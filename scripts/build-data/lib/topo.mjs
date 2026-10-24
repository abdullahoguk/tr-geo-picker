// TopoJSON yardımcıları: delta/quantize çözme, projeksiyon, topoloji korumalı sadeleştirme filtresi.

/** Quantize edilmiş topolojinin arc'larını mutlak koordinata çevirip her noktaya fn uygular. */
export function mapArcs(topology, fn) {
  const t = topology.transform;
  const arcs = topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map((p) => {
      if (t) {
        x += p[0];
        y += p[1];
        return fn([x * t.scale[0] + t.translate[0], y * t.scale[1] + t.translate[1]]);
      }
      return fn(p);
    });
  });
  const { transform, bbox, ...rest } = topology;
  return { ...rest, arcs };
}

/**
 * Lambert konform konik (küresel, d3.geoConicConformal ile aynı formül). Çıktı metre, y kuzeye.
 * @returns {(p: [number, number]) => [number, number]}
 */
export function lambertConformalConic({ lat1, lat2, lat0, lon0, R = 6371008.8 }) {
  const rad = Math.PI / 180;
  const p1 = lat1 * rad;
  const p2 = lat2 * rad;
  const tany = (p) => Math.tan(Math.PI / 4 + p / 2);
  const n = Math.log(Math.cos(p1) / Math.cos(p2)) / Math.log(tany(p2) / tany(p1));
  const F = (Math.cos(p1) * Math.pow(tany(p1), n)) / n;
  const rho = (p) => F / Math.pow(tany(p), n);
  const rho0 = rho(lat0 * rad);
  return ([lon, lat]) => {
    const r = rho(lat * rad);
    const a = n * (lon - lon0) * rad;
    return [R * r * Math.sin(a), R * (rho0 - r * Math.cos(a))];
  };
}

/**
 * presimplify edilmiş (z ağırlıklı) arc'ları eşik ile süzer. Kapalı tek-arc halkalar
 * (adacıklar) için en ağır 3 iç nokta her zaman tutulur, böylece şekil yok olmaz.
 */
export function simplifyArcs(presimplified, minWeight) {
  const arcs = presimplified.arcs.map((arc) => {
    const kept = arc.filter((p) => p[2] >= minWeight);
    const first = arc[0];
    const last = arc[arc.length - 1];
    if (kept.length < 5 && first[0] === last[0] && first[1] === last[1] && arc.length > 4) {
      const inner = arc.slice(1, -1).map((p, i) => [p[2], i + 1]);
      inner.sort((a, b) => b[0] - a[0]);
      const idx = new Set(inner.slice(0, 3).map(([, i]) => i));
      return arc.filter((p, i) => i === 0 || i === arc.length - 1 || idx.has(i)).map((p) => [p[0], p[1]]);
    }
    return kept.map((p) => [p[0], p[1]]);
  });
  return { ...presimplified, arcs };
}
