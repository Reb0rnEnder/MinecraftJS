// Mojang's component map was emitted as a list in older releases (1.20.6) and
// as a JSON object in 1.21.11. Canonical JSON sorts all object keys; if a
// legacy array-form components field is encountered, sort it by component type.
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
      components: Array.isArray(item.components)
        ? [...item.components].sort((a, b) => a.type < b.type ? -1 : a.type > b.type ? 1 : 0)
        : item.components
    }]));
  }
  return canonicalJson(report);
}
