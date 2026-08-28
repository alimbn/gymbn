import {
  onCoachAuthReady, coachLogin, coachSignOut, coachResetPassword, isCurrentUserCoach,
  listCatalog, addCatalogExercise, renameCatalogExercise, setCatalogDuration, setCatalogMedia, archiveCatalogExercise,
  listRegions,
} from './coach/coachCloud.js';
import { renderLoginForm } from './shared/loginForm.js';
import { addRoute, renderRoute } from './router.js';
import * as studentRoster from './coach/studentRoster.js';
import * as studentDetail from './coach/studentDetail.js';
import * as assignProgram from './coach/assignProgram.js';
import * as studentMeasurements from './coach/studentMeasurements.js';
import * as studentPayments from './coach/studentPayments.js';
import * as studentSchedule from './coach/studentSchedule.js';
import * as studentScheduleSummary from './coach/studentScheduleSummary.js';
import * as studentScheduleSummaryDesktop from './coach/studentScheduleSummaryDesktop.js';
import * as exerciseCatalog from './admin/exerciseCatalog.js';

const viewRoot = document.getElementById('view-root');

renderLoading();
onCoachAuthReady(async (user) => {
  if (!user) {
    renderLogin();
    return;
  }
  let ok = false;
  try {
    ok = await isCurrentUserCoach();
  } catch (err) {
    console.error('Hoca yetkisi kontrol edilemedi', err);
  }
  if (!ok) {
    renderAccessDenied();
    return;
  }
  initCoachApp();
});

function renderLoading() {
  viewRoot.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-title">Gym Takip — Hoca</div>
        <p class="auth-loading">Yükleniyor…</p>
      </div>
    </div>
  `;
}

function renderLogin() {
  renderLoginForm(viewRoot, {
    title: 'Gym Takip — Hoca',
    onSubmit: (email, password) => coachLogin(email, password),
    onResetPassword: (email) => coachResetPassword(email),
  });
}

function renderAccessDenied() {
  viewRoot.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-title">Gym Takip — Hoca</div>
        <p class="auth-error">Bu hesabın hoca yetkisi yok.</p>
        <button type="button" class="btn btn-ghost btn-block" id="signout-btn">Çıkış Yap</button>
      </div>
    </div>
  `;
  viewRoot.querySelector('#signout-btn').addEventListener('click', () => coachSignOut());
}

function initCoachApp() {
  document.body.classList.remove('auth-gate');

  addRoute(/^#\/?$/, (root) => studentRoster.render(root));
  addRoute(/^#\/student\/([^/]+)$/, (root, match) => studentDetail.render(root, { studentUid: match[1] }));
  addRoute(/^#\/assign\/([^/]+)$/, (root, match) => assignProgram.render(root, { studentUid: match[1] }));
  addRoute(/^#\/measurements\/([^/]+)$/, (root, match) => studentMeasurements.render(root, { studentUid: match[1] }));
  addRoute(/^#\/payments\/([^/]+)$/, (root, match) => studentPayments.render(root, { studentUid: match[1] }));
  addRoute(/^#\/schedule\/([^/]+)(?:\/([^/]+))?$/, (root, match) => studentSchedule.render(root, { studentUid: match[1], mondayIso: match[2] }));
  addRoute(/^#\/schedule\/([^/]+)\/([^/]+)\/summary$/, (root, match) => studentScheduleSummary.render(root, { studentUid: match[1], mondayIso: match[2] }));
  addRoute(/^#\/schedule\/([^/]+)\/([^/]+)\/summary-desktop$/, (root, match) => studentScheduleSummaryDesktop.render(root, { studentUid: match[1], mondayIso: match[2] }));
  // admin'in canManageCatalog toggle'ıyla izin verdiği hocalar için — admin.html'in
  // AYNI exerciseCatalog.js ekranı, sadece Firestore fonksiyonları coachCloud.js'ten
  // (kendi paylaşılan oturumuyla). İzinsiz bir hoca buraya URL'i elle yazsa bile
  // firestore.rules'taki canManageCatalog() yazmayı reddeder — bu route sadece
  // linki gösterip göstermemeyi kontrol ediyor, gerçek yetki sunucu tarafında.
  addRoute(/^#\/catalog$/, (root) => exerciseCatalog.render(root, {
    onBack: () => { location.hash = '#/'; },
    listCatalog, addCatalogExercise, renameCatalogExercise, setCatalogDuration, setCatalogMedia, archiveCatalogExercise,
    listRegions,
  }));

  function onRouteChange() {
    renderRoute(viewRoot);
    viewRoot.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', onRouteChange);
  onRouteChange();
}
