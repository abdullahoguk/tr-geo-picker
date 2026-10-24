import { TAG_NAME } from './constants.js';
import { load } from './data-loader.js';
import { normalize, search } from './search.js';
import { t } from './i18n.js';
import { CSS, getSheet } from './styles.js';

/**
 * @typedef {import('./data-loader.js').Catalog} Catalog
 * @typedef {import('./data-loader.js').Geo} Geo
 * @typedef {import('./data-loader.js').DataProvider} DataProvider
 * @typedef {'turkiye'|'bolge'|'il'} ViewLevel
 * @typedef {{ id: string, name: string, value: string }} SelectionPart
 * @typedef {{ bolge: SelectionPart|null, il: SelectionPart|null, ilce: SelectionPart|null }} Selection
 */

const STR = ['name', 'mode', 'value-type', 'data-src', 'theme', 'display', 'size', 'placeholder', 'locale', 'start-region', 'start-il', 'name-separator'];
const BOOL = ['emit-fields', 'required', 'disabled', 'readonly', 'lock-level'];
const CHILD = { turkiye: 'bolge', bolge: 'il', il: 'ilce' };
const LV = ['turkiye', 'bolge', 'il'];
const camel = (s) => s.replace(/-(\w)/g, (_, c) => c.toUpperCase());
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const byName = (a, b) => a.name.localeCompare(b.name, 'tr');
const POPOVER = typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype;

/**
 * Türkiye haritası üzerinden il / ilçe seçtiren, form uyumlu custom element.
 *
 * @element tr-geo-picker
 * @attr {string} name - Form alan adı
 * @attr {'il'|'ilce'} mode - Seçimin bittiği seviye (varsayılan ilce)
 * @attr {string} value - Seçili değer (value-type'a göre)
 * @attr {'id'|'name'|'custom'} value-type - Değerin neyi temsil ettiği (varsayılan id)
 * @attr {string} name-separator - value-type="name" ve mode="ilce" için ayraç (varsayılan /)
 * @attr {boolean} emit-fields - {name}_bolge, {name}_il, {name}_ilce alanlarını da gönderir
 * @attr {string} data-src - Harici veri klasörü URL'i
 * @attr {string} theme - light | dark | auto | özel ad
 * @attr {'inline'|'popover'} display - Görünüm (varsayılan inline)
 * @attr {'sm'|'md'} size - Kompaktlık
 * @attr {boolean} searchable - Arama kutusu; kapatmak için searchable="false"
 * @attr {boolean} required
 * @attr {boolean} disabled
 * @attr {boolean} readonly
 * @attr {string} placeholder - popover alanındaki boş metin
 * @attr {'tr'|'en'} locale - UI dili
 * @attr {string} start-region - Açılış bölgesi id'si
 * @attr {string} start-il - Açılış ili (plaka)
 * @attr {boolean} lock-level - start-il / start-region üstüne çıkışı engeller
 * @cssprop --tks-height - Harita yüksekliği (320px)
 * @cssprop --tks-bg - Arka plan
 * @cssprop --tks-fg - Metin
 * @cssprop --tks-fill-selected - Seçili öğe dolgusu
 * @cssprop --tks-region-1 - Bölge renkleri (1–7)
 * @fires change - Son seviyede seçim yapıldığında. detail: { value, selection }
 * @fires input - Seçim yolu her değiştiğinde. detail: { value, selection }
 * @fires tks-navigate - Görünüm değiştiğinde. detail: { level, id, path }
 * @fires tks-load - Veri yüklendiğinde. detail: { level, id }
 * @fires tks-error - Veri yüklenemediğinde. detail: { level, id, error }
 * @csspart field - popover modunda input görünümlü alan
 * @csspart panel - harita paneli
 * @csspart breadcrumb - üst gezinme
 * @csspart search - arama kutusu
 * @csspart map - SVG harita
 * @csspart item - haritadaki her öğe
 * @csspart region - Türkiye görünümündeki bölge öğeleri
 * @csspart item-selected - seçili öğe
 * @csspart item-disabled - seçilemeyen öğe
 * @csspart list - harita altındaki liste
 * @csspart tooltip - isim balonu
 */
export class TrGeoPicker extends HTMLElement {
  static formAssociated = true;
  static observedAttributes = [...STR, ...BOOL, 'value', 'searchable'];

  #in = this.attachInternals();
  #root = this.attachShadow({ mode: 'open', delegatesFocus: true });
  /** @type {Catalog|null} */ #cat = null;
  #idx = /** @type {any} */ (null);
  /** @type {{ level: ViewLevel, id: string|null }} */ #view = { level: 'turkiye', id: null };
  /** @type {Geo|null} */ #geo = null;
  /** @type {Record<string, any>} */ #sel = { bolge: null, il: null, ilce: null };
  #value = '';
  #pending = /** @type {string|null} */ (null);
  #data = /** @type {Catalog|null} */ (null);
  #provider = /** @type {DataProvider|null} */ (null);
  #filter = /** @type {((item: any) => boolean)|null} */ (null);
  #seq = 0;
  #started = false;
  #off = /** @type {(() => void)|null} */ (null);
  #vseq = 0;
  #entries = /** @type {any[]|null} */ (null);
  #act = new Map();
  #vb = [0, 0, 1, 1];
  #z = [0, 0, 1, 1];
  #ptr = new Map();
  #drag = false;
  #hits = /** @type {any[]} */ ([]);
  #hi = -1;

  constructor() {
    super();
    const sheet = getSheet();
    if (sheet) this.#root.adoptedStyleSheets = [sheet];
  }

  // ---------- Özellikler

  get mode() {
    return this.getAttribute('mode') === 'il' ? 'il' : 'ilce';
  }
  get valueType() {
    const v = this.getAttribute('value-type');
    return v === 'name' || v === 'custom' ? v : 'id';
  }
  get display() {
    return this.getAttribute('display') === 'popover' ? 'popover' : 'inline';
  }
  get searchable() {
    return this.getAttribute('searchable') !== 'false';
  }
  set searchable(v) {
    this.setAttribute('searchable', String(!!v));
  }
  get locale() {
    return this.getAttribute('locale') || 'tr';
  }
  get nameSeparator() {
    return this.getAttribute('name-separator') || '/';
  }
  get readOnly() {
    return this.hasAttribute('readonly');
  }
  set readOnly(v) {
    this.toggleAttribute('readonly', !!v);
  }

  /** Seçili değer (`value-type`'a göre). */
  get value() {
    return this.#pending ?? this.#value;
  }
  set value(v) {
    v = v == null ? '' : String(v);
    if (!this.#cat) {
      this.#pending = v;
      this.#sync();
      return;
    }
    this.#pending = null;
    this.#applyValue(v);
    this.#refresh();
  }

