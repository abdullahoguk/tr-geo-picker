// Resmi il/ilçe listesi: T.C. İçişleri Bakanlığı e-İçişleri "Mülki İdari Bölümler" sayfası.
// Sayfa ASP.NET WebForms; il seçimi postback'i ile ilçe dropdown'u doldurulur. Her il için bir postback yapılır.
import { cached, fetchRetry, log } from './lib/util.mjs';
import { titleCase } from './lib/tr.mjs';

export const OFFICIAL_URL = 'https://www.e-icisleri.gov.tr/Anasayfa/MulkiIdariBolumleri.aspx';
const P = 'ctl00$cph1$CografiBirimControl$';
const UA = 'Mozilla/5.0 (tr-geo-picker data pipeline)';

const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

function options(html, id) {
  const m = html.match(new RegExp(`id="ctl00_cph1_CografiBirimControl_${id}"[^>]*>([\\s\\S]*?)</select>`));
  if (!m) throw new Error(`e-İçişleri: ${id} dropdown bulunamadı (sayfa yapısı değişmiş olabilir)`);
  return [...m[1].matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)</g)]
    .map(([, v, t]) => ({ code: v, name: decode(t).trim() }))
    .filter((o) => o.code !== '-1' && o.code !== '');
}

function hiddenFields(html) {
  const out = {};
  for (const [, n, v] of html.matchAll(/<input type="hidden" name="([^"]+)" id="[^"]*" value="([^"]*)"/g)) out[n] = decode(v);
  return out;
}

function summary(html) {
  const out = {};
  for (const [, k, v] of html.matchAll(/id="ctl00_cph1_CografiBirimControl_lbl(\w+?)Sayisi"[^>]*>\s*([\d.]+)\s*</g))
    out[k] = Number(v.replace(/\./g, ''));
  return out;
}

class Session {
  cookies = new Map();
  async request(body) {
    const headers = { 'User-Agent': UA, Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') };
    if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const res = await fetchRetry(OFFICIAL_URL, { method: body ? 'POST' : 'GET', headers, body });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      this.cookies.set(kv.slice(0, i), kv.slice(i + 1));
    }
    return res.text();
  }
}

export async function fetchOfficial() {
  return cached('official.json', async () => {
    log('resmi liste çekiliyor:', OFFICIAL_URL);
    const s = new Session();
    const home = await s.request();
    const base = hiddenFields(home);
    const iller = options(home, 'DropDownListIl');
    if (!iller.length) throw new Error('e-İçişleri: il listesi boş');
    const out = [];
    for (const il of iller) {
      const form = new URLSearchParams({
        ...base,
        __EVENTTARGET: `${P}DropDownListIl`,
        __EVENTARGUMENT: '',
        [`${P}DropDownListIl`]: il.code,
      });
      let ilceler;
      for (let attempt = 1; ; attempt++) {
        const html = await s.request(form.toString());
        try {
          ilceler = options(html, 'DropDownListIlce');
          if (!ilceler.length) throw new Error(`${il.name}: ilçe listesi boş`);
          break;
        } catch (err) {
          if (attempt >= 3) throw err;
        }
      }
      out.push({
        plaka: il.code.padStart(2, '0'),
        name: titleCase(il.name),
        rawName: il.name,
        ilceler: ilceler.map((o) => ({ code: o.code, name: titleCase(o.name), rawName: o.name })),
      });
      process.stdout.write('.');
    }
    process.stdout.write('\n');
    return { source: OFFICIAL_URL, accessedAt: new Date().toISOString(), summary: summary(home), iller: out };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const o = await fetchOfficial();
  log(`il: ${o.iller.length}, ilçe: ${o.iller.reduce((n, i) => n + i.ilceler.length, 0)}`, o.summary);
}
