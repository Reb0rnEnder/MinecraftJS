// Decoder/consumer inventory, not a claim of valid-body or gameplay parity.
import {writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {CLIENTBOUND_762} from '../../client/js/net/protocol-1.19.4-ids.js';
import {decodePacket762,Writer762} from '../../client/js/net/protocol-1.19.4.js';
import {Game} from '../../client/js/game/game.js';
import {cache} from './prepare.mjs';

// Existing native adapters normalize these names before Game dispatch.
const aliases={
  clear_titles:'title',action_bar:'title',set_title_text:'title',
  set_title_subtitle:'title',set_title_time:'title',
  initialize_world_border:'world_border',world_border_center:'world_border',
  world_border_lerp_size:'world_border',world_border_size:'world_border',
  world_border_warning_delay:'world_border',world_border_warning_reach:'world_border',
  enter_combat_event:'combat_event',end_combat_event:'combat_event',
  death_combat_event:'combat_event',teams:'scoreboard_team',
  entity_update_attributes:'update_attributes',
};
const outsideGame={bundle_delimiter:'Connection / PacketBundles762 consumes delimiters before Game dispatch'};
const packets=Object.entries(CLIENTBOUND_762).map(([name,id])=>{
  let decoder;
  try {
    const p=decodePacket762(new Writer762().varint(id).build());
    decoder=p.name==='unsupported'?'unsupported':'accepts-empty-body';
  } catch {
    // A read/validation failure establishes a reader path only. A malformed
    // empty body does not validate its field order, types or gameplay effect.
    decoder='body-reader-present';
  }
  const handler='on_'+(aliases[name]||name);
  return {name,id,decoder,consumer:outsideGame[name]||
    (typeof Game.prototype[handler]==='function'?'Game.'+handler:'no Game handler'),
    nativeBehaviorValidatedByThisProbe:false};
});
// Complete native constructor/write layouts, not just the ID-only probe above.
// These exercise the confirmed unsupported paths without depending on a server.
const examples=[
  ['initialize_world_border','wn',w=>w.f64(0).f64(0).f64(64).f64(32).varlong(1500n).varint(29999984).varint(5).varint(15)],
  ['world_border_lerp_size','xz',w=>w.f64(64).f64(32).varlong(1500n)],
  ['face_player','xm',w=>w.varint(1).f64(2).f64(70).f64(-3).bool(false)],
].map(([name,nativeClass,body])=>{
  const bytes=body(new Writer762().varint(CLIENTBOUND_762[name])).build();
  return{name,nativeClass,bytes:[...bytes],decodedName:decodePacket762(bytes).name};
});
const report={version:'1.19.4',protocol:762,fullParity:false,packets,
  completeNativeBodyExamples:examples,
  unsupported:packets.filter(p=>p.decoder==='unsupported').map(p=>p.name),
  withoutGameHandler:packets.filter(p=>p.consumer==='no Game handler').map(p=>p.name),
  limitations:[
    'An ID-only probe distinguishes explicit unsupported results from reader paths. It is not a valid-packet fixture.',
    'A named handler may ignore fields or omit native effects; handler presence is not functional parity.',
    'update_view_position has no consumer; native ClientChunkCache uses the server-specified cache center. Impact requires live tests.',
  ]};
await mkdir(join(cache,'audit'),{recursive:true});
await writeFile(join(cache,'audit/packet-review.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({packets:packets.length,unsupported:report.unsupported,withoutGameHandler:report.withoutGameHandler,fullParity:false},null,2));
