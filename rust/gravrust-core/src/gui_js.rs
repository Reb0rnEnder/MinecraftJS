// Port of `client/js/gui/gui.js`.
//
// The 2D GUI layer rendered through the graphics device (vanilla-like drawing
// helpers). Quads are accumulated for the whole frame and drawn in order at
// `end()` (one vertex upload per frame).
//
// Browser-bound surfaces stay behind traits with the exact call sequences of
// the JavaScript: the graphics device (`gfx/device.js`: createMesh,
// updateMesh, draw, setGlobals, setScissor, clearDepth), the asset pipeline
// (`assets.texture/image`) and glyph rasterisation (`FontRenderer.draw`,
// measurement ported in `crate::gui::font`). The scene-graph walk of
// `drawNode` reaches `gfx/scene.js` `toDraw` through the [`SceneToDraw`]
// contract until that module is ported.

use crate::math::{identity_matrix, multiply, ortho, rotate, scale, translate};

/// JS: `const MAX_QUADS = 65536;`
pub const MAX_QUADS: usize = 65536;
/// JS: `const STRIDE = FORMAT.color.stride;` (`gfx/device.js`: pos 3, uv 2, col 4).
pub const STRIDE: usize = 9;
/// JS: `const GUI_PARAMS = colorParams(1, 1, 1, 1, 0.004, 0);`
/// (`colorParams(r,g,b,a,alphaTest,useFog)` fills a 16-float param block).
pub fn gui_params() -> [f32; 16] {
    let mut p = [0.0f32; 16];
    p[0] = 1.0;
    p[1] = 1.0;
    p[2] = 1.0;
    p[3] = 1.0;
    p[4] = 0.004;
    p
}
/// JS: `import{EMPTY_DYNAMIC_LIGHTS}from'../gfx/dynamic-lighting.js'` —
/// `new Float32Array(24)`; defined here until that module is ported.
pub fn empty_dynamic_lights() -> [f32; 24] {
    [0.0; 24]
}
/// JS: `export function argb(c)`.
pub fn argb(c: u32) -> [f32; 4] {
    [
        ((c >> 16) & 255) as f32 / 255.0,
        ((c >> 8) & 255) as f32 / 255.0,
        (c & 255) as f32 / 255.0,
        ((c >> 24) & 255) as f32 / 255.0,
    ]
}
/// JS: `const WHITE = [1, 1, 1, 1]; export { WHITE };`
pub const WHITE: [f32; 4] = [1.0, 1.0, 1.0, 1.0];

pub type Mat4 = [f32; 16];
/// Opaque mesh handle minted by the device.
pub type MeshId = u32;
/// Opaque texture handle minted by the device/assets.
pub type TextureId = u32;

/// The per-command state JS builds as `{ blend, ...depth }` or
/// `{ blend, depthTest: false, depthWrite: false }`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DrawState {
    /// JS: `blend` — `'alpha' | 'invert' | 'darken' | ...`.
    pub blend: &'static str,
    pub depth: Option<DepthState>,
}

impl DrawState {
    /// JS: `c.depth ? { blend: c.blend, ...c.depth } : { blend: c.blend, depthTest: false, depthWrite: false }`.
    pub fn of(blend: &'static str, depth: Option<DepthState>) -> Self {
        DrawState { blend, depth }
    }
}

/// Depth state for following quads. JS: `null` = no depth test, else
/// `{ depthTest, depthWrite }`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DepthState {
    pub depth_test: bool,
    pub depth_write: bool,
}

/// A queued 3D draw (item models, scene nodes). JS builds these as object
/// spreads; the device receives them verbatim plus the model matrix.
#[derive(Debug, Clone)]
pub struct QueuedDraw {
    pub mesh: MeshId,
    /// JS: `pipeline` — the device pipeline name (e.g. `'color'`).
    pub pipeline: String,
    pub textures: Vec<TextureId>,
    pub params: [f32; 16],
    pub state: DrawState,
    pub first: usize,
    pub count: usize,
    /// JS: `model` — model matrix relative to the current GUI matrix.
    pub model: Mat4,
}

/// One accumulated command. JS: `{ kind: 'quads', texture, blend, scissor,
/// depth, first, count }` or `{ kind: 'draw', scissor, draw }`.
#[derive(Debug, Clone)]
pub enum GuiCommand {
    Quads {
        texture: Option<TextureId>,
        blend: &'static str,
        scissor: Option<[f64; 4]>,
        depth: Option<DepthState>,
        first: usize,
        count: usize,
    },
    Draw {
        scissor: Option<[f64; 4]>,
        draw: QueuedDraw,
    },
}

