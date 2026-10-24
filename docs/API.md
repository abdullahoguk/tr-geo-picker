# API

Etiket adı `tr-geo-picker`. Değiştirmek için tek yer: `src/constants.js` → `TAG_NAME`.

Bileşen form-associated bir custom element'tir (`static formAssociated = true`). `<form>` içinde `<input>` gibi davranır: `name` ile gönderilir, `required` ile doğrulanır, form reset'te `value` attribute'una döner. `fieldset[disabled]` içindeyken devre dışı kalır.

## Attribute'lar

| Attribute | Property | Değerler | Varsayılan | Açıklama |
|---|---|---|---|---|
| `name` | `name` | string | — | Form alan adı |
| `mode` | `mode` | `il` \| `ilce` | `ilce` | Seçimin bittiği seviye |
| `value` | `value` | string | `""` | Başlangıç değeri. Property anlık değeri verir; attribute form reset'te dönülecek değerdir (`<input>` gibi). |
| `value-type` | `valueType` | `id` \| `name` \| `custom` | `id` | Değerin neyi temsil ettiği (aşağıya bakın) |
| `name-separator` | `nameSeparator` | string | `/` | `value-type="name"` + `mode="ilce"` için il ile ilçe arasındaki ayraç |
| `emit-fields` | `emitFields` | boolean | false | `{name}` ile birlikte `{name}_bolge`, `{name}_il`, `{name}_ilce` de gönderilir |
| `data-src` | `dataSrc` | URL (klasör) | paketle gelen `data/` | Harici veri kök URL'i |
| `theme` | `theme` | `light` \| `dark` \| `auto` \| özel ad | `auto` | Bkz. [THEMING.md](THEMING.md) |
| `display` | `display` | `inline` \| `popover` | `inline` | `popover`: input yüksekliğinde alan, tıklayınca harita paneli açılır |
| `size` | `size` | `sm` \| `md` | `md` | `sm`: daha alçak harita, küçük yazı |
| `searchable` | `searchable` | boolean | true | Arama kutusu. Kapatmak için `searchable="false"` |
| `required` | `required` | boolean | false | Boşken form gönderilmez, `:invalid` eşleşir |
| `disabled` | `disabled` | boolean | false | Etkileşim kapalı, forma gönderilmez |
| `readonly` | `readOnly` | boolean | false | Gezinilebilir ama seçim değiştirilemez |
| `placeholder` | `placeholder` | string | "İl / ilçe seçin" | `popover` alanında boşken görünen metin |
| `locale` | `locale` | `tr` \| `en` | `tr` | UI metinleri (`src/i18n.js`) |
| `start-region` | `startRegion` | bölge id | — | Açılışta gösterilecek bölge (ör. `karadeniz`) |
| `start-il` | `startIl` | plaka | — | Açılışta gösterilecek il (ör. `81`) |
| `lock-level` | `lockLevel` | boolean | false | `start-il` / `start-region` görünümünün üstüne çıkılamaz |

Önceden seçili bir `value` varsa `start-*` yerine seçimin bulunduğu harita açılır: `mode="ilce"` ise ilin ilçe haritası, `mode="il"` ise bölgenin il haritası.

### `value-type`

| Tip | `mode="il"` | `mode="ilce"` |
|---|---|---|
| `id` | `81` (plaka) | `1815` (ilçe kodu, tek başına benzersiz) |
| `name` | `Düzce` | `Düzce/Akçakoca` |
| `custom` | katalogdaki `value` | katalogdaki `value`; yoksa `id` kullanılır ve `console.warn` verilir |

`name` tipinde gelen değer Türkçe normalize edilerek eşleştirilir. `DÜZCE/akçakoca` da kabul edilir; forma her zaman katalogdaki yazım gider.

### `emit-fields`

`name="lok" emit-fields value="1815"` olan bir bileşen forma şunları ekler:

