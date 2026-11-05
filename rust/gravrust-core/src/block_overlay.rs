// Port of `client/js/render/block-overlay.js`.
//
// ScreenEffectRenderer.getViewBlockingState: sample eight corners around the
// player's eye. Collision alone does not decide whether a block hides the
// view.
//
// Block/state lookups use the ported `crate::blocks` registry plus the
// world/state accessors behind [`OverlayWorld`]; the model baking and sprite
// lookup are browser-bound asset-pipeline calls behind [`OverlayAssets`].

use crate::blocks::{BlockRegistry, RenderProps};

/// The world/player surface `viewBlockingState` reads.
pub trait OverlayWorld {
    /// JS: `game.player` — `None` when absent; the fields below.
    fn player(&self) -> Option<OverlayPlayer>;
    /// JS: `game.gameMode === 3` (spectator game mode).
    fn game_mode(&self) -> i32;
    /// JS: `game.world.getState(x, y, z)`.
    fn get_state(&self, x: i32, y: i32, z: i32) -> u32;
    /// JS: `game.tileProps` — the resolved render props for a state.
    fn tile_props(&self, state: u32) -> RenderProps;
}

/// JS: the player fields the overlay reads (`p.spectator`, `p.noClip`,
/// `p.width`, `p.x/y/z`, `p.eyeHeight` — value or method).
#[derive(Debug, Clone, Copy)]
pub struct OverlayPlayer {
    pub spectator: bool,
    pub no_clip: bool,
    pub width: Option<f64>,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    /// JS: `typeof p.eyeHeight === 'function' ? p.eyeHeight() : p.eyeHeight ?? 1.62`.
    pub eye_height: Option<f64>,
}

impl OverlayPlayer {
    /// JS: `p.width ?? .6`.
    pub fn width(&self) -> f64 {
        self.width.unwrap_or(0.6)
    }
    /// JS: `p.y + (typeof p.eyeHeight==='function' ? p.eyeHeight() : p.eyeHeight ?? 1.62)`.
    pub fn eye(&self) -> f64 {
        self.y + self.eye_height.unwrap_or(1.62)
    }
}

/// The asset surface `renderBlockOverlay` uses.
pub trait OverlayAssets {
    /// JS: `assets.atlasTexture` — the atlas texture handle for `gui.quad`.
    fn atlas_texture(&self) -> Option<u32>;
    /// JS: `assets.modelStore.bakeVariant(resolved.file, resolved.props,
    /// resolved.variant, 0)` — browser-bound model baking; returns the baked
    /// model's particle sprite name.
    fn bake_variant_particle(
        &self,
        file: &str,
        props: &RenderProps,
        variant: &str,
    ) -> Option<String>;
    /// JS: `assets.atlas.entries.get(model.particle)` — the atlas entry's UV
    /// `[u0, v0, u1, v1]`, when the sprite exists.
    fn atlas_entry_uv(&self, sprite: &str) -> Option<[f32; 4]>;
}

/// JS: the resolved-state triple the overlay needs from the blockstate
/// resolver: `{ file, props, variant }`.
#[derive(Debug, Clone)]
pub struct ResolvedState {
    pub file: String,
    pub props: RenderProps,
    pub variant: String,
}

/// The state resolver (`world/blockstates.js` `resolveState`) behind a
/// contract; the blockstates port feeds it the same arguments.
pub trait StateResolver {
    fn resolve_state(&self, state: u32, world: &dyn OverlayWorld, x: i32, y: i32, z: i32) -> Option<ResolvedState>;
}

