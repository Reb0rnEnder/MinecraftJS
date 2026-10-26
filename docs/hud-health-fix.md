# Survival HUD absorption correction

The HUD used the 1.8.9 absorption metadata index 17. This version uses index 11.
Correcting it restores golden hearts and avoids treating unrelated metadata as
an absorption value. Normal and absorption-heart HUD drawing, shoulder metadata,
and survival/adventure bars have regression coverage. The 1.14.4 respawn field
correction does not apply here: the existing decoder already emits gamemode.
