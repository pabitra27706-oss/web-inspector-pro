const { v4: uuidv4 } = require('uuid');

const BLOCKED_DOMAINS_DEEP = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'hotjar.com',
];

async function createDeepPage(browser, timeout = 30000) {
  const page = await browser.newPage();

  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );

  await page.setRequestInterception(true);

  const networkRequests = [];
  const networkResponses = [];
  const consoleMessages = [];
  const jsErrors = [];

  page.on('request', (req) => {
    const url = req.url();
    if (BLOCKED_DOMAINS_DEEP.some(d => url.includes(d))) {
      req.abort();
      return;
    }
    networkRequests.push({
      url,
      method: req.method(),
      resourceType: req.resourceType(),
      headers: req.headers(),
      postData: req.postData() || null,
      timestamp: Date.now(),
    });
    req.continue();
  });

  page.on('response', async (res) => {
    try {
      const req = res.request();
      networkResponses.push({
        url: res.url(),
        status: res.status(),
        statusText: res.statusText(),
        headers: res.headers(),
        resourceType: req.resourceType(),
        fromCache: res.fromCache(),
        timing: res.timing ? res.timing() : null,
      });
    } catch {}
  });

  page.on('console', (msg) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text().substring(0, 500),
      location: msg.location(),
    });
  });

  page.on('pageerror', (err) => {
    jsErrors.push({ message: err.message.substring(0, 300), stack: err.stack?.substring(0, 500) || null });
  });

  page.on('error', () => {});
  page.on('dialog', async (dialog) => { try { await dialog.dismiss(); } catch {} });

  return { page, networkRequests, networkResponses, consoleMessages, jsErrors };
}

async function extractDomData(page) {
  return await page.evaluate(() => {
    const getAllElements = () => document.querySelectorAll('*').length;

    const getHiddenElements = () => {
      const hidden = [];
      document.querySelectorAll('*').forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || el.hidden) {
          hidden.push({
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            class: el.className || null,
            text: (el.textContent || '').trim().substring(0, 100),
          });
        }
      });
      return hidden.slice(0, 30);
    };

    const getForms = () => {
      return Array.from(document.forms).map(form => ({
        action: form.action || '',
        method: form.method || 'GET',
        fields: form.elements.length,
        hasPasswordField: Array.from(form.elements).some(el => el.type === 'password'),
        hasFileField: Array.from(form.elements).some(el => el.type === 'file'),
        fieldDetails: Array.from(form.elements).slice(0, 20).map(el => ({
          type: el.type || el.tagName.toLowerCase(),
          name: el.name || '',
          placeholder: el.placeholder || '',
          required: el.required,
          autocomplete: el.autocomplete || null,
        })),
      }));
    };

    const getStorageData = () => {
      const local = [];
      const session = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          local.push({ key, value: (localStorage.getItem(key) || '').substring(0, 200) });
        }
      } catch {}
      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          session.push({ key, value: (sessionStorage.getItem(key) || '').substring(0, 200) });
        }
      } catch {}
      return { localStorage: local, sessionStorage: session };
    };

    const getCookies = () => {
      try {
        return document.cookie.split(';').map(c => {
          const [name, ...rest] = c.trim().split('=');
          return { name: name.trim(), value: rest.join('=').substring(0, 100) };
        }).filter(c => c.name);
      } catch { return []; }
    };

    const getMetaTags = () => {
      return Array.from(document.querySelectorAll('meta')).map(m => ({
        name: m.name || m.property || m.httpEquiv || null,
        content: (m.content || '').substring(0, 300),
      })).filter(m => m.name);
    };

    const getLinks = () => {
      return Array.from(document.querySelectorAll('a[href]')).slice(0, 100).map(a => ({
        href: a.href,
        text: (a.textContent || '').trim().substring(0, 100),
        rel: a.rel || null,
        target: a.target || null,
      }));
    };

    const getImages = () => {
      return Array.from(document.querySelectorAll('img')).slice(0, 50).map(img => ({
        src: img.src || img.dataset.src || '',
        alt: img.alt || '',
        hasAlt: img.hasAttribute('alt'),
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        loading: img.loading || null,
      }));
    };

    const getScripts = () => {
      return Array.from(document.querySelectorAll('script')).slice(0, 50).map(s => ({
        src: s.src || null,
        type: s.type || 'text/javascript',
        async: s.async,
        defer: s.defer,
        inline: !s.src,
        contentLength: s.textContent ? s.textContent.length : 0,
      }));
    };

    const getComputedColors = () => {
      const colors = new Set();
      document.querySelectorAll('*').forEach(el => {
        const style = window.getComputedStyle(el);
        const bg = style.backgroundColor;
        const color = style.color;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') colors.add(bg);
        if (color && color !== 'rgba(0, 0, 0, 0)') colors.add(color);
      });
      return Array.from(colors).slice(0, 30);
    };

    const getServiceWorkers = async () => {
      try {
        if (!navigator.serviceWorker) return [];
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.map(r => ({ url: r.active?.scriptURL || 'Unknown', scope: r.scope }));
      } catch { return []; }
    };

    const getPerformanceData = () => {
      try {
        const nav = performance.getEntriesByType('navigation')[0];
        const paint = performance.getEntriesByType('paint');
        const fcp = paint.find(p => p.name === 'first-contentful-paint');
        return {
          ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : null,
          domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null,
          loadComplete: nav ? Math.round(nav.loadEventEnd - nav.startTime) : null,
          fcp: fcp ? Math.round(fcp.startTime) : null,
          transferSize: nav ? nav.transferSize : null,
          encodedBodySize: nav ? nav.encodedBodySize : null,
          decodedBodySize: nav ? nav.decodedBodySize : null,
        };
      } catch { return {}; }
    };

    const getWebVitals = () => {
      const vitals = {};
      try {
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        if (lcpEntries.length > 0) vitals.lcp = Math.round(lcpEntries[lcpEntries.length - 1].startTime);
        const fidEntries = performance.getEntriesByType('first-input');
        if (fidEntries.length > 0) vitals.fid = Math.round(fidEntries[0].processingStart - fidEntries[0].startTime);
        const layoutShifts = performance.getEntriesByType('layout-shift');
        vitals.cls = parseFloat(layoutShifts.reduce((sum, e) => sum + (e.hadRecentInput ? 0 : e.value), 0).toFixed(4));
      } catch {}
      return vitals;
    };

    return {
      totalElements: getAllElements(),
      hiddenElements: getHiddenElements(),
      forms: getForms(),
      storageData: getStorageData(),
      cookies: getCookies(),
      metaTags: getMetaTags(),
      links: getLinks(),
      images: getImages(),
      scripts: getScripts(),
      computedColors: getComputedColors(),
      performanceData: getPerformanceData(),
      webVitals: getWebVitals(),
      title: document.title,
      lang: document.documentElement.lang || null,
      charset: document.characterSet || null,
      readyState: document.readyState,
      referrer: document.referrer || null,
      lastModified: document.lastModified || null,
      url: window.location.href,
      origin: window.location.origin,
      cookies_count: document.cookie.split(';').filter(c => c.trim()).length,
    };
  });
}

