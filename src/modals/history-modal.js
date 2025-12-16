// History Modal - 历史记录模态框
// 用于显示和管理生成的二维码和扫描的历史记录

const BaseModal = require('./base-modal');
const browserApi = require('../utils/browser-api');

/**
 * 历史记录模态框类
 */
class HistoryModal extends BaseModal {
    /**
     * 构造函数
     * @param {string} modalId - 模态框元素的ID
     * @param {object} options - 配置选项
     * @param {object} options.history - 历史记录对象 {generated: [], scanned: []}
     * @param {function} options.onRestore - 恢复历史记录时的回调
     * @param {function} options.onClear - 清除历史记录时的回调
     * @param {function} options.showMessage - 显示消息的函数
     * @param {function} options.formatTime - 格式化时间的函数
     * @param {function} options.escapeHtml - 转义HTML的函数
     * @param {function} options.truncateText - 截断文本的函数
     * @param {function} options.isUrl - 判断是否为URL的函数
     * @param {function} options.bindImageErrorHandlers - 绑定图片错误处理的函数
     * @param {function} options.loadFaviconsForHistory - 加载favicon的函数
     * @param {object} options.confirmModal - ConfirmModal实例（用于确认清除）
     */
    constructor(modalId, options = {}) {
        super(modalId, options);
        
        this.history = options.history || { generated: [], scanned: [] };
        this.onRestore = options.onRestore || null;
        this.onClear = options.onClear || null;
        this.showMessage = options.showMessage || null;
        this.formatTime = options.formatTime || null;
        this.escapeHtml = options.escapeHtml || null;
        this.truncateText = options.truncateText || null;
        this.isUrl = options.isUrl || null;
        this.bindImageErrorHandlers = options.bindImageErrorHandlers || null;
        this.loadFaviconsForHistory = options.loadFaviconsForHistory || null;
        this.confirmModal = options.confirmModal || null;
        
        this.bindEvents();
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 历史标签页切换
        const generateTab = this.querySelector('#generate-tab');
        const scanTab = this.querySelector('#scan-tab');
        
        if (generateTab) {
            generateTab.addEventListener('click', () => {
                this.switchHistoryTab('generated');
            });
        }
        
        if (scanTab) {
            scanTab.addEventListener('click', () => {
                this.switchHistoryTab('scanned');
            });
        }
        
        // 清除历史记录按钮
        const clearBtn = this.querySelector('#clear-history');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.showClearConfirm();
            });
        }
        
        // 使用事件委托处理历史记录项的所有交互（最佳实践：减少事件监听器数量）
        if (this.modalElement) {
            // 双击恢复事件委托
            this.modalElement.addEventListener('dblclick', (e) => {
                const historyItem = e.target.closest('.history-item');
                if (historyItem) {
                    e.stopPropagation();
                    const content = historyItem.dataset.content;
                    const type = historyItem.dataset.type;
                    if (content && type && this.onRestore) {
                        this.onRestore(content, type);
                    }
                }
            });
            
            // 复制按钮事件委托
            this.modalElement.addEventListener('click', (e) => {
                if (e.target.classList.contains('copy-btn') || e.target.closest('.copy-btn')) {
                    e.stopPropagation();
                    const btn = e.target.classList.contains('copy-btn') ? e.target : e.target.closest('.copy-btn');
                    const content = btn.dataset.content;
                    if (content) {
                        this.copyHistoryContent(content);
                    } else {
                        if (this.showMessage) {
                            this.showMessage(browserApi.i18n.getMessage('error_no_content_to_copy'), 'error');
                        }
                    }
                }
            });
        }
    }
    
    /**
     * 显示历史记录模态框
     */
    show() {
        this.renderHistory();
        // 确保默认显示 generated tab
        this.switchHistoryTab('generated');
        super.show();
    }
    
    /**
     * 渲染历史记录
     */
    renderHistory() {
        this.renderGeneratedHistory();
        this.renderScannedHistory();
    }
    
    /**
     * 切换历史记录Tab
     * @param {string} tab - 'generated' 或 'scanned'
     */
    switchHistoryTab(tab) {
        const generateTab = this.querySelector('#generate-tab');
        const scanTab = this.querySelector('#scan-tab');
        const generateHistory = this.querySelector('#generate-history');
        const scanHistory = this.querySelector('#scan-history');
        
        if (!generateTab || !scanTab || !generateHistory || !scanHistory) return;
        
        if (tab === 'generated') {
            generateTab.classList.add('active');
            scanTab.classList.remove('active');
            generateHistory.classList.add('active');
            scanHistory.classList.remove('active');
        } else {
            scanTab.classList.add('active');
            generateTab.classList.remove('active');
            scanHistory.classList.add('active');
            generateHistory.classList.remove('active');
        }
    }
    
    /**
     * 渲染生成的历史记录
     */
    renderGeneratedHistory() {
        const container = this.querySelector('#generate-history');
        if (!container) return;
        
        // 保存当前的active状态
        const wasActive = container.classList.contains('active');
        
        // 清空容器（使用 textContent 更安全，自动清理所有子元素）
        container.textContent = '';
        
        if (this.history.generated.length === 0) {
            const emptyElement = this.createEmptyHistoryElement(
                '📱',
                'popup_history_empty_generated_title',
                'popup_history_empty_generated_hint'
            );
            container.appendChild(emptyElement);
            
            // 恢复active状态
            if (wasActive) {
                container.classList.add('active');
            }
            return;
        }
        
        // 先恢复active状态，确保容器可见（这样动画才能正常显示）
        if (wasActive) {
            container.classList.add('active');
        }
        
        // 使用 DocumentFragment 批量操作 DOM（Google 最佳实践：减少重排和重绘）
        const fragment = document.createDocumentFragment();
        
        this.history.generated.forEach((record, index) => {
            const itemElement = this.createHistoryItemElement(record, index, 'generated');
            fragment.appendChild(itemElement);
        });
        
        // 一次性添加到 DOM（只触发一次重排）
        container.appendChild(fragment);
        
        // 绑定图片错误处理事件
        if (this.bindImageErrorHandlers) {
            this.bindImageErrorHandlers(container);
        }
        
        // 加载favicon
        if (this.loadFaviconsForHistory) {
            this.loadFaviconsForHistory('generated');
        }
    }
    
    /**
     * 渲染扫描的历史记录
     */
    renderScannedHistory() {
        const container = this.querySelector('#scan-history');
        if (!container) return;
        
        // 保存当前的active状态
        const wasActive = container.classList.contains('active');
        
        // 清空容器（使用 textContent 更安全，自动清理所有子元素）
        container.textContent = '';
        
        if (this.history.scanned.length === 0) {
            const emptyElement = this.createEmptyHistoryElement(
                '🔍',
                'popup_history_empty_scanned_title',
                'popup_history_empty_scanned_hint'
            );
            container.appendChild(emptyElement);
            
            // 恢复active状态
            if (wasActive) {
                container.classList.add('active');
            }
            return;
        }
        
        // 先恢复active状态，确保容器可见（这样动画才能正常显示）
        if (wasActive) {
            container.classList.add('active');
        }
        
        // 使用 DocumentFragment 批量操作 DOM（Google 最佳实践：减少重排和重绘）
        const fragment = document.createDocumentFragment();
        
        this.history.scanned.forEach((record, index) => {
            const itemElement = this.createHistoryItemElement(record, index, 'scanned');
            fragment.appendChild(itemElement);
        });
        
        // 一次性添加到 DOM（只触发一次重排）
        container.appendChild(fragment);
        
        // 绑定图片错误处理事件
        if (this.bindImageErrorHandlers) {
            this.bindImageErrorHandlers(container);
        }
        
        // 加载favicon
        if (this.loadFaviconsForHistory) {
            this.loadFaviconsForHistory('scanned');
        }
    }
    
    /**
     * 复制历史记录内容
     * @param {string} content - 要复制的内容
     */
    copyHistoryContent(content) {
        if (content === null || content === undefined || (typeof content === 'string' && content.trim() === '')) {
            const errorMsg = browserApi.i18n.getMessage('error_no_content_to_copy') || '没有可复制的内容';
            if (this.showMessage) {
                this.showMessage(errorMsg, 'error');
            }
            return;
        }
        
        if (typeof content !== 'string') {
            const errorMsg = browserApi.i18n.getMessage('error_invalid_copy_content') || '无法复制该内容';
            if (this.showMessage) {
                this.showMessage(errorMsg, 'error');
            }
            return;
        }
        
        if (!navigator.clipboard) {
            const errorMsg = browserApi.i18n.getMessage('error_clipboard_not_supported') || '剪贴板不支持';
            if (this.showMessage) {
                this.showMessage(errorMsg, 'error');
            }
            return;
        }
        
        navigator.clipboard.writeText(content)
            .then(() => {
                const successMsg = browserApi.i18n.getMessage('success_text_copied') || '内容已复制到剪贴板';
                if (this.showMessage) {
                    this.showMessage(successMsg, 'success');
                }
            })
            .catch(() => {
                this.fallbackCopyTextToClipboard(content);
            });
    }
    
    /**
     * 备用复制方法
     * @param {string} text - 要复制的文本
     */
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
                if (this.showMessage) {
                    this.showMessage(successMsg, 'success');
                }
            } else {
                const errorMsg = browserApi.i18n.getMessage('error_copy_failed') || '复制失败';
                if (this.showMessage) {
                    this.showMessage(errorMsg, 'error');
                }
            }
        } catch (error) {
            const errorMsg = browserApi.i18n.getMessage('error_copy_failed') || '复制失败';
            if (this.showMessage) {
                this.showMessage(errorMsg, 'error');
            }
        }
    }
    
    /**
     * 显示清除确认对话框
     */
    showClearConfirm() {
        if (this.confirmModal) {
            this.confirmModal.show({
                title: browserApi.i18n.getMessage('popup_history_clear_all'),
                message: browserApi.i18n.getMessage('confirm_clear_history') || '确定要清除所有历史记录吗？此操作无法撤销。',
                onConfirm: () => {
                    this.clearAllHistory();
                }
            });
        } else {
            // 如果没有confirmModal，直接清除
            if (confirm(browserApi.i18n.getMessage('confirm_clear_history') || '确定要清除所有历史记录吗？此操作无法撤销。')) {
                this.clearAllHistory();
            }
        }
    }
    
    /**
     * 清除所有历史记录
     */
    clearAllHistory() {
        this.history.generated = [];
        this.history.scanned = [];
        
        if (this.onClear) {
            this.onClear();
        }
        
        this.renderHistory();
        
        if (this.showMessage) {
            this.showMessage(browserApi.i18n.getMessage('success_history_cleared'), 'success');
        }
        
        this.emit('clear');
    }
    
    /**
     * 更新历史记录
     * @param {object} history - 新的历史记录对象
     */
    updateHistory(history) {
        this.history = history;
        this.renderHistory();
        // 保持当前激活的tab状态
        const generateTab = this.querySelector('#generate-tab');
        if (generateTab && generateTab.classList.contains('active')) {
            this.switchHistoryTab('generated');
        } else {
            this.switchHistoryTab('scanned');
        }
    }
    
    /**
     * 转义HTML属性值
     * @param {string} str - 要转义的字符串
     * @returns {string} 转义后的字符串
     */
    escapeHtmlForAttribute(str) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
    /**
     * 创建空历史记录元素
     * @param {string} icon - 图标emoji
     * @param {string} titleKey - 标题i18n key
     * @param {string} hintKey - 提示i18n key
     * @returns {HTMLElement} 空历史记录容器元素
     */
    createEmptyHistoryElement(icon, titleKey, hintKey) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-history';
        
        const iconDiv = document.createElement('div');
        iconDiv.className = 'empty-history-icon';
        iconDiv.textContent = icon;
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'empty-history-text';
        titleDiv.textContent = browserApi.i18n.getMessage(titleKey);
        
        const hintDiv = document.createElement('div');
        hintDiv.className = 'empty-history-hint';
        hintDiv.textContent = browserApi.i18n.getMessage(hintKey);
        
        emptyDiv.appendChild(iconDiv);
        emptyDiv.appendChild(titleDiv);
        emptyDiv.appendChild(hintDiv);
        
        return emptyDiv;
    }
    
    /**
     * 创建历史记录项元素
     * @param {object} record - 历史记录对象
     * @param {number} index - 记录索引
     * @param {string} type - 记录类型 ('generated' 或 'scanned')
     * @returns {HTMLElement} 历史记录项元素
     */
    createHistoryItemElement(record, index, type) {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.dataset.index = index;
        item.dataset.content = record.content;
        item.dataset.type = record.type;
        item.title = browserApi.i18n.getMessage('popup_history_double_click_restore') || '双击恢复此记录';
        
        // 创建图标容器
        const iconDiv = document.createElement('div');
        iconDiv.className = `history-icon ${type === 'generated' ? 'generate' : 'scan'}`;
        
        // 创建图标内容
        const isUrl = this.isUrl ? this.isUrl(record.content) : false;
        const isGoogleDrive = record.isGoogleDrive || (isUrl && record.content.includes('drive.google.com'));
        
        if (isGoogleDrive) {
            const img = document.createElement('img');
            img.src = 'images/qr-icon/googledrive.png';
            img.alt = 'Google Drive';
            img.className = 'google-drive-icon';
            
            const fallback = document.createElement('span');
            fallback.className = 'fallback-icon';
            fallback.style.display = 'none';
            fallback.textContent = type === 'generated' ? '📱' : '🔍';
            
            iconDiv.appendChild(img);
            iconDiv.appendChild(fallback);
        } else if (isUrl && record.faviconUrl) {
            const img = document.createElement('img');
            img.src = record.faviconUrl;
            img.alt = 'favicon';
            img.className = 'favicon';
            
            const fallback = document.createElement('span');
            fallback.className = 'fallback-icon';
            fallback.style.display = 'none';
            fallback.textContent = type === 'generated' ? '📱' : '🔍';
            
            iconDiv.appendChild(img);
            iconDiv.appendChild(fallback);
        } else if (isUrl) {
            const fallback = document.createElement('span');
            fallback.className = 'fallback-icon';
            fallback.textContent = type === 'generated' ? '📱' : '🔍';
            
            const img = document.createElement('img');
            img.src = '';
            img.alt = 'favicon';
            img.className = 'favicon';
            img.style.display = 'none';
            
            iconDiv.appendChild(fallback);
            iconDiv.appendChild(img);
        } else {
            const fallback = document.createElement('span');
            fallback.className = 'fallback-icon';
            fallback.textContent = type === 'generated' ? '📱' : '🔍';
            iconDiv.appendChild(fallback);
        }
        
        // 创建内容包装器
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'history-content-wrapper';
        
        // 创建标题
        const titleDiv = document.createElement('div');
        titleDiv.className = 'history-title';
        if (isUrl) {
            titleDiv.setAttribute('dir', 'ltr');
        }
        
        let titleText = '';
        if (type === 'generated') {
            const isGoogleDrive = record.isGoogleDrive || (isUrl && record.content.includes('drive.google.com'));
            if (isGoogleDrive && record.fileName) {
                titleText = this.truncateText ? this.truncateText(record.fileName, 60) : record.fileName;
            } else {
                titleText = this.truncateText ? this.truncateText(record.content, 60) : record.content;
            }
        } else {
            titleText = this.truncateText ? this.truncateText(record.displayData || record.content, 60) : (record.displayData || record.content);
        }
        titleDiv.textContent = titleText;
        
        // 创建副标题
        const subtitleDiv = document.createElement('div');
        subtitleDiv.className = 'history-subtitle';
        
        const typeSpan = document.createElement('span');
        let typeDisplay = '';
        if (type === 'generated') {
            const isGoogleDrive = record.isGoogleDrive || (isUrl && record.content.includes('drive.google.com'));
            if (isGoogleDrive && record.fileType) {
                typeDisplay = record.fileType.toUpperCase();
            } else {
                typeDisplay = record.type.toUpperCase();
            }
        } else {
            typeDisplay = record.type.toUpperCase();
        }
        typeSpan.textContent = typeDisplay;
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'history-time';
        const time = this.formatTime ? this.formatTime(record.timestamp) : new Date(record.timestamp).toLocaleString();
        timeSpan.textContent = time;
        
        subtitleDiv.appendChild(typeSpan);
        subtitleDiv.appendChild(timeSpan);
        
        contentWrapper.appendChild(titleDiv);
        contentWrapper.appendChild(subtitleDiv);
        
        // 创建操作按钮
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'history-actions';
        
        // 创建复制按钮（事件通过委托处理，不需要单独绑定）
        const copyBtn = document.createElement('button');
        copyBtn.className = 'history-action-btn copy-btn';
        copyBtn.dataset.content = record.content;
        copyBtn.textContent = browserApi.i18n.getMessage('popup_history_action_copy');
        // 注意：不再在这里绑定事件，使用事件委托（已在 bindEvents 中处理）
        
        actionsDiv.appendChild(copyBtn);
        
        // 组装元素
        item.appendChild(iconDiv);
        item.appendChild(contentWrapper);
        item.appendChild(actionsDiv);
        
        // 注意：双击事件通过事件委托处理（已在 bindEvents 中处理），不需要单独绑定
        
        return item;
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HistoryModal;
} else {
    window.HistoryModal = HistoryModal;
}

