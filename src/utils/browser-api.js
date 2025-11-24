// 浏览器API适配器
const browserApi = (() => {
    // 检测浏览器类型
    const isFirefox = typeof browser !== 'undefined' && browser.runtime;
    const isChrome = typeof chrome !== 'undefined' && chrome.runtime;
    
    if (isFirefox) {
        return {
            ...browser,
            action: browser.browserAction,
            browser_action: browser.browserAction,
            i18n: browser.i18n,
            // Firefox scripting API might be different, check compatibility if needed
            scripting: browser.scripting
        };
    } else if (isChrome) {
        return {
            ...chrome,
            browser_action: chrome.action,
            scripting: chrome.scripting,
            i18n: chrome.i18n
        };
    } else {
        // Fallback or mock for testing environments if needed
        return typeof chrome !== 'undefined' ? chrome : {};
    }
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = browserApi;
} else if (typeof window !== 'undefined') {
    window.browserApi = browserApi;
} else if (typeof self !== 'undefined') {
    self.browserApi = browserApi;
}

