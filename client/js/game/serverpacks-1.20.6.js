import {ServerPacks,WorkingScreen} from './serverpacks.js';
import {ResourcePack} from '../assets.js';
import {platform} from '../platform/platform.js';
import {sha1} from '../util/mccrypto.js';
import {tr} from '../gui/i18n.js';
import {ConfirmScreen,DisconnectedScreen} from '../gui/screens/menus.js';

export const PACK_STATUS_766=Object.freeze({SUCCESSFULLY_LOADED:0,DECLINED:1,FAILED_DOWNLOAD:2,ACCEPTED:3,DOWNLOADED:4,INVALID_URL:5,FAILED_RELOAD:6,DISCARDED:7});

// Native ServerPackManager owns one ordered list per server connection. A push
// replaces the same UUID, later packs override earlier packs, and pop cancels
// pending work without replying as if the client had rejected the pack.
export class ServerPacks766 extends ServerPacks {
  constructor(game) {
    super(game);
    this.entries=new Map();this.serial=0;this.revision=0;
    this.reloadPromise=Promise.resolve();this.reloadQueued=false;
    this.maxSize=0xFA00000; // DownloadedPackSource$4: 250 MiB
    this.minecraftVersion='1.20.6';
  }

  push(packet,send) {
    let url;
    try {url=new URL(packet.url);if(!['http:','https:'].includes(url.protocol))throw Error('Invalid scheme');}
    catch {send(PACK_STATUS_766.INVALID_URL);return;}
    this.pop(packet.uuid);
    const record={...packet,send,conn:this.game.conn,serial:++this.serial,accepted:false,ready:false,loaded:false,terminal:false};
    this.entries.set(packet.uuid,record);this.revision++;
    const mode=this._serverEntry()?.resourceMode || 'prompt';
    if(mode==='enabled')this._accept(record);
    else if(mode==='disabled'&&!packet.forced){this._finish(record,PACK_STATUS_766.DECLINED);this.entries.delete(record.uuid);}
    else this._prompt();
    return record;
  }

  _live(record) {return this.entries.get(record.uuid)===record&&this.game.conn===record.conn;}
  _finish(record,status) {if(!record.terminal){record.terminal=true;if(this.game.conn===record.conn)record.send(status);}}

  _prompt() {
    const pending=[...this.entries.values()].filter(record=>!record.accepted&&!record.terminal);
    if(!pending.length)return;
    const g=this.game,conn=g.conn,forced=pending.some(record=>record.forced),last=pending.at(-1);
    g.screens.open(new ConfirmScreen(g,yes=>{
      if(g.conn!==conn)return;
      const requests=[...this.entries.values()].filter(record=>!record.accepted&&!record.terminal);
      const required=requests.some(record=>record.forced),entry=this._serverEntry();
      if(entry&&(yes||!required)){entry.resourceMode=yes?'enabled':'disabled';g.settings.save();}
      g.screens.open(null);
      for(const record of requests){
        if(yes)this._accept(record);
        else {this._finish(record,PACK_STATUS_766.DECLINED);this.entries.delete(record.uuid);}
      }
      if(!yes&&required){g.disconnect(true);g.screens.open(new DisconnectedScreen(g,tr('disconnect.lost'),tr('multiplayer.requiredTexturePrompt.disconnect')));}
    },tr(forced?'multiplayer.requiredTexturePrompt.line1':'multiplayer.texturePrompt.line1'),
    this._promptText(forced,last.promptMessage),tr(forced?'gui.proceed':'gui.yes'),tr(forced?'menu.disconnect':'gui.no')));
  }

  _accept(record) {
    if(!this._live(record)||record.accepted)return;
    record.accepted=true;record.send(PACK_STATUS_766.ACCEPTED);
    record.task=this._downloadBytes(record).then(bytes=>{
      if(!this._live(record))return;
      record.bytes=bytes;record.ready=true;record.send(PACK_STATUS_766.DOWNLOADED);this._scheduleReload();
    },()=>{
      if(!this._live(record))return;
      this._finish(record,PACK_STATUS_766.FAILED_DOWNLOAD);this.entries.delete(record.uuid);this.revision++;
      // Native batch failure retains already-active packs, discarding the other
      // not-yet-active requests rather than partially activating the batch.
      for(const other of this.entries.values())if(other.accepted&&!other.loaded){
        this._finish(other,PACK_STATUS_766.DISCARDED);this.entries.delete(other.uuid);
      }
      this._scheduleReload();
    });
  }

  async _downloadBytes(record) {
    const files=platform().files,want=/^[0-9a-f]{40}$/i.test(record.hash||'')?record.hash.toLowerCase():'';
    const key='server-packs/'+Array.from(sha1(new TextEncoder().encode(record.url)),byte=>byte.toString(16).padStart(2,'0')).join('');
    let bytes=await files.get(key).catch(()=>null);
    if(bytes&&!(await this._check(want,bytes))){await files.delete(key).catch(()=>{});bytes=null;}
    if(!bytes){
      await this._deleteOld();
      const screen=new WorkingScreen(this.game);this.game.screens.open(screen);
      try {bytes=await this._fetch(record.url,screen,()=>this._live(record));}
      finally {screen.setDoneWorking();}
      if(!this._live(record))return null;
      if(!(await this._check(want,bytes)))throw Error('Hash mismatch');
      await files.put(key,bytes).then(()=>this._remember(key),()=>{});
    }
    return bytes;
  }

  _makePack(record) {
    const pack=new ResourcePack('server/'+record.uuid+'/'+record.serial,record.bytes);
    const meta=JSON.parse(pack.zip.readText(pack.prefix+'pack.mcmeta'));
    if(!meta?.pack||!Number.isInteger(meta.pack.pack_format))throw Error('Invalid server pack metadata');
    return pack;
  }

  _scheduleReload() {
    if(this.reloadQueued)return this.reloadPromise;
    this.reloadQueued=true;
    this.reloadPromise=this.reloadPromise.then(async()=>{
      this.reloadQueued=false;
      const records=[...this.entries.values()].filter(record=>record.accepted&&this._live(record));
      if(records.some(record=>!record.ready))return;
      const a=this.game.assets,previous=a.serverPacks||[],active=records.sort((a,b)=>b.serial-a.serial),revision=this.revision;
      const oldSet=new Set(previous),user=a.packs.filter(pack=>!oldSet.has(pack));
      try {
        for(const record of active)record.pack??=this._makePack(record);
        const desired=active.map(record=>record.pack);
        if(desired.length===previous.length&&desired.every((pack,index)=>pack===previous[index]))return;
        a.serverPacks=desired;a.serverPack=desired[0]||null;a.packs=[...desired,...user];
        await this.game.reloadResources();
        for(const record of active)if(this._live(record)&&!record.loaded){record.loaded=true;this._finish(record,PACK_STATUS_766.SUCCESSFULLY_LOADED);}
      }catch(error){
        a.serverPacks=previous;a.serverPack=previous[0]||null;a.packs=[...previous,...user];
        for(const record of active)if(this._live(record)&&!record.loaded){this._finish(record,PACK_STATUS_766.FAILED_RELOAD);this.entries.delete(record.uuid);}
        try {await this.game.reloadResources();}catch(rollback){console.error('Server pack recovery failed',rollback);}
      }
      if(revision!==this.revision)this._scheduleReload();
    });
    return this.reloadPromise;
  }

  pop(uuid=null) {
    let changed=false;
    for(const [id] of this.entries)if(uuid===null||id===uuid){this.entries.delete(id);changed=true;}
    if(changed){this.revision++;this._scheduleReload();}
    return this.reloadPromise;
  }

  clear() {this.pop();}
  async whenIdle(){await Promise.all([...this.entries.values()].map(record=>record.task));await this.reloadPromise;}
}
