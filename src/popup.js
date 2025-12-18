// QR Code Generator Chrome Extension - Popup Script

const browserApi = require('./utils/browser-api');
const GoogleDriveAPI = require('./utils/google-drive-api');

// Modal Classes
const BaseModal = require('./modals/base-modal');
const ConfirmModal = require('./modals/confirm-modal');
const UserInfoModal = require('./modals/user-info-modal');
const EditModal = require('./modals/edit-modal');
const ScanModal = require('./modals/scan-modal');
const HistoryModal = require('./modals/history-modal');
const UploadDriveModal = require('./modals/upload-drive-modal');

class QRCodePopup {
    constructor() {
        this.currentQRCode = null;
        this.currentCanvas = null;
        this.currentContent = '';
        this.currentType = 'url';
        this.qrOptions = {
            foreground: '#000000',
            background: '#FFFFFF',
            width: 512, // 默认尺寸512px（包含20px边框）
            height: 512, // 默认尺寸512px（包含20px边框）
            margin: 10,
            logo: null,
            logoOpacity: 100,
            builtinLogo: null // 内置 logo 路径
        };
        
        // 内置 logo 文件名列表（直接写死，12个，两行，每行6个）
        this.builtinLogoFiles = [
            'instagram.svg',
            'line.svg',
            'linkedin.svg',
            'spotify.svg',
            'telegram.svg',
            'vimeo.svg',
            'vkontakte.svg',
            'wechat.svg',
            'whatsapp.svg',
            'x.svg',
            'youtube.svg',
            'zoom.svg'
        ];
        
        // 历史记录相关
        this.history = {
            generated: [],
            scanned: []
        };
        
        // Google Drive API实例
        this.googleDriveAPI = new GoogleDriveAPI();
        // selectedFiles和selectedFolders已移至UploadDriveModal
        this.uploadMode = 'file'; // 上传模式：'file' 或 'folder'（用于保存设置）
        this.defaultVisibility = 'anyone'; // 默认可见性（用于保存设置）
        
        // 初始化模态框实例（将在init中完成）
        this.modals = {};
        
        this.init();
    }

    async init() {
        this.initI18n();
        this.initModals();
        this.bindEvents();
        this.loadSettings();
        this.loadHistory();
        
        // 检查是否有待处理的授权操作（授权过程中popup关闭的情况）
        await this.checkPendingAuth();
        
        // 初始化时检查登录状态并更新上传按钮样式
        await this.updateUploadButtonAuthState();
        
        // 检查是否有待扫描的图片URL（来自右键菜单）
        const hasPendingScan = await this.checkPendingScanUrl();
        
        // 如果没有待扫描的URL，检查是否有待处理的二维码数据（来自右键菜单）
        if (!hasPendingScan) {
            await this.checkPendingQRData();
        }
        
        // 聚焦到URL输入框的末尾
        this.focusUrlInput();
    }
    
    /**
     * 初始化所有模态框
     */
    initModals() {
        // 初始化ConfirmModal
        this.modals.confirm = new ConfirmModal('confirm-clear-modal', {
            onConfirm: () => {
                if (this.modals.history) {
                    this.modals.history.clearAllHistory();
                }
            }
        });
        
        // 初始化UserInfoModal
        this.modals.userInfo = new UserInfoModal('user-info-modal', {
            googleDriveAPI: this.googleDriveAPI,
            showMessage: (msg, type) => this.showMessage(msg, type),
            onLogout: () => {
                // 登出后的处理
                const avatarContainer = document.getElementById('user-avatar-container');
                if (avatarContainer) avatarContainer.style.display = 'none';
                if (this.modals.uploadDrive) {
                    this.modals.uploadDrive.showAuthSection();
                }
                this.updateUploadButtonAuthState(false);
            }
        });
        
        // 初始化EditModal
        this.modals.edit = new EditModal('edit-modal', {
            qrOptions: this.qrOptions,
            builtinLogoFiles: this.builtinLogoFiles,
            onApply: (options) => {
                this.qrOptions = options;
                this.saveSettings();
                if (this.currentContent) {
                    this.createQRCode(this.currentContent, this.currentType);
                }
            },
            onReset: (options) => {
                this.qrOptions = options;
                if (this.currentContent) {
                    this.createQRCode(this.currentContent, this.currentType);
                }
            },
            onCreateQRCode: () => {
                if (this.currentContent) {
                    this.createQRCode(this.currentContent, this.currentType);
                }
            }
        });
        
        // 初始化ScanModal
        this.modals.scan = new ScanModal('scan-modal', {
            onScanComplete: (result) => {
                // 扫描完成后的处理（可选）
            },
            showMessage: (msg, type) => this.showMessage(msg, type),
            addToHistory: (type, record) => this.addToHistory(type, record),
            isUrl: (url) => this.isUrl(url),
            getFaviconUrl: (url) => this.getFaviconUrl(url)
        });
        
        // 初始化HistoryModal
        this.modals.history = new HistoryModal('history-modal', {
            history: this.history,
            onRestore: (content, type) => {
                this.restoreHistoryRecord(content, type);
            },
            onClear: () => {
                this.saveHistory();
            },
            showMessage: (msg, type) => this.showMessage(msg, type),
            formatTime: (timestamp) => this.formatTime(timestamp),
            escapeHtml: (text) => this.escapeHtml(text),
            truncateText: (text, maxLength) => this.truncateText(text, maxLength),
            isUrl: (url) => this.isUrl(url),
            bindImageErrorHandlers: (container) => this.bindImageErrorHandlers(container),
            loadFaviconsForHistory: (type) => this.loadFaviconsForHistory(type),
            confirmModal: this.modals.confirm
        });
        
        // 初始化UploadDriveModal
        this.modals.uploadDrive = new UploadDriveModal('upload-drive-modal', {
            googleDriveAPI: this.googleDriveAPI,
            onCreateQRCode: (content, type) => {
                this.currentContent = content;
                this.currentType = type;
                const urlElement = document.getElementById('current-url');
                if (urlElement) {
                    urlElement.value = content;
                }
                this.createQRCode(content, type);
            },
            showMessage: (msg, type) => this.showMessage(msg, type),
            addToHistory: (type, record) => this.addToHistory(type, record),
            userInfoModal: this.modals.userInfo,
            onUploadComplete: (files, folder) => {
                // 上传完成后的处理（可选）
            }
        });
        
        // 更新HistoryModal的confirmModal引用
        if (this.modals.history) {
            this.modals.history.confirmModal = this.modals.confirm;
        }
    }
    
