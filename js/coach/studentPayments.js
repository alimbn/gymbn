import { getStudent, getStudentAppState, setStudentAppState } from './coachCloud.js';
import { cycleStatus, sortedPayments } from './paymentCycle.js';
import { escapeHtml, formatDateLongTr, todayIso, ICON_TRASH } from '../util.js';
import { confirmSheet } from '../components/confirmSheet.js';

function uid() {
  return `pay_${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function render(container, { studentUid }) {
  renderLoadingScreen(container);

  let student;
  let remoteState;
  try {
    [student, remoteState] = await Promise.all([getStudent(studentUid), getStudentAppState(studentUid)]);
  } catch (err) {
    console.error('Öğrenci verisi yüklenemedi', err);
    renderErrorScreen(container, studentUid, 'Öğrenci verisi yüklenemedi, internet bağlantını kontrol edip tekrar dene.');
    return;
  }
  if (!student) {
    renderErrorScreen(container, studentUid, 'Öğrenci bulunamadı.');
    return;
  }

  const state = remoteState || { payments: [] };
  state.payments = state.payments || [];
  renderScreen(container, studentUid, student, state);
}

function renderLoadingScreen(container) {
  container.innerHTML = '<p class="empty-state">Yükleniyor…</p>';
}

function renderErrorScreen(container, studentUid, message) {
  container.innerHTML = `
    <div class="view-header">
      <a href="#/student/${studentUid}" class="back-link" aria-label="Geri">←</a>
      <h2 class="view-title">Ödemeler</h2>
      <span></span>
    </div>
    <p class="empty-state">${escapeHtml(message)}</p>
  `;
}

function buildCycleCard(payments) {
  const cycle = cycleStatus(payments);
  if (!cycle.hasPayment) {
    return `
      <div class="stat-card">
        <div class="stat-label">Ödeme</div>
        <div class="stat-detail">Henüz ödeme kaydı yok.</div>
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

function buildPaymentList(payments) {
  const sorted = sortedPayments(payments);
  if (!sorted.length) return '<p class="empty-state">Henüz ödeme kaydı yok.</p>';
  return sorted.map((p) => `
    <div class="list-item" data-id="${escapeHtml(p.id)}">
      <div class="list-item-main">
        <div class="list-item-title">${formatDateLongTr(p.date)}</div>
        ${p.amount ? `<div class="list-item-sub">${escapeHtml(p.amount)}</div>` : ''}
      </div>
      <div class="list-item-actions">
        <button type="button" class="btn-icon danger delete-btn" aria-label="Sil">${ICON_TRASH}</button>
      </div>
    </div>
  `).join('');
}

function renderScreen(container, studentUid, student, state) {
  container.innerHTML = `
    <div class="view-header">
      <a href="#/student/${studentUid}" class="back-link" aria-label="Geri">←</a>
      <h2 class="view-title">${escapeHtml(student.displayName)}</h2>
      <span></span>
    </div>
    <div id="cycle-summary">${buildCycleCard(state.payments)}</div>
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
    <div class="list" id="payment-list">${buildPaymentList(state.payments)}</div>
  `;

  wireScreen(container, studentUid, state);
}

function wireScreen(container, studentUid, state) {
  const form = container.querySelector('#add-payment-form');
  const summaryEl = container.querySelector('#cycle-summary');
  const listEl = container.querySelector('#payment-list');

  function refresh() {
    summaryEl.innerHTML = buildCycleCard(state.payments);
    listEl.innerHTML = buildPaymentList(state.payments);
    wireDeleteButtons();
  }

  function wireDeleteButtons() {
    listEl.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('.list-item');
        const id = row.dataset.id;
        if (!(await confirmSheet('Bu ödeme kaydı silinsin mi?'))) return;
        btn.disabled = true;
        const idx = state.payments.findIndex((p) => p.id === id);
        const [removed] = state.payments.splice(idx, 1);
        try {
          await setStudentAppState(studentUid, state);
          refresh();
        } catch (err) {
          console.error('Ödeme silinemedi', err);
          alert('Ödeme silinemedi, internet bağlantını kontrol edip tekrar dene.');
          state.payments.splice(idx, 0, removed);
          btn.disabled = false;
        }
      });
    });
  }
  wireDeleteButtons();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dateInput = container.querySelector('#payment-date');
    const amountInput = container.querySelector('#payment-amount');
    if (!dateInput.value) return;
    const submitBtn = form.querySelector('button');
    submitBtn.disabled = true;
    const payment = { id: uid(), date: dateInput.value, amount: amountInput.value.trim() || null, note: '' };
    state.payments.push(payment);
    try {
      await setStudentAppState(studentUid, state);
      refresh();
    } catch (err) {
      console.error('Ödeme kaydedilemedi', err);
      alert('Ödeme kaydedilemedi, internet bağlantını kontrol edip tekrar dene.');
      // pop() değil id'ye göre çıkarma — eş zamanlı bir silme işlemi araya
      // girmiş olabileceğinden diziye pozisyona göre değil kimliğe göre
      // dokunmak daha güvenli (bkz. delete handler'daki aynı desen).
      const idx = state.payments.findIndex((p) => p.id === payment.id);
      if (idx !== -1) state.payments.splice(idx, 1);
    } finally {
      submitBtn.disabled = false;
    }
  });
}
