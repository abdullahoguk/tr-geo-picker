import { test, expect } from '@playwright/test';

/** Fixture'ı açar, verilen HTML'i bir form içine koyar ve ilk harita çizilene kadar bekler. */
async function mount(page, html, setup) {
  await page.goto('/test/fixture.html');
  await page.waitForFunction(() => window.ready);
  await page.evaluate(
    ([html, setup]) => {
      const form = document.createElement('form');
      form.id = 'f';
      form.innerHTML = html;
      if (setup) new Function('form', setup)(form);
      document.body.append(form);
    },
    [html, setup?.toString().replace(/^[^{]*{|}$/g, '')],
  );
  await waitMap(page);
  return page.locator('tr-geo-picker');
}

const waitMap = (page) => page.waitForFunction(() => document.querySelector('tr-geo-picker')?.shadowRoot?.querySelector('.m path'));
const formData = (page) => page.evaluate(() => [...new FormData(document.getElementById('f'))]);
const chip = (el, name) => el.locator('.list button', { hasText: new RegExp(`^${name}$`) });
const viewIs = (el, label) => expect(el.locator('svg.m')).toHaveAttribute('aria-label', label);

test('ilçe modu: Türkiye › bölge › il › ilçe ve form değeri (id)', async ({ page }) => {
  const el = await mount(page, '<tr-geo-picker name="ilce"></tr-geo-picker>');
  await viewIs(el, 'Türkiye');
  await chip(el, 'Karadeniz Bölgesi').click();
  await viewIs(el, 'Karadeniz Bölgesi');
  await chip(el, 'Düzce').click();
  await viewIs(el, 'Düzce');
  await chip(el, 'Akçakoca').click();
  expect(await formData(page)).toEqual([['ilce', '1815']]);
  await expect(el.locator('path[data-id="1815"]')).toHaveAttribute('aria-selected', 'true');
  await expect(el.locator('nav')).toContainText('Akçakoca');
});

test('il modu: il seçimiyle biter', async ({ page }) => {
  const el = await mount(page, '<tr-geo-picker name="il" mode="il"></tr-geo-picker>');
  await chip(el, 'Karadeniz Bölgesi').click();
  await chip(el, 'Düzce').click();
  await viewIs(el, 'Karadeniz Bölgesi');
  expect(await formData(page)).toEqual([['il', '81']]);
});

const CUSTOM = (form) => {
  const el = form.querySelector('tr-geo-picker');
  el.data = {
    bolgeler: [{ id: 'karadeniz', name: 'Karadeniz Bölgesi', iller: ['81'] }],
    iller: [{ id: '81', name: 'Düzce', bolge: 'karadeniz', value: 'IL_81' }],
    ilceler: [
      { id: '1815', name: 'Akçakoca', il: '81', value: 'ILCE_5521' },
      { id: '1814', name: 'Cumayeri', il: '81' },
    ],
  };
};

for (const [mode, vt, value, expected] of [
  ['ilce', 'id', '1815', '1815'],
  ['ilce', 'name', 'düzce/AKÇAKOCA', 'Düzce/Akçakoca'],
  ['ilce', 'custom', 'ILCE_5521', 'ILCE_5521'],
  ['il', 'id', '81', '81'],
  ['il', 'name', 'Düzce', 'Düzce'],
  ['il', 'custom', 'IL_81', 'IL_81'],
]) {
  test(`value-type: mode=${mode} value-type=${vt}`, async ({ page }) => {
    const el = await mount(page, `<tr-geo-picker name="x" mode="${mode}" value-type="${vt}" value="${value}"></tr-geo-picker>`, vt === 'custom' ? CUSTOM : null);
    await expect.poll(() => formData(page)).toEqual([['x', expected]]);
    // Önceden seçili açılış: ilgili haritada seçim işaretli
    const id = mode === 'il' ? '81' : '1815';
    await expect(el.locator(`path[data-id="${id}"]`)).toHaveAttribute('aria-selected', 'true');
    // UI ile yeniden seçim de aynı değeri üretir
    await el.evaluate((e) => e.reset());
    expect(await formData(page)).toEqual([['x', '']]);
    await el.evaluate((e, id) => e.select(id), id);
    await expect.poll(() => formData(page)).toEqual([['x', expected]]);
  });
}

test('custom: value yoksa id kullanılır ve uyarı verilir', async ({ page }) => {
  const warnings = [];
  page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()));
  const el = await mount(page, '<tr-geo-picker name="x" value-type="custom"></tr-geo-picker>', CUSTOM);
  await el.evaluate((e) => e.select('1814'));
  await expect.poll(() => formData(page)).toEqual([['x', '1814']]);
  expect(warnings.some((w) => w.includes('Cumayeri'))).toBe(true);
});

