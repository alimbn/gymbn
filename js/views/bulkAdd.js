import {
  dayTypes, exercises, createDayEntry, getDayEntryByDate, suggestNextDayNumber,
  addExerciseInstanceWithPrescribed, updateDayEntryField,
} from '../storage.js';
import {
  normalizeForMatch, addDaysIso, mondayOfWeek, todayIso, escapeHtml,
} from '../util.js';
import { parseWeeklyProgramText } from '../bulkParse.js';
import { confirmSheet } from '../components/confirmSheet.js';
import { getMyCatalogIfManaged } from '../cloudSync.js';
import { closestCatalogMatch } from '../shared/catalogMatch.js';

// `catalog` null ise bireysel hesap — eski serbest metin davranışı, hiç değişmedi.
// Bir dizi ise (boş olsa bile) hesap coach-yönetimli bir öğrenci — o zaman isim
// alanı zorunlu bir katalog seçimine dönüyor (assignProgram.js'teki AYNI mantık),
// "kendi uydurma" bir isim yazıp sistemde tekrarlayan/yazım-hatalı kayıtlar
// çoğaltmasın diye — kullanıcının kendi isteği.
export async function render(container, params) {
  const monday = (params && params.mondayIso) || mondayOfWeek(todayIso());
  const catalog = await getMyCatalogIfManaged();
  if (catalog && !catalog.length) {
    container.innerHTML = `
      <div class="view-header">
        <button type="button" class="back-link" id="back-btn" aria-label="Geri">←</button>
        <h2 class="view-title">Programı Yapıştır</h2>
        <span></span>
      </div>
      <p class="empty-state">Egzersiz kütüphanesi henüz boş. Hocandan admin ekranından en az bir egzersiz eklemesini iste.</p>
    `;
    container.querySelector('#back-btn').addEventListener('click', () => history.back());
    return;
  }
  renderPasteScreen(container, monday, catalog);
}

function renderPasteScreen(container, monday, catalog) {
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
      parseWeeklyProgramText(text).map((b) => enrichBlock(b, catalog)),
      monday,
    );
    renderReviewScreen(container, monday, blocks, catalog);
  });
}

function enrichBlock(block, catalog) {
  const normalized = normalizeForMatch(block.dayTypeRaw);
  const matched = dayTypes.active().find((dt) => normalizeForMatch(dt.name) === normalized);
  return {
    dayTypeRaw: block.dayTypeRaw,
    dayTypeId: matched ? matched.id : null,
    assignedDate: null,
    exercises: block.exercises.map((ex) => {
      if (!catalog) return { ...ex };
      const parsedName = ex.name;
      const normalizedName = normalizeForMatch(parsedName);
      const match = catalog.find((c) => normalizeForMatch(c.name) === normalizedName);
      return { ...ex, parsedName, catalogId: match ? match.id : null };
    }),
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

function renderReviewScreen(container, monday, blocks, catalog) {
  container.innerHTML = `
    <div class="view-header">
      <button type="button" class="back-link" id="back-to-paste-btn" aria-label="Geri">←</button>
      <h2 class="view-title">Önizleme</h2>
      <span></span>
    </div>
    <p class="muted bulk-intro">${blocks.length} gün bulundu. ${catalog ? 'Kırmızı çerçeveli egzersizler kataloğa eşleşmedi, kendin seç. ' : ''}Yanlış ayrıştırılan bir alan varsa düzelt, sonra onayla.</p>
    <div id="blocks-root"></div>
    <button type="button" class="btn btn-primary btn-block" id="confirm-btn">Onayla ve Ekle</button>
  `;

  container.querySelector('#back-to-paste-btn').addEventListener('click', () => {
    renderPasteScreen(container, monday, catalog);
  });

  const blocksRoot = container.querySelector('#blocks-root');
  blocks.forEach((block) => {
    blocksRoot.appendChild(buildBlockCard(block, catalog));
  });

  container.querySelector('#confirm-btn').addEventListener('click', async () => {
    const unresolved = blocksRoot.querySelector('.bulk-ex-name-select.unresolved');
    if (unresolved) {
      unresolved.scrollIntoView({ behavior: 'smooth', block: 'center' });
      unresolved.focus();
      return;
    }
    const skipped = blocks.filter((b) => !b.assignedDate).length;
    if (skipped && !(await confirmSheet(`${skipped} gün tarihe atanmadığı için eklenmeyecek. Devam edilsin mi?`, { confirmLabel: 'Devam Et', danger: false }))) {
      return;
    }
    commitBlocks(blocks, catalog);
    location.hash = '#/week/' + monday;
  });
}

function buildBlockCard(block, catalog) {
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
    exList.appendChild(buildExerciseRow(ex, block, exList, catalog));
  });

  return card;
}

