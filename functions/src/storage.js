const cheerio = require('cheerio');
const { URL } = require('url');

const COOKIE_PATTERNS = [
  { pattern: /document\.cookie\s*=\s*['"`]([^'"`]+)['"`]/g, type: 'Set via JS' },
  { pattern: /(?:__utm|_ga|_gid|_fbp|_fbc|_hjid|_hjSession)/g, type: 'Tracking Cookie' },
  { pattern: /(?:session|sess|sid|auth|token|remember|csrf)[_-]?(?:id|token|key)?/gi, type: 'Session Cookie' },
];

const STORAGE_PATTERNS = [
  { pattern: /localStorage\.setItem\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]?([^'"`),]+)/g, type: 'localStorage set' },
  { pattern: /localStorage\.getItem\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g, type: 'localStorage get' },
  { pattern: /sessionStorage\.setItem\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]?([^'"`),]+)/g, type: 'sessionStorage set' },
  { pattern: /sessionStorage\.getItem\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g, type: 'sessionStorage get' },
];

const INDEXEDDB_PATTERNS = [
  { pattern: /indexedDB\.open\s*\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*(\d+))?/g, type: 'IndexedDB open' },
  { pattern: /IDBFactory\s*\.\s*open/g, type: 'IDBFactory' },
  { pattern: /window\.indexedDB/g, type: 'window.indexedDB' },
];

const CACHE_PATTERNS = [
  { pattern: /caches\.open\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g, type: 'Cache API open' },
  { pattern: /cache\.put\s*\(/g, type: 'Cache put' },
  { pattern: /cache\.add\s*\(/g, type: 'Cache add' },
  { pattern: /cache\.match\s*\(/g, type: 'Cache match' },
];

const SERVICE_WORKER_PATTERNS = [
  { pattern: /navigator\.serviceWorker\.register\s*\(\s*['"`]([^'"`]+)['"`]/g, type: 'SW Register' },
  { pattern: /self\.addEventListener\s*\(\s*['"`](install|activate|fetch)['"`]/g, type: 'SW Event' },
];

const TRACKING_COOKIE_SIGNATURES = {
  '__utma': { name: 'Google Analytics', purpose: 'Distinguishes users and sessions', expiry: '2 years' },
  '__utmb': { name: 'Google Analytics', purpose: 'Determines new sessions/visits', expiry: '30 minutes' },
  '__utmc': { name: 'Google Analytics', purpose: 'Operates with __utmb', expiry: 'Session' },
  '__utmz': { name: 'Google Analytics', purpose: 'Stores traffic source', expiry: '6 months' },
  '_ga': { name: 'Google Analytics 4', purpose: 'Distinguishes users', expiry: '2 years' },
  '_gid': { name: 'Google Analytics', purpose: 'Distinguishes users', expiry: '24 hours' },
  '_gat': { name: 'Google Analytics', purpose: 'Throttle request rate', expiry: '1 minute' },
  '_fbp': { name: 'Facebook Pixel', purpose: 'Delivers advertisements', expiry: '3 months' },
  '_fbc': { name: 'Facebook Click ID', purpose: 'Stores Facebook click identifier', expiry: '2 years' },
  '_hjid': { name: 'Hotjar', purpose: 'Sets unique user ID', expiry: '1 year' },
  '_hjSession': { name: 'Hotjar', purpose: 'Holds session data', expiry: 'Session' },
  '__stripe_mid': { name: 'Stripe', purpose: 'Fraud prevention', expiry: '1 year' },
  '__stripe_sid': { name: 'Stripe', purpose: 'Fraud prevention', expiry: '30 minutes' },
  'intercom-id': { name: 'Intercom', purpose: 'Unique visitor ID', expiry: '9 months' },
  'intercom-session': { name: 'Intercom', purpose: 'Session ID', expiry: '1 week' },
  'ajs_user_id': { name: 'Segment', purpose: 'User identification', expiry: '1 year' },
  'ajs_anonymous_id': { name: 'Segment', purpose: 'Anonymous ID', expiry: '1 year' },
  '_hjAbsoluteSessionInProgress': { name: 'Hotjar', purpose: 'Session tracking', expiry: '30 minutes' },
  'mp_': { name: 'Mixpanel', purpose: 'Analytics tracking', expiry: '1 year' },
  'amplitude_id': { name: 'Amplitude', purpose: 'User tracking', expiry: '10 years' },
};

function extractCookiesFromHeaders(headers) {
  const cookies = [];
  const setCookieHeader = headers['set-cookie'] || headers['Set-Cookie'];
  if (!setCookieHeader) return cookies;

  const cookieList = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];

  for (const cookieStr of cookieList) {
    try {
      const parts = cookieStr.split(';').map(p => p.trim());
      const [nameValue, ...attributes] = parts;
      const eqIndex = nameValue.indexOf('=');
      if (eqIndex === -1) continue;

      const name = nameValue.substring(0, eqIndex).trim();
      const value = nameValue.substring(eqIndex + 1).trim();

      const attrMap = {};
      for (const attr of attributes) {
        const [key, val] = attr.split('=').map(s => s.trim());
        attrMap[key.toLowerCase()] = val || true;
      }

      const tracking = Object.entries(TRACKING_COOKIE_SIGNATURES).find(([sig]) =>
        name.toLowerCase().startsWith(sig.toLowerCase())
      );

      cookies.push({
        name,
        value: value.substring(0, 100),
        secure: 'secure' in attrMap,
        httpOnly: 'httponly' in attrMap,
        sameSite: attrMap['samesite'] || null,
        path: attrMap['path'] || '/',
        domain: attrMap['domain'] || null,
        expires: attrMap['expires'] || attrMap['max-age'] || null,
        isTracking: !!tracking,
        trackingInfo: tracking ? tracking[1] : null,
      });
    } catch {}
  }
  return cookies;
}

function extractCookiesFromHtml(html) {
  const cookies = [];
  const seen = new Set();

  for (const { pattern, type } of COOKIE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(html)) !== null) {
      const raw = match[1] || match[0];
      const eqIdx = raw.indexOf('=');
      const name = eqIdx > -1 ? raw.substring(0, eqIdx).trim() : raw.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);

      const tracking = Object.entries(TRACKING_COOKIE_SIGNATURES).find(([sig]) =>
        name.toLowerCase().startsWith(sig.toLowerCase())
      );

      cookies.push({
        name,
        value: eqIdx > -1 ? raw.substring(eqIdx + 1, eqIdx + 50) : null,
        source: 'JavaScript',
        type,
        secure: false,
        httpOnly: false,
        sameSite: null,
        isTracking: !!tracking,
        trackingInfo: tracking ? tracking[1] : null,
      });
    }
  }
  return cookies;
}

function extractLocalStorageUsage(html) {
  const items = [];
  const seen = new Set();

  for (const { pattern, type } of STORAGE_PATTERNS) {
    if (!type.startsWith('localStorage')) continue;
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(html)) !== null) {
      const key = match[1]?.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push({
        key,
        value: match[2] ? match[2].trim().substring(0, 100) : null,
        operation: type.includes('set') ? 'write' : 'read',
      });
    }
  }
  return items;
}

