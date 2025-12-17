// Scan Modal - 扫描二维码模态框
// 用于从本地文件或URL扫描二维码

const BaseModal = require('./base-modal');
const browserApi = require('../utils/browser-api');

/**
 * 扫描二维码模态框类
 */
class ScanModal extends BaseModal {
    /**
     * 构造函数
     * @param {string} modalId - 模态框元素的ID
     * @param {object} options - 配置选项
     * @param {function} options.onScanComplete - 扫描完成时的回调
     * @param {function} options.showMessage - 显示消息的函数
     * @param {function} options.addToHistory - 添加到历史记录的函数
     * @param {function} options.isUrl - 判断是否为URL的函数
     * @param {function} options.getFaviconUrl - 获取favicon URL的函数
     */
    constructor(modalId, options = {}) {
        super(modalId, {
            ...options,
            onReset: () => {
                this.resetScanModal();
            }
        });
        
        this.onScanComplete = options.onScanComplete || null;
        this.showMessage = options.showMessage || null;
        this.addToHistory = options.addToHistory || null;
        this.isUrl = options.isUrl || null;
        this.getFaviconUrl = options.getFaviconUrl || null;
        this.currentResult = null;
        
        this.bindEvents();
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 扫描Tab切换事件
        const localTab = this.querySelector('#scan-tab-local');
        const urlTab = this.querySelector('#scan-tab-url');
        
        if (localTab) {
            localTab.addEventListener('click', () => {
                this.switchScanTab('local');
            });
        }
        
        if (urlTab) {
            urlTab.addEventListener('click', () => {
                this.switchScanTab('url');
            });
        }
        
        // URL扫描按钮
        const scanUrlBtn = this.querySelector('#scan-url-btn');
        if (scanUrlBtn) {
            scanUrlBtn.addEventListener('click', () => {
                this.scanFromUrl();
            });
        }
        
        // URL输入框回车事件
        const scanUrlInput = this.querySelector('#scan-url-input');
        if (scanUrlInput) {
            scanUrlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.scanFromUrl();
                }
            });
        }
        
        // QR码文件选择
        const qrFileInput = this.querySelector('#qr-file');
        if (qrFileInput) {
            qrFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                this.handleFileSelect(file);
            });
        }
        
        // 扫描结果操作
        const copyResultBtn = this.querySelector('#copy-result');
        const openResultBtn = this.querySelector('#open-result');
        
        if (copyResultBtn) {
            copyResultBtn.addEventListener('click', () => {
                this.copyResult();
            });
        }
        
        if (openResultBtn) {
            openResultBtn.addEventListener('click', () => {
                this.openResult();
            });
        }
    }
    
    /**
     * 显示扫描模态框
     */
    show() {
        this.resetScanModal();
        super.show();
    }
    
    /**
     * 重置扫描模态框
     */
    resetScanModal() {
        // 默认显示local tab
        this.switchScanTab('local');
        
        // 隐藏所有结果区域
        const uploadResult = this.querySelector('#scan-upload-result');
        const urlResult = this.querySelector('#scan-url-result');
        const oldResult = this.querySelector('#scan-result');
        
        if (uploadResult) uploadResult.style.display = 'none';
        if (urlResult) urlResult.style.display = 'none';
        if (oldResult) oldResult.style.display = 'none';
        
        // 隐藏所有预览区域
        const uploadPreview = this.querySelector('#scan-upload-preview');
        const urlPreview = this.querySelector('#scan-url-preview');
        
        if (uploadPreview) uploadPreview.style.display = 'none';
        if (urlPreview) urlPreview.style.display = 'none';
        
        // 重置表单
        const qrFileInput = this.querySelector('#qr-file');
        const scanUrlInput = this.querySelector('#scan-url-input');
        
        if (qrFileInput) qrFileInput.value = '';
        if (scanUrlInput) scanUrlInput.value = '';
        
        const fileHint = this.querySelector('.file-input-hint');
        if (fileHint) {
            fileHint.textContent = browserApi.i18n.getMessage('popup_common_no_file_selected');
            fileHint.style.color = '#6c757d';
        }
        
        // 隐藏底部的Copy和Open按钮
        const copyBtn = this.querySelector('#copy-result');
        const openBtn = this.querySelector('#open-result');
        
        if (copyBtn) copyBtn.style.display = 'none';
        if (openBtn) openBtn.style.display = 'none';
        
        this.currentResult = null;
    }
    
    /**
     * 切换扫描Tab
     * @param {string} tab - 'local' 或 'url'
     */
    switchScanTab(tab) {
        const localTab = this.querySelector('#scan-tab-local');
        const urlTab = this.querySelector('#scan-tab-url');
        const uploadSection = this.querySelector('#scan-upload-section');
        const urlSection = this.querySelector('#scan-url-section');
        
        if (!localTab || !urlTab || !uploadSection || !urlSection) return;
        
        // 重置tab状态
        localTab.classList.remove('active');
        urlTab.classList.remove('active');
        
        // 隐藏所有section
        uploadSection.style.display = 'none';
        urlSection.style.display = 'none';
        
        const copyBtn = this.querySelector('#copy-result');
        const openBtn = this.querySelector('#open-result');
        
        if (tab === 'local') {
            localTab.classList.add('active');
            uploadSection.style.display = 'block';
            
            // 检查是否有上传结果
            const uploadResult = this.querySelector('#scan-upload-result');
            if (uploadResult && uploadResult.style.display !== 'none') {
                if (copyBtn) copyBtn.style.display = 'flex';
                if (openBtn) openBtn.style.display = 'flex';
            } else {
                if (copyBtn) copyBtn.style.display = 'none';
                if (openBtn) openBtn.style.display = 'none';
            }
        } else if (tab === 'url') {
            urlTab.classList.add('active');
            urlSection.style.display = 'block';
            
            // 检查是否有URL结果
            const urlResult = this.querySelector('#scan-url-result');
            if (urlResult && urlResult.style.display !== 'none') {
                if (copyBtn) copyBtn.style.display = 'flex';
                if (openBtn) openBtn.style.display = 'flex';
            } else {
                if (copyBtn) copyBtn.style.display = 'none';
                if (openBtn) openBtn.style.display = 'none';
            }
            
            // 聚焦到URL输入框
            const scanUrlInput = this.querySelector('#scan-url-input');
            if (scanUrlInput) {
                setTimeout(() => {
                    scanUrlInput.focus();
                }, 100);
            }
        }
    }
    
    /**
     * 处理文件选择
     * @param {File} file - 选择的文件
     */
    async handleFileSelect(file) {
        const fileHint = this.querySelector('.file-input-hint');
        const previewContainer = this.querySelector('#scan-upload-preview');
        const previewImage = this.querySelector('#upload-preview-image');
        
        // 隐藏之前的结果
        const uploadResult = this.querySelector('#scan-upload-result');
        const copyBtn = this.querySelector('#copy-result');
        const openBtn = this.querySelector('#open-result');
        
        if (uploadResult) uploadResult.style.display = 'none';
        if (copyBtn) copyBtn.style.display = 'none';
        if (openBtn) openBtn.style.display = 'none';
        
        if (file) {
            if (fileHint) {
                fileHint.textContent = file.name;
                fileHint.style.color = '#47630f';
            }
            
            // 使用FileReader读取文件
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dataUrl = e.target.result;
                
                // 显示预览
                if (previewContainer && previewImage) {
                    previewImage.src = dataUrl;
                    previewImage.onload = () => {
                        previewContainer.style.display = 'block';
                    };
                    previewImage.onerror = () => {
                        if (previewContainer) {
                            previewContainer.style.display = 'none';
                        }
                    };
                }
                
                // 扫描二维码
                await this.scanImageFromDataUrl(dataUrl, 'upload');
            };
            
            reader.onerror = () => {
                if (this.showMessage) {
                    this.showMessage(browserApi.i18n.getMessage('error_read_file_failed'), 'error');
                }
                if (previewContainer) {
                    previewContainer.style.display = 'none';
                }
            };
            
            reader.readAsDataURL(file);
        } else {
            if (fileHint) {
                fileHint.textContent = browserApi.i18n.getMessage('popup_common_no_file_selected');
                fileHint.style.color = '#6c757d';
            }
            if (previewContainer) {
                previewContainer.style.display = 'none';
            }
        }
    }
    
    /**
     * 从URL扫描
     */
    async scanFromUrl() {
        const urlInput = this.querySelector('#scan-url-input');
        if (!urlInput) return;
        
        const url = urlInput.value.trim();
        
        if (!url) {
            if (this.showMessage) {
                this.showMessage(browserApi.i18n.getMessage('error_invalid_url'), 'error');
            }
            return;
        }
        
        // 验证URL格式
        try {
            new URL(url);
        } catch (error) {
            if (this.showMessage) {
                this.showMessage(browserApi.i18n.getMessage('error_invalid_url'), 'error');
            }
            return;
        }
        
        // 隐藏之前的结果
        const urlResult = this.querySelector('#scan-url-result');
        const copyBtn = this.querySelector('#copy-result');
        const openBtn = this.querySelector('#open-result');
        
        if (urlResult) urlResult.style.display = 'none';
        if (copyBtn) copyBtn.style.display = 'none';
        if (openBtn) openBtn.style.display = 'none';
        
        try {
            if (this.showMessage) {
                this.showMessage(browserApi.i18n.getMessage('info_scanning_qr'), 'info');
            }
            
            await this.scanImageFromUrl(url, 'url');
        } catch (error) {
            if (this.showMessage) {
                this.showMessage(browserApi.i18n.getMessage('error_load_image_failed'), 'error');
            }
            const urlPreview = this.querySelector('#scan-url-preview');
            if (urlPreview) {
                urlPreview.style.display = 'none';
            }
        }
    }
    
    /**
     * 从URL扫描图片
     * @param {string} url - 图片URL
     * @param {string} source - 来源 ('url')
     */
    async scanImageFromUrl(url, source) {
        return new Promise((resolve, reject) => {
            const previewContainer = this.querySelector('#scan-url-preview');
            const previewImage = this.querySelector('#url-preview-image');
            
            if (previewContainer && previewImage) {
                previewImage.src = url;
                previewContainer.style.display = 'block';
            }
            
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = async () => {
                try {
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
                if (this.showMessage) {
                    this.showMessage(browserApi.i18n.getMessage('error_load_image_failed_cors'), 'error');
                }
                if (previewContainer) {
                    previewContainer.style.display = 'none';
                }
                reject(new Error('Failed to load image'));
            };
            
            img.src = url;
        });
    }
    
    /**
     * 从DataURL扫描图片
     * @param {string} dataUrl - 图片DataURL
     * @param {string} source - 来源 ('upload')
     */
    async scanImageFromDataUrl(dataUrl, source) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = async () => {
                try {
                    if (source === 'upload') {
                        const previewContainer = this.querySelector('#scan-upload-preview');
                        const previewImage = this.querySelector('#upload-preview-image');
                        if (previewContainer && previewImage) {
                            if (previewImage.src !== dataUrl) {
                                previewImage.src = dataUrl;
                            }
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
                if (this.showMessage) {
                    this.showMessage(browserApi.i18n.getMessage('error_load_image_failed'), 'error');
                }
                reject(new Error('Failed to load image'));
            };
            
            img.src = dataUrl;
        });
    }
    
    /**
     * 从图片元素扫描
     * @param {HTMLImageElement} img - 图片元素
     * @param {string} source - 来源 ('upload' 或 'url')
     */
    async scanImageFromElement(img, source) {
        try {
            // 检查图片尺寸
            if (img.width < 50 || img.height < 50) {
                if (this.showMessage) {
                    this.showMessage(browserApi.i18n.getMessage('error_image_too_small'), 'error');
                }
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
                if (this.showMessage) {
                    this.showMessage(browserApi.i18n.getMessage('success_scan_completed'), 'success');
                }
            } else {
                if (this.showMessage) {
                    this.showMessage(browserApi.i18n.getMessage('error_no_qr_found'), 'error');
                }
            }
        } catch (error) {
            if (this.showMessage) {
                this.showMessage(browserApi.i18n.getMessage('error_scan_failed', [error.message]), 'error');
            }
        }
    }
    
    /**
     * 解码二维码
     * @param {ImageData} imageData - 图片数据
     * @returns {Promise<object|null>} 扫描结果
     */
    async decodeQRCode(imageData) {
        try {
            if (!window.jsQRImproved) {
                return null;
            }
            
            const result = window.jsQRImproved.scan(imageData, imageData.width, imageData.height);
            
            if (result) {
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
    
    /**
     * 显示扫描结果
     * @param {object} result - 扫描结果
     * @param {string} source - 来源 ('upload' 或 'url')
     */
    showScanResult(result, source) {
        this.currentResult = result;
        
        let resultContainer, typeElement, contentElement;
        const localTab = this.querySelector('#scan-tab-local');
        const urlTab = this.querySelector('#scan-tab-url');
        const uploadSection = this.querySelector('#scan-upload-section');
        const urlSection = this.querySelector('#scan-url-section');
        
        if (source === 'upload') {
            if (localTab) localTab.classList.add('active');
            if (urlTab) urlTab.classList.remove('active');
            if (uploadSection) uploadSection.style.display = 'block';
            if (urlSection) urlSection.style.display = 'none';
            
            resultContainer = this.querySelector('#scan-upload-result');
            typeElement = this.querySelector('#upload-result-type');
            contentElement = this.querySelector('#upload-result-content');
        } else if (source === 'url') {
            if (urlTab) urlTab.classList.add('active');
            if (localTab) localTab.classList.remove('active');
            if (urlSection) urlSection.style.display = 'block';
            if (uploadSection) uploadSection.style.display = 'none';
            
            resultContainer = this.querySelector('#scan-url-result');
            typeElement = this.querySelector('#url-result-type');
            contentElement = this.querySelector('#url-result-content');
        } else {
            if (localTab) localTab.classList.add('active');
            if (urlTab) urlTab.classList.remove('active');
            if (uploadSection) uploadSection.style.display = 'block';
            if (urlSection) urlSection.style.display = 'none';
            
            resultContainer = this.querySelector('#scan-result');
            typeElement = this.querySelector('#result-type');
            contentElement = this.querySelector('#result-content');
        }
        
        if (!resultContainer || !typeElement || !contentElement) return;
        
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
            contentElement.classList.add('invalid');
        } else {
            contentElement.classList.remove('invalid');
            // 移除内联样式，让 CSS 处理颜色（支持深色模式）
            contentElement.style.color = '';
            contentElement.style.fontStyle = '';
        }
        
        // 显示结果区域
        resultContainer.style.display = 'block';
        
        // 显示底部的Copy和Open按钮
        const copyBtn = this.querySelector('#copy-result');
        const openBtn = this.querySelector('#open-result');
        
        if (copyBtn) {
            copyBtn.style.display = 'flex';
            copyBtn.setAttribute('data-content', result.data);
        }
        
        if (openBtn) {
            openBtn.style.display = 'flex';
            openBtn.setAttribute('data-content', result.data);
        }
        
        // 为URL类型的扫描结果获取favicon URL
        let faviconUrl = null;
        if (result.type === 'url' && this.isUrl && this.isUrl(result.data)) {
            try {
                if (this.getFaviconUrl) {
                    const faviconUrls = this.getFaviconUrl(result.data);
                    if (faviconUrls && faviconUrls.length > 0) {
                        faviconUrl = faviconUrls[0];
                    }
                }
            } catch (error) {
                // 静默处理favicon获取失败
            }
        }
        
        // 添加到扫描历史记录
        if (this.addToHistory) {
            this.addToHistory('scanned', {
                content: result.data,
                type: result.type,
                displayData: result.displayData,
                faviconUrl: faviconUrl,
                timestamp: new Date().toISOString()
            });
        }
        
        // 触发扫描完成事件
        if (this.onScanComplete) {
            this.onScanComplete(result);
        }
        
        this.emit('scanComplete', result);
    }
    
    /**
     * 复制结果
     */
    copyResult() {
        const copyBtn = this.querySelector('#copy-result');
        if (!copyBtn) return;
        
        let content = copyBtn.getAttribute('data-content');
        if (!content && this.currentResult) {
            content = this.currentResult.data;
        }
        
        if (content) {
            navigator.clipboard.writeText(content).then(() => {
                if (this.showMessage) {
                    this.showMessage(browserApi.i18n.getMessage('success_result_copied'), 'success');
                }
            });
        }
    }
    
    /**
     * 打开结果
     */
    openResult() {
        const openBtn = this.querySelector('#open-result');
        if (!openBtn) return;
        
        let content = openBtn.getAttribute('data-content');
        if (!content && this.currentResult) {
            content = this.currentResult.data;
        }
        
        if (content) {
            if (content.startsWith('http://') || content.startsWith('https://')) {
                browserApi.tabs.create({ url: content });
            } else {
                if (this.showMessage) {
                    this.showMessage(browserApi.i18n.getMessage('warning_cannot_open_non_url'), 'warning');
                }
            }
        }
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScanModal;
} else {
    window.ScanModal = ScanModal;
}

