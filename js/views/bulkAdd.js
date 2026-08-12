import {
  dayTypes, exercises, createDayEntry, getDayEntryByDate, suggestNextDayNumber,
  addExerciseInstanceWithPrescribed, updateDayEntryField,
} from '../storage.js';
import {
  normalizeForMatch, addDaysIso, mondayOfWeek, todayIso, escapeHtml,
} from '../util.js';
import { parseWeeklyProgramText } from '../bulkParse.js';

export function render(container, params) {
  const monday = (params && params.mondayIso) || mondayOfWeek(todayIso());
  renderPasteScreen(container, monday);
}

function renderPasteScreen(container, monday) {
  container.innerHTML = `
    <div class="view-header">
      <button type="button" class="back-link" id="back-btn" aria-label="Geri">←</button>
      <h2 class="view-title">Programı Yapıştır</h2>
      <span></span>
    </div>
    <p class="muted bulk-intro">Hocanın attığı haftalık programı, gün başlıklarının arasında boş satır bırakarak aşağıya yapıştır:</p>
    <textarea id="paste-textarea" class="bulk-textarea" placeholder="Anterior - 1
dumbell shoulder press 2 set 8-9 tekrar 12.5kg
...

Posterior - 1
Barfiks 3 set 5-6 tekrar
..."></textarea>
    <button type="button" class="btn btn-primary btn-block" id="parse-btn">Ayrıştır</button>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => history.back());

  container.querySelector('#parse-btn').addEventListener('click', () => {
    const text = container.querySelector('#paste-textarea').value;
    if (!text.trim()) return;
    const blocks = assignDefaultDates(
      parseWeeklyProgramText(text).map((b) => enrichBlock(b)),
      monday,
    );
    renderReviewScreen(container, monday, blocks);
  });
}

function enrichBlock(block) {
  const normalized = normalizeForMatch(block.dayTypeRaw);
  const matched = dayTypes.active().find((dt) => normalizeForMatch(dt.name) === normalized);
  return {
    dayTypeRaw: block.dayTypeRaw,
    dayTypeId: matched ? matched.id : null,
    assignedDate: null,
    exercises: block.exercises.map((ex) => ({ ...ex })),
  };
}

function assignDefaultDates(blocks, monday) {
  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
  const emptyDates = weekDates.filter((d) => !getDayEntryByDate(d));
  const occupiedDates = weekDates.filter((d) => getDayEntryByDate(d));
  // Prefer empty days as defaults (the common case: filling a fresh week), then fall
  // back to already-occupied days rather than leaving a block unassigned — bulk-add
  // only ever appends exercises, so assigning into an occupied day is safe, just not
  // the first guess. The user can always change the date freely either way.
  const preferredOrder = [...emptyDates, ...occupiedDates];
  blocks.forEach((block, i) => {
    block.assignedDate = preferredOrder[i] || weekDates[i % 7] || null;
  });
  return blocks;
}

function describeExistingEntry(dateIso) {
  const entry = getDayEntryByDate(dateIso);
  if (!entry) return '';
  const dt = entry.dayTypeId ? dayTypes.byId(entry.dayTypeId) : null;
  const parts = [dt ? dt.name : null, entry.exercises.length ? `${entry.exercises.length} egzersiz` : 'boş gün kaydı'].filter(Boolean);
  return `Bu günde zaten kayıt var: ${parts.join(' · ')}. Yeni egzersizler bunun üzerine eklenecek.`;
}

function renderReviewScreen(container, monday, blocks) {
  container.innerHTML = `
    <div class="view-header">
      <button type="button" class="back-link" id="back-to-paste-btn" aria-label="Geri">←</button>
      <h2 class="view-title">Önizleme</h2>
      <span></span>
    </div>
    <p class="muted bulk-intro">${blocks.length} gün bulundu. Yanlış ayrıştırılan bir alan varsa düzelt, sonra onayla.</p>
    <div id="blocks-root"></div>
    <button type="button" class="btn btn-primary btn-block" id="confirm-btn">Onayla ve Ekle</button>
  `;

  container.querySelector('#back-to-paste-btn').addEventListener('click', () => {
    renderPasteScreen(container, monday);
  });

  const blocksRoot = container.querySelector('#blocks-root');
  blocks.forEach((block) => {
    blocksRoot.appendChild(buildBlockCard(block));
  });

  container.querySelector('#confirm-btn').addEventListener('click', () => {
    const skipped = blocks.filter((b) => !b.assignedDate).length;
    if (skipped && !confirm(`${skipped} gün tarihe atanmadığı için eklenmeyecek. Devam edilsin mi?`)) {
      return;
    }
    commitBlocks(blocks);
    location.hash = '#/week/' + monday;
  });
}

function buildBlockCard(block) {
  const card = document.createElement('div');
  card.className = 'card bulk-block-card';

  const dayTypeOptions = dayTypes.active().map((dt) => (
    `<option value="${dt.id}"${dt.id === block.dayTypeId ? ' selected' : ''}>${escapeHtml(dt.name)}</option>`
  )).join('');
  const newDayTypeOption = block.dayTypeId
    ? ''
    : `<option value="" selected>Yeni: ${escapeHtml(block.dayTypeRaw || 'İsimsiz')}</option>`;

  card.innerHTML = `
    <div class="form-row">
      <div class="field">
        <label>Gün Tipi</label>
        <select class="block-daytype-select">${newDayTypeOption}${dayTypeOptions}</select>
      </div>
      <div class="field">
        <label>Tarih</label>
        <input type="date" class="block-date-input" value="${block.assignedDate || ''}">
      </div>
    </div>
    <div class="block-date-info muted"></div>
    <div class="block-exercise-list"></div>
  `;

  card.querySelector('.block-daytype-select').addEventListener('change', (e) => {
    block.dayTypeId = e.target.value || null;
  });

  const dateInput = card.querySelector('.block-date-input');
  const dateInfo = card.querySelector('.block-date-info');
  function updateDateInfo() {
    dateInfo.textContent = block.assignedDate ? describeExistingEntry(block.assignedDate) : '';
  }
  dateInput.addEventListener('change', (e) => {
    block.assignedDate = e.target.value || null;
    updateDateInfo();
  });
  updateDateInfo();

  const exList = card.querySelector('.block-exercise-list');
  block.exercises.forEach((ex) => {
    exList.appendChild(buildExerciseRow(ex, block, exList));
  });

  return card;
}

function buildExerciseRow(ex, block, exList) {
  const row = document.createElement('div');
  row.className = 'bulk-exercise-row';
  row.innerHTML = `
    <div class="bulk-exercise-row-top">
      <input type="text" class="bulk-ex-name" value="${escapeHtml(ex.name)}" placeholder="Egzersiz adı">
      <button type="button" class="btn-icon danger bulk-ex-remove" aria-label="Satırı sil">×</button>
    </div>
    <div class="bulk-exercise-row-fields">
      <input type="text" class="bulk-ex-field" data-field="weight" value="${escapeHtml(ex.weight)}" placeholder="Ağırlık">
      <input type="number" class="bulk-ex-field" data-field="setCount" value="${ex.setCount === '' ? '' : ex.setCount}" placeholder="Set" min="1" inputmode="numeric">
      <input type="text" class="bulk-ex-field" data-field="reps" value="${escapeHtml(ex.reps)}" placeholder="Tekrar">
      <input type="text" class="bulk-ex-field" data-field="rir" value="${escapeHtml(ex.rir)}" placeholder="Rir">
    </div>
    <input type="text" class="bulk-ex-note" value="${escapeHtml(ex.coachNote)}" placeholder="Hoca notu (opsiyonel)">
  `;

  row.querySelector('.bulk-ex-name').addEventListener('input', (e) => {
    ex.name = e.target.value;
  });
  row.querySelectorAll('.bulk-ex-field').forEach((input) => {
    input.addEventListener('input', (e) => {
      const field = e.target.dataset.field;
      ex[field] = field === 'setCount' ? (e.target.value ? Number(e.target.value) : '') : e.target.value;
    });
  });
  row.querySelector('.bulk-ex-note').addEventListener('input', (e) => {
    ex.coachNote = e.target.value;
  });
  row.querySelector('.bulk-ex-remove').addEventListener('click', () => {
    const idx = Array.from(exList.children).indexOf(row);
    if (idx !== -1) block.exercises.splice(idx, 1);
    row.remove();
  });

  return row;
}

function commitBlocks(blocks) {
  for (const block of blocks) {
    if (!block.assignedDate) continue;

    let dayTypeId = block.dayTypeId;
    if (!dayTypeId) {
      dayTypeId = dayTypes.add(block.dayTypeRaw || 'Antrenman').id;
    }

    let entry = getDayEntryByDate(block.assignedDate);
    if (!entry) {
      entry = createDayEntry({ date: block.assignedDate, dayNumber: suggestNextDayNumber(), dayTypeId });
    } else if (!entry.dayTypeId) {
      // Fill in a missing day-type on an existing shell entry, but never overwrite one
      // that's already set — bulk-add should never silently relabel a day.
      updateDayEntryField(entry.id, 'dayTypeId', dayTypeId, false);
    }

    for (const ex of block.exercises) {
      if (!ex.name) continue;
      const normalized = normalizeForMatch(ex.name);
      let exercise = exercises.active().find((e) => normalizeForMatch(e.name) === normalized);
      if (!exercise) exercise = exercises.add(ex.name);
      addExerciseInstanceWithPrescribed(
        entry.id,
        exercise.id,
        { weight: ex.weight, setCount: ex.setCount, reps: ex.reps, rir: ex.rir, coachNote: ex.coachNote },
      );
    }
  }
}
