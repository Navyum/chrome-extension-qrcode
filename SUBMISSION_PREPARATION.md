# 提交准备文档 - Identity 权限更新

## 📋 版本信息
- **版本号**: 2.0.1
- **更新日期**: 2024
- **主要变更**: 新增 `identity` 权限用于 Google Drive 集成功能

---

## 🔐 权限说明

### 新增权限
- **权限名称**: `identity` (可选权限)
- **平台**: Chrome/Edge (Manifest V3)
- **平台**: Firefox (Manifest V2) - 必需权限

### 权限用途
`identity` 权限用于：
1. **Google OAuth2 认证流程**
   - 通过 `chrome.identity.launchWebAuthFlow()` 启动 OAuth 授权
   - 获取 Google 账户访问令牌
   - 实现安全的用户身份验证

2. **Google Drive API 集成**
   - 上传文件到 Google Drive
   - 获取文件共享链接
   - 读取用户基本信息（头像、姓名）

### OAuth2 配置
```json
{
  "oauth2": {
    "client_id": "218937796520-mparpteknls03pef340tkouv6bn6u11m.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/userinfo.profile"
    ]
  }
}
```

### 权限范围说明
- `https://www.googleapis.com/auth/drive.file`: 
  - 仅访问用户通过本扩展创建的文件
  - **不访问**用户现有的 Google Drive 文件
  - 仅用于上传和分享新文件
  
- `https://www.googleapis.com/auth/userinfo.profile`:
  - 仅读取用户基本信息（姓名、头像）
  - **不访问**其他敏感信息

---

## 📝 商店描述更新清单

### Chrome Web Store / Edge Add-ons

#### 1. 功能描述更新
需要在描述中明确说明：
- ✅ Google Drive 集成功能（可选功能）
- ✅ 用户可以选择是否使用此功能
- ✅ 仅在用户主动使用时才请求权限
- ✅ 权限为可选权限（Chrome/Edge）

**建议描述文本**:
```
新功能：Google Drive 集成（可选）
- 可以将文件上传到 Google Drive 并生成分享链接的二维码
- 支持文件和文件夹上传
- 可选择文件可见性设置
- 仅在您使用此功能时才请求 Google 账户授权
- 仅访问通过本扩展创建的文件，不会访问您现有的文件
```

#### 2. 隐私说明
需要在隐私政策中说明：
- ✅ 如何使用 `identity` 权限
- ✅ 数据收集和使用情况
- ✅ Google OAuth2 流程说明
- ✅ 数据存储位置（本地存储）

#### 3. 权限说明
需要在权限说明中解释：
- ✅ `identity` 权限的用途
- ✅ 为什么需要此权限
- ✅ 权限是可选的（Chrome/Edge）
- ✅ 用户可以随时撤销授权

---

## 🔒 隐私政策更新要求

### 必须包含的内容

#### 1. Identity 权限使用说明
```
本扩展使用 identity 权限来：
- 通过 Google OAuth2 进行用户身份验证
- 访问 Google Drive API 上传文件
- 获取用户基本信息（姓名、头像）用于显示

此权限仅在用户主动使用 Google Drive 上传功能时才会被请求。
```

#### 2. 数据收集说明
```
我们收集的数据：
- Google 访问令牌（仅存储在本地浏览器中）
- 用户基本信息（姓名、头像，仅用于显示）
- 上传文件的元数据（文件名、大小等）

我们不收集：
- 用户的 Google Drive 文件内容
- 用户的其他 Google 账户信息
- 任何个人敏感数据
```

#### 3. 数据存储说明
```
所有数据仅存储在用户的本地浏览器中：
- 访问令牌存储在 chrome.storage.local
- 用户信息缓存在内存中
- 不会上传到任何第三方服务器
```

#### 4. 第三方服务说明
```
本扩展使用以下第三方服务：
- Google OAuth2 API（用于身份验证）
- Google Drive API（用于文件上传）

这些服务遵循 Google 的隐私政策和服务条款。
```

#### 5. 用户权利说明
```
用户可以：
- 随时撤销 Google 授权（在扩展设置中）
- 通过 Google 账户设置撤销授权
- 不使用 Google Drive 功能（不影响其他功能）
```

---

## ✅ 测试清单

### 功能测试

#### Chrome/Edge (Manifest V3)
- [ ] 首次使用 Google Drive 功能时，正确请求 `identity` 权限
- [ ] 用户拒绝权限时，显示适当的错误提示
- [ ] 用户授予权限后，可以正常进行 OAuth 授权
- [ ] OAuth 授权流程正常完成
- [ ] 可以成功上传文件到 Google Drive
- [ ] 可以成功获取文件共享链接
- [ ] 可以生成二维码
- [ ] 用户信息正确显示（头像、姓名）
- [ ] 可以正常退出登录
- [ ] 可以撤销 Google 授权

#### Firefox (Manifest V2)
- [ ] 安装时正确请求 `identity` 权限
- [ ] OAuth 授权流程正常完成
- [ ] 所有 Google Drive 功能正常工作

