# Changelog

Biçim [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/), sürümleme [Semantic Versioning](https://semver.org/lang/tr/) esaslıdır.

## [Unreleased]

## [0.1.0] - 2026-10-24

### Eklendi

- `<tr-geo-picker>` Web Component: Türkiye › 7 bölge › il › ilçe gezinmesi, `mode="il|ilce"`
- Form entegrasyonu (`ElementInternals`): `name`, `required`, `:invalid`, reset, state restore, `emit-fields`
- `value-type`: `id`, `name` (`name-separator`), `custom`
- Harici veri: `data-src`, `data`, `dataProvider`, `filter` ile pasif öğeler
- `display="popover"` (Popover API ve yedeği), `size="sm"`
- Türkçe normalize edilmiş arama, harita altında liste, il görünümünde wheel/pinch zoom ve pan
- Klavye ile tam kullanım, `aria-live` duyuruları
- `light` / `dark` / `auto` tema, `--tks-*` CSS değişkenleri, `::part()`; `tr` / `en` arayüz metinleri
- Veri: 81 il, 973 ilçe (e-İçişleri, Ekim 2026); geometri geoBoundaries / OpenStreetMap (ODbL)
- Veri pipeline'ı: `data:update`, `data:build`, `data:check`
- `dist/tr-geo-picker.min.js`, `types/index.d.ts`, `custom-elements.json`
- Demo sayfası (örnek kodları, SEO etiketleri, JSON-LD, paylaşım görseli) ve Cloudflare Pages için `build:site` (`SITE_URL` ile canonical ve sitemap)
