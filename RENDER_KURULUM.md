# Lostra Alanya'yı Render'da yayınlama

Bu rehber, **gerçek müşteri kayıtları kaybolmasın** diye ücretli bir web servisi ve kalıcı disk kurar. Render'ın güncel arayüzünde bazı alanların yeri değişebilir; alan adlarına göre ilerleyin. İlk kurulumda yerel bilgisayarınızdaki mevcut talepler Render'a otomatik taşınmaz.

## 1. Render hesabı açın

1. [render.com](https://render.com/) adresini açın ve **Get Started / Sign Up** seçeneğine tıklayın.
2. Mümkünse `lostra-alanya` deposuna erişimi olan **GitHub hesabınızla** giriş yapın. GitHub bir yetki ekranı gösterirse Render'ın depoyu okuyabilmesi için bağlantıyı onaylayın.
3. Render e-posta doğrulaması isterse gelen e-postadaki bağlantıya tıklayın. Açılan **Dashboard** sayfasına dönün.
4. GitHub ile giriş yapmadıysanız Render **Account Settings → Account Security → Git Deployment Credentials → Add credential → GitHub** yolundan deponun bulunduğu hesabı bağlayın.
5. Ücretli servis seçerken ödeme yöntemi istenirse Render'ın **Billing** ekranında ekleyin; onaylamadan önce ekrandaki güncel servis ve disk ücretini okuyun.

## 2. Web servisi oluşturun

1. Dashboard'da sağ üstte **+ New → Web Service** seçin. **Static Site** seçmeyin; bu projede Python sunucusu çalışıyor.
2. Liste içinden `hasaca-bot/lostra-alanya` deposunu seçip **Connect** tıklayın. Depo görünmüyorsa GitHub bağlantısının o depoya eriştiğini kontrol edin.
3. Hesabınız bu GitHub deposuna erişemiyorsa **Public Git Repository** seçip `https://github.com/hasaca-bot/lostra-alanya` adresini yapıştırın ve **Connect** tıklayın. Bu yöntemle Render otomatik dağıtım yapmaz; yeni kod gönderildikten sonra dağıtımı panelden elle başlatmanız gerekir.

## 3. Kutuları şu şekilde doldurun

| Render alanı | Girilecek değer |
| --- | --- |
| **Name** | `lostra-alanya` — alınmışsa örneğin `lostra-alanya-site` yazın. Bu ad bağlantıda görünür. |
| **Project / Environment** | Zorunlu değilse varsayılanı bırakın. |
| **Region** | Size ve müşterilerinize yakın bir bölge seçin; listede varsa Frankfurt uygundur. |
| **Branch** | `main` |
| **Root Directory** | **Boş bırakın.** Python dosyaları depo kökündedir. |
| **Language / Runtime** | `Python 3` veya `Python` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `python server.py` |
| **Instance Type / Compute** | Kalıcı disk eklenebilen **ücretli** en küçük planı seçin. Fiyatı onaylamadan önce Render'ın gösterdiği güncel tutarı okuyun. |
| **Auto-Deploy** | GitHub hesabını bağladıysanız `On` / `Yes`. Public Git Repository yöntemiyle bu özellik yoktur. |
| **Health Check Path** | Alan görünüyorsa `/health` yazın. |

**Port, Publish Directory, Dockerfile, Pre-deploy Command** gibi başka alanlar gösterilirse boş veya varsayılan kalsın. Sunucu Render'ın verdiği `PORT` değerini kendisi okur ve `0.0.0.0` adresine bağlanır. `npm install` veya CSS derleme komutu eklemeyin; CSS dosyası depoda hazırdır.

## 4. Şifreyi ve veri klasörünü ekleyin

Servis oluşturma ekranındaki **Advanced → Environment Variables** bölümünü açın. İki satır ekleyin:

| Key | Value |
| --- | --- |
| `LOSTRA_ADMIN_PASSWORD` | Kendinizin belirlediği **en az 16 karakterlik güçlü bir şifre**. Bu değeri GitHub dosyasına, sohbet mesajına veya ekran görüntüsüne koymayın. |
| `LOSTRA_DATA_DIR` | `/var/data` |

`PORT`, `RENDER`, `LOSTRA_HOST`, `DATABASE_URL` veya Gemini anahtarı için satır eklemeyin. Render `PORT` ve `RENDER` değerlerini otomatik verir. Gemini anahtarını site yayına çıktıktan sonra giriş yapıp **Site Yapılandırması → Gemini bağlantısı** ekranında kaydedebilirsiniz.

Şifreyi sonra değiştirmek için servisinizin **Environment** bölümünde `LOSTRA_ADMIN_PASSWORD` değerini değiştirip **Save and deploy** seçin. Yeni dağıtımdan sonra eski oturumlar kapanır.

## 5. Kalıcı diski ekleyin

**Advanced → Disk** alanı varsa burada ekleyin. Görünmüyorsa servisi oluşturduktan sonra servis menüsündeki **Disk → Add disk** yolunu kullanın:

| Disk alanı | Girilecek değer |
| --- | --- |
| **Name** | `lostra-data` |
| **Mount Path** | `/var/data` |
| **Size** | Başlangıç için sunulan en küçük uygun boyut; ihtiyaç arttığında büyütülebilir. |

**Mount Path ile `LOSTRA_DATA_DIR` aynı olmalı.** SQLite veritabanı, müşteri fotoğrafları, galeri yüklemeleri ve tanılama kayıtları bu dizinde saklanır. Disk eklemek yeni dağıtım başlatabilir. Disk ücretini Render ekranda gösterir. Disk ilk kurulumda sonradan eklendiyse, **Disk** ekranında takılı ve servis **Live** görünmeden gerçek müşteri talebi almayın.

`/health` adresi veritabanını açmadan sunucunun çalıştığını söyler.

## 6. Yayınlayın ve kontrol edin

1. **Create Web Service** veya **Deploy Web Service** düğmesine tıklayın.
2. **Deploys / Events** ekranında derleme ve başlatma bitene kadar bekleyin. Durum **Live** olmalı.
3. Render'ın verdiği `https://...onrender.com` bağlantısını açın. Müşteri ana sayfası görünmeli.
4. Aynı adresin sonuna `/admin` ekleyin. **Yönetici girişi** ekranı açılmalı. Render'a girdiğiniz şifreyle oturum açın.
5. Yönetim panelinde sağ üstte **Çıkış yap** düğmesini deneyin. Çıkıştan sonra `/admin` yeniden giriş istemeli.
6. Deneme talebi ve fotoğraf yükleyin, takip kodunu sorgulayın, yönetim panelinde bir aşama ilerletin. **Gerçek müşteri bilgisi kullanmadan** bu akışı deneyin.

**Şifre ayarlanmadı** uyarısı görürseniz servisinizin **Environment** ekranındaki `LOSTRA_ADMIN_PASSWORD` değerini kontrol edip **Save and deploy** seçin. **502 / port bulunamadı** hatasında **Start Command** değerinin `python server.py` olduğunu ve dağıtım kayıtlarını kontrol edin.

## Ücretsiz planla yalnızca geçici deneme

Ücretsiz Web Service seçebilirsiniz; ancak **kalıcı disk ekleyemezsiniz**. SQLite veritabanı ve yüklenen fotoğraflar hizmet uykuya geçtiğinde, yeniden başlatıldığında veya yeniden dağıtıldığında silinebilir. Bu nedenle ücretsiz planda gerçek müşteri kaydı tutmayın. Sadece kaybolması sorun olmayacak örnek veriyle deneme yapacaksanız `LOSTRA_DATA_DIR` satırını **hiç eklemeyin**.

## Kaynaklar

- [Render: ilk dağıtım](https://render.com/docs/your-first-deploy)
- [Render: Web Service alanları ve port](https://render.com/docs/web-services)
- [Render: ortam değişkenleri](https://render.com/docs/configure-environment-variables)
- [Render: kalıcı disk](https://render.com/docs/disks)
- [Render: ücretsiz planın dosya kaybı](https://render.com/docs/free)
