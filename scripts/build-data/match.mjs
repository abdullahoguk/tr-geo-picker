// Resmi liste ↔ geometri eşleştirme. İl: geoBoundaries ADM1 shapeISO (TR-xx).
// İlçe: ADM2 öğesinin temsil noktası hangi il poligonundaysa o il içinde, normalize isimle eşleşir.
import { join } from 'node:path';
import { HERE, readJSON, log } from './lib/util.mjs';
import { normalize } from './lib/tr.mjs';
import { bbox, inGeometry, labelPoint } from './lib/geo.mjs';
import { fetchOsmDistricts } from './fetch-osm.mjs';

/** "Çanakkale merkez", "Osmaniye (merkez)", "Rize merkezi", "Afyonkarahisar (Merkez İlçe)", "Gediz Merkez" */
function districtKey(name, ilName) {
  const n = name
    .toLocaleLowerCase('tr')
    .replace(/[()]/g, ' ')
    .replace(/\s+(district|ilçesi)\s*$/u, '');
  if (normalize(n) === normalize(ilName)) return 'merkez';
  const stripped = n.replace(/\bmerkez(i|\s+ilçe)?\b/gu, ' ').trim();
  if (stripped !== n.trim()) {
    const rest = normalize(stripped);
    if (!rest || rest === normalize(ilName)) return 'merkez';
    return rest;
  }
  return normalize(name);
}

/**
 * @param {object} official   fetch-official çıktısı
 * @param {object} adm1       geoBoundaries ADM1 GeoJSON
 * @param {object} adm2       geoBoundaries ADM2 GeoJSON
 * @returns {{ ilGeom: Map<string, object>, ilceGeom: Map<string, object>, unmatched: object, warnings: string[] }}
 */
export async function match(official, adm1, adm2) {
  const aliases = (await readJSON(join(HERE, 'aliases.json'))).ilce;
  const warnings = [];
  const unmatched = { iller: [], ilceler: [], geometry: [] };

  // --- İller
  const ilByPlaka = new Map(official.iller.map((il) => [il.plaka, il]));
  const ilGeom = new Map();
  for (const f of adm1.features) {
    const plaka = (f.properties.shapeISO || '').replace(/^TR-/, '');
    const il = ilByPlaka.get(plaka);
    if (!il) {
      unmatched.geometry.push({ level: 'il', source: 'geoBoundaries ADM1', name: f.properties.shapeName, iso: f.properties.shapeISO });
      continue;
    }
    if (normalize(f.properties.shapeName) !== normalize(il.name))
      warnings.push(`il adı farklı: ${plaka} resmi="${il.name}" geometri="${f.properties.shapeName}"`);
    ilGeom.set(plaka, f);
  }
  for (const il of official.iller) if (!ilGeom.has(il.plaka)) unmatched.iller.push({ plaka: il.plaka, name: il.name });

  // --- İlçe → il (nokta-poligon)
  const ilBoxes = [...ilGeom].map(([plaka, f]) => ({ plaka, f, b: bbox(f.geometry) }));
  const findIl = (pt) =>
    ilBoxes.find(({ b, f }) => pt[0] >= b[0] && pt[0] <= b[2] && pt[1] >= b[1] && pt[1] <= b[3] && inGeometry(pt, f.geometry))?.plaka;

  const byIl = new Map(); // plaka -> Map(key -> feature[])
  for (const f of adm2.features) {
    const pt = labelPoint(f.geometry);
    const plaka = pt && findIl(pt);
    if (!plaka) {
      unmatched.geometry.push({ level: 'ilce', source: 'geoBoundaries ADM2', name: f.properties.shapeName, reason: 'il poligonu bulunamadı', point: pt });
      continue;
    }
    const il = ilByPlaka.get(plaka);
    const alias = aliases[`${plaka}:${f.properties.shapeName}`];
    const key = alias ? districtKey(alias, il.name) : districtKey(f.properties.shapeName, il.name);
    if (!byIl.has(plaka)) byIl.set(plaka, new Map());
    const m = byIl.get(plaka);
    m.set(key, [...(m.get(key) ?? []), f]);
  }

  // --- İlçe isim eşleşmesi
  const ilceGeom = new Map();
  for (const il of official.iller) {
    const pool = byIl.get(il.plaka) ?? new Map();
    for (const ilce of il.ilceler) {
      const key = districtKey(ilce.name, il.name);
      const hits = pool.get(key);
      if (!hits) {
        unmatched.ilceler.push({ il: il.plaka, ilName: il.name, id: ilce.code, name: ilce.name });
        continue;
      }
      if (hits.length > 1) warnings.push(`${il.name}/${ilce.name}: ${hits.length} geometri parçası birleştirildi`);
      ilceGeom.set(ilce.code, { il: il.plaka, features: hits, source: 'geoBoundaries' });
      pool.delete(key);
    }
    for (const [, feats] of pool)
      for (const f of feats)
        unmatched.geometry.push({ level: 'ilce', source: 'geoBoundaries ADM2', il: il.plaka, ilName: il.name, name: f.properties.shapeName });
  }

  // --- İkincil kaynak: geoBoundaries'te olmayan resmi ilçeler OSM'den tamamlanır
  const missingByIl = Map.groupBy(unmatched.ilceler, (u) => u.il);
  for (const [plaka, missing] of missingByIl) {
    const il = ilByPlaka.get(plaka);
    let osm;
    try {
      osm = await fetchOsmDistricts(plaka);
    } catch (err) {
      warnings.push(`OSM yedeği başarısız (${il.name}): ${err.message}`);
      continue;
    }
    for (const u of missing) {
      const key = districtKey(u.name, il.name);
      const hits = osm.filter((f) => [f.properties.shapeName, f.properties['name:tr']].some((n) => n && districtKey(n, il.name) === key));
      if (!hits.length) continue;
      ilceGeom.set(u.id, { il: plaka, features: hits, source: 'osm' });
      unmatched.ilceler.splice(unmatched.ilceler.indexOf(u), 1);
      warnings.push(`${il.name}/${u.name}: geometri OSM'den alındı (komşu ilçelerle topoloji paylaşmaz, kontrol edin)`);
    }
  }

  log(`eşleşen il: ${ilGeom.size}, ilçe: ${ilceGeom.size}; eşleşmeyen resmi ilçe: ${unmatched.ilceler.length}, artık geometri: ${unmatched.geometry.length}`);
  return { ilGeom, ilceGeom, unmatched, warnings };
}