### 权限测试
- [ ] 未授予 `identity` 权限时，Google Drive 功能不可用
- [ ] 授予权限后，功能正常可用
- [ ] 撤销权限后，功能正确禁用
- [ ] 权限请求提示清晰明确

### 隐私测试
- [ ] 访问令牌仅存储在本地
- [ ] 不会向第三方服务器发送敏感数据
- [ ] 用户信息仅用于显示，不用于其他目的
- [ ] 退出登录后，本地数据正确清除

### 用户体验测试
- [ ] 权限请求时机合理（仅在需要时）
- [ ] 错误提示清晰易懂
- [ ] 授权流程流畅
- [ ] 多语言支持正确

---

## 📋 审核注意事项

### Chrome Web Store 审核要点

#### 1. 权限使用说明
- ✅ 在商店描述中明确说明 `identity` 权限的用途
- ✅ 说明权限是可选的
- ✅ 说明仅在用户主动使用时才请求

#### 2. 隐私政策
- ✅ 必须提供隐私政策链接
- ✅ 隐私政策必须说明 `identity` 权限的使用
- ✅ 必须说明数据收集和使用情况
- ✅ 必须说明第三方服务（Google OAuth2/Drive API）

#### 3. 功能说明
- ✅ 明确说明 Google Drive 集成功能
- ✅ 说明功能的可选性
- ✅ 说明用户如何启用/禁用功能

#### 4. 常见审核问题准备

**Q: 为什么需要 identity 权限？**
A: 用于 Google OAuth2 认证，实现安全的用户身份验证和 Google Drive API 访问。

**Q: 是否会访问用户的所有 Google Drive 文件？**
A: 不会。我们仅使用 `drive.file` scope，只能访问通过本扩展创建的文件。

**Q: 数据是否会上传到第三方服务器？**
A: 不会。所有数据仅存储在用户本地浏览器中，不会上传到任何第三方服务器。

**Q: 用户如何撤销授权？**
A: 用户可以在扩展设置中撤销授权，或通过 Google 账户设置页面撤销。

### Edge Add-ons 审核要点
- ✅ 与 Chrome Web Store 要求类似
- ✅ 确保 Manifest V3 兼容性

### Firefox Add-ons 审核要点
- ✅ `identity` 权限在 Firefox 中是必需权限
- ✅ 需要在描述中说明为什么需要此权限
- ✅ 确保 OAuth 流程在 Firefox 中正常工作

---

## 📄 需要更新的文件

### 1. 商店描述文件
- [ ] `docs/StoreListing-en.txt` - 英文描述
- [ ] `docs/StoreListing-zh_CN.txt` - 中文描述
- [ ] 其他语言描述文件（如需要）

### 2. 隐私政策
- [ ] 更新在线隐私政策页面
- [ ] 确保包含所有必需的信息

### 3. 代码文件
- [ ] ✅ `manifest/chrome.json` - 已配置 `optional_permissions`
- [ ] ✅ `manifest/edge.json` - 已配置 `optional_permissions`
- [ ] ✅ `manifest/firefox.json` - 已配置 `permissions`
- [ ] ✅ `src/utils/google-drive-api.js` - 已实现权限请求逻辑

---

## 🚀 提交步骤

### 1. 代码准备
- [ ] 确保所有代码已提交到版本控制
- [ ] 运行构建脚本生成 dist 文件
- [ ] 检查所有 manifest 文件配置正确

### 2. 文档准备
- [ ] 更新商店描述
- [ ] 更新隐私政策
- [ ] 准备审核说明文档（如需要）

### 3. 测试验证
- [ ] 完成所有测试清单项目
- [ ] 在不同浏览器中测试
- [ ] 测试权限请求流程

### 4. 提交审核
- [ ] Chrome Web Store: 上传新版本，填写更新说明
- [ ] Edge Add-ons: 上传新版本，填写更新说明
- [ ] Firefox Add-ons: 上传新版本，填写更新说明

### 5. 审核跟进
- [ ] 关注审核状态
- [ ] 准备回答审核员的问题
- [ ] 如有问题及时修复并重新提交

---

## 📞 支持信息

### 审核问题联系
- 准备详细的权限使用说明
- 准备功能演示视频（如需要）
- 准备技术文档（如需要）

### 用户支持
- 准备常见问题解答（FAQ）
- 准备使用教程
- 准备故障排除指南

---

## ⚠️ 重要提醒

1. **隐私政策必须更新**：这是审核的关键要求
2. **权限说明必须清晰**：避免审核被拒
3. **功能必须可选**：确保用户可以选择不使用 Google Drive 功能
4. **测试必须充分**：确保所有功能正常工作
5. **文档必须完整**：确保所有说明清晰准确

---

## 📚 参考资源

- [Chrome Identity API 文档](https://developer.chrome.com/docs/extensions/reference/identity/)
- [Google OAuth2 文档](https://developers.google.com/identity/protocols/oauth2)
- [Chrome Web Store 审核指南](https://developer.chrome.com/docs/webstore/review-policy/)
- [Firefox Add-ons 审核指南](https://extensionworkshop.com/documentation/publish/add-on-policies/)

---

**最后更新**: 2024
**文档版本**: 1.0

