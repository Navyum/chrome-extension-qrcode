// QR Code Generator Chrome Extension - Background Script

const browserApi = require('./utils/browser-api');

browserApi.runtime.onInstalled.addListener((details) => {
    // 创建右键菜单
    createContextMenus();
    
    // 设置默认配置
    setDefaultSettings();

    // 卸载时触发调研问卷
    if (details.reason === browserApi.runtime.OnInstalledReason.INSTALL) {
        browserApi.runtime.setUninstallURL('https://forms.gle/TbehvAbCm72vyxUG9');
    }
});

// 创建右键菜单
function createContextMenus() {
    // 清除现有菜单
    browserApi.contextMenus.removeAll(() => {
        // 为选中文本创建菜单
        browserApi.contextMenus.create({
            id: 'generate-qr-selected-text',
            title: browserApi.i18n.getMessage('contextMenuGenerateText'),
            contexts: ['selection']
        });
        
        // 为链接创建菜单
        browserApi.contextMenus.create({
            id: 'generate-qr-link',
            title: browserApi.i18n.getMessage('contextMenuGenerateLink'),
            contexts: ['link']
        });
        
        // 为图片创建菜单
        browserApi.contextMenus.create({
            id: 'generate-qr-image',
            title: browserApi.i18n.getMessage('contextMenuGenerateImage'),
            contexts: ['image']
        });
        
        // 为页面创建菜单
        browserApi.contextMenus.create({
            id: 'generate-qr-page',
            title: browserApi.i18n.getMessage('contextMenuGeneratePage'),
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
    
    // 只有在没有设置时才设置默认值
    const current = await browserApi.storage.local.get('qrOptions');
    if (!current.qrOptions) {
        await browserApi.storage.local.set(defaultSettings);
    }
}

// 获取选中文本的函数（将被注入到页面执行）
function getSelectionScript() {
    const selection = window.getSelection();
    return selection ? selection.toString().trim() : '';
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
            // 在 activeTab 下，tab.url 是可访问的
            content = tab.url || info.pageUrl;
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
    const actionApi = browserApi.action || browserApi.browser_action;
    // openPopup 仅在 Firefox 或特定的 Chrome 版本/策略下有效，通常需要用户交互
    // 对于 commands 触发的，它是有效的。
    // 对于 contextMenu 触发的，它也是有效的。
    try {
        await actionApi.openPopup();
    } catch (e) {
        // Ignore popup open errors (usually due to lack of user gesture)
    }
}

// 处理快捷键
browserApi.commands.onCommand.addListener(async (command) => {
    const [tab] = await browserApi.tabs.query({ active: true, currentWindow: true });
    
    // 忽略受限页面 (如 chrome:// URLs)
    if (!tab || !tab.id || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
         if (command === '_execute_action') {
             // 即使在受限页面，_execute_action 也会打开 popup，popup.js 会处理显示当前 URL (如果 activeTab 允许) 或显示 placeholder
             // 但是这里我们显式调用 openPopupWithData 是为了传递特定的意图
             // 如果 activeTab 不允许访问 url，popup.js 可能只能显示 'Loading...'
             return; 
         }
    }

    switch (command) {
        case '_execute_action':
            // 生成当前页面二维码
            // 注意：manifest 中 _execute_action 默认行为是打开 popup
            // 但如果我们想预填数据，可以这里设置 storage，然后让 popup 读取
            // 实际上，_execute_action 会自动打开 popup，这里不需要手动 openPopup
            // 只需要设置数据。但是 _execute_action 命令本身就是打开 popup，
            // 这里 listener 可能在 popup 打开之前或之后运行。
            // 更可靠的是：popup.js 启动时检查当前 tab。
            // 所以对于 _execute_action，其实不需要做太多，除非我们想强制刷新数据。
            break;
            
        case 'generate-text-qr':
            // 生成选中文本二维码
            try {
                let text = '';
                // 检查是否支持 scripting API (MV3)
                if (browserApi.scripting) {
                    const results = await browserApi.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: getSelectionScript
                    });
                    
                    if (results && results[0] && results[0].result) {
                        text = results[0].result;
                    }
                } 
                // 回退到 tabs.executeScript (MV2 / Firefox)
                else if (browserApi.tabs.executeScript) {
                    const results = await browserApi.tabs.executeScript(tab.id, {
                        code: `(${getSelectionScript.toString()})()`
                    });
                    
                    if (results && results[0]) {
                        text = results[0];
                    }
                }

                if (text) {
                    await openPopupWithData(text, 'text');
                } else {
                    // 如果没有选中文本，打开popup到自定义标签页
                    await openPopupWithData('', 'custom');
                }
            } catch (error) {
                await openPopupWithData('', 'custom');
            }
            break;
    }
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
    
    // getTabInfo 现在 popup.js 可以直接调用 tabs.query (有 activeTab 权限)
    // 但为了兼容性保留
    if (request.action === 'getTabInfo') {
        browserApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            sendResponse({ tab: tabs[0] });
        });
        return true;
    }
});

// 权限检查
browserApi.permissions.contains({
    permissions: ['activeTab', 'contextMenus', 'storage', 'downloads', 'scripting']
}, (result) => {
    // 权限检查完成
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
        }
    }
}, 24 * 60 * 60 * 1000); // 每24小时执行一次
