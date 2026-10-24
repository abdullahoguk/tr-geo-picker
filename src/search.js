const FOLD = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

/**
 * Türkçe normalize: "İSTANBUL" → "istanbul", "Iğdır" → "igdir".
 * @param {string} s
 */
export const normalize = (s) =>
  String(s)
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşüâîû]/g, (c) => FOLD[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * @typedef {{ level: 'bolge'|'il'|'ilce', id: string, name: string, sub?: string, key: string }} SearchEntry
 */

/**
 * @param {SearchEntry[]} entries
 * @param {string} query
 * @param {number} [limit]
 * @returns {SearchEntry[]}
 */
export function search(entries, query, limit = 8) {
  const q = normalize(query).trim();
  if (!q) return [];
  const scored = [];
  for (const e of entries) {
    const i = e.key.indexOf(q);
    if (i < 0) continue;
    // Başta eşleşme > kelime başı > içerde; il > ilçe > bölge
    const score = (i === 0 ? 0 : e.key[i - 1] === ' ' ? 1 : 2) * 3 + (e.level === 'il' ? 0 : e.level === 'ilce' ? 1 : 2);
    scored.push([score, e]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name, 'tr'));
  return scored.slice(0, limit).map((x) => x[1]);
}
