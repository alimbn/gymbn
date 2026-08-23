import { getDayEntryByDate, createDayEntry, suggestNextDayNumber, deleteDayEntry, dayTypes, getPaymentCycleStatus, updateDayEntryField } from '../storage.js';
import { addDaysIso, todayIso, dayOfWeekLabel, formatDateShortTr, escapeHtml, vibrate } from '../util.js';
import { confirmSheet } from '../components/confirmSheet.js';

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
        ${cycle.hasPayment ? `<div class="week-cycle-note">${cycle.overdue ? 'Ödeme gecikti' : cycle.countdown ? `Ödemeye ${cycle.daysUntilDue === 0 ? 'bugün' : cycle.daysUntilDue + ' gün'}` : 'Ödeme güncel'}</div>` : ''}
      </div>
      <a href="#/week/${nextMonday}" class="btn-icon" aria-label="Sonraki hafta">›</a>
    </div>
    <a href="#/bulk-add/${mondayIso}" class="btn btn-block bulk-add-link">📋 Programı Yapıştır</a>
    <div class="week-grid" id="week-grid"></div>
    ${existingEntries.length ? `<a href="#/week/${mondayIso}/summary" class="btn btn-block week-summary-link">📄 Haftalık Özet</a>` : ''}
    ${existingEntries.length ? `<a href="#/week/${mondayIso}/summary-desktop" class="btn btn-block week-summary-link">🖥️ Masaüstü Özeti</a>` : ''}
    ${existingEntries.length ? '<button type="button" class="btn btn-danger btn-block week-clear-btn" id="clear-week-btn">Bu Haftadaki Tüm Günleri Sil</button>' : ''}
  `;

  const grid = container.querySelector('#week-grid');
  grid.innerHTML = days.map((date) => buildSlot(date, date === today)).join('');

  grid.querySelectorAll('.week-slot-main').forEach((mainEl) => {
    mainEl.addEventListener('click', () => {
      const date = mainEl.closest('.week-slot').dataset.date;
      let entry = getDayEntryByDate(date);
      if (!entry) {
        entry = createDayEntry({ date, dayNumber: suggestNextDayNumber(), dayTypeId: null });
      }
      location.hash = '#/day/' + entry.id;
    });
  });

  wireDragHandles(grid, days, container, mondayIso);

  const clearBtn = container.querySelector('#clear-week-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      const totalExercises = existingEntries.reduce((sum, e) => sum + e.exercises.length, 0);
      if (await confirmSheet(`Bu haftadaki ${existingEntries.length} gün (toplam ${totalExercises} egzersiz) tamamen silinecek. Bu işlem geri alınamaz.`)) {
        existingEntries.forEach((e) => deleteDayEntry(e.id));
        render(container, { mondayIso });
      }
    });
  }
}

const HANDLE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>';

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
    body = '<div class="week-slot-add">+</div>';
  }
  // Boş günlerin tutamacı yok (sürüklenecek bir şey yok) ama hâlâ geçerli bir bırakma
  // hedefi — dolu bir günü boş bir güne sürükleyince oraya taşınabiliyor.
  const handle = entry ? `<div class="week-slot-handle" aria-label="Sürükleyerek taşı">${HANDLE_SVG}</div>` : '<div class="week-slot-handle-spacer"></div>';
  return `
    <div class="week-slot ${stateClass}${isToday ? ' today' : ''}" data-date="${date}">
      ${handle}
      <div class="week-slot-main">
        <div class="week-slot-day">
          <span>${dayOfWeekLabel(date)}</span>
          <span class="week-slot-date">${formatDateShortTr(date)}</span>
        </div>
        ${body}
      </div>
    </div>
  `;
}

// Bir günü başka bir güne sürükleyince İÇERİK takas oluyor, tarihler (haftanın
// günleri) hep sabit kalıyor — Pazartesi hep Pazartesi'de duruyor, sadece hangi
// programın o günde olduğu değişiyor. Boş bir güne sürüklenirse basitçe TAŞINIYOR
// (takas edilecek bir şey yok). Tamamlanmış (✅) günler de dahil, hiçbir kısıtlama
// yok — sürükleme veri kaybettirmiyor, yanlışlıkla olursa geri sürüklenebilir.
function swapDayContents(dateA, dateB) {
  if (dateA === dateB) return;
  const entryA = getDayEntryByDate(dateA);
  const entryB = getDayEntryByDate(dateB);
  if (entryA) updateDayEntryField(entryA.id, 'date', dateB, false);
  if (entryB) updateDayEntryField(entryB.id, 'date', dateA, false);
}

let dragState = null;

function wireDragHandles(grid, days, container, mondayIso) {
  grid.querySelectorAll('.week-slot-handle').forEach((handle) => {
    handle.addEventListener('pointerdown', (e) => {
      const slot = handle.closest('.week-slot');
      dragState = { slot, startIndex: [...grid.children].indexOf(slot), placeholderIndex: null };
      dragState.placeholderIndex = dragState.startIndex;
      slot.classList.add('dragging');
      vibrate(15);
      const onMove = (ev) => onDragMove(ev, grid);
      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        onDragEnd(grid, days, container, mondayIso);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp, { once: true });
      e.preventDefault();
    });
  });
}

function onDragMove(e, grid) {
  if (!dragState) return;
  const rows = [...grid.children];
  const y = e.clientY;
  let newIndex = dragState.placeholderIndex;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] === dragState.slot) continue;
    const rect = rows[i].getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (y < mid) { newIndex = i > dragState.placeholderIndex ? i - 1 : i; break; }
    if (i === rows.length - 1) newIndex = i;
  }
  if (newIndex !== dragState.placeholderIndex) {
    const ref = rows[newIndex];
    if (ref && ref !== dragState.slot) {
      grid.insertBefore(dragState.slot, newIndex < dragState.placeholderIndex ? ref : ref.nextSibling);
      dragState.placeholderIndex = newIndex;
    }
  }
}

function onDragEnd(grid, days, container, mondayIso) {
  if (!dragState) return;
  const { slot, startIndex, placeholderIndex } = dragState;
  slot.classList.remove('dragging');
  dragState = null;
  if (placeholderIndex === startIndex) return;
  swapDayContents(days[startIndex], days[placeholderIndex]);
  render(container, { mondayIso });
}
