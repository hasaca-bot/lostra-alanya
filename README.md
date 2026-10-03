# Lostra Alanya

Gönderilen HTML tasarımı üzerine kurulan müşteri sitesi ve talep yönetim paneli.

## Yerel çalıştırma

Python 3.10+ ile bu klasörde:

```powershell
python -m pip install -r requirements.txt
$env:LOSTRA_ADMIN_PASSWORD = Read-Host 'En az 8 karakterlik yönetici şifresi'
python server.py
```

- Müşteri sitesi: http://127.0.0.1:8765/
- Yönetim paneli: http://127.0.0.1:8765/admin
- Yönetici girişi: http://127.0.0.1:8765/admin/login
- Canlı tanılama: http://127.0.0.1:8765/diagnostics
- Port değiştirmek için: `$env:LOSTRA_PORT='8766'; python server.py`

Fotoğrafları güvenli biçimde işlemek için Pillow gerekir. İlk açılışta `data/lostra.sqlite3` ve `data/uploads/` oluşturulur. Bu klasörü düzenli yedekleyin; müşteri ve fotoğraf verileri buradadır. Site CSS dosyası depoda hazırdır; yalnızca stil sınıflarını değiştirirken Node.js ile yeniden derleme gerekir ([CSS_BUILD.md](CSS_BUILD.md)).

## Akış

1. Müşteri ad, telefon, marka/model, ürün türü, işlem seçimi ve 1–3 fotoğraf ile talep oluşturur. Fotoğraflar JPG, PNG veya WebP olabilir; fotoğraf başına 5 MB sınırı yoktur. Toplam fotoğraf boyutu en fazla 47 MB, HTTP isteği en fazla 48 MB olabilir. Sunucu görselin tamamını çözüp tekrar kodlar; EXIF ve konum verilerini siler. En çok 25 megapiksel ve 10.000 piksel kenar kabul edilir.
2. Sunucu rastgele `LA-XXXX-XXXX` takip kodu oluşturur ve kaydı `Yeni` durumuyla saklar.
3. Yönetim paneli talepleri `Yeni`, `İnceleniyor`, `Hazırlanıyor`, `Tamamlandı`, `Gönderildi`, `Teslim Edildi` sütunlarında gösterir. Her talep kartındaki düğme durumu tek tıklamayla sıradaki aşamaya taşır; son aşamada düğme görünmez. Müşteri/ürün detayları, fotoğraflar, model ve iç not görülebilir; durum, model ve iç not ayrıca detay ekranından değiştirilebilir.
4. Müşteri takip koduyla sorguladığında güncel durum ve SVG simgeli ilerleme çubuğu görünür. Talep `Teslim Edildi` durumuna geçtikten sonra yönetici yorum izni açarsa müşteri koduyla bir kez puan ve yorum gönderebilir; adını gizleyebilir.
5. Yönetim panelindeki **Site Yapılandırması** bölümünden sayfa metinleri, galeri kartları, ürün türleri ve işlem seçenekleri düzenlenir. Galeriye en fazla 24 kart eklenebilir; yeni görseller yalnızca dosya yüklenerek seçilir. Süreç adlarının düzenlenmesi kapalıdır. Değişiklikler yeni açılan müşteri sayfasında geçerlidir.
6. **Ziyaretçi Grafiği** son 14 günü gösterir. Tarayıcı oturumu günde bir kez sayılır; sayı benzersiz kişi veya kimlik doğrulanmış kullanıcı sayısı değildir.
7. **Site Yapılandırması → Gemini bağlantısı** alanına API anahtarını girip kaydedin, ardından “Bağlantıyı test et” düğmesini kullanın. Anahtar tarayıcıya geri gönderilmez ve herkese açık `/api/site` yanıtına eklenmez. Müşteri asistanı yalnızca güncel site içeriğini kaynak alır. Panel asistanı talep arayabilir, ayrıntı okuyabilir, durum/model/iç not/yorum iznini mevcut kurallarla güncelleyebilir. Sohbet ve Gemini isteği yalnızca mesaj gönderildiğinde çalışır. Yönetici komutları müşteri verilerini Gemini hizmetine iletebilir.
8. Talep `Tamamlandı`, `Gönderildi` veya `Teslim Edildi` durumundayken karttaki veya detay ekranındaki **Müşteriye mesaj hazırla** düğmesi WhatsApp'ta önceden yazılmış bir taslak açar. Yönetici mesajı kontrol edip WhatsApp'taki gönder düğmesine kendisi basar. Gemini etkinse yalnızca durum için hazırlanmış genel metni daha doğal yazar; müşteri adı, telefon, model, fotoğraf ve takip kodu Gemini'ye gönderilmez. Gemini erişilemezse hazır metin kullanılır. Telefon numarası WhatsApp bağlantısı için uluslararası biçime dönüştürülür. Düğmeye basılmadıkça bu işlem için veritabanı veya Gemini çağrısı yapılmaz.

## Veritabanı kullanımı

