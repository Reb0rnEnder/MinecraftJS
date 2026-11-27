// Microsoft account -> Minecraft Java login done by the client itself over its own HTTPS (net/https.js: TLS over a
// raw TCP route), so no HTTP-relaying server is needed. Same flow as the proxy's lib/msauth.js:
//   login.live.com device code -> Xbox Live user token -> XSTS -> login_with_xbox -> Minecraft profile
// plus the Mojang services the client uses (privileges, block list, chat signing certificates, session join).
import { postForm, postJson, httpsRequest } from '../net/https.js';

const CLIENT_ID = '00000000441cc96b', SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL';
const XBL = { 'x-xbl-contract-version': '1' };
const bearer = (token) => { if (typeof token !== 'string' || !token.trim()) throw Error('Missing Minecraft session'); return { Authorization: 'Bearer ' + token }; };

export async function startDeviceCode() {
  const r = await postForm('https://login.live.com/oauth20_connect.srf', { client_id: CLIENT_ID, scope: SCOPE, response_type: 'device_code' }), json = r.json() || {};
  if (!json.device_code) throw Error(json.error_description || 'Could not start Microsoft sign in');
  return { userCode: json.user_code, deviceCode: json.device_code, verificationUri: json.verification_uri, interval: json.interval || 5, expiresIn: json.expires_in || 900 };
}

// Null while the user has not finished signing in
export async function pollDeviceCode(deviceCode) {
  const json = (await postForm('https://login.live.com/oauth20_token.srf', { client_id: CLIENT_ID, device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' })).json() || {};
  if (json.error === 'authorization_pending' || json.error === 'slow_down') return null;
  if (json.error === 'expired_token') throw Error('The sign in code expired. Please try again.');
  if (json.error === 'authorization_declined') throw Error('Sign in was cancelled.');
  if (!json.access_token) throw Error(json.error_description || 'Microsoft sign in failed');
  return minecraftLogin(json.access_token, json.refresh_token);
}

export async function refresh(refreshToken) {
  const json = (await postForm('https://login.live.com/oauth20_token.srf', { client_id: CLIENT_ID, refresh_token: refreshToken, grant_type: 'refresh_token', scope: SCOPE })).json() || {};
  if (!json.access_token) throw Error('Your Microsoft session expired. Please sign in again.');
  return minecraftLogin(json.access_token, json.refresh_token || refreshToken);
}

const XSTS_ERRORS = {
  2148916233: 'This Microsoft account has no Xbox profile. Sign in once at minecraft.net to create one.',
  2148916235: 'Xbox Live is not available in your country.',
  2148916236: 'This account needs adult verification on the Xbox website.',
  2148916237: 'This account needs adult verification on the Xbox website.',
  2148916238: 'This is a child account; it must be added to a Microsoft family by an adult.',
};

export async function minecraftLogin(msaToken, refreshToken) {
  const xbl = await postJson('https://user.auth.xboxlive.com/user/authenticate', { Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: 't=' + msaToken }, RelyingParty: 'http://auth.xboxlive.com', TokenType: 'JWT' }, XBL);
  const xblJson = xbl.json() || {};
  if (!xblJson.Token) throw Error('Xbox Live sign in failed (HTTP ' + xbl.status + ')');
  const xsts = await postJson('https://xsts.auth.xboxlive.com/xsts/authorize', { Properties: { SandboxId: 'RETAIL', UserTokens: [xblJson.Token] }, RelyingParty: 'rp://api.minecraftservices.com/', TokenType: 'JWT' }, XBL);
  const xstsJson = xsts.json() || {};
  if (!xstsJson.Token) throw Error(XSTS_ERRORS[xstsJson.XErr] || 'Xbox Live authorization failed (HTTP ' + xsts.status + (xstsJson.XErr ? ', ' + xstsJson.XErr : '') + ')');
  const uhs = xstsJson.DisplayClaims.xui[0].uhs;
  const mc = await postJson('https://api.minecraftservices.com/authentication/login_with_xbox', { identityToken: `XBL3.0 x=${uhs};${xstsJson.Token}` }), mcJson = mc.json() || {};
  if (!mcJson.access_token) throw Error('Minecraft services rejected the Xbox token (HTTP ' + mc.status + ')');
  const pr = await httpsRequest('https://api.minecraftservices.com/minecraft/profile', { headers: bearer(mcJson.access_token) });
  if (pr.status === 404) throw Error("This Microsoft account doesn't own Minecraft: Java Edition.");
  const profile = pr.json() || {};
  if (!profile.id) throw Error('Could not load the Minecraft profile (HTTP ' + pr.status + ')');
  const skin = (profile.skins || []).find((k) => k.state === 'ACTIVE') || (profile.skins || [])[0];
  return { type: 'microsoft', name: profile.name, skinUrl: skin ? skin.url : null, slim: !!(skin && skin.variant === 'SLIM'), uuid: profile.id, accessToken: mcJson.access_token, expiresAt: Date.now() + (mcJson.expires_in || 86400) * 1000, refreshToken };
}

export async function socialPrivileges(accessToken) {
  const r = await httpsRequest('https://api.minecraftservices.com/privileges', { headers: bearer(accessToken), timeout: 10000 }), data = r.json();
  if (r.status !== 200 || !data?.privileges || typeof data.privileges !== 'object') throw Error('Could not load account privileges (HTTP ' + r.status + ')');
  return Object.fromEntries(['onlineChat', 'multiplayerServer', 'multiplayerRealms', 'telemetry'].map((name) => [name, data.privileges[name]?.enabled === true]));
}

export async function blockedProfiles(accessToken) {
  const r = await httpsRequest('https://api.minecraftservices.com/privacy/blocklist', { headers: bearer(accessToken), timeout: 10000 }), data = r.json();
  if (r.status !== 200) throw Error('Could not load the account block list (HTTP ' + r.status + ')');
  if (!Array.isArray(data?.blockedProfiles) || data.blockedProfiles.some((u) => typeof u !== 'string' || !(/^[0-9a-f]{32}$/i.test(u) || /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(u)))) throw Error('Invalid account block list response');
  return data.blockedProfiles;
}

// player/certificates: the account's chat signing key pair, signed by Mojang
export async function certificates(accessToken) {
  const r = await httpsRequest('https://api.minecraftservices.com/player/certificates', { method: 'POST', headers: bearer(accessToken), timeout: 10000 }), data = r.json();
  if (r.status !== 200) throw Error('Could not load the chat signing key (HTTP ' + r.status + ')');
  if (typeof data?.keyPair?.privateKey !== 'string' || typeof data?.keyPair?.publicKey !== 'string' || typeof data.publicKeySignatureV2 !== 'string') throw Error('Invalid chat signing key response');
  return { keyPair: { privateKey: data.keyPair.privateKey, publicKey: data.keyPair.publicKey }, publicKeySignatureV2: data.publicKeySignatureV2, expiresAt: data.expiresAt, refreshedAfter: data.refreshedAfter };
}

// sessionserver join for online-mode servers (the server hash is computed by the caller)
export async function joinServer(accessToken, uuid, hash) {
  const r = await postJson('https://sessionserver.mojang.com/session/minecraft/join', { accessToken, selectedProfile: String(uuid).replace(/-/g, ''), serverId: hash });
  if (r.status === 204 || r.status === 200) return;
  const json = r.json() || {}, msg = json.errorMessage || json.error || '';
  if (r.status === 403) throw Error('Invalid session (try signing in again). ' + msg);
  throw Error('Could not join the server session (HTTP ' + r.status + ') ' + msg);
}
