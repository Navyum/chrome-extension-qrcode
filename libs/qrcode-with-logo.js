/**
 * QR码生成器 - 支持Logo和水印
 * 基于原qrcode.js扩展
 */

class QRCodeWithLogo {
    constructor(options = {}) {
        this.options = {
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#FFFFFF",
            correctLevel: QRCode.CorrectLevel.H,
            logo: null,
            logoSize: 0.2,
            logoOpacity: 1,
            watermark: null,
            watermarkSize: 0.3,
            watermarkOpacity: 0.3,
            ...options
        };
    }

    /**
     * 生成带Logo的QR码
     * @param {string} text - QR码内容
     * @param {HTMLElement} container - 容器元素
     * @returns {Promise<HTMLCanvasElement>} 返回Promise，解析为最终的canvas
     */
    async generate(text, container) {
        // 清空容器
        container.innerHTML = '';
        
        // 创建临时容器生成基础QR码
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        document.body.appendChild(tempContainer);
        
        // 生成基础QR码
        const qrCode = new QRCode(tempContainer, {
            text: text,
            width: this.options.width,
            height: this.options.height,
            colorDark: this.options.colorDark,
            colorLight: this.options.colorLight,
            correctLevel: this.options.correctLevel
        });
        
        // 给一点点时间确保 canvas 渲染完成 (虽然 qrcode.js 通常是同步的)
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 获取生成的canvas
        const canvas = tempContainer.querySelector('canvas');
        if (!canvas) {
            document.body.removeChild(tempContainer);
            return null;
        }
        
        // 创建新的canvas用于添加Logo
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = this.options.width;
        finalCanvas.height = this.options.height;
        const ctx = finalCanvas.getContext('2d');
        
        // 绘制基础QR码
        ctx.drawImage(canvas, 0, 0);
        
        // 等待Logo加载完成
        if (this.options.logo) {
            await this.addLogo(finalCanvas, this.options.logo);
        }
        
        // 等待水印加载完成
        if (this.options.watermark) {
            await this.addWatermark(finalCanvas, this.options.watermark);
        }
        
        // 将最终结果添加到容器
        container.appendChild(finalCanvas);
        
        // 清理临时元素
        document.body.removeChild(tempContainer);
        
        return finalCanvas;
    }

    /**
     * 添加Logo到QR码
     * @param {HTMLCanvasElement} canvas - 画布
     * @param {string|File} logo - Logo图片URL或文件
     * @returns {Promise<void>} 返回Promise，在Logo加载并绘制完成后解析
     */
    addLogo(canvas, logo) {
        return new Promise((resolve, reject) => {
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            // 解决跨域问题（如果是外部URL）
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                try {
                    const qrSize = canvas.width;
                    const logoSize = qrSize * this.options.logoSize;
                    const logoX = (qrSize - logoSize) / 2;
                    const logoY = (qrSize - logoSize) / 2;
                    
                    // 保存当前状态
                    ctx.save();
                    
                    // 设置透明度
                    ctx.globalAlpha = parseFloat(this.options.logoOpacity) || 1;
                    
                    // 绘制Logo背景（白色圆角矩形或正方形）
                    ctx.fillStyle = this.options.colorLight || '#FFFFFF';
                    const padding = 2;
                    ctx.fillRect(logoX - padding, logoY - padding, logoSize + padding * 2, logoSize + padding * 2);
                    
                    // 绘制Logo
                    ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
                    
                    // 恢复状态
                    ctx.restore();
                    
                    resolve();
                } catch (e) {
                    reject(e);
                }
            };
            
            img.onerror = (err) => {
                console.error('Logo load error:', err);
                reject(new Error('Failed to load logo image'));
            };
            
            if (typeof logo === 'string' && logo.length > 0) {
                img.src = logo;
            } else if (logo instanceof File || logo instanceof Blob) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    img.src = e.target.result;
                };
                reader.onerror = () => {
                    reject(new Error('Failed to read logo file'));
                };
                reader.readAsDataURL(logo);
            } else {
                // 如果 logo 是无效的（比如空字符串或非 File/Blob 对象）
                console.warn('Invalid logo type:', typeof logo);
                resolve(); 
            }
        });
    }

    /**
     * 添加水印到QR码
     * @param {HTMLCanvasElement} canvas - 画布
     * @param {string|File} watermark - 水印图片URL或文件
     * @returns {Promise<void>} 返回Promise，在水印加载并绘制完成后解析
     */
    addWatermark(canvas, watermark) {
        return new Promise((resolve, reject) => {
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                const qrSize = canvas.width;
                const watermarkSize = qrSize * this.options.watermarkSize;
                const watermarkX = (qrSize - watermarkSize) / 2;
                const watermarkY = (qrSize - watermarkSize) / 2;
                
                // 保存当前状态
                ctx.save();
                
                // 设置透明度
                ctx.globalAlpha = this.options.watermarkOpacity;
                
                // 绘制水印
                ctx.drawImage(img, watermarkX, watermarkY, watermarkSize, watermarkSize);
                
                // 恢复状态
                ctx.restore();
                
                resolve();
            };
            
            img.onerror = () => {
                reject(new Error('Failed to load watermark image'));
            };
            
            if (typeof watermark === 'string') {
                img.src = watermark;
            } else if (watermark instanceof File) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    img.src = e.target.result;
                };
                reader.onerror = () => {
                    reject(new Error('Failed to read watermark file'));
                };
                reader.readAsDataURL(watermark);
            } else {
                resolve(); // 如果没有水印，直接resolve
            }
        });
    }

    /**
     * 下载QR码
     * @param {HTMLCanvasElement} canvas - 画布
     * @param {string} filename - 文件名
     * @param {string} format - 格式 (png/jpg)
     */
    download(canvas, filename = 'qrcode', format = 'png') {
        const link = document.createElement('a');
        link.download = `${filename}.${format}`;
        link.href = canvas.toDataURL(`image/${format}`);
        link.click();
    }

    /**
     * 获取QR码数据URL
     * @param {HTMLCanvasElement} canvas - 画布
     * @param {string} format - 格式 (png/jpg)
     * @returns {string} 数据URL
     */
    getDataURL(canvas, format = 'png') {
        return canvas.toDataURL(`image/${format}`);
    }
}

// 导出到全局
window.QRCodeWithLogo = QRCodeWithLogo; 