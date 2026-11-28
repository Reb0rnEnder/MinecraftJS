// Native 1.20.6 player reporting (net.minecraft.client.multiplayer.chat.report + authlib AbuseReportRequest):
// the per-server ChatLog of shown messages, chat/skin/name report builders, ChatReportContextBuilder evidence,
// the ChatSelectionLogFiller paging used by the selection screen, and the services request body.

// authlib AbuseReportLimits.DEFAULTS (YggdrasilUserApiService.getAbuseReportLimits)
export const REPORT_LIMITS = Object.freeze({ maxOpinionCommentsLength: 1000, maxReportedMessageCount: 4, maxEvidenceMessageCount: 40, leadingContextMessageCount: 9, trailingContextMessageCount: 0 });
// ReportReason in declaration order; backend names are the upper-cased ids
export const REPORT_REASONS = ['generic', 'hate_speech', 'harassment_or_bullying', 'self_harm_or_suicide', 'imminent_harm', 'defamation_impersonation_false_information', 'alcohol_tobacco_drugs', 'child_sexual_exploitation_or_abuse', 'terrorism_or_violent_extremism', 'non_consensual_intimate_imagery'];
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
export const undashed = (u) => String(u).replace(/-/g, '').toLowerCase();
const dashed = (u) => { const s = undashed(u); return s.length === 32 ? `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}` : String(u); };
const sameUuid = (a, b) => a != null && b != null && undashed(a) === undashed(b);
const b64 = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
const sigKey = (sig) => (sig ? b64(sig) : null);

// ChatLog: a ring buffer with ever-increasing event ids; start() is the oldest id still held
export class ChatLog {
  constructor(capacity = 1024) { this.buffer = new Array(capacity).fill(null); this.nextId = 0; }
  push(event) { this.buffer[this.nextId++ % this.buffer.length] = event; }
  lookup(id) { return id >= this.start() && id <= this.end() ? this.buffer[id % this.buffer.length] : null; }
  start() { return Math.max(this.nextId - this.buffer.length, 0); }
  end() { return this.nextId - 1; }
}

// PlayerChatMessage as logged: link (index, sender, session), body (content, timestamp, salt, lastSeen), signature
export function loggedPlayerMessage(packet, sessionId, lastSeen, profile, trust, content) {
  const signed = !!packet.signature && !!sessionId;
  return {
    type: 'player', profile, trust, content,
    message: {
      link: signed ? { index: packet.index, sender: packet.sender, sessionId } : { index: 0, sender: packet.sender, sessionId: NIL_UUID },
      signature: packet.signature ? Uint8Array.from(packet.signature) : null, signatureKey: sigKey(packet.signature),
      content: packet.plainMessage, timestamp: Number(packet.timestamp), salt: BigInt(String(packet.salt ?? 0)),
      lastSeen: (lastSeen || []).map((s) => Uint8Array.from(s)), filtered: packet.filterType === 1,
    },
  };
}
export const loggedSystemMessage = (text, time = Date.now()) => ({ type: 'system', text, time });

// PlayerChatMessage.hasSignatureFrom / SignedMessageLink.isDescendantOf / record equality
export const hasSignatureFrom = (m, uuid) => !!m.signature && sameUuid(m.link.sender, uuid);
const isDescendantOf = (link, other) => link.index > other.index && sameUuid(link.sender, other.sender) && sameUuid(link.sessionId, other.sessionId);
const sameMessage = (a, b) => !!a && !!b && a.signatureKey === b.signatureKey && a.link.index === b.link.index && sameUuid(a.link.sender, b.link.sender) && a.timestamp === b.timestamp && a.content === b.content;

