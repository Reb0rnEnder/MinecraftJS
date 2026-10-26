// Run the pinned target constructors, including their native UV-mapped vertices.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {execFileSync} = require('child_process');
exports.extractModels = function (jar) {
  const root = path.join(__dirname, '..');
  const cache = path.join(root, 'cache/port-1.15.2');
  const client = path.join(cache, 'client.jar');
  const expected = 'e3f78cd16f9eb9a52307ed96ebec64241cc5b32d';
  const hash = data => crypto.createHash('sha1').update(data).digest('hex');
  if (hash(jar.data) !== expected || hash(fs.readFileSync(client)) !== expected) throw Error('Native model extraction requires the official 1.15.2 client jar');
  execFileSync('java', ['-cp', client + path.delimiter + path.join(cache, 'server.jar'), path.join(root, 'tools/port-1.15.2/ExtractModels.java'), path.join(cache, 'client.txt'), path.join(root, 'tools/port-1.15.2/model-specs.json'), path.join(cache, 'native-models.json')], {stdio: ['ignore', 'pipe', 'pipe']});
  const result = JSON.parse(fs.readFileSync(path.join(cache, 'native-models.json')));
  return {models: result.models, errors: Object.entries(result.errors).map(([key, error]) => key + ': ' + error)};
};
