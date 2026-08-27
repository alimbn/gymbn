import { getStudent, getStudentAppState } from './coachCloud.js';
import {
  addDaysIso, dayOfWeekLabel, formatDateShortTr, formatDateLongTr, escapeHtml, statusBadge, formatDuration,
  setViewportZoomable,
} from '../util.js';

// Öğrencinin kendi weekSummary.js'inin hoca-tarafı birebir kopyası — AYNI tam
// açık (akordiyon değil) görüntüleme, sadece veri kaynağı uzaktan çekilen
// `state`, üstüne studentSchedule.js'in (Takvim) ‹/› hafta gezinmesi eklendi.
// Takvim'den "📄 Haftalık Özet" düğmesiyle buraya geliniyor, "←" ile geri dönülüyor.
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
      <h2 class="view-title">Haftalık Özet</h2>
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

  let goodCount = 0;
  let badCount = 0;
  entries.forEach((e) => e.exercises.forEach((inst) => {
    if (inst.status === 'good') goodCount++;
    else if (inst.status === 'bad') badCount++;
  }));

  container.innerHTML = `
    <div class="view-header">
      <button type="button" class="back-link" id="back-btn" aria-label="Geri">←</button>
      <h2 class="view-title">Haftalık Özet</h2>
      <span></span>
    </div>
    <p class="view-subtitle">${escapeHtml(student.displayName)}</p>
    <div class="week-nav">
      <a href="#/schedule/${studentUid}/${prevMonday}/summary" class="btn-icon" aria-label="Önceki hafta">‹</a>
      <div class="week-range">${formatDateShortTr(mondayIso)} – ${formatDateShortTr(days[6])}</div>
      <a href="#/schedule/${studentUid}/${nextMonday}/summary" class="btn-icon" aria-label="Sonraki hafta">›</a>
    </div>
    <div class="summary-overview">
      <div class="summary-stat"><strong>${entries.length}</strong><span>gün antrenman</span></div>
      <div class="summary-stat good"><strong>${goodCount}</strong><span>✅ istenildiği gibi</span></div>
      <div class="summary-stat bad"><strong>${badCount}</strong><span>🔻 yapılamadı</span></div>
    </div>
    <div class="summary-days">
      ${entries.length ? entries.map((e) => buildDaySummary(e, state)).join('') : '<p class="empty-state">Bu haftaya henüz kayıt eklenmedi.</p>'}
    </div>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => {
    history.back();
  });
}

function buildDaySummary(entry, state) {
  const dt = entry.dayTypeId ? state.dayTypes.find((d) => d.id === entry.dayTypeId) : null;
  const titleParts = [dt ? dt.name : null, entry.dayNumber ? `#${entry.dayNumber}` : null].filter(Boolean);
  const durationNote = entry.workoutDurationSec ? ` · ⏱ ${formatDuration(entry.workoutDurationSec)}` : '';
  return `
    <div class="summary-day">
      <div class="summary-day-header">
        <span>${dayOfWeekLabel(entry.date)} · ${formatDateShortTr(entry.date)}</span>
        <span>${escapeHtml(titleParts.join(' · ') || 'Antrenman')}${entry.completed ? ' ✅' : ''}${durationNote}</span>
      </div>
      ${entry.exercises.length ? entry.exercises.map((inst) => buildExerciseSummary(inst, state)).join('') : '<p class="empty-state">Egzersiz eklenmedi.</p>'}
    </div>
  `;
}

function buildExerciseSummary(inst, state) {
  const exercise = state.exercises.find((e) => e.id === inst.exerciseId);
  const isDuration = !!(exercise && exercise.isDuration);
  return `
    <div class="summary-exercise">
      <div class="summary-exercise-name">${escapeHtml(exercise ? exercise.name : '(silinmiş egzersiz)')} ${statusBadge(inst.status)}</div>
      <div class="summary-exercise-row"><span class="summary-label">Planlanan:</span> ${escapeHtml(formatPrescribed(inst.prescribed, isDuration))}</div>
      <div class="summary-exercise-row"><span class="summary-label">Yapılan:</span> ${escapeHtml(formatActual(inst.actualSets, isDuration))}</div>
      ${inst.prescribed.coachNote ? `<div class="summary-exercise-coachnote">Hoca: "${escapeHtml(inst.prescribed.coachNote)}"</div>` : ''}
      ${inst.note ? `<div class="summary-exercise-note">Sporcu: "${escapeHtml(inst.note)}"</div>` : ''}
    </div>
  `;
}

function formatPrescribed(p, isDuration) {
  const parts = [];
  if (p.weight) parts.push(p.weight);
  if (p.setCount) parts.push(`${p.setCount} set`);
  if (p.reps) parts.push(isDuration ? `${p.reps}sn` : `${p.reps} tekrar`);
  if (p.rir) parts.push(isDuration ? `rezerv ${p.rir}sn` : `rir ${p.rir}`);
  return parts.join(' · ') || '-';
}

function formatActual(actualSets, isDuration) {
  if (!actualSets.length) return '-';
  return actualSets.map((s) => {
    let str = `${s.weight || '-'}×${s.reps || '-'}${isDuration ? 'sn' : ''}`;
    if (s.rir) str += isDuration ? ` (rezerv ${s.rir}sn)` : ` (rir ${s.rir})`;
    return str;
  }).join(', ');
}
