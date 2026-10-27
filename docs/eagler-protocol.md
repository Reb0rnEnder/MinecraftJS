# Eaglercraft texture protocol support

References inspected for this implementation:

- [EaglerXServer](https://github.com/lax1dude/eaglerxserver), revision
  `3822c777a960a15e519372399ccfda9190ad73ae`, particularly the V3 plugin-message
  definitions and `SPacketOtherSkinCustomV3EAG` / cape packet layouts.
- [Eaglercraft client](https://gitflic.ru/project/lax1dude/eaglercraft-1_8), revision
  `332a7bb11fe2f26e047eb43c87e7633b8d757b19`, particularly `ServerTextureCacheOld`,
  `PlayerTextureEntry`, `SkinPackets`, `SkinConverter`, `DefaultSkins` and
  `DefaultCapes`. Preset resources retain those upstream definitions and names;
  the embedded preset data records its upstream revision. Original resource
  ownership and upstream attribution remain unchanged.

The client had a WebSocket handshake but no game plugin-message consumer for
skins/capes. HTTP texture requests are not necessary in Eaglercraft: the client
requests another player's UUID over `EAG|Skins-1.8` / `EAG|Capes-1.8`, and the
server responds over that same socket. Modern Minecraft channel names are
`eagler:skins-1-8` and `eagler:capes-1-8`.

Plaintext authentication now uses the upstream method ID 255 (the old value 3
was incorrect), with the native 255-byte UTF-8 password limit. SHA-based methods
remain explicitly unsupported rather than sending a password under an unknown ID.

Implemented for the existing V2/V3 handshake path:

- Deduplicated on-demand UUID requests; tab-list metadata does not eagerly fetch
  an entire server's player list. The bounded cache is cleared on world/server
  changes and resource reloads, with owned GPU textures released.
- V3 preset and custom skin replies, including classic/slim arm selection.
  Wire ABGR pixels become GPU RGBA; no HTTP skin fetch is needed on this path.
- V3 custom capes and 25 cape presets, including conversion of the compact
  23×17 BGR layout and its side strip into the native cape texture layout.
- All 29 upstream skin preset images; the five custom-mesh skin presets use
  their supplied fallback textures on the standard player model. Custom mesh
  geometry/animation remains unsupported.
- A real browser WebSocket regression performs the V3 handshake and receives
  custom skin/cape replies through the production packet decoder. Separate
  tests cover preset images, pixel ordering, malformed replies and cache reuse.

This is not complete Eaglercraft extension parity. V4/V5 negotiation and their
multiplexed extensions, voice, cookies, web views, custom mesh skins and the full
set of authentication extensions remain outside this implementation.
The negotiated Java protocol must also match the native version of this checkout;
this change does not add an automatic 1.8-to-1.15 packet translator.

Foreign player-head URL lookups are now implemented through V3 request 0x06.
See [deployment and resource fixes](static-hosting-and-proxy.md) for details.
