const sprite = document.getElementById('sprite');
const cols = 9;
const rows = 6;
const breath = [0, 1, 2, 3];
const blink = [4, 5, 4];

let gaze = 0;
let bob = 0;
let blinkStep = -1;
let breathsLeft = 5;
let dragging = false;
let ignoring = true;

function place() {
  const width = sprite.clientWidth;
  const height = sprite.clientHeight;
  sprite.style.backgroundSize = `${width * cols}px ${height * rows}px`;
  const row = blinkStep >= 0 ? blink[blinkStep] : breath[bob];
  sprite.style.backgroundPosition = `${-gaze * width}px ${-row * height}px`;
}

function lookAt(dx, dy, reach) {
  const distance = Math.hypot(dx, dy);
  gaze = 0;
  if (distance > 24 && distance <= reach) {
    const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
    const order = [3, 4, 5, 6, 7, 8, 1, 2];
    gaze = order[((sector % 8) + 8) % 8];
  }
  place();
}

function setIgnore(ignore) {
  if (ignore === ignoring) return;
  ignoring = ignore;
  window.petApi.setIgnore(ignore);
}

async function followPointer() {
  const state = await window.petApi.pointer();
  if (!state) return;
  const dx = state.cursor.x - (state.bounds.x + state.bounds.width / 2);
  const dy = state.cursor.y - (state.bounds.y + state.bounds.height * 0.62);
  const reach = Math.min(240, state.bounds.height * 0.7);
  lookAt(dx, dy, reach);
}

window.addEventListener('mousemove', (event) => {
  if (dragging) {
    setIgnore(false);
    window.petApi.dragMove();
    return;
  }
  setIgnore(document.elementFromPoint(event.clientX, event.clientY) !== sprite);
});

sprite.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  dragging = true;
  setIgnore(false);
  window.petApi.dragStart();
  sprite.setPointerCapture(event.pointerId);
});

function endDrag() {
  if (!dragging) return;
  dragging = false;
  window.petApi.dragEnd();
}

sprite.addEventListener('pointerup', endDrag);
sprite.addEventListener('pointercancel', endDrag);
sprite.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  window.petApi.showMenu();
});

sprite.addEventListener('wheel', (event) => {
  event.preventDefault();
  window.petApi.resizeStep(event.deltaY < 0 ? 1 : -1);
}, { passive: false });

setInterval(() => {
  if (blinkStep >= 0) {
    blinkStep += 1;
    if (blinkStep >= blink.length) blinkStep = -1;
  } else {
    bob = (bob + 1) % breath.length;
    if (bob === 0) {
      breathsLeft -= 1;
      if (breathsLeft <= 0) {
        blinkStep = 0;
        breathsLeft = 5 + Math.floor(Math.random() * 3);
      }
    }
  }
  place();
}, 170);

followPointer();
setInterval(followPointer, 50);
place();