impl GuiCommand {
    /// The command's scissor rect, shared by both kinds.
    fn scissor(&self) -> Option<[f64; 4]> {
        match self {
            GuiCommand::Quads { scissor, .. } | GuiCommand::Draw { scissor, .. } => *scissor,
        }
    }
}

/// JS: `this.device` — the graphics device (`gfx/device.js`), which stays
/// browser-bound (WebGL2/WebGPU). The ported GUI drives it through this
/// contract with the same call order and arguments.
pub trait GfxDevice {
    /// JS: `device.createMesh(FORMAT.color, verts, { quads, dynamic })`.
    fn create_mesh(&mut self, format: &str, verts: &[f32], quads: bool, dynamic: bool) -> MeshId;
    /// JS: `device.updateMesh(mesh, verts, { quads: true })`.
    fn update_mesh(&mut self, mesh: MeshId, verts: &[f32], quads: bool);
    /// JS: `device.createTexture({ width, height, data })`.
    fn create_texture(&mut self, width: u32, height: u32, data: &[u8]) -> TextureId;
    /// JS: `device.clearDepth()`.
    fn clear_depth(&mut self);
    /// JS: `device.setGlobals({ view, proj, fogMode, dynamicLights })`.
    fn set_globals(&mut self, view: &Mat4, proj: &Mat4, fog_mode: i32, dynamic_lights: &[f32]);
    /// JS: `device.setScissor(rect | null)` — rect in pixels, origin top-left.
    fn set_scissor(&mut self, rect: Option<[f64; 4]>);
    /// JS: `device.draw({ mesh, pipeline: 'color', textures, params, state, first, count })`.
    fn draw_quads(
        &mut self,
        mesh: MeshId,
        textures: &[TextureId],
        params: &[f32; 16],
        state: DrawState,
        first: usize,
        count: usize,
    );
    /// JS: `device.draw(draw)` — a queued 3D draw record.
    fn draw(&mut self, draw: &QueuedDraw);
}

/// JS: `this.assets` — texture/image lookups (browser-bound pipeline).
pub trait GuiAssets {
    /// JS: `assets.texture(path)` / `assets.texture(path, { wrap: 'repeat' })`.
    fn texture(&self, path: &str, wrap_repeat: bool) -> Option<TextureId>;
    /// JS: `assets.image(path)`.
    fn image(&self, path: &str) -> Option<AssetImage>;
    /// JS: `drawNode`'s `resolve` for non-string texture refs.
    fn texture_resolved(&self, t: &SceneTextureRef) -> Option<TextureId>;
}

