import {
  onAdminAuthReady, adminLogin, adminSignOut, adminResetPassword, isCurrentUserAdmin,
  listCatalog, addCatalogExercise, renameCatalogExercise, setCatalogDuration, setCatalogMedia, archiveCatalogExercise,
  listRegions, broadcastSystemMessage,
} from './admin/adminCloud.js';
import { renderLoginForm } from './shared/loginForm.js';
import { confirmSheet } from './components/confirmSheet.js';
import * as coachRoster from './admin/coachRoster.js';
import * as exerciseCatalog from './admin/exerciseCatalog.js';
import * as targetRegions from './admin/targetRegions.js';

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
  showRoster();
}

function showRoster() {
  viewRoot.innerHTML = `
    <div class="view-header">
      <h2 class="view-title">Hocalar</h2>
      <button type="button" class="btn btn-ghost" id="admin-signout-btn">Çıkış</button>
    </div>
    <div class="more-menu">
      <a href="#" class="more-menu-item" id="catalog-nav-link"><span>Egzersiz Kütüphanesi</span><span class="chevron">›</span></a>
      <a href="#" class="more-menu-item" id="regions-nav-link"><span>Hedef Bölgeler</span><span class="chevron">›</span></a>
      <a href="#" class="more-menu-item" id="broadcast-nav-link"><span>📢 Sistem Mesajı Gönder</span><span class="chevron">›</span></a>
    </div>
    <div id="admin-body"></div>
  `;
  viewRoot.querySelector('#admin-signout-btn').addEventListener('click', () => adminSignOut());
  viewRoot.querySelector('#catalog-nav-link').addEventListener('click', (e) => {
    e.preventDefault();
    showCatalog();
  });
  viewRoot.querySelector('#regions-nav-link').addEventListener('click', (e) => {
    e.preventDefault();
    showRegions();
  });
  viewRoot.querySelector('#broadcast-nav-link').addEventListener('click', (e) => {
    e.preventDefault();
    openBroadcastSheet();
  });
  coachRoster.render(viewRoot.querySelector('#admin-body'));
}

// Tüm hocalara+öğrencilere aynı anda tek yönlü bir duyuru — bkz.
// adminCloud.js'teki broadcastSystemMessage yorumu. Kendi ekranı/route'u yok
// (admin.html'de zaten router yok), libraryList.js'in openMediaSheet'i gibi
// yerinde bir sheet — bu kadar küçük, tek-seferlik bir eylem için ayrı bir
// dosya/route açmaya değmiyor.
function openBroadcastSheet() {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.innerHTML = `
    <div class="sheet">
      <div class="sheet-title">📢 Sistem Mesajı Gönder</div>
      <div class="sheet-sub">Tüm hocalara ve öğrencilere bildirim olarak gönderilir.</div>
      <textarea id="broadcast-textarea" class="bulk-textarea" style="min-height:110px;" placeholder="Mesajını yaz…"></textarea>
      <div class="muted" id="broadcast-result" style="text-align:center; margin-top:var(--space-2); min-height:1.2em;"></div>
      <button type="button" class="btn btn-primary btn-block" id="broadcast-send-btn">Gönder</button>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });

  const textarea = backdrop.querySelector('#broadcast-textarea');
  const resultEl = backdrop.querySelector('#broadcast-result');
  const sendBtn = backdrop.querySelector('#broadcast-send-btn');

  sendBtn.addEventListener('click', async () => {
    const message = textarea.value.trim();
    if (!message) return;
    if (!(await confirmSheet('Bu mesaj TÜM hocalara ve öğrencilere gönderilecek. Emin misin?', { confirmLabel: 'Gönder', danger: false }))) return;
    sendBtn.disabled = true;
    sendBtn.textContent = 'Gönderiliyor…';
    try {
      const { total, failed } = await broadcastSystemMessage(message);
      resultEl.textContent = failed ? `✓ ${total - failed}/${total} kişiye gönderildi (${failed} başarısız)` : `✓ ${total} kişiye gönderildi`;
      textarea.value = '';
      sendBtn.textContent = 'Gönder';
    } catch (err) {
      console.error('Sistem mesajı gönderilemedi', err);
      resultEl.textContent = 'Gönderilemedi, internet bağlantını kontrol edip tekrar dene.';
      sendBtn.textContent = 'Gönder';
    }
    sendBtn.disabled = false;
  });
}

function showCatalog() {
  exerciseCatalog.render(viewRoot, {
    onBack: showRoster,
    listCatalog, addCatalogExercise, renameCatalogExercise, setCatalogDuration, setCatalogMedia, archiveCatalogExercise,
    listRegions,
  });
}

function showRegions() {
  targetRegions.render(viewRoot, { onBack: showRoster });
}
