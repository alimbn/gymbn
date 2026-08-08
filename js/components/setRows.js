import { addActualSet, removeActualSet, updateActualSetField } from '../storage.js';
import { escapeHtml } from '../util.js';

const WEIGHT_STEP = 2.5;
const NUMBER_FIELD_MAX = { reps: 30, rir: 9 };
const NUMBER_FIELD_LABEL = { reps: 'Tekrar', rir: 'Rir' };

export function renderSetRows(container, { dayId, instId, inst }) {
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
    row.innerHTML = `
      <div class="set-row-head">
        <span class="set-row-label">Set ${idx + 1}</span>
        <button type="button" class="btn-icon danger set-row-remove" aria-label="Seti sil">×</button>
      </div>
      ${buildWeightStepper(set.weight)}
      <div class="set-row-bottom">
        ${buildNumberField('reps', set.reps)}
        ${buildNumberField('rir', set.rir)}
      </div>
    `;
    wireRow(row);
    return row;
  }

  function buildWeightStepper(value) {
    return `
      <div class="stepper" data-field="weight">
        <button type="button" class="stepper-btn" data-action="dec" aria-label="Azalt">−</button>
        <input type="text" class="set-field stepper-input" data-field="weight" value="${escapeHtml(value ?? '')}">
        <span class="stepper-unit">kg</span>
        <button type="button" class="stepper-btn" data-action="inc" aria-label="Artır">+</button>
      </div>
    `;
  }

  function buildNumberField(field, value) {
    const current = parseInt(value, 10);
    let options = '';
    for (let i = 0; i <= NUMBER_FIELD_MAX[field]; i++) {
      options += `<option value="${i}"${i === current ? ' selected' : ''}>${i}</option>`;
    }
    return `
      <div class="number-field number-field-${field}">
        <label>${NUMBER_FIELD_LABEL[field]}</label>
        <select class="set-field number-select" data-field="${field}">${options}</select>
      </div>
    `;
  }

  function wireRow(row) {
    const setIndex = Number(row.dataset.setIndex);

    row.querySelector('.set-row-remove').addEventListener('click', () => {
      removeActualSet(dayId, instId, setIndex);
      renderAll();
    });

    const weightInput = row.querySelector('.stepper-input[data-field="weight"]');
    weightInput.addEventListener('focus', () => weightInput.select());
    weightInput.addEventListener('input', () => {
      updateActualSetField(dayId, instId, setIndex, 'weight', weightInput.value, true);
      row.classList.remove('suggested');
      syncLaterRows(setIndex);
    });
    row.querySelector('.stepper[data-field="weight"]').querySelectorAll('.stepper-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const current = parseFloat(weightInput.value);
        const base = isNaN(current) ? 0 : current;
        const dir = btn.dataset.action === 'inc' ? 1 : -1;
        const next = Math.max(0, Math.round((base + dir * WEIGHT_STEP) * 100) / 100);
        weightInput.value = String(next);
        updateActualSetField(dayId, instId, setIndex, 'weight', weightInput.value, false);
        row.classList.remove('suggested');
        syncLaterRows(setIndex);
      });
    });

    row.querySelectorAll('.number-select').forEach((select) => {
      select.addEventListener('change', () => {
        const field = select.dataset.field;
        updateActualSetField(dayId, instId, setIndex, field, select.value, false);
        row.classList.remove('suggested');
        syncLaterRows(setIndex);
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
        el.value = set[el.dataset.field];
      });
    });
  }
}
