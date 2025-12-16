# PixelQR - 二维码生成器与扫描器 | 免费离线二维码工具

<div align="center">

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-blue?logo=googlechrome&logoColor=white&style=for-the-badge)](https://chrome.google.com/webstore/detail/qr-code-generator-scanner/fjhdmehmeknophjlcfanlfmajjaeekol) [![Firefox Add-ons](https://img.shields.io/badge/Firefox%20Add--ons-Install-orange?logo=firefox&logoColor=white&style=for-the-badge)](https://addons.mozilla.org/zh-CN/firefox/addon/best-qr-code/)
[![Version](https://img.shields.io/badge/version-1.0.0-green?style=for-the-badge)](https://chrome.google.com/webstore/detail/qr-code-generator-scanner/fjhdmehmeknophjlcfanlfmajjaeekol)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

<img src="icons/icon128.png" alt="QR Code Generator Icon" width="128" height="128">

**PixelQR 是一款功能强大的浏览器扩展，提供二维码生成、扫描、自定义和 Google Drive 集成功能。核心功能完全离线工作，保护用户隐私，支持 Chrome、Firefox、Edge 等多种浏览器。**

</div>


## 📸 功能截图

<div align="center">

### 主页面 - 一键生成当前页面二维码
<img src="images/1-1.png" alt="主页面截图" width="800">

### 自定义页面 - 支持Logo和颜色自定义
<img src="images/1-2.png" alt="自定义页面截图" width="800">

### 扫描页面 - 上传图片识别二维码
<img src="images/1-3.png" alt="扫描页面截图" width="800">

### 历史记录 - 查看生成和扫描历史
<img src="images/1-4.png" alt="历史记录页面截图" width="800">

</div>

## 🌟 功能特性

### 🆕 最新功能

#### 创建本地文件/文件夹二维码以方便分享
- **文件上传**：将文件或文件夹上传到 Google Drive，自动生成分享链接二维码
- **可见性控制**：可选择文件可见性（仅所有者或任何有链接的人）
- **批量处理**：支持同时上传多个文件或整个文件夹
- **自动生成二维码**：上传后自动为分享链接生成二维码，方便快速分享

#### 内置 Logo 支持
- **预设图标**：提供 12 种热门平台内置 Logo（Instagram、YouTube、微信、Telegram 等）
- **快速美化**：一键选择内置 Logo，快速美化二维码
- **自定义上传**：仍支持上传自定义 Logo 图片
- **透明度调节**：可调整 Logo 透明度，确保二维码可扫描性

#### URL 扫描功能
- **远程扫描**：支持通过输入图片 URL 远程扫描二维码
- **本地扫描**：继续支持上传本地图片文件进行扫描
- **智能识别**：自动识别二维码内容类型并显示结果

#### 自动适配系统深色模式
- **智能切换**：自动检测系统主题设置，无缝适配深色/浅色模式
- **护眼体验**：深色模式下提供舒适的视觉体验，减少眼部疲劳
- **完美适配**：界面元素自动调整，确保在任何模式下都清晰易读

### 核心功能

#### 二维码生成
- **当前页面二维码**：一键为当前浏览的网页生成二维码
- **自定义文本二维码**：支持为任意文本内容生成二维码
- **右键菜单集成**：在网页上右键选择文本、链接或图片即可生成二维码
- **快捷键支持**：
  - `Ctrl+Shift+Q` (Windows/Linux) / `Cmd+Shift+Q` (Mac)：为当前页面生成二维码
  - `Ctrl+Shift+T` (Windows/Linux) / `Cmd+Shift+T` (Mac)：为选中文本生成二维码

#### 二维码自定义
- **颜色自定义**：支持自定义前景色和背景色，打造个性化二维码
- **尺寸调整**：可调整二维码的宽度和高度（120px-1024px），适应不同使用场景
- **Logo 集成**：支持内置 Logo 或上传自定义 Logo 到二维码中心
- **Logo 透明度**：可调整 Logo 的透明度（0-100%），确保二维码可扫描性

#### 二维码扫描
- **本地图片上传**：支持上传二维码图片文件进行扫描
- **URL 扫描**：支持通过图片 URL 远程扫描二维码
- **智能识别**：自动识别二维码内容类型（URL、文本等）
- **结果操作**：支持复制扫描结果或直接打开链接

#### 历史记录
- **生成历史**：自动记录所有生成的二维码，方便快速访问
- **扫描历史**：记录所有扫描的二维码内容
- **快速操作**：从历史记录中快速重新生成或复制二维码

### 其他功能
- **离线优先**：核心的二维码生成和扫描功能完全离线工作，无需网络连接
- **多浏览器支持**：支持 Chrome、Firefox、Edge 浏览器
- **一键下载**：支持将二维码保存为 PNG 图片
- **一键复制**：支持复制二维码图片到剪贴板
- **多语言支持**：支持 12 种语言，自动根据浏览器语言设置显示


### 🎯 快速安装

**推荐方式**：直接点击上方按钮从官方商店安装
- [Chrome Web Store](https://chrome.google.com/webstore/detail/qr-code-generator-scanner/fjhdmehmeknophjlcfanlfmajjaeekol) - 一键安装
- [Firefox Add-ons](https://addons.mozilla.org/zh-CN/firefox/addon/best-qr-code/) - 一键安装

**开发者模式**：如需从源码安装，请参考下方详细步骤

## 🚀 安装方法

### Chrome浏览器
1. 下载或克隆此项目
2. 运行构建命令：`npm run build:chrome`
3. 打开Chrome浏览器，进入 `chrome://extensions/`
4. 开启"开发者模式"
5. 点击"加载已解压的扩展程序"
6. 选择 `dist/chrome` 文件夹

### Firefox浏览器
1. 下载或克隆此项目
2. 运行构建命令：`npm run build:firefox`
3. 打开Firefox浏览器，进入 `about:debugging`
4. 点击"此Firefox"
5. 点击"临时载入附加组件"
6. 选择 `dist/firefox/manifest.json` 文件

### Edge浏览器
1. 下载或克隆此项目
2. 运行构建命令：`npm run build:edge`
3. 打开Edge浏览器，进入 `edge://extensions/`
4. 开启"开发人员模式"
5. 点击"加载解压缩的扩展"
6. 选择 `dist/edge` 文件夹

## 📦 打包发布

### 构建所有浏览器版本
```bash
npm run build:all
```

### 打包为发布文件
```bash
# 打包Chrome版本
npm run pack:chrome

# 打包Firefox版本
npm run pack:firefox

# 打包Edge版本
npm run pack:edge

# 打包所有版本
npm run pack:all
```

打包后的文件将保存在 `build/` 目录中：
- `chrome.zip` - Chrome扩展包
- `firefox.xpi` - Firefox扩展包
- `edge.zip` - Edge扩展包

## 🛠️ 开发指南

### 环境要求
- Node.js 14.0+
- npm 6.0+

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```

### 项目结构
```
chrome-extension-qrcode/
├── src/                    # 源代码目录
│   ├── popup.html         # 弹窗页面
│   ├── popup.css          # 弹窗样式
│   ├── popup.js           # 弹窗逻辑
│   ├── background.js      # 后台脚本
│   └── content.js         # 内容脚本
├── manifest/              # 浏览器配置文件
│   ├── chrome.json        # Chrome配置
│   ├── firefox.json       # Firefox配置
│   └── edge.json          # Edge配置
├── libs/                  # 第三方库
│   ├── qrcode.js          # 二维码生成库
│   ├── qrcode-with-logo.js # 带Logo的二维码生成
│   ├── jsqr.js            # 二维码扫描库
│   └── jsqr-improve.js    # 改进的扫描库
├── icons/                 # 扩展图标
├── asserts/               # 资源文件
├── images/                # 图片资源
├── webpack.config.js      # Webpack配置
└── package.json           # 项目配置
```

### 技术栈
- **前端**：HTML5, CSS3, JavaScript (ES6+)
- **构建工具**：Webpack 5
- **二维码生成**：qrcode.js
- **二维码扫描**：jsQR
- **浏览器API**：Chrome Extensions API, Web Extensions API

### 浏览器兼容性
- **Chrome**：Manifest V3
- **Firefox**：Manifest V2
- **Edge**：Manifest V3

## 📝 使用说明

### 基本使用
1. 点击浏览器工具栏中的扩展图标
2. 扩展会自动为当前页面生成二维码
3. 使用各种按钮进行下载、复制、编辑等操作

### 自定义二维码
1. 点击"Edit QR Code"按钮
2. 在弹出窗口中调整颜色、尺寸、Logo等设置
3. 点击"Apply"应用更改

### 扫描二维码
1. 点击"Scan QR Code"按钮
2. 上传包含二维码的图片文件
3. 查看扫描结果并选择复制或打开

### 查看历史
1. 点击历史记录图标
2. 在"Generated"标签中查看生成历史
3. 在"Scanned"标签中查看扫描历史

## 🔧 配置说明

### 权限说明
- `activeTab`：访问当前活动标签页
- `contextMenus`：创建右键菜单
- `storage`：存储用户数据
- `downloads`：下载文件
- `tabs`：访问标签页信息
- `http://*/*`, `https://*/*`：访问网页内容

### 快捷键配置
可在 `manifest/*.json` 文件中的 `commands` 部分修改快捷键设置。

## 🤝 贡献指南

1. Fork 此项目
2. 创建功能分支：`git checkout -b feature/AmazingFeature`
3. 提交更改：`git commit -m 'Add some AmazingFeature'`
4. 推送到分支：`git push origin feature/AmazingFeature`
5. 提交Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [qrcode.js](https://github.com/davidshimjs/qrcodejs) - 二维码生成库
- [jsQR](https://github.com/cozmo/jsQR) - 二维码扫描库
- 所有贡献者和用户的支持

---

**隐私说明**：核心的二维码生成和扫描功能完全在本地完成，不会收集或上传任何用户数据。Google Drive 功能需要网络连接，仅在用户主动使用时才会连接 Google 服务，保护您的隐私安全。
