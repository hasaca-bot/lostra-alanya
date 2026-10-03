# Lostra Alanya: Başkasının Render hesabında yayınlama

Bu yönergeyi siteyi yayınlayacak kişiye gönderin. **Render hesabı ve ödeme bilgileri sizin adınıza olacak.** Site kodu başka bir kişinin herkese açık GitHub deposunda duruyor. Depoya erişim izni veya GitHub şifresi istemeniz gerekmiyor.

**Kullanılacak GitHub bağlantısı:** https://github.com/hasaca-bot/lostra-alanya

Gerçek müşteri kayıtları ve fotoğrafları tutulacağı için aşağıdaki ana kurulumda **ücretli web servisi + kalıcı disk** seçiliyor. Uygulama SQLite veritabanını bu diskte kendisi oluşturur; Render'da ayrıca **Postgres** açmayın. Render'ın güncel tutarını ödeme öncesinde kendi ekranınızda kontrol edin. Bilgisayardaki eski kayıtlar bu kurulumla kendiliğinden taşınmaz.

## 1. Kendi Render hesabınızı açın

1. [render.com](https://render.com/) sitesini açın; **Get Started** veya **Sign Up** düğmesine basın.
2. **Kendi e-posta adresinizle** hesap oluşturun. E-postanıza doğrulama bağlantısı gelirse açın.
3. Render'ın **Dashboard** ekranına girin. GitHub hesabı bağlamayın; aşağıda herkese açık depo bağlantısını kullanacağız.
4. Ücretli plan sırasında ödeme yöntemi istenirse **Billing** bölümüne kendi ödeme bilgilerinizi girin. Servis ve disk ücretini onaylamadan önce okuyun.

## 2. Kodu kendi Render hesabınıza bağlayın

1. Dashboard'da **+ New → Web Service** seçin. **Static Site** veya **Postgres** seçmeyin.
2. Kaynak seçiminde **Public Git Repository** sekmesini seçin. **Git Provider** sekmesinden bir depo aramayın.
3. Açılan bağlantı kutusuna **tam olarak** `https://github.com/hasaca-bot/lostra-alanya` yazın ve **Connect** düğmesine basın.

Bu işlem kodu sizin GitHub hesabınıza taşımaz; Render, mevcut herkese açık depodan okuyarak siteyi **sizin Render hesabınızda** çalıştırır. Bu bağlantı yönteminde kod güncellemeleri otomatik yayınlanmaz. Güncelleme geldiğinde 7. adımdaki düğmeye basmanız gerekir.

## 3. Servis formunu doldurun

| Render'daki kutu | Ne yapmalısınız? |
| --- | --- |
| **Name** | `lostra-alanya` yazın. Ad kullanımdaysa `lostra-alanya-site` gibi farklı bir ad yazın. |
| **Region** | Listede varsa Frankfurt gibi Türkiye'ye yakın bir bölge seçin. |
| **Branch** | `main` yazın veya seçin. |
| **Root Directory** | **Boş bırakın.** |
| **Language / Runtime** | `Python 3` veya `Python` seçin. |
| **Build Command** | `pip install -r requirements.txt` yazın. |
| **Start Command** | `python server.py` yazın. |
| **Instance Type / Compute** | Kalıcı disk destekleyen **ücretli en küçük uygun planı** seçin. |
| **Health Check Path** | Kutu görünüyorsa `/health` yazın. |
| **Project / Environment** | Zorunlu değilse varsayılan kalsın. |
| **Auto-Deploy** | Bu depo bağlantısı yönteminde kullanılmaz; kapalı veya varsayılan kalsın. |

**Port, Publish Directory, Dockerfile ve Pre-deploy Command** kutularını boş veya varsayılan bırakın. `npm` komutu eklemeyin.

## 4. Yönetici şifresini ekleyin

Formdaki **Advanced → Environment Variables** bölümünü açın. Disk de aynı oluşturma ekranında eklenebiliyorsa iki satırı birlikte ekleyin:

| Key kutusu | Value kutusu |
| --- | --- |
| `LOSTRA_ADMIN_PASSWORD` | Site sahibinin belirlediği **en az 8 karakterlik benzersiz yönetici şifresi** |
| `LOSTRA_DATA_DIR` | `/var/data` |

**Disk ancak servis oluşturulduktan sonra eklenebiliyorsa**, ilk ekranda yalnızca `LOSTRA_ADMIN_PASSWORD` satırını ekleyin. `LOSTRA_DATA_DIR=/var/data` satırını disk eklendikten sonra ekleyip **Save and deploy** seçin. Disk olmadan bu değeri girerseniz uygulama `/var/data` klasörünü açamaz ve yayın başarısız olur.

Şifreyi GitHub'a veya rehber dosyasına yazmayın. Site sahibi isterse bu kutuya şifreyi kurulumu yaparken kendisi girebilir. **Şifre boşsa yönetici paneli açılmaz.** `PORT`, `RENDER`, `DATABASE_URL` ve Gemini için başka satır eklemeyin. Gemini anahtarı daha sonra yönetici panelindeki **Site Yapılandırması → Gemini bağlantısı** bölümüne girilir.

## 5. Kalıcı diski ekleyin

**Advanced → Disk** alanı varsa burada ekleyin. Bu alan yoksa servisi oluşturduktan sonra servis menüsünden **Disk → Add disk** açın.

| Disk kutusu | Yazılacak değer |
| --- | --- |
| **Name** | `lostra-data` |
| **Mount Path** | `/var/data` |
| **Size** | Ekranda sunulan en küçük uygun boyut |

`Mount Path` ile yukarıdaki `LOSTRA_DATA_DIR` değeri **aynı** olmalı. Disk sonradan eklendiyse disk takılıp servis **Live** görünene kadar gerçek müşteri talebi almayın.

Disk sonradan eklendiyse servisinizin **Environment** ekranına dönün, `LOSTRA_DATA_DIR` anahtarını `/var/data` değeriyle ekleyin ve **Save and deploy** seçin. Yeni dağıtım **Live** olmadan müşteri talebi kabul etmeyin.

### Veritabanı için ayrıca ne yapmalısınız?

**Başka bir servis veya veritabanı oluşturmayın.** Bu uygulama açılırken `/var/data/lostra.sqlite3` dosyasını ve gerekli tabloları kendi oluşturur. Talep kayıtları, müşterinin takip durumu, yorumlar ve site ayarları bu dosyadadır. Yüklenen müşteri fotoğrafları `/var/data/uploads`, site görselleri `/var/data/site-images` klasöründe saklanır. Bunların hepsi aynı kalıcı diskte olmalıdır.

Render'da **+ New → Postgres** seçmeniz, `DATABASE_URL` yazmanız veya SQL komutu çalıştırmanız gerekmez. Postgres açılırsa mevcut uygulama ona bağlanmaz. Ayrı Postgres servisi ileride istenirse önce uygulama kodunun değiştirilmesi gerekir.

SQLite veritabanı ayrı çalışan bir sunucu değildir. Uygulama bağlantıyı ilk kurulumda ve gerekli isteklerde kısa süreli açıp kapatır; açık sayfa yüzünden sürekli veritabanı bağlantısı tutmaz. Ancak **ücretli web servisi ve kalıcı disk kendi planlarına göre ücretlendirilir**; bağlantının kapalı olması bu barındırma ücretini sıfırlamaz.

## 6. Yayınlayın ve deneyin

1. **Create Web Service** veya **Deploy Web Service** düğmesine basın.
2. Servisin **Deploys** sayfasında durum **Live** olana kadar bekleyin. **Failed** görünürse aynı sayfadaki hata kayıtlarına bakın.
3. Render'ın servis sayfasında gösterdiği `https://...onrender.com` adresini açın. Müşteri sitesi görünmeli.
4. Adresin sonuna `/admin` ekleyin. Yönetici giriş ekranı açılmalı. Yukarıda belirlediğiniz şifreyle giriş yapın.
5. Gerçek müşteri bilgisi kullanmadan örnek talep ve fotoğraf yükleyin. Takip koduyla durumu sorgulayın; panelden aşamayı değiştirin ve **Çıkış yap** düğmesini deneyin.
6. **Diski sınayın:** Örnek talebin takip kodunu not edin. Servisin **Deploys → Manual Deploy → Deploy latest commit** işlemini yapıp tekrar **Live** olmasını bekleyin. Aynı kodu yeniden sorgulayın ve panelde talep ile fotoğrafın hâlâ göründüğünü kontrol edin. Kayıt kaybolduysa gerçek müşteriye açmadan önce `LOSTRA_DATA_DIR` ile diskin **Mount Path** değerlerinin `/var/data` olduğunu kontrol edin.

### `Permission denied: '/var/data'` hatası çıkarsa

Derleme bitmiş olsa bile disk `/var/data` yoluna bağlanmadığında sunucu bu hatayla açılmaz. Mevcut servis üzerinde şunları yapın:

1. Servisin **Compute** ekranında ücretli plan seçili mi bakın. **Free** seçiliyse **Compute → Edit** ile kalıcı disk destekleyen ücretli plana geçin ve **Save** seçin.
2. Servisin **Disk** ekranında **Add disk** seçin. **Mount Path** kutusuna tam olarak `/var/data`, **Name** kutusuna `lostra-data` girin ve diski ekleyin.
3. Servisin **Environment** ekranında `LOSTRA_DATA_DIR` değerinin tam olarak `/var/data` olduğunu doğrulayın; gerekiyorsa **Save and deploy** seçin.
4. **Deploys** ekranında yeni yayının **Live** olduğunu kontrol edin. Render disk bağlarken yeniden dağıtım başlatır.

Ücretli plana geçmeden yalnızca kısa deneme yapmak istiyorsanız **Environment** ekranından `LOSTRA_DATA_DIR` satırını kaldırıp **Save and deploy** seçebilirsiniz. Bu durumda kayıtlar ve fotoğraflar kalıcı değildir; gerçek müşteri verisi kullanmayın.

## 7. Daha sonra kod güncellenirse

GitHub deposuna yeni sürüm gönderildiğinde Render'da kendi servisinizi açın: **Deploys → Manual Deploy → Deploy latest commit**. **Live** olunca yeni sürüm yayındadır. Bu bağlantı türünde otomatik yayın yoktur.

## Ücretsiz deneme seçeneği

Yalnızca silinmesi sorun olmayan örnek verilerle deneme yapacaksanız ücretsiz Web Service seçebilirsiniz. Bu durumda **Disk eklemeyin** ve `LOSTRA_DATA_DIR` satırını **hiç oluşturmayın**. Ücretsiz serviste SQLite kayıtları ve yüklenen fotoğraflar uykuya geçme, yeniden başlatma veya yeniden dağıtma sırasında kaybolabilir. **Gerçek müşteri verisi için kullanmayın.**

## Render belgeleri

- [Herkese açık Git deposundan Web Service oluşturma](https://render.com/docs/web-services)
- [Elle yeni sürüm yayınlama](https://render.com/docs/deploys)
- [Ortam değişkeni ekleme](https://render.com/docs/configure-environment-variables)
- [Kalıcı disk](https://render.com/docs/disks)
- [Servisin Compute planını değiştirme](https://render.com/docs/compute-plans)
- [Ücretsiz planın dosya saklama sınırları](https://render.com/docs/free)
