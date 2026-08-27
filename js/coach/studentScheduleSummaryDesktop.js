import { getStudent, getStudentAppState } from './coachCloud.js';
import {
  addDaysIso, dayOfWeekLabel, formatDateShortTr, formatDateLongTr, escapeHtml, statusBadge, formatDuration,
  setViewportZoomable,
} from '../util.js';

// Öğrencinin kendi weekSummaryDesktop.js'inin hoca-tarafı birebir kopyası —
// AYNI geniş-tablo görüntüleme, sadece veri kaynağı uzaktan çekilen `state`,
// üstüne studentSchedule.js'in (Takvim) ‹/› hafta gezinmesi eklendi.
// setAppChromeHidden burada zararsız bir no-op: coach.html'de zaten .app-header/
// .bottom-nav gibi kalıcı bir chrome yok, gizlenecek bir şey bulunmuyor.
export async function render(container, { studentUid, mondayIso }) {
  setViewportZoomable(true);
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

  const state = remoteState || {};
  state.dayEntries = state.dayEntries || [];
  state.dayTypes = state.dayTypes || [];
  state.exercises = state.exercises || [];
  renderScreen(container, studentUid, student, state, mondayIso);
}

function renderLoadingScreen(container) {
  container.innerHTML = '<p class="empty-state">Yükleniyor…</p>';
}

function renderErrorScreen(container, message) {
  container.innerHTML = `
    <div class="view-header">
      <button type="button" class="back-link" id="back-btn" aria-label="Geri">←</button>
      <h2 class="view-title">Masaüstü Özeti</h2>
      <span></span>
    </div>
    <p class="empty-state">${escapeHtml(message)}</p>
  `;
  container.querySelector('#back-btn').addEventListener('click', () => history.back());
}

function renderScreen(container, studentUid, student, state, mondayIso) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(mondayIso, i));
  const entries = days.map((d) => state.dayEntries.find((e) => e.date === d)).filter(Boolean);
  const prevMonday = addDaysIso(mondayIso, -7);
  const nextMonday = addDaysIso(mondayIso, 7);
  const rows = groupByDayTypeFamily(entries, state);

  container.innerHTML = `
    <div class="view-header">
      <button type="button" class="back-link" id="back-btn" aria-label="Geri">←</button>
      <h2 class="view-title">Masaüstü Özeti</h2>
      <span></span>
    </div>
    <p class="view-subtitle">${escapeHtml(student.displayName)}</p>
    <div class="week-nav">
      <a href="#/schedule/${studentUid}/${prevMonday}/summary-desktop" class="btn-icon" aria-label="Önceki hafta">‹</a>
      <div class="week-range">${formatDateShortTr(mondayIso)} – ${formatDateShortTr(days[6])}</div>
      <a href="#/schedule/${studentUid}/${nextMonday}/summary-desktop" class="btn-icon" aria-label="Sonraki hafta">›</a>
    </div>
    <div class="desktop-summary">
      ${entries.length ? rows.map((row) => `<div class="desktop-day-row">${row.map((entry) => buildDayTable(entry, state)).join('')}</div>`).join('') : '<p class="empty-state">Bu haftaya henüz kayıt eklenmedi.</p>'}
    </div>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => {
    history.back();
  });
}

function buildDayTable(entry, state) {
  const dt = entry.dayTypeId ? state.dayTypes.find((d) => d.id === entry.dayTypeId) : null;
  const titleParts = [dt ? dt.name : null, entry.dayNumber ? `${entry.dayNumber}. Gün` : null].filter(Boolean);
  const durationNote = entry.workoutDurationSec ? ` · ⏱ ${formatDuration(entry.workoutDurationSec)}` : '';
  const header = `${titleParts.join(' · ') || 'Antrenman'} — ${formatDateLongTr(entry.date)}, ${dayOfWeekLabel(entry.date)}${entry.completed ? ' ✅' : ''}${durationNote}`;

  if (!entry.exercises.length) {
    return `
      <div class="desktop-day-block">
        <div class="desktop-day-header">${escapeHtml(header)}</div>
        <p class="empty-state">Egzersiz eklenmedi.</p>
      </div>
    `;
  }

  const rows = entry.exercises.map((inst) => {
    const exercise = state.exercises.find((e) => e.id === inst.exerciseId);
    const isDuration = !!(exercise && exercise.isDuration);
    return `
      <tr>
        <td class="desktop-ex-name">
          <div>${escapeHtml(exercise ? exercise.name : '(silinmiş egzersiz)')} ${statusBadge(inst.status)}</div>
          <div class="desktop-ex-prescribed">${escapeHtml(formatPrescribed(inst.prescribed, isDuration))}</div>
        </td>
        <td>${escapeHtml(joinSetValues(inst.actualSets, 'weight'))}</td>
        <td>${inst.actualSets.length || '-'}</td>
        <td>${escapeHtml(joinSetValues(inst.actualSets, 'reps', isDuration ? 'sn' : ''))}</td>
        <td>${escapeHtml(joinSetValues(inst.actualSets, 'rir', isDuration ? 'sn' : ''))}</td>
        <td class="desktop-ex-note">
          ${inst.prescribed.coachNote ? `<div class="desktop-note-coach">H: ${escapeHtml(inst.prescribed.coachNote)}</div>` : ''}
          ${inst.note ? `<div class="desktop-note-athlete">S: ${escapeHtml(inst.note)}</div>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div class="desktop-day-block">
      <div class="desktop-day-header">${escapeHtml(header)}</div>
      <div class="desktop-table-scroll">
        <table class="desktop-table">
          <colgroup>
            <col style="width:28%">
            <col style="width:13%">
            <col style="width:7%">
            <col style="width:15%">
            <col style="width:9%">
            <col style="width:28%">
          </colgroup>
          <thead>
            <tr>
              <th>Egzersiz</th>
              <th>Ağırlık</th>
              <th>Set</th>
              <th>Tekrar</th>
              <th>Rir</th>
              <th>Not</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

// "Anterior-1" ve "Anterior-2" gibi aynı ailenin farklı numaralı günlerini aynı
// satırda göstermek için sondaki "-N"yi atıp temel adı çıkarıyor.
function baseDayTypeName(entry, state) {
  const dt = entry.dayTypeId ? state.dayTypes.find((d) => d.id === entry.dayTypeId) : null;
  const name = dt ? dt.name : 'Antrenman';
  return name.replace(/[\s-]*\d+\s*$/, '').trim() || name;
}

// Günleri temel gün-tipi adına göre gruplar; grup sırası haftadaki ilk görülme
// sırasına göre (ilk görülen gün-tipi ailesi ilk satır olur).
function groupByDayTypeFamily(entries, state) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = baseDayTypeName(entry, state);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return [...groups.values()];
}

function formatPrescribed(p, isDuration) {
  const parts = [];
  if (p.setCount) parts.push(`${p.setCount} set`);
  if (p.reps) parts.push(isDuration ? `${p.reps}sn` : `${p.reps} tekrar`);
  if (p.weight) parts.push(p.weight);
  if (p.rir) parts.push(isDuration ? `rezerv ${p.rir}sn` : `rir ${p.rir}`);
  return parts.join(' · ') || '-';
}

function joinSetValues(actualSets, field, suffix = '') {
  if (!actualSets.length) return '-';
  const values = actualSets.map((s) => (s[field] ? s[field] + suffix : '-'));
  const unique = [...new Set(values)];
  return unique.length === 1 ? unique[0] : values.join(' # ');
}
