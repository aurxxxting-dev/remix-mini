const { app, BrowserWindow, ipcMain, desktopCapturer, clipboard, nativeImage, screen, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

app.disableHardwareAcceleration();

let API_KEY_FILE;
let OUTPUT_DIR;

function getPaths() {
  if (!API_KEY_FILE) {
    const userData = app.getPath('userData');
    API_KEY_FILE = path.join(userData, 'config.json');
    OUTPUT_DIR = path.join(userData, 'output');
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  }
  return { API_KEY_FILE, OUTPUT_DIR };
}

let API_KEY = '';
let API_TYPE = 'gemini'; // 'gemini' or 'agnes'

// Load config from file (dev mode only)
try {
  if (fs.existsSync(path.join(__dirname, 'config.json'))) {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
    if (config.apiKey) API_KEY = config.apiKey;
    if (config.apiType) API_TYPE = config.apiType;
  }
} catch (_) {}

// API configurations
const API_CONFIGS = {
  gemini: {
    url: 'https://api.apib.ai/v1/images/generations',
    model: 'gemini-3.1-flash-image-preview',
    needsKey: true,
    async: true, // uses task polling
  },
  agnes: {
    url: 'https://apihub.agnes-ai.com/v1/images/generations',
    model: 'agnes-image-2.1-flash',
    key: 'sk-XL2JPKrBt0tWUYCADppAHTs9g3mUTOVYSZNgVfaqH4AV1mHK',
    needsKey: false,
    async: false, // direct response
  },
};

// Ratio mapping: existing app ratios -> agnes API ratios
const RATIO_MAP_AGNES = {
  '1:1': '1:1',
  '2:3': '2:3',
  '3:2': '3:2',
  '3:4': '3:4',
  '4:3': '4:3',
  '4:5': '3:4',  // map to closest supported
  '5:4': '4:3',  // map to closest supported
  '9:16': '9:16',
  '16:9': '16:9',
};

// Agnes API 1K size mapping (exact pixels)
const AGNES_SIZE_MAP = {
  '1:1': '1024x1024',
  '2:3': '832x1248',
  '3:2': '1248x832',
  '3:4': '864x1152',
  '4:3': '1152x864',
  '9:16': '736x1312',
  '16:9': '1312x736',
};

let mainWindow;
let screenshotWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 560,
    height: 90,
    center: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    shadow: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'desktop-capturer') {
      callback(true);
    } else {
      callback(false);
    }
  });
}

app.whenReady().then(() => {
  const { API_KEY_FILE: keyFile } = getPaths();
  try {
    if (fs.existsSync(keyFile)) {
      const config = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
      if (config.apiKey) API_KEY = config.apiKey;
      if (config.apiType) API_TYPE = config.apiType;
    }
  } catch (_) {}
  createMainWindow();

  // Lightweight update check - fetch remote version info
  const DOWNLOAD_PAGE = 'https://gitee.com/auerh/remix-mini/releases';
  const currentVersion = app.getVersion();

  async function checkForUpdate() {
    try {
      const url = 'https://gitee.com/auerh/remix-mini/raw/main/version.json';
      const data = await new Promise((resolve, reject) => {
        const req = https.get(url, { timeout: 8000 }, (res) => {
          // Follow redirects
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectReq = https.get(res.headers.location, { timeout: 8000 }, (redirectRes) => {
              let body = '';
              redirectRes.on('data', (c) => body += c);
              redirectRes.on('end', () => {
                try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
              });
            });
            redirectReq.on('error', reject);
            redirectReq.on('timeout', () => { redirectReq.destroy(); reject(new Error('timeout')); });
            return;
          }
          let body = '';
          res.on('data', (c) => body += c);
          res.on('end', () => {
            try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
          });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      });

      if (data.version && data.version !== currentVersion) {
        if (mainWindow) mainWindow.webContents.send('update-status', '发现新版本 v' + data.version);
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: '发现新版本',
          message: `新版本 v${data.version} 已发布`,
          detail: data.changelog || '点击"前往下载"获取最新版本。',
          buttons: ['前往下载', '稍后'],
          defaultId: 0,
        });
        if (response === 0) {
          shell.openExternal(data.downloadUrl || DOWNLOAD_PAGE);
        }
      } else {
        if (mainWindow) mainWindow.webContents.send('update-status', '已是最新版本');
      }
    } catch (err) {
      console.log('Update check failed:', err.message);
      if (mainWindow) mainWindow.webContents.send('update-status', '检测失败');
    }
  }

  setTimeout(checkForUpdate, 3000);
});

