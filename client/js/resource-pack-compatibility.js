// 1.20.2+ PackMetadataSection.supported_formats uses InclusiveRange (int, [min, max],
// or { min_inclusive, max_inclusive }); 1.21.9+ PackMetadataSection supports min_format/max_format
// major or [major, minor] tuples compared lexicographically against [format, minor].
function tuple(v) {
  if (Number.isInteger(v)) return [v, 0];
  if (Array.isArray(v) && v.length >= 1 && Number.isInteger(v[0])) {
    return [v[0], Number.isInteger(v[1]) ? v[1] : 0];
  }
  return null;
}

function cmpTuple(a, b) {
  return a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1];
}

export function packCompatibility(pack, format, minor = 0) {
  if (!pack) return 'compatible';
  const cur = tuple(format) || [Number(format) || 0, Number(minor) || 0];
  if (minor && !Array.isArray(format)) cur[1] = Number(minor) || 0;
  const minFmt = tuple(pack.minFormat ?? pack.min_format);
  const maxFmt = tuple(pack.maxFormat ?? pack.max_format);
  if (minFmt || maxFmt) {
    const lo = minFmt || maxFmt;
    const hi = maxFmt || minFmt;
    if (cmpTuple(lo, hi) <= 0) {
      if (cmpTuple(hi, cur) < 0) return 'old';
      if (cmpTuple(lo, cur) > 0) return 'new';
      return 'compatible';
    }
  }
  const range = pack.supportedFormats;
  let min, max;
  if (Number.isInteger(range)) min = max = range;
  else if (Array.isArray(range) && range.length === 2) [min, max] = range;
  else if (range && typeof range === 'object') ({ min_inclusive: min, max_inclusive: max } = range);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) min = max = pack.format;
  return max < cur[0] ? 'old' : min > cur[0] ? 'new' : 'compatible';
}
