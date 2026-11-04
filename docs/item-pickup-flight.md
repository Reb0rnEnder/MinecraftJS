# Item collection flight

The collect packet previously attached its animation to the server entity. A destroy packet arriving in the same network batch deleted that entity before its first animation frame. The collection visual now owns a separate render copy and expires after three simulation ticks, independently of server destruction or partial-stack metadata. Inventory slot updates remain authoritative for hotbar pop animations.

The squared progress and copied-item lifetime follow native ItemPickupParticle/EntityPickupFX. Native 1.14.4–1.18.2 sources use collector feet plus 0.5; 1.19.4 interpolates toward half eye height. Earlier targets retain their fixed-height rule. References: extracted version-specific item-visual-src classes and the 1.19.4 visual-quick-src/ffs.java in local parity caches. The Minecraft Wiki Item (entity) page was requested for history cross-checking but access was blocked by robots.txt in this session; no Wiki support is claimed for the interpolation formula.

Regression coverage: immediate collect/destroy ordering, partial collection, independent item data, squared position interpolation, three-tick expiry through EntityManager.tick, and particle counts. This change does not claim to fix floor collision.