ipcMain.handle('check-for-update', () => {
  const currentVersion = app.getVersion();
  const url = 'https://gitee.com/auerh/remix-mini/raw/main/version.json';
  
  function processResponse(res) {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      https.get(res.headers.location, { timeout: 8000 }, processResponse).on('error', () => {
        if (mainWindow) mainWindow.webContents.send('update-status', '检测失败');
      });
      return;
    }
    let body = '';
    res.on('data', (c) => body += c);
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.version && data.version !== currentVersion) {
          if (mainWindow) mainWindow.webContents.send('update-status', '发现新版本 v' + data.version);
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: '发现新版本',
            message: `新版本 v${data.version} 已发布`,
            detail: data.changelog || '点击"前往下载"获取最新版本。',
            buttons: ['前往下载', '稍后'],
            defaultId: 0,
          }).then(({ response }) => {
            if (response === 0) shell.openExternal(data.downloadUrl || 'https://gitee.com/auerh/remix-mini/releases');
          });
        } else {
          if (mainWindow) mainWindow.webContents.send('update-status', '已是最新版本');
        }
      } catch (_) {
        if (mainWindow) mainWindow.webContents.send('update-status', '检测失败');
      }
    });
  }
  
  https.get(url, { timeout: 8000 }, processResponse).on('error', () => {
    if (mainWindow) mainWindow.webContents.send('update-status', '检测失败');
  });
});
app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

ipcMain.handle('take-screenshot', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 },
  });
  if (sources.length === 0) return null;

  const dataUrl = sources[0].thumbnail.toDataURL();
  const { width, height } = screen.getPrimaryDisplay().size;

  screenshotWindow = new BrowserWindow({
    width, height, x: 0, y: 0,
    frame: false, alwaysOnTop: true, fullscreen: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });

  screenshotWindow.loadFile('screenshot.html');
  screenshotWindow.webContents.on('did-finish-load', () => {
    screenshotWindow.webContents.send('screenshot-data', dataUrl);
  });

  return new Promise((resolve) => {
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      ipcMain.removeAllListeners('screenshot-cropped');
      ipcMain.removeAllListeners('screenshot-cancelled');
      if (screenshotWindow && !screenshotWindow.isDestroyed()) screenshotWindow.close();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(true);
        mainWindow.focus();
      }
      resolve(val);
    };

    ipcMain.once('screenshot-cropped', (_, { dataUrl, size, aspectRatio }) => finish({ dataUrl, size, aspectRatio }));
    ipcMain.once('screenshot-cancelled', () => finish(null));
    screenshotWindow.on('closed', () => finish(null));
  });
});

ipcMain.handle('generate-image', async (_, { prompt, imageBase64, size, aspectRatio }) => {
  getPaths();
  const config = API_CONFIGS[API_TYPE];
  const apiKey = config.needsKey ? API_KEY : config.key;

  if (config.needsKey && !apiKey) {
    return { success: false, error: '请先在设置中配置 API Key' };
  }

  let result;
  if (API_TYPE === 'agnes') {
    result = await generateWithAgnes(prompt, imageBase64, aspectRatio, apiKey);
  } else {
    result = await generateWithGemini(prompt, imageBase64, aspectRatio, apiKey);
  }

  if (result.success && mainWindow) {
    try {
      const img = nativeImage.createFromPath(result.filePath);
      const thumb = img.resize({ width: 72 });
      mainWindow.webContents.send('new-image-generated', {
        path: result.filePath,
        thumbnail: thumb.toDataURL(),
      });
    } catch (_) {}
  }

  return result;
});

