// Native 1.20.6 reporting model: ChatLog ring ids, Report.Builder rules, ChatReportContextBuilder evidence, the
// ChatSelectionLogFiller paging and authlib's AbuseReportRequest JSON.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ChatLog,ReportingContext,ReportBuilder,ChatSelectionLogFiller,loggedPlayerMessage,loggedSystemMessage,abuseReportRequestJson,isoInstant,reportErrorKey} from '../client/js/game/reporting.js';
const BAD='11111111-2222-3333-4444-555555555555',OTHER='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',S1='99999999-8888-7777-6666-555555555555';
const sig=(n)=>new Uint8Array(256).fill(n);
const msg=(sender,index,n,lastSeen=[],text='m'+n)=>loggedPlayerMessage({sender,index,signature:sig(n),plainMessage:text,timestamp:1700000000000+n*1000,salt:-9007199254740993n},S1,lastSeen.map(sig),{uuid:sender,name:sender===BAD?'Bad':'Other'},'secure',text);
const env={address:'example.net:25570',clientVersion:'1.20.6',locale:'en-US'};
test('ChatLog keeps ever-increasing ids over a 1024-entry ring',()=>{
  const log=new ChatLog(4);for(let i=0;i<6;i++)log.push(loggedSystemMessage('s'+i,0));
  assert.deepEqual([log.start(),log.end(),log.lookup(1),log.lookup(5).text],[2,5,null,'s5']);
});
test('builders: chat needs messages, then a reason, then a short comment; at most four reported messages',()=>{
  const b=new ReportBuilder('chat',BAD);assert.equal(b.hasContent(),false);assert.equal(b.checkBuildable(),'gui.chatReport.send.no_reported_messages');
  for(const id of [1,2,3,4,5])b.toggleReported(id);assert.deepEqual([...b.report.reported],[1,2,3,4]);
  assert.equal(b.checkBuildable(),'gui.abuseReport.send.no_reason');b.setReason('hate_speech');
  b.setComments('x'.repeat(1001));assert.equal(b.checkBuildable(),'gui.abuseReport.send.comment_too_long');b.setComments('ok');assert.equal(b.checkBuildable(),null);
  b.toggleReported(2);assert.deepEqual([...b.report.reported],[1,3,4]);
  const name=new ReportBuilder('name',BAD,{name:'Bad'});assert.equal(name.checkBuildable(),null);assert.equal(name.hasContent(),false);
  const skin=new ReportBuilder('skin',BAD,{skin:{url:'http://textures.minecraft.net/texture/abc'}});assert.equal(skin.checkBuildable(),'gui.abuseReport.send.no_reason');
});
test('evidence: the reported message with its chain and the messages it had seen, oldest first; request JSON as authlib writes it',()=>{
  const ctx=new ReportingContext(env),log=ctx.chatLog;
  log.push(msg(OTHER,0,1));            // 0: seen by the reported message
  log.push(msg(BAD,0,2));              // 1: earlier in the reported chain
  log.push(loggedSystemMessage('joined',0)); // 2: system lines are never evidence
  log.push(msg(OTHER,1,3));            // 3: unrelated
  log.push(msg(BAD,1,4,[1]));          // 4: reported, saw message 0
  const b=new ReportBuilder('chat',BAD,{reportId:'0f0f0f0f-0000-4000-8000-000000000001',createdAt:Date.UTC(2026,10,28,1,2,3)});b.toggleReported(4);b.setReason('harassment_or_bullying');
  const built=b.build(ctx);
  assert.deepEqual(built.report.evidence.messages.map(m=>[m.message,m.messageReported]),[['m1',false],['m2',false],['m4',true]]);
  const json=abuseReportRequestJson(built,env),body=JSON.parse(json.replace(/"salt":(-?\d+)/g,'"salt":"$1"'));
  assert.equal(body.version,1);assert.equal(body.id,'0f0f0f0f000040008000000000000001');assert.equal(body.reportType,'CHAT');
  assert.deepEqual(body.clientInfo,{clientVersion:'1.20.6',locale:'en-US'});assert.deepEqual(body.thirdPartyServerInfo,{address:'example.net:25570'});
  assert.equal(body.report.reason,'HARASSMENT_OR_BULLYING');assert.equal(body.report.createdTime,'2026-11-28T01:02:03Z');assert.equal('skinUrl' in body.report,false);
  assert.equal(body.report.reportedEntity.profileId,'11111111222233334444555555555555');
  const m=body.report.evidence.messages[2];
  assert.equal(m.profileId,'11111111222233334444555555555555');assert.equal(m.sessionId,'99999999888877776666555555555555');assert.equal(m.index,1);
  assert.equal(m.salt,'-9007199254740993');assert.match(json,/"salt":-9007199254740993/);assert.equal(m.timestamp,'2023-11-14T22:13:24Z');
  assert.deepEqual(m.lastSeen,[Buffer.from(sig(1)).toString('base64')]);assert.equal(m.signature,Buffer.from(sig(4)).toString('base64'));
  assert.equal(isoInstant(Date.UTC(2026,0,1,0,0,0,250)),'2026-01-01T00:00:00.250Z');
  assert.deepEqual(reportErrorKey(Object.assign(Error('Too many reports'),{status:429})),{key:'gui.abuseReport.send.error_message',args:['Too many reports']});
  assert.deepEqual(reportErrorKey(Object.assign(Error('x'),{unavailable:true})),{key:'gui.abuseReport.send.service_unavailable'});
});
test('selection filler pages newest first: reportable messages, their context, join and fold dividers',()=>{
  const ctx=new ReportingContext(env),log=ctx.chatLog;
  log.push(msg(BAD,0,1));for(let i=0;i<3;i++)log.push(msg(OTHER,i,10+i));
  log.push(loggedPlayerMessage({sender:BAD,index:0,signature:sig(2),plainMessage:'new session',timestamp:0,salt:0},'00000000-0000-0000-0000-000000000077',[],{uuid:BAD,name:'Bad'},'secure','new session'));
  const out=[],filler=new ChatSelectionLogFiller(ctx,e=>e.message.signature&&e.profile.uuid===BAD);
  filler.fillNextPage(10,{acceptMessage:(id,e)=>out.push(id+':'+e.content),acceptDivider:d=>out.push(d.key+':'+d.args.join(','))});
  assert.deepEqual(out,['4:new session','gui.chatSelection.join:Bad','gui.chatSelection.fold:3','0:m1']);
});
