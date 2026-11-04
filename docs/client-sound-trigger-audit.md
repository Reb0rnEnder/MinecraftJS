# Client sound trigger audit — 2026-11-04

## Corrected paths

- Throwable potions are dispatched before sustained-use actions. SplashPotionItem and LingeringPotionItem inherit PotionItem's DRINK animation/duration, but override use to throw immediately. Treating that animation as the activation method made the client start drinking. Native runtime metadata remains intact; the interaction path now chooses the overridden behavior, retains Creative stacks and consumes Survival stacks once. Existing 1.8.9 splash metadata handling is preserved, with its Creative throw-success result corrected.
- 1.12.2+ collection packets now emit the local item pop or XP pickup sound at the collected entity, with native volume, pitch distribution and Players category. The old comment incorrectly applied 1.8.9's sound callback behavior to every release. Unknown entity IDs stay silent and existing three-tick pickup visuals remain intact.
- Locally activated buttons emit press sounds and predict their pressed state once. A button already pressed stays silent. Comparator mode changes now emit their local click with the correct mode-dependent pitch. Native Adventure/Spectator restrictions are retained for these audio paths. Release and lever sounds stay server-owned.
- Native 1.19.4 button volume/pitch lives in sounds.json: the caller uses 1/1 so these settings are applied once. Earlier targets use caller volume .3 and pitch .6. The 1.19.4 nether/bamboo/cherry button event identities are confined to that branch; older targets retain their own names and assets.
- Consume effects, item breakage and native riptide/spyglass/bundle actions use the Players volume category where present; drinks emit no food fragments. Honey uses its own drinking event on 1.15+. The server's item-completion status emits the final gulp/bite (16 food fragments when eating) exactly once, using a snapshot so an inventory update to an empty bottle/bowl cannot erase it. Burps remain server-owned.

## Native ownership audit

| Path | Native owner / result |
|---|---|
| Splash/lingering potion throw | Server broadcasts the throw sound to everyone (null excluded player); no extra local throw sound is added. The client predicts the use result, not drinking. |
| Item/XP collection, 1.12.2+ | Collection-packet handler emits local audio. Item volume .2 with pitch (r-r)*1.4+2; XP .1 with pitch (r-r)*.35+.9. Fixed. |
| Collection/button/comparator sound, 1.8.9 | World methods delegate to RenderGlobal's empty sound callbacks; actual sound arrives from the server. Do not add a second local sound. Verified directly from bcy, adm, bdb and bfr. |
| Button press, 1.12.2+ | Local use sound; server excludes the pressing player. Fixed, including pressed-state repeat suppression. |
| Button release / lever click | Server broadcast. Kept on the existing packet path rather than duplicated locally. |
| Comparator mode change, 1.12.2+ | Local use sound; server excludes the activating player. Fixed. |
| Doors / trapdoors / fence gates | Existing prediction invokes the native world-event sound path; source path and door rollback regressions checked. |
| Block hit / break / accepted placement | Existing native SoundType paths. All current block sound references resolve or are the explicit native intentionally_empty marker. Placement and fire-event regressions pass. |
| Explosions / world events | Existing explosion and level-event routes; reference/category regressions pass. This does not establish every possible event's timing by gameplay capture. |
| Riptide / spyglass / bundle | Existing action/status paths, version-specific availability retained. Source inspection and available native-target use regressions checked. |
| Periodic/final consumption | Local LivingEntity use effects; food/drink/honey fixes above. Server burp packets remain untouched. |
| Ordinary item drop (Q or inventory drop) | Player.drop creates the entity and motion without a generic drop sound. No invented drop sound is added. Bundle emptying is a distinct action with its own existing sound. |
| Flint-and-steel / tool transformations / buckets and bottles | A wider source audit still finds incomplete client prediction/use paths. Several native methods emit player-excluded sounds which require the same native success predicates as their interactions. These are remaining feature gaps, not proved complete by an asset test. Do not play a sound merely because an item was clicked: that would recreate invalid-placement sounds the user previously reported. |

Native 1.19.4 classes inspected: ClientPacketListener (fdk), ButtonBlock (cpq), ComparatorBlock (cqo), LeverBlock (ctp), PotionItem/ThrowablePotionItem/SplashPotionItem, Player.drop, LivingEntity.triggerItemUseEffects/completeUsingItem, HoneyBottleItem, BucketItem, BottleItem, FlintAndSteelItem, AxeItem, HoeItem, ShovelItem, ArmorItem and FishingRodItem. Corresponding collection/button/comparator/potion/drop classes were extracted from each available 1.14.4–1.18.2 jar under cache/port-V/sound-use-native. 1.12.2 collection code is brz; 1.8.9 source audit is under the ignored cache/sound-audit-1.8.9 directory. Existing 1.13.2 behavior is covered by runtime use/collection tests and its native sound definitions.

The [Splash Potion history](https://minecraft.wiki/w/Splash_Potion#History), [item sounds](https://minecraft.wiki/w/Item_(entity)#Sounds) and [wooden button history](https://minecraft.wiki/w/Wooden_Button#History) provide context; exact version behavior, ownership and pitch were taken from native code and assets, not assumed from current Wiki prose.

## Asset and browser verification

Every registered event/reference is checked against the target's native default sound definitions. 1.19.4 has six registered events absent from its official default sounds.json, including intentionally_empty and prototype/unused brush/horn/cherry entries. The test explicitly records that native silence and binds the exception to the official sound-definition SHA-1 539a0c2f52110193b3eb1a506a194714485571b0 (asset-index SHA-1 1c5794ccdb92e85c7933fb033979301b95477a29). No fabricated aliases, newer assets or resource-pack overrides were added to make silent native events audible.

All native Ogg samples were decoded with Chromium through the actual BrowserPlatform Web Audio adapter, including unreferenced shipped samples. The harness now also supports unbuilt source trees through the exact native asset index.

| Version | Ogg samples decoded | Relevant Node regressions |
|---|---:|---:|
| 1.8.9 | 578 | 25 passed |
| 1.12.2 | 1,085 | 25 passed |
| 1.13.2 | 1,406 | 29 passed |
| 1.14.4 | 1,779 | 29 passed |
| 1.15.2 | 1,830 | 29 passed |
| 1.16.5 | 2,336 | 29 passed |
| 1.17.1 | 2,776 | 37 passed |
| 1.18.2 | 2,794 | 37 passed |
| 1.19.4 | 3,411 | 37 passed |

All nine browser decode tests passed; 17,995 samples total. These checks prove availability/decodability in the tested browser, not audible speaker output, every gameplay trigger's timing, or other browsers. User sound settings, resource packs, worlds and captures were untouched. No distributions were rebuilt.

Backports retain native differences: sustained potion dispatch is protected on existing 1.12.2+ branches; pickup and activation audio is fixed on 1.12.2+ and intentionally excluded from 1.8.9. Consume completion/category/particle correctness applies to all existing branches; honey-specific sound stays on 1.15+. No new release-only events or protocol fields were added to old clients.

Reproduce with tools/test-client-use-pickup-sounds.mjs, tools/test-sound-coverage.mjs, tools/test-client-sound-triggers.mjs where present, tools/test-item-pickup-flight.mjs and tools/test-placement-sound-riding.mjs. Browser adapter coverage is tools/test-audio-decode-browser.mjs with PLAYWRIGHT_MODULE set. The legacy test-1.13.2-riptide.mjs is run on 1.13.2 only: on newer targets it requires that older jar and asserts older packet IDs, so it is not a valid newer-version fixture.

The remaining tool/bucket prediction work means full client sound-trigger parity is not yet established. Asset completeness is not presented as gameplay completeness.