async function generateWithAgnes(prompt, imageBase64, aspectRatio, apiKey) {
  const config = API_CONFIGS.agnes;
  const mappedRatio = RATIO_MAP_AGNES[aspectRatio] || '1:1';
  const exactSize = AGNES_SIZE_MAP[mappedRatio] || '1024x1024';

  const body = {
    model: config.model,
    prompt: prompt,
    size: exactSize,
    extra_body: {
      response_format: 'url',
    },
  };

  if (imageBase64) {
    body.extra_body.image = ['data:image/png;base64,' + imageBase64];
  }

  return new Promise((resolve) => {
    const urlObj = new URL(config.url);
    const postData = JSON.stringify(body);
    const req = https.request({
      hostname: urlObj.hostname, port: 443, path: urlObj.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey, 'Content-Length': Buffer.byteLength(postData) },
      timeout: 120000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.data && json.data[0] && json.data[0].url) {
            const imgUrl = json.data[0].url;
            downloadImage(imgUrl).then((buf) => {
              const filePath = path.join(OUTPUT_DIR, 'agnes_' + Date.now() + '.png');
              fs.writeFileSync(filePath, buf);
              clipboard.writeImage(nativeImage.createFromBuffer(buf));
              resolve({ success: true, filePath });
            }).catch((err) => {
              resolve({ success: false, error: '下载失败: ' + err.message });
            });
          } else {
            resolve({ success: false, error: json.error?.message || data.substring(0, 200) });
          }
        } catch (e) {
          resolve({ success: false, error: e.message + ': ' + data.substring(0, 200) });
        }
      });
    });
    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false, error: '请求超时' }); });
    req.write(postData);
    req.end();
  });
}

async function generateWithGemini(prompt, imageBase64, aspectRatio, apiKey) {
  const config = API_CONFIGS.gemini;
  const body = {
    model: config.model,
    prompt: prompt,
    size: aspectRatio || '1:1',
    resolution: '1K',
    n: 1,
  };

  if (imageBase64) {
    body.image_urls = ['data:image/png;base64,' + imageBase64];
  }

  // Step 1: Submit task
  const taskId = await new Promise((resolve, reject) => {
    const urlObj = new URL(config.url);
    const postData = JSON.stringify(body);
    const req = https.request({
      hostname: urlObj.hostname, port: 443, path: urlObj.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey, 'Content-Length': Buffer.byteLength(postData) },
      timeout: 60000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.code === 200 && json.data && json.data[0] && json.data[0].task_id) {
            resolve(json.data[0].task_id);
          } else {
            reject(new Error(json.error?.message || data.substring(0, 200)));
          }
        } catch (e) {
          reject(new Error(e.message + ': ' + data.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(postData);
    req.end();
  });

  // Step 2: Poll task status
  return await pollTaskStatus(taskId, apiKey);
}

function pollTaskStatus(taskId, apiKey) {
  return new Promise((resolve) => {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = () => {
      attempts++;
      const taskUrl = `https://api.apib.ai/v1/tasks/${taskId}?language=zh`;

      https.get(taskUrl, {
        headers: { 'Authorization': 'Bearer ' + apiKey },
        timeout: 30000,
      }, (res) => {
        let data = '';
        res.on('data', (c) => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.code !== 200) {
              resolve({ success: false, error: 'Task query failed: ' + (json.error?.message || data.substring(0, 200)) });
              return;
            }

            const task = json.data;
            if (task.status === 'completed') {
              const imgUrl = task.result?.images?.[0]?.url?.[0];
              if (imgUrl) {
                downloadImage(imgUrl).then((buf) => {
                  const filePath = path.join(OUTPUT_DIR, 'remix_' + Date.now() + '.png');
                  fs.writeFileSync(filePath, buf);
                  clipboard.writeImage(nativeImage.createFromBuffer(buf));
                  resolve({ success: true, filePath });
                }).catch((err) => {
                  resolve({ success: false, error: 'Download failed: ' + err.message });
                });
              } else {
                resolve({ success: false, error: 'No image in result' });
              }
              return;
            }

            if (task.status === 'failed') {
              resolve({ success: false, error: task.error?.message || 'Task failed' });
              return;
            }

            if (task.status === 'cancelled') {
              resolve({ success: false, error: 'Task cancelled' });
              return;
            }

            // Still processing
            if (attempts >= maxAttempts) {
              resolve({ success: false, error: 'Task timeout' });
              return;
            }

            setTimeout(poll, 2000);
          } catch (e) {
            resolve({ success: false, error: e.message });
          }
        });
      }).on('error', (e) => {
        if (attempts >= maxAttempts) {
          resolve({ success: false, error: 'Task query failed: ' + e.message });
          return;
        }
        setTimeout(poll, 2000);
      });
    };

    poll();
  });
}

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 120000 }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject).on('timeout', () => {
      reject(new Error('download timeout'));
    });
  });
}

