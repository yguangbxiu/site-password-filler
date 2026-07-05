// Service Worker for Chrome extension
// Handles storage initialization and message passing

importScripts('site-key.js');

function isHostnameBlocked(hostname, blockedHosts) {
  const normalized = normalizeSiteKey(hostname);
  if (!normalized) return false;
  return (blockedHosts || []).some((h) => normalizeSiteKey(h) === normalized);
}

function normalizePath(path) {
  if (!path || typeof path !== 'string') return '/';
  let p = path.trim();
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

function isPathBlocked(hostname, pathname, blockedPathRules) {
  const normHost = normalizeSiteKey(hostname);
  const normPath = normalizePath(pathname);
  if (!normHost || !normPath) return false;

  return (blockedPathRules || []).some((rule) => {
    if (normalizeSiteKey(rule.hostname) !== normHost) return false;
    const rulePath = normalizePath(rule.path);
    if (rule.matchType === 'prefix') {
      return normPath === rulePath || normPath.startsWith(`${rulePath}/`);
    }
    return normPath === rulePath;
  });
}

function isFillBlocked(hostname, pathname, blockedHosts, blockedPathRules) {
  if (isHostnameBlocked(hostname, blockedHosts)) return true;
  return isPathBlocked(hostname, pathname, blockedPathRules);
}

function getBlockedHosts(callback) {
  chrome.storage.local.get(['blockedHosts'], (result) => {
    callback(result.blockedHosts || []);
  });
}

function getBlockedPathRules(callback) {
  chrome.storage.local.get(['blockedPathRules'], (result) => {
    callback(result.blockedPathRules || []);
  });
}

function getBlockSettings(callback) {
  chrome.storage.local.get(['blockedHosts', 'blockedPathRules'], (result) => {
    callback({
      blockedHosts: result.blockedHosts || [],
      blockedPathRules: result.blockedPathRules || []
    });
  });
}

function setBlockedHosts(blockedHosts, callback) {
  chrome.storage.local.set({ blockedHosts }, callback);
}

function setBlockedPathRules(blockedPathRules, callback) {
  chrome.storage.local.set({ blockedPathRules }, callback);
}

function pathRuleKey(rule) {
  return `${normalizeSiteKey(rule.hostname)}|${normalizePath(rule.path)}|${rule.matchType || 'exact'}`;
}

function generateCredentialId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function prependPasswordEntry(passwords, siteKey, entry) {
  if (!passwords[siteKey]) {
    return { [siteKey]: [entry], ...passwords };
  }
  passwords[siteKey].unshift(entry);
  return passwords;
}

function prependPasswordEntries(passwords, siteKey, entries) {
  if (entries.length === 0) return passwords;
  if (!passwords[siteKey]) {
    return { [siteKey]: entries, ...passwords };
  }
  passwords[siteKey] = [...entries, ...passwords[siteKey]];
  return passwords;
}

function parseImportPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  if (raw.format === 'site-password-filler-export') {
    return {
      passwords: raw.passwords && typeof raw.passwords === 'object' ? raw.passwords : {},
      blockedHosts: Array.isArray(raw.blockedHosts) ? raw.blockedHosts : [],
      blockedPathRules: Array.isArray(raw.blockedPathRules) ? raw.blockedPathRules : []
    };
  }

  if (raw.passwords && typeof raw.passwords === 'object' && !Array.isArray(raw.passwords)) {
    return {
      passwords: raw.passwords,
      blockedHosts: Array.isArray(raw.blockedHosts) ? raw.blockedHosts : [],
      blockedPathRules: Array.isArray(raw.blockedPathRules) ? raw.blockedPathRules : []
    };
  }

  const entries = Object.entries(raw);
  if (entries.length > 0 && entries.every(([, value]) => Array.isArray(value))) {
    return {
      passwords: raw,
      blockedHosts: [],
      blockedPathRules: []
    };
  }

  return null;
}

