# Veri

## Dosyalar

```
data/
  meta.json                 # kaynaklar, erişim tarihleri, sayılar, doğrulama sonuçları, lisans
  catalog.json              # tüm hiyerarşi (isimler + id'ler), ~46 KB (gzip ~9 KB)
  geo/turkiye.json          # 7 bölge
  geo/bolge/{bolgeId}.json  # bölgedeki il sınırları
  geo/il/{plaka}.json       # ildeki ilçe sınırları
```

Katalog bir kez yüklenir. Geometri yalnızca o an gösterilen seviye için yüklenir ve aynı sayfadaki tüm bileşenler arasında önbelleğe alınır.

### Id'ler

| Seviye | Id | Örnek |
|---|---|---|
| Bölge | ASCII slug | `marmara`, `ege`, `akdeniz`, `ic-anadolu`, `karadeniz`, `dogu-anadolu`, `guneydogu-anadolu` |
| İl | Plaka, iki haneli string | `"01"` … `"81"` |
| İlçe | e-İçişleri ilçe kodu, string | `"1815"` (Akçakoca) |

Id'ler hep string'dir. Yeni bir il kurulursa `"82"` ve sonrası değişiklik gerektirmeden çalışır.

### catalog.json

```json
{
  "version": "2026.10",
  "bolgeler": [{ "id": "karadeniz", "name": "Karadeniz Bölgesi", "iller": ["05", "08", "…", "81"] }],
  "iller":    [{ "id": "81", "name": "Düzce", "bolge": "karadeniz" }],
  "ilceler":  [{ "id": "1815", "name": "Akçakoca", "il": "81" }]
}
```

Her öğe isteğe bağlı bir `value` alanı taşıyabilir. `value-type="custom"` kullanıldığında forma bu değer gönderilir.

### Geometri dosyası

```json
{ "viewBox": "0 0 1000 447", "items": [{ "id": "1815", "d": "M412 230l…z", "cx": 412, "cy": 230 }] }
```

Koordinatlar önceden projekte edilmiştir ve runtime'da hesap yapılmaz. `d` bir SVG path'idir. `cx`/`cy` etiket ve tooltip noktasıdır; polylabel ile en büyük parçanın görsel merkezi olarak hesaplanır.

## Harici veri

Öncelik sırası: **`dataProvider` → `data` → `data-src` → paketle gelen veri.**

### `data-src`: verinin kopyasını kendi sunucunuzda tutmak

`data/` klasörünü olduğu gibi kopyalayın ve kökünü gösterin:

```html
<tr-geo-picker name="ilce" data-src="/assets/tr-geo/"></tr-geo-picker>
```

Farklı bir alan adındaysa sunucunun CORS izni vermesi gerekir.

### `data`: kendi kataloğunuz

Geometri paketten gelir, isimler ve seçilebilir öğeler sizin kataloğunuzdan. **Katalogda olmayan ama haritada olan öğeler gri ve seçilemez çizilir.** "Sadece hizmet verdiğimiz ilçeler seçilebilsin" senaryosu bu şekilde kurulur.

```js
const el = document.querySelector('tr-geo-picker');
el.data = {
  bolgeler: [{ id: 'karadeniz', name: 'Karadeniz Bölgesi', iller: ['81'] }],
  iller: [{ id: '81', name: 'Düzce', bolge: 'karadeniz' }],
  ilceler: [
    { id: '1815', name: 'Akçakoca', il: '81' },
    { id: '1818', name: 'Gümüşova', il: '81' },
  ],
};
```

Paketteki kataloğu alıp yalnızca süzmek isterseniz `filter` daha kısadır:

```js
const izinli = new Set(['1815', '1818']);
el.filter = (item) => item.level !== 'ilce' || izinli.has(item.id);
```

### `value-type="custom"`: kendi veritabanı id'leriniz

```html
<tr-geo-picker id="lok" name="lokasyon_id" value-type="custom"></tr-geo-picker>
<script type="module">
  const cat = await fetch('/js/tr-geo/data/catalog.json').then((r) => r.json());
  const dbId = await fetch('/api/ilce-eslesme.json').then((r) => r.json()); // { "1815": "ILCE_5521", … }
  document.getElementById('lok').data = {
    ...cat,
    ilceler: cat.ilceler.map((c) => ({ ...c, value: dbId[c.id] })),
  };
</script>
```

Form `lokasyon_id=ILCE_5521` gönderir. `value` alanı olmayan bir öğe seçilirse id gönderilir ve konsola uyarı yazılır. Edit formunda `value="ILCE_5521"` verirseniz bileşen ilgili ilçeyi seçili açar.

### `dataProvider`: tamamen kendi API'niz

```js
el.dataProvider = async (level, id) => {
  // level: 'catalog' | 'turkiye' | 'bolge' | 'il'
  const r = await fetch(`/api/geo.asp?level=${level}&id=${id ?? ''}`);
  return r.ok ? r.json() : null; // null → sıradaki kaynağa (data → data-src → paket) düşer
};
```

Yalnızca kataloğu kendi API'nizden verip geometriyi paketten almak için diğer seviyelerde `null` döndürün.

## Veri pipeline'ı

Veri elle yazılmaz; `scripts/build-data/` altındaki pipeline üretir. İki aşamalıdır. Kaynakların bir kopyası repoda tutulur, bu sayede build internete çıkmaz.

