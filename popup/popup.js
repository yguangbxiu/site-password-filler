// Popup UI Logic

let currentHostname = '';
let currentPathname = '/';
let currentPathRuleId = null;
let editingItem = null; // 跟踪当前编辑的项
let modalMode = 'edit'; // 模态框模式：'edit' 或 'copy'

// 初始化时隐藏表单，让加载函数决定显示
document.querySelector('.add-form').style.display = 'none';

// 优先从 URL 参数读取 hostname（从密码面板的"管理密码..."打开时）
const params = new URLSearchParams(window.location.search);
const hostnameFromParam = params.get('hostname');

function initCurrentPage(hostname, pathname) {
  currentHostname = hostname;
  currentPathname = pathname || '/';
  document.getElementById('currentHostname').textContent = `当前网站: ${currentHostname}`;
  document.getElementById('currentPathname').textContent = `当前页面: ${currentPathname}`;
  updatePageBlockUI();
  loadCurrentPasswords();
}

if (hostnameFromParam) {
  initCurrentPage(hostnameFromParam, '/');
} else {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    try {
      const url = new URL(tabs[0].url);
      initCurrentPage(getSiteKeyFromUrl(tabs[0].url), url.pathname);
    } catch {
      document.getElementById('currentHostname').textContent = '无法识别当前网站';
      document.getElementById('currentPathname').textContent = '';
      updatePageBlockUI();
    }
  });
}

// 标签页切换
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const tabName = e.target.dataset.tab;

    // 移除活跃状态
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));

    // 添加活跃状态
    e.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');

    if (tabName === 'all') {
      loadAllPasswords();
    }
    if (tabName === 'blocked') {
      loadBlockedHosts();
      loadBlockedPathRules();
      if (currentHostname) {
        document.getElementById('addBlockedHost').value = currentHostname;
        document.getElementById('addBlockedPathHost').value = currentHostname;
        document.getElementById('addBlockedPath').value = currentPathname;
      }
    }
  });
});

function updatePageBlockUI() {
  const siteBanner = document.getElementById('siteBlockBanner');
  const pageBanner = document.getElementById('pageBlockBanner');
  const actions = document.getElementById('siteBlockActions');

  if (!currentHostname) {
    siteBanner.classList.add('hidden');
    pageBanner.classList.add('hidden');
    actions.classList.add('hidden');
    return;
  }

  chrome.runtime.sendMessage(
    { action: 'isPageBlocked', hostname: currentHostname, pathname: currentPathname },
    (response) => {
      const hostBlocked = !!(response && response.hostBlocked);
      const pathBlocked = !!(response && response.pathBlocked);
      currentPathRuleId = null;

      siteBanner.classList.toggle('hidden', !hostBlocked);
      pageBanner.classList.toggle('hidden', !pathBlocked || hostBlocked);
      actions.classList.toggle('hidden', hostBlocked || pathBlocked);

      if (pathBlocked && !hostBlocked) {
        chrome.runtime.sendMessage({ action: 'getBlockedPathRules' }, (rulesResponse) => {
          const rules = (rulesResponse && rulesResponse.data) || [];
          const normalizedHost = normalizeSiteKey(currentHostname);
          const normPath = currentPathname.replace(/\/$/, '') || '/';
          const matched = rules.find((rule) => {
            if (rule.hostname !== normalizedHost) return false;
            const rulePath = rule.path.replace(/\/$/, '') || '/';
            if (rule.matchType === 'prefix') {
              return normPath === rulePath || normPath.startsWith(`${rulePath}/`);
            }
            return normPath === rulePath;
          });
          currentPathRuleId = matched ? matched.id : null;
        });
      }
    }
  );
}

function loadBlockedPathRules() {
  chrome.runtime.sendMessage({ action: 'getBlockedPathRules' }, (response) => {
    const list = document.getElementById('blockedPathList');
    list.innerHTML = '';
    const rules = (response && response.data) || [];

    if (rules.length === 0) {
      list.innerHTML = '<p class="empty-message">暂无页面路径屏蔽</p>';
      return;
    }

    rules.forEach((rule) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'blocked-host-item';

      const nameEl = document.createElement('span');
      nameEl.className = 'blocked-host-name';
      const matchLabel = rule.matchType === 'prefix' ? '及子路径' : '仅当前页';
      nameEl.textContent = `${rule.hostname}${rule.path} (${matchLabel})`;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-remove-blocked';
      removeBtn.textContent = '移除';
      removeBtn.addEventListener('click', () => removeBlockedPathRule(rule.id));

      itemEl.appendChild(nameEl);
      itemEl.appendChild(removeBtn);
      list.appendChild(itemEl);
    });
  });
}

function normalizePathInput(path) {
  let p = path.trim();
  if (!p) return '';
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

function addBlockedPathRule(hostname, path, matchType, onDone) {
  const host = parseSiteKeyInput(hostname);
  const normalizedPath = normalizePathInput(path);
  if (!host || !isValidSiteKey(host)) {
    alert('请输入有效的域名或 IP 地址');
    return;
  }
  if (!normalizedPath) {
    alert('请输入有效的路径，例如 /system/model/index');
    return;
  }

  chrome.runtime.sendMessage(
    {
      action: 'addBlockedPathRule',
      hostname: host,
      path: normalizedPath,
      matchType: matchType === 'prefix' ? 'prefix' : 'exact'
    },
    (response) => {
      if (response && response.success) {
        loadBlockedPathRules();
        updatePageBlockUI();
        loadCurrentPasswords();
        if (typeof onDone === 'function') onDone();
      }
    }
  );
}

function removeBlockedPathRule(id) {
  chrome.runtime.sendMessage({ action: 'removeBlockedPathRule', id }, (response) => {
    if (response && response.success) {
      loadBlockedPathRules();
      updatePageBlockUI();
      loadCurrentPasswords();
    }
  });
}
function loadBlockedHosts() {
  chrome.runtime.sendMessage({ action: 'getBlockedHosts' }, (response) => {
    const list = document.getElementById('blockedHostList');
    list.innerHTML = '';
    const hosts = (response && response.data) || [];

    if (hosts.length === 0) {
      list.innerHTML = '<p class="empty-message">暂无整站屏蔽</p>';
      return;
    }

    hosts.forEach((host) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'blocked-host-item';

      const nameEl = document.createElement('span');
      nameEl.className = 'blocked-host-name';
      nameEl.textContent = host;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-remove-blocked';
      removeBtn.textContent = '移除';
      removeBtn.addEventListener('click', () => removeBlockedHost(host));

      itemEl.appendChild(nameEl);
      itemEl.appendChild(removeBtn);
      list.appendChild(itemEl);
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function parseSiteKeyInput(raw) {
  const value = raw.trim();
  if (!value) return '';

  try {
    if (value.includes('://')) {
      return getSiteKeyFromUrl(value);
    }
    if (value.includes('/')) {
      return getSiteKeyFromUrl(`https://${value}`);
    }
  } catch {
    return '';
  }

  return normalizeSiteKey(value);
}

function addBlockedHost(hostname, onDone) {
  const host = parseSiteKeyInput(hostname);
  if (!host || !isValidSiteKey(host)) {
    alert('请输入有效的域名或 IP 地址，例如 example.com 或 192.168.1.1:8080');
    return;
  }

  chrome.runtime.sendMessage(
    { action: 'addBlockedHost', hostname: host },
    (response) => {
      if (response && response.success) {
        loadBlockedHosts();
        updatePageBlockUI();
        loadCurrentPasswords();
        document.getElementById('addBlockedHost').value = '';
        if (typeof onDone === 'function') onDone();
      }
    }
  );
}

function removeBlockedHost(hostname) {
  chrome.runtime.sendMessage(
    { action: 'removeBlockedHost', hostname },
    (response) => {
      if (response && response.success) {
        loadBlockedHosts();
        updatePageBlockUI();
        loadCurrentPasswords();
      }
    }
  );
}

document.getElementById('blockCurrentBtn').addEventListener('click', () => {
  if (!currentHostname) return;
  if (confirm(`确定屏蔽 ${currentHostname}？\n该网站所有页面都不会弹出密码填充面板。`)) {
    addBlockedHost(currentHostname);
  }
});

document.getElementById('blockCurrentPageBtn').addEventListener('click', () => {
  if (!currentHostname || !currentPathname) return;
  if (confirm(`确定仅屏蔽当前页面 ${currentHostname}${currentPathname}？\n登录页等其它页面仍可填充。`)) {
    addBlockedPathRule(currentHostname, currentPathname, 'exact');
  }
});

document.getElementById('blockCurrentPagePrefixBtn').addEventListener('click', () => {
  if (!currentHostname || !currentPathname) return;
  if (confirm(`确定屏蔽 ${currentHostname}${currentPathname} 及其子路径？\n例如 ${currentPathname}/... 也不会弹出填充面板。`)) {
    addBlockedPathRule(currentHostname, currentPathname, 'prefix');
  }
});

document.getElementById('unblockCurrentBtn').addEventListener('click', () => {
  if (!currentHostname) return;
  removeBlockedHost(currentHostname);
});

document.getElementById('unblockCurrentPageBtn').addEventListener('click', () => {
  if (currentPathRuleId) {
    removeBlockedPathRule(currentPathRuleId);
    return;
  }
  chrome.runtime.sendMessage({ action: 'getBlockedPathRules' }, (response) => {
    const rules = (response && response.data) || [];
    const normalizedHost = normalizeSiteKey(currentHostname);
    const normPath = currentPathname.replace(/\/$/, '') || '/';
    const matched = rules.find((rule) => {
      if (rule.hostname !== normalizedHost) return false;
      const rulePath = rule.path.replace(/\/$/, '') || '/';
      if (rule.matchType === 'prefix') {
        return normPath === rulePath || normPath.startsWith(`${rulePath}/`);
      }
      return normPath === rulePath;
    });
    if (matched) {
      removeBlockedPathRule(matched.id);
    }
  });
});

document.getElementById('addBlockedBtn').addEventListener('click', () => {
  const input = document.getElementById('addBlockedHost');
  addBlockedHost(input.value);
});

document.getElementById('addBlockedPathBtn').addEventListener('click', () => {
  const hostInput = document.getElementById('addBlockedPathHost');
  const pathInput = document.getElementById('addBlockedPath');
  const usePrefix = document.getElementById('addBlockedPathPrefix').checked;
  addBlockedPathRule(hostInput.value, pathInput.value, usePrefix ? 'prefix' : 'exact', () => {
    pathInput.value = '';
    document.getElementById('addBlockedPathPrefix').checked = false;
  });
});

document.getElementById('addBlockedHost').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('addBlockedBtn').click();
  }
});

document.getElementById('addBlockedPath').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('addBlockedPathBtn').click();
  }
});

// 加载当前网站的密码
function loadCurrentPasswords() {
  chrome.runtime.sendMessage(
    { action: 'isPageBlocked', hostname: currentHostname, pathname: currentPathname },
    (blockResponse) => {
      const pageBlocked = !!(blockResponse && blockResponse.blocked);

      chrome.runtime.sendMessage(
        { action: 'getPasswords', hostname: currentHostname },
        (response) => {
          const list = document.getElementById('currentPasswordList');
          const addForm = document.querySelector('.add-form');
          list.innerHTML = '';

          if (!response.success || response.data.length === 0) {
            addForm.style.display = pageBlocked ? 'none' : 'block';
            list.innerHTML = pageBlocked
              ? '<p class="empty-message">当前页面或网站已屏蔽，且暂无保存的账号</p>'
              : '<p class="empty-message">该网站暂无保存的账号</p>';
            return;
          }

          addForm.style.display = 'none';
          response.data.forEach((item) => {
            const itemEl = createPasswordItem(item, currentHostname);
            list.appendChild(itemEl);
          });
        }
      );
    }
  );
}

let allPasswordItems = [];

// 加载全部密码
function loadAllPasswords() {
  chrome.runtime.sendMessage(
    { action: 'getAllPasswords' },
    (response) => {
      const passwords = response.data || {};
      allPasswordItems = Object.entries(passwords).flatMap(([hostname, items]) =>
        items.map((item) => ({ ...item, hostname }))
      );
      renderAllPasswordList();
    }
  );
}

function matchesPasswordSearch(item, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const fields = [item.hostname, item.username, item.password, item.label || ''];
  return fields.some((field) => field.toLowerCase().includes(q));
}

