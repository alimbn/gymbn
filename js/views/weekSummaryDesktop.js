import { getDayEntryByDate, dayTypes, exercises } from '../storage.js';
import { addDaysIso, dayOfWeekLabel, formatDateLongTr, escapeHtml, setViewportZoomable, setAppChromeHidden, statusBadge } from '../util.js';

export function render(container, { mondayIso }) {
  setViewportZoomable(true);
  setAppChromeHidden(true);

  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(mondayIso, i));
  const entries = days.map((d) => getDayEntryByDate(d)).filter(Boolean);
  const rows = groupByDayTypeFamily(entries);

  container.innerHTML = `
    <div class="view-header">
      <button type="button" class="back-link" id="back-btn" aria-label="Geri">←</button>
      <h2 class="view-title">Masaüstü Özeti</h2>
      <span></span>
    </div>
    <div class="summary-range">${formatDateLongTr(mondayIso)} – ${formatDateLongTr(days[6])}</div>
    <div class="desktop-summary">
      ${entries.length ? rows.map((row) => `<div class="desktop-day-row">${row.map(buildDayTable).join('')}</div>`).join('') : '<p class="empty-state">Bu haftaya henüz kayıt eklenmedi.</p>'}
    </div>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => {
    history.back();
  });
}

function buildDayTable(entry) {
  const dt = entry.dayTypeId ? dayTypes.byId(entry.dayTypeId) : null;
  const titleParts = [dt ? dt.name : null, entry.dayNumber ? `${entry.dayNumber}. Gün` : null].filter(Boolean);
  const header = `${titleParts.join(' · ') || 'Antrenman'} — ${formatDateLongTr(entry.date)}, ${dayOfWeekLabel(entry.date)}${entry.completed ? ' ✅' : ''}`;

  if (!entry.exercises.length) {
    return `
      <div class="desktop-day-block">
        <div class="desktop-day-header">${escapeHtml(header)}</div>
        <p class="empty-state">Egzersiz eklenmedi.</p>
      </div>
    `;
  }

  const rows = entry.exercises.map((inst) => {
    const exercise = exercises.byId(inst.exerciseId);
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
        <td class="desktop-ex-note">${escapeHtml(inst.note)}</td>
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
function baseDayTypeName(entry) {
  const dt = entry.dayTypeId ? dayTypes.byId(entry.dayTypeId) : null;
  const name = dt ? dt.name : 'Antrenman';
  return name.replace(/[\s-]*\d+\s*$/, '').trim() || name;
}

// Günleri temel gün-tipi adına göre gruplar; grup sırası haftadaki ilk görülme
// sırasına göre (ilk görülen gün-tipi ailesi ilk satır olur).
function groupByDayTypeFamily(entries) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = baseDayTypeName(entry);
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
