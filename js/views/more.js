import { exportBackup, importBackup } from '../storage.js';

export function render(container) {
  container.innerHTML = `
    <div class="view-header">
      <h2 class="view-title">Diğer</h2>
    </div>
    <div class="more-menu">
      <a class="more-menu-item" href="#/exercises"><span>Egzersizler</span><span class="chevron">›</span></a>
      <a class="more-menu-item" href="#/day-types"><span>Gün Tipleri</span><span class="chevron">›</span></a>
      <a class="more-menu-item" href="#/payments"><span>Ödemeler</span><span class="chevron">›</span></a>
    </div>

    <div class="section-title">Yedekleme</div>
    <div class="card">
      <p class="muted" style="margin-bottom: var(--space-3);">
        Tüm verilerin bu telefonda saklanıyor. Kaza ile silinmesine karşı ara sıra yedek indirmen önerilir.
      </p>
      <button type="button" class="btn btn-block" id="export-btn" style="margin-bottom: var(--space-3);">Yedeği Dışa Aktar (.json indir)</button>
      <label class="btn btn-block" for="import-file" style="display:block; text-align:center; cursor:pointer;">Yedekten Geri Yükle</label>
      <input type="file" id="import-file" accept="application/json" style="display:none;">
    </div>
  `;

  container.querySelector('#export-btn').addEventListener('click', () => {
    exportBackup();
  });

  container.querySelector('#import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('Mevcut tüm veriler yedekteki verilerle değiştirilecek. Emin misin?')) {
      e.target.value = '';
      return;
    }
    importBackup(file, (err) => {
      if (err) {
        alert('Yedek dosyası okunamadı: ' + err.message);
        return;
      }
      location.reload();
    });
  });
}