/// JS: an `assets.image(path)` result: dimensions plus RGBA pixels.
#[derive(Debug, Clone)]
pub struct AssetImage {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

/// JS: `drawNode`'s texture references are strings or resolved handles.
#[derive(Debug, Clone)]
pub enum SceneTextureRef {
    Path(String),
    Handle(TextureId),
}

/// JS: `this.font` — the `FontRenderer` from `gui/font.js`. Measurement is
/// ported in `crate::gui::font`; glyph rasterisation (layout + quads) is
/// browser-bound and reaches the ported calls through this contract.
pub trait FontDraw {
    /// JS: `font.draw(s, x, y, color, shadow)` — returns the drawn width.
    fn draw(&mut self, s: &str, x: f64, y: f64, color: u32, shadow: bool) -> f64;
    /// JS: `font.drawCentered(s, cx, y, color, shadow)`.
    fn draw_centered(&mut self, s: &str, cx: f64, y: f64, color: u32, shadow: bool) -> f64;
    /// JS: `font.width(s)`.
    fn width(&self, s: &str) -> f64;
}

/// JS: a scene node entry from `node.collect()` (`gfx/scene.js`): the draw
/// data `d` (with `d.order`) and its world matrix.
pub struct SceneEntry {
    /// JS: `d.order || 0` — sort key.
    pub order: f64,
    /// Opaque draw data; handed to [`SceneToDraw::to_draw`] verbatim.
    pub data: Vec<f32>,
    /// JS: `world` — the node's world matrix (16 floats).
    pub world: Vec<f32>,
}

/// JS: `toDraw(d, world, resolve)` from `gfx/scene.js` — converts collected
/// scene data into device draw records. That module is not ported yet, so the
/// GUI reaches it through this contract.
pub trait SceneToDraw {
    fn to_draw(
        &mut self,
        data: &[f32],
        world: &[f32],
        resolve: &mut dyn FnMut(&SceneTextureRef) -> Option<TextureId>,
    ) -> Option<QueuedDraw>;
}

/// JS: a scene node (`gfx/scene.js`) walked by `drawNode`.
pub trait SceneNode {
    /// JS: `node.updateWorld(m, null)`.
    fn update_world(&mut self, m: &Mat4, parent: Option<&Mat4>);
    /// JS: `node.collect([])`.
    fn collect(&self, out: Vec<SceneEntry>) -> Vec<SceneEntry>;
}

/// The ported `Gui` class.
pub struct Gui {
    /// JS: `this.device`.
    pub device: Box<dyn GfxDevice>,
    /// JS: `this.assets`.
    pub assets: Box<dyn GuiAssets>,
    /// JS: `this.font = new FontRenderer(this)`.
    pub font: Box<dyn FontDraw>,
    /// JS: `this.guiScaleSetting = 0; // 0 = auto`.
    pub gui_scale_setting: i32,
    /// JS: `this.scale = 2`.
    pub scale: i32,
    /// JS: `this.width = 0`.
    pub width: i32,
    /// JS: `this.height = 0`.
    pub height: i32,
    /// JS: `this.verts = new Float32Array(MAX_QUADS * 4 * STRIDE)`.
    pub verts: Vec<f32>,
    /// JS: `this.quadCount = 0`.
    pub quad_count: usize,
    /// JS: `this.mesh`.
    pub mesh: MeshId,
    /// JS: `this.white` — a 1x1 white texture.
    pub white: TextureId,
    /// JS: `this.commands`.
    pub commands: Vec<GuiCommand>,
    /// JS: `this.stack = [mat4.create()]`.
    pub stack: Vec<Mat4>,
    /// JS: `this.color = [1, 1, 1, 1]`.
    pub color: [f32; 4],
    /// JS: `this.blend = 'alpha'`.
    pub blend: &'static str,
    /// JS: `this.scissorRect = null`.
    pub scissor_rect: Option<[f64; 4]>,
    /// JS: `this.depth` — set by `setDepth` (created in `begin()` in JS).
    pub depth: Option<DepthState>,
    /// JS: `this.iconDepth = 0`.
    pub icon_depth: i32,
    /// JS: `this.proj = mat4.create()`.
    pub proj: Mat4,
    /// JS: `this._cur` — the current open batch (index into `commands`).
    cur: Option<usize>,
    /// The live platform size. JS reads `platform().width/height` on every
    /// `resize()`/`end()`; the host pushes the current values here instead so
    /// the ported code never touches browser globals.
    platform_w: f64,
    platform_h: f64,
}

impl Gui {
    /// JS: `constructor(device, assets)`.
    pub fn new(mut device: Box<dyn GfxDevice>, assets: Box<dyn GuiAssets>, font: Box<dyn FontDraw>) -> Self {
        // JS: this.verts = new Float32Array(MAX_QUADS * 4 * STRIDE);
        let verts = vec![0.0f32; MAX_QUADS * 4 * STRIDE];
        // JS: this.mesh = device.createMesh(FORMAT.color, new Float32Array(0), { quads: true, dynamic: true });
        let mesh = device.create_mesh("color", &[], true, true);
        // JS: this.white = device.createTexture({ width: 1, height: 1, data: new Uint8Array([255,255,255,255]) });
        let white = device.create_texture(1, 1, &[255, 255, 255, 255]);
        let mut gui = Gui {
            device,
            assets,
            font,
            gui_scale_setting: 0,
            scale: 2,
            width: 0,
            height: 0,
            verts,
            quad_count: 0,
            mesh,
            white,
            commands: Vec::new(),
            stack: vec![identity_matrix()],
            color: [1.0, 1.0, 1.0, 1.0],
            blend: "alpha",
            scissor_rect: None,
            depth: None,
            icon_depth: 0,
            proj: identity_matrix(),
            cur: None,
            platform_w: 0.0,
            platform_h: 0.0,
        };
        gui.resize();
        gui
    }

    /// Push the current platform surface size (JS: `platform().width/height`).
    /// The host calls this before `resize()`/`end()` each frame.
    pub fn set_platform_size(&mut self, w: f64, h: f64) {
        self.platform_w = w;
        self.platform_h = h;
    }

    /// JS: `get matrix() { return this.stack[this.stack.length - 1]; }`.
    pub fn matrix(&self) -> &Mat4 {
        self.stack.last().unwrap()
    }

    /// JS: `resize()`.
    pub fn resize(&mut self) {
        let (w, h) = (self.platform_w, self.platform_h);
        let mut scale: i32 = 1;
        // JS: const max = this.guiScaleSetting === 0 ? 1000 : this.guiScaleSetting;
        let max = if self.gui_scale_setting == 0 { 1000 } else { self.gui_scale_setting };
        // JS: while (scale < max && w / (scale + 1) >= 320 && h / (scale + 1) >= 240) scale++;
        while scale < max && w / (scale as f64 + 1.0) >= 320.0 && h / (scale as f64 + 1.0) >= 240.0 {
            scale += 1;
        }
        self.scale = scale;
        // JS: this.width = Math.ceil(w / scale); this.height = Math.ceil(h / scale);
        self.width = (w / scale as f64).ceil() as i32;
        self.height = (h / scale as f64).ceil() as i32;
    }

