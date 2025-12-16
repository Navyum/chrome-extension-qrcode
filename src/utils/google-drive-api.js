// Google Drive API 工具类
// 用于处理文件上传到Google Drive并获取共享链接

/**
 * Google Drive API配置常量
 */
const DRIVE_API_CONFIG = {
    // API端点
    OAUTH_AUTH_URL: 'https://accounts.google.com/o/oauth2/v2/auth',
    UPLOAD_ENDPOINT: 'https://www.googleapis.com/upload/drive/v3/files',
    DRIVE_API_ENDPOINT: 'https://www.googleapis.com/drive/v3/files',
    USER_INFO_ENDPOINT: 'https://www.googleapis.com/oauth2/v2/userinfo',
    
    // OAuth2配置
    DEFAULT_SCOPES: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.profile'
    ],
    RESPONSE_TYPE: 'token',
    
    // 上传配置
    UPLOAD_TYPE: {
        MULTIPART: 'multipart', // 小文件直接上传
        RESUMABLE: 'resumable'  // 大文件可续传上传
    },
    UPLOAD_FIELDS: 'id,name,webViewLink',
    
    // 文件大小阈值（字节）
    SMALL_FILE_THRESHOLD: 5 * 1024 * 1024, // 5MB
    
    // Resumable上传配置
    RESUMABLE_CHUNK_SIZE: 256 * 1024, // 256KB per chunk
    
    // 权限配置
    PERMISSIONS: {
        owner: null, // 仅所有者，不需要设置权限
        anyone: {
            role: 'reader',
            type: 'anyone'
        },
        restricted: null // 受限访问：移除公开权限，仅所有者可见
    },
    
    // 存储键名
    STORAGE_KEYS: {
        ACCESS_TOKEN: 'googleDriveAccessToken',
        TOKEN_EXPIRY: 'googleDriveTokenExpiry',
        FOLDER_ID: 'googleDriveFolderId',
        USER_INFO: 'googleDriveUserInfo'
    },
    
    // 文件夹配置
    FOLDER_NAME: 'PixelQR',
    
    // 令牌过期时间提前量（毫秒）
    TOKEN_EXPIRY_BUFFER: 5 * 60 * 1000, // 5分钟
    
    // 默认令牌有效期（秒）
    DEFAULT_TOKEN_EXPIRY: 3600
};

/**
 * Google Drive API 客户端类
 * 提供文件上传、权限管理等功能
 */
class GoogleDriveAPI {
    /**
     * 构造函数
     */
    constructor() {
        this.clientId = null;
        this.accessToken = null;
        this.tokenExpiry = null;
        this.folderId = null; // 缓存的文件夹ID
        this.userInfo = null; // 缓存的用户信息
    }
    
    /**
     * 错误日志输出
     * @private
     * @param {...any} args - 要输出的参数
     */
    _error(...args) {
        // Error logging disabled
    }
    
    /**
     * 安全地获取Chrome或Firefox的runtime API
     * @private
     * @returns {object|null} runtime API对象或null
     */
    _getRuntimeAPI() {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            return chrome.runtime;
        }
        if (typeof browser !== 'undefined' && browser.runtime) {
            return browser.runtime;
        }
        return null;
    }
    
    /**
     * 安全地获取Chrome或Firefox的identity API
     * @private
     * @returns {object|null} identity API对象或null
     */
    _getIdentityAPI() {
        if (typeof chrome !== 'undefined' && chrome.identity) {
            return chrome.identity;
        }
        if (typeof browser !== 'undefined' && browser.identity) {
            return browser.identity;
        }
        return null;
    }
    
    /**
     * 安全地获取Chrome或Firefox的storage API
     * @private
     * @returns {object|null} storage API对象或null
     */
    _getStorageAPI() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            return chrome.storage;
        }
        if (typeof browser !== 'undefined' && browser.storage) {
            return browser.storage;
        }
        return null;
    }
    
    /**
     * 安全地获取runtime.lastError
     * @private
     * @returns {object|undefined} lastError对象或undefined
     */
    _getLastError() {
        const chromeRuntime = typeof chrome !== 'undefined' ? chrome.runtime : null;
        const browserRuntime = typeof browser !== 'undefined' ? browser.runtime : null;
        return chromeRuntime?.lastError || browserRuntime?.lastError;
    }
    
    /**
     * 初始化API客户端
     * 从manifest.json中获取OAuth2配置
     * @throws {Error} 如果初始化失败
     * @returns {Promise<void>}
     */
    async init() {
        try {
            const runtime = this._getRuntimeAPI();
            if (!runtime) {
                throw new Error('Browser runtime API not available');
            }
            
            const manifest = runtime.getManifest();
            
            if (!manifest.oauth2 || !manifest.oauth2.client_id) {
                throw new Error(
                    'Google OAuth2 client_id not found in manifest. ' +
                    'Please configure oauth2.client_id in manifest.json'
                );
            }
            
            this.clientId = manifest.oauth2.client_id;
        } catch (error) {
            this._error('初始化失败:', error);
            throw error;
        }
    }
    
    /**
     * 构建OAuth2授权URL
     * @private
     * @param {string} redirectUri - 重定向URI
     * @param {string[]} scopes - OAuth2 scopes
     * @returns {string} 授权URL
     */
    _buildAuthUrl(redirectUri, scopes = DRIVE_API_CONFIG.DEFAULT_SCOPES) {
        const params = new URLSearchParams({
            client_id: this.clientId,
            response_type: DRIVE_API_CONFIG.RESPONSE_TYPE,
            redirect_uri: redirectUri,
            scope: scopes.join(' ')
        });
        
        return `${DRIVE_API_CONFIG.OAUTH_AUTH_URL}?${params.toString()}`;
    }
    
    /**
     * 从重定向URL中提取访问令牌
     * @private
     * @param {string} redirectUrl - 重定向URL
     * @returns {object} 包含accessToken和expiresIn的对象
     * @throws {Error} 如果提取失败
     */
    _extractTokenFromRedirect(redirectUrl) {
        try {
            const url = new URL(redirectUrl);
            const hashParams = new URLSearchParams(url.hash.substring(1));
            
            const error = hashParams.get('error');
            if (error) {
                const errorDescription = hashParams.get('error_description') || error;
                throw new Error(`OAuth error: ${error} - ${errorDescription}`);
            }
            
            const accessToken = hashParams.get('access_token');
            if (!accessToken) {
                throw new Error('No access token in redirect URL');
            }
            
            const expiresIn = parseInt(
                hashParams.get('expires_in') || DRIVE_API_CONFIG.DEFAULT_TOKEN_EXPIRY
            );
            
            return { accessToken, expiresIn };
        } catch (error) {
            if (error.message.startsWith('OAuth error:')) {
                throw error;
            }
            throw new Error(`Failed to parse redirect URL: ${error.message}`);
        }
    }
    
    /**
     * 请求 identity 权限（如果尚未授予）
     * @private
     * @returns {Promise<boolean>} 如果权限已授予或成功请求返回true
     */
    async _requestIdentityPermission() {
        const runtime = this._getRuntimeAPI();
        if (!runtime || !runtime.permissions) {
            // 如果没有 permissions API，假设权限已授予（必需权限的情况）
            return true;
        }
        
        try {
            // 检查是否已有权限
            const hasPermission = await new Promise((resolve) => {
                if (runtime.permissions.contains) {
                    runtime.permissions.contains({ permissions: ['identity'] }, resolve);
                } else {
                    // 如果没有 contains 方法，假设没有权限
                    resolve(false);
                }
            });
            
            if (hasPermission) {
                return true;
            }
            
            // 请求权限
            const granted = await new Promise((resolve) => {
                if (runtime.permissions.request) {
                    runtime.permissions.request({ permissions: ['identity'] }, resolve);
                } else {
                    // 如果没有 request 方法，拒绝请求
                    resolve(false);
                }
            });
            
            if (granted) {
                return true;
            } else {
                this._error('用户拒绝了 identity 权限请求');
                throw new Error('需要 identity 权限才能使用 Google Drive 功能');
            }
        } catch (error) {
            this._error('请求 identity 权限失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取访问令牌
     * 如果已有有效令牌则返回缓存的，否则触发OAuth授权流程
     * @returns {Promise<string>} 访问令牌
     * @throws {Error} 如果获取失败
     */
    async getAccessToken() {
        // 检查是否已有有效的访问令牌
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return Promise.resolve(this.accessToken);
        }
        
        // 请求 identity 权限（如果尚未授予）
        await this._requestIdentityPermission();
        
        const identity = this._getIdentityAPI();
        if (!identity) {
            const error = new Error(
                'Identity API not available. This feature requires Chrome or Edge browser.'
            );
            this._error(error.message);
            throw error;
        }
        
        return new Promise((resolve, reject) => {
            // 获取重定向URL
            const redirectUrl = identity.getRedirectURL();
            
            // 构建授权URL
            const authUrl = this._buildAuthUrl(redirectUrl);
            
            // 启动OAuth流程
            identity.launchWebAuthFlow({
                url: authUrl,
                interactive: true
            }, (redirectUrl) => {
                const lastError = this._getLastError();
                if (lastError) {
                    this._error('OAuth流程失败:', lastError.message);
                    reject(new Error(lastError.message));
                    return;
                }
                
                if (!redirectUrl) {
                    this._error('未返回重定向URL');
                    reject(new Error('No redirect URL returned'));
                    return;
                }
                
                try {
                    // 提取访问令牌
                    const { accessToken, expiresIn } = this._extractTokenFromRedirect(redirectUrl);
                    
                    this.accessToken = accessToken;
                    // 设置过期时间（提前缓冲时间）
                    this.tokenExpiry = Date.now() + (expiresIn * 1000 - DRIVE_API_CONFIG.TOKEN_EXPIRY_BUFFER);
                    
                    // 保存令牌到storage
                    this._saveTokenToStorage(accessToken, this.tokenExpiry);
                    
                    resolve(accessToken);
                } catch (error) {
                    this._error('解析重定向URL失败:', error);
                    reject(error);
                }
            });
        });
    }
    
    /**
     * 保存令牌到本地存储
     * @private
     * @param {string} token - 访问令牌
     * @param {number} expiry - 过期时间戳
     */
    _saveTokenToStorage(token, expiry) {
        const storage = this._getStorageAPI();
        if (storage) {
            storage.local.set({
                [DRIVE_API_CONFIG.STORAGE_KEYS.ACCESS_TOKEN]: token,
                [DRIVE_API_CONFIG.STORAGE_KEYS.TOKEN_EXPIRY]: expiry
            });
        }
    }
    
    /**
     * 从本地存储加载令牌
     * @returns {Promise<string|null>} 访问令牌或null
     */
    async loadToken() {
        return new Promise((resolve) => {
            const storage = this._getStorageAPI();
            if (!storage) {
                resolve(null);
                return;
            }
            
            const keys = [
                DRIVE_API_CONFIG.STORAGE_KEYS.ACCESS_TOKEN,
                DRIVE_API_CONFIG.STORAGE_KEYS.TOKEN_EXPIRY
            ];
            
            storage.local.get(keys, (result) => {
                const token = result[DRIVE_API_CONFIG.STORAGE_KEYS.ACCESS_TOKEN];
                const expiry = result[DRIVE_API_CONFIG.STORAGE_KEYS.TOKEN_EXPIRY];
                
                if (token && expiry && Date.now() < expiry) {
                    this.accessToken = token;
                    this.tokenExpiry = expiry;
                    resolve(token);
                } else {
                    // 令牌已过期或不存在
                    this.accessToken = null;
                    this.tokenExpiry = null;
                    resolve(null);
                }
            });
        });
    }
    
    /**
     * 构建文件上传URL（multipart方式）
     * @private
     * @returns {string} 上传URL
     */
    _buildMultipartUploadUrl() {
        const params = new URLSearchParams({
            uploadType: DRIVE_API_CONFIG.UPLOAD_TYPE.MULTIPART,
            fields: DRIVE_API_CONFIG.UPLOAD_FIELDS
        });
        return `${DRIVE_API_CONFIG.UPLOAD_ENDPOINT}?${params.toString()}`;
    }
    
    /**
     * 构建resumable上传初始化URL
     * @private
     * @returns {string} 初始化URL
     */
    _buildResumableInitUrl() {
        const params = new URLSearchParams({
            uploadType: DRIVE_API_CONFIG.UPLOAD_TYPE.RESUMABLE,
            fields: DRIVE_API_CONFIG.UPLOAD_FIELDS
        });
        return `${DRIVE_API_CONFIG.UPLOAD_ENDPOINT}?${params.toString()}`;
    }
    
    /**
     * 构建权限设置URL
     * @private
     * @param {string} fileId - 文件ID
     * @param {string} [permissionId] - 可选的权限ID（用于删除权限）
     * @returns {string} 权限设置URL
     */
    _buildPermissionUrl(fileId, permissionId = null) {
        let url = `${DRIVE_API_CONFIG.DRIVE_API_ENDPOINT}/${fileId}/permissions`;
        if (permissionId) {
            url += `/${permissionId}`;
        }
        return url;
    }
    
    /**
     * 构建文件共享链接
     * @private
     * @param {string} fileId - 文件ID
     * @returns {string} 共享链接
     */
    _buildShareLink(fileId) {
        return `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
    }
    
    /**
     * 构建文件夹的分享链接
     * @private
     * @param {string} folderId - 文件夹ID
     * @returns {string} 文件夹分享链接
     */
    _buildFolderShareLink(folderId) {
        return `https://drive.google.com/drive/folders/${folderId}`;
    }
    
    /**
     * 获取文件夹的分享链接
     * @param {string} folderId - 文件夹ID
     * @returns {Promise<object>} 包含文件夹ID和分享链接的对象
     */
    async getFolderShareLink(folderId) {
        try {
            const shareLink = this._buildFolderShareLink(folderId);
            return {
                id: folderId,
                shareLink: shareLink,
                webViewLink: shareLink
            };
        } catch (error) {
            this._error('获取文件夹分享链接失败:', error);
            throw error;
        }
    }
    
    /**
     * 查询文件夹是否存在
     * @private
     * @param {string} folderName - 文件夹名称
     * @param {string} accessToken - 访问令牌
     * @returns {Promise<string|null>} 文件夹ID或null
     */
    async _findFolder(folderName, accessToken) {
        try {
            const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            const params = new URLSearchParams({
                q: query,
                fields: 'files(id, name)',
                pageSize: '1'
            });
            
            const url = `${DRIVE_API_CONFIG.DRIVE_API_ENDPOINT}?${params.toString()}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (!response.ok) {
                this._error('查询文件夹失败:', response.status, response.statusText);
                return null;
            }
            
            const data = await response.json();
            if (data.files && data.files.length > 0) {
                return data.files[0].id;
            }
            
            return null;
        } catch (error) {
            this._error('查询文件夹时出错:', error);
            return null;
        }
    }
    
    /**
     * 创建文件夹
     * @private
     * @param {string} folderName - 文件夹名称
     * @param {string} accessToken - 访问令牌
     * @param {string} [parentFolderId] - 可选的父文件夹ID
     * @param {boolean} [returnFullInfo=false] - 是否返回完整信息（包括webViewLink）
     * @returns {Promise<string|object|null>} 文件夹ID、完整信息对象或null
     */
    async _createFolder(folderName, accessToken, parentFolderId = null, returnFullInfo = false) {
        try {
            const metadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder'
            };
            
            // 如果指定了父文件夹，添加到元数据中
            if (parentFolderId) {
                metadata.parents = [parentFolderId];
            }
            
            // 如果需要返回完整信息，添加fields参数
            const fields = returnFullInfo ? '?fields=id,name,webViewLink' : '';
            const url = DRIVE_API_CONFIG.DRIVE_API_ENDPOINT + fields;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(metadata)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                this._error('创建文件夹失败:', errorData.error?.message || response.statusText);
                return null;
            }
            
            const folderData = await response.json();
            
            if (returnFullInfo) {
                return {
                    id: folderData.id,
                    name: folderData.name,
                    webViewLink: folderData.webViewLink || null
                };
            } else {
                return folderData.id;
            }
        } catch (error) {
            this._error('创建文件夹时出错:', error);
            return null;
        }
    }
    
    /**
     * 创建文件夹（公共方法）
     * @param {string} folderName - 文件夹名称
     * @param {string} [parentFolderId] - 可选的父文件夹ID
     * @param {boolean} [returnFullInfo=false] - 是否返回完整信息（包括webViewLink）
     * @returns {Promise<string|object|null>} 文件夹ID、完整信息对象或null
     */
    async createFolder(folderName, parentFolderId = null, returnFullInfo = false) {
        try {
            const accessToken = await this.getAccessToken();
            return await this._createFolder(folderName, accessToken, parentFolderId, returnFullInfo);
        } catch (error) {
            this._error('创建文件夹失败:', error);
            return null;
        }
    }
    
    /**
     * 获取或创建PixelQR文件夹
     * @param {string} [accessToken] - 可选的访问令牌
     * @returns {Promise<string|null>} 文件夹ID或null
     */
    async getOrCreateFolder(accessToken = null) {
        try {
            // 如果已缓存文件夹ID，直接返回
            if (this.folderId) {
                return this.folderId;
            }
            
            // 尝试从storage加载
            const storage = this._getStorageAPI();
            if (storage) {
                const keys = [DRIVE_API_CONFIG.STORAGE_KEYS.FOLDER_ID];
                const result = await new Promise((resolve) => {
                    storage.local.get(keys, resolve);
                });
                
                if (result[DRIVE_API_CONFIG.STORAGE_KEYS.FOLDER_ID]) {
                    this.folderId = result[DRIVE_API_CONFIG.STORAGE_KEYS.FOLDER_ID];
                    return this.folderId;
                }
            }
            
            // 获取访问令牌
            if (!accessToken) {
                accessToken = await this.getAccessToken();
            }
            
            // 查询文件夹是否存在
            let folderId = await this._findFolder(DRIVE_API_CONFIG.FOLDER_NAME, accessToken);
            
            // 如果不存在，创建文件夹
            if (!folderId) {
                folderId = await this._createFolder(DRIVE_API_CONFIG.FOLDER_NAME, accessToken);
            }
            
            // 缓存文件夹ID
            if (folderId) {
                this.folderId = folderId;
                
                // 保存到storage
                if (storage) {
                    storage.local.set({
                        [DRIVE_API_CONFIG.STORAGE_KEYS.FOLDER_ID]: folderId
                    });
                }
            }
            
            return folderId;
        } catch (error) {
            this._error('获取或创建文件夹失败:', error);
            return null;
        }
    }
    
    /**
     * 小文件直接上传（multipart方式）
     * @private
     * @param {File} file - 文件对象
     * @param {object} metadata - 文件元数据
     * @param {string} accessToken - 访问令牌
     * @param {Function} [onProgress] - 进度回调函数
     * @returns {Promise<object>} 文件信息对象
     */
    async _uploadSmallFile(file, metadata, accessToken, onProgress = null) {
        // 创建FormData
        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { 
            type: 'application/json' 
        }));
        formData.append('file', file);
        
        // 上传文件
        const uploadUrl = this._buildMultipartUploadUrl();
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            this._error('上传失败:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData
            });
            throw new Error(
                errorData.error?.message || 
                `Upload failed: ${response.statusText} (${response.status})`
            );
        }
        
        const fileData = await response.json();
        
        // 调用进度回调（100%）
        if (onProgress) {
            onProgress(100);
        }
        
        return fileData;
    }
    
    /**
     * 大文件可续传上传（resumable方式）
     * @private
     * @param {File} file - 文件对象
     * @param {object} metadata - 文件元数据
     * @param {string} accessToken - 访问令牌
     * @param {Function} [onProgress] - 进度回调函数
     * @returns {Promise<object>} 文件信息对象
     */
    async _uploadLargeFile(file, metadata, accessToken, onProgress = null) {
        // 步骤1：初始化resumable上传会话
        const initUrl = this._buildResumableInitUrl();
        const initResponse = await fetch(initUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Upload-Content-Type': file.type || 'application/octet-stream',
                'X-Upload-Content-Length': file.size.toString()
            },
            body: JSON.stringify(metadata)
        });
        
        if (!initResponse.ok) {
            const errorData = await initResponse.json().catch(() => ({}));
            this._error('初始化resumable上传失败:', {
                status: initResponse.status,
                statusText: initResponse.statusText,
                error: errorData
            });
            throw new Error(
                errorData.error?.message || 
                `Failed to initialize resumable upload: ${initResponse.statusText}`
            );
        }
        
        // 获取上传URL
        const uploadUrl = initResponse.headers.get('Location');
        if (!uploadUrl) {
            throw new Error('No upload URL returned from resumable upload initialization');
        }
        
        // 步骤2：分块上传文件
        const chunkSize = DRIVE_API_CONFIG.RESUMABLE_CHUNK_SIZE;
        let uploadedBytes = 0;
        const totalBytes = file.size;
        
        while (uploadedBytes < totalBytes) {
            const chunkEnd = Math.min(uploadedBytes + chunkSize, totalBytes);
            const chunk = file.slice(uploadedBytes, chunkEnd);
            
            // 上传当前块
            const chunkResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Length': (chunkEnd - uploadedBytes).toString(),
                    'Content-Range': `bytes ${uploadedBytes}-${chunkEnd - 1}/${totalBytes}`
                },
                body: chunk
            });
            
            // 检查响应状态
            if (chunkResponse.status === 308) {
                // 308 Resume Incomplete - 继续上传
                const rangeHeader = chunkResponse.headers.get('Range');
                if (rangeHeader) {
                    const match = rangeHeader.match(/bytes=0-(\d+)/);
                    if (match) {
                        uploadedBytes = parseInt(match[1]) + 1;
                    } else {
                        uploadedBytes = chunkEnd;
                    }
                } else {
                    uploadedBytes = chunkEnd;
                }
                
                // 更新进度
                const progress = Math.round((uploadedBytes / totalBytes) * 100);
                if (onProgress) {
                    onProgress(progress);
                }
            } else if (chunkResponse.status === 200 || chunkResponse.status === 201) {
                // 上传完成
                const fileData = await chunkResponse.json();
                
                // 更新进度到100%
                if (onProgress) {
                    onProgress(100);
                }
                
                return fileData;
            } else {
                // 上传失败
                const errorData = await chunkResponse.json().catch(() => ({}));
                this._error('分块上传失败:', {
                    status: chunkResponse.status,
                    statusText: chunkResponse.statusText,
                    error: errorData,
                    uploadedBytes: uploadedBytes,
                    totalBytes: totalBytes
                });
                throw new Error(
                    errorData.error?.message || 
                    `Chunk upload failed: ${chunkResponse.statusText} (${chunkResponse.status})`
                );
            }
        }
        
        // 如果循环结束但未返回，说明上传可能有问题
        throw new Error('Upload completed but no file data returned');
    }
    
    /**
     * 上传文件到Google Drive
     * 根据文件大小自动选择最佳上传方式
     * @param {File} file - 要上传的文件对象
     * @param {string} [fileName] - 可选的自定义文件名
     * @param {Function} [onProgress] - 进度回调函数 (progress: number) => void
     * @param {string} [parentFolderId] - 可选的父文件夹ID（如果不提供则使用PixelQR文件夹）
     * @returns {Promise<object>} 包含文件信息的对象
     * @throws {Error} 如果上传失败
     */
    async uploadFile(file, fileName = null, onProgress = null, parentFolderId = null) {
        try {
            const fileSize = file.size || 0;
            const isLargeFile = fileSize >= DRIVE_API_CONFIG.SMALL_FILE_THRESHOLD;
            
            // 确保已初始化
            if (!this.clientId) {
                await this.init();
            }
            
            // 尝试加载已保存的令牌
            await this.loadToken();
            
            // 获取访问令牌（如果未授权会自动触发授权流程）
            const accessToken = await this.getAccessToken();
            
            // 使用文件名或默认名称
            const name = fileName || file.name || 'uploaded_file';
            
            // 确定父文件夹ID
            let targetFolderId = parentFolderId;
            if (!targetFolderId) {
                // 如果没有指定父文件夹，使用PixelQR文件夹
                targetFolderId = await this.getOrCreateFolder(accessToken);
            }
            
            // 创建文件元数据
            const metadata = {
                name: name,
                mimeType: file.type || 'application/octet-stream'
            };
            
            // 如果找到文件夹，设置父文件夹
            if (targetFolderId) {
                metadata.parents = [targetFolderId];
            }
            
            // 根据文件大小选择上传方式
            let fileData;
            if (isLargeFile) {
                fileData = await this._uploadLargeFile(file, metadata, accessToken, onProgress);
            } else {
                fileData = await this._uploadSmallFile(file, metadata, accessToken, onProgress);
            }
            
            // 文件权限在上传后由调用者设置（根据用户选择的可见性）
            
            // 返回文件信息（包含共享链接）
            return {
                id: fileData.id,
                name: fileData.name,
                webViewLink: fileData.webViewLink,
                shareLink: this._buildShareLink(fileData.id)
            };
        } catch (error) {
            this._error('上传文件失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取文件的所有权限列表
     * @private
     * @param {string} fileId - 文件ID
     * @param {string} accessToken - 访问令牌
     * @returns {Promise<Array>} 权限列表
     */
    async _getFilePermissions(fileId, accessToken) {
        try {
            const url = `${DRIVE_API_CONFIG.DRIVE_API_ENDPOINT}/${fileId}/permissions?fields=permissions(id,type,role)`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                this._error('获取文件权限失败:', errorData.error?.message || response.statusText);
                return [];
            }
            
            const data = await response.json();
            return data.permissions || [];
        } catch (error) {
            this._error('获取文件权限时出错:', error);
            return [];
        }
    }
    
    /**
     * 删除文件权限
     * @private
     * @param {string} fileId - 文件ID
     * @param {string} permissionId - 权限ID
     * @param {string} accessToken - 访问令牌
     * @returns {Promise<boolean>} 是否成功删除
     */
    async _deleteFilePermission(fileId, permissionId, accessToken) {
        try {
            const permissionUrl = this._buildPermissionUrl(fileId, permissionId);
            const response = await fetch(permissionUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                this._error('删除文件权限失败:', errorData.error?.message || response.statusText);
                return false;
            }
            
            return true;
        } catch (error) {
            this._error('删除文件权限时出错:', error);
            return false;
        }
    }
    
    /**
     * 设置文件权限
     * @param {string} fileId - 文件ID
     * @param {string} visibility - 可见性类型: 'owner', 'anyone', 'restricted'
     * @param {string} [accessToken] - 可选的访问令牌
     * @returns {Promise<void>}
     */
    async setFileVisibility(fileId, visibility = 'anyone', accessToken = null) {
        try {
            // 如果是owner，不需要设置权限（默认就是owner）
            if (visibility === 'owner') {
                return;
            }
            
            if (!accessToken) {
                accessToken = await this.getAccessToken();
            }
            
            // 处理 restricted：移除所有公开权限
            if (visibility === 'restricted') {
                // 获取文件的所有权限
                const permissions = await this._getFilePermissions(fileId, accessToken);
                
                // 查找并删除 'anyone' 类型的权限
                const anyonePermissions = permissions.filter(p => p.type === 'anyone');
                
                if (anyonePermissions.length === 0) {
                    return;
                }
                
                // 删除所有 'anyone' 权限
                for (const permission of anyonePermissions) {
                    await this._deleteFilePermission(fileId, permission.id, accessToken);
                }
                
                return;
            }
            
            // 处理 anyone：添加公开权限
            const permission = DRIVE_API_CONFIG.PERMISSIONS[visibility];
            if (!permission) {
                this._error('未知的可见性类型:', visibility);
                return;
            }
            
            const permissionUrl = this._buildPermissionUrl(fileId);
            const response = await fetch(permissionUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(permission)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                this._error('设置文件权限失败:', 
                    errorData.error?.message || response.statusText
                );
                // 不抛出错误，因为文件已经上传成功
            }
        } catch (error) {
            this._error('设置文件权限时出错:', error);
            // 不抛出错误，因为文件已经上传成功
        }
    }
    
    /**
     * 设置文件为公开可访问（兼容旧方法）
     * @param {string} fileId - 文件ID
     * @param {string} [accessToken] - 可选的访问令牌
     * @returns {Promise<void>}
     */
    async makeFilePublic(fileId, accessToken = null) {
        return this.setFileVisibility(fileId, 'anyone', accessToken);
    }
    
    /**
     * 获取用户信息
     * @param {string} [accessToken] - 可选的访问令牌
     * @returns {Promise<object|null>} 用户信息对象或null
     */
    async getUserInfo(accessToken = null) {
        try {
            // 如果已缓存用户信息，直接返回
            if (this.userInfo) {
                return this.userInfo;
            }
            
            // 尝试从storage加载
            const storage = this._getStorageAPI();
            if (storage) {
                const keys = [DRIVE_API_CONFIG.STORAGE_KEYS.USER_INFO];
                const result = await new Promise((resolve) => {
                    storage.local.get(keys, resolve);
                });
                
                if (result[DRIVE_API_CONFIG.STORAGE_KEYS.USER_INFO]) {
                    this.userInfo = result[DRIVE_API_CONFIG.STORAGE_KEYS.USER_INFO];
                    return this.userInfo;
                }
            }
            
            // 获取访问令牌
            if (!accessToken) {
                accessToken = await this.getAccessToken();
            }
            
            // 获取用户信息
            const response = await fetch(DRIVE_API_CONFIG.USER_INFO_ENDPOINT, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (!response.ok) {
                this._error('获取用户信息失败:', response.status, response.statusText);
                return null;
            }
            
            const userInfo = await response.json();
            
            // 缓存用户信息
            this.userInfo = userInfo;
            
            // 保存到storage
            if (storage) {
                storage.local.set({
                    [DRIVE_API_CONFIG.STORAGE_KEYS.USER_INFO]: userInfo
                });
            }
            
            return userInfo;
        } catch (error) {
            this._error('获取用户信息失败:', error);
            return null;
        }
    }
    
    /**
     * 获取PixelQR文件夹的链接
     * @returns {Promise<string|null>} 文件夹链接或null
     */
    async getFolderLink() {
        try {
            const folderId = await this.getOrCreateFolder();
            if (folderId) {
                return `https://drive.google.com/drive/folders/${folderId}`;
            }
            return null;
        } catch (error) {
            this._error('获取文件夹链接失败:', error);
            return null;
        }
    }
    
    /**
     * 创建文件夹并上传文件夹内的所有文件
     * @param {string} folderName - 文件夹名称
     * @param {FileList|Array<File>} files - 文件夹内的文件列表
     * @param {string} parentFolderId - 父文件夹ID（PixelQR文件夹）
     * @param {Function} onProgress - 进度回调函数 (progress: number) => void
     * @returns {Promise<object>} 包含文件夹ID和分享链接的对象
     */
    async uploadFolder(folderName, files, parentFolderId, onProgress = null) {
        try {
            const accessToken = await this.getAccessToken();
            if (!accessToken) {
                throw new Error('无法获取访问令牌');
            }
            
            // 1. 创建文件夹
            const folderMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: parentFolderId ? [parentFolderId] : []
            };
            
            const createResponse = await fetch(DRIVE_API_CONFIG.DRIVE_API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(folderMetadata)
            });
            
            if (!createResponse.ok) {
                const errorData = await createResponse.json().catch(() => ({}));
                throw new Error(errorData.error?.message || '创建文件夹失败');
            }
            
            const folderData = await createResponse.json();
            const folderId = folderData.id;
            
            // 2. 上传文件夹内的所有文件
            const fileArray = Array.from(files);
            const totalFiles = fileArray.length;
            let uploadedCount = 0;
            
            // 构建文件路径映射（保持文件夹结构）
            const fileMap = new Map(); // path -> file
            
            for (const file of fileArray) {
                if (file.webkitRelativePath) {
                    fileMap.set(file.webkitRelativePath, file);
                } else {
                    fileMap.set(file.name, file);
                }
            }
            
            // 按路径排序，确保先创建子文件夹
            const sortedPaths = Array.from(fileMap.keys()).sort();
            
            // 创建子文件夹映射（路径 -> 文件夹ID）
            const subFolderMap = new Map();
            
            for (const relativePath of sortedPaths) {
                const file = fileMap.get(relativePath);
                const pathParts = relativePath.split('/');
                
                if (pathParts.length > 1) {
                    // 有子文件夹，需要创建子文件夹结构
                    let currentParentId = folderId;
                    
                    // 创建所有父文件夹
                    for (let i = 0; i < pathParts.length - 1; i++) {
                        const subFolderName = pathParts[i];
                        const subFolderPath = pathParts.slice(0, i + 1).join('/');
                        
                        if (!subFolderMap.has(subFolderPath)) {
                            // 创建子文件夹
                            const subFolderMetadata = {
                                name: subFolderName,
                                mimeType: 'application/vnd.google-apps.folder',
                                parents: [currentParentId]
                            };
                            
                            const subFolderResponse = await fetch(DRIVE_API_CONFIG.DRIVE_API_ENDPOINT, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${accessToken}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(subFolderMetadata)
                            });
                            
                            if (subFolderResponse.ok) {
                                const subFolderData = await subFolderResponse.json();
                                subFolderMap.set(subFolderPath, subFolderData.id);
                                currentParentId = subFolderData.id;
                            }
                        } else {
                            currentParentId = subFolderMap.get(subFolderPath);
                        }
                    }
                    
                    // 上传文件到对应的父文件夹
                    const fileParentId = currentParentId;
                    await this.uploadFile(file, null, (progress) => {
                        if (onProgress) {
                            const overallProgress = Math.round(
                                (uploadedCount / totalFiles) * 100 + (progress / totalFiles)
                            );
                            onProgress(overallProgress);
                        }
                    }, fileParentId);
                } else {
                    // 根目录文件，直接上传到文件夹
                    await this.uploadFile(file, null, (progress) => {
                        if (onProgress) {
                            const overallProgress = Math.round(
                                (uploadedCount / totalFiles) * 100 + (progress / totalFiles)
                            );
                            onProgress(overallProgress);
                        }
                    }, folderId);
                }
                
                uploadedCount++;
                if (onProgress) {
                    onProgress(Math.round((uploadedCount / totalFiles) * 100));
                }
            }
            
            // 3. 构建分享链接
            const shareLink = `https://drive.google.com/drive/folders/${folderId}`;
            
            return {
                id: folderId,
                name: folderName,
                webViewLink: shareLink,
                shareLink: shareLink
            };
        } catch (error) {
            this._error('上传文件夹失败:', error);
            throw error;
        }
    }
    
    /**
     * 登出（清除令牌、文件夹ID和用户信息缓存）
     * @returns {Promise<void>}
     */
    async logout(removePermission = false) {
        this.accessToken = null;
        this.tokenExpiry = null;
        this.folderId = null;
        this.userInfo = null;
        
        const storage = this._getStorageAPI();
        if (storage) {
            const keys = [
                DRIVE_API_CONFIG.STORAGE_KEYS.ACCESS_TOKEN,
                DRIVE_API_CONFIG.STORAGE_KEYS.TOKEN_EXPIRY,
                DRIVE_API_CONFIG.STORAGE_KEYS.FOLDER_ID,
                DRIVE_API_CONFIG.STORAGE_KEYS.USER_INFO
            ];
            
            await new Promise((resolve) => {
                storage.local.remove(keys, resolve);
            });
        }
        
        // 如果请求移除权限，尝试移除 identity 权限
        if (removePermission) {
            await this._removeIdentityPermission();
        }
    }
    
    /**
     * 移除 identity 权限（如果已授予）
     * @private
     * @returns {Promise<boolean>} 如果权限已移除或不存在返回true
     */
    async _removeIdentityPermission() {
        const runtime = this._getRuntimeAPI();
        if (!runtime || !runtime.permissions) {
            // 如果没有 permissions API，无法移除（可能是必需权限）
            return false;
        }
        
        try {
            // 检查是否有权限
            const hasPermission = await new Promise((resolve) => {
                if (runtime.permissions.contains) {
                    runtime.permissions.contains({ permissions: ['identity'] }, resolve);
                } else {
                    resolve(false);
                }
            });
            
            if (!hasPermission) {
                return true;
            }
            
            // 移除权限
            const removed = await new Promise((resolve) => {
                if (runtime.permissions.remove) {
                    runtime.permissions.remove({ permissions: ['identity'] }, resolve);
                } else {
                    resolve(false);
                }
            });
            
            return removed;
        } catch (error) {
            this._error('移除 identity 权限失败:', error);
            return false;
        }
    }
    
    /**
     * 检查是否已授权
     * @returns {Promise<boolean>} 如果已授权返回true
     */
    async isAuthenticated() {
        await this.loadToken();
        return this.accessToken !== null && 
               this.tokenExpiry !== null && 
               Date.now() < this.tokenExpiry;
    }
}

// 导出单例
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoogleDriveAPI;
} else {
    window.GoogleDriveAPI = GoogleDriveAPI;
}
