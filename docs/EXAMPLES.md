# Örnekler

Örneklerde script yolu `/js/tr-geo/dist/tr-geo-picker.min.js` olarak geçiyor. `data/` klasörü `dist/` ile yan yana durmalıdır (`/js/tr-geo/data/`). Başka bir yerdeyse `data-src` verin.

## Düz HTML formu

```html
<form method="post" action="/kayit">
  <label for="ilce">İlçe</label>
  <tr-geo-picker id="ilce" name="ilce" required></tr-geo-picker>
  <button>Gönder</button>
</form>

<script type="module" src="/js/tr-geo/dist/tr-geo-picker.min.js"></script>
```

Gönderilen veri `ilce=1815` biçimindedir. Seçim yapılmadan gönderilmeye çalışılırsa tarayıcı native doğrulama mesajını gösterir.

## Sadece il modu

```html
<tr-geo-picker name="il" mode="il" value-type="name" display="popover" placeholder="İl seçin"></tr-geo-picker>
```

Form `il=Düzce` gönderir.

## Tek ile kilitli ilçe seçimi

```html
<tr-geo-picker name="ilce" start-il="81" lock-level></tr-geo-picker>
```

Doğrudan Düzce'nin ilçe haritası açılır. Breadcrumb'daki üst seviyeler devre dışıdır ve Esc yukarı çıkmaz.

## Classic ASP

### Kayıt

```asp
<%
' kaydet.asp
Dim ilceKodu, ilKodu
ilceKodu = Request.Form("ilce")       ' "1815"
ilKodu   = Request.Form("ilce_il")    ' "81"  (emit-fields açıksa)

If ilceKodu = "" Then
  Response.Write "İlçe seçilmedi"
  Response.End
End If

Set cmd = Server.CreateObject("ADODB.Command")
cmd.ActiveConnection = conn
cmd.CommandText = "UPDATE Musteri SET IlceKodu = ?, IlKodu = ? WHERE Id = ?"
cmd.Parameters.Append cmd.CreateParameter("ilce", 200, 1, 10, ilceKodu)
cmd.Parameters.Append cmd.CreateParameter("il", 200, 1, 2, ilKodu)
cmd.Parameters.Append cmd.CreateParameter("id", 3, 1, , CLng(Request.Form("id")))
cmd.Execute
%>
```

### Edit formunda seçili açma

```asp
<form method="post" action="kaydet.asp">
  <input type="hidden" name="id" value="<%= rs("Id") %>">
  <tr-geo-picker name="ilce" emit-fields required
                 value="<%= Server.HTMLEncode(rs("IlceKodu") & "") %>"></tr-geo-picker>
  <button>Kaydet</button>
</form>
<script type="module" src="/js/tr-geo/dist/tr-geo-picker.min.js"></script>
```

`value` doluysa bileşen ilgili ilin ilçe haritasını, seçili ilçe işaretli olarak açar. Form reset'te bu değere döner.

### İsimle saklıyorsanız

```asp
<tr-geo-picker name="ilce" value-type="name"
               value="<%= Server.HTMLEncode(rs("Il") & "/" & rs("Ilce")) %>"></tr-geo-picker>
```

Değer büyük/küçük harf ve Türkçe karakter farkına duyarsız eşleştirilir. `DÜZCE/AKÇAKOCA` da Akçakoca'yı seçer.

### Kendi veritabanı id'leriniz

```asp
<tr-geo-picker id="lok" name="lokasyon_id" value-type="custom"
               value="<%= rs("LokasyonId") %>"></tr-geo-picker>
<script type="module">
  import '/js/tr-geo/dist/tr-geo-picker.min.js';
  // /api/lokasyon-katalog.asp, catalog.json biçiminde ve her ilçede "value" alanıyla döner
  document.getElementById('lok').data = await fetch('/api/lokasyon-katalog.asp').then((r) => r.json());
</script>
```

## PHP

```php
<tr-geo-picker name="ilce" value="<?= htmlspecialchars($kayit['ilce_kodu'] ?? '') ?>"></tr-geo-picker>
<?php $ilce = $_POST['ilce'] ?? ''; ?>
```

## React 19

React 19 custom element'lere property'leri doğrudan aktarır. `data`, `filter` ve `dataProvider` prop olarak verilebilir. Event'ler `on` + event adı ile dinlenir.

```jsx
import 'tr-geo-picker';

export function AdresFormu({ izinliIlceler }) {
  const [secim, setSecim] = useState(null);
  return (
    <form action={kaydet}>
      <tr-geo-picker
        name="ilce"
        required
        filter={(it) => it.level !== 'ilce' || izinliIlceler.includes(it.id)}
        onchange={(e) => setSecim(e.detail.selection)}
      />
      {secim && <p>{secim.ilce.name}, {secim.il.name}</p>}
      <button>Kaydet</button>
    </form>
  );
}
```

TypeScript için `types/index.d.ts` içinde `TrGeoPicker` tipi ve `HTMLElementTagNameMap` kaydı vardır. JSX tipleri için:

```ts
import type { TrGeoPicker } from 'tr-geo-picker';
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'tr-geo-picker': React.DetailedHTMLProps<React.HTMLAttributes<TrGeoPicker>, TrGeoPicker> & Partial<TrGeoPicker> & { onchange?: (e: CustomEvent) => void };
    }
  }
}
```

## Vue 3

Vue'ya etiketin custom element olduğunu bildirin:

```js
// vite.config.js
import vue from '@vitejs/plugin-vue';
export default {
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'tr-geo-picker' } } })],
};
```

```vue
<script setup>
import 'tr-geo-picker';
import { ref } from 'vue';
const ilce = ref('1815');
</script>

<template>
  <form>
    <tr-geo-picker name="ilce" :value="ilce" @change="ilce = $event.detail.value" required />
    <p>Seçili: {{ ilce }}</p>
  </form>
</template>
```

Property olarak vermek için `.prop` niteleyicisini kullanın: `:data.prop="katalog"`, `:filter.prop="fn"`.

## Event'leri dinlemek

```js
const el = document.querySelector('tr-geo-picker');
el.addEventListener('change', (e) => {
  const { value, selection } = e.detail;
  console.log(value, selection.il.name, selection.ilce?.name);
});
el.addEventListener('tks-error', (e) => console.error('Harita verisi yüklenemedi', e.detail.error));
```

## Programatik kontrol

```js
el.goTo('il', '34');   // İstanbul ilçe haritası
el.select('1360');     // Kadıköy'ü seç
el.back();             // bir seviye yukarı
el.reset();            // temizle
el.value = '1815';     // değerle seç
```
