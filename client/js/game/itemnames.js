// Item display names through the game's translation keys (port of Item.getUnlocalizedName for the
// multi-texture items, ItemPotion / ItemMonsterPlacer / ItemSkull / ItemBanner naming). Items without a
// special rule map their English name to the matching .lang key, so every name follows the language.

// EnumDyeColor by block metadata (wool, carpet, stained glass / clay)
const COLORS = ['white', 'orange', 'magenta', 'lightBlue', 'yellow', 'lime', 'pink', 'gray', 'silver', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
const WOOD = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'big_oak'];

// id -> (meta) => translation key prefix (without ".name")
const VARIANTS = {
  1: (m) => 'tile.stone.' + (['stone', 'granite', 'graniteSmooth', 'diorite', 'dioriteSmooth', 'andesite', 'andesiteSmooth'][m] || 'stone'),
  3: (m) => 'tile.dirt.' + (['default', 'coarse', 'podzol'][m] || 'default'),
  5: (m) => 'tile.wood.' + (WOOD[m] || 'oak'),
  6: (m) => 'tile.sapling.' + (WOOD[m & 7] || 'oak'),
  12: (m) => 'tile.sand.' + (m === 1 ? 'red' : 'default'),
  17: (m) => 'tile.log.' + WOOD[m & 3],
  18: (m) => 'tile.leaves.' + WOOD[m & 3],
  19: (m) => 'tile.sponge.' + (m === 1 ? 'wet' : 'dry'),
  24: (m) => 'tile.sandStone.' + (['default', 'chiseled', 'smooth'][m] || 'default'),
  31: (m) => 'tile.tallgrass.' + (['shrub', 'grass', 'fern'][m] || 'grass'),
  35: (m) => 'tile.cloth.' + COLORS[m & 15],
  37: () => 'tile.flower1.dandelion',
  38: (m) => 'tile.flower2.' + (['poppy', 'blueOrchid', 'allium', 'houstonia', 'tulipRed', 'tulipOrange', 'tulipWhite', 'tulipPink', 'oxeyeDaisy'][m] || 'poppy'),
  39: () => 'tile.mushroom', 40: () => 'tile.mushroom',
  43: (m) => 'tile.stoneSlab.' + ['stone', 'sand', 'wood', 'cobble', 'brick', 'smoothStoneBrick', 'netherBrick', 'quartz'][m & 7],
  44: (m) => 'tile.stoneSlab.' + ['stone', 'sand', 'wood', 'cobble', 'brick', 'smoothStoneBrick', 'netherBrick', 'quartz'][m & 7],
  77: () => 'tile.button', 143: () => 'tile.button',
  78: () => 'tile.snow',
  85: () => 'tile.fence',
  95: (m) => 'tile.stainedGlass.' + COLORS[m & 15],
  96: () => 'tile.trapdoor',
  97: (m) => 'tile.monsterStoneEgg.' + (['stone', 'cobble', 'brick', 'mossybrick', 'crackedbrick', 'chiseledbrick'][m] || 'stone'),
  98: (m) => 'tile.stonebricksmooth.' + (['default', 'mossy', 'cracked', 'chiseled'][m] || 'default'),
  99: () => 'tile.mushroom', 100: () => 'tile.mushroom',
  107: () => 'tile.fenceGate',
  120: () => 'tile.endPortalFrame',
  123: () => 'tile.redstoneLight',
  125: (m) => 'tile.woodSlab.' + (WOOD[m & 7] || 'oak'),
  126: (m) => 'tile.woodSlab.' + (WOOD[m & 7] || 'oak'),
  139: (m) => 'tile.cobbleWall.' + (m === 1 ? 'mossy' : 'normal'),
  145: (m) => 'tile.anvil.' + (['intact', 'slightlyDamaged', 'veryDamaged'][m >> 2] || 'intact'),
  151: () => 'tile.daylightDetector',
  155: (m) => 'tile.quartzBlock.' + (['default', 'chiseled', 'lines'][Math.min(m, 2)] || 'default'),
  159: (m) => 'tile.clayHardenedStained.' + COLORS[m & 15],
  160: (m) => 'tile.thinStainedGlass.' + COLORS[m & 15],
  161: (m) => 'tile.leaves.' + WOOD[4 + (m & 1)],
  162: (m) => 'tile.log.' + WOOD[4 + (m & 1)],
  168: (m) => 'tile.prismarine.' + (['rough', 'bricks', 'dark'][m] || 'rough'),
  171: (m) => 'tile.woolCarpet.' + COLORS[m & 15],
  175: (m) => 'tile.doublePlant.' + (['sunflower', 'syringa', 'grass', 'fern', 'rose', 'paeonia'][m & 7] || 'sunflower'),
  179: (m) => 'tile.redSandStone.' + (['default', 'chiseled', 'smooth'][m] || 'default'),
  181: () => 'tile.stoneSlab2.red_sandstone', 182: () => 'tile.stoneSlab2.red_sandstone',
  263: (m) => (m === 1 ? 'item.charcoal' : 'item.coal'),
  322: () => 'item.appleGold',
  338: () => 'item.reeds',
  349: (m) => 'item.fish.' + (['cod', 'salmon', 'clownfish', 'pufferfish'][m] || 'cod') + '.raw',
  350: (m) => 'item.fish.' + (['cod', 'salmon'][m] || 'cod') + '.cooked',
  351: (m) => 'item.dyePowder.' + COLORS[15 - (m & 15)],
  397: (m) => 'item.skull.' + (['skeleton', 'wither', 'zombie', 'char', 'creeper'][m] || 'skeleton'),
  425: (m) => 'item.banner.' + COLORS[15 - (m & 15)],
};

