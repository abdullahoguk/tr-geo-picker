// `npm run dev` — bağımlılıksız statik sunucu. Repo kökünü sunar, demo/ sayfasını açar.
//   node scripts/serve.mjs [--port 8080] [--root site]
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const root = resolve(arg('--root', '.'));
const port = Number(arg('--port', process.env.PORT || 8080));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8',
};

// site/_redirects varsa Cloudflare gibi uygula (yalnız "/yol" ve "/yol/*" kuralları); yoksa / → /demo/
const redirects = existsSync(join(root, '_redirects'))
  ? readFileSync(join(root, '_redirects'), 'utf8').split('\n').map((l) => l.trim().split(/\s+/)).filter((r) => r.length >= 2 && r[0].startsWith('/'))
  : [['/', '/demo/', '302']];

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const rule = redirects.find(([from]) => (from.endsWith('/*') ? url.pathname.startsWith(from.slice(0, -1)) : url.pathname === from));
  if (rule) return res.writeHead(Number(rule[2] || 302), { Location: rule[1] }).end();
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    let s = await stat(file);
    if (s.isDirectory()) {
      if (!url.pathname.endsWith('/')) return res.writeHead(301, { Location: url.pathname + '/' }).end();
      file = join(file, 'index.html');
      s = await stat(file);
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404');
  }
}).listen(port, () => console.log(`http://localhost:${port}/`));