function renderAllPasswordList() {
  const list = document.getElementById('allPasswordList');
  const batchToolbar = document.getElementById('batchToolbar');
  const searchBar = document.getElementById('searchBar');
  const query = document.getElementById('searchInput').value.trim();
  list.innerHTML = '';

  if (allPasswordItems.length === 0) {
    batchToolbar.classList.add('hidden');
    searchBar.classList.add('hidden');
    list.innerHTML = '<p class="empty-message">暂无保存的账号密码</p>';
    return;
  }

  searchBar.classList.remove('hidden');
  batchToolbar.classList.remove('hidden');

  const filtered = allPasswordItems.filter((item) => matchesPasswordSearch(item, query));

  if (filtered.length === 0) {
    list.innerHTML = '<p class="empty-message">未找到匹配的账号密码</p>';
  } else {
    filtered.forEach((item) => {
      const itemEl = createPasswordItem(item, item.hostname, { batchMode: true });
      list.appendChild(itemEl);
    });
  }
  updateBatchSelectionUI();
}

function getBatchCheckboxes() {
  return Array.from(document.querySelectorAll('#allPasswordList .password-item-checkbox'));
}

function updateBatchSelectionUI() {
  const checkboxes = getBatchCheckboxes();
  const selectedCount = checkboxes.filter((cb) => cb.checked).length;
  const deleteBtn = document.getElementById('batchDeleteBtn');
  const countEl = document.getElementById('batchSelectCount');

  deleteBtn.disabled = selectedCount === 0;
  deleteBtn.textContent = selectedCount > 0 ? `删除选中 (${selectedCount})` : '删除选中';
  countEl.textContent = selectedCount > 0 ? `已选 ${selectedCount} / ${checkboxes.length}` : '';
}

function selectAllPasswords() {
  getBatchCheckboxes().forEach((cb) => {
    cb.checked = true;
  });
  updateBatchSelectionUI();
}

function invertPasswordSelection() {
  getBatchCheckboxes().forEach((cb) => {
    cb.checked = !cb.checked;
  });
  updateBatchSelectionUI();
}

function deleteSelectedPasswords() {
  const selected = getBatchCheckboxes()
    .filter((cb) => cb.checked)
    .map((cb) => ({ hostname: cb.dataset.hostname, id: cb.dataset.id }));

  if (selected.length === 0) return;

  if (!confirm(`确定删除选中的 ${selected.length} 条记录？此操作不可恢复。`)) {
    return;
  }

  chrome.runtime.sendMessage(
    { action: 'deletePasswordsBatch', items: selected },
    (response) => {
      if (response && response.success) {
        loadCurrentPasswords();
        loadAllPasswords();
      }
    }
  );
}

document.getElementById('selectAllBtn').addEventListener('click', selectAllPasswords);
document.getElementById('invertSelectBtn').addEventListener('click', invertPasswordSelection);
document.getElementById('batchDeleteBtn').addEventListener('click', deleteSelectedPasswords);

document.getElementById('searchInput').addEventListener('input', renderAllPasswordList);
document.getElementById('clearSearchBtn').addEventListener('click', () => {
  document.getElementById('searchInput').value = '';
  renderAllPasswordList();
  document.getElementById('searchInput').focus();
});