const SET_COUNT_MAX = 20;
const REPS_MAX = 30;
const RIR_MAX = 9;
const UNTIL_FAILURE_TEXT = 'tükenene kadar';

function fieldDisplay(value) {
  return value === '' || value == null ? '—' : String(value);
}

function parseRangeValue(str) {
  const match = String(str ?? '').match(/^(\d+)(?:-(\d+))?$/);
  if (!match) return { start: null, end: null };
  return { start: parseInt(match[1], 10), end: match[2] ? parseInt(match[2], 10) : null };
}

function formatRangeValue(start, end) {
  if (start == null) return '';
  if (end == null || end === start) return String(start);
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  return `${lo}-${hi}`;
}

// Set için sade, tekil seçici — setRows.js'in openNumberPicker'ıyla aynı iskelet
// (target kavramı hariç, burada karşılaştırılacak bir hedef yok, kendisi hedefi girer).
function openSetPicker({ current, onSelect }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  let cells = '';
  for (let i = 1; i <= SET_COUNT_MAX; i++) {
    cells += `<button type="button" class="number-picker-cell${i === current ? ' selected' : ''}" data-value="${i}">${i}</button>`;
  }
  backdrop.innerHTML = `
    <div class="sheet">
      <div class="sheet-title">Set</div>
      <button type="button" class="zero-btn${current === 0 ? ' selected' : ''}" data-value="0">0</button>
      <hr class="zero-divider">
      <div class="number-picker-grid">${cells}</div>
      <button type="button" class="btn btn-block sheet-close">Kapat</button>
    </div>
  `;
  document.body.appendChild(backdrop);

  function close() { backdrop.remove(); }
  function handlePick(e) {
    const cell = e.target.closest('.number-picker-cell, .zero-btn');
    if (!cell) return;
    onSelect(Number(cell.dataset.value));
    close();
  }
  backdrop.querySelector('.number-picker-grid').addEventListener('click', handlePick);
  backdrop.querySelector('.zero-btn').addEventListener('click', handlePick);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector('.sheet-close').addEventListener('click', close);

  const selectedEl = backdrop.querySelector('.number-picker-cell.selected');
  if (selectedEl) selectedEl.scrollIntoView({ block: 'center' });
}

