import { addActualSet, removeActualSet, updateActualSetField } from '../storage.js';
import { escapeHtml } from '../util.js';
import { openCountdown } from './countdownTimer.js';

const WEIGHT_STEP = 2.5;
const DURATION_STEP = 5;
const NUMBER_FIELD_MAX = { reps: 30, rir: 9 };
const NUMBER_FIELD_LABEL = { reps: 'Tekrar', rir: 'Rir' };

// Hocanın prescribed metninden 1-2 hedef sayı çıkarır — "3-4" gibi bir aralıksa
// İKİSİNİ de döner (extractLeadingInt sadece ilkini alırdı, "4" sessizce kaybolurdu).
function extractIntRange(str) {
  const match = String(str ?? '').match(/(\d+)(?:-(\d+))?/);
  if (!match) return [];
  const low = parseInt(match[1], 10);
  const high = match[2] ? parseInt(match[2], 10) : low;
  return low === high ? [low] : [low, high];
}

// Tüm setler her zaman açık/düzenlenebilir kalıyor (kullanıcı canlı testte
// akordiyon/gizleme hâlini UX düşüşü olarak değerlendirdi) — sadece hangi setle
// uğraştığını amber sol ray + kendi zemini işaretliyor. Bir sete dokunmak
// (herhangi bir alanına) o seti aktif işaretliyor; RIR alanına dokunmak AYRICA
// bir sonraki bitmemiş sete ilerletiyor (rir genelde bir setin en son kontrol
// edilen değeri, doğal bir "artık ilerle" sinyali).
export function renderSetRows(container, { dayId, instId, inst, isDuration, exerciseName }) {
  let activeIndex = firstIncompleteIndex();
  renderAll();

  function firstIncompleteIndex() {
    const idx = inst.actualSets.findIndex((s) => !s.touched);
    return idx === -1 ? null : idx;
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

  // Tam yeniden render etmeden sadece "active" sınıfını taşımak — bir input'a
  // yazarken satır aktifleşip renderAll tetiklerse odak/imleç kaybolurdu.
  function activate(idx) {
    if (activeIndex === idx) return;
    activeIndex = idx;
    container.querySelectorAll('.set-row').forEach((r) => {
      r.classList.toggle('active', Number(r.dataset.setIndex) === idx);
    });
  }

  function buildRow(set, idx) {
    const row = document.createElement('div');
    row.className = 'set-row' + (set.touched ? '' : ' suggested') + (idx === activeIndex ? ' active' : '');
    row.dataset.setIndex = String(idx);

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
    row.addEventListener('click', () => activate(idx));
    wireRow(row);
    return row;
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

  // 0, ana ızgaradan ayrı kendi geniş butonunda duruyor (özellikle Rir'de sık
  // seçilen bir değer — "failure'a kadar gittim" — gizli kalmasın diye), ızgara
  // 1'den başlayınca satırlar doğal 5'li gruplara oturuyor (1-5, 6-10, 11-15...).
  // `targets` (hocanın prescribed değerinden çıkarılan 1-2 hedef sayı — "3-4" gibi
  // bir aralıksa İKİSİ de) seçili değerden farklıysa, kesikli çerçeveyle işaretleniyor.
  function openNumberPicker({ title, max, current, targets, onSelect }) {
    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    let cells = '';
    for (let i = 1; i <= max; i++) {
      const classes = ['number-picker-cell'];
      if (i === current) classes.push('selected');
      if (targets.includes(i) && i !== current) classes.push('target');
      cells += `<button type="button" class="${classes.join(' ')}" data-value="${i}">${i}</button>`;
    }
    const zeroClasses = ['zero-btn'];
    if (current === 0) zeroClasses.push('selected');
    if (targets.includes(0) && current !== 0) zeroClasses.push('target');
    backdrop.innerHTML = `
      <div class="sheet">
        <div class="sheet-title">${escapeHtml(title)}</div>
        <button type="button" class="${zeroClasses.join(' ')}" data-value="0">0</button>
        <hr class="zero-divider">
        <div class="number-picker-grid">${cells}</div>
        <button type="button" class="btn btn-block sheet-close">Kapat</button>
      </div>
    `;
    document.body.appendChild(backdrop);

    function close() {
      backdrop.remove();
    }

    function handlePick(e) {
      const cell = e.target.closest('.number-picker-cell, .zero-btn');
      if (!cell) return;
      onSelect(Number(cell.dataset.value));
      close();
    }
    backdrop.querySelector('.number-picker-grid').addEventListener('click', handlePick);
    backdrop.querySelector('.zero-btn').addEventListener('click', handlePick);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
    backdrop.querySelector('.sheet-close').addEventListener('click', close);

    const selectedEl = backdrop.querySelector('.number-picker-cell.selected');
    if (selectedEl) selectedEl.scrollIntoView({ block: 'center' });
  }

  function advanceAfterRir(idx) {
    const next = inst.actualSets.findIndex((s, i) => i > idx && !s.touched);
    activate(next === -1 ? null : next);
  }

  function wireRow(row) {
    const setIndex = Number(row.dataset.setIndex);

    row.querySelector('.set-row-remove').addEventListener('click', () => {
      removeActualSet(dayId, instId, setIndex);
      activeIndex = firstIncompleteIndex();
      renderAll();
    });

    // Ağırlık her zaman, süre/rezerv sadece isDuration'da bir stepper — hepsi aynı
    // jenerik döngüyle kabloanıyor, adım büyüklüğü data-step'ten okunuyor.
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
      btn.addEventListener('click', () => {
        const field = btn.dataset.field;
        const current = parseInt(btn.textContent, 10);
        const targets = extractIntRange(inst.prescribed[field]);
        openNumberPicker({
          title: NUMBER_FIELD_LABEL[field],
          max: NUMBER_FIELD_MAX[field],
          current: isNaN(current) ? -1 : current,
          targets,
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
