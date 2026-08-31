// Escapes a user-supplied string so it can be safely embedded in a RegExp
// without being interpreted as regex syntax (prevents ReDoS / NoSQL-injection
// via crafted regex metacharacters in search/filter input).
export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Turkish letters whose upper/lower forms do not fold correctly with a plain
// case-insensitive JS/Mongo regex (dotted/dotless I, and the other Turkish
// diacritics). We expand each such character into an explicit character
// class so search/duplicate-matching behaves correctly for Turkish text.
const TURKISH_CASE_CLASSES: Record<string, string> = {
  i: '[iİ]',
  İ: '[iİ]',
  ı: '[ıI]',
  I: '[ıI]',
  ç: '[çÇ]',
  Ç: '[çÇ]',
  ğ: '[ğĞ]',
  Ğ: '[ğĞ]',
  ö: '[öÖ]',
  Ö: '[öÖ]',
  ş: '[şŞ]',
  Ş: '[şŞ]',
  ü: '[üÜ]',
  Ü: '[üÜ]',
};

// Builds a case-insensitive, Turkish-character-aware regex source string
// from raw user input. Escapes regex metacharacters first, then expands
// Turkish letters into explicit character classes; the 'i' flag handles the
// rest (plain ASCII) case-insensitively.
export const buildTurkishInsensitivePattern = (raw: string): string => {
  let result = '';

  for (const char of raw) {
    if (TURKISH_CASE_CLASSES[char]) {
      result += TURKISH_CASE_CLASSES[char];
    } else if (/[.*+?^${}()|[\]\\]/.test(char)) {
      result += `\\${char}`;
    } else {
      result += char;
    }
  }

  return result;
};

export const buildSearchRegex = (raw: string): RegExp =>
  new RegExp(buildTurkishInsensitivePattern(raw.trim()), 'i');

export const buildExactInsensitiveRegex = (raw: string): RegExp =>
  new RegExp(`^${buildTurkishInsensitivePattern(raw.trim())}$`, 'i');

// Turkish-aware lowercase, used for in-app equality comparisons (duplicate
// checks) where a plain .toLowerCase() would mishandle İ/I/ı.
export const turkishLower = (raw: string): string =>
  raw.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
