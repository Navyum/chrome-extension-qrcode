// QR Code Generator Chrome Extension - Popup Script

const browserApi = require('./utils/browser-api');

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
        
        this.init();
    }

    async init() {
        this.initI18n();
        this.bindEvents();
        this.loadSettings();
        this.loadHistory();
        this.setupModalEvents();
        
        // 检查是否有待扫描的图片URL（来自右键菜单）
        const hasPendingScan = await this.checkPendingScanUrl();
        
        // 如果没有待扫描的URL，检查是否有待处理的二维码数据（来自右键菜单）
        if (!hasPendingScan) {
            await this.checkPendingQRData();
        }
        
        // 聚焦到URL输入框的末尾
        this.focusUrlInput();
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
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 10H16.74C16.3659 7.49025 14.2356 5.5 11.64 5.5C9.17347 5.5 7.12647 7.22729 6.5 9.5C4.5 9.5 3 11 3 13C3 15 4.5 16.5 6.5 16.5H18C19.6569 16.5 21 15.1569 21 13.5C21 11.8431 19.6569 10.5 18 10Z" fill="#87CEEB"/>
                    <path d="M20 12C20 13.1046 19.1046 14 18 14C16.8954 14 16 13.1046 16 12C16 10.8954 16.8954 10 18 10C19.1046 10 20 10.8954 20 12Z" fill="#4682B4"/>
                </svg>`;
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
            this.addToHistory('generated', {
                content: content,
                type: type,
                faviconUrl: faviconUrl,
                timestamp: new Date().toISOString()
            });
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
            document.getElementById('generate-history').style.display = 'block';
            document.getElementById('scan-history').style.display = 'none';
        });

        document.getElementById('scan-tab').addEventListener('click', () => {
            document.getElementById('scan-tab').classList.add('active');
            document.getElementById('generate-tab').classList.remove('active');
            document.getElementById('scan-history').style.display = 'block';
            document.getElementById('generate-history').style.display = 'none';
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
                const content = e.target.getAttribute('data-content');
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

        // 点击模态框外部关闭
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    // 如果是扫描模态框，需要重置
                    if (modal.id === 'scan-modal') {
                        this.resetScanModal();
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
        const result = await browserApi.storage.local.get('qrOptions');
        if (result.qrOptions) {
            this.qrOptions = { ...this.qrOptions, ...result.qrOptions };
        }
    }

    async saveSettings() {
        await browserApi.storage.local.set({ qrOptions: this.qrOptions });
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
                // 如果存在相同记录，移除旧记录
                this.history.generated.splice(existingIndex, 1);
            }
            
            // 添加新记录到开头
            this.history.generated.unshift(record);
            
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
            const title = this.escapeHtml(this.truncateText(record.content, 60));
            const isUrl = this.isUrl(record.content);
            const dirAttr = isUrl ? 'dir="ltr"' : '';
            const copyText = this.escapeHtml(browserApi.i18n.getMessage('popup_history_action_copy'));
            

            // 使用保存的favicon URL或占位图标
            let iconHtml = '📱';
            if (isUrl && record.faviconUrl) {
                iconHtml = `<img src="${this.escapeHtmlForAttribute(record.faviconUrl)}" alt="favicon" class="favicon" />
                           <span class="fallback-icon" style="display: none;">📱</span>`;
            } else if (isUrl) {
                iconHtml = `<span class="fallback-icon">📱</span>
                           <img src="" alt="favicon" class="favicon" style="display: none;" />`;
            }
            
            return `
                <div class="history-item" data-index="${index}">
                    <div class="history-icon generate">
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
        
        // 只为没有favicon URL的记录异步加载favicon
        this.loadFaviconsForHistory('generated');
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
                <div class="history-item" data-index="${index}">
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
        
        // 只为没有favicon URL的记录异步加载favicon
        this.loadFaviconsForHistory('scanned');
    }

    bindImageErrorHandlers(container) {
        if (!container) return;
        const favicons = container.querySelectorAll('.favicon');
        favicons.forEach(img => {
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
        // 检查navigator.clipboard是否可用
        if (!navigator.clipboard) {
            this.showMessage(browserApi.i18n.getMessage('error_clipboard_not_supported'), 'error');
            return;
        }
        
        // 检查内容是否有效
        if (!content || typeof content !== 'string') {
            this.showMessage(browserApi.i18n.getMessage('error_invalid_copy_content'), 'error');
            return;
        }
        
        navigator.clipboard.writeText(content)
            .then(() => {
                this.showMessage(browserApi.i18n.getMessage('success_text_copied'), 'success');
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
                this.showMessage(browserApi.i18n.getMessage('success_text_copied'), 'success');
            } else {
                this.showMessage(browserApi.i18n.getMessage('error_copy_failed'), 'error');
            }
        } catch (error) {
            this.showMessage(browserApi.i18n.getMessage('error_copy_failed'), 'error');
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
        
        if (typeof browser !== 'undefined' && browser.runtime) {
            // Firefox - 使用Firefox Add-ons商店
            reviewUrl = `https://addons.mozilla.org/en-US/firefox/addon/${extensionId}/reviews/`;
        } else {
            // Chrome/Edge - 使用Chrome Web Store
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
}

// 初始化插件
document.addEventListener('DOMContentLoaded', () => {
    window.qrCodePopup = new QRCodePopup();
}); 