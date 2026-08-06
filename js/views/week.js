import { getDayEntryByDate, createDayEntry, suggestNextDayNumber, deleteDayEntry, dayTypes, getPaymentCycleStatus } from '../storage.js';
import { addDaysIso, todayIso, dayOfWeekLabel, formatDateShortTr, escapeHtml } from '../util.js';

export function render(container, { mondayIso }) {
  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(mondayIso, i));
  const prevMonday = addDaysIso(mondayIso, -7);
  const nextMonday = addDaysIso(mondayIso, 7);
  const cycle = getPaymentCycleStatus();
  const existingEntries = days.map((d) => getDayEntryByDate(d)).filter(Boolean);

  container.innerHTML = `
    <div class="view-header">
      <a href="#/" class="back-link" aria-label="Geri">←</a>
      <h2 class="view-title">Haftalık Program</h2>
      <span></span>
    </div>
    <div class="week-nav">
      <a href="#/week/${prevMonday}" class="btn-icon" aria-label="Önceki hafta">‹</a>
      <div>
        <div class="week-range">${formatDateShortTr(mondayIso)} – ${formatDateShortTr(days[6])}</div>
        ${cycle.hasPayment ? `<div class="week-cycle-note">Ödeme döngüsü: ${cycle.overdue ? 'gecikti' : cycle.weekInCycle + '. hafta'}</div>` : ''}
      </div>
      <a href="#/week/${nextMonday}" class="btn-icon" aria-label="Sonraki hafta">›</a>
    </div>
    <a href="#/bulk-add/${mondayIso}" class="btn btn-block bulk-add-link">📋 Programı Yapıştır</a>
    <div class="week-grid" id="week-grid"></div>
    ${existingEntries.length ? '<button type="button" class="btn btn-danger btn-block week-clear-btn" id="clear-week-btn">Bu Haftadaki Tüm Günleri Sil</button>' : ''}
  `;

  const grid = container.querySelector('#week-grid');
  grid.innerHTML = days.map((date) => buildSlot(date, date === today)).join('');

  grid.querySelectorAll('.week-slot').forEach((slotEl) => {
    slotEl.addEventListener('click', () => {
      const date = slotEl.dataset.date;
      let entry = getDayEntryByDate(date);
      if (!entry) {
        entry = createDayEntry({ date, dayNumber: suggestNextDayNumber(), dayTypeId: null });
      }
      location.hash = '#/day/' + entry.id;
    });
  });

  const clearBtn = container.querySelector('#clear-week-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const totalExercises = existingEntries.reduce((sum, e) => sum + e.exercises.length, 0);
      if (confirm(`Bu haftadaki ${existingEntries.length} gün (toplam ${totalExercises} egzersiz) tamamen silinecek. Bu işlem geri alınamaz. Emin misin?`)) {
        existingEntries.forEach((e) => deleteDayEntry(e.id));
        render(container, { mondayIso });
      }
    });
  }
}

function buildSlot(date, isToday) {
  const entry = getDayEntryByDate(date);
  const stateClass = entry ? 'filled' : 'empty';
  let body;
  if (entry) {
    const dt = entry.dayTypeId ? dayTypes.byId(entry.dayTypeId) : null;
    const titleParts = [dt ? dt.name : null, entry.dayNumber ? `#${entry.dayNumber}` : null].filter(Boolean);
    body = `
      <div class="week-slot-title">${escapeHtml(titleParts.join(' · ') || 'Antrenman')}${entry.completed ? ' ✅' : ''}</div>
      <div class="week-slot-sub">${entry.exercises.length} egzersiz</div>
    `;
  } else {
    body = '<div class="week-slot-add">+ Gün Ekle</div>';
  }
  return `
    <div class="week-slot ${stateClass}${isToday ? ' today' : ''}" data-date="${date}">
      <div class="week-slot-day">
        <span>${dayOfWeekLabel(date)}</span>
        <span class="week-slot-date">${formatDateShortTr(date)}</span>
      </div>
      ${body}
    </div>
  `;
}