async function extractInlineSecrets(page) {
  return await page.evaluate(() => {
    const secrets = [];
    const patterns = [
      { regex: /AIza[0-9A-Za-z\-_]{35}/, type: 'Google API Key' },
      { regex: /sk-[a-zA-Z0-9]{48}/, type: 'OpenAI API Key' },
      { regex: /ghp_[a-zA-Z0-9]{36}/, type: 'GitHub Token' },
      { regex: /AKIA[0-9A-Z]{16}/, type: 'AWS Access Key' },
      { regex: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/]*/, type: 'JWT Token' },
    ];

    document.querySelectorAll('script:not([src])').forEach(script => {
      const content = script.textContent || '';
      for (const { regex, type } of patterns) {
        const match = content.match(regex);
        if (match) {
          secrets.push({ type, value: match[0].substring(0, 80), source: 'inline script' });
        }
      }
    });

    return secrets;
  });
}

async function deepScan(browser, url, timeout = 30000) {
  const scanId = uuidv4();
  const { page, networkRequests, networkResponses, consoleMessages, jsErrors } = await createDeepPage(browser, timeout);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    try {
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: Math.min(timeout - 8000, 15000) }),
        new Promise(r => setTimeout(r, Math.min(timeout - 8000, 15000))),
      ]);
    } catch {}

    await new Promise(r => setTimeout(r, 2000));

    const [domData, inlineSecrets, finalHtml] = await Promise.all([
      extractDomData(page),
      extractInlineSecrets(page),
      page.content(),
    ]);

    const filteredRequests = networkRequests.filter(r =>
      !BLOCKED_DOMAINS_DEEP.some(d => r.url.includes(d))
    ).slice(0, 200);

    const filteredResponses = networkResponses.filter(r =>
      !BLOCKED_DOMAINS_DEEP.some(d => r.url.includes(d))
    ).slice(0, 200);

    const apiEndpoints = filteredRequests.filter(r => {
      const url = r.url.toLowerCase();
      return url.includes('/api/') || url.includes('/graphql') || url.includes('/rest/') || url.includes('.json');
    });

    const authHeaders = filteredRequests.filter(r => {
      const headers = r.headers || {};
      return Object.keys(headers).some(k =>
        k.toLowerCase().includes('authorization') || k.toLowerCase().includes('x-api-key')
      );
    });

    const thirdPartyRequests = filteredRequests.filter(r => {
      try {
        return new URL(r.url).hostname !== new URL(url).hostname;
      } catch { return false; }
    });

    return {
      scanId,
      html: finalHtml,
      domData,
      inlineSecrets,
      network: {
        requests: filteredRequests,
        responses: filteredResponses,
        apiEndpoints,
        authHeaders,
        thirdPartyRequests: thirdPartyRequests.slice(0, 50),
        totalRequests: filteredRequests.length,
      },
      console: {
        messages: consoleMessages.slice(0, 50),
        errors: jsErrors.slice(0, 20),
        errorCount: jsErrors.length,
      },
      timestamp: new Date().toISOString(),
    };
  } finally {
    try { await page.close(); } catch {}
  }
}

module.exports = { deepScan };