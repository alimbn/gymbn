import { onAdminAuthReady, adminLogin, adminSignOut, adminResetPassword, isCurrentUserAdmin } from './admin/adminCloud.js';
import { renderLoginForm } from './shared/loginForm.js';
import * as coachRoster from './admin/coachRoster.js';

const viewRoot = document.getElementById('view-root');

renderLoading();
onAdminAuthReady(async (user) => {
  if (!user) {
    renderLogin();
    return;
  }
  let ok = false;
  try {
    ok = await isCurrentUserAdmin();
  } catch (err) {
    console.error('Admin yetkisi kontrol edilemedi', err);
  }
  if (!ok) {
    renderAccessDenied();
    return;
  }
  renderAdminShell();
});

function renderLoading() {
  viewRoot.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-title">Gym Takip — Admin</div>
        <p class="auth-loading">Yükleniyor…</p>
      </div>
    </div>
  `;
}

function renderLogin() {
  renderLoginForm(viewRoot, {
    title: 'Gym Takip — Admin',
    onSubmit: (email, password) => adminLogin(email, password),
    onResetPassword: (email) => adminResetPassword(email),
  });
}

function renderAccessDenied() {
  viewRoot.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-title">Gym Takip — Admin</div>
        <p class="auth-error">Bu hesabın admin yetkisi yok.</p>
        <button type="button" class="btn btn-ghost btn-block" id="signout-btn">Çıkış Yap</button>
      </div>
    </div>
  `;
  viewRoot.querySelector('#signout-btn').addEventListener('click', () => adminSignOut());
}

function renderAdminShell() {
  document.body.classList.remove('auth-gate');
  viewRoot.innerHTML = `
    <div class="view-header">
      <h2 class="view-title">Hocalar</h2>
      <button type="button" class="btn btn-ghost" id="admin-signout-btn">Çıkış</button>
    </div>
    <div id="admin-body"></div>
  `;
  viewRoot.querySelector('#admin-signout-btn').addEventListener('click', () => adminSignOut());
  coachRoster.render(viewRoot.querySelector('#admin-body'));
}
