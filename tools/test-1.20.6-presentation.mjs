import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Writer766} from '../client/js/net/configuration-1.20.6.js';
import {decodePlayBody766,decodePlayPacket766} from '../client/js/net/play-codec-1.20.6.js';
import {PLAY_CLIENTBOUND_766 as IN} from '../client/js/net/protocol-1.20.6-ids.js';
import {Game} from '../client/js/game/game.js';
import {Scoreboard} from '../client/js/game/scoreboard.js';
import {Hud} from '../client/js/gui/hud.js';
import {setPlatform} from '../client/js/platform/platform.js';
import {chatToPlain} from '../client/js/gui/chat.js';
import {simplify} from '../client/js/net/nbt.js';
import {CommandTree} from '../client/js/game/commands.js';
import {Particles} from '../client/js/render/particles.js';
import {PLAY_SCHEMA_766} from '../client/js/net/play-schema-1.20.6.js';

const uuid='12345678-1234-4234-8234-123456789abc';
const packet=(name,body)=>decodePlayPacket766(new Writer766().varint(IN[name]).raw(body.build()).build());
const game=fields=>Object.assign(Object.create(Game.prototype),fields);

test('native NBT chat passes the actual chat handlers, preserving literal JSON and formatting',()=>{
  const received=[],g=game({on_chat:p=>received.push(p)});
  const literal='{"text":"literal"}';
  g.handlePacket(packet('system_chat',new Writer766().component({text:literal,color:'green'}).bool(false)));
  assert.equal(chatToPlain(received[0].message),literal);assert.equal(received[0].position,1);
  g.handlePacket(packet('profileless_chat',new Writer766().component({text:'hello'}).varint(0).component({text:'Sender'}).bool(false)));
  assert.equal(received.length,2);assert.equal(JSON.parse(received[1].message).with[1],'hello');
  const p=decodePlayBody766('player_chat',new Writer766().uuid(uuid).varint(0).bool(false).string('hello').i64(1n).i64(2n).varint(0).bool(true).component({text:'hello',bold:true}).varint(0).varint(0).component({text:'Sender'}).bool(false).build());
  assert.equal(p.sender,uuid);assert.equal(JSON.parse(p.networkName),'Sender');assert.equal(JSON.parse(p.unsignedChatContent).bold,true);
});

test('native tab-list profiles, chat keys and display text reach Scoreboard and verifier consumers',()=>{
  const g=game({entities:{all:()=>[]},entityRenderer:{skinFor(){}},chatVerifier:{install(){},remove(){}}});
  g.scoreboard=new Scoreboard(g);
  const p=packet('player_info',new Writer766().u8(1|2|4|8|16|32).varint(1).uuid(uuid).string('Fixture').varint(0)
    .bool(true).uuid(uuid).i64(123n).varint(1).u8(8).varint(1).u8(9).varint(1).bool(true).varint(37).bool(true).component({text:'Display',color:'gold'}));
  let installed;g.chatVerifier.install=(id,key)=>installed={id,key};g.handlePacket(p);
  const player=g.scoreboard.players.get(uuid);assert.equal(player.name,'Fixture');assert.equal(player.ping,37);assert.equal(player.listed,true);assert.match(player.displayName,/Display/);
  assert.equal(installed.id,uuid);assert.equal(installed.key.expireTime,123n);assert.deepEqual([...installed.key.keyBytes],[8]);assert.deepEqual([...installed.key.keySignature],[9]);
});

test('native objectives, teams, scores and removals reach their actual handlers',()=>{
  const g=game({entities:{all:()=>[]}});g.scoreboard=new Scoreboard(g);
  g.handlePacket(packet('scoreboard_objective',new Writer766().string('points').u8(0).component({text:'Points',color:'gold'}).varint(0).bool(false)));
  g.handlePacket(packet('scoreboard_display_objective',new Writer766().varint(1).string('points')));
  g.handlePacket(packet('scoreboard_score',new Writer766().string('Fixture').string('points').varint(7).bool(false).bool(false)));
  assert.equal(g.scoreboard.sidebar,'points');assert.equal(g.scoreboard.objectives.get('points').scores.get('Fixture'),7);
  g.handlePacket(packet('teams',new Writer766().string('red').u8(0).component({text:'Team'}).u8(3).string('always').string('never').varint(12).component({text:'Prefix'}).component({text:'Suffix'}).varint(1).string('Fixture')));
  const team=g.scoreboard.teams.get('red');assert.equal(team.displayName,'Team');assert.equal(team.color,12);assert.equal(team.collisionRule,'never');assert.ok(team.prefix.includes('Prefix'));
  g.handlePacket(packet('reset_score',new Writer766().string('Fixture').bool(true).string('points')));
  assert.equal(g.scoreboard.objectives.get('points').scores.size,0);
});

test('native title and death packets reach presentation consumers with component text',()=>{
  const hud={onTitle:Hud.prototype.onTitle},g=game({hud,entityId:7,screens:{current:null}});
  g.handlePacket(packet('set_title_text',new Writer766().component({text:'Title'})));
  g.handlePacket(packet('set_title_subtitle',new Writer766().component({text:'Subtitle'})));
  g.handlePacket(packet('set_title_time',new Writer766().i32(5).i32(20).i32(7)));
  assert.equal(hud.title,'Title');assert.equal(hud.subtitle,'Subtitle');assert.equal(hud.titleStay,20);
  g.handlePacket(packet('death_combat_event',new Writer766().varint(7).component({text:'Native death'})));
  assert.equal(g.deathMessage,'Native death');
  g.handlePacket(packet('clear_titles',new Writer766().bool(true)));assert.equal(hud.title,'');assert.equal(hud.titleFadeIn,10);
});

