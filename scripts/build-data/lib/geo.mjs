import polylabel from 'polylabel';

/** Feature → polygon dizisi ([[ring, ...holes], ...]) */
export const polygonsOf = (geom) =>
  geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];

export function ringArea(r) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return a / 2;
}

export const largestPolygon = (geom) =>
  polygonsOf(geom).reduce((best, p) => (Math.abs(ringArea(p[0])) > Math.abs(ringArea(best?.[0] ?? [])) ? p : best), null);

/** En büyük poligonun "görsel merkezi" (polylabel). */
export function labelPoint(geom, precision) {
  const p = largestPolygon(geom);
  if (!p) return null;
  return polylabel(p, precision ?? 0.001);
}

function inRing([x, y], r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const inPolygon = (pt, poly) => inRing(pt, poly[0]) && !poly.slice(1).some((h) => inRing(pt, h));
export const inGeometry = (pt, geom) => polygonsOf(geom).some((p) => inPolygon(pt, p));

export function bbox(geom) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of polygonsOf(geom))
    for (const [x, y] of p[0]) {
      if (x < b[0]) b[0] = x;
      if (y < b[1]) b[1] = y;
      if (x > b[2]) b[2] = x;
      if (y > b[3]) b[3] = y;
    }
  return b;
}