// 创建密码列表项 DOM
function createPasswordItem(item, hostname, options = {}) {
  const { batchMode = false } = options;
  const itemEl = document.createElement('div');
  itemEl.className = batchMode ? 'password-item batch-mode' : 'password-item';

  const checkboxHtml = batchMode
    ? `<input type="checkbox" class="password-item-checkbox" data-hostname="${hostname}" data-id="${item.id}" />`
    : '';

  itemEl.innerHTML = `
    ${checkboxHtml}
    <div class="password-info">
      <div class="password-hostname">${hostname}</div>
      <div class="password-username">用户名: ${item.username}</div>
      ${item.label ? `<div class="password-label">标签: ${item.label}</div>` : ''}
      <div class="password-pwd-masked">密码: ••••••••</div>
    </div>
    <div class="password-actions">
      <button class="btn-copy-pwd" data-password="${item.password}" title="复制密码">复制</button>
      <button class="btn-duplicate" data-hostname="${hostname}" title="复制到新站点">副本</button>
      <button class="btn-edit" data-hostname="${hostname}" data-id="${item.id}" title="编辑密码">编辑</button>
      <button class="btn-delete" data-hostname="${hostname}" data-id="${item.id}">删除</button>
    </div>
  `;

  if (batchMode) {
    const checkbox = itemEl.querySelector('.password-item-checkbox');
    checkbox.addEventListener('change', updateBatchSelectionUI);
  }

  // 复制密码按钮（到剪贴板）
  itemEl.querySelector('.btn-copy-pwd').addEventListener('click', (e) => {
    const pwd = e.target.dataset.password;
    navigator.clipboard.writeText(pwd).then(() => {
      const originalText = e.target.textContent;
      e.target.textContent = '✓';
      setTimeout(() => {
        e.target.textContent = originalText;
      }, 1500);
    });
  });

  // 复制账号按钮
  itemEl.querySelector('.btn-duplicate').addEventListener('click', (e) => {
    const hostname = e.target.dataset.hostname;
    openCopyModal(item, hostname);
  });

  // 编辑按钮
  itemEl.querySelector('.btn-edit').addEventListener('click', (e) => {
    const hostname = e.target.dataset.hostname;
    const id = e.target.dataset.id;
    openEditModal(item, hostname, id);
  });

  // 删除按钮
  itemEl.querySelector('.btn-delete').addEventListener('click', (e) => {
    const hostname = e.target.dataset.hostname;
    const id = e.target.dataset.id;

    if (confirm('确定删除这条记录?')) {
      chrome.runtime.sendMessage(
        { action: 'deletePassword', hostname, id },
        (response) => {
          if (response.success) {
            loadCurrentPasswords();
            loadAllPasswords();
          }
        }
      );
    }
  });

  return itemEl;
}

// 添加密码
document.getElementById('addBtn').addEventListener('click', () => {
  const username = document.getElementById('addUsername').value;
  const password = document.getElementById('addPassword').value;
  const label = document.getElementById('addLabel').value;

  if (!username || !password) {
    alert('用户名和密码不能为空');
    return;
  }

  chrome.runtime.sendMessage(
    {
      action: 'savePassword',
      hostname: currentHostname,
      username,
      password,
      label
    },
    (response) => {
      if (response.success) {
        // 清空表单
        document.getElementById('addUsername').value = '';
        document.getElementById('addPassword').value = '';
        document.getElementById('addLabel').value = '';

        // 重新加载列表
        loadCurrentPasswords();
        alert('账号已保存!');
      }
    }
  );
});

// 回车保存
document.getElementById('addPassword').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('addBtn').click();
  }
});

function setEditHostnameRowVisible(visible) {
  const row = document.getElementById('editHostnameRow');
  row.classList.toggle('hidden', !visible);
  if (!visible) {
    document.getElementById('editHostname').value = '';
  }
}

// 编辑密码模态框函数
function openEditModal(item, hostname, id) {
  modalMode = 'edit';
  editingItem = { item, hostname, id };
  setEditHostnameRowVisible(false);
  document.getElementById('modalTitle').textContent = '编辑账号';
  document.getElementById('saveEditBtn').textContent = '保存修改';
  document.getElementById('saveEditBtn').dataset.mode = 'edit';
  document.getElementById('editUsername').value = item.username;
  document.getElementById('editPassword').value = item.password;
  document.getElementById('editLabel').value = item.label || '';
  document.getElementById('editModal').classList.add('show');
  document.getElementById('editUsername').focus();
}

// 复制账号模态框函数
function openCopyModal(item, hostname) {
  modalMode = 'copy';
  editingItem = { hostname };
  setEditHostnameRowVisible(true);
  document.getElementById('modalTitle').textContent = '复制到新站点';
  document.getElementById('saveEditBtn').textContent = '保存为新账号';
  document.getElementById('saveEditBtn').dataset.mode = 'copy';
  document.getElementById('editHostname').value = hostname;
  document.getElementById('editUsername').value = item.username;
  document.getElementById('editPassword').value = item.password;
  document.getElementById('editLabel').value = item.label || '';
  document.getElementById('editModal').classList.add('show');
  document.getElementById('editHostname').focus();
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('show');
  editingItem = null;
  setEditHostnameRowVisible(false);
  document.getElementById('editUsername').value = '';
  document.getElementById('editPassword').value = '';
  document.getElementById('editLabel').value = '';
}

// 编辑模态框事件监听
document.getElementById('closeModal').addEventListener('click', closeEditModal);
document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);

