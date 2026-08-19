import { isoToDate, todayIso, pad2 } from './util.js';
import { scheduleCloudPush } from './cloudSync.js';

const STORAGE_KEY = 'gymbnData';
const SCHEMA_VERSION = 1;

let state = null;
let historyIndex = {};
let saveTimer = null;

export function uid(prefix) {
  const time = Date.now().toString(36).slice(-4);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${time}${rand}`;
}

function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: 0,
    exercises: [],
    dayTypes: [
      { id: uid('dt'), name: 'Anterior-1', archived: false },
      { id: uid('dt'), name: 'Posterior-1', archived: false },
      { id: uid('dt'), name: 'Anterior-2', archived: false },
      { id: uid('dt'), name: 'Posterior-2', archived: false },
    ],
    dayEntries: [],
    payments: [],
    measurements: [],
  };
}

// "Son sefer" gerçekten KAYDEDİLMİŞ (en az bir set touched) örnekler arasından,
// günün takvim tarihine değil `loggedAt`'e (gerçek kayıt anı) göre seçiliyor —
// program haftalık atanıp sırayla değil karışık yapılabiliyor (ör. 20'sini
// 17'sinden önce girme), o yüzden tarih sırası "son"u yanlış gösterebiliyordu.
// Bu alan eklenmeden ÖNCE kaydedilmiş eski örneklerde `loggedAt` yok — o yüzden
// eski veri kaybolmasın diye günün tarihine düşüyoruz (eski davranışla aynı sıra).
function rebuildHistoryIndex() {
  const idx = {};
  for (const day of state.dayEntries) {
    for (const inst of day.exercises) {
      if (!inst.actualSets.some((s) => s.touched)) continue;
      (idx[inst.exerciseId] ??= []).push({
        date: day.date,
        dayEntryId: day.id,
        prescribed: inst.prescribed,
        actualSets: inst.actualSets,
        loggedAt: inst.loggedAt || isoToDate(day.date).getTime(),
      });
    }
  }
  for (const list of Object.values(idx)) list.sort((a, b) => a.loggedAt - b.loggedAt);
  historyIndex = idx;
}

export function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      state = JSON.parse(raw);
    } catch (e) {
      console.error('gymbnData parse edilemedi, varsayılan boş veriyle başlanıyor', e);
      state = defaultState();
    }
  } else {
    state = defaultState();
  }
  if (!Array.isArray(state.exercises)) state.exercises = [];
  if (!Array.isArray(state.dayTypes)) state.dayTypes = [];
  if (!Array.isArray(state.dayEntries)) state.dayEntries = [];
  if (!Array.isArray(state.payments)) state.payments = [];
  if (typeof state.updatedAt !== 'number') state.updatedAt = 0;
  rebuildHistoryIndex();
  return state;
}

export function getState() {
  return state;
}

export function saveState(debounce = true) {
  clearTimeout(saveTimer);
  const persist = () => {
    state.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    rebuildHistoryIndex();
    scheduleCloudPush(state);
  };
  if (debounce) {
    saveTimer = setTimeout(persist, 300);
  } else {
    persist();
  }
}

/* ---------- Exercise & day-type libraries (shared shape) ---------- */

function createLibraryItem(collectionKey, prefix, name, extra = {}) {
  const item = { id: uid(prefix), name: name.trim(), archived: false, ...extra };
  state[collectionKey].push(item);
  saveState(false);
  return item;
}

function renameLibraryItem(collectionKey, id, name) {
  const item = state[collectionKey].find((it) => it.id === id);
  if (!item) return;
  item.name = name.trim();
  saveState(false);
}

function archiveLibraryItem(collectionKey, id) {
  const item = state[collectionKey].find((it) => it.id === id);
  if (!item) return;
  item.archived = true;
  saveState(false);
}

function activeLibraryItems(collectionKey) {
  return state[collectionKey].filter((it) => !it.archived);
}

function libraryItemById(collectionKey, id) {
  return state[collectionKey].find((it) => it.id === id) || null;
}

export const exercises = {
  add: (name, isDuration = false) => createLibraryItem('exercises', 'ex', name, { isDuration }),
  rename: (id, name) => renameLibraryItem('exercises', id, name),
  archive: (id) => archiveLibraryItem('exercises', id),
  setDuration: (id, isDuration) => {
    const item = libraryItemById('exercises', id);
    if (!item) return;
    item.isDuration = isDuration;
    saveState(false);
  },
  setMedia: (id, { videoUrl, targetRegions }) => {
    const item = libraryItemById('exercises', id);
    if (!item) return;
    item.videoUrl = videoUrl || '';
    item.targetRegions = targetRegions || [];
    delete item.targetRegion;
    saveState(false);
  },
  active: () => activeLibraryItems('exercises'),
  all: () => state.exercises,
  byId: (id) => libraryItemById('exercises', id),
};

export const dayTypes = {
  add: (name) => createLibraryItem('dayTypes', 'dt', name),
  rename: (id, name) => renameLibraryItem('dayTypes', id, name),
  archive: (id) => archiveLibraryItem('dayTypes', id),
  active: () => activeLibraryItems('dayTypes'),
  all: () => state.dayTypes,
  byId: (id) => libraryItemById('dayTypes', id),
};

/* ---------- Day entries ---------- */

export function getDayEntries() {
  return state.dayEntries;
}

export function getDayEntryById(id) {
  return state.dayEntries.find((d) => d.id === id) || null;
}

export function getDayEntryByDate(dateIso) {
  return state.dayEntries.find((d) => d.date === dateIso) || null;
}

export function suggestNextDayNumber() {
  if (!state.dayEntries.length) return null;
  const max = Math.max(...state.dayEntries.map((d) => Number(d.dayNumber) || 0));
  return max + 1;
}

export function createDayEntry({ date, dayNumber, dayTypeId }) {
  const entry = {
    id: uid('day'),
    date,
    dayNumber: dayNumber ?? null,
    dayTypeId: dayTypeId ?? null,
    exercises: [],
  };
  state.dayEntries.push(entry);
  saveState(false);
  return entry;
}

export function updateDayEntryField(dayId, field, value, debounce = false) {
  const entry = getDayEntryById(dayId);
  if (!entry) return;
  entry[field] = value;
  saveState(debounce);
}

export function deleteDayEntry(dayId) {
  state.dayEntries = state.dayEntries.filter((d) => d.id !== dayId);
  saveState(false);
}

/* ---------- Exercise instances within a day entry ---------- */

function findInstance(dayId, instId) {
  const entry = getDayEntryById(dayId);
  return entry ? entry.exercises.find((e) => e.id === instId) || null : null;
}

// "Yapılan" set alanları artık sayısal seçiciler (reps 0-30, rir 0-9) — prescribed
// serbest metin olabildiği için ("8-9", "75sn", "tükenene kadar") ilk sayıyı çıkarıp
// makul bir başlangıç değerine indirgiyoruz; kullanıcı zaten seçiciden düzeltebilir.
// Export edilmiş: setRows.js aynı mantığı seçicide hocanın hedefini işaretlemek için
// de kullanıyor (bkz. openNumberPicker'ın target parametresi).
export function extractLeadingInt(str, fallback) {
  const match = String(str ?? '').match(/\d+/);
  return match ? parseInt(match[0], 10) : fallback;
}

function clampRir(n) {
  return Math.max(0, Math.min(9, n));
}

// Süre-bazlı egzersizlerde rir alanı "rezerv saniye" anlamına geldiği için
// (bkz. exercises.isDuration) 0-9'a sıkıştırılmıyor, sadece negatif olamıyor.
function buildActualSetsFromPrescribed(prescribed, isDuration) {
  const count = Math.max(1, Number(prescribed.setCount) || 1);
  const reps = String(extractLeadingInt(prescribed.reps, 0));
  const rirValue = extractLeadingInt(prescribed.rir, 0);
  const rir = String(isDuration ? Math.max(0, rirValue) : clampRir(rirValue));
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push({ weight: prescribed.weight, reps, rir, touched: false });
  }
  return rows;
}

function buildInstance(exerciseId, prescribed) {
  const exercise = libraryItemById('exercises', exerciseId);
  const isDuration = !!(exercise && exercise.isDuration);
  return {
    id: uid('exi'),
    exerciseId,
    note: '',
    status: null,
    loggedAt: null,
    prescribed,
    actualSets: buildActualSetsFromPrescribed(prescribed, isDuration),
  };
}

export function addExerciseInstance(dayId, exerciseId) {
  const entry = getDayEntryById(dayId);
  if (!entry) return null;
  const last = getLastInstance(exerciseId, dayId);
  const prescribed = last
    ? { ...last.prescribed }
    : { weight: '', setCount: 3, reps: '', rir: '0' };
  const inst = buildInstance(exerciseId, prescribed);
  entry.exercises.push(inst);
  saveState(false);
  return inst;
}

export function addExerciseInstanceWithPrescribed(dayId, exerciseId, prescribed) {
  const entry = getDayEntryById(dayId);
  if (!entry) return null;
  const inst = buildInstance(exerciseId, prescribed);
  entry.exercises.push(inst);
  saveState(false);
  return inst;
}

export function removeExerciseInstance(dayId, instId) {
  const entry = getDayEntryById(dayId);
  if (!entry) return;
  entry.exercises = entry.exercises.filter((e) => e.id !== instId);
  saveState(false);
}

export function updateInstancePrescribed(dayId, instId, field, value, debounce = false) {
  const inst = findInstance(dayId, instId);
  if (!inst) return;
  inst.prescribed[field] = value;
  if (inst.actualSets.every((s) => !s.touched)) {
    const exercise = libraryItemById('exercises', inst.exerciseId);
    inst.actualSets = buildActualSetsFromPrescribed(inst.prescribed, !!(exercise && exercise.isDuration));
  }
  saveState(debounce);
}

export function updateInstanceNote(dayId, instId, note) {
  const inst = findInstance(dayId, instId);
  if (!inst) return;
  inst.note = note;
  saveState(true);
}

export function updateInstanceStatus(dayId, instId, status) {
  const inst = findInstance(dayId, instId);
  if (!inst) return;
  inst.status = status;
  saveState(false);
}

export function addActualSet(dayId, instId) {
  const inst = findInstance(dayId, instId);
  if (!inst) return;
  const exercise = libraryItemById('exercises', inst.exerciseId);
  const isDuration = !!(exercise && exercise.isDuration);
  const last = inst.actualSets[inst.actualSets.length - 1];
  inst.actualSets.push(last
    ? { weight: last.weight, reps: last.reps, rir: last.rir, touched: false }
    : {
      weight: inst.prescribed.weight,
      reps: String(extractLeadingInt(inst.prescribed.reps, 0)),
      rir: String(isDuration
        ? Math.max(0, extractLeadingInt(inst.prescribed.rir, 0))
        : clampRir(extractLeadingInt(inst.prescribed.rir, 0))),
      touched: false,
    });
  saveState(false);
}

export function removeActualSet(dayId, instId, setIndex) {
  const inst = findInstance(dayId, instId);
  if (!inst) return;
  inst.actualSets.splice(setIndex, 1);
  saveState(false);
}

export function updateActualSetField(dayId, instId, setIndex, field, value, debounce = false) {
  const inst = findInstance(dayId, instId);
  if (!inst) return;
  const row = inst.actualSets[setIndex];
  row[field] = value;
  row.touched = true;
  inst.loggedAt = Date.now();
  for (let i = setIndex + 1; i < inst.actualSets.length; i++) {
    const next = inst.actualSets[i];
    if (!next.touched) {
      next.weight = row.weight;
      next.reps = row.reps;
      next.rir = row.rir;
    }
  }
  saveState(debounce);
}

/* ---------- "Last time this exercise" lookup ---------- */

export function getLastInstance(exerciseId, excludeDayEntryId) {
  const list = historyIndex[exerciseId];
  if (!list) return null;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].dayEntryId !== excludeDayEntryId) return list[i];
  }
  return null;
}

/* ---------- Payments ---------- */

export function getPayments() {
  return [...state.payments].sort((a, b) => b.date.localeCompare(a.date));
}

export function addPayment(date, amount, note) {
  const payment = { id: uid('pay'), date, amount: amount || null, note: note || '' };
  state.payments.push(payment);
  saveState(false);
  return payment;
}

export function deletePayment(id) {
  state.payments = state.payments.filter((p) => p.id !== id);
  saveState(false);
}

const PAYMENT_COUNTDOWN_DAYS = 10;

function clampDayToMonth(year, month, day) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(day, lastDay);
}

function anchorDateFor(anchorDay, year, month) {
  return new Date(year, month, clampDayToMonth(year, month, anchorDay));
}

// `date`'ten SONRAKİ ilk milad günü — `date`'in kendisi milad günüyse bir
// sonraki aya geçiyor ("az önce ödedin, sıradaki ödeme gelecek ay" demek).
function nextOccurrenceAfter(anchorDay, date) {
  let year = date.getFullYear();
  let month = date.getMonth();
  let candidate = anchorDateFor(anchorDay, year, month);
  if (candidate.getTime() <= date.getTime()) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
    candidate = anchorDateFor(anchorDay, year, month);
  }
  return candidate;
}

function paymentDaysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// Kayan 4 haftalık döngü yerine sabit ayın günü: en ESKİ ödemenin günü kalıcı
// milad oluyor (ayrı bir ayar yok — "hangi gün ödemeye başladıysa o milad").
// Sıradaki ödeme, EN SON ödemeden sonraki ilk milad günü — geç ödense bile bir
// sonraki miladı ERTELEMİYOR, sadece o anki gecikmeyi kapatıyor. js/coach/
// paymentCycle.js'te İZOLE bir kopyası var (coach sayfaları bu dosyayı import
// edemiyor) — biri değişirse ikisi de değişmeli.
export function getPaymentCycleStatus() {
  const sorted = getPayments();
  if (!sorted.length) return { hasPayment: false };

  const anchorDay = isoToDate(sorted[sorted.length - 1].date).getDate();
  const today = isoToDate(todayIso());
  const latestPaymentDate = isoToDate(sorted[0].date);
  const dueDate = nextOccurrenceAfter(anchorDay, latestPaymentDate);
  const overdue = today.getTime() > dueDate.getTime();
  const dueDateIso = `${dueDate.getFullYear()}-${pad2(dueDate.getMonth() + 1)}-${pad2(dueDate.getDate())}`;

  if (overdue) {
    return {
      hasPayment: true,
      anchorDay,
      overdue: true,
      dueDate: dueDateIso,
      daysSinceDue: paymentDaysBetween(dueDate, today),
    };
  }
  const daysUntilDue = paymentDaysBetween(today, dueDate);
  return {
    hasPayment: true,
    anchorDay,
    overdue: false,
    dueDate: dueDateIso,
    daysUntilDue,
    countdown: daysUntilDue <= PAYMENT_COUNTDOWN_DAYS,
  };
}

/* ---------- Backup: export / import ---------- */

export function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gymbn-yedek-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importBackup(file, onDone) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.dayEntries)) throw new Error('Geçersiz yedek dosyası formatı');
      if (!Array.isArray(parsed.exercises)) parsed.exercises = [];
      if (!Array.isArray(parsed.dayTypes)) parsed.dayTypes = [];
      if (!Array.isArray(parsed.payments)) parsed.payments = [];
      if (!parsed.schemaVersion) parsed.schemaVersion = SCHEMA_VERSION;
      state = parsed;
      saveState(false);
      onDone(null);
    } catch (e) {
      onDone(e);
    }
  };
  reader.onerror = () => onDone(new Error('Dosya okunamadı'));
  reader.readAsText(file);
}
