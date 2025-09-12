// QR Code Generator Chrome Extension - Background Script

// 插件安装时的初始化
// 浏览器API适配器
const browserApi = (() => {
    // 检测浏览器类型
    const isFirefox = typeof browser !== 'undefined' && browser.runtime;
    const isChrome = typeof chrome !== 'undefined' && chrome.runtime;
    
    if (isFirefox) {
        // Firefox环境
        return {
            ...browser,
            // 重写action，指向browser_action
            action: browser.browserAction,
            // 为了向后兼容，也提供browser_action别名
            browser_action: browser.browserAction
        };
    } else if (isChrome) {
        // Chrome/Edge环境
        return {
            ...chrome,
            // 为了向后兼容，提供browser_action别名指向action
            browser_action: chrome.action
        };
    } else {
        throw new Error('Neither browser nor chrome API is available');
    }
})();


browserApi.runtime.onInstalled.addListener(() => {
    console.log('QR Code Generator Extension 已安装');
    
    // 创建右键菜单
    createContextMenus();
    
    // 设置默认配置
    setDefaultSettings();
});

// 创建右键菜单
function createContextMenus() {
    // 清除现有菜单
    browserApi.contextMenus.removeAll(() => {
        // 为选中文本创建菜单
        browserApi.contextMenus.create({
            id: 'generate-qr-selected-text',
            title: '生成选中文本的二维码',
            contexts: ['selection']
        });
        
        // 为链接创建菜单
        browserApi.contextMenus.create({
            id: 'generate-qr-link',
            title: '生成链接的二维码',
            contexts: ['link']
        });
        
        // 为图片创建菜单
        browserApi.contextMenus.create({
            id: 'generate-qr-image',
            title: '生成图片链接的二维码',
            contexts: ['image']
        });
        
        // 为页面创建菜单
        browserApi.contextMenus.create({
            id: 'generate-qr-page',
            title: '生成当前页面的二维码',
            contexts: ['page']
        });
    });
}

// 设置默认配置
async function setDefaultSettings() {
    const defaultSettings = {
        qrOptions: {
            foreground: '#000000',
            background: '#FFFFFF',
            width: 512,
            height: 512,
            margin: 10,
            logo: null,
            logoOpacity: 100
        },
        shortcuts: {
            generatePage: 'Ctrl+Shift+Q',
            generateText: 'Ctrl+Shift+T',
            scan: 'Ctrl+Shift+S'
        }
    };
    
    await browserApi.storage.local.set(defaultSettings);
}

// 处理右键菜单点击
browserApi.contextMenus.onClicked.addListener(async (info, tab) => {
    let content = '';
    let type = 'url';
    
    switch (info.menuItemId) {
        case 'generate-qr-selected-text':
            content = info.selectionText;
            type = 'text';
            break;
            
        case 'generate-qr-link':
            content = info.linkUrl;
            type = 'url';
            break;
            
        case 'generate-qr-image':
            content = info.srcUrl;
            type = 'url';
            break;
            
        case 'generate-qr-page':
            content = tab.url;
            type = 'url';
            break;
    }
    
    if (content) {
        // 打开弹出窗口并传递数据
        await openPopupWithData(content, type);
    }
});

// 打开弹出窗口并传递数据
async function openPopupWithData(content, type) {
    // 存储要生成的数据
    await browserApi.storage.local.set({
        pendingQRData: {
            content: content || '', // 确保content不为undefined
            type: type,
            timestamp: Date.now()
        }
    });
    
    // 打开弹出窗口
    console.log("browserApi.action");
    console.log(browserApi);
    console.log(browserApi.action);
    console.log(browserApi.browser_action);
    const actionApi = browserApi.action|| browserApi.browser_action;
    actionApi.openPopup();
}

// 处理快捷键
browserApi.commands.onCommand.addListener(async (command) => {
    const [tab] = await browserApi.tabs.query({ active: true, currentWindow: true });
    
    switch (command) {
        case '_execute_action':
            // 生成当前页面二维码
            await openPopupWithData(tab.url, 'url');
            break;
            
        case 'generate-text-qr':
            // 生成选中文本二维码
            try {
                const response = await browserApi.tabs.sendMessage(tab.id, { action: 'getSelectedText' });
                if (response && response.text) {
                    await openPopupWithData(response.text, 'text');
                } else {
                    // 如果没有选中文本，打开popup到自定义标签页
                    await openPopupWithData('', 'custom');
                }
            } catch (error) {
                console.log('无法获取选中文本，打开自定义输入页面');
                await openPopupWithData('', 'custom');
            }
            break;
    }
});

// 处理来自content script的消息
browserApi.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getSelectedText') {
        // 获取选中文本
        browserApi.tabs.sendMessage(sender.tab.id, { action: 'getSelectedText' }, (response) => {
            sendResponse(response);
        });
        return true; // 保持消息通道开放
    }
    
    if (request.action === 'generateQR') {
        // 生成二维码
        openPopupWithData(request.content, request.type);
    }
});

// 处理标签页更新
browserApi.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // 可以在这里添加页面加载完成后的逻辑
        console.log('页面加载完成:', tab.url);
    }
});

// 处理插件图标点击
browserApi.action.onClicked.addListener(async (tab) => {
    // 如果没有设置popup，则直接打开弹出窗口
    await openPopupWithData(tab.url, 'url');
});

// 错误处理
browserApi.runtime.onSuspend.addListener(() => {
    console.log('插件即将卸载');
});

// 处理来自popup的消息
browserApi.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPendingQRData') {
        // 获取待处理的二维码数据
        browserApi.storage.local.get('pendingQRData', (result) => {
            sendResponse(result.pendingQRData);
            // 清除待处理数据
            browserApi.storage.local.remove('pendingQRData');
        });
        return true;
    }
    
    if (request.action === 'downloadFile') {
        // 下载文件
        browserApi.downloads.download({
            url: request.dataUrl,
            filename: request.filename,
            saveAs: false
        }, (downloadId) => {
            sendResponse({ downloadId: downloadId });
        });
        return true;
    }
    
    if (request.action === 'getTabInfo') {
        // 获取当前标签页信息
        browserApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            sendResponse({ tab: tabs[0] });
        });
        return true;
    }
});

// 权限检查
browserApi.permissions.contains({
    permissions: ['activeTab', 'contextMenus', 'storage', 'downloads', 'tabs']
}, (result) => {
    if (!result) {
        console.warn('插件缺少必要权限');
    }
});

// 定期清理过期数据
setInterval(async () => {
    const result = await browserApi.storage.local.get('history');
    if (result.history) {
        const now = Date.now();
        const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000); // 一周前
        
        const filteredHistory = result.history.filter(item => 
            item.timestamp > oneWeekAgo
        );
        
        if (filteredHistory.length !== result.history.length) {
            await browserApi.storage.local.set({ history: filteredHistory });
            console.log('已清理过期历史记录');
        }
    }
}, 24 * 60 * 60 * 1000); // 每24小时执行一次
