# Water, chat, proxies and world updates

The 1.13.2 branch starts swimming after eye immersion, retains an existing swim
pose near the surface, and uses the jar's upward steering, sprint drag and water
gravity. Sneaking sinks; jump assists ascent. Depth Strider reads boots and
Dolphin's Grace uses native drag. Biome water/fog colours come from all 73
registered biomes in the pinned jar. Water uses EXP2 fog in all three rendering
backends, five-second biome transitions, and the 600-tick underwater adaptation
curve. Conduit vision feeds the lightmap. These 1.13 mechanics are not backported.

All branches use the corrected proxy placeholders: `%u` is the undashed UUID,
`%r` the raw full URL, `%R` the encoded full URL. `%U` remains a raw-URL alias.
UUID-only skin services work without a server texture property; cape and profile
fetches keep the automatic route because a UUID skin endpoint returns a PNG.
Saving still invalidates pending skin records and refreshes player visuals.

Chat hit regions preserve events on translation arguments and are sliced per
wrapped line. This restores advancement descriptions and item tooltips, including
enchantments/lore from typed SNBT, on all applicable versions. Legacy achievement
hover descriptions are supported on 1.8.9. The 1.13 suggestion selection follows
mouse motion and the hovered row after scrolling.

Chat history used a class-name comparison that fails after production minifying.
An explicit screen flag now makes expired messages reappear when chat opens.
Unknown translation keys are formatted with their arguments, so server components
using `translate: "%s"` display their message instead of a literal placeholder.

Paths sample neighbouring light immediately after chunk loading (1.12.2/1.13.2;
no path block is added to 1.8.9). Falling blocks remove their source once and use
box collision rather than jumping to the top of any opaque cell. A synchronized
landing block hides its redundant falling entity and can be built on immediately.
Landing block creation remains server-authoritative. These falling-block fixes
apply to all three versions.

Offline regression tests compare swim steering and adaptation to jar bytecode,
exercise EXP2 software rendering and biome transitions, verify proxy routes and
hover data on each version, and cover faded history, literal-format translation
keys, path lighting and placement on landed sand. Production HTML builds are
checked on all three branches.

Follow-up path audit: vanilla 1.13.2 reports 38 default block states using
neighbour brightness. All have the flag in the client after the path fix. The
path opacity was also corrected from 0 to 15; the exposed top remains bright
while direct skylight is blocked beneath it. Native jar reflection confirmed
opacity 15; the 1.12.2 `arc` path constructor explicitly sets opacity 255
(normalized to 15 by this client's light system). No path block exists in 1.8.9.
This checks default states, not every state-dependent lighting behaviour.
