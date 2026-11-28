import { ADVENTURE_PROPERTIES_774 as data } from './adventure-properties-1.21.11.js';
import { getStateProperties } from '../world/blocks.js';
import { DEFAULT_TAGS } from './default-tags.js';

const blockTags = (tags) => tags?.registries?.blocks;
const matchesBlock = (set, block, tags) =>
  !set || (set.blockIds ? set.blockIds.includes(block.id) : (blockTags(tags) ? blockTags(tags).get(set.name) : DEFAULT_TAGS.blocks[set.name])?.includes(block.id) || false);

/** Look up a property value string in `type.values`, normalizing base-10 integers like Java IntegerProperty.getValue. */
function propertyIndex(type, raw) {
  if (raw == null) return -1;
  const str = String(raw);
  if (!type.integer) return type.values.indexOf(str);
  if (!/^[+-]?\d+$/.test(str)) return -1;
  const parsed = Number.parseInt(str, 10);
  if (parsed < -2147483648 || parsed > 2147483647) return -1;
  return type.values.indexOf(String(parsed));
}

// Ranged property bounds validate every endpoint string against the block's actual domain and compare in native ordinal order.
function matchesProperty(matcher, definition, properties) {
  const index = definition?.[matcher.name];
  if (index === undefined) return false;
  const type = data.propertyTypes[index], actual = propertyIndex(type, properties[matcher.name]);
  if (actual < 0) return false;
  if (matcher.isExactMatch) {
    const expected = propertyIndex(type, matcher.value?.exactValue ?? matcher.value);
    return expected >= 0 && actual === expected;
  }
  const min = matcher.value?.minValue, max = matcher.value?.maxValue;
  if (min != null) {
    const low = propertyIndex(type, min);
    if (low < 0 || actual < low) return false;
  }
  if (max != null) {
    const high = propertyIndex(type, max);
    if (high < 0 || actual > high) return false;
  }
  return true;
}

export function matchesAdventureComponentState(predicate, block, state, tags = null) {
  if (!matchesBlock(predicate.blockSet, block, tags)) return false;
  const matchers = predicate.properties;
  if (!matchers?.length) return true;
  const definition = data.properties[block.name], properties = getStateProperties(state);
  return matchers.every((matcher) => matchesProperty(matcher, definition, properties));
}
