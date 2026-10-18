class Game {
  constructor() {
    this.ws = null;
    this.world = new World();
    this.renderer = null;
    this.controls = null;
    this.connected = false;
    this.entityId = 0;
    this.gameMode = 0;
    this.dimension = 0;

    this.health = 20;
    this.food = 20;
    this.foodSaturation = 5;
    this.xpLevel = 0;
    this.xpProgress = 0;

    this.lastTick = performance.now();
    this.fps = 0;
    this.fpsFrames = 0;
    this.fpsTime = 0;

    this.positionUpdateTimer = 0;
    this.lastSentX = 0;
    this.lastSentY = 0;
    this.lastSentZ = 0;
    this.lastSentYaw = 0;
    this.lastSentPitch = 0;

    this.setupUI();
  }

  setupUI() {
    document.getElementById('connect-btn').addEventListener('click', () => this.connect());
    document.getElementById('resume-btn').addEventListener('click', () => {
      this.controls.togglePause(false);
      document.getElementById('game-canvas').requestPointerLock();
    });
    document.getElementById('disconnect-btn').addEventListener('click', () => this.disconnect());

    document.getElementById('username').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.connect();
    });
  }

  connect() {
    const username = document.getElementById('username').value || 'WebPlayer';
    const host = document.getElementById('server-host').value || 'localhost';
    const port = parseInt(document.getElementById('server-port').value) || 25565;

    document.getElementById('login-status').textContent = 'Connecting...';

    const wsUrl = `ws://${window.location.host}`;
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({
        type: 'connect',
        host,
        port,
        username
      }));
    };

    this.ws.onmessage = (e) => {
      // Play-state packets arrive as raw binary: varint packet id + body
      if (typeof e.data !== 'string') {
        const bytes = new Uint8Array(e.data);
        let id = 0, shift = 0, i = 0, b;
        do { b = bytes[i++]; id |= (b & 0x7F) << shift; shift += 7; } while (b & 0x80);
        this.handleMessage({ type: 'packet', state: 3, id, data: bytes.subarray(i) });
        return;
      }
      try {
        const msg = JSON.parse(e.data);
        this.handleMessage(msg);
      } catch (err) {
        console.error('Message parse error:', err);
      }
    };

    this.ws.onclose = () => {
      document.getElementById('login-status').textContent = 'Disconnected';
      this.connected = false;
    };

    this.ws.onerror = (err) => {
      document.getElementById('login-status').textContent = 'Connection failed';
      console.error('WebSocket error:', err);
    };
  }

  disconnect() {
    if (this.ws) this.ws.close();
    this.connected = false;
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.exitPointerLock();
  }

  startGame() {
    if (this.gameStarted) return;
    this.gameStarted = true;

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';

    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';
    this.updateLoadingProgress('Joining world...', 25);

    const canvas = document.getElementById('game-canvas');
    this.renderer = new GameRenderer(canvas);
    this.controls = new PlayerControls(this.renderer.camera, canvas);

    this.controls.onChatSend = (msg) => this.sendChat(msg);
    this.controls.onSlotChange = (slot) => this.sendHeldItemChange(slot);
    this.controls.onDigStart = () => this.handleDig();
    this.controls.onBlockPlace = () => this.handlePlace();

    this.connected = true;
    this.sendClientSettings();
    this.sendPluginMessage('MC|Brand', 'vanilla');
    this.gameLoop();
  }

  updateLoadingProgress(text, pct) {
    const detailEl = document.getElementById('loading-detail');
    if (detailEl && text) detailEl.textContent = text;
    const barEl = document.getElementById('loading-progress-bar');
    if (barEl && pct !== undefined) barEl.style.width = Math.min(100, Math.max(0, pct)) + '%';
  }

  hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay && overlay.style.display !== 'none') {
      overlay.style.transition = 'opacity 0.4s ease';
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.style.display = 'none';
        overlay.style.opacity = '1';
      }, 400);
    }
  }

  handleMessage(msg) {
    if (msg.type === 'status') {
      const statusEl = document.getElementById('login-status');
      if (statusEl) statusEl.textContent = msg.message;
      this.updateLoadingProgress(msg.message);
      return;
    }

    if (msg.type === 'error') {
      const statusEl = document.getElementById('login-status');
      if (statusEl) statusEl.textContent = 'Error: ' + msg.message;
      this.addChat('Error: ' + msg.message, '#ff5555');
      return;
    }

    if (msg.type === 'disconnected') {
      const statusEl = document.getElementById('login-status');
      if (statusEl) statusEl.textContent = 'Disconnected from server.';
      this.addChat('Disconnected from server', '#ff5555');
      return;
    }

    if (msg.type === 'kicked') {
      const reason = this.parseChatJson(msg.reason);
      const statusEl = document.getElementById('login-status');
      if (statusEl) statusEl.textContent = 'Kicked: ' + reason;
      this.addChat('Kicked: ' + reason, '#ff5555');
      return;
    }

    if (msg.type === 'login_success') {
      console.log('Login success event:', msg);
      this.playerUuid = msg.uuid;
      this.playerName = msg.username;
      this.updateLoadingProgress(`Logged in as ${msg.username}! Entering world...`, 30);
      this.startGame();
      return;
    }

    if (msg.type !== 'packet') return;

    const buf = new PacketBuffer(msg.data);

    if (msg.state === 2) {
      if (msg.id === 0x02) {
        this.startGame();
      }
      return;
    }

    // Ensure game has started if we receive play packets
    if (!this.gameStarted) {
      this.startGame();
    }

    try {
      this.handlePlayPacket(msg.id, buf);
    } catch (e) {
      // Catch any unexpected packet parse issue gracefully
      console.warn('Packet parse error for 0x' + msg.id.toString(16), e);
    }
  }

  handlePlayPacket(id, buf) {
    switch (id) {
      case ServerPackets.KEEP_ALIVE:
        this.handleKeepAlive(buf);
        break;

      case ServerPackets.JOIN_GAME:
        this.handleJoinGame(buf);
        break;

      case ServerPackets.CHAT_MESSAGE:
        this.handleChatMessage(buf);
        break;

      case ServerPackets.TIME_UPDATE:
        this.handleTimeUpdate(buf);
        break;

      case ServerPackets.UPDATE_HEALTH:
        this.handleUpdateHealth(buf);
        break;

      case ServerPackets.PLAYER_POSITION_AND_LOOK:
        this.handlePositionAndLook(buf);
        break;

      case ServerPackets.CHUNK_DATA:
        this.handleChunkData(buf);
        break;

      case ServerPackets.MAP_CHUNK_BULK:
        this.handleChunkBulk(buf);
        break;

      case ServerPackets.BLOCK_CHANGE:
        this.handleBlockChange(buf);
        break;

      case ServerPackets.MULTI_BLOCK_CHANGE:
        this.handleMultiBlockChange(buf);
        break;

      case ServerPackets.SPAWN_POSITION:
        this.handleSpawnPosition(buf);
        break;

      case ServerPackets.SET_EXPERIENCE:
        this.handleSetExperience(buf);
        break;

      case ServerPackets.PLAYER_ABILITIES:
        this.handlePlayerAbilities(buf);
        break;

      case ServerPackets.SPAWN_PLAYER:
        this.handleSpawnPlayer(buf);
        break;

      case ServerPackets.SPAWN_MOB:
        this.handleSpawnMob(buf);
        break;

      case ServerPackets.ENTITY_RELATIVE_MOVE:
        this.handleEntityRelativeMove(buf);
        break;

      case ServerPackets.ENTITY_LOOK_AND_RELATIVE_MOVE:
        this.handleEntityLookAndRelativeMove(buf);
        break;

      case ServerPackets.ENTITY_TELEPORT:
        this.handleEntityTeleport(buf);
        break;

      case ServerPackets.DESTROY_ENTITIES:
        this.handleDestroyEntities(buf);
        break;

      case ServerPackets.RESPAWN:
        this.handleRespawn(buf);
        break;

      case ServerPackets.CHANGE_GAME_STATE:
        this.handleChangeGameState(buf);
        break;

      case ServerPackets.HELD_ITEM_CHANGE:
        this.handleServerHeldItemChange(buf);
        break;

      case ServerPackets.DISCONNECT:
        this.handleDisconnect(buf);
        break;

      case ServerPackets.WINDOW_ITEMS:
        this.handleWindowItems(buf);
        break;

      case ServerPackets.SET_SLOT:
        this.handleSetSlot(buf);
        break;

      case ServerPackets.PLAYER_LIST_ITEM:
        break;

      case ServerPackets.CONFIRM_TRANSACTION:
        this.handleConfirmTransaction(buf);
        break;

      case ServerPackets.SPAWN_OBJECT:
        this.handleSpawnObject(buf);
        break;

      case ServerPackets.ENTITY_VELOCITY:
        break;

      case ServerPackets.ENTITY_METADATA:
        break;

      case ServerPackets.ENTITY_PROPERTIES:
        break;

      case ServerPackets.ENTITY_HEAD_LOOK:
        break;

      case ServerPackets.ENTITY_STATUS:
        break;

      case ServerPackets.ANIMATION:
        break;

      case ServerPackets.ENTITY:
        break;

      case ServerPackets.ENTITY_LOOK:
        break;

      case ServerPackets.PLUGIN_MESSAGE:
        break;

      case ServerPackets.ENTITY_EFFECT:
        break;

      case ServerPackets.REMOVE_ENTITY_EFFECT:
        break;

      case ServerPackets.ENTITY_EQUIPMENT:
        break;

      case ServerPackets.COLLECT_ITEM:
        break;

      case ServerPackets.PLAYER_LIST_HEADER_FOOTER:
        break;

      case ServerPackets.SCOREBOARD_OBJECTIVE:
        break;

      case ServerPackets.UPDATE_SCORE:
        break;

      case ServerPackets.DISPLAY_SCOREBOARD:
        break;

      case ServerPackets.TEAMS:
        break;

      case ServerPackets.TITLE:
        break;

      case ServerPackets.WORLD_BORDER:
        break;

      case ServerPackets.STATISTICS:
        break;

      case ServerPackets.SOUND_EFFECT:
        break;

      case ServerPackets.PARTICLE:
        break;

      case ServerPackets.EFFECT:
        break;

      case ServerPackets.EXPLOSION:
        break;

      case ServerPackets.BLOCK_ACTION:
        break;

      case ServerPackets.BLOCK_BREAK_ANIMATION:
        break;

      case ServerPackets.UPDATE_BLOCK_ENTITY:
        break;

      case ServerPackets.MAP:
        break;

      case ServerPackets.UPDATE_SIGN:
        break;

      case ServerPackets.SERVER_DIFFICULTY:
        break;

      case ServerPackets.COMBAT_EVENT:
        break;

      case ServerPackets.CAMERA:
        break;

      case ServerPackets.ATTACH_ENTITY:
        break;

      case ServerPackets.OPEN_WINDOW:
        break;

      case ServerPackets.CLOSE_WINDOW:
        break;

      case ServerPackets.WINDOW_PROPERTY:
        break;

      case ServerPackets.SPAWN_GLOBAL_ENTITY:
        break;

      case ServerPackets.SPAWN_EXPERIENCE_ORB:
        break;

      case ServerPackets.SPAWN_PAINTING:
        break;

      case ServerPackets.USE_BED:
        break;

      case ServerPackets.RESOURCE_PACK_SEND:
        break;

      case ServerPackets.TAB_COMPLETE:
        break;

      case ServerPackets.SET_COMPRESSION:
        break;

      case ServerPackets.UPDATE_ENTITY_NBT:
        break;
    }
  }

  // Packet Handlers

  handleKeepAlive(buf) {
    const keepAliveId = buf.readVarInt();
    this.sendPacket(ClientPackets.KEEP_ALIVE, new PacketWriter().writeVarInt(keepAliveId));
  }

  handleJoinGame(buf) {
    this.entityId = buf.readInt();
    this.gameMode = buf.readUByte();
    this.dimension = buf.readByte();
    const difficulty = buf.readUByte();
    const maxPlayers = buf.readUByte();
    const levelType = buf.readString();
    const reducedDebug = buf.readBoolean();

    this.updateLoadingProgress('Joined server! Loading terrain...', 40);
    this.addChat(`Joined game (Mode: ${['Survival','Creative','Adventure','Spectator'][this.gameMode]})`, '#55ff55');
    console.log('Joined game. Entity ID:', this.entityId, 'Dimension:', this.dimension);

    // Send Client Settings (0x15) and MC|Brand (0x17)
    this.sendClientSettings();
    this.sendPluginMessage('MC|Brand', 'vanilla');
  }

  handleChatMessage(buf) {
    const jsonStr = buf.readString();
    const position = buf.readByte();
    const text = this.parseChatJson(jsonStr);
    this.addChat(text);
  }

  parseChatJson(json) {
    try {
      const obj = JSON.parse(json);
      return this.extractChatText(obj);
    } catch {
      return json;
    }
  }

  extractChatText(obj) {
    if (typeof obj === 'string') return obj;
    let text = obj.text || '';
    if (obj.translate) {
      text = obj.translate;
      if (obj.with) {
        obj.with.forEach((w, i) => {
          text = text.replace(`%${i+1}$s`, this.extractChatText(w));
          text = text.replace('%s', this.extractChatText(w));
        });
      }
    }
    if (obj.extra) {
      for (const e of obj.extra) {
        text += this.extractChatText(e);
      }
    }
    return text;
  }

  handleTimeUpdate(buf) {
    const worldAge = buf.readLong();
    const timeOfDay = buf.readLong();
  }

  handleUpdateHealth(buf) {
    this.health = buf.readFloat();
    this.food = buf.readVarInt();
    this.foodSaturation = buf.readFloat();

    this.updateHealthDisplay();

    if (this.health <= 0) {
      this.addChat('You died!', '#ff5555');
      setTimeout(() => {
        this.sendPacket(ClientPackets.CLIENT_STATUS, new PacketWriter().writeVarInt(0));
      }, 2000);
    }
  }

  handlePositionAndLook(buf) {
    const x = buf.readDouble();
    const y = buf.readDouble();
    const z = buf.readDouble();
    const yaw = buf.readFloat();
    const pitch = buf.readFloat();
    const flags = buf.readByte();

    if (!this.controls) return;

    if (flags & 0x01) this.controls.position.x += x;
    else this.controls.position.x = x;

    if (flags & 0x02) this.controls.position.y += y;
    else this.controls.position.y = y;

    if (flags & 0x04) this.controls.position.z += z;
    else this.controls.position.z = z;

    if (flags & 0x08) this.controls.yaw += (-yaw * Math.PI / 180);
    else this.controls.yaw = -yaw * Math.PI / 180;

    if (flags & 0x10) this.controls.pitch += (-pitch * Math.PI / 180);
    else this.controls.pitch = -pitch * Math.PI / 180;

    this.controls.velocity.set(0, 0, 0);
    this.controls.onGround = true;

    // Confirm teleport (send position back)
    const writer = new PacketWriter()
      .writeDouble(this.controls.position.x)
      .writeDouble(this.controls.position.y)
      .writeDouble(this.controls.position.z)
      .writeFloat(this.controls.getYawDegrees())
      .writeFloat(this.controls.getPitchDegrees())
      .writeBoolean(true);
    this.sendPacket(ClientPackets.PLAYER_POSITION_AND_LOOK, writer);

    this.updateLoadingProgress('Spawn position received! Preparing world...', 70);
    console.log(`Teleported to ${this.controls.position.x.toFixed(1)}, ${this.controls.position.y.toFixed(1)}, ${this.controls.position.z.toFixed(1)}`);
  }

  handleChunkData(buf) {
    const chunkX = buf.readInt();
    const chunkZ = buf.readInt();
    const groundUp = buf.readBoolean();
    const bitmask = buf.readUShort();
    const size = buf.readVarInt();

    if (bitmask === 0 && groundUp) {
      this.world.removeChunk(chunkX, chunkZ);
      return;
    }

    this.world.parseChunkData(buf, chunkX, chunkZ, groundUp, bitmask);
    this.onChunkReceived();
  }

  handleChunkBulk(buf) {
    this.world.parseChunkBulk(buf);
    this.onChunkReceived();
  }

  onChunkReceived() {
    const count = this.world.chunks.size;
    const pct = Math.min(95, 50 + count * 2);
    this.updateLoadingProgress(`Loading terrain (${count} chunks ready)...`, pct);

    if (count >= 10) {
      this.hideLoadingOverlay();
    }
  }

  handleBlockChange(buf) {
    const pos = buf.readPosition();
    const blockState = buf.readVarInt();
    const blockId = blockState >> 4;
    this.world.setBlock(pos.x, pos.y, pos.z, blockId);

    // Mark affected chunks as dirty
    const cx = Math.floor(pos.x / 16);
    const cz = Math.floor(pos.z / 16);
    const chunk = this.world.getChunk(cx, cz);
    if (chunk) chunk.dirty = true;

    // Also dirty neighbors if on chunk edge
    const lx = ((pos.x % 16) + 16) % 16;
    const lz = ((pos.z % 16) + 16) % 16;
    if (lx === 0) { const n = this.world.getChunk(cx-1, cz); if (n) n.dirty = true; }
    if (lx === 15) { const n = this.world.getChunk(cx+1, cz); if (n) n.dirty = true; }
    if (lz === 0) { const n = this.world.getChunk(cx, cz-1); if (n) n.dirty = true; }
    if (lz === 15) { const n = this.world.getChunk(cx, cz+1); if (n) n.dirty = true; }
  }

  handleMultiBlockChange(buf) {
    const chunkX = buf.readInt();
    const chunkZ = buf.readInt();
    const count = buf.readVarInt();
    for (let i = 0; i < count; i++) {
      const record = buf.readUShort();
      const blockState = buf.readVarInt();
      const blockId = blockState >> 4;
      const x = (record >> 12) & 0xF;
      const z = (record >> 8) & 0xF;
      const y = record & 0xFF;
      this.world.setBlock(chunkX * 16 + x, y, chunkZ * 16 + z, blockId);
    }
    const chunk = this.world.getChunk(chunkX, chunkZ);
    if (chunk) chunk.dirty = true;
  }

  handleSpawnPosition(buf) {
    const pos = buf.readPosition();
    console.log('Spawn position:', pos);
  }

  handleSetExperience(buf) {
    this.xpProgress = buf.readFloat();
    this.xpLevel = buf.readVarInt();
    const totalXp = buf.readVarInt();
    this.updateXPDisplay();
  }

  handlePlayerAbilities(buf) {
    const flags = buf.readByte();
    const flySpeed = buf.readFloat();
    const walkSpeed = buf.readFloat();
  }

  handleSpawnPlayer(buf) {
    const eid = buf.readVarInt();
    const uuid = buf.readUUID();
    const x = buf.readInt() / 32.0;
    const y = buf.readInt() / 32.0;
    const z = buf.readInt() / 32.0;
    const yaw = buf.readAngle();
    const pitch = buf.readAngle();
    const currentItem = buf.readShort();

    const entity = { x, y, z, yaw, pitch, type: 'player', uuid };
    this.world.entities.set(eid, entity);
    this.renderer.updatePlayerMesh(uuid, entity);

    try { buf.readMetadata(); } catch(e) {}
  }

  handleSpawnMob(buf) {
    const eid = buf.readVarInt();
    const type = buf.readUByte();
    const x = buf.readInt() / 32.0;
    const y = buf.readInt() / 32.0;
    const z = buf.readInt() / 32.0;
    const yaw = buf.readAngle();
    const pitch = buf.readAngle();
    const headPitch = buf.readAngle();
    const velX = buf.readShort();
    const velY = buf.readShort();
    const velZ = buf.readShort();

    const entity = { x, y, z, yaw, pitch, type: 'mob', mobType: type };
    this.world.entities.set(eid, entity);
    this.renderer.updateEntityMesh(eid, entity);

    try { buf.readMetadata(); } catch(e) {}
  }

  handleSpawnObject(buf) {
    const eid = buf.readVarInt();
    const type = buf.readByte();
    const x = buf.readInt() / 32.0;
    const y = buf.readInt() / 32.0;
    const z = buf.readInt() / 32.0;
    const pitch = buf.readAngle();
    const yaw = buf.readAngle();
    const data = buf.readInt();

    const entity = { x, y, z, yaw, pitch, type: 'object', objectType: type };
    this.world.entities.set(eid, entity);
  }

  handleEntityRelativeMove(buf) {
    const eid = buf.readVarInt();
    const dx = buf.readByte() / 32.0;
    const dy = buf.readByte() / 32.0;
    const dz = buf.readByte() / 32.0;
    const onGround = buf.readBoolean();

    const entity = this.world.entities.get(eid);
    if (entity) {
      entity.x += dx;
      entity.y += dy;
      entity.z += dz;
      if (entity.type === 'player') {
        this.renderer.updatePlayerMesh(entity.uuid, entity);
      } else {
        this.renderer.updateEntityMesh(eid, entity);
      }
    }
  }

  handleEntityLookAndRelativeMove(buf) {
    const eid = buf.readVarInt();
    const dx = buf.readByte() / 32.0;
    const dy = buf.readByte() / 32.0;
    const dz = buf.readByte() / 32.0;
    const yaw = buf.readAngle();
    const pitch = buf.readAngle();
    const onGround = buf.readBoolean();

    const entity = this.world.entities.get(eid);
    if (entity) {
      entity.x += dx;
      entity.y += dy;
      entity.z += dz;
      entity.yaw = yaw;
      entity.pitch = pitch;
      if (entity.type === 'player') {
        this.renderer.updatePlayerMesh(entity.uuid, entity);
      } else {
        this.renderer.updateEntityMesh(eid, entity);
      }
    }
  }

  handleEntityTeleport(buf) {
    const eid = buf.readVarInt();
    const x = buf.readInt() / 32.0;
    const y = buf.readInt() / 32.0;
    const z = buf.readInt() / 32.0;
    const yaw = buf.readAngle();
    const pitch = buf.readAngle();
    const onGround = buf.readBoolean();

    const entity = this.world.entities.get(eid);
    if (entity) {
      entity.x = x;
      entity.y = y;
      entity.z = z;
      entity.yaw = yaw;
      entity.pitch = pitch;
      if (entity.type === 'player') {
        this.renderer.updatePlayerMesh(entity.uuid, entity);
      } else {
        this.renderer.updateEntityMesh(eid, entity);
      }
    }
  }

  handleDestroyEntities(buf) {
    const count = buf.readVarInt();
    for (let i = 0; i < count; i++) {
      const eid = buf.readVarInt();
      const entity = this.world.entities.get(eid);
      if (entity && entity.type === 'player') {
        this.renderer.removeEntityMesh('player_' + entity.uuid);
      } else {
        this.renderer.removeEntityMesh(eid);
      }
      this.world.entities.delete(eid);
    }
  }

  handleRespawn(buf) {
    this.dimension = buf.readInt();
    const difficulty = buf.readUByte();
    this.gameMode = buf.readUByte();
    const levelType = buf.readString();

    // Clear world on dimension change
    for (const [key, chunk] of this.world.chunks) {
      if (chunk.mesh) {
        chunk.mesh.forEach(m => {
          this.renderer.chunkGroup.remove(m);
          m.geometry.dispose();
          m.material.dispose();
        });
      }
    }
    this.world.chunks.clear();
    this.addChat('Respawning...', '#55ff55');
  }

  handleChangeGameState(buf) {
    const reason = buf.readUByte();
    const value = buf.readFloat();
    if (reason === 3) {
      this.gameMode = value;
    }
  }

  handleServerHeldItemChange(buf) {
    const slot = buf.readByte();
    this.controls.selectSlot(slot);
  }

  handleDisconnect(buf) {
    const reason = buf.readString();
    const text = this.parseChatJson(reason);
    this.addChat('Disconnected: ' + text, '#ff5555');
    this.disconnect();
  }

  handleWindowItems(buf) {
    const windowId = buf.readUByte();
    const count = buf.readShort();
    for (let i = 0; i < count; i++) {
      try { buf.readSlot(); } catch(e) { break; }
    }
  }

  handleSetSlot(buf) {
    const windowId = buf.readByte();
    const slot = buf.readShort();
    try { buf.readSlot(); } catch(e) {}
  }

  handleConfirmTransaction(buf) {
    const windowId = buf.readByte();
    const actionNumber = buf.readShort();
    const accepted = buf.readBoolean();

    // In 1.8.9, acknowledge transaction confirmation
    const writer = new PacketWriter()
      .writeByte(windowId)
      .writeShort(actionNumber)
      .writeBoolean(true);
    this.sendPacket(ClientPackets.CONFIRM_TRANSACTION, writer);
  }

  // Sending packets

  sendPluginMessage(channel, data) {
    const writer = new PacketWriter().writeString(channel);
    if (typeof data === 'string') {
      writer.writeString(data);
    } else if (data instanceof Uint8Array) {
      writer.writeBytes(data);
    }
    this.sendPacket(ClientPackets.PLUGIN_MESSAGE, writer);
  }

  sendPacket(id, writer) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // Proxy expects raw binary: varint packet id + body (it handles framing/compression)
    const payload = new PacketWriter().writeVarInt(id).writeBytes(writer.build()).build();
    this.ws.send(payload);
  }

  sendClientSettings() {
    const writer = new PacketWriter()
      .writeString('en_US')
      .writeByte(8) // view distance
      .writeByte(0) // chat mode
      .writeBoolean(true) // chat colors
      .writeByte(0x7F) // skin parts (all) - unsigned byte in 1.8
      ;
    this.sendPacket(ClientPackets.CLIENT_SETTINGS, writer);
  }

  sendChat(message) {
    const writer = new PacketWriter().writeString(message);
    this.sendPacket(ClientPackets.CHAT_MESSAGE, writer);
  }

  sendHeldItemChange(slot) {
    const writer = new PacketWriter().writeShort(slot);
    this.sendPacket(ClientPackets.HELD_ITEM_CHANGE, writer);
  }

  sendPositionAndLook() {
    const x = this.controls.position.x;
    const y = this.controls.position.y;
    const z = this.controls.position.z;
    const yaw = this.controls.getYawDegrees();
    const pitch = this.controls.getPitchDegrees();
    const onGround = this.controls.onGround;

    const posChanged = Math.abs(x - this.lastSentX) > 0.01 ||
                       Math.abs(y - this.lastSentY) > 0.01 ||
                       Math.abs(z - this.lastSentZ) > 0.01;
    const lookChanged = Math.abs(yaw - this.lastSentYaw) > 0.1 ||
                        Math.abs(pitch - this.lastSentPitch) > 0.1;

    if (posChanged || lookChanged) {
      const writer = new PacketWriter()
        .writeDouble(x)
        .writeDouble(y)
        .writeDouble(z)
        .writeFloat(yaw)
        .writeFloat(pitch)
        .writeBoolean(onGround);
      this.sendPacket(ClientPackets.PLAYER_POSITION_AND_LOOK, writer);

      this.lastSentX = x;
      this.lastSentY = y;
      this.lastSentZ = z;
      this.lastSentYaw = yaw;
      this.lastSentPitch = pitch;
    } else {
      const writer = new PacketWriter().writeBoolean(onGround);
      this.sendPacket(ClientPackets.PLAYER, writer);
    }
  }

  handleDig() {
    const target = this.controls.getRayTarget(this.world, 5);
    if (!target) return;

    // Send arm swing animation
    this.sendPacket(ClientPackets.ANIMATION, new PacketWriter());

    const pos = target.block;
    const writer = new PacketWriter()
      .writeByte(0) // status: started digging
      .writePosition(pos.x, pos.y, pos.z)
      .writeByte(1); // face
    this.sendPacket(ClientPackets.PLAYER_DIGGING, writer);

    if (this.gameMode === 1) {
      // Creative: instant break
      const writer2 = new PacketWriter()
        .writeByte(2) // status: finished digging
        .writePosition(pos.x, pos.y, pos.z)
        .writeByte(1);
      this.sendPacket(ClientPackets.PLAYER_DIGGING, writer2);

      this.world.setBlock(pos.x, pos.y, pos.z, 0);
    }
  }

  handlePlace() {
    const target = this.controls.getRayTarget(this.world, 5);
    if (!target || !target.adjacent) return;

    const pos = target.block;

    // Determine face from adjacent block relative to target
    const adj = target.adjacent;
    let face = 0;
    if (adj.y > pos.y) face = 1;      // top
    else if (adj.y < pos.y) face = 0;  // bottom
    else if (adj.z > pos.z) face = 3;  // south
    else if (adj.z < pos.z) face = 2;  // north
    else if (adj.x > pos.x) face = 5;  // east
    else if (adj.x < pos.x) face = 4;  // west

    const writer = new PacketWriter()
      .writePosition(pos.x, pos.y, pos.z)
      .writeByte(face)
      .writeShort(-1)    // held item: -1 = empty slot
      .writeByte(8)
      .writeByte(8)
      .writeByte(8);
    this.sendPacket(ClientPackets.PLAYER_BLOCK_PLACEMENT, writer);
  }

  // UI Updates

  addChat(text, color) {
    const container = document.getElementById('chat-messages');
    const line = document.createElement('div');
    line.className = 'chat-line';
    line.textContent = text;
    if (color) line.style.color = color;
    container.appendChild(line);

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;

    // Fade out after 10 seconds
    setTimeout(() => {
      line.classList.add('fading');
      setTimeout(() => {
        if (line.parentNode) line.parentNode.removeChild(line);
      }, 1000);
    }, 10000);

    // Keep max 50 messages
    while (container.children.length > 50) {
      container.removeChild(container.firstChild);
    }
  }

  updateHealthDisplay() {
    const healthPct = Math.max(0, this.health / 20 * 100);
    const hungerPct = Math.max(0, this.food / 20 * 100);
    document.getElementById('health-fill').style.width = healthPct + '%';
    document.getElementById('hunger-fill').style.width = hungerPct + '%';
    document.getElementById('health-text').textContent = `${Math.ceil(this.health)}/20`;
    document.getElementById('hunger-text').textContent = `${this.food}/20`;
  }

  updateXPDisplay() {
    document.getElementById('xp-fill').style.width = (this.xpProgress * 100) + '%';
    document.getElementById('xp-level').textContent = this.xpLevel;
  }

  updateDebugInfo() {
    if (document.getElementById('debug-info').style.display === 'none') return;
    const pos = this.controls.position;
    document.getElementById('position').textContent =
      `Pos: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
    document.getElementById('chunk-info').textContent =
      `Chunks: ${this.world.chunks.size}`;
  }

  // Game Loop

  gameLoop() {
    const now = performance.now();
    const dt = Math.min((now - this.lastTick) / 1000, 0.1);
    this.lastTick = now;

    // FPS counter
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 1) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      document.getElementById('fps').textContent = `FPS: ${this.fps}`;
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }

    // Update controls
    if (this.controls && !this.controls.paused) {
      this.controls.update(dt, this.world);
    }

    // Send position update every 50ms
    this.positionUpdateTimer += dt;
    if (this.positionUpdateTimer >= 0.05) {
      this.positionUpdateTimer = 0;
      if (this.connected) {
        this.sendPositionAndLook();
      }
    }

    // Update world rendering
    if (this.renderer) {
      this.renderer.updateChunks(this.world, this.controls.position.x, this.controls.position.z);

      // Update block highlight
      const target = this.controls.getRayTarget(this.world, 5);
      this.renderer.updateBlockHighlight(target ? target.block : null);

      this.renderer.render();
    }

    // Update debug
    this.updateDebugInfo();

    requestAnimationFrame(() => this.gameLoop());
  }
}

// Start
const game = new Game();