// ChatReportContextBuilder: each reported message collects up to `leading` earlier messages of its chain or that
// it had seen (its lastSeen signatures)
export class ChatReportContextBuilder {
  constructor(leading) { this.leading = leading; this.collectors = []; }
  collectAllContext(log, reported, handler) {
    const pending = new Set(reported);
    for (let id = pending.size ? Math.max(...pending) : -1; id >= log.start() && (this.isActive() || pending.size); id--) {
      const event = log.lookup(id);
      if (event?.type !== 'player') continue;
      const accepted = this.acceptContext(event.message);
      if (pending.delete(id)) { this.trackContext(event.message); handler(id, event); continue; }
      if (accepted) handler(id, event);
    }
  }
  trackContext(message) {
    const collector = { seen: new Set(message.lastSeen.map(sigKey)), last: message, chain: true, count: 0 };
    collector.accept = (m) => {
      if (sameMessage(m, collector.last)) return false;
      let hit = collector.seen.delete(m.signatureKey);
      if (collector.chain && sameUuid(collector.last.link.sender, m.link.sender)) {
        if (isDescendantOf(collector.last.link, m.link)) { hit = true; collector.last = m; } else collector.chain = false;
      }
      if (hit) collector.count++;
      return hit;
    };
    collector.complete = () => collector.count >= this.leading || !collector.chain && collector.seen.size === 0;
    this.collectors.push(collector);
  }
  acceptContext(message) {
    let accepted = false;
    this.collectors = this.collectors.filter((c) => { if (!c.accept(message)) return true; accepted = true; return !c.complete(); });
    return accepted;
  }
  isActive() { return this.collectors.length > 0; }
}

// ChatSelectionLogFiller: pages backwards through the log, emitting reportable messages, their context, "join"
// dividers between unrelated chains of the reported player and "fold" dividers for skipped messages
export class ChatSelectionLogFiller {
  constructor(context, canReport) {
    this.log = context.chatLog; this.builder = new ChatReportContextBuilder(context.limits.leadingContextMessageCount);
    this.canReport = canReport; this.previousLink = null; this.eventId = this.log.end(); this.missed = 0; this.lastMessage = null;
  }
  fillNextPage(count, out) {
    let added = 0, event;
    while (added < count && (event = this.log.lookup(this.eventId)) != null) {
      const id = this.eventId--;
      if (event.type !== 'player' || sameMessage(event.message, this.lastMessage)) continue;
      if (this.acceptMessage(out, event)) {
        if (this.missed > 0) { out.acceptDivider({ key: 'gui.chatSelection.fold', args: [this.missed] }); this.missed = 0; }
        out.acceptMessage(id, event);
        added++;
      } else this.missed++;
      this.lastMessage = event.message;
    }
  }
  acceptMessage(out, event) {
    const m = event.message, context = this.builder.acceptContext(m);
    if (this.canReport(event)) {
      this.builder.trackContext(m);
      if (this.previousLink && !isDescendantOf(this.previousLink, m.link)) out.acceptDivider({ key: 'gui.chatSelection.join', args: [event.profile.name], yellow: true });
      this.previousLink = m.link;
      return true;
    }
    return context;
  }
}

// Report + ChatReport/SkinReport/NameReport builders
export class ReportBuilder {
  constructor(type, reportedProfileId, extra = {}, limits = REPORT_LIMITS) {
    this.type = type; this.limits = limits;
    this.report = { reportId: extra.reportId ?? randomUuid(), createdAt: extra.createdAt ?? Date.now(), reportedProfileId, comments: '', reason: null, reported: new Set(), name: extra.name ?? null, skin: extra.skin ?? null };
  }
  static from(report, type, limits = REPORT_LIMITS) { const b = new ReportBuilder(type, report.reportedProfileId, {}, limits); b.report = copyReport(report); return b; }
  copy() { return ReportBuilder.from(this.report, this.type, this.limits); }
  get comments() { return this.report.comments; }
  setComments(s) { this.report.comments = s; }
  get reason() { return this.report.reason; }
  setReason(r) { this.report.reason = r; }
  isReported(id) { return this.report.reported.has(id); }
  toggleReported(id) { const s = this.report.reported; if (s.has(id)) s.delete(id); else if (s.size < this.limits.maxReportedMessageCount) s.add(id); }
  hasContent() { return this.type === 'chat' ? !!this.report.comments || this.report.reported.size > 0 || this.report.reason != null : this.type === 'skin' ? !!this.report.comments || this.report.reason != null : !!this.report.comments; }
  checkBuildable() {
    const r = this.report;
    if (this.type === 'chat') {
      if (!r.reported.size) return 'gui.chatReport.send.no_reported_messages';
      if (r.reported.size > this.limits.maxReportedMessageCount) return 'gui.chatReport.send.too_many_messages';
    }
    if (this.type !== 'name' && r.reason == null) return 'gui.abuseReport.send.no_reason';
    if (r.comments.length > this.limits.maxOpinionCommentsLength) return 'gui.abuseReport.send.comment_too_long';
    return null;
  }
  // Report.Builder.build -> { id, reportType, report } (AbuseReport.chat / skin / name)
  build(context) {
    const problem = this.checkBuildable();
    if (problem) return { error: problem };
    // AbuseReport record order: opinionComments, reason, evidence, skinUrl, reportedEntity, createdTime
    const r = this.report, report = { opinionComments: r.comments, reason: this.type !== 'name' ? r.reason.toUpperCase() : null,
      evidence: this.type === 'chat' ? { messages: this.evidence(context) } : null, skinUrl: this.type === 'skin' ? r.skin?.url ?? null : null,
      reportedEntity: { profileId: r.reportedProfileId }, createdTime: r.createdAt };
    return { id: r.reportId, reportType: this.type === 'name' ? 'USERNAME' : this.type.toUpperCase(), report };
  }
  evidence(context) {
    const out = [];
    new ChatReportContextBuilder(this.limits.leadingContextMessageCount).collectAllContext(context.chatLog, this.report.reported, (id, event) => {
      const m = event.message;
      out.push({ index: m.link.index, profileId: m.link.sender, sessionId: m.link.sessionId, timestamp: m.timestamp, salt: m.salt, lastSeen: m.lastSeen.map(b64), message: m.content, signature: m.signature ? b64(m.signature) : null, messageReported: this.isReported(id) });
    });
    return out.reverse();
  }
}
const copyReport = (r) => ({ ...r, reported: new Set(r.reported) });

