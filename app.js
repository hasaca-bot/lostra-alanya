const $ = (selector) => document.querySelector(selector);
try {
  const visitKey = `lostra-visit-${new Date().toISOString().slice(0, 10)}`;
  if (!sessionStorage.getItem(visitKey)) {
    sessionStorage.setItem(visitKey, '1');
    fetch('/api/visit', { method: 'POST' }).then(response => { if (!response.ok) throw new Error(); }).catch(() => { try { sessionStorage.removeItem(visitKey); } catch { /* Storage may be disabled. */ } });
  }
} catch { /* The site remains usable if storage is disabled. */ }
const galleryGrid = $('#calismalarimiz .grid.grid-cols-1');
const galleryTemplate = galleryGrid?.firstElementChild.cloneNode(true);
if (galleryGrid) galleryGrid.id = 'gallery-grid';
function renderGallery(items) {
  if (!galleryGrid || !galleryTemplate) return;
  galleryGrid.replaceChildren();
  items.forEach((item) => {
    const card = galleryTemplate.cloneNode(true);
    const image = card.querySelector('img');
    image.src = item.image; image.alt = item.title; image.loading = 'lazy';
    card.querySelector('.gallery-label').textContent = item.label;
    card.querySelector('h3').textContent = item.title;
    card.querySelector('h3 + p').textContent = item.intro;
    const foot = card.querySelector('.border-t');
    if (foot) foot.remove();
    galleryGrid.append(card);
  });
}
const reviewsSection = document.createElement('section');
reviewsSection.className = 'reviews-section';
reviewsSection.innerHTML = '<div class="reviews-inner"><span class="eyebrow">Müşteri deneyimleri</span><h2>Yenilenen ayakkabıların hikâyeleri</h2><div id="reviews-list" class="reviews-list"><p>Yorumlar yükleniyor…</p></div></div>';
$('#calismalarimiz')?.after(reviewsSection);
async function loadReviews() {
  const list = $('#reviews-list');
  if (!list) return;
  try {
    const response = await fetch('/api/reviews', { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const { reviews } = await response.json();
    list.replaceChildren();
    if (!reviews.length) { list.append(Object.assign(document.createElement('p'), { textContent: 'Henüz müşteri yorumu yok.' })); return; }
    reviews.forEach((review) => {
      const card = document.createElement('article'); card.className = 'review-card';
      const rating = document.createElement('span'); rating.className = 'review-rating'; rating.setAttribute('aria-label', `${review.rating} / 5 puan`);
      for (let i = 0; i < review.rating; i++) rating.innerHTML += '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L7 14.2 2 9.3l6.9-1Z"/></svg>';
      const body = document.createElement('p'); body.textContent = review.comment;
      const author = document.createElement('strong'); author.textContent = review.name;
      card.append(rating, body, author); list.append(card);
    });
  } catch { list.textContent = 'Yorumlar şu anda yüklenemiyor.'; }
}
loadReviews();
async function loadSiteSettings() {
  try {
    const response = await fetch('/api/site', { cache: 'no-store' });
    if (!response.ok) throw new Error('Ayarlar yüklenemedi.');
    const config = await response.json();
    document.querySelectorAll('[data-site]').forEach((node) => {
      if (Object.hasOwn(config.content, node.dataset.site)) node.textContent = config.content[node.dataset.site];
    });
    document.querySelectorAll('#hizmetler h3').forEach((title, index) => {
      const number = index + 1;
      if (config.content[`service_${number}_title`]) title.textContent = config.content[`service_${number}_title`];
      if (title.nextElementSibling && config.content[`service_${number}_intro`]) title.nextElementSibling.textContent = config.content[`service_${number}_intro`];
    });
    document.querySelectorAll('#nasil-calisir h3').forEach((title, index) => {
      const number = index + 1;
      if (config.content[`step_${number}_title`]) title.textContent = config.content[`step_${number}_title`];
      if (title.nextElementSibling && config.content[`step_${number}_intro`]) title.nextElementSibling.textContent = config.content[`step_${number}_intro`];
    });
    renderGallery(config.gallery);
    function showOptions(containerId, name, options, checkedFirst) {
      const container = document.getElementById(containerId);
      container.replaceChildren();
      options.forEach((option, index) => {
        const label = document.createElement('label');
        label.className = 'cursor-pointer border border-outline-variant p-3 bg-surface hover:bg-surface-container-low transition-colors flex items-center gap-2.5';
        const input = document.createElement('input');
        input.type = name === 'product_type' ? 'radio' : 'checkbox';
        input.name = name;
        input.value = option;
        input.checked = checkedFirst && index === 0;
        input.className = 'text-primary-container focus:ring-0 border-outline';
        const text = document.createElement('span');
        text.className = 'font-body-sm text-body-sm text-on-surface';
        text.textContent = option;
        label.append(input, text);
        container.append(label);
      });
    }
    showOptions('product-options', 'product_type', config.product_types, true);
    showOptions('service-options', 'services', config.services, false);
  } catch (error) {
    console.warn('Site ayarları alınamadı; HTML içeriği gösteriliyor.', error);
  }
}
loadSiteSettings();
const slider = $('#comparison-slider');
if (slider) {
  const afterLayer = $('#after-layer');
  const handle = $('#slider-handle');
  const afterImage = afterLayer.querySelector('img');
  const frame = slider.firstElementChild;
  let percentage = 50;
  const syncImageWidth = () => { afterImage.style.width = `${frame.clientWidth}px`; };
  const setPosition = (value) => {
    percentage = Math.max(5, Math.min(95, value));
    afterLayer.style.width = `${percentage}%`;
    handle.style.left = `${percentage}%`;
    slider.setAttribute('aria-valuenow', String(Math.round(percentage)));
  };
  slider.querySelectorAll('img').forEach((image) => {
    image.draggable = false;
    image.addEventListener('dragstart', (event) => event.preventDefault());
  });
  window.addEventListener('resize', syncImageWidth);
  syncImageWidth();
  slider.addEventListener('pointerdown', (event) => { if (!event.isPrimary || event.button !== 0) return; slider.setPointerCapture(event.pointerId); setPosition((event.clientX - slider.getBoundingClientRect().left) / slider.clientWidth * 100); });
  slider.addEventListener('pointermove', (event) => { if (slider.hasPointerCapture(event.pointerId)) setPosition((event.clientX - slider.getBoundingClientRect().left) / slider.clientWidth * 100); });
  slider.addEventListener('pointerup', event => { if (slider.hasPointerCapture(event.pointerId)) slider.releasePointerCapture(event.pointerId); });
  slider.addEventListener('keydown', (event) => {
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); setPosition(event.key === 'Home' ? 5 : 95); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setPosition(percentage + (event.key === 'ArrowRight' ? 5 : -5)); }
  });
  setPosition(50);
}

