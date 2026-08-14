import { escapeHtml } from '../util.js';

const PRE_DELAY_SECONDS = 5;
const INTENSE_THRESHOLD = 10;

let activeBackdrop = null;

// Plank/tutma gibi süre-bazlı egzersizler için: kısa bir hazırlık gecikmesinden
// sonra hedef süreden geriye sayan bir modal. Son 10sn'de nabız yoğunlaşır (bkz.
// dinlenme kronometresinin sürekli nabzından farklı, hedefe özel bir animasyon).
// Ses/titreşim bilinçli olarak bu turda yok — kullanıcı "sonraya kalabilir" dedi.
export function openCountdown({ targetSeconds, label }) {
  if (activeBackdrop) activeBackdrop.remove();

  const target = Math.max(1, Math.round(targetSeconds) || 0);
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop countdown-backdrop';
  backdrop.innerHTML = `
    <div class="countdown-modal">
      ${label ? `<div class="countdown-label">${escapeHtml(label)}</div>` : ''}
      <div class="countdown-display">${PRE_DELAY_SECONDS}</div>
      <div class="countdown-sub">Hazırlan...</div>
      <button type="button" class="btn btn-block countdown-cancel">İptal</button>
    </div>
  `;
  document.body.appendChild(backdrop);
  activeBackdrop = backdrop;

  const modal = backdrop.querySelector('.countdown-modal');
  const display = backdrop.querySelector('.countdown-display');
  const sub = backdrop.querySelector('.countdown-sub');

  let phase = 'predelay';
  let remaining = PRE_DELAY_SECONDS;
  let intervalId = null;

  function close() {
    clearInterval(intervalId);
    backdrop.remove();
    if (activeBackdrop === backdrop) activeBackdrop = null;
  }

  function tick() {
    remaining--;
    if (phase === 'predelay') {
      if (remaining <= 0) {
        phase = 'counting';
        remaining = target;
        sub.textContent = label ? 'Süre' : '';
      }
      display.textContent = String(remaining);
      return;
    }
    if (phase === 'counting') {
      if (remaining <= INTENSE_THRESHOLD && remaining > 0) modal.classList.add('countdown-intense');
      if (remaining <= 0) {
        phase = 'done';
        clearInterval(intervalId);
        modal.classList.remove('countdown-intense');
        modal.classList.add('countdown-done');
        display.textContent = '✓';
        sub.textContent = 'Bitti!';
        return;
      }
      display.textContent = String(remaining);
    }
  }

  intervalId = setInterval(tick, 1000);

  backdrop.querySelector('.countdown-cancel').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop && phase === 'done') close();
  });
}
