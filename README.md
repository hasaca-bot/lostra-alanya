# Lostra Alanya

Gönderilen HTML tasarımı üzerine kurulan müşteri sitesi ve talep yönetim paneli.

## Yerel çalıştırma

Python 3.10+ ile bu klasörde:

```powershell
python server.py
```

- Müşteri sitesi: http://127.0.0.1:8765/
- Yönetim paneli: http://127.0.0.1:8765/admin
- Canlı tanılama: http://127.0.0.1:8765/diagnostics
- Port değiştirmek için: `$env:LOSTRA_PORT='8766'; python server.py`

Ek Python paketi gerekmez. İlk açılışta `data/lostra.sqlite3` ve `data/uploads/` oluşturulur. Bu klasörü düzenli yedekleyin; müşteri ve fotoğraf verileri buradadır.

## Akış

1. Müşteri ad, telefon, marka/model, ürün türü, işlem seçimi ve 1–3 fotoğraf ile talep oluşturur. Fotoğraflar JPG, PNG veya WebP ve en fazla 5 MB olabilir.
2. Sunucu rastgele `LA-XXXX-XXXX` takip kodu oluşturur ve kaydı `Yeni` durumuyla saklar.
3. Yönetim paneli talepleri `Yeni`, `İnceleniyor`, `Hazırlanıyor`, `Tamamlandı`, `Gönderildi`, `Teslim Edildi` sütunlarında gösterir. Her talep kartındaki düğme durumu tek tıklamayla sıradaki aşamaya taşır; son aşamada düğme görünmez. Müşteri/ürün detayları, fotoğraflar, model ve iç not görülebilir; durum, model ve iç not ayrıca detay ekranından değiştirilebilir.
4. Müşteri takip koduyla sorguladığında güncel durum ve SVG simgeli ilerleme çubuğu görünür. Talep `Teslim Edildi` durumuna geçtikten sonra yönetici yorum izni açarsa müşteri koduyla bir kez puan ve yorum gönderebilir; adını gizleyebilir.
5. Yönetim panelindeki **Site Yapılandırması** bölümünden sayfa metinleri, galeri kartları, ürün türleri ve işlem seçenekleri düzenlenir. Galeriye en fazla 24 kart eklenebilir; yeni görseller yalnızca dosya yüklenerek seçilir. Süreç adlarının düzenlenmesi kapalıdır. Değişiklikler yeni açılan müşteri sayfasında geçerlidir.
6. **Ziyaretçi Grafiği** son 14 günü gösterir. Tarayıcı oturumu günde bir kez sayılır; sayı benzersiz kişi veya kimlik doğrulanmış kullanıcı sayısı değildir.
7. **Site Yapılandırması → Gemini bağlantısı** alanına API anahtarını girip kaydedin, ardından “Bağlantıyı test et” düğmesini kullanın. Anahtar tarayıcıya geri gönderilmez ve herkese açık `/api/site` yanıtına eklenmez. Müşteri asistanı yalnızca güncel site içeriğini kaynak alır. Panel asistanı talep arayabilir, ayrıntı okuyabilir, durum/model/iç not/yorum iznini mevcut kurallarla güncelleyebilir. Sohbet ve Gemini isteği yalnızca mesaj gönderildiğinde çalışır. Yönetici komutları müşteri verilerini Gemini hizmetine iletebilir.
8. Talep `Tamamlandı`, `Gönderildi` veya `Teslim Edildi` durumundayken karttaki veya detay ekranındaki **Müşteriye mesaj hazırla** düğmesi WhatsApp'ta önceden yazılmış bir taslak açar. Yönetici mesajı kontrol edip WhatsApp'taki gönder düğmesine kendisi basar. Gemini etkinse yalnızca durum için hazırlanmış genel metni daha doğal yazar; müşteri adı, telefon, model, fotoğraf ve takip kodu Gemini'ye gönderilmez. Gemini erişilemezse hazır metin kullanılır. Telefon numarası WhatsApp bağlantısı için uluslararası biçime dönüştürülür. Düğmeye basılmadıkça bu işlem için veritabanı veya Gemini çağrısı yapılmaz.

## Veritabanı kullanımı

SQLite bağlantısı yalnızca ilk kurulumda veya bir API isteği sırasında açılır ve işlem sonunda kapatılır. Açık yönetim paneli yeni olayları **Server-Sent Events** üzerinden bellekteki bildirim kuyruğuyla alır. Uzaktaki bağlantı bu akışı geciktirirse panel dört saniyede bir yalnızca bellekteki değişiklik sayacını kontrol eder; bu kontrol veritabanını açmaz. Yeni talep veya düzenleme algılanınca panel bir kez listeyi yükler. Müşteri takip ekranı yalnızca “Durumu sorgula” tıklanınca sorgu yapar. Site metinleri ve yorumlar sayfa açılışında bir kez yüklenir. Ziyaret sayımı oturum başına günlük tek istektir; grafik yalnızca ekranı açılınca sorgulanır. SQLite yerel dosyadır; barındırma ve depolama maliyeti seçilecek hizmete bağlıdır.

## Uzaktan tanılama

`/diagnostics` herkese açık, salt okunur bir ekrandır. İlk açılışta ve “Yeniden kontrol et” düğmesine basılınca kısa bir SQLite erişim kontrolü yapar ve bağlantıyı kapatır. Açık ekran yerelde SSE ile anlık bildirim alır; uzaktaki tünelin akışı geciktirmesi halinde beş saniyede bir yalnızca bellekteki özetleri kontrol eder. Bu canlı kontroller veritabanını açmaz. HTTP hataları, sunucu istisnaları ve site/panel tarayıcı hatalarının güvenli özetleri `data/diagnostics.jsonl` dosyasına sınırlı boyutta kaydedilir; sunucu yeniden başlatılınca son kayıtlar tekrar görünür. Takip kodu, müşteri bilgisi, istek gövdesi, URL sorgusu, tam hata mesajı, yığın izi ve API anahtarı bu ekrana veya tanılama dosyasına yazılmaz. Ayrıntılı hata ayıklama için sunucunun özel konsolu gerekir. Çok sayıda hata gelirse kayıt akışı dakika başına sınırlandırılır.

## Test

```powershell
python -m unittest -v test_flow.py
node --check app.js
node --check admin.js
node --check chat-ui.js
```

Entegrasyon testi geçici test veritabanında fotoğraf yükleme, canlı olay, yönetim güncellemesi, müşteri takibi, galeri, ziyaret sayımı, yorum izni ve Gemini asistanının izinli güncelleme akışını denetler. Gemini API yanıtı otomatik testte taklit edilir; gerçek bağlantı ayrıca paneldeki test düğmesiyle doğrulanabilir.

## Yayın öncesi

Yönetim panelinde kullanıcı isteği doğrultusunda henüz şifre yoktur. Mevcut sunucu varsayılan olarak yalnızca `127.0.0.1` üzerinde dinler. İnternete port açmadan önce panel ve yönetici sohbeti için yetkilendirme eklenmeli; HTTPS, kalıcı veri depolama ve yedekleme planı belirlenmelidir. Gemini anahtarı yerel SQLite dosyasında saklanır; dosyaya erişimi kısıtlayın ve yedekleri koruyun. Referans HTML'deki işletme yılı, portföy ve hizmet iddiaları işletme tarafından doğrulanmalıdır. Yalnızca teslim sonrası izin verilen gerçek talep kodları yorum yayınlayabilir.
