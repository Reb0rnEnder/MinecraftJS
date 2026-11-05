// Port of `client/js/render/loading-overlay.js`.
//
// Layouts verified against native startup splashes and 1.14+ LoadingOverlay.
// Drawing goes through the ported `crate::gui_js::Gui` (the same `gui.rect`,
// `gui.quad`, `gui.tex`, `gui.setBlend` calls).

/// JS: `export const LOADING_STYLE = 'square';`
pub const LOADING_STYLE: &str = "square";
/// JS: `export const LOADING_LOGO = 'gui/title/mojang.png';`
pub const LOADING_LOGO: &str = "gui/title/mojang.png";

/// JS: `const clamp=v=>Math.max(0,Math.min(1,v));`
fn clamp(v: f64) -> f64 {
    v.max(0.0).min(1.0)
}

/// JS: `export function loadingScale(width,height,setting=0)`.
pub fn loading_scale(width: f64, height: f64, setting: i32) -> i32 {
    // JS: let scale=1;while(scale<(setting||1000)&&width/(scale+1)>=320&&height/(scale+1)>=240)scale++;
    let mut scale = 1i32;
    let max = if setting == 0 { 1000 } else { setting };
    while scale < max && width / (scale as f64 + 1.0) >= 320.0 && height / (scale as f64 + 1.0) >= 240.0 {
        scale += 1;
    }
    scale
}

/// JS: the `loadingLayout` return shape.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LoadingLayout {
    /// JS: `background` — an [r, g, b] triple.
    pub background: [f64; 3],
    /// JS: `logo` — `[x, y, w, h]`.
    pub logo: [i64; 4],
    /// JS: `bar` — `[x, y, r, b]`.
    pub bar: [i64; 4],
}

/// JS: `export function loadingLayout(width,height)`.
pub fn loading_layout(width: f64, height: f64) -> LoadingLayout {
    // JS: const studios=LOADING_STYLE==='studios',
    //      logoWidth=studios?Math.min(width*.75,height):256,
    //      logoHeight=studios?logoWidth/4:256;
    let studios = LOADING_STYLE == "studios";
    let logo_width = if studios { (width * 0.75).min(height) } else { 256.0 };
    let logo_height = if studios { logo_width / 4.0 } else { 256.0 };
    // JS: return { background: studios?[239/255,50/255,61/255]:[1,1,1],
    //   logo:[Math.floor(width/2)-Math.floor(logoWidth/2),Math.floor(height/2)-Math.floor(logoHeight/2),Math.floor(logoWidth/2)*2,Math.floor(logoHeight)],
    //   bar: studios?[...]:[Math.floor(width/2)-150,Math.floor(height/4)*3,Math.floor(width/2)+150,Math.floor(height/4)*3+10] };
    let background = if studios {
        [239.0 / 255.0, 50.0 / 255.0, 61.0 / 255.0]
    } else {
        [1.0, 1.0, 1.0]
    };
    let logo = [
        (width / 2.0).floor() as i64 - (logo_width / 2.0).floor() as i64,
        (height / 2.0).floor() as i64 - (logo_height / 2.0).floor() as i64,
        (logo_width / 2.0).floor() as i64 * 2,
        logo_height as i64,
    ];
    let bar = if studios {
        [
            (width / 2.0).floor() as i64 - (logo_width / 2.0).floor() as i64,
            (height * 0.8325).floor() as i64 - 5,
            (width / 2.0).floor() as i64 + (logo_width / 2.0).floor() as i64,
            (height * 0.8325).floor() as i64 + 5,
        ]
    } else {
        [
            (width / 2.0).floor() as i64 - 150,
            (height / 4.0).floor() as i64 * 3,
            (width / 2.0).floor() as i64 + 150,
            (height / 4.0).floor() as i64 * 3 + 10,
        ]
    };
    LoadingLayout { background, logo, bar }
}

