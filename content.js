// QR Code Generator Chrome Extension - Content Script

// 监听来自popup或background的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getSelectedText') {
        const selectedText = getSelectedText();
        sendResponse({ text: selectedText });
    }
    
    if (request.action === 'getPageInfo') {
        const pageInfo = getPageInfo();
        sendResponse(pageInfo);
    }
    
    if (request.action === 'injectQRCode') {
        injectQRCode(request.data);
        sendResponse({ success: true });
    }
});

// 获取选中的文本
function getSelectedText() {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
        return selection.toString().trim();
    }
    return '';
}

// 获取页面信息
function getPageInfo() {
    return {
        url: window.location.href,
        title: document.title,
        description: getMetaDescription(),
        favicon: getFavicon()
    };
}

// 获取页面描述
function getMetaDescription() {
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
        return metaDesc.getAttribute('content');
    }
    
    // 如果没有meta description，尝试获取第一个段落
    const firstP = document.querySelector('p');
    if (firstP) {
        return firstP.textContent.substring(0, 160) + '...';
    }
    
    return '';
}

// 获取网站图标
function getFavicon() {
    const favicon = document.querySelector('link[rel="icon"]') || 
                   document.querySelector('link[rel="shortcut icon"]') ||
                   document.querySelector('link[rel="apple-touch-icon"]');
    
    if (favicon) {
        return favicon.href;
    }
    
    // 默认favicon路径
    return window.location.origin + '/favicon.ico';
}

// 注入二维码到页面
function injectQRCode(data) {
    // 创建二维码容器
    const qrContainer = document.createElement('div');
    qrContainer.id = 'qr-code-extension-container';
    qrContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 200px;
        height: 200px;
        background: white;
        border: 2px solid #667eea;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        padding: 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
    `;
    
    // 创建关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #666;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    closeBtn.onclick = () => {
        document.body.removeChild(qrContainer);
    };
    
    // 创建二维码标题
    const title = document.createElement('div');
    title.textContent = '二维码';
    title.style.cssText = `
        font-size: 12px;
        color: #666;
        margin-bottom: 5px;
        text-align: center;
    `;
    
    // 创建二维码显示区域
    const qrDisplay = document.createElement('div');
    qrDisplay.id = 'qr-code-display';
    qrDisplay.style.cssText = `
        width: 150px;
        height: 150px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // 添加元素到容器
    qrContainer.appendChild(closeBtn);
    qrContainer.appendChild(title);
    qrContainer.appendChild(qrDisplay);
    
    // 添加到页面
    document.body.appendChild(qrContainer);
    
    // 生成二维码
    generateQRCodeInPage(qrDisplay, data.content);
}

// 在页面中生成二维码
function generateQRCodeInPage(container, content) {
    // 检查是否已加载QRCode库
    if (typeof QRCode === 'undefined') {
        // 动态加载QRCode库
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('qrcode.min.js');
        script.onload = () => {
            createQRCode(container, content);
        };
        document.head.appendChild(script);
    } else {
        createQRCode(container, content);
    }
}

// 创建二维码
function createQRCode(container, content) {
    new QRCode(container, {
        text: content,
        width: 150,
        height: 150,
        colorDark: '#000000',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.H
    });
}

// 添加键盘快捷键支持
document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+Q: 生成当前页面二维码
    if (e.ctrlKey && e.shiftKey && e.key === 'Q') {
        e.preventDefault();
        chrome.runtime.sendMessage({
            action: 'generateQR',
            content: window.location.href,
            type: 'url'
        });
    }
    
    // Ctrl+Shift+T: 生成选中文本二维码
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        const selectedText = getSelectedText();
        if (selectedText) {
            chrome.runtime.sendMessage({
                action: 'generateQR',
                content: selectedText,
                type: 'text'
            });
        }
    }
});

// 添加右键菜单支持
document.addEventListener('contextmenu', (e) => {
    const selectedText = getSelectedText();
    if (selectedText) {
        // 可以在这里添加自定义右键菜单项
        console.log('选中文本:', selectedText);
    }
});

// 监听页面变化（用于SPA应用）
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        // 页面URL发生变化时的处理
        console.log('页面URL已更改:', url);
    }
}).observe(document, { subtree: true, childList: true });

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('QR Code Generator Extension 内容脚本已加载');
    
    // 可以在这里添加页面特定的初始化逻辑
    initializePageFeatures();
});

// 初始化页面功能
function initializePageFeatures() {
    // 为链接添加二维码生成功能
    addQRCodeToLinks();
    
    // 为图片添加二维码生成功能
    addQRCodeToImages();
}

// 为链接添加二维码生成功能
function addQRCodeToLinks() {
    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
        link.addEventListener('mouseenter', (e) => {
            // 可以在这里添加悬停显示二维码的功能
        });
    });
}

// 为图片添加二维码生成功能
function addQRCodeToImages() {
    const images = document.querySelectorAll('img[src]');
    images.forEach(img => {
        img.addEventListener('mouseenter', (e) => {
            // 可以在这里添加悬停显示二维码的功能
        });
    });
}

// 导出函数供其他脚本使用
window.QRCodeExtension = {
    getSelectedText,
    getPageInfo,
    injectQRCode,
    generateQRCodeInPage
}; 