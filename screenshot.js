const bg = document.getElementById('bg');
const selection = document.getElementById('selection');
const sizeInfo = document.getElementById('size-info');
const hint = document.getElementById('hint');

// Aspect ratios: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9
const ASPECT_RATIOS = [
  { w: 1, h: 1, label: '1:1' },
  { w: 2, h: 3, label: '2:3' },
  { w: 3, h: 2, label: '3:2' },
  { w: 3, h: 4, label: '3:4' },
  { w: 4, h: 3, label: '4:3' },
  { w: 4, h: 5, label: '4:5' },
  { w: 5, h: 4, label: '5:4' },
  { w: 9, h: 16, label: '9:16' },
  { w: 16, h: 9, label: '16:9' },
];
let currentRatioIndex = 0;

let startX, startY, isDragging = false;
let fullDataUrl = null;

window.screenshotAPI.onScreenshotData((dataUrl) => {
  bg.src = dataUrl;
  fullDataUrl = dataUrl;
  updateHint();
});

function getCurrentRatio() {
  return ASPECT_RATIOS[currentRatioIndex];
}

function updateHint() {
  const ratio = getCurrentRatio();
  hint.innerHTML = `按 Q 切换比例 (当前：${ratio.label}) · 拖拽选择区域 · ESC 取消`;
}

function calculateRect(ratio) {
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  let w, h, x, y;

  if (ratio.w === ratio.h) {
    // Square
    const size = Math.min(Math.abs(dx), Math.abs(dy));
    w = h = size;
    x = dx < 0 ? startX - size : startX;
    y = dy < 0 ? startY - size : startY;
  } else if (Math.abs(dx) > Math.abs(dy) * (ratio.w / ratio.h)) {
    // Height determines size
    h = Math.abs(dy);
    w = h * (ratio.w / ratio.h);
    x = dx < 0 ? startX - w : startX;
    y = dy < 0 ? startY - h : startY;
  } else {
    // Width determines size
    w = Math.abs(dx);
    h = w * (ratio.h / ratio.w);
    x = dx < 0 ? startX - w : startX;
    y = dy < 0 ? startY - h : startY;
  }

  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

let e = { clientX: 0, clientY: 0 }; // For calculateRect usage

document.addEventListener('mousemove', (event) => {
  if (!isDragging) return;
  e = event;

  const rect = calculateRect(getCurrentRatio());

  selection.style.left = rect.x + 'px';
  selection.style.top = rect.y + 'px';
  selection.style.width = rect.w + 'px';
  selection.style.height = rect.h + 'px';

  sizeInfo.textContent = `${rect.w} x ${rect.h} (${getCurrentRatio().label})`;
  sizeInfo.style.left = (rect.x + rect.w + 8) + 'px';
  sizeInfo.style.top = (rect.y + rect.h + 8) + 'px';
});

document.addEventListener('mousedown', (event) => {
  isDragging = true;
  startX = event.clientX;
  startY = event.clientY;
  selection.style.display = 'block';
  selection.style.left = startX + 'px';
  selection.style.top = startY + 'px';
  selection.style.width = '0';
  selection.style.height = '0';
  sizeInfo.style.display = 'block';
  e = event;
});

document.addEventListener('mouseup', async (event) => {
  if (!isDragging) return;
  isDragging = false;
  e = event;

  const rect = calculateRect(getCurrentRatio());

  if (rect.w < 10 || rect.h < 10) {
    selection.style.display = 'none';
    sizeInfo.style.display = 'none';
    return;
  }

  hint.style.display = 'none';

  const img = new Image();
  img.onload = () => {
    const scaleX = img.naturalWidth / window.innerWidth;
    const scaleY = img.naturalHeight / window.innerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(rect.w * scaleX);
    canvas.height = Math.round(rect.h * scaleY);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, Math.round(rect.x * scaleX), Math.round(rect.y * scaleY),
      canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);

    const croppedDataUrl = canvas.toDataURL('image/png');
    const size = `${canvas.width}x${canvas.height}`;
    const aspectRatio = getCurrentRatio().label;
    window.screenshotAPI.sendCropped(croppedDataUrl, size, aspectRatio);
  };
  img.src = fullDataUrl;
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    window.screenshotAPI.sendCancelled();
  }

  if (event.key === 'q' || event.key === 'Q') {
    currentRatioIndex = (currentRatioIndex + 1) % ASPECT_RATIOS.length;
    updateHint();
    // Trigger a re-render of the selection if dragging
    if (isDragging) {
      const rect = calculateRect(getCurrentRatio());
      selection.style.width = rect.w + 'px';
      selection.style.height = rect.h + 'px';
      sizeInfo.textContent = `${rect.w} x ${rect.h} (${getCurrentRatio().label})`;
    }
  }
});
