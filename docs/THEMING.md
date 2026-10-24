# Tema

Bileşenin bütün renkleri ve ölçüleri CSS custom property olarak tanımlıdır. Shadow DOM içindeki kurallarda sabit renk yoktur; hepsi `var(--tks-*)` kullanır. Değişkenleri host üzerinde ezersiniz.

## Hazır temalar

| `theme` | Davranış |
|---|---|
| `auto` (varsayılan) | `prefers-color-scheme`'e göre açık veya koyu |
| `light` | Açık |
| `dark` | Koyu |
| başka bir ad | Açık temayla başlar; değerleri sizin CSS'iniz belirler |

## Değişkenler

| Değişken | Açık | Koyu | Ne için |
|---|---|---|---|
| `--tks-font` | `inherit` | | Yazı tipi |
| `--tks-height` | `320px` (`size="sm"`: 240px) | | Harita yüksekliği |
| `--tks-field-height` | `38px` (`sm`: 32px) | | `popover` alanının yüksekliği |
| `--tks-panel-width` | `420px` | | `popover` panel genişliği |
| `--tks-radius` | `8px` | | Köşe yuvarlaklığı |
| `--tks-duration` | `200ms` | | Seviye geçiş animasyonu (`prefers-reduced-motion`'da kapalı) |
| `--tks-bg` | `#fff` | `#111827` | Arka plan |
| `--tks-fg` | `#1f2937` | `#f3f4f6` | Metin |
| `--tks-muted` | `#6b7280` | `#9ca3af` | İkincil metin |
| `--tks-border` | `#e5e7eb` | `#374151` | Kenarlıklar |
| `--tks-fill` | `#e5e7eb` | `#374151` | Harita öğesi dolgusu |
| `--tks-fill-hover` | `#93c5fd` | `#1d4ed8` | Üzerine gelince |
| `--tks-fill-selected` | `#2563eb` | `#60a5fa` | Seçili öğe, breadcrumb bağlantıları |
| `--tks-fill-disabled` | `#f3f4f6` | `#1f2937` | Pasif (seçilemez) öğe |
| `--tks-stroke` | `#fff` | `#111827` | Sınır çizgisi |
| `--tks-stroke-width` | `.6` | | Sınır kalınlığı (zoom'dan etkilenmez) |
| `--tks-focus` | `#2563eb` | `#60a5fa` | Klavye odak halkası |
| `--tks-tooltip-bg` | `#111827` | `#f9fafb` | İsim balonu arka planı |
| `--tks-tooltip-fg` | `#fff` | `#111827` | İsim balonu metni |
| `--tks-chip-bg` | `#f3f4f6` | `#1f2937` | Liste çipleri, öneri vurgusu |
| `--tks-shadow` | gölge | gölge | Popover ve öneri gölgesi |
| `--tks-region-1` … `--tks-region-7` | pastel | koyu | Türkiye görünümündeki 7 bölgenin renkleri (katalog sırasıyla) |

## Özel tema

`theme` attribute'una bir ad verin ve değişkenleri host'ta tanımlayın:

```html
<tr-geo-picker name="ilce" theme="kurumsal"></tr-geo-picker>

<style>
  tr-geo-picker[theme="kurumsal"] {
    --tks-font: Georgia, serif;
    --tks-radius: 2px;
    --tks-bg: #fffaf3;
    --tks-fg: #3b2f2f;
    --tks-muted: #8a7563;
    --tks-border: #ead9c3;
    --tks-fill: #f1e3cf;
    --tks-fill-hover: #f0b47a;
    --tks-fill-selected: #b4441e;
    --tks-fill-disabled: #f7efe4;
    --tks-stroke: #fffaf3;
    --tks-focus: #b4441e;
    --tks-tooltip-bg: #3b2f2f;
    --tks-tooltip-fg: #fffaf3;
    --tks-chip-bg: #f6ead9;
    --tks-region-1: #e9b384; --tks-region-2: #d98e5f; --tks-region-3: #c9a66b; --tks-region-4: #a7b48a;
    --tks-region-5: #8fb0a9; --tks-region-6: #b39cb0; --tks-region-7: #d4a5a5;
  }
</style>
```

Sayfanın kendi koyu moduna uyan bir özel tema için:

```css
@media (prefers-color-scheme: dark) {
  tr-geo-picker[theme="kurumsal"] { --tks-bg: #1d1714; --tks-fg: #f3e9dc; /* … */ }
}
```

Tek bir değişkeni bütün bileşenlerde değiştirmek için `theme` vermeniz gerekmez:

```css
tr-geo-picker { --tks-height: 400px; --tks-fill-selected: #16a34a; }
```

## Part'lar

Daha derin özelleştirme için `::part()` kullanılabilir:

| Part | Öğe |
|---|---|
| `field` | `display="popover"` iken input görünümlü alan (button) |
| `panel` | Harita paneli |
| `breadcrumb` | Üstteki gezinme (`nav`) |
| `search` | Arama kutusu (`input`) |
| `map` | SVG harita |
| `item` | Haritadaki her öğe (`path`) |
| `region` | Türkiye görünümündeki bölge öğeleri (`item` ile birlikte) |
| `item-selected` | Seçili öğe |
| `item-disabled` | Seçilemeyen öğe |
| `list` | Harita altındaki liste |
| `tooltip` | İsim balonu |

```css
tr-geo-picker::part(field) { border-width: 2px; }
tr-geo-picker::part(item-selected) { fill: url(#desen); }
tr-geo-picker::part(list) { display: none; } /* listeyi gizle (erişilebilirlik için arama açık kalmalı) */
```

## Doğrulama görünümü

Bileşen native `:invalid` / `:valid` durumlarını destekler:

```css
form.gonderildi tr-geo-picker:invalid { outline: 2px solid #dc2626; border-radius: 8px; }
```