SQLite bağlantısı yalnızca ilk kurulumda veya bir API isteği sırasında açılır ve işlem sonunda kapatılır. Açık yönetim paneli yeni olayları **Server-Sent Events** üzerinden bellekteki bildirim kuyruğuyla alır. Uzaktaki bağlantı bu akışı geciktirirse panel dört saniyede bir yalnızca bellekteki değişiklik sayacını kontrol eder; bu kontrol veritabanını açmaz. Yeni talep veya düzenleme algılanınca panel bir kez listeyi yükler; başarısız yükleme sonraki kontrolde yeniden denenir. Müşteri takip ekranı yalnızca “Durumu sorgula” tıklanınca sorgu yapar. Site metinleri ve yorumlar sayfa açılışında bir kez yüklenir. Ziyaret sayımı oturum başına günlük tek istektir; sunucu imzalı oturum çereziyle tekrar sayımı ve gereksiz veritabanı açılışını önler. Grafik yalnızca ekranı açılınca sorgulanır. SQLite yerel dosyadır; barındırma ve depolama maliyeti seçilecek hizmete bağlıdır.

## Uzaktan tanılama

`/diagnostics` herkese açık, salt okunur bir ekrandır. İlk açılışta ve “Yeniden kontrol et” düğmesine basılınca kısa bir SQLite erişim kontrolü yapar ve bağlantıyı kapatır. Açık ekran yerelde SSE ile anlık bildirim alır; uzaktaki tünelin akışı geciktirmesi halinde beş saniyede bir yalnızca bellekteki özetleri kontrol eder. Bu canlı kontroller veritabanını açmaz. HTTP hataları, sunucu istisnaları ve site/panel tarayıcı hatalarının güvenli özetleri `data/diagnostics.jsonl` dosyasına sınırlı boyutta kaydedilir; sunucu yeniden başlatılınca son kayıtlar tekrar görünür. Takip kodu, müşteri bilgisi, istek gövdesi, URL sorgusu, tam hata mesajı, yığın izi ve API anahtarı bu ekrana veya tanılama dosyasına yazılmaz. Ayrıntılı hata ayıklama için sunucunun özel konsolu gerekir. Çok sayıda hata gelirse kayıt akışı dakika başına sınırlandırılır.

## Test

```powershell
python -m unittest discover -p "test_*.py" -v
node --check app.js
node --check admin.js
node --check chat-ui.js
```

Testler geçici test veritabanında fotoğraf yükleme, canlı olay, yönetim güncellemesi, müşteri takibi, galeri, ziyaret sayımı, yorum izni, eşzamanlı düzenleme uyarısı, görsel metadata temizliği ve Gemini asistanının izinli güncelleme akışını denetler. Gemini API yanıtı otomatik testte taklit edilir; gerçek bağlantı ayrıca paneldeki test düğmesiyle doğrulanabilir.

## İstek güvenliği ve sınırlar

Sunucu tarayıcının farklı kökenden gelen API isteklerini reddeder; istek boyutlarını sınırlar ve HTML yanıtlarına güvenlik başlıkları ekler. Görseller bütün olarak doğrulanır, yeniden kodlanır ve metaverisi silinir. Asistan çağrıları dakika ve saat başına, görsel işlemleri aynı anda çalışan istek sayısına göre sınırlandırılır. Aynı talebin iki kez hızla ilerletilmesi veya eski detay ekranından kaydedilmesi 409 uyarısıyla durdurulur. Müşteri asistanından gelen araç çağrıları çalıştırılmaz. Açık sayfadaki SSE ve değişiklik kontrolleri veritabanını açmaz. [AUDIT.md](AUDIT.md) test kapsamını ve kalan yayın risklerini özetler.

## Yayın öncesi

Yönetim paneli, yönetici API'leri, yönetici asistanı ve müşteri fotoğrafları oturum gerektirir. Şifre yalnızca `LOSTRA_ADMIN_PASSWORD` ortam değişkeninden okunur; 8 karakterden kısaysa veya boşsa yönetim erişimi kapalı kalır. Oturumlar bellekte tutulur ve 12 saat sonra sona erer; kontrol sırasında veritabanı açılmaz. Render üzerinde HTTPS ile güvenli çerez kullanılır. Yerel sunucu varsayılan olarak yalnızca `127.0.0.1` üzerinde dinler. Gerçek müşteri verileri için kalıcı disk ve yedekleme planı gerekir; adım adım kurulum [RENDER_KURULUM.md](RENDER_KURULUM.md) dosyasındadır. Gemini anahtarı yerel SQLite dosyasında saklanır; dosyaya erişimi kısıtlayın, yedekleri koruyun ve daha önce test için paylaşılan anahtarı yayından önce yenileyin. Referans HTML'deki işletme yılı, portföy ve hizmet iddiaları işletme tarafından doğrulanmalıdır. Yalnızca teslim sonrası izin verilen gerçek talep kodları yorum yayınlayabilir.
