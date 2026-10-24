import { DEFAULT_DATA_URL } from './constants.js';

/**
 * @typedef {{ id: string, name: string, value?: string }} BaseItem
 * @typedef {BaseItem & { iller: string[] }} Bolge
 * @typedef {BaseItem & { bolge: string }} Il
 * @typedef {BaseItem & { il: string }} Ilce
 * @typedef {{ version?: string, bolgeler: Bolge[], iller: Il[], ilceler: Ilce[] }} Catalog
 * @typedef {{ id: string, d: string, cx: number, cy: number }} GeoItem
 * @typedef {{ viewBox: string, items: GeoItem[] }} Geo
 * @typedef {'catalog'|'turkiye'|'bolge'|'il'} DataLevel
 * @typedef {(level: DataLevel, id?: string) => (unknown | Promise<unknown>)} DataProvider
 */

/** URL → Promise önbelleği (aynı sayfadaki tüm örnekler paylaşır). */
const cache = new Map();

/** @param {string} url */
function getJSON(url) {
  if (!cache.has(url)) {
    const p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
      return r.json();
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return cache.get(url);
}

/** @param {DataLevel} level @param {string} [id] */
const pathOf = (level, id) =>
  level === 'catalog' ? 'catalog.json' : level === 'turkiye' ? 'geo/turkiye.json' : `geo/${level}/${encodeURIComponent(id || '')}.json`;

/**
 * Öncelik: dataProvider → data (yalnız katalog) → data-src → paketle gelen veri.
 * dataProvider null/undefined döndürürse zincirin devamına düşülür.
 * @param {{ dataProvider?: DataProvider | null, data?: Catalog | null, dataSrc?: string | null }} src
 * @param {DataLevel} level
 * @param {string} [id]
 */
export async function load(src, level, id) {
  if (src.dataProvider) {
    const r = await src.dataProvider(level, id);
    if (r != null) return r;
  }
  if (level === 'catalog' && src.data) return src.data;
  let base = src.dataSrc || DEFAULT_DATA_URL;
  if (!base.endsWith('/')) base += '/';
  return getJSON(new URL(pathOf(level, id), new URL(base, document.baseURI)).href);
}
