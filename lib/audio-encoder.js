// Shared by the HTML, static-site and development-asset builders.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

function validateAudioOptions(opts = {}) {
  if (opts.audio !== undefined && !['opus', 'vorbis', 'copy'].includes(opts.audio)) {
    throw new Error('--audio must be opus, vorbis or copy (default: opus)');
  }
  for (const key of ['sfx-kbps', 'music-kbps']) {
    if (opts[key] !== undefined && (typeof opts[key] === 'boolean' || !/^\d+$/.test(String(opts[key])) || Number(opts[key]) < 6 || Number(opts[key]) > 512)) {
      throw new Error('--' + key + ' must be an integer from 6 to 512 kbps');
    }
  }
  if ((opts.audio || 'opus') === 'opus' && [opts['sfx-kbps'], opts['music-kbps']].some(n => Number(n) > 510)) {
    throw new Error('Opus bitrates must not exceed 510 kbps');
  }
}

function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const exe of ['ffmpeg', 'ffmpeg.exe']) {
      const p = path.join(dir, exe);
      if (fs.existsSync(p)) return p;
    }
  }
  try { return require('ffmpeg-static'); } catch (e) { return null; }
}

function run(exe, args, input) {
  return new Promise((resolve, reject) => {
    const child = execFile(exe, args, { encoding: 'buffer', maxBuffer: 1 << 30 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr.toString().trim().split('\n').pop() || err.message));
      else resolve(stdout);
    });
    child.stdin.end(input);
  });
}

class AudioEncoder {
  constructor(opts = {}) {
    validateAudioOptions(opts);
    this.codec = opts.audio || 'opus';
    this.sfxKbps = Number(opts['sfx-kbps'] ?? 32);
    this.musicKbps = Number(opts['music-kbps'] ?? 48);
    this.ffmpeg = this.codec === 'copy' ? null : findFfmpeg();
    if (this.codec !== 'copy' && !this.ffmpeg) {
      console.warn('ffmpeg not found (install it, set FFMPEG, or `npm install`): sounds are copied uncompressed');
      this.codec = 'copy';
    }
    this.cacheDir = opts.cacheDir || path.join(require('./mcassets').CACHE_DIR, 'audio');
  }

  // Music and records are stereo at a higher bitrate; positional effects are mono (vanilla plays them as mono sources)
  async encode(rel, bytes) {
    if (this.codec === 'copy') return bytes;
    const music = /^(music|records)\//.test(rel);
    const kbps = music ? this.musicKbps : this.sfxKbps;
    const key = crypto.createHash('sha1').update(bytes).digest('hex') + `-${this.codec}-${kbps}${music ? 's' : 'm'}.ogg`;
    const cached = path.join(this.cacheDir, key);
    if (fs.existsSync(cached) && fs.statSync(cached).size > 0) return fs.readFileSync(cached);
    if (!bytes.length) throw new Error('Empty sound file ' + rel);
    const codecArgs = this.codec === 'opus'
      ? ['-c:a', 'libopus', '-b:a', kbps + 'k', '-vbr', 'on', '-application', 'audio']
      : ['-c:a', 'libvorbis', '-b:a', kbps + 'k'];
    const out = await run(this.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-vn', '-map_metadata', '-1',
      ...(music ? [] : ['-ac', '1']), ...codecArgs, '-f', 'ogg', 'pipe:1'], bytes);
    // Keep the original when re-encoding does not make it smaller (tiny clips)
    const result = out.length && out.length < bytes.length ? out : bytes;
    fs.mkdirSync(this.cacheDir, { recursive: true });
    fs.writeFileSync(cached + '.tmp', result); // rename: an interrupted build never leaves a partial entry
    fs.renameSync(cached + '.tmp', cached);
    return result;
  }
}

module.exports = { AudioEncoder, findFfmpeg, validateAudioOptions };