function extractSessionStorageUsage(html) {
  const items = [];
  const seen = new Set();

  for (const { pattern, type } of STORAGE_PATTERNS) {
    if (!type.startsWith('sessionStorage')) continue;
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(html)) !== null) {
      const key = match[1]?.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push({
        key,
        value: match[2] ? match[2].trim().substring(0, 100) : null,
        operation: type.includes('set') ? 'write' : 'read',
      });
    }
  }
  return items;
}

function extractIndexedDbUsage(html) {
  const databases = [];
  const seen = new Set();

  for (const { pattern, type } of INDEXEDDB_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(html)) !== null) {
      const name = match[1]?.trim() || 'Unknown';
      const version = match[2] || null;
      if (seen.has(name)) continue;
      seen.add(name);
      databases.push({ name, version, type });
    }
  }

  if (databases.length === 0 && /indexedDB/i.test(html)) {
    databases.push({ name: 'Unknown', version: null, type: 'Detected (name not extractable)' });
  }

  return databases;
}

function extractCacheStorageUsage(html) {
  const caches = [];
  const seen = new Set();

  for (const { pattern, type } of CACHE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(html)) !== null) {
      const name = match[1]?.trim();
      if (!name) {
        if (!seen.has(type)) {
          seen.add(type);
          caches.push({ name: type, type });
        }
        continue;
      }
      if (seen.has(name)) continue;
      seen.add(name);
      caches.push({ name, type });
    }
  }
  return caches;
}

