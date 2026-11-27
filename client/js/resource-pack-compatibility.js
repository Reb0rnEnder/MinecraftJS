// 26.3 PackFormat is a major.minor pair; the native PackCompatibility.forVersion compares
// both components. 26.3 pack.mcmeta may use min_format/max_format (the compact list codec) or
// the legacy integer pack_format/supported_formats fields. Older targets keep their integer
// thresholds, so the current format is selected by protocol instead of one shared constant.
export const PACK_FORMAT_26_3 = Object.freeze({major: 97, minor: 1});
export const PACK_FORMAT_1_20_6 = Object.freeze({major: 32, minor: 0});

export function packFormatForProtocol(protocol) {
  return Number(protocol) === 777 ? PACK_FORMAT_26_3 : PACK_FORMAT_1_20_6;
}

function asFormat(value) {
  if (Number.isInteger(value) && value >= 0) return {major: value, minor: 0};
  // PackFormat.fullCodec is ExtraCodecs.compactListCodec: [major] or [major, minor].
  if (Array.isArray(value) && (value.length === 1 || value.length === 2) && value.every(part => Number.isInteger(part) && part >= 0)) {
    return {major: value[0], minor: value[1] ?? 0};
  }
  if (value && typeof value === 'object' && Number.isInteger(value.major) && Number.isInteger(value.minor)) {
    return {major: value.major, minor: value.minor};
  }
  return null;
}

// IntermediaryFormat.packCodec maps a legacy InclusiveRange<Integer> to a range of
// PackFormat.of(value) (minor 0). min_format/max_format are already PackFormat values.
function packRange(pack) {
  if (!pack) return null;
  const min = asFormat(pack.minFormat), max = asFormat(pack.maxFormat);
  if (min && max) return {min, max};
  let supported = pack.supportedFormats;
  let a, b;
  if (Number.isInteger(supported)) a = b = supported;
  else if (Array.isArray(supported) && supported.length === 2) [a, b] = supported;
  else if (supported && typeof supported === 'object') ({min_inclusive: a, max_inclusive: b} = supported);
  if (Number.isInteger(a) && Number.isInteger(b) && a <= b) return {min: asFormat(a), max: asFormat(b)};
  const single = asFormat(pack.format);
  return single ? {min: single, max: single} : null;
}

function compare(a, b) {
  return a.major - b.major || a.minor - b.minor;
}

// Native values are TOO_OLD, TOO_NEW and COMPATIBLE; an absent/unknown range is treated as
// compatible because the selection screen only distinguishes the three incompatibility keys.
export function packCompatibility(pack, format = PACK_FORMAT_26_3) {
  const range = packRange(pack);
  if (!range) return 'compatible';
  const current = asFormat(format) ?? PACK_FORMAT_26_3;
  if (compare(range.max, current) < 0) return 'old';
  if (compare(current, range.min) < 0) return 'new';
  return 'compatible';
}
