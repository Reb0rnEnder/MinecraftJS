# Indexed default assets and native title panorama

The 1.14.4 client jar retains the underwater panorama from 1.13.2. The actual
village panorama is supplied as six objects in the Mojang 1.14 asset index.
The old proxy chose jar entries first, and builds only collected indexed sounds
and languages. Both paths therefore displayed the wrong panorama even when the
correct jar/version was selected and the proxy was restarted.

Default asset resolution now uses an indexed object before a duplicate jar entry.
Builds collect indexed client textures and other client resources as well as
sounds/languages. User/server resource packs still layer above those defaults.
Unused bundled resource-pack archives and Realms resources are not embedded.

The first village face has SHA-1 `d75f4a52c3a7333e1676f9d648dbc3a129eaf182`;
the jar's leftover face has SHA-1 `39f20e6c806e4dbd110582797c0eca280e223c73`.
Tests verify all six faces against the selected asset index, including the bytes
inside the built HTML ZIP. Both proxy serving and the embedded build now use the
indexed faces.

Versioned folder-asset URLs bypass images cached from the former implementation.
Dynamic asset responses revalidate instead of remaining fresh for an hour.
Builds include `asset-manifest.json` (layout version, Minecraft version, client
jar hash and asset-index ID). The proxy accepts an extracted `client/assets/`
folder only when that identity matches; unversioned or stale folders cannot
shadow the native resources. Its fallback is the current index/jar asset source.

The title rendering is also ported from the 1.14 jar's CubeMap (`dmx`) and
PanoramaRenderer (`dnk`): full window resolution, an 85-degree projection, four
small jitter passes, native face orientation and slow camera rotation. The old
256px render-target/blur chain is removed. TitleScreen uses the jar's panorama
overlay PNG rather than the old pair of gradient rectangles. Super Potato Mode
retains its explicit reduced-pass option.

Validation: all 36 current native/font/worker tests pass. A fresh browser title
screen loads six 1024×1024 village faces with no legacy blur targets; its rendered
screenshot was inspected. The development HTML was rebuilt, and all embedded
panorama hashes and its asset manifest were checked. Existing stable branches
retain their own native title assets/rendering; the village panorama and this
new CubeMap path belong to 1.14.4.

The next visual-asset migration remains the 1.14 particle definition/atlas system;
new mob/workstation rendering and built-in Programmer Art pack selection are also
still tracked parity gaps. This fix does not label the development branch fully
vanilla-compatible.