```
lok=1815
lok_bolge=karadeniz
lok_il=81
lok_ilce=1815
```

Alt alanlar da `value-type`'a uyar (`name` ise `Karadeniz Bölgesi`, `Düzce`, `Akçakoca`). `mode="il"` iken `lok_ilce` boş gider.

## Yalnız property

| Property | Tip | Açıklama |
|---|---|---|
| `data` | `Catalog` | Katalog nesnesi (isimler, id'ler, hiyerarşi). Geometri yine `data-src`'den veya paketten gelir. |
| `dataProvider` | `(level, id) => data \| Promise<data>` | Tamamen özel veri yükleme. `level`: `catalog`, `turkiye`, `bolge`, `il`. `null`/`undefined` dönerse sıradaki kaynağa geçilir. |
| `filter` | `(item) => boolean` | `false` dönen öğeler gri ve seçilemez çizilir. `item.level`: `bolge`, `il` veya `ilce`. Hiç seçilebilir alt öğesi kalmayan il ve bölgeler de pasif olur. |
| `selection` | `Selection` (salt okunur) | `{ bolge, il, ilce }`, her biri `{ id, name, value }` veya `null` |
| `form`, `validity`, `validationMessage`, `willValidate` | | Native form alanlarıyla aynı |

Veri kaynaklarının öncelik sırası `dataProvider` → `data` → `data-src` → paketle gelen veri şeklindedir. Ayrıntılar için [DATA.md](DATA.md).

## Metotlar

| Metot | Açıklama |
|---|---|
| `reset()` | Seçimi temizler ve başlangıç görünümüne döner |
| `goTo(level, id)` | Görünüme gider: `goTo('turkiye')`, `goTo('bolge', 'ege')`, `goTo('il', '35')`. Promise döner. |
| `select(id)` | Görünümdeki veya katalogdaki bir öğeyi seçer. Son seviye değilse içine girer. |
| `back()` | Bir seviye yukarı çıkar (`lock-level`'a uyar) |
| `open()` / `close()` | `display="popover"` panelini açar / kapatır |
| `checkValidity()` / `reportValidity()` | Native davranış |

## Event'ler

Hepsi `bubbles: true, composed: true`.

| Event | `detail` | Ne zaman |
|---|---|---|
| `change` | `{ value, selection }` | Yalnız son seviyede seçim yapılınca |
| `input` | `{ value, selection }` | Seçim yolu her değiştiğinde (bölge veya il değişince `value` boşalır) |
| `tks-navigate` | `{ level, id, path }` | Görünüm değişince. `path`: `[{ level, id, name }, …]` |
| `tks-load` | `{ level, id }` | Katalog veya geometri yüklenince |
| `tks-error` | `{ level, id, error }` | Veri yüklenemeyince |

Bileşenin içindeki arama kutusunun native `input` event'i dışarı sızmaz. Host'ta dinlediğiniz `input`, her zaman yukarıdaki `detail` ile gelir.

## Klavye

| Tuş | Harita | Arama kutusu |
|---|---|---|
| Tab | Haritaya / listeye geçer | |
| ← → ↑ ↓ | Yöndeki en yakın öğeye gider | Öneriler arasında gezinir |
| Home / End | İlk / son öğe | |
| Enter / Space | Seçer veya içine girer | Öneriyi seçer |
| Esc / Backspace | Bir seviye yukarı | Aramayı temizler |
| + / − | Yakınlaştırır / uzaklaştırır (il görünümü) | |

Harita altındaki liste ve arama kutusu, haritaya erişemeyen kullanıcılar için birincil yoldur. Seviye değişimleri ve seçimler `aria-live` ile duyurulur.

## CSS part'ları

`field`, `panel`, `breadcrumb`, `search`, `map`, `item`, `region`, `item-selected`, `item-disabled`, `list`, `tooltip`. Ayrıntılar için [THEMING.md](THEMING.md).
