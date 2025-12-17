// Upload Drive Modal - 上传到Google Drive模态框
// 用于上传文件或文件夹到Google Drive并生成二维码

const BaseModal = require('./base-modal');
const browserApi = require('../utils/browser-api');

/**
 * 上传到Google Drive模态框类
 */
class UploadDriveModal extends BaseModal {
    /**
     * 构造函数
     * @param {string} modalId - 模态框元素的ID
     * @param {object} options - 配置选项
     * @param {object} options.googleDriveAPI - GoogleDriveAPI实例
     * @param {function} options.onCreateQRCode - 创建二维码的回调函数
     * @param {function} options.showMessage - 显示消息的函数
     * @param {function} options.addToHistory - 添加到历史记录的函数
     * @param {object} options.userInfoModal - UserInfoModal实例
     * @param {function} options.onUploadComplete - 上传完成时的回调
     */
    constructor(modalId, options = {}) {
        super(modalId, {
            ...options,
            onReset: () => {
                this.resetUploadModal();
            }
        });
        
        this.googleDriveAPI = options.googleDriveAPI || null;
        this.onCreateQRCode = options.onCreateQRCode || null;
        this.showMessage = options.showMessage || null;
        this.addToHistory = options.addToHistory || null;
        this.userInfoModal = options.userInfoModal || null;
        this.onUploadComplete = options.onUploadComplete || null;
        
        this.selectedFiles = [];
        this.selectedFolders = [];
        this.uploadMode = 'file';
        this.defaultVisibility = 'anyone';
        
        this.bindEvents();
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 取消上传按钮
        const cancelBtn = this.querySelector('#cancel-upload');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hide();
            });
        }
        
        // 开始上传按钮
        const startUploadBtn = this.querySelector('#start-upload');
        if (startUploadBtn) {
            startUploadBtn.addEventListener('click', () => {
                this.uploadFilesToDrive();
            });
        }
        
        // Google登录按钮
        const signInBtn = this.querySelector('#google-signin-btn');
        if (signInBtn) {
            signInBtn.addEventListener('click', () => {
                this.handleGoogleSignIn();
            });
        }
        
        // 上传模式选择事件
        const uploadModeRadios = this.querySelectorAll('input[name="upload-mode"]');
        uploadModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.uploadMode = e.target.value;
                this.updateUploadMode();
            });
        });
        
        // 文件/文件夹选择
        const fileInput = this.querySelector('#drive-upload-file');
        const folderInput = this.querySelector('#drive-upload-folder');
        const fileLabel = this.querySelector('#drive-file-label');
        
        if (fileLabel) {
            fileLabel.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.uploadMode === 'file' && fileInput) {
                    fileInput.click();
                } else if (this.uploadMode === 'folder' && folderInput) {
                    folderInput.click();
                }
            });
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (this.uploadMode === 'file') {
                    this.handleFileSelect(e.target.files, 'file');
                }
                e.target.value = '';
            });
        }
        
        if (folderInput) {
            folderInput.addEventListener('change', (e) => {
                if (this.uploadMode === 'folder') {
                    this.handleFileSelect(e.target.files, 'folder');
                }
                e.target.value = '';
            });
        }
        
        // 可见性选择事件
        const visibilityRadios = this.querySelectorAll('input[name="file-visibility"]');
        visibilityRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.defaultVisibility = e.target.value;
                this.updateVisibilityOptions(e.target.value);
            });
        });
        
        // 用户头像点击事件
        const avatarContainer = this.querySelector('#user-avatar-container');
        if (avatarContainer) {
            avatarContainer.addEventListener('click', () => {
                if (this.userInfoModal) {
                    this.userInfoModal.show();
                }
            });
        }
    }
    
    /**
     * 显示上传模态框
     */
    async show() {
        this.resetUploadModal();
        
        try {
            if (!this.googleDriveAPI) {
                throw new Error('GoogleDriveAPI未初始化');
            }
            
            await this.googleDriveAPI.init();
            const isAuthenticated = await this.googleDriveAPI.isAuthenticated();
            
            if (isAuthenticated) {
                this.showUploadSection();
            } else {
                this.showAuthSection();
            }
        } catch (error) {
            this.showAuthSection();
        }
        
        super.show();
    }
    
    /**
     * 显示授权登录界面
     */
    showAuthSection() {
        const authSection = this.querySelector('#auth-section');
        const uploadSection = this.querySelector('#upload-section');
        const startUploadBtn = this.querySelector('#start-upload');
        const avatarContainer = this.querySelector('#user-avatar-container');
        
        if (authSection) authSection.style.display = 'block';
        if (uploadSection) uploadSection.style.display = 'none';
        if (startUploadBtn) startUploadBtn.style.display = 'none';
        if (avatarContainer) avatarContainer.style.display = 'none';
        
        // 移除登录状态的绿色样式（在主界面）
        const uploadBtn = document.getElementById('upload-drive-btn');
        if (uploadBtn) {
            uploadBtn.classList.remove('authenticated');
        }
    }
    
    /**
     * 显示文件上传界面
     */
    showUploadSection() {
        const authSection = this.querySelector('#auth-section');
        const uploadSection = this.querySelector('#upload-section');
        const startUploadBtn = this.querySelector('#start-upload');
        
        if (authSection) authSection.style.display = 'none';
        if (uploadSection) uploadSection.style.display = 'block';
        if (startUploadBtn) startUploadBtn.style.display = 'inline-block';
        
        // 恢复上传模式选择
        const uploadModeRadio = this.querySelector(`input[name="upload-mode"][value="${this.uploadMode}"]`);
        if (uploadModeRadio) {
            uploadModeRadio.checked = true;
        }
        this.updateUploadMode();
        
        // 恢复可见性选择
        const visibilityRadio = this.querySelector(`input[name="file-visibility"][value="${this.defaultVisibility}"]`);
        if (visibilityRadio) {
            visibilityRadio.checked = true;
            this.updateVisibilityOptions(this.defaultVisibility);
        }
        
        // 加载用户头像
        this.loadUserAvatar();
        
        // 更新上传按钮的登录状态样式（在主界面）
        this.updateUploadButtonAuthState(true);
    }
    
    /**
     * 更新上传模式UI
     */
    updateUploadMode() {
        const fileLabel = this.querySelector('#drive-file-label');
        if (!fileLabel) return;
        
        const fileInputText = fileLabel.querySelector('.file-input-text');
        if (!fileInputText) return;
        
        this.clearSelection();
        
        if (this.uploadMode === 'file') {
            fileInputText.textContent = browserApi.i18n.getMessage('popup_upload_choose_file') || '选择文件';
            fileLabel.setAttribute('for', 'drive-upload-file');
        } else {
            fileInputText.textContent = browserApi.i18n.getMessage('popup_upload_choose_folder') || '选择文件夹';
            fileLabel.setAttribute('for', 'drive-upload-folder');
        }
        
        this.updateUploadModeOptions(this.uploadMode);
    }
    
    /**
     * 更新上传模式选项的选中状态
     * @param {string} selectedValue - 选中的模式值
     */
    updateUploadModeOptions(selectedValue) {
        const options = this.querySelectorAll('.upload-mode-option');
        options.forEach(option => {
            const radio = option.querySelector('input[type="radio"]');
            if (radio && radio.value === selectedValue) {
                option.classList.add('checked');
            } else {
                option.classList.remove('checked');
            }
        });
    }
    
    /**
     * 更新可见性选项的选中状态
     * @param {string} selectedValue - 选中的可见性值
     */
    updateVisibilityOptions(selectedValue) {
        const options = this.querySelectorAll('.visibility-option');
        options.forEach(option => {
            const radio = option.querySelector('input[type="radio"]');
            if (radio && radio.value === selectedValue) {
                option.classList.add('checked');
            } else {
                option.classList.remove('checked');
            }
        });
    }
    
    /**
     * 处理文件或文件夹选择
     * @param {FileList} files - 选择的文件列表
     * @param {string} type - 'file' 或 'folder'
     */
    handleFileSelect(files, type) {
        if (!files || files.length === 0) {
            this.updateSelectionDisplay();
            return;
        }
        
        if ((type === 'file' && this.uploadMode !== 'file') || 
            (type === 'folder' && this.uploadMode !== 'folder')) {
            return;
        }
        
        const fileArray = Array.from(files);
        
        if (type === 'folder') {
            const firstFile = fileArray[0];
            let folderName = '文件夹';
            
            if (firstFile.webkitRelativePath) {
                const pathParts = firstFile.webkitRelativePath.split('/');
                folderName = pathParts[0];
            }
            
            this.selectedFolders = [{
                name: folderName,
                files: fileArray
            }];
            this.selectedFiles = [];
        } else {
            fileArray.forEach(file => {
                const exists = this.selectedFiles.some(f => 
                    f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
                );
                if (!exists) {
                    this.selectedFiles.push(file);
                }
            });
            this.selectedFolders = [];
        }
        
        this.updateSelectionDisplay();
    }
    
    /**
     * 更新选择显示
     */
    updateSelectionDisplay() {
        const fileLabel = this.querySelector('#drive-file-label');
        if (!fileLabel) return;
        
        const fileHint = fileLabel.querySelector('.file-input-hint');
        if (!fileHint) return;
        
        if (this.uploadMode === 'file') {
            if (this.selectedFiles.length === 0) {
                fileHint.textContent = browserApi.i18n.getMessage('popup_common_no_file_selected');
                fileHint.style.color = '#6c757d';
            } else if (this.selectedFiles.length === 1) {
                fileHint.textContent = this.selectedFiles[0].name;
                fileHint.style.color = '#47630f';
            } else {
                fileHint.textContent = browserApi.i18n.getMessage('popup_upload_files_selected', [this.selectedFiles.length]) || `${this.selectedFiles.length} 个文件`;
                fileHint.style.color = '#47630f';
            }
        } else {
            if (this.selectedFolders.length === 0) {
                fileHint.textContent = browserApi.i18n.getMessage('popup_common_no_file_selected');
                fileHint.style.color = '#6c757d';
            } else {
                const folder = this.selectedFolders[0];
                fileHint.textContent = `${folder.name} (${folder.files.length} 个文件)`;
                fileHint.style.color = '#47630f';
            }
        }
    }
    
    /**
     * 清除选择
     */
    clearSelection() {
        this.selectedFiles = [];
        this.selectedFolders = [];
        this.updateSelectionDisplay();
    }
    
    /**
     * 重置上传模态框
     */
    resetUploadModal() {
        this.clearSelection();
        
        const fileInput = this.querySelector('#drive-upload-file');
        const folderInput = this.querySelector('#drive-upload-folder');
        const progressDiv = this.querySelector('#upload-progress');
        const resultDiv = this.querySelector('#upload-result');
        const startUploadBtn = this.querySelector('#start-upload');
        
        if (fileInput) fileInput.value = '';
        if (folderInput) folderInput.value = '';
        if (progressDiv) progressDiv.style.display = 'none';
        if (resultDiv) resultDiv.style.display = 'none';
        if (startUploadBtn) startUploadBtn.disabled = false;
        
        // 恢复可见性选择
        const visibilityRadio = this.querySelector(`input[name="file-visibility"][value="${this.defaultVisibility}"]`);
        if (visibilityRadio) {
            visibilityRadio.checked = true;
            this.updateVisibilityOptions(this.defaultVisibility);
        }
    }
    
    /**
     * 处理Google登录
     */
    async handleGoogleSignIn() {
        if (!this.googleDriveAPI) {
            return;
        }
        
        const signInBtn = this.querySelector('#google-signin-btn');
        const signInText = signInBtn ? signInBtn.querySelector('span') : null;
        
        if (signInBtn) signInBtn.disabled = true;
        if (signInText) {
            signInText.textContent = browserApi.i18n.getMessage('popup_upload_auth_processing') || '正在登录...';
        }
        
        try {
            await browserApi.storage.local.set({
                pendingAuthAction: 'signin',
                pendingAuthTimestamp: Date.now()
            });
            
            await this.googleDriveAPI.getAccessToken();
            
            await browserApi.storage.local.remove('pendingAuthAction');
            
            this.showUploadSection();
            
            if (this.showMessage) {
                this.showMessage(browserApi.i18n.getMessage('success_auth_granted'), 'success');
            }
        } catch (authError) {
            await browserApi.storage.local.remove('pendingAuthAction');
            
            if (this.showMessage) {
                this.showMessage(
                    browserApi.i18n.getMessage('error_auth_failed', [authError.message || authError.toString()]), 
                    'error'
                );
            }
        } finally {
            if (signInBtn) signInBtn.disabled = false;
            if (signInText) {
                signInText.textContent = browserApi.i18n.getMessage('popup_upload_auth_button');
            }
        }
    }
    
    /**
     * 加载用户头像
     */
    async loadUserAvatar() {
        if (!this.googleDriveAPI) return;
        
        try {
            await this.googleDriveAPI.init();
            const userInfo = await this.googleDriveAPI.getUserInfo();
            
            const avatarContainer = this.querySelector('#user-avatar-container');
            const avatarImg = this.querySelector('#user-avatar');
            
            if (userInfo && userInfo.picture && avatarContainer && avatarImg) {
                avatarImg.src = userInfo.picture;
                avatarImg.alt = userInfo.name || 'User Avatar';
                avatarImg.title = userInfo.name || '点击查看账户信息';
                avatarContainer.style.display = 'block';
                
                avatarContainer.onclick = () => {
                    if (this.userInfoModal) {
                        this.userInfoModal.show(userInfo);
                    }
                };
                
                this.updateUploadButtonAuthState(true);
            } else {
                if (avatarContainer) avatarContainer.style.display = 'none';
                this.updateUploadButtonAuthState(false);
            }
        } catch (error) {
            const avatarContainer = this.querySelector('#user-avatar-container');
            if (avatarContainer) avatarContainer.style.display = 'none';
            this.updateUploadButtonAuthState(false);
        }
    }
    
    /**
     * 更新上传按钮的登录状态样式
     * @param {boolean} isAuthenticated - 是否已登录
     */
    async updateUploadButtonAuthState(isAuthenticated) {
        const uploadBtn = document.getElementById('upload-drive-btn');
        if (!uploadBtn) return;
        
        if (isAuthenticated === undefined) {
            try {
                if (this.googleDriveAPI) {
                    await this.googleDriveAPI.init();
                    isAuthenticated = await this.googleDriveAPI.isAuthenticated();
                } else {
                    isAuthenticated = false;
                }
            } catch (error) {
                isAuthenticated = false;
            }
        }
        
        if (isAuthenticated) {
            uploadBtn.classList.add('authenticated');
        } else {
            uploadBtn.classList.remove('authenticated');
        }
    }
    
    /**
     * 上传文件到Google Drive
     */
    async uploadFilesToDrive() {
        if (!this.googleDriveAPI) {
            if (this.showMessage) {
                this.showMessage('GoogleDriveAPI未初始化', 'error');
            }
            return;
        }
        
        if (this.selectedFiles.length === 0 && this.selectedFolders.length === 0) {
            if (this.showMessage) {
                this.showMessage(browserApi.i18n.getMessage('error_no_file_selected'), 'error');
            }
            return;
        }
        
        try {
            await this.googleDriveAPI.init();
            const isAuthenticated = await this.googleDriveAPI.isAuthenticated();
            
            if (!isAuthenticated) {
                if (this.showMessage) {
                    this.showMessage(browserApi.i18n.getMessage('info_requesting_auth'), 'info');
                }
                
                await browserApi.storage.local.set({
                    pendingAuthAction: 'upload',
                    pendingAuthTimestamp: Date.now()
                });
                
                try {
                    await this.googleDriveAPI.getAccessToken();
                    await browserApi.storage.local.remove('pendingAuthAction');
                    
                    if (this.showMessage) {
                        this.showMessage(browserApi.i18n.getMessage('success_auth_granted'), 'success');
                    }
                    
                    await this.loadUserAvatar();
                } catch (authError) {
                    await browserApi.storage.local.remove('pendingAuthAction');
                    
                    if (this.showMessage) {
                        this.showMessage(
                            browserApi.i18n.getMessage('error_auth_failed', [authError.message || authError.toString()]), 
                            'error'
                        );
                    }
                    
                    const progressDiv = this.querySelector('#upload-progress');
                    const startUploadBtn = this.querySelector('#start-upload');
                    if (progressDiv) progressDiv.style.display = 'none';
                    if (startUploadBtn) startUploadBtn.disabled = false;
                    return;
                }
            } else {
                await this.loadUserAvatar();
            }
            
            // 显示进度条
            const progressDiv = this.querySelector('#upload-progress');
            const resultDiv = this.querySelector('#upload-result');
            const startUploadBtn = this.querySelector('#start-upload');
            
            if (progressDiv) progressDiv.style.display = 'block';
            if (resultDiv) resultDiv.style.display = 'none';
            if (startUploadBtn) startUploadBtn.disabled = true;
            
            // 获取可见性设置
            const visibilityRadio = this.querySelector('input[name="file-visibility"]:checked');
            const visibility = visibilityRadio ? visibilityRadio.value : 'anyone';
            
            // 获取PixelQR文件夹ID
            const accessToken = await this.googleDriveAPI.getAccessToken();
            const pixelQRFolderId = await this.googleDriveAPI.getOrCreateFolder(accessToken);
            
            let uploadedFiles = [];
            let dateFolderInfo = null;
            
            if (this.uploadMode === 'file') {
                const totalFiles = this.selectedFiles.length;
                let uploadedCount = 0;
                
                let targetFolderId = pixelQRFolderId;
                
                // 如果选择多个文件，先创建日期文件夹
                if (totalFiles > 1) {
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const hours = String(now.getHours()).padStart(2, '0');
                    const minutes = String(now.getMinutes()).padStart(2, '0');
                    const seconds = String(now.getSeconds()).padStart(2, '0');
                    const dateFolderName = `PixelQR-${year}-${month}-${day}_${hours}:${minutes}:${seconds}`;
                    
                    const progressText = this.querySelector('#upload-progress-text');
                    if (progressText) {
                        progressText.textContent = `正在创建文件夹 "${dateFolderName}"...`;
                    }
                    
                    const folderResult = await this.googleDriveAPI.createFolder(dateFolderName, pixelQRFolderId, true);
                    if (folderResult && folderResult.id) {
                        targetFolderId = folderResult.id;
                        dateFolderInfo = folderResult;
                        
                        if (visibility !== 'owner') {
                            await this.googleDriveAPI.setFileVisibility(targetFolderId, visibility);
                        }
                    }
                }
                
                // 上传文件
                for (let i = 0; i < this.selectedFiles.length; i++) {
                    const file = this.selectedFiles[i];
                    
                    const progressFill = this.querySelector('#upload-progress-fill');
                    const progressText = this.querySelector('#upload-progress-text');
                    
                    if (progressFill) {
                        const fileProgress = Math.round((uploadedCount / totalFiles) * 100);
                        progressFill.style.width = fileProgress + '%';
                    }
                    
                    if (progressText) {
                        progressText.textContent = browserApi.i18n.getMessage('popup_upload_progress', [uploadedCount + 1, totalFiles, file.name]) || `上传 ${uploadedCount + 1}/${totalFiles}: ${file.name}`;
                    }
                    
                    try {
                        const result = await this.googleDriveAPI.uploadFile(file, null, (progress) => {
                            const fileProgressPercent = progress / 100;
                            const overallProgress = Math.round(
                                (uploadedCount / totalFiles) * 100 + (fileProgressPercent / totalFiles) * 100
                            );
                            const progressFill = this.querySelector('#upload-progress-fill');
                            if (progressFill) {
                                progressFill.style.width = overallProgress + '%';
                            }
                        }, targetFolderId);
                        
                        if (visibility !== 'owner') {
                            await this.googleDriveAPI.setFileVisibility(result.id, visibility);
                        }
                        
                        uploadedFiles.push(result);
                        uploadedCount++;
                    } catch (error) {
                        // Ignore individual file upload errors
                    }
                }
            } else {
                // 文件夹上传模式
                if (this.selectedFolders.length > 0) {
                    const folder = this.selectedFolders[0];
                    
                    const progressText = this.querySelector('#upload-progress-text');
                    if (progressText) {
                        progressText.textContent = `正在上传文件夹 "${folder.name}"...`;
                    }
                    
                    try {
                        const folderResult = await this.googleDriveAPI.uploadFolder(
                            folder.name,
                            folder.files,
                            pixelQRFolderId,
                            (progress) => {
                                const progressFill = this.querySelector('#upload-progress-fill');
                                if (progressFill) {
                                    progressFill.style.width = progress + '%';
                                }
                            }
                        );
                        
                        uploadedFiles.push(folderResult);
                        dateFolderInfo = folderResult;
                        
                        if (visibility !== 'owner') {
                            await this.googleDriveAPI.setFileVisibility(folderResult.id, visibility);
                        }
                    } catch (error) {
                        throw error;
                    }
                }
            }
            
            // 显示上传结果
            this.showUploadResult(uploadedFiles, dateFolderInfo);
            
            // 触发上传完成回调
            if (this.onUploadComplete) {
                this.onUploadComplete(uploadedFiles, dateFolderInfo);
            }
            
            this.emit('uploadComplete', { files: uploadedFiles, folder: dateFolderInfo });
            
        } catch (error) {
            if (this.showMessage) {
                this.showMessage(
                    browserApi.i18n.getMessage('error_upload_failed', [error.message || error.toString()]) || '上传失败',
                    'error'
                );
            }
            
            const progressDiv = this.querySelector('#upload-progress');
            const startUploadBtn = this.querySelector('#start-upload');
            if (progressDiv) progressDiv.style.display = 'none';
            if (startUploadBtn) startUploadBtn.disabled = false;
        }
    }
    
    /**
     * 显示上传结果
     * @param {Array} uploadedFiles - 上传的文件列表
     * @param {object} dateFolderInfo - 日期文件夹信息（可选）
     */
    showUploadResult(uploadedFiles, dateFolderInfo) {
        const progressDiv = this.querySelector('#upload-progress');
        const resultDiv = this.querySelector('#upload-result');
        const successMessage = this.querySelector('#upload-success-message');
        const linkDisplay = this.querySelector('#upload-link-display');
        const startUploadBtn = this.querySelector('#start-upload');
        
        if (progressDiv) progressDiv.style.display = 'none';
        if (resultDiv) resultDiv.style.display = 'block';
        if (startUploadBtn) startUploadBtn.disabled = false;
        
        if (!uploadedFiles || uploadedFiles.length === 0) return;
        
        // 确定要生成的二维码链接
        let qrLink = null;
        let displayText = '';
        
        if (dateFolderInfo && (this.selectedFiles.length > 1 || this.selectedFolders.length > 0)) {
            // 多文件上传或文件夹上传：使用文件夹链接
            qrLink = dateFolderInfo.webViewLink || dateFolderInfo.shareLink;
            displayText = browserApi.i18n.getMessage('popup_upload_folder_link') || 'Folder Link';
        } else if (uploadedFiles.length > 0) {
            // 单文件上传：使用文件链接
            qrLink = uploadedFiles[0].webViewLink || uploadedFiles[0].shareLink;
            displayText = browserApi.i18n.getMessage('popup_upload_file_link') || 'File Link';
        }
        
        if (successMessage) {
            let messageText = '';
            
            // 判断上传类型和文件个数
            if (this.selectedFolders.length > 0) {
                // 文件夹上传：显示文件夹内的文件个数
                const folder = this.selectedFolders[0];
                const fileCount = folder.files ? folder.files.length : 0;
                if (fileCount > 0) {
                    messageText = browserApi.i18n.getMessage('popup_upload_success_multiple', [fileCount]) || `Successfully uploaded ${fileCount} files!`;
                } else {
                    messageText = browserApi.i18n.getMessage('success_file_uploaded') || 'File uploaded successfully';
                }
            } else if (this.selectedFiles.length > 1) {
                // 多文件上传：显示实际上传成功的文件个数
                const successCount = uploadedFiles.length;
                messageText = browserApi.i18n.getMessage('popup_upload_success_multiple', [successCount]) || `Successfully uploaded ${successCount} files!`;
            } else if (uploadedFiles.length === 1) {
                // 单文件上传：显示文件名
                const fileName = uploadedFiles[0].name || 'file';
                messageText = browserApi.i18n.getMessage('popup_upload_success', [fileName]) || `File "${fileName}" uploaded successfully!`;
            } else {
                // 默认消息
                messageText = browserApi.i18n.getMessage('success_file_uploaded') || 'File uploaded successfully';
            }
            
            successMessage.textContent = messageText;
        }
        
        if (linkDisplay && qrLink) {
            // 清空容器
            linkDisplay.textContent = '';
            
            // 创建链接元素
            const link = document.createElement('a');
            link.href = qrLink;
            link.target = '_blank';
            link.textContent = qrLink;
            
            linkDisplay.appendChild(link);
            
            // 显示成功消息提示，包含文件个数信息
            if (this.showMessage) {
                let uploadSuccessMsg = '';
                
                // 判断上传类型和文件个数
                if (this.selectedFolders.length > 0) {
                    // 文件夹上传：显示文件夹内的文件个数
                    const folder = this.selectedFolders[0];
                    const fileCount = folder.files ? folder.files.length : 0;
                    if (fileCount > 0) {
                        uploadSuccessMsg = browserApi.i18n.getMessage('popup_upload_success_multiple', [fileCount]) || `Successfully uploaded ${fileCount} files!`;
                    } else {
                        uploadSuccessMsg = browserApi.i18n.getMessage('success_file_uploaded') || 'File uploaded successfully';
                    }
                } else if (this.selectedFiles.length > 1) {
                    // 多文件上传：显示实际上传成功的文件个数
                    const successCount = uploadedFiles.length;
                    uploadSuccessMsg = browserApi.i18n.getMessage('popup_upload_success_multiple', [successCount]) || `Successfully uploaded ${successCount} files!`;
                } else if (uploadedFiles.length === 1) {
                    // 单文件上传：显示文件名
                    const fileName = uploadedFiles[0].name || 'file';
                    uploadSuccessMsg = browserApi.i18n.getMessage('popup_upload_success', [fileName]) || `File "${fileName}" uploaded successfully!`;
                } else {
                    // 默认消息
                    uploadSuccessMsg = browserApi.i18n.getMessage('success_file_uploaded') || 'File uploaded successfully';
                }
                
                this.showMessage(uploadSuccessMsg, 'success');
            }
        }
        
        // 生成二维码
        if (qrLink && this.onCreateQRCode) {
            this.onCreateQRCode(qrLink, 'url');
        }
        
        // 添加到历史记录
        if (this.addToHistory && qrLink) {
            this.addToHistory('generated', {
                content: qrLink,
                type: 'url',
                isGoogleDrive: true,
                fileName: dateFolderInfo ? dateFolderInfo.name : (uploadedFiles[0] ? uploadedFiles[0].name : ''),
                fileType: dateFolderInfo ? 'folder' : 'file',
                timestamp: new Date().toISOString()
            });
        }
        
        // 延迟关闭模态框，确保二维码已生成并显示在popup页面
        setTimeout(() => {
            this.hide();
        }, 500);
    }
    
    /**
     * 设置上传模式
     * @param {string} mode - 'file' 或 'folder'
     */
    setUploadMode(mode) {
        this.uploadMode = mode;
        this.updateUploadMode();
    }
    
    /**
     * 设置默认可见性
     * @param {string} visibility - 'owner', 'anyone', 'restricted'
     */
    setDefaultVisibility(visibility) {
        this.defaultVisibility = visibility;
        const visibilityRadio = this.querySelector(`input[name="file-visibility"][value="${visibility}"]`);
        if (visibilityRadio) {
            visibilityRadio.checked = true;
            this.updateVisibilityOptions(visibility);
        }
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UploadDriveModal;
} else {
    window.UploadDriveModal = UploadDriveModal;
}