document.getElementById('saveEditBtn').addEventListener('click', () => {
  if (!editingItem) return;

  const username = document.getElementById('editUsername').value;
  const password = document.getElementById('editPassword').value;
  const label = document.getElementById('editLabel').value;

  if (!username || !password) {
    alert('用户名和密码不能为空');
    return;
  }

  const mode = document.getElementById('saveEditBtn').dataset.mode;

  if (mode === 'copy') {
    const host = parseSiteKeyInput(document.getElementById('editHostname').value);
    if (!host || !isValidSiteKey(host)) {
      alert('请输入有效的域名或 IP 地址，例如 example.com 或 192.168.1.1:8080');
      return;
    }

    // 复制模式：创建新账号
    chrome.runtime.sendMessage(
      {
        action: 'savePassword',
        hostname: host,
        username,
        password,
        label
      },
      (response) => {
        if (response.success) {
          closeEditModal();
          loadCurrentPasswords();
          loadAllPasswords();
          alert('账号已保存!');
        }
      }
    );
  } else {
    // 编辑模式：更新现有账号
    chrome.runtime.sendMessage(
      {
        action: 'editPassword',
        hostname: editingItem.hostname,
        id: editingItem.id,
        username,
        password,
        label
      },
      (response) => {
        if (response.success) {
          closeEditModal();
          loadCurrentPasswords();
          loadAllPasswords();
          alert('账号已更新!');
        }
      }
    );
  }
});

// 点击模态框外关闭
document.getElementById('editModal').addEventListener('click', (e) => {
  if (e.target.id === 'editModal') {
    closeEditModal();
  }
});

// 编辑密码框回车保存
document.getElementById('editPassword').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('saveEditBtn').click();
  }
});

// 密码可见性切换
document.getElementById('togglePasswordBtn').addEventListener('click', (e) => {
  e.preventDefault();
  const passwordInput = document.getElementById('editPassword');
  const toggleBtn = e.target;

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleBtn.textContent = '👁️‍🗨️';
    toggleBtn.title = '隐藏密码';
  } else {
    passwordInput.type = 'password';
    toggleBtn.textContent = '👁️';
    toggleBtn.title = '查看密码';
  }

  passwordInput.focus();
});

function formatBackupDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function downloadJsonFile(data) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `site-password-filler-backup-${formatBackupDate(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatImportStats(stats) {
  return [
    `新增账号：${stats.passwordsAdded}`,
    `覆盖账号：${stats.passwordsUpdated}`,
    `跳过无效账号：${stats.passwordsSkipped}`,
    `新增整站屏蔽：${stats.hostsAdded}`,
    `新增路径屏蔽：${stats.pathRulesAdded}`,
    `覆盖路径屏蔽：${stats.pathRulesUpdated}`
  ].join('\n');
}

document.getElementById('exportBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'exportData' }, (response) => {
    if (!response || !response.success) {
      alert('导出失败，请重试');
      return;
    }
    downloadJsonFile(response.data);
  });
});

document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFileInput').click();
});

document.getElementById('importFileInput').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const result = parseImportFile(reader.result, file.name);
    if (result.error === 'invalid_csv') {
      alert('无法识别 CSV 表头，请确认来自 Chrome 密码管理器的导出文件');
      return;
    }
    if (result.error === 'invalid_format') {
      alert('文件格式不正确，请使用本扩展导出的 JSON 或 Chrome 密码 CSV');
      return;
    }

    const sourceLabel = result.source === 'chrome-csv'
      ? 'Chrome 密码 CSV'
      : 'JSON 备份';
    if (!confirm(`将合并导入 ${sourceLabel} 数据，相同站点 + 用户名的账号会被覆盖。是否继续？`)) {
      return;
    }

    chrome.runtime.sendMessage({ action: 'importData', data: result.data }, (response) => {
      if (!response || !response.success) {
        if (response && response.error === 'invalid_format') {
          alert('文件格式不正确，请使用本扩展导出的 JSON 或 Chrome 密码 CSV');
        } else {
          alert('导入失败，请重试');
        }
        return;
      }

      alert(`导入完成：\n${formatImportStats(response.stats)}`);
      loadAllPasswords();
      loadCurrentPasswords();
      loadBlockedHosts();
      loadBlockedPathRules();
      updatePageBlockUI();
    });
  };
  reader.onerror = () => {
    alert('读取文件失败，请重试');
  };
  reader.readAsText(file);
});