/// JS: `export function loadingProgress(previous,target)`.
pub fn loading_progress(previous: f64, target: f64) -> f64 {
    // JS: return clamp(previous*.95+clamp(target)*.050000012);
    clamp(previous * 0.95 + clamp(target) * 0.050000012)
}

/// JS: `[destination rect, UV rect]` — each quad is
/// `[x, y, w, h, u0, v0, u1, v1]`. Studios uses two atlas halves, with native
/// +/- .0625 texel offsets.
pub fn loading_logo_quads(layout: &LoadingLayout) -> Vec<[f64; 8]> {
    // JS: const [x,y,w,h]=layout.logo;
    let [x, y, w, h] = layout.logo;
    // JS: return LOADING_STYLE==='studios'
    //   ? [[x,y,w/2,h,-.0625/120,0,1-.0625/120,.5],[x+w/2,y,w/2,h,.0625/120,.5,1+.0625/120,1]]
    //   : [[x,y,w,h,0,0,1,1]];
    if LOADING_STYLE == "studios" {
        let (x, y, w, h) = (x as f64, y as f64, w as f64, h as f64);
        vec![
            [x, y, w / 2.0, h, -0.0625 / 120.0, 0.0, 1.0 - 0.0625 / 120.0, 0.5],
            [x + w / 2.0, y, w / 2.0, h, 0.0625 / 120.0, 0.5, 1.0 + 0.0625 / 120.0, 1.0],
        ]
    } else {
        vec![[x as f64, y as f64, w as f64, h as f64, 0.0, 0.0, 1.0, 1.0]]
    }
}

/// JS: a rect entry `[x, y, r, b, [r, g, b, a]]`.
pub type LoadingRect = [f64; 8];

/// JS: `export function loadingRects(layout,progress,alpha=1)`.
pub fn loading_rects(layout: &LoadingLayout, progress: f64, alpha: f64) -> Vec<LoadingRect> {
    // JS: if(LOADING_STYLE==='legacy')return [];
    if LOADING_STYLE == "legacy" {
        return Vec::new();
    }
    // JS: const [x,y,r,b]=layout.bar,p=clamp(progress);
    let [x, y, r, b] = layout.bar;
    let p = clamp(progress);
    if LOADING_STYLE == "studios" {
        // JS: return [[x+1,y,r-1,y+1,[1,1,1,alpha]],[x+1,b-1,r-1,b,[1,1,1,alpha]],
        //   [x,y,x+1,b,[1,1,1,alpha]],[r-1,y,r,b,[1,1,1,alpha]],
        //   [x+2,y+2,x+Math.ceil((r-x-2)*p),b-2,[1,1,1,alpha]]];
        let (x, y, r, b) = (x as f64, y as f64, r as f64, b as f64);
        return vec![
            [x + 1.0, y, r - 1.0, y + 1.0, 1.0, 1.0, 1.0, alpha],
            [x + 1.0, b - 1.0, r - 1.0, b, 1.0, 1.0, 1.0, alpha],
            [x, y, x + 1.0, b, 1.0, 1.0, 1.0, alpha],
            [r - 1.0, y, r, b, 1.0, 1.0, 1.0, alpha],
            [x + 2.0, y + 2.0, x + ((r - x - 2.0) * p).ceil(), b - 2.0, 1.0, 1.0, 1.0, alpha],
        ];
    }
    // JS: const fade=1-alpha;
    // JS: return [[x-1,y-1,r+1,b+1,[fade,fade,fade,1]],[x,y,r,b,[1,1,1,1]],
    //   [x+1,y+1,x+Math.ceil((r-x-1)*p),b-1,[(226+29*fade)/255,(40+215*fade)/255,(55+200*fade)/255,1]]];
    let fade = 1.0 - alpha;
    let (x, y, r, b) = (x as f64, y as f64, r as f64, b as f64);
    vec![
        [x - 1.0, y - 1.0, r + 1.0, b + 1.0, fade, fade, fade, 1.0],
        [x, y, r, b, 1.0, 1.0, 1.0, 1.0],
        [
            x + 1.0,
            y + 1.0,
            x + ((r - x - 1.0) * p).ceil(),
            b - 1.0,
            (226.0 + 29.0 * fade) / 255.0,
            (40.0 + 215.0 * fade) / 255.0,
            (55.0 + 200.0 * fade) / 255.0,
            1.0,
        ],
    ]
}