    /// JS: `begin()`.
    pub fn begin(&mut self) {
        self.quad_count = 0;
        self.commands.clear();
        self.stack.truncate(1);
        self.stack[0] = identity_matrix();
        self.color = [1.0, 1.0, 1.0, 1.0];
        self.blend = "alpha";
        self.scissor_rect = None;
        self.depth = None;
        self.icon_depth = 0;
        self.cur = None;
    }

    /// JS: `end()` — flush everything to the device (call once per frame).
    pub fn end(&mut self) {
        // JS: if (this.quadCount) d.updateMesh(this.mesh, this.verts.subarray(0, this.quadCount * 4 * STRIDE), { quads: true });
        if self.quad_count > 0 {
            let n = self.quad_count * 4 * STRIDE;
            let verts: Vec<f32> = self.verts[..n].to_vec();
            self.device.update_mesh(self.mesh, &verts, true);
        }
        // JS: const pw = platform().width / this.scale, ph = platform().height / this.scale;
        let pw = self.platform_w / self.scale as f64;
        let ph = self.platform_h / self.scale as f64;
        // JS: mat4.ortho(this.proj, 0, pw, ph, 0, -400000, 400000);
        self.proj = ortho(0.0, pw, ph, 0.0, -400000.0, 400000.0);
        self.device.clear_depth();
        // JS: d.setGlobals({ view: IDENTITY, proj: this.proj, fogMode: 2, dynamicLights: EMPTY_DYNAMIC_LIGHTS });
        let view = identity_matrix();
        let lights = empty_dynamic_lights();
        self.device.set_globals(&view, &self.proj, 2, &lights);
        let commands = std::mem::take(&mut self.commands);
        for c in &commands {
            // JS: d.setScissor(c.scissor ? [scaled rect] : null);
            let scissor = c.scissor().map(|s| {
                [
                    s[0] * self.scale as f64,
                    s[1] * self.scale as f64,
                    s[2] * self.scale as f64,
                    s[3] * self.scale as f64,
                ]
            });
            self.device.set_scissor(scissor);
            match c {
                GuiCommand::Quads { texture, blend, depth, first, count, .. } => {
                    // JS: const tex = (c.texture && (c.texture.bg || c.texture.tex)) ? c.texture : this.white;
                    let tex = texture.unwrap_or(self.white);
                    let state = DrawState::of(blend, *depth);
                    // JS: d.draw({ mesh, pipeline: 'color', textures: [tex], params: GUI_PARAMS, state, first: c.first * 6, count: c.count * 6 });
                    self.device.draw_quads(self.mesh, &[tex], &gui_params(), state, first * 6, count * 6);
                }
                GuiCommand::Draw { draw, .. } => {
                    // JS: d.draw(c.draw);
                    self.device.draw(draw);
                }
            }
        }
        self.commands = commands;
        // JS: d.setScissor(null);
        self.device.set_scissor(None);
    }

    // ---------------------------------------------------------------- state

    /// JS: `pushMatrix() { this.stack.push(new Float32Array(this.matrix)); }`.
    pub fn push_matrix(&mut self) {
        let m = *self.matrix();
        self.stack.push(m);
    }

    /// JS: `popMatrix() { if (this.stack.length > 1) this.stack.pop(); }`.
    pub fn pop_matrix(&mut self) {
        if self.stack.len() > 1 {
            self.stack.pop();
        }
    }

    /// JS: `translate(x, y, z = 0) { mat4.translate(this.matrix, this.matrix, x, y, z); }`.
    pub fn translate(&mut self, x: f64, y: f64, z: f64) {
        let m = *self.matrix();
        let i = self.stack.len() - 1;
        self.stack[i] = translate(&m, x, y, z);
    }

    /// JS: `scaleBy(x, y = x, z = 1) { mat4.scale(this.matrix, this.matrix, x, y, z); }`.
    pub fn scale_by(&mut self, x: f64, y: f64, z: f64) {
        let m = *self.matrix();
        let i = self.stack.len() - 1;
        self.stack[i] = scale(&m, x, y, z);
    }

    /// JS: `rotate(rad) { mat4.rotateZ(this.matrix, this.matrix, rad); }`.
    pub fn rotate(&mut self, rad: f64) {
        let m = *self.matrix();
        let i = self.stack.len() - 1;
        self.stack[i] = rotate(&m, rad, 0.0, 0.0, 1.0);
    }

    /// JS: `setColor(r, g, b, a)`.
    pub fn set_color(&mut self, r: f32, g: f32, b: f32, a: f32) {
        self.color = [r, g, b, a];
    }

