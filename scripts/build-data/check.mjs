// `npm run data:check` — data/ çıktısını ve sources/ kopyasını yalnızca doğrular (yazmaz, ağa çıkmaz).
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA, HERE, readJSON } from './lib/util.mjs';
import { runChecks, report } from './lib/checks.mjs';

const official = await readJSON(join(HERE, 'sources', 'official.json'));
const unmatched = await readJSON(join(HERE, 'unmatched.json'));
const catalog = await readJSON(join(DATA, 'catalog.json'));
const meta = await readJSON(join(DATA, 'meta.json'));

const geo = {};
const sizes = {};
for (const sub of ['', 'bolge/', 'il/']) {
  for (const f of await readdir(join(DATA, 'geo', sub))) {
    if (!f.endsWith('.json')) continue;
    const key = `geo/${sub}${f}`;
    geo[key] = await readJSON(join(DATA, key));
    sizes[key] = (await stat(join(DATA, key))).size;
  }
}

const checks = runChecks({ official, catalog, geo, sizes, unmatched });
const metaOk =
  meta.counts.il === catalog.iller.length && meta.counts.ilce === catalog.ilceler.length && meta.counts.bolge === catalog.bolgeler.length;
checks.push({ id: 'meta-counts-match-catalog', ok: metaOk, level: 'error', ...(metaOk ? {} : { detail: 'meta.json sayıları katalogla uyuşmuyor' }) });

console.log('[data:check]');
const failed = report(checks);
process.exit(failed ? 1 : 0);