    /**
     * 检查是否有待处理的授权操作
     * 如果授权过程中popup关闭，重新打开时需要恢复状态
     */
    async checkPendingAuth() {
        try {
            const result = await browserApi.storage.local.get(['pendingAuthAction', 'pendingAuthTimestamp']);
            if (result.pendingAuthAction && result.pendingAuthTimestamp) {
                const timeDiff = Date.now() - result.pendingAuthTimestamp;
                // 如果超过5分钟，清除待处理状态（可能是旧的残留数据）
                if (timeDiff > 5 * 60 * 1000) {
                    await browserApi.storage.local.remove('pendingAuthAction');
                    return;
                }
                
                // 检查是否已授权
                const isAuthenticated = await this.googleDriveAPI.isAuthenticated();
                if (isAuthenticated) {
                    // 授权成功，清除待处理状态
                    await browserApi.storage.local.remove('pendingAuthAction');
                    
                    // 根据操作类型恢复界面
                    // 注意：showUploadSection方法已移至UploadDriveModal，如果用户需要上传，会打开上传模态框
                    // 上传模态框在show()方法中会自动检查授权状态并显示相应的界面
                    if (result.pendingAuthAction === 'signin' || result.pendingAuthAction === 'upload') {
                        this.showMessage(browserApi.i18n.getMessage('success_auth_granted'), 'success');
                        // 更新上传按钮状态
                        await this.updateUploadButtonAuthState(true);
                    }
                }
            }
        } catch (error) {
            // Ignore pending auth check errors
        }
    }

    initI18n() {
        // 设置 HTML 语言和方向
        document.documentElement.lang = browserApi.i18n.getMessage('htmlLang') || 'en';
        document.documentElement.dir = browserApi.i18n.getMessage('htmlDir') || 'ltr';

        // 替换 data-i18n 属性的文本内容
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const messageKey = element.getAttribute('data-i18n');
            const message = browserApi.i18n.getMessage(messageKey);
            if (message) {
                element.textContent = message;
            }
        });

        // 替换 data-i18n-title 属性的 title
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const messageKey = element.getAttribute('data-i18n-title');
            const message = browserApi.i18n.getMessage(messageKey);
            if (message) {
                element.title = message;
            }
        });

        // 替换 data-i18n-placeholder 属性的 placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const messageKey = element.getAttribute('data-i18n-placeholder');
            const message = browserApi.i18n.getMessage(messageKey);
            if (message) {
                element.placeholder = message;
            }
        });

        // 替换 data-i18n-alt 属性的 alt
        document.querySelectorAll('[data-i18n-alt]').forEach(element => {
            const messageKey = element.getAttribute('data-i18n-alt');
            const message = browserApi.i18n.getMessage(messageKey);
            if (message) {
                element.alt = message;
            }
        });
    }

    bindEvents() {
        // 编辑按钮
        document.getElementById('edit-btn').addEventListener('click', () => {
            if (this.modals.edit) {
                // 更新EditModal的二维码选项
                this.modals.edit.updateQROptions(this.qrOptions);
                this.modals.edit.show();
            }
        });

        // 下载按钮
        document.getElementById('download-btn').addEventListener('click', () => {
            this.downloadQRCode();
        });

        // 复制按钮
        document.getElementById('copy-btn').addEventListener('click', () => {
            this.copyQRCode();
        });

        // 扫描按钮
        document.getElementById('scan-btn').addEventListener('click', () => {
            if (this.modals.scan) {
                this.modals.scan.show();
            }
        });

        // 底部图标事件
        document.getElementById('history-btn').addEventListener('click', () => {
            if (this.modals.history) {
                this.modals.history.updateHistory(this.history);
                this.modals.history.show();
            }
        });

        document.getElementById('help-btn').addEventListener('click', () => {
            this.openHelp();
        });

        document.getElementById('star-btn').addEventListener('click', () => {
            this.rateExtension();
        });

        document.getElementById('feedback-btn').addEventListener('click', () => {
            this.openFeedback();
        });

        document.getElementById('sponsor-btn').addEventListener('click', () => {
            this.openSponsor();
        });

        // 上传到Google Drive按钮
        document.getElementById('upload-drive-btn').addEventListener('click', () => {
            if (this.modals.uploadDrive) {
                // 更新上传模式和可见性设置
                this.modals.uploadDrive.setUploadMode(this.uploadMode);
                this.modals.uploadDrive.setDefaultVisibility(this.defaultVisibility);
                this.modals.uploadDrive.show();
            }
        });

        // URL输入框事件
        document.getElementById('current-url').addEventListener('input', (e) => {
            this.currentContent = e.target.value;
            this.currentType = 'url';
            
            // 如果内容不为空，尝试生成二维码
            if (e.target.value.trim()) {
                this.createQRCode(e.target.value, 'url');
            }
        });

        // URL输入框回车事件
        document.getElementById('current-url').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.target.blur(); // 失去焦点
            }
        });
    }

    focusUrlInput() {
        const urlInput = document.getElementById('current-url');
        if (urlInput) {
            urlInput.focus();
            // 将光标移动到文本末尾
            const length = urlInput.value.length;
            urlInput.setSelectionRange(length, length);
        }
    }

    // 检查是否有待扫描的图片URL（来自右键菜单）
    async checkPendingScanUrl() {
        try {
            // 从background script获取待扫描的图片URL
            const response = await browserApi.runtime.sendMessage({ action: 'getPendingScanUrl' });
            
            if (response && response.url) {
                // 有待扫描的URL，打开扫描模态框并自动扫描
                if (this.modals.scan) {
                    this.modals.scan.show();
                // 切换到URL tab
                    this.modals.scan.switchScanTab('url');
                // 填入URL
                const urlInput = document.getElementById('scan-url-input');
                if (urlInput) {
                    urlInput.value = response.url;
                    // 自动执行扫描
                    setTimeout(() => {
                            this.modals.scan.scanFromUrl();
                    }, 100);
                    }
                }
                return true; // 返回true表示有待扫描的URL，不需要继续执行checkPendingQRData
            }
            return false; // 返回false表示没有待扫描的URL，继续执行checkPendingQRData
        } catch (error) {
            // 出错时，继续执行checkPendingQRData
            return false;
        }
    }

    // 检查是否有待处理的二维码数据（来自右键菜单）
    async checkPendingQRData() {
        try {
            // 从background script获取待处理数据
            const response = await browserApi.runtime.sendMessage({ action: 'getPendingQRData' });
            
            if (response && response.content !== undefined) {
                // 有待处理数据，根据类型处理
                this.currentContent = response.content;
                this.currentType = response.type;
                

                
                // 更新页面信息
                if (response.type === 'url') {
                    // 对于URL类型，尝试获取页面信息并显示自定义URL
                    try {
                        const [tab] = await browserApi.tabs.query({ active: true, currentWindow: true });
                        if (tab) {
                            this.updatePageInfo(tab, response.content);
                        }
                    } catch (error) {
                        // 如果获取tab信息失败，仍然更新URL输入框
                        const urlElement = document.getElementById('current-url');
                        if (urlElement) {
                            urlElement.value = response.content;
                        }
                    }
                } else if (response.type === 'text') {
                    // 对于文本类型，更新URL输入框
                    const urlElement = document.getElementById('current-url');
                    if (urlElement) {
                        urlElement.value = response.content;
                    }
                } else if (response.type === 'custom') {
                    // 对于自定义类型，清空URL输入框
                    const urlElement = document.getElementById('current-url');
                    if (urlElement) {
                        urlElement.value = '';
                    }
                }
                
                // 生成二维码
                await this.createQRCode(response.content, response.type);
            } else {
                // 没有待处理数据，生成当前页面的二维码
                await this.generateCurrentPageQR();
            }
        } catch (error) {
            // 出错时，生成当前页面的二维码
            await this.generateCurrentPageQR();
        }
    }

    async generateCurrentPageQR() {
        try {
            // 获取当前标签页信息
            const [tab] = await browserApi.tabs.query({ active: true, currentWindow: true });
            
            if (tab && tab.url) {
                this.currentContent = tab.url;
                this.currentType = 'url';
                
                // 更新页面标题和URL
                this.updatePageInfo(tab);
                
                // 生成二维码
                await this.createQRCode(tab.url, 'url');
            } else {
                this.showMessage(browserApi.i18n.getMessage('error_unable_get_current_page_url'), 'error');
            }
        } catch (error) {
            this.showMessage(browserApi.i18n.getMessage('error_failed_generate_qr'), 'error');
        }
    }

    updatePageInfo(tab, customUrl = null) {
        const titleElement = document.querySelector('.title');
        const urlElement = document.getElementById('current-url');
        const cloudIconElement = document.querySelector('.cloud-icon');
        
        // 使用自定义URL或tab.url
        const url = customUrl || tab.url;
        
        if (titleElement) {
            if (tab.title && !customUrl) {
                // 修复换行问题：移除换行符和多余空格
                const cleanTitle = tab.title.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
                titleElement.textContent = cleanTitle.length > 30 ? 
                    cleanTitle.substring(0, 30) + '...' : cleanTitle;
            } else if (customUrl) {
                // 对于自定义URL，显示URL的域名
                try {
                    const urlObj = new URL(customUrl);
                    titleElement.textContent = urlObj.hostname;
                } catch (error) {
                    titleElement.textContent = browserApi.i18n.getMessage('popup_custom_url_title');
                }
            }
        }
        
        if (urlElement && url) {
            urlElement.value = url;
        }
        
        // 更新favicon
        if (cloudIconElement) {
            // 尝试获取最佳favicon (优先使用 _favicon API 获取 64px 高清图标)
            const targetUrl = customUrl || tab.url;
            let bestFavicon = null;
            
            // 总是尝试获取 _favicon 链接，因为它能提供指定尺寸(64px)的图标
            // 从而解决 "Image natural dimensions" 的警告
            const faviconUrls = this.getFaviconUrl(targetUrl);
            if (faviconUrls && faviconUrls.length > 0) {
                bestFavicon = faviconUrls[0];
            }

            if (bestFavicon) {
                 cloudIconElement.innerHTML = `<img src="${bestFavicon}" alt="Favicon" width="24" height="24" style="border-radius: 4px;" class="cloud-favicon">
                        <div style="display:none" class="cloud-default-icon">${this.getDefaultIconSvg()}</div>`;
                 
                 // 绑定错误处理事件
                 const img = cloudIconElement.querySelector('.cloud-favicon');
                 const fallback = cloudIconElement.querySelector('.cloud-default-icon');
                 if (img && fallback) {
                     img.addEventListener('error', () => {
                         img.style.display = 'none';
                         fallback.style.display = 'inline-block';
                     });
                 }
            } else if (tab.favIconUrl && !customUrl) {
                // 如果 _favicon API 不可用（例如URL解析失败），回退到 tab.favIconUrl
                const isRestrictedProtocol = tab.favIconUrl.startsWith('chrome') || tab.favIconUrl.startsWith('edge');
                if (!isRestrictedProtocol) {
                     cloudIconElement.innerHTML = `<img src="${this.escapeHtmlForAttribute(tab.favIconUrl)}" alt="Favicon" width="24" height="24" style="border-radius: 4px;">`;
                } else {
                    this.renderDefaultIcon(cloudIconElement);
                }
            } else {
                this.renderDefaultIcon(cloudIconElement);
            }
        }
    }

    renderDefaultIcon(element) {
        element.innerHTML = this.getDefaultIconSvg();
    }

    getDefaultIconSvg() {
        return `<img src="images/qr-icon/cloud.svg" alt="Cloud" width="24" height="24">`;
    }

    async createQRCode(content, type) {
        const qrContainer = document.getElementById('qr-container');
        
        // 清空容器
        qrContainer.innerHTML = '';
        
        // 检查内容长度（只在真正需要时检查）
        if (!content || typeof content !== 'string') {
            this.showMessage(browserApi.i18n.getMessage('error_invalid_content'), 'error');
            return;
        }
        
        // 为popup显示使用固定尺寸（220x220，与qr-container大小一致）
        const displaySize = 200;
        
        try {
            // 尝试生成二维码，自动调整纠错级别
            const canvas = await this.generateQRCodeWithFallback(content, qrContainer, displaySize);
            
            this.currentCanvas = canvas;
            this.currentContent = content;
            this.currentType = type;

            // 启用所有按钮
            document.getElementById('edit-btn').disabled = false;
            document.getElementById('download-btn').disabled = false;
            document.getElementById('copy-btn').disabled = false;
            document.getElementById('scan-btn').disabled = false;
            
            // 获取URL的favicon URL
            let faviconUrl = null;
            if (type === 'url') {
                try {
                    // 优先尝试获取对应URL的高清favicon
                    const faviconUrls = this.getFaviconUrl(content);
                    if (faviconUrls && faviconUrls.length > 0) {
                        faviconUrl = faviconUrls[0];
                    }
                    
                    // 如果没找到，且内容与当前标签页一致，尝试使用标签页的favicon作为后备
                    if (!faviconUrl) {
                        const [tab] = await browserApi.tabs.query({ active: true, currentWindow: true });
                        if (tab && tab.favIconUrl) {
                            // 简单的URL比较，忽略末尾斜杠等差异
                            const normContent = content.replace(/\/$/, '');
                            const normTabUrl = tab.url.replace(/\/$/, '');
                            if (normContent === normTabUrl) {
                                faviconUrl = tab.favIconUrl;
                            }
                        }
                    }
                } catch (error) {
                    // 静默处理favicon获取失败
                }
            }
            
            // 添加到生成历史记录
            // 跳过以下情况：
            // 1. Google Drive链接（已在uploadFilesToDrive中添加）
            // 2. chrome:// 开头的URL（浏览器内部页面）
            const isGoogleDriveLink = type === 'url' && content.includes('drive.google.com');
            const isChromeInternalUrl = type === 'url' && content.startsWith('chrome://');
            
            if (!isGoogleDriveLink && !isChromeInternalUrl) {
                this.addToHistory('generated', {
                    content: content,
                    type: type,
                    faviconUrl: faviconUrl,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            // 检查是否是长度溢出错误
            // 增加对 TypeError 的检查，处理库未抛出明确 overflow 错误的情况
            if ((error.message && error.message.includes('code length overflow')) || 
                (error.message && error.message.includes('Unable to generate QR code with any error correction level')) ||
                (error instanceof TypeError)) {
                
                const currentLength = this.getUTF8Length(content);
                // 如果长度很大，优先提示长度过长，而不是“太复杂”
                if (currentLength > 2300) { // 2300是大致的中等纠错级别容量，超过这个数很有可能就是太长了
                     this.showMessage(browserApi.i18n.getMessage('error_content_too_long', [currentLength]), 'error');
                } else {
                     this.showMessage(browserApi.i18n.getMessage('error_content_too_complex', [currentLength]), 'error');
                }
            } else {
                // 其他错误，显示通用错误信息
                this.showMessage(browserApi.i18n.getMessage('error_generate_generic'), 'error');
            }
            return;
        }
    }

    async getLogoForQRCode() {
        // 如果有内置 logo，返回其 URL
        if (this.qrOptions.builtinLogo) {
            return browserApi.runtime.getURL(`images/qr-icon/${this.qrOptions.builtinLogo}`);
        }
        // 如果有自定义 logo，返回文件对象
        return this.qrOptions.logo;
    }

    async generateQRCodeWithFallback(content, container, size) {
        // 尝试不同的纠错级别，从M开始，如果失败则降低到L
        const errorLevels = [
            { level: QRCode.CorrectLevel.M, name: 'Medium' },
            { level: QRCode.CorrectLevel.L, name: 'Low' }
        ];
        
        try {
            const canvas = await this.generateQRCodeAtLevel(content, container, size, errorLevels, true);
            
            if (!canvas) {
                throw new Error('Unable to generate QR code with any error correction level');
            }

            // 更新当前使用的生成器
            // 注意：generateQRCodeAtLevel 内部创建了新的 QRCodeWithLogo，但没有保存它
            // 我们可以在这里根据成功后的状态重新创建一个，或者修改 generateQRCodeAtLevel
            // 为了简单，我们在这里直接使用 canvas 的 parentElement 检查
                
                return canvas;
            } catch (error) {
            throw error;
        }
    }


    async downloadQRCode() {
        if (!this.currentQRCode) {
            this.showMessage(browserApi.i18n.getMessage('warning_generate_first'), 'warning');
            return;
        }

        try {
            // 生成文件名
            const timestamp = new Date().toISOString().slice(0, 10);
            const content = this.currentContent.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '');
            const filename = `qrcode_${content}_${timestamp}`;

            // 计算二维码本身的尺寸（用户设置的尺寸减去边框）
            const borderSize = 10; // 每边的边框大小
            let qrWidth = this.qrOptions.width - (borderSize * 2);
            let qrHeight = this.qrOptions.height - (borderSize * 2);
            
            // 确保二维码尺寸不会太小（最小100px）
            const minSize = 100;
            if (qrWidth < minSize) {
                qrWidth = minSize;
            }
            if (qrHeight < minSize) {
                qrHeight = minSize;
            }

            // 创建临时容器生成下载用的二维码
            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-9999px';
            tempContainer.style.top = '-9999px';
            document.body.appendChild(tempContainer);

            // 使用 generateQRCodeWithFallback 来确保下载也能成功（自动处理纠错级别）
            // 我们稍微修改一下 generateQRCodeWithFallback 的调用，因为我们要支持 H 级别
            const downloadCanvas = await this.generateQRCodeAtLevel(this.currentContent, tempContainer, qrWidth, [
                { level: QRCode.CorrectLevel.H, name: 'High' },
                { level: QRCode.CorrectLevel.M, name: 'Medium' },
                { level: QRCode.CorrectLevel.L, name: 'Low' }
            ]);
            
            if (!downloadCanvas) {
                throw new Error('Failed to generate QR code');
            }
            
            // 创建带白色边框的二维码用于下载
            const canvasToDownload = this.addWhiteBorder(downloadCanvas);

            if (canvasToDownload) {
                // 创建下载链接
                const link = document.createElement('a');
                link.download = `${filename}.png`;
                link.href = canvasToDownload.toDataURL('image/png');
                link.click();
                
                this.showMessage(browserApi.i18n.getMessage('success_qr_downloaded'), 'success');
            }

            // 清理临时容器
            document.body.removeChild(tempContainer);
        } catch (error) {
            console.error('Download failed:', error);
            this.showMessage(browserApi.i18n.getMessage('error_download_failed'), 'error');
        }
    }

    async copyQRCode() {
        if (!this.currentQRCode) {
            this.showMessage(browserApi.i18n.getMessage('warning_generate_first'), 'warning');
            return;
        }

        try {
            // 计算二维码本身的尺寸（用户设置的尺寸减去边框）
            const borderSize = 10; // 每边的边框大小
            let qrWidth = this.qrOptions.width - (borderSize * 2);
            let qrHeight = this.qrOptions.height - (borderSize * 2);
            
            // 确保二维码尺寸不会太小（最小100px）
            const minSize = 100;
            if (qrWidth < minSize) {
                qrWidth = minSize;
            }
            if (qrHeight < minSize) {
                qrHeight = minSize;
            }

            // 创建临时容器生成复制用的二维码
            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-9999px';
            tempContainer.style.top = '-9999px';
            document.body.appendChild(tempContainer);

            // 使用 generateQRCodeAtLevel 确保复制也能成功
            const copyCanvas = await this.generateQRCodeAtLevel(this.currentContent, tempContainer, qrWidth, [
                { level: QRCode.CorrectLevel.H, name: 'High' },
                { level: QRCode.CorrectLevel.M, name: 'Medium' },
                { level: QRCode.CorrectLevel.L, name: 'Low' }
            ]);
            
            if (!copyCanvas) {
                throw new Error('Failed to generate QR code');
            }
            
            // 创建带白色边框的二维码
            const borderedCanvas = this.addWhiteBorder(copyCanvas);
            const dataURL = borderedCanvas.toDataURL('image/png');
            const blob = this.dataURLtoBlob(dataURL);
            
            await navigator.clipboard.write([
                new ClipboardItem({ "image/png": blob })
            ]);
            
            this.showMessage(browserApi.i18n.getMessage('success_qr_copied'), 'success');

            // 清理临时容器
            document.body.removeChild(tempContainer);
        } catch (error) {
            console.error('Copy failed:', error);
            this.showMessage(browserApi.i18n.getMessage('error_copy_qr_failed'), 'error');
        }
    }

    // 辅助方法：在指定的一系列纠错级别中尝试生成二维码
    async generateQRCodeAtLevel(content, container, size, levels, isMainDisplay = false) {
        // 获取 logo（内置或自定义）
        const logo = this.qrOptions.builtinLogo 
            ? browserApi.runtime.getURL(`images/qr-icon/${this.qrOptions.builtinLogo}`)
            : this.qrOptions.logo;
            
        for (const errorLevel of levels) {
            try {
                const qrGenerator = new QRCodeWithLogo({
                    width: size,
                    height: size,
                    colorDark: this.qrOptions.foreground,
                    colorLight: this.qrOptions.background,
                    correctLevel: errorLevel.level,
                    logo: logo,
                    logoSize: 0.2,
                    logoOpacity: this.qrOptions.logoOpacity / 100
                });
                
                const canvas = await qrGenerator.generate(content, container);
                
                if (isMainDisplay) {
                    this.currentQRCode = qrGenerator;
                    // 如果成功生成，显示纠错级别信息
                    if (errorLevel.name === 'Low') {
                        const levelName = browserApi.i18n.getMessage('error_level_low');
                        this.showMessage(browserApi.i18n.getMessage('info_generated_with_error_level', [levelName]), 'info');
                    }
                }
                
                return canvas;
            } catch (error) {
                container.innerHTML = '';
                continue;
            }
        }
        return null;
    }

    addWhiteBorder(canvas) {
        const borderSize = 10; // 白色边框大小
        const originalWidth = canvas.width;
        const originalHeight = canvas.height;
        
        // 创建新的canvas，尺寸包含边框
        const borderedCanvas = document.createElement('canvas');
        borderedCanvas.width = originalWidth + borderSize * 2;
        borderedCanvas.height = originalHeight + borderSize * 2;
        
        const ctx = borderedCanvas.getContext('2d');
        
        // 填充白色背景
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, borderedCanvas.width, borderedCanvas.height);
        
        // 绘制原始二维码到中心位置
        ctx.drawImage(canvas, borderSize, borderSize);
        
        return borderedCanvas;
    }

    dataURLtoBlob(dataURL) {
        const arr = dataURL.split(",");
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }


    async loadSettings() {
        const result = await browserApi.storage.local.get(['qrOptions', 'defaultVisibility', 'uploadMode']);
        if (result.qrOptions) {
            this.qrOptions = { ...this.qrOptions, ...result.qrOptions };
        }
        if (result.defaultVisibility) {
            this.defaultVisibility = result.defaultVisibility;
        }
        if (result.uploadMode) {
            this.uploadMode = result.uploadMode;
        }
        
        // 更新UI（延迟执行，确保DOM已加载）
        setTimeout(() => {
            const radio = document.querySelector(`input[name="upload-mode"][value="${this.uploadMode}"]`);
            if (radio) {
                radio.checked = true;
            }
            if (this.modals.uploadDrive) {
                this.modals.uploadDrive.setUploadMode(this.uploadMode);
            }
        }, 0);
    }

    async saveSettings() {
        await browserApi.storage.local.set({ 
            qrOptions: this.qrOptions,
            defaultVisibility: this.defaultVisibility,
            uploadMode: this.uploadMode
        });
    }

    // 历史记录相关方法
    async loadHistory() {
        const result = await browserApi.storage.local.get(['history']);
        if (result.history) {
            this.history = result.history;
            // 清理重复记录
            this.deduplicateHistory();
        }
    }

    deduplicateHistory() {
        // 清理generated记录中的重复项
        const uniqueGenerated = [];
        const seen = new Set();
        
        for (const record of this.history.generated) {
            let key;
            if (record.type === 'url') {
                key = `url:${this.normalizeUrl(record.content)}`;
            } else {
                key = `${record.type}:${record.content}`;
            }
            
            if (!seen.has(key)) {
                seen.add(key);
                uniqueGenerated.push(record);
            }
        }
        
        this.history.generated = uniqueGenerated;
        this.saveHistory();
    }

    async saveHistory() {
        await browserApi.storage.local.set({ history: this.history });
    }

    addToHistory(type, record) {
        // 限制历史记录数量为50条
        const maxRecords = 50;
        
        if (type === 'generated') {
            // 去重处理：检查是否已存在相同内容的记录
            const existingIndex = this.history.generated.findIndex(item => {
                // 对于URL类型，进行规范化比较
                if (item.type === 'url' && record.type === 'url') {
                    return this.normalizeUrl(item.content) === this.normalizeUrl(record.content);
                }
                // 对于其他类型，直接比较内容和类型
                return item.content === record.content && item.type === record.type;
            });
            
            if (existingIndex !== -1) {
                // 如果存在相同记录，更新时间和相关信息，然后移到开头
                const existingRecord = this.history.generated[existingIndex];
                existingRecord.timestamp = record.timestamp;
                // 更新其他可能变化的字段
                if (record.fileName) existingRecord.fileName = record.fileName;
                if (record.fileType) existingRecord.fileType = record.fileType;
                if (record.isGoogleDrive !== undefined) existingRecord.isGoogleDrive = record.isGoogleDrive;
                if (record.faviconUrl) existingRecord.faviconUrl = record.faviconUrl;
                
                // 移除旧记录
                this.history.generated.splice(existingIndex, 1);
                // 添加到开头
                this.history.generated.unshift(existingRecord);
            } else {
                // 添加新记录到开头
                this.history.generated.unshift(record);
            }
            
            // 限制记录数量
            if (this.history.generated.length > maxRecords) {
                this.history.generated = this.history.generated.slice(0, maxRecords);
            }
        } else if (type === 'scanned') {
            this.history.scanned.unshift(record);
            if (this.history.scanned.length > maxRecords) {
                this.history.scanned = this.history.scanned.slice(0, maxRecords);
            }
        }
        
        this.saveHistory();
        
        // 如果HistoryModal已初始化，更新其历史记录
        if (this.modals.history) {
            this.modals.history.updateHistory(this.history);
        }
            }

    // HistoryModal相关方法已移至src/modals/history-modal.js
    
    /**
     * 恢复历史记录到popup页面
     * @param {string} content - 记录内容
     * @param {string} type - 记录类型
     */
    async restoreHistoryRecord(content, type) {
        // 关闭历史记录模态框
        if (this.modals.history) {
            this.modals.history.hide();
        }
        
        // 更新当前内容和类型
        this.currentContent = content;
        this.currentType = type;
        
        // 更新URL输入框
        const urlElement = document.getElementById('current-url');
        if (urlElement && type === 'url') {
            urlElement.value = content;
        }
        
        // 查找历史记录以获取保存的favicon信息
        let record = null;
        if (type === 'url') {
            // 在generated历史记录中查找
            record = this.history.generated.find(item => {
                if (item.type === 'url' && item.content === content) {
                    return true;
                }
                // 对于URL类型，进行规范化比较
                if (item.type === 'url') {
                    return this.normalizeUrl(item.content) === this.normalizeUrl(content);
                }
                return false;
            });
        }
        
        // 更新页面标题和favicon
        if (type === 'url') {
            try {
                const urlObj = new URL(content);
                const titleElement = document.querySelector('.title');
                if (titleElement) {
                    // 如果是Google Drive文件且有文件名，显示文件名
                    if (record && record.isGoogleDrive && record.fileName) {
                        titleElement.textContent = record.fileName;
                    } else {
                        titleElement.textContent = urlObj.hostname;
                    }
                }
                
                // 更新favicon
                const cloudIconElement = document.querySelector('.cloud-icon');
                if (cloudIconElement) {
                    const isGoogleDrive = record && (record.isGoogleDrive || content.includes('drive.google.com'));
                    
                    if (isGoogleDrive) {
                        // 使用Google Drive图标
                        cloudIconElement.innerHTML = `<img src="images/qr-icon/googledrive.png" alt="Google Drive" width="24" height="24" style="border-radius: 4px;" class="cloud-favicon">
                            <div style="display:none" class="cloud-default-icon">${this.getDefaultIconSvg()}</div>`;
                        
                        // 绑定错误处理事件
                        const img = cloudIconElement.querySelector('.cloud-favicon');
                        const fallback = cloudIconElement.querySelector('.cloud-default-icon');
                        if (img && fallback) {
                            img.addEventListener('error', () => {
                                img.style.display = 'none';
                                fallback.style.display = 'inline-block';
                            });
                        }
                    } else {
                        // 使用保存的favicon或获取新的favicon
                        let faviconUrl = null;
                        if (record && record.faviconUrl) {
                            faviconUrl = record.faviconUrl;
                        } else {
                            // 尝试获取favicon
                            const faviconUrls = this.getFaviconUrl(content);
                            if (faviconUrls && faviconUrls.length > 0) {
                                faviconUrl = faviconUrls[0];
                            }
                        }
                        
                        if (faviconUrl) {
                            cloudIconElement.innerHTML = `<img src="${this.escapeHtmlForAttribute(faviconUrl)}" alt="Favicon" width="24" height="24" style="border-radius: 4px;" class="cloud-favicon">
                                <div style="display:none" class="cloud-default-icon">${this.getDefaultIconSvg()}</div>`;
                            
                            // 绑定错误处理事件
                            const img = cloudIconElement.querySelector('.cloud-favicon');
                            const fallback = cloudIconElement.querySelector('.cloud-default-icon');
                            if (img && fallback) {
                                img.addEventListener('error', () => {
                                    img.style.display = 'none';
                                    fallback.style.display = 'inline-block';
                                });
                            }
                        } else {
                            // 使用默认图标
                            this.renderDefaultIcon(cloudIconElement);
                        }
                    }
                }
            } catch (error) {
                // 静默处理
            }
        }
        
        // 生成二维码
        this.createQRCode(content, type);
        
        // 聚焦到URL输入框
        this.focusUrlInput();
    }

    // renderScannedHistory方法已移至src/modals/history-modal.js

    bindImageErrorHandlers(container) {
        if (!container) return;
        // 处理 favicon 和 Google Drive icon 的错误
        const images = container.querySelectorAll('.favicon, .google-drive-icon');
        images.forEach(img => {
            img.addEventListener('error', () => {
                img.style.display = 'none';
                const fallback = img.nextElementSibling;
                if (fallback && fallback.classList.contains('fallback-icon')) {
                    fallback.style.display = 'inline-block';
                }
            });
        });
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return browserApi.i18n.getMessage('time_just_now');
        if (minutes < 60) return browserApi.i18n.getMessage('time_minutes_ago', [minutes]);
        if (hours < 24) return browserApi.i18n.getMessage('time_hours_ago', [hours]);
        if (days < 7) return browserApi.i18n.getMessage('time_days_ago', [days]);
        
        return date.toLocaleDateString();
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    getFaviconUrl(url) {
        try {
            const urlObj = new URL(url);
            // chrome://favicon API (Best practice for extensions)
            // 优先使用 chrome-extension://_favicon/ (MV3) 或 chrome://favicon/ (MV2/Firefox)
            // 注意：Chrome MV3 需要 "favicon" 权限才能访问 chrome-extension://_favicon/
            
            const faviconPaths = [];
            
            // MV3 Preferred method
            const extensionFaviconUrl = new URL(browserApi.runtime.getURL("/_favicon/"));
            extensionFaviconUrl.searchParams.set("pageUrl", url);
            extensionFaviconUrl.searchParams.set("size", "64");
            faviconPaths.push(extensionFaviconUrl.toString());

            // Fallbacks
            faviconPaths.push(`${urlObj.protocol}//${urlObj.hostname}/favicon.ico`);
            faviconPaths.push(`${urlObj.protocol}//${urlObj.hostname}/apple-touch-icon.png`);
            
            return faviconPaths; 
        } catch (error) {
            return null;
        }
    }

    // 异步加载favicon
    async loadFaviconsForHistory(type) {
        const records = this.history[type];
        
        if (!records || records.length === 0) return;
        
        // 只为没有保存favicon URL的URL记录异步加载favicon
        for (let index = 0; index < records.length; index++) {
            const record = records[index];
            if (!this.isUrl(record.content)) continue;
            
            // 如果已经有保存的favicon URL，跳过
            if (record.faviconUrl) continue;
            
            // 获取favicon URL列表
            const faviconUrls = this.getFaviconUrl(record.content);
            if (!faviconUrls) continue;
            
            // 尝试加载favicon
            const loadedFavicon = await this.loadFavicon(faviconUrls);
            
            if (loadedFavicon) {
                // 检查DOM元素是否仍然存在并更新favicon
                this.updateFaviconInHistory(type, index, loadedFavicon);
                
                // 保存favicon URL到历史记录中
                record.faviconUrl = loadedFavicon;
                this.saveHistory();
            }
            // 如果加载失败，保持显示占位图标
        }
    }

    // 更新历史记录中的favicon
    updateFaviconInHistory(type, index, faviconUrl) {
        try {
            const container = document.getElementById(`${type}-history`);
            if (!container) return;
            
            const historyItem = container.querySelector(`[data-index="${index}"]`);
            if (!historyItem) return;
            
            const faviconImg = historyItem.querySelector('.favicon');
            const fallbackIcon = historyItem.querySelector('.fallback-icon');
            
            if (faviconImg && fallbackIcon) {
                // 加载成功，显示favicon
                faviconImg.src = faviconUrl;
                faviconImg.style.display = 'inline-block';
                fallbackIcon.style.display = 'none';
            }
        } catch (error) {
            // 静默处理favicon更新失败
        }
    }

    // 尝试加载favicon
    async loadFavicon(faviconUrls) {
        for (const url of faviconUrls) {
            try {
                // 直接尝试加载图片，避免CORS问题
                const img = new Image();
                
                return new Promise((resolve) => {
                    img.onload = () => resolve(url);
                    img.onerror = () => resolve(null);
                    img.src = url;
                });
            } catch (error) {
                // 继续尝试下一个URL
                continue;
            }
        }
        return null;
    }

    isUrl(content) {
        try {
            new URL(content);
            return true;
        } catch (error) {
            return false;
        }
    }

    normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            // 移除查询参数、锚点等，只保留协议、域名和路径
            return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
        } catch {
            // 如果URL解析失败，返回原始字符串
            return url;
        }
    }

    getUTF8Length(text) {
        if (!text || typeof text !== 'string') {
            return 0;
        }
        
        // 使用与qrcode.js库相同的UTF-8长度计算方法
        const replacedText = encodeURI(text).toString().replace(/\%[0-9a-fA-F]{2}/g, 'a');
        return replacedText.length + (replacedText.length != text ? 3 : 0);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    escapeHtmlForAttribute(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // copyHistoryContent方法已移至src/modals/history-modal.js

    openHistoryContent(content) {
        if (content.startsWith('http://') || content.startsWith('https://')) {
            browserApi.tabs.create({ url: content });
        } else {
            this.showMessage(browserApi.i18n.getMessage('warning_cannot_open_non_url'), 'warning');
        }
    }

    rateExtension() {
        // 跳转到浏览器商店评分页面
        const extensionId = browserApi.runtime.id;
        let reviewUrl;
        
        // 检查是否是Firefox（使用browserApi而不是直接使用browser）
        const isFirefox = typeof browserApi !== 'undefined' && 
                         browserApi.runtime && 
                         browserApi.runtime.getBrowserInfo;
        
        try {
            // 尝试检测Firefox（Firefox有getBrowserInfo方法）
            if (isFirefox || (typeof browser !== 'undefined' && browser.runtime)) {
            // Firefox - 使用Firefox Add-ons商店
            reviewUrl = `https://addons.mozilla.org/en-US/firefox/addon/${extensionId}/reviews/`;
        } else {
            // Chrome/Edge - 使用Chrome Web Store
                reviewUrl = `https://chrome.google.com/webstore/detail/${extensionId}/reviews`;
            }
        } catch (e) {
            // 默认使用Chrome Web Store
            reviewUrl = `https://chrome.google.com/webstore/detail/${extensionId}/reviews`;
        }

        browserApi.tabs.create({ url: reviewUrl });
        this.showMessage(browserApi.i18n.getMessage('success_thanks_rating'), 'success');
    }
    openHelp() {
        let helpUrl = 'https://qr.camscanner.top/';
        browserApi.tabs.create({ url: helpUrl });
    }

    openFeedback() {
        let supportUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSdHfHweueYDQePclu-HRMOq0zpTYyDFi9hgcMoRJuh1sDTOdg/viewform?usp=dialog';
        browserApi.tabs.create({ url: supportUrl });
        this.showMessage(browserApi.i18n.getMessage('info_opening_support'), 'info');
    }

    openSponsor() {
        let sponsorUrl = 'https://ko-fi.com/navyum';
        browserApi.tabs.create({ url: sponsorUrl });
        this.showMessage(browserApi.i18n.getMessage('info_opening_sponsor'), 'info');
    }

    showMessage(message, type = 'info') {
        // 如果消息为空，使用默认消息
        if (!message || (typeof message === 'string' && message.trim() === '')) {
            const defaultMessages = {
                success: '操作成功',
                error: '操作失败',
                warning: '警告',
                info: '提示'
            };
            message = defaultMessages[type] || '提示';
        }
        
        // 创建消息元素
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 6px;
            color: white;
            font-size: 14px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        // 根据类型设置背景色
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        messageEl.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(messageEl);

        // 6秒后自动移除（错误提示延长到3秒）
        const duration = type === 'error' ? 6000 : 3000;
        setTimeout(() => {
            messageEl.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, duration);
    }

    // UploadDriveModal相关方法已移至src/modals/upload-drive-modal.js
    // UserInfoModal相关方法已移至src/modals/user-info-modal.js

    /**
     * 更新上传按钮的登录状态样式（保留在主文件中，因为需要在初始化时调用）
     * @param {boolean} isAuthenticated - 是否已登录
     */
    async updateUploadButtonAuthState(isAuthenticated) {
        const uploadBtn = document.getElementById('upload-drive-btn');
        if (!uploadBtn) return;
        
        // 如果未传入参数，自动检测登录状态
        if (isAuthenticated === undefined) {
        try {
            await this.googleDriveAPI.init();
                isAuthenticated = await this.googleDriveAPI.isAuthenticated();
        } catch (error) {
                isAuthenticated = false;
            }
        }
        
        if (isAuthenticated) {
            uploadBtn.classList.add('authenticated');
            } else {
            uploadBtn.classList.remove('authenticated');
        }
    }

    // uploadFilesToDrive方法已移至src/modals/upload-drive-modal.js
}

// 初始化插件
document.addEventListener('DOMContentLoaded', () => {
    window.qrCodePopup = new QRCodePopup();
}); 