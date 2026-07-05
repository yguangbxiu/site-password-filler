// Content Script - 注入到页面，检测登录表单并提供密码填充功能

let siteKey = '';
try {
  siteKey = getSiteKeyFromUrl(window.location.href);
} catch {
  siteKey = '';
}
let pathname = window.location.pathname;
let passwordModal = null;
let activeInputEl = null;  // 当前活跃的输入框
let isModalOpen = false;
let suppressModalUntil = 0;  // 用户主动关闭后短暂禁止重新打开
const QUICK_ADD_DISMISS_MS = 30 * 1000;  // 快速添加面板点击关闭后禁止重新打开
let modalOutsideClickHandler = null;
let isPageBlocked = false;
let modalSessionId = 0;  // 忽略用户关闭后仍返回的异步回调

// 触发框架响应的输入框填充方法
function fillInput(el, value) {
  const nativeInputSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  ).set;

  nativeInputSetter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
}

// 关闭密码选择面板；suppressReopen 用于用户点击关闭/外部区域，避免焦点回到输入框后立即重开
function closePasswordModal({ suppressReopen = false, suppressDuration = 400 } = {}) {
  // 必须先于 remove()：移除含焦点的节点时浏览器会同步把焦点还给页面输入框，触发 focus 重开面板
  if (suppressReopen) {
    suppressModalUntil = Date.now() + suppressDuration;
    modalSessionId += 1;
  }
  if (passwordModal) {
    const active = document.activeElement;
    if (active && passwordModal.contains(active)) {
      active.blur();
    }
    passwordModal.remove();
    passwordModal = null;
    isModalOpen = false;
  }
  // 关闭后焦点会回到页面输入框并再次触发 focus；主动 blur 比仅靠时间窗口更可靠
  if (suppressReopen && activeInputEl && document.contains(activeInputEl)) {
    activeInputEl.blur();
  }
  if (modalOutsideClickHandler) {
    document.removeEventListener('click', modalOutsideClickHandler);
    modalOutsideClickHandler = null;
  }
}

function canOpenPasswordModal() {
  return Date.now() >= suppressModalUntil;
}

function attachOutsideClickClose() {
  if (modalOutsideClickHandler) {
    document.removeEventListener('click', modalOutsideClickHandler);
  }
  modalOutsideClickHandler = (e) => {
    if (
      passwordModal &&
      !passwordModal.contains(e.target) &&
      e.target !== activeInputEl &&
      !activeInputEl?.contains(e.target)
    ) {
      closePasswordModal({ suppressReopen: true });
    }
  };
  setTimeout(() => {
    document.addEventListener('click', modalOutsideClickHandler);
  }, 0);
}

function refreshPageBlockStatus(callback) {
  chrome.runtime.sendMessage(
    { action: 'isPageBlocked', hostname: siteKey, pathname },
    (response) => {
      isPageBlocked = !!(response && response.blocked);
      if (typeof callback === 'function') callback();
    }
  );
}

function blockCurrentSite() {
  chrome.runtime.sendMessage({ action: 'addBlockedHost', hostname: siteKey }, () => {
    isPageBlocked = true;
    closePasswordModal({ suppressReopen: true });
  });
}

function blockCurrentPage(matchType) {
  chrome.runtime.sendMessage(
    {
      action: 'addBlockedPathRule',
      hostname: siteKey,
      path: pathname,
      matchType
    },
    () => {
      isPageBlocked = true;
      closePasswordModal({ suppressReopen: true });
    }
  );
}

function appendBlockFooters(modalEl) {
  const pageFooter = document.createElement('div');
  pageFooter.className = 'pw-filler-footer pw-filler-footer-block';
  pageFooter.innerHTML = '<span class="pw-filler-footer-block-icon">🚫</span><span>屏蔽此页面</span>';
  pageFooter.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`仅屏蔽当前页面 ${siteKey}${pathname}？\n登录页等其它页面仍可填充。`)) {
      blockCurrentPage('exact');
    }
  });
  modalEl.appendChild(pageFooter);

  const siteFooter = document.createElement('div');
  siteFooter.className = 'pw-filler-footer pw-filler-footer-block';
  siteFooter.innerHTML = '<span class="pw-filler-footer-block-icon">⛔</span><span>屏蔽整个网站</span>';
  siteFooter.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`确定屏蔽 ${siteKey}？\n该网站所有页面都不会弹出密码填充面板。`)) {
      blockCurrentSite();
    }
  });
  modalEl.appendChild(siteFooter);
}

// 显示密码选择面板
function showPasswordModal(inputEl) {
  if (isPageBlocked) return;

  activeInputEl = inputEl;
  closePasswordModal();
  const sessionId = ++modalSessionId;

  chrome.runtime.sendMessage(
    { action: 'getPasswords', hostname: siteKey },
    (response) => {
      if (sessionId !== modalSessionId) return;
      if (!response || !response.success || response.data.length === 0) {
        showPasswordModal_Empty(inputEl, sessionId);
        return;
      }

      // 创建模态框容器
      passwordModal = document.createElement('div');
      passwordModal.className = 'pw-filler-modal';

      // 创建账号列表
      response.data.forEach((item) => {
        const accountItem = document.createElement('div');
        accountItem.className = 'pw-filler-account-item';

        // 生成首字母图标
        const firstChar = item.username.charAt(0).toUpperCase();

        accountItem.innerHTML = `
          <div class="pw-filler-account-icon">${firstChar}</div>
          <div class="pw-filler-account-info">
            <div class="pw-filler-account-username">${escapeHtml(item.username)}</div>
            ${item.label ? `<div class="pw-filler-account-label">${escapeHtml(item.label)}</div>` : ''}
          </div>
          <div class="pw-filler-account-mask">•••</div>
        `;

        accountItem.addEventListener('click', () => {
          // 找到用户名和密码框
          const usernameInput = findUsernameInput(inputEl);
          const passwordInput = findPasswordInput(inputEl);

          // 填充用户名
          if (usernameInput) {
            fillInput(usernameInput, item.username);
          }

          // 填充密码
          if (passwordInput) {
            fillInput(passwordInput, item.password);
          }

          // 关闭面板（不要立即 focus，避免重新打开）
          closePasswordModal({ suppressReopen: true });
        });

        passwordModal.appendChild(accountItem);
      });

      // 创建底部操作栏
      const footer = document.createElement('div');
      footer.className = 'pw-filler-footer';
      footer.innerHTML = `
        <div class="pw-filler-footer-text">
          <span class="pw-filler-footer-icon">⚙️</span>
          <span>管理密码...</span>
        </div>
        <div class="pw-filler-footer-key">🔑</div>
      `;

      footer.addEventListener('click', (e) => {
        e.stopPropagation();
        openPasswordManager();
      });

      passwordModal.appendChild(footer);
      appendBlockFooters(passwordModal);

      if (sessionId !== modalSessionId) return;

      // 定位面板
      positionModal(inputEl);
      document.body.appendChild(passwordModal);
      isModalOpen = true;

      attachOutsideClickClose();
    }
  );
}

// 显示空状态 - 快速添加表单
function showPasswordModal_Empty(inputEl, sessionId = modalSessionId) {
  if (sessionId !== modalSessionId) return;

  const modalEl = document.createElement('div');
  modalEl.className = 'pw-filler-modal';

  // 获取页面上已输入的用户名和密码值
  const usernameInput = findUsernameInput(inputEl);
  const passwordInput = findPasswordInput(inputEl);
  const pageUsername = usernameInput?.value || '';
  const pagePassword = passwordInput?.value || '';

  // 创建快速添加表单容器
  const quickAdd = document.createElement('div');
  quickAdd.className = 'pw-filler-quick-add';

  // 标题
  const title = document.createElement('div');
  title.className = 'pw-filler-quick-add-title';

  const titleText = document.createElement('span');
  titleText.className = 'pw-filler-quick-add-title-text';
  titleText.innerHTML = '<span class="pw-filler-quick-add-title-icon">➕</span>快速添加账号';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'pw-filler-quick-add-close';
  closeBtn.setAttribute('aria-label', '关闭');
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
  });
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closePasswordModal({ suppressReopen: true, suppressDuration: QUICK_ADD_DISMISS_MS });
  });

  title.appendChild(titleText);
  title.appendChild(closeBtn);

  // 表单
  const form = document.createElement('div');
  form.className = 'pw-filler-quick-add-form';

  // 用户名字段
  const usernameField = document.createElement('div');
  usernameField.className = 'pw-filler-quick-add-field';
  const usernameLabel = document.createElement('label');
  usernameLabel.className = 'pw-filler-quick-add-label';
  usernameLabel.textContent = '用户名';
  const usernameInputEl = document.createElement('input');
  usernameInputEl.type = 'text';
  usernameInputEl.placeholder = '输入用户名';
  usernameInputEl.value = pageUsername;
  usernameInputEl._pwFillerListened = true;  // 防止重复监听
  usernameField.appendChild(usernameLabel);
  usernameField.appendChild(usernameInputEl);

  // 密码字段
  const passwordField = document.createElement('div');
  passwordField.className = 'pw-filler-quick-add-field';
  const passwordLabel = document.createElement('label');
  passwordLabel.className = 'pw-filler-quick-add-label';
  passwordLabel.textContent = '密码';
  const passwordInputEl = document.createElement('input');
  passwordInputEl.type = 'text';  // 用 text 显示，避免触发密码检测
  passwordInputEl.placeholder = '输入密码';
  passwordInputEl.value = pagePassword;
  passwordInputEl._pwFillerListened = true;
  passwordField.appendChild(passwordLabel);
  passwordField.appendChild(passwordInputEl);

  // 标签字段（可选）
  const labelField = document.createElement('div');
  labelField.className = 'pw-filler-quick-add-field';
  const labelLabel = document.createElement('label');
  labelLabel.className = 'pw-filler-quick-add-label';
  labelLabel.textContent = '标签（可选）';
  const labelInputEl = document.createElement('input');
  labelInputEl.type = 'text';
  labelInputEl.placeholder = '如：测试账号、生产账号';
  labelInputEl._pwFillerListened = true;
  labelField.appendChild(labelLabel);
  labelField.appendChild(labelInputEl);

  // 保存按钮
  const saveBtn = document.createElement('button');
  saveBtn.className = 'pw-filler-quick-add-btn';
  saveBtn.textContent = '💾 保存账号';
  saveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const username = usernameInputEl.value.trim();
    const pwd = passwordInputEl.value.trim();
    const label = labelInputEl.value.trim();

    if (!username || !pwd) {
      alert('用户名和密码不能为空');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';

    // 保存到存储
    chrome.runtime.sendMessage(
      {
        action: 'savePassword',
        hostname: siteKey,
        username,
        password: pwd,
        label
      },
      (response) => {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 保存账号';

        if (response && response.success) {
          // 保存成功，关闭空状态面板，重新打开以显示刚添加的账号
          closePasswordModal();
          showPasswordModal(inputEl);
        } else {
          alert('保存失败，请重试');
        }
      }
    );
  });

  // 组装表单
  form.appendChild(usernameField);
  form.appendChild(passwordField);
  form.appendChild(labelField);
  form.appendChild(saveBtn);

  quickAdd.appendChild(title);
  quickAdd.appendChild(form);
  modalEl.appendChild(quickAdd);
  appendBlockFooters(modalEl);

  // 防止面板内的 input 点击冒泡触发关闭
  modalEl.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  if (sessionId !== modalSessionId) return;

  passwordModal = modalEl;
  positionModal(inputEl);
  document.body.appendChild(passwordModal);
  isModalOpen = true;

  attachOutsideClickClose();
}

// 定位面板到输入框下方
function positionModal(inputEl) {
  if (!passwordModal) return;

  const rect = inputEl.getBoundingClientRect();
  const scrollTop = window.scrollY;
  const scrollLeft = window.scrollX;

  passwordModal.style.position = 'fixed';
  passwordModal.style.top = (rect.bottom + scrollTop) + 'px';
  passwordModal.style.left = (rect.left + scrollLeft) + 'px';
  passwordModal.style.width = rect.width + 'px';
}

// 打开密码管理器（popup）
function openPasswordManager() {
  // 向 background script 发送消息，让它打开 popup
  chrome.runtime.sendMessage(
    { action: 'openPasswordManager', hostname: siteKey },
    (response) => {
      closePasswordModal({ suppressReopen: true });
    }
  );
}

// XSS 防护
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 查找用户名输入框
function findUsernameInput(currentInputEl) {
  const form = currentInputEl.closest('form');
  if (form) {
    return (
      form.querySelector('input[type="email"]') ||
      form.querySelector('input[type="text"]') ||
      form.querySelector('input[type="tel"]')
    );
  }

  let prev = currentInputEl.previousElementSibling;
  while (prev) {
    if (
      prev.tagName === 'INPUT' &&
      ['email', 'text', 'tel'].includes(prev.type)
    ) {
      return prev;
    }
    prev = prev.previousElementSibling;
  }

  return null;
}

// 查找密码输入框（支持无 form 标签的 SPA）
function findPasswordInput(inputEl) {
  // 如果 inputEl 本身就是密码框，直接返回
  if (inputEl.type === 'password') {
    return inputEl;
  }

  // 在 form 中搜索
  const form = inputEl.closest('form');
  if (form) {
    return form.querySelector('input[type="password"]');
  }

  // 没有 form 时，逐级向上遍历父元素，查找包含密码框的容器
  let parent = inputEl.parentElement;
  while (parent && parent !== document.body) {
    const pwInput = parent.querySelector('input[type="password"]');
    if (pwInput) {
      return pwInput;
    }
    parent = parent.parentElement;
  }

  // 最后尝试在整个文档中搜索（针对极端情况）
  return document.querySelector('input[type="password"]');
}

// 检测登录表单并绑定事件
function detectLoginForms() {
  const passwordInputs = document.querySelectorAll('input[type="password"]');
  const textInputs = document.querySelectorAll('input[type="text"], input[type="email"]');

  // 绑定密码框
  passwordInputs.forEach((passwordInputEl) => {
    if (passwordInputEl._pwFillerListened) return;
    passwordInputEl._pwFillerListened = true;

    passwordInputEl.addEventListener('focus', () => {
      if (!canOpenPasswordModal()) return;
      showPasswordModal(passwordInputEl);
    });

    passwordInputEl.addEventListener('blur', () => {
      setTimeout(() => {
        if (isModalOpen && !passwordModal) {
          // modal 已关闭，什么都不做
        }
      }, 50);
    });
  });

  // 绑定用户名框（辅助触发）
  textInputs.forEach((textInputEl) => {
    if (textInputEl._pwFillerListened) return;
    textInputEl._pwFillerListened = true;

    textInputEl.addEventListener('focus', (e) => {
      // 检查是否在登录表单中（有相邻的密码框）
      const form = textInputEl.closest('form');
      let hasPasswordField = false;

      if (form) {
        hasPasswordField = !!form.querySelector('input[type="password"]');
      }

      if (hasPasswordField && canOpenPasswordModal()) {
        showPasswordModal(textInputEl);
      }
    });

    textInputEl.addEventListener('blur', () => {
      setTimeout(() => {
        if (isModalOpen && !passwordModal) {
          // modal 已关闭，什么都不做
        }
      }, 50);
    });
  });
}

function onLocationChange() {
  const nextPath = window.location.pathname;
  if (nextPath === pathname) return;
  pathname = nextPath;
  refreshPageBlockStatus(() => {
    if (isPageBlocked) {
      closePasswordModal({ suppressReopen: true });
    } else {
      detectLoginForms();
    }
  });
}

function watchSpaNavigation() {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    onLocationChange();
  };
  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    onLocationChange();
  };
  window.addEventListener('popstate', onLocationChange);
}

refreshPageBlockStatus(() => {
  if (!isPageBlocked) {
    detectLoginForms();
  }
});

watchSpaNavigation();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (!changes.blockedHosts && !changes.blockedPathRules) return;
  refreshPageBlockStatus(() => {
    if (isPageBlocked) {
      closePasswordModal({ suppressReopen: true });
    } else {
      detectLoginForms();
    }
  });
});

const observer = new MutationObserver(() => {
  if (!isPageBlocked) {
    detectLoginForms();
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});
