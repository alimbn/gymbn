import { getStudent, getStudentAppState } from './coachCloud.js';
import { buildDesktopSummary } from './studentScheduleSummaryDesktop.js';
import {
  addDaysIso, dayOfWeekLabel, formatDateShortTr, formatDateLongTr, mondayOfWeek, todayIso,
  escapeHtml, statusBadge, formatDuration, setViewportZoomable,
} from '../util.js';

// weekSummary.js'in AYNI render mantığı (o zaten tamamen görüntüleme-amaçlı,
// hiç düzenleme yok — soyulacak bir interaktiflik yoktu) — sadece veri kaynağı
// storage.js'in yerel singleton'ı yerine uzaktan çekilen `state` parametresi,
// üstüne week.js'in ‹/› hafta gezinmesi eklendi. formatPrescribed/formatActual
// birebir kopya.
export async function render(container, { studentUid, mondayIso }) {
  renderLoadingScreen(container);
  const monday = mondayIso || mondayOfWeek(todayIso());

  let student;
  let remoteState;
  try {
    [student, remoteState] = await Promise.all([getStudent(studentUid), getStudentAppState(studentUid)]);
  } catch (err) {
    console.error('Öğrenci verisi yüklenemedi', err);
    renderErrorScreen(container, studentUid, 'Öğrenci verisi yüklenemedi, internet bağlantını kontrol edip tekrar dene.');
    return;
  }
  if (!student) {
    renderErrorScreen(container, studentUid, 'Öğrenci bulunamadı.');
    return;
  }

  const state = remoteState || {};
  state.dayEntries = state.dayEntries || [];
  state.dayTypes = state.dayTypes || [];
  state.exercises = state.exercises || [];
  renderScreen(container, studentUid, student, state, monday);
}

function renderLoadingScreen(container) {
  container.innerHTML = '<p class="empty-state">Yükleniyor…</p>';
}

function renderErrorScreen(container, studentUid, message) {
  container.innerHTML = `
    <div class="view-header">
      <a href="#/student/${studentUid}" class="back-link" aria-label="Geri">←</a>
      <h2 class="view-title">Takvim</h2>
      <span></span>
    </div>
    <p class="empty-state">${escapeHtml(message)}</p>
  `;
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
      <a href="#/student/${studentUid}" class="back-link" aria-label="Geri">←</a>
      <h2 class="view-title">${escapeHtml(student.displayName)}</h2>
      <span></span>
    </div>
    <div class="week-nav">
      <a href="#/schedule/${studentUid}/${prevMonday}" class="btn-icon" aria-label="Önceki hafta">‹</a>
      <div class="week-range">${formatDateShortTr(mondayIso)} – ${formatDateShortTr(days[6])}</div>
      <a href="#/schedule/${studentUid}/${nextMonday}" class="btn-icon" aria-label="Sonraki hafta">›</a>
    </div>
    <div class="summary-overview">
      <div class="summary-stat"><strong>${entries.length}</strong><span>gün antrenman</span></div>
      <div class="summary-stat good"><strong>${goodCount}</strong><span>✅ istenildiği gibi</span></div>
      <div class="summary-stat bad"><strong>${badCount}</strong><span>🔻 yapılamadı</span></div>
    </div>
    ${entries.length ? `
      <div class="schedule-view-toggle">
        <button type="button" class="schedule-toggle-btn active" data-view="haftalik">📄 Haftalık Özet</button>
        <button type="button" class="schedule-toggle-btn" data-view="masaustu">🖥️ Masaüstü Özeti</button>
      </div>
      <div id="schedule-content">${buildAccordionView(entries, state)}</div>
    ` : '<p class="empty-state">Bu haftaya henüz program atanmadı.</p>'}
  `;

  if (!entries.length) return;

  const contentEl = container.querySelector('#schedule-content');

  // Akordiyon: her girişte VE her "Haftalık Özet"e dönüşte tam kapalı başlar —
  // ayrı bir state saklanmıyor, buildAccordionView her çağrıldığında taze
  // .collapsed markup üretiyor. Her gün BAĞIMSIZ açılıp kapanıyor — dayEntry.js'in
  // egzersiz kartlarındaki "tek seferde bir tane" kuralının aksine, istenirse
  // hepsi aynı anda açık kalabilir. #schedule-content sekme değişince yeniden
  // yazılsa da HEP AYNI (stabil) elemanda kaldığı için tek bir delegated
  // listener iki görünüm için de yeterli — masaüstü tabloda .summary-day-header
  // hiç yok, kontrol orada sessizce no-op oluyor.
  contentEl.addEventListener('click', (e) => {
    const header = e.target.closest('.summary-day-header');
    if (!header) return;
    header.closest('.summary-day').classList.toggle('collapsed');
  });

  // Sekme değişimi: route değişmediği için router.js'in setViewportZoomable(false)
  // sıfırlaması burada devreye girmiyor — o yüzden yönü biz yönetiyoruz (masaüstü
  // yoğun tablo için zoom açık, haftalık özete dönünce kapalı).
  container.querySelectorAll('.schedule-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) return;
      container.querySelectorAll('.schedule-toggle-btn').forEach((b) => b.classList.toggle('active', b === btn));
      if (btn.dataset.view === 'masaustu') {
        setViewportZoomable(true);
        contentEl.innerHTML = buildDesktopSummary(entries, state);
      } else {
        setViewportZoomable(false);
        contentEl.innerHTML = buildAccordionView(entries, state);
      }
    });
  });
}

function buildAccordionView(entries, state) {
  return `<div class="summary-days summary-days-accordion">${entries.map((e) => buildDaySummary(e, state)).join('')}</div>`;
}

function buildDaySummary(entry, state) {
  const dt = entry.dayTypeId ? state.dayTypes.find((d) => d.id === entry.dayTypeId) : null;
  const titleParts = [dt ? dt.name : null, entry.dayNumber ? `#${entry.dayNumber}` : null].filter(Boolean);
  const durationNote = entry.workoutDurationSec ? ` · ⏱ ${formatDuration(entry.workoutDurationSec)}` : '';
  return `
    <div class="summary-day collapsed" data-date="${entry.date}">
      <div class="summary-day-header">
        <span class="summary-day-header-left"><span class="accordion-chevron">▸</span>${dayOfWeekLabel(entry.date)} · ${formatDateShortTr(entry.date)}</span>
        <span>${escapeHtml(titleParts.join(' · ') || 'Antrenman')}${entry.completed ? ' ✅' : ''}${durationNote}</span>
      </div>
      <div class="summary-day-body">
        ${entry.exercises.length ? entry.exercises.map((inst) => buildExerciseSummary(inst, state)).join('') : '<p class="empty-state">Egzersiz eklenmedi.</p>'}
      </div>
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
