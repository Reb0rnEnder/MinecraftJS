class PlayerControls {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;

    this.yaw = 0;
    this.pitch = 0;
    this.position = new THREE.Vector3(0, 70, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);

    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.jumping = false;
    this.sneaking = false;
    this.sprinting = false;
    this.onGround = false;

    this.selectedSlot = 0;
    this.locked = false;
    this.chatOpen = false;
    this.paused = false;

    this.sensitivity = 0.002;
    this.walkSpeed = 4.317;
    this.sprintSpeed = 5.612;
    this.jumpVelocity = 8.0;
    this.gravity = 25.0;
    this.playerHeight = 1.62;
    this.playerWidth = 0.3;

    this.lastPositionUpdate = 0;
    this.positionUpdateInterval = 50;

    this.setupControls();
  }

  setupControls() {
    this.canvas.addEventListener('click', () => {
      if (!this.locked && !this.paused) {
        this.canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    });

    document.addEventListener('keydown', (e) => {
      if (this.chatOpen) return;

      switch (e.code) {
        case 'KeyW': this.moveForward = true; break;
        case 'KeyS': this.moveBackward = true; break;
        case 'KeyA': this.moveLeft = true; break;
        case 'KeyD': this.moveRight = true; break;
        case 'Space': this.jumping = true; break;
        case 'ShiftLeft': this.sneaking = true; break;
        case 'ControlLeft': this.sprinting = true; break;
        case 'KeyT':
          if (this.locked) {
            e.preventDefault();
            this.openChat();
          }
          break;
        case 'Slash':
          if (this.locked) {
            e.preventDefault();
            this.openChat('/');
          }
          break;
        case 'Escape':
          if (this.chatOpen) {
            this.closeChat();
          } else if (this.locked) {
            document.exitPointerLock();
            this.togglePause(true);
          } else {
            this.togglePause(false);
          }
          break;
        case 'F3':
          e.preventDefault();
          this.toggleDebug();
          break;
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5':
        case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9':
          this.selectSlot(parseInt(e.code.charAt(5)) - 1);
          break;
      }
    });

    document.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW': this.moveForward = false; break;
        case 'KeyS': this.moveBackward = false; break;
        case 'KeyA': this.moveLeft = false; break;
        case 'KeyD': this.moveRight = false; break;
        case 'Space': this.jumping = false; break;
        case 'ShiftLeft': this.sneaking = false; break;
        case 'ControlLeft': this.sprinting = false; break;
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.onLeftClick();
      if (e.button === 2) this.onRightClick();
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      let slot = this.selectedSlot;
      if (e.deltaY > 0) slot++;
      else slot--;
      if (slot < 0) slot = 8;
      if (slot > 8) slot = 0;
      this.selectSlot(slot);
    });
  }

  selectSlot(slot) {
    this.selectedSlot = slot;
    document.querySelectorAll('.hotbar-slot').forEach((el, i) => {
      el.classList.toggle('selected', i === slot);
    });
    if (this.onSlotChange) this.onSlotChange(slot);
  }

  openChat(prefix) {
    this.chatOpen = true;
    const input = document.getElementById('chat-input');
    input.style.display = 'block';
    input.value = prefix || '';
    input.focus();
    document.exitPointerLock();

    const handler = (e) => {
      if (e.key === 'Enter') {
        const msg = input.value;
        if (msg.trim() && this.onChatSend) {
          this.onChatSend(msg);
        }
        this.closeChat();
        input.removeEventListener('keydown', handler);
      } else if (e.key === 'Escape') {
        this.closeChat();
        input.removeEventListener('keydown', handler);
      }
    };
    input.addEventListener('keydown', handler);
  }

  closeChat() {
    this.chatOpen = false;
    const input = document.getElementById('chat-input');
    input.style.display = 'none';
    input.value = '';
    if (!this.paused) {
      this.canvas.requestPointerLock();
    }
  }

  togglePause(show) {
    this.paused = show;
    document.getElementById('pause-menu').style.display = show ? 'flex' : 'none';
  }

  toggleDebug() {
    const debug = document.getElementById('debug-info');
    debug.style.display = debug.style.display === 'none' ? 'block' : 'none';
  }

  onLeftClick() {
    if (this.onDigStart) this.onDigStart();
  }

  onRightClick() {
    if (this.onBlockPlace) this.onBlockPlace();
  }

  getRayTarget(world, maxDist) {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const pos = this.camera.position.clone();

    const step = 0.05;
    let prevX, prevY, prevZ;

    for (let d = 0; d < maxDist; d += step) {
      const x = Math.floor(pos.x + dir.x * d);
      const y = Math.floor(pos.y + dir.y * d);
      const z = Math.floor(pos.z + dir.z * d);

      const block = world.getBlock(x, y, z);
      if (block !== 0 && block !== 8 && block !== 9 && block !== 10 && block !== 11) {
        return {
          block: { x, y, z, id: block },
          adjacent: prevX !== undefined ? { x: prevX, y: prevY, z: prevZ } : null
        };
      }
      prevX = x; prevY = y; prevZ = z;
    }
    return null;
  }

  update(dt, world) {
    const speed = this.sprinting ? this.sprintSpeed : this.walkSpeed;

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const moveDir = new THREE.Vector3(0, 0, 0);
    if (this.moveForward) moveDir.add(forward);
    if (this.moveBackward) moveDir.sub(forward);
    if (this.moveLeft) moveDir.sub(right);
    if (this.moveRight) moveDir.add(right);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      this.velocity.x = moveDir.x * speed;
      this.velocity.z = moveDir.z * speed;
    } else {
      this.velocity.x *= 0.8;
      this.velocity.z *= 0.8;
      if (Math.abs(this.velocity.x) < 0.01) this.velocity.x = 0;
      if (Math.abs(this.velocity.z) < 0.01) this.velocity.z = 0;
    }

    // Gravity
    this.velocity.y -= this.gravity * dt;

    // Jump
    if (this.jumping && this.onGround) {
      this.velocity.y = this.jumpVelocity;
      this.onGround = false;
    }

    // Collision detection
    const newPos = this.position.clone();
    newPos.x += this.velocity.x * dt;
    newPos.y += this.velocity.y * dt;
    newPos.z += this.velocity.z * dt;

    // Simple AABB collision
    if (world) {
      // Y collision (feet and head)
      const feetY = Math.floor(newPos.y);
      const headY = Math.floor(newPos.y + this.playerHeight);
      const px = Math.floor(newPos.x);
      const pz = Math.floor(newPos.z);

      // Check feet
      if (this.velocity.y <= 0) {
        const testFeetY = Math.floor(newPos.y);
        const w = this.playerWidth;
        const b1 = world.getBlock(Math.floor(newPos.x - w), testFeetY, Math.floor(newPos.z - w));
        const b2 = world.getBlock(Math.floor(newPos.x + w), testFeetY, Math.floor(newPos.z - w));
        const b3 = world.getBlock(Math.floor(newPos.x - w), testFeetY, Math.floor(newPos.z + w));
        const b4 = world.getBlock(Math.floor(newPos.x + w), testFeetY, Math.floor(newPos.z + w));
        if ((b1 && SOLID_BLOCKS.has(b1)) || (b2 && SOLID_BLOCKS.has(b2)) || (b3 && SOLID_BLOCKS.has(b3)) || (b4 && SOLID_BLOCKS.has(b4))) {
          newPos.y = testFeetY + 1;
          this.velocity.y = 0;
          this.onGround = true;
        } else {
          this.onGround = false;
        }
      }

      // Check head
      if (this.velocity.y > 0) {
        const blockAbove = world.getBlock(px, headY + 1, pz);
        if (blockAbove !== 0 && SOLID_BLOCKS.has(blockAbove)) {
          this.velocity.y = 0;
        }
      }

      // X collision
      const checkX = Math.floor(newPos.x + (this.velocity.x > 0 ? this.playerWidth : -this.playerWidth));
      for (let cy = Math.floor(newPos.y); cy <= Math.floor(newPos.y + this.playerHeight); cy++) {
        if (world.getBlock(checkX, cy, pz) !== 0 && SOLID_BLOCKS.has(world.getBlock(checkX, cy, pz))) {
          newPos.x = this.position.x;
          this.velocity.x = 0;
          break;
        }
      }

      // Z collision
      const checkZ = Math.floor(newPos.z + (this.velocity.z > 0 ? this.playerWidth : -this.playerWidth));
      for (let cy = Math.floor(newPos.y); cy <= Math.floor(newPos.y + this.playerHeight); cy++) {
        if (world.getBlock(px, cy, checkZ) !== 0 && SOLID_BLOCKS.has(world.getBlock(px, cy, checkZ))) {
          newPos.z = this.position.z;
          this.velocity.z = 0;
          break;
        }
      }
    }

    this.position.copy(newPos);

    // Update camera
    this.camera.position.set(this.position.x, this.position.y + this.playerHeight, this.position.z);

    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }

  getYawDegrees() {
    return ((-this.yaw * 180 / Math.PI) % 360 + 360) % 360;
  }

  getPitchDegrees() {
    return -this.pitch * 180 / Math.PI;
  }
}
