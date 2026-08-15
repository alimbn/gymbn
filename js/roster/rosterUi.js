import { escapeHtml, ICON_TRASH } from '../util.js';
import { confirmSheet } from '../components/confirmSheet.js';

// libraryList.js'in .list/.list-item görsel dilini paylaşıyor ama roster'a özgü
// üç farkı karşılıyor: veri asenkron (Firestore), satırlar tıklanabilir link
// olabiliyor (öğrenci → program atama), ve "davet oluştur" akışı (link üretip
// göstermek + bekleyen davetleri listelemek) var. libraryList.js'in kendisi
// senkron store.active() varsayıyor, bu yüzden doğrudan kullanılamadı.
// container'ı zaten SAHİPLENMİŞ bir yer varsayar — üstteki başlık/geri/çıkış
// gibi sayfaya özgü header'ı çağıran kendi çiziyor (admin.html'de "back" hiç
// anlamlı değil, coach.html'de öğrenci satırına tıklanınca gidilecek yer farklı
// olduğu için bu kısım kasıtlı olarak burada değil).
export async function renderRosterScreen(container, config) {
  const {
    addPlaceholder, addButtonLabel = 'Davet Oluştur',
    loadItems, loadPendingInvites, onAdd, onCancelInvite,
    emptyText = 'Henüz eklenmedi.', statLabel, extraStats,
  } = config;

  container.innerHTML = `
    <div class="stat-strip" id="roster-stat-strip"></div>
    <form class="add-form" id="roster-add-form">
      <input type="text" id="roster-add-input" placeholder="${escapeHtml(addPlaceholder)}" autocomplete="off">
      <button type="submit" class="btn btn-primary">${escapeHtml(addButtonLabel)}</button>
    </form>
    <div class="search-hint" id="roster-search-hint"></div>
    <div id="roster-invite-panel"></div>
    <div id="roster-pending-root"></div>
    <div class="list" id="roster-list-root"><p class="empty-state">Yükleniyor…</p></div>
  `;

  const addForm = container.querySelector('#roster-add-form');
  const addInput = container.querySelector('#roster-add-input');
  const invitePanel = container.querySelector('#roster-invite-panel');
  const pendingRoot = container.querySelector('#roster-pending-root');
  const listRoot = container.querySelector('#roster-list-root');
  const statStrip = container.querySelector('#roster-stat-strip');
  const searchHint = container.querySelector('#roster-search-hint');

  function renderInvitePanel(link) {
    invitePanel.innerHTML = `
      <div class="card invite-link-card">
        <p class="muted">Davet linki oluşturuldu, kopyala ve gönder:</p>
        <div class="invite-link-row">
          <input type="text" readonly value="${escapeHtml(link)}" class="invite-link-input" id="invite-link-input">
          <button type="button" class="btn btn-primary invite-copy-btn">Kopyala</button>
        </div>
      </div>
    `;
    invitePanel.querySelector('.invite-copy-btn').addEventListener('click', () => copyLink(link));
  }

  async function copyLink(link) {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const input = invitePanel.querySelector('#invite-link-input');
      if (input) { input.focus(); input.select(); }
    }
  }

  function renderPending(invites) {
    if (!invites.length) {
      pendingRoot.innerHTML = '';
      return;
    }
    pendingRoot.innerHTML = `
      <div class="roster-pending-section">
        <div class="list-item-sub roster-pending-heading">Bekleyen Davetler</div>
        <div class="list">
          ${invites.map((inv) => `
            <div class="list-item" data-invite-id="${escapeHtml(inv.id)}">
              <div class="list-item-main">
                <span class="list-item-title">${escapeHtml(inv.displayName)}</span>
                <div class="list-item-sub">Bekliyor</div>
              </div>
              <div class="list-item-actions">
                <button type="button" class="btn-icon invite-copy-again-btn" aria-label="Linki kopyala" title="Linki kopyala">⧉</button>
                ${onCancelInvite ? `<button type="button" class="btn-icon danger invite-cancel-btn" aria-label="İptal et">${ICON_TRASH}</button>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    pendingRoot.querySelectorAll('.list-item').forEach((row, i) => {
      row.querySelector('.invite-copy-again-btn').addEventListener('click', () => copyLink(invites[i].link));
      const cancelBtn = row.querySelector('.invite-cancel-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
          if (!(await confirmSheet(`"${invites[i].displayName}" daveti iptal edilsin mi?`, { confirmLabel: 'İptal Et' }))) return;
          cancelBtn.disabled = true;
          try {
            await onCancelInvite(invites[i].id);
            await reload();
          } catch (err) {
            console.error('Davet iptal edilemedi', err);
            alert('Davet iptal edilemedi, tekrar dene.');
            cancelBtn.disabled = false;
          }
        });
      }
    });
  }

  function renderList(items) {
    if (!items.length) {
      listRoot.innerHTML = `<p class="empty-state">${escapeHtml(emptyText)}</p>`;
      return;
    }
    listRoot.innerHTML = items.map((item) => {
      const tag = item.href ? 'a' : 'div';
      const hrefAttr = item.href ? ` href="${item.href}"` : '';
      return `
        <${tag} class="list-item"${hrefAttr} data-id="${escapeHtml(item.id)}">
          <div class="list-item-main">
            <span class="list-item-title">${escapeHtml(item.title)}</span>
            ${item.subtitle ? `<div class="list-item-sub">${escapeHtml(item.subtitle)}</div>` : ''}
          </div>
          ${item.badge ? `<span class="badge ${escapeHtml(item.badge.className || '')}">${escapeHtml(item.badge.text)}</span>` : ''}
        </${tag}>
      `;
    }).join('');
  }

  // İstatistik şeridi: sayım taşı + (varsa) ekran-özel ek taşlar (ör. roster'da
  // "N Gecikmiş" — admin'in hoca listesinde bu kavram yok, extraStats verilmezse
  // hiç eklenmiyor, şerit tek taşta kalıyor).
  function renderStatStrip(count, items) {
    if (!statLabel) return;
    const tiles = [`
      <div class="stat-tile">
        <div class="stat-tile-value">${count}</div>
        <div class="stat-tile-label">${escapeHtml(statLabel)}</div>
      </div>
    `];
    if (extraStats) {
      extraStats(items).forEach((s) => {
        tiles.push(`
          <div class="stat-tile${s.warn ? ' warn' : ''}">
            <div class="stat-tile-value">${s.value}</div>
            <div class="stat-tile-label">${escapeHtml(s.label)}</div>
          </div>
        `);
      });
    }
    statStrip.innerHTML = tiles.join('');
  }

  // "Öğrenci/Hoca adı" kutusu iki iş görüyor: normal submit'te yeni davet oluşturur,
  // yazarken de aşağıdaki listeyi (hem eklenmiş hem bekleyen) anlık filtreler — datatable
  // arama mantığı. Sıfır eşleşmede "davet et" ipucu göstererek arama mı yeni ekleme mi
  // yaptığı karışmasın diye.
  function rowMatches(row, q) {
    const title = row.querySelector('.list-item-title');
    return !q || (title && title.textContent.toLocaleLowerCase('tr').includes(q));
  }

  function applyFilter() {
    const q = addInput.value.trim().toLocaleLowerCase('tr');
    let listVisible = 0;
    listRoot.querySelectorAll('.list-item').forEach((row) => {
      const match = rowMatches(row, q);
      row.classList.toggle('hidden-by-filter', !match);
      if (match) listVisible++;
    });
    let pendingVisible = 0;
    pendingRoot.querySelectorAll('.list-item').forEach((row) => {
      const match = rowMatches(row, q);
      row.classList.toggle('hidden-by-filter', !match);
      if (match) pendingVisible++;
    });
    const pendingSection = pendingRoot.querySelector('.roster-pending-section');
    if (pendingSection) pendingSection.style.display = pendingVisible ? '' : 'none';

    if (!q) {
      searchHint.textContent = '';
      searchHint.classList.remove('active');
    } else if (listVisible + pendingVisible === 0) {
      searchHint.textContent = `Bu isimde kimse yok — eklemek için "${addForm.querySelector('button').textContent}"e dokun.`;
      searchHint.classList.add('active');
    } else {
      searchHint.textContent = `${listVisible + pendingVisible} eşleşme.`;
      searchHint.classList.remove('active');
    }
  }
  addInput.addEventListener('input', applyFilter);

  async function reload() {
    invitePanel.innerHTML = '';
    const [items, invites] = await Promise.all([loadItems(), loadPendingInvites()]);
    renderList(items);
    renderPending(invites);
    renderStatStrip(items.length, items);
    applyFilter();
  }

  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = addInput.value.trim();
    if (!name) return;
    const submitBtn = addForm.querySelector('button');
    submitBtn.disabled = true;
    try {
      const { link } = await onAdd(name);
      addInput.value = '';
      renderInvitePanel(link);
      await reload();
    } catch (err) {
      console.error('Davet oluşturulamadı', err);
      alert('Davet oluşturulamadı, tekrar dene.');
    } finally {
      submitBtn.disabled = false;
    }
  });

  try {
    await reload();
  } catch (err) {
    console.error('Liste yüklenemedi', err);
    listRoot.innerHTML = '<p class="empty-state">Liste yüklenemedi, sayfayı yenile.</p>';
  }
}
