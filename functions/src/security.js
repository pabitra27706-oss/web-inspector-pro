const axios = require('axios');
const { URL } = require('url');
const cheerio = require('cheerio');

const API_KEY_PATTERNS = [
  { pattern: /AIza[0-9A-Za-z\-_]{35}/g, type: 'Google API Key' },
  { pattern: /AAAA[A-Za-z0-9_\-]{7}:[A-Za-z0-9_\-]{140}/g, type: 'Firebase Cloud Messaging' },
  { pattern: /ya29\.[0-9A-Za-z\-_]+/g, type: 'Google OAuth Token' },
  { pattern: /sk-[a-zA-Z0-9]{48}/g, type: 'OpenAI API Key' },
  { pattern: /sk-proj-[a-zA-Z0-9\-_]{40,}/g, type: 'OpenAI Project Key' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, type: 'GitHub Personal Token' },
  { pattern: /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/g, type: 'GitHub Fine-Grained Token' },
  { pattern: /gho_[a-zA-Z0-9]{36}/g, type: 'GitHub OAuth Token' },
  { pattern: /ghs_[a-zA-Z0-9]{36}/g, type: 'GitHub Actions Token' },
  { pattern: /glpat-[a-zA-Z0-9\-_]{20}/g, type: 'GitLab Personal Token' },
  { pattern: /xox[baprs]\-[0-9A-Za-z]{10,48}/g, type: 'Slack Token' },
  { pattern: /T[a-zA-Z0-9_]{8}\/B[a-zA-Z0-9_]{8}\/[a-zA-Z0-9_]{24}/g, type: 'Slack Webhook' },
  { pattern: /SK[a-f0-9]{32}/g, type: 'Twilio Account SID' },
  { pattern: /AC[a-f0-9]{32}/g, type: 'Twilio Auth Token' },
  { pattern: /SG\.[a-zA-Z0-9_\-]{22}\.[a-zA-Z0-9_\-]{43}/g, type: 'SendGrid API Key' },
  { pattern: /key-[0-9a-zA-Z]{32}/g, type: 'Mailgun API Key' },
  { pattern: /[0-9a-f]{32}-us[0-9]{1,2}/g, type: 'Mailchimp API Key' },
  { pattern: /AKID[A-Z0-9]{16}/g, type: 'AWS Access Key' },
  { pattern: /AKIA[0-9A-Z]{16}/g, type: 'AWS Access Key ID' },
  { pattern: /AGPA[0-9A-Z]{16}/g, type: 'AWS Group Policy' },
  { pattern: /(?:aws_secret_access_key|AWS_SECRET)['":\s=]+([A-Za-z0-9\/+=]{40})/gi, type: 'AWS Secret Key' },
  { pattern: /(?:heroku)[_\-]?(?:api)?[_\-]?key['":\s=]+([0-9a-f\-]{36})/gi, type: 'Heroku API Key' },
  { pattern: /(?:stripe)[_\-]?(?:secret|sk)['":\s=]+(sk_(?:live|test)_[0-9a-zA-Z]{24,})/gi, type: 'Stripe Secret Key' },
  { pattern: /pk_(?:live|test)_[0-9a-zA-Z]{24,}/g, type: 'Stripe Publishable Key' },
  { pattern: /sq0csp-[0-9A-Za-z\-_]{43}/g, type: 'Square OAuth Token' },
  { pattern: /sqOatp-[0-9A-Za-z\-_]{22}/g, type: 'Square Access Token' },
  { pattern: /(?:firebase|fb)[_\-]?(?:api)?[_\-]?key['":\s=]+([A-Za-z0-9\-_]{20,})/gi, type: 'Firebase Key' },
  { pattern: /(?:mongodb\+srv|mongodb):\/\/[^\s"'<>]+/gi, type: 'MongoDB Connection String' },
  { pattern: /(?:mysql|postgres|postgresql|redis|mssql):\/\/[^\s"'<>]+/gi, type: 'Database Connection String' },
  { pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, type: 'Private Key' },
  { pattern: /-----BEGIN CERTIFICATE-----/g, type: 'Certificate' },
  { pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/]*/g, type: 'JWT Token' },
];

const CREDENTIAL_PATTERNS = [
  { pattern: /(?:password|passwd|pwd)['":\s=]+['"]([^'"]{4,})['"]/gi, type: 'Password' },
  { pattern: /(?:secret|SECRET)['":\s=]+['"]([^'"]{8,})['"]/gi, type: 'Secret' },
  { pattern: /(?:username|user|login)['":\s=]+['"]([^'"]{3,})['"]/gi, type: 'Username' },
  { pattern: /(?:db_pass|database_password|db_password)['":\s=]+['"]([^'"]{4,})['"]/gi, type: 'DB Password' },
  { pattern: /(?:admin_pass|admin_password)['":\s=]+['"]([^'"]{4,})['"]/gi, type: 'Admin Password' },
];

const XSS_PATTERNS = [
  { pattern: /document\.write\s*\(/g, desc: 'document.write() usage' },
  { pattern: /innerHTML\s*=/g, desc: 'innerHTML assignment' },
  { pattern: /outerHTML\s*=/g, desc: 'outerHTML assignment' },
  { pattern: /eval\s*\(/g, desc: 'eval() usage' },
  { pattern: /setTimeout\s*\(\s*['"`][^'"`]*\+/g, desc: 'setTimeout with string concat' },
  { pattern: /setInterval\s*\(\s*['"`][^'"`]*\+/g, desc: 'setInterval with string concat' },
  { pattern: /\.html\s*\(\s*[a-zA-Z$_]/g, desc: 'jQuery .html() with variable' },
  { pattern: /location\.hash/g, desc: 'location.hash access' },
  { pattern: /location\.search/g, desc: 'location.search access' },
  { pattern: /document\.referrer/g, desc: 'document.referrer access' },
  { pattern: /window\.name/g, desc: 'window.name access' },
  { pattern: /insertAdjacentHTML/g, desc: 'insertAdjacentHTML usage' },
];

const SQLI_PATTERNS = [
  { pattern: /(?:SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\s+.+FROM\s+/gi, desc: 'Raw SQL in source' },
  { pattern: /(?:mysql_query|mysqli_query|pg_query)\s*\(/gi, desc: 'Direct DB query call' },
  { pattern: /\$_(?:GET|POST|REQUEST|COOKIE)\[['"][^'"]+['"]\]\s*(?:\.|\+)/gi, desc: 'Unsanitized $_GET/$_POST concat' },
  { pattern: /\?(?:id|user|page|cat|item|search)=\d+/gi, desc: 'Numeric URL parameter (potential injection point)' },
];

const ADMIN_PATHS = [
  '/admin', '/admin/', '/administrator', '/admin/login', '/admin.php',
  '/wp-admin', '/wp-login.php', '/wp-admin/admin-ajax.php',
  '/login', '/login.php', '/signin', '/auth', '/auth/login',
  '/dashboard', '/panel', '/control', '/cpanel', '/webmail',
  '/phpmyadmin', '/pma', '/myadmin', '/mysql',
  '/manager', '/management', '/backend', '/backoffice',
  '/user/login', '/users/sign_in', '/account/login',
  '/secure', '/private', '/restricted', '/internal',
];

const BACKUP_PATHS = [
  '/.git/HEAD', '/.git/config', '/.env', '/.env.local', '/.env.production',
  '/config.php', '/config.js', '/config.json', '/configuration.php',
  '/backup.zip', '/backup.tar.gz', '/backup.sql', '/db.sql',
  '/database.sql', '/dump.sql', '/site.tar.gz',
  '/web.config', '/app.config', '/settings.py', '/settings.php',
  '/composer.json', '/package.json', '/yarn.lock', '/package-lock.json',
  '/Gemfile', '/requirements.txt', '/Dockerfile', '/docker-compose.yml',
  '/.htaccess', '/.htpasswd', '/robots.txt', '/sitemap.xml',
];

const SECURITY_HEADERS = [
  { name: 'Content-Security-Policy', key: 'content-security-policy', critical: true },
  { name: 'X-Frame-Options', key: 'x-frame-options', critical: true },
  { name: 'X-Content-Type-Options', key: 'x-content-type-options', critical: true },
  { name: 'Strict-Transport-Security', key: 'strict-transport-security', critical: true },
  { name: 'Referrer-Policy', key: 'referrer-policy', critical: false },
  { name: 'Permissions-Policy', key: 'permissions-policy', critical: false },
  { name: 'X-XSS-Protection', key: 'x-xss-protection', critical: false },
  { name: 'Cross-Origin-Opener-Policy', key: 'cross-origin-opener-policy', critical: false },
  { name: 'Cross-Origin-Embedder-Policy', key: 'cross-origin-embedder-policy', critical: false },
  { name: 'Cross-Origin-Resource-Policy', key: 'cross-origin-resource-policy', critical: false },
];

function findApiKeys(html) {
  const found = [];
  const seen = new Set();
  for (const { pattern, type } of API_KEY_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(html)) !== null) {
      const value = match[1] || match[0];
      const key = `${type}:${value.substring(0, 20)}`;
      if (!seen.has(key) && value.length > 8) {
        seen.add(key);
        found.push({ type, value: value.substring(0, 120) });
      }
      if (found.length >= 30) break;
    }
  }
  return found;
}

function findCredentials(html) {
  const found = [];
  const seen = new Set();
  for (const { pattern, type } of CREDENTIAL_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(html)) !== null) {
      const value = match[1] || match[0];
      const key = `${type}:${value.substring(0, 15)}`;
      if (!seen.has(key)) {
        seen.add(key);
        found.push({ type, value: value.substring(0, 60), context: match[0].substring(0, 100) });
      }
      if (found.length >= 20) break;
    }
  }
  return found;
}

function findXssHints(html) {
  const hints = [];
  for (const { pattern, desc } of XSS_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    if (regex.test(html)) {
      hints.push(desc);
    }
  }
  return hints;
}

function findSqliPoints(html) {
  const points = [];
  for (const { pattern, desc } of SQLI_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    if (regex.test(html)) {
      points.push(desc);
    }
  }
  return points;
}

function findJwtTokens(html) {
  const jwtRegex = /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/]*/g;
  const tokens = [];
  let match;
  while ((match = jwtRegex.exec(html)) !== null) {
    const token = match[0];
    let decoded = null;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const header = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf8'));
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        decoded = { header, payload };
      }
    } catch {}
    tokens.push({ token: token.substring(0, 200), decoded });
    if (tokens.length >= 5) break;
  }
  return tokens;
}

function findSourceMaps(html, scripts) {
  const sourceMaps = [];
  const sourceMapRegex = /\/\/[#@]\s*sourceMappingURL=([^\s]+)/g;
  let match;
  while ((match = sourceMapRegex.exec(html)) !== null) {
    sourceMaps.push(match[1]);
  }
  return sourceMaps;
}

function analyzeSecurityHeaders(headers) {
  const result = [];
  const headerKeys = Object.keys(headers).map(k => k.toLowerCase());
  for (const header of SECURITY_HEADERS) {
    const present = headerKeys.includes(header.key);
    const value = present ? headers[Object.keys(headers).find(k => k.toLowerCase() === header.key)] : null;
    result.push({ name: header.name, key: header.key, present, value: value || null, critical: header.critical });
  }
  return result;
}

function calculateHeaderScore(headers) {
  const analyzed = analyzeSecurityHeaders(headers);
  const critical = analyzed.filter(h => h.critical);
  const nonCritical = analyzed.filter(h => !h.critical);
  const criticalPresent = critical.filter(h => h.present).length;
  const nonCriticalPresent = nonCritical.filter(h => h.present).length;
  const score = Math.round((criticalPresent / critical.length) * 70 + (nonCriticalPresent / nonCritical.length) * 30);
  return `${score}/100`;
}

function analyzeCors(headers) {
  const allowOrigin = headers['access-control-allow-origin'] || headers['Access-Control-Allow-Origin'] || null;
  const allowMethods = headers['access-control-allow-methods'] || headers['Access-Control-Allow-Methods'] || null;
  const allowHeaders = headers['access-control-allow-headers'] || headers['Access-Control-Allow-Headers'] || null;
  const allowCredentials = headers['access-control-allow-credentials'] || headers['Access-Control-Allow-Credentials'] || null;

  let risk = 'low';
  let policy = 'Restricted';

  if (allowOrigin === '*') {
    risk = allowCredentials === 'true' ? 'high' : 'medium';
    policy = 'Open (Wildcard)';
  } else if (allowOrigin) {
    policy = 'Specific Origin';
    risk = 'low';
  } else {
    policy = 'Not Configured';
  }

  return { allowOrigin, allowMethods, allowHeaders, allowCredentials, risk, policy };
}

function analyzeSSL(url, headers) {
  const isHttps = url.startsWith('https://');
  const hsts = headers['strict-transport-security'] || headers['Strict-Transport-Security'];
  const protocol = isHttps ? 'TLS' : 'None';
  const expires = headers['certificate-expiry'] || null;
  const issuer = headers['x-ssl-issuer'] || null;

  return {
    valid: isHttps,
    protocol,
    hsts: !!hsts,
    hstsValue: hsts || null,
    expires,
    issuer,
  };
}

async function fetchTextSafe(url, timeout = 8000) {
  try {
    const res = await axios.get(url, {
      timeout,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebInspectorPro/1.0)' },
      validateStatus: () => true,
      maxRedirects: 3,
    });
    if (res.status === 200) return res.data;
    return null;
  } catch {
    return null;
  }
}

async function fetchRobotsTxt(baseUrl) {
  try {
    const parsed = new URL(baseUrl);
    const robotsUrl = `${parsed.protocol}//${parsed.hostname}/robots.txt`;
    return await fetchTextSafe(robotsUrl);
  } catch {
    return null;
  }
}

async function fetchSitemapInfo(baseUrl, robotsTxt) {
  try {
    const parsed = new URL(baseUrl);
    let sitemapUrl = `${parsed.protocol}//${parsed.hostname}/sitemap.xml`;

    if (robotsTxt) {
      const sitemapMatch = /Sitemap:\s*(\S+)/i.exec(robotsTxt);
      if (sitemapMatch) sitemapUrl = sitemapMatch[1];
    }

    const content = await fetchTextSafe(sitemapUrl);
    if (!content) return { found: false, url: sitemapUrl, entries: 0 };

    const urlMatches = content.match(/<loc>/g);
    return { found: true, url: sitemapUrl, entries: urlMatches ? urlMatches.length : 0 };
  } catch {
    return { found: false, url: null, entries: 0 };
  }
}

async function findAdminPanels(baseUrl) {
  const found = [];
  const parsed = new URL(baseUrl);
  const base = `${parsed.protocol}//${parsed.hostname}`;

  const checks = ADMIN_PATHS.slice(0, 10).map(async (path) => {
    try {
      const res = await axios.head(`${base}${path}`, {
        timeout: 5000,
        validateStatus: () => true,
        maxRedirects: 2,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebInspectorPro/1.0)' },
      });
      if (res.status === 200 || res.status === 302 || res.status === 301) {
        found.push(`${base}${path}`);
      }
    } catch {}
  });

  await Promise.allSettled(checks);
  return found;
}

async function findBackupFiles(baseUrl) {
  const found = [];
  const parsed = new URL(baseUrl);
  const base = `${parsed.protocol}//${parsed.hostname}`;

  const checks = BACKUP_PATHS.slice(0, 8).map(async (path) => {
    try {
      const res = await axios.head(`${base}${path}`, {
        timeout: 5000,
        validateStatus: () => true,
        maxRedirects: 2,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebInspectorPro/1.0)' },
      });
      if (res.status === 200) {
        found.push(`${base}${path}`);
      }
    } catch {}
  });

  await Promise.allSettled(checks);
  return found;
}

async function analyzeSecurity(url, html, responseHeaders) {
  const headers = responseHeaders || {};
  const isHttps = url.startsWith('https://');

  const [robotsTxt, adminPanels, backupFiles] = await Promise.allSettled([
    fetchRobotsTxt(url),
    findAdminPanels(url),
    findBackupFiles(url),
  ]);

  const robotsTxtContent = robotsTxt.status === 'fulfilled' ? robotsTxt.value : null;
  const sitemap = await fetchSitemapInfo(url, robotsTxtContent);

  const apiKeys = findApiKeys(html);
  const credentials = findCredentials(html);
  const xssHints = findXssHints(html);
  const sqliPoints = findSqliPoints(html);
  const jwtTokens = findJwtTokens(html);
  const sourceMaps = findSourceMaps(html);
  const securityHeaders = analyzeSecurityHeaders(headers);
  const headerScore = calculateHeaderScore(headers);
  const cors = analyzeCors(headers);
  const ssl = analyzeSSL(url, headers);

  const issuesFound =
    (apiKeys.length > 0 ? apiKeys.length : 0) +
    (credentials.length > 0 ? credentials.length : 0) +
    (xssHints.length > 0 ? xssHints.length : 0) +
    (sqliPoints.length > 0 ? sqliPoints.length : 0) +
    (!isHttps ? 1 : 0) +
    securityHeaders.filter(h => h.critical && !h.present).length;

  return {
    https: isHttps,
    ssl,
    headers: securityHeaders,
    headerScore,
    cors,
    apiKeys,
    credentials,
    xssHints,
    sqliPoints,
    jwtTokens,
    sourceMaps,
    robotsTxt: robotsTxtContent || 'Not found',
    sitemap,
    adminPanels: adminPanels.status === 'fulfilled' ? adminPanels.value : [],
    backupFiles: backupFiles.status === 'fulfilled' ? backupFiles.value : [],
    issuesFound,
  };
}

module.exports = { analyzeSecurity };