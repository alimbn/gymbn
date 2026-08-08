export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isoToDate(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysIso(isoStr, days) {
  const d = isoToDate(isoStr);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function mondayOfWeek(isoStr) {
  const day = isoToDate(isoStr).getDay();
  return addDaysIso(isoStr, day === 0 ? -6 : 1 - day);
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function dayOfWeekLabel(isoStr) {
  return capitalize(isoToDate(isoStr).toLocaleDateString('tr-TR', { weekday: 'long' }));
}

export function formatDateLongTr(isoStr) {
  return isoToDate(isoStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateShortTr(isoStr) {
  return isoToDate(isoStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export function monthLabelTr(isoStr) {
  return capitalize(isoToDate(isoStr).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }));
}

export function normalizeForMatch(str) {
  return String(str ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ');
}

const VIEWPORT_LOCKED = 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover';
const VIEWPORT_ZOOMABLE = 'width=device-width, initial-scale=1, viewport-fit=cover';

export function setViewportZoomable(zoomable) {
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) meta.setAttribute('content', zoomable ? VIEWPORT_ZOOMABLE : VIEWPORT_LOCKED);
}

export function setAppChromeHidden(hidden) {
  document.body.classList.toggle('chrome-hidden', hidden);
}

// Egzersiz durumunu (good/bad/null) her yerde aynı görünen tek bir rozete çeviriyor:
// yeşil ✓ (good), kırmızı ▼ (bad), turuncu − (henüz işaretlenmedi).
export function statusBadge(status) {
  if (status === 'good') return '<span class="status-badge status-badge-good">✓</span>';
  if (status === 'bad') return '<span class="status-badge status-badge-bad">▼</span>';
  return '<span class="status-badge status-badge-neutral">−</span>';
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}
