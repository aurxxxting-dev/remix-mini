let currentScreenshot = null;
let currentSize = '1024x1024';
let currentAspectRatio = '1:1';

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

function findClosestAspectRatio(w, h) {
  const ratio = w / h;
  let closest = '1:1';
  let minDiff = Infinity;
  for (const ar of ASPECT_RATIOS) {
    const diff = Math.abs(ratio - ar.w / ar.h);
    if (diff < minDiff) {
      minDiff = diff;
      closest = ar.label;
    }
  }
  return closest;
}

function setScreenshot(dataUrl, size, aspectRatio) {
  currentScreenshot = dataUrl.split(',')[1];
  currentSize = size || '1024x1024';
  if (!aspectRatio) {
    const dims = currentSize.split('x');
    aspectRatio = findClosestAspectRatio(parseInt(dims[0]), parseInt(dims[1]));
  }
  currentAspectRatio = aspectRatio;
  thumbnail.src = dataUrl;
  thumbnailContainer.style.display = 'block';
}

const btnScreenshot = document.getElementById('btnScreenshot');
const btnPaste = document.getElementById('btnPaste');
const btnGenerate = document.getElementById('btnGenerate');
const btnClose = document.getElementById('btnClose');
const btnSettings = document.getElementById('btnSettings');
const promptInput = document.getElementById('promptInput');
const thumbnailContainer = document.getElementById('thumbnailContainer');
const thumbnail = document.getElementById('thumbnail');
const status = document.getElementById('status');
const toolbar = document.getElementById('toolbar');

// Settings bar elements
const settingsBar = document.getElementById('settingsBar');
const settingsClose = document.getElementById('settingsClose');
const btnSave = document.getElementById('btnSave');
const apiKeyInput = document.getElementById('apiKeyInput');
const btnPasteKey = document.getElementById('btnPasteKey');
const apiKeySection = document.getElementById('apiKeySection');

// API selector elements
const apiGemini = document.getElementById('apiGemini');
const apiAgnes = document.getElementById('apiAgnes');
const balanceDisplay = document.getElementById('balanceDisplay');

let currentApiType = 'gemini';

async function refreshBalance() {
  if (currentApiType !== 'gemini') {
    balanceDisplay.textContent = '';
    balanceDisplay.style.display = 'none';
    return;
  }
  try {
    const data = await window.agnesAPI.getTokenBalance();
    if (data) {
      if (data.unlimitedQuota) {
        balanceDisplay.textContent = '余额: ∞';
      } else if (data.balance != null) {
        const num = parseFloat(data.balance);
        balanceDisplay.textContent = isNaN(num) ? '余额: ' + data.balance : '余额: ' + (num * 1.2).toFixed(2);
      } else {
        balanceDisplay.textContent = '';
        balanceDisplay.style.display = 'none';
        return;
      }
      balanceDisplay.style.display = 'block';
    } else {
      balanceDisplay.style.display = 'none';
    }
  } catch (_) {
    balanceDisplay.style.display = 'none';
  }
}

// Load current config
(async () => {
  const currentKey = await window.agnesAPI.getApiKey();
  const currentType = await window.agnesAPI.getApiType();
  apiKeyInput.value = currentKey;
  currentApiType = currentType;
  updateApiSelector();
  refreshBalance();
})();

function updateApiSelector() {
  apiGemini.classList.toggle('active', currentApiType === 'gemini');
  apiAgnes.classList.toggle('active', currentApiType === 'agnes');
  // Show/hide API key input based on selection
  apiKeySection.style.display = currentApiType === 'gemini' ? 'flex' : 'none';
}

apiGemini.addEventListener('click', async () => {
  currentApiType = 'gemini';
  updateApiSelector();
  await window.agnesAPI.setApiType('gemini');
  refreshBalance();
});

apiAgnes.addEventListener('click', async () => {
  currentApiType = 'agnes';
  updateApiSelector();
  await window.agnesAPI.setApiType('agnes');
  balanceDisplay.textContent = '';
});

// Paste API key from clipboard
btnPasteKey.addEventListener('click', async () => {
  try {
    const text = await window.agnesAPI.readClipboardText();
    if (text) {
      apiKeyInput.value = text.trim();
    } else {
      setStatus('剪贴板为空', 'error');
    }
  } catch (e) {
    setStatus('读取剪贴板失败：' + e.message, 'error');
  }
});

// Settings bar
btnSettings.addEventListener('click', () => {
  settingsBar.style.display = 'flex';
});

settingsClose.addEventListener('click', () => {
  settingsBar.style.display = 'none';
});

btnSave.addEventListener('click', async () => {
  if (currentApiType === 'gemini') {
    const newKey = apiKeyInput.value.trim();
    if (!newKey) {
      setStatus('请输入 API Key', 'error');
      return;
    }
    const result = await window.agnesAPI.setApiKey(newKey);
    if (result.success) {
      settingsBar.style.display = 'none';
      setStatus('API Key 已保存', 'success');
      refreshBalance();
    } else {
      setStatus('保存失败：' + result.error, 'error');
    }
  } else {
    // Agnes API uses built-in key, just save the type
    settingsBar.style.display = 'none';
    setStatus('已切换到 Agnes API', 'success');
  }
});

apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    btnSave.click();
  }
  e.stopPropagation();
});

settingsBar.addEventListener('click', (e) => {
  if (e.target === settingsBar) {
    settingsBar.style.display = 'none';
  }
});

btnScreenshot.addEventListener('click', async () => {
  btnScreenshot.disabled = true;
  setStatus('正在截图...', 'loading');

  try {
    const result = await window.agnesAPI.takeScreenshot();
    if (result) {
      setScreenshot(result.dataUrl, result.size, result.aspectRatio);
      setStatus('截图完成', 'success');
    } else {
      setStatus('截图已取消', '');
    }
  } catch (e) {
    setStatus('截图失败: ' + e.message, 'error');
  } finally {
    btnScreenshot.disabled = false;
  }
});

btnPaste.addEventListener('click', async () => {
  btnPaste.disabled = true;
  setStatus('正在读取粘贴板...', 'loading');

  try {
    const result = await window.agnesAPI.pasteImage();
    if (result) {
      setScreenshot(result.dataUrl, result.size);
      setStatus('已粘贴', 'success');
    } else {
      setStatus('粘贴板无图片', 'error');
    }
  } catch (e) {
    setStatus('读取失败: ' + e.message, 'error');
  } finally {
    btnPaste.disabled = false;
  }
});

btnGenerate.addEventListener('click', generate);
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') generate();
});

document.addEventListener('keydown', (e) => {
  // Only trigger image paste when settings bar is closed and not in input field
  if (settingsBar.style.display !== 'flex' &&
      (e.ctrlKey || e.metaKey) && e.key === 'v' && document.activeElement !== promptInput) {
    e.preventDefault();
    btnPaste.click();
  }
});

async function generate() {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    setStatus('请输入提示词', 'error');
    return;
  }

  btnGenerate.disabled = true;
  toolbar.classList.add('generating');
  setStatus('正在生成...', 'loading');

  try {
    const result = await window.agnesAPI.generateImage({
      prompt,
      imageBase64: currentScreenshot || null,
      size: currentSize || '1024x1024',
      aspectRatio: currentAspectRatio || '1:1',
    });

    if (result.success) {
      setStatus('已保存并复制到剪贴板', 'success');
      currentScreenshot = null;
      currentSize = '1024x1024';
      currentAspectRatio = '1:1';
      thumbnailContainer.style.display = 'none';
      refreshBalance();
    } else {
      setStatus('生成失败: ' + result.error, 'error');
    }
  } catch (e) {
    setStatus('请求失败: ' + e.message, 'error');
  } finally {
    btnGenerate.disabled = false;
    toolbar.classList.remove('generating');
  }
}

btnClose.addEventListener('click', () => {
  window.agnesAPI.closeApp();
});

function setStatus(text, type) {
  status.textContent = text;
  status.className = 'status' + (type ? ` ${type}` : '');
  fitWindow();
}

function fitWindow() {
  const toolbar = document.getElementById('toolbar');
  const h = toolbar.scrollHeight + 4;
  window.agnesAPI.setWindowHeight(h);
}

// History management
function createHistoryItem(item) {
  const div = document.createElement('div');
  div.className = 'history-item';
  div.draggable = true;

  const img = document.createElement('img');
  img.src = item.thumbnail;
  div.appendChild(img);

  div.addEventListener('dragstart', (e) => {
    e.preventDefault();
    window.agnesAPI.startDragFile(item.path);
  });

  return div;
}

function loadHistory() {
  window.agnesAPI.getHistoryImages().then(items => {
    if (items.length > 0) {
      const container = document.getElementById('historyContainer');
      container.style.display = 'flex';
      items.forEach(item => container.appendChild(createHistoryItem(item)));
      fitWindow();
    }
  });
}

function addHistoryItem(item) {
  const container = document.getElementById('historyContainer');
  container.style.display = 'flex';

  const el = createHistoryItem(item);
  container.insertBefore(el, container.firstChild);

  while (container.children.length > 5) {
    container.removeChild(container.lastChild);
  }

  fitWindow();
}

loadHistory();

window.agnesAPI.onNewImageGenerated(item => {
  addHistoryItem(item);
});