// Tekrar/Rir için aralık-veya-tekil seçici — assignProgram.js'teki AYNI bileşen,
// bkz. oradaki yorum (bulkParse.js'in RIR_RE/REPS_RE'si aralık üretebiliyor,
// UNTIL_FAILURE_RE de reps'e özel tek serbest metin, o yüzden Rir'de checkbox yok).
function openRangePicker({ title, max, current, allowFailure, onSelect }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const isFailure = !!allowFailure && current === UNTIL_FAILURE_TEXT;
  let { start, end } = isFailure ? { start: null, end: null } : parseRangeValue(current);

  backdrop.innerHTML = `
    <div class="sheet">
      <div class="sheet-title">${escapeHtml(title)}</div>
      ${allowFailure ? `
        <div class="checkbox-row">
          <input type="checkbox" id="range-failure-check"${isFailure ? ' checked' : ''}>
          <label for="range-failure-check">Tükenene kadar</label>
        </div>
      ` : ''}
      <div class="range-readout"></div>
      <button type="button" class="zero-btn" data-value="0">0</button>
      <hr class="zero-divider">
      <div class="number-picker-grid"></div>
      <button type="button" class="btn btn-block sheet-close">Kapat</button>
    </div>
  `;
  document.body.appendChild(backdrop);

  const grid = backdrop.querySelector('.number-picker-grid');
  const zeroBtn = backdrop.querySelector('.zero-btn');
  const readout = backdrop.querySelector('.range-readout');
  const checkbox = backdrop.querySelector('#range-failure-check');

  function pick(i) {
    if (start == null || end != null) { start = i; end = null; }
    else { end = i; }
    render();
  }

  function render() {
    let cells = '';
    for (let i = 1; i <= max; i++) {
      const inRange = start != null && end != null && i >= Math.min(start, end) && i <= Math.max(start, end);
      const isEdge = i === start || i === end;
      cells += `<button type="button" class="number-picker-cell${isEdge ? ' selected' : inRange ? ' range-mid' : ''}" data-value="${i}">${i}</button>`;
    }
    grid.innerHTML = cells;
    zeroBtn.classList.toggle('selected', start === 0 || end === 0);
    updateReadout();
    updateFailureState();
    const selectedEl = grid.querySelector('.selected');
    if (selectedEl) selectedEl.scrollIntoView({ block: 'center' });
  }

  function updateReadout() {
    if (checkbox && checkbox.checked) { readout.textContent = 'Tükenene kadar seçili'; return; }
    if (start != null && end != null) {
      readout.textContent = formatRangeValue(start, end) + ' seçili';
    } else if (start != null) {
      readout.textContent = start + ' seçili — aralık için ikinci sayıya dokun';
    } else {
      readout.textContent = '';
    }
  }

  function updateFailureState() {
    if (!checkbox) return;
    grid.classList.toggle('grid-disabled', checkbox.checked);
    zeroBtn.classList.toggle('grid-disabled', checkbox.checked);
  }

  grid.addEventListener('click', (e) => {
    const cell = e.target.closest('.number-picker-cell');
    if (cell) pick(Number(cell.dataset.value));
  });
  zeroBtn.addEventListener('click', () => pick(0));
  if (checkbox) checkbox.addEventListener('change', () => { updateReadout(); updateFailureState(); });

  function close() {
    onSelect(checkbox && checkbox.checked ? UNTIL_FAILURE_TEXT : formatRangeValue(start, end));
    backdrop.remove();
  }
  backdrop.querySelector('.sheet-close').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  render();
}

