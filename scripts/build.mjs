// dist/tr-geo-picker.min.js — CDN / script tag kullanımı için tek dosya ES module build.
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';

const outfile = 'dist/tr-geo-picker.min.js';
await build({
  entryPoints: ['src/tr-geo-picker.js'],
  outfile,
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['chrome120', 'edge120', 'firefox120', 'safari17'],
  legalComments: 'none',
});
const buf = await readFile(outfile);
const gz = gzipSync(buf, { level: 9 }).length;
console.log(`${outfile}: ${buf.length} B, gzip ${gz} B`);
if (gz > 12 * 1024) {
  console.error('gzip boyutu 12 KB bütçesini aşıyor');
  process.exit(1);
}
