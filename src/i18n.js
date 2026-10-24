/**
 * UI metinleri. Yeni dil eklemek için aynı anahtarlarla bir sözlük ekleyin.
 * `{0}` yer tutucuları sırayla doldurulur.
 * @type {Record<string, Record<string, string>>}
 */
export const I18N = {
  tr: {
    root: 'Türkiye',
    placeholder: 'İl / ilçe seçin',
    search: 'İl veya ilçe ara…',
    noResult: 'Sonuç yok',
    back: 'Geri',
    zoomIn: 'Yakınlaştır',
    zoomOut: 'Uzaklaştır',
    zoomReset: 'Sığdır',
    required: 'Lütfen bir seçim yapın.',
    selected: '{0} seçildi',
    showing: '{0}: {1} seçenek',
    map: 'Harita',
    list: 'Liste',
    loading: 'Yükleniyor…',
    error: 'Veri yüklenemedi',
  },
  en: {
    root: 'Türkiye',
    placeholder: 'Select province / district',
    search: 'Search province or district…',
    noResult: 'No results',
    back: 'Back',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    zoomReset: 'Fit',
    required: 'Please make a selection.',
    selected: '{0} selected',
    showing: '{0}: {1} options',
    map: 'Map',
    list: 'List',
    loading: 'Loading…',
    error: 'Failed to load data',
  },
};

/** @param {string} locale @param {string} key @param {...(string|number)} args */
export const t = (locale, key, ...args) =>
  (I18N[locale] || I18N.tr)[key].replace(/\{(\d)\}/g, (_, i) => String(args[i]));
