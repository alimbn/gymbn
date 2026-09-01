import { escapeHtml, ICON_TRASH } from '../util.js';
import { confirmSheet } from '../components/confirmSheet.js';

// "📢 Sistem Mesajı Gönder"in geçmişi — sadece admin'in kendi gönderdiği
// system_message'lar (bkz. firestore.rules'taki dar isAdmin() OR'u, bir coach/
// öğrenci arası bildirime hiç dokunmuyor). Her satır aslında birden fazla
// dokümanı (alıcı sayısı kadar) temsil ediyor, hepsi aynı broadcastId'yi
// taşıyor — silme o grubun TAMAMINI kaldırıyor (bkz. adminCloud.js).
export async function render(container, { onBack, listMyBroadcasts, deleteBroadcast }) {
  container.innerHTML = `
    <div class="view-header">
      <button type="button" class="back-link" id="history-back-btn" aria-label="Geri">←</button>
      <h2 class="view-title">Gönderilen Mesajlar</h2>
      <span></span>
    </div>
    <div class="list" id="list-root"><p class="empty-state">Yükleniyor…</p></div>
  `;
  container.querySelector('#history-back-btn').addEventListener('click', onBack);

  const listRoot = container.querySelector('#list-root');
  let items = [];
  try {
    items = await listMyBroadcasts();
  } catch (err) {
    console.error('Geçmiş yüklenemedi', err);
    listRoot.innerHTML = '<p class="empty-state">Yüklenemedi, internet bağlantını kontrol edip tekrar dene.</p>';
    return;
  }

  function formatSentAt(ms) {
    if (!ms) return '';
    const d = new Date(ms);
    return `${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  function renderItems() {
    if (!items.length) {
      listRoot.innerHTML = '<p class="empty-state">Henüz mesaj gönderilmedi.</p>';
      return;
    }
    listRoot.innerHTML = items.map((b) => `
      <div class="list-item broadcast-history-item" data-id="${b.broadcastId}">
        <div class="list-item-main">
          <div class="broadcast-history-text">${escapeHtml(b.message)}</div>
          <span class="list-item-sub">${formatSentAt(b.createdAt)} · ${b.count} kişiye gönderildi</span>
        </div>
        <div class="list-item-actions">
          <button type="button" class="btn-icon danger delete-btn" aria-label="Sil">${ICON_TRASH}</button>
        </div>
      </div>
    `).join('');
  }

  listRoot.addEventListener('click', async (e) => {
    const row = e.target.closest('.broadcast-history-item');
    if (!row || !e.target.closest('.delete-btn')) return;
    const item = items.find((b) => b.broadcastId === row.dataset.id);
    if (!(await confirmSheet(`Bu mesaj (${item.count} kişiye gönderilmişti) silinsin mi? Herkesin bildirim listesinden kaldırılır.`, { confirmLabel: 'Sil' }))) return;
    try {
      await deleteBroadcast(item.broadcastId);
      items = items.filter((b) => b.broadcastId !== item.broadcastId);
      renderItems();
    } catch (err) {
      console.error('Mesaj silinemedi', err);
      alert('Silinemedi, internet bağlantını kontrol edip tekrar dene.');
    }
  });

  renderItems();
}