function mergeImportedData(existing, imported) {
  const stats = {
    passwordsAdded: 0,
    passwordsUpdated: 0,
    passwordsSkipped: 0,
    hostsAdded: 0,
    pathRulesAdded: 0,
    pathRulesUpdated: 0
  };

  let passwords = { ...(existing.passwords || {}) };

  for (const [rawKey, items] of Object.entries(imported.passwords || {})) {
    const siteKey = normalizeSiteKey(rawKey);
    if (!siteKey) {
      stats.passwordsSkipped += Array.isArray(items) ? items.length : 0;
      continue;
    }
    if (!Array.isArray(items)) {
      continue;
    }

    const siteExists = Object.prototype.hasOwnProperty.call(passwords, siteKey);
    const newEntries = [];

    for (const item of items) {
      if (!item || typeof item !== 'object') {
        stats.passwordsSkipped += 1;
        continue;
      }
      const username = typeof item.username === 'string' ? item.username.trim() : '';
      const password = typeof item.password === 'string' ? item.password : '';
      if (!username || !password) {
        stats.passwordsSkipped += 1;
        continue;
      }

      const entry = {
        id: generateCredentialId(),
        username,
        password,
        label: typeof item.label === 'string' ? item.label : ''
      };

      if (siteExists) {
        const idx = passwords[siteKey].findIndex((p) => p.username === username);
        if (idx >= 0) {
          passwords[siteKey][idx] = entry;
          stats.passwordsUpdated += 1;
        } else {
          newEntries.push(entry);
        }
      } else {
        const idx = newEntries.findIndex((p) => p.username === username);
        if (idx >= 0) {
          newEntries[idx] = entry;
          stats.passwordsUpdated += 1;
        } else {
          newEntries.push(entry);
          stats.passwordsAdded += 1;
        }
      }
    }

    if (newEntries.length > 0) {
      passwords = prependPasswordEntries(passwords, siteKey, newEntries);
      if (siteExists) {
        stats.passwordsAdded += newEntries.length;
      }
    }
  }

  const blockedHostSet = new Set(
    (existing.blockedHosts || []).map((h) => normalizeSiteKey(h)).filter(Boolean)
  );
  for (const host of imported.blockedHosts || []) {
    const normalized = normalizeSiteKey(host);
    if (!normalized) continue;
    if (!blockedHostSet.has(normalized)) {
      blockedHostSet.add(normalized);
      stats.hostsAdded += 1;
    }
  }
  const blockedHosts = Array.from(blockedHostSet).sort();

  const pathRuleMap = new Map();
  for (const rule of existing.blockedPathRules || []) {
    pathRuleMap.set(pathRuleKey(rule), rule);
  }
  for (const rule of imported.blockedPathRules || []) {
    const host = normalizeSiteKey(rule.hostname);
    const path = normalizePath(rule.path);
    const matchType = rule.matchType === 'prefix' ? 'prefix' : 'exact';
    if (!host || !path) continue;

    const nextRule = {
      id: generateCredentialId(),
      hostname: host,
      path,
      matchType
    };
    const key = pathRuleKey(nextRule);
    if (pathRuleMap.has(key)) {
      pathRuleMap.set(key, { ...pathRuleMap.get(key), hostname: host, path, matchType });
      stats.pathRulesUpdated += 1;
    } else {
      pathRuleMap.set(key, nextRule);
      stats.pathRulesAdded += 1;
    }
  }
  const blockedPathRules = Array.from(pathRuleMap.values()).sort((a, b) => {
    const left = `${a.hostname}${a.path}`;
    const right = `${b.hostname}${b.path}`;
    return left.localeCompare(right);
  });

  return { passwords, blockedHosts, blockedPathRules, stats };
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('站点密码填充器 / Site Password Filler 已安装');

  chrome.storage.local.get(['passwords', 'blockedHosts', 'blockedPathRules'], (result) => {
    const updates = {};
    if (!result.passwords) {
      updates.passwords = {};
    }
    if (!result.blockedHosts) {
      updates.blockedHosts = [];
    }
    if (!result.blockedPathRules) {
      updates.blockedPathRules = [];
    }
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates);
    }
  });
});