test('registered/inline sound holders retain native category, coordinates and seed',()=>{
  const played=[],g=game({entityId:7,player:{x:2,y:3,z:4},sound:{play:(...args)=>played.push(args)},assets:{soundNames:['native.sound']}});
  g.handlePacket(packet('sound_effect',new Writer766().varint(1).varint(4).i32(16).i32(24).i32(-8).f32(1).f32(0.5).i64(123n)));
  assert.deepEqual(played[0],['native.sound',2,3,-1,1,0.5,{category:4,seed:123n}]);
  g.handlePacket(packet('entity_sound_effect',new Writer766().varint(0).string('minecraft:inline.sound').bool(true).f32(30).varint(7).varint(7).f32(1).f32(1).i64(5n)));
  assert.equal(played[1][0],'inline.sound');assert.equal(played[1][6].entity,g.player);assert.equal(played[1][6].seed,5n);
});

test('Join Game retains Configuration chat and damage registries in a typed consumer view',()=>{
  const entry={id:0,key:'minecraft:test',value:{t:10,v:{chat:{t:10,v:{translation_key:{t:8,v:'test.key'}}}}}};
  const registries=new Map([['minecraft:chat_type',[entry]]]);
  // A respawn can resolve no dimension when none was advertised; this exercises
  // registry projection independently of a hand-built dimension codec.
  const w=new Writer766().varint(0).string('minecraft:overworld').i64(0n).i8(0).u8(255).bool(false).bool(false).bool(false).varint(0).u8(0);
  registries.set('minecraft:dimension_type',[{key:'minecraft:overworld',value:{t:10,v:{min_y:{t:3,v:-64},height:{t:3,v:384}}}}]);
  const p=decodePlayBody766('respawn',w.build(),{registries});
  assert.equal(simplify(p.dimensionCodec)['minecraft:chat_type'].value[0].element.chat.translation_key,'test.key');
});

test('native command nodes feed the actual command parser, including greedy strings and new property-free types',()=>{
  const p=packet('declare_commands',new Writer766().varint(3)
    .u8(0).varint(1).varint(1)
    .u8(1).varint(1).varint(2).string('say')
    .u8(6).varint(0).string('message').varint(5).varint(2).varint(0));
  const commands=new CommandTree(p,{});assert.equal(commands.root,0);assert.equal(commands.nodes[2].properties.mode,2);
  assert.equal(commands.parse('/say hello world').error,undefined);
  const args=PLAY_SCHEMA_766.types.command_node[1][3].type[1].fields['2'][1];
  const parsers=args.find(f=>f.name==='parser').type[1].mappings;
  const lootId=Number(Object.entries(parsers).find(([,name])=>name==='minecraft:loot_table')[0]);
  const loot=packet('declare_commands',new Writer766().varint(2).u8(0).varint(1).varint(1)
    .u8(6).varint(0).string('loot').varint(lootId).varint(0));
  assert.equal(loot.nodes[1].parser,'minecraft:loot_table');assert.deepEqual(loot.nodes[1].properties,{});
});

test('simple and parameterized particles normalize to the renderer and preserve 1.20.5 ARGB colors',()=>{
  const mapping=PLAY_SCHEMA_766.types.Particle[1][0].type[1].mappings;
  const ids=Object.fromEntries(Object.entries(mapping).map(([id,name])=>[name,Number(id)]));
  function particle(name,data=()=>{}){
    const w=new Writer766().bool(false).f64(1).f64(2).f64(3).f32(0).f32(0).f32(0).f32(1).i32(1).varint(ids[name]);data(w);
    return packet('world_particles',w);
  }
  const smoke=particle('smoke');assert.equal(smoke.particleId,ids.smoke);assert.equal(smoke.particles,1);
  assert.deepEqual(particle('block',w=>w.varint(7)).data,{blockState:7});
  const vibration=particle('vibration',w=>w.varint(0).position(4,5,6).varint(20));
  assert.deepEqual(vibration.data.destination,{x:4,y:5,z:6});assert.equal(vibration.data.positionType,'minecraft:block');
  const effect=particle('entity_effect',w=>w.i32(0x80402010|0));
  const q={},fake={game:{assets:{data:{particles:Object.entries(mapping).map(([id,name])=>({id:Number(id),name}))}}},spell(...args){this.args=args;return q}};
  Particles.prototype.onPacket.call(fake,effect);assert.deepEqual(fake.args.slice(6),[64/255,32/255,16/255]);assert.equal(q.a,128/255);
});

test('native explosion sound/particles and interaction mode reach gameplay without destroying KEEP blocks',()=>{
  const mapping=PLAY_SCHEMA_766.types.Particle[1][0].type[1].mappings;
  const id=name=>Number(Object.entries(mapping).find(([,value])=>value===name)[0]);
  const sound=[],effects=[],blocks=[];
  const g=game({assets:{soundNames:['native.explosion']},sound:{play:(...args)=>sound.push(args)},world:{setState:(...args)=>blocks.push(args)},
    player:{motionX:0,motionY:0,motionZ:0},particles:{onPacket:p=>effects.push(p)}});
  const body=interaction=>new Writer766().f64(1).f64(2).f64(3).f32(4).varint(1).i8(0).i8(0).i8(0)
    .f32(.5).f32(0).f32(0).varint(interaction).varint(id('explosion')).varint(id('explosion_emitter')).varint(1);
  g.handlePacket(packet('explosion',body(0)));assert.equal(blocks.length,0);assert.equal(effects[0].particleId,id('explosion'));assert.equal(sound[0][0],'native.explosion');
  g.handlePacket(packet('explosion',body(1)));assert.equal(blocks.length,1);assert.equal(effects[1].particleId,id('explosion_emitter'));assert.equal(g.player.motionX,1);
});
