# Transition plan: Java 1.19.4

Status: planning only; runtime remains **1.18.2 / protocol 758**. This supersedes
the older [1.19.2 plan](transition-1.19.2.md) as the proposed destination. It does
not claim 1.19 connectivity or complete 1.18.2 parity. Implementation should use
one named `1.19.4` branch and `/home/ender/minecraftjs-1.19.4` worktree, reusing
that target if it already exists. Do not create intermediate supported branches
unless requested. Preserve every existing supported branch and local input.

## Release boundaries and inputs

| Release | Protocol | Data version | Resource/data pack formats | Audit focus |
| --- | --- | --- | --- | --- |
| [1.19](https://minecraft.wiki/w/Java_Edition_1.19) | 759 | 3105 | 9 / 10 | Wild Update content and first signed-chat protocol |
| [1.19.1](https://minecraft.wiki/w/Java_Edition_1.19.1) | 760 | 3117 | 9 / 10 | Allay duplication, reporting and chat validation |
| [1.19.2](https://minecraft.wiki/w/Java_Edition_1.19.2) | 760 | 3120 | 9 / 10 | Secure-chat disconnect and social-screen fixes |
| [1.19.3](https://minecraft.wiki/w/Java_Edition_1.19.3) | 761 | 3218 | 12 / 10 | Creative categories, chat sessions, assets and feature flags |
| [1.19.4](https://minecraft.wiki/w/Java_Edition_1.19.4) | 762 | 3337 | 13 / 12 | Display/interaction entities, damage registry and GUI changes |

All use Java 17. Official release metadata was downloaded and SHA-1 checked;
client/server jars, mappings and asset-index references are pinned in
[transition-1.19.4.inputs.json](transition-1.19.4.inputs.json). Those target jars
have not been downloaded or executed for this planning task. The pinned
minecraft-data schemas for 758, 759, 760, 761 and 762 were downloaded and compared.
There is no separate 1.19.1 dataPaths entry in that revision: use the 1.19.2
schema for the protocol-760 checkpoint and audit native 1.19.1 separately.

The initial 1.19 Wiki fetch was blocked; its indexed release content, the other
four supplied Wiki pages and the official [1.19.1](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-19-1),
[1.19.2](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-19-2),
[1.19.3](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-19-3)
and [1.19.4](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-19-4)
release notes supply the historical checklist. Native target code is the
implementation authority; a current Wiki page alone is insufficient evidence.

## Milestone 0 — tested baseline and extraction

Start from the latest pushed 1.18.2, including registry namespace normalization,
paired-door correction, respawn view reset, version-specific chest geometry,
GUI lighting, placement support, sprint particles and compass fixes. Carry the
remaining 1.18.2 ledger forward; do not mark its open items complete by upgrading.

Download/hash-check native inputs into an isolated cache. Generate registries,
block states, collision/selection/occlusion/support faces, render layers, model
geometry, item mechanics, creative catalogs, GUI option arrays, language/font,
particles/sounds, tags and menus. Adapt extraction to 1.19.3's JOML migration;
never substitute old model constructors because reflection stopped working.

Gate: every native state and ID cross-checks against reports; generated models
have valid geometry; all existing regressions and three graphics backends pass.
Keep screenshots, packs, server worlds, session files and site configuration out
of commits. Never upgrade a user's world as part of extraction or testing.

## Milestone 1 — protocol 762 connection and terrain

Generate packet IDs from the pinned schema and compare native read/write code.
Port login, dimensions/registries, entity metadata and shared types before
reusing old packet bodies. 1.19.4 still uses login/play; do not import the later
1.20.2 Configuration state. Preserve default-namespace handling at registry
boundaries, including biome and damage registries.

The schema diff records these checkpoints:

- 758 -> 759: separate player/system chat; unified entity spawning; changed
  join/respawn, interaction sequences, particles, trades, effects and sounds.
- 759 -> 760: chat acknowledgement/header/deletion/suggestion changes.
- 760 -> 761: session updates, profileless chat, player removal and feature flags;
  sound holders, explosion and recipe changes; chat preview packets removed.
- 761 -> 762: chunk-biome updates, damage events and hurt animation; changes to
  position, recipes, server data, metadata and command/particle shared types.

Port the final 762 formats; use the intermediate schemas to explain transitions,
not to retain obsolete preview handlers in the final target. New biome-only
updates must change colors/fog and invalidate relevant mesh caches without
replacing terrain. Retain atomic palette/light validation and negative-height
coverage. Implement sequence-based prediction acknowledgement for dig/place/use.

Gate: status, login/compression/encryption, keepalive, teleport confirmation,
full-height terrain/light/biomes, inventory transactions, failed placement,
server corrections and Nether/End round trips on a native 1.19.4 test server.
Also test a proxy hub transfer with a replacement registry. Relabel the new
client/F3/build identity only with the protocol implementation, not this plan.

## Milestone 2 — signed chat and multiplayer controls

Treat this as a separate blocker. Implement native 762 chat sessions, account
profile-key handling, signing, message indexing, acknowledgement state and
ordering. Keep system/profileless messages separate from player signatures.
Respect available account capabilities and server secure-profile requirements;
do not fabricate credentials or mark unsigned messages verified.

Cover signed commands and argument signatures, last-seen messages, reconnects,
server transfers, filtering, deletion/trust indicators, reporting and social UI.
Use the 760 checkpoint to investigate the 1.19.2 disconnect fix; the final target
must not retain removed chat-preview UI. Test local offline and authenticated
configurations, with tokens/keys excluded from captures and distributions.

Gate: sustained chat/command traffic with correct acknowledgements and no
secure-chat disconnect, plus native formatting/hover/click/scoreboard regressions.

## Milestone 3 — Wild Update content

Generate, then audit mangrove/mud/sculk families, reinforced deepslate, froglights,
frogs/tadpoles/allays/wardens, chest boats, recovery compass, goat horns and the
new particle/sound registries. Test support/collision and item rendering before
claiming a block works. Cover darkness, vibration presentation, entity layers,
animations and chest-boat inventories. Allay dancing/duplication presentation
must include the 1.19.1 change. Server AI/world generation remain authoritative;
client support means correct state, rendering, input, feedback and synchronization.

Gate: a reproducible fixture world/catalog for new states, entities, events and
menus, including rejected placements, unload/reload and resource-pack replacement.

## Milestone 4 — 1.19.3 assets, creative inventory and experiments

Extract the reordered creative tabs and their exact memberships/order, including
operator permissions and tab visibility. Regenerate the Vex model. Port atlas
source definitions and target sound/recipe formats instead of treating pack
format numbers as the only resource-pack change.

The 1.19.3 experiment checkpoint includes bamboo wood, hanging signs, chiseled
bookshelves and camels. The 1.19.4 checkpoint adds the sniffer, archaeology,
armor trims and cherry content. Test those registries, models and menus under
their required flags rather than making them ordinary defaults.

Read server feature flags when determining available content. Native experimental
1.20 content and bundles must be recognized where the target supports them, but
remain gated; they are not ordinary default 1.19.4 progression and must not be
backported to 1.18.2. Test a normal server and a separate experimental fixture.

Gate: native creative search/categories, resource-pack overrides, stable animated
tab icons and both feature-flag states. Preserve older branches' native layouts.

## Milestone 5 — 1.19.4 presentation and interaction

Implement item/block/text display entities with native metadata, interpolation,
billboarding, brightness, culling and arbitrary transforms. Validate matrix and
quaternion conventions with asymmetric fixtures. Display entities do not acquire
mob physics. Interaction entities need their server-specified bounds and attack/
use routing even though they have no ordinary rendered model.

Decode damage types and directional hurt events before updating camera tilt and
sounds. Audit equipment swapping, potion visuals, jukebox presentation, glint
textures/settings and translated-text fallback behavior against native code.

Port accessibility onboarding, native defaults, keyboard navigation, tooltip
placement, contrast pack, damage/glint/notification options and F3 shortcuts.
Only add rows actually present in 1.19.4; do not copy current-version menus.

Gate: display transforms/interpolation and text transparency on all three
backends; interaction hit tests; native GUI geometry/input; language/resource-pack,
audio and damage feedback comparisons. Record unavailable observations honestly.

## Milestone 6 — release acceptance and distribution

Keep a per-release/per-feature ledger with implemented, tested and remaining
columns. Require native-server joins, inventory/crafting/trading, combat/movement,
portal/dimension transfers, registry changes and both chat-security settings.
Use independent servers/worlds for new targets; preserve the supplied 1.18.2
server and EULA/properties. Obtain server inputs only when implementation/testing
actually starts. This plan does not launch a server or accept a new EULA.

Run shared regressions on every applicable older branch and native target-specific
checks on 1.19.4. Validate WebGL 2, WebGPU and Software; synthetic graphics tests
are correctness evidence, not hardware performance measurements. Do not call
connection success full parity.

Publish source first, then rebuild standalone HTML and static distributions with
matching source commits, manifests and checksums. Add 1.19.4 to the supported-build
tool only once it is an explicitly created, tested target. Preserve the historic
1.19.2 planning document as context, not as an additional runtime branch.
