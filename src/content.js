// QR Code Generator Chrome Extension - Content Script
// 此文件主要作为资源文件，在需要时通过 scripting API 动态注入
// 目前已将核心逻辑移至 background.js 的 getSelectionScript 中
// 如果将来有复杂的页面操作，可以在这里扩展

console.log('QR Code Generator: Content script ready');

// 保留用于消息监听的示例，以防未来扩展
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'ping') {
            sendResponse({ status: 'alive' });
        }
    });
}
