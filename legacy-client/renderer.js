class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x87CEEB);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.chunkGroup = new THREE.Group();
    this.scene.add(this.chunkGroup);

    this.entityMeshes = new Map();

    this.blockHighlight = null;
    this.setupBlockHighlight();
    this.setupLighting();
    this.setupSky();

    this.meshQueue = [];
    this.meshPerFrame = 2;

    window.addEventListener('resize', () => this.onResize());
  }

  setupLighting() {
    const ambient = new THREE.AmbientLight(0xcccccc, 0.7);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 0.5);
    sun.position.set(100, 200, 100);
    this.scene.add(sun);
  }

  setupSky() {
    this.scene.fog = new THREE.Fog(0x87CEEB, 150, 400);

    const skyGeo = new THREE.SphereGeometry(450, 16, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x87CEEB,
      side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);
  }

  setupBlockHighlight() {
    const geo = new THREE.BoxGeometry(1.005, 1.005, 1.005);
    const edges = new THREE.EdgesGeometry(geo);
    const mat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    this.blockHighlight = new THREE.LineSegments(edges, mat);
    this.blockHighlight.visible = false;
    this.scene.add(this.blockHighlight);
  }

  updateBlockHighlight(target) {
    if (!target) {
      this.blockHighlight.visible = false;
      return;
    }
    this.blockHighlight.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
    this.blockHighlight.visible = true;
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  buildChunkMesh(chunk, world) {
    if (!chunk.dirty) return;
    chunk.dirty = false;

    if (chunk.mesh) {
      chunk.mesh.forEach(m => {
        this.chunkGroup.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      });
    }
    chunk.mesh = [];

    const positions = [];
    const colors = [];
    const normals = [];
    const transparentPositions = [];
    const transparentColors = [];
    const transparentNormals = [];

    const cx = chunk.x * 16;
    const cz = chunk.z * 16;

    const faces = [
      { dir: [0, 1, 0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },   // top
      { dir: [0, -1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },  // bottom
      { dir: [0, 0, 1], corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] },   // south
      { dir: [0, 0, -1], corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]] },  // north
      { dir: [1, 0, 0], corners: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]] },   // east
      { dir: [-1, 0, 0], corners: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]] },  // west
    ];

    const faceShading = [1.0, 0.5, 0.8, 0.8, 0.6, 0.6];

    for (let section = 0; section < 16; section++) {
      if (!chunk.sections[section]) continue;

      for (let ly = 0; ly < 16; ly++) {
        for (let lz = 0; lz < 16; lz++) {
          for (let lx = 0; lx < 16; lx++) {
            const blockId = chunk.sections[section].getBlock(lx, ly, lz);
            if (blockId === 0) continue;

            const wx = cx + lx;
            const wy = section * 16 + ly;
            const wz = cz + lz;

            const baseColor = BLOCK_COLORS[blockId] || 0xFF00FF;
            let r, g, b;

            const isTransparent = TRANSPARENT_BLOCKS.has(blockId) && blockId !== 0;
            const targetPos = isTransparent ? transparentPositions : positions;
            const targetCol = isTransparent ? transparentColors : colors;
            const targetNor = isTransparent ? transparentNormals : normals;

            for (let fi = 0; fi < 6; fi++) {
              const face = faces[fi];

              // Per-face color for grass/mycelium
              let faceColor = baseColor;
              if (blockId === 2) { // grass
                if (fi === 0) faceColor = 0x5b8731; // top = green
                else if (fi === 1) faceColor = 0x866043; // bottom = dirt
                else faceColor = 0x7a6b4e; // sides = dirt-ish with green tint
              }
              r = ((faceColor >> 16) & 0xFF) / 255;
              g = ((faceColor >> 8) & 0xFF) / 255;
              b = (faceColor & 0xFF) / 255;
              const nx = lx + face.dir[0];
              const ny = ly + face.dir[1] + section * 16;
              const nz = lz + face.dir[2];

              let neighbor;
              if (nx >= 0 && nx < 16 && nz >= 0 && nz < 16 && ny >= 0 && ny < 256) {
                neighbor = chunk.getBlock(nx, ny, nz);
              } else {
                neighbor = world.getBlock(wx + face.dir[0], wy + face.dir[1], wz + face.dir[2]);
              }

              if (neighbor !== 0 && !TRANSPARENT_BLOCKS.has(neighbor)) continue;
              if (neighbor === blockId && isTransparent) continue;

              const shade = faceShading[fi];
              const c = face.corners;

              // Two triangles per face
              targetPos.push(
                c[0][0]+lx, c[0][1]+wy, c[0][2]+lz,
                c[1][0]+lx, c[1][1]+wy, c[1][2]+lz,
                c[2][0]+lx, c[2][1]+wy, c[2][2]+lz,
                c[0][0]+lx, c[0][1]+wy, c[0][2]+lz,
                c[2][0]+lx, c[2][1]+wy, c[2][2]+lz,
                c[3][0]+lx, c[3][1]+wy, c[3][2]+lz
              );

              for (let v = 0; v < 6; v++) {
                targetCol.push(r * shade, g * shade, b * shade);
                targetNor.push(face.dir[0], face.dir[1], face.dir[2]);
              }
            }
          }
        }
      }
    }

    if (positions.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

      const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, 0, cz);
      this.chunkGroup.add(mesh);
      chunk.mesh.push(mesh);
    }

    if (transparentPositions.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(transparentPositions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(transparentColors, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(transparentNormals, 3));

      const mat = new THREE.MeshLambertMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.8
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, 0, cz);
      mesh.renderOrder = 1;
      this.chunkGroup.add(mesh);
      chunk.mesh.push(mesh);
    }
  }

  updateChunks(world, playerX, playerZ) {
    const playerCX = Math.floor(playerX / 16);
    const playerCZ = Math.floor(playerZ / 16);
    const renderDist = 6;
    let built = 0;

    for (const [key, chunk] of world.chunks) {
      const dx = Math.abs(chunk.x - playerCX);
      const dz = Math.abs(chunk.z - playerCZ);

      if (dx > renderDist + 2 || dz > renderDist + 2) {
        if (chunk.mesh) {
          chunk.mesh.forEach(m => {
            this.chunkGroup.remove(m);
            m.geometry.dispose();
            m.material.dispose();
          });
          chunk.mesh = [];
        }
        continue;
      }

      if (chunk.dirty && dx <= renderDist && dz <= renderDist && built < this.meshPerFrame) {
        this.buildChunkMesh(chunk, world);
        built++;
      }
    }
  }

  updateEntityMesh(entityId, entity) {
    let mesh = this.entityMeshes.get(entityId);
    if (!mesh) {
      const geo = new THREE.BoxGeometry(0.6, 1.8, 0.6);
      const mat = new THREE.MeshLambertMaterial({ color: 0xff8800 });
      mesh = new THREE.Mesh(geo, mat);
      this.scene.add(mesh);
      this.entityMeshes.set(entityId, mesh);
    }
    mesh.position.set(entity.x, entity.y + 0.9, entity.z);
  }

  removeEntityMesh(entityId) {
    const mesh = this.entityMeshes.get(entityId);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      this.entityMeshes.delete(entityId);
    }
  }

  updatePlayerMesh(uuid, player) {
    let mesh = this.entityMeshes.get('player_' + uuid);
    if (!mesh) {
      const bodyGeo = new THREE.BoxGeometry(0.6, 1.5, 0.3);
      const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4488cc });
      const headMat = new THREE.MeshLambertMaterial({ color: 0xffcc88 });

      const body = new THREE.Mesh(bodyGeo, bodyMat);
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 1.0;

      const group = new THREE.Group();
      group.add(body);
      group.add(head);
      this.scene.add(group);
      this.entityMeshes.set('player_' + uuid, group);
      mesh = group;
    }
    if (player.x !== undefined) {
      mesh.position.set(player.x, player.y, player.z);
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
