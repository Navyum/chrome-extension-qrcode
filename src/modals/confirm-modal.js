// Confirm Modal - 确认对话框模态框
// 用于显示确认对话框，如清除历史记录等

const BaseModal = require('./base-modal');

/**
 * 确认对话框模态框类
 */
class ConfirmModal extends BaseModal {
    /**
     * 构造函数
     * @param {string} modalId - 模态框元素的ID
     * @param {object} options - 配置选项
     * @param {function} options.onConfirm - 确认时的回调
     * @param {function} options.onCancel - 取消时的回调
     */
    constructor(modalId, options = {}) {
        super(modalId, options);
        
        this.onConfirm = options.onConfirm || null;
        this.onCancel = options.onCancel || null;
        
        this.bindConfirmEvents();
    }
    
    /**
     * 绑定确认和取消按钮事件
     */
    bindConfirmEvents() {
        const confirmBtn = this.querySelector('#confirm-clear-btn');
        const cancelBtn = this.querySelector('#cancel-clear-btn');
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (this.onConfirm) {
                    this.onConfirm();
                }
                this.emit('confirm');
                this.hide();
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (this.onCancel) {
                    this.onCancel();
                }
                this.emit('cancel');
                this.hide();
            });
        }
    }
    
    /**
     * 显示确认对话框
     * @param {object} config - 配置选项
     * @param {string} config.title - 标题（可选）
     * @param {string} config.message - 消息内容（可选）
     * @param {function} config.onConfirm - 确认回调（可选）
     * @param {function} config.onCancel - 取消回调（可选）
     */
    show(config = {}) {
        // 更新标题和消息（如果提供）
        if (config.title) {
            const titleElement = this.querySelector('.modal-header h3');
            if (titleElement) {
                titleElement.textContent = config.title;
            }
        }
        
        if (config.message) {
            const messageElement = this.querySelector('.modal-body p');
            if (messageElement) {
                messageElement.textContent = config.message;
            }
        }
        
        // 更新回调函数
        if (config.onConfirm) {
            this.onConfirm = config.onConfirm;
        }
        
        if (config.onCancel) {
            this.onCancel = config.onCancel;
        }
        
        // 调用父类的show方法
        super.show();
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfirmModal;
} else {
    window.ConfirmModal = ConfirmModal;
}

