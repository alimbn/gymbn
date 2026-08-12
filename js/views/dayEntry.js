import {
  getDayEntryById, updateDayEntryField, deleteDayEntry,
  dayTypes, exercises, addExerciseInstance, removeExerciseInstance, updateInstancePrescribed,
  updateInstanceNote, updateInstanceStatus, getLastInstance,
} from '../storage.js';
import { dayOfWeekLabel, formatDateShortTr, escapeHtml, statusBadge, formatDuration } from '../util.js';
import { renderSetRows } from '../components/setRows.js';
import { openPicker } from '../components/picker.js';

export function render(container, { id }) {
  const entry = getDayEntryById(id);

  if (!entry) {
    container.innerHTML = `
      <div class="view-header"><h2 class="view-title">Antrenman</h2></div>
      <p class="empty-state">Bu antrenman bulunamadı.</p>
      <a href="#/" class="btn btn-primary btn-block">Panele Dön</a>
    `;
    return;
  }

  renderEntry(container, entry);
}

function renderEntry(container, entry) {
  container.innerHTML = `
    <div class="view-header">
      <button type="button" class="back-link" id="back-btn" aria-label="Geri">←</button>
      <h2 class="view-title">Antrenman</h2>
      <button type="button" class="btn-icon danger" id="delete-day-btn" aria-label="Günü sil">🗑</button>
    </div>
    <div class="card">
      <div class="form-row">
        <div class="field">
          <label>Tarih</label>
          <input type="date" id="date-input" value="${entry.date}">
        </div>
        <div class="field">
          <label>Gün No</label>
          <input type="number" id="day-number-input" inputmode="numeric" value="${entry.dayNumber ?? ''}">
        </div>
      </div>
      <div class="field">
        <label>Gün Tipi</label>
        <select id="day-type-select">
          <option value="">Gün tipi seç...</option>
          ${dayTypes.active().map((dt) => `<option value="${dt.id}"${dt.id === entry.dayTypeId ? ' selected' : ''}>${escapeHtml(dt.name)}</option>`).join('')}
        </select>
      </div>
      <p class="view-subtitle" id="weekday-label"></p>
    </div>

    <div class="card workout-timer-card">
      <div id="workout-timer-content"></div>
    </div>

    <div class="section">
      <div class="section-title">Egzersizler</div>
      <div id="exercise-cards"></div>
      <button type="button" class="btn btn-block" id="add-exercise-btn">+ Egzersiz Ekle</button>
    </div>

    <button type="button" class="btn btn-block day-complete-btn" id="complete-day-btn"></button>
  `;

  const dateInput = container.querySelector('#date-input');
  const dayNumberInput = container.querySelector('#day-number-input');
  const dayTypeSelect = container.querySelector('#day-type-select');
  const weekdayLabel = container.querySelector('#weekday-label');
  const cardsRoot = container.querySelector('#exercise-cards');

  function updateWeekdayLabel() {
    weekdayLabel.textContent = entry.date ? dayOfWeekLabel(entry.date) : '';
  }
  updateWeekdayLabel();

  // Antrenman süresi: workoutStartedAt bir zaman damgası, geçen süre her tick'te
  // Date.now()'dan hesaplanıyor — sekme arka plana alınsa/kapatılsa bile doğru kalır.
  const workoutTimerContent = container.querySelector('#workout-timer-content');
  let workoutTickInterval = null;

  function renderWorkoutTimer() {
    clearInterval(workoutTickInterval);
    if (entry.workoutDurationSec) {
      workoutTimerContent.innerHTML = `<div class="workout-timer-done">✅ Antrenman süresi: <strong>${formatDuration(entry.workoutDurationSec)}</strong></div>`;
      return;
    }
    if (entry.workoutStartedAt) {
      workoutTimerContent.innerHTML = `<div class="workout-timer-running">⏱ Antrenman sürüyor: <strong id="workout-elapsed"></strong></div>`;
      const elapsedEl = workoutTimerContent.querySelector('#workout-elapsed');
      const tick = () => {
        if (!elapsedEl.isConnected) {
          clearInterval(workoutTickInterval);
          return;
        }
        elapsedEl.textContent = formatDuration((Date.now() - entry.workoutStartedAt) / 1000);
      };
      tick();
      workoutTickInterval = setInterval(tick, 1000);
      return;
    }
    workoutTimerContent.innerHTML = `<button type="button" class="btn btn-primary btn-block" id="start-workout-btn">▶ Antrenmana Başla</button>`;
    workoutTimerContent.querySelector('#start-workout-btn').addEventListener('click', () => {
      entry.workoutStartedAt = Date.now();
      updateDayEntryField(entry.id, 'workoutStartedAt', entry.workoutStartedAt, false);
      renderWorkoutTimer();
    });
  }
  renderWorkoutTimer();

  container.querySelector('#back-btn').addEventListener('click', () => {
    history.back();
  });

  container.querySelector('#delete-day-btn').addEventListener('click', () => {
    const dt = entry.dayTypeId ? dayTypes.byId(entry.dayTypeId) : null;
    const label = [formatDateShortTr(entry.date), dt ? dt.name : null].filter(Boolean).join(' · ');
    if (confirm(`"${label}" antrenman günü tamamen silinecek (${entry.exercises.length} egzersiz dahil). Bu işlem geri alınamaz. Emin misin?`)) {
      deleteDayEntry(entry.id);
      history.back();
    }
  });

  dateInput.addEventListener('change', () => {
    entry.date = dateInput.value;
    updateDayEntryField(entry.id, 'date', entry.date, false);
    updateWeekdayLabel();
  });

  dayNumberInput.addEventListener('input', () => {
    const value = dayNumberInput.value ? Number(dayNumberInput.value) : null;
    updateDayEntryField(entry.id, 'dayNumber', value, true);
  });

  dayTypeSelect.addEventListener('change', () => {
    entry.dayTypeId = dayTypeSelect.value || null;
    updateDayEntryField(entry.id, 'dayTypeId', entry.dayTypeId, false);
  });

  // "Complete" is a plain flag — purely so the week view can show at a glance which
  // days are done, doesn't lock editing. Its one side effect: the first time it's
  // turned on, it stops the workout timer (if running) and locks in the duration.
  const completeBtn = container.querySelector('#complete-day-btn');
  function updateCompleteBtn() {
    completeBtn.textContent = entry.completed ? '✅ Gün Tamamlandı' : 'Günü Tamamla';
    completeBtn.classList.toggle('active', !!entry.completed);
  }
  updateCompleteBtn();
  completeBtn.addEventListener('click', () => {
    entry.completed = !entry.completed;
    if (entry.completed && entry.workoutStartedAt && !entry.workoutDurationSec) {
      entry.workoutDurationSec = Math.round((Date.now() - entry.workoutStartedAt) / 1000);
      updateDayEntryField(entry.id, 'workoutDurationSec', entry.workoutDurationSec, false);
      renderWorkoutTimer();
    }
    updateDayEntryField(entry.id, 'completed', entry.completed, false);
    updateCompleteBtn();
  });

  // Accordion: only one exercise card expanded at a time, so mid-workout you can
  // focus on the one you're actually doing. Starts fully collapsed; adding a new
  // exercise focuses that one. Not persisted — purely a per-visit UI aid.
  let expandedInstId = null;

  function toggleExpand(instId) {
    expandedInstId = expandedInstId === instId ? null : instId;
    renderCards();
  }

  function renderCards() {
    if (!entry.exercises.length) {
      cardsRoot.innerHTML = '<p class="empty-state">Henüz egzersiz eklenmedi.</p>';
      return;
    }
    cardsRoot.innerHTML = '';
    entry.exercises.forEach((inst, idx) => {
      const isExpanded = inst.id === expandedInstId;
      cardsRoot.appendChild(buildExerciseCard(entry, inst, isExpanded, () => toggleExpand(inst.id), renderCards, () => advanceTo(idx)));
    });
  }

  // "Nasıl gitti?" işaretlendiğinde bu kartı kapatıp bir sonraki egzersizi açar —
  // antrenman sırasında elle kapat/aç yapmadan sırayla ilerlemek için.
  function advanceTo(currentIdx) {
    const next = entry.exercises[currentIdx + 1];
    expandedInstId = next ? next.id : null;
    renderCards();
    if (next) {
      requestAnimationFrame(() => {
        const nextCardEl = cardsRoot.children[currentIdx + 1];
        if (nextCardEl) nextCardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  container.querySelector('#add-exercise-btn').addEventListener('click', () => {
    const activeExercises = exercises.active();
    if (!activeExercises.length) {
      alert('Önce "Diğer > Egzersizler" ekranından en az bir egzersiz eklemelisin.');
      return;
    }
    openPicker({
      title: 'Egzersiz Seç',
      items: activeExercises,
      emptyMessage: 'Eşleşen egzersiz yok.',
      onSelect: (exerciseId) => {
        const newInst = addExerciseInstance(entry.id, exerciseId);
        expandedInstId = newInst.id;
        renderCards();
      },
    });
  });

  renderCards();
}

function buildExerciseCard(entry, inst, isExpanded, onToggle, refreshCards, onStatusSet) {
  const card = document.createElement('div');
  card.className = 'exercise-card' + (isExpanded ? ' expanded' : ' collapsed');
  const exercise = exercises.byId(inst.exerciseId);

  card.innerHTML = `
    <div class="exercise-card-header">
      <span class="accordion-chevron">${isExpanded ? '▾' : '▸'}</span>
      <span class="exercise-name">${escapeHtml(exercise ? exercise.name : '(silinmiş egzersiz)')}</span>
      ${(inst.note || inst.prescribed.coachNote) ? '<span class="note-indicator" aria-label="Not var">💬</span>' : ''}
      <span class="exercise-status-icon">${statusBadge(inst.status)}</span>
      <button type="button" class="btn-icon danger remove-exercise-btn" aria-label="Egzersizi sil">🗑</button>
    </div>
    <div class="exercise-card-body"></div>
  `;

  card.querySelector('.exercise-card-header').addEventListener('click', () => onToggle());

  card.querySelector('.remove-exercise-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const name = exercise ? exercise.name : 'Bu egzersiz';
    if (confirm(`"${name}" bugünün antrenmanından silinsin mi?`)) {
      removeExerciseInstance(entry.id, inst.id);
      refreshCards();
    }
  });

  if (isExpanded) {
    buildExpandedBody(card.querySelector('.exercise-card-body'), entry, inst, onStatusSet);
  }

  return card;
}

function buildExpandedBody(bodyEl, entry, inst, onStatusSet) {
  const last = getLastInstance(inst.exerciseId, entry.id);
  const exercise = exercises.byId(inst.exerciseId);
  const isDuration = !!(exercise && exercise.isDuration);
  const repsLabel = isDuration ? 'Süre (sn)' : 'Tekrar';
  const rirLabel = isDuration ? 'Rezerv (sn)' : 'Rir';

  bodyEl.innerHTML = `
    <div class="last-time">${last ? `Son sefer (${formatDateShortTr(last.date)}): ${formatSetsSummary(last.actualSets, isDuration)}` : 'İlk kez yapılıyor.'}</div>
    <div class="prescribed-block">
      <div class="block-label">Planlanan (Hoca)</div>
      <div class="prescribed-fields">
        <div class="field"><label>Ağırlık</label><input type="text" class="presc-input" data-field="weight" value="${escapeHtml(inst.prescribed.weight)}"></div>
        <div class="field"><label>Set</label><input type="number" class="presc-input" data-field="setCount" min="1" inputmode="numeric" value="${inst.prescribed.setCount ?? ''}"></div>
        <div class="field"><label>${repsLabel}</label><input type="text" class="presc-input" data-field="reps" value="${escapeHtml(inst.prescribed.reps)}"></div>
        <div class="field"><label>${rirLabel}</label><input type="text" class="presc-input" data-field="rir" value="${escapeHtml(inst.prescribed.rir)}"></div>
      </div>
      <div class="field prescribed-note-field">
        <label>Hoca Notu</label>
        <input type="text" class="presc-input" data-field="coachNote" value="${escapeHtml(inst.prescribed.coachNote || '')}" placeholder="—">
      </div>
    </div>
    <div class="set-rows-mount"></div>
    <div class="status-row">
      <span class="status-row-label">Nasıl gitti?</span>
      <button type="button" class="status-btn status-btn-good${inst.status === 'good' ? ' active' : ''}" aria-label="İstenildiği gibi yaptım">✓</button>
      <button type="button" class="status-btn status-btn-bad${inst.status === 'bad' ? ' active' : ''}" aria-label="Yapamadım">▼</button>
      <button type="button" class="status-btn status-btn-neutral${inst.status === 'neutral' ? ' active' : ''}" aria-label="Fena değildi">−</button>
    </div>
    <button type="button" class="note-toggle">${inst.note ? '− Notu Gizle' : '+ Not Ekle'}</button>
    <textarea class="note-textarea" placeholder="Not..." style="display:${inst.note ? 'block' : 'none'}">${escapeHtml(inst.note)}</textarea>
  `;

  bodyEl.querySelectorAll('.presc-input').forEach((input) => {
    input.addEventListener('input', () => {
      const field = input.dataset.field;
      const value = field === 'setCount' ? (input.value ? Number(input.value) : '') : input.value;
      updateInstancePrescribed(entry.id, inst.id, field, value, true);
      mountSetRows();
    });
  });

  const goodBtn = bodyEl.querySelector('.status-btn-good');
  const badBtn = bodyEl.querySelector('.status-btn-bad');
  const neutralBtn = bodyEl.querySelector('.status-btn-neutral');
  function setStatus(status) {
    const next = inst.status === status ? null : status;
    inst.status = next;
    updateInstanceStatus(entry.id, inst.id, next);
    goodBtn.classList.toggle('active', next === 'good');
    badBtn.classList.toggle('active', next === 'bad');
    neutralBtn.classList.toggle('active', next === 'neutral');
    if (next !== null) onStatusSet();
  }
  goodBtn.addEventListener('click', () => setStatus('good'));
  badBtn.addEventListener('click', () => setStatus('bad'));
  neutralBtn.addEventListener('click', () => setStatus('neutral'));

  const noteToggle = bodyEl.querySelector('.note-toggle');
  const noteTextarea = bodyEl.querySelector('.note-textarea');
  noteToggle.addEventListener('click', () => {
    const showing = noteTextarea.style.display !== 'none';
    noteTextarea.style.display = showing ? 'none' : 'block';
    noteToggle.textContent = showing ? '+ Not Ekle' : '− Notu Gizle';
    if (!showing) noteTextarea.focus();
  });
  noteTextarea.addEventListener('input', () => {
    updateInstanceNote(entry.id, inst.id, noteTextarea.value);
  });

  const setRowsMount = bodyEl.querySelector('.set-rows-mount');
  function mountSetRows() {
    renderSetRows(setRowsMount, {
      dayId: entry.id, instId: inst.id, inst, isDuration,
      exerciseName: exercise ? exercise.name : '',
    });
  }
  mountSetRows();
}

function formatSetsSummary(actualSets, isDuration) {
  return actualSets.map((s) => `${s.weight || '-'}×${s.reps || '-'}${isDuration ? 'sn' : ''}`).join(', ');
}
