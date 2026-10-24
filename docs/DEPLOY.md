# Demoyu yayınlama (Cloudflare Pages)

**Ayrı bir branch gerekmez.** Cloudflare Pages `main` branch'ini doğrudan yayınlar. Site, bağımlılıksız bir script ile build sırasında üretilir. `site/` klasörü git'e girmez.

```sh
npm run build:site   # site/ → demo (kökte), src/, data/, robots.txt, _redirects, _headers
```

Demo sitenin kök adresinde (`/`) yayınlanır; eski `/demo/` adresi 301 ile köke yönlenir. `site/_headers` dosyası `data/` için önbellek ve CORS başlıklarını ekler. Bu sayede yayınlanan veri başka sitelerden `data-src` ile de kullanılabilir.

## SEO

Sayfada başlık, açıklama, Open Graph / Twitter etiketleri, `SoftwareSourceCode` JSON-LD, favicon ve 1200×630 paylaşım görseli (`demo/og.png`) vardır. Mutlak adres gerektiren etiketler (`canonical`, `og:url`, `og:image`, `twitter:image`) ve `sitemap.xml` yalnız **`SITE_URL`** ortam değişkeni verildiğinde yazılır:

```sh
SITE_URL=https://tr-geo.alanadiniz.com npm run build:site
```

`src/` ve `data/` robots.txt ile engellenmez, çünkü arama motoru sayfayı render etmek için bunlara erişmelidir. İndekslenmeleri `X-Robots-Tag: noindex` başlığıyla kapatılır.

Paylaşım görseli veri veya tasarım değişince `npm run og` ile yeniden üretilir (Playwright Chromium kullanır, çıktı repoya girer).

## Git entegrasyonu ile (önerilen)

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → `abdullahoguk/tr-geo-picker`
2. Build ayarları:

   | Ayar | Değer |
   |---|---|
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `node scripts/build-site.mjs` |
   | Build output directory | `site` |
   | Environment variable | `SKIP_DEPENDENCY_INSTALL` = `1` |
   | Environment variable | `SITE_URL` = `https://tr-geo.alanadiniz.com` (yalnız Production) |

   Build script'i yalnız Node'un yerleşik modüllerini kullanır. `SKIP_DEPENDENCY_INSTALL` ile Cloudflare'in `npm install` yapmasına gerek kalmaz.
3. **Custom domains** → **Set up a custom domain** → ör. `tr-geo.alanadiniz.com`. Alan adı Cloudflare'deyse CNAME kaydı otomatik eklenir. Değilse DNS'inize `tr-geo` → `<proje>.pages.dev` CNAME kaydı ekleyin.

Her `main` push'u production'a gider. Diğer branch'ler ve PR'lar otomatik olarak `<branch>.<proje>.pages.dev` önizlemesi alır.

## Wrangler ile elle yükleme

```sh
SITE_URL=https://tr-geo.alanadiniz.com npm run build:site
npx wrangler pages deploy site --project-name tr-geo-picker
```