    /// JS: `setAlpha(a) { this.color = [1, 1, 1, a]; }`.
    pub fn set_alpha(&mut self, a: f32) {
        self.color = [1.0, 1.0, 1.0, a];
    }

    /// JS: `resetColor()`.
    pub fn reset_color(&mut self) {
        self.color = [1.0, 1.0, 1.0, 1.0];
    }

    /// JS: `setBlend(mode) { this.blend = mode || 'alpha'; }`.
    pub fn set_blend(&mut self, mode: Option<&'static str>) {
        self.blend = mode.unwrap_or("alpha");
    }

    /// JS: `setDepth(state)` — depth state for following quads (null = no depth test).
    pub fn set_depth(&mut self, state: Option<DepthState>) {
        self.depth = state;
        self.cur = None;
    }

    /// JS: `scissor(x, y, w, h)` — scissor in GUI coordinates (axis aligned,
    /// ignores the matrix stack).
    pub fn scissor(&mut self, x: f64, y: f64, w: f64, h: f64) {
        self.scissor_rect = Some([x, y, w, h]);
        self.cur = None;
    }

    /// JS: `clearScissor()`.
    pub fn clear_scissor(&mut self) {
        self.scissor_rect = None;
        self.cur = None;
    }

    // ---------------------------------------------------------------- primitives

    /// JS: `_batch(texture)` — reuse the open batch when state matches.
    fn batch(&mut self, texture: Option<TextureId>) -> usize {
        if let Some(i) = self.cur {
            if let GuiCommand::Quads { texture: t, blend, scissor, depth, .. } = &self.commands[i] {
                if *t == texture && *blend == self.blend && *scissor == self.scissor_rect && *depth == self.depth {
                    return i;
                }
            }
        }
        let cmd = GuiCommand::Quads {
            texture,
            blend: self.blend,
            scissor: self.scissor_rect,
            depth: self.depth,
            first: self.quad_count,
            count: 0,
        };
        self.commands.push(cmd);
        self.cur = Some(self.commands.len() - 1);
        self.cur.unwrap()
    }

    /// JS: `quad(texture, x0, y0, x1, y1, u0, v0, u1, v1, c0, c1 = c0, c2 = c1, c3 = c0)` —
    /// emit a textured quad; corners in GUI space (before the matrix), uv in
    /// 0..1, colours per corner. Vertex order: (x0,y0) (x0,y1) (x1,y1) (x1,y0).
    #[allow(clippy::too_many_arguments)]
    pub fn quad(
        &mut self,
        texture: Option<TextureId>,
        x0: f64,
        y0: f64,
        x1: f64,
        y1: f64,
        u0: f32,
        v0: f32,
        u1: f32,
        v1: f32,
        c0: [f32; 4],
        c1: [f32; 4],
        c2: [f32; 4],
        c3: [f32; 4],
    ) {
        if texture.is_none() || self.quad_count >= MAX_QUADS {
            return;
        }
        let b = self.batch(texture);
        let m = *self.matrix();
        let mc = self.color;
        let mut o = self.quad_count * 4 * STRIDE;
        // JS: const pts = [[x0,y0,u0,v0,c0], [x0,y1,u0,v1,c1], [x1,y1,u1,v1,c2], [x1,y0,u1,v0,c3]];
        let pts: [(f64, f64, f32, f32, [f32; 4]); 4] = [
            (x0, y0, u0, v0, c0),
            (x0, y1, u0, v1, c1),
            (x1, y1, u1, v1, c2),
            (x1, y0, u1, v0, c3),
        ];
        for (x, y, u, vv, c) in pts {
            self.verts[o] = (m[0] as f64 * x + m[4] as f64 * y + m[12] as f64) as f32;
            self.verts[o + 1] = (m[1] as f64 * x + m[5] as f64 * y + m[13] as f64) as f32;
            self.verts[o + 2] = (m[2] as f64 * x + m[6] as f64 * y + m[14] as f64) as f32;
            self.verts[o + 3] = u;
            self.verts[o + 4] = vv;
            self.verts[o + 5] = c[0] * mc[0];
            self.verts[o + 6] = c[1] * mc[1];
            self.verts[o + 7] = c[2] * mc[2];
            self.verts[o + 8] = c[3] * mc[3];
            o += STRIDE;
        }
        self.quad_count += 1;
        if let GuiCommand::Quads { count, .. } = &mut self.commands[b] {
            *count += 1;
        }
    }

