(() => {
  const page = location.pathname.startsWith('/admin') ? 'admin' : location.pathname.startsWith('/diagnostics') ? 'diagnostics' : 'site';
  const sources = new Set(['app.js', 'admin.js', 'chat-ui.js', 'diagnostics.js', 'diagnostics-client.js']);
  function report(kind, filename = '', line = 0, column = 0) {
    let source = 'unknown';
    try {
      const name = new URL(filename, location.href).pathname.split('/').pop();
      if (sources.has(name)) source = name;
    } catch (_) { /* Only a fixed source name is reported. */ }
    const body = JSON.stringify({ page, kind, source, line: Number.isInteger(line) && line >= 0 ? Math.min(line, 99999) : 0, column: Number.isInteger(column) && column >= 0 ? Math.min(column, 99999) : 0 });
    try { navigator.sendBeacon('/api/diagnostics/client-error', new Blob([body], { type: 'application/json' })); }
    catch (_) { /* Diagnostics must never interrupt the page. */ }
  }
  window.addEventListener('error', (event) => {
    if (event.error || event.filename) report('error', event.filename, event.lineno, event.colno);
  });
  window.addEventListener('unhandledrejection', () => report('rejection'));
})();
