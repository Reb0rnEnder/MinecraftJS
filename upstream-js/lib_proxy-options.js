const net = require('node:net');
const dns = require('node:dns').promises;
const privatePack = new net.BlockList();
for(const [ip,bits,type] of [['10.0.0.0',8,'ipv4'],['172.16.0.0',12,'ipv4'],['192.168.0.0',16,'ipv4'],['169.254.0.0',16,'ipv4'],['fc00::',7,'ipv6'],['fe80::',10,'ipv6']])privatePack.addSubnet(ip,bits,type);
const loopback = new net.BlockList();
loopback.addSubnet('127.0.0.0', 8, 'ipv4');
loopback.addAddress('0.0.0.0', 'ipv4');
loopback.addAddress('::1', 'ipv6');
loopback.addAddress('::', 'ipv6');
function proxyOptions(argv = process.argv.slice(2), env = process.env) {
  const options = {proxyOnly: env.PROXY_ONLY === '1', allowLoopback: env.ALLOW_LOOPBACK === '1'};
  for (const arg of argv) {
    if (arg === '--proxy-only') options.proxyOnly = true;
    else if (arg === '--allow-loopback') options.allowLoopback = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error('Unknown proxy option: ' + arg);
  }
  return options;
}
function isLoopback(address) {
  const family = net.isIP(address);
  return !!family && loopback.check(address, family === 6 ? 'ipv6' : 'ipv4');
}
async function resolveTarget(host, port, {allowLoopback = false, lookup = dns.lookup} = {}) {
  if (typeof host !== 'string' || !host || /[\s\0/\\]/.test(host)) throw new Error('Invalid target hostname');
  host = host.replace(/^\[([^\]]+)\]$/, '$1');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid target port');
  if (!allowLoopback && /(^|\.)localhost\.?$/i.test(host)) throw new Error('Loopback connections are disabled');
  const addresses = net.isIP(host) ? [{address: host, family: net.isIP(host)}] : await lookup(host, {all: true});
  if (!addresses.length) throw new Error('Target has no addresses');
  if (!allowLoopback && addresses.some(a => isLoopback(a.address))) throw new Error('Loopback connections are disabled');
  // Pin the validated DNS answer: the socket must not resolve the hostname again.
  return {host: addresses[0].address, port};
}
module.exports = {proxyOptions, isLoopback, resolveTarget};

// Resolve and validate every redirect, then pin the connection to that answer.
async function openPack(url, headers, options, signal, redirects = 0) {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid resource pack URL');
  if (redirects > 5) throw new Error('Too many resource pack redirects');
  const target = await resolveTarget(url.hostname, Number(url.port) || (url.protocol === 'https:' ? 443 : 80), options);
  // Resource pack fetching remains restricted to public hosts (the TCP bridge may reach LAN servers).
  if (privatePack.check(target.host,net.isIP(target.host)===6?'ipv6':'ipv4')) throw new Error('Private resource pack host');
  const response = await new Promise((resolve, reject) => {
    const transport = require(url.protocol === 'https:' ? 'node:https' : 'node:http');
    const request = transport.get(url, {headers, signal, lookup(_host, opts, callback) {
      const answer = {address: target.host, family: net.isIP(target.host)};
      if (opts.all) callback(null, [answer]); else callback(null, answer.address, answer.family);
    }}, resolve);
    request.on('error', reject);
  });
  if ([301,302,303,307,308].includes(response.statusCode) && response.headers.location) {
    response.resume();
    return openPack(new URL(response.headers.location,url),headers,options,signal,redirects+1);
  }
  return response;
}
module.exports.openPack = openPack;
