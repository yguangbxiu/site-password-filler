# 站点密码填充器 · Site Password Filler

Chrome 浏览器扩展（Manifest V3），按**精确站点标识**匹配并自动填充账号密码，避免不同环境（如 `prev-` / `prod-`）之间的账号混淆。

> **版本**：1.0.0 · **许可**：MIT  
> **名称**：站点密码填充器（中文） / Site Password Filler（英文）

---

## 目录

- [功能概览](#功能概览)
- [快速安装（用户）](#快速安装用户)
- [使用指南](#使用指南)
- [屏蔽规则](#屏蔽规则)
- [导入与导出](#导入与导出)
- [开发者指南](#开发者指南)
- [项目结构](#项目结构)
- [数据存储](#数据存储)
- [技术说明](#技术说明)
- [安全建议](#安全建议)
- [故障排除](#故障排除)
- [版本演进](#版本演进)
- [相关文档](#相关文档)

---

## 功能概览

| 功能 | 说明 |
|------|------|
| 精确站点匹配 | 按完整 hostname 区分网站，不按二级域名合并；支持 IP 地址及带端口访问（如 `192.168.1.1:8080`） |
| 智能表单检测 | 自动识别登录页的用户名框与密码框，支持无 `<form>` 标签的 SPA 页面 |
| 聚焦即填充 | 聚焦密码框或登录表单中的用户名框时，弹出已保存账号列表，一键填入 |
| 快速添加 | 当前站点无保存账号时，在页面内直接填写并保存，自动预填页面上已输入的用户名/密码 |
| 密码管理 | Popup 中增删改查、复制密码、复制为新账号（跨站点副本） |
| 搜索与批量操作 | 「全部密码」支持按站点/用户名/密码/标签搜索，以及全选、反选、批量删除 |
| 导入 / 导出 | 导出完整 JSON 备份；导入 JSON 备份或 Chrome 密码管理器 CSV，合并写入本地数据 |
| 屏蔽规则 | 可按整站或页面路径屏蔽自动填充，适合非登录页误触发场景 |
| 框架兼容 | 通过原生 setter + 事件触发，兼容 React / Vue 等现代框架 |
| SPA 支持 | `MutationObserver` + `history` 监听，适配动态加载与前端路由切换 |
| 多语言 | 扩展名称与描述支持中文（默认）/ 英文（`_locales`） |

### 填充面板 UI

聚焦登录输入框后弹出的面板包含：

- **账号列表**：首字母彩色图标、用户名、可选标签、密码掩码（`•••`）
- **快速添加表单**（无账号时）：预填页面已有输入，支持标签，保存后自动刷新为账号列表
- **底部操作**：「管理密码…」在新标签页打开管理界面并定位当前站点
- **快捷屏蔽**：「屏蔽此页面」「屏蔽整个网站」

填充完成后面板**立即关闭**，不会遮挡登录按钮；点击外部区域也会关闭，并短暂抑制重新弹出。

---

## 快速安装（用户）

### 方式一：加载源码（推荐）

1. 获取项目文件夹（解压 ZIP 或克隆仓库）
2. 若 `icons/` 目录缺少图标，在项目根目录执行：
   ```bash
   npm install
   npm run generate-icons
   ```
3. 打开 Chrome，访问 `chrome://extensions/`
4. 开启右上角 **开发者模式**
5. 点击 **加载未打包的扩展程序**，选择本项目目录
6. 扩展列表出现「站点密码填充器」（英文界面下为 **Site Password Filler**）即安装成功

### 方式二：安装 CRX 文件

1. 打开 `chrome://extensions/`，开启 **开发者模式**
2. 将 `dist/chrome-password-filler.crx` 拖拽到页面中
3. 确认安装

更详细的安装说明见 [INSTALLATION.md](./INSTALLATION.md)。

---

## 使用指南

### 登录时自动填充

1. 打开任意网站的登录页
2. 点击**密码输入框**，或点击登录表单中的**用户名输入框**
3. 弹出账号列表面板 → 选择一条记录
4. 用户名和密码自动填入对应输入框，手动点击登录即可

**说明**：无论从用户名框还是密码框触发，都会分别查找并填充用户名框与密码框；即使页面上没有 `<form>` 标签（常见于 React / Vue SPA），也能通过多级 DOM 查找定位密码框。

若当前站点尚未保存账号，面板会显示**快速添加**表单：

- 自动读取页面上已输入的用户名和密码并预填
- 可填写可选标签（如「测试账号」「生产账号」）
- 点击「保存账号」后，面板刷新并显示刚保存的记录，可立即点击填充登录

面板底部还提供：

- **管理密码…** — 在新标签页打开管理界面，定位到当前站点
- **屏蔽此页面 / 屏蔽整个网站** — 快捷添加屏蔽规则

### 在 Popup 中管理密码

点击浏览器工具栏中的扩展图标，打开管理界面，包含三个标签页：

#### 当前网站

- 显示当前标签页的站点标识（siteKey）与页面路径
- 若已屏蔽，显示对应提示横幅，并提供「取消整站屏蔽」或「取消页面屏蔽」
- 未屏蔽时，可快捷「屏蔽当前页面」「屏蔽当前路径及子页面」「屏蔽整个网站」
- 添加、编辑、删除该站点的账号（已有账号时隐藏添加表单，通过编辑/副本操作管理）
- 每条记录支持：复制密码、复制到新站点（副本）、编辑、删除

#### 全部密码

- 跨站点查看所有已保存账号
- **搜索**：按站点、用户名、密码或标签过滤
- **批量操作**：全选、反选、删除选中
- **导入 / 导出**：见 [导入与导出](#导入与导出)
- 每条记录支持：复制密码、复制到新站点、编辑、删除

编辑 / 复制模态框支持切换密码可见性（👁️ 按钮）。

#### 屏蔽规则

- **整站屏蔽**：指定域名后，该站点所有页面均不弹出填充面板
- **页面路径屏蔽**：仅屏蔽特定路径（如 `/system/model/index`），可勾选「同时屏蔽子路径」
- 整站屏蔽优先级高于页面屏蔽

### 复制到新站点（跨环境）

适用于将同一套账号从 `prev-` 复制到 `prod-` 等场景：

1. 在「全部密码」或「当前网站」中点击某条记录的 **副本**
2. 在弹窗中修改目标站点（如 `prod-platform.example.com`）
3. 确认用户名、密码、标签后保存

原站点记录不变，会在目标站点新建一条账号。

---

## 屏蔽规则

适用于以下场景：

- 后台管理页等非登录页也有输入框，误触发填充面板
- 同一域名下，只希望登录页启用填充，其他页面禁用

**规则类型：**

| 类型 | 示例 | 效果 |
|------|------|------|
| 整站屏蔽 | `example.com` | 该域名下所有页面均不弹出面板 |
| 精确路径 | `example.com` + `/admin/dashboard` | 仅该路径不弹出，登录页 `/login` 仍可用 |
| 路径前缀 | `example.com` + `/admin`（含子路径） | `/admin` 及 `/admin/...` 均不弹出 |

可在填充面板的底部快捷添加，也可在 Popup 的「当前网站」或「屏蔽规则」标签页统一管理。

---

## 导入与导出

在 Popup 的「全部密码」标签页顶部操作。

### 导出

点击 **导出**，下载 JSON 备份文件，文件名格式为 `site-password-filler-backup-YYYY-MM-DD.json`。

备份内容包括：

- 全部账号（`passwords`）
- 整站屏蔽列表（`blockedHosts`）
- 页面路径屏蔽规则（`blockedPathRules`）
- 格式标识 `format: "site-password-filler-export"` 与导出时间

### 导入

点击 **导入**，选择以下任一格式：

| 格式 | 说明 |
|------|------|
| 本扩展导出的 JSON | 完整恢复账号与屏蔽规则 |
| Chrome 密码管理器 CSV | 需包含 `url`、`username`、`password` 列；可选 `name`、`note` 列；按 URL 解析 siteKey，`note` 映射为标签 |
| 仅含 `passwords` 的 JSON | 兼容旧格式，仅导入账号 |

导入为**合并模式**：

- 相同站点 + 相同用户名的账号会被**覆盖**
- 屏蔽规则按 hostname + path + matchType 去重合并
- 完成后显示统计：新增/覆盖/跳过的账号数，以及屏蔽规则变更数

> 备份文件含**明文密码**，请妥善保管，勿上传到公共位置或分享给他人。

---

## 开发者指南

### 环境要求

- Google Chrome（或 Chromium 内核浏览器）
- Node.js（用于生成图标与打包，可选）

### 本地开发

```bash
# 安装依赖
npm install

# 生成占位图标（若 icons/ 为空）
npm run generate-icons
```

然后在 `chrome://extensions/` 中加载本项目目录。修改代码后，在扩展卡片上点击 **刷新** 按钮，并**刷新目标网页**使 Content Script 生效。

### 打包分发

```bash
# 生成 CRX（需 OpenSSL）及 ZIP 源码包
node pack.js
```

产出文件：

| 文件 | 说明 |
|------|------|
| `dist/chrome-password-filler.crx` | 已签名扩展，用户可拖拽安装 |
| `dist/chrome-password-filler.zip` | 源码 ZIP 包 |
| `keys/private.pem` | 签名私钥，**仅维护者保管，勿提交或分享** |

分发流程详见 [DISTRIBUTION.md](./DISTRIBUTION.md)。

### 消息 API（background.js）

Content Script 与 Popup 通过 `chrome.runtime.sendMessage` 与 Service Worker 通信：

| action | 说明 |
|--------|------|
| `getPasswords` | 获取指定站点的账号列表 |
| `savePassword` | 新增账号（插入列表头部） |
| `editPassword` | 编辑已有账号 |
| `deletePassword` | 删除单条账号 |
| `deletePasswordsBatch` | 批量删除（`items: [{ hostname, id }]`） |
| `getAllPasswords` | 获取全部站点的账号 |
| `openPasswordManager` | 在新标签页打开 Popup 并定位站点（`?hostname=`） |
| `exportData` | 导出完整 JSON 备份 |
| `importData` | 合并导入 JSON / 解析后的 CSV 数据 |
| `isHostBlocked` / `isPageBlocked` | 查询屏蔽状态（`isPageBlocked` 返回 `hostBlocked` / `pathBlocked`） |
| `getBlockedHosts` / `addBlockedHost` / `removeBlockedHost` | 整站屏蔽管理 |
| `getBlockedPathRules` / `addBlockedPathRule` / `removeBlockedPathRule` | 页面路径屏蔽管理 |

### 站点标识（site-key.js）

密码与屏蔽规则均以 **siteKey** 为索引，规则如下：

- 域名：取 `hostname`，小写，去掉 `www.` 前缀
- IP 地址：若 URL 含端口，则 siteKey 为 `host:port`（IPv6 格式为 `[addr]:port`）
- 示例：
  - `https://prev-platform.example.com/login` → `prev-platform.example.com`
  - `https://prod-platform.example.com/login` → `prod-platform.example.com`（与 prev 不同 key）
  - `http://192.168.1.1:8080/` → `192.168.1.1:8080`

---

## 项目结构

```
site-password-filler/
├── manifest.json          # 扩展配置（Manifest V3，含 i18n 名称）
├── _locales/              # 多语言：zh_CN / en
│   ├── zh_CN/messages.json
│   └── en/messages.json
├── background.js          # Service Worker：存储、导入合并、消息处理
├── site-key.js            # 站点标识归一化（Content / Background / Popup 共用）
├── import-parse.js        # CSV / Chrome 密码导出文件解析
├── content.js             # 内容脚本：表单检测、填充面板、快速添加、屏蔽快捷入口
├── content.css            # 页面内填充面板样式
├── popup/
│   ├── popup.html         # 管理界面
│   ├── popup.js           # 管理逻辑（搜索、批量删除、导入导出等）
│   └── popup.css          # Popup 样式
├── icons/                 # 扩展图标（16 / 48 / 128 px）
├── generate-icons.js      # 图标生成脚本
├── pack.js                # CRX + ZIP 打包脚本
├── package.json
├── README.md              # 本文件
├── INSTALLATION.md        # 用户安装指南
└── DISTRIBUTION.md        # 维护者分发指南
```

---

## 数据存储

所有数据保存在 `chrome.storage.local`，共三类：

### passwords

```json
{
  "passwords": {
    "prev-platform.example.com": [
      {
        "id": "1710000000000-abc123",
        "username": "admin",
        "password": "test-password",
        "label": "测试账号"
      }
    ],
    "prod-platform.example.com": [
      {
        "id": "1710000000001-def456",
        "username": "admin",
        "password": "prod-password",
        "label": "生产账号"
      }
    ]
  }
}
```

### blockedHosts（整站屏蔽）

```json
{
  "blockedHosts": ["internal-tool.example.com"]
}
```

### blockedPathRules（页面路径屏蔽）

```json
{
  "blockedPathRules": [
    {
      "id": "1710000000002",
      "hostname": "dev-upms.example.com",
      "path": "/system/model/index",
      "matchType": "exact"
    },
    {
      "id": "1710000000003",
      "hostname": "dev-upms.example.com",
      "path": "/admin",
      "matchType": "prefix"
    }
  ]
}
```

### 导出格式

```json
{
  "format": "site-password-filler-export",
  "version": 1,
  "exportedAt": "2026-07-05T08:00:00.000Z",
  "passwords": { },
  "blockedHosts": [],
  "blockedPathRules": []
}
```

> 密码以明文存储在本地浏览器中，详见[安全建议](#安全建议)。

---

## 技术说明

### 框架兼容的输入填充

通过调用原生 `HTMLInputElement` 的 `value` setter，并派发 `input` / `change` / `blur` 事件，确保 React、Vue 等框架能感知到值变化。**不派发 `focus` 事件**，避免填充后面板被重新打开：

```javascript
const nativeInputSetter = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype, 'value'
).set;
nativeInputSetter.call(el, value);
el.dispatchEvent(new Event('input', { bubbles: true }));
el.dispatchEvent(new Event('change', { bubbles: true }));
el.dispatchEvent(new Event('blur', { bubbles: true }));
```

### 用户名 / 密码框查找

填充时分别定位两个输入框，而非依赖触发源：

| 函数 | 策略 |
|------|------|
| `findUsernameInput` | 同 form 内 `email` / `text` / `tel` 输入框；无 form 时向前查找兄弟节点 |
| `findPasswordInput` | 触发框本身 → 同 form 内 → 父元素逐级向上 → 全文档兜底 |

### 面板关闭与防重开

- 填充或用户主动关闭时，调用 `closePasswordModal({ suppressReopen: true })`
- 关闭前对面板内焦点元素 `blur`，并对页面输入框 `blur`，避免焦点回弹触发 `focus` 监听器
- 快速添加面板手动关闭后，30 秒内不再自动弹出（`QUICK_ADD_DISMISS_MS`）
- 异步加载账号时使用 `modalSessionId` 忽略过期回调，防止竞态重开

### 动态页面检测

- `MutationObserver` 监听 DOM 变化，捕获 SPA 动态插入的登录表单
- 拦截 `history.pushState` / `replaceState` 及 `popstate`，在路由切换时更新路径屏蔽状态
- 监听 `chrome.storage.onChanged`，屏蔽规则变更后实时刷新页面屏蔽状态

### 权限说明

| 权限 | 用途 |
|------|------|
| `storage` | 读写本地密码与屏蔽规则 |
| `activeTab` | Popup 获取当前标签页 URL |
| `<all_urls>`（content_scripts） | 在所有页面注入填充脚本 |

---

## 安全建议

> 本扩展面向**个人开发 / 测试环境**的便捷填充，**不是**企业级密码管理器。

- 密码存储在本地浏览器中，未做端到端加密
- 导出 / 导入的 JSON 与 CSV 文件含明文密码，请本地加密保管
- **不要**存储银行、支付等高敏感账号
- 仅在受信任的个人设备上使用
- 不再使用的站点请及时删除账号记录
- 如需团队级密码管理，建议使用 Bitwarden、1Password 等专业工具

---

## 故障排除

| 问题 | 处理方式 |
|------|----------|
| 扩展图标不显示 | 确认 `icons/` 下存在 `icon16.png`、`icon48.png`、`icon128.png`；运行 `npm run generate-icons` 后重新加载扩展 |
| 登录页不弹出填充面板 | 刷新页面；检查该站点或路径是否已被屏蔽；F12 查看 Console 是否有报错 |
| 只填充了用户名，密码为空 | 多见于无 `<form>` 的 SPA；确认已更新到最新版本（含多级 `findPasswordInput` 查找） |
| 填充后面板不关闭 | 确认已更新到最新版本（已移除填充时的 `focus` 派发与 `.focus()` 调用） |
| 点击「管理密码…」无反应 | 确认已更新到最新版本（通过 `openPasswordManager` 在新标签页打开） |
| 填充后表单无反应 | 部分站点使用特殊表单库，尝试 Tab 切换焦点或手动点击登录按钮 |
| 修改代码后不生效 | 在 `chrome://extensions/` 刷新扩展，并刷新目标网页 |
| 导入 CSV 失败 | 确认 CSV 来自 Chrome 密码管理器导出，且包含 `url`、`username`、`password` 列 |
| CSP 限制 | 少数站点的内容安全策略可能限制内联脚本，本扩展以外部 Content Script 注入，一般不受影响 |

---

## 版本演进

以下为 README 初版（1.0.0）之后的主要功能与修复，详细说明见对应文档：

| 版本 | 主题 | 要点 |
|------|------|------|
| v1.1 | UI 升级 | 账号图标、标签、密码掩码、底部操作栏、双输入框触发 |
| v1.2 | 填充逻辑 | 点击账号时分别查找并填充用户名框与密码框 |
| v1.3 | 面板交互 | 填充后自动关闭，移除 `focus` 事件避免面板重开 |
| v1.4 | SPA 适配 | 多级递进查找密码框，支持无 `<form>` 的 React / Vue 页面 |
| v1.5 | 快速添加 | 空状态展示内联表单，预填页面已有输入，保存后刷新列表 |
| v1.6 | 管理入口 | 「管理密码…」通过新标签页打开 Popup，URL 传递 `hostname` 参数 |
| — | 数据管理 | 导入 / 导出 JSON、Chrome CSV 合并导入、搜索、批量删除、跨站点副本 |

---

## 相关文档

| 文档 | 面向对象 | 内容 |
|------|----------|------|
| [INSTALLATION.md](./INSTALLATION.md) | 用户 | 详细安装步骤、更新方法、常见问题 |
| [DISTRIBUTION.md](./DISTRIBUTION.md) | 维护者 | CRX / ZIP 分发、签名密钥管理、版本发布流程 |
| [UPGRADE-v1.1.md](./UPGRADE-v1.1.md) | 开发者 | UI 面板升级说明 |
| [FEATURE-v1.5.md](./FEATURE-v1.5.md) | 开发者 | 快速添加功能详解 |
| [FIX-v1.2.md](./FIX-v1.2.md) ~ [FIX-v1.6.md](./FIX-v1.6.md) | 开发者 | 各版本填充与交互修复说明 |

---

## 后续规划

- 主密码加密存储
- 云端同步与备份
- 标签分组管理
- 自定义 URL 匹配规则（正则）
- 快捷键快速打开填充面板

---

## 反馈

如有问题或建议，欢迎提交 Issue 或 Pull Request。