test('emit-fields: ayrı alanlar gönderilir', async ({ page }) => {
  await mount(page, '<tr-geo-picker name="lok" emit-fields value="1815"></tr-geo-picker>');
  await expect
    .poll(() => formData(page))
    .toEqual([
      ['lok', '1815'],
      ['lok_bolge', 'karadeniz'],
      ['lok_il', '81'],
      ['lok_ilce', '1815'],
    ]);
});

test('required, :invalid ve form reset', async ({ page }) => {
  const el = await mount(page, '<tr-geo-picker name="ilce" required value="1815"></tr-geo-picker><button type="reset">r</button>');
  await expect.poll(() => el.evaluate((e) => e.checkValidity())).toBe(true);
  await el.evaluate((e) => (e.value = ''));
  expect(await el.evaluate((e) => [e.checkValidity(), e.matches(':invalid'), e.validity.valueMissing])).toEqual([false, true, true]);
  expect(await page.evaluate(() => document.getElementById('f').checkValidity())).toBe(false);
  await page.click('button[type=reset]');
  await expect.poll(() => formData(page)).toEqual([['ilce', '1815']]);
  expect(await el.evaluate((e) => e.matches(':valid'))).toBe(true);
});

test('dataProvider: özel yükleyici ve zincire düşme', async ({ page }) => {
  const el = await mount(page, '<tr-geo-picker name="x"></tr-geo-picker>', (form) => {
    const el = form.querySelector('tr-geo-picker');
    window.calls = [];
    el.dataProvider = async (level, id) => {
      window.calls.push(level + ':' + (id ?? ''));
      if (level === 'catalog')
        return {
          bolgeler: [{ id: 'karadeniz', name: 'Karadeniz', iller: ['81'] }],
          iller: [{ id: '81', name: 'Düzce', bolge: 'karadeniz' }],
          ilceler: [{ id: '1815', name: 'Akçakoca', il: '81' }],
        };
      return null; // geometri paketten
    };
  });
  await chip(el, 'Karadeniz').click();
  await chip(el, 'Düzce').click();
  await chip(el, 'Akçakoca').click();
  expect(await formData(page)).toEqual([['x', '1815']]);
  expect(await page.evaluate(() => window.calls)).toEqual(['catalog:', 'turkiye:', 'bolge:karadeniz', 'il:81']);
  // Katalogda olmayan öğeler pasif
  await expect(el.locator('path[data-id="1814"]')).toHaveAttribute('aria-disabled', 'true');
});

test('data-src: harici klasör ve hata event\'i', async ({ page }) => {
  const el = await mount(page, '<tr-geo-picker name="x" data-src="/data"></tr-geo-picker>');
  await viewIs(el, 'Türkiye');
  const err = await el.evaluate(
    (e) =>
      new Promise((res) => {
        e.addEventListener('tks-error', (ev) => res(ev.detail.level), { once: true });
        e.setAttribute('data-src', '/yok/');
      }),
  );
  expect(err).toBe('catalog');
});

