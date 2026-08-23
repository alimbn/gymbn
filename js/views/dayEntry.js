import {
  getDayEntryById, updateDayEntryField, deleteDayEntry,
  dayTypes, exercises, addExerciseInstance, removeExerciseInstance, updateInstancePrescribed,
  updateInstanceNote, updateInstanceStatus, getLastInstance,
} from '../storage.js';
import {
  dayOfWeekLabel, formatDateShortTr, escapeHtml, statusBadge, formatDuration, vibrate,
  ICON_TRASH, ICON_NOTE, ICON_COACH, isExerciseMediaEnabled, youTubeEmbedId,
} from '../util.js';
import { renderSetRows } from '../components/setRows.js';
import { openPicker } from '../components/picker.js';
import { confirmSheet } from '../components/confirmSheet.js';

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
      <button type="button" class="btn-icon danger" id="delete-day-btn" aria-label="Günü sil">${ICON_TRASH}</button>
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

    <div class="day-complete-wrap">
      <button type="button" class="btn btn-block day-complete-btn" id="complete-day-btn"></button>
      <span class="confetti-wrap" id="complete-confetti"></span>
    </div>
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
      vibrate(15);
      entry.workoutStartedAt = Date.now();
      updateDayEntryField(entry.id, 'workoutStartedAt', entry.workoutStartedAt, false);
      renderWorkoutTimer();
    });
  }
  renderWorkoutTimer();

  container.querySelector('#back-btn').addEventListener('click', () => {
    history.back();
  });

  container.querySelector('#delete-day-btn').addEventListener('click', async () => {
    const dt = entry.dayTypeId ? dayTypes.byId(entry.dayTypeId) : null;
    const label = [formatDateShortTr(entry.date), dt ? dt.name : null].filter(Boolean).join(' · ');
    if (await confirmSheet(`"${label}" antrenman günü tamamen silinecek (${entry.exercises.length} egzersiz dahil). Bu işlem geri alınamaz.`)) {
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

  // "Günü Tamamla"ya basınca (sadece tamamlanma yönünde, geri alırken değil) kısa
  // bir titreşim + zıplama + birkaç renkli noktanın merkezden dağılması — bu ekranın
  // en büyük anı olduğu için madde 1/2'deki küçük onay animasyonundan biraz daha vurgulu.
  function playCompleteCelebration() {
    vibrate([15, 50, 15]);
    completeBtn.classList.remove('just-completed');
    void completeBtn.offsetWidth; // reflow: art arda tamamla/geri al/tamamla'da animasyon her seferinde yeniden oynasın
    completeBtn.classList.add('just-completed');

    const confettiWrap = container.querySelector('#complete-confetti');
    confettiWrap.innerHTML = '';
    const colors = ['var(--success)', 'var(--primary)', 'var(--warning)'];
    const count = 8;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('span');
      dot.className = 'confetti-dot';
      const angle = (Math.PI * 2 * i) / count;
      const dist = 50 + Math.random() * 20;
      dot.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      dot.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      dot.style.background = colors[i % colors.length];
      confettiWrap.appendChild(dot);
      requestAnimationFrame(() => dot.classList.add('playing'));
    }
  }

  completeBtn.addEventListener('click', () => {
    entry.completed = !entry.completed;
    if (entry.completed && entry.workoutStartedAt && !entry.workoutDurationSec) {
      entry.workoutDurationSec = Math.round((Date.now() - entry.workoutStartedAt) / 1000);
      updateDayEntryField(entry.id, 'workoutDurationSec', entry.workoutDurationSec, false);
      renderWorkoutTimer();
    }
    updateDayEntryField(entry.id, 'completed', entry.completed, false);
    updateCompleteBtn();
    if (entry.completed) playCompleteCelebration();
  });

  // Accordion: only one exercise card expanded at a time, so mid-workout you can
  // focus on the one you're actually doing. Starts fully collapsed; adding a new
  // exercise focuses that one. Not persisted — purely a per-visit UI aid.
  let expandedInstId = null;
  // "Nasıl gitti?" ile az önce durumu değişen instance — SADECE bir sonraki
  // renderCards() çağrısında rozetin büyüyüp-çizilme animasyonunu tetiklemek için,
  // tek seferlik (renderCards her çalıştığında sıfırlanıyor).
  let justSetStatusInstId = null;

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
      const animateBadge = inst.id === justSetStatusInstId;
      cardsRoot.appendChild(buildExerciseCard(entry, inst, isExpanded, () => toggleExpand(inst.id), renderCards, () => advanceTo(idx), animateBadge));
    });
    justSetStatusInstId = null;
  }

  // "Nasıl gitti?" işaretlendiğinde bu kartı kapatıp bir sonraki egzersizi açar —
  // antrenman sırasında elle kapat/aç yapmadan sırayla ilerlemek için.
  function advanceTo(currentIdx) {
    const current = entry.exercises[currentIdx];
    justSetStatusInstId = current ? current.id : null;
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
      alert('Önce "Ayarlar > Egzersizler" ekranından en az bir egzersiz eklemelisin.');
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

function buildExerciseCard(entry, inst, isExpanded, onToggle, refreshCards, onStatusSet, animateBadge) {
  const card = document.createElement('div');
  card.className = 'exercise-card' + (isExpanded ? ' expanded' : ' collapsed') + (inst.status ? ' marked' : '');
  const exercise = exercises.byId(inst.exerciseId);
  const regionColorVal = exercise?.targetRegions?.[0]?.color;
  if (regionColorVal) card.style.setProperty('--region-color', regionColorVal);

  card.innerHTML = `
    <div class="exercise-card-header">
      <span class="accordion-chevron">${isExpanded ? '▾' : '▸'}</span>
      <span class="exercise-name">${escapeHtml(exercise ? exercise.name : '(silinmiş egzersiz)')}</span>
      ${(inst.note || inst.prescribed.coachNote) ? `<span class="note-indicator" aria-label="Not var">${ICON_NOTE}</span>` : ''}
      <span class="exercise-status-icon">${statusBadge(inst.status, animateBadge)}</span>
      <button type="button" class="btn-icon danger remove-exercise-btn" aria-label="Egzersizi sil">${ICON_TRASH}</button>
    </div>
    <div class="exercise-card-body"></div>
  `;

  card.querySelector('.exercise-card-header').addEventListener('click', () => onToggle());

  card.querySelector('.remove-exercise-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const name = exercise ? exercise.name : 'Bu egzersiz';
    if (await confirmSheet(`"${name}" bugünün antrenmanından silinsin mi?`)) {
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
  const showMedia = isExerciseMediaEnabled() && exercise && (exercise.targetRegions?.length || exercise.videoUrl);
  const ytId = exercise && exercise.videoUrl ? youTubeEmbedId(exercise.videoUrl) : null;

  bodyEl.innerHTML = `
    ${showMedia ? `
    <div class="exercise-media-row">
      <div class="target-pill-row">
        ${(exercise.targetRegions || []).map((r) => `<span class="target-pill"><span class="dot" style="--pill-color:${r.color}"></span>${escapeHtml(r.name)}</span>`).join('')}
      </div>
      ${exercise.videoUrl ? '<button type="button" class="video-toggle-btn">▶ Hareketi Gör</button>' : ''}
    </div>
    ${exercise.videoUrl ? `
    <div class="video-embed-frame">
      ${ytId ? `
      <div class="video-embed-thumb youtube-thumb" data-yt-id="${ytId}">
        <span class="video-play-btn"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M9 7.5v9l7-4.5-7-4.5Z"/></svg></span>
      </div>` : `
      <a class="video-embed-thumb" href="${escapeHtml(exercise.videoUrl)}" target="_blank" rel="noopener">
        <span class="video-play-btn"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M9 7.5v9l7-4.5-7-4.5Z"/></svg></span>
      </a>`}
      <div class="video-embed-caption">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 15l6-6M10.5 8H15v4.5M6 12l-2 2a3 3 0 104 4l2-2"/></svg>
        <span>${escapeHtml(exercise.videoUrl)}</span>
      </div>
    </div>` : ''}
    ` : ''}
    <div class="last-time">${last ? `Son sefer (${formatDateShortTr(last.date)}): ${formatSetsSummary(last.actualSets, isDuration)}` : 'İlk kez yapılıyor.'}</div>
    <div class="prescribed-block">
      <div class="block-label">${ICON_COACH}Hoca</div>
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
    if (next !== null) {
      vibrate(15);
      onStatusSet();
    }
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

  const videoToggle = bodyEl.querySelector('.video-toggle-btn');
  if (videoToggle) {
    const frame = bodyEl.querySelector('.video-embed-frame');
    videoToggle.addEventListener('click', () => {
      const open = frame.classList.toggle('open');
      videoToggle.textContent = open ? '▾ Hareketi Gizle' : '▶ Hareketi Gör';
    });
  }

  const youtubeThumb = bodyEl.querySelector('.youtube-thumb');
  if (youtubeThumb) {
    youtubeThumb.addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.className = 'video-embed-iframe';
      iframe.src = `https://www.youtube-nocookie.com/embed/${youtubeThumb.dataset.ytId}?autoplay=1`;
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      iframe.setAttribute('allowfullscreen', '');
      youtubeThumb.replaceWith(iframe);
    }, { once: true });
  }

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
