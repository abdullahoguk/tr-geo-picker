// İkincil kaynak: OpenStreetMap (ODbL) admin_level=6 sınırları, Overpass API ile.
// Yalnızca geoBoundaries'te bulunamayan resmi ilçeler için çağrılır (ör. yeni kurulan ilçe).
import { cached, fetchRetry, log } from './lib/util.mjs';

export const OVERPASS_URL = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

async function overpass(query) {
  const res = await fetchRetry(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'tr-geo-picker data pipeline' },
    body: 'data=' + encodeURIComponent(query),
    timeout: 180_000,
  });
  return res.json();
}

const same = (a, b) => a[0] === b[0] && a[1] === b[1];

/** Way parçalarını kapalı halkalara birleştirir. */
function assembleRings(ways) {
  const parts = ways.map((w) => w.map((p) => [p.lon, p.lat]));
  const rings = [];
  while (parts.length) {
    let ring = parts.shift();
    let grew = true;
    while (!same(ring[0], ring[ring.length - 1]) && grew) {
      grew = false;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const end = ring[ring.length - 1];
        if (same(end, p[0])) ring = ring.concat(p.slice(1));
        else if (same(end, p[p.length - 1])) ring = ring.concat(p.slice(0, -1).reverse());
        else continue;
        parts.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (same(ring[0], ring[ring.length - 1]) && ring.length >= 4) rings.push(ring);
  }
  return rings;
}

function relationToGeometry(rel) {
  const role = (r) => rel.members.filter((m) => m.type === 'way' && (m.role || 'outer') === r && m.geometry).map((m) => m.geometry);
  const outers = assembleRings(role('outer'));
  const inners = assembleRings(role('inner'));
  if (!outers.length) return null;
  // İç halkaları basitçe ilk dış halkaya ata (ilçe sınırlarında iç halka nadirdir).
  const polys = outers.map((o, i) => (i === 0 ? [o, ...inners] : [o]));
  return polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys };
}

/**
 * @param {string} plaka
 * @param {(name: string) => string} keyOf  isim → eşleştirme anahtarı
 * @returns {Promise<Map<string, object>>} anahtar → GeoJSON Feature
 */
export async function fetchOsmDistricts(plaka) {
  const data = await cached(`osm-${plaka}.json`, async () => {
    log(`OSM: TR-${plaka} ilçe sınırları Overpass'tan çekiliyor`);
    return overpass(`[out:json][timeout:170];
area["ISO3166-2"="TR-${plaka}"]["admin_level"="4"]->.a;
rel(area.a)["boundary"="administrative"]["admin_level"="6"];
out geom;`);
  });
  return data.elements
    .filter((e) => e.type === 'relation')
    .map((rel) => ({
      type: 'Feature',
      properties: { shapeName: rel.tags?.name ?? '', osmId: rel.id, 'name:tr': rel.tags?.['name:tr'] },
      geometry: relationToGeometry(rel),
    }))
    .filter((f) => f.geometry);
}
