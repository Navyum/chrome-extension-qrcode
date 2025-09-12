/**
 * 浏览器API适配器
 * 统一不同浏览器的API调用
 */

// 检测当前浏览器环境
function detectBrowser() {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
    const manifest = chrome.runtime.getManifest();
    if (manifest.manifest_version === 2) {
      return 'firefox';
    }
    return 'chrome';
  }
  if (typeof browser !== 'undefined' && browser.runtime) {
    return 'firefox';
  }
  return 'unknown';
}

const currentBrowser = detectBrowser();

// 统一的浏览器API对象
const browserAPI = {
  // 存储API
  storage: {
    local: {
      get: (keys) => {
        if (currentBrowser === 'firefox') {
          return browser.storage.local.get(keys);
        }
        return chrome.storage.local.get(keys);
      },
      set: (items) => {
        if (currentBrowser === 'firefox') {
          return browser.storage.local.set(items);
        }
        return chrome.storage.local.set(items);
      },
      remove: (keys) => {
        if (currentBrowser === 'firefox') {
          return browser.storage.local.remove(keys);
        }
        return chrome.storage.local.remove(keys);
      }
    }
  },

  // 标签页API
  tabs: {
    query: (queryInfo) => {
      if (currentBrowser === 'firefox') {
        return browser.tabs.query(queryInfo);
      }
      return chrome.tabs.query(queryInfo);
    },
    getCurrent: () => {
      if (currentBrowser === 'firefox') {
        return browser.tabs.getCurrent();
      }
      return chrome.tabs.getCurrent();
    },
    get: (tabId) => {
      if (currentBrowser === 'firefox') {
        return browser.tabs.get(tabId);
      }
      return chrome.tabs.get(tabId);
    }
  },

  // 运行时API
  runtime: {
    getManifest: () => {
      if (currentBrowser === 'firefox') {
        return browser.runtime.getManifest();
      }
      return chrome.runtime.getManifest();
    },
    getURL: (path) => {
      if (currentBrowser === 'firefox') {
        return browser.runtime.getURL(path);
      }
      return chrome.runtime.getURL(path);
    },
    onMessage: {
      addListener: (callback) => {
        if (currentBrowser === 'firefox') {
          return browser.runtime.onMessage.addListener(callback);
        }
        return chrome.runtime.onMessage.addListener(callback);
      }
    },
    sendMessage: (message) => {
      if (currentBrowser === 'firefox') {
        return browser.runtime.sendMessage(message);
      }
      return chrome.runtime.sendMessage(message);
    },
    onInstalled: {
      addListener: (callback) => {
        if (currentBrowser === 'firefox') {
          return browser.runtime.onInstalled.addListener(callback);
        }
        return chrome.runtime.onInstalled.addListener(callback);
      }
    },
    onSuspend: {
      addListener: (callback) => {
        if (currentBrowser === 'firefox') {
          return browser.runtime.onSuspend.addListener(callback);
        }
        return chrome.runtime.onSuspend.addListener(callback);
      }
    }
  },

  // 下载API
  downloads: {
    download: (options) => {
      if (currentBrowser === 'firefox') {
        return browser.downloads.download(options);
      }
      return chrome.downloads.download(options);
    }
  },

  // 上下文菜单API
  contextMenus: {
    create: (createProperties) => {
      if (currentBrowser === 'firefox') {
        return browser.contextMenus.create(createProperties);
      }
      return chrome.contextMenus.create(createProperties);
    },
    removeAll: (callback) => {
      if (currentBrowser === 'firefox') {
        return browser.contextMenus.removeAll(callback);
      }
      return chrome.contextMenus.removeAll(callback);
    },
    onClicked: {
      addListener: (callback) => {
        if (currentBrowser === 'firefox') {
          return browser.contextMenus.onClicked.addListener(callback);
        }
        return chrome.contextMenus.onClicked.addListener(callback);
      }
    }
  },

  // 命令API
  commands: {
    onCommand: {
      addListener: (callback) => {
        if (currentBrowser === 'firefox') {
          return browser.commands.onCommand.addListener(callback);
        }
        return chrome.commands.onCommand.addListener(callback);
      }
    }
  },

  // Action/Browser Action API - 统一处理
  action: {
    onClicked: {
      addListener: (callback) => {
        if (currentBrowser === 'firefox') {
          // Firefox使用browser_action
          return browser.browserAction.onClicked.addListener(callback);
        } else {
          // Chrome/Edge使用action
          return chrome.action.onClicked.addListener(callback);
        }
      }
    }
  },

  // 为了向后兼容，也提供browser_action别名
  browser_action: {
    onClicked: {
      addListener: (callback) => {
        if (currentBrowser === 'firefox') {
          return browser.browserAction.onClicked.addListener(callback);
        } else {
          // Chrome/Edge中browser_action重定向到action
          return chrome.action.onClicked.addListener(callback);
        }
      }
    }
  },

  // 获取当前浏览器类型
  getBrowser: () => currentBrowser,

  // 检查是否为Firefox
  isFirefox: () => currentBrowser === 'firefox',

  // 检查是否为Chrome/Edge
  isChrome: () => currentBrowser === 'chrome'
};

// 导出API
if (typeof module !== 'undefined' && module.exports) {
  module.exports = browserAPI;
} else {
  window.browserAPI = browserAPI;
}