    /// JS: `quadUV(texture, x0, y0, x1, y1, uvs, c)` — quad with explicit
    /// per-corner uvs: `uvs = [[u,v] x4]` in corner order (x0,y0) (x0,y1) (x1,y1) (x1,y0).
    pub fn quad_uv(
        &mut self,
        texture: Option<TextureId>,
        x0: f64,
        y0: f64,
        x1: f64,
        y1: f64,
        uvs: [[f32; 2]; 4],
        c: [f32; 4],
    ) {
        if texture.is_none() || self.quad_count >= MAX_QUADS {
            return;
        }
        let b = self.batch(texture);
        let m = *self.matrix();
        let mc = self.color;
        let mut o = self.quad_count * 4 * STRIDE;
        let pts: [(f64, f64); 4] = [(x0, y0), (x0, y1), (x1, y1), (x1, y0)];
        for i in 0..4 {
            let (x, y) = pts[i];
            self.verts[o] = (m[0] as f64 * x + m[4] as f64 * y + m[12] as f64) as f32;
            self.verts[o + 1] = (m[1] as f64 * x + m[5] as f64 * y + m[13] as f64) as f32;
            self.verts[o + 2] = (m[2] as f64 * x + m[6] as f64 * y + m[14] as f64) as f32;
            self.verts[o + 3] = uvs[i][0];
            self.verts[o + 4] = uvs[i][1];
            self.verts[o + 5] = c[0] * mc[0];
            self.verts[o + 6] = c[1] * mc[1];
            self.verts[o + 7] = c[2] * mc[2];
            self.verts[o + 8] = c[3] * mc[3];
            o += STRIDE;
        }
        self.quad_count += 1;
        if let GuiCommand::Quads { count, .. } = &mut self.commands[b] {
            *count += 1;
        }
    }

    /// JS: `quadPoints(texture, pts, colors)` — arbitrary quad (triangles:
    /// repeat the last point) with per-corner colours; `pts = [[x, y] x4]`.
    pub fn quad_points(&mut self, texture: Option<TextureId>, pts: [(f64, f64); 4], colors: [[f32; 4]; 4]) {
        if texture.is_none() || self.quad_count >= MAX_QUADS {
            return;
        }
        let b = self.batch(texture);
        let m = *self.matrix();
        let mc = self.color;
        let mut o = self.quad_count * 4 * STRIDE;
        for i in 0..4 {
            let (x, y) = pts[i];
            let c = colors[i];
            self.verts[o] = (m[0] as f64 * x + m[4] as f64 * y + m[12] as f64) as f32;
            self.verts[o + 1] = (m[1] as f64 * x + m[5] as f64 * y + m[13] as f64) as f32;
            self.verts[o + 2] = (m[2] as f64 * x + m[6] as f64 * y + m[14] as f64) as f32;
            self.verts[o + 3] = 0.0;
            self.verts[o + 4] = 0.0;
            self.verts[o + 5] = c[0] * mc[0];
            self.verts[o + 6] = c[1] * mc[1];
            self.verts[o + 7] = c[2] * mc[2];
            self.verts[o + 8] = c[3] * mc[3];
            o += STRIDE;
        }
        self.quad_count += 1;
        if let GuiCommand::Quads { count, .. } = &mut self.commands[b] {
            *count += 1;
        }
    }

    /// JS: `tex(path) { return typeof path === 'string' ? this.assets.texture(path) : path; }`.
    pub fn tex(&self, path: &str) -> Option<TextureId> {
        self.assets.texture(path, false)
    }

    /// JS: `img(path) { return this.assets.image(path); }`.
    pub fn img(&self, path: &str) -> Option<AssetImage> {
        self.assets.image(path)
    }

    /// JS: `blit(path, x, y, u, v, w, h, texW = 256, texH = 256, dw = w, dh = h)` —
    /// drawTexturedModalRect equivalent; texture coordinates are in a texW x texH space.
    #[allow(clippy::too_many_arguments)]
    pub fn blit(
        &mut self,
        path: &str,
        x: f64,
        y: f64,
        u: f64,
        v: f64,
        w: f64,
        h: f64,
        tex_w: f64,
        tex_h: f64,
        dw: f64,
        dh: f64,
    ) {
        let t = self.tex(path);
        if t.is_none() || w <= 0.0 || h <= 0.0 {
            return;
        }
        self.quad(
            t,
            x,
            y,
            x + dw,
            y + dh,
            (u / tex_w) as f32,
            (v / tex_h) as f32,
            ((u + w) / tex_w) as f32,
            ((v + h) / tex_h) as f32,
            WHITE,
            WHITE,
            WHITE,
            WHITE,
        );
    }