/// JS: `export function viewBlockingState(game)` — `None` where the JS
/// returns `null`.
pub fn view_blocking_state(
    game: &dyn OverlayWorld,
    registry: &BlockRegistry,
) -> Option<((i32, i32, i32), u32)> {
    // JS: const p=game.player;if(!p||p.spectator||p.noClip||game.gameMode===3)return null;
    let p = game.player()?;
    if p.spectator || p.no_clip || game.game_mode() == 3 {
        return None;
    }
    let width = p.width();
    let eye = p.eye();
    // JS: for(let i=0;i<8;i++){
    //   const x=Math.floor(p.x+(((i>>0)&1)-.5)*width*.8),
    //         y=Math.floor(eye+(((i>>1)&1)-.5)*.1),
    //         z=Math.floor(p.z+(((i>>2)&1)-.5)*width*.8),
    //         state=game.world.getState(x,y,z),b=getBlock(state);
    //   if(b&&(b.renderType===undefined?b.hasModel:b.renderType!==0)&&(b.viewBlocking??b.suffocates??b.opaque))
    //     return{state,x,y,z};
    // }
    for i in 0..8i32 {
        let x = (p.x + ((((i >> 0) & 1) as f64 - 0.5) * width * 0.8)).floor() as i32;
        let y = (eye + ((((i >> 1) & 1) as f64 - 0.5) * 0.1)).floor() as i32;
        let z = (p.z + ((((i >> 2) & 1) as f64 - 0.5) * width * 0.8)).floor() as i32;
        let state = game.get_state(x, y, z);
        let def = registry.def(state);
        // JS renderType comes from the resolved render props: `undefined` when
        // absent (fall back to hasModel), else nonzero means visible.
        let props = game.tile_props(state);
        let renders = if props.render_type == 0 && !block_has_render_type(def) {
            def.has_model
        } else {
            props.render_type != 0
        };
        // JS: b.viewBlocking ?? b.suffocates ?? b.opaque — the resolved props
        // carry suffocates; viewBlocking is not in the native 1.15 data, so
        // the chain is suffocates || opaque (matching the ?? fallbacks).
        let view_blocking = props.suffocates || def.opaque;
        if renders && view_blocking {
            return Some(((x, y, z), state));
        }
    }
    None
}

/// JS `b.renderType !== undefined` — whether the block data carries an
/// explicit renderType (BlockDef has no such field in the native data; the
/// props always do, so "undefined" means the props left it at the sentinel).
fn block_has_render_type(_def: &crate::blocks::BlockDef) -> bool {
    false
}

/// JS: `export function renderBlockOverlay(game,gui)`.
pub fn render_block_overlay(
    game: &dyn OverlayWorld,
    registry: &BlockRegistry,
    resolver: &dyn StateResolver,
    assets: &dyn OverlayAssets,
    gui: &mut dyn OverlayGui,
) {
    // JS: const hit=viewBlockingState(game);if(!hit)return;
    let Some(((x, y, z), state)) = view_blocking_state(game, registry) else { return };
    // JS: const assets=game.assets,
    //      resolved=resolveState(hit.state,(x,y,z)=>game.world.getState(x,y,z),hit.x,hit.y,hit.z,game.tileProps),
    //      model=assets.modelStore.bakeVariant(resolved.file,resolved.props,resolved.variant,0),
    //      sprite=assets.atlas.entries.get(model.particle);
    let Some(resolved) = resolver.resolve_state(state, game, x, y, z) else { return };
    let Some(sprite) = assets.bake_variant_particle(&resolved.file, &resolved.props, &resolved.variant) else { return };
    // JS: if(sprite){const[u0,v0,u1,v1]=sprite.uv;gui.quad(assets.atlasTexture,0,0,gui.width,gui.height,u1,v0,u0,v1,[.1,.1,.1,1]);}
    if let Some([u0, v0, u1, v1]) = assets.atlas_entry_uv(&sprite) {
        gui.quad_overlay(assets.atlas_texture(), 0.0, 0.0, gui.width(), gui.height(), u1, v0, u0, v1, [0.1, 0.1, 0.1, 1.0]);
    }
}

/// The `gui` surface the overlay draws through: one textured quad in GUI
/// space (the ported `crate::gui_js::Gui::quad` satisfies this).
pub trait OverlayGui {
    fn width(&self) -> f64;
    fn height(&self) -> f64;
    #[allow(clippy::too_many_arguments)]
    fn quad_overlay(
        &mut self,
        texture: Option<u32>,
        x0: f64,
        y0: f64,
        x1: f64,
        y1: f64,
        u0: f32,
        v0: f32,
        u1: f32,
        v1: f32,
        color: [f32; 4],
    );
}
