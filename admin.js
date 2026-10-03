const statuses = ['Yeni', 'İnceleniyor', 'Hazırlanıyor', 'Tamamlandı', 'Gönderildi', 'Teslim Edildi'];
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const iconSvg = (path) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const whatsappSvg = () => iconSvg('<path d="M12 2.5a9.5 9.5 0 0 0-8.15 14.39L2.5 21.5l4.73-1.24A9.5 9.5 0 1 0 12 2.5Z"/><path d="M8.55 7.7c-.35-.3-.85-.2-1.13.1-.42.45-.62 1.02-.56 1.58.34 3.22 3.2 6.08 6.42 6.42.56.06 1.13-.14 1.58-.56.3-.28.4-.78.1-1.13l-1.05-1.2c-.19-.22-.5-.29-.76-.15l-.9.48a7 7 0 0 1-2.48-2.48l.48-.9c.14-.26.07-.57-.15-.76Z" stroke-width="1.6"/>');
const $ = (selector) => document.querySelector(selector);
let requests = [];
let selectedId = null;
let busy = false;
let reloadPending = false;
let knownRevision = null;
let requestsLoaded = false;
let activeStatus = null;
const advancingIds = new Set();
const draftingIds = new Set();
let detailSnapshot = null;
let detailSaving = false;
let detailReturnFocus = null;
const storage = { get(key) { try { return localStorage.getItem(key); } catch { return null; } }, set(key, value) { try { localStorage.setItem(key, value); } catch { /* Preferences are optional. */ } } };
function detailValues() { const form = $('#detail form'); return form ? JSON.stringify([...form.elements].filter(node => node.matches('input,select,textarea')).map(node => node.type === 'checkbox' ? node.checked : node.value)) : null; }
function detailDirty() { return detailSnapshot !== null && detailValues() !== detailSnapshot; }
$('#today').textContent = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'full' }).format(new Date());
$('#live-status').setAttribute('role', 'status');

function render() {
  const query = $('#search').value.trim().toLocaleLowerCase('tr-TR');
  const board = $('#board');
  const shown = requests.filter((item) => (!activeStatus || item.status === activeStatus) && `${item.name} ${item.model} ${item.code} ${item.phone}`.toLocaleLowerCase('tr-TR').includes(query));
  $('#dashboard-view .intro h1').textContent = activeStatus || 'Talep Panosu';
  $('#dashboard-view .intro p').textContent = activeStatus ? `${activeStatus} aşamasındaki talepleri inceleyin ve güncelleyin.` : 'Yeni istekleri inceleyin, fotoğraflara bakın ve aşamaları güncelleyin.';
  const summary = $('#board-summary');
  if (summary) summary.textContent = query ? `${shown.length} eşleşen talep` : activeStatus ? `${shown.length} talep` : `${requests.length} toplam talep · ${requests.filter((item) => item.status === 'Yeni').length} yeni`;
  board.replaceChildren();
  board.classList.toggle('single', Boolean(activeStatus));
  statuses.forEach((status) => {
    if (activeStatus && activeStatus !== status) return;
    const column = el('section', 'column');
    column.dataset.status = status;
    const items = requests.filter((item) => item.status === status && `${item.name} ${item.model} ${item.code} ${item.phone}`.toLocaleLowerCase('tr-TR').includes(query));
    const header = el('div', 'column-title');
    header.append(el('span', '', status), el('span', '', String(items.length)));
    const cards = el('div', 'cards');
    items.forEach((item) => {
      const cardGroup = el('div', 'request-card-shell');
      const card = el('button', 'request-card');
      card.type = 'button';
      card.setAttribute('aria-label', `${item.code}, ${item.name}, ${item.status}; detayları aç`);
      const photo = el('img');
      photo.src = item.photos[0];
      photo.alt = `${item.model} fotoğrafı`;
      photo.loading = 'lazy';
      const body = el('div', 'card-body');
      const top = el('div', 'card-top');
      top.append(el('span', '', item.code), el('span', '', new Date(item.created_at).toLocaleDateString('tr-TR')));
      body.append(top, el('div', 'card-name', item.name), el('p', 'card-model', `${item.product_type} · ${item.model}`), el('div', 'card-foot', `${item.photos.length} fotoğraf · ${item.services.length} işlem`));
      card.append(photo, body);
      card.addEventListener('click', () => {
        try { showDetail(item.id); }
        catch (error) { $('#notice').textContent = `Talep detayı açılamadı: ${error.message}`; $('#notice').hidden = false; }
      });
      cardGroup.append(card);
      const nextStatus = statuses[statuses.indexOf(item.status) + 1];
      if (nextStatus) {
        const advance = el('button', 'request-next');
        advance.type = 'button'; advance.disabled = advancingIds.has(item.id);
        advance.setAttribute('aria-label', `${item.code}: ${nextStatus} aşamasına al`);
        advance.append(el('span', '', `${nextStatus} aşamasına al`));
        const arrow = el('span', 'request-next-icon');
        arrow.innerHTML = iconSvg('<path d="M5 12h14m-6-6 6 6-6 6"/>');
        advance.append(arrow);
        advance.addEventListener('click', () => advanceRequest(item.id, advance));
        cardGroup.append(advance);
      }
      if (statuses.indexOf(item.status) >= statuses.indexOf('Tamamlandı')) {
        const contact = el('button', 'request-contact');
        contact.type = 'button';
        contact.setAttribute('aria-label', `${item.code}: WhatsApp mesaj taslağını aç`);
        contact.innerHTML = whatsappSvg();
        contact.append(el('span', '', 'Müşteriye mesaj hazırla'));
        contact.addEventListener('click', () => openCompletionDraft(item.id, contact));
        cardGroup.append(contact);
      }
      cards.append(cardGroup);
    });
    if (!items.length) cards.append(el('div', 'empty', query ? 'Aramayla eşleşen talep yok.' : 'Bu aşamada talep yok.'));
    column.append(header, cards);
    board.append(column);
  });
}

