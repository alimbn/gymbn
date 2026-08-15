import { getStudent } from './coachCloud.js';
import { escapeHtml } from '../util.js';

// Roster satırına dokununca artık doğrudan program atamaya gitmiyor — birden
// fazla yönetim ekranı (program/ölçüm/ödeme) eklendiği için aradaki bu hub
// ekranı gerekti. assignProgram.js'in back-link'i de buraya döner.
export async function render(container, { studentUid }) {
  container.innerHTML = '<p class="empty-state">Yükleniyor…</p>';

  let student;
  try {
    student = await getStudent(studentUid);
  } catch (err) {
    console.error('Öğrenci yüklenemedi', err);
    renderShell(container, 'Öğrenci', '<p class="empty-state">Öğrenci verisi yüklenemedi, internet bağlantını kontrol edip tekrar dene.</p>');
    return;
  }
  if (!student) {
    renderShell(container, 'Öğrenci', '<p class="empty-state">Öğrenci bulunamadı.</p>');
    return;
  }

  renderShell(container, student.displayName, `
    <div class="list">
      <a href="#/assign/${studentUid}" class="list-item">
        <div class="list-item-main">
          <span class="list-item-title">Program</span>
          <div class="list-item-sub">Bu haftaki program, yeni program ata</div>
        </div>
      </a>
      <a href="#/measurements/${studentUid}" class="list-item">
        <div class="list-item-main">
          <span class="list-item-title">Ölçümler</span>
          <div class="list-item-sub">Beden ölçümleri ve ilerleme</div>
        </div>
      </a>
      <a href="#/payments/${studentUid}" class="list-item">
        <div class="list-item-main">
          <span class="list-item-title">Ödemeler</span>
          <div class="list-item-sub">Ödeme döngüsü ve geçmiş</div>
        </div>
      </a>
    </div>
  `);
}

function renderShell(container, title, bodyHtml) {
  container.innerHTML = `
    <div class="view-header">
      <a href="#/" class="back-link" aria-label="Geri">←</a>
      <h2 class="view-title">${escapeHtml(title)}</h2>
      <span></span>
    </div>
    ${bodyHtml}
  `;
}
