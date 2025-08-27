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
     */
    generate(text, container) {
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
        
        // 获取生成的canvas
        const canvas = tempContainer.querySelector('canvas');
        if (!canvas) {
            console.error('QR码生成失败');
            return;
        }
        
        // 创建新的canvas用于添加Logo
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = this.options.width;
        finalCanvas.height = this.options.height;
        const ctx = finalCanvas.getContext('2d');
        
        // 绘制基础QR码
        ctx.drawImage(canvas, 0, 0);
        
        // 添加Logo
        if (this.options.logo) {
            this.addLogo(finalCanvas, this.options.logo);
        }
        
        // 添加水印
        if (this.options.watermark) {
            this.addWatermark(finalCanvas, this.options.watermark);
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
     */
    addLogo(canvas, logo) {
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            const qrSize = canvas.width;
            const logoSize = qrSize * this.options.logoSize;
            const logoX = (qrSize - logoSize) / 2;
            const logoY = (qrSize - logoSize) / 2;
            
            // 保存当前状态
            ctx.save();
            
            // 设置透明度
            ctx.globalAlpha = this.options.logoOpacity;
            
            // 绘制Logo背景（可选）
            ctx.fillStyle = this.options.colorLight;
            ctx.fillRect(logoX - 2, logoY - 2, logoSize + 4, logoSize + 4);
            
            // 绘制Logo
            ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
            
            // 恢复状态
            ctx.restore();
        };
        
        if (typeof logo === 'string') {
            img.src = logo;
        } else if (logo instanceof File) {
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.readAsDataURL(logo);
        }
    }

    /**
     * 添加水印到QR码
     * @param {HTMLCanvasElement} canvas - 画布
     * @param {string|File} watermark - 水印图片URL或文件
     */
    addWatermark(canvas, watermark) {
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
        };
        
        if (typeof watermark === 'string') {
            img.src = watermark;
        } else if (watermark instanceof File) {
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.readAsDataURL(watermark);
        }
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