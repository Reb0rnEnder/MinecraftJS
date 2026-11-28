import { ChunkBatchCalculator } from './chunk-batch.js';
import { VanillaSocket } from './tcp.js';
import { C774, Configuration774, Writer774, decodeLogin774 } from './configuration-1.21.11.js';
import { PLAY_SERVERBOUND_774 } from './protocol-1.21.11-ids.js';
import { decodePlayPacket774 } from './play-codec-1.21.11.js';
import { nameUuid } from '../util/uuid-md5.js';
import { encodeUtf8 } from '../util/utf8.js';

export class VanillaSocket774 extends VanillaSocket {
  constructor(entry, options = {}) {
    super(entry);
    this.options = options;
    this.cookies = new Map();
    this.resourcePacks = new Map();
    this.configuration = null;
    this.profile = null;
    this.configurationGeneration = 0;
    this.chunkBatch = new ChunkBatchCalculator();
    this.autoPlayAcks = options.autoPlayAcks !== false;
  }

  _connect(msg) {
    this.transferred = !!msg.transferred;
    return super._connect({ ...msg, protocol: 774 });
  }

  _loginIntent() { return this.transferred ? 3 : 2; }

  _loginStart(msg) {
    const username = (msg.username || 'Player').slice(0, 16);
    const uuid = this.auth?.uuid || nameUuid(encodeUtf8('OfflinePlayer:' + username));
    return C774.loginStart(username, uuid);
  }

  _beginConfiguration(initial = true) {
    this.state = 'configuration';
    this.configurationGeneration++;
    this.chunkBatch = new ChunkBatchCalculator();
    this.configuration = new Configuration774(
      (bytes) => this._send(bytes),
      (packet) => this.emit('configuration', packet),
      this.cookies,
      'knownPack' in this.options ? this.options.knownPack : undefined
    );
    if (initial) this.configuration.start(this.options);
  }

  _packet(data) {
    if (this.closed) return;
    if (this.state === 'login') {
      const packet = decodeLogin774(data);
      switch (packet.name) {
        case 'disconnect':
          this._kick(packet.reason);
          break;
        case 'compress':
          this.split.threshold = packet.threshold;
          break;
        case 'success':
          this.profile = packet;
          this._send(C774.loginAcknowledged());
          this._beginConfiguration();
          break;
        case 'login_plugin_request':
          this._send(C774.loginPluginResponse(packet.messageId));
          break;
        case 'cookie_request':
          this._send(C774.loginCookieResponse(packet.key, this.cookies.get(packet.key)));
          break;
        case 'encryption_begin':
          return this._encryptionRequest(packet, packet.shouldAuthenticate);
        default:
          break;
      }
      return;
    }

    if (this.state === 'configuration') {
      const packet = this.configuration.handle(data);
      if (packet.name === 'disconnect') {
        this.emit('configuration_disconnect', packet.reason);
        this._kick(packet.reason);
      } else if (packet.name === 'finish_configuration') {
        this.state = 'play';
        this._control({
          type: 'login_success',
          uuid: this.profile.uuid,
          username: this.profile.username
        });
        this.emit('configuration_complete', this.configuration);
      } else if (packet.name === 'transfer') {
        this._transfer(packet);
      } else if (packet.name === 'add_resource_pack') {
        this.resourcePacks.set(packet.uuid, packet);
        this.emit('resource_pack', packet);
      } else if (packet.name === 'remove_resource_pack') {
        if (packet.uuid) this.resourcePacks.delete(packet.uuid);
        else this.resourcePacks.clear();
        this.emit('resource_pack_remove', packet);
      } else if (packet.name === 'code_of_conduct') {
        if (this.options.autoAcceptCodeOfConduct !== false) {
          this._send(C774.acceptCodeOfConduct());
        }
      }
      return;
    }

    if (this.state === 'play') {
      const packet = decodePlayPacket774(data, this.configuration);
      if (packet.name === 'start_configuration') {
        this.emit('reconfiguration_start');
        this._send(C774.acknowledgeReconfiguration());
        this._beginConfiguration(false);
        return;
      } else if (packet.name === 'add_resource_pack') {
        this.resourcePacks.set(packet.uuid, packet);
      } else if (packet.name === 'remove_resource_pack') {
        if (packet.uuid) this.resourcePacks.delete(packet.uuid);
        else this.resourcePacks.clear();
      }

      if (packet.name === 'cookie_request') {
        this._send(C774.playCookieResponse(packet.key, this.cookies.get(packet.key)));
      } else if (packet.name === 'store_cookie') {
        if (packet.value.length > 5120) throw Error('Cookie exceeds native limit');
        this.cookies.set(packet.key, packet.value.slice());
      } else if (packet.name === 'transfer') {
        this._transfer(packet);
        return;
      }

      if (this.autoPlayAcks && packet.name === 'chunk_batch_start') this.chunkBatch.start();
      if (this.autoPlayAcks && packet.name === 'keep_alive') {
        this._send(C774.playKeepAlive(packet.keepAliveId));
      } else if (this.autoPlayAcks && packet.name === 'position') {
        this._send(C774.teleportConfirm(packet.teleportId));
      } else if (this.autoPlayAcks && packet.name === 'chunk_batch_finished') {
        this._send(C774.chunkBatchReceived(this.chunkBatch.finish(packet.batchSize)));
      } else if (packet.name === 'kick_disconnect') {
        this.emit('play_disconnect', packet.reason);
        this._kick(packet.reason);
        return;
      }

      this.emit('play', packet);
      this.emit('bootstrap_play', packet);
      this.emit('binary', data);
    }
  }

  _transfer(packet) {
    if (!packet.host || packet.port < 1 || packet.port > 65535) throw Error('Invalid transfer destination');
    this.state = 'transferring';
    this.emit('transfer', {
      ...packet,
      cookies: new Map([...this.cookies].map(([key, value]) => [key, value.slice()]))
    });
  }

  playPacket(data) {
    return decodePlayPacket774(data, this.configuration);
  }

  sendResourcePackStatus(uuid, status) {
    if (this.closed) return;
    if (this.state === 'configuration') this._send(C774.resourcePackStatus(uuid, status));
    else if (this.state === 'play') {
      this._send(new Writer774().varint(PLAY_SERVERBOUND_774.resource_pack_receive).uuid(uuid).varint(status).build());
    }
  }
}
