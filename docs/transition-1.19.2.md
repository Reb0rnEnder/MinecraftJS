# Transition plan: Java 1.19.2

Status: planning only. Keep this worktree on 1.18.2 / protocol 758. No 1.19.2
branch, runtime relabel, server launch or world upgrade is part of this plan.
When implementation is requested, use branch `1.19.2` and worktree
`/home/ender/minecraftjs-1.19.2`, reusing that exact target if it already exists.

Target: **Java 1.19.2**, protocol **760**, data version **3120**, resource-pack
format **9**, data-pack format **10**, Java **17**. The official metadata hash,
jars/mappings/index URLs and the upstream 760 schema are pinned in
`transition-1.19.2.inputs.json`. Metadata and schema were downloaded and checked;
the target jars/runtime have not been downloaded or validated during planning.
The pinned schema was compared with our 758 schema; the JSON records changed,
added and removed packet bodies. Native code remains the implementation authority.

## 0. Carry forward a tested baseline

Branch from the latest pushed 1.18.2, including native tag-driven vine climbing,
version-specific dripleaf placement and Accessibility menu initialization.
Preserve all existing named targets, user packs/configuration and local servers.
Track 1.18.2's unfinished fog/cloud/F3/UI audits and large-world browser loading
timeout explicitly; a new protocol branch does not resolve those issues.
Fix shared regressions on every applicable target without importing newer assets,
protocol fields or menus into older versions.

Acceptance: source regressions, native extraction checks, all graphics adapters,
real inventory operations and Nether/End/full-height Overworld round trips.
Keep real-world join/frametime and memory observations separate from synthetic
palette/backend tests. Never report fabricated Java/server/GPU metrics.

## 1. Native inputs and registry/runtime extraction

Download/hash-check client/server jars and official mappings. Extract server
bundled dependencies and execute its data reports in an isolated cache, without
accepting a new EULA or opening a user world. Generate native block/item/entity,
particle/sound, menu, biome, tag, damage/mechanics, creative, font/language and
GUI tables. Validate every block state/property and registry ID/range.

Regenerate collision, selection, occlusion, render-layer, support-face, offset and
heightmap predicates. Execute native model layers and check all new model parts.
Add fixtures for frog/tadpole/allay/warden, chest boats, mangrove wood/roots,
mud/mud bricks, sculk blocks, froglights, recovery compass, goat horns, disc 5
and reinforced deepslate. Explicitly audit 1.19, 1.19.1 and 1.19.2 separately.

## 2. Connection and protocol 760

Generate all packet IDs; compare all changed bodies with native code, including
login state and shared types, not only the play-state summary. Implement target
login/key/certificate negotiation through both MinecraftJS proxy and raw TCP
relay/Wisp paths. Test online/offline and secure-profile-required configurations.
Surface genuine service/authorization failures instead of pretending a profile
has valid credentials. Keep access tokens and private keys out of logs/builds.

The inspected schema changes join/respawn dimension data, entity spawn formats,
particle/effect/sound/trade bodies and interaction acknowledgements. Resolve
dimension keys through the registry codec. Replace removed living/painting spawn
packets with the native 760 entity/metadata/variant paths. Preserve section-relative
terrain/biome/light decoding and test malformed palettes and -64/-1/0/255/319.

Add native action sequence fields and acknowledge/reconcile predicted block
changes. Cover digging, block placement and use-item, cancellation and server
correction. Existing inventory state IDs/cursor recovery still need live checks.

Acceptance: status, encryption/compression/login, spawn confirmation, keepalives,
full-height terrain/light/biomes, inventory, interactions and dimension travel on
an isolated matching server. Do not replace or upgrade a running user world.

## 3. Signed chat, commands and 1.19.1/1.19.2 correctness

This is a separate required milestone, not a generic legacy chat packet remap.
Implement player/system chat, message headers, deleted-message handling,
suggestions and optional preview. Follow exact 1.19.2 signing/salt/timestamp,
last-seen acknowledgements, command argument signatures and profile-key rules.
Check the exact target's structures; do not copy later releases' chat sessions.

Verify formatted messages, translations, click/hover events, scoreboard/team
components, filter masks and trust indicators without dropping text. Implement
native restrictions, chat options, social interactions and report-screen/service
behavior where supported; record service access limitations honestly.
Test signed/unsigned/system messages, offline players, expired keys, disabled
previews, rapid messages, deletion and reconnect/server switches. 1.19.2 specifically
fixes secure-chat disconnects and a social-interactions crash; include both as
explicit release acceptance cases, plus 1.19.1's allay duplication and fixes.

## 4. Wild Update client-visible behavior

Implement native new entity models, metadata, poses, held equipment, sounds and
particles. Audit allay item handling/dancing/duplication, frog/tadpole variants,
warden emergence/digging/roar/sonic boom and chest-boat interaction/rendering.
Server AI, spawning, drops, ancient cities and terrain generation stay server-owned.

Support sculk sensor/catalyst/shrieker state, vibrations, darkness effect and
accessibility controls; mud/roots/leaves collision/selection, mangrove placement,
waterlogging and item-use feedback; froglight emission, recovery-compass target,
goat-horn cooldown/audio, and Swift Sneak movement. Native shape/support/placement
rules must gate local sounds and animations, rather than guessing success.

Acceptance: native-source fixtures and observable browser/server outcomes for each
feature, including server rejection and resource-pack replacement. Do not certify
all feature parity from registry presence or a rendered static model alone.

## 5. Rendering, GUI, packs and final acceptance

Compare target fog/lighting/darkness/sky/cloud/water behavior and all native GUI
option arrays. Test opening/rendering every menu from title and in-world contexts,
resizing, scrolling, focus, narrator and missing handlers before publishing.
Regenerate 760 command parser/property handling and all tag families. Retain
old/new pack warnings for format 9 and verify fonts, atlases and custom models.

Run backend regressions plus actual hardware where available; keep shader support
limits explicit. Profile full-height joins, decode/mesh/upload backlogs, frame-time
spikes and memory before claiming optimization improvements. Rebuild separately
named development HTML/static artifacts from pushed clean source commits; publish
manifests and checksums together and preserve site configuration.

## Sources

- [Official 1.19.2 release](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-19-2)
- [Official 1.19.1 release](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-19-1)
- [Minecraft Wiki 1.19](https://minecraft.wiki/w/Java_Edition_1.19)
- [Minecraft Wiki 1.19.1](https://minecraft.wiki/w/Java_Edition_1.19.1)
- [Minecraft Wiki 1.19.2](https://minecraft.wiki/w/Java_Edition_1.19.2)
- Pinned official metadata and protocol inputs in `transition-1.19.2.inputs.json`.

The 1.19 Wiki page was blocked by robots during this planning pass; 1.19.1 and
1.19.2 and official releases were accessible. Resolve release-specific details
against the exact pinned native source during implementation.
