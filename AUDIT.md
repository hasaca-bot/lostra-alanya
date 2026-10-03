# Proje taraması — 3 Ekim 2026

## Düzeltilen sorunlar

| Alan | Bulgu | Yapılan düzeltme |
| --- | --- | --- |
| Mantık | Yeni talep listesi ağ hatasından sonra son sürüme erişemeyebiliyordu. | Başarılı yükleme olmadan sürüm kabul edilmiyor; sonraki bellek kontrolü yeniden deniyor. Sunucu yeniden başladığında sürüm yeniden kullanılmıyor. |
| Mantık | İki hızlı yönetici işlemi bir talebi iki aşama ilerletebiliyordu. | `expected_status` ve düzenleme zamanı kontrolü; çakışmaya `409` yanıtı. İstemcide tekrar tıklama engeli. |
| Mantık | Ayarlar ekranında 61–80 karakterlik seçenekler formda sunulabiliyor, sunucuda reddediliyordu. | Müşteri talebi aynı 80 karakter sınırını kullanıyor; seçilen ürün ve hizmetler güncel ayarlara göre doğrulanıyor. |
| Kullanılabilirlik | Fotoğraf alanı sürükleyip bırakmayı vaat edip uygulamıyordu. | Dosya bırakma, anlık tür/boyut geri bildirimi ve önizleme eklendi. |
| Kullanılabilirlik | Yönetici detayındaki kaydedilmemiş değişiklikler veya canlı yenileme kullanıcıyı yanıltabiliyordu. | Kapanışta uyarı, odak yönetimi, eski kayıt uyarısı ve yeniden yükleme denemesi eklendi. |
| Kullanılabilirlik | Sohbet akışı boş/yarım kalınca geçmiş sırası bozulabiliyordu. | Zaman aşımı, giriş kilidi ve başarısız mesaja geri dönüş eklendi. |
| Güvenlik | Müşteri sohbet akışındaki beklenmedik araç çağrısı yönetici işlemine ulaşabiliyordu. | Araç çağrıları yalnızca yönetici sohbetinde işleniyor. |
| Güvenlik | Dosya başlığı doğru fakat içeriği bozuk bir görsel saklanabiliyordu; fotoğraf metaverisi kalıyordu. | Pillow ile tam çözümleme, boyut denetimi, sabit görsel denetimi ve metaverisiz yeniden kodlama. |
| Güvenlik | Farklı köken, bozuk JSON, sınırsız gövde ve yoğun asistan istekleri yeterince denetlenmiyordu. | Köken ve istek biçimi kontrolü, güvenlik başlıkları, hız/eşzamanlılık sınırları, JSON nesne denetimi. |
| Uyumluluk | Tailwind CDN'si çalışma anında üçüncü taraf JavaScript'e bağlıydı. | Derlenmiş yerel CSS kullanılıyor; derleme yönergesi ve sürüm kilidi eklendi. |
| Maliyet | Tekrarlanan ziyaret isteği veritabanını gereksiz açabiliyordu. | Günlük imzalı oturum çerezi aynı oturumun ikinci sayımını bellekte önlüyor. |
| Güvenlik | Yönetim sayfası ve müşteri fotoğrafları internette şifresiz açılabiliyordu. | Sunucuda doğrulanan yönetici girişi, 12 saatlik oturum, çıkış ve yönetim uç noktalarında yetki denetimi eklendi. |

## Doğrulama

- `python -m unittest discover -p "test_*.py" -q`: yönetici oturumu dahil 30 test geçti.
- `node --check app.js`, `admin.js`, `chat-ui.js`; `python -m py_compile` ve `git diff --check`: geçti.
- Gerçek tarayıcıda müşteri ana sayfası, takip sonucu, yönetici panosu, açılıp kapanan menü, karanlık mod, tam ekran asistan ve ayarlar açıldı. Yeni talep başka bir istekte oluşturulunca panelde yenilemeden belirdi; aşama düğmesi ve takip çubuğu doğrulandı. Tarayıcı konsolunda hata görülmedi.
- Bu oturumda tarayıcıya mobil görünüm boyutu verilmesi desteklenmediği için gerçek mobil görsel kontrolü tamamlanmadı. Mevcut CSS kırılma noktaları koddan gözden geçirildi.
- Yönetici giriş ekranı tarayıcıda açıldı; yanlış şifre reddedildi, doğru şifre paneli açtı ve çıkış tekrar giriş ekranına döndürdü. Tarayıcı konsolunda hata görülmedi.

## Yayın öncesi kalan işler

1. Yayın sırasında güçlü `LOSTRA_ADMIN_PASSWORD` değeri girilmeli; gerçek müşteri verisi için Render kalıcı diski ve yedekleri hazırlanmalı. Ayrıntı [RENDER_KURULUM.md](RENDER_KURULUM.md) dosyasında.
2. Test amacıyla sohbet içinde paylaşılan Gemini anahtarı yenilenmeli. SQLite yedeği de özel tutulmalı.
3. Site içeriğindeki işletme kuruluş yılı, örnek çalışma görselleri, hizmet ve ücretsiz ekspertiz gibi ticari iddialar işletme tarafından onaylanmalı.
4. Tailwind 3'ün yalnızca derleme sırasında kullanılan dolaylı `braces` paketinde açık bildirimi var. Derleme sabit proje yollarıyla çalışır; ayrıntı [CSS_BUILD.md](CSS_BUILD.md) dosyasında.

Hiçbir tarama kusursuzluk garantisi vermez. Bu kontroller test edilen akışlar ve mevcut tehditler için somut düzeltmelerdir.
