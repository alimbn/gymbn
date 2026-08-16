import { exportBackup, importBackup } from '../storage.js';
import { isRestTimerAutoResetEnabled, setRestTimerAutoResetEnabled, isExerciseMediaEnabled, setExerciseMediaEnabled } from '../util.js';
import { confirmSheet } from '../components/confirmSheet.js';

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

    <div class="section-title">Ayarlar</div>
    <div class="card">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-title">Dinlenme kronometresini otomatik sıfırla</span>
          <span class="setting-row-sub">Durdurulup 1 dakika dokunulmazsa sıfırlanır</span>
        </div>
        <button type="button" class="settings-toggle" id="auto-reset-toggle" role="switch" aria-label="Dinlenme kronometresini otomatik sıfırla"></button>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-title">Hareket videosu ve hedef bölge göster</span>
          <span class="setting-row-sub">Antrenman kartında bağlı video ve kas grubu bilgisini göster</span>
        </div>
        <button type="button" class="settings-toggle" id="exercise-media-toggle" role="switch" aria-label="Hareket videosu ve hedef bölge göster"></button>
      </div>
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

  const autoResetToggle = container.querySelector('#auto-reset-toggle');
  function syncAutoResetToggle() {
    const on = isRestTimerAutoResetEnabled();
    autoResetToggle.classList.toggle('on', on);
    autoResetToggle.setAttribute('aria-checked', String(on));
  }
  syncAutoResetToggle();
  autoResetToggle.addEventListener('click', () => {
    setRestTimerAutoResetEnabled(!isRestTimerAutoResetEnabled());
    syncAutoResetToggle();
  });

  const exerciseMediaToggle = container.querySelector('#exercise-media-toggle');
  function syncExerciseMediaToggle() {
    const on = isExerciseMediaEnabled();
    exerciseMediaToggle.classList.toggle('on', on);
    exerciseMediaToggle.setAttribute('aria-checked', String(on));
  }
  syncExerciseMediaToggle();
  exerciseMediaToggle.addEventListener('click', () => {
    setExerciseMediaEnabled(!isExerciseMediaEnabled());
    syncExerciseMediaToggle();
  });

  container.querySelector('#export-btn').addEventListener('click', () => {
    exportBackup();
  });

  container.querySelector('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!(await confirmSheet('Mevcut tüm veriler yedekteki verilerle değiştirilecek.', { confirmLabel: 'Değiştir' }))) {
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
