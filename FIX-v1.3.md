# 🐛 修复：面板填充后自动关闭

## 问题现象

✗ 填充账号密码后，面板仍停留在页面上，挡住登录按钮，影响后续操作

## 根本原因

填充后面板重复打开的双重原因：

1. **`fillInput()` 派发了 `focus` 事件**
   ```javascript
   el.dispatchEvent(new Event('focus', { bubbles: true }));  // ❌
   ```
   - 事件冒泡到输入框
   - 触发 `focus` 事件监听器
   - 监听器再次调用 `showPasswordModal()`
   - 面板重新打开 💥

2. **点击后调用了 `.focus()`**
   ```javascript
   closePasswordModal();
   (passwordInput || inputEl).focus();  // ❌ 又触发一遍
   ```

## 修复方案

### 1. 移除不必要的 `focus` 事件派发

```javascript
// ❌ 旧代码
function fillInput(el, value) {
  nativeInputSetter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  el.dispatchEvent(new Event('focus', { bubbles: true }));  // 移除这行
}

// ✅ 新代码
function fillInput(el, value) {
  nativeInputSetter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  // ✓ 去掉 focus，input + change + blur 已足够 React/Vue 识别
}
```

**为什么 `input` + `change` 就够了？**
- `input` - React/Vue 监听此事件更新受控组件
- `change` - 表单框架用于数据同步
- `blur` - 用于字段验证
- `focus` - 不需要，移除它能避免重复打开面板

### 2. 移除点击后的 `.focus()` 调用

```javascript
// ❌ 旧代码
accountItem.addEventListener('click', () => {
  // ... 填充逻辑 ...
  closePasswordModal();
  (passwordInput || inputEl).focus();  // 移除
});

// ✅ 新代码
accountItem.addEventListener('click', () => {
  // ... 填充逻辑 ...
  closePasswordModal();  // 直接关闭，不要聚焦
});
```

**为什么不需要 focus？**
- 用户点击账号后，面板关闭
- 用户自然看到填充的表单
- 用户自然点击登录按钮或按 Enter
- 无需强制 focus

## 修改的文件

**content.js**
- 第 8-19 行：移除 `fillInput()` 中的 `focus` 事件派发
- 第 64-84 行：移除点击后的 `.focus()` 调用

## 效果对比

### 修复前
```
用户点击账号
    ↓
面板关闭
    ↓
.focus() 触发 focus 事件
    ↓
showPasswordModal() 再次打开 🔄
    ↓
面板卡在页面上 ❌
```

### 修复后
```
用户点击账号
    ↓
面板关闭 ✓
    ↓
不触发 focus 事件 ✓
    ↓
面板保持关闭 ✓
```

## 测试步骤

```
1. 重新加载扩展 (Chrome → 扩展程序 → 刷新)

2. 访问登录页面

3. 点击用户名或密码框
   ↓
4. 面板弹出，点击账号
   ↓
5. ✅ 验证：
   - 面板立即关闭 ✓
   - 账号密码已填充 ✓
   - 可以正常点击登录按钮 ✓
   - 面板不会再出现 ✓
```

## 技术细节

### 为什么 `blur` 要保留？
```javascript
el.dispatchEvent(new Event('blur', { bubbles: true }));
```
- 表单框架用 `blur` 触发验证（如：检查字段是否有效）
- 保留 `blur` 确保表单验证正确运行
- 不会导致面板重新打开（面板已关闭）

### 事件顺序
填充完整流程的事件顺序（修复后）：
```
fillInput()
  ├─ 调用原生 setter
  ├─ dispatch 'input'     ← 框架识别值变化
  ├─ dispatch 'change'    ← 数据同步
  └─ dispatch 'blur'      ← 验证字段
  
关键：没有 'focus' 事件，所以不会重新打开面板 ✓
```

---

## 总结

**问题**：面板填充后仍显示，影响操作  
**原因**：dispatch focus 事件 + .focus() 调用  
**修复**：移除两处触发 focus 的代码  
**结果**：面板填充后立即消失，用户可正常操作 ✓

现在体验丝滑的自动填充！🎉
