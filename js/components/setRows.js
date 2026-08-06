import { addActualSet, removeActualSet, updateActualSetField } from '../storage.js';
import { escapeHtml } from '../util.js';

const STEPS = { weight: 2.5, reps: 1, rir: 1 };
const UNITS = { weight: 'kg', reps: 'tekrar', rir: 'rir' };

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
      ${buildStepper('weight', set.weight)}
      <div class="set-row-bottom">
        ${buildStepper('reps', set.reps)}
        ${buildStepper('rir', set.rir)}
      </div>
    `;
    wireRow(row);
    return row;
  }

  function buildStepper(field, value) {
    return `
      <div class="stepper" data-field="${field}">
        <button type="button" class="stepper-btn" data-action="dec" aria-label="Azalt">−</button>
        <input type="text" class="stepper-input" data-field="${field}" value="${escapeHtml(value ?? '')}">
        <span class="stepper-unit">${UNITS[field]}</span>
        <button type="button" class="stepper-btn" data-action="inc" aria-label="Artır">+</button>
      </div>
    `;
  }

  function wireRow(row) {
    const setIndex = Number(row.dataset.setIndex);

    row.querySelector('.set-row-remove').addEventListener('click', () => {
      removeActualSet(dayId, instId, setIndex);
      renderAll();
    });

    row.querySelectorAll('.stepper').forEach((stepperEl) => {
      const field = stepperEl.dataset.field;
      const input = stepperEl.querySelector('.stepper-input');

      input.addEventListener('focus', () => input.select());

      input.addEventListener('input', () => {
        updateActualSetField(dayId, instId, setIndex, field, input.value, true);
        row.classList.remove('suggested');
        syncLaterRows(setIndex);
      });

      stepperEl.querySelectorAll('.stepper-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const step = STEPS[field];
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
  }

  function syncLaterRows(fromIndex) {
    const rowEls = container.querySelectorAll('.set-row');
    inst.actualSets.forEach((set, idx) => {
      if (idx <= fromIndex || set.touched) return;
      const rowEl = rowEls[idx];
      if (!rowEl) return;
      rowEl.querySelectorAll('.stepper-input').forEach((inp) => {
        if (document.activeElement === inp) return;
        inp.value = set[inp.dataset.field];
      });
    });
  }
}
