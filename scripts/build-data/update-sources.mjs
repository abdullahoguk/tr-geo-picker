// `npm run data:update` — kaynakları internetten çekip repodaki sources/ kopyasını yeniler.
// Bu adım ara sıra elle çalıştırılır; `data:build` yalnızca sources/ klasörünü okur, ağa çıkmaz.
//
//   1. Resmi il/ilçe listesi  → e-İçişleri (fetch-official.mjs)
//   2. İlçe geometrisi            → geoBoundaries TUR ADM1/ADM2, eksikler için OSM Overpass
//   3. Eşleştirme             → match.mjs; eşleşmeyenler unmatched.json'a, boş değilse hata
//   4. sources/official.json, sources/ilceler.topojson, sources/sources.json yazılır
import { topology } from 'topojson-server';
import { presimplify, sphericalTriangleArea } from 'topojson-simplify';
import { quantize } from 'topojson-client';
import { simplifyArcs } from './lib/topo.mjs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HERE, log, writeJSON } from './lib/util.mjs';
import { fetchOfficial } from './fetch-official.mjs';
import { fetchGeoBoundaries } from './fetch-geo.mjs';
import { OVERPASS_URL } from './fetch-osm.mjs';
import { match } from './match.mjs';

const SNAPSHOT_SIMPLIFY_M = 15; // kaynak kopyası için hafif sadeleştirme (metre)
const SRC = join(HERE, 'sources');

const official = await fetchOfficial();
const adm1 = await fetchGeoBoundaries('ADM1');
const adm2 = await fetchGeoBoundaries('ADM2');
const { ilceGeom, unmatched, warnings } = await match(official, adm1.geojson, adm2.geojson);

await writeJSON(join(HERE, 'unmatched.json'), unmatched);
for (const w of warnings) log('uyarı:', w);
const unmatchedCount = unmatched.iller.length + unmatched.ilceler.length + unmatched.geometry.length;
if (unmatchedCount) {
  console.error(`[data] ${unmatchedCount} eşleşmeyen kayıt var → scripts/build-data/unmatched.json. aliases.json'u güncelleyip tekrar çalıştırın.`);
  process.exit(1);
}

const parts = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const features = [...ilceGeom].map(([id, g]) => ({
  type: 'Feature',
  properties: { id, il: g.il, src: g.source },
  geometry:
    g.features.length === 1 ? g.features[0].geometry : { type: 'MultiPolygon', coordinates: g.features.flatMap((f) => parts(f.geometry)) },
}));
// Topoloji (komşu ilçeler ortak arc paylaşır) → hafif sadeleştirme → 1e6 quantize
const R = 6371008.8;
const minArea = (SNAPSHOT_SIMPLIFY_M / R) ** 2 / 2; // küresel üçgen alanı (sr), ~aralık²/2
const topo = topology({ ilceler: { type: 'FeatureCollection', features } });
const snap = quantize(simplifyArcs(presimplify(topo, sphericalTriangleArea), minArea), 1e6);
const out = JSON.stringify(snap);
await writeFile(join(SRC, 'ilceler.topojson'), out);

await writeJSON(join(SRC, 'official.json'), {
  source: official.source,
  accessedAt: official.accessedAt,
  summary: official.summary,
  iller: official.iller.map((il) => ({
    plaka: il.plaka,
    name: il.name,
    rawName: il.rawName,
    ilceler: il.ilceler.map(({ code, name, rawName }) => ({ code, name, rawName })),
  })),
});

const gb = (m) => ({
  boundaryID: m.boundaryID,
  year: m.boundaryYearRepresented,
  upstream: m.boundarySource,
  upstreamLicense: m.boundaryLicense,
  sourceDataUpdateDate: m.sourceDataUpdateDate,
  url: m.gjDownloadURL,
  accessedAt: m.accessedAt,
});
const osmIds = features.filter((f) => f.properties.src === 'osm').map((f) => f.properties.id);
await writeJSON(join(SRC, 'sources.json'), {
  updatedAt: new Date().toISOString(),
  official: {
    name: 'T.C. İçişleri Bakanlığı — e-İçişleri Mülki İdari Bölümler',
    url: official.source,
    accessedAt: official.accessedAt,
  },
  geometry: {
    name: 'geoBoundaries gbOpen TUR',
    homepage: 'https://www.geoboundaries.org',
    adm1: gb(adm1.meta),
    adm2: gb(adm2.meta),
    snapshotSimplifyMeters: SNAPSHOT_SIMPLIFY_M,
  },
  osm: { url: OVERPASS_URL, license: 'ODbL 1.0', usedFor: osmIds },
  warnings,
});
log(`sources/ güncellendi: ${features.length} ilçe geometrisi (${(out.length / 1e6).toFixed(2)} MB), OSM'den: ${osmIds.length}`);
