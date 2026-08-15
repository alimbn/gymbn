import { getDayEntries, dayTypes, getPaymentCycleStatus } from '../storage.js';
import { formatDateLongTr, todayIso, mondayOfWeek, addDaysIso, escapeHtml } from '../util.js';

export function render(container) {
  const entries = getDayEntries();
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const last = sorted[0] || null;
  const monday = mondayOfWeek(todayIso());
  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
  const hasThisWeek = entries.some((e) => weekDates.includes(e.date));
  const cycle = getPaymentCycleStatus();

  container.innerHTML = `
    <div class="view-header">
      <h2 class="view-title">Panel</h2>
    </div>
    ${buildLastWorkoutCard(last)}
    ${buildPaymentCard(cycle)}
    <a href="#/week" class="btn btn-primary btn-block">${hasThisWeek ? 'Bu Haftanın Programına Devam Et' : 'Bu Haftanın Programını Oluştur'}</a>
  `;
}

function buildLastWorkoutCard(last) {
  if (!last) {
    return `
      <div class="stat-card">
        <div class="stat-label">Son Antrenman</div>
        <div class="stat-detail">Henüz antrenman kaydı yok.</div>
      </div>
    `;
  }
  const dt = last.dayTypeId ? dayTypes.byId(last.dayTypeId) : null;
  const titleParts = [last.dayNumber ? `#${last.dayNumber}` : null, dt ? dt.name : null].filter(Boolean);
  return `
    <div class="stat-card">
      <div class="stat-label">Son Antrenman</div>
      <div class="stat-value">${escapeHtml(titleParts.join(' · ') || 'Antrenman')}</div>
      <div class="stat-detail">${formatDateLongTr(last.date)} · ${last.exercises.length} egzersiz</div>
    </div>
  `;
}

function buildPaymentCard(cycle) {
  if (!cycle.hasPayment) {
    return `
      <div class="stat-card">
        <div class="stat-label">Ödeme</div>
        <div class="stat-detail">Henüz ödeme kaydı yok.</div>
        <a href="#/payments" class="btn btn-ghost">+ Ödeme Ekle</a>
      </div>
    `;
  }
  if (cycle.overdue) {
    return `
      <div class="stat-card">
        <div class="stat-label">Ödeme Günü</div>
        <div class="stat-value">Ödeme zamanı geldi <span class="badge badge-danger">Gecikti</span></div>
        <div class="stat-detail">Ödeme günü: ${formatDateLongTr(cycle.dueDate)} (${cycle.daysSinceDue} gün geçti)</div>
      </div>
    `;
  }
  if (cycle.countdown) {
    return `
      <div class="stat-card">
        <div class="stat-label">Ödeme Günü</div>
        <div class="stat-value">${cycle.daysUntilDue === 0 ? 'Bugün' : `${cycle.daysUntilDue} gün kaldı`}</div>
        <div class="stat-detail">Sıradaki ödeme: ${formatDateLongTr(cycle.dueDate)}</div>
      </div>
    `;
  }
  return `
    <div class="stat-card">
      <div class="stat-label">Ödeme Günü</div>
      <div class="stat-value">${formatDateLongTr(cycle.dueDate)}</div>
      <div class="stat-detail">Sabit ödeme günü: ${cycle.anchorDay}</div>
    </div>
  `;
}