function buildExerciseRow(ex, block, exList, catalog) {
  const row = document.createElement('div');
  row.className = 'bulk-exercise-row';

  let nameFieldHtml;
  if (catalog) {
    const sortedCatalog = [...catalog].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    const options = sortedCatalog.map((c) => (
      `<option value="${c.id}"${ex.catalogId === c.id ? ' selected' : ''}>${escapeHtml(c.name)}</option>`
    )).join('');
    const placeholderLabel = ex.catalogId
      ? '— eşleşme yok, seç —'
      : `"${ex.parsedName || ''}" — eşleşme yok, seç`;
    const suggestion = ex.catalogId ? null : closestCatalogMatch(ex.parsedName, catalog);
    nameFieldHtml = `
      <div class="bulk-ex-name-wrap">
        <select class="bulk-ex-name-select${ex.catalogId ? '' : ' unresolved'}">
          <option value="">${escapeHtml(placeholderLabel)}</option>
          ${options}
        </select>
        ${suggestion ? `<button type="button" class="bulk-ex-suggest-btn" data-suggest-id="${suggestion.id}">Bunu mu demek istedin: "${escapeHtml(suggestion.name)}"?</button>` : ''}
      </div>
    `;
  } else {
    nameFieldHtml = `<input type="text" class="bulk-ex-name" value="${escapeHtml(ex.name)}" placeholder="Egzersiz adı">`;
  }

  row.innerHTML = `
    <div class="bulk-exercise-row-top">
      ${nameFieldHtml}
      <button type="button" class="btn-icon danger bulk-ex-remove" aria-label="Satırı sil">×</button>
    </div>
    <div class="bulk-exercise-row-fields">
      <div class="field">
        <label>Ağırlık</label>
        <input type="text" class="bulk-ex-field" data-field="weight" value="${escapeHtml(ex.weight)}">
      </div>
      <div class="field">
        <label>Set</label>
        <button type="button" class="bulk-picker-trigger${ex.setCount === '' ? ' empty' : ''}" data-field="setCount">${escapeHtml(fieldDisplay(ex.setCount))}</button>
      </div>
      <div class="field">
        <label>Tekrar</label>
        <button type="button" class="bulk-picker-trigger${ex.reps === '' ? ' empty' : ''}" data-field="reps">${escapeHtml(fieldDisplay(ex.reps))}</button>
      </div>
      <div class="field">
        <label>Rir</label>
        <button type="button" class="bulk-picker-trigger${ex.rir === '' ? ' empty' : ''}" data-field="rir">${escapeHtml(fieldDisplay(ex.rir))}</button>
      </div>
    </div>
    <input type="text" class="bulk-ex-note" value="${escapeHtml(ex.coachNote)}" placeholder="Hoca notu (opsiyonel)">
  `;

  if (catalog) {
    const nameSelect = row.querySelector('.bulk-ex-name-select');
    function resolveSelection(catalogId) {
      const catalogEx = catalog.find((c) => c.id === catalogId);
      ex.catalogId = catalogEx ? catalogEx.id : null;
      ex.name = catalogEx ? catalogEx.name : '';
      nameSelect.value = ex.catalogId || '';
      nameSelect.classList.toggle('unresolved', !ex.catalogId);
      const suggestBtn = row.querySelector('.bulk-ex-suggest-btn');
      if (suggestBtn) suggestBtn.style.display = ex.catalogId ? 'none' : '';
    }
    nameSelect.addEventListener('change', (e) => resolveSelection(e.target.value));
    const suggestBtn = row.querySelector('.bulk-ex-suggest-btn');
    if (suggestBtn) {
      suggestBtn.addEventListener('click', () => resolveSelection(suggestBtn.dataset.suggestId));
    }
  } else {
    row.querySelector('.bulk-ex-name').addEventListener('input', (e) => {
      ex.name = e.target.value;
    });
  }

  row.querySelector('.bulk-ex-field[data-field="weight"]').addEventListener('input', (e) => {
    ex.weight = e.target.value;
  });

  const setBtn = row.querySelector('[data-field="setCount"]');
  setBtn.addEventListener('click', () => {
    openSetPicker({
      current: ex.setCount === '' ? null : ex.setCount,
      onSelect: (value) => {
        ex.setCount = value;
        setBtn.textContent = fieldDisplay(value);
        setBtn.classList.remove('empty');
      },
    });
  });

  const repsBtn = row.querySelector('[data-field="reps"]');
  repsBtn.addEventListener('click', () => {
    openRangePicker({
      title: 'Tekrar',
      max: REPS_MAX,
      current: ex.reps,
      allowFailure: true,
      onSelect: (value) => {
        ex.reps = value;
        repsBtn.textContent = fieldDisplay(value);
        repsBtn.classList.toggle('empty', value === '');
      },
    });
  });

  const rirBtn = row.querySelector('[data-field="rir"]');
  rirBtn.addEventListener('click', () => {
    openRangePicker({
      title: 'Rir',
      max: RIR_MAX,
      current: ex.rir,
      onSelect: (value) => {
        ex.rir = value;
        rirBtn.textContent = fieldDisplay(value);
        rirBtn.classList.toggle('empty', value === '');
      },
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

function commitBlocks(blocks, catalog) {
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
      let exercise;
      if (catalog) {
        // Onayla ekranı zaten eşleşmemiş (.unresolved) satır varken engelliyor —
        // catalogId'siz bir satıra buraya kadar gelinmemesi gerekiyor, savunma amaçlı atla.
        if (!ex.catalogId) continue;
        const catalogEx = catalog.find((c) => c.id === ex.catalogId);
        if (!catalogEx) continue;
        exercise = exercises.resolveFromCatalog(catalogEx);
      } else {
        if (!ex.name) continue;
        const normalized = normalizeForMatch(ex.name);
        exercise = exercises.active().find((e) => normalizeForMatch(e.name) === normalized);
        // Sadece YENİ oluşturulan bir egzersiz için süre tipi otomatik ayarlanıyor —
        // zaten var olan bir eşleşmenin tipini sürpriz şekilde değiştirmiyoruz.
        if (!exercise) exercise = exercises.add(ex.name, ex.detectedDuration);
      }
      addExerciseInstanceWithPrescribed(
        entry.id,
        exercise.id,
        { weight: ex.weight, setCount: ex.setCount, reps: ex.reps, rir: ex.rir, coachNote: ex.coachNote },
      );
    }
  }
}
