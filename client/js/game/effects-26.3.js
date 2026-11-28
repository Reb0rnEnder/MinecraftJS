// Native 26.3 mob effects that are newer than the 1.20.6 item UX table.
// MobEffects.BREATH_OF_THE_NAUTILUS is registered at protocol id 39 with
// MobEffectCategory.BENEFICIAL and colour 65518 (javap on the 26.3 client jar);
// it declares no attribute modifiers.
export const EFFECT_26_3 = Object.freeze({breath_of_the_nautilus: 39});

export const NATIVE_EFFECTS_26_3 = Object.freeze({
  39: Object.freeze({
    key: 'minecraft:breath_of_the_nautilus',
    color: 65518,
    bad: false,
    beneficial: true,
    blendTicks: 0,
    modifiers: []
  })
});