export function randomUuid() {
  const b = new Uint8Array(16); crypto.getRandomValues(b); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  return dashed([...b].map((x) => x.toString(16).padStart(2, '0')).join(''));
}

// java.time ISO_INSTANT: fraction only when non-zero, in groups of three digits
export function isoInstant(ms) { return new Date(ms).toISOString().replace('.000Z', 'Z'); }

// AbuseReportRequest as authlib's Gson writes it: undashed UUIDs, ISO instants, base64 byte buffers, null fields
// left out, the salt as an exact JSON long
export function abuseReportRequestJson(result, environment) {
  const salts = [];
  const value = (v, k) => {
    if (v == null) return undefined;
    if (typeof v === 'bigint') { salts.push(v.toString()); return `\u0000salt${salts.length - 1}\u0000`; }
    if (['id', 'profileId', 'sessionId'].includes(k)) return undashed(v);
    if (k === 'timestamp' || k === 'createdTime') return isoInstant(v);
    if (Array.isArray(v)) return v.map((x) => value(x));
    if (typeof v === 'object') { const o = {}; for (const [key, x] of Object.entries(v)) { const y = value(x, key); if (y !== undefined) o[key] = y; } return o; }
    return v;
  };
  const body = value({ version: 1, id: result.id, report: result.report, clientInfo: { clientVersion: environment.clientVersion, locale: environment.locale }, thirdPartyServerInfo: { address: environment.address }, reportType: result.reportType });
  return JSON.stringify(body).replace(/"\\u0000salt(\d+)\\u0000"/g, (_, i) => salts[+i]);
}

// ReportingContext: kept while the report environment (server address) stays the same, with its chat log and draft
export class ReportingContext {
  constructor(environment, limits = REPORT_LIMITS) { this.environment = environment; this.limits = limits; this.chatLog = new ChatLog(1024); this.draft = null; }
  matches(environment) { return this.environment.address === environment.address && this.environment.clientVersion === environment.clientVersion; }
  setDraft(draft) { this.draft = draft; }
  hasDraftFor(uuid) { return !!this.draft && sameUuid(this.draft.report.reportedProfileId, uuid); }
}

// ReportEnvironment.thirdParty(serverData.ip): the address as entered, with the client's version and locale
export function reportEnvironment(host, port, locale = (globalThis.navigator?.language || 'en-US')) {
  return { address: port && port !== 25565 ? `${host}:${port}` : String(host), clientVersion: '1.20.6', locale };
}

// AbuseReportSender.Services error text: the HTTP error message, else the service-unavailable/JSON text
export function reportErrorKey(error) {
  if (error?.status >= 400) return { key: 'gui.abuseReport.send.error_message', args: [error.message] };
  if (error?.json) return { key: 'gui.abuseReport.send.json_error' };
  return { key: 'gui.abuseReport.send.service_unavailable' };
}
