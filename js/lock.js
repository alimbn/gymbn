const UNLOCK_KEY = 'gymbn_unlocked';
const APP_PASSWORD = 'CHANGE_ME';

export function isUnlocked() {
  return localStorage.getItem(UNLOCK_KEY) === 'true';
}

export function showLockScreen() {
  document.body.innerHTML = `
    <div class="lock-screen">
      <div class="lock-card">
        <div class="lock-title">Gym Takip</div>
        <input type="password" id="lock-password" placeholder="Şifre" autocomplete="off">
        <button type="button" class="btn btn-primary btn-block" id="lock-submit">Aç</button>
        <p class="lock-error" id="lock-error" style="display:none;">Yanlış şifre.</p>
      </div>
    </div>
  `;

  const input = document.getElementById('lock-password');
  const error = document.getElementById('lock-error');

  function tryUnlock() {
    if (input.value === APP_PASSWORD) {
      localStorage.setItem(UNLOCK_KEY, 'true');
      location.reload();
    } else {
      error.style.display = 'block';
      input.value = '';
      input.focus();
    }
  }

  document.getElementById('lock-submit').addEventListener('click', tryUnlock);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryUnlock();
  });
  input.focus();
}
