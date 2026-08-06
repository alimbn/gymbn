const routes = [];

export function addRoute(pattern, handler) {
  routes.push({ pattern, handler });
}

export function renderRoute(container) {
  const hash = location.hash || '#/';
  for (const route of routes) {
    const match = hash.match(route.pattern);
    if (match) {
      container.innerHTML = '';
      route.handler(container, match);
      return;
    }
  }
  container.innerHTML = '<p class="empty-state">Sayfa bulunamadı.</p>';
}
