// Native KeyMapping.createNameSupplier: bindings are read at render time.
const BINDINGS={
  'key.attack':'attack',
  'key.use':'use',
  'key.forward':'forward',
  'key.left':'left',
  'key.back':'back',
  'key.right':'right',
  'key.jump':'jump',
  'key.sneak':'sneak',
  'key.sprint':'sprint',
  'key.drop':'drop',
  'key.inventory':'inventory',
  'key.socialInteractions':'socialInteractions',
  'key.chat':'chat',
  'key.playerlist':'playerlist',
  'key.pickItem':'pickItem',
  'key.command':'command',
  'key.screenshot':'screenshot',
  'key.togglePerspective':'perspective',
  'minecraftjs.key.zoom':'zoom',
  'key.smoothCamera':'smoothCamera',
  'key.swapHands':'swapHands',
  'key.advancements':'advancements',
  'key.saveToolbarActivator':'saveToolbarActivator',
  'key.loadToolbarActivator':'loadToolbarActivator',
  'key.fullscreen':'fullscreen',
  'key.spectatorOutlines':'spectatorOutlines'
};
for(let i=1;i<=9;i++)BINDINGS['key.hotbar.'+i]='hotbar'+i;
export function bindingResolver(settings,translate){
  return name=>{const field=BINDINGS[name];return field&&Object.hasOwn(settings.keys,field)?settings.keyName(settings.keys[field]):translate(name);};
}
