import { addActualSet, removeActualSet, updateActualSetField } from '../storage.js';
import { escapeHtml } from '../util.js';

const WEIGHT_STEP = 2.5;
const DURATION_STEP = 5;
const NUMBER_FIELD_MAX = { reps: 30, rir: 9 };
const NUMBER_FIELD_LABEL = { reps: 'Tekrar', rir: 'Rir' };

export function renderSetRows(container, { dayId, instId, inst, isDuration }) {
  renderAll();

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
      renderAll();
    });
  }

  function buildRow(set, idx) {
    const row = document.createElement('div');
    row.className = 'set-row' + (set.touched ? '' : ' suggested');
    row.dataset.setIndex = String(idx);
    const bottomFields = isDuration
      ? buildLabeledStepper('reps', set.reps, { step: DURATION_STEP, unit: 'sn', label: 'Süre' })
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

  function buildWeightStepper(value) {
    return buildStepper('weight', value, { step: WEIGHT_STEP, unit: 'kg' });
  }

  function buildLabeledStepper(field, value, { step, unit, label }) {
    return `
      <div class="stepper-group">
        <label>${label}</label>
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

  function wireRow(row) {
    const setIndex = Number(row.dataset.setIndex);

    row.querySelector('.set-row-remove').addEventListener('click', () => {
      removeActualSet(dayId, instId, setIndex);
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
        syncLaterRows(setIndex);
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
          syncLaterRows(setIndex);
        });
      });
    });

    row.querySelectorAll('.number-picker-trigger').forEach((btn) => {
      btn.addEventListener('click', () => {
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
            syncLaterRows(setIndex);
          },
        });
      });
    });
  }

  function syncLaterRows(fromIndex) {
    const rowEls = container.querySelectorAll('.set-row');
    inst.actualSets.forEach((set, idx) => {
      if (idx <= fromIndex || set.touched) return;
      const rowEl = rowEls[idx];
      if (!rowEl) return;
      rowEl.querySelectorAll('.set-field').forEach((el) => {
        if (document.activeElement === el) return;
        const val = set[el.dataset.field];
        if (el.tagName === 'BUTTON') el.textContent = val;
        else el.value = val;
      });
    });
  }
}
