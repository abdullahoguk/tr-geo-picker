// Ortak doğrulamalar. Sayılar hiçbir yerde sabit yazılmaz; resmi kopyadan (sources/official.json) türetilir.
import { BUDGET } from '../build-geo.mjs';

/**
 * @param {object} p
 * @param {object} p.official       sources/official.json
 * @param {object} p.catalog        catalog.json
 * @param {Record<string, {viewBox: string, items: {id: string}[]}>} p.geo  'geo/...' → dosya içeriği
 * @param {Record<string, number>} p.sizes  'geo/...' → bayt
 * @param {object} p.unmatched      unmatched.json
 * @returns {{ id: string, ok: boolean, level: 'error'|'warn', detail?: string }[]}
 */
export function runChecks({ official, catalog, geo, sizes, unmatched }) {
  const res = [];
  const check = (id, ok, detail, level = 'error') => res.push({ id, ok: !!ok, level, ...(ok ? {} : { detail }) });
  const dupes = (arr) => [...new Set(arr.filter((x, i) => arr.indexOf(x) !== i))];

  const um = unmatched.iller.length + unmatched.ilceler.length + unmatched.geometry.length;
  check('unmatched-empty', um === 0, `${um} eşleşmeyen kayıt (scripts/build-data/unmatched.json)`);

  // Sayılar resmi listeyle tutarlı
  const offIl = official.iller.length;
  const offIlce = official.iller.reduce((n, il) => n + il.ilceler.length, 0);
  check('il-count-matches-official', catalog.iller.length === offIl, `katalog ${catalog.iller.length} ≠ resmi ${offIl}`);
  check('ilce-count-matches-official', catalog.ilceler.length === offIlce, `katalog ${catalog.ilceler.length} ≠ resmi ${offIlce}`);
  const s = official.summary ?? {};
  if (s.Il != null) check('official-summary-il', s.Il === offIl, `sayfa özeti ${s.Il} ≠ liste ${offIl}`, 'warn');
  if (s.Ilce != null && s.IlBelediye != null)
    check('official-summary-ilce', s.Ilce + s.IlBelediye === offIlce, `sayfa özeti ${s.Ilce}+${s.IlBelediye} ≠ liste ${offIlce}`, 'warn');

  // Benzersiz id'ler (tüm seviyeler birlikte de çakışmamalı)
  const bIds = catalog.bolgeler.map((b) => b.id);
  const iIds = catalog.iller.map((i) => i.id);
  const cIds = catalog.ilceler.map((c) => c.id);
  check('unique-bolge-ids', !dupes(bIds).length, dupes(bIds).join(','));
  check('unique-il-ids', !dupes(iIds).length, dupes(iIds).join(','));
  check('unique-ilce-ids', !dupes(cIds).length, dupes(cIds).join(','));
  check('ids-are-strings', [...bIds, ...iIds, ...cIds].every((x) => typeof x === 'string' && x), 'string olmayan id');

  // Hiyerarşi
  const bSet = new Set(bIds);
  const iSet = new Set(iIds);
  const noBolge = catalog.iller.filter((i) => !bSet.has(i.bolge)).map((i) => i.id);
  check('every-il-has-bolge', !noBolge.length, `bölgesiz il: ${noBolge.join(',')} (bolgeler.json'a ekleyin)`);
  const noIl = catalog.ilceler.filter((c) => !iSet.has(c.il)).map((c) => c.id);
  check('every-ilce-has-il', !noIl.length, `ilsiz ilçe: ${noIl.join(',')}`);
  const bolgeListOk = catalog.bolgeler.every((b) => b.iller.every((id) => catalog.iller.find((i) => i.id === id)?.bolge === b.id));
  check('bolge-il-lists-consistent', bolgeListOk && catalog.bolgeler.reduce((n, b) => n + b.iller.length, 0) === catalog.iller.length, 'bölge.iller ile il.bolge uyuşmuyor');
  const emptyIl = catalog.iller.filter((i) => !catalog.ilceler.some((c) => c.il === i.id)).map((i) => i.id);
  check('every-il-has-ilce', !emptyIl.length, `ilçesiz il: ${emptyIl.join(',')}`);

  // Her katalog öğesinin geometrisi var (ve fazlası yok)
  const ids = (file) => new Set((geo[file]?.items ?? []).map((x) => x.id));
  const same = (file, expected) => {
    const got = ids(file);
    const missing = expected.filter((x) => !got.has(x));
    const extra = [...got].filter((x) => !expected.includes(x));
    return { ok: geo[file] && !missing.length && !extra.length, detail: `${file}: eksik [${missing}] fazla [${extra}]` };
  };
  const geoErrors = [];
  const t = same('geo/turkiye.json', bIds);
  if (!t.ok) geoErrors.push(t.detail);
  for (const b of catalog.bolgeler) {
    const r = same(`geo/bolge/${b.id}.json`, b.iller);
    if (!r.ok) geoErrors.push(r.detail);
  }
  for (const il of catalog.iller) {
    const r = same(`geo/il/${il.id}.json`, catalog.ilceler.filter((c) => c.il === il.id).map((c) => c.id));
    if (!r.ok) geoErrors.push(r.detail);
  }
  check('every-item-has-geometry', !geoErrors.length, geoErrors.slice(0, 10).join(' | '));
  const emptyPath = Object.entries(geo).flatMap(([f, g]) => g.items.filter((x) => !/^M/.test(x.d)).map((x) => `${f}#${x.id}`));
  check('no-empty-paths', !emptyPath.length, emptyPath.join(','));

  // Boyut bütçeleri (gzip öncesi)
  const over = Object.entries(sizes).filter(([f, n]) => n > BUDGET[f.startsWith('geo/il/') ? 'il' : f.startsWith('geo/bolge/') ? 'bolge' : 'turkiye']);
  check('size-budgets', !over.length, over.map(([f, n]) => `${f}=${n}`).join(', '));

  return res;
}

export function report(results) {
  let failed = 0;
  for (const r of results) {
    const mark = r.ok ? '✓' : r.level === 'warn' ? '!' : '✗';
    if (!r.ok && r.level === 'error') failed++;
    console.log(`  ${mark} ${r.id}${r.ok ? '' : ' — ' + r.detail}`);
  }
  return failed;
}
