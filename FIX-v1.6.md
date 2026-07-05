# 🔧 修复：管理密码按钮无反应

## 问题现象

点击"管理密码..."链接时没有任何反应，无法打开管理界面

## 根本原因

`openPasswordManager()` 函数发送了一条未被处理的消息：
```javascript
chrome.runtime.sendMessage({ action: 'openPopup' })
```

background.js 中没有对应的消息处理器，导致什么都没发生。

## 修复方案

**直接用 `window.open()` 在新标签页打开 popup HTML**，并通过 URL 参数传递当前网站的 hostname。

### 修改 1: `content.js` — 重写 `openPasswordManager()`

```javascript
// ❌ 旧代码（不工作）
function openPasswordManager() {
  const popupUrl = chrome.runtime.getURL('popup/popup.html');
  chrome.runtime.sendMessage({ action: 'openPopup' }, ...);
}

// ✅ 新代码
function openPasswordManager() {
  // 在新标签页中打开管理界面，传递当前 hostname 作为 URL 参数
  const popupUrl = chrome.runtime.getURL('popup/popup.html')
    + '?hostname=' + encodeURIComponent(hostname);
  window.open(popupUrl, '_blank');
  closePasswordModal();
}
```

**关键改进**：
- 用 `window.open()` 直接打开新标签页
- URL 中附带 `?hostname=` 参数（当前网站 hostname）
- URL 编码防止特殊字符问题
- 同时关闭弹出面板

### 修改 2: `popup/popup.js` — 支持 URL 参数

Popup 原来只从 active tab 读取 hostname。当通过新标签页打开时，active tab 是 popup 自身（URL 是 `chrome-extension://...`），需要先检查 URL 参数。

```javascript
// ❌ 旧代码（不支持 URL 参数）
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = new URL(tabs[0].url);
  currentHostname = url.hostname;
  ...
});

// ✅ 新代码（优先 URL 参数，其次 active tab）
const params = new URLSearchParams(window.location.search);
const hostnameFromParam = params.get('hostname');

if (hostnameFromParam) {
  // 从 URL 参数读取（从面板"管理密码..."打开）
  currentHostname = hostnameFromParam;
  document.getElementById('currentHostname').textContent = `当前网站: ${currentHostname}`;
  loadCurrentPasswords();
} else {
  // 从 active tab 读取（从扩展图标打开）
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = new URL(tabs[0].url);
    currentHostname = url.hostname;
    document.getElementById('currentHostname').textContent = `当前网站: ${currentHostname}`;
    loadCurrentPasswords();
  });
}
```

**关键改进**：
- 先检查 URL 参数 `?hostname=`
- 如果有参数，直接使用（从面板打开时）
- 如果没有，回退到从 active tab 查询（从扩展图标打开时）

## 工作流程

### 场景 1: 从密码面板点击"管理密码..."

```
用户点击"管理密码..."
    ↓
openPasswordManager() 被调用
    ↓
构建 URL: /popup.html?hostname=kuboard.cn
    ↓
window.open(url, '_blank')
    ↓
新标签页打开 popup
    ↓
popup.js 读取 URL 参数 hostname=kuboard.cn
    ↓
显示 kuboard.cn 的账号列表 ✓
```

### 场景 2: 从扩展图标点击打开 popup

```
用户点击扩展图标
    ↓
popup 打开（在扩展弹窗中）
    ↓
popup.js 检查 URL 参数
    ↓
无 URL 参数，查询 active tab
    ↓
从 active tab 的 URL 读取 hostname
    ↓
显示该网站的账号列表 ✓
```

## 修改的文件

| 文件 | 改动 | 影响 |
|------|------|------|
| `content.js` | 重写 `openPasswordManager()` | 现在能打开管理界面 |
| `popup/popup.js` | 添加 URL 参数处理 | 支持从面板快速打开 |

## 测试步骤

```
1. 重新加载扩展

2. 访问有保存账号的网站登录页

3. 点击密码框 → 面板弹出

4. 点击"管理密码..."
   ↓
5. ✅ 验证：
   - 打开新标签页
   - popup 显示 "当前网站: 网站名"
   - 显示该网站的所有账号 ✓
   - 可以增删改查 ✓

6. 返回登录页，面板已自动关闭 ✓

7. 点击扩展图标打开 popup（原有方式）
   ↓
8. ✅ 验证：
   - popup 正常弹出
   - 显示当前 active tab 的网站账号 ✓
   - 功能完整 ✓
```

## 优势

✅ **无需修改 manifest.json** - 不需要新增权限  
✅ **无需修改 background.js** - 不需要消息处理器  
✅ **支持双向打开** - 从面板打开 + 从扩展图标打开都能正确显示  
✅ **URL 参数安全** - 使用 `encodeURIComponent()` 防止注入  
✅ **向后兼容** - 旧方式（扩展图标）仍然完全工作  

## 技术细节

### 为什么要传递 hostname？

如果直接打开 `/popup.html` 而不传递参数：
- popup 会尝试获取 active tab 的 URL
- 但 active tab 此时是 popup 自己（`chrome-extension://...`）
- hostname 会变成 `chrome-extension:...`（不对）
- 显示错误的网站或无法找到账号

传递 `?hostname=` 参数后：
- popup 优先读取参数中的 hostname
- 显示正确的网站账号 ✓

### 为什么要关闭面板？

`closePasswordModal()` 能立即关闭密码面板，让用户专注于新打开的管理界面。

---

✨ **现在点击"管理密码..."就能成功打开管理界面了！**
