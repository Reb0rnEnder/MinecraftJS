# Sword mining rules

Vanilla permits swords to mine in Survival, with fast cobweb cutting and normal
slow mining for blocks such as stone. Creative swords must not destroy blocks.
The client already guarded local Creative block removal, but its click and held
mining paths still sent START_DESTROY_BLOCK requests. This patch also suppresses
those redundant mining requests, so a server cannot treat them as normal Creative
breaks. The local destruction guard remains in place.

Adjacent fire is an exception: the request is retained to synchronize extinguishing
without destroying the supporting block. Once fire is gone, holding the button
with a sword sends no further mining requests. Empty hands and ordinary tools
retain instant Creative breaking. Survival sword/cobweb behavior is preserved.

The same rule applies to 1.8.9, 1.12.2 and 1.13.2, so the fix is backported using
each version's sword identities and existing wire format. Tests cover all five
sword materials, click/hold, stone/cobwebs, direct local prediction, fire, ordinary
Creative tools, and Survival cutting. Production builds are checked on all three
branches. The 1.14.4 transition remains on hold.
