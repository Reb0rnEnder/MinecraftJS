import { blocks } from '../world/blocks.js';
import { COMPONENT_IDS } from '../net/item-components-1.21.11.js';
import { DEFAULT_TAGS } from './default-tags.js';
import { ADVENTURE_PROPERTIES_774 } from './adventure-properties-1.21.11.js';
import { ADVENTURE_TOOLTIP_DATA as legacyData } from './adventure-tooltip-data.js';

function isHidden(components, key) {
  const td = components.tooltip_display;
  if (td?.hide_tooltip || td?.hideTooltip) return true;
  const hidden = td?.hidden_components || td?.hiddenComponents;
  if (!Array.isArray(hidden) || !hidden.length) return false;
  const id = COMPONENT_IDS[key];
  return hidden.some((entry) => entry === id || entry === key || entry === 'minecraft:' + key);
}

// AdventureModePredicate.computeTooltip: an unrestricted predicate makes the
// entire description unknown; otherwise flatten holders and remove duplicates.
export function appendAdventureTooltips(items, item, lines) {
  const components = items.components(item), t = (key) => items.assets.translate(key), tags = items.registryTags?.();
  const blockNames = ADVENTURE_PROPERTIES_774.blockNames || legacyData.blockNames;
  for (const [key, title] of [['can_break', 'item.canBreak'], ['can_place_on', 'item.canPlace']]) {
    const permission = components[key];
    if (!permission || isHidden(components, key) || (permission.showTooltip ?? permission.show_in_tooltip ?? true) === false) continue;
    const predicates = Array.isArray(permission) ? permission : permission.predicates;
    if (!predicates) continue;
    lines.push('', '§7' + t(title));
    if (predicates.some((p) => !p.blockSet)) { lines.push('§7' + t('item.canUse.unknown')); continue; }
    const seen = new Set();
    for (const predicate of predicates) {
      const set = predicate.blockSet;
      const ids = set.blockIds ?? (tags ? tags.registries.blocks.get(set.name) : DEFAULT_TAGS.blocks[set.name]) ?? [];
      for (const id of ids) {
        if (!seen.has(id)) {
          seen.add(id);
          const block = blocks[id];
          if (block) lines.push('§8' + t(blockNames[block.name] || ('block.minecraft.' + block.name)));
        }
      }
    }
  }
}
