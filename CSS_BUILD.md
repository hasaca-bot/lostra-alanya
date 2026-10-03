# Stil dosyasını derleme

Site, depoya eklenen `tailwind.css` dosyasını doğrudan sunar. Siteyi çalıştırmak için Node.js, npm veya Tailwind CDN bağlantısı gerekmez.

`index.html` veya `app.js` içinde Tailwind sınıfları değiştirildiğinde, proje klasöründe Node.js ve npm ile:

```sh
npm ci --ignore-scripts
npm run build:css
```

Tema renkleri, yazı boyutları ve diğer değerler `tailwind.config.cjs` içindedir. Kaynak CSS `tailwind-input.css`, derlenen çıktı `tailwind.css` dosyasıdır. Derlenen dosyayı kaynak değişiklikleriyle birlikte depoya ekleyin. Paket sürümleri `package-lock.json` ile sabitlenmiştir; bunlar yalnızca geliştirme araçlarıdır.

JavaScript içinden eklenen Tailwind sınıflarını tam metin olarak yazın; örneğin `bg-primary`. Sınıf adlarını parçalardan birleştirmeyin. Yeni bir kaynak dosyada Tailwind sınıfları kullanılırsa bu dosyayı yapılandırmadaki `content` listesine ekleyin.

`site.css`, `tracking-ui.css` ve `chat-ui.css` derlemeden sonra yüklenir; mevcut uygulama stilleri ve erişilebilirlik düzeltmeleri aynı önceliği korur.

## Geliştirme bağımlılığı notu

3 Ekim 2026 tarihli `npm audit`, Tailwind 3'ün dolaylı `braces` bağımlılığında iç içe dosya desenleriyle tetiklenebilen bir hizmet engelleme açığı bildiriyor (`GHSA-vfj7-8cjw-p6xm`). Henüz düzeltilmiş bir `braces` sürümü bulunmuyor. Mevcut derleme yalnızca yapılandırmadaki sabit, projeye ait dosya yollarını tarar; kullanıcı girdilerini derleme desenlerine eklemeyin. Bu araçlar sunucuda veya ziyaretçinin tarayıcısında çalışmaz. Tailwind 4'e geçiş, tarayıcı desteği ve mevcut görünüm ayrıca doğrulanarak yapılmalıdır.
