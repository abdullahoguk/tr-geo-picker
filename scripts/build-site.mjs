// `npm run build:site` — Cloudflare Pages (veya herhangi bir statik host) için site/ klasörü.
// Bağımlılık gerektirmez (yalnız Node yerleşik modülleri); npm install olmadan çalışır.
//
// Demo sitenin kökünde yayınlanır (/). SEO için mutlak adres gereken etiketler (canonical, og:url,
// og:image) ve sitemap.xml yalnız SITE_URL verildiğinde yazılır:
//   SITE_URL=https://tr-geo.ornek.com npm run build:site
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const OUT = 'site';
const SITE_URL = process.env.SITE_URL ? process.env.SITE_URL.replace(/\/*$/, '/') : '';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT);
for (const dir of ['src', 'data']) await cp(dir, `${OUT}/${dir}`, { recursive: true });
// demo/ kökte: ../src ve ../data göreli yolları kökten de aynı yere çözülür
await cp('demo', OUT, { recursive: true });

if (SITE_URL) {
  const abs = [
    `<link rel="canonical" href="${esc(SITE_URL)}">`,
    `<meta property="og:url" content="${esc(SITE_URL)}">`,
    `<meta property="og:image" content="${esc(SITE_URL)}og.png">`,
    `<meta name="twitter:image" content="${esc(SITE_URL)}og.png">`,
  ].join('\n');
  const html = await readFile(`${OUT}/index.html`, 'utf8');
  const marker = /<!-- seo:abs[^>]*-->/;
  if (!marker.test(html)) throw new Error('demo/index.html içinde <!-- seo:abs --> işareti yok');
  await writeFile(`${OUT}/index.html`, html.replace(marker, abs));
  const lastmod = new Date().toISOString().slice(0, 10);
  await writeFile(
    `${OUT}/sitemap.xml`,
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${esc(SITE_URL)}</loc><lastmod>${lastmod}</lastmod></url>\n</urlset>\n`,
  );
} else {
  console.warn('SITE_URL verilmedi: canonical, og:url, og:image ve sitemap.xml yazılmadı');
}

// src/ ve data/ engellenmez: arama motoru sayfayı render etmek için onlara erişmeli (indekslenmeleri _headers ile kapalı)
await writeFile(`${OUT}/robots.txt`, ['User-agent: *', 'Allow: /', SITE_URL && `Sitemap: ${SITE_URL}sitemap.xml`].filter(Boolean).join('\n') + '\n');
await writeFile(`${OUT}/_redirects`, '/demo /  301\n/demo/* /  301\n');
await writeFile(
  `${OUT}/_headers`,
  [
    '/data/*', '  Cache-Control: public, max-age=86400', '  Access-Control-Allow-Origin: *', '  X-Robots-Tag: noindex',
    '/src/*', '  Cache-Control: public, max-age=3600', '  X-Robots-Tag: noindex',
    '/og.png', '  Cache-Control: public, max-age=604800',
    '',
  ].join('\n'),
);
console.log(`${OUT}/ hazır${SITE_URL ? ` (${SITE_URL})` : ''}`);
