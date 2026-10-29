// Run the pinned target constructors, including their native UV-mapped vertices.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {execFileSync} = require('child_process');
exports.extractModels = function (jar) {
  const root = path.join(__dirname, '..');
  const cache = path.join(root, 'cache/port-1.16.5');
  const client = path.join(cache, 'client.jar');
  const expected = '37fd3c903861eeff3bc24b71eed48f828b5269c8';
  const hash = data => crypto.createHash('sha1').update(data).digest('hex');
  if (hash(jar.data) !== expected || hash(fs.readFileSync(client)) !== expected) throw Error('Native model extraction requires the official 1.16.5 client jar');
  execFileSync('java', ['-cp', client + path.delimiter + path.join(cache, 'server.jar'), path.join(root, 'tools/port-1.16.5/ExtractModels.java'), path.join(cache, 'client.txt'), path.join(root, 'tools/port-1.16.5/model-specs.json'), path.join(cache, 'native-models.json')], {stdio: ['ignore', 'pipe', 'pipe']});
  const result = JSON.parse(fs.readFileSync(path.join(cache, 'native-models.json')));
  return {models: result.models, errors: Object.entries(result.errors).map(([key, error]) => key + ': ' + error)};
};