    /// JS: `drawImage(path, sx, sy, sw, sh, x, y, w, h, color = WHITE)` — draw a
    /// texture region given in texture pixels.
    #[allow(clippy::too_many_arguments)]
    pub fn draw_image(
        &mut self,
        path: &str,
        sx: f64,
        sy: f64,
        sw: f64,
        sh: f64,
        x: f64,
        y: f64,
        w: f64,
        h: f64,
        color: [f32; 4],
    ) {
        // JS: const t = this.tex(path); if (!t) return;
        let t = self.tex(path);
        if t.is_none() {
            return;
        }
        // JS: sx / t.width ... — the asset image carries the pixel dimensions.
        let Some(img) = self.assets.image(path) else { return };
        let (tw, th) = (img.width as f64, img.height as f64);
        self.quad(
            t,
            x,
            y,
            x + w,
            y + h,
            (sx / tw) as f32,
            (sy / th) as f32,
            ((sx + sw) / tw) as f32,
            ((sy + sh) / th) as f32,
            color,
            color,
            color,
            color,
        );
    }

    /// JS: `rect(x0, y0, x1, y1, color)`.
    pub fn rect(&mut self, x0: f64, y0: f64, x1: f64, y1: f64, color: u32) {
        let (x0, x1) = if x0 > x1 { (x1, x0) } else { (x0, x1) };
        let (y0, y1) = if y0 > y1 { (y1, y0) } else { (y0, y1) };
        let c = argb(color);
        self.quad(Some(self.white), x0, y0, x1, y1, 0.0, 0.0, 1.0, 1.0, c, c, c, c);
    }

    /// JS: `gradient(x0, y0, x1, y1, top, bottom)`.
    pub fn gradient(&mut self, x0: f64, y0: f64, x1: f64, y1: f64, top: u32, bottom: u32) {
        let a = argb(top);
        let b = argb(bottom);
        self.quad(Some(self.white), x0, y0, x1, y1, 0.0, 0.0, 1.0, 1.0, a, b, b, a);
    }

    /// JS: `text(s, x, y, color = 0xffffff, shadow = true)`.
    pub fn text(&mut self, s: &str, x: f64, y: f64, color: u32, shadow: bool) -> f64 {
        self.font.draw(s, x, y, color, shadow)
    }

    /// JS: `textCentered(s, cx, y, color = 0xffffff, shadow = true)`.
    pub fn text_centered(&mut self, s: &str, cx: f64, y: f64, color: u32, shadow: bool) -> f64 {
        self.font.draw_centered(s, cx, y, color, shadow)
    }

    /// JS: `textWidth(s) { return this.font.width(s); }`.
    pub fn text_width(&self, s: &str) -> f64 {
        self.font.width(s)
    }

    /// JS: `drawMesh(draw, model)` — queue a 3D draw (e.g. item models) in GUI
    /// space; `model` is relative to the current matrix.
    pub fn draw_mesh(&mut self, mut draw: QueuedDraw, model: &Mat4) {
        let m = *self.matrix();
        // JS: const m = mat4.multiply(mat4.create(), this.matrix, model);
        draw.model = multiply(&m, model);
        self.commands.push(GuiCommand::Draw { scissor: self.scissor_rect, draw });
        self.cur = None;
    }

    /// JS: `drawNode(node, model)` — queue a scene node tree in GUI space
    /// (model relative to the current matrix).
    pub fn draw_node(
        &mut self,
        node: &mut dyn SceneNode,
        scene: &mut dyn SceneToDraw,
        model: &Mat4,
    ) {
        let m = *self.matrix();
        // JS: const m = mat4.multiply(mat4.create(), this.matrix, model);
        let world = multiply(&m, model);
        // JS: node.updateWorld(m, null);
        node.update_world(&world, None);
        // JS: const list = node.collect([]);
        let mut list = node.collect(Vec::new());
        // JS: list.sort((a, b) => (a.d.order || 0) - (b.d.order || 0));
        list.sort_by(|a, b| a.order.partial_cmp(&b.order).unwrap_or(std::cmp::Ordering::Equal));
        // JS: const resolve = (t) => (typeof t === 'function' ? t() : this.assets.texture(t));
        for e in &mut list {
            let world_v = std::mem::take(&mut e.world);
            let data = std::mem::take(&mut e.data);
            let mut resolve = |t: &SceneTextureRef| -> Option<TextureId> { self.assets.texture_resolved(t) };
            // JS: const dr = toDraw(d, new Float32Array(world), resolve);
            if let Some(dr) = scene.to_draw(&data, &world_v, &mut resolve) {
                self.commands.push(GuiCommand::Draw { scissor: self.scissor_rect, draw: dr });
            }
        }
        self.cur = None;
    }

    /// JS: `nextIconDepth()` — next depth slot for stacked 3D icons, so later
    /// icons draw over earlier ones.
    pub fn next_icon_depth(&mut self) -> i32 {
        self.icon_depth += 64;
        self.icon_depth
    }

