// Base Modal Class - 基础模态框类
// 提供所有模态框的通用功能

const browserApi = require('../utils/browser-api');

/**
 * 基础模态框类
 * 提供模态框的通用功能：显示/隐藏、国际化、事件系统等
 */
class BaseModal {
    /**
     * 构造函数
     * @param {string} modalId - 模态框元素的ID
     * @param {object} options - 配置选项
     * @param {function} options.onShow - 显示时的回调
     * @param {function} options.onHide - 隐藏时的回调
     * @param {function} options.onReset - 重置时的回调
     */
    constructor(modalId, options = {}) {
        this.modalId = modalId;
        this.modalElement = document.getElementById(modalId);
        this.options = options;
        this.eventListeners = {};
        
        if (!this.modalElement) {
            console.error(`Modal element with id "${modalId}" not found`);
            return;
        }
        
        this.init();
    }
    
    /**
     * 初始化模态框
     */
    init() {
        // 初始化国际化
        this.initI18n();
        
        // 绑定关闭按钮事件
        this.bindCloseEvents();
        
        // 绑定点击外部关闭事件
        this.bindOutsideClick();
    }
    
    /**
     * 初始化国际化
     */
    initI18n() {
        // 替换 data-i18n 属性的文本内容
        const elements = this.modalElement.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const messageKey = element.getAttribute('data-i18n');
            const message = browserApi.i18n.getMessage(messageKey);
            if (message) {
                element.textContent = message;
            }
        });

        // 替换 data-i18n-title 属性的 title
        const titleElements = this.modalElement.querySelectorAll('[data-i18n-title]');
        titleElements.forEach(element => {
            const messageKey = element.getAttribute('data-i18n-title');
            const message = browserApi.i18n.getMessage(messageKey);
            if (message) {
                element.title = message;
            }
        });

        // 替换 data-i18n-placeholder 属性的 placeholder
        const placeholderElements = this.modalElement.querySelectorAll('[data-i18n-placeholder]');
        placeholderElements.forEach(element => {
            const messageKey = element.getAttribute('data-i18n-placeholder');
            const message = browserApi.i18n.getMessage(messageKey);
            if (message) {
                element.placeholder = message;
            }
        });

        // 替换 data-i18n-alt 属性的 alt
        const altElements = this.modalElement.querySelectorAll('[data-i18n-alt]');
        altElements.forEach(element => {
            const messageKey = element.getAttribute('data-i18n-alt');
            const message = browserApi.i18n.getMessage(messageKey);
            if (message) {
                element.alt = message;
            }
        });
    }
    
    /**
     * 绑定关闭按钮事件
     */
    bindCloseEvents() {
        // 查找所有关闭按钮（class包含close-btn或id包含close-）
        const closeButtons = this.modalElement.querySelectorAll('.close-btn, [id*="close-"]');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.hide();
            });
        });
    }
    
    /**
     * 绑定点击外部关闭事件
     */
    bindOutsideClick() {
        this.modalElement.addEventListener('click', (e) => {
            if (e.target === this.modalElement) {
                this.hide();
            }
        });
    }
    
    /**
     * 显示模态框
     */
    show() {
        if (!this.modalElement) return;
        
        this.modalElement.style.display = 'flex';
        
        // 触发onShow回调
        if (this.options.onShow) {
            this.options.onShow();
        }
        
        // 触发show事件
        this.emit('show');
    }
    
    /**
     * 隐藏模态框
     */
    hide() {
        if (!this.modalElement) return;
        
        this.modalElement.style.display = 'none';
        
        // 触发onHide回调
        if (this.options.onHide) {
            this.options.onHide();
        }
        
        // 触发hide事件
        this.emit('hide');
    }
    
    /**
     * 重置模态框状态
     */
    reset() {
        // 触发onReset回调
        if (this.options.onReset) {
            this.options.onReset();
        }
        
        // 触发reset事件
        this.emit('reset');
    }
    
    /**
     * 注册事件监听器
     * @param {string} event - 事件名称
     * @param {function} callback - 回调函数
     */
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }
    
    /**
     * 移除事件监听器
     * @param {string} event - 事件名称
     * @param {function} callback - 回调函数（可选）
     */
    off(event, callback) {
        if (!this.eventListeners[event]) return;
        
        if (callback) {
            this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
        } else {
            delete this.eventListeners[event];
        }
    }
    
    /**
     * 触发事件
     * @param {string} event - 事件名称
     * @param {*} data - 事件数据
     */
    emit(event, data) {
        if (!this.eventListeners[event]) return;
        
        this.eventListeners[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event listener for "${event}":`, error);
            }
        });
    }
    
    /**
     * 获取模态框元素
     * @returns {HTMLElement|null}
     */
    getElement() {
        return this.modalElement;
    }
    
    /**
     * 查询模态框内的元素
     * @param {string} selector - CSS选择器
     * @returns {HTMLElement|null}
     */
    querySelector(selector) {
        return this.modalElement ? this.modalElement.querySelector(selector) : null;
    }
    
    /**
     * 查询模态框内的所有元素
     * @param {string} selector - CSS选择器
     * @returns {NodeList}
     */
    querySelectorAll(selector) {
        return this.modalElement ? this.modalElement.querySelectorAll(selector) : [];
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseModal;
} else {
    window.BaseModal = BaseModal;
}

