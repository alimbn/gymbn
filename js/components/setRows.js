import { addActualSet, removeActualSet, updateActualSetField } from '../storage.js';
import { escapeHtml } from '../util.js';
import { openCountdown } from './countdownTimer.js';

const WEIGHT_STEP = 2.5;
const DURATION_STEP = 5;
const NUMBER_FIELD_MAX = { reps: 30, rir: 9 };
const NUMBER_FIELD_LABEL = { reps: 'Tekrar', rir: 'Rir' };

// Set satırları egzersiz kartlarındaki akordiyonun bir seviye içerisi: aynı anda
// sadece ÇALIŞILAN set açık (amber sol ray + kendi zemini), diğerleri (bitmiş ya
// da henüz sırası gelmemiş fark etmez) tek satırlık özete iniyor. "Bu seti
// bitirdim" sinyali RIR alanına dokunmak — gerçek antrenmanda da rir genelde bir
// setin en son kontrol edilen değeri olduğu için doğal bir "artık ilerle" anı.
export function renderSetRows(container, { dayId, instId, inst, isDuration, exerciseName }) {
  let activeIndex = firstIncompleteIndex();
  renderAll();

  // -1 = hiçbiri aktif değil (hepsi tamamsa hepsi kapalı/özet başlar, bir
  // egzersiz kartını tekrar açıp gözden geçirirken tümünü derli toplu görmek
  // için — istenilen satıra dokunup yine düzenlenebiliyor).
  function firstIncompleteIndex() {
    return inst.actualSets.findIndex((s) => !s.touched);
  }

  function renderAll() {
    container.innerHTML = `
      <div class="set-rows">
        <div class="block-label">Yapılan (Actual)</div>
        <div class="set-rows-list"></div>
        <button type="button" class="add-set-btn">+ Set Ekle</button>
      </div>
    `;
    const list = container.querySelector('.set-rows-list');
    inst.actualSets.forEach((set, idx) => list.appendChild(buildRow(set, idx)));
    container.querySelector('.add-set-btn').addEventListener('click', () => {
      addActualSet(dayId, instId);
      activeIndex = inst.actualSets.length - 1;
      renderAll();
    });
  }

  function activate(idx) {
    activeIndex = idx;
    renderAll();
  }

  function buildRow(set, idx) {
    const row = document.createElement('div');
    const isActive = idx === activeIndex;
    row.className = 'set-row' + (set.touched ? '' : ' suggested') + (isActive ? ' active' : ' collapsed');
    row.dataset.setIndex = String(idx);

    if (!isActive) {
      row.innerHTML = buildSummary(set, idx, isDuration);
      row.addEventListener('click', () => activate(idx));
      return row;
    }

    const bottomFields = isDuration
      ? buildLabeledStepper('reps', set.reps, { step: DURATION_STEP, unit: 'sn', label: 'Süre', withTimer: true })
        + buildLabeledStepper('rir', set.rir, { step: DURATION_STEP, unit: 'sn', label: 'Rezerv' })
      : `<div class="set-row-bottom">
          ${buildNumberField('reps', set.reps)}
          ${buildNumberField('rir', set.rir)}
        </div>`;
    row.innerHTML = `
      <div class="set-row-head">
        <span class="set-row-label">Set ${idx + 1}</span>
        <button type="button" class="btn-icon danger set-row-remove" aria-label="Seti sil">×</button>
      </div>
      ${buildWeightStepper(set.weight)}
      ${bottomFields}
    `;
    wireRow(row);
    return row;
  }

  function buildSummary(set, idx, isDurationRow) {
    return `
      <div class="set-row-summary">
        <span class="set-row-summary-set">Set ${idx + 1}</span>
        <span class="set-row-summary-val">${escapeHtml(formatRowSummary(set, isDurationRow))}</span>
        ${set.touched ? '<span class="set-row-summary-check">✓</span>' : ''}
      </div>
    `;
  }

  function formatRowSummary(set, isDurationRow) {
    const parts = [];
    if (set.weight) parts.push(`${set.weight}kg`);
    if (isDurationRow) {
      parts.push(`${set.reps || '-'}sn`);
      if (set.rir) parts.push(`rezerv ${set.rir}sn`);
    } else {
      parts.push(`× ${set.reps || '-'}`);
      if (set.rir) parts.push(`rir ${set.rir}`);
    }
    return parts.join(' ');
  }

  function buildWeightStepper(value) {
    return buildStepper('weight', value, { step: WEIGHT_STEP, unit: 'kg' });
  }

  function buildLabeledStepper(field, value, { step, unit, label, withTimer }) {
    return `
      <div class="stepper-group">
        <label>${label}${withTimer ? ' <button type="button" class="countdown-trigger-btn" data-field="' + field + '" aria-label="Geri sayımı başlat">▶</button>' : ''}</label>
        ${buildStepper(field, value, { step, unit })}
      </div>
    `;
  }

  function buildStepper(field, value, { step, unit }) {
    return `
      <div class="stepper" data-field="${field}" data-step="${step}">
        <button type="button" class="stepper-btn" data-action="dec" aria-label="Azalt">−</button>
        <input type="text" class="set-field stepper-input" data-field="${field}" value="${escapeHtml(value ?? '')}">
        <span class="stepper-unit">${unit}</span>
        <button type="button" class="stepper-btn" data-action="inc" aria-label="Artır">+</button>
      </div>
    `;
  }

  function buildNumberField(field, value) {
    return `
      <div class="number-field number-field-${field}">
        <label>${NUMBER_FIELD_LABEL[field]}</label>
        <button type="button" class="set-field number-picker-trigger" data-field="${field}">${escapeHtml(value ?? '0')}</button>
      </div>
    `;
  }

  function openNumberPicker({ title, max, current, onSelect }) {
    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    let cells = '';
    for (let i = 0; i <= max; i++) {
      cells += `<button type="button" class="number-picker-cell${i === current ? ' selected' : ''}" data-value="${i}">${i}</button>`;
    }
    backdrop.innerHTML = `
      <div class="sheet">
        <div class="sheet-title">${escapeHtml(title)}</div>
        <div class="number-picker-grid">${cells}</div>
        <button type="button" class="btn btn-block sheet-close">Kapat</button>
      </div>
    `;
    document.body.appendChild(backdrop);

    function close() {
      backdrop.remove();
    }

    backdrop.querySelector('.number-picker-grid').addEventListener('click', (e) => {
      const cell = e.target.closest('.number-picker-cell');
      if (!cell) return;
      onSelect(Number(cell.dataset.value));
      close();
    });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
    backdrop.querySelector('.sheet-close').addEventListener('click', close);

    const selectedEl = backdrop.querySelector('.number-picker-cell.selected');
    if (selectedEl) selectedEl.scrollIntoView({ block: 'center' });
  }

  // Bir sete "bitti, ilerle" demenin sinyali: rir (ya da süre-tipinde rezerv)
  // alanına dokunmak — gerçek antrenumda da rir genelde bir setin son kontrol
  // edilen değeri. Ağırlık/tekrar'a dokunmak SADECE değeri günceller, hiç
  // ilerletmiyor — kullanıcı hâlâ o setle uğraşıyor olabilir, erken kapatmıyoruz.
  function advanceAfterRir(idx) {
    const next = inst.actualSets.findIndex((s, i) => i > idx && !s.touched);
    activate(next); // bulunamazsa -1: son setse egzersiz kartı akordiyonundaki gibi sadece kapanır
  }

  function wireRow(row) {
    const setIndex = Number(row.dataset.setIndex);

    row.querySelector('.set-row-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeActualSet(dayId, instId, setIndex);
      activeIndex = firstIncompleteIndex();
      renderAll();
    });

    row.querySelectorAll('.stepper').forEach((stepperEl) => {
      const field = stepperEl.dataset.field;
      const step = parseFloat(stepperEl.dataset.step);
      const input = stepperEl.querySelector('.stepper-input');
      input.addEventListener('focus', () => input.select());
      input.addEventListener('input', () => {
        updateActualSetField(dayId, instId, setIndex, field, input.value, true);
        row.classList.remove('suggested');
        if (field === 'rir') advanceAfterRir(setIndex);
      });
      stepperEl.querySelectorAll('.stepper-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const current = parseFloat(input.value);
          const base = isNaN(current) ? 0 : current;
          const dir = btn.dataset.action === 'inc' ? 1 : -1;
          const next = Math.max(0, Math.round((base + dir * step) * 100) / 100);
          input.value = String(next);
          updateActualSetField(dayId, instId, setIndex, field, input.value, false);
          row.classList.remove('suggested');
          if (field === 'rir') advanceAfterRir(setIndex);
        });
      });
    });

    const countdownBtn = row.querySelector('.countdown-trigger-btn');
    if (countdownBtn) {
      countdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const durationInput = row.querySelector('.stepper-input[data-field="' + countdownBtn.dataset.field + '"]');
        openCountdown({ targetSeconds: parseFloat(durationInput.value), label: exerciseName });
      });
    }

    row.querySelectorAll('.number-picker-trigger').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const field = btn.dataset.field;
        const current = parseInt(btn.textContent, 10);
        openNumberPicker({
          title: NUMBER_FIELD_LABEL[field],
          max: NUMBER_FIELD_MAX[field],
          current: isNaN(current) ? -1 : current,
          onSelect: (value) => {
            btn.textContent = String(value);
            updateActualSetField(dayId, instId, setIndex, field, String(value), false);
            row.classList.remove('suggested');
            if (field === 'rir') advanceAfterRir(setIndex);
          },
        });
      });
    });
  }
}
