import { isRestTimerAutoResetEnabled, isRestTimerBigEnabled, setRestTimerBigEnabled, vibrate } from '../util.js';

const DRAG_THRESHOLD = 8;
const LONG_PRESS_MS = 600;
const IDLE_RESET_MS = 60000;
const TAP_WINDOW_MS = 300;

// Set arası dinlenmeyi takip eden, tüm ekranlar boyunca kaybolmayan (document.body'ye
// doğrudan eklenen, #view-root'un dışında olduğu için router yeniden render ettiğinde
// silinmeyen) sürüklenebilir bir kronometre. Tek dokunuş başlat/duraklat (anında, gecikmesiz),
// çift dokunuş (300ms içinde ikinci dokunuş) sıfırlar, uzun basış büyük/küçük boy arasında
// geçiş yapar, sürükleme yeniden konumlandırır — dördü de aynı pointer olayları üzerinden
// ayırt ediliyor. Çift dokunuş, ilk dokunuşun başlat/durdur'u ANINDA tetikleyip ikinci dokunuş
// gelirse onu geri alması şeklinde kurulu (klasik "bekle-sonra-karar-ver" değil) — en sık
// kullanılan tek-dokunuş hiç gecikmiyor, bedeli sadece çift dokunulduğunda kısa bir yanıp sönme.
export function initRestTimer() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'rest-timer-btn';
  btn.className = 'rest-timer-btn' + (isRestTimerBigEnabled() ? ' big' : '');
  btn.innerHTML = '<span class="rest-timer-time">00:00</span><span class="ripple-ring"></span><span class="ripple-ring d2"></span>';
  document.body.appendChild(btn);

  const timeEl = btn.querySelector('.rest-timer-time');

  let seconds = 0;
  let running = false;
  let intervalId = null;
  let idleResetTimer = null;
  let lastTapTime = 0;

  let pointerDown = false;
  let dragMoved = false;
  let longPressFired = false;
  let longPressTimer = null;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  function render() {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    timeEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function toggle() {
    running = !running;
    btn.classList.toggle('running', running);
    if (running) {
      clearTimeout(idleResetTimer);
      intervalId = setInterval(() => {
        seconds++;
        render();
      }, 1000);
    } else {
      clearInterval(intervalId);
      scheduleIdleReset();
    }
  }

  // Duraklatılmış (çalışmayan) kronometre 1dk boyunca dokunulmadan kalırsa
  // kendini sıfırlıyor — amaç, bir seti bitirip dinlenmeyi durdurduktan sonra
  // bir sonraki sete girerken hâlâ eski süreyi gösterip elle sıfırlatmaması.
  // Çift-dokunuş sıfırlaması bu özelliğe rağmen aynen çalışmaya devam ediyor.
  function scheduleIdleReset() {
    clearTimeout(idleResetTimer);
    if (seconds === 0 || !isRestTimerAutoResetEnabled()) return;
    idleResetTimer = setTimeout(() => {
      if (!running) reset();
    }, IDLE_RESET_MS);
  }

  function reset() {
    running = false;
    clearInterval(intervalId);
    clearTimeout(idleResetTimer);
    seconds = 0;
    btn.classList.remove('running');
    render();
  }

  function toggleSize() {
    const big = !btn.classList.contains('big');
    btn.classList.toggle('big', big);
    setRestTimerBigEnabled(big);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  btn.addEventListener('pointerdown', (e) => {
    pointerDown = true;
    dragMoved = false;
    longPressFired = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = btn.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    try { btn.setPointerCapture(e.pointerId); } catch { /* dokunma/pointer bazı tarayıcılarda desteklemeyebilir, sürükleme yine de çalışır */ }

    longPressTimer = setTimeout(() => {
      if (!dragMoved) {
        longPressFired = true;
        vibrate(15);
        toggleSize();
      }
    }, LONG_PRESS_MS);
  });

  btn.addEventListener('pointermove', (e) => {
    if (!pointerDown) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragMoved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      dragMoved = true;
      clearTimeout(longPressTimer);
      btn.classList.add('dragging');
    }
    if (dragMoved) {
      const maxLeft = window.innerWidth - btn.offsetWidth;
      const maxTop = window.innerHeight - btn.offsetHeight;
      btn.style.left = `${clamp(startLeft + dx, 0, maxLeft)}px`;
      btn.style.top = `${clamp(startTop + dy, 0, maxTop)}px`;
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    }
  });

  function endPointer() {
    clearTimeout(longPressTimer);
    pointerDown = false;
    btn.classList.remove('dragging');
    if (dragMoved) {
      dragMoved = false;
      return;
    }
    if (longPressFired) {
      longPressFired = false;
      return;
    }
    const now = Date.now();
    if (now - lastTapTime < TAP_WINDOW_MS) {
      lastTapTime = 0;
      vibrate(15);
      reset();
    } else {
      lastTapTime = now;
      toggle();
    }
  }

  btn.addEventListener('pointerup', endPointer);
  btn.addEventListener('pointercancel', () => {
    clearTimeout(longPressTimer);
    pointerDown = false;
    dragMoved = false;
    btn.classList.remove('dragging');
  });

  render();
}
