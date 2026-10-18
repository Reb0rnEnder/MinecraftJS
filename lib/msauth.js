// Microsoft account -> Minecraft Java login (OAuth device code flow) and the Mojang session handshake
// used to join online-mode servers.
//
//   Microsoft (login.live.com device code) -> Xbox Live user token -> XSTS token
//   -> api.minecraftservices.com login_with_xbox -> Minecraft access token + profile
//
// The OAuth client id defaults to the public Minecraft (Nintendo Switch) title id that open source
// launchers use for device-code sign in; set MSA_CLIENT_ID to use your own registered application.
const crypto = require('crypto');

const CLIENT_ID = process.env.MSA_CLIENT_ID || '00000000441cc96b';
const SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL';

async function postForm(url, params) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
  const text = await r.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch (e) { json = { error: 'bad_response', error_description: text.slice(0, 200) }; }
  return { status: r.status, json };
}

async function postJson(url, body, headers = {}) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', ...headers }, body: JSON.stringify(body) });
  const text = await r.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch (e) { json = {}; }
  return { status: r.status, json, headers: r.headers };
}

class AuthError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

// Step 1: ask Microsoft for a device code the user enters at verification_uri
async function startDeviceCode() {
  const { json } = await postForm('https://login.live.com/oauth20_connect.srf', { client_id: CLIENT_ID, scope: SCOPE, response_type: 'device_code' });
  if (!json.device_code) throw new AuthError(json.error_description || 'Could not start Microsoft sign in', json.error);
  return { userCode: json.user_code, deviceCode: json.device_code, verificationUri: json.verification_uri, interval: json.interval || 5, expiresIn: json.expires_in || 900 };
}

// Step 2: poll until the user has signed in. Returns null while pending.
async function pollDeviceCode(deviceCode) {
  const { json } = await postForm('https://login.live.com/oauth20_token.srf', {
    client_id: CLIENT_ID, device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  });
  if (json.error === 'authorization_pending' || json.error === 'slow_down') return null;
  if (json.error === 'expired_token') throw new AuthError('The sign in code expired. Please try again.', json.error);
  if (json.error === 'authorization_declined') throw new AuthError('Sign in was cancelled.', json.error);
  if (!json.access_token) throw new AuthError(json.error_description || 'Microsoft sign in failed', json.error);
  return minecraftLogin(json.access_token, json.refresh_token);
}

// Exchange a stored Microsoft refresh token for fresh tokens
async function refresh(refreshToken) {
  const { json } = await postForm('https://login.live.com/oauth20_token.srf', {
    client_id: CLIENT_ID, refresh_token: refreshToken, grant_type: 'refresh_token', scope: SCOPE,
  });
  if (!json.access_token) throw new AuthError('Your Microsoft session expired. Please sign in again.', json.error || 'refresh_failed');
  return minecraftLogin(json.access_token, json.refresh_token || refreshToken);
}

const XSTS_ERRORS = {
  2148916233: 'This Microsoft account has no Xbox profile. Sign in once at minecraft.net to create one.',
  2148916235: 'Xbox Live is not available in your country.',
  2148916236: 'This account needs adult verification on the Xbox website.',
  2148916237: 'This account needs adult verification on the Xbox website.',
  2148916238: 'This is a child account; it must be added to a Microsoft family by an adult.',
};

async function minecraftLogin(msaToken, refreshToken) {
  const xbl = await postJson('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: 't=' + msaToken },
    RelyingParty: 'http://auth.xboxlive.com', TokenType: 'JWT',
  }, { 'x-xbl-contract-version': '1' });
  if (!xbl.json.Token) throw new AuthError('Xbox Live sign in failed (HTTP ' + xbl.status + ')', 'xbl');

  const xsts = await postJson('https://xsts.auth.xboxlive.com/xsts/authorize', {
    Properties: { SandboxId: 'RETAIL', UserTokens: [xbl.json.Token] },
    RelyingParty: 'rp://api.minecraftservices.com/', TokenType: 'JWT',
  }, { 'x-xbl-contract-version': '1' });
  if (!xsts.json.Token) {
    const msg = XSTS_ERRORS[xsts.json.XErr] || 'Xbox Live authorization failed (HTTP ' + xsts.status + (xsts.json.XErr ? ', ' + xsts.json.XErr : '') + ')';
    throw new AuthError(msg, 'xsts');
  }
  const uhs = xsts.json.DisplayClaims.xui[0].uhs;

  const mc = await postJson('https://api.minecraftservices.com/authentication/login_with_xbox', { identityToken: `XBL3.0 x=${uhs};${xsts.json.Token}` });
  if (!mc.json.access_token) throw new AuthError('Minecraft services rejected the Xbox token (HTTP ' + mc.status + ')', 'mc_login');

  const pr = await fetch('https://api.minecraftservices.com/minecraft/profile', { headers: { authorization: 'Bearer ' + mc.json.access_token } });
  if (pr.status === 404) throw new AuthError("This Microsoft account doesn't own Minecraft: Java Edition.", 'no_profile');
  const profile = await pr.json();
  if (!profile.id) throw new AuthError('Could not load the Minecraft profile (HTTP ' + pr.status + ')', 'profile');
  const skin = (profile.skins || []).find((k) => k.state === 'ACTIVE') || (profile.skins || [])[0];
  return {
    type: 'microsoft',
    name: profile.name,
    skinUrl: skin ? skin.url : null,
    slim: !!(skin && skin.variant === 'SLIM'),
    uuid: profile.id,
    accessToken: mc.json.access_token,
    expiresAt: Date.now() + (mc.json.expires_in || 86400) * 1000,
    refreshToken,
  };
}

// ------------------------------------------------------------------ session (online-mode join)

// Minecraft's "server hash": SHA-1 as a signed (two's complement) hex number
function serverHash(serverId, secret, publicKey) {
  const d = crypto.createHash('sha1').update(Buffer.from(serverId, 'latin1')).update(secret).update(publicKey).digest();
  const negative = (d[0] & 0x80) !== 0;
  if (negative) {
    let carry = 1;
    for (let i = d.length - 1; i >= 0; i--) { const v = (~d[i] & 0xff) + carry; d[i] = v & 0xff; carry = v >> 8; }
  }
  const hex = d.toString('hex').replace(/^0+/, '');
  return (negative ? '-' : '') + (hex || '0');
}

async function joinServer(accessToken, uuid, hash) {
  const r = await fetch('https://sessionserver.mojang.com/session/minecraft/join', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accessToken, selectedProfile: uuid.replace(/-/g, ''), serverId: hash }),
  });
  if (r.status === 204 || r.status === 200) return;
  let msg = '';
  try { const j = await r.json(); msg = j.errorMessage || j.error || ''; } catch (e) { /* empty body */ }
  if (r.status === 403) throw new AuthError('Invalid session (try signing in again). ' + msg, 'session');
  throw new AuthError('Could not join the server session (HTTP ' + r.status + ') ' + msg, 'session');
}

module.exports = { startDeviceCode, pollDeviceCode, refresh, serverHash, joinServer, AuthError };
