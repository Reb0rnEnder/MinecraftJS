# Native 1.19.4 parity audit — ongoing

This is an audit of the exact pinned client, not a full-parity certification.
The remaining double sound on authenticated webmc is still open. A disposable native 1.19.4 server confirmed one local wood break and zero
server break broadcasts to the initiating player. Reproduce with
`tools/port-1.19.4/probe-break-sounds.mjs` against the isolated presentation
fixture. The earlier silent-air fix does not establish the webmc cause, and no guessed duplicate suppression
is being shipped.

## Reproduce this pass

```sh
node tools/port-1.19.4/reports.mjs --check
node tools/port-1.19.4/verify-protocol.mjs
node tools/port-1.19.4/audit-native.mjs --test
```

Use Java 17+ for the report generator. Native inputs are SHA-1 pinned in target.json:
client `958928a560c9167687bea0cefeb7375da1e552a8`, mappings
`f14771b764f943c154d3a6fcb47694477e328148`. The audit writes local source indices
and test evidence into ignored cache/port-1.19.4/audit/. Class indexing proves
which native inputs are available; it does not prove our implementation matches.
Native source was decompiled with CFR 0.152; generated source/jars are not committed.

On 2026-11-05: 998 blocks, all 23,725 state names/properties, native default states,
1,454 sound registry IDs, and state sound-type access matched the pinned native
reports/extracted data. The sound asset check validates the native sounds.json
hash and referenced Ogg files. The protocol gate passed. The selected 46-file
regression pass has **286 passes, no failures or skips**. The explicit file list
is audit-cases.json. These are targeted tests, not coverage of every Java method.

The first broad run exposed three stale test-fixture failures: pre-1.16 packet
IDs/settings were being fed into 762. New native-762 fixtures now test actual
recipe categories, per-book settings, shaped notification bytes and NBT replies.
The old-version fixture is retained for its actual target; no client behavior was
changed to satisfy obsolete bytes.

## Fixes found in this pass

Mining-hit sounds used Neutral. Native 1.19.4 MultiPlayerGameMode (`fdn`) uses
SoundSource.BLOCKS (`ams.e`). Exact native controllers checked: 1.14.4 `dke`
retains Neutral; 1.15.2 `dnr`, 1.16.5 `dww`, 1.17.1 `ejl`, 1.18.2 `emv` use Blocks.
The category fix is applied only to 1.15.2+; older targets retain their behavior.
This affects mixer sliders, not the number of sounds emitted.

SoundEngine (`fxg`) also clamps the product of instance/sample gain and category
volume before applying master gain. Our one-shot path clamped instance volume
first, and loops did the same to their envelope. Both paths now use the native
order. This corrects loud sounds at reduced sliders and sample-volume clipping;
it also does not explain a second emitted event. Native 1.12.2 SoundManager
(`chm`) confirms the combined category clamp; native 1.8.9 (`bpx`) clamps
instance/sample volume before category instead. Its backport deliberately uses
that older order. Attenuation/range parity remains
under review.

The recipe wire decoder retained categories, but serverRecipe discarded them;
RecipeBook then classified by an item's creative tab. Native ClientRecipeBook
(`elv`), CraftingBookCategory (`cin`) and CookingBookCategory (`cim`) classify
recipes by category. The adapter now retains it and the book uses native
crafting/furnace/blast-furnace/smoker grouping. JSON recipe categories are retained
too. This feature arrived in 1.19.3 ([official release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-19-3),
[Wiki history](https://minecraft.wiki/w/Recipe_%28Java_Edition%29)); it is not
backported to 1.18.2 or older. The 1.20.6 graphical baseline carries the fix.

## Source comparison and remaining acceptance work

| Area | Exact native reference | Evidence and remaining work |
|---|---|---|
| Block interaction | MultiPlayerGameMode fdn, Block cpi, SlabBlock cwh, ServerPlayerGameMode air | Break/hit/event paths reviewed; slab native-server gate from prior pass. Authenticated webmc event trace pending. Other context-dependent placements remain partial. |
| Sound | SoundEngine fxg, SimpleSoundInstance fwa, SoundSource ams, SoundType cwq | Category mismatch fixed; registry/state/asset checks pass. Full trigger coverage and gain/attenuation equivalence are not certified. |
| Protocol/registries | ClientPacketListener fdk; exact packet mappings and codecs | Native reports, packet compatibility and first-play gates pass. This does not prove every optional packet's gameplay consequence. |
| Movement | Entity bfh, LivingEntity bfx, Player bym, LocalPlayer fhk | Existing crawl/bubbles/spectator/mouse-look regressions pass. Floating-boat jitter remains unresolved; earlier client mitigations failed native server validation. |
| Terrain/light | ClientLevel fdj, LevelLightEngine (mapped in source index) | State/property/biome/shape regression checks pass. Exhaustive light propagation and all boundary sequences need reference acceptance. |
| Entities/rendering | LevelRenderer fie, GameRenderer fhz, EntityRenderDispatcher (source index) | Native keyframe/projectile/painting/preview/shulker regressions pass; all states/layers and graphics backends are not visually certified. |
| Inventory/recipes | InventoryScreen, CreativeModeInventoryScreen, MerchantScreen, AbstractContainerMenu (source index), ClientRecipeBook elv | Category loss fixed; merchant/inventory/equipment/recipe tests pass. All workstation screens still need pixel and interaction acceptance. |
| Text/chat | Component tj, TranslatableContents ut, Language qz, Font (source index) | Fallback/format/hover/trust tests pass. Outgoing signed chat/commands/reporting remain partial. Raw webmc death component has not been captured. |
| GUI/accessibility | OptionsScreen, VideoSettingsScreen, AccessibilityOptionsScreen, ChatOptionsScreen, SocialInteractionsScreen, DeathScreen ese | Targeted GUI checks pass; exact pixels, focus/navigation and full narration are not certified. |
| Resources | PackSelectionScreen, PackRepository (source index) | Existing pack/font/texture paths remain under audit. Arbitrary OptiFine shader execution is not vanilla parity and remains incomplete. |
| Server-authoritative behavior | Exact native server jar/release boundaries | AI, drops, recipes and other server decisions must not be invented client-side. Experiments retain native feature gating. |

The source index includes 41 exact classes spanning these areas. It is an input
map for continued comparisons, not a claim that all 41 classes have been fully
reviewed. Existing development/parity ledgers remain open.

## Trace the remaining double sound

After reloading the client, run in the console on webmc:

```js
var sc = (await import('/js/debug/capture-sounds.js')).captureSounds(game);
// Break one wooden block, then:
sc.download(); sc.stop();
```

Save minecraftjs-sound-capture.json in the 1.19.4 worktree. The bounded trace
separates local hit/break/place requests from server world-event/sound packets,
and includes IDs, block states and mixer categories. It excludes chat, server
addresses, credentials and custom payloads. It observes requested sounds; it does
not claim to measure played audio, device latency or native Java FPS.
