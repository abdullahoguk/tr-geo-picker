// Geometri üretimi: kaynak topolojisi projekte edilir, topoloji korumalı (Visvalingam) sadeleştirilir,
// il/bölge sınırları ilçe arc'larının birleştirilmesiyle (dissolve) üretilir; böylece sınırlar birebir örtüşür.
// Her dosya kendi viewBox'una fit edilmiş SVG path'lere çevrilir.
import polylabel from 'polylabel';
import { feature, mergeArcs } from 'topojson-client';
import { presimplify } from 'topojson-simplify';
import { log } from './lib/util.mjs';
import { polygonsOf, ringArea } from './lib/geo.mjs';
import { lambertConformalConic, mapArcs, simplifyArcs } from './lib/topo.mjs';

/** Türkiye için Lambert konform konik (standart paraleller 37°K / 41°K). */
export const PROJECTION = { name: 'Lambert Conformal Conic (spherical)', lat1: 37, lat2: 41, lat0: 39, lon0: 35 };
export const VIEW = 1000; // uzun kenar (viewBox birimi)
const PAD = 8; // viewBox kenar boşluğu
const MIN_PART_AREA = 0.6; // viewBox birim²; daha küçük adacıklar/delikler atılır (tek parça hariç)

export const BUDGET = { turkiye: 60_000, bolge: 80_000, il: 40_000 };

const fmt = (n) => (Math.round(n * 10) / 10).toString().replace(/^(-?)0\./, '$1.');

/** GeoJSON (projekte, y yukarı) → viewBox'a fit edilmiş SVG path öğeleri. */
function toSvg(features, b) {
  const w = b[2] - b[0];
  const h = b[3] - b[1];
  const k = (VIEW - 2 * PAD) / Math.max(w, h);
  const W = Math.round(w * k + 2 * PAD);
  const H = Math.round(h * k + 2 * PAD);
  const tx = ([x, y]) => [Math.round(((x - b[0]) * k + PAD) * 10) / 10, Math.round(((b[3] - y) * k + PAD) * 10) / 10];

  const items = features.map((f) => {
    let polys = polygonsOf(f.geometry).map((p) => p.map((r) => r.map(tx)));
    polys.sort((a, c) => Math.abs(ringArea(c[0])) - Math.abs(ringArea(a[0])));
    polys = polys
      .filter((p, i) => i === 0 || Math.abs(ringArea(p[0])) >= MIN_PART_AREA)
      .map((p) => [p[0], ...p.slice(1).filter((r) => Math.abs(ringArea(r)) >= MIN_PART_AREA)]);
    let d = '';
    for (const p of polys)
      for (const ring of p) {
        const pts = ring.slice(0, -1).filter((pt, i, a) => i === 0 || pt[0] !== a[i - 1][0] || pt[1] !== a[i - 1][1]);
        if (pts.length < 3) continue;
        d += `M${fmt(pts[0][0])} ${fmt(pts[0][1])}l`;
        for (let i = 1; i < pts.length; i++) {
          const dx = fmt(pts[i][0] - pts[i - 1][0]);
          const dy = fmt(pts[i][1] - pts[i - 1][1]);
          d += (i === 1 || dx[0] === '-' ? '' : ' ') + dx + (dy[0] === '-' ? '' : ' ') + dy;
        }
        d += 'z';
      }
    const [cx, cy] = polylabel(polys[0], 0.5);
    return { id: String(f.id), d, cx: Math.round(cx), cy: Math.round(cy) };
  });
  return { viewBox: `0 0 ${W} ${H}`, items };
}

function bboxOf(features) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of features)
    for (const p of polygonsOf(f.geometry))
      for (const [x, y] of p[0]) {
        if (x < b[0]) b[0] = x;
        if (y < b[1]) b[1] = y;
        if (x > b[2]) b[2] = x;
        if (y > b[3]) b[3] = y;
      }
  return b;
}

/**
 * Kaynak topolojisini projekte eder ve bir kez presimplify eder (ağırlıklar arc'a özgüdür, dosyadan bağımsız).
 * @param {object} topo  sources/ilceler.topojson (lon/lat, quantize)
 */
export function prepare(topo) {
  const project = lambertConformalConic(PROJECTION);
  return presimplify(mapArcs(topo, project));
}

/**
 * Bir dosya üretir; bütçeyi aşarsa sadeleştirme eşiğini büyüterek tekrar dener.
 * @param {object} pre      prepare() çıktısı
 * @param {object[]} geoms  topoloji geometri nesneleri ({ id, type, arcs })
 * @param {number} budget   bayt (gzip öncesi)
 */
function buildFile(pre, geoms, budget) {
  const full = { ...pre, objects: { x: { type: 'GeometryCollection', geometries: geoms } } };
  const b = bboxOf(feature(full, full.objects.x).features);
  const unit = Math.max(b[2] - b[0], b[3] - b[1]) / VIEW; // 1 viewBox birimi kaç metre
  let minArea = (unit * 0.35) ** 2;
  for (let attempt = 0; attempt < 16; attempt++) {
    const t = simplifyArcs(full, minArea);
    const svg = toSvg(feature(t, t.objects.x).features, b);
    const size = Buffer.byteLength(JSON.stringify(svg));
    if (size <= budget * 0.97) return { svg, size };
    minArea *= 1.6;
  }
  throw new Error(`bütçe aşılıyor: ${budget} B`);
}

/** Aynı gruptaki ilçe geometrilerini ortak arc'ları atarak birleştirir. */
function dissolve(pre, geoms, key) {
  const groups = Map.groupBy(geoms, (g) => g.properties[key]);
  return [...groups].map(([id, gs]) => ({ ...mergeArcs(pre, gs), id }));
}

/**
 * @param {object} pre  prepare() çıktısı
 * @param {{bolgeler: {id: string}[], iller: {id: string}[]}} catalog
 * @param {(id: string) => {il: string, bolge: string} | undefined} lookup  ilçe id → hiyerarşi
 */
export function buildAll(pre, catalog, lookup) {
  const ilceler = pre.objects.ilceler.geometries
    .map((g) => ({ ...g, id: g.properties.id, properties: { id: g.properties.id, ...lookup(g.properties.id) } }))
    .filter((g) => g.properties.il && g.properties.bolge);
  const files = {};
  files['geo/turkiye.json'] = buildFile(pre, dissolve(pre, ilceler, 'bolge'), BUDGET.turkiye);
  log(`turkiye.json ${files['geo/turkiye.json'].size} B`);
  for (const b of catalog.bolgeler)
    files[`geo/bolge/${b.id}.json`] = buildFile(pre, dissolve(pre, ilceler.filter((g) => g.properties.bolge === b.id), 'il'), BUDGET.bolge);
  log(`bölge dosyaları: ${catalog.bolgeler.length}`);
  for (const il of catalog.iller)
    files[`geo/il/${il.id}.json`] = buildFile(pre, ilceler.filter((g) => g.properties.il === il.id), BUDGET.il);
  log(`il dosyaları: ${catalog.iller.length}`);
  return files;
}
