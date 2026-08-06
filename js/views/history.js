import { getDayEntries, dayTypes } from '../storage.js';
import { formatDateLongTr, monthLabelTr, escapeHtml } from '../util.js';

export function render(container) {
  const entries = [...getDayEntries()].sort((a, b) => b.date.localeCompare(a.date));

  container.innerHTML = `
    <div class="view-header">
      <h2 class="view-title">Geçmiş</h2>
    </div>
    <div id="history-list"></div>
  `;

  const listEl = container.querySelector('#history-list');

  if (!entries.length) {
    listEl.innerHTML = '<p class="empty-state">Henüz kayıtlı antrenman yok.</p>';
    return;
  }

  let currentMonth = null;
  const parts = [];
  for (const entry of entries) {
    const monthLabel = monthLabelTr(entry.date);
    if (monthLabel !== currentMonth) {
      currentMonth = monthLabel;
      parts.push(`<div class="month-heading">${escapeHtml(monthLabel)}</div>`);
    }
    const dt = entry.dayTypeId ? dayTypes.byId(entry.dayTypeId) : null;
    const titleParts = [entry.dayNumber ? `#${entry.dayNumber}` : null, dt ? dt.name : null].filter(Boolean);
    parts.push(`
      <a class="list-item" href="#/day/${entry.id}">
        <div class="list-item-main">
          <div class="list-item-title">${escapeHtml(titleParts.join(' · ') || 'Antrenman')}</div>
          <div class="list-item-sub">${formatDateLongTr(entry.date)} · ${entry.exercises.length} egzersiz</div>
        </div>
        <span class="muted">›</span>
      </a>
    `);
  }
  listEl.innerHTML = parts.join('');
}
