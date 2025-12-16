// User Info Modal - 用户信息模态框
// 用于显示Google Drive用户信息和账户管理

const BaseModal = require('./base-modal');
const browserApi = require('../utils/browser-api');

/**
 * 用户信息模态框类
 */
class UserInfoModal extends BaseModal {
    /**
     * 构造函数
     * @param {string} modalId - 模态框元素的ID
     * @param {object} options - 配置选项
     * @param {object} options.googleDriveAPI - GoogleDriveAPI实例
     * @param {function} options.onLogout - 登出时的回调
     * @param {function} options.showMessage - 显示消息的函数
     */
    constructor(modalId, options = {}) {
        super(modalId, options);
        
        this.googleDriveAPI = options.googleDriveAPI || null;
        this.onLogout = options.onLogout || null;
        this.showMessage = options.showMessage || null;
        
        this.bindEvents();
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        const openFolderBtn = this.querySelector('#open-drive-folder-btn');
        const logoutBtn = this.querySelector('#logout-drive-btn');
        const revokeLink = this.querySelector('#revoke-google-auth-link');
        
        if (openFolderBtn) {
            openFolderBtn.addEventListener('click', () => {
                this.handleOpenDriveFolder();
            });
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleLogoutDrive();
            });
        }
        
        if (revokeLink) {
            revokeLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleRevokeGoogleAuth();
            });
        }
    }
    
    /**
     * 显示用户信息模态框
     * @param {object} userInfo - 用户信息对象（可选）
     */
    async show(userInfo = null) {
        const avatarImg = this.querySelector('#user-info-avatar');
        const nameEl = this.querySelector('#user-info-name');
        const emailEl = this.querySelector('#user-info-email');
        
        // 如果没有传入userInfo，尝试从API获取
        if (!userInfo && this.googleDriveAPI) {
            try {
                await this.googleDriveAPI.init();
                userInfo = await this.googleDriveAPI.getUserInfo();
            } catch (error) {
                if (this.showMessage) {
                    this.showMessage(
                        browserApi.i18n.getMessage('error_drive_init_failed', [error.message || error.toString()]), 
                        'error'
                    );
                }
                return;
            }
        }
        
        if (userInfo) {
            if (avatarImg) avatarImg.src = userInfo.picture || '';
            if (nameEl) nameEl.textContent = userInfo.name || '';
            if (emailEl) emailEl.textContent = userInfo.email || '';
        }
        
        super.show();
    }
    
    /**
     * 处理打开Drive文件夹
     */
    async handleOpenDriveFolder() {
        if (!this.googleDriveAPI) {
            return;
        }
        
        try {
            const folderLink = await this.googleDriveAPI.getFolderLink();
            if (folderLink) {
                browserApi.tabs.create({ url: folderLink });
                this.hide();
            } else {
                if (this.showMessage) {
                    this.showMessage(browserApi.i18n.getMessage('error_folder_not_found'), 'error');
                }
            }
        } catch (error) {
            if (this.showMessage) {
                this.showMessage(browserApi.i18n.getMessage('error_folder_not_found'), 'error');
            }
        }
    }
    
    /**
     * 处理登出（清除本地授权）
     */
    async handleLogoutDrive() {
        if (!this.googleDriveAPI) {
            return;
        }
        
        try {
            await this.googleDriveAPI.logout();
            this.hide();
            
            // 触发登出回调
            if (this.onLogout) {
                this.onLogout();
            }
            
            this.emit('logout');
            
            if (this.showMessage) {
                this.showMessage(browserApi.i18n.getMessage('success_logout'), 'success');
            }
        } catch (error) {
            if (this.showMessage) {
                this.showMessage(browserApi.i18n.getMessage('error_logout_failed'), 'error');
            }
        }
    }
    
    /**
     * 处理撤销 Google 授权（跳转到授权管理页面）
     */
    async handleRevokeGoogleAuth() {
        if (!this.googleDriveAPI) {
            return;
        }
        
        try {
            // 先清除本地授权并尝试移除权限
            await this.googleDriveAPI.logout(true);
        } catch (err) {
            // Ignore local auth clear errors
        }
        
        // 跳转到 Google 授权管理页面
        const revokeUrl = 'https://myaccount.google.com/connections';
        browserApi.tabs.create({ url: revokeUrl });
        
        this.hide();
        
        // 触发登出回调
        if (this.onLogout) {
            this.onLogout();
        }
        
        this.emit('logout');
        
        if (this.showMessage) {
            this.showMessage(browserApi.i18n.getMessage('info_revoke_auth_opened'), 'info');
        }
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserInfoModal;
} else {
    window.UserInfoModal = UserInfoModal;
}

