// Mojang's component map is emitted as a list in items.json. Its iteration
// order varies between JVM invocations; component values and their own lists
// (lore, nested stacks, attribute modifiers, etc.) retain semantic order.
export function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

export function canonicalReport(name, report) {
  if (name === 'items') {
    report = Object.fromEntries(Object.entries(report).map(([key, item]) => [key, {
      ...item,
      components: [...item.components].sort((a, b) => a.type < b.type ? -1 : a.type > b.type ? 1 : 0)
    }]));
  }
  return canonicalJson(report);
}