// 监听来自 content script 或 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getPasswords') {
    const siteKey = normalizeSiteKey(message.hostname);
    chrome.storage.local.get(['passwords'], (result) => {
      const passwords = result.passwords || {};
      sendResponse({
        success: true,
        data: passwords[siteKey] || []
      });
    });
    return true; // 异步响应
  }

  if (message.action === 'savePassword') {
    chrome.storage.local.get(['passwords'], (result) => {
      let passwords = result.passwords || {};
      const siteKey = normalizeSiteKey(message.hostname);
      const entry = {
        id: Date.now().toString(),
        username: message.username,
        password: message.password,
        label: message.label || ''
      };

      passwords = prependPasswordEntry(passwords, siteKey, entry);

      chrome.storage.local.set({ passwords }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (message.action === 'editPassword') {
    chrome.storage.local.get(['passwords'], (result) => {
      const passwords = result.passwords || {};
      const siteKey = normalizeSiteKey(message.hostname);
      const id = message.id;

      if (passwords[siteKey]) {
        const itemIndex = passwords[siteKey].findIndex(p => p.id === id);
        if (itemIndex !== -1) {
          passwords[siteKey][itemIndex] = {
            ...passwords[siteKey][itemIndex],
            username: message.username,
            password: message.password,
            label: message.label || ''
          };
        }
      }

      chrome.storage.local.set({ passwords }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (message.action === 'deletePassword') {
    chrome.storage.local.get(['passwords'], (result) => {
      const passwords = result.passwords || {};
      const siteKey = normalizeSiteKey(message.hostname);
      const id = message.id;

      if (passwords[siteKey]) {
        passwords[siteKey] = passwords[siteKey].filter(p => p.id !== id);
      }

      chrome.storage.local.set({ passwords }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (message.action === 'deletePasswordsBatch') {
    chrome.storage.local.get(['passwords'], (result) => {
      const passwords = result.passwords || {};
      const items = message.items || [];

      items.forEach(({ hostname, id }) => {
        const siteKey = normalizeSiteKey(hostname);
        if (passwords[siteKey]) {
          passwords[siteKey] = passwords[siteKey].filter(p => p.id !== id);
          if (passwords[siteKey].length === 0) {
            delete passwords[siteKey];
          }
        }
      });

      chrome.storage.local.set({ passwords }, () => {
        sendResponse({ success: true, deleted: items.length });
      });
    });
    return true;
  }

  if (message.action === 'getAllPasswords') {
    chrome.storage.local.get(['passwords'], (result) => {
      sendResponse({
        success: true,
        data: result.passwords || {}
      });
    });
    return true;
  }

  if (message.action === 'openPasswordManager') {
    const siteKey = normalizeSiteKey(message.hostname);
    const popupUrl = chrome.runtime.getURL('popup/popup.html')
      + '?hostname=' + encodeURIComponent(siteKey);
    chrome.tabs.create({ url: popupUrl });
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'isHostBlocked') {
    getBlockedHosts((blockedHosts) => {
      sendResponse({
        success: true,
        blocked: isHostnameBlocked(message.hostname, blockedHosts)
      });
    });
    return true;
  }

  if (message.action === 'isPageBlocked') {
    getBlockSettings(({ blockedHosts, blockedPathRules }) => {
      const pathname = message.pathname || '/';
      const hostBlocked = isHostnameBlocked(message.hostname, blockedHosts);
      const pathBlocked = isPathBlocked(message.hostname, pathname, blockedPathRules);
      sendResponse({
        success: true,
        blocked: hostBlocked || pathBlocked,
        hostBlocked,
        pathBlocked
      });
    });
    return true;
  }

  if (message.action === 'getBlockedPathRules') {
    getBlockedPathRules((blockedPathRules) => {
      sendResponse({ success: true, data: blockedPathRules });
    });
    return true;
  }

  if (message.action === 'addBlockedPathRule') {
    const host = normalizeSiteKey(message.hostname);
    const path = normalizePath(message.path);
    const matchType = message.matchType === 'prefix' ? 'prefix' : 'exact';
    if (!host || !path) {
      sendResponse({ success: false, error: 'invalid_rule' });
      return true;
    }
    getBlockedPathRules((blockedPathRules) => {
      const nextRule = { id: Date.now().toString(), hostname: host, path, matchType };
      const key = pathRuleKey(nextRule);
      if (!blockedPathRules.some((rule) => pathRuleKey(rule) === key)) {
        blockedPathRules.push(nextRule);
        blockedPathRules.sort((a, b) => {
          const left = `${a.hostname}${a.path}`;
          const right = `${b.hostname}${b.path}`;
          return left.localeCompare(right);
        });
      }
      setBlockedPathRules(blockedPathRules, () => {
        sendResponse({ success: true, data: blockedPathRules });
      });
    });
    return true;
  }

  if (message.action === 'removeBlockedPathRule') {
    getBlockedPathRules((blockedPathRules) => {
      const next = blockedPathRules.filter((rule) => rule.id !== message.id);
      setBlockedPathRules(next, () => {
        sendResponse({ success: true, data: next });
      });
    });
    return true;
  }

  if (message.action === 'getBlockedHosts') {
    getBlockedHosts((blockedHosts) => {
      sendResponse({ success: true, data: blockedHosts });
    });
    return true;
  }

  if (message.action === 'addBlockedHost') {
    const host = normalizeSiteKey(message.hostname);
    if (!host) {
      sendResponse({ success: false, error: 'invalid_hostname' });
      return true;
    }
    getBlockedHosts((blockedHosts) => {
      if (!blockedHosts.includes(host)) {
        blockedHosts.push(host);
        blockedHosts.sort();
      }
      setBlockedHosts(blockedHosts, () => {
        sendResponse({ success: true, data: blockedHosts });
      });
    });
    return true;
  }

  if (message.action === 'removeBlockedHost') {
    const host = normalizeSiteKey(message.hostname);
    getBlockedHosts((blockedHosts) => {
      const next = blockedHosts.filter((h) => normalizeSiteKey(h) !== host);
      setBlockedHosts(next, () => {
        sendResponse({ success: true, data: next });
      });
    });
    return true;
  }

  if (message.action === 'exportData') {
    chrome.storage.local.get(['passwords', 'blockedHosts', 'blockedPathRules'], (result) => {
      sendResponse({
        success: true,
        data: {
          format: 'site-password-filler-export',
          version: 1,
          exportedAt: new Date().toISOString(),
          passwords: result.passwords || {},
          blockedHosts: result.blockedHosts || [],
          blockedPathRules: result.blockedPathRules || []
        }
      });
    });
    return true;
  }

  if (message.action === 'importData') {
    const parsed = parseImportPayload(message.data);
    if (!parsed) {
      sendResponse({ success: false, error: 'invalid_format' });
      return true;
    }

    chrome.storage.local.get(['passwords', 'blockedHosts', 'blockedPathRules'], (result) => {
      const merged = mergeImportedData(
        {
          passwords: result.passwords || {},
          blockedHosts: result.blockedHosts || [],
          blockedPathRules: result.blockedPathRules || []
        },
        parsed
      );

      chrome.storage.local.set(
        {
          passwords: merged.passwords,
          blockedHosts: merged.blockedHosts,
          blockedPathRules: merged.blockedPathRules
        },
        () => {
          sendResponse({ success: true, stats: merged.stats });
        }
      );
    });
    return true;
  }
});
