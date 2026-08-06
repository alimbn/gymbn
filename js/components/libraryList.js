import { escapeHtml } from '../util.js';

export function renderLibraryList(container, { title, store, placeholder, backHref }) {
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
          <button type="button" class="btn-icon edit-btn" aria-label="Düzenle">✎</button>
          <button type="button" class="btn-icon danger delete-btn" aria-label="Sil">🗑</button>
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

  listRoot.addEventListener('click', (e) => {
    const row = e.target.closest('.list-item');
    if (!row) return;
    if (e.target.classList.contains('edit-btn')) {
      enterEdit(row);
    } else if (e.target.classList.contains('delete-btn')) {
      const name = row.querySelector('.view-mode').textContent;
      if (confirm(`"${name}" silinsin mi?`)) {
        store.archive(row.dataset.id);
        renderItems();
      }
    }
  });

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
