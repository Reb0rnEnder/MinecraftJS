# Native camera eye-height transitions

The 1.13.2 EntityRenderer retains previous/current camera eye height, moving
halfway toward the entity's eye height per tick and interpolating per frame.
The client now uses that behavior for camera rendering while gameplay rays,
fluid checks and collision use the actual entity pose immediately. This fixes
crouch/swimming camera snaps without importing 1.14 crawling or pose dimensions.
The camera resets its height on a fresh Join Game. A regression covers smoothing,
frame interpolation, return to standing, reset and unchanged gameplay eyes.
The full regression suite passes 227 checks with one optional endpoint skipped.
