// QR Code Generator Chrome Extension - Popup Script

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
            logoOpacity: 100
        };
        
        // 历史记录相关
        this.history = {
            generated: [],
            scanned: []
        };
        
        this.init();
    }

    async init() {
        this.bindEvents();
        this.loadSettings();
        this.loadHistory();
        this.setupModalEvents();
        
        // 检查是否有待处理的二维码数据（来自右键菜单）
        await this.checkPendingQRData();
        
        // 聚焦到URL输入框的末尾
        this.focusUrlInput();
        
        // 字符计数功能已移除
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

        // URL输入框事件
        document.getElementById('current-url').addEventListener('input', (e) => {
            this.currentContent = e.target.value;
            this.currentType = 'url';
            
            // 字符计数功能已移除
            
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

    // 检查是否有待处理的二维码数据（来自右键菜单）
    async checkPendingQRData() {
        try {
            // 从background script获取待处理数据
            const response = await chrome.runtime.sendMessage({ action: 'getPendingQRData' });
            
            if (response && response.content !== undefined) {
                // 有待处理数据，根据类型处理
                this.currentContent = response.content;
                this.currentType = response.type;
                

                
                // 更新页面信息
                if (response.type === 'url') {
                    // 对于URL类型，尝试获取页面信息并显示自定义URL
                    try {
                        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                        if (tab) {
                            this.updatePageInfo(tab, response.content);
                        }
                    } catch (error) {
                        console.warn('Failed to get tab info:', error);
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
            console.error('Failed to check pending QR data:', error);
            // 出错时，生成当前页面的二维码
            await this.generateCurrentPageQR();
        }
    }

    async generateCurrentPageQR() {
        try {
            // 获取当前标签页信息
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab && tab.url) {
                this.currentContent = tab.url;
                this.currentType = 'url';
                
                // 更新页面标题和URL
                this.updatePageInfo(tab);
                
                // 生成二维码
                await this.createQRCode(tab.url, 'url');
            } else {
                this.showMessage('Unable to get current page URL', 'error');
            }
        } catch (error) {
            console.error('Failed to generate QR code:', error);
            this.showMessage('Failed to generate QR code', 'error');
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
                    titleElement.textContent = 'Custom URL';
                }
            }
        }
        
        if (urlElement && url) {
            urlElement.value = url;
        }
        
        // 更新favicon
        if (cloudIconElement) {
            if (tab.favIconUrl && !customUrl) {
                // 使用当前页面的favicon
                cloudIconElement.innerHTML = `<img src="${tab.favIconUrl}" alt="Favicon" width="24" height="24" style="border-radius: 4px;">`;
            } else if (customUrl) {
                // 对于自定义URL，尝试获取favicon
                try {
                    const urlObj = new URL(customUrl);
                    const faviconUrl = `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
                    cloudIconElement.innerHTML = `<img src="${faviconUrl}" alt="Favicon" width="24" height="24" style="border-radius: 4px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: none;">
                            <path d="M18 10H16.74C16.3659 7.49025 14.2356 5.5 11.64 5.5C9.17347 5.5 7.12647 7.22729 6.5 9.5C4.5 9.5 3 11 3 13C3 15 4.5 16.5 6.5 16.5H18C19.6569 16.5 21 15.1569 21 13.5C21 11.8431 19.6569 10.5 18 10Z" fill="#87CEEB"/>
                            <path d="M20 12C20 13.1046 19.1046 14 18 14C16.8954 14 16 13.1046 16 12C16 10.8954 16.8954 10 18 10C19.1046 10 20 10.8954 20 12Z" fill="#4682B4"/>
                        </svg>`;
                } catch (error) {
                    // 如果URL解析失败，使用默认图标
                    cloudIconElement.innerHTML = `
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 10H16.74C16.3659 7.49025 14.2356 5.5 11.64 5.5C9.17347 5.5 7.12647 7.22729 6.5 9.5C4.5 9.5 3 11 3 13C3 15 4.5 16.5 6.5 16.5H18C19.6569 16.5 21 15.1569 21 13.5C21 11.8431 19.6569 10.5 18 10Z" fill="#87CEEB"/>
                            <path d="M20 12C20 13.1046 19.1046 14 18 14C16.8954 14 16 13.1046 16 12C16 10.8954 16.8954 10 18 10C19.1046 10 20 10.8954 20 12Z" fill="#4682B4"/>
                        </svg>
                    `;
                }
            } else {
                // 如果没有favicon，使用默认的云图标
                cloudIconElement.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 10H16.74C16.3659 7.49025 14.2356 5.5 11.64 5.5C9.17347 5.5 7.12647 7.22729 6.5 9.5C4.5 9.5 3 11 3 13C3 15 4.5 16.5 6.5 16.5H18C19.6569 16.5 21 15.1569 21 13.5C21 11.8431 19.6569 10.5 18 10Z" fill="#87CEEB"/>
                        <path d="M20 12C20 13.1046 19.1046 14 18 14C16.8954 14 16 13.1046 16 12C16 10.8954 16.8954 10 18 10C19.1046 10 20 10.8954 20 12Z" fill="#4682B4"/>
                    </svg>
                `;
            }
        }
    }

    async createQRCode(content, type) {
        const qrContainer = document.getElementById('qr-container');
        
        // 清空容器
        qrContainer.innerHTML = '';
        
        // 检查内容长度（只在真正需要时检查）
        if (!content || typeof content !== 'string') {
            this.showMessage('Invalid content. Please enter valid text.', 'error');
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
            
            // 获取当前标签页的favicon URL
            let faviconUrl = null;
            if (type === 'url') {
                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tab && tab.favIconUrl) {
                        faviconUrl = tab.favIconUrl;
                    }
                } catch (error) {
                    console.warn('Failed to get favicon URL:', error);
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
            console.error('Failed to generate QR code:', error);
            
            // 检查是否是长度溢出错误
            if (error.message && error.message.includes('code length overflow')) {
                const currentLength = this.getUTF8Length(content);
                this.showMessage(`Content too long (${currentLength} UTF-8 bytes). Maximum supported: 2953 bytes. Please shorten the content.`, 'error');
            } else if (error.message && error.message.includes('Unable to generate QR code with any error correction level')) {
                const currentLength = this.getUTF8Length(content);
                this.showMessage(`Unable to generate QR code. Content may be too complex(${currentLength} UTF-8 bytes - Maximum supported: 2953 bytes) or contain unsupported characters.`, 'error');
            } else {
                // 其他错误，显示通用错误信息
                this.showMessage('Failed to generate QR code. Please check your content and try again.', 'error');
            }
            return;
        }
    }

    generateQRCodeWithFallback(content, container, size) {
        // 尝试不同的纠错级别，从M开始，如果失败则降低到L
        const errorLevels = [
            { level: QRCode.CorrectLevel.M, name: 'Medium' },
            { level: QRCode.CorrectLevel.L, name: 'Low' }
        ];
        
        for (const errorLevel of errorLevels) {
            try {
                const qrGenerator = new QRCodeWithLogo({
                    width: size,
                    height: size,
                    colorDark: this.qrOptions.foreground,
                    colorLight: this.qrOptions.background,
                    correctLevel: errorLevel.level,
                    logo: this.qrOptions.logo,
                    logoSize: 0.2,
                    logoOpacity: this.qrOptions.logoOpacity / 100
                });
                
                const canvas = qrGenerator.generate(content, container);
                this.currentQRCode = qrGenerator;
                
                // 如果成功生成，显示纠错级别信息
                if (errorLevel.name === 'Low') {
                    this.showMessage(`QR code generated with ${errorLevel.name} error correction level for better compatibility.`, 'info');
                }
                
                return canvas;
            } catch (error) {
                console.warn(`Failed to generate QR code with ${errorLevel.name} error correction:`, error);
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
            const fileHint = document.querySelector('.file-input-hint');
            
            if (file) {
                document.querySelector('.logo-options').style.display = 'block';
                this.qrOptions.logo = file;
                
                // 更新显示的文件名
                fileHint.textContent = file.name;
                fileHint.style.color = '#47630f';
                
                // 如果有当前二维码，重新生成
                if (this.currentContent) {
                    this.createQRCode(this.currentContent, this.currentType);
                }
            } else {
                fileHint.textContent = 'No file selected';
                fileHint.style.color = '#6c757d';
            }
        });

        // 扫描模态框事件
        document.getElementById('close-scan-modal').addEventListener('click', () => {
            document.getElementById('scan-modal').style.display = 'none';
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

        // 清除历史记录
        document.getElementById('clear-history').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all history? This action cannot be undone.')) {
                this.history.generated = [];
                this.history.scanned = [];
                this.saveHistory();
                this.renderHistory();
                this.showMessage('History cleared', 'success');
            }
        });

        // 历史记录copy按钮事件委托
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('copy-btn')) {
                console.log('🔍 [DEBUG] Copy button clicked');
                const content = e.target.getAttribute('data-content');
                console.log('🔍 [DEBUG] Content from data attribute:', content);
                if (content) {
                    this.copyHistoryContent(content);
                } else {
                    console.error('❌ [DEBUG] No content found in data attribute');
                    this.showMessage('No content to copy', 'error');
                }
            }
        });

        // QR码文件选择
        document.getElementById('qr-file').addEventListener('change', (e) => {
            const file = e.target.files[0];
            const fileHint = document.querySelector('#scan-modal .file-input-hint');
            
            if (file) {
                fileHint.textContent = file.name;
                fileHint.style.color = '#47630f';
                this.scanQRCode(file);
            } else {
                fileHint.textContent = 'No file selected';
                fileHint.style.color = '#6c757d';
            }
        });

        // 扫描结果操作
        document.getElementById('copy-result').addEventListener('click', () => {
            const content = document.getElementById('result-content').textContent;
            navigator.clipboard.writeText(content).then(() => {
                this.showMessage('Result copied to clipboard', 'success');
            });
        });

        document.getElementById('open-result').addEventListener('click', () => {
            const content = document.getElementById('result-content').textContent;
            if (content.startsWith('http://') || content.startsWith('https://')) {
                chrome.tabs.create({ url: content });
            } else {
                this.showMessage('Cannot open non-URL content', 'warning');
            }
        });

        // 点击模态框外部关闭
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
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
            logoOpacity: 100
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
    }

    async downloadQRCode() {
        if (!this.currentQRCode) {
            this.showMessage('Please generate QR code first', 'warning');
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

            // 使用计算后的尺寸生成下载用的二维码
            const downloadQRGenerator = new QRCodeWithLogo({
                width: qrWidth,
                height: qrHeight,
                colorDark: this.qrOptions.foreground,
                colorLight: this.qrOptions.background,
                correctLevel: QRCode.CorrectLevel.H,
                logo: this.qrOptions.logo,
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
                
                this.showMessage('QR code downloaded successfully', 'success');
            }

            // 清理临时容器
            document.body.removeChild(tempContainer);
        } catch (error) {
            console.error('Download failed:', error);
            this.showMessage('Download failed, please try again', 'error');
        }
    }

    async copyQRCode() {
        if (!this.currentQRCode) {
            this.showMessage('Please generate QR code first', 'warning');
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

            // 使用计算后的尺寸生成复制用的二维码
            const copyQRGenerator = new QRCodeWithLogo({
                width: qrWidth,
                height: qrHeight,
                colorDark: this.qrOptions.foreground,
                colorLight: this.qrOptions.background,
                correctLevel: QRCode.CorrectLevel.H,
                logo: this.qrOptions.logo,
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
            
            this.showMessage('QR code copied to clipboard', 'success');

            // 清理临时容器
            document.body.removeChild(tempContainer);
        } catch (error) {
            console.error('Copy failed:', error);
            this.showMessage('Copy failed, please try again', 'error');
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
        // 重置扫描结果
        document.getElementById('scan-result').style.display = 'none';
        document.getElementById('qr-file').value = '';
        document.querySelector('#scan-modal .file-input-hint').textContent = 'No file selected';
        document.querySelector('#scan-modal .file-input-hint').style.color = '#6c757d';
        
        // 隐藏底部的Copy和Open按钮
        document.getElementById('copy-result').style.display = 'none';
        document.getElementById('open-result').style.display = 'none';
    }

    async scanQRCode(file) {
        try {
            // 显示加载状态
            this.showMessage('Scanning QR code...', 'info');
            
            const reader = new FileReader();
            reader.onload = async (e) => {
                const img = new Image();
                img.onload = async () => {
                    try {
                        // 检查图片尺寸
                        if (img.width < 50 || img.height < 50) {
                            this.showMessage('Image too small to scan QR code', 'error');
                            return;
                        }
                        
                        // 使用jsQR库来扫描二维码
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx.drawImage(img, 0, 0);
                        
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        
                        // 使用jsQR库扫描二维码
                        const result = await this.decodeQRCode(imageData);
                        
                        if (result) {
                            this.showScanResult(result);
                            this.showMessage('QR code scanned successfully', 'success');
                        } else {
                            this.showMessage('No QR code found in the image', 'error');
                        }
                    } catch (error) {
                        console.error('QR code scanning failed:', error);
                        this.showMessage('Failed to scan QR code: ' + error.message, 'error');
                    }
                };
                
                img.onerror = () => {
                    this.showMessage('Failed to load image', 'error');
                };
                
                img.src = e.target.result;
            };
            
            reader.onerror = () => {
                this.showMessage('Failed to read file', 'error');
            };
            
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('File reading failed:', error);
            this.showMessage('Failed to read file: ' + error.message, 'error');
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
            console.error('QR code decoding failed:', error);
            return null;
        }
    }

    // detectContentType方法已移至jsQR适配器中处理

    showScanResult(result) {
        document.getElementById('result-type').textContent = result.type;
        
        // 使用格式化后的显示数据
        const contentElement = document.getElementById('result-content');
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
        
        document.getElementById('scan-result').style.display = 'block';
        
        // 显示底部的Copy和Open按钮
        document.getElementById('copy-result').style.display = 'flex';
        document.getElementById('open-result').style.display = 'flex';
        
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
                console.warn('Failed to get favicon URL for scanned URL:', error);
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
        const result = await chrome.storage.local.get('qrOptions');
        if (result.qrOptions) {
            this.qrOptions = { ...this.qrOptions, ...result.qrOptions };
        }
    }

    async saveSettings() {
        await chrome.storage.local.set({ qrOptions: this.qrOptions });
    }

    // 历史记录相关方法
    async loadHistory() {
        const result = await chrome.storage.local.get(['history']);
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
        await chrome.storage.local.set({ history: this.history });
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
                    <div class="empty-history-text">No generated QR codes yet</div>
                    <div class="empty-history-hint">Generate your first QR code to see it here</div>
                </div>
            `;
            return;
        }

        container.innerHTML = this.history.generated.map((record, index) => {
            const time = this.formatTime(record.timestamp);
            const title = this.truncateText(record.content, 60);
            const isUrl = this.isUrl(record.content);
            
            console.log('🔍 [DEBUG] Rendering generated record:', record);
            console.log('🔍 [DEBUG] Record content:', record.content);
            
            // 使用保存的favicon URL或占位图标
            let iconHtml = '📱';
            if (isUrl && record.faviconUrl) {
                iconHtml = `<img src="${record.faviconUrl}" alt="favicon" class="favicon" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';" />
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
                        <div class="history-title">${title}</div>
                        <div class="history-subtitle">
                            <span>${record.type.toUpperCase()}</span>
                            <span class="history-time">${time}</span>
                        </div>
                    </div>
                    <div class="history-actions">
                        <button class="history-action-btn copy-btn" data-content="${this.escapeHtmlForAttribute(record.content)}">Copy</button>
                    </div>
                </div>
            `;
        }).join('');
        
        // 只为没有favicon URL的记录异步加载favicon
        this.loadFaviconsForHistory('generated');
    }

    renderScannedHistory() {
        const container = document.getElementById('scan-history');
        
        if (this.history.scanned.length === 0) {
            container.innerHTML = `
                <div class="empty-history">
                    <div class="empty-history-icon">🔍</div>
                    <div class="empty-history-text">No scanned QR codes yet</div>
                    <div class="empty-history-hint">Scan your first QR code to see it here</div>
                </div>
            `;
            return;
        }

        container.innerHTML = this.history.scanned.map((record, index) => {
            const time = this.formatTime(record.timestamp);
            const title = this.truncateText(record.displayData || record.content, 60);
            const isUrl = this.isUrl(record.content);
            
            console.log('🔍 [DEBUG] Rendering scanned record:', record);
            console.log('🔍 [DEBUG] Record content:', record.content);
            
            // 使用保存的favicon URL或占位图标
            let iconHtml = '🔍';
            if (isUrl && record.faviconUrl) {
                iconHtml = `<img src="${record.faviconUrl}" alt="favicon" class="favicon" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';" />
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
                        <div class="history-title">${title}</div>
                        <div class="history-subtitle">
                            <span>${record.type.toUpperCase()}</span>
                            <span class="history-time">${time}</span>
                        </div>
                    </div>
                    <div class="history-actions">
                        <button class="history-action-btn copy-btn" data-content="${this.escapeHtmlForAttribute(record.content)}">Copy</button>
                    </div>
                </div>
            `;
        }).join('');
        
        // 只为没有favicon URL的记录异步加载favicon
        this.loadFaviconsForHistory('scanned');
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return date.toLocaleDateString();
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    getFaviconUrl(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            
            // 尝试多种favicon路径
            const faviconPaths = [
                `${urlObj.protocol}//${hostname}/favicon.ico`,
                `${urlObj.protocol}//${hostname}/apple-touch-icon.png`,
                `${urlObj.protocol}//${hostname}/apple-touch-icon-precomposed.png`,
                `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
                `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${hostname}&size=32`
            ];
            
            return faviconPaths; // 返回所有路径数组
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
            console.warn('Failed to update favicon:', error);
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



    // updateCharacterCount函数已移除

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
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }

    copyHistoryContent(content) {
        console.log('🔍 [DEBUG] copyHistoryContent called with content:', content);
        console.log('🔍 [DEBUG] content type:', typeof content);
        console.log('🔍 [DEBUG] content length:', content ? content.length : 'null/undefined');
        
        // 检查navigator.clipboard是否可用
        if (!navigator.clipboard) {
            console.error('❌ [DEBUG] navigator.clipboard is not available');
            this.showMessage('Clipboard API not supported', 'error');
            return;
        }
        
        console.log('🔍 [DEBUG] navigator.clipboard is available');
        
        // 检查内容是否有效
        if (!content || typeof content !== 'string') {
            console.error('❌ [DEBUG] Invalid content:', content);
            this.showMessage('Invalid content to copy', 'error');
            return;
        }
        
        console.log('🔍 [DEBUG] Content is valid, attempting to copy...');
        
        navigator.clipboard.writeText(content)
            .then(() => {
                console.log('✅ [DEBUG] Copy successful');
                this.showMessage('Content copied to clipboard', 'success');
            })
            .catch((error) => {
                console.error('❌ [DEBUG] Copy failed with error:', error);
                console.error('❌ [DEBUG] Error name:', error.name);
                console.error('❌ [DEBUG] Error message:', error.message);
                
                // 尝试使用备用方法
                this.fallbackCopyTextToClipboard(content);
            });
    }
    
    fallbackCopyTextToClipboard(text) {
        console.log('🔍 [DEBUG] Trying fallback copy method');
        
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
                console.log('✅ [DEBUG] Fallback copy successful');
                this.showMessage('Content copied to clipboard', 'success');
            } else {
                console.error('❌ [DEBUG] Fallback copy failed');
                this.showMessage('Failed to copy content', 'error');
            }
        } catch (error) {
            console.error('❌ [DEBUG] Fallback copy error:', error);
            this.showMessage('Failed to copy content', 'error');
        }
    }

    openHistoryContent(content) {
        if (content.startsWith('http://') || content.startsWith('https://')) {
            chrome.tabs.create({ url: content });
        } else {
            this.showMessage('Cannot open non-URL content', 'warning');
        }
    }

    rateExtension() {
        // 跳转到Chrome Web Store评分页面
        const extensionId = chrome.runtime.id;
        const reviewUrl = `https://chrome.google.com/webstore/detail/${extensionId}/reviews`;
        chrome.tabs.create({ url: reviewUrl });
        this.showMessage('Thank you for rating our extension!', 'success');
    }

    openFeedback() {
        // 跳转到Chrome Web Store官方support页面
        const extensionId = chrome.runtime.id;
        const supportUrl = `https://chromewebstore.google.com/detail/${extensionId}/support`;
        chrome.tabs.create({ url: supportUrl });
        this.showMessage('Opening support page...', 'info');
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

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 初始化插件
document.addEventListener('DOMContentLoaded', () => {
    window.qrCodePopup = new QRCodePopup();
}); 