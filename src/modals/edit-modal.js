// Edit Modal - 编辑二维码模态框
// 用于编辑二维码的颜色、尺寸、Logo等选项

const BaseModal = require('./base-modal');
const browserApi = require('../utils/browser-api');

/**
 * 编辑二维码模态框类
 */
class EditModal extends BaseModal {
    /**
     * 构造函数
     * @param {string} modalId - 模态框元素的ID
     * @param {object} options - 配置选项
     * @param {object} options.qrOptions - 当前二维码选项
     * @param {array} options.builtinLogoFiles - 内置Logo文件列表
     * @param {function} options.onApply - 应用编辑时的回调
     * @param {function} options.onReset - 重置时的回调
     * @param {function} options.onCreateQRCode - 创建二维码的回调函数
     */
    constructor(modalId, options = {}) {
        super(modalId, options);
        
        this.qrOptions = options.qrOptions || {
            foreground: '#000000',
            background: '#FFFFFF',
            width: 512,
            height: 512,
            margin: 10,
            logo: null,
            logoOpacity: 100,
            builtinLogo: null
        };
        
        this.builtinLogoFiles = options.builtinLogoFiles || [];
        this.onApply = options.onApply || null;
        this.onCreateQRCode = options.onCreateQRCode || null;
        this.onReset = options.onReset || null;
        
        this.bindEvents();
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        const applyBtn = this.querySelector('#apply-edit');
        const cancelBtn = this.querySelector('#cancel-edit');
        const resetBtn = this.querySelector('#reset-edit');
        
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.applyEdit();
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hide();
            });
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetEdit();
            });
        }
        
        // Size Settings 联动功能
        const widthInput = this.querySelector('#qr-width');
        const heightInput = this.querySelector('#qr-height');
        
        if (widthInput && heightInput) {
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
        }
        
        // Logo透明度滑块
        const opacityInput = this.querySelector('#logo-opacity');
        const opacityValue = this.querySelector('#opacity-value');
        if (opacityInput && opacityValue) {
            opacityInput.addEventListener('input', (e) => {
                opacityValue.textContent = e.target.value + '%';
            });
        }
        
        // Logo文件选择
        const logoFileInput = this.querySelector('#logo-file');
        if (logoFileInput) {
            logoFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                this.handleLogoFileSelect(file);
            });
        }
        
        // Logo文件取消按钮
        const logoFileRemove = this.querySelector('#logo-file-remove');
        if (logoFileRemove) {
            logoFileRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.removeLogoFile();
            });
        }
    }
    
    /**
     * 显示编辑模态框
     */
    show() {
        // 设置当前值
        const foregroundColor = this.querySelector('#foreground-color');
        const backgroundColor = this.querySelector('#background-color');
        const widthInput = this.querySelector('#qr-width');
        const heightInput = this.querySelector('#qr-height');
        
        if (foregroundColor) foregroundColor.value = this.qrOptions.foreground;
        if (backgroundColor) backgroundColor.value = this.qrOptions.background;
        if (widthInput) widthInput.value = this.qrOptions.width;
        if (heightInput) heightInput.value = this.qrOptions.height;
        
        // 初始化内置 logo 网格
        this.initBuiltinLogoGrid();
        
        // 更新 logo 选择状态
        this.updateLogoSelectionState();
        
        super.show();
    }
    
    /**
     * 初始化内置Logo网格
     */
    initBuiltinLogoGrid() {
        const grid = this.querySelector('#builtin-logo-grid');
        if (!grid) return;
        
        // 清空网格（使用 textContent 更安全）
        grid.textContent = '';
        
        // 使用 DocumentFragment 批量操作 DOM（Google 最佳实践：减少重排和重绘）
        const fragment = document.createDocumentFragment();
        
        // 添加内置 logo 选项
        this.builtinLogoFiles.forEach(logoFile => {
            const logoItem = document.createElement('div');
            logoItem.className = 'builtin-logo-item';
            logoItem.dataset.logo = logoFile;
            
            // 创建图标容器
            const iconDiv = document.createElement('div');
            iconDiv.className = 'builtin-logo-icon';
            
            const img = document.createElement('img');
            img.src = `images/qr-icon/${logoFile}`;
            img.alt = '';
            // 使用事件委托处理错误（更高效）
            img.addEventListener('error', () => {
                img.style.display = 'none';
            });
            
            iconDiv.appendChild(img);
            
            // 创建选中标记
            const checkmark = document.createElement('div');
            checkmark.className = 'builtin-logo-checkmark';
            checkmark.textContent = '✓';
            
            logoItem.appendChild(iconDiv);
            logoItem.appendChild(checkmark);
            logoItem.addEventListener('click', () => this.selectBuiltinLogo(logoFile));
            
            fragment.appendChild(logoItem);
        });
        
        // 一次性添加到 DOM（只触发一次重排）
        grid.appendChild(fragment);
    }
    
    /**
     * 选择内置Logo
     * @param {string} logoFile - Logo文件名
     */
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
        
        // 如果有创建二维码的回调，重新生成
        if (this.onCreateQRCode) {
            this.onCreateQRCode();
        }
        
        this.emit('logoChanged', this.qrOptions);
    }
    
    /**
     * 处理Logo文件选择
     * @param {File} file - 选择的文件
     */
    handleLogoFileSelect(file) {
        if (file) {
            // 清除内置 logo
            this.qrOptions.builtinLogo = null;
            
            // 清除内置 logo 选中状态
            this.querySelectorAll('.builtin-logo-item').forEach(item => {
                item.classList.remove('selected');
            });
            
            // 设置自定义 logo
            this.qrOptions.logo = file;
            
            // 隐藏选择按钮，显示文件名和取消按钮
            const fileLabel = this.querySelector('#logo-file-label');
            const fileSelected = this.querySelector('#logo-file-selected');
            const fileName = this.querySelector('#logo-file-name');
            const filePreview = this.querySelector('#logo-file-preview');
            
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
            const logoOptions = this.querySelector('.logo-options');
            if (logoOptions) {
                logoOptions.style.display = 'block';
            }
            
            // 如果有创建二维码的回调，重新生成
            if (this.onCreateQRCode) {
                this.onCreateQRCode();
            }
            
            this.emit('logoChanged', this.qrOptions);
        }
    }
    
    /**
     * 移除Logo文件
     */
    removeLogoFile() {
        // 清除文件选择
        const logoFileInput = this.querySelector('#logo-file');
        if (logoFileInput) {
            logoFileInput.value = '';
        }
        this.qrOptions.logo = null;
        
        // 清除预览图片
        const filePreview = this.querySelector('#logo-file-preview');
        if (filePreview) {
            filePreview.src = '';
        }
        
        // 显示选择按钮，隐藏文件名显示
        const fileLabel = this.querySelector('#logo-file-label');
        const fileSelected = this.querySelector('#logo-file-selected');
        
        if (fileLabel && fileSelected) {
            fileLabel.style.display = 'flex';
            fileSelected.style.display = 'none';
        }
        
        // 如果没有logo，隐藏透明度选项
        if (!this.qrOptions.builtinLogo) {
            const logoOptions = this.querySelector('.logo-options');
            if (logoOptions) {
                logoOptions.style.display = 'none';
            }
        }
        
        // 如果有创建二维码的回调，重新生成
        if (this.onCreateQRCode) {
            this.onCreateQRCode();
        }
        
        this.emit('logoChanged', this.qrOptions);
    }
    
    /**
     * 更新Logo选择状态
     */
    updateLogoSelectionState() {
        // 更新内置 logo 选中状态
        const logoItems = this.querySelectorAll('.builtin-logo-item');
        logoItems.forEach(item => {
            const logoFile = item.dataset.logo;
            if (logoFile === this.qrOptions.builtinLogo) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        
        // 更新自定义 logo 显示
        const fileHint = this.querySelector('.file-input-hint');
        if (this.qrOptions.builtinLogo) {
            // 如果有内置 logo，隐藏自定义 logo 提示
            if (fileHint) {
                fileHint.textContent = browserApi.i18n.getMessage('popup_common_no_file_selected');
                fileHint.style.color = '#6c757d';
            }
            const logoOptions = this.querySelector('.logo-options');
            if (logoOptions) {
                logoOptions.style.display = 'block';
            }
        } else if (this.qrOptions.logo) {
            // 如果有自定义 logo，显示文件名
            if (fileHint) {
                fileHint.textContent = this.qrOptions.logo.name || browserApi.i18n.getMessage('popup_common_no_file_selected');
                fileHint.style.color = '#47630f';
            }
            const logoOptions = this.querySelector('.logo-options');
            if (logoOptions) {
                logoOptions.style.display = 'block';
            }
        } else {
            const logoOptions = this.querySelector('.logo-options');
            if (logoOptions) {
                logoOptions.style.display = 'none';
            }
        }
    }
    
    /**
     * 应用编辑
     */
    applyEdit() {
        // 获取编辑选项
        const foregroundColor = this.querySelector('#foreground-color');
        const backgroundColor = this.querySelector('#background-color');
        const widthInput = this.querySelector('#qr-width');
        const heightInput = this.querySelector('#qr-height');
        const opacityInput = this.querySelector('#logo-opacity');
        
        if (foregroundColor) this.qrOptions.foreground = foregroundColor.value;
        if (backgroundColor) this.qrOptions.background = backgroundColor.value;
        if (widthInput) this.qrOptions.width = parseInt(widthInput.value);
        if (heightInput) this.qrOptions.height = parseInt(heightInput.value);
        if (opacityInput) this.qrOptions.logoOpacity = parseInt(opacityInput.value);
        
        // 触发应用回调
        if (this.onApply) {
            this.onApply(this.qrOptions);
        }
        
        this.emit('apply', this.qrOptions);
        
        // 关闭模态框
        this.hide();
    }
    
    /**
     * 重置编辑
     */
    resetEdit() {
        this.qrOptions = {
            foreground: '#000000',
            background: '#FFFFFF',
            width: 512,
            height: 512,
            margin: 10,
            logo: null,
            logoOpacity: 100,
            builtinLogo: null
        };
        
        // 更新表单
        const foregroundColor = this.querySelector('#foreground-color');
        const backgroundColor = this.querySelector('#background-color');
        const widthInput = this.querySelector('#qr-width');
        const heightInput = this.querySelector('#qr-height');
        const opacityInput = this.querySelector('#logo-opacity');
        const opacityValue = this.querySelector('#opacity-value');
        
        if (foregroundColor) foregroundColor.value = this.qrOptions.foreground;
        if (backgroundColor) backgroundColor.value = this.qrOptions.background;
        if (widthInput) widthInput.value = this.qrOptions.width;
        if (heightInput) heightInput.value = this.qrOptions.height;
        if (opacityInput) opacityInput.value = this.qrOptions.logoOpacity;
        if (opacityValue) opacityValue.textContent = '100%';
        
        const logoOptions = this.querySelector('.logo-options');
        if (logoOptions) {
            logoOptions.style.display = 'none';
        }
        
        const logoFileInput = this.querySelector('#logo-file');
        if (logoFileInput) {
            logoFileInput.value = '';
        }
        
        // 重置文件名显示
        const fileLabel = this.querySelector('#logo-file-label');
        const fileSelected = this.querySelector('#logo-file-selected');
        if (fileLabel) fileLabel.style.display = 'flex';
        if (fileSelected) fileSelected.style.display = 'none';
        
        // 更新 logo 选择状态
        this.updateLogoSelectionState();
        
        // 触发重置回调
        if (this.onReset) {
            this.onReset(this.qrOptions);
        }
        
        this.emit('reset', this.qrOptions);
    }
    
    /**
     * 更新二维码选项（从外部更新）
     * @param {object} qrOptions - 新的二维码选项
     */
    updateQROptions(qrOptions) {
        this.qrOptions = { ...this.qrOptions, ...qrOptions };
    }
    
    /**
     * 获取当前二维码选项
     * @returns {object} 二维码选项
     */
    getQROptions() {
        return { ...this.qrOptions };
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EditModal;
} else {
    window.EditModal = EditModal;
}

