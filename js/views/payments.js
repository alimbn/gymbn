import { getPayments, addPayment, deletePayment, getPaymentCycleStatus } from '../storage.js';
import { formatDateLongTr, todayIso, ICON_TRASH } from '../util.js';

export function render(container) {
  container.innerHTML = `
    <div class="view-header">
      <a href="#/more" class="back-link" aria-label="Geri">←</a>
      <h2 class="view-title">Ödemeler</h2>
      <span></span>
    </div>
    <div id="cycle-summary"></div>
    <form class="card" id="add-payment-form">
      <div class="form-row">
        <div class="field">
          <label>Tarih</label>
          <input type="date" id="payment-date" value="${todayIso()}" max="${todayIso()}">
        </div>
        <div class="field">
          <label>Tutar (opsiyonel)</label>
          <input type="text" id="payment-amount" inputmode="decimal" placeholder="₺">
        </div>
      </div>
      <button type="submit" class="btn btn-primary btn-block">+ Ödeme Ekle</button>
    </form>
    <div class="section-title">Geçmiş Ödemeler</div>
    <div class="list" id="payment-list"></div>
  `;

  const summaryEl = container.querySelector('#cycle-summary');
  const listEl = container.querySelector('#payment-list');

  function renderSummary() {
    const cycle = getPaymentCycleStatus();
    if (!cycle.hasPayment) {
      summaryEl.innerHTML = '';
      return;
    }
    summaryEl.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Güncel Döngü</div>
        <div class="stat-value">${cycle.overdue ? 'Ödeme zamanı geldi' : `${cycle.weekInCycle}. hafta / 4`}</div>
        <div class="stat-detail">Son ödeme: ${formatDateLongTr(cycle.lastDate)} (${cycle.daysSince} gün önce)</div>
      </div>
    `;
  }

  function renderList() {
    const payments = getPayments();
    if (!payments.length) {
      listEl.innerHTML = '<p class="empty-state">Henüz ödeme kaydı yok.</p>';
      return;
    }
    listEl.innerHTML = payments.map((p) => `
      <div class="list-item" data-id="${p.id}">
        <div class="list-item-main">
          <div class="list-item-title">${formatDateLongTr(p.date)}</div>
          ${p.amount ? `<div class="list-item-sub">${p.amount}</div>` : ''}
        </div>
        <div class="list-item-actions">
          <button type="button" class="btn-icon danger delete-btn" aria-label="Sil">${ICON_TRASH}</button>
        </div>
      </div>
    `).join('');
  }

  container.querySelector('#add-payment-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const dateInput = container.querySelector('#payment-date');
    const amountInput = container.querySelector('#payment-amount');
    if (!dateInput.value) return;
    addPayment(dateInput.value, amountInput.value.trim(), '');
    amountInput.value = '';
    renderSummary();
    renderList();
  });

  listEl.addEventListener('click', (e) => {
    const row = e.target.closest('.list-item');
    if (!row || !e.target.classList.contains('delete-btn')) return;
    if (confirm('Bu ödeme kaydı silinsin mi?')) {
      deletePayment(row.dataset.id);
      renderSummary();
      renderList();
    }
  });

  renderSummary();
  renderList();
}
