// jsQR库二次开发适配文件
// 用于适配当前Chrome插件的QR码扫描功能

class jsQRAdapter {
    constructor() {
        // 检查jsQR库是否已加载
        if (typeof jsQR === 'undefined') {
            console.error('jsQR library not loaded');
            return;
        }
        
        this.jsQR = jsQR;
        this.scanHistory = new Map(); // 扫描历史缓存
        this.maxHistorySize = 50; // 最大历史记录数
    }

    /**
     * 扫描QR码的主要方法
     * @param {ImageData} imageData - 图像数据
     * @param {number} width - 图像宽度
     * @param {number} height - 图像高度
     * @returns {Object|null} 扫描结果或null
     */
    scanQRCode(imageData, width, height) {
        try {
            // 参数验证
            if (!imageData || !imageData.data) {
                throw new Error('Invalid ImageData object');
            }
            
            if (!width || !height) {
                throw new Error('Invalid dimensions');
            }
            
            if (imageData.data.length !== width * height * 4) {
                throw new Error('ImageData size does not match dimensions');
            }

            // 生成缓存键
            const cacheKey = this.generateCacheKey(imageData, width, height);
            
            // 检查缓存
            if (this.scanHistory.has(cacheKey)) {
                console.log('Using cached result');
                return this.scanHistory.get(cacheKey);
            }

            // 图像预处理
            const processedImageData = this.preprocessImage(imageData, width, height);
            
            // 使用jsQR库扫描
            const result = this.jsQR(processedImageData.data, processedImageData.width, processedImageData.height);
            
            if (result) {
                // 处理扫描结果
                const processedResult = this.processScanResult(result);
                
                // 缓存结果
                this.cacheResult(cacheKey, processedResult);
                
                return processedResult;
            }
            
            return null;
            
        } catch (error) {
            console.error('QR code scanning failed:', error);
            return null;
        }
    }

    /**
     * 图像预处理
     * @param {ImageData} imageData - 原始图像数据
     * @param {number} width - 图像宽度
     * @param {number} height - 图像高度
     * @returns {ImageData} 预处理后的图像数据
     */
    preprocessImage(imageData, width, height) {
        // 如果图像太大，进行缩放以提高性能
        const maxSize = 800;
        let targetWidth = width;
        let targetHeight = height;
        
        if (width > maxSize || height > maxSize) {
            const scale = Math.min(maxSize / width, maxSize / height);
            targetWidth = Math.floor(width * scale);
            targetHeight = Math.floor(height * scale);
        }
        
        // 如果尺寸没有变化，直接返回原图像
        if (targetWidth === width && targetHeight === height) {
            return imageData;
        }
        
        // 创建缩放后的图像数据
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        // 创建临时canvas进行缩放
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = width;
        tempCanvas.height = height;
        
        // 将原始图像数据绘制到临时canvas
        const tempImageData = new ImageData(imageData.data, width, height);
        tempCtx.putImageData(tempImageData, 0, 0);
        
        // 缩放到目标尺寸
        ctx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, targetWidth, targetHeight);
        
