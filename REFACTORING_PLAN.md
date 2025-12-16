# Popup 文件拆分规划方案

## 📊 当前状态分析

### 文件大小
- `popup.js`: 3403 行
- `popup.html`: 442 行  
- `popup.css`: 2612 行
- **总计**: 6457 行

### 模态框识别
1. **EditModal** - 编辑二维码模态框（~200行 JS，~150行 HTML，~300行 CSS）
2. **ScanModal** - 扫描二维码模态框（~400行 JS，~90行 HTML，~200行 CSS）
3. **HistoryModal** - 历史记录模态框（~300行 JS，~25行 HTML，~250行 CSS）
4. **UploadDriveModal** - 上传到Google Drive模态框（~600行 JS，~105行 HTML，~400行 CSS）
5. **UserInfoModal** - 用户信息模态框（~150行 JS，~30行 HTML，~150行 CSS）
6. **ConfirmModal** - 确认清除对话框（~50行 JS，~15行 HTML，~50行 CSS）

## 🎯 拆分目标

### 目录结构
```
src/
├── modals/                    # 模态框模块目录
│   ├── base-modal.js         # 基础模态框类（通用功能）
│   ├── edit-modal.js         # 编辑二维码模态框
│   ├── scan-modal.js         # 扫描二维码模态框
│   ├── history-modal.js      # 历史记录模态框
│   ├── upload-drive-modal.js # 上传到Google Drive模态框
│   ├── user-info-modal.js    # 用户信息模态框
│   └── confirm-modal.js      # 确认对话框
├── styles/                    # 样式文件目录
│   ├── modals/               # 模态框样式目录
│   │   ├── base-modal.css    # 基础模态框样式
│   │   ├── edit-modal.css    # 编辑模态框样式
│   │   ├── scan-modal.css    # 扫描模态框样式
│   │   ├── history-modal.css # 历史记录模态框样式
│   │   ├── upload-drive-modal.css # 上传模态框样式
│   │   ├── user-info-modal.css    # 用户信息模态框样式
│   │   └── confirm-modal.css      # 确认对话框样式
│   └── popup-main.css        # 主界面样式（从popup.css提取）
├── popup.js                   # 主文件（简化后，预计~1500行）
├── popup.html                 # 主HTML文件（保持，或拆分模板）
└── popup.css                  # 主样式文件（简化后，仅包含主界面样式）
```

## 📋 详细拆分计划

### 阶段1: 基础架构搭建

#### 1.1 创建 BaseModal 类
**文件**: `src/modals/base-modal.js`
**职责**:
- 提供模态框的通用功能（显示/隐藏、关闭、点击外部关闭）
- 处理国际化（i18n）
- 提供事件系统
- 管理模态框状态

**API设计**:
```javascript
class BaseModal {
    constructor(modalId, options = {})
    show()
    hide()
    reset()
    on(event, callback)
    emit(event, data)
    initI18n()
}
```

#### 1.2 创建基础样式
**文件**: `src/styles/modals/base-modal.css`
**内容**:
- 模态框容器样式（.modal）
- 模态框内容样式（.modal-content）
- 模态框头部/底部样式（.modal-header, .modal-footer）
- 关闭按钮样式（.close-btn）
- 深色模式支持

### 阶段2: 拆分各个模态框

#### 2.1 EditModal（编辑二维码模态框）
**文件**: 
- `src/modals/edit-modal.js`
- `src/styles/modals/edit-modal.css`

**功能**:
- 颜色设置（前景色/背景色）
- 尺寸设置（宽度/高度）
- Logo设置（内置Logo选择、自定义Logo上传、透明度）
- 应用/重置/取消操作

**依赖**:
- BaseModal
- QRCodePopup主类（通过回调或事件通信）

**提取的代码范围**:
- `showEditModal()` 方法
- `initBuiltinLogoGrid()` 方法
- `selectBuiltinLogo()` 方法
- `handleLogoFileSelect()` 方法
- `updateLogoSelectionState()` 方法
- `removeLogoFile()` 方法
- `applyEdit()` 方法
- `resetEdit()` 方法
- 相关事件绑定（setupModalEvents中的edit部分）

#### 2.2 ScanModal（扫描二维码模态框）
**文件**:
- `src/modals/scan-modal.js`
- `src/styles/modals/scan-modal.css`

**功能**:
- Tab切换（本地文件/URL）
- 文件上传扫描
- URL扫描
- 扫描结果显示
- 复制/打开操作

**依赖**:
- BaseModal
- jsQR库

**提取的代码范围**:
- `showScanModal()` 方法
- `resetScanModal()` 方法
- `switchScanTab()` 方法
- `handleScanFileUpload()` 方法
- `handleScanUrl()` 方法
- `scanQRCodeFromImage()` 方法
- `displayScanResult()` 方法
- 相关事件绑定

#### 2.3 HistoryModal（历史记录模态框）
**文件**:
- `src/modals/history-modal.js`
- `src/styles/modals/history-modal.css`

**功能**:
- Tab切换（已生成/已扫描）
- 历史记录列表渲染
- 历史记录项操作（复制、删除、重新生成）
- 清除所有历史记录

**依赖**:
- BaseModal
- ConfirmModal（用于确认清除）

**提取的代码范围**:
- `showHistoryModal()` 方法
- `renderGeneratedHistory()` 方法
- `renderScannedHistory()` 方法
- `switchHistoryTab()` 方法
- `copyHistoryContent()` 方法
- `deleteHistoryItem()` 方法
- `clearAllHistory()` 方法
- `loadHistory()` 方法
- `saveHistory()` 方法
- 相关事件绑定

#### 2.4 UploadDriveModal（上传到Google Drive模态框）
**文件**:
- `src/modals/upload-drive-modal.js`
- `src/styles/modals/upload-drive-modal.css`

**功能**:
- 授权登录界面
- 文件/文件夹选择
- 上传方式选择（文件/文件夹）
- 可见性设置
- 文件上传进度
- 上传结果展示

**依赖**:
- BaseModal
- GoogleDriveAPI
- UserInfoModal（用于显示用户信息）

**提取的代码范围**:
- `showUploadDriveModal()` 方法
- `resetUploadModal()` 方法
- `showAuthSection()` 方法
- `showUploadSection()` 方法
- `handleGoogleSignIn()` 方法
- `handleFileSelect()` 方法
- `handleFolderSelect()` 方法
- `updateUploadMode()` 方法
- `uploadFilesToDrive()` 方法
- `loadUserAvatar()` 方法
- `updateUploadButtonAuthState()` 方法
- 相关事件绑定

#### 2.5 UserInfoModal（用户信息模态框）
**文件**:
- `src/modals/user-info-modal.js`
- `src/styles/modals/user-info-modal.css`

**功能**:
- 显示用户信息（头像、姓名、邮箱）
- 打开Drive文件夹
- 退出登录
- 撤销Google授权

**依赖**:
- BaseModal
- GoogleDriveAPI

**提取的代码范围**:
- `showUserInfoModal()` 方法
- `hideUserInfoModal()` 方法
- `handleOpenDriveFolder()` 方法
- `handleLogoutDrive()` 方法
- `handleRevokeGoogleAuth()` 方法
- 相关事件绑定

#### 2.6 ConfirmModal（确认对话框）
**文件**:
- `src/modals/confirm-modal.js`
- `src/styles/modals/confirm-modal.css`

**功能**:
- 通用确认对话框
- 自定义标题和内容
- 确认/取消操作

**依赖**:
- BaseModal

**提取的代码范围**:
- `showConfirmModal()` 方法（如果存在）
- 确认清除历史记录的相关逻辑

### 阶段3: 重构主文件

#### 3.1 重构 popup.js
**目标**: 简化主文件，通过模块化方式使用各个模态框

**主要变更**:
- 移除已拆分的模态框方法
- 导入各个模态框模块
- 初始化各个模态框实例
- 保持主业务逻辑（QR码生成、下载、复制等）

**保留的核心功能**:
- QR码生成逻辑
- 下载/复制功能
- 主界面事件绑定
- 设置管理
- 历史记录存储（通过HistoryModal管理）

#### 3.2 更新 popup.html
**选项A**: 保持HTML在一个文件中（推荐）
- 保持所有模态框HTML在popup.html中
- 通过script标签引入各个模态框JS文件

**选项B**: 拆分HTML模板
- 将每个模态框HTML提取到独立文件
- 通过JavaScript动态加载（增加复杂度，不推荐）

#### 3.3 更新 popup.css
**变更**:
- 移除已拆分的模态框样式
- 保留主界面样式
- 通过@import引入各个模态框样式文件

## 🔄 通信机制

### 模态框与主类通信
**方式1: 回调函数**（推荐）
```javascript
// 在popup.js中
const editModal = new EditModal('edit-modal', {
    onApply: (options) => {
        // 应用编辑选项
        this.qrOptions = options;
        this.createQRCode(this.currentContent, this.currentType);
    }
});
```

**方式2: 事件系统**
```javascript
// 在popup.js中
editModal.on('apply', (options) => {
    this.qrOptions = options;
    this.createQRCode(this.currentContent, this.currentType);
});

// 在EditModal中
this.emit('apply', this.getOptions());
```

**方式3: 直接访问主类实例**
```javascript
// 在popup.js中
const editModal = new EditModal('edit-modal', {
    popupInstance: this
});
```

## 📦 模块依赖关系

```
popup.js (主文件)
├── BaseModal (基础类)
├── EditModal
│   └── BaseModal
├── ScanModal
│   └── BaseModal
├── HistoryModal
│   ├── BaseModal
│   └── ConfirmModal
│       └── BaseModal
├── UploadDriveModal
│   ├── BaseModal
│   ├── GoogleDriveAPI
│   └── UserInfoModal
│       └── BaseModal
└── UserInfoModal
    └── BaseModal
```

## ✅ 实施步骤

1. **创建目录结构**
   - 创建 `src/modals/` 目录
   - 创建 `src/styles/modals/` 目录

2. **实现BaseModal**
   - 创建基础模态框类和样式
   - 测试基础功能

3. **逐个拆分模态框**（按复杂度从低到高）
   - ConfirmModal（最简单）
   - UserInfoModal
   - EditModal
   - HistoryModal
   - ScanModal
   - UploadDriveModal（最复杂）

4. **重构主文件**
   - 更新popup.js导入和使用各个模态框
   - 更新popup.html引入样式和脚本
   - 更新popup.css移除已拆分样式

5. **测试验证**
   - 确保所有功能正常工作
   - 检查深色模式
   - 检查国际化

## 🎨 代码组织原则

1. **单一职责**: 每个模态框类只负责自己的功能
2. **依赖注入**: 通过构造函数注入依赖
3. **事件驱动**: 使用事件系统解耦
4. **可扩展性**: 便于添加新模态框
5. **向后兼容**: 保持现有API不变

## 📝 注意事项

1. **保持向后兼容**: 确保现有功能不受影响
2. **国际化支持**: 所有模态框都需要支持i18n
3. **深色模式**: 所有样式都需要支持深色模式
4. **错误处理**: 每个模态框都需要适当的错误处理
5. **性能优化**: 避免不必要的DOM操作和重绘

## 🚀 预期收益

1. **代码可维护性**: 每个模态框独立，易于维护
2. **代码可读性**: 文件更小，逻辑更清晰
3. **代码复用**: BaseModal可被所有模态框复用
4. **团队协作**: 不同开发者可以并行开发不同模态框
5. **测试友好**: 每个模态框可以独立测试

