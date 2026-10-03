const form = document.getElementById('login-form');
const password = document.getElementById('password');
const error = document.getElementById('login-error');
const submit = document.getElementById('login-button');
const toggle = document.getElementById('toggle-password');
let busy = false;

toggle.addEventListener('click', () => {
  const visible = password.type === 'password';
  password.type = visible ? 'text' : 'password';
  toggle.setAttribute('aria-pressed', String(visible));
  toggle.setAttribute('aria-label', visible ? 'Şifreyi gizle' : 'Şifreyi göster');
  password.focus();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  submit.disabled = true;
  error.hidden = true;
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password: password.value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Giriş yapılamadı.');
    password.value = '';
    location.replace('/admin');
  } catch (cause) {
    error.textContent = cause.message || 'Sunucuya bağlanılamadı.';
    error.hidden = false;
    password.focus();
  } finally {
    busy = false;
    submit.disabled = false;
  }
});
