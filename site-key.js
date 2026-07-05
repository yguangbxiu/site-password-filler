// 密码存储/屏蔽规则的站点标识：域名按 hostname，IP 地址按 hostname:port

function isIPv4(host) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);
}

function isIPv6(host) {
  return host.includes(':');
}

function isIpAddress(host) {
  return isIPv4(host) || isIPv6(host);
}

function normalizeSiteHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') return '';
  let h = hostname.trim().toLowerCase();
  if (h.startsWith('www.')) {
    h = h.slice(4);
  }
  return h;
}

function getSiteKeyFromUrl(url) {
  const parsed = typeof url === 'string' ? new URL(url) : url;
  const host = normalizeSiteHostname(parsed.hostname);
  if (!host) return '';
  if (isIpAddress(host) && parsed.port) {
    if (isIPv6(host)) {
      return `[${host}]:${parsed.port}`;
    }
    return `${host}:${parsed.port}`;
  }
  return host;
}

function normalizeSiteKey(siteKey) {
  if (!siteKey || typeof siteKey !== 'string') return '';
  const trimmed = siteKey.trim();
  if (!trimmed) return '';

  try {
    if (trimmed.includes('://')) {
      return getSiteKeyFromUrl(trimmed);
    }
    if (trimmed.includes('/')) {
      return getSiteKeyFromUrl(`https://${trimmed}`);
    }
  } catch {
    // fall through for plain host / host:port input
  }

  let key = trimmed.toLowerCase();
  if (key.startsWith('www.')) {
    key = key.slice(4);
  }
  return key;
}

function isValidSiteKey(siteKey) {
  if (!siteKey) return false;
  return /^(\[[\da-f:]+\]|(?:\d{1,3}\.){3}\d{1,3}|[a-z0-9][a-z0-9.-]*[a-z0-9]|[a-z0-9])(:\d+)?$/i.test(siteKey);
}