const RECORDS = { 2256: '13', 2257: 'cat', 2258: 'blocks', 2259: 'chirp', 2260: 'far', 2261: 'mall', 2262: 'mellohi', 2263: 'stal', 2264: 'strad', 2265: 'ward', 2266: '11', 2267: 'wait' };

export class ItemNames {
  constructor(assets, items) {
    this.assets = assets;
    this.items = items;
    this._rev = null;
    this._revFor = -1;
  }

  t(key, ...args) { return this.assets.translate(key, args); }
  has(key) { return this.assets.lang[key] !== undefined; }

  // English display name -> .lang key (from the English table), rebuilt when the language reloads
  _reverse() {
    const v = this.assets.langVersion || 0;
    if (this._rev && this._revFor === v) return this._rev;
    const rev = new Map();
    const en = this.assets.langEn || this.assets.lang;
    for (const [k, val] of Object.entries(en)) {
      if (!/^(tile|item)\..+\.name$/.test(k)) continue;
      const list = rev.get(val);
      if (list) list.push(k); else rev.set(val, [k]);
    }
    this._rev = rev;
    this._revFor = v;
    return rev;
  }

  // Translation key for an item stack, or null if none is known
  key(id, meta, englishName) {
    const f = VARIANTS[id];
    if (f) {
      const k = f(meta) + '.name';
      if (this.has(k)) return k;
    }
    if (englishName) {
      const list = this._reverse().get(englishName);
      if (list) {
        const pref = id < 256 ? 'tile.' : 'item.';
        return list.find((k) => k.startsWith(pref)) || list[0];
      }
    }
    return null;
  }

  // ItemStack.getDisplayName without a custom name
  name(item, def, englishName) {
    const id = item.id, meta = item.damage || 0;
    // ItemPotion / ItemSplashPotion / ItemLingeringPotion / ItemTippedArrow: the PotionType's prefixed name
    const pre = { 373: 'potion.effect.', 438: 'splash_potion.effect.', 441: 'lingering_potion.effect.', 440: 'tipped_arrow.effect.' }[id];
    if (pre) return this.t(pre + this.items.potionType(item).name);
    if (id === 383) {
      // ItemMonsterPlacer.getItemStackDisplayName: "Spawn" + the entity's name from EntityTag.id
      let s = this.t('item.monsterPlacer.name').trim();
      const egg = this.items.eggInfo(item);
      if (egg) s += ' ' + this.t('entity.' + egg[2] + '.name');
      return s;
    }
    if (RECORDS[id]) return this.t('item.record.name');
    const k = this.key(id, meta, englishName);
    return k ? this.t(k) : englishName;
  }

  recordDescription(id) { return RECORDS[id] ? this.t('item.record.' + RECORDS[id] + '.desc') : null; }
}