    // ---------------------------------------------------------------- vanilla helpers

    /// JS: `dirtBackground(tint = 0x404040)`.
    pub fn dirt_background(&mut self, tint: u32) {
        let t = self.assets.texture("gui/options_background.png", true);
        let Some(t) = t else {
            self.rect(0.0, 0.0, self.width as f64, self.height as f64, 0xff202020);
            return;
        };
        // JS: const k = (tint & 255) / 255;
        let k = (tint & 255) as f32 / 255.0;
        let w = self.width as f64;
        let h = self.height as f64;
        self.quad(
            Some(t),
            0.0,
            0.0,
            w,
            h,
            0.0,
            0.0,
            (w / 32.0) as f32,
            (h / 32.0) as f32,
            [k, k, k, 1.0],
            [k, k, k, 1.0],
            [k, k, k, 1.0],
            [k, k, k, 1.0],
        );
    }

    /// JS: `worldBackground()`.
    pub fn world_background(&mut self) {
        let w = self.width as f64;
        let h = self.height as f64;
        self.gradient(0.0, 0.0, w, h, 0xc0101010, 0xd0101010);
    }

    /// JS: `tooltip(lines, mx, my)` — GuiScreen.drawHoveringText.
    pub fn tooltip(&mut self, lines: &[String], mx: f64, my: f64) {
        if lines.is_empty() {
            return;
        }
        let mut w = 0.0f64;
        for l in lines {
            w = w.max(self.text_width(l));
        }
        let mut x = mx + 12.0;
        let mut y = my - 12.0;
        let mut h = 8.0;
        if lines.len() > 1 {
            h += 2.0 + (lines.len() - 1) as f64 * 10.0;
        }
        if x + w > self.width as f64 {
            x -= 28.0 + w;
        }
        if y + h + 6.0 > self.height as f64 {
            y = self.height as f64 - h - 6.0;
        }
        // JS: const bg = 0xf0100010, b1 = 0x505000ff, b2 = 0x5028007f;
        let bg = 0xf0100010u32;
        let b1 = 0x505000ffu32;
        let b2 = 0x5028007fu32;
        self.rect(x - 3.0, y - 4.0, x + w + 3.0, y - 3.0, bg);
        self.rect(x - 3.0, y + h + 3.0, x + w + 3.0, y + h + 4.0, bg);
        self.rect(x - 3.0, y - 3.0, x + w + 3.0, y + h + 3.0, bg);
        self.rect(x - 4.0, y - 3.0, x - 3.0, y + h + 3.0, bg);
        self.rect(x + w + 3.0, y - 3.0, x + w + 4.0, y + h + 3.0, bg);
        self.gradient(x - 3.0, y - 3.0 + 1.0, x - 3.0 + 1.0, y + h + 3.0 - 1.0, b1, b2);
        self.gradient(x + w + 2.0, y - 3.0 + 1.0, x + w + 3.0, y + h + 3.0 - 1.0, b1, b2);
        self.rect(x - 3.0, y - 3.0, x + w + 3.0, y - 3.0 + 1.0, b1);
        self.rect(x - 3.0, y + h + 2.0, x + w + 3.0, y + h + 3.0, b2);
        let mut ty = y;
        for (i, l) in lines.iter().enumerate() {
            self.text(l, x, ty, 0xffffff, true);
            // JS: y += i === 0 ? 12 : 10;
            ty += if i == 0 { 12.0 } else { 10.0 };
        }
    }

    /// JS: `button(x, y, w, h, label, hovered, enabled = true)` — GuiButton.
    pub fn button(&mut self, x: f64, y: f64, w: f64, h: f64, label: &str, hovered: bool, enabled: bool) {
        // JS: const v = !enabled ? 46 : hovered ? 86 : 66;
        let v: f64 = if !enabled { 46.0 } else if hovered { 86.0 } else { 66.0 };
        let x = x.floor();
        let y = y.floor();
        let half = (w / 2.0).floor();
        self.blit("gui/widgets.png", x, y, 0.0, v, half, h, 256.0, 256.0, half, h);
        self.blit("gui/widgets.png", x + half, y, 200.0 - half, v, half, h, 256.0, 256.0, half, h);
        // JS: const color = !enabled ? 0xa0a0a0 : hovered ? VANILLA_UI.buttonText.hover : VANILLA_UI.buttonText.normal;
        let color: u32 = if !enabled {
            0xa0a0a0
        } else if hovered {
            crate::assets::vanilla_layout::VANILLA_UI.button_text_hover
        } else {
            crate::assets::vanilla_layout::VANILLA_UI.button_text_normal
        };
        self.text_centered(label, x + (w / 2.0).floor(), y + ((h - 8.0) / 2.0).floor(), color, true);
    }
}
