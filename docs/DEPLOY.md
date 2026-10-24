# Demoyu yayınlama (Cloudflare)

**Ayrı bir branch gerekmez.** Cloudflare `main` branch'ini doğrudan yayınlar. Workers (static assets) ve Pages ikisi de çalışır. Site, bağımlılıksız bir script ile build sırasında üretilir. `site/` klasörü git'e girmez.

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

## Cloudflare Workers (önerilen)

Repodaki `wrangler.jsonc`, `site/` klasörünü static assets olarak yayınlar. Worker script'i yoktur; `_headers` ve `_redirects` Workers tarafından uygulanır.

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Import a repository** → `abdullahoguk/tr-geo-picker`
2. **Settings → Builds:**

   | Ayar | Değer |
   |---|---|
   | Production branch | `main` |
   | Build command | `node scripts/build-site.mjs` |
   | Deploy command | `npx wrangler deploy` |
   | Root directory | `/` |
   | Build variable | `SKIP_DEPENDENCY_INSTALL` = `1` |
   | Build variable | `SITE_URL` = `https://tr-geo.alanadiniz.com` |

   Worker adı `wrangler.jsonc` içindeki `name` ile aynı olmalıdır (`tr-geo-picker`). Build script'i yalnız Node'un yerleşik modüllerini kullanır, `npm install` gerekmez.
3. **Settings → Domains & Routes → Add → Custom domain** → ör. `tr-geo.alanadiniz.com` (alan adı Cloudflare'de olmalı).

`wrangler.jsonc` olmadan `wrangler deploy` yayınlanacak klasörü kendisi tahmin eder ve `demo/` klasörünü seçebilir. Bu durumda sayfa açılır ama `src/` ve `data/` 404 verir.

## Cloudflare Pages

1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → `abdullahoguk/tr-geo-picker`
2. Build command `node scripts/build-site.mjs`, build output directory `site`, ortam değişkenleri yukarıdaki gibi (`SKIP_DEPENDENCY_INSTALL`, `SITE_URL`).
3. **Custom domains** → **Set up a custom domain**.

Diğer branch'ler ve PR'lar otomatik önizleme alır.

## Wrangler ile elle yükleme

```sh
SITE_URL=https://tr-geo.alanadiniz.com npm run build:site
npx wrangler deploy                                        # Workers
npx wrangler pages deploy site --project-name tr-geo-picker  # veya Pages
```
