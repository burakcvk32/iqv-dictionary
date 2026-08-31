// Canonical group values for NEW records (rule: new writes should use these
// exact strings). Existing legacy data may contain spelling/case variants;
// those are handled by the normalizer below without touching stored data.
export const CANONICAL_GROUP_IQV_OS_AI = 'IQV OS AI';
export const CANONICAL_GROUP_INDUSTRIAL = 'Endüstriyel';

export type GroupKey = 'IQV_OS_AI' | 'INDUSTRIAL' | 'OTHER';

const stripDiacritics = (value: string): string =>
  value
    .replace(/[İI]/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u');

const simplify = (value: string): string =>
  stripDiacritics(value.toLowerCase()).replace(/[\s_-]+/g, '');

/**
 * Maps a raw `group` string (as it may exist in legacy Mongo data, e.g.
 * "iqv-os-ai", "IQVOSAI", "Industrial", "Endustriyel") to a canonical key.
 * Used only for read-side compatibility (filtering/duplicate matching) —
 * it never mutates stored documents.
 */
export const normalizeGroupKey = (raw?: string | null): GroupKey => {
  if (!raw) {
    return 'OTHER';
  }

  const simplified = simplify(raw);

  if (simplified === 'iqvosai') {
    return 'IQV_OS_AI';
  }

  if (simplified === 'endustriyel' || simplified === 'industrial') {
    return 'INDUSTRIAL';
  }

  return 'OTHER';
};

export const canonicalGroupLabel = (key: GroupKey, raw: string): string => {
  if (key === 'IQV_OS_AI') return CANONICAL_GROUP_IQV_OS_AI;
  if (key === 'INDUSTRIAL') return CANONICAL_GROUP_INDUSTRIAL;
  return raw.trim();
};

/** For NEW/updated records: normalizes known variants to their canonical
 * spelling, leaves unrecognized (future) group names as-is (trimmed). */
export const canonicalizeGroupForStorage = (raw: string): string =>
  canonicalGroupLabel(normalizeGroupKey(raw), raw);

/** Regex source (to embed in a Mongo/JS RegExp) matching any known spelling
 * variant of the given canonical group key, for read-side filtering against
 * legacy data that was never normalized. */
export const groupVariantPatternSource = (
  key: GroupKey,
  rawFallback: string,
): string => {
  if (key === 'IQV_OS_AI') {
    return '^\\s*iqv[\\s_-]*os[\\s_-]*ai\\s*$';
  }

  if (key === 'INDUSTRIAL') {
    return '^\\s*(end[uü]striyel|industrial)\\s*$';
  }

  const escaped = rawFallback.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `^\\s*${escaped}\\s*$`;
};

export const isIqvOsAiGroup = (raw?: string | null): boolean =>
  normalizeGroupKey(raw) === 'IQV_OS_AI';