```
data:update  (ara sıra, internet gerekir)          data:build  (her zaman, çevrimdışı)
───────────────────────────────────────            ─────────────────────────────────────
e-İçişleri il/ilçe listesi  ─┐                     sources/official.json   ─┐
geoBoundaries TUR ADM1/ADM2 ─┼─ eşleştir ─►        sources/ilceler.topojson ─┼─► data/
OSM Overpass (yalnız eksik)  ─┘   sources/          bolgeler.json            ─┘
                                  unmatched.json
```

### `npm run data:update`

1. **Resmi liste:** T.C. İçişleri Bakanlığı e-İçişleri "Mülki İdari Bölümler" sayfasından 81 ilin ilçe listesi kodlarıyla çekilir. Sayfadaki özet sayılar da kaydedilir.
2. **Geometri:** geoBoundaries gbOpen TUR ADM1 (il) ve ADM2 (ilçe). İndirme linki her seferinde geoBoundaries API'sinden çözülür, böylece yeni sürüm otomatik alınır.
3. **Eşleştirme:** Her ilçe poligonu, temsil noktasının düştüğü il poligonuna atanır. Sonra o il içinde Türkçe normalize edilmiş isimle eşleştirilir. "Çanakkale merkez", "Osmaniye (merkez)", "Rize merkezi", "Giresun District" gibi biçimler kural ile çözülür. Kalan farklar `scripts/build-data/aliases.json` dosyasında tutulur.
4. **Eksik ilçe:** geoBoundaries'te bulunmayan resmi ilçe (ör. yeni kurulmuş) varsa OpenStreetMap'ten (`admin_level=6`, Overpass) tamamlanır.
5. Eşleşmeyen kayıtlar **`scripts/build-data/unmatched.json`** dosyasına yazılır. **Dosya boş değilse komut hata ile biter.** Bu durumda `aliases.json`'a eşleme ekleyip tekrar çalıştırın.
6. Sonuç `scripts/build-data/sources/` altına yazılır:
   - `official.json`
   - `ilceler.topojson`: komşu ilçeler ortak sınır paylaşır, 15 m sadeleştirilmiş, ~3 MB
   - `sources.json`: sürümler ve erişim tarihleri

İndirilen ham dosyalar `scripts/build-data/.cache/` altında tutulur ve git'e girmez. `--offline` bayrağı yalnızca bu önbelleği kullanır.

### `npm run data:build`

Yalnızca repodaki kopyayı okur.

1. Katalog üretilir. İl→bölge eşlemesi `scripts/build-data/bolgeler.json` dosyasından gelir: 1941 Birinci Coğrafya Kongresi'nin 7 bölgesi. Birden fazla bölgeye yayılan illerde il merkezinin bulunduğu bölge esas alınır.
2. Geometri Lambert konform konik projeksiyonla projekte edilir (standart paraleller 37°K / 41°K, merkez 35°D).
3. Topolojiyi koruyan Visvalingam sadeleştirmesi yapılır. Ortak sınırlar her iki tarafta birebir aynı kalır.
4. İl sınırları ilçelerin, bölge sınırları illerin birleştirilmesiyle (dissolve) üretilir. Böylece seviyeler arasında sınırlar örtüşür.
5. Her dosya kendi viewBox'una sığdırılır (uzun kenar 1000) ve boyut sınırına göre sadeleştirme otomatik ayarlanır:

   | Dosya | Sınır (gzip öncesi) |
   |---|---|
   | `turkiye.json` | ≤ 60 KB |
   | Her bölge dosyası | ≤ 80 KB |
   | Her il dosyası | ≤ 40 KB |

6. Doğrulamalar çalışır ve sonuçlar `meta.json`'a yazılır.

### `npm run data:check`

`data/` çıktısını yalnızca doğrular. CI'da çalıştırılmalıdır. Hiçbir sayı sabit yazılmaz, hepsi resmi listeden türetilir.

- `unmatched.json` boş
- İl ve ilçe sayıları resmi listeyle aynı; e-İçişleri sayfasındaki özet sayılarla çapraz kontrol (uyarı düzeyinde)
- Bölge, il ve ilçe id'leri benzersiz ve string
- Her ilçenin bir ili, her ilin bir bölgesi, her ilin en az bir ilçesi var
- Her katalog öğesinin geometrisi var ve geometride katalog dışı öğe yok
- Boyut sınırları aşılmıyor
- `meta.json` sayıları katalogla tutarlı

### Yeni il veya ilçe kurulduğunda

1. `npm run data:update` çalıştırın.
2. Yeni il varsa build `every-il-has-bolge` hatası verir. Plakayı `scripts/build-data/bolgeler.json` içindeki uygun bölgeye ekleyin.
3. İsim farkı yüzünden eşleşmeyen varsa `unmatched.json`'a bakıp `aliases.json`'a ekleyin.
4. `npm run data:build`, ardından `sources/`, `data/` ve `unmatched.json` değişikliklerini commit edin.

## Lisans

`data/geo/` OpenStreetMap türevidir (geoBoundaries aracılığıyla) ve **ODbL 1.0** lisanslıdır. Kullanan sayfada "© OpenStreetMap katkıda bulunanlar" atfı gösterilmelidir. Tam metin `data/meta.json` → `license.attribution` alanındadır.
