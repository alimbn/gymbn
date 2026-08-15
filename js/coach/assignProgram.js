import { normalizeForMatch, addDaysIso, mondayOfWeek, todayIso, escapeHtml } from '../util.js';
import { parseWeeklyProgramText } from '../bulkParse.js';
import { getStudent, getStudentAppState, setStudentAppState } from './coachCloud.js';

// bulkAdd.js'in AYNI yapıştır→ayrıştır→düzenlenebilir önizleme→onayla akışı,
// ama js/storage.js'in yerel singleton'ı yerine BAŞKA bir kullanıcının uzaktan
// çekilen state objesi üzerinde çalışıyor — bilerek bulkAdd.js'e dokunulmadı
// (bkz. plan), storage.js'in CRUD yardımcıları da BİLEREK import edilmedi:
// storage.js, cloudSync.js'i import ediyor ve o da kendi (paylaşılan/localStorage
// kalıcı) Firebase auth oturumunu başlatıyor — bu sayfanın izole, bellek-içi
// auth oturumuyla (bkz. shared/firebaseClient.js) çakışmaması için CRUD mantığı
// burada küçük, saf bir kopya olarak tutuluyor.

function uid(prefix) {
  const time = Date.now().toString(36).slice(-4);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${time}${rand}`;
}

function emptyState() {
  return { schemaVersion: 1, updatedAt: 0, exercises: [], dayTypes: [], dayEntries: [], payments: [] };
}

function activeDayTypes(state) { return state.dayTypes.filter((d) => !d.archived); }
function activeExercises(state) { return state.exercises.filter((e) => !e.archived); }
function findDayEntryByDate(state, dateIso) { return state.dayEntries.find((d) => d.date === dateIso) || null; }
function suggestNextDayNumber(state) {
  if (!state.dayEntries.length) return null;
  return Math.max(...state.dayEntries.map((d) => Number(d.dayNumber) || 0)) + 1;
}
function addDayType(state, name) {
  const item = { id: uid('dt'), name: name.trim(), archived: false };
  state.dayTypes.push(item);
  return item;
}
function addExercise(state, name, isDuration) {
  const item = { id: uid('ex'), name: name.trim(), archived: false, isDuration: !!isDuration };
  state.exercises.push(item);
  return item;
}
function createDayEntry(state, { date, dayNumber, dayTypeId }) {
  const entry = { id: uid('day'), date, dayNumber: dayNumber ?? null, dayTypeId: dayTypeId ?? null, exercises: [] };
  state.dayEntries.push(entry);
  return entry;
}

// storage.js'in (module-private, export edilmemiş) buildActualSetsFromPrescribed'ıyla
// AYNI mantığın kasıtlı küçük kopyası — bkz. dosya başındaki not.
function extractLeadingInt(str, fallback) {
  const match = String(str ?? '').match(/\d+/);
  return match ? parseInt(match[0], 10) : fallback;
}
function clampRir(n) { return Math.max(0, Math.min(9, n)); }
function buildActualSetsFromPrescribed(prescribed, isDuration) {
  const count = Math.max(1, Number(prescribed.setCount) || 1);
  const reps = String(extractLeadingInt(prescribed.reps, 0));
  const rirValue = extractLeadingInt(prescribed.rir, 0);
  const rir = String(isDuration ? Math.max(0, rirValue) : clampRir(rirValue));
  const rows = [];
  for (let i = 0; i < count; i++) rows.push({ weight: prescribed.weight, reps, rir, touched: false });
  return rows;
}
function addExerciseInstanceWithPrescribed(state, dayId, exerciseId, prescribed) {
  const entry = state.dayEntries.find((d) => d.id === dayId);
  if (!entry) return null;
  const exercise = state.exercises.find((e) => e.id === exerciseId);
  const isDuration = !!(exercise && exercise.isDuration);
  const inst = {
    id: uid('exi'),
    exerciseId,
    note: '',
    status: null,
    prescribed,
    actualSets: buildActualSetsFromPrescribed(prescribed, isDuration),
  };
  entry.exercises.push(inst);
  return inst;
}

export async function render(container, { studentUid }) {
  renderLoadingScreen(container);

  let student;
  let remoteState;
  try {
    [student, remoteState] = await Promise.all([getStudent(studentUid), getStudentAppState(studentUid)]);
  } catch (err) {
    console.error('Öğrenci verisi yüklenemedi', err);
    renderErrorScreen(container, 'Öğrenci verisi yüklenemedi, internet bağlantını kontrol edip tekrar dene.');
    return;
  }
  if (!student) {
    renderErrorScreen(container, 'Öğrenci bulunamadı.');
    return;
  }

  const state = remoteState || emptyState();
  const monday = mondayOfWeek(todayIso());
  renderPasteScreen(container, student, state, monday);
}

function renderLoadingScreen(container) {
  container.innerHTML = '<p class="empty-state">Yükleniyor…</p>';
}

function renderErrorScreen(container, message) {
  container.innerHTML = `
    <div class="view-header">
      <a href="#/" class="back-link" aria-label="Geri">←</a>
      <h2 class="view-title">Program Ata</h2>
      <span></span>
    </div>
    <p class="empty-state">${escapeHtml(message)}</p>
  `;
}

function renderPasteScreen(container, student, state, monday) {
  container.innerHTML = `
    <div class="view-header">
      <a href="#/" class="back-link" aria-label="Geri">←</a>
      <h2 class="view-title">Program Ata</h2>
      <span></span>
    </div>
    <p class="muted bulk-intro">Öğrenci: <strong>${escapeHtml(student.displayName)}</strong></p>
    <p class="muted bulk-intro">Haftalık programı, gün başlıklarının arasında boş satır bırakarak aşağıya yapıştır:</p>
    <textarea id="paste-textarea" class="bulk-textarea" placeholder="Anterior - 1
dumbell shoulder press 2 set 8-9 tekrar 12.5kg
...

Posterior - 1
Barfiks 3 set 5-6 tekrar
..."></textarea>
    <button type="button" class="btn btn-primary btn-block" id="parse-btn">Ayrıştır</button>
  `;

  container.querySelector('#parse-btn').addEventListener('click', () => {
    const text = container.querySelector('#paste-textarea').value;
    if (!text.trim()) return;
    const blocks = assignDefaultDates(
      parseWeeklyProgramText(text).map((b) => enrichBlock(b, state)),
      state, monday,
    );
    renderReviewScreen(container, student, state, monday, blocks);
  });
}

function enrichBlock(block, state) {
  const normalized = normalizeForMatch(block.dayTypeRaw);
  const matched = activeDayTypes(state).find((dt) => normalizeForMatch(dt.name) === normalized);
  return {
    dayTypeRaw: block.dayTypeRaw,
    dayTypeId: matched ? matched.id : null,
    assignedDate: null,
    exercises: block.exercises.map((ex) => ({ ...ex })),
  };
}

function assignDefaultDates(blocks, state, monday) {
  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
  const emptyDates = weekDates.filter((d) => !findDayEntryByDate(state, d));
  const occupiedDates = weekDates.filter((d) => findDayEntryByDate(state, d));
  const preferredOrder = [...emptyDates, ...occupiedDates];
  blocks.forEach((block, i) => {
    block.assignedDate = preferredOrder[i] || weekDates[i % 7] || null;
  });
  return blocks;
}

function describeExistingEntry(state, dateIso) {
  const entry = findDayEntryByDate(state, dateIso);
  if (!entry) return '';
  const dt = entry.dayTypeId ? state.dayTypes.find((d) => d.id === entry.dayTypeId) : null;
  const parts = [dt ? dt.name : null, entry.exercises.length ? `${entry.exercises.length} egzersiz` : 'boş gün kaydı'].filter(Boolean);
  return `Bu günde zaten kayıt var: ${parts.join(' · ')}. Yeni egzersizler bunun üzerine eklenecek.`;
}

function renderReviewScreen(container, student, state, monday, blocks) {
  container.innerHTML = `
    <div class="view-header">
      <button type="button" class="back-link" id="back-to-paste-btn" aria-label="Geri">←</button>
      <h2 class="view-title">Önizleme</h2>
      <span></span>
    </div>
    <p class="muted bulk-intro">Öğrenci: <strong>${escapeHtml(student.displayName)}</strong></p>
    <p class="muted bulk-intro">${blocks.length} gün bulundu. Yanlış ayrıştırılan bir alan varsa düzelt, sonra onayla.</p>
    <div id="blocks-root"></div>
    <button type="button" class="btn btn-primary btn-block" id="confirm-btn">Onayla ve Ata</button>
  `;

  container.querySelector('#back-to-paste-btn').addEventListener('click', () => {
    renderPasteScreen(container, student, state, monday);
  });

  const blocksRoot = container.querySelector('#blocks-root');
  blocks.forEach((block) => blocksRoot.appendChild(buildBlockCard(block, state)));

  const confirmBtn = container.querySelector('#confirm-btn');
  confirmBtn.addEventListener('click', async () => {
    const skipped = blocks.filter((b) => !b.assignedDate).length;
    if (skipped && !confirm(`${skipped} gün tarihe atanmadığı için eklenmeyecek. Devam edilsin mi?`)) {
      return;
    }
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Kaydediliyor…';
    try {
      commitBlocks(state, blocks);
      await setStudentAppState(student.id, state);
      location.hash = '#/';
    } catch (err) {
      console.error('Program atanamadı', err);
      alert('Program kaydedilemedi, internet bağlantını kontrol edip tekrar dene.');
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Onayla ve Ata';
    }
  });
}

function buildBlockCard(block, state) {
  const card = document.createElement('div');
  card.className = 'card bulk-block-card';

  const dayTypeOptions = activeDayTypes(state).map((dt) => (
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
    dateInfo.textContent = block.assignedDate ? describeExistingEntry(state, block.assignedDate) : '';
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

function commitBlocks(state, blocks) {
  for (const block of blocks) {
    if (!block.assignedDate) continue;

    let dayTypeId = block.dayTypeId;
    if (!dayTypeId) {
      dayTypeId = addDayType(state, block.dayTypeRaw || 'Antrenman').id;
    }

    let entry = findDayEntryByDate(state, block.assignedDate);
    if (!entry) {
      entry = createDayEntry(state, { date: block.assignedDate, dayNumber: suggestNextDayNumber(state), dayTypeId });
    } else if (!entry.dayTypeId) {
      entry.dayTypeId = dayTypeId;
    }

    for (const ex of block.exercises) {
      if (!ex.name) continue;
      const normalized = normalizeForMatch(ex.name);
      let exercise = activeExercises(state).find((e) => normalizeForMatch(e.name) === normalized);
      if (!exercise) exercise = addExercise(state, ex.name, ex.detectedDuration);
      addExerciseInstanceWithPrescribed(
        state, entry.id, exercise.id,
        { weight: ex.weight, setCount: ex.setCount, reps: ex.reps, rir: ex.rir, coachNote: ex.coachNote },
      );
    }
  }
}