function extractServiceWorkers(html) {
  const workers = [];
  const seen = new Set();

  for (const { pattern, type } of SERVICE_WORKER_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(html)) !== null) {
      const url = match[1]?.trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      workers.push({ url, scope: '/', type });
    }
  }

  if (workers.length === 0 && /serviceWorker/i.test(html)) {
    workers.push({ url: 'Detected (path not extractable)', scope: '/', type: 'Service Worker' });
  }

  return workers;
}

function detectPrivacyCompliance(cookies, html) {
  const hasGdprBanner = /cookie\s*(?:consent|banner|notice|policy|gdpr)/i.test(html);
  const hasCcpa = /(?:ccpa|california\s*privacy|do\s*not\s*sell)/i.test(html);
  const hasPrivacyPolicy = /privacy\s*policy/i.test(html);
  const trackingCookies = cookies.filter(c => c.isTracking);

  return {
    hasGdprBanner,
    hasCcpa,
    hasPrivacyPolicy,
    trackingCookiesFound: trackingCookies.length,
    complianceRisk: trackingCookies.length > 0 && !hasGdprBanner ? 'high' : trackingCookies.length > 0 ? 'medium' : 'low',
  };
}

function detectWebRtcUsage(html) {
  return /RTCPeerConnection|webkitRTCPeerConnection|mozRTCPeerConnection|RTCDataChannel/i.test(html);
}

function detectWebSocketUsage(html) {
  const wsUrls = [];
  const wsRegex = /new\s+WebSocket\s*\(\s*['"`](wss?:\/\/[^'"`]+)['"`]/g;
  let match;
  while ((match = wsRegex.exec(html)) !== null) {
    wsUrls.push(match[1]);
  }
  return { detected: /new\s+WebSocket\s*\(/i.test(html), urls: wsUrls };
}

function analyzeStorageFingerprinting(html) {
  const techniques = [];
  if (/canvas\.toDataURL|getImageData/i.test(html)) techniques.push('Canvas Fingerprinting');
  if (/AudioContext|webkitAudioContext/i.test(html)) techniques.push('Audio Fingerprinting');
  if (/navigator\.plugins|navigator\.mimeTypes/i.test(html)) techniques.push('Plugin Detection');
  if (/screen\.width|screen\.height|screen\.colorDepth/i.test(html)) techniques.push('Screen Fingerprinting');
  if (/navigator\.fonts|document\.fonts/i.test(html)) techniques.push('Font Fingerprinting');
  if (/navigator\.hardwareConcurrency|navigator\.deviceMemory/i.test(html)) techniques.push('Hardware Fingerprinting');
  return techniques;
}

function analyzeStorage(html, responseHeaders) {
  const headers = responseHeaders || {};
  const $ = cheerio.load(html || '');

  const inlineScripts = [];
  $('script:not([src])').each((_, el) => inlineScripts.push($(el).html() || ''));
  const jsContent = inlineScripts.join('\n');
  const fullContent = (html || '') + jsContent;

  const headerCookies = extractCookiesFromHeaders(headers);
  const jsCookies = extractCookiesFromHtml(jsContent);
  const allCookies = [...headerCookies, ...jsCookies].slice(0, 50);

  const localStorage = extractLocalStorageUsage(jsContent);
  const sessionStorage = extractSessionStorageUsage(jsContent);
  const indexedDb = extractIndexedDbUsage(jsContent);
  const cacheStorage = extractCacheStorageUsage(jsContent);
  const serviceWorkers = extractServiceWorkers(jsContent);
  const privacy = detectPrivacyCompliance(allCookies, fullContent);
  const webRtc = detectWebRtcUsage(jsContent);
  const webSocket = detectWebSocketUsage(jsContent);
  const fingerprinting = analyzeStorageFingerprinting(jsContent);

  return {
    cookies: allCookies,
    localStorage,
    sessionStorage,
    indexedDb,
    cacheStorage,
    serviceWorkers,
    privacy,
    webRtc,
    webSocket,
    fingerprinting,
    summary: {
      totalCookies: allCookies.length,
      trackingCookies: allCookies.filter(c => c.isTracking).length,
      secureCookies: allCookies.filter(c => c.secure).length,
      httpOnlyCookies: allCookies.filter(c => c.httpOnly).length,
      localStorageKeys: localStorage.length,
      sessionStorageKeys: sessionStorage.length,
      indexedDbs: indexedDb.length,
      cacheNames: cacheStorage.length,
      serviceWorkersFound: serviceWorkers.length,
    },
  };
}

module.exports = { analyzeStorage };