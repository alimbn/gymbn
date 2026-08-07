import { onAuthReady, login } from './cloudSync.js';

export function boot(onSignedIn) {
  document.body.classList.add('auth-gate');
  showLoadingScreen();
  onAuthReady((user) => {
    if (user) {
      onSignedIn();
    } else {
      showLoginScreen();
    }
  });
}

export function unlockAppShell() {
  document.body.classList.remove('auth-gate');
}

function viewRoot() {
  return document.getElementById('view-root');
}

function showLoadingScreen() {
  viewRoot().innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-title">Gym Takip</div>
        <p class="auth-loading">Yükleniyor…</p>
      </div>
    </div>
  `;
}

function showLoginScreen() {
  viewRoot().innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-title">Gym Takip</div>
        <input type="email" id="auth-email" placeholder="E-posta" autocomplete="username">
        <input type="password" id="auth-password" placeholder="Şifre" autocomplete="current-password">
        <button type="button" class="btn btn-primary btn-block" id="auth-submit">Giriş Yap</button>
        <p class="auth-error" id="auth-error" style="display:none;"></p>
      </div>
    </div>
  `;

  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const submitBtn = document.getElementById('auth-submit');
  const errorEl = document.getElementById('auth-error');

  function showError(message) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Giriş Yap';
  }

  function trySignIn() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Giriş yapılıyor…';
    errorEl.style.display = 'none';
    login(email, password).catch((err) => {
      showError(loginErrorMessage(err));
      passwordInput.value = '';
      passwordInput.focus();
    });
  }

  submitBtn.addEventListener('click', trySignIn);
  emailInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') passwordInput.focus(); });
  passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') trySignIn(); });
  emailInput.focus();
}

function loginErrorMessage(err) {
  const code = err?.code || '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'E-posta veya şifre hatalı.';
  }
  if (code.includes('too-many-requests')) {
    return 'Çok fazla deneme yapıldı, biraz sonra tekrar deneyin.';
  }
  if (code.includes('network-request-failed')) {
    return 'İnternet bağlantısı yok.';
  }
  if (code.includes('invalid-email')) {
    return 'Geçersiz e-posta adresi.';
  }
  return 'Giriş başarısız, tekrar deneyin.';
}
