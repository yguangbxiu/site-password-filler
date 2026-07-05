// CSV / Chrome 密码导出文件解析（依赖 site-key.js 中的 getSiteKeyFromUrl、normalizeSiteKey）

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"') {
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      if (next === '\n') i += 1;
      row.push(field);
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      field = '';
    } else if (c === '\n') {
      row.push(field);
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }

  return rows;
}

function isChromePasswordCsv(headers) {
  if (!Array.isArray(headers) || headers.length === 0) return false;
  const normalized = headers.map((h) => String(h).trim().toLowerCase());
  return normalized.includes('url')
    && normalized.includes('username')
    && normalized.includes('password');
}

function resolveSiteKeyFromChromeRow(url, name) {
  const urlValue = typeof url === 'string' ? url.trim() : '';
  const nameValue = typeof name === 'string' ? name.trim() : '';

  if (urlValue) {
    try {
      const siteKey = getSiteKeyFromUrl(urlValue);
      if (siteKey) return siteKey;
    } catch {
      // fall through
    }
  }

  if (nameValue) {
    return normalizeSiteKey(nameValue);
  }

  return '';
}

function parseChromePasswordCsv(text) {
  const rows = parseCsv(String(text || '').replace(/^\uFEFF/, ''));
  if (rows.length === 0) return null;

  const headers = rows[0];
  if (!isChromePasswordCsv(headers)) return null;

  const normalizedHeaders = headers.map((h) => String(h).trim().toLowerCase());
  const urlIdx = normalizedHeaders.indexOf('url');
  const nameIdx = normalizedHeaders.indexOf('name');
  const usernameIdx = normalizedHeaders.indexOf('username');
  const passwordIdx = normalizedHeaders.indexOf('password');
  const noteIdx = normalizedHeaders.indexOf('note');

  const passwords = {};

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const username = String(row[usernameIdx] || '').trim();
    const password = String(row[passwordIdx] || '');
    if (!username || !password) continue;

    const siteKey = resolveSiteKeyFromChromeRow(row[urlIdx], nameIdx >= 0 ? row[nameIdx] : '');
    if (!siteKey) continue;

    const label = noteIdx >= 0 ? String(row[noteIdx] || '') : '';
    if (!passwords[siteKey]) passwords[siteKey] = [];
    passwords[siteKey].push({ username, password, label });
  }

  return { passwords };
}

function looksLikeChromePasswordCsv(text) {
  const rows = parseCsv(String(text || '').replace(/^\uFEFF/, ''));
  if (rows.length === 0) return false;
  return isChromePasswordCsv(rows[0]);
}

function parseImportFile(text, filename) {
  const trimmed = String(text || '').replace(/^\uFEFF/, '');
  const isCsvExt = filename && /\.csv$/i.test(filename);

  if (isCsvExt || looksLikeChromePasswordCsv(trimmed)) {
    const parsed = parseChromePasswordCsv(trimmed);
    if (!parsed) {
      return { error: 'invalid_csv' };
    }
    return {
      data: { passwords: parsed.passwords },
      source: 'chrome-csv'
    };
  }

  try {
    return {
      data: JSON.parse(trimmed),
      source: 'json'
    };
  } catch {
    const parsed = parseChromePasswordCsv(trimmed);
    if (parsed) {
      return {
        data: { passwords: parsed.passwords },
        source: 'chrome-csv'
      };
    }
    return { error: 'invalid_format' };
  }
}
