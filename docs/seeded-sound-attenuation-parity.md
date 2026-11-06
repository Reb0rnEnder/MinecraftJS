# Seeded sounds and sample attenuation (2026-11-06)

Server-provided sound seeds now reach the native-weighted sample selector on 1.19.4 and the forwarded 1.20.6 graphical baseline. Each sound starts its own Java-compatible RandomSource; nested events consume the same generator. This changes sample choice, not whether explicit server sounds are played.

## Correction to the review's range finding

The initial review incorrectly treated a network SoundEvent fixed range as client attenuation. Native ClientPacketListener `fdk`, ClientLevel `fdj.playSeededSound`, SimpleSoundInstance `fwa`, and SoundEngine `fxg.play` show that it is not used for client attenuation. The server uses that event range to select packet recipients. No packet-range override or server-echo filter is added.

The actual client gap was discarding `sounds.json` sample attenuation distance and ignoring sample volume when calculating the audible radius. Native release boundaries are retained:

| Target | Radius calculation |
| --- | --- |
| 1.8.9 | `max(instanceVolume, 1) * 16` |
| 1.12.2 | `max(instanceVolume * sampleVolume, 1) * 16` |
| 1.13.2–1.19.4 | `max(instanceVolume * sampleVolume, 1) * sample.attenuation_distance` (default 16) |

Sample/event volume and pitch arithmetic follow float precision in 1.12.2 and later. Referenced events retain the selected leaf's attenuation distance. The forwarded 1.20.6 baseline follows the 1.19.4 behavior; complete native 766 Play is still pending. Seed fields are not added to pre-1.19 protocol targets; sample distances are not added to pre-1.13 resource formats.

## Evidence and limitations

Compared each target's exact local native sound engine and sample definitions: 1.8.9 `bpx`, 1.12.2 `chm` / `cgj.g`, 1.13.2 serializer `dfv`, and officially mapped later sound engines. On 1.19.4, `fwe` reads sample distance, `fxj` composes event samples, `fxk` selects weighted samples with RandomSource, and `apo.create(long)` returns LegacyRandomSource. Source references use the pinned client SHA-1 `958928a560c9167687bea0cefeb7375da1e552a8`.

`tools/port-1.19.4/VerifySeededSounds.java` executes native JSON parsing and WeighedSoundEvents selection in a headless JVM. Its 72 selections cover nine signed 64-bit seeds, including both boundaries. Committed vectors pass through the real JavaScript selector. Additional tests pass real sound packets through Game into sample selection, check per-play RNG resets, entity-attached sounds, nested events and version-specific attenuation.

All ten targets pass focused sound regressions and browser-bundle compilation. The 1.19.4 selected native audit passes **344 tests, zero failures/skips, in 58 files**. These checks inspect selected samples and platform audio parameters; they do not measure physical playback or certify every client sound trigger. No distributions were rebuilt. The historical Wiki endpoint was restricted during this follow-up; exact client code supplies these implementation details.
