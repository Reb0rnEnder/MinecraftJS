# Fabulous rendering

The graphics option now cycles Fast, Fancy, Fabulous. The third choice uses
separate native-style color/depth layers for main, translucent terrain, certain
translucent block items, particles, weather and clouds. Each pixel sorts occupied
layers by depth and blends their premultiplied colors. Terrain/item/particle
layers receive the main depth buffer; weather/cloud layers have independent
depth. Tripwire belongs to weather. Debug overlays retain the main depth buffer.
Composition precedes the hand and any spectator/shaderpack post-processing.
Resizing or disabling the option releases its targets.

Inputs are the pinned 1.16.5 and 1.17.1 `shaders/post/transparency.json`,
`shaders/program/transparency.fsh`, LevelRenderer and RenderType. The two native
composition programs have the same algorithm; 1.17 changes GLSL syntax. Native
ItemRenderer/ItemBlockRenderTypes route half-transparent block items separately;
entity translucent materials keep their main output. Item batching and glint
retain the selected output. This feature is confined to 1.16.5 and 1.17.1.
The release introduction is cross-checked against the
[graphics history](https://minecraft.wiki/w/Graphics_settings#History).

`test-fabulous-browser.mjs` checks six-layer occlusion and premultiplied blending,
plus copied-depth rejection, in WebGL 2, WebGPU and software. Channels agree with
the numeric reference within three byte levels. Existing backend format, target,
lead and fire readback tests pass too. `test-fabulous-routing.mjs` checks item
routing, batching separation and tripwire meshes. The isolated 1.17.1 world/mob
scene renders in Fabulous on all three adapters without reported errors. These
software-adapter checks do not establish performance on users' hardware, every
shader/resource pack, or exact native screenshot equality.

Render-target destruction previously freed only color textures. Framebuffers
and depth storage are now freed too, including on all five older branches;
those older targets retain their native graphics choices.