async function advanceRequest(id, button) {
  if (advancingIds.has(id)) return;
  const current = requests.find(item => item.id === id);
  if (!current) return;
  advancingIds.add(id);
  button.disabled = true;
  try {
    const response = await fetch(`/api/requests/${id}/advance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected_status: current.status }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Talep ilerletilemedi.');
    const item = requests.find((request) => request.id === id);
    if (item) item.status = result.status;
    render();
    await load();
  } catch (error) {
    await load();
    $('#notice').textContent = error.message;
    $('#notice').hidden = false;
  } finally {
    advancingIds.delete(id);
    render();
  }
}

async function openCompletionDraft(id, button, feedback = null) {
  if (draftingIds.has(id)) return;
  draftingIds.add(id);
  const draftTab = window.open('about:blank', '_blank');
  if (draftTab) {
    draftTab.opener = null;
    draftTab.document.title = 'WhatsApp taslağı hazırlanıyor';
    draftTab.document.body.textContent = 'Mesaj taslağı hazırlanıyor…';
  }
  button.disabled = true;
  if (feedback) feedback.textContent = 'Mesaj taslağı hazırlanıyor…';
  try {
    const response = await fetch(`/api/requests/${id}/message-draft`, { method: 'POST' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Mesaj taslağı hazırlanamadı.');
    const url = `https://wa.me/${result.phone}?text=${encodeURIComponent(result.message)}`;
    if (draftTab && !draftTab.closed) {
      draftTab.location.replace(url);
    } else {
      const target = feedback || $('#notice');
      const link = el('a', 'draft-fallback', 'WhatsApp taslağını aç');
      link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      target.replaceChildren(link);
      target.hidden = false;
    }
    if (feedback && draftTab && !draftTab.closed) feedback.textContent = result.source === 'gemini' ? 'Gemini taslağı WhatsApp’ta açıldı. Göndermeden önce metni kontrol edin.' : 'Hazır taslak WhatsApp’ta açıldı. Göndermeden önce metni kontrol edin.';
    if (!feedback && result.source !== 'gemini' && draftTab && !draftTab.closed) {
      $('#notice').textContent = 'Gemini kullanılamadı; hazır mesaj taslağı açıldı.';
      $('#notice').hidden = false;
    }
  } catch (error) {
    if (draftTab && !draftTab.closed) draftTab.close();
    const target = feedback || $('#notice');
    target.textContent = error.message;
    target.hidden = false;
  } finally {
    draftingIds.delete(id);
    button.disabled = false;
  }
}

async function load() {
  if (busy) { reloadPending = true; return; }
  busy = true;
  try {
    do {
      reloadPending = false;
      try {
        const response = await fetch('/api/requests', { cache: 'no-store' });
        if (response.status === 401) { location.replace('/admin/login'); return; }
        if (!response.ok) throw new Error('Talepler yüklenemedi.');
        const data = await response.json();
        const previousIds = new Set(requests.map((item) => item.id));
        const newCount = requestsLoaded ? data.requests.filter((item) => item.status === 'Yeni' && !previousIds.has(item.id)).length : 0;
        requests = data.requests;
        requestsLoaded = true;
        if (Number.isSafeInteger(data.revision)) knownRevision = data.revision;
        $('#notice').hidden = true;
        render();
        if (newCount) $('#live-status').textContent = `${newCount} yeni talep geldi`;
      } catch (error) {
        $('#notice').textContent = `${error.message} Yenile düğmesiyle tekrar deneyin.`;
        $('#notice').hidden = false;
      }
    } while (reloadPending);
  } finally { busy = false; }
}

function showDetail(id) {
  if (selectedId !== null && !closeDetail()) return;
  detailReturnFocus = document.activeElement;
  selectedId = id;
  const item = requests.find((request) => request.id === id);
  if (!item) return;
  const detail = $('#detail');
  detail.replaceChildren();
  const head = el('div', 'drawer-head');
  const heading = el('div');
  heading.append(el('div', 'detail-code', item.code), el('h2', '', item.name));
  const close = el('button', 'close'); close.innerHTML = iconSvg('<path d="M5 5 19 19M19 5 5 19"/>'); close.type = 'button'; close.setAttribute('aria-label', 'Detayları kapat'); close.addEventListener('click', closeDetail);
  head.append(heading, close);
  const photos = el('div', 'photo-grid');
  item.photos.forEach((src, index) => { const link = el('a'); link.href = src; link.target = '_blank'; link.rel = 'noopener'; const image = el('img'); image.src = src; image.alt = `${item.model} fotoğraf ${index + 1}`; link.append(image); photos.append(link); });
  const info = el('div', 'detail-section');
  info.append(el('h3', '', 'Müşteri ve ürün'));
  const grid = el('div', 'detail-grid');
  [['Telefon', item.phone], ['Ürün türü', item.product_type], ['İşlemler', item.services.join(', ') || 'Belirtilmedi'], ['Oluşturulma', new Date(item.created_at).toLocaleString('tr-TR')]].forEach(([label, value]) => { const p = el('p'); p.append(el('strong', '', label), document.createTextNode(value)); grid.append(p); });
  info.append(grid);
  const notes = el('div', 'detail-section'); notes.append(el('h3', '', 'Müşteri notu'), el('p', '', item.notes || 'Not eklenmedi.'));
  const form = el('form', 'detail-section');
  form.append(el('h3', '', 'Atölye güncellemesi'));
  const modelLabel = el('label', '', 'Marka / model'); modelLabel.htmlFor = 'edit-model';
  const model = el('input'); model.id = 'edit-model'; model.maxLength = 100; model.required = true; model.value = item.model;
  const statusLabel = el('label', '', 'Talep durumu'); statusLabel.htmlFor = 'edit-status';
  const status = el('select'); status.id = 'edit-status'; statuses.forEach((value) => { const option = el('option', '', value); option.value = value; status.append(option); }); status.value = item.status;
  const noteLabel = el('label', '', 'Atölye iç notu'); noteLabel.htmlFor = 'edit-note';
  const note = el('textarea'); note.id = 'edit-note'; note.maxLength = 2000; note.value = item.admin_note;
  const reviewLabel = el('label', 'review-permission');
  const reviewCheckbox = el('input'); reviewCheckbox.type = 'checkbox'; reviewCheckbox.checked = Boolean(item.review_allowed);
  reviewLabel.append(reviewCheckbox, el('span', '', 'Müşteriye yorum izni ver'));
  const reviewHint = el('p', 'review-hint', 'Yalnızca “Teslim Edildi” aşamasında açılabilir.');
  const syncReview = () => { reviewCheckbox.disabled = status.value !== 'Teslim Edildi'; if (reviewCheckbox.disabled) reviewCheckbox.checked = false; };
  status.addEventListener('change', syncReview); syncReview();
  const save = el('button', 'save', 'Değişiklikleri kaydet'); save.type = 'submit';
  const message = el('p', 'save-message'); message.setAttribute('role', 'alert');
  form.append(modelLabel, model, statusLabel, status, noteLabel, note, reviewLabel, reviewHint, save, message);
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (detailSaving) return; detailSaving = true; save.disabled = true; save.textContent = 'Kaydediliyor…'; message.textContent = '';
    try {
      const response = await fetch(`/api/requests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: model.value, status: status.value, admin_note: note.value, review_allowed: reviewCheckbox.checked, expected_updated_at: item.updated_at }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Kaydedilemedi.');
      detailSnapshot = null; detailSaving = false; closeDetail(); await load();
    } catch (error) { message.textContent = error.message; }
    finally { detailSaving = false; save.disabled = false; save.textContent = 'Değişiklikleri kaydet'; }
  });
  detail.append(head, photos, info, notes, form);
  if (statuses.indexOf(item.status) >= statuses.indexOf('Tamamlandı')) {
    const contactSection = el('section', 'detail-section contact-section');
    contactSection.append(el('h3', '', 'Müşteriye haber ver'), el('p', '', 'İşlem tamamlandı. Taslak müşteri numarası için hazırlanır; gönderme işlemini siz yaparsınız.'));
    const contact = el('button', 'contact-customer'); contact.type = 'button';
    contact.innerHTML = whatsappSvg();
    contact.append(el('span', '', 'WhatsApp taslağını aç'));
    const feedback = el('p', 'contact-feedback'); feedback.setAttribute('role', 'status');
    contact.addEventListener('click', () => openCompletionDraft(item.id, contact, feedback));
    contactSection.append(contact, feedback);
    detail.append(contactSection);
  }
  detailSnapshot = detailValues();
  $('#overlay').hidden = false;
  document.body.style.overflow = 'hidden';
  close.focus();
}
function closeDetail() {
  if (detailSaving) return false;
  if (detailDirty() && !window.confirm('Kaydedilmemiş değişiklikler var. Değişiklikleri bırakıp kapatmak istiyor musunuz?')) return false;
  $('#overlay').hidden = true; document.body.style.overflow = ''; selectedId = null; detailSnapshot = null;
  if (detailReturnFocus?.isConnected) detailReturnFocus.focus(); else $('#search').focus();
  return true;
}
$('#overlay').addEventListener('click', (event) => { if (event.target.id === 'overlay') closeDetail(); });
document.addEventListener('keydown', (event) => {
  if ($('#overlay').hidden || document.body.classList.contains('admin-chat-open')) return;
  if (event.key === 'Escape') { event.preventDefault(); closeDetail(); }
  if (event.key === 'Tab') {
    const nodes = [...$('#detail').querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')].filter(node => node.getClientRects().length);
    const first = nodes[0], last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
$('#search').addEventListener('input', render);
$('#refresh').addEventListener('click', load);
load();
const events = new EventSource('/api/events');
events.addEventListener('change', (event) => {
  load();
});
events.addEventListener('review', () => { if (typeof reviewsView !== 'undefined' && !reviewsView.hidden) loadAdminReviews(); });
events.addEventListener('open', () => { if (!$('#live-status').textContent.includes('yeni talep')) $('#live-status').textContent = 'Canlı bildirim'; checkRevision(); });
events.addEventListener('error', () => { if (!$('#live-status').textContent.includes('yeni talep')) $('#live-status').textContent = 'Otomatik kontrol etkin'; });
let checkingRevision = false;
async function checkRevision() {
  if (document.hidden || checkingRevision) return;
  checkingRevision = true;
  try {
    const response = await fetch('/api/revision', { cache: 'no-store' });
    if (response.status === 401) { location.replace('/admin/login'); return; }
    if (!response.ok) throw new Error('Değişiklik kontrolü başarısız.');
    const {revision} = await response.json();
    if (Number.isSafeInteger(revision) && revision !== knownRevision) {
      await load();
    }
  } catch { /* EventSource yeniden bağlanırken sonraki kontrol tekrar dener. */ }
  finally { checkingRevision = false; }
}
setInterval(checkRevision, 4000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkRevision(); });

// Site content and form choices are edited on demand. No database request runs while this tab is idle.
const settingsStyle = el('link'); settingsStyle.rel = 'stylesheet'; settingsStyle.href = '/admin-settings.css'; document.head.append(settingsStyle);
const main = document.querySelector('main');
const dashboardView = el('section'); dashboardView.id = 'dashboard-view';
while (main.firstChild) dashboardView.append(main.firstChild);
const boardSummary = el('p', 'board-summary'); boardSummary.id = 'board-summary'; boardSummary.setAttribute('aria-live', 'polite');
dashboardView.querySelector('#board').before(boardSummary);
const settingsView = el('section'); settingsView.id = 'settings-view'; settingsView.hidden = true;
const reviewsView = el('section', 'admin-extra-view'); reviewsView.id = 'reviews-view'; reviewsView.hidden = true;
const analyticsView = el('section', 'admin-extra-view'); analyticsView.id = 'analytics-view'; analyticsView.hidden = true;
main.append(dashboardView, settingsView, reviewsView, analyticsView);
const sidebar = el('aside', 'admin-sidebar'); sidebar.id = 'admin-sidebar';
sidebar.setAttribute('aria-label', 'Yönetim menüsü');
const sidebarHead = el('div', 'sidebar-head');
sidebarHead.append(el('strong', 'sidebar-title', 'LOSTRA'), el('span', 'sidebar-subtitle', 'YÖNETİM PANELİ'));
const sidebarToggle = el('button', 'sidebar-toggle'); sidebarToggle.type = 'button'; sidebarToggle.setAttribute('aria-label', 'Menüyü daralt'); sidebarToggle.innerHTML = iconSvg('<path d="m14 6-6 6 6 6"/>');
sidebarHead.append(sidebarToggle); sidebar.append(sidebarHead);
const sidebarNav = el('nav', 'sidebar-nav'); sidebar.append(sidebarNav); document.body.prepend(sidebar);
const mobileToggle = el('button', 'mobile-sidebar-toggle'); mobileToggle.type = 'button'; mobileToggle.setAttribute('aria-label', 'Yönetim menüsünü aç'); mobileToggle.innerHTML = iconSvg('<path d="M4 6h16M4 12h16M4 18h16"/>');
$('.top').prepend(mobileToggle);
const sidebarBackdrop = el('button', 'sidebar-backdrop'); sidebarBackdrop.type = 'button'; sidebarBackdrop.setAttribute('aria-label', 'Menüyü kapat'); document.body.append(sidebarBackdrop);
function closeMobileSidebar() { document.body.classList.remove('sidebar-mobile-open'); mobileToggle.setAttribute('aria-expanded', 'false'); }
mobileToggle.addEventListener('click', () => { document.body.classList.toggle('sidebar-mobile-open'); mobileToggle.setAttribute('aria-expanded', String(document.body.classList.contains('sidebar-mobile-open'))); });
sidebarBackdrop.addEventListener('click', closeMobileSidebar);
function setCollapsed(collapsed) { document.body.classList.toggle('sidebar-collapsed', collapsed); sidebarToggle.setAttribute('aria-label', collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'); sidebarToggle.innerHTML = iconSvg(collapsed ? '<path d="m10 6 6 6-6 6"/>' : '<path d="m14 6-6 6 6 6"/>'); storage.set('lostra-sidebar-collapsed', String(collapsed)); }
sidebarToggle.addEventListener('click', () => setCollapsed(!document.body.classList.contains('sidebar-collapsed')));
setCollapsed(storage.get('lostra-sidebar-collapsed') === 'true');
const themeToggle = el('button', 'theme-toggle'); themeToggle.type = 'button';
$('.top-links').prepend(themeToggle);
const logoutButton = el('button', 'logout-button'); logoutButton.type = 'button';
logoutButton.innerHTML = iconSvg('<path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6"/>');
logoutButton.append(el('span', '', 'Çıkış yap'));
logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try {
    const response = await fetch('/api/admin/logout', { method: 'POST' });
    if (!response.ok) throw new Error('Çıkış yapılamadı. Tekrar deneyin.');
    location.replace('/admin/login');
  } catch (cause) {
    $('#notice').textContent = cause.message;
    $('#notice').hidden = false;
    logoutButton.disabled = false;
  }
});
$('.top-links').append(logoutButton);
function applyTheme(theme) { document.body.dataset.theme = theme; themeToggle.innerHTML = iconSvg(theme === 'dark' ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>' : '<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>'); themeToggle.append(el('span', '', theme === 'dark' ? 'Aydınlık mod' : 'Karanlık mod')); themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Aydınlık moda geç' : 'Karanlık moda geç'); storage.set('lostra-admin-theme', theme); }
themeToggle.addEventListener('click', () => applyTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark'));
applyTheme(storage.get('lostra-admin-theme') === 'dark' ? 'dark' : 'light');
const topSiteLink = $('.top-links a'); topSiteLink.textContent = 'Müşteri sitesi'; topSiteLink.insertAdjacentHTML('beforeend', iconSvg('<path d="M13 5h6v6m0-6-9 9"/><path d="M19 13v6H5V5h6"/>'));
const sideLinks = [];
function sideButton(label, path, view, status = null) {
  const button = el('button', 'side-link'); button.type = 'button'; button.title = label;
  button.innerHTML = iconSvg(path); button.append(el('span', 'side-label', label));
  button.addEventListener('click', () => { activeStatus = status; switchView(view); if (view === 'board') render(); history.replaceState(null, '', view === 'site' ? '/admin#site-settings' : view === 'analytics' ? '/admin#analytics' : view === 'reviews' ? '/admin#reviews' : status ? `/admin#status-${encodeURIComponent(status)}` : '/admin'); closeMobileSidebar(); });
  sideLinks.push({ button, view, status }); sidebarNav.append(button); return button;
}
sidebarNav.append(el('div', 'side-group', 'TALEP PANOSU'));
sideButton('Tüm Talepler', '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>', 'board');
const statusIcon = '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>';
statuses.forEach((status) => sideButton(status, statusIcon, 'board', status).classList.add('side-sub'));
sidebarNav.append(el('div', 'side-group', 'İÇERİK VE VERİ'));
sideButton('Müşteri Yorumları', '<path d="M4 4h16v12H8l-4 4V4Z"/><path d="M8 9h8M8 13h5"/>', 'reviews');
sideButton('Ziyaretçi Grafiği', '<path d="M3 20h18M5 17V9m5 8V5m5 12v-6m5 6V3"/>', 'analytics');
sidebarNav.append(el('div', 'side-group', 'AYARLAR'));
sideButton('Site Yapılandırması', '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>', 'site');
let siteConfig = null;
let settingsLoaded = false;
function switchView(view) {
  const site = view === 'site';
  dashboardView.hidden = view !== 'board';
  settingsView.hidden = !site;
  reviewsView.hidden = view !== 'reviews';
  analyticsView.hidden = view !== 'analytics';
  sideLinks.forEach(({button, view: target, status}) => { const active = target === view && (target !== 'board' || status === activeStatus); button.classList.toggle('active', active); if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  if (site && !settingsLoaded) loadSettings();
  if (view === 'reviews') loadAdminReviews();
  if (view === 'analytics') loadAnalytics();
}
async function loadAdminReviews() {
  reviewsView.innerHTML = '<div class="settings-intro"><span class="eyebrow">Müşteri deneyimleri</span><h1>Müşteri Yorumları</h1><p>Teslim edilen işlere ait yayınlanan yorumlar.</p></div><div class="admin-review-list">Yükleniyor…</div>';
  try { const response = await fetch('/api/reviews'); if (!response.ok) throw new Error(); const {reviews} = await response.json(); const list = reviewsView.querySelector('.admin-review-list'); list.replaceChildren(); if (!reviews.length) list.textContent = 'Henüz yorum yok.'; reviews.forEach(review => { const card = el('article', 'settings-card'); card.append(el('strong', '', `${review.name} · ${review.rating}/5`), el('p', '', review.comment)); list.append(card); }); } catch { reviewsView.querySelector('.admin-review-list').textContent = 'Yorumlar yüklenemedi.'; }
}
async function loadAnalytics() {
  analyticsView.innerHTML = '<div class="settings-intro"><span class="eyebrow">Son 14 gün</span><h1>Ziyaretçi Grafiği</h1><p>Her tarayıcı oturumu günde bir kez sayılır. Bu grafik sayfa açıkken veritabanını sorgulamaz.</p></div><div class="settings-card analytics-card">Yükleniyor…</div>';
  try {
    const response = await fetch('/api/analytics');
    if (!response.ok) throw new Error();
    const {days} = await response.json();
    const card = analyticsView.querySelector('.analytics-card');
    card.replaceChildren();
    const total = days.reduce((sum, day) => sum + day.count, 0);
    card.append(el('h2', '', `${total} ziyaret`), el('p', '', 'Son 14 günün toplamı'));
    const firstVisit = days.findIndex(day => day.count > 0);
    if (firstVisit < 0) {
      card.append(el('p', 'analytics-empty', 'Son 14 günde henüz ziyaret kaydı yok.'));
      return;
    }
    const visibleDays = days.slice(firstVisit);
    const chart = el('div', 'visit-chart');
    chart.setAttribute('role', 'img');
    chart.setAttribute('aria-label', `İlk ziyaret gününden bugüne günlük ziyaretler. Toplam ${total} ziyaret.`);
    const max = Math.max(...visibleDays.map(day => day.count));
    const dateLabel = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });
    visibleDays.forEach(day => {
      const column = el('div', 'visit-day');
      const bar = el('div', 'visit-bar');
      bar.style.height = `${Math.max(3, day.count / max * 180)}px`;
      column.title = `${day.day}: ${day.count} ziyaret`;
      column.append(el('span', 'visit-count', String(day.count)), bar, el('small', '', dateLabel.format(new Date(`${day.day}T12:00:00Z`))));
      chart.append(column);
    });
    card.append(chart, el('p', 'analytics-note', 'Grafik ilk ziyaret kaydından başlar.'));
  } catch { analyticsView.querySelector('.analytics-card').textContent = 'Grafik yüklenemedi.'; }
}

const contentGroups = [
  { title: 'Giriş alanı', intro: 'Ana sayfanın ilk görünen başlığı ve açıklaması.', fields: [['hero_title_before','Başlık başlangıcı'],['hero_title_accent','Vurgulu kelime'],['hero_title_after','Başlık sonu'],['hero_subtitle','Kısa açıklama']] },
  { title: 'Hizmetler ve süreç', intro: 'Hizmet ve işleyiş bölümlerinin üst metinleri.', fields: [['services_title','Hizmetler başlığı'],['services_intro','Hizmetler açıklaması'],['process_title','Süreç başlığı'],['process_intro','Süreç açıklaması']] },
  { title: 'Form ve takip', intro: 'Müşterinin talep oluştururken ve sorgularken gördüğü metinler.', fields: [['form_title','Form başlığı'],['form_intro','Form açıklaması'],['tracking_title','Takip başlığı'],['tracking_intro','Takip açıklaması']] },
  { title: 'Diğer sayfa metinleri', intro: 'Galeri, iletişim ve alt bölüm metinleri.', fields: [['gallery_title','Galeri başlığı'],['contact_title','İletişim başlığı'],['contact_intro','İletişim açıklaması'],['footer_intro','Alt bölüm açıklaması']] },
];
for (let index = 1; index <= 5; index++) contentGroups.push({ title: `Hizmet ${index}`, intro: 'Hizmet listesindeki başlık ve açıklama.', fields: [[`service_${index}_title`,'Hizmet adı'],[`service_${index}_intro`,'Hizmet açıklaması']] });
for (let index = 1; index <= 4; index++) contentGroups.push({ title: `Süreç adımı ${index}`, intro: 'Adım adı sabittir; açıklamasını düzenleyebilirsiniz.', fields: [[`step_${index}_intro`,'Adım açıklaması']] });
const longFields = new Set(['hero_subtitle','services_intro','process_intro','form_intro','tracking_intro','contact_intro','footer_intro']);
function settingsCard(title, intro) {
  const card = el('section', 'settings-card');
  card.append(el('h2', '', title), el('p', '', intro));
  return card;
}
function choiceRow(value) {
  const row = el('div', 'choice-row');
  const input = el('input'); input.type = 'text'; input.maxLength = 80; input.required = true; input.value = value; input.setAttribute('aria-label', 'Seçenek adı');
  const up = el('button'); up.innerHTML = iconSvg('<path d="m6 14 6-6 6 6"/>'); up.type = 'button'; up.title = 'Yukarı taşı'; up.setAttribute('aria-label', 'Seçeneği yukarı taşı');
  const down = el('button'); down.innerHTML = iconSvg('<path d="m6 10 6 6 6-6"/>'); down.type = 'button'; down.title = 'Aşağı taşı'; down.setAttribute('aria-label', 'Seçeneği aşağı taşı');
  const remove = el('button'); remove.innerHTML = iconSvg('<path d="M5 5 19 19M19 5 5 19"/>'); remove.type = 'button'; remove.title = 'Sil'; remove.setAttribute('aria-label', 'Seçeneği sil');
  up.addEventListener('click', () => { if (row.previousElementSibling) row.parentNode.insertBefore(row, row.previousElementSibling); });
  down.addEventListener('click', () => { if (row.nextElementSibling) row.parentNode.insertBefore(row.nextElementSibling, row); });
  remove.addEventListener('click', () => row.remove());
  row.append(input, up, down, remove);
  return row;
}
function imagePicker(labelText) {
  const picker = el('label', 'image-picker');
  const upload = el('input', 'image-upload');
  upload.type = 'file';
  upload.accept = 'image/jpeg,image/png,image/webp';
  upload.setAttribute('aria-label', labelText);
  const action = el('span', 'image-picker-action');
  action.innerHTML = iconSvg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>');
  action.append(document.createTextNode(' Görsel seç'));
  const filename = el('span', 'image-picker-name', 'Dosya seçilmedi');
  upload.addEventListener('change', () => { filename.textContent = upload.files?.[0]?.name || 'Dosya seçilmedi'; });
  picker.append(upload, action, filename);
  return { picker, upload };
}
function galleryRow(item = { label: '', title: '', intro: '', image: '' }) {
  const row = el('div', 'gallery-setting-row');
  const header = el('div', 'gallery-row-head');
  header.append(el('strong', '', item.title || 'Yeni galeri görseli'));
  const moveUp = el('button'); moveUp.type = 'button'; moveUp.setAttribute('aria-label', 'Galeri görselini yukarı taşı'); moveUp.innerHTML = iconSvg('<path d="m6 14 6-6 6 6"/>'); moveUp.addEventListener('click', () => { if (row.previousElementSibling) row.parentNode.insertBefore(row, row.previousElementSibling); });
  const moveDown = el('button'); moveDown.type = 'button'; moveDown.setAttribute('aria-label', 'Galeri görselini aşağı taşı'); moveDown.innerHTML = iconSvg('<path d="m6 10 6 6 6-6"/>'); moveDown.addEventListener('click', () => { if (row.nextElementSibling) row.parentNode.insertBefore(row.nextElementSibling, row); });
  const remove = el('button'); remove.type = 'button'; remove.setAttribute('aria-label', 'Galeri görselini kaldır'); remove.innerHTML = iconSvg('<path d="M5 5 19 19M19 5 5 19"/>'); remove.addEventListener('click', () => row.remove()); header.append(remove);
  header.insertBefore(moveUp, remove); header.insertBefore(moveDown, remove);
  row.append(header);
  [['label','Çalışma kategorisi'],['title','Çalışma başlığı'],['intro','Çalışma açıklaması']].forEach(([key, name]) => {
    const label = el('label', 'setting-field'); label.append(el('span', '', name));
    const input = key === 'intro' ? el('textarea') : el('input'); input.dataset.galleryField = key; input.required = true; input.maxLength = 600; input.value = item[key]; label.append(input); row.append(label);
  });
  const imageValue = el('input'); imageValue.type = 'hidden'; imageValue.dataset.galleryField = 'image'; imageValue.value = item.image;
  const preview = el('img', 'setting-image-preview'); preview.alt = 'Galeri görseli önizleme'; if (item.image) preview.src = item.image;
  const {picker, upload} = imagePicker('Galeri görseli yükle');
  const message = el('small', 'upload-message', 'JPG, PNG veya WebP · en fazla 5 MB');
  upload.addEventListener('change', async () => {
    const file = upload.files?.[0]; if (!file) return;
    upload.disabled = true; message.textContent = 'Görsel yükleniyor…';
    try { const data = new FormData(); data.append('image', file); const response = await fetch('/api/site-image', { method: 'POST', body: data }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Görsel yüklenemedi.'); imageValue.value = result.url; preview.src = result.url; message.textContent = 'Görsel yüklendi. Yayınlamak için kaydedin.'; }
    catch (error) { message.textContent = error.message; } finally { upload.disabled = false; }
  });
  row.append(imageValue, picker, message, preview);
  return row;
}
function renderSettings() {
  settingsView.replaceChildren();
  const intro = el('div', 'settings-intro');
  intro.append(el('span', 'eyebrow', 'Görünüm ve form'), el('h1', '', 'Site Ayarları'), el('p', '', 'Metinleri, ürün türlerini ve işlem seçeneklerini buradan düzenleyin. Kaydettiğiniz değişiklikler yeni açılan müşteri sayfasında görünür.'));
  const form = el('form'); form.id = 'settings-form';
  const grid = el('div', 'settings-grid');
  contentGroups.forEach((group) => {
    const card = settingsCard(group.title, group.intro);
    const fields = el('div', 'settings-fields');
    group.fields.forEach(([key, labelText]) => {
      const isLong = longFields.has(key) || key.endsWith('_intro');
      const isImage = key.endsWith('_image');
      const label = el(isImage ? 'div' : 'label', `setting-field ${isLong || isImage ? 'full' : ''}`);
      label.append(el('span', '', labelText));
      const input = el(isLong ? 'textarea' : 'input');
      input.dataset.key = key;
      input.required = true;
      input.maxLength = 600;
      input.value = siteConfig.content[key];
      label.append(input);
      if (isImage) {
        const {picker, upload} = imagePicker(`${group.title} için görsel yükle`);
        const preview = el('img', 'setting-image-preview'); preview.src = input.value; preview.alt = `${group.title} önizleme`;
        const uploadMessage = el('small', 'upload-message', 'JPG, PNG veya WebP · en fazla 5 MB');
        upload.addEventListener('change', async () => {
          const file = upload.files?.[0]; if (!file) return;
          upload.disabled = true; uploadMessage.textContent = 'Görsel yükleniyor…';
          try {
            const data = new FormData(); data.append('image', file);
            const response = await fetch('/api/site-image', { method: 'POST', body: data });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Görsel yüklenemedi.');
            input.value = result.url; preview.src = result.url;
            uploadMessage.textContent = 'Görsel yüklendi. Yayınlamak için değişiklikleri kaydedin.';
          } catch (error) { uploadMessage.textContent = error.message; }
          finally { upload.disabled = false; }
        });
        input.addEventListener('change', () => { preview.src = input.value; });
        label.append(picker, uploadMessage, preview);
      }
      fields.append(label);
    });
    card.append(fields); grid.append(card);
  });
  const galleryCard = settingsCard('Galeri görselleri', 'Görsel ekleyin, sıralayın veya kaldırın. Değişiklikler kaydedildikten sonra sitede görünür.');
  galleryCard.classList.add('wide');
  const galleryList = el('div', 'gallery-settings-list'); galleryList.id = 'settings-gallery';
  siteConfig.gallery.forEach((item) => galleryList.append(galleryRow(item)));
  const addGallery = el('button', 'add-choice', 'Galeri görseli ekle'); addGallery.type = 'button';
  addGallery.addEventListener('click', () => { if (galleryList.children.length >= 24) return; const row = galleryRow(); galleryList.append(row); row.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  galleryCard.append(galleryList, addGallery); grid.append(galleryCard);
  [['product_types','Ürün türleri','Müşterinin formda seçebileceği ürün kategorileri.'],['services','İşlem seçenekleri','Müşterinin birden fazla seçebileceği hizmetler.']].forEach(([key,title,introText], index) => {
    const card = settingsCard(title, introText);
    const list = el('div', 'choice-list'); list.id = `settings-${key}`;
    siteConfig[key].forEach((choice) => list.append(choiceRow(choice)));
    const add = el('button', 'add-choice', 'Seçenek ekle'); add.type = 'button';
    add.addEventListener('click', () => { if (list.children.length >= 15) return; const row = choiceRow(''); list.append(row); row.querySelector('input').focus(); });
    card.append(list, add); grid.insertBefore(card, grid.children[index] || null);
  });
  const actions = el('div', 'settings-actions');
  const message = el('span', 'settings-message'); message.id = 'settings-message'; message.setAttribute('role', 'status');
  const preview = el('a', 'preview-link'); preview.href = '/'; preview.target = '_blank'; preview.rel = 'noopener'; preview.innerHTML = iconSvg('<path d="M13 5h6v6m0-6-9 9"/><path d="M19 13v6H5V5h6"/>'); preview.append(el('span', '', 'Siteyi görüntüle'));
  const save = el('button', 'settings-save', 'Değişiklikleri kaydet'); save.type = 'submit';
  actions.append(message, preview, save);
  form.append(grid, actions); form.addEventListener('submit', saveSettings);
  settingsView.append(intro, form);
  const aiCard = settingsCard('Gemini bağlantısı', 'API anahtarı yalnızca bu sunucuda saklanır. Müşteri asistanı site metinlerini kullanır; yönetici asistanı talep bilgilerini yalnızca komut verdiğinizde Gemini’ye gönderir.');
  aiCard.classList.add('ai-settings-card');
  const aiField = el('label', 'setting-field'); aiField.append(el('span', '', 'Gemini API anahtarı'));
  const aiInput = el('input'); aiInput.type = 'password'; aiInput.autocomplete = 'off'; aiInput.dataset.lpignore = 'true'; aiInput.placeholder = 'Yeni anahtarı buraya girin'; aiInput.setAttribute('aria-label', 'Gemini API anahtarı'); aiField.append(aiInput);
  const aiStatus = el('p', 'ai-settings-status', 'Bağlantı durumu yükleniyor…'); aiStatus.setAttribute('role', 'status');
  const aiActions = el('div', 'ai-settings-actions');
  const aiSave = el('button', 'settings-save', 'Anahtarı kaydet'); aiSave.type = 'button';
  const aiTest = el('button', 'refresh', 'Bağlantıyı test et'); aiTest.type = 'button';
  const aiClear = el('button', 'refresh', 'Anahtarı sil'); aiClear.type = 'button';
  aiActions.append(aiSave, aiTest, aiClear); aiCard.append(aiField, aiActions, aiStatus); settingsView.insertBefore(aiCard, form);
  const setAiStatus = (data) => { aiStatus.textContent = data.configured ? `Anahtar kayıtlı · ${data.model}` : 'Anahtar kayıtlı değil. Sohbetler henüz çalışmaz.'; };
  fetch('/api/admin/ai-settings', { cache: 'no-store' }).then((response) => response.json()).then(setAiStatus).catch(() => { aiStatus.textContent = 'Bağlantı durumu alınamadı.'; });
  async function updateAiKey(value) {
    const response = await fetch('/api/admin/ai-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: value }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Anahtar kaydedilemedi.');
    aiInput.value = ''; setAiStatus(result);
  }
  aiSave.addEventListener('click', async () => { if (!aiInput.value.trim()) { aiStatus.textContent = 'Önce bir anahtar girin.'; return; } aiSave.disabled = true; try { await updateAiKey(aiInput.value.trim()); } catch (error) { aiStatus.textContent = error.message; } finally { aiSave.disabled = false; } });
  aiClear.addEventListener('click', async () => { aiClear.disabled = true; try { await updateAiKey(''); } catch (error) { aiStatus.textContent = error.message; } finally { aiClear.disabled = false; } });
  aiTest.addEventListener('click', async () => { aiTest.disabled = true; aiStatus.textContent = 'Gemini bağlantısı deneniyor…'; try { const response = await fetch('/api/admin/ai-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Bağlantı kurulamadı.'); aiStatus.textContent = 'Gemini bağlantısı başarılı.'; } catch (error) { aiStatus.textContent = error.message; } finally { aiTest.disabled = false; } });
}
async function loadSettings() {
  settingsView.replaceChildren(el('p', 'settings-loading', 'Site ayarları yükleniyor…'));
  try {
    const response = await fetch('/api/site', { cache: 'no-store' });
    if (!response.ok) throw new Error('Ayarlar alınamadı.');
    siteConfig = await response.json();
    settingsLoaded = true;
    renderSettings();
  } catch (error) { settingsView.replaceChildren(el('p', 'notice', `${error.message} Sayfayı yenileyip tekrar deneyin.`)); }
}
async function saveSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const save = form.querySelector('.settings-save');
  if (save.disabled) return;
  const message = $('#settings-message');
  if (form.querySelector('input[type=file]:disabled')) { message.textContent = 'Görsellerin yüklenmesini bekleyin.'; return; }
  const content = { ...siteConfig.content };
  form.querySelectorAll('[data-key]').forEach((input) => { content[input.dataset.key] = input.value.trim(); });
  const choices = (key) => [...form.querySelectorAll(`#settings-${key} input`)].map((input) => input.value.trim());
  const gallery = [...form.querySelectorAll('.gallery-setting-row')].map((row) => Object.fromEntries([...row.querySelectorAll('[data-gallery-field]')].map((input) => [input.dataset.galleryField, input.value.trim()])));
  const config = { content, product_types: choices('product_types'), services: choices('services'), gallery };
  save.disabled = true; save.textContent = 'Kaydediliyor…'; message.textContent = ''; message.classList.remove('error');
  try {
    const response = await fetch('/api/site', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ayarlar kaydedilemedi.');
    siteConfig = config;
    message.textContent = 'Değişiklikler kaydedildi. Önizleme için siteyi yeniden açın.';
  } catch (error) { message.textContent = error.message; message.classList.add('error'); }
  finally { save.disabled = false; save.textContent = 'Değişiklikleri kaydet'; }
}
if (location.hash === '#site-settings') switchView('site');
else if (location.hash === '#analytics') switchView('analytics');
else if (location.hash === '#reviews') switchView('reviews');
else if (location.hash.startsWith('#status-')) { try { activeStatus = decodeURIComponent(location.hash.slice(8)); } catch { activeStatus = null; } if (!statuses.includes(activeStatus)) activeStatus = null; switchView('board'); render(); }
else switchView('board');

window.addEventListener('beforeunload', event => { if (detailDirty() || detailSaving) { event.preventDefault(); event.returnValue = ''; } });
