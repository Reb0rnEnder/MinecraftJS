import { VanillaSocket } from "./tcp.js";
import { C766, Configuration766, Writer766, decodeLogin766 } from "./configuration-1.20.6.js";
import { PLAY_SERVERBOUND_766 } from './protocol-1.20.6-ids.js';
import { decodePlayPacket766 } from "./play-codec-1.20.6.js";
import { nameUuid } from "../util/uuid-md5.js";
import { encodeUtf8 } from "../util/utf8.js";

export class VanillaSocket766 extends VanillaSocket {
  constructor(entry, options = {}) {
    super(entry);
    this.options = options;
    this.cookies = new Map();
    this.resourcePacks = new Map();
    this.configuration = null;
    this.profile = null;
    this.configurationGeneration = 0;
    this.autoPlayAcks = options.autoPlayAcks !== false;
  }

  _connect(msg) {
    this.transferred = !!msg.transferred;
    return super._connect({ ...msg, protocol: 766 });
  }

  _loginIntent() { return this.transferred ? 3 : 2; }

  _loginStart(msg) {
    const username = (msg.username || "Player").slice(0, 16);
    const uuid = this.auth?.uuid || nameUuid(encodeUtf8("OfflinePlayer:" + username));
    return C766.loginStart(username, uuid);
  }

  _beginConfiguration(initial = true) {
    this.state = "configuration";
    this.configurationGeneration++;
    this.configuration = new Configuration766(
      (bytes) => this._send(bytes),
      (packet) => this.emit("configuration", packet),
      this.cookies
    );
    if (initial) this.configuration.start(this.options);
  }

  _packet(data) {
    if(this.closed)return;
    if (this.state === "login") {
      const packet = decodeLogin766(data);
      switch (packet.name) {
        case "disconnect":
          this._kick(packet.reason);
          break;
        case "compress":
          this.split.threshold = packet.threshold;
          break;
        case "success":
          this.profile = packet;
          this._send(C766.loginAcknowledged());
          this._beginConfiguration();
          break;
        case "login_plugin_request":
          this._send(C766.loginPluginResponse(packet.messageId));
          break;
        case "cookie_request":
          this._send(C766.loginCookieResponse(packet.key, this.cookies.get(packet.key)));
          break;
        case "encryption_begin":
          return this._encryptionRequest(packet, packet.shouldAuthenticate);
          break;
        default:
          break;
      }
      return;
    }

    if (this.state === "configuration") {
      const packet = this.configuration.handle(data);
      if (packet.name === "disconnect") {
        this.emit("configuration_disconnect", packet.reason);
        this._kick(packet.reason);
      } else if (packet.name === "finish_configuration") {
        this.state = "play";
        this._control({
          type: "login_success",
          uuid: this.profile.uuid,
          username: this.profile.username
        });
        this.emit("configuration_complete", this.configuration);
      } else if (packet.name === "transfer") {
        this._transfer(packet);
      } else if (packet.name === "add_resource_pack") {
        this.resourcePacks.set(packet.uuid, packet);
        this.emit("resource_pack", packet);
      } else if (packet.name === "remove_resource_pack") {
        if (packet.uuid) this.resourcePacks.delete(packet.uuid);
        else this.resourcePacks.clear();
        this.emit("resource_pack_remove", packet);
      }
      return;
    }

    if (this.state === "play") {
      const packet = decodePlayPacket766(data, this.configuration);
      if (packet.name === "start_configuration") {
        this.emit("reconfiguration_start");
        this._send(C766.acknowledgeReconfiguration());
        this._beginConfiguration(false);
        return;
      } else if (packet.name === 'add_resource_pack') {
        this.resourcePacks.set(packet.uuid,packet);
      } else if (packet.name === 'remove_resource_pack') {
        if(packet.uuid)this.resourcePacks.delete(packet.uuid);else this.resourcePacks.clear();
      }

      if (packet.name === "cookie_request") {
        this._send(C766.playCookieResponse(packet.key, this.cookies.get(packet.key)));
      } else if (packet.name === "store_cookie") {
        if (packet.value.length > 5120) throw Error("Cookie exceeds native limit");
        this.cookies.set(packet.key, packet.value.slice());
      } else if (packet.name === "transfer") {
        this._transfer(packet);
        return;
      }

      if (this.autoPlayAcks && packet.name === "keep_alive") {
        this._send(C766.playKeepAlive(packet.keepAliveId));
      } else if (this.autoPlayAcks && packet.name === "position") {
        this._send(C766.teleportConfirm(packet.teleportId));
      } else if (this.autoPlayAcks && packet.name === "chunk_batch_finished") {
        this._send(C766.chunkBatchReceived(packet.batchSize));
      } else if (packet.name === "kick_disconnect") {
        this.emit("play_disconnect", packet.reason);
        this._kick(packet.reason);
        return;
      }

      this.emit("play", packet);
      this.emit("bootstrap_play", packet);
      this.emit("binary", data);
    }
  }

  _transfer(packet) {
    if (!packet.host || packet.port < 1 || packet.port > 65535) throw Error("Invalid transfer destination");
    this.state = "transferring";
    // Cookies are connection-owned; only an explicit server transfer carries
    // them to a new connection. Ordinary joins start with an empty map.
    this.emit("transfer", { ...packet, cookies: new Map([...this.cookies].map(([key, value]) => [key, value.slice()])) });
  }

  playPacket(data) {
    return decodePlayPacket766(data, this.configuration);
  }

  sendResourcePackStatus(uuid,status) {
    if(this.closed)return;
    if(this.state==='configuration')this._send(C766.resourcePackStatus(uuid,status));
    else if(this.state==='play')this._send(new Writer766().varint(PLAY_SERVERBOUND_766.resource_pack_receive).uuid(uuid).varint(status).build());
  }
}