/// The `gui` surface `renderLoadingOverlay` draws through — exactly the
/// ported `crate::gui_js::Gui` calls (`rect`, `quad`, `tex`, `setBlend`).
pub trait LoadingGui {
    fn width(&self) -> f64;
    fn height(&self) -> f64;
    fn rect(&mut self, x0: f64, y0: f64, x1: f64, y1: f64, color: u32);
    fn tex(&mut self, path: &str) -> Option<u32>;
    #[allow(clippy::too_many_arguments)]
    fn quad(&mut self, texture: Option<u32>, x0: f64, y0: f64, x1: f64, y1: f64, u0: f32, v0: f32, u1: f32, v1: f32, color: [f32; 4]);
    fn set_blend(&mut self, mode: &str);
}

/// JS: `export function renderLoadingOverlay(gui,progress,{backgroundAlpha=1,logoAlpha=1,barAlpha=1}={})`.
pub fn render_loading_overlay(gui: &mut dyn LoadingGui, progress: f64, background_alpha: f64, logo_alpha: f64, bar_alpha: f64) {
    // JS: const layout=loadingLayout(gui.width,gui.height),[r,g,b]=layout.background;
    let layout = loading_layout(gui.width(), gui.height());
    let [r, g, b] = layout.background;
    // JS: gui.rect(0,0,gui.width,gui.height,
    //   ((Math.ceil(backgroundAlpha*255)<<24)|(Math.round(r*255)<<16)|(Math.round(g*255)<<8)|Math.round(b*255))>>>0);
    let bg = (((background_alpha * 255.0).ceil() as u64) << 24
        | ((r * 255.0).round() as u64) << 16
        | ((g * 255.0).round() as u64) << 8
        | (b * 255.0).round() as u64) as u32;
    gui.rect(0.0, 0.0, gui.width(), gui.height(), bg);
    // JS: const tex=gui.tex(LOADING_LOGO);
    let tex = gui.tex(LOADING_LOGO);
    if let Some(tex) = tex {
        // JS: gui.setBlend(LOADING_STYLE==='studios'?'add':'alpha');
        gui.set_blend(if LOADING_STYLE == "studios" { "add" } else { "alpha" });
        // JS: for(const [x,y,w,h,u0,v0,u1,v1]of loadingLogoQuads(layout))
        //     gui.quad(tex,x,y,x+w,y+h,u0,v0,u1,v1,[1,1,1,logoAlpha]);
        for [x, y, w, h, u0, v0, u1, v1] in loading_logo_quads(&layout) {
            gui.quad(Some(tex), x, y, x + w, y + h, u0 as f32, v0 as f32, u1 as f32, v1 as f32, [1.0, 1.0, 1.0, logo_alpha as f32]);
        }
        // JS: gui.setBlend('alpha');
        gui.set_blend("alpha");
    }
    // JS: for(const [x,y,r,b,c]of loadingRects(layout,progress,barAlpha))
    //     if(r>x&&b>y)gui.rect(x,y,r,b,((Math.round(c[3]*255)<<24)|(Math.round(c[0]*255)<<16)|(Math.round(c[1]*255)<<8)|Math.round(c[2]*255))>>>0);
    for [x, y, r, b, cr, cg, cb, ca] in loading_rects(&layout, progress, bar_alpha) {
        if r > x && b > y {
            let color = (((ca * 255.0).round() as u64) << 24
                | ((cr * 255.0).round() as u64) << 16
                | ((cg * 255.0).round() as u64) << 8
                | (cb * 255.0).round() as u64) as u32;
            gui.rect(x, y, r, b, color);
        }
    }
}
