# Hold zoom wheel adjustment

While the configured zoom key is held, scroll up increases magnification and scroll down reduces it. The wheel is consumed before hotbar/spectator scrolling, so zooming does not also change the selected item or flight speed. Changes retain the existing smooth FOV transition. Magnification is bounded; releasing zoom restores the normal FOV, and the next hold starts at the usual quarter-FOV setting. Menus, unlocked input and disabled zoom keep their normal wheel behavior.

This is a requested MinecraftJS extension, not vanilla behavior. It applies to all nine existing targets with the optional zoom feature. Regression tests cover direction, limits, input routing and smooth/release behavior on every target.