        // 获取缩放后的图像数据
        return ctx.getImageData(0, 0, targetWidth, targetHeight);
    }

    /**
     * 处理扫描结果
     * @param {Object} result - jsQR库返回的原始结果
     * @returns {Object} 处理后的结果
     */
    processScanResult(result) {
        return {
            data: result.data,
            type: this.detectContentType(result.data),
            format: result.format,
            bounds: result.bounds,
            timestamp: Date.now()
        };
    }

    /**
     * 检测内容类型
     * @param {string} content - 扫描到的内容
     * @returns {string} 内容类型
     */
    detectContentType(content) {
        if (!content) return 'Unknown';
        
        const lowerContent = content.toLowerCase();
        
        if (lowerContent.startsWith('http://') || lowerContent.startsWith('https://')) {
            return 'URL';
        } else if (lowerContent.startsWith('mailto:')) {
            return 'Email';
        } else if (lowerContent.startsWith('tel:')) {
            return 'Phone';
        } else if (lowerContent.startsWith('sms:')) {
            return 'SMS';
        } else if (lowerContent.startsWith('geo:')) {
            return 'Location';
        } else if (lowerContent.startsWith('begin:vcard')) {
            return 'Contact';
        } else if (lowerContent.startsWith('wifi:')) {
            return 'WiFi';
        } else if (lowerContent.startsWith('bitcoin:') || lowerContent.startsWith('ethereum:')) {
            return 'Cryptocurrency';
        } else if (lowerContent.match(/^\d{13,14}$/)) {
            return 'ISBN';
        } else if (lowerContent.match(/^[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}$/)) {
            return 'IBAN';
        } else {
            return 'Text';
        }
    }

    /**
     * 生成缓存键
     * @param {ImageData} imageData - 图像数据
     * @param {number} width - 图像宽度
     * @param {number} height - 图像高度
     * @returns {string} 缓存键
     */
    generateCacheKey(imageData, width, height) {
        // 使用图像数据的哈希作为缓存键
        let hash = 0;
        const data = imageData.data;
        
        // 为了性能，只使用部分数据进行哈希计算
        const step = Math.max(1, Math.floor(data.length / 1000));
        
        for (let i = 0; i < data.length; i += step) {
            hash = ((hash << 5) - hash) + data[i];
            hash = hash & hash; // 转换为32位整数
        }
        
        return `${hash}_${width}_${height}`;
    }

    /**
     * 缓存扫描结果
     * @param {string} key - 缓存键
     * @param {Object} result - 扫描结果
     */
    cacheResult(key, result) {
        // 限制缓存大小
        if (this.scanHistory.size >= this.maxHistorySize) {
            const firstKey = this.scanHistory.keys().next().value;
            this.scanHistory.delete(firstKey);
        }
        
        this.scanHistory.set(key, result);
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.scanHistory.clear();
    }

    /**
     * 获取缓存统计信息
     * @returns {Object} 缓存统计
     */
    getCacheStats() {
        return {
            size: this.scanHistory.size,
            maxSize: this.maxHistorySize
        };
    }

    /**
     * 批量扫描多个图像
     * @param {Array} imageDataArray - 图像数据数组
     * @returns {Array} 扫描结果数组
     */
    batchScan(imageDataArray) {
        const results = [];
        
        for (const item of imageDataArray) {
            const result = this.scanQRCode(item.imageData, item.width, item.height);
            if (result) {
                results.push({
                    ...result,
                    source: item.source || 'unknown'
                });
            }
        }
        
        return results;
    }

    /**
     * 验证QR码格式
     * @param {string} data - QR码数据
     * @returns {boolean} 是否为有效格式
     */
    validateQRData(data) {
        if (!data || typeof data !== 'string') {
            return false;
        }
        
        // 检查数据长度
        if (data.length === 0 || data.length > 2953) {
            return false;
        }
        
        // 检查是否包含无效字符
        const invalidChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
        if (invalidChars.test(data)) {
            return false;
        }
        
        return true;
    }

    /**
     * 格式化扫描结果用于显示
     * @param {Object} result - 扫描结果
     * @returns {Object} 格式化后的结果
     */
    formatResultForDisplay(result) {
        if (!result) return null;
        
        const formatted = {
            ...result,
            displayData: this.formatDataForDisplay(result.data, result.type),
            timestamp: new Date(result.timestamp).toLocaleString(),
            isValid: this.validateQRData(result.data)
        };
        
        return formatted;
    }

    /**
     * 格式化数据用于显示
     * @param {string} data - 原始数据
     * @param {string} type - 数据类型
     * @returns {string} 格式化后的数据
     */
    formatDataForDisplay(data, type) {
        if (!data) return '';
        
        switch (type) {
            case 'URL':
                return data;
            case 'Email':
                return data.replace('mailto:', '');
            case 'Phone':
                return data.replace('tel:', '');
            case 'SMS':
                return data.replace('sms:', '');
            case 'WiFi':
                return this.formatWiFiData(data);
            case 'Contact':
                return this.formatContactData(data);
            default:
                return data;
        }
    }

    /**
     * 格式化WiFi数据
     * @param {string} data - WiFi数据
     * @returns {string} 格式化后的WiFi信息
     */
    formatWiFiData(data) {
        try {
            const wifiData = data.replace('WIFI:', '');
            const parts = wifiData.split(';');
            const info = {};
            
            for (const part of parts) {
                if (part.includes(':')) {
                    const [key, value] = part.split(':', 2);
                    info[key] = value;
                }
            }
            
            let result = '';
            if (info.S) result += `SSID: ${info.S}\n`;
            if (info.T) result += `Type: ${info.T}\n`;
            if (info.P) result += `Password: ${info.P}\n`;
            if (info.H) result += `Hidden: ${info.H === 'true' ? 'Yes' : 'No'}`;
            
            return result.trim();
        } catch (error) {
            return data;
        }
    }

    /**
     * 格式化联系人数据
     * @param {string} data - 联系人数据
     * @returns {string} 格式化后的联系人信息
     */
    formatContactData(data) {
        try {
            const lines = data.split('\n');
            const info = {};
            
            for (const line of lines) {
                if (line.startsWith('FN:')) {
                    info.name = line.substring(3);
                } else if (line.startsWith('TEL:')) {
                    info.phone = line.substring(4);
                } else if (line.startsWith('EMAIL:')) {
                    info.email = line.substring(6);
                }
            }
            
            let result = '';
            if (info.name) result += `Name: ${info.name}\n`;
            if (info.phone) result += `Phone: ${info.phone}\n`;
            if (info.email) result += `Email: ${info.email}`;
            
            return result.trim();
        } catch (error) {
            return data;
        }
    }
}

// 创建全局实例
window.jsQRAdapter = new jsQRAdapter();

// 导出到全局作用域
window.jsQRImproved = {
    scan: (imageData, width, height) => window.jsQRAdapter.scanQRCode(imageData, width, height),
    batchScan: (imageDataArray) => window.jsQRAdapter.batchScan(imageDataArray),
    clearCache: () => window.jsQRAdapter.clearCache(),
    getCacheStats: () => window.jsQRAdapter.getCacheStats(),
    validateQRData: (data) => window.jsQRAdapter.validateQRData(data),
    formatResult: (result) => window.jsQRAdapter.formatResultForDisplay(result)
}; 