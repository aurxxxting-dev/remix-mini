# Remix Mini

截图 + AI 图像生成工具，基于 Gemini 2.5 Flash Image Preview API。

## 功能

- 截图 + AI 图像生成
- 支持多种宽高比 (1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9)
- 剪贴板粘贴图片
- 自动保存并复制到剪贴板

## 安装

```bash
npm install
```

## 运行

```bash
npm start
```

## 打包

```bash
npm run build:win
```

## 使用

1. 首次运行点击设置图标配置 API Key
2. 点击截图按钮或 Ctrl+V 粘贴图片
3. 输入提示词，按回车或点击生成按钮
4. 图片自动保存到 `output/` 并复制到剪贴板

有截图时为图生图，无截图时为文生图。

## 快捷键

- `Ctrl+V` - 粘贴图片
- `Enter` - 生成图像
- `Q` - 切换截图比例 (截图时)
- `ESC` - 取消截图
