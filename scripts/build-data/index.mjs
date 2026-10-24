// `npm run data:build` — repodaki sources/ kopyasından data/ çıktısını üretir. Ağa çıkmaz.
// Kaynakları yenilemek için önce `npm run data:update`.
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA, HERE, log, readJSON, writeJSON } from './lib/util.mjs';
import { buildAll, prepare, PROJECTION, VIEW, BUDGET } from './build-geo.mjs';
import { runChecks, report } from './lib/checks.mjs';

const SRC = join(HERE, 'sources');
const official = await readJSON(join(SRC, 'official.json'));
const sources = await readJSON(join(SRC, 'sources.json'));
const regions = await readJSON(join(HERE, 'bolgeler.json'));
const unmatched = await readJSON(join(HERE, 'unmatched.json'));

if (unmatched.iller.length + unmatched.ilceler.length + unmatched.geometry.length) {
  console.error('[data] unmatched.json boş değil; build durduruldu.');
  process.exit(1);
}

// --- Katalog
const collator = new Intl.Collator('tr');
const builtAt = new Date();
const version = `${builtAt.getUTCFullYear()}.${String(builtAt.getUTCMonth() + 1).padStart(2, '0')}`;
const bolgeOf = new Map(regions.bolgeler.flatMap((b) => b.iller.map((p) => [p, b.id])));
const iller = official.iller
  .map((il) => ({ id: il.plaka, name: il.name, bolge: bolgeOf.get(il.plaka) }))
  .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
const known = new Set(iller.map((i) => i.id));
const strayPlaka = [...bolgeOf.keys()].filter((p) => !known.has(p));
if (strayPlaka.length) log(`uyarı: bolgeler.json resmi listede olmayan plaka içeriyor: ${strayPlaka}`);
const catalog = {
  version,
  bolgeler: regions.bolgeler.map((b) => ({
    id: b.id,
    name: b.name,
    iller: iller.filter((i) => i.bolge === b.id).map((i) => i.id),
  })),
  iller,
  ilceler: official.iller.flatMap((il) =>
    il.ilceler
      .map((c) => ({ id: c.code, name: c.name, il: il.plaka }))
      .sort((a, b) => collator.compare(a.name, b.name)),
  ),
};
catalog.ilceler.sort((a, b) => a.il.localeCompare(b.il, 'en', { numeric: true }) || collator.compare(a.name, b.name));

// --- Geometri
const topo = JSON.parse(await readFile(join(SRC, 'ilceler.topojson'), 'utf8'));
const ilceInfo = new Map(catalog.ilceler.map((c) => [c.id, { il: c.il, bolge: bolgeOf.get(c.il) }]));
log(`projeksiyon ve sadeleştirme (${topo.objects.ilceler.geometries.length} ilçe)…`);
const files = buildAll(prepare(topo), catalog, (id) => ilceInfo.get(id));

const geo = Object.fromEntries(Object.entries(files).map(([f, r]) => [f, r.svg]));
const sizes = Object.fromEntries(Object.entries(files).map(([f, r]) => [f, r.size]));

// --- Doğrulama
const checks = runChecks({ official, catalog, geo, sizes, unmatched });
log('doğrulama:');
const failed = report(checks);

// --- Yazım
await rm(join(DATA, 'geo'), { recursive: true, force: true });
await writeJSON(join(DATA, 'catalog.json'), catalog, false);
for (const [f, svg] of Object.entries(geo)) await writeJSON(join(DATA, f), svg, false);

const max = (prefix) => Math.max(...Object.entries(sizes).filter(([f]) => f.startsWith(prefix)).map(([, n]) => n));
const meta = {
  name: 'tr-geo-picker data',
  version,
  generatedAt: builtAt.toISOString(),
  counts: {
    bolge: catalog.bolgeler.length,
    il: catalog.iller.length,
    ilce: catalog.ilceler.length,
    perBolge: Object.fromEntries(catalog.bolgeler.map((b) => [b.id, b.iller.length])),
  },
  officialSummary: official.summary,
  sources: {
    official: { ...sources.official, note: 'İl/ilçe isimleri ve kodları (otorite). İlçe id = e-İçişleri ilçe kodu, il id = plaka.' },
    geometry: sources.geometry,
    osm: sources.osm,
    regions: { file: 'scripts/build-data/bolgeler.json', source: regions.source },
    sourcesUpdatedAt: sources.updatedAt,
  },
  license: {
    code: 'MIT',
    data: 'ODbL 1.0 (geometri OpenStreetMap türevidir)',
    attribution:
      'Sınır geometrisi: geoBoundaries (www.geoboundaries.org), kaynak verisi © OpenStreetMap katkıda bulunanlar, ODbL 1.0 (openstreetmap.org/copyright). İl/ilçe listesi: T.C. İçişleri Bakanlığı e-İçişleri.',
  },
  processing: {
    tool: 'topojson-client / topojson-simplify',
    projection: PROJECTION,
    viewBoxLongSide: VIEW,
    simplify: 'topology-aware (Visvalingam), dosya başına bütçeye göre aralık',
    budgets: BUDGET,
  },
  files: {
    catalog: Buffer.byteLength(JSON.stringify(catalog)),
    turkiye: sizes['geo/turkiye.json'],
    bolgeMax: max('geo/bolge/'),
    ilMax: max('geo/il/'),
    total: Object.values(sizes).reduce((a, b) => a + b, 0),
  },
  checks,
  warnings: sources.warnings,
};
await writeJSON(join(DATA, 'meta.json'), meta);
log(`data/ yazıldı (sürüm ${version})`);
if (failed) {
  console.error(`[data] ${failed} doğrulama başarısız`);
  process.exit(1);
}
