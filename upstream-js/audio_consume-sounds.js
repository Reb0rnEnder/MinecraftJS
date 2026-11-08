// LivingEntity.triggerItemUseEffects: drinking has no food-fragment particles.
export function consumeEffect(game, item, count=5) {
  const action=game.items.useAction(item);
  if(action==='eat'){
    game.particles.itemCrack(item,game.player,count);
    game.sound.playAtPlayer('random.eat',.5+.5*Math.round(Math.random()),(Math.random()-Math.random())*.2+1,'player');
  }else if(action==='drink'){
    game.sound.playAtPlayer('random.drink',.5,Math.random()*.1+.9,'player');
  }
}
