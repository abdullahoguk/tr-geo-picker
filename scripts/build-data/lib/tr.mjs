// Türkçe metin yardımcıları (build tarafı). Runtime'daki src/search.js ile aynı kurala uyar.

const FOLD = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

/** Eşleştirme anahtarı: tr küçük harf, aksan katlama, yalnız [a-z0-9]. */
export function normalize(s) {
  return String(s)
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşüâîû]/g, (c) => FOLD[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

/** "AFYONKARAHİSAR" → "Afyonkarahisar", "19 MAYIS" → "19 Mayıs" */
export function titleCase(s) {
  return String(s)
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s\-(/])(\p{L})/gu, (_, p, c) => p + c.toLocaleUpperCase('tr'));
}

/** ASCII slug: "İç Anadolu" → "ic-anadolu" */
export function slug(s) {
  return String(s)
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşüâîû]/g, (c) => FOLD[c])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