test('filter: pasif öğeler seçilemez', async ({ page }) => {
  const el = await mount(page, '<tr-geo-picker name="x"></tr-geo-picker>', (form) => {
    form.querySelector('tr-geo-picker').filter = (it) => it.level !== 'ilce' || it.name !== 'Akçakoca';
  });
  await el.evaluate((e) => e.goTo('il', '81'));
  await viewIs(el, 'Düzce');
  await expect(el.locator('path[data-id="1815"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(chip(el, 'Akçakoca')).toBeDisabled();
  await el.evaluate((e) => e.select('1815'));
  expect(await formData(page)).toEqual([['x', '']]);
});

test('yalnız klavye ile ilçe seçimi', async ({ page }) => {
  const el = await mount(page, '<tr-geo-picker name="x" searchable="false"></tr-geo-picker>');
  await page.keyboard.press('Tab'); // haritadaki ilk öğe
  await expect(el.locator('path:focus')).toHaveCount(1);
  await page.keyboard.press('Enter'); // bölgeye in
  await expect(el.locator('svg.m')).not.toHaveAttribute('aria-label', 'Türkiye');
  await expect(el.locator('path:focus')).toHaveCount(1);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter'); // ile in
  await expect(el.locator('.zoom')).toBeVisible();
  await page.keyboard.press('Enter'); // ilçeyi seç
  await expect.poll(async () => (await formData(page))[0][1]).not.toBe('');
  await page.keyboard.press('Escape'); // bir seviye yukarı
  await expect(el.locator('.zoom')).toBeHidden();
});

for (const [q, expected] of [
  ['İSTANBUL', 'İstanbul'],
  ['istanbul', 'İstanbul'],
  ['ığdır', 'Iğdır'],
  ['IGDIR', 'Iğdır'],
  ['kadık', 'Kadıköy'],
]) {
  test(`Türkçe arama: "${q}"`, async ({ page }) => {
    const el = await mount(page, '<tr-geo-picker name="x"></tr-geo-picker>');
    await el.locator('input[type=search]').fill(q);
    await expect(el.locator('.sugg li').first()).toContainText(expected);
  });
}

test('arama ile doğrudan ilçe seçimi', async ({ page }) => {
  const el = await mount(page, '<tr-geo-picker name="x"></tr-geo-picker>');
  const input = el.locator('input[type=search]');
  await input.fill('kadık');
  await input.press('Enter');
  await expect.poll(() => formData(page)).toEqual([['x', '1360']]);
  await viewIs(el, 'İstanbul');
});

test('input event\'i iç arama kutusundan sızmaz; change yalnız son seviyede', async ({ page }) => {
  const el = await mount(page, '<tr-geo-picker name="x"></tr-geo-picker>');
  await page.evaluate(() => {
    window.ev = [];
    const e = document.querySelector('tr-geo-picker');
    for (const t of ['input', 'change']) e.addEventListener(t, (x) => window.ev.push(t + ':' + (x.detail?.value ?? 'native')));
  });
  await el.locator('input[type=search]').fill('xyz');
  await chip(el, 'Karadeniz Bölgesi').click();
  await chip(el, 'Düzce').click();
  await chip(el, 'Akçakoca').click();
  expect(await page.evaluate(() => window.ev)).toEqual(['input:', 'input:', 'input:1815', 'change:1815']);
});

test('popover: açılır, seçimle kapanır, alan metni güncellenir', async ({ page }) => {
  const el = await mount(page, '<tr-geo-picker name="x" display="popover" start-il="81"></tr-geo-picker>');
  await expect(el.locator('.panel')).toBeHidden();
  await el.locator('.field').click();
  await expect(el.locator('.panel')).toBeVisible();
  await chip(el, 'Akçakoca').click();
  await expect(el.locator('.panel')).toBeHidden();
  await expect(el.locator('.field')).toContainText('Akçakoca, Düzce');
});

test('lock-level: start-il üstüne çıkılamaz', async ({ page }) => {
  const el = await mount(page, '<tr-geo-picker name="x" start-il="81" lock-level></tr-geo-picker>');
  await viewIs(el, 'Düzce');
  await expect(el.locator('nav button')).toHaveCount(2);
  for (const b of await el.locator('nav button').all()) await expect(b).toBeDisabled();
  await el.evaluate((e) => e.back());
  await viewIs(el, 'Düzce');
});

test('tema: dark ve özel tema değişkenleri uygulanır', async ({ page }) => {
  const el = await mount(page, '<tr-geo-picker name="x" theme="dark"></tr-geo-picker>');
  const bg = () => el.evaluate((e) => getComputedStyle(e.shadowRoot.querySelector('.panel')).backgroundColor);
  expect(await bg()).toBe('rgb(17, 24, 39)');
  await page.addStyleTag({ content: 'tr-geo-picker[theme="kurumsal"]{--tks-bg:#fffaf3}' });
  await el.evaluate((e) => e.setAttribute('theme', 'kurumsal'));
  expect(await bg()).toBe('rgb(255, 250, 243)');
});
