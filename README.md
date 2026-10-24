# tr-geo-picker

Türkiye haritası üzerinden **il** veya **ilçe** seçtiren, form içinde normal bir `<input>` gibi davranan Web Component.

- Bağımlılıksız: tek ES module, 10 KB gzip (veri hariç)
- Native form desteği: `name`, `required`, `:invalid`, submit, reset (`ElementInternals`)
- Türkiye › 7 bölge › il › ilçe sırasıyla iner; `mode="il"` ile il seçiminde biter
- Türkçe duyarlı arama (`kadık` → Kadıköy, `IGDIR` → Iğdır)
- Klavye ve ekran okuyucu ile tam kullanım, liste alternatifi, il görünümünde zoom/pan
- CSS değişkenleri ve `::part()` ile tema; açık/koyu tema hazır
- Değer olarak kod, isim veya kendi veritabanı id'leriniz (`value-type`)
- Güncel veri: 81 il, 973 ilçe (T.C. İçişleri Bakanlığı listesi). Veri pipeline'ı repoda

**Demo:** `npm run dev` → <http://localhost:8080/demo/>

## Kurulum

### Script tag (CDN, Classic ASP, PHP, düz HTML)

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/tr-geo-picker/dist/tr-geo-picker.min.js"></script>
```

Kendi sunucunuzda barındırmak için `dist/tr-geo-picker.min.js` ile `data/` klasörünü yan yana koyun:

```
/js/tr-geo/dist/tr-geo-picker.min.js
/js/tr-geo/data/...
```

Bileşen veriyi kendi konumuna göre `../data/` altında arar. Farklı bir yer için `data-src` attribute'unu kullanın.

### npm

```sh
npm i tr-geo-picker
```

```js
import 'tr-geo-picker';
```

## 30 saniyede

```html
<form method="post" action="/kaydet">
  <tr-geo-picker name="ilce" required></tr-geo-picker>
  <button>Kaydet</button>
</form>
<script type="module" src="/js/tr-geo/dist/tr-geo-picker.min.js"></script>
```

Form `ilce=1815` (Akçakoca'nın ilçe kodu) gönderir. Diğer kullanımlar:

```html
<!-- Sadece il, değer olarak il adı -->
<tr-geo-picker name="il" mode="il" value-type="name"></tr-geo-picker>

<!-- Input yüksekliğinde kompakt alan, tıklayınca harita açılır -->
<tr-geo-picker name="lokasyon" display="popover"></tr-geo-picker>

<!-- Yalnız Düzce ilçeleri, Akçakoca seçili -->
<tr-geo-picker name="ilce" start-il="81" lock-level value="1815"></tr-geo-picker>

<!-- Kendi veri sunucunuz + koyu tema -->
<tr-geo-picker name="lokasyon" data-src="/assets/tr-geo/" theme="dark"></tr-geo-picker>
```

## Dokümantasyon

| | |
|---|---|
| [docs/API.md](docs/API.md) | Attribute, property, metot ve event'ler |
| [docs/DATA.md](docs/DATA.md) | Veri şemaları, harici veri, `dataProvider`, veri pipeline'ı |
| [docs/THEMING.md](docs/THEMING.md) | CSS değişkenleri, part'lar, özel tema |
| [docs/EXAMPLES.md](docs/EXAMPLES.md) | Düz HTML, Classic ASP, React 19, Vue 3 örnekleri |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Demoyu Cloudflare Pages'te yayınlama |
| [CHANGELOG.md](CHANGELOG.md) | Sürüm notları |

## Değer biçimleri

| `value-type` | `mode="il"` | `mode="ilce"` |
|---|---|---|
| `id` (varsayılan) | `81` (plaka, iki hane: `01`…`81`) | `1815` (e-İçişleri ilçe kodu) |
| `name` | `Düzce` | `Düzce/Akçakoca` |
| `custom` | katalogdaki `value` | katalogdaki `value` |

## Tarayıcı desteği

Chrome, Edge, Firefox ve Safari'nin son 2 sürümü, iOS Safari ve Android Chrome. Popover API'si olmayan tarayıcılarda bileşen kendi açılır panel yedeğini kullanır.

## Geliştirme

```sh
npm install          # ~31 MB, 6 geliştirme bağımlılığı
npm run dev          # demo: http://localhost:8080/demo/
npm test             # Playwright: Chromium, Firefox, WebKit (ilk sefer: npx playwright install)
npm run build        # dist/tr-geo-picker.min.js (12 KB gzip sınırı kontrol edilir)
npm run analyze      # custom-elements.json (analyzer npx ile geçici indirilir)
npm run data:build   # data/ klasörünü repodaki kaynak kopyasından üretir (ağa çıkmaz)
npm run data:check   # veri doğrulaması
npm run data:update  # kaynak kopyasını resmi listeden ve geoBoundaries'ten yeniler
```

Runtime bağımlılığı yoktur. Geliştirme bağımlılıkları: `esbuild` (dist), `@playwright/test` (testler), `topojson-server`, `topojson-client`, `topojson-simplify` ve `polylabel` (yalnız veri pipeline'ı).

## Lisans ve veri atfı

Kod: [MIT](LICENSE).

Harita verisi ayrı lisanslıdır:

- **Sınır geometrisi:** [geoBoundaries](https://www.geoboundaries.org) (gbOpen TUR ADM1/ADM2). Kaynak verisi © [OpenStreetMap katkıda bulunanlar](https://www.openstreetmap.org/copyright), **ODbL 1.0**. `data/geo/` altındaki dosyalar bu verinin türevidir ve ODbL koşullarına tabidir: atıf gösterilmeli, veri değiştirilip dağıtılırsa aynı lisansla paylaşılmalıdır.
- **İl / ilçe isimleri ve kodları:** T.C. İçişleri Bakanlığı, [e-İçişleri Mülki İdari Bölümler](https://www.e-icisleri.gov.tr/Anasayfa/MulkiIdariBolumleri.aspx).

Kaynak sürümleri ve erişim tarihleri: [`data/meta.json`](data/meta.json).