const menu = $('#menu-toggle');
menu?.addEventListener('click', () => {
  const nav = $('#mobile-nav');
  nav.hidden = !nav.hidden;
  menu.setAttribute('aria-expanded', String(!nav.hidden));
  menu.setAttribute('aria-label', nav.hidden ? 'Menüyü aç' : 'Menüyü kapat');
});
$('#mobile-nav')?.addEventListener('click', (event) => { if (event.target.closest('a')) { $('#mobile-nav').hidden = true; menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Menüyü aç'); } });

const sectionLinks = [...document.querySelectorAll('header a[href^="#"], #mobile-nav a[href^="#"]')];
const navSections = [...new Set(sectionLinks.map((link) => link.hash.slice(1)))]
  .map((id) => document.getElementById(id))
  .filter(Boolean)
  .sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
let navFrame = 0;
function setActiveSection(id) {
  sectionLinks.forEach((link) => {
    const active = link.hash === `#${id}`;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
function syncActiveSection() {
  navFrame = 0;
  const marker = (document.querySelector('header')?.getBoundingClientRect().height || 80) + 40;
  let activeId = '';
  for (const section of navSections) {
    if (section.getBoundingClientRect().top <= marker) activeId = section.id;
    else break;
  }
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
    activeId = navSections.at(-1)?.id || activeId;
  }
  setActiveSection(activeId);
}
function scheduleActiveSection() {
  if (!navFrame) navFrame = requestAnimationFrame(syncActiveSection);
}
window.addEventListener('scroll', scheduleActiveSection, { passive: true });
window.addEventListener('resize', scheduleActiveSection);
window.addEventListener('hashchange', scheduleActiveSection);
window.addEventListener('load', scheduleActiveSection);
sectionLinks.forEach((link) => link.addEventListener('click', () => setActiveSection(link.hash.slice(1))));
scheduleActiveSection();

const photoInput = $('#photos');
const photoFeedback = $('#photo-feedback');
let photoUrls = [];
function clearPhotoPreview() { photoUrls.forEach(url => URL.revokeObjectURL(url)); photoUrls = []; $('#photo-preview').replaceChildren(); }
photoInput?.addEventListener('change', () => {
  const files = [...photoInput.files];
  const preview = $('#photo-preview');
  clearPhotoPreview();
  photoFeedback.textContent = files.length ? `${files.length} fotoğraf seçildi.` : '1 ila 3 JPG, PNG veya WebP fotoğrafı; her biri en fazla 5 MB.';
  files.slice(0, 3).forEach((file) => {
    const image = document.createElement('img');
    image.alt = file.name;
    const url = URL.createObjectURL(file); photoUrls.push(url); image.src = url;
    image.onload = image.onerror = () => URL.revokeObjectURL(url);
    preview.append(image);
  });
});
const photoDropzone = $('#photo-dropzone');
if (photoInput && photoDropzone) {
  for (const name of ['dragenter', 'dragover']) {
    photoDropzone.addEventListener(name, (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      photoDropzone.classList.add('is-dragging');
    });
  }
  photoDropzone.addEventListener('dragleave', (event) => {
    if (!photoDropzone.contains(event.relatedTarget)) photoDropzone.classList.remove('is-dragging');
  });
  photoDropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    photoDropzone.classList.remove('is-dragging');
    const files = [...(event.dataTransfer?.files || [])];
    if (files.length < 1 || files.length > 3 || files.some(file => file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      photoFeedback.textContent = '1 ila 3 JPG, PNG veya WebP fotoğrafı bırakın. Her biri en fazla 5 MB olabilir.';
      return;
    }
    const transfer = new DataTransfer();
    files.forEach(file => transfer.items.add(file));
    photoInput.files = transfer.files;
    photoInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const quoteForm = $('#quote-form');
let quoteSubmitting = false;
quoteForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (quoteSubmitting) return;
  const error = $('#form-error');
  error.classList.add('hidden');
  const files = [...photoInput.files];
  if (files.length < 1 || files.length > 3 || files.some((file) => file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
    error.textContent = '1 ila 3 JPG, PNG veya WebP fotoğrafı seçin. Her biri en fazla 5 MB olabilir.';
    error.classList.remove('hidden');
    error.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  quoteSubmitting = true;
  const button = quoteForm.querySelector('button[type=submit]');
  button.disabled = true;
  const previous = button.textContent;
  button.textContent = 'Talep gönderiliyor…';
  try {
    const response = await fetch('/api/requests', { method: 'POST', body: new FormData(quoteForm) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Talep gönderilemedi.');
    $('#created-code').textContent = result.code;
    $('#tracking-code').value = result.code;
    $('#form-success').classList.remove('hidden');
    $('#form-success').scrollIntoView({ behavior: 'smooth', block: 'center' });
    quoteForm.reset();
    clearPhotoPreview();
    photoFeedback.textContent = '1 ila 3 JPG, PNG veya WebP fotoğrafı; her biri en fazla 5 MB.';
  } catch (cause) {
    error.textContent = cause.message;
    error.classList.remove('hidden');
  } finally {
    quoteSubmitting = false;
    button.disabled = false;
    button.textContent = previous;
  }
});

const stages = ['Yeni', 'İnceleniyor', 'Hazırlanıyor', 'Tamamlandı', 'Gönderildi', 'Teslim Edildi'];
const stageIcons = [
  '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6M8 10h8M8 14h6"/>',
  '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  '<path d="m14 7 3-3 3 3-3 3-3-3ZM4 20l9-9M3 21l3-1-2-2-1 3Z"/>',
  '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  '<path d="M2 5h12v11H2zM14 9h4l4 4v3h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  '<path d="M3 12 9 18 21 6"/><path d="M4 4h16v16H4z"/>',
];
let tracking = false;
$('#track-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (tracking) return;
  tracking = true;
  const code = $('#tracking-code').value.trim().toUpperCase();
  const error = $('#track-error');
  const result = $('#track-result');
  const button = $('#track-form button');
  error.classList.add('hidden');
  result.classList.add('hidden');
  button.disabled = true;
  button.textContent = 'Sorgulanıyor…';
  try {
    const response = await fetch(`/api/track?code=${encodeURIComponent(code)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Talep bulunamadı.');
    result.replaceChildren();
    const title = document.createElement('h3');
    title.textContent = `${data.product_type} · ${data.model}`;
    const status = document.createElement('span');
    status.className = 'status-text';
    status.textContent = data.status;
    const caption = document.createElement('p');
    caption.textContent = `Takip kodu: ${data.code} · Son güncelleme: ${new Date(data.updated_at).toLocaleString('tr-TR')}`;
    const progress = document.createElement('div');
    progress.className = 'status-progress';
    const current = Math.max(0, stages.indexOf(data.status));
    progress.setAttribute('role', 'progressbar');
    progress.setAttribute('aria-label', 'Ayakkabı işlem durumu');
    progress.setAttribute('aria-valuemin', '0');
    progress.setAttribute('aria-valuemax', String(stages.length - 1));
    progress.setAttribute('aria-valuenow', String(current));
    progress.setAttribute('aria-valuetext', data.status);
    const rail = document.createElement('div');
    rail.className = 'progress-rail';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    fill.style.width = `${Math.max(0, current) * 100 / (stages.length - 1)}%`;
    rail.append(fill);
    progress.append(rail);
    stages.forEach((stage, index) => {
      const item = document.createElement('div');
      item.className = `status-step ${index <= current ? 'done' : ''} ${index === current ? 'current' : ''}`;
      const icon = document.createElement('span');
      icon.className = 'stage-icon';
      icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${stageIcons[index]}</svg>`;
      const label = document.createElement('span');
      label.textContent = stage;
      item.append(icon, label);
      progress.append(item);
    });
    const progressScroller = document.createElement('div');
    progressScroller.className = 'status-progress-scroller';
    progressScroller.append(progress);
    result.append(title, status, caption, progressScroller);
    if (data.review_allowed && !data.review_submitted) {
      const form = document.createElement('form'); form.className = 'review-form';
      form.innerHTML = '<h4>Deneyiminizi paylaşın</h4><p>Yorumunuz ve adınız sitede yayınlanır. Adınızın görünmesini istemiyorsanız aşağıdaki kutuyu işaretleyin.</p><label>Puanınız <select name="rating" required><option value="5">5 / 5</option><option value="4">4 / 5</option><option value="3">3 / 5</option><option value="2">2 / 5</option><option value="1">1 / 5</option></select></label><label>Yorumunuz <textarea name="comment" maxlength="1000" required placeholder="Deneyiminizi yazın"></textarea></label><label class="review-anonymous"><input name="anonymous" type="checkbox"> İsmimi gizle</label><button type="submit">Yorumu gönder</button><p class="review-feedback" role="status"></p>';
      form.addEventListener('submit', async (event) => {
        event.preventDefault(); const submit = form.querySelector('button'); if (submit.disabled) return; submit.disabled = true;
        try {
          const response = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: data.code, rating: Number(form.elements.rating.value), comment: form.elements.comment.value, anonymous: form.elements.anonymous.checked }) });
          const answer = await response.json();
          if (!response.ok) throw new Error(answer.error || 'Yorum gönderilemedi.');
          form.replaceChildren(Object.assign(document.createElement('p'), { textContent: 'Yorumunuz için teşekkür ederiz.' }));
          loadReviews();
        } catch (cause) { form.querySelector('.review-feedback').textContent = cause.message; submit.disabled = false; }
      });
      result.append(form);
    } else if (data.review_submitted) {
      result.append(Object.assign(document.createElement('p'), { textContent: 'Bu takip koduyla yorum gönderildi. Teşekkür ederiz.' }));
    }
    result.classList.remove('hidden');
  } catch (cause) {
    error.textContent = cause.message;
    error.classList.remove('hidden');
  } finally {
    tracking = false;
    button.disabled = false;
    button.textContent = 'Durumu sorgula';
  }
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); } }), { threshold: .1 });
  document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
} else document.querySelectorAll('.reveal').forEach((element) => element.classList.add('in-view'));
