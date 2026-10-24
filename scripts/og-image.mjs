// `npm run og` — demo/og.png (1200×630 sosyal paylaşım görseli) üretir.
// Yalnız veri veya tasarım değişince çalıştırılır; çıktı repoya girer, site build'i bunu gerektirmez.
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const geo = JSON.parse(await readFile('data/geo/turkiye.json', 'utf8'));
const meta = JSON.parse(await readFile('data/meta.json', 'utf8'));
const order = JSON.parse(await readFile('data/catalog.json', 'utf8')).bolgeler.map((b) => b.id);
// --tks-region-1…7 (açık tema), bileşendeki gibi katalog sırasıyla
const colors = ['#fca5a5', '#fdba74', '#fcd34d', '#86efac', '#5eead4', '#a5b4fc', '#f0abfc'];
const paths = geo.items.map((it) => `<path d="${it.d}" fill="${colors[order.indexOf(it.id)]}"/>`).join('');

const html = `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; width: 1200px; height: 630px; background: #f7f7f5; color: #1c1c1a;
         font-family: system-ui, "Segoe UI", Roboto, sans-serif; display: grid; grid-template-rows: auto 1fr; }
  header { padding: 56px 72px 0; }
  h1 { margin: 0; font-size: 64px; letter-spacing: -.02em; line-height: 1.05; }
  p { margin: 14px 0 0; font-size: 28px; color: #6b6b66; }
  code { font: 600 26px ui-monospace, Menlo, monospace; color: #2563eb; }
  svg { width: 840px; height: 376px; margin: 0 auto 24px; display: block; align-self: end; }
  path { stroke: #fff; stroke-width: 1.4; stroke-linejoin: round; }
</style>
<header><code>&lt;tr-geo-picker&gt;</code><h1>Türkiye il ilçe seçici harita</h1>
<p>${meta.counts.il} il · ${meta.counts.ilce} ilçe · form uyumlu · bağımlılıksız Web Component</p></header>
<svg viewBox="${geo.viewBox}">${paths}</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.screenshot({ path: 'demo/og.png' });
await browser.close();
console.log('demo/og.png yazıldı');
