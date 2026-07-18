# Remix Mini - 开发日志

## 项目概况
- **名称**: Remix Mini
- **版本**: v1.3.2
- **框架**: Electron v28.3.3
- **模型**: Gemini 3.1 Flash Image Preview / Agnes Image 2.1 Flash
- **平台**: Windows x64

---

## 版本历史

### v1.3.2 - 2026/07/17

#### 优化
| 变更 | 说明 |
|------|------|
| 版本号可读性 | 版本号文字颜色加深，提升辨识度 |

#### 打包产物
- `Remix Mini Setup 1.3.2.exe` - NSIS 安装包（已发布到 GitHub Release）

---

### v1.3.1 - 2026/07/17

#### 新功能
| 变更 | 说明 |
|------|------|
| 版本号显示 | 标题栏右侧显示当前版本号（如 v1.3.1） |
| GitHub 自动更新 | 启动 3 秒后检测 GitHub Release 新版本，后台静默下载，完成后弹窗提示安装 |

#### 修复
| 变更 | 说明 |
|------|------|
| 余额数据源修正 | 改用 `remain_credits`（积分）替代 `remain_balance`（余额），与后台显示一致 |
| 余额显示修正 | 积分 × 1.2 后显示，解决实际余额 16.36 显示为 1.96 的问题 |

#### 技术实现
- `main.js`: API 响应优先取 `remain_credits`，兼容两种返回格式；集成 `electron-updater` 自动更新
- `renderer.js`: 保持 × 1.2 系数，使用积分基数计算；加载时显示版本号
- `preload.js`: 新增 `getVersion` IPC 桥接
- `package.json`: 新增 `publish` 配置指向 GitHub 仓库

#### 打包产物
- `Remix Mini Setup 1.3.1.exe` - NSIS 安装包（已发布到 GitHub Release）

---

### v1.3.0 - 2026/07/17

#### 新功能
| 变更 | 说明 |
|------|------|
| 令牌余额查询 | PRO 模式下右下角显示 API 余额，每次生成图片后自动刷新 |
| 余额显示规则 | 有限额度显示数值（×1.2），无限额度显示 ∞，FREE 模式不显示 |

#### 技术实现
- `get-token-balance` IPC: 调用 `api.apib.ai/v1/balance` 查询当前 API Key 余额
- 余额显示位置: 工具栏右下角，灰色小字（14px），`position: absolute`
- 触发时机: 应用启动（PRO 模式）、切换到 PRO、每次图片生成成功后

#### 打包产物
- `Remix Mini Setup 1.3.0.exe` - NSIS 安装包

---

### v1.2.0 - 2026/07/17

#### 新功能
| 变更 | 说明 |
|------|------|
| 生成历史 | 工具栏底部显示最近 5 张生成图片的缩略图 |
| 文件拖拽 | 缩略图可直接拖入 PS、PPT 等软件，等同于拖拽文件 |
| 动态窗口高度 | 窗口高度自动匹配内容，无多余空白 |

#### 技术实现
- `get-history-images` IPC: 读取 output 目录，返回最近 5 张 PNG 缩略图（72px base64）
- `start-drag-file` IPC: 调用 Electron 原生 `webContents.startDrag()` 实现跨应用文件拖拽
- `new-image-generated` 事件: 生成成功后自动通知渲染进程更新历史
- `set-window-height` IPC: 动态调整窗口高度，`scrollHeight` 精确匹配工具栏内容
- 关闭原生窗口阴影 (`shadow: false`)，移除 status 区域 `min-height` 避免空白

#### 打包产物
- `Remix Mini Setup 1.2.0.exe` - NSIS 安装包

---

### v1.1.1 - 2026/07/16

#### 更新
| 变更 | 说明 |
|------|------|
| PRO 模型升级 | Gemini 2.5 → 3.1，更强的图像生成能力 |
| 新增分辨率参数 | 默认 resolution: "1K" |
| 端点保持 | api.apib.ai（api.apimart.ai 不可用，已回退） |

#### API 配置 (最终)
| API | 端点 | 模型 | Key |
|-----|------|------|-----|
| Gemini (PRO) | api.apib.ai | gemini-3.1-flash-image-preview | 需用户配置 |
| Agnes (FREE) | apihub.agnes-ai.com | agnes-image-2.1-flash | 内置 (免费) |

#### 打包产物
- `Remix Mini Setup 1.1.1.exe` - NSIS 安装包 (约 105MB)

---

### v1.1.0 - 2026/07/16

#### 新功能
| 变更 | 说明 |
|------|------|
| 双 API 支持 | 支持 Gemini 和 Agnes 两个 API 切换使用 |
| Agnes API 内置 | 免费 API 内置 Key，无需用户配置 |
| API 切换界面 | 设置栏新增 PRO/FREE 切换按钮 |

#### 技术实现
- Gemini API: 异步模式（提交任务 → 轮询状态 → 下载图片）
- Agnes API: 同步模式（直接返回图片 URL）
- 比例映射: 4:5 → 3:4, 5:4 → 4:3（适配 Agnes 支持的比例）
- 图生图尺寸: 使用精确像素（1312x736 等），而非档位 + ratio 组合

#### Agnes API 尺寸映射 (1K 档位)
| 比例 | 尺寸 |
|------|------|
| 1:1 | 1024x1024 |
| 2:3 | 832x1248 |
| 3:2 | 1248x832 |
| 3:4 | 864x1152 |
| 4:3 | 1152x864 |
| 9:16 | 736x1312 |
| 16:9 | 1312x736 |

#### 打包产物
- `Remix Mini Setup 1.1.0.exe` - NSIS 安装包 (约 105MB)

---

### v1.0.5 - 2026/07/16

#### 更新
| 变更 | 说明 |
|------|------|
| 替换应用图标 | 使用 mini.png 作为新 Logo |

#### 打包产物
- `Remix Mini Setup 1.0.5.exe` - NSIS 安装包 (约 105MB)

---

### v1.0.4 - 2026/07/16

#### 优化
| 变更 | 说明 |
|------|------|
| 保留提示词 | 生成图像后不再清空输入框，便于连续生成 |

#### 打包产物
- `Remix Mini Setup 1.0.4.exe` - NSIS 安装包 (约 105MB)

---

### v1.0.3 - 2026/07/16

#### 品牌更新
| 变更 | 说明 |
|------|------|
| 软件名称 | Agnes Image → Remix Mini |
| 界面标题 | AGNES → REMIX MINI |
| 输出文件名 | agnes_*.png → remix_*.png |
| 应用标识 | com.agens.image-tool → com.remix-mini.image-tool |

#### 安全改进
| 变更 | 说明 |
|------|------|
| 移除硬编码 API Key | 首次运行需在设置中配置 API Key，不再内置默认密钥 |

#### 打包产物
- `Remix Mini Setup 1.0.3.exe` - NSIS 安装包 (约 105MB)

---

### v1.0.2 - 2026/06/18

#### 新功能
| 功能 | 说明 |
|------|------|
| 多比例截图 | 支持 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9，按 Q 键切换 |
| 比例自动匹配 | 粘贴图片时按像素尺寸自动匹配最接近的预设比例 |
| 比例传递 API | 截图比例通过 API size 字段传递给 Gemini 模型 |
| 剪贴板粘贴 | Ctrl+V 从剪贴板获取图片，支持图像/文件/HTML 三种格式 |
| 设置弹窗 | 可在界面内修改 API Key 并持久化保存 |
| 横条设置栏 | 设置界面从弹窗改为工具栏下方横条，粘贴和保存按钮同排显示 |
| 粘贴按钮 | API Key 输入框旁增加粘贴按钮，避免 Ctrl+V 冲突 |

#### Bug 修复
| 问题 | 修复方案 |
|------|----------|
| 打包后输出目录写入失败 (ENOENT) | 输出路径改为 app.getPath('userData')/output |
| API Key 配置在打包后无法读写 | 配置文件移至 userData 目录 |
| 截图后窗口不置顶 | 截图完成时恢复 mainWindow 置顶和聚焦 |
| 截图只有 1:1 比例 | 重写 screenshot.js 支持 9 种比例循环 |
| Ctrl+V 与设置弹窗冲突 | 检查 modal 显示状态，弹窗打开时不触发粘贴 |
| API Key 保存无效 (invalid API key) | ipcMain.handle 签名错误: `(key)` 实际接收的是 IPC event 对象，应改为 `(_, key)`，导致整个 event 对象被 JSON 序列化写入 config.json |
| 截图按钮点击无反应 | 重新绑定事件处理器 |
| Electron 28 没有 hasImage/readBitmap | 仅使用 clipboard.readImage() |
| 设置按钮点击无效果 | 按钮位置从绝对定位移到面板内 |
| 打包超时 | 设置 CSC_IDENTITY_AUTO_DISCOVERY=false，使用国内镜像 |

#### 打包配置
- electron-builder NSIS 安装包
- npmmirror 国内镜像 (npm + electron)
- 自定义 ICO Logo (多尺寸: 16/32/48/256)
- 跳过代码签名检测

---

## 技术决策记录

### API 选型历程
1. 初始使用某图像生成 API (未定)
2. 尝试阿里云千问 - 图像编辑模型
3. 最终选定 api.apib.ai 提供的 Gemini 2.5 Flash Image Preview

### 异步任务设计
- 接口为异步模式: POST 提交任务 → 返回 task_id
- 轮询 task status: 每 2 秒查询一次，最多 60 次 (2 分钟)
- 状态: processing → completed/failed/cancelled
- 完成后下载图片 → 保存到 output 目录 → 写入系统剪贴板

### 路径方案 (打包后兼容)
| 开发模式 | 打包后模式 |
|----------|-----------|
| `__dirname/output` (实际文件系统) | `app.getPath('userData')/output` (AppData) |
| `__dirname/config.json` | `app.getPath('userData')/config.json` |
| asar 内文件只读 | userData 可读写 |

延迟初始化 getPaths() 在 app.whenReady() 后调用，确保 app.getPath('userData') 可用。

### IPC 签名陷阱
`ipcMain.handle('channel', handler)` 的 handler 签名为 `(event, ...args)`：
- 第一个参数始终是 IPC event 对象 (包含 sender, frameId, processId 等)
- 实际传入参数从第二个参数开始
- 错误示例: `ipcMain.handle('set-api-key', (key) => {` → key 是 event 对象，写入 config.json 后变成完整 IPC 事件序列化数据
- 正确写法: `ipcMain.handle('set-api-key', (_, key) => {`

### 比例实现
- 截图时: 用户按 Q 切换 → 选择框实时约束比例 → 发送给 API
- 粘贴时: 读取图片宽高 → 遍历预设比例表 → 取差值最小的

---

## 文件清单

| 文件 | 用途 |
|------|------|
| main.js | Electron 主进程，IPC 处理，API 调用 |
| preload.js | 上下文隔离桥接 |
| renderer.js | 主窗口渲染进程，UI 逻辑 |
| index.html | 主窗口结构 |
| style.css | 主窗口样式 |
| screenshot.js | 截图窗口渲染进程，选区绘制 |
| screenshot.html | 截图窗口结构 |
| package.json | 项目配置 + electron-builder 配置 |
| package-lock.json | 依赖锁定文件 |
| assets/logo.ico | 应用图标 (ICO 格式，多尺寸) |
| assets/logo.png | 应用图标 (PNG 格式) |
| .npmrc | 国内镜像配置 |
| config.json | 用户配置文件 (API Key，运行时生成) |

---

## 已知限制
- 打包体积较大 (~105MB，含 Electron 运行时)
- 无代码签名，Windows SmartScreen 可能拦截
- 轮询 API 为固定间隔，未实现 SSE/WebSocket
- 仅支持 Windows x64

---

## 快速开始

### 安装
```bash
npm install
```

### 运行 (开发模式)
```bash
npm start
```

### 打包
```bash
npm run build:win
```

### 首次使用
1. 启动应用后，点击设置图标配置 API Key
2. 点击截图按钮或 Ctrl+V 粘贴图片
3. 输入提示词，按回车或点击生成按钮
4. 图片自动保存到 output 目录并复制到剪贴板
