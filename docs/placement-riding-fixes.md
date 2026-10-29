# Placement sounds and removed vehicles

Successful ordinary block placement calls the existing placement-sound helper
at the destination position, after placement/count validation. Sound playback
also occurs for oriented blocks whose state is left to the server to resolve;
it is independent of optimistic geometry updates. Failed attempts remain silent.
The sound helper retains the target version's sound names, category, volume,
pitch and resource-pack overrides.

Entity removal clears local riding references, boat state and the steering
controller before deleting the entity. It also detaches remote riders and
removes destroyed passengers from parent vehicles. A missing vehicle entry or
repeated destroy packet still clears stale local references. The player's
position is preserved; subsequent normal movement resumes. Removal batches
scan the entity list once.

Both fixes apply to all six supported branches. Run
`node --test tools/test-placement-sound-riding.mjs` in each checkout. The 1.16.5
`tools/port-1.16.5/probe-placement-riding-browser.mjs` additionally exercises
placement and movement after a destroyed boat in an isolated browser scene,
without connecting to or editing a server world.
