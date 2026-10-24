import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT = join(HERE, '..', '..');
export const CACHE = join(HERE, '.cache');
export const DATA = join(ROOT, 'data');

export const OFFLINE = process.argv.includes('--offline') || process.env.DATA_OFFLINE === '1';

export const log = (...a) => console.log('[data]', ...a);

export async function readJSON(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function writeJSON(file, obj, pretty = true) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, pretty ? JSON.stringify(obj, null, 2) + '\n' : JSON.stringify(obj));
}

/** Dosya önbellekte varsa ve --offline ise onu döndürür, yoksa üretir ve yazar. */
export async function cached(name, produce) {
  const file = join(CACHE, name);
  if (OFFLINE) {
    try {
      return await readJSON(file);
    } catch {
      throw new Error(`--offline: önbellekte ${name} yok, önce çevrimiçi çalıştırın`);
    }
  }
  const value = await produce();
  await writeJSON(file, value, false);
  return value;
}

export async function fetchRetry(url, opts = {}, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(opts.timeout ?? 60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return res;
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * i * i));
    }
  }
}
