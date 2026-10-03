(() => {
  const admin = location.pathname.startsWith('/admin');
  const icon = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const root = document.createElement('div'); root.className = `chat-widget ${admin ? 'chat-admin' : 'chat-customer'}`;
  const launcher = document.createElement('button'); launcher.type = 'button'; launcher.className = 'chat-launcher'; launcher.setAttribute('aria-label', admin ? 'Yönetici asistanını aç' : 'Müşteri asistanını aç'); launcher.setAttribute('aria-expanded', 'false');
  const logo = document.createElement('img'); logo.src = '/ai-robot.svg'; logo.alt = ''; logo.className = 'chat-logo'; logo.width = 64; logo.height = 64; launcher.append(logo);
  const panel = document.createElement('section'); panel.className = 'chat-panel'; panel.hidden = true; panel.setAttribute('aria-label', admin ? 'Yönetici asistanı sohbeti' : 'Müşteri asistanı sohbeti');
  if (admin) { panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); }
  const head = document.createElement('div'); head.className = 'chat-head';
  const title = document.createElement('div');
  const name = document.createElement('h2'); name.textContent = admin ? 'Atölye asistanı' : 'Lostra asistanı';
  const intro = document.createElement('p'); intro.textContent = admin ? 'Talep arayın ve kayıtları komutla güncelleyin.' : 'Hizmetler ve talep süreci hakkında sorun.';
  title.append(name, intro);
  const close = document.createElement('button'); close.type = 'button'; close.className = 'chat-close'; close.setAttribute('aria-label', 'Sohbeti kapat'); close.innerHTML = icon('<path d="M5 5l14 14M19 5 5 19"/>');
  const headLogo = document.createElement('img'); headLogo.src = '/ai-robot.svg'; headLogo.alt = ''; headLogo.className = 'chat-head-logo'; headLogo.width = 38; headLogo.height = 38;
  head.append(headLogo, title, close);
  const stream = document.createElement('div'); stream.className = 'chat-stream'; stream.setAttribute('role', 'log'); stream.setAttribute('aria-live', 'polite');
  if (admin) {
    const hero = document.createElement('div'); hero.className = 'chat-admin-hero';
    const heroLogo = document.createElement('img'); heroLogo.src = '/ai-robot.svg'; heroLogo.alt = ''; heroLogo.width = 80; heroLogo.height = 80;
    const heroTitle = document.createElement('h3'); heroTitle.textContent = 'Atölye asistanına sorun';
    hero.append(heroLogo, heroTitle); stream.append(hero);
  }
  const welcome = document.createElement('p'); welcome.className = 'chat-welcome'; welcome.textContent = admin ? 'Talepleri bulun, durumlarını güncelleyin ve müşteri işlemlerini yönetin.' : 'Ayakkabı bakım hizmetlerimizi, talep formunu veya takip sürecini sorabilirsiniz.'; stream.append(welcome);
  const faq = document.createElement('section'); faq.className = 'chat-faq'; faq.setAttribute('aria-label', 'Hazır soru ve cevaplar');
  const faqTitle = document.createElement('h3'); faqTitle.textContent = 'Sık sorulanlar'; faq.append(faqTitle);
  const entries = admin ? [
    ['Yeni talepleri nasıl görürüm?', 'Talep panosunda Yeni bölümünü açabilir veya asistana “Yeni talepleri göster” yazabilirsiniz.'],
    ['Talep durumunu nasıl değiştiririm?', 'Takip koduyla talebi bulun ve durumunu seçin. Asistana da “LA-… kodlu talebi Hazırlanıyor durumuna al” diyebilirsiniz.'],
    ['Yorum izni ne zaman açılır?', 'Talep Teslim Edildi aşamasına geçince ilgili kayıt için yorum iznini açabilirsiniz.']
  ] : [
    ['Nasıl talep oluştururum?', 'Teklif formuna ürün bilgilerinizi ve fotoğraflarınızı ekleyin. Gönderince takip kodu alırsınız.', '#teklif-al'],
    ['Fiyatı nasıl öğrenirim?', 'Ürününüz incelendikten sonra teklif paylaşılır. Fotoğrafla teklif talebi oluşturabilirsiniz.', '#teklif-al'],
    ['Talebimi nasıl takip ederim?', 'Size verilen takip kodunu Talep Takibi bölümüne girin; güncel aşamayı orada görürsünüz.', '#takip'],
    ['Hangi hizmetler var?', 'Temizleme, boyama, taban ve dikiş onarımı ile restorasyon hizmetleri için teklif isteyebilirsiniz.', '#hizmetler']
  ];
  for (const [question, answer, href] of entries) {
    const details = document.createElement('details');
    const summary = document.createElement('summary'); summary.textContent = question;
    const chevron = document.createElement('span'); chevron.innerHTML = icon('<path d="m6 9 6 6 6-6"/>'); summary.append(chevron);
    const response = document.createElement('p'); response.textContent = answer;
    details.append(summary, response);
    if (href) { const link = document.createElement('a'); link.href = href; link.textContent = 'İlgili bölüme git'; details.append(link); }
    faq.append(details);
  }
  stream.append(faq);
  const form = document.createElement('form'); form.className = 'chat-compose';
  const input = document.createElement('textarea'); input.rows = 2; input.maxLength = 1500; input.required = true; input.placeholder = admin ? 'Talep hakkında talimat yazın…' : 'Sorunuzu yazın…'; input.setAttribute('aria-label', 'Sohbet mesajı');
  const send = document.createElement('button'); send.type = 'submit'; send.setAttribute('aria-label', 'Mesajı gönder'); send.innerHTML = icon('<path d="m3 11 18-8-8 18-2-8-8-2Zm8 2 10-10"/>');
  form.append(input, send); panel.append(head, stream, form); root.append(panel, launcher); document.body.append(root);
  const messages = [];
  let submitting = false;
  let previousFocus = null;
  let modalSiblings = [];
  let followLatest = true;
  let openFrame = 0;
  panel.id = 'lostra-chat-panel'; launcher.setAttribute('aria-controls', panel.id);
  function scrollToLatest(force = false) { if (force || followLatest) stream.scrollTop = stream.scrollHeight; }
  stream.addEventListener('scroll', () => { followLatest = stream.scrollHeight - stream.scrollTop - stream.clientHeight < 72; });
  function bubble(text, sender) { const item = document.createElement('p'); item.className = `chat-message chat-${sender}`; item.textContent = text; if (admin) panel.classList.add('has-messages'); stream.append(item); scrollToLatest(true); return item; }
  function fitAdminViewport() {
    if (!admin) return;
    const viewport = window.visualViewport;
    panel.style.setProperty('--chat-visible-height', `${Math.round(viewport?.height ?? window.innerHeight)}px`);
    panel.style.setProperty('--chat-visible-top', `${Math.round(viewport?.offsetTop ?? 0)}px`);
  }
  if (admin) {
    window.visualViewport?.addEventListener('resize', fitAdminViewport);
    window.visualViewport?.addEventListener('scroll', fitAdminViewport);
    window.addEventListener('resize', fitAdminViewport);
    fitAdminViewport();
  }
  let closeTimer;
  function toggle(open) {
    clearTimeout(closeTimer);
    cancelAnimationFrame(openFrame);
    launcher.setAttribute('aria-expanded', String(open));
    launcher.setAttribute('aria-label', open ? 'Sohbeti kapat' : admin ? 'Yönetici asistanını aç' : 'Müşteri asistanını aç');
    if (admin) {
      if (open) {
        previousFocus = document.activeElement;
        modalSiblings = [...document.body.children].filter(node => node !== root && !node.inert);
        modalSiblings.forEach(node => { node.inert = true; });
        fitAdminViewport();
        panel.hidden = false;
        root.classList.add('chat-open');
        document.body.classList.add('admin-chat-open');
        openFrame = requestAnimationFrame(() => panel.classList.add('is-open'));
        input.focus();
      } else {
        panel.classList.remove('is-open');
        closeTimer = setTimeout(() => {
          panel.hidden = true;
          document.body.classList.remove('admin-chat-open');
          root.classList.remove('chat-open');
          modalSiblings.forEach(node => { node.inert = false; }); modalSiblings = [];
          (previousFocus?.isConnected ? previousFocus : launcher).focus();
        }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 340);
      }
    } else {
      panel.hidden = !open;
      if (open) input.focus(); else launcher.focus();
    }
  }
  launcher.addEventListener('click', () => toggle(panel.hidden)); close.addEventListener('click', () => toggle(false));
  document.addEventListener('keydown', (event) => {
    if (panel.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); toggle(false); }
    if (admin && event.key === 'Tab') {
      const focusable = [...panel.querySelectorAll('button:not(:disabled), textarea:not(:disabled), summary, a[href]')].filter(node => node.getClientRects().length > 0);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); const text = input.value.trim(); if (!text || submitting) return;
    submitting = true; stream.setAttribute('aria-busy', 'true');
    bubble(text, 'user'); messages.push({ role: 'user', text }); input.value = ''; send.disabled = true; input.disabled = true;
    const pending = bubble('Yanıt hazırlanıyor…', 'assistant'); pending.classList.add('chat-pending');
    const letters = [];
    let ticker = null; let wakeDrain = null; let fullReply = ''; let gotDone = false; let changed = false;
    function showLetters() {
      if (!letters.length) { clearInterval(ticker); ticker = null; if (wakeDrain) { wakeDrain(); wakeDrain = null; } return; }
      pending.textContent += letters.shift(); scrollToLatest();
    }
    function append(textPart) {
      if (!textPart) return;
      if (pending.classList.contains('chat-pending')) { pending.textContent = ''; pending.classList.remove('chat-pending'); }
      fullReply += textPart; letters.push(...Array.from(textPart));
      if (!ticker) ticker = setInterval(showLetters, 7);
    }
    function drain() { return ticker ? new Promise((resolve) => { wakeDrain = resolve; }) : Promise.resolve(); }
    function handleEvent(block) {
      const lines = block.split(/\r?\n/).filter((line) => line.startsWith('data:'));
      if (!lines.length) return;
      const data = JSON.parse(lines.map((line) => line.slice(5).trimStart()).join('\n'));
      if (data.type === 'delta') append(data.text);
      else if (data.type === 'action') changed = true;
      else if (data.type === 'done') { gotDone = true; if (data.actions?.length) changed = true; }
      else if (data.type === 'error') throw new Error(data.error || 'Yanıt alınamadı.');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    let reader;
    try {
      const response = await fetch(admin ? '/api/chat/admin' : '/api/chat/customer', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' }, signal: controller.signal, body: JSON.stringify({ messages: messages.slice(-11) }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Yanıt alınamadı.'); }
      if (!response.body) throw new Error('Sohbet akışı açılamadı.');
      reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        let boundary;
        while ((boundary = buffer.search(/\r?\n\r?\n/)) !== -1) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, '');
          handleEvent(block);
        }
        if (done) break;
      }
      if (buffer.trim()) handleEvent(buffer);
      if (!gotDone) throw new Error('Sohbet akışı tamamlanamadı.');
      await drain();
      if (!fullReply.trim()) throw new Error('Yanıt alınamadı. Lütfen yeniden deneyin.');
      messages.push({ role: 'model', text: fullReply.slice(0, 5000) });
      if (admin && changed && typeof load === 'function') load();
    } catch (error) {
      if (ticker) { clearInterval(ticker); ticker = null; }
      pending.textContent = error.name === 'AbortError' ? 'Yanıt zaman aşımına uğradı. Lütfen yeniden deneyin.' : error.message; pending.classList.remove('chat-pending'); pending.classList.add('chat-error'); messages.pop();
      if (admin && changed && typeof load === 'function') load();
    } finally { clearTimeout(timeout); if (reader) { try { await reader.cancel(); } catch { /* The stream may already be closed. */ } } submitting = false; stream.setAttribute('aria-busy', 'false'); send.disabled = false; input.disabled = false; if (launcher.getAttribute('aria-expanded') === 'true') input.focus(); scrollToLatest(); }
  });
})();
