const DRAG_THRESHOLD = 8;
const LONG_PRESS_MS = 600;

// Set arası dinlenmeyi takip eden, tüm ekranlar boyunca kaybolmayan (document.body'ye
// doğrudan eklenen, #view-root'un dışında olduğu için router yeniden render ettiğinde
// silinmeyen) sürüklenebilir bir kronometre. Tek dokunuş başlat/duraklat, uzun basış
// sıfırlar, sürükleme yeniden konumlandırır — üçü aynı pointer olayları üzerinden
// ayırt ediliyor.
export function initRestTimer() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'rest-timer-btn';
  btn.className = 'rest-timer-btn';
  btn.textContent = '00:00';
  document.body.appendChild(btn);

  let seconds = 0;
  let running = false;
  let intervalId = null;

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
    btn.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function toggle() {
    running = !running;
    btn.classList.toggle('running', running);
    if (running) {
      intervalId = setInterval(() => {
        seconds++;
        render();
      }, 1000);
    } else {
      clearInterval(intervalId);
    }
  }

  function reset() {
    running = false;
    clearInterval(intervalId);
    seconds = 0;
    btn.classList.remove('running');
    render();
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
        reset();
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
    toggle();
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