ipcMain.handle('close-app', () => app.quit());

ipcMain.handle('get-api-key', () => API_KEY);

ipcMain.handle('set-api-key', (_, key) => {
  API_KEY = key;
  const { API_KEY_FILE: keyFile } = getPaths();
  try {
    const config = { apiKey: key, apiType: API_TYPE };
    fs.writeFileSync(keyFile, JSON.stringify(config, null, 2));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-api-type', () => API_TYPE);

ipcMain.handle('get-version', () => app.getVersion());

ipcMain.handle('set-api-type', (_, type) => {
  API_TYPE = type;
  const { API_KEY_FILE: keyFile } = getPaths();
  try {
    const config = { apiKey: API_KEY, apiType: type };
    fs.writeFileSync(keyFile, JSON.stringify(config, null, 2));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-token-balance', async () => {
  if (!API_KEY) return null;
  return new Promise((resolve) => {
    const req = https.get('https://api.apib.ai/v1/balance', {
      headers: { 'Authorization': 'Bearer ' + API_KEY },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.code === 200 && json.data) {
            resolve({
              balance: json.data.remain_credits ?? json.data.balance ?? null,
              unlimitedQuota: json.data.unlimited_quota ?? false,
            });
          } else if (json.success) {
            resolve({
              balance: json.remain_credits ?? json.remain_balance ?? null,
              unlimitedQuota: json.unlimited_quota ?? false,
            });
          } else {
            resolve(null);
          }
        } catch (_) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
});

ipcMain.handle('read-clipboard-text', () => {
  return clipboard.readText() || '';
});

ipcMain.handle('get-history-images', () => {
  const { OUTPUT_DIR } = getPaths();
  try {
    if (!fs.existsSync(OUTPUT_DIR)) return [];
    const files = fs.readdirSync(OUTPUT_DIR)
      .filter(f => f.endsWith('.png'))
      .map(f => {
        const fullPath = path.join(OUTPUT_DIR, f);
        const stat = fs.statSync(fullPath);
        return { path: fullPath, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 5);

    return files.map(f => {
      try {
        const img = nativeImage.createFromPath(f.path);
        const thumb = img.resize({ width: 72 });
        return { path: f.path, thumbnail: thumb.toDataURL() };
      } catch (_) {
        return null;
      }
    }).filter(Boolean);
  } catch (e) {
    return [];
  }
});

ipcMain.on('start-drag-file', (event, filePath) => {
  try {
    const img = nativeImage.createFromPath(filePath);
    event.sender.startDrag({
      file: filePath,
      icon: img.resize({ width: 64, height: 64 }),
    });
  } catch (_) {}
});

ipcMain.handle('set-window-height', (_, height) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setSize(560, height);
  }
});

ipcMain.handle('paste-image', () => {
  // 1. Try reading image data directly from clipboard
  let img = clipboard.readImage();
  if (!img.isEmpty()) {
    const size = img.getSize();
    return { dataUrl: img.toDataURL(), size: `${size.width}x${size.height}` };
  }

  // 2. Try reading image data from file list (CF_HDROP) - e.g. file explorer copy
  try {
    const filePaths = clipboard.readFilePaths ? clipboard.readFilePaths() : [];
    if (filePaths.length > 0) {
      const filePath = filePaths[0];
      const ext = path.extname(filePath).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico'].includes(ext)) {
        const loadedImg = nativeImage.createFromPath(filePath);
        if (!loadedImg.isEmpty()) {
          const size = loadedImg.getSize();
          return { dataUrl: loadedImg.toDataURL(), size: `${size.width}x${size.height}` };
        }
      }
    }
  } catch (_) {}

  // 3. Fallback: try reading HTML to extract image src (e.g. browser copy)
  try {
    const html = clipboard.readHTML();
    if (html) {
      const match = html.match(/<img[^>]+src=["']data:image\/[^"']+["']/i);
      if (match) {
        const srcMatch = match[0].match(/src=["']([^"']+)["']/);
        if (srcMatch) {
          const fallbackImg = nativeImage.createFromBuffer(Buffer.from(srcMatch[1], 'base64'));
          if (!fallbackImg.isEmpty()) {
            const size = fallbackImg.getSize();
            return { dataUrl: fallbackImg.toDataURL(), size: `${size.width}x${size.height}` };
          }
        }
      }
    }
  } catch (_) {}

  return null;
});