  /** @returns {Selection} */
  get selection() {
    const part = (lv) => {
      const it = this.#sel[lv];
      return it ? { id: it.id, name: it.name, value: this.#val(it) } : null;
    };
    return { bolge: part('bolge'), il: part('il'), ilce: part('ilce') };
  }

  /** Katalog nesnesini doğrudan verir (geometri yine data-src / paketten gelir). */
  get data() {
    return this.#data;
  }
  set data(v) {
    this.#data = v;
    if (this.#started) this.#init();
  }
  /** `async (level, id) => data` ile tamamen özel veri yükleme. null dönerse varsayılan zincire düşer. */
  get dataProvider() {
    return this.#provider;
  }
  set dataProvider(v) {
    this.#provider = v;
    if (this.#started) this.#init();
  }
  /** `(item) => boolean` — false dönen öğeler pasif (gri) çizilir. item.level: 'bolge'|'il'|'ilce' */
  get filter() {
    return this.#filter;
  }
  set filter(v) {
    this.#filter = v;
    this.#act.clear();
    this.#entries = null;
    if (this.#geo) this.#render();
  }

  get form() {
    return this.#in.form;
  }
  get validity() {
    return this.#in.validity;
  }
  get validationMessage() {
    return this.#in.validationMessage;
  }
  get willValidate() {
    return this.#in.willValidate;
  }
  checkValidity() {
    return this.#in.checkValidity();
  }
  reportValidity() {
    return this.#in.reportValidity();
  }

  // ---------- Yaşam döngüsü

  connectedCallback() {
    // Upgrade öncesi atanmış property'leri (ör. React) setter'lardan geçir
    for (const p of ['data', 'dataProvider', 'filter', 'value']) {
      if (Object.hasOwn(this, p)) {
        const v = this[p];
        delete this[p];
        this[p] = v;
      }
    }
    if (this.#pending == null && !this.#value && this.hasAttribute('value')) this.#pending = this.getAttribute('value');
    if (!this.#root.firstChild) this.#shell();
    if (!this.#started) this.#init();
  }

  attributeChangedCallback(name, old, v) {
    if (old === v || !this.#root.firstChild) return;
    if (name === 'value') this.value = v;
    else if (name === 'data-src') this.#init();
    else if (['display', 'searchable', 'locale', 'placeholder'].includes(name)) {
      this.#shell();
      if (this.#geo) this.#render();
    } else if (['mode', 'value-type', 'name-separator', 'emit-fields', 'required', 'name'].includes(name)) {
      if (name === 'mode') {
        this.#act.clear();
        this.#entries = null;
      }
      if (this.#cat && name !== 'name' && name !== 'required' && name !== 'emit-fields') this.#applyValue(this.#value);
      this.#refresh();
    } else if (name === 'disabled' || name === 'readonly') this.#sync();
  }

  formResetCallback() {
    this.value = this.getAttribute('value') || '';
    if (this.#cat) this.#show(...this.#startView());
  }
  formStateRestoreCallback(state) {
    if (typeof state === 'string') this.value = state;
  }
  formDisabledCallback(d) {
    this.#$('.w')?.classList.toggle('dis', d);
  }

  // ---------- Genel metotlar

  /** Değeri temizler ve başlangıç görünümüne döner. */
  reset() {
    this.#pending = null;
    this.#sel = { bolge: null, il: null, ilce: null };
    this.#value = '';
    this.#refresh();
    if (this.#cat) this.#show(...this.#startView());
  }
  /** @param {ViewLevel} level @param {string} [id] */
  goTo(level, id) {
    return this.#show(level, level === 'turkiye' ? null : String(id));
  }
  /** Görünümdeki veya katalogdaki bir öğeyi seçer / içine girer. @param {string} id */
  select(id) {
    id = String(id);
    const child = CHILD[this.#view.level];
    if (this.#idx?.[child].has(id)) return this.#choose(child, id);
    for (const lv of ['ilce', 'il', 'bolge']) if (this.#idx?.[lv].has(id)) return this.#choose(lv, id);
  }
  /** Bir seviye yukarı çıkar. */
  back() {
    const { level, id } = this.#view;
    if (!this.#canUp()) return;
    if (level === 'il') this.#show('bolge', this.#idx.il.get(id)?.bolge);
    else if (level === 'bolge') this.#show('turkiye', null);
  }
  /** popover modunda paneli açar. */
  open() {
    const p = this.#$('.panel');
    if (this.display !== 'popover' || !p) return;
    if (POPOVER) p.showPopover();
    else this.#toggleFallback(true);
  }
  close() {
    const p = this.#$('.panel');
    if (this.display !== 'popover' || !p) return;
    if (POPOVER) p.hidePopover();
    else this.#toggleFallback(false);
  }

  // ---------- İskelet

  #$(s) {
    return /** @type {any} */ (this.#root.querySelector(s));
  }
  #t(k, ...a) {
    return t(this.locale, k, ...a);
  }

  #shell() {
    const pop = this.display === 'popover';
    const r = this.#root;
    r.innerHTML =
      (getSheet() ? '' : `<style>${CSS}</style>`) +
      `<div class="w${pop ? ' pop' : ''}">` +
      (pop
        ? `<button type="button" class="field" part="field" aria-haspopup="dialog" aria-expanded="false"><span class="txt"></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>`
        : '') +
      `<div class="panel" part="panel"${pop && POPOVER ? ' popover' : ''}>` +
      `<div class="top"><nav part="breadcrumb" aria-label="${this.#t('map')}"></nav>` +
      (this.searchable
        ? `<div class="sw"><input type="search" part="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="sg" autocomplete="off" spellcheck="false" placeholder="${esc(this.#t('search'))}" aria-label="${esc(this.#t('search'))}"><ul class="sugg" id="sg" role="listbox" hidden></ul></div>`
        : '') +
      `</div><div class="map"><svg class="m" part="map" role="listbox" tabindex="-1" preserveAspectRatio="xMidYMid meet"></svg>` +
      `<div class="msg"></div><div class="tip" part="tooltip" hidden></div>` +
      `<div class="zoom" hidden><button type="button" data-z="1" aria-label="${this.#t('zoomIn')}">+</button><button type="button" data-z="-1" aria-label="${this.#t('zoomOut')}">−</button><button type="button" data-z="0" aria-label="${this.#t('zoomReset')}">⤢</button></div></div>` +
      `<ul class="list" part="list" aria-label="${this.#t('list')}"></ul><div class="sr" aria-live="polite"></div></div></div>`;

    const map = this.#$('.map');
    const svg = this.#$('.m');
    svg.addEventListener('click', (e) => {
      const p = e.target.closest('path');
      if (p && !this.#drag) this.#pick(p.dataset.id);
    });
    svg.addEventListener('keydown', (e) => this.#mapKey(e));
    svg.addEventListener('pointerover', (e) => this.#tip(e.target.closest('path'), e));
    svg.addEventListener('pointermove', (e) => this.#ptr.size || this.#tip(e.target.closest('path'), e));
    svg.addEventListener('pointerleave', () => this.#tip(null));
    svg.addEventListener('focusin', (e) => this.#tip(e.target.closest('path')));
    svg.addEventListener('focusout', () => this.#tip(null));
    map.addEventListener('wheel', (e) => this.#wheel(e), { passive: false });
    map.addEventListener('pointerdown', (e) => this.#pdown(e));
    map.addEventListener('pointermove', (e) => this.#pmove(e));
    for (const ev of ['pointerup', 'pointercancel']) map.addEventListener(ev, (e) => this.#pup(e));
    this.#$('.zoom').addEventListener('click', (e) => {
      const z = e.target.closest('button')?.dataset.z;
      if (z === '0') this.#setZ(this.#vb.slice());
      else if (z) this.#zoomAt(null, z === '1' ? 0.66 : 1.5);
    });
    this.#$('nav').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) this.#show(/** @type {ViewLevel} */ (b.dataset.l), b.dataset.id || null, true);
    });
    this.#$('.list').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) this.#pick(b.dataset.id, true);
    });
    this.#$('.panel').addEventListener('keydown', (e) => {
      if ((e.key === 'Backspace' || e.key === 'Escape') && e.target.type !== 'search' && this.#canUp()) {
        e.preventDefault();
        e.stopPropagation();
        this.back();
        queueMicrotask(() => this.#focusMap());
      }
    });

    const q = this.#$('input');
    if (q) {
      q.addEventListener('input', (e) => {
        e.stopPropagation(); // iç input'un event'i host'un input event'iyle karışmasın
        this.#suggest(q.value);
      });
      q.addEventListener('change', (e) => e.stopPropagation());
      q.addEventListener('keydown', (e) => this.#searchKey(e));
      q.addEventListener('blur', () => setTimeout(() => this.#suggest(''), 150));
      this.#$('.sugg').addEventListener('pointerdown', (e) => {
        const li = e.target.closest('li');
        if (li) {
          e.preventDefault();
          this.#useHit(+li.dataset.i);
        }
      });
    }

    if (pop) {
      const f = this.#$('.field');
      const p = this.#$('.panel');
      if (POPOVER) {
        f.popoverTargetElement = p;
        p.addEventListener('toggle', (e) => this.#onToggle(e.newState === 'open'));
      } else {
        f.addEventListener('click', () => this.#toggleFallback(!p.classList.contains('open')));
      }
    }
    this.#sync();
  }

  // ---------- Veri

  get #src() {
    return { dataProvider: this.#provider, data: this.#data, dataSrc: this.getAttribute('data-src') };
  }

  async #init() {
    this.#started = true;
    const seq = ++this.#seq;
    try {
      const cat = /** @type {Catalog} */ (await load(this.#src, 'catalog'));
      if (seq !== this.#seq) return;
      this.#index(cat);
      this.#emit('tks-load', { level: 'catalog', id: null });
      const v = this.#pending ?? this.#value;
      this.#pending = null;
      this.#applyValue(v);
      this.#sync();
      await this.#show(...this.#startView());
    } catch (error) {
      if (seq === this.#seq) this.#fail('catalog', null, error);
    }
  }

  #index(cat) {
    const m = (arr) => new Map((arr || []).map((x) => [String(x.id), { ...x, id: String(x.id) }]));
    const idx = { bolge: m(cat.bolgeler), il: m(cat.iller), ilce: m(cat.ilceler), kids: new Map() };
    for (const b of idx.bolge.values())
      for (const id of b.iller || []) {
        const il = idx.il.get(String(id));
        if (il && !il.bolge) il.bolge = b.id;
      }
    const kid = (k, x) => (idx.kids.has(k) ? idx.kids.get(k) : idx.kids.set(k, []).get(k)).push(x);
    for (const il of idx.il.values()) kid('bolge:' + il.bolge, il);
    for (const c of idx.ilce.values()) kid('il:' + (c.il = String(c.il)), c);
    [...idx.bolge.values()].forEach((b, i) => (b.n = i));
    this.#cat = cat;
    this.#idx = idx;
    this.#act.clear();
    this.#entries = null;
  }

  #kids(level, id) {
    return this.#idx.kids.get(level + ':' + id) || [];
  }

  /** Öğe seçilebilir mi? Üst seviyeler en az bir seçilebilir alt öğe içeriyorsa aktiftir. */
  #on(level, id) {
    const k = level + ':' + id;
    if (this.#act.has(k)) return this.#act.get(k);
    const it = this.#idx?.[level]?.get(id);
    let ok = !!it && (!this.#filter || !!this.#filter({ ...it, level }));
    if (ok && level === 'bolge') ok = this.#kids('bolge', id).some((x) => this.#on('il', x.id));
    else if (ok && level === 'il' && this.mode === 'ilce') ok = this.#kids('il', id).some((x) => this.#on('ilce', x.id));
    this.#act.set(k, ok);
    return ok;
  }

  #startView() {
    const s = this.#sel;
    const il = this.getAttribute('start-il');
    const rg = this.getAttribute('start-region');
    if (this.mode === 'ilce' && s.il) return /** @type {const} */ (['il', s.il.id]);
    if (s.bolge) return /** @type {const} */ (['bolge', s.bolge.id]);
    if (il && this.#idx.il.has(il)) return /** @type {const} */ (this.mode === 'il' ? ['bolge', this.#idx.il.get(il).bolge] : ['il', il]);
    if (rg && this.#idx.bolge.has(rg)) return /** @type {const} */ (['bolge', rg]);
    return /** @type {const} */ (['turkiye', null]);
  }

  /** Kilitliyse en üst görünüm seviyesi. */
  #minLevel() {
    if (!this.hasAttribute('lock-level')) return 0;
    if (this.getAttribute('start-il') && this.mode === 'ilce') return 2;
    return this.getAttribute('start-il') || this.getAttribute('start-region') ? 1 : 0;
  }
  #canUp() {
    return LV.indexOf(this.#view.level) > this.#minLevel();
  }

  async #show(level, id, focus = false) {
    const seq = ++this.#vseq;
    try {
      const geo = /** @type {Geo} */ (await load(this.#src, level, id ?? undefined));
      if (seq !== this.#vseq) return;
      this.#view = { level, id };
      this.#geo = geo;
      this.#emit('tks-load', { level, id });
      this.#render(focus);
      this.#emit('tks-navigate', { level, id, path: this.#path() });
    } catch (error) {
      if (seq === this.#vseq) this.#fail(level, id, error);
    }
  }

  #fail(level, id, error) {
    const m = this.#$('.msg');
    if (m) m.textContent = this.#t('error');
    this.#emit('tks-error', { level, id, error });
  }

  // ---------- Değer

  /** @param {any} it */
  #val(it) {
    const vt = this.valueType;
    if (vt === 'name') return it.name;
    if (vt === 'custom') {
      if (it.value != null) return String(it.value);
      console.warn(`[${TAG_NAME}] "${it.name}" için katalogda value yok; id kullanılıyor.`);
    }
    return it.id;
  }

  #compute() {
    const { il, ilce } = this.#sel;
    const leaf = this.mode === 'il' ? il : ilce;
    if (!leaf) return '';
    if (this.valueType === 'name' && this.mode === 'ilce') return il.name + this.nameSeparator + ilce.name;
    return this.#val(leaf);
  }

  #applyValue(v) {
    this.#sel = { bolge: null, il: null, ilce: null };
    this.#value = '';
    if (!v) return;
    const leafLv = this.mode === 'il' ? 'il' : 'ilce';
    const key = this.valueType === 'name' ? normalize(v) : v;
    for (const it of this.#idx[leafLv].values()) {
      this.#setPath(leafLv, it);
      const c = this.#compute();
      if ((this.valueType === 'name' ? normalize(c) : c) === key) {
        this.#value = c;
        return;
      }
    }
    this.#sel = { bolge: null, il: null, ilce: null };
    console.warn(`[${TAG_NAME}] değer katalogda bulunamadı: "${v}"`);
  }

  #setPath(level, it) {
    const il = level === 'ilce' ? this.#idx.il.get(it.il) : level === 'il' ? it : null;
    this.#sel = {
      bolge: this.#idx.bolge.get(level === 'bolge' ? it.id : il?.bolge) || null,
      il,
      ilce: level === 'ilce' ? it : null,
    };
  }

  #sync() {
    const v = this.#value;
    const name = this.getAttribute('name');
    if (this.hasAttribute('emit-fields') && name) {
      const fd = new FormData();
      fd.append(name, v);
      for (const lv of ['bolge', 'il', 'ilce']) fd.append(`${name}_${lv}`, this.#sel[lv] && v ? this.#val(this.#sel[lv]) : '');
      this.#in.setFormValue(fd, v);
    } else this.#in.setFormValue(v, v);
    const anchor = this.#$('.field') || this.#$('input') || this.#$('.list button') || undefined;
    if (this.hasAttribute('required') && !v) this.#in.setValidity({ valueMissing: true }, this.#t('required'), anchor);
    else this.#in.setValidity({});
    const f = this.#$('.field .txt');
    if (f) {
      const s = this.#sel;
      const leaf = this.mode === 'il' ? s.il : s.ilce;
      f.className = 'txt' + (leaf && v ? '' : ' ph');
      f.textContent = leaf && v ? (s.ilce ? `${s.ilce.name}, ${s.il.name}` : s.il.name) : this.getAttribute('placeholder') || this.#t('placeholder');
    }
  }

  #refresh() {
    this.#sync();
    if (this.#geo) this.#render();
  }

  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  // ---------- Seçim akışı

  #pick(id, focus = false) {
    const child = CHILD[this.#view.level];
    if (this.#on(child, id)) this.#choose(child, id, focus);
  }

  #choose(level, id, focus = false) {
    const it = this.#idx[level].get(id);
    if (!it || !this.#on(level, id)) return;
    const leaf = level === (this.mode === 'il' ? 'il' : 'ilce');
    if (leaf && level === 'ilce' && !this.#on('il', it.il)) return;
    if (this.readOnly) {
      if (!leaf) this.#show(level, id, focus);
      return;
    }
    const prev = this.#value;
    const pathKey = () => ['bolge', 'il', 'ilce'].map((l) => this.#sel[l]?.id).join();
    const prevPath = pathKey();
    if (leaf) {
      this.#setPath(level, it);
      this.#value = this.#compute();
      this.#sync();
      this.#emit('input', { value: this.#value, selection: this.selection });
      this.#emit('change', { value: this.#value, selection: this.selection });
      this.#say(this.#t('selected', it.name));
      const [vl, vid] = level === 'ilce' ? ['il', it.il] : ['bolge', this.#sel.bolge.id];
      if (this.#view.level !== vl || this.#view.id !== vid) this.#show(vl, vid, focus);
      else this.#render(focus);
      if (this.display === 'popover') this.close();
      return;
    }
    if (this.#sel[level]?.id !== id) {
      this.#setPath(level, it);
      this.#value = '';
      this.#sync();
      if (pathKey() !== prevPath || prev) this.#emit('input', { value: '', selection: this.selection });
    }
    this.#show(level, id, focus);
  }

  /** Görünüm yolu: Türkiye › bölge › il */
  #path() {
    const { level, id } = this.#view;
    const p = [{ level: 'turkiye', id: null, name: this.#t('root') }];
    const il = level === 'il' ? this.#idx.il.get(id) : null;
    const b = this.#idx.bolge.get(level === 'bolge' ? id : il?.bolge);
    if (b && level !== 'turkiye') p.push({ level: 'bolge', id: b.id, name: b.name });
    if (il) p.push({ level: 'il', id: il.id, name: il.name });
    return p;
  }

  // ---------- Çizim

  #render(focus = false) {
    const geo = this.#geo;
    if (!geo || !this.#idx) return;
    const { level } = this.#view;
    const child = CHILD[level];
    const svg = this.#$('.m');
    const map = this.#$('.map');
    if (!svg) return;
    this.#$('.msg').textContent = '';
    this.#vb = geo.viewBox.split(/[\s,]+/).map(Number);
    this.#setZ(this.#vb.slice());
    const selId = this.#sel[child]?.id;
    const isLeaf = child === (this.mode === 'il' ? 'il' : 'ilce');
    const marked = (id) => id === selId && (!isLeaf || !!this.#value);
    let html = '';
    for (const g of geo.items) {
      const it = this.#idx[child].get(g.id);
      const on = this.#on(child, g.id);
      const sel = marked(g.id);
      const part = `item${level === 'turkiye' ? ' region' : ''}${sel ? ' item-selected' : ''}${on ? '' : ' item-disabled'}`;
      const color = level === 'turkiye' && it ? ` style="--c:var(--tks-region-${(it.n % 7) + 1})"` : '';
      html += `<path d="${g.d}" data-id="${esc(g.id)}" role="option" tabindex="-1" part="${part}" aria-label="${esc(it?.name ?? g.id)}" aria-selected="${sel}"${on ? '' : ' aria-disabled="true"'}${color}/>`;
    }
    svg.innerHTML = `<g>${html}</g>`;
    const first = svg.querySelector('path[aria-selected="true"]') || svg.querySelector('path:not([aria-disabled])');
    if (first) first.tabIndex = 0;
    const path = this.#path();
    svg.setAttribute('aria-label', path[path.length - 1].name);
    map.classList.toggle('zm', level === 'il');
    this.#$('.zoom').hidden = level !== 'il';

    // Breadcrumb
    const min = this.#minLevel();
    let nav = path
      .map((p, i) =>
        i === path.length - 1
          ? `<span aria-current="location">${esc(p.name)}</span>`
          : `<button type="button" data-l="${p.level}" data-id="${p.id ?? ''}"${i < min ? ' disabled' : ''}>${esc(p.name)}</button>`,
      )
      .join('<i aria-hidden="true">›</i>');
    if (level === 'il' && this.#sel.ilce && this.#value && this.#sel.il?.id === this.#view.id)
      nav += `<i aria-hidden="true">›</i><span>${esc(this.#sel.ilce.name)}</span>`;
    this.#$('nav').innerHTML = nav;

    // Liste fallback
    const items = geo.items
      .map((g) => this.#idx[child].get(g.id))
      .filter(Boolean)
      .sort(byName);
    this.#$('.list').innerHTML = items
      .map(
        (it) =>
          `<li><button type="button" data-id="${esc(it.id)}" aria-pressed="${marked(it.id)}"${this.#on(child, it.id) ? '' : ' disabled'}>${esc(it.name)}</button></li>`,
      )
      .join('');
    this.#say(this.#t('showing', path[path.length - 1].name, items.filter((it) => this.#on(child, it.id)).length));
    this.#sync();
    if (focus) this.#focusMap();
  }

  #focusMap() {
    this.#$('.m path[tabindex="0"]')?.focus();
  }

  #say(msg) {
    const s = this.#$('.sr');
    if (s) s.textContent = msg;
  }

  #tip(p, e) {
    const tip = this.#$('.tip');
    if (!tip) return;
    if (!p) return void (tip.hidden = true);
    const box = this.#$('.map').getBoundingClientRect();
    const r = p.getBoundingClientRect();
    const x = e ? e.clientX : r.left + r.width / 2;
    const y = e ? e.clientY : r.top + r.height / 2;
    tip.textContent = p.getAttribute('aria-label');
    tip.style.left = `${x - box.left}px`;
    tip.style.top = `${y - box.top}px`;
    tip.hidden = false;
  }

  // ---------- Klavye

  #mapKey(e) {
    const p = e.target.closest('path');
    if (!p) return;
    const k = e.key;
    if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      this.#pick(p.dataset.id, true);
      return;
    }
    if (k === '+' || k === '-') {
      if (this.#view.level === 'il') this.#zoomAt(null, k === '+' ? 0.66 : 1.5);
      return;
    }
    const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[k];
    const all = [...this.#$('.m').querySelectorAll('path')];
    let next;
    if (k === 'Home') next = all[0];
    else if (k === 'End') next = all[all.length - 1];
    else if (dir) {
      const pos = new Map(this.#geo.items.map((g) => [g.id, g]));
      const a = pos.get(p.dataset.id);
      let best = Infinity;
      for (const q of all) {
        const b = pos.get(q.dataset.id);
        if (q === p || !b) continue;
        const dx = b.cx - a.cx;
        const dy = b.cy - a.cy;
        const main = dx * dir[0] + dy * dir[1];
        if (main <= 0) continue;
        const score = main + 2 * Math.abs(dx * dir[1] + dy * dir[0]);
        if (score < best) [best, next] = [score, q];
      }
    } else return;
    e.preventDefault();
    if (next) {
      p.tabIndex = -1;
      next.tabIndex = 0;
      next.focus();
    }
  }

  // ---------- Arama

  #suggest(q) {
    const ul = this.#$('.sugg');
    const input = this.#$('input');
    if (!ul) return;
    if (!this.#entries && this.#idx) {
      const e = [];
      const add = (level, it, sub) => this.#on(level, it.id) && e.push({ level, id: it.id, name: it.name, sub, key: normalize(it.name) });
      for (const b of this.#idx.bolge.values()) add('bolge', b, '');
      for (const il of this.#idx.il.values()) add('il', il, this.#idx.bolge.get(il.bolge)?.name);
      if (this.mode === 'ilce') for (const c of this.#idx.ilce.values()) add('ilce', c, this.#idx.il.get(c.il)?.name);
      this.#entries = e;
    }
    this.#hits = q && this.#entries ? search(this.#entries, q) : [];
    this.#hi = this.#hits.length ? 0 : -1;
    ul.innerHTML = q
      ? this.#hits.length
        ? this.#hits.map((h, i) => `<li role="option" id="s${i}" data-i="${i}" aria-selected="${i === 0}">${esc(h.name)}<small>${esc(h.sub || '')}</small></li>`).join('')
        : `<li aria-disabled="true">${this.#t('noResult')}</li>`
      : '';
    ul.hidden = !q;
    input.setAttribute('aria-expanded', String(!!q));
    input.setAttribute('aria-activedescendant', this.#hi >= 0 ? 's0' : '');
  }

  #searchKey(e) {
    const n = this.#hits.length;
    const input = e.target;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!n) return;
      this.#hi = (this.#hi + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
      this.#$('.sugg')
        .querySelectorAll('li')
        .forEach((li, i) => li.setAttribute('aria-selected', String(i === this.#hi)));
      input.setAttribute('aria-activedescendant', 's' + this.#hi);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.#hi >= 0) this.#useHit(this.#hi);
    } else if (e.key === 'Escape' && input.value) {
      e.preventDefault();
      e.stopPropagation();
      input.value = '';
      this.#suggest('');
    }
  }

  #useHit(i) {
    const h = this.#hits[i];
    const input = this.#$('input');
    if (!h) return;
    input.value = '';
    this.#suggest('');
    if (h.level === 'ilce' && !this.readOnly) {
      // Önce il haritasını aç, sonra ilçeyi seç
      this.#choose('ilce', h.id, true);
    } else this.#choose(h.level, h.id, true);
  }

  // ---------- Zoom / pan (yalnız il görünümü)

  #setZ(z) {
    const [x0, y0, w0, h0] = this.#vb;
    z[2] = Math.min(w0, Math.max(w0 / 10, z[2]));
    z[3] = (z[2] / w0) * h0;
    z[0] = Math.min(x0 + w0 - z[2], Math.max(x0, z[0]));
    z[1] = Math.min(y0 + h0 - z[3], Math.max(y0, z[1]));
    this.#z = z;
    this.#$('.m').setAttribute('viewBox', z.join(' '));
  }

  /** @param {{x: number, y: number}|null} p SVG koordinatı; null = merkez @param {number} k ölçek (<1 yakınlaştır) */
  #zoomAt(p, k) {
    const z = this.#z;
    p ||= { x: z[0] + z[2] / 2, y: z[1] + z[3] / 2 };
    this.#setZ([p.x - (p.x - z[0]) * k, p.y - (p.y - z[1]) * k, z[2] * k, z[3] * k]);
  }

  #svgPt(cx, cy) {
    const m = this.#$('.m').getScreenCTM();
    return m ? new DOMPoint(cx, cy).matrixTransform(m.inverse()) : null;
  }

  #wheel(e) {
    if (this.#view.level !== 'il') return;
    e.preventDefault();
    this.#zoomAt(this.#svgPt(e.clientX, e.clientY), Math.exp(e.deltaY * 0.0015));
  }

  #pdown(e) {
    if (this.#view.level !== 'il' || (e.pointerType === 'mouse' && e.button)) return;
    this.#ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    this.#drag = false;
  }

  #pmove(e) {
    const p = this.#ptr.get(e.pointerId);
    if (!p) return;
    const m = this.#$('.m').getScreenCTM();
    if (!m) return;
    if (this.#ptr.size === 2) {
      const [a, b] = [...this.#ptr.values()];
      const d0 = Math.hypot(a.x - b.x, a.y - b.y);
      p.x = e.clientX;
      p.y = e.clientY;
      const d1 = Math.hypot(a.x - b.x, a.y - b.y);
      if (d0 && d1) this.#zoomAt(this.#svgPt((a.x + b.x) / 2, (a.y + b.y) / 2), d0 / d1);
      this.#drag = true;
      return;
    }
    if (!this.#drag && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 5) return;
    if (!this.#drag) {
      this.#drag = true;
      this.#$('.map').setPointerCapture?.(e.pointerId);
      this.#tip(null);
    }
    const z = this.#z;
    this.#setZ([z[0] - (e.clientX - p.x) / m.a, z[1] - (e.clientY - p.y) / m.d, z[2], z[3]]);
    p.x = e.clientX;
    p.y = e.clientY;
  }

  #pup(e) {
    this.#ptr.delete(e.pointerId);
    // click event'i pointerup'tan sonra gelir; sürükleme bayrağını bir tur sonra temizle
    if (this.#drag && !this.#ptr.size) setTimeout(() => (this.#drag = false));
  }

  // ---------- Popover

  #onToggle(open) {
    this.#$('.field')?.setAttribute('aria-expanded', String(open));
    const reposition = () => this.#place();
    if (open) {
      this.#place();
      addEventListener('scroll', reposition, { capture: true, passive: true });
      addEventListener('resize', reposition);
      this.#off = () => {
        removeEventListener('scroll', reposition, { capture: true });
        removeEventListener('resize', reposition);
      };
      requestAnimationFrame(() => (this.#$('input') || this.#$('.m path[tabindex="0"]'))?.focus());
    } else {
      this.#off?.();
      this.#$('.field')?.focus();
    }
  }

  #place() {
    const f = this.#$('.field');
    const p = this.#$('.panel');
    const r = f.getBoundingClientRect();
    const pw = p.offsetWidth;
    const ph = p.offsetHeight;
    const below = innerHeight - r.bottom >= ph + 8 || r.top < ph + 8;
    p.style.left = `${Math.max(8, Math.min(r.left, innerWidth - pw - 8))}px`;
    p.style.top = `${below ? r.bottom + 4 : r.top - ph - 4}px`;
  }

  #toggleFallback(open) {
    const p = this.#$('.panel');
    if (p.classList.contains('open') === open) return;
    p.classList.toggle('open', open);
    const outside = (e) => !e.composedPath().includes(this) && this.#toggleFallback(false);
    const esc = (e) => e.key === 'Escape' && this.#toggleFallback(false);
    if (open) {
      this.#onToggle(true);
      const off = this.#off;
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('keydown', esc, true);
      this.#off = () => {
        document.removeEventListener('pointerdown', outside, true);
        document.removeEventListener('keydown', esc, true);
        off?.();
      };
    } else this.#onToggle(false);
  }
}

// Attribute ↔ property yansıtması (string ve boolean olanlar)
for (const a of STR) {
  const p = camel(a);
  if (Object.getOwnPropertyDescriptor(TrGeoPicker.prototype, p)) continue;
  Object.defineProperty(TrGeoPicker.prototype, p, {
    get() {
      return this.getAttribute(a);
    },
    set(v) {
      v == null ? this.removeAttribute(a) : this.setAttribute(a, v);
    },
  });
}
for (const a of BOOL) {
  const p = camel(a);
  if (Object.getOwnPropertyDescriptor(TrGeoPicker.prototype, p)) continue;
  Object.defineProperty(TrGeoPicker.prototype, p, {
    get() {
      return this.hasAttribute(a);
    },
    set(v) {
      this.toggleAttribute(a, !!v);
    },
  });
}
for (const a of ['mode', 'valueType', 'display', 'locale', 'nameSeparator']) {
  const d = Object.getOwnPropertyDescriptor(TrGeoPicker.prototype, a);
  const attr = a.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
  Object.defineProperty(TrGeoPicker.prototype, a, {
    get: d.get,
    set(v) {
      this.setAttribute(attr, v);
    },
  });
}

customElements.get(TAG_NAME) || customElements.define(TAG_NAME, TrGeoPicker);
