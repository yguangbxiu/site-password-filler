# 插件分发指南 - 给其他人使用

## 🎯 快速分发方案

### 方案 1️⃣：ZIP + 安装说明（最简单）
最适合小团队或内部使用

**分发文件**：
- `chrome-password-filler-source.zip` 
- `INSTALLATION.md`

**优点**：
✅ 无需签名  
✅ 用户可自己管理代码  
✅ 更新简单（重新解压覆盖）

**分发方式**：
1. 通过云盘（Google Drive, Dropbox, 网盘等）分享 ZIP 文件
2. 添加 INSTALLATION.md 作为说明
3. 用户按步骤操作即可

---

### 方案 2️⃣：CRX + 签名证书（推荐正式发布）
适合生产环境或大规模分发

**生成 CRX 文件**：
```bash
npm run pack
```

**分发文件**：
- `dist/chrome-password-filler.crx`
- `keys/private.pem` (保管好，仅用于维护者)
- `INSTALLATION.md`

**优点**：
✅ Chrome 官方格式  
✅ 可追踪版本  
✅ 用户体验更专业

**用户安装**：
1. 下载 `.crx` 文件
2. 在 `chrome://extensions/` 页面拖拽安装
3. 完成！

---

### 方案 3️⃣：Chrome Web Store 发布（最专业）
适合公开发布

**步骤**：
1. 在 [Chrome Web Store](https://chromewebstore.google.com/developer/register) 注册开发者账号（$5）
2. 生成签名的 CRX 文件：`npm run pack`
3. 进入开发者后台上传 CRX
4. 填写应用信息、截图、隐私政策
5. 提交审核（1-3 天）

**优点**：
✅ 官方渠道，用户信任度高  
✅ 自动更新  
✅ 评分和评论功能

---

## 📦 打包清单

### 源码分发（ZIP）
```
dist/
└── chrome-password-filler-source.zip
    ├── manifest.json
    ├── background.js
    ├── content.js
    ├── content.css
    ├── popup/
    ├── icons/
    ├── package.json
    └── 其他文件
```

### 编译分发（CRX）
```
dist/
├── chrome-password-filler.crx      ← 用户安装这个
└── private.pem                      ← 维护者保管
```

---

## 🔐 签名密钥管理

### 保护 private.pem
```bash
# 给文件添加权限限制
chmod 600 keys/private.pem

# 建议备份在安全的地方
# 不要上传到 Git 或公开共享
```

### 在 .gitignore 中排除
```
# 已经配置，但检查确认：
keys/
dist/
node_modules/
```

---

## 📲 分享渠道建议

| 渠道 | 最佳用途 | 文件 |
|-----|---------|------|
| **邮件** | 小团队(1-10人) | ZIP + 说明 |
| **GitHub** | 开发者 | ZIP + 源代码 |
| **云盘分享** | 团队分发 | CRX + 签名 |
| **Chrome Web Store** | 大众 | CRX 文件 |
| **Slack/钉钉** | 团队内部 | ZIP 链接 |

---

## ✨ 分发检查清单

- [ ] 确认 `icons/` 有三个 PNG 文件
- [ ] 确认 `manifest.json` 版本号正确
- [ ] 生成 CRX：`npm run pack`
- [ ] 检查 `dist/` 文件已生成
- [ ] 准备 `INSTALLATION.md`
- [ ] 保护好 `keys/private.pem`（不要分享）
- [ ] 测试：用新的 Chrome profile 安装测试

---

## 🔄 版本更新流程

### 发布新版本：

1. **更新代码**
   ```bash
   # 修改文件...
   git add .
   git commit -m "feat: add new feature"
   ```

2. **更新版本号**
   ```json
   // manifest.json
   {
     "version": "1.1.0"  // ← 递增
   }
   ```

3. **重新打包**
   ```bash
   npm run pack
   ```

4. **重新分发**
   - CRX: 上传到 Chrome Web Store 或通过 CRX 文件分享
   - ZIP: 重新生成 ZIP 包
   - 通知用户有新版本

---

## 📊 用户安装统计

如果想了解有多少用户使用了这个插件：

### 使用 Chrome Web Store
- 自动获得安装数和评分
- 可查看使用统计

### 使用 CRX/ZIP
- 建议在 popup 中添加反馈链接
- 收集 GitHub Issue 的报告

---

## 🎁 推荐分发内容

给用户时包括：

```
📦 chrome-password-filler
├── chrome-password-filler-source.zip
├── INSTALLATION.md                  ← 必须！
├── README.md                        ← 功能说明
└── 如何安装.txt                     ← 中文简要说明
```

---

## 常见问题

### Q: 用户收到 CRX 后无法安装？
**A**: 可能是：
- Chrome 自动拦截了下载的 CRX
- 需要通过 `chrome://extensions/` 拖拽安装
- 或改用 ZIP 方案

### Q: 如何追踪有多少人在用？
**A**: 
- 发布到 Chrome Web Store 可自动统计
- 其他方式建议在 popup 中添加反馈链接

### Q: 用户更新到新版本？
**A**:
- **Web Store**：自动更新
- **CRX 文件**：用户需要手动下载新版本
- **ZIP 文件**：用户解压覆盖后重新加载

### Q: 如何支持国际用户？
**A**: 
- 在 `manifest.json` 添加多语言支持
- 参考 Chrome i18n 文档

---

## 📞 技术支持

如果用户遇到问题，让他们：

1. 检查 INSTALLATION.md 的 FAQ 部分
2. 在 GitHub 提交 Issue
3. 查看浏览器开发者工具的错误

---

**最后提醒**：保管好 `keys/private.pem`！这是更新现有安装所必需的签名密钥。
