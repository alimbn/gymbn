import { getDayEntryByDate, dayTypes, exercises } from '../storage.js';
import { addDaysIso, dayOfWeekLabel, formatDateShortTr, formatDateLongTr, escapeHtml, setViewportZoomable } from '../util.js';

export function render(container, { mondayIso }) {
  setViewportZoomable(true);

  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(mondayIso, i));
  const entries = days.map((d) => getDayEntryByDate(d)).filter(Boolean);

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
    <div class="summary-range">${formatDateLongTr(mondayIso)} – ${formatDateLongTr(days[6])}</div>
    <div class="summary-overview">
      <div class="summary-stat"><strong>${entries.length}</strong><span>gün antrenman</span></div>
      <div class="summary-stat good"><strong>${goodCount}</strong><span>✅ istenildiği gibi</span></div>
      <div class="summary-stat bad"><strong>${badCount}</strong><span>🔻 yapılamadı</span></div>
    </div>
    <div class="summary-days">
      ${entries.length ? entries.map(buildDaySummary).join('') : '<p class="empty-state">Bu haftaya henüz kayıt eklenmedi.</p>'}
    </div>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => {
    history.back();
  });
}

function buildDaySummary(entry) {
  const dt = entry.dayTypeId ? dayTypes.byId(entry.dayTypeId) : null;
  const titleParts = [dt ? dt.name : null, entry.dayNumber ? `#${entry.dayNumber}` : null].filter(Boolean);
  return `
    <div class="summary-day">
      <div class="summary-day-header">
        <span>${dayOfWeekLabel(entry.date)} · ${formatDateShortTr(entry.date)}</span>
        <span>${escapeHtml(titleParts.join(' · ') || 'Antrenman')}${entry.completed ? ' ✅' : ''}</span>
      </div>
      ${entry.exercises.length ? entry.exercises.map(buildExerciseSummary).join('') : '<p class="empty-state">Egzersiz eklenmedi.</p>'}
    </div>
  `;
}

function buildExerciseSummary(inst) {
  const exercise = exercises.byId(inst.exerciseId);
  const statusIcon = inst.status === 'good' ? ' ✅' : inst.status === 'bad' ? ' 🔻' : '';
  return `
    <div class="summary-exercise">
      <div class="summary-exercise-name">${escapeHtml(exercise ? exercise.name : '(silinmiş egzersiz)')}${statusIcon}</div>
      <div class="summary-exercise-row"><span class="summary-label">Planlanan:</span> ${escapeHtml(formatPrescribed(inst.prescribed))}</div>
      <div class="summary-exercise-row"><span class="summary-label">Yapılan:</span> ${escapeHtml(formatActual(inst.actualSets))}</div>
      ${inst.note ? `<div class="summary-exercise-note">"${escapeHtml(inst.note)}"</div>` : ''}
    </div>
  `;
}

function formatPrescribed(p) {
  const parts = [];
  if (p.weight) parts.push(p.weight);
  if (p.setCount) parts.push(`${p.setCount} set`);
  if (p.reps) parts.push(`${p.reps} tekrar`);
  if (p.rir) parts.push(`rir ${p.rir}`);
  return parts.join(' · ') || '-';
}

function formatActual(actualSets) {
  if (!actualSets.length) return '-';
  return actualSets.map((s) => {
    let str = `${s.weight || '-'}×${s.reps || '-'}`;
    if (s.rir) str += ` (rir ${s.rir})`;
    return str;
  }).join(', ');
}
