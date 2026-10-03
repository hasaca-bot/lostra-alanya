(() => {
  const $ = (selector) => document.querySelector(selector);
  const rows = $('#event-rows');
  const seen = new Set();
  let counts = { http_errors: 0, browser_errors: 0, server_errors: 0 };
  const labels = { http: 'HTTP hatası', browser: 'Tarayıcı hatası', server: 'Sunucu hatası' };

  function errorCount() {
    $('#error-count').textContent = String(counts.http_errors + counts.browser_errors + counts.server_errors);
  }
  function duration(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return days ? `${days} gün ${hours} sa` : hours ? `${hours} sa ${minutes} dk` : `${minutes} dk`;
  }
  function rowFor(event, animate = false) {
    const row = document.createElement('tr');
    row.dataset.id = event.id || '';
    if (animate) row.className = 'event-new';
    const where = event.kind === 'browser' ? `${event.route} · ${event.source || 'unknown'}:${event.line || 0}` : event.route;
    const values = [new Date(event.time).toLocaleString('tr-TR'), labels[event.kind] || 'Hata', where, event.status || '—'];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = String(value);
      row.append(cell);
    }
    return row;
  }
  function replaceEvents(events) {
    rows.replaceChildren();
    seen.clear();
    if (!events.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 4; cell.className = 'empty'; cell.textContent = 'Henüz hata kaydı yok.';
      row.append(cell); rows.append(row); return;
    }
    for (const event of events) {
      if (event.id) seen.add(event.id);
      rows.append(rowFor(event));
    }
  }
  function addEvent(event) {
    if (event.id && seen.has(event.id)) return;
    if (event.id) seen.add(event.id);
    if (rows.querySelector('.empty')) rows.replaceChildren();
    rows.prepend(rowFor(event, true));
    while (rows.children.length > 30) rows.lastChild.remove();
    if (seen.size > 80) {
      seen.clear();
      rows.querySelectorAll('tr[data-id]').forEach((row) => { if (row.dataset.id) seen.add(row.dataset.id); });
    }
  }
  async function refresh() {
    const button = $('#refresh'); button.disabled = true;
    try {
      const response = await fetch('/api/diagnostics', { cache: 'no-store' });
      if (!response.ok) throw new Error('Tanılama bilgileri alınamadı.');
      const data = await response.json();
      counts = data.counts;
      $('#server-status').textContent = 'Çalışıyor';
      $('#database-status').textContent = data.database;
      $('#uptime').textContent = duration(data.uptime_seconds);
      errorCount();
      replaceEvents(data.events);
      $('#updated').textContent = `Son kontrol: ${new Date(data.time).toLocaleString('tr-TR')}`;
    } catch (error) {
      $('#server-status').textContent = 'Erişilemiyor';
      $('#updated').textContent = error.message;
    } finally { button.disabled = false; }
  }

  $('#refresh').addEventListener('click', refresh);
  refresh();
  async function refreshLive() {
    try {
      const response = await fetch('/api/diagnostics/live', { cache: 'no-store' });
      if (!response.ok) throw new Error('Canlı izleme kesildi.');
      const data = await response.json();
      counts = data.counts;
      $('#server-status').textContent = 'Çalışıyor';
      $('#uptime').textContent = duration(data.uptime_seconds);
      [...data.events].reverse().forEach(addEvent);
      errorCount();
      $('#connection').textContent = 'Canlı izleme açık';
    } catch (_) {
      $('#server-status').textContent = 'Erişilemiyor';
      $('#connection').textContent = 'Yeniden bağlanıyor';
    }
  }
  setInterval(refreshLive, 5000);
  const stream = new EventSource('/api/diagnostics/events');
  let connectedBefore = false;
  stream.addEventListener('open', () => {
    $('#connection').textContent = 'Canlı izleme açık';
    if (connectedBefore) refreshLive();
    connectedBefore = true;
  });
  stream.addEventListener('error', () => { $('#connection').textContent = 'Yeniden bağlanıyor'; });
  stream.addEventListener('diagnostic', (message) => {
    const event = JSON.parse(message.data);
    if (event.id && seen.has(event.id)) return;
    addEvent(event);
    if (event.kind === 'http') counts.http_errors++;
    if (event.kind === 'browser') counts.browser_errors++;
    if (event.kind === 'server') counts.server_errors++;
    errorCount();
  });
})();
