# Door corrections, respawn view and multiplayer warning parity

Target: 1.18.2. Shared fixes are applied to all eight existing supported targets,
1.8.9 through 1.18.2; no new release branch is created.

## Corrections and respawn

A predicted door toggle now retains the original states of both halves. An
upper-only protection correction restores the predicted lower half too, without
replacing a newer authoritative update. Section/multi-block updates apply their
authoritative states before reconciling predictions. Repeated clicks retain the
original snapshot. Prediction bookkeeping is bounded and cleared on login/respawn.

1.8.9/1.12.2 use native door metadata: OPEN belongs to the lower half, so an upper
update alone cannot confirm a locally toggled lower half. From 1.13.2 onward each
half carries the OPEN block-state property. No modern properties are introduced
into the old targets. See [Door block states and history](https://minecraft.wiki/w/Door).

Login/respawn restores the local camera and detaches the old mount/controller.
A stale spectator camera could otherwise keep suppressing player movement packets
following a hub transfer. This is a targeted reset, not a claim that the entire
native player reconstruction lifecycle is implemented. Native reference:
1.18.2 ClientPacketListener.handleRespawn (obfuscated emt.a(tp), client SHA-1
2e9a3e3107cca00d6bc9c97bf7d149cae163ef21) creates a new local player and restores
Minecraft.cameraEntity to it even for a same-dimension respawn.

## Warning screen

The multiplayer safety warning exists only in the applicable newer targets;
[options.txt history](https://minecraft.wiki/w/Options.txt_(Java_Edition)) dates
skipMultiplayerWarning to 1.15.2. Exact client code, rather than current screenshots,
provides the following release-specific layout:

| Version | Text | Checkbox atlas | Keyboard order |
| --- | --- | --- | --- |
| 1.15.2 | centered, 9-pixel line spacing | 32 x 64, no focus column | Proceed, Back, checkbox |
| 1.16.5 / 1.17.1 | left x=25, 18-pixel spacing | 64 x 64, focused u=20 | Proceed, Back, checkbox |
| 1.18.2 | left x=25, 18-pixel spacing | 64 x 64, focused u=20 | checkbox, Proceed, Back |

The glyph remains 20 x 20, with checked v=20. Native classes inspected:
1.15.2 dih/dcx, 1.16.5 drd/dll, 1.17.1 edd/dxc,
1.18.2 WarningScreen ego, SafetyScreen egm, Checkbox eag. Header y=30, body y=70;
button offset is (wrapped line count + 1) times native line spacing. Earlier
releases do not receive the newer warning screen.

## Verification and remaining server-specific investigation

Follow-up: the supplied authenticated trace identified an unqualified registry
key; see [biome registry namespace fix](biome-registry-namespace.md). The probe
limitations below describe the earlier investigation.

Run `node --test tools/test-door-prediction.mjs tools/test-respawn-view.mjs tools/test-network-capture.mjs`.
These nine regressions pass on all eight targets; browser bundle checks pass too.
On 1.15.2 through 1.18.2 also run `node --test tools/test-multiplayer-warning.mjs`.
An actual Chromium/WebGL2 software-rendered 1.18.2 browser check passed warning
rendering, checkbox states, focus order and capture installation without a crash.
This does not benchmark hardware graphics performance.

The unauthenticated wss://play.webmc.fun probe reached its login gateway and
received Login, Position and 25 chunks without an observed decode failure or
unsupported packet at that stage. The NPC transfer requires an authenticated
session and has NOT been reproduced. The camera reset fixes a concrete movement
suppression path, but does not prove it resolves the reported empty world.

To capture that transfer, open browser developer tools after joining, then run:

```js
const trace = game.captureNetwork();
// Click the NPC and reproduce the missing world / snapping.
trace.download();
trace.stop();
```

This writes minecraftjs-network-capture.json locally. It records bounded
transition snapshots, packet counts, unsupported IDs, decode errors and relevant
handler errors. It excludes raw chat, custom payloads, skins, credentials, UUIDs
and server URLs. No capture is uploaded automatically. Use this evidence before
claiming a missing packet or relaxing chunk validation.
