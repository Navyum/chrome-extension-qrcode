// QR Code Generator Chrome Extension - Popup Script

const browserApi = require('./utils/browser-api');
const GoogleDriveAPI = require('./utils/google-drive-api');

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
        this.selectedFiles = []; // 选中的文件列表
        this.selectedFolders = []; // 选中的文件夹列表，每个元素包含 {name, files}
        this.uploadMode = 'file'; // 上传模式：'file' 或 'folder'
        this.defaultVisibility = 'anyone'; // 默认可见性
        
        this.init();
    }

    async init() {
        this.initI18n();
        this.bindEvents();
        this.loadSettings();
        this.loadHistory();
        this.setupModalEvents();
        
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
                    if (result.pendingAuthAction === 'signin') {
                        // 如果是登录操作，显示上传界面
                        this.showUploadSection();
                        this.showMessage(browserApi.i18n.getMessage('success_auth_granted'), 'success');
                    } else if (result.pendingAuthAction === 'upload') {
                        // 如果是上传操作，显示上传界面并提示可以继续上传
                        this.showUploadSection();
                        this.showMessage(browserApi.i18n.getMessage('success_auth_granted'), 'success');
                    }
                }
            }
        } catch (error) {
            console.error('[Init] 检查待处理授权失败:', error);
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
            this.showEditModal();
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
            this.showScanModal();
        });

        // 底部图标事件
        document.getElementById('history-btn').addEventListener('click', () => {
            this.showHistoryModal();
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
            this.showUploadDriveModal();
        });

        // Google登录按钮
        document.getElementById('google-signin-btn').addEventListener('click', async () => {
            await this.handleGoogleSignIn();
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
                this.showScanModal();
                // 切换到URL tab
                this.switchScanTab('url');
                // 填入URL
                const urlInput = document.getElementById('scan-url-input');
                if (urlInput) {
                    urlInput.value = response.url;
                    // 自动执行扫描
                    setTimeout(() => {
                        this.scanFromUrl();
                    }, 100);
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
            const canvas = this.generateQRCodeWithFallback(content, qrContainer, displaySize);
            
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

    generateQRCodeWithFallback(content, container, size) {
        // 尝试不同的纠错级别，从M开始，如果失败则降低到L
        const errorLevels = [
            { level: QRCode.CorrectLevel.M, name: 'Medium' },
            { level: QRCode.CorrectLevel.L, name: 'Low' }
        ];
        
        // 获取 logo（内置或自定义）
        const logo = this.qrOptions.builtinLogo 
            ? browserApi.runtime.getURL(`images/qr-icon/${this.qrOptions.builtinLogo}`)
            : this.qrOptions.logo;
        
        for (const errorLevel of errorLevels) {
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
                
                const canvas = qrGenerator.generate(content, container);
                this.currentQRCode = qrGenerator;
                
                // 如果成功生成，显示纠错级别信息
                if (errorLevel.name === 'Low') {
                    const levelName = browserApi.i18n.getMessage('error_level_low');
                    this.showMessage(browserApi.i18n.getMessage('info_generated_with_error_level', [levelName]), 'info');
                }
                
                return canvas;
            } catch (error) {
                // 这里的错误通常意味着当前纠错级别无法容纳该内容（长度溢出），
                // 或者发生了其他生成错误。这是正常的降级过程，我们只需静默失败并尝试下一个级别。
                // 最终如果所有级别都失败，会在上层 createQRCode 中捕获并提示用户。
                
                // 清空容器，准备下一次尝试
                container.innerHTML = '';
                continue;
            }
        }
        
        // 如果所有纠错级别都失败，抛出错误
        throw new Error('Unable to generate QR code with any error correction level');
    }

    showEditModal() {
        document.getElementById('edit-modal').style.display = 'flex';
        
        // 设置当前值
        document.getElementById('foreground-color').value = this.qrOptions.foreground;
        document.getElementById('background-color').value = this.qrOptions.background;
        document.getElementById('qr-width').value = this.qrOptions.width;
        document.getElementById('qr-height').value = this.qrOptions.height;
        
        // 初始化内置 logo 网格
        this.initBuiltinLogoGrid();
        
        // 更新 logo 选择状态
        this.updateLogoSelectionState();
    }
    
    initBuiltinLogoGrid() {
        const grid = document.getElementById('builtin-logo-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        // 直接写死文件名，添加内置 logo 选项（12个，两行，每行6个）
        this.builtinLogoFiles.forEach(logoFile => {
            const logoItem = document.createElement('div');
            logoItem.className = 'builtin-logo-item';
            logoItem.dataset.logo = logoFile;
            logoItem.innerHTML = `
                <div class="builtin-logo-icon">
                    <img src="images/qr-icon/${logoFile}" alt="" onerror="this.style.display='none';">
                </div>
                <div class="builtin-logo-checkmark">✓</div>
            `;
            logoItem.addEventListener('click', () => this.selectBuiltinLogo(logoFile));
            grid.appendChild(logoItem);
        });
    }
    
    selectBuiltinLogo(logoFile) {
        // 清除自定义 logo
        this.removeLogoFile();
        
        // 设置内置 logo
        if (logoFile === null) {
            this.qrOptions.logo = null;
            this.qrOptions.builtinLogo = null;
        } else {
            this.qrOptions.logo = null; // 清除自定义 logo
            this.qrOptions.builtinLogo = logoFile;
        }
        
        // 更新 UI 状态
        this.updateLogoSelectionState();
        
        // 如果有当前二维码，重新生成
        if (this.currentContent) {
            this.createQRCode(this.currentContent, this.currentType);
        }
    }
    
    handleLogoFileSelect(file) {
        if (file) {
            // 清除内置 logo
            this.qrOptions.builtinLogo = null;
            
            // 清除内置 logo 选中状态
            document.querySelectorAll('.builtin-logo-item').forEach(item => {
                item.classList.remove('selected');
            });
            
            // 设置自定义 logo
            this.qrOptions.logo = file;
            
            // 隐藏选择按钮，显示文件名和取消按钮
            const fileLabel = document.getElementById('logo-file-label');
            const fileSelected = document.getElementById('logo-file-selected');
            const fileName = document.getElementById('logo-file-name');
            const filePreview = document.getElementById('logo-file-preview');
            
            if (fileLabel && fileSelected && fileName && filePreview) {
                fileLabel.style.display = 'none';
                fileSelected.style.display = 'flex';
                fileName.textContent = file.name;
                
                // 创建预览图片
                const reader = new FileReader();
                reader.onload = (e) => {
                    filePreview.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
            
            // 显示透明度选项
            document.querySelector('.logo-options').style.display = 'block';
            
            // 如果有当前二维码，重新生成
            if (this.currentContent) {
                this.createQRCode(this.currentContent, this.currentType);
            }
        }
    }
    
    removeLogoFile() {
        // 清除文件选择
        document.getElementById('logo-file').value = '';
        this.qrOptions.logo = null;
        
        // 清除预览图片
        const filePreview = document.getElementById('logo-file-preview');
        if (filePreview) {
            filePreview.src = '';
        }
        
        // 显示选择按钮，隐藏文件名显示
        const fileLabel = document.getElementById('logo-file-label');
        const fileSelected = document.getElementById('logo-file-selected');
        
        if (fileLabel && fileSelected) {
            fileLabel.style.display = 'flex';
            fileSelected.style.display = 'none';
        }
        
        // 如果没有logo，隐藏透明度选项
        if (!this.qrOptions.builtinLogo) {
            document.querySelector('.logo-options').style.display = 'none';
        }
        
        // 如果有当前二维码，重新生成
        if (this.currentContent) {
            this.createQRCode(this.currentContent, this.currentType);
        }
    }
    
    updateLogoSelectionState() {
        // 更新内置 logo 选中状态
        const logoItems = document.querySelectorAll('.builtin-logo-item');
        logoItems.forEach(item => {
            const logoFile = item.dataset.logo;
            if (logoFile === this.qrOptions.builtinLogo) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        
        // 更新自定义 logo 显示
        const fileHint = document.querySelector('.file-input-hint');
        if (this.qrOptions.builtinLogo) {
            // 如果有内置 logo，隐藏自定义 logo 提示
            if (fileHint) {
                fileHint.textContent = browserApi.i18n.getMessage('popup_common_no_file_selected');
                fileHint.style.color = '#6c757d';
            }
            document.querySelector('.logo-options').style.display = 'block';
        } else if (this.qrOptions.logo) {
            // 如果有自定义 logo，显示文件名
            if (fileHint) {
                fileHint.textContent = this.qrOptions.logo.name || browserApi.i18n.getMessage('popup_common_no_file_selected');
                fileHint.style.color = '#47630f';
            }
            document.querySelector('.logo-options').style.display = 'block';
        } else {
            document.querySelector('.logo-options').style.display = 'none';
        }
    }



    setupModalEvents() {
        // 编辑模态框
        document.getElementById('close-edit-modal').addEventListener('click', () => {
            document.getElementById('edit-modal').style.display = 'none';
        });

        document.getElementById('apply-edit').addEventListener('click', () => {
            this.applyEdit();
        });

        document.getElementById('cancel-edit').addEventListener('click', () => {
            document.getElementById('edit-modal').style.display = 'none';
        });

        document.getElementById('reset-edit').addEventListener('click', () => {
            this.resetEdit();
        });

        // Size Settings 联动功能
        const widthInput = document.getElementById('qr-width');
        const heightInput = document.getElementById('qr-height');
        
        // 当修改width时，Height跟随改动对应值
        widthInput.addEventListener('input', (e) => {
            const width = parseInt(e.target.value);
            if (width && width > 0) {
                heightInput.value = width;
            }
        });
        
        // 当修改height时，width跟随改动对应值
        heightInput.addEventListener('input', (e) => {
            const height = parseInt(e.target.value);
            if (height && height > 0) {
                widthInput.value = height;
            }
        });



        // Logo透明度滑块
        document.getElementById('logo-opacity').addEventListener('input', (e) => {
            document.getElementById('opacity-value').textContent = e.target.value + '%';
        });

        // Logo文件选择
        document.getElementById('logo-file').addEventListener('change', (e) => {
            const file = e.target.files[0];
            this.handleLogoFileSelect(file);
        });
        
        // Logo文件取消按钮
        document.getElementById('logo-file-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.removeLogoFile();
        });

        // 扫描模态框事件
        document.getElementById('close-scan-modal').addEventListener('click', () => {
            this.resetScanModal();
            document.getElementById('scan-modal').style.display = 'none';
        });

        // 扫描Tab切换事件
        document.getElementById('scan-tab-local').addEventListener('click', () => {
            this.switchScanTab('local');
        });

        document.getElementById('scan-tab-url').addEventListener('click', () => {
            this.switchScanTab('url');
        });

        // URL扫描按钮
        document.getElementById('scan-url-btn').addEventListener('click', () => {
            this.scanFromUrl();
        });

        // URL输入框回车事件
        document.getElementById('scan-url-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.scanFromUrl();
            }
        });

        // 历史模态框事件
        document.getElementById('close-history-modal').addEventListener('click', () => {
            document.getElementById('history-modal').style.display = 'none';
        });

        // 历史标签页切换
        document.getElementById('generate-tab').addEventListener('click', () => {
            document.getElementById('generate-tab').classList.add('active');
            document.getElementById('scan-tab').classList.remove('active');
            document.getElementById('generate-history').classList.add('active');
            document.getElementById('scan-history').classList.remove('active');
        });

        document.getElementById('scan-tab').addEventListener('click', () => {
            document.getElementById('scan-tab').classList.add('active');
            document.getElementById('generate-tab').classList.remove('active');
            document.getElementById('scan-history').classList.add('active');
            document.getElementById('generate-history').classList.remove('active');
        });

        // 清除历史记录 - 打开确认模态框
        document.getElementById('clear-history').addEventListener('click', () => {
            document.getElementById('confirm-clear-modal').style.display = 'flex';
        });

        // 确认清除
        document.getElementById('confirm-clear-btn').addEventListener('click', () => {
            this.history.generated = [];
            this.history.scanned = [];
            this.saveHistory();
            this.renderHistory();
            this.showMessage(browserApi.i18n.getMessage('success_history_cleared'), 'success');
            document.getElementById('confirm-clear-modal').style.display = 'none';
        });

        // 取消清除
        document.getElementById('cancel-clear-btn').addEventListener('click', () => {
            document.getElementById('confirm-clear-modal').style.display = 'none';
        });

        // 关闭确认模态框
        document.getElementById('close-confirm-modal').addEventListener('click', () => {
            document.getElementById('confirm-clear-modal').style.display = 'none';
        });

        // 历史记录copy按钮事件委托
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('copy-btn')) {
                // 使用 dataset.content 自动解码 HTML 实体，而不是 getAttribute
                const content = e.target.dataset.content;
                if (content) {
                    this.copyHistoryContent(content);
                } else {
                    this.showMessage(browserApi.i18n.getMessage('error_no_content_to_copy'), 'error');
                }
            }
        });

        // QR码文件选择
        document.getElementById('qr-file').addEventListener('change', (e) => {
            const file = e.target.files[0];
            const fileHint = document.querySelector('#scan-modal .file-input-hint');
            const previewContainer = document.getElementById('scan-upload-preview');
            const previewImage = document.getElementById('upload-preview-image');
            
            // 隐藏之前的结果
            document.getElementById('scan-upload-result').style.display = 'none';
            document.getElementById('copy-result').style.display = 'none';
            document.getElementById('open-result').style.display = 'none';
            
            if (file) {
                fileHint.textContent = file.name;
                fileHint.style.color = '#47630f';
                
                // 使用同一个FileReader来显示预览和扫描
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const dataUrl = e.target.result;
                    // 确保预览容器和图片元素存在
                    if (previewContainer && previewImage) {
                        previewImage.src = dataUrl;
                        previewImage.onload = () => {
                            // 图片加载成功后显示预览
                            previewContainer.style.display = 'block';
                        };
                        previewImage.onerror = () => {
                            console.error('Failed to load preview image');
                            previewContainer.style.display = 'none';
                        };
                    }
                    // 扫描二维码
                    await this.scanImageFromDataUrl(dataUrl, 'upload');
                };
                reader.onerror = () => {
                    this.showMessage(browserApi.i18n.getMessage('error_read_file_failed'), 'error');
                    if (previewContainer) {
                        previewContainer.style.display = 'none';
                    }
                };
                reader.readAsDataURL(file);
            } else {
                fileHint.textContent = browserApi.i18n.getMessage('popup_common_no_file_selected');
                fileHint.style.color = '#6c757d';
                if (previewContainer) {
                    previewContainer.style.display = 'none';
                }
            }
        });

        // 扫描结果操作
        document.getElementById('copy-result').addEventListener('click', () => {
            // 从data-content属性获取内容，如果没有则从可见的结果区域读取
            let content = document.getElementById('copy-result').getAttribute('data-content');
            if (!content) {
                // 检查哪个结果区域可见
                const uploadResult = document.getElementById('scan-upload-result');
                const urlResult = document.getElementById('scan-url-result');
                const oldResult = document.getElementById('scan-result');
                
                if (uploadResult.style.display !== 'none') {
                    content = document.getElementById('upload-result-content').textContent;
                } else if (urlResult.style.display !== 'none') {
                    content = document.getElementById('url-result-content').textContent;
                } else if (oldResult.style.display !== 'none') {
                    content = document.getElementById('result-content').textContent;
                }
            }
            
            if (content) {
                navigator.clipboard.writeText(content).then(() => {
                    this.showMessage(browserApi.i18n.getMessage('success_result_copied'), 'success');
                });
            }
        });

        document.getElementById('open-result').addEventListener('click', () => {
            // 从data-content属性获取内容，如果没有则从可见的结果区域读取
            let content = document.getElementById('open-result').getAttribute('data-content');
            if (!content) {
                // 检查哪个结果区域可见
                const uploadResult = document.getElementById('scan-upload-result');
                const urlResult = document.getElementById('scan-url-result');
                const oldResult = document.getElementById('scan-result');
                
                if (uploadResult.style.display !== 'none') {
                    content = document.getElementById('upload-result-content').textContent;
                } else if (urlResult.style.display !== 'none') {
                    content = document.getElementById('url-result-content').textContent;
                } else if (oldResult.style.display !== 'none') {
                    content = document.getElementById('result-content').textContent;
                }
            }
            
            if (content) {
                if (content.startsWith('http://') || content.startsWith('https://')) {
                    browserApi.tabs.create({ url: content });
                } else {
                    this.showMessage(browserApi.i18n.getMessage('warning_cannot_open_non_url'), 'warning');
                }
            }
        });

        // 上传到Google Drive模态框事件
        document.getElementById('close-upload-modal').addEventListener('click', () => {
            document.getElementById('upload-drive-modal').style.display = 'none';
            this.resetUploadModal();
        });

        document.getElementById('cancel-upload').addEventListener('click', () => {
            document.getElementById('upload-drive-modal').style.display = 'none';
            this.resetUploadModal();
        });

        document.getElementById('start-upload').addEventListener('click', () => {
            this.uploadFilesToDrive();
        });

        // 上传模式选择事件
        document.querySelectorAll('input[name="upload-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.uploadMode = e.target.value;
                this.updateUploadMode();
                this.saveSettings();
            });
        });

        // 统一的文件/文件夹选择入口
        const fileInput = document.getElementById('drive-upload-file');
        const folderInput = document.getElementById('drive-upload-folder');
        const fileLabel = document.getElementById('drive-file-label');
        
        // 点击标签时根据模式触发对应的选择器
        fileLabel.addEventListener('click', (e) => {
            e.preventDefault();
            if (this.uploadMode === 'file') {
                fileInput.click();
            } else {
                folderInput.click();
            }
        });

        // 文件选择事件
        fileInput.addEventListener('change', (e) => {
            if (this.uploadMode === 'file') {
                this.handleFileSelect(e.target.files, 'file');
            }
            e.target.value = ''; // 重置，允许重复选择
        });
        
        // 文件夹选择事件
        folderInput.addEventListener('change', (e) => {
            if (this.uploadMode === 'folder') {
                this.handleFileSelect(e.target.files, 'folder');
            }
            e.target.value = ''; // 重置，允许重复选择
        });

        // 可见性选择事件
        document.querySelectorAll('input[name="file-visibility"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.defaultVisibility = e.target.value;
                this.updateVisibilityOptions(e.target.value);
                this.saveSettings(); // 保存可见性选择
            });
        });

        // 用户信息模态框事件
        document.getElementById('close-user-info-modal').addEventListener('click', () => {
            this.hideUserInfoModal();
        });

        document.getElementById('open-drive-folder-btn').addEventListener('click', () => {
            this.handleOpenDriveFolder();
        });

        document.getElementById('logout-drive-btn').addEventListener('click', () => {
            this.handleLogoutDrive();
        });

        document.getElementById('revoke-google-auth-link').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleRevokeGoogleAuth();
        });

        // 点击模态框外部关闭
        document.getElementById('user-info-modal').addEventListener('click', (e) => {
            if (e.target.id === 'user-info-modal') {
                this.hideUserInfoModal();
            }
        });

        // 点击模态框外部关闭
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    // 如果是扫描模态框，需要重置
                    if (modal.id === 'scan-modal') {
                        this.resetScanModal();
                    }
                    // 如果是上传模态框，需要重置
                    if (modal.id === 'upload-drive-modal') {
                        this.resetUploadModal();
                    }
                    modal.style.display = 'none';
                }
            });
        });
    }

    applyEdit() {
        // 获取编辑选项
        this.qrOptions.foreground = document.getElementById('foreground-color').value;
        this.qrOptions.background = document.getElementById('background-color').value;
        this.qrOptions.width = parseInt(document.getElementById('qr-width').value);
        this.qrOptions.height = parseInt(document.getElementById('qr-height').value);
        this.qrOptions.logoOpacity = parseInt(document.getElementById('logo-opacity').value);

        // 重新生成二维码
        if (this.currentContent) {
            this.createQRCode(this.currentContent, this.currentType);
        }

        // 保存设置
        this.saveSettings();

        // 关闭模态框
        document.getElementById('edit-modal').style.display = 'none';
    }

    resetEdit() {
        this.qrOptions = {
            foreground: '#000000',
            background: '#FFFFFF',
            width: 512, // 默认尺寸512px（包含20px边框）
            height: 512, // 默认尺寸512px（包含20px边框）
            margin: 10,
            logo: null,
            logoOpacity: 100,
            builtinLogo: null
        };

        // 更新表单
        document.getElementById('foreground-color').value = this.qrOptions.foreground;
        document.getElementById('background-color').value = this.qrOptions.background;
        document.getElementById('qr-width').value = this.qrOptions.width;
        document.getElementById('qr-height').value = this.qrOptions.height;
        document.getElementById('logo-opacity').value = this.qrOptions.logoOpacity;
        document.getElementById('opacity-value').textContent = '100%';
        document.querySelector('.logo-options').style.display = 'none';
        document.getElementById('logo-file').value = '';
        
        // 重置文件名显示
        const fileLabel = document.getElementById('logo-file-label');
        const fileSelected = document.getElementById('logo-file-selected');
        if (fileLabel) fileLabel.style.display = 'flex';
        if (fileSelected) fileSelected.style.display = 'none';
        
        // 更新 logo 选择状态
        this.updateLogoSelectionState();
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

            // 获取 logo（内置或自定义）
            const logo = this.qrOptions.builtinLogo 
                ? browserApi.runtime.getURL(`images/qr-icon/${this.qrOptions.builtinLogo}`)
                : this.qrOptions.logo;

            // 使用计算后的尺寸生成下载用的二维码
            const downloadQRGenerator = new QRCodeWithLogo({
                width: qrWidth,
                height: qrHeight,
                colorDark: this.qrOptions.foreground,
                colorLight: this.qrOptions.background,
                correctLevel: QRCode.CorrectLevel.H,
                logo: logo,
                logoSize: 0.2,
                logoOpacity: this.qrOptions.logoOpacity / 100
            });

            // 创建临时容器生成下载用的二维码
            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-9999px';
            tempContainer.style.top = '-9999px';
            document.body.appendChild(tempContainer);

            const downloadCanvas = downloadQRGenerator.generate(this.currentContent, tempContainer);
            
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

            // 获取 logo（内置或自定义）
            const logo = this.qrOptions.builtinLogo 
                ? browserApi.runtime.getURL(`images/qr-icon/${this.qrOptions.builtinLogo}`)
                : this.qrOptions.logo;

            // 使用计算后的尺寸生成复制用的二维码
            const copyQRGenerator = new QRCodeWithLogo({
                width: qrWidth,
                height: qrHeight,
                colorDark: this.qrOptions.foreground,
                colorLight: this.qrOptions.background,
                correctLevel: QRCode.CorrectLevel.H,
                logo: logo,
                logoSize: 0.2,
                logoOpacity: this.qrOptions.logoOpacity / 100
            });

            // 创建临时容器生成复制用的二维码
            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-9999px';
            tempContainer.style.top = '-9999px';
            document.body.appendChild(tempContainer);

            const copyCanvas = copyQRGenerator.generate(this.currentContent, tempContainer);
            
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
            this.showMessage(browserApi.i18n.getMessage('error_copy_qr_failed'), 'error');
        }
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

    showScanModal() {
        document.getElementById('scan-modal').style.display = 'flex';
        // 重置到选择页面
        this.resetScanModal();
    }

    resetScanModal() {
        // 默认显示local tab
        this.switchScanTab('local');
        
        // 隐藏所有结果区域
        document.getElementById('scan-upload-result').style.display = 'none';
        document.getElementById('scan-url-result').style.display = 'none';
        document.getElementById('scan-result').style.display = 'none';
        
        // 隐藏所有预览区域
        document.getElementById('scan-upload-preview').style.display = 'none';
        document.getElementById('scan-url-preview').style.display = 'none';
        
        // 重置表单
        document.getElementById('qr-file').value = '';
        const fileHint = document.querySelector('#scan-modal .file-input-hint');
        if (fileHint) {
            fileHint.textContent = browserApi.i18n.getMessage('popup_common_no_file_selected');
            fileHint.style.color = '#6c757d';
        }
        document.getElementById('scan-url-input').value = '';
        
        // 隐藏底部的Copy和Open按钮
        document.getElementById('copy-result').style.display = 'none';
        document.getElementById('open-result').style.display = 'none';
    }

    switchScanTab(tab) {
        const localTab = document.getElementById('scan-tab-local');
        const urlTab = document.getElementById('scan-tab-url');
        const uploadSection = document.getElementById('scan-upload-section');
        const urlSection = document.getElementById('scan-url-section');
        
        // 重置tab状态
        localTab.classList.remove('active');
        urlTab.classList.remove('active');
        
        // 隐藏所有section
        uploadSection.style.display = 'none';
        urlSection.style.display = 'none';
        
        // 不隐藏结果区域和预览区域，保留它们以便切换tab时显示
        // 只更新底部按钮的显示状态
        
        if (tab === 'local') {
            localTab.classList.add('active');
            uploadSection.style.display = 'block';
            
            // 检查是否有上传结果，如果有则显示底部按钮
            const uploadResult = document.getElementById('scan-upload-result');
            if (uploadResult && uploadResult.style.display !== 'none') {
                document.getElementById('copy-result').style.display = 'flex';
                document.getElementById('open-result').style.display = 'flex';
            } else {
                document.getElementById('copy-result').style.display = 'none';
                document.getElementById('open-result').style.display = 'none';
            }
        } else if (tab === 'url') {
            urlTab.classList.add('active');
            urlSection.style.display = 'block';
            
            // 检查是否有URL结果，如果有则显示底部按钮
            const urlResult = document.getElementById('scan-url-result');
            if (urlResult && urlResult.style.display !== 'none') {
                document.getElementById('copy-result').style.display = 'flex';
                document.getElementById('open-result').style.display = 'flex';
            } else {
                document.getElementById('copy-result').style.display = 'none';
                document.getElementById('open-result').style.display = 'none';
            }
            
            // 聚焦到URL输入框
            setTimeout(() => {
                document.getElementById('scan-url-input').focus();
            }, 100);
        }
    }

    async scanQRCodeFromFile(file) {
        try {
            // 显示加载状态
            this.showMessage(browserApi.i18n.getMessage('info_scanning_qr'), 'info');
            
            const reader = new FileReader();
            reader.onload = async (e) => {
                await this.scanImageFromDataUrl(e.target.result, 'upload');
            };
            
            reader.onerror = () => {
                this.showMessage(browserApi.i18n.getMessage('error_read_file_failed'), 'error');
            };
            
            reader.readAsDataURL(file);
        } catch (error) {
            this.showMessage(browserApi.i18n.getMessage('error_read_file_failed_reason', [error.message]), 'error');
        }
    }

    async scanFromUrl() {
        const urlInput = document.getElementById('scan-url-input');
        const url = urlInput.value.trim();
        
        if (!url) {
            this.showMessage(browserApi.i18n.getMessage('error_invalid_url'), 'error');
            return;
        }
        
        // 验证URL格式
        try {
            new URL(url);
        } catch (error) {
            this.showMessage(browserApi.i18n.getMessage('error_invalid_url'), 'error');
            return;
        }
        
        // 隐藏之前的结果
        document.getElementById('scan-url-result').style.display = 'none';
        document.getElementById('copy-result').style.display = 'none';
        document.getElementById('open-result').style.display = 'none';
        
        try {
            // 显示加载状态
            this.showMessage(browserApi.i18n.getMessage('info_scanning_qr'), 'info');
            
            // 使用fetch获取图片，但需要处理CORS
            // 由于CORS限制，我们尝试直接加载图片
            await this.scanImageFromUrl(url, 'url');
        } catch (error) {
            this.showMessage(browserApi.i18n.getMessage('error_load_image_failed'), 'error');
            // 隐藏预览
            document.getElementById('scan-url-preview').style.display = 'none';
        }
    }

    async scanImageFromUrl(url, source) {
        return new Promise((resolve, reject) => {
            // 先尝试显示预览（即使可能因为CORS失败）
            const previewContainer = document.getElementById('scan-url-preview');
            const previewImage = document.getElementById('url-preview-image');
            if (previewContainer && previewImage) {
                previewImage.src = url;
                previewContainer.style.display = 'block';
            }
            
            const img = new Image();
            img.crossOrigin = 'anonymous'; // 尝试跨域请求
            
            img.onload = async () => {
                try {
                    // 确保预览已显示
                    if (previewContainer && previewImage) {
                        previewImage.src = url;
                        previewContainer.style.display = 'block';
                    }
                    
                    await this.scanImageFromElement(img, source);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            
            img.onerror = () => {
                // 如果直接加载失败，尝试使用代理或提示用户
                this.showMessage(browserApi.i18n.getMessage('error_load_image_failed_cors'), 'error');
                // 隐藏预览
                if (previewContainer) {
                    previewContainer.style.display = 'none';
                }
                reject(new Error('Failed to load image'));
            };
            
            img.src = url;
        });
    }

    async scanImageFromDataUrl(dataUrl, source) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = async () => {
                try {
                    // 如果是upload source，确保预览已显示
                    if (source === 'upload') {
                        const previewContainer = document.getElementById('scan-upload-preview');
                        const previewImage = document.getElementById('upload-preview-image');
                        if (previewContainer && previewImage) {
                            // 如果预览图片的src不同，更新它
                            if (previewImage.src !== dataUrl) {
                                previewImage.src = dataUrl;
                            }
                            // 确保预览容器显示
                            if (previewContainer.style.display === 'none') {
                                previewContainer.style.display = 'block';
                            }
                        }
                    }
                    
                    await this.scanImageFromElement(img, source);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            
            img.onerror = () => {
                this.showMessage(browserApi.i18n.getMessage('error_load_image_failed'), 'error');
                reject(new Error('Failed to load image'));
            };
            
            img.src = dataUrl;
        });
    }

    async scanImageFromElement(img, source) {
                    try {
                        // 检查图片尺寸
                        if (img.width < 50 || img.height < 50) {
                            this.showMessage(browserApi.i18n.getMessage('error_image_too_small'), 'error');
                            return;
                        }
                        
                        // 使用jsQR库来扫描二维码
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx.drawImage(img, 0, 0);
                        
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        
            // 使用改进的jsQR适配器扫描二维码
                        const result = await this.decodeQRCode(imageData);
                        
                        if (result) {
                            this.showScanResult(result, source);
                            this.showMessage(browserApi.i18n.getMessage('success_scan_completed'), 'success');
                        } else {
                            this.showMessage(browserApi.i18n.getMessage('error_no_qr_found'), 'error');
                        }
                    } catch (error) {
                        this.showMessage(browserApi.i18n.getMessage('error_scan_failed', [error.message]), 'error');
                    }
    }


    async decodeQRCode(imageData) {
        try {
            // 使用改进的jsQR适配器扫描二维码
            const result = window.jsQRImproved.scan(imageData, imageData.width, imageData.height);
            
            if (result) {
                // 格式化结果用于显示
                const formattedResult = window.jsQRImproved.formatResult(result);
                return {
                    data: formattedResult.data,
                    type: formattedResult.type,
                    displayData: formattedResult.displayData,
                    isValid: formattedResult.isValid
                };
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    showScanResult(result, source) {
        // 根据source确定显示在哪个section
        let resultContainer, typeElement, contentElement;
        const localTab = document.getElementById('scan-tab-local');
        const urlTab = document.getElementById('scan-tab-url');
        const uploadSection = document.getElementById('scan-upload-section');
        const urlSection = document.getElementById('scan-url-section');
        
        if (source === 'upload') {
            // 设置tab状态为local
            localTab.classList.add('active');
            urlTab.classList.remove('active');
            uploadSection.style.display = 'block';
            urlSection.style.display = 'none';
            
            resultContainer = document.getElementById('scan-upload-result');
            typeElement = document.getElementById('upload-result-type');
            contentElement = document.getElementById('upload-result-content');
        } else if (source === 'url') {
            // 设置tab状态为url
            urlTab.classList.add('active');
            localTab.classList.remove('active');
            urlSection.style.display = 'block';
            uploadSection.style.display = 'none';
            
            resultContainer = document.getElementById('scan-url-result');
            typeElement = document.getElementById('url-result-type');
            contentElement = document.getElementById('url-result-content');
        } else {
            // 兼容旧代码，使用原来的结果区域
            localTab.classList.add('active');
            urlTab.classList.remove('active');
            uploadSection.style.display = 'block';
            urlSection.style.display = 'none';
            
            resultContainer = document.getElementById('scan-result');
            typeElement = document.getElementById('result-type');
            contentElement = document.getElementById('result-content');
        }
        
        // 设置结果类型
        typeElement.textContent = browserApi.i18n.getMessage(`type_${result.type.toLowerCase()}`) || result.type;
        
        // 使用格式化后的显示数据
        if (result.displayData) {
            contentElement.textContent = result.displayData;
        } else {
            contentElement.textContent = result.data;
        }
        
        // 添加有效性指示
        if (result.isValid === false) {
            contentElement.style.color = '#dc3545';
            contentElement.style.fontStyle = 'italic';
        } else {
            contentElement.style.color = '#333';
            contentElement.style.fontStyle = 'normal';
        }
        
        // 显示结果区域
        resultContainer.style.display = 'block';
        
        // 显示底部的Copy和Open按钮
        document.getElementById('copy-result').style.display = 'flex';
        document.getElementById('open-result').style.display = 'flex';
        
        // 更新底部按钮的数据源
        document.getElementById('copy-result').setAttribute('data-content', result.data);
        document.getElementById('open-result').setAttribute('data-content', result.data);
        
        // 为URL类型的扫描结果获取favicon URL
        let faviconUrl = null;
        if (result.type === 'url' && this.isUrl(result.data)) {
            try {
                // 尝试从扫描的URL获取favicon
                const faviconUrls = this.getFaviconUrl(result.data);
                if (faviconUrls && faviconUrls.length > 0) {
                    // 使用第一个favicon URL作为默认值
                    faviconUrl = faviconUrls[0];
                }
            } catch (error) {
                // 静默处理favicon获取失败
            }
        }
        
        // 添加到扫描历史记录
        this.addToHistory('scanned', {
            content: result.data,
            type: result.type,
            displayData: result.displayData,
            faviconUrl: faviconUrl,
            timestamp: new Date().toISOString()
        });
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
            this.updateUploadMode();
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
    }

    showHistoryModal() {
        document.getElementById('history-modal').style.display = 'flex';
        this.renderHistory();
    }

    renderHistory() {
        this.renderGeneratedHistory();
        this.renderScannedHistory();
    }

    renderGeneratedHistory() {
        const container = document.getElementById('generate-history');
        
        if (this.history.generated.length === 0) {
            container.innerHTML = `
                <div class="empty-history">
                    <div class="empty-history-icon">📱</div>
                    <div class="empty-history-text">${this.escapeHtml(browserApi.i18n.getMessage('popup_history_empty_generated_title'))}</div>
                    <div class="empty-history-hint">${this.escapeHtml(browserApi.i18n.getMessage('popup_history_empty_generated_hint'))}</div>
                </div>
            `;
            return;
        }

        container.innerHTML = this.history.generated.map((record, index) => {
            const time = this.formatTime(record.timestamp);
            const isUrl = this.isUrl(record.content);
            const dirAttr = isUrl ? 'dir="ltr"' : '';
            const copyText = this.escapeHtml(browserApi.i18n.getMessage('popup_history_action_copy'));
            
            // 判断是否是Google Drive链接
            const isGoogleDrive = record.isGoogleDrive || (isUrl && record.content.includes('drive.google.com'));
            
            // 确定标题显示内容
            let title;
            if (isGoogleDrive && record.fileName) {
                title = this.escapeHtml(this.truncateText(record.fileName, 60));
            } else {
                title = this.escapeHtml(this.truncateText(record.content, 60));
            }
            
            // 确定类型显示内容
            let typeDisplay;
            if (isGoogleDrive && record.fileType) {
                typeDisplay = record.fileType.toUpperCase();
            } else {
                typeDisplay = record.type.toUpperCase();
            }

            // 使用Google Drive icon或保存的favicon URL或占位图标
            let iconHtml = '📱';
            if (isGoogleDrive) {
                // 使用Google Drive的PNG icon
                iconHtml = `<img src="images/qr-icon/googledrive.png" alt="Google Drive" class="google-drive-icon" />
                           <span class="fallback-icon" style="display: none;">📱</span>`;
            } else if (isUrl && record.faviconUrl) {
                iconHtml = `<img src="${this.escapeHtmlForAttribute(record.faviconUrl)}" alt="favicon" class="favicon" />
                           <span class="fallback-icon" style="display: none;">📱</span>`;
            } else if (isUrl) {
                iconHtml = `<span class="fallback-icon">📱</span>
                           <img src="" alt="favicon" class="favicon" style="display: none;" />`;
            }
            
            return `
                <div class="history-item" data-index="${index}" data-content="${this.escapeHtmlForAttribute(record.content)}" data-type="${this.escapeHtmlForAttribute(record.type)}" title="双击恢复此记录">
                    <div class="history-icon generate">
                        ${iconHtml}
                    </div>
                    <div class="history-content-wrapper">
                        <div class="history-title" ${dirAttr}>${title}</div>
                        <div class="history-subtitle">
                            <span>${this.escapeHtml(typeDisplay)}</span>
                            <span class="history-time">${time}</span>
                        </div>
                    </div>
                    <div class="history-actions">
                        <button class="history-action-btn copy-btn" data-content="${this.escapeHtmlForAttribute(record.content)}">${copyText}</button>
                    </div>
                </div>
            `;
        }).join('');
        
        // 绑定图片错误处理事件
        this.bindImageErrorHandlers(container);
        
        // 绑定双击事件：跳转到popup页面并重新展示记录
        container.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const content = item.dataset.content;
                const type = item.dataset.type;
                if (content && type) {
                    this.restoreHistoryRecord(content, type);
                }
            });
        });
        
        // 绑定复制按钮事件
        container.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const content = btn.dataset.content;
                if (content) {
                    navigator.clipboard.writeText(content).then(() => {
                        this.showMessage(browserApi.i18n.getMessage('success_copied'), 'success');
                    }).catch(() => {
                        this.showMessage(browserApi.i18n.getMessage('error_copy_failed'), 'error');
                    });
                }
            });
        });
        
        // 只为没有favicon URL的记录异步加载favicon
        this.loadFaviconsForHistory('generated');
    }
    
    /**
     * 恢复历史记录到popup页面
     * @param {string} content - 记录内容
     * @param {string} type - 记录类型
     */
    async restoreHistoryRecord(content, type) {
        // 关闭历史记录模态框
        document.getElementById('history-modal').style.display = 'none';
        
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

    renderScannedHistory() {
        const container = document.getElementById('scan-history');
        
        if (this.history.scanned.length === 0) {
            container.innerHTML = `
                <div class="empty-history">
                    <div class="empty-history-icon">🔍</div>
                    <div class="empty-history-text">${this.escapeHtml(browserApi.i18n.getMessage('popup_history_empty_scanned_title'))}</div>
                    <div class="empty-history-hint">${this.escapeHtml(browserApi.i18n.getMessage('popup_history_empty_scanned_hint'))}</div>
                </div>
            `;
            return;
        }

        container.innerHTML = this.history.scanned.map((record, index) => {
            const time = this.formatTime(record.timestamp);
            const title = this.escapeHtml(this.truncateText(record.displayData || record.content, 60));
            const isUrl = this.isUrl(record.content);
            const dirAttr = isUrl ? 'dir="ltr"' : '';
            const copyText = this.escapeHtml(browserApi.i18n.getMessage('popup_history_action_copy'));
            

            // 使用保存的favicon URL或占位图标
            let iconHtml = '🔍';
            if (isUrl && record.faviconUrl) {
                iconHtml = `<img src="${this.escapeHtmlForAttribute(record.faviconUrl)}" alt="favicon" class="favicon" />
                           <span class="fallback-icon" style="display: none;">🔍</span>`;
            } else if (isUrl) {
                iconHtml = `<span class="fallback-icon">🔍</span>
                           <img src="" alt="favicon" class="favicon" style="display: none;" />`;
            }
            
            return `
                <div class="history-item" data-index="${index}" data-content="${this.escapeHtmlForAttribute(record.content)}" data-type="${this.escapeHtmlForAttribute(record.type)}" title="双击恢复此记录">
                    <div class="history-icon scan">
                        ${iconHtml}
                    </div>
                    <div class="history-content-wrapper">
                        <div class="history-title" ${dirAttr}>${title}</div>
                        <div class="history-subtitle">
                            <span>${this.escapeHtml(record.type.toUpperCase())}</span>
                            <span class="history-time">${time}</span>
                        </div>
                    </div>
                    <div class="history-actions">
                        <button class="history-action-btn copy-btn" data-content="${this.escapeHtmlForAttribute(record.content)}">${copyText}</button>
                    </div>
                </div>
            `;
        }).join('');
        
        // 绑定图片错误处理事件
        this.bindImageErrorHandlers(container);
        
        // 绑定双击事件：跳转到popup页面并重新展示记录
        container.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const content = item.dataset.content;
                const type = item.dataset.type;
                if (content && type) {
                    this.restoreHistoryRecord(content, type);
                }
            });
        });
        
        // 绑定复制按钮事件
        container.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const content = btn.dataset.content;
                if (content) {
                    navigator.clipboard.writeText(content).then(() => {
                        this.showMessage(browserApi.i18n.getMessage('success_copied'), 'success');
                    }).catch(() => {
                        this.showMessage(browserApi.i18n.getMessage('error_copy_failed'), 'error');
                    });
                }
            });
        });
        
        // 只为没有favicon URL的记录异步加载favicon
        this.loadFaviconsForHistory('scanned');
    }

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

    copyHistoryContent(content) {
        // 检查内容是否有效（包括空字符串）
        if (content === null || content === undefined || (typeof content === 'string' && content.trim() === '')) {
            const errorMsg = browserApi.i18n.getMessage('error_no_content_to_copy') || '没有可复制的内容';
            this.showMessage(errorMsg, 'error');
            return;
        }
        
        // 确保内容是字符串类型
        if (typeof content !== 'string') {
            const errorMsg = browserApi.i18n.getMessage('error_invalid_copy_content') || '无法复制该内容';
            this.showMessage(errorMsg, 'error');
            return;
        }
        
        // 检查navigator.clipboard是否可用
        if (!navigator.clipboard) {
            const errorMsg = browserApi.i18n.getMessage('error_clipboard_not_supported') || '剪贴板不支持';
            this.showMessage(errorMsg, 'error');
            return;
        }
        
        navigator.clipboard.writeText(content)
            .then(() => {
                const successMsg = browserApi.i18n.getMessage('success_text_copied') || '内容已复制到剪贴板';
                this.showMessage(successMsg, 'success');
            })
            .catch((error) => {
                // 尝试使用备用方法
                this.fallbackCopyTextToClipboard(content);
            });
    }
    
    fallbackCopyTextToClipboard(text) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                const successMsg = browserApi.i18n.getMessage('success_text_copied') || '内容已复制到剪贴板';
                this.showMessage(successMsg, 'success');
            } else {
                const errorMsg = browserApi.i18n.getMessage('error_copy_failed') || '复制失败';
                this.showMessage(errorMsg, 'error');
            }
        } catch (error) {
            const errorMsg = browserApi.i18n.getMessage('error_copy_failed') || '复制失败';
            this.showMessage(errorMsg, 'error');
        }
    }

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

    // Google Drive上传相关方法
    /**
     * 显示上传到Google Drive模态框
     * 根据授权状态显示不同的界面
     */
    async showUploadDriveModal() {
        document.getElementById('upload-drive-modal').style.display = 'flex';
        this.resetUploadModal();
        
        try {
            // 初始化Google Drive API
            await this.googleDriveAPI.init();
            
            // 检查是否已授权
            const isAuthenticated = await this.googleDriveAPI.isAuthenticated();
            
            if (isAuthenticated) {
                // 已授权，显示文件上传界面
                this.showUploadSection();
            } else {
                // 未授权，显示授权登录界面
                this.showAuthSection();
            }
        } catch (error) {
            console.error('[Upload] 初始化失败:', error);
            this.showAuthSection();
        }
    }

    /**
     * 显示授权登录界面
     */
    showAuthSection() {
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('upload-section').style.display = 'none';
        document.getElementById('start-upload').style.display = 'none';
        document.getElementById('user-avatar-container').style.display = 'none';
        
        // 移除登录状态的绿色样式
        const uploadBtn = document.getElementById('upload-drive-btn');
        if (uploadBtn) {
            uploadBtn.classList.remove('authenticated');
        }
    }

    /**
     * 显示文件上传界面
     */
    showUploadSection() {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('upload-section').style.display = 'block';
        document.getElementById('start-upload').style.display = 'inline-block';
        
        // 恢复保存的上传模式选择
        const uploadModeRadio = document.querySelector(`input[name="upload-mode"][value="${this.uploadMode}"]`);
        if (uploadModeRadio) {
            uploadModeRadio.checked = true;
        }
        this.updateUploadMode();
        
        // 恢复保存的可见性选择
        const savedVisibility = this.defaultVisibility || 'anyone';
        const visibilityRadio = document.querySelector(`input[name="file-visibility"][value="${savedVisibility}"]`);
        if (visibilityRadio) {
            visibilityRadio.checked = true;
            this.updateVisibilityOptions(savedVisibility);
        } else {
            // 如果保存的值不存在，使用默认值
            const defaultRadio = document.querySelector('input[name="file-visibility"][value="anyone"]');
            if (defaultRadio) {
                defaultRadio.checked = true;
                this.updateVisibilityOptions('anyone');
            }
        }
        
        // 加载用户信息
        this.loadUserAvatar();
        
        // 更新上传按钮的登录状态样式
        this.updateUploadButtonAuthState(true);
    }
    
    /**
     * 更新上传按钮的登录状态样式
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
                console.error('[Upload] 检查登录状态失败:', error);
                isAuthenticated = false;
            }
        }
        
        if (isAuthenticated) {
            uploadBtn.classList.add('authenticated');
        } else {
            uploadBtn.classList.remove('authenticated');
        }
    }

    /**
     * 处理Google登录按钮点击
     */
    async handleGoogleSignIn() {
        const signInBtn = document.getElementById('google-signin-btn');
        const signInText = signInBtn.querySelector('span');
        signInBtn.disabled = true;
        if (signInText) {
            signInText.textContent = browserApi.i18n.getMessage('popup_upload_auth_processing') || '正在登录...';
        }
        
        try {
            // 保存当前状态，防止popup关闭后丢失
            await browserApi.storage.local.set({
                pendingAuthAction: 'signin',
                pendingAuthTimestamp: Date.now()
            });
            
            // 获取访问令牌（会触发授权流程）
            await this.googleDriveAPI.getAccessToken();
            console.log('[Upload] 授权成功');
            
            // 清除待处理状态
            await browserApi.storage.local.remove('pendingAuthAction');
            
            // 授权成功后，切换到文件上传界面
            this.showUploadSection();
            this.showMessage(browserApi.i18n.getMessage('success_auth_granted'), 'success');
        } catch (authError) {
            console.error('[Upload] 授权失败:', authError);
            
            // 清除待处理状态
            await browserApi.storage.local.remove('pendingAuthAction');
            
            this.showMessage(
                browserApi.i18n.getMessage('error_auth_failed', [authError.message || authError.toString()]), 
                'error'
            );
        } finally {
            signInBtn.disabled = false;
            if (signInText) {
                signInText.textContent = browserApi.i18n.getMessage('popup_upload_auth_button');
            }
        }
    }

    resetUploadModal() {
        this.clearSelection();
        document.getElementById('drive-upload-file').value = '';
        document.getElementById('drive-upload-folder').value = '';
        document.getElementById('upload-progress').style.display = 'none';
        document.getElementById('upload-result').style.display = 'none';
        document.getElementById('start-upload').disabled = false;
        
        // 恢复保存的可见性选择
        const savedVisibility = this.defaultVisibility || 'anyone';
        const visibilityRadio = document.querySelector(`input[name="file-visibility"][value="${savedVisibility}"]`);
        if (visibilityRadio) {
            visibilityRadio.checked = true;
            this.updateVisibilityOptions(savedVisibility);
        } else {
            // 如果保存的值不存在，使用默认值
            const defaultRadio = document.querySelector('input[name="file-visibility"][value="anyone"]');
            if (defaultRadio) {
                defaultRadio.checked = true;
                this.updateVisibilityOptions('anyone');
            }
        }
    }

    /**
     * 更新可见性选项的选中状态
     * @param {string} selectedValue - 选中的可见性值
     */
    updateVisibilityOptions(selectedValue) {
        document.querySelectorAll('.visibility-option').forEach(option => {
            const radio = option.querySelector('input[type="radio"]');
            if (radio && radio.value === selectedValue) {
                option.classList.add('checked');
            } else {
                option.classList.remove('checked');
            }
        });
    }
    
    async loadUserAvatar() {
        try {
            await this.googleDriveAPI.init();
            const userInfo = await this.googleDriveAPI.getUserInfo();
            
            if (userInfo && userInfo.picture) {
                const avatarContainer = document.getElementById('user-avatar-container');
                const avatarImg = document.getElementById('user-avatar');
                
                avatarImg.src = userInfo.picture;
                avatarImg.alt = userInfo.name || 'User Avatar';
                avatarImg.title = userInfo.name || '点击查看账户信息';
                avatarContainer.style.display = 'block';
                
                // 点击头像打开用户信息模态框
                avatarContainer.onclick = () => {
                    this.showUserInfoModal(userInfo);
                };
                
                // 更新上传按钮的登录状态样式
                this.updateUploadButtonAuthState(true);
            } else {
                document.getElementById('user-avatar-container').style.display = 'none';
                // 更新上传按钮的登录状态样式
                this.updateUploadButtonAuthState(false);
            }
        } catch (error) {
            console.error('[Upload] 加载用户头像失败:', error);
            document.getElementById('user-avatar-container').style.display = 'none';
            // 更新上传按钮的登录状态样式
            this.updateUploadButtonAuthState(false);
        }
    }

    /**
     * 显示用户信息模态框
     */
    async showUserInfoModal(userInfo = null) {
        const modal = document.getElementById('user-info-modal');
        const avatarImg = document.getElementById('user-info-avatar');
        const nameEl = document.getElementById('user-info-name');
        const emailEl = document.getElementById('user-info-email');
        
        // 如果没有传入userInfo，尝试从API获取
        if (!userInfo) {
            try {
                await this.googleDriveAPI.init();
                userInfo = await this.googleDriveAPI.getUserInfo();
            } catch (error) {
                console.error('[User Info] 获取用户信息失败:', error);
                this.showMessage(browserApi.i18n.getMessage('error_drive_init_failed', [error.message || error.toString()]), 'error');
                return;
            }
        }
        
        if (userInfo) {
            if (avatarImg) avatarImg.src = userInfo.picture || '';
            if (nameEl) nameEl.textContent = userInfo.name || '';
            if (emailEl) emailEl.textContent = userInfo.email || '';
        }
        
        modal.style.display = 'flex';
    }

    /**
     * 隐藏用户信息模态框
     */
    hideUserInfoModal() {
        const modal = document.getElementById('user-info-modal');
        modal.style.display = 'none';
    }

    /**
     * 处理打开Drive文件夹
     */
    async handleOpenDriveFolder() {
        try {
            const folderLink = await this.googleDriveAPI.getFolderLink();
            if (folderLink) {
                browserApi.tabs.create({ url: folderLink });
                this.hideUserInfoModal();
            } else {
                this.showMessage(browserApi.i18n.getMessage('error_folder_not_found'), 'error');
            }
        } catch (error) {
            console.error('[User Info] 打开文件夹失败:', error);
            this.showMessage(browserApi.i18n.getMessage('error_folder_not_found'), 'error');
        }
    }

    /**
     * 处理登出（清除本地授权）
     */
    async handleLogoutDrive() {
        try {
            await this.googleDriveAPI.logout();
            this.hideUserInfoModal();
            // 隐藏头像
            document.getElementById('user-avatar-container').style.display = 'none';
            // 显示授权界面
            this.showAuthSection();
            // 更新上传按钮的登录状态样式
            this.updateUploadButtonAuthState(false);
            this.showMessage(browserApi.i18n.getMessage('success_logout'), 'success');
        } catch (error) {
            console.error('[User Info] 登出失败:', error);
            this.showMessage(browserApi.i18n.getMessage('error_logout_failed'), 'error');
        }
    }

    /**
     * 处理撤销 Google 授权（跳转到授权管理页面）
     */
    async handleRevokeGoogleAuth() {
        try {
            // 先清除本地授权并尝试移除权限
            await this.googleDriveAPI.logout(true);
        } catch (err) {
            console.error('[User Info] 清除本地授权失败:', err);
        }
        
        // 跳转到 Google 授权管理页面
        const revokeUrl = 'https://myaccount.google.com/connections';
        browserApi.tabs.create({ url: revokeUrl });
        
        this.hideUserInfoModal();
        // 隐藏头像
        document.getElementById('user-avatar-container').style.display = 'none';
        // 显示授权界面
        this.showAuthSection();
        
        this.showMessage(browserApi.i18n.getMessage('info_revoke_auth_opened'), 'info');
    }

    /**
     * 更新上传模式UI
     */
    updateUploadMode() {
        const fileLabel = document.getElementById('drive-file-label');
        const fileInputText = fileLabel.querySelector('.file-input-text');
        
        // 清除之前的选择
        this.clearSelection();
        
        // 更新标签文本
        if (this.uploadMode === 'file') {
            fileInputText.textContent = browserApi.i18n.getMessage('popup_upload_choose_file') || '选择文件';
            fileLabel.setAttribute('for', 'drive-upload-file');
        } else {
            fileInputText.textContent = browserApi.i18n.getMessage('popup_upload_choose_folder') || '选择文件夹';
            fileLabel.setAttribute('for', 'drive-upload-folder');
        }
        
        // 更新上传模式选项的选中状态样式
        this.updateUploadModeOptions(this.uploadMode);
    }
    
    /**
     * 更新上传模式选项的选中状态
     * @param {string} selectedValue - 选中的模式值 ('file' 或 'folder')
     */
    updateUploadModeOptions(selectedValue) {
        document.querySelectorAll('.upload-mode-option').forEach(option => {
            const radio = option.querySelector('input[type="radio"]');
            if (radio && radio.value === selectedValue) {
                option.classList.add('checked');
            } else {
                option.classList.remove('checked');
            }
        });
    }
    
    /**
     * 处理文件或文件夹选择
     * @param {FileList} files - 选择的文件列表
     * @param {string} type - 'file' 或 'folder'
     */
    handleFileSelect(files, type) {
        if (!files || files.length === 0) {
            this.updateSelectionDisplay();
            return;
        }
        
        // 检查类型是否匹配当前模式
        if ((type === 'file' && this.uploadMode !== 'file') || 
            (type === 'folder' && this.uploadMode !== 'folder')) {
            return; // 类型不匹配，忽略
        }
        
        const fileArray = Array.from(files);
        
        if (type === 'folder') {
            // 文件夹选择：提取文件夹名和文件列表
            const firstFile = fileArray[0];
            let folderName = '文件夹';
            
            if (firstFile.webkitRelativePath) {
                const pathParts = firstFile.webkitRelativePath.split('/');
                folderName = pathParts[0];
            }
            
            // 文件夹模式：只保留一个文件夹
            this.selectedFolders = [{
                name: folderName,
                files: fileArray
            }];
            this.selectedFiles = []; // 清除文件选择
        } else {
            // 文件选择：添加到文件列表（去重）
            fileArray.forEach(file => {
                const exists = this.selectedFiles.some(f => 
                    f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
                );
                if (!exists) {
                    this.selectedFiles.push(file);
                }
            });
            this.selectedFolders = []; // 清除文件夹选择
        }
        
        this.updateSelectionDisplay();
    }
    
    /**
     * 更新选择显示
     */
    updateSelectionDisplay() {
        const fileHint = document.getElementById('drive-file-label').querySelector('.file-input-hint');
        
        if (this.uploadMode === 'file') {
            // 文件模式
            if (this.selectedFiles.length === 0) {
                fileHint.textContent = browserApi.i18n.getMessage('popup_common_no_file_selected');
                fileHint.style.color = '#6c757d';
            } else if (this.selectedFiles.length === 1) {
                fileHint.textContent = this.selectedFiles[0].name;
                fileHint.style.color = '#47630f';
            } else {
                fileHint.textContent = browserApi.i18n.getMessage('popup_upload_files_selected', [this.selectedFiles.length]);
                fileHint.style.color = '#47630f';
            }
        } else {
            // 文件夹模式
            if (this.selectedFolders.length === 0) {
                fileHint.textContent = browserApi.i18n.getMessage('popup_common_no_file_selected');
                fileHint.style.color = '#6c757d';
            } else {
                const folder = this.selectedFolders[0];
                fileHint.textContent = `${folder.name} (${folder.files.length} 个文件)`;
                fileHint.style.color = '#47630f';
            }
        }
    }
    
    /**
     * 清除选择
     */
    clearSelection() {
        this.selectedFiles = [];
        this.selectedFolders = [];
        this.updateSelectionDisplay();
    }
    
    /**
     * 生成日期时间戳文件夹名
     * @returns {string} 格式：2025-11-20_18:34:12
     */
    generateDateFolderName() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}_${hours}:${minutes}:${seconds}`;
    }

    async uploadFilesToDrive() {
        console.log('[Upload] 开始上传流程');
        console.log('[Upload] 选中文件数量:', this.selectedFiles.length);
        console.log('[Upload] 选中文件夹数量:', this.selectedFolders.length);
        console.log('[Upload] 文件列表:', this.selectedFiles.map(f => ({
            name: f.name,
            size: f.size,
            type: f.type
        })));
        console.log('[Upload] 文件夹列表:', this.selectedFolders.map(f => ({
            name: f.name,
            fileCount: f.files.length
        })));

        // 检查是否有选择
        if (this.selectedFiles.length === 0 && this.selectedFolders.length === 0) {
            console.warn('[Upload] 没有选中文件或文件夹');
            this.showMessage(browserApi.i18n.getMessage('error_no_file_selected'), 'error');
            return;
        }

        try {
            // 初始化Google Drive API
            console.log('[Upload] 初始化Google Drive API...');
            await this.googleDriveAPI.init();
            console.log('[Upload] Google Drive API初始化成功');

            // 检查是否已授权，如果没有则先获取授权
            console.log('[Upload] 检查授权状态...');
            const isAuthenticated = await this.googleDriveAPI.isAuthenticated();
            if (!isAuthenticated) {
                console.log('[Upload] 未授权，开始获取授权...');
                this.showMessage(browserApi.i18n.getMessage('info_requesting_auth'), 'info');
                
                // 保存当前状态，防止popup关闭后丢失
                await browserApi.storage.local.set({
                    pendingAuthAction: 'upload',
                    pendingAuthTimestamp: Date.now()
                });
                
                // 获取访问令牌（会触发授权流程）
                try {
                    await this.googleDriveAPI.getAccessToken();
                    console.log('[Upload] 授权成功');
                    
                    // 清除待处理状态
                    await browserApi.storage.local.remove('pendingAuthAction');
                    
                    this.showMessage(browserApi.i18n.getMessage('success_auth_granted'), 'success');
                    
                    // 授权成功后加载用户头像
                    await this.loadUserAvatar();
                } catch (authError) {
                    console.error('[Upload] 授权失败:', authError);
                    
                    // 清除待处理状态
                    await browserApi.storage.local.remove('pendingAuthAction');
                    
                    this.showMessage(
                        browserApi.i18n.getMessage('error_auth_failed', [authError.message || authError.toString()]), 
                        'error'
                    );
                    document.getElementById('upload-progress').style.display = 'none';
                    document.getElementById('start-upload').disabled = false;
                    return;
                }
            } else {
                console.log('[Upload] 已授权，使用现有令牌');
                // 加载用户头像
                await this.loadUserAvatar();
            }

            // 显示进度条
            document.getElementById('upload-progress').style.display = 'block';
            document.getElementById('upload-result').style.display = 'none';
            document.getElementById('start-upload').disabled = true;
            
            // 获取选择的可见性
            const visibilityRadio = document.querySelector('input[name="file-visibility"]:checked');
            const visibility = visibilityRadio ? visibilityRadio.value : 'anyone';
            console.log(`[Upload] 可见性设置:`, visibility);
            
            // 获取PixelQR文件夹ID
            const accessToken = await this.googleDriveAPI.getAccessToken();
            const pixelQRFolderId = await this.googleDriveAPI.getOrCreateFolder(accessToken);
            
            let uploadedFiles = [];
            let dateFolderInfo = null; // 日期文件夹信息，用于多文件上传
            
            if (this.uploadMode === 'file') {
                // 文件上传模式
                const totalFiles = this.selectedFiles.length;
                let uploadedCount = 0;
                
                // 如果选择多个文件，先创建日期文件夹
                let targetFolderId = pixelQRFolderId;
                if (totalFiles > 1) {
                    // 生成日期时间格式的文件夹名称：PixelQR-2025-11-12_12:11:10
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const hours = String(now.getHours()).padStart(2, '0');
                    const minutes = String(now.getMinutes()).padStart(2, '0');
                    const seconds = String(now.getSeconds()).padStart(2, '0');
                    const dateFolderName = `PixelQR-${year}-${month}-${day}_${hours}:${minutes}:${seconds}`;
                    
                    console.log(`[Upload] 创建日期文件夹: ${dateFolderName}`);
                    document.getElementById('upload-progress-text').textContent = 
                        `正在创建文件夹 "${dateFolderName}"...`;
                    
                    // 创建日期文件夹，获取完整信息（包括webViewLink）
                    const folderResult = await this.googleDriveAPI.createFolder(dateFolderName, pixelQRFolderId, true);
                    if (folderResult && folderResult.id) {
                        targetFolderId = folderResult.id;
                        dateFolderInfo = folderResult;
                        console.log(`[Upload] 日期文件夹创建成功，ID: ${targetFolderId}`);
                        
                        // 为日期文件夹设置可见性权限
                        if (visibility !== 'owner') {
                            await this.googleDriveAPI.setFileVisibility(targetFolderId, visibility);
                            console.log(`[Upload] 日期文件夹权限设置完成: ${visibility}`);
                        }
                    } else {
                        console.warn('[Upload] 日期文件夹创建失败，将使用PixelQR根文件夹');
                        // 如果创建失败，继续使用PixelQR根文件夹
                    }
                }
                
                for (let i = 0; i < this.selectedFiles.length; i++) {
                    const file = this.selectedFiles[i];
                    
                    console.log(`[Upload] 开始上传文件 ${i + 1}/${totalFiles}:`, file.name);
                    
                    // 更新文件选择进度
                    const fileProgress = Math.round((uploadedCount / totalFiles) * 100);
                    document.getElementById('upload-progress-fill').style.width = fileProgress + '%';
                    document.getElementById('upload-progress-text').textContent = 
                        browserApi.i18n.getMessage('popup_upload_progress', [uploadedCount + 1, totalFiles, file.name]);

                    try {
                        // 上传文件到目标文件夹，带进度回调
                        const result = await this.googleDriveAPI.uploadFile(file, null, (progress) => {
                            // 计算总体进度：已完成文件 + 当前文件进度
                            const fileProgressPercent = progress / 100;
                            const overallProgress = Math.round(
                                (uploadedCount / totalFiles) * 100 + (fileProgressPercent / totalFiles) * 100
                            );
                            document.getElementById('upload-progress-fill').style.width = overallProgress + '%';
                            
                            // 更新进度文本
                            if (progress < 100) {
                                const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
                                document.getElementById('upload-progress-text').textContent = 
                                    browserApi.i18n.getMessage('popup_upload_progress_detail', [
                                        uploadedCount + 1, 
                                        totalFiles, 
                                        file.name,
                                        progress,
                                        fileSizeMB
                                    ]);
                            }
                        }, targetFolderId);
                        
                        console.log(`[Upload] 文件 "${file.name}" 上传成功:`, result);
                        
                        // 根据选择的可见性设置文件权限
                        if (visibility !== 'owner') {
                            await this.googleDriveAPI.setFileVisibility(result.id, visibility);
                        }
                        
                        uploadedFiles.push(result);
                        uploadedCount++;
                    } catch (error) {
                        console.error(`[Upload] 文件 "${file.name}" 上传失败:`, error);
                        console.error('[Upload] 错误详情:', {
                            message: error.message,
                            stack: error.stack
                        });
                        // 继续上传其他文件
                    }
                }
            } else {
                // 文件夹上传模式
                if (this.selectedFolders.length > 0) {
                    const folder = this.selectedFolders[0];
                    console.log('[Upload] 文件夹上传模式，文件夹名:', folder.name);
                    console.log('[Upload] 文件数量:', folder.files.length);
                    
                    document.getElementById('upload-progress-text').textContent = 
                        `正在上传文件夹 "${folder.name}"...`;
                    
                    try {
                        // 上传文件夹
                        const folderResult = await this.googleDriveAPI.uploadFolder(
                            folder.name,
                            folder.files,
                            pixelQRFolderId,
                            (progress) => {
                                document.getElementById('upload-progress-fill').style.width = progress + '%';
                                document.getElementById('upload-progress-text').textContent = 
                                    `正在上传文件夹 "${folder.name}": ${progress}%`;
                            }
                        );
                        
                        console.log('[Upload] 文件夹上传成功:', folderResult);
                        
                        // 根据选择的可见性设置文件夹权限
                        if (visibility !== 'owner') {
                            await this.googleDriveAPI.setFileVisibility(folderResult.id, visibility);
                        }
                        
                        uploadedFiles.push(folderResult);
                    } catch (error) {
                        console.error('[Upload] 文件夹上传失败:', error);
                        throw error;
                    }
                }
            }

            // 完成上传
            document.getElementById('upload-progress-fill').style.width = '100%';
            const completedCount = uploadedFiles.length;
            const totalCount = this.uploadMode === 'file' ? this.selectedFiles.length : 1;
            document.getElementById('upload-progress-text').textContent = 
                browserApi.i18n.getMessage('popup_upload_completed', [completedCount, totalCount]);

            if (uploadedFiles.length > 0) {
                // 显示结果
                const resultContainer = document.getElementById('upload-result');
                const successMessage = document.getElementById('upload-success-message');
                const linkDisplay = document.getElementById('upload-link-display');

                if (uploadedFiles.length === 1) {
                    // 单个文件：显示链接并生成二维码
                    const file = uploadedFiles[0];
                    successMessage.textContent = browserApi.i18n.getMessage('popup_upload_success', [file.name]);
                    
                    // 显示链接
                    const linkElement = document.createElement('div');
                    linkElement.style.marginTop = '10px';
                    linkElement.style.wordBreak = 'break-all';
                    linkElement.innerHTML = `
                        <div style="margin-bottom: 5px; font-weight: bold;">${browserApi.i18n.getMessage('popup_upload_link')}:</div>
                        <a href="${this.escapeHtmlForAttribute(file.shareLink)}" target="_blank" style="color: #007bff; text-decoration: underline;">
                            ${this.escapeHtml(file.shareLink)}
                        </a>
                    `;
                    linkDisplay.innerHTML = '';
                    linkDisplay.appendChild(linkElement);
                    
                    resultContainer.style.display = 'block';

                    // 总是生成二维码，使用分享链接
                    console.log('[Upload] 准备生成二维码，链接:', file.shareLink);
                    setTimeout(() => {
                        // 设置当前内容和类型
                        this.currentContent = file.shareLink;
                        this.currentType = 'url';
                        
                        // 更新URL输入框
                        const urlElement = document.getElementById('current-url');
                        if (urlElement) {
                            urlElement.value = file.shareLink;
                        }
                        
                        // 更新页面标题为Google Drive链接的域名
                        const titleElement = document.querySelector('.title');
                        if (titleElement) {
                            try {
                                const urlObj = new URL(file.shareLink);
                                titleElement.textContent = urlObj.hostname;
                            } catch (error) {
                                titleElement.textContent = 'Google Drive';
                            }
                        }
                        
                        console.log('[Upload] 调用createQRCode生成二维码，内容:', file.shareLink);
                        
                        // 添加到历史记录，包含文件信息
                        const isFolder = this.uploadMode === 'folder';
                        const fileExtension = isFolder ? 'folder' : (file.name.split('.').pop().toLowerCase() || 'file');
                        this.addToHistory('generated', {
                            content: file.shareLink,
                            type: 'url',
                            fileName: file.name,
                            fileType: fileExtension,
                            isGoogleDrive: true,
                            faviconUrl: null, // Google Drive链接使用本地icon
                            timestamp: new Date().toISOString()
                        });
                        
                        // 生成二维码
                        this.createQRCode(file.shareLink, 'url');
                        
                        // 关闭上传模态框
                        document.getElementById('upload-drive-modal').style.display = 'none';
                        this.showMessage(browserApi.i18n.getMessage('success_qr_generated'), 'success');
                        console.log('[Upload] 二维码生成完成');
                    }, 100);
                } else {
                    // 多个文件：检查是否有日期文件夹
                    const hasDateFolder = this.uploadMode === 'file' && this.selectedFiles.length > 1 && dateFolderInfo;
                    
                    if (hasDateFolder) {
                        // 多个文件上传到日期文件夹：显示文件夹链接并生成文件夹二维码
                        successMessage.textContent = browserApi.i18n.getMessage('popup_upload_success_multiple', [uploadedFiles.length]);
                        
                        // 获取文件夹的分享链接
                        const folderShareInfo = await this.googleDriveAPI.getFolderShareLink(dateFolderInfo.id);
                        const folderShareLink = folderShareInfo.shareLink;
                        
                        console.log('[Upload] 获取文件夹分享链接:', folderShareLink);
                        
                        // 显示文件夹链接
                        const linkElement = document.createElement('div');
                        linkElement.style.marginTop = '10px';
                        linkElement.style.wordBreak = 'break-all';
                        linkElement.innerHTML = `
                            <div style="margin-bottom: 5px; font-weight: bold;">${browserApi.i18n.getMessage('popup_upload_folder_link') || '文件夹链接'}:</div>
                            <a href="${this.escapeHtmlForAttribute(folderShareLink)}" target="_blank" style="color: #007bff; text-decoration: underline;">
                                ${this.escapeHtml(folderShareLink)}
                            </a>
                            <div style="margin-top: 10px; font-size: 12px; color: #666;">
                                ${browserApi.i18n.getMessage('popup_upload_files_in_folder') || '包含'} ${uploadedFiles.length} ${browserApi.i18n.getMessage('popup_upload_files') || '个文件'}
                            </div>
                        `;
                        linkDisplay.innerHTML = '';
                        linkDisplay.appendChild(linkElement);
                        resultContainer.style.display = 'block';
                        
                        // 为文件夹生成二维码
                        console.log('[Upload] 为文件夹生成二维码，链接:', folderShareLink);
                        setTimeout(() => {
                            // 设置当前内容和类型
                            this.currentContent = folderShareLink;
                            this.currentType = 'url';
                            
                            // 更新URL输入框
                            const urlElement = document.getElementById('current-url');
                            if (urlElement) {
                                urlElement.value = folderShareLink;
                            }
                            
                            // 更新页面标题为Google Drive链接的域名
                            const titleElement = document.querySelector('.title');
                            if (titleElement) {
                                try {
                                    const urlObj = new URL(folderShareLink);
                                    titleElement.textContent = urlObj.hostname;
                                } catch (error) {
                                    titleElement.textContent = 'Google Drive';
                                }
                            }
                            
                            console.log('[Upload] 调用createQRCode生成二维码，内容:', folderShareLink);
                            
                            // 添加到历史记录，包含文件夹信息
                            this.addToHistory('generated', {
                                content: folderShareLink,
                                type: 'url',
                                fileName: dateFolderInfo.name,
                                fileType: 'folder',
                                isGoogleDrive: true,
                                faviconUrl: null, // Google Drive链接使用本地icon
                                timestamp: new Date().toISOString()
                            });
                            
                            // 生成二维码
                            this.createQRCode(folderShareLink, 'url');
                            
                            // 关闭上传模态框
                            document.getElementById('upload-drive-modal').style.display = 'none';
                            this.showMessage(browserApi.i18n.getMessage('success_qr_generated'), 'success');
                            console.log('[Upload] 文件夹二维码生成完成');
                        }, 100);
                    } else {
                        // 多个文件但没有日期文件夹（理论上不应该发生，但保留兼容性）：显示所有链接，并为第一个文件生成二维码
                    successMessage.textContent = browserApi.i18n.getMessage('popup_upload_success_multiple', [uploadedFiles.length]);
                    
                    const linksElement = document.createElement('div');
                    linksElement.style.marginTop = '10px';
                    linksElement.innerHTML = '<div style="margin-bottom: 5px; font-weight: bold;">' + 
                        browserApi.i18n.getMessage('popup_upload_links') + ':</div>';
                    
                    uploadedFiles.forEach((file, index) => {
                        const linkDiv = document.createElement('div');
                        linkDiv.style.marginBottom = '5px';
                        linkDiv.style.wordBreak = 'break-all';
                        linkDiv.innerHTML = `
                            <span style="font-weight: bold;">${index + 1}. ${this.escapeHtml(file.name)}:</span><br>
                            <a href="${this.escapeHtmlForAttribute(file.shareLink)}" target="_blank" style="color: #007bff; text-decoration: underline;">
                                ${this.escapeHtml(file.shareLink)}
                            </a>
                        `;
                        linksElement.appendChild(linkDiv);
                    });
                    
                    linkDisplay.innerHTML = '';
                    linkDisplay.appendChild(linksElement);
                    resultContainer.style.display = 'block';

                    // 为第一个文件生成二维码
                    const firstFile = uploadedFiles[0];
                    console.log('[Upload] 为第一个文件生成二维码，链接:', firstFile.shareLink);
                    setTimeout(() => {
                        // 设置当前内容和类型
                        this.currentContent = firstFile.shareLink;
                        this.currentType = 'url';
                        
                        // 更新URL输入框
                        const urlElement = document.getElementById('current-url');
                        if (urlElement) {
                            urlElement.value = firstFile.shareLink;
                        }
                        
                        // 更新页面标题为Google Drive链接的域名
                            const titleElement = document.querySelector('.title');
                            if (titleElement) {
                                try {
                                    const urlObj = new URL(firstFile.shareLink);
                                    titleElement.textContent = urlObj.hostname;
                                } catch (error) {
                                    titleElement.textContent = 'Google Drive';
                                }
                            }
                            
                            console.log('[Upload] 调用createQRCode生成二维码，内容:', firstFile.shareLink);
                            
                            // 添加到历史记录，包含文件信息
                            const fileExtension = firstFile.name.split('.').pop().toLowerCase();
                            this.addToHistory('generated', {
                                content: firstFile.shareLink,
                                type: 'url',
                                fileName: firstFile.name,
                                fileType: fileExtension,
                                isGoogleDrive: true,
                                faviconUrl: null, // Google Drive链接使用本地icon
                                timestamp: new Date().toISOString()
                            });
                            
                            // 生成二维码
                            this.createQRCode(firstFile.shareLink, 'url');
                            
                            // 关闭上传模态框
                            document.getElementById('upload-drive-modal').style.display = 'none';
                            this.showMessage(browserApi.i18n.getMessage('success_qr_generated'), 'success');
                            console.log('[Upload] 二维码生成完成');
                        }, 100);
                    }
                }

                document.getElementById('start-upload').disabled = false;
            } else {
                // 所有文件上传失败
                this.showMessage(browserApi.i18n.getMessage('error_upload_all_failed'), 'error');
                document.getElementById('upload-progress').style.display = 'none';
                document.getElementById('start-upload').disabled = false;
            }
        } catch (error) {
            console.error('[Upload] 上传流程失败:', error);
            console.error('[Upload] 错误详情:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            this.showMessage(
                browserApi.i18n.getMessage('error_upload_failed', [error.message || error.toString()]), 
                'error'
            );
            document.getElementById('upload-progress').style.display = 'none';
            document.getElementById('start-upload').disabled = false;
        }
    }
}

// 初始化插件
document.addEventListener('DOMContentLoaded', () => {
    window.qrCodePopup = new QRCodePopup();
}); 