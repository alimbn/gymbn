import { escapeHtml, ICON_TRASH, ICON_MEDIA, EXERCISE_REGIONS } from '../util.js';
import { confirmSheet } from './confirmSheet.js';

export function renderLibraryList(container, { title, store, placeholder, backHref, showDurationToggle, showMediaEditor }) {
  container.innerHTML = `
    <div class="view-header">
      <a href="${backHref}" class="back-link" aria-label="Geri">←</a>
      <h2 class="view-title">${title}</h2>
      <span></span>
    </div>
    <form class="add-form" id="add-form">
      <input type="text" id="add-input" placeholder="${placeholder}" autocomplete="off">
      <button type="submit" class="btn btn-primary">Ekle</button>
    </form>
    <div class="list" id="list-root"></div>
  `;

  const listRoot = container.querySelector('#list-root');
  const addForm = container.querySelector('#add-form');
  const addInput = container.querySelector('#add-input');

  function renderItems() {
    const items = store.active();
    if (!items.length) {
      listRoot.innerHTML = '<p class="empty-state">Henüz eklenmedi.</p>';
      return;
    }
    listRoot.innerHTML = items.map((item) => `
      <div class="list-item" data-id="${item.id}">
        <div class="list-item-main">
          <span class="list-item-title view-mode">${escapeHtml(item.name)}</span>
          <input type="text" class="edit-input" style="display:none" value="${escapeHtml(item.name)}">
        </div>
        <div class="list-item-actions">
          ${showDurationToggle ? `<button type="button" class="btn-icon duration-toggle-btn${item.isDuration ? ' active' : ''}" aria-label="Süre-bazlı egzersiz" title="Süre-bazlı egzersiz">⏱</button>` : ''}
          ${showMediaEditor ? `<button type="button" class="btn-icon media-btn${(item.videoUrl || item.targetRegions?.length) ? ' active' : ''}" aria-label="Video ve hedef bölge" title="Video ve hedef bölge">${ICON_MEDIA}</button>` : ''}
          <button type="button" class="btn-icon edit-btn" aria-label="Düzenle">✎</button>
          <button type="button" class="btn-icon danger delete-btn" aria-label="Sil">${ICON_TRASH}</button>
        </div>
      </div>
    `).join('');
  }

  function enterEdit(row) {
    row.querySelector('.view-mode').style.display = 'none';
    const input = row.querySelector('.edit-input');
    input.style.display = '';
    input.focus();
    input.select();
  }

  function exitEdit(row, save) {
    const input = row.querySelector('.edit-input');
    const viewSpan = row.querySelector('.view-mode');
    if (save) {
      const name = input.value.trim();
      if (name) {
        store.rename(row.dataset.id, name);
        viewSpan.textContent = name;
      }
    } else {
      input.value = viewSpan.textContent;
    }
    input.style.display = 'none';
    viewSpan.style.display = '';
  }

  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = addInput.value.trim();
    if (!name) return;
    store.add(name);
    addInput.value = '';
    renderItems();
    addInput.focus();
  });

  listRoot.addEventListener('click', async (e) => {
    const row = e.target.closest('.list-item');
    if (!row) return;
    if (e.target.classList.contains('edit-btn')) {
      enterEdit(row);
    } else if (e.target.classList.contains('delete-btn')) {
      const name = row.querySelector('.view-mode').textContent;
      if (await confirmSheet(`"${name}" silinsin mi?`)) {
        store.archive(row.dataset.id);
        renderItems();
      }
    } else if (e.target.classList.contains('duration-toggle-btn')) {
      const item = store.byId(row.dataset.id);
      store.setDuration(row.dataset.id, !item.isDuration);
      renderItems();
    } else if (e.target.closest('.media-btn')) {
      openMediaSheet(store.byId(row.dataset.id));
    }
  });

  function openMediaSheet(item) {
    const selectedNames = new Set((item.targetRegions || []).map((r) => r.name));
    if (item.targetRegion) selectedNames.add(item.targetRegion); // eski tekil alan, göç

    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    backdrop.innerHTML = `
      <div class="sheet">
        <div class="sheet-title">${escapeHtml(item.name)}</div>
        <div class="sheet-sub">Video linki ve hedef bölge(ler) ekle</div>
        <div class="field">
          <label>Video linki</label>
          <input type="text" id="media-url" placeholder="https://..." value="${escapeHtml(item.videoUrl || '')}">
        </div>
        <div class="field" style="margin-bottom:0;">
          <label>Hedef bölge (birden fazla seçebilirsin)</label>
          <div class="region-grid" id="media-region-grid">
            ${EXERCISE_REGIONS.map((r) => (
              `<button type="button" class="region-chip${selectedNames.has(r.name) ? ' selected' : ''}" data-name="${escapeHtml(r.name)}" data-color="${r.color}">${escapeHtml(r.name)}</button>`
            )).join('')}
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-block" id="media-save">Kaydet</button>
      </div>
    `;
    document.body.appendChild(backdrop);

    backdrop.querySelectorAll('.region-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('selected');
      });
    });

    function close() { backdrop.remove(); }
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

    backdrop.querySelector('#media-save').addEventListener('click', () => {
      const videoUrl = backdrop.querySelector('#media-url').value.trim();
      const targetRegions = [...backdrop.querySelectorAll('.region-chip.selected')].map((chip) => ({
        name: chip.dataset.name,
        color: chip.dataset.color,
      }));
      store.setMedia(item.id, { videoUrl, targetRegions });
      close();
      renderItems();
    });
  }

  listRoot.addEventListener('keydown', (e) => {
    if (!e.target.classList.contains('edit-input')) return;
    const row = e.target.closest('.list-item');
    if (e.key === 'Enter') {
      e.preventDefault();
      exitEdit(row, true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      exitEdit(row, false);
    }
  });

  listRoot.addEventListener('focusout', (e) => {
    if (!e.target.classList.contains('edit-input')) return;
    const row = e.target.closest('.list-item');
    if (row && row.querySelector('.edit-input').style.display !== 'none') {
      exitEdit(row, true);
    }
  });

  renderItems();
}
