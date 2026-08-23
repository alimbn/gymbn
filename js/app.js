import { loadState, getState } from './storage.js';
import { addRoute, renderRoute } from './router.js';
import { todayIso, mondayOfWeek } from './util.js';
import { boot, unlockAppShell } from './auth.js';
import { pullRemoteIfNewer, listMyNotifications, markNotificationRead } from './cloudSync.js';
import { initNotificationBell } from './components/notificationBell.js';
import * as dashboard from './views/dashboard.js';
import * as week from './views/week.js';
import * as weekSummary from './views/weekSummary.js';
import * as weekSummaryDesktop from './views/weekSummaryDesktop.js';
import * as bulkAdd from './views/bulkAdd.js';
import * as dayEntry from './views/dayEntry.js';
import * as exerciseLibrary from './views/exerciseLibrary.js';
import * as dayTypeLibrary from './views/dayTypeLibrary.js';
import * as historyView from './views/history.js';
import * as payments from './views/payments.js';
import * as more from './views/more.js';
import { initRestTimer } from './components/restTimer.js';

boot(async () => {
  loadState();
  const reloading = await pullRemoteIfNewer(getState().updatedAt || 0);
  if (reloading) return;
  unlockAppShell();
  initApp();
});

function initApp() {
  const viewRoot = document.getElementById('view-root');

  addRoute(/^#\/?$/, (root) => dashboard.render(root));
  addRoute(/^#\/week$/, (root) => {
    const monday = mondayOfWeek(todayIso());
    history.replaceState(null, '', '#/week/' + monday);
    week.render(root, { mondayIso: monday });
  });
  addRoute(/^#\/week\/([^/]+)$/, (root, match) => week.render(root, { mondayIso: match[1] }));
  addRoute(/^#\/week\/([^/]+)\/summary$/, (root, match) => weekSummary.render(root, { mondayIso: match[1] }));
  addRoute(/^#\/week\/([^/]+)\/summary-desktop$/, (root, match) => weekSummaryDesktop.render(root, { mondayIso: match[1] }));
  addRoute(/^#\/bulk-add$/, (root) => bulkAdd.render(root, { mondayIso: mondayOfWeek(todayIso()) }));
  addRoute(/^#\/bulk-add\/([^/]+)$/, (root, match) => bulkAdd.render(root, { mondayIso: match[1] }));
  addRoute(/^#\/day\/([^/]+)$/, (root, match) => dayEntry.render(root, { id: match[1] }));
  addRoute(/^#\/exercises$/, (root) => exerciseLibrary.render(root));
  addRoute(/^#\/day-types$/, (root) => dayTypeLibrary.render(root));
  addRoute(/^#\/history$/, (root) => historyView.render(root));
  addRoute(/^#\/payments$/, (root) => payments.render(root));
  addRoute(/^#\/more$/, (root) => more.render(root));

  function updateActiveNav() {
    const hash = location.hash || '#/';
    const activeMap = {
      dashboard: hash === '#/' || hash === '',
      log: hash.startsWith('#/day') || hash.startsWith('#/week') || hash.startsWith('#/bulk-add'),
      history: hash.startsWith('#/history'),
      more: hash.startsWith('#/more') || hash.startsWith('#/exercises') || hash.startsWith('#/day-types') || hash.startsWith('#/payments'),
    };
    document.querySelectorAll('.nav-item').forEach((el) => {
      el.classList.toggle('active', !!activeMap[el.dataset.nav]);
    });
  }

  function onRouteChange() {
    renderRoute(viewRoot);
    updateActiveNav();
    viewRoot.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', onRouteChange);
  onRouteChange();

  // #view-root'un dışında, document.body'ye doğrudan ekleniyor — böylece
  // router her navigasyonda #view-root'u temizlese de kronometre kaybolmuyor.
  initRestTimer();

  // Bireysel hesaplarda (students/{uid} yok) listMyNotifications hep boş dizi
  // döner, zil sessizce hiç kırmızı nokta göstermez — davranışsal bir fark yok.
  initNotificationBell(document.querySelector('.app-header'), {
    listNotifications: listMyNotifications,
    markNotificationRead,
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch((err) => {
        console.error('Service worker kaydı başarısız', err);
      });
    });
  }
}
