// Crash handling: a crash report in the spirit of the game's crash-reports/*.txt, shown on a full-page screen made of
// plain DOM (the renderer may be the thing that broke). Used for exceptions in the game loop and failures at startup.
import { tr } from './gui/i18n.js';

// One-liners for the report header (MinecraftJS's own)
const COMMENTS = [
  'Well, that block was not supposed to go there.',
  'The creeper was inside the code all along.',
  'It worked fine in the last chunk.',
  'Somebody divided by a cactus.',
  'Have you tried turning the redstone off and on again?',
  'This is fine. Everything is on fire, but this is fine.',
  'The pixels went on strike.',
  'A wild exception appeared!',
  'Not my best tick.',
  'I promise this never happens in survival mode.',
  'Steve would like to apologise.',
  'Even the Ender Dragon has off days.',
];

const pad = (n) => String(n).padStart(2, '0');
function stamp(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }

// The report text: header, description, the error with its stack, then what the game was doing and on what system
export function buildCrashReport(error, description, game) {
  const now = new Date();
  const lines = [];
  lines.push('---- MinecraftJS Crash Report ----');
  lines.push('// ' + COMMENTS[Math.floor(Math.random() * COMMENTS.length)]);
  lines.push('');
  lines.push('Time: ' + stamp(now));
  lines.push('Description: ' + description);
  lines.push('');
  const err = error instanceof Error ? error : new Error(String(error));
  lines.push(String(err.stack || (err.name + ': ' + err.message)).replace(/\n\s*/g, '\n\tat ').replace(/\n\tat at /g, '\n\tat '));
  lines.push('');
  lines.push('');
  lines.push('A detailed walkthrough of the error, its code path and all known details is as follows:');
  lines.push('---------------------------------------------------------------------------------------');
  lines.push('');
  if (game) {
    lines.push('-- Affected game --');
    lines.push('Details:');
    const safe = (label, fn) => { try { lines.push(`\t${label}: ${fn()}`); } catch (e) { lines.push(`\t${label}: ~~ERROR~~ ${e.message}`); } };
    safe('In world', () => (game.inWorld ? 'Yes' : 'No'));
    safe('Server', () => (game.serverAddress ? game.serverAddress.host + ':' + game.serverAddress.port : 'none'));
    safe('Player position', () => (game.player ? [game.player.x, game.player.y, game.player.z].map((v) => v.toFixed(3)).join(', ') : 'none'));
    safe('Dimension', () => (game.world && game.world.dimension !== undefined ? game.world.dimension : 'none'));
    safe('Game mode', () => game.gameMode);
    safe('Screen', () => (game.screens && game.screens.current ? game.screens.current.constructor.name : 'none'));
    safe('Loaded chunks', () => (game.world && game.world.chunks ? game.world.chunks.size : 0));
    safe('Entities', () => (game.entities && game.entities.map ? game.entities.map.size : 0));
    safe('FPS', () => game.fps);
    lines.push('');
  }
  lines.push('-- System Details --');
  lines.push('Details:');
  const sys = (label, fn) => { try { const v = fn(); if (v !== undefined && v !== null && v !== '') lines.push(`\t${label}: ${v}`); } catch (e) { /* not available */ } };
  sys('MinecraftJS Version', () => tr('minecraftjs.version'));
  sys('Graphics API', () => game && game.device && game.device.name);
  sys('Renderer', () => game && game.device && game.device.info && [game.device.info.vendor, game.device.info.renderer, game.device.info.version].filter(Boolean).join(' / '));
  sys('Super Potato Mode', () => (game && game.settings ? (game.settings.superPotato || (game.device && game.device.name === 'Software') ? 'on' : 'off') : undefined));
  sys('Browser', () => navigator.userAgent);
  sys('Screen', () => `${screen.width}x${screen.height} @${window.devicePixelRatio || 1}x, window ${innerWidth}x${innerHeight}`);
  sys('Memory', () => (performance.memory ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)} MB used / ${(performance.memory.jsHeapSizeLimit / 1048576).toFixed(0)} MB limit` : undefined));
  sys('CPU threads', () => navigator.hardwareConcurrency);
  sys('Page', () => location.href.split('?')[0]);
  return lines.join('\n');
}

let shown = false;

// Full-page crash screen: title, the report in a scrolling box, and copy / save / reload buttons
export function showCrashScreen(report) {
  console.error(report);
  if (shown || typeof document === 'undefined') return;
  shown = true;
  const css = `
#crash{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px 16px;box-sizing:border-box;
  background:#2a2017 repeating-conic-gradient(#33281c 0 25%,#2a2017 0 50%) 0 0/32px 32px;color:#e0e0e0;font:14px/1.4 monospace;overflow:auto}
#crash h1{margin:8px 0 0;font:bold 28px monospace;color:#fff;text-shadow:3px 3px 0 #3f3f3f;text-align:center}
#crash .sub{color:#a0a0a0;text-align:center;max-width:860px}
#crash textarea{margin:0;width:min(1000px,100%);flex:1 1 auto;min-height:200px;overflow:auto;background:rgba(0,0,0,.55);border:2px solid #000;
  box-shadow:inset 0 0 0 2px #555;padding:12px;white-space:pre-wrap;word-break:break-word;color:#ddd;font:12px/1.4 monospace;box-sizing:border-box;resize:none;user-select:text;-webkit-user-select:text;cursor:text}
#crash .buttons{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
#crash button{min-width:160px;padding:8px 16px;font:15px monospace;color:#fff;text-shadow:2px 2px 0 #3f3f3f;cursor:pointer;
  background:#6f6f6f linear-gradient(#8a8a8a,#5f5f5f);border:2px solid #000;box-shadow:inset 0 2px 0 #aaa,inset 0 -2px 0 #444}
#crash button:hover{background:#7d8bc4 linear-gradient(#93a0d8,#6573b0);color:#ffffa0}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.id = 'crash';
  const h1 = document.createElement('h1'); h1.textContent = 'MinecraftJS has crashed!';
  const sub = document.createElement('div'); sub.className = 'sub';
  sub.textContent = 'Something went wrong and the game had to stop. The crash report below explains what happened; please include it when reporting the problem.';
  // A native read-only text control supports selection, Ctrl/Cmd+A and copying
  // independently of the game's canvas and its user-select:none styling.
  const text = document.createElement('textarea'); text.value = report; text.readOnly = true;
  text.setAttribute('aria-label', 'Crash report'); text.spellcheck = false;
  // Keep game-wide input listeners from cancelling native scrolling, text
  // selection, keyboard shortcuts, or the report's context menu after a crash.
  for (const type of ['mousedown', 'mouseup', 'mousemove', 'wheel', 'contextmenu', 'keydown', 'keyup', 'paste']) {
    root.addEventListener(type, (event) => event.stopPropagation());
  }
  const buttons = document.createElement('div'); buttons.className = 'buttons';
  const button = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; buttons.appendChild(b); return b; };
  const copy = button('Copy crash report', async () => {
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(report); copy.textContent = 'Copied!'; return; } catch { /* fall back below */ }
    }
    // Clipboard API is unavailable on ordinary LAN HTTP pages. execCommand
    // still supports user-initiated copying there; keep the selection if denied.
    text.focus(); text.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { /* manual copy remains available */ }
    copy.textContent = copied ? 'Copied!' : (/Mac|iPhone|iPad/.test(navigator.platform) ? 'Press Cmd+C to copy' : 'Press Ctrl+C to copy');
  });
  button('Save crash report', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([report], { type: 'text/plain' }));
    a.download = 'crash-' + stamp(new Date()).replace(/[: ]/g, '-') + '.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  button('Reload game', () => location.reload());
  root.append(h1, sub, text, buttons);
  if (document.pointerLockElement) document.exitPointerLock();
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
  document.body.appendChild(root);
}
