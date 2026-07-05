# Chrome 密码填充插件 - 安装指南

这个文档说明如何使用打包好的插件文件。

## 📦 文件说明

- **chrome-password-filler-source.zip** - 完整源代码包，包含所有文件
- **private.pem** - 签名私钥（保管好！用于未来版本更新）

## ✅ 安装方法 1：使用源码包（推荐用户）

这是最简单的安装方法，适合大多数用户。

### 步骤：

1. **下载并解压**
   - 解压 `chrome-password-filler-source.zip` 到任意位置
   - 例如解压到 `~/Downloads/chrome-password-filler`

2. **生成图标**（如果没有）
   ```bash
   cd chrome-password-filler
   npm install
   node generate-icons.js
   ```
   > 图标应该会生成在 `icons/` 目录

3. **加载到 Chrome**
   - 打开 Chrome，访问 `chrome://extensions/`
   - 启用右上角的 **开发者模式** 开关
   - 点击 **加载未打包的扩展程序**
   - 选择 `chrome-password-filler` 目录
   - ✅ 完成！插件会显示在扩展列表中

## 🔐 安装方法 2：使用已签名 CRX 文件（正式分发）

如果有 `.crx` 文件，可以这样安装：

1. 在 Chrome 中访问 `chrome://extensions/`
2. 启用 **开发者模式**
3. 将 `.crx` 文件拖拽到扩展页面
4. 点击确认安装

> 注意：CRX 文件需要正确签名才能在其他设备上使用

## 🔄 更新现有安装

如果已经安装过此插件，更新步骤：

1. 解压新版本源码到同一位置，覆盖旧文件
2. 访问 `chrome://extensions/`
3. 在插件卡片上点击刷新按钮 🔄
4. 新版本会立即生效

## 📋 用户常见问题

### Q: 为什么看不到插件图标？
- 检查 `icons/` 目录下是否有三个 PNG 文件
- 如果没有，运行 `npm install && node generate-icons.js`
- 重新加载插件（在 `chrome://extensions/` 点击刷新）

### Q: 页面上看不到密码填充下拉菜单？
- 刷新页面（Ctrl/Cmd + R）
- 打开开发者工具检查是否有 JavaScript 错误
- 有些网站可能有内容安全策略 (CSP) 限制

### Q: 填充后表单没有反应？
- 有些网站使用特殊表单库，可能需要手动按 Tab 键
- 或在填充后手动点击登录按钮

## 🛡️ 安全建议

⚠️ **本地存储警告**：
- 密码存储在本地浏览器存储中
- **不存储高安全级别账号**（金融、支付等）
- 定期清理不再使用的网站账号
- 仅在受信任的个人设备上使用

## 📝 开发者信息

### 签名密钥管理

`private.pem` 文件是私钥，用于对扩展签名。**保管好这个文件！**

如果需要发布更新版本：
```bash
# 更新代码后，使用私钥重新打包
npm run pack
```

### 项目结构
```
chrome-password-filler/
├── manifest.json           # 插件配置
├── background.js           # Service Worker
├── content.js              # 内容脚本
├── content.css             # 样式
├── popup/                  # 管理界面
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── icons/                  # 插件图标
└── package.json            # 依赖配置
```

## 🚀 发布到 Chrome Web Store

如果想正式发布到应用商店：

1. 注册 Chrome Web Store 开发者账号（$5 一次性费用）
2. 生成 CRX 文件：`npm run pack`
3. 上传 CRX 文件到开发者后台
4. 填写应用信息和截图
5. 提交审核（通常 1-3 天）

## 📞 支持

- 项目主页：查看 README.md
- 问题报告：创建 Issue 或提交 PR

---

**版本**: 1.0.0  
**最后更新**: 2026-06-01
