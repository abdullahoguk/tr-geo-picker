// Geometri: geoBoundaries gbOpen TUR ADM1/ADM2. Güncel indirme linki API'den çözülür.
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { CACHE, OFFLINE, fetchRetry, log } from './lib/util.mjs';

const API = (lvl) => `https://www.geoboundaries.org/api/current/gbOpen/TUR/${lvl}/`;

async function exists(f) {
  try {
    return (await stat(f)).size > 0;
  } catch {
    return false;
  }
}

/** @returns {Promise<{meta: object, geojson: object}>} */
export async function fetchGeoBoundaries(level) {
  const metaFile = join(CACHE, `gb-${level}.meta.json`);
  const geoFile = join(CACHE, `gb-${level}.geojson`);
  await mkdir(CACHE, { recursive: true });
  let meta;
  if (OFFLINE && (await exists(metaFile))) {
    meta = JSON.parse(await readFile(metaFile, 'utf8'));
  } else {
    meta = await (await fetchRetry(API(level))).json();
    meta.accessedAt = new Date().toISOString();
    const prev = (await exists(metaFile)) ? JSON.parse(await readFile(metaFile, 'utf8')) : null;
    if (prev?.gjDownloadURL !== meta.gjDownloadURL || !(await exists(geoFile))) {
      log(`geoBoundaries ${level} indiriliyor:`, meta.gjDownloadURL);
      const buf = Buffer.from(await (await fetchRetry(meta.gjDownloadURL, { timeout: 300_000 })).arrayBuffer());
      await writeFile(geoFile, buf);
    }
    await writeFile(metaFile, JSON.stringify(meta, null, 2));
  }
  if (!(await exists(geoFile))) throw new Error(`geoBoundaries ${level} önbellekte yok`);
  return { meta, geojson: JSON.parse(await readFile(geoFile, 'utf8')) };
}
