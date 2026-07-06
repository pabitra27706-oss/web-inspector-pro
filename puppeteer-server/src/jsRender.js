const { v4: uuidv4 } = require('uuid');

const JS_FRAMEWORK_SIGNALS = {
  React: ['__REACT_DEVTOOLS_GLOBAL_HOOK__', 'window.__react', '_reactRootContainer'],
  Vue: ['__VUE__', 'window.__vue__', '__VUE_DEVTOOLS_GLOBAL_HOOK__'],
  Angular: ['window.ng', 'getAllAngularRootElements', 'window.angular'],
  Svelte: ['window.__svelte'],
  Ember: ['window.Ember', 'window.Em'],
  Backbone: ['window.Backbone'],
  jQuery: ['window.jQuery', 'window.$'],
};

async function createRenderPage(browser, timeout = 30000) {
  const page = await browser.newPage();

  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );

  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  page.on('error', () => {});
  page.on('pageerror', () => {});
  page.on('dialog', async (dialog) => { try { await dialog.dismiss(); } catch {} });

  return page;
}

async function waitForFrameworkRender(page, timeout = 10000) {
  const strategies = [
    () => page.waitForFunction(() => {
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        return document.querySelectorAll('[data-reactroot], #root, #app').length > 0 &&
          document.querySelector('#root, #app')?.children.length > 0;
      }
      return true;
    }, { timeout }),
    () => page.waitForFunction(() => {
      if (window.__VUE__) {
        return document.querySelector('#app')?.__vue_app__ !== undefined;
      }
      return true;
    }, { timeout }),
    () => page.waitForFunction(() => document.readyState === 'complete', { timeout }),
    () => new Promise(r => setTimeout(r, 3000)),
  ];

  for (const strategy of strategies) {
    try {
      await strategy();
      return;
    } catch {}
  }
}

async function detectFrameworks(page) {
  return await page.evaluate((signals) => {
    const detected = [];
    for (const [framework, checks] of Object.entries(signals)) {
      for (const check of checks) {
        try {
          const parts = check.split('.');
          let obj = window;
          let found = true;
          for (const part of parts.slice(1)) {
            if (obj[part] === undefined) { found = false; break; }
            obj = obj[part];
          }
          if (found && obj !== window) {
            detected.push(framework);
            break;
          }
        } catch {}
      }
    }
    return detected;
  }, JS_FRAMEWORK_SIGNALS);
}

async function extractRenderedContent(page) {
  return await page.evaluate(() => {
    const getTextContent = () => {
      const body = document.body;
      if (!body) return '';
      const clone = body.cloneNode(true);
      clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
      return (clone.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 10000);
    };

    const getDynamicElements = () => {
      const dynamic = [];
      document.querySelectorAll('[data-v-], [data-reactid], [ng-version], [data-ng-version], ._nghost-ng-c-,  [class*="svelte-"]').forEach(el => {
        dynamic.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          class: (el.className || '').substring(0, 100),
          framework: el.hasAttribute('data-v-') ? 'Vue' :
            el.hasAttribute('data-reactid') ? 'React' :
            el.hasAttribute('ng-version') || el.hasAttribute('data-ng-version') ? 'Angular' : 'Unknown',
        });
      });
      return dynamic.slice(0, 20);
    };

    const getRouterInfo = () => {
      try {
        return {
          pathname: window.location.pathname,
          hash: window.location.hash,
          search: window.location.search,
          historyLength: window.history.length,
          isHashRouter: window.location.hash.startsWith('#/'),
        };
      } catch { return {}; }
    };

    const getReactState = () => {
      try {
        const root = document.querySelector('#root, #app, [data-reactroot]');
        if (!root) return null;
        const key = Object.keys(root).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
        if (!key) return null;
        return { hasReactRoot: true, rootElement: root.tagName.toLowerCase() };
      } catch { return null; }
    };

    const getVueState = () => {
      try {
        const app = document.querySelector('#app');
        if (!app || !app.__vue_app__) return null;
        const vueApp = app.__vue_app__;
        return {
          hasVueApp: true,
          version: vueApp.version || 'Unknown',
          componentCount: vueApp._context?.components ? Object.keys(vueApp._context.components).length : 0,
        };
      } catch { return null; }
    };

    const getGlobalVariables = () => {
      const skip = new Set(['window', 'self', 'frames', 'parent', 'top', 'document', 'location', 'navigator', 'history', 'screen', 'performance', 'console', 'alert', 'confirm', 'prompt', 'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker', 'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'crypto', 'Intl', 'JSON', 'Math', 'Date', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Proxy', 'Reflect', 'Error', 'TypeError', 'RangeError', 'undefined', 'null', 'NaN', 'Infinity', 'globalThis']);
      const globals = [];
      try {
        for (const key of Object.keys(window)) {
          if (!skip.has(key) && !key.startsWith('__') && !key.startsWith('webkit') && !key.startsWith('on')) {
            const type = typeof window[key];
            if (type === 'object' || type === 'function') {
              globals.push({ name: key, type });
            }
          }
        }
      } catch {}
      return globals.slice(0, 30);
    };

    const getAjaxActivity = () => {
      return {
        fetchDefined: typeof window.fetch === 'function',
        xhrDefined: typeof window.XMLHttpRequest === 'function',
        axiosDefined: typeof window.axios !== 'undefined',
        jqueryDefined: typeof window.jQuery !== 'undefined' || typeof window.$ !== 'undefined',
      };
    };

    const getRenderedLinks = () => {
      return Array.from(document.querySelectorAll('a[href]')).slice(0, 100).map(a => ({
        href: a.href,
        text: (a.textContent || '').trim().substring(0, 80),
        isInternal: a.href.startsWith(window.location.origin),
      }));
    };

    const getRenderedImages = () => {
      return Array.from(document.querySelectorAll('img')).slice(0, 50).map(img => ({
        src: img.currentSrc || img.src,
        alt: img.alt || '',
        loaded: img.complete && img.naturalWidth > 0,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      }));
    };

    const getAccessibilityInfo = () => {
      const ariaLabels = document.querySelectorAll('[aria-label]').length;
      const ariaRoles = document.querySelectorAll('[role]').length;
      const tabIndexed = document.querySelectorAll('[tabindex]').length;
      const landmarks = document.querySelectorAll('main, nav, header, footer, aside, section[aria-label]').length;
      const skipLinks = document.querySelectorAll('a[href="#main"], a[href="#content"], a[href="#skip"]').length;
      return { ariaLabels, ariaRoles, tabIndexed, landmarks, skipLinks };
    };

    return {
      html: document.documentElement.outerHTML.substring(0, 100000),
      textContent: getTextContent(),
      dynamicElements: getDynamicElements(),
      routerInfo: getRouterInfo(),
      reactState: getReactState(),
      vueState: getVueState(),
      globalVariables: getGlobalVariables(),
      ajaxActivity: getAjaxActivity(),
      renderedLinks: getRenderedLinks(),
      renderedImages: getRenderedImages(),
      accessibility: getAccessibilityInfo(),
      totalElements: document.querySelectorAll('*').length,
      title: document.title,
      metaDescription: document.querySelector('meta[name="description"]')?.content || null,
    };
  });
}

async function measureRenderPerformance(page) {
  return await page.evaluate(() => {
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find(p => p.name === 'first-contentful-paint');
      const fp = paint.find(p => p.name === 'first-paint');
      const resources = performance.getEntriesByType('resource').slice(0, 50);

      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      const lcp = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1] : null;

      const layoutShifts = performance.getEntriesByType('layout-shift');
      const cls = layoutShifts.reduce((sum, e) => sum + (e.hadRecentInput ? 0 : e.value), 0);

      return {
        navigationTiming: nav ? {
          ttfb: Math.round(nav.responseStart - nav.requestStart),
          dnsLookup: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
          tcpConnect: Math.round(nav.connectEnd - nav.connectStart),
          tlsNegotiation: nav.secureConnectionStart > 0 ? Math.round(nav.connectEnd - nav.secureConnectionStart) : 0,
          serverResponse: Math.round(nav.responseEnd - nav.responseStart),
          domParsing: Math.round(nav.domInteractive - nav.responseEnd),
          domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
          loadEvent: Math.round(nav.loadEventEnd - nav.startTime),
          transferSize: nav.transferSize,
          encodedBodySize: nav.encodedBodySize,
        } : null,
        firstPaint: fp ? Math.round(fp.startTime) : null,
        firstContentfulPaint: fcp ? Math.round(fcp.startTime) : null,
        largestContentfulPaint: lcp ? Math.round(lcp.startTime) : null,
        cumulativeLayoutShift: parseFloat(cls.toFixed(4)),
        resourceCount: resources.length,
        resources: resources.map(r => ({
          name: r.name.substring(0, 200),
          type: r.initiatorType,
          duration: Math.round(r.duration),
          transferSize: r.transferSize,
          encodedBodySize: r.encodedBodySize,
        })),
      };
    } catch { return {}; }
  });
}

async function checkSpaRouting(page, baseUrl) {
  const routes = [];
  try {
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.href)
        .filter(h => h.startsWith(window.location.origin) && h !== window.location.href)
        .slice(0, 5)
    );

    for (const link of links) {
      try {
        await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 8000 });
        await new Promise(r => setTimeout(r, 1000));
        const title = await page.title();
        const elemCount = await page.evaluate(() => document.querySelectorAll('*').length);
        routes.push({ url: link, title, elementCount: elemCount, success: true });
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        routes.push({ url: link, error: err.message, success: false });
      }
    }
  } catch {}
  return routes;
}

async function jsRender(browser, url, options = {}) {
  const { timeout = 30000, checkRouting = false } = options;
  const renderId = uuidv4();
  let page = null;

  try {
    page = await createRenderPage(browser, timeout);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    await waitForFrameworkRender(page, Math.min(timeout - 5000, 10000));
    await new Promise(r => setTimeout(r, 1500));

    const [detectedFrameworks, renderedContent, renderPerformance] = await Promise.all([
      detectFrameworks(page),
      extractRenderedContent(page),
      measureRenderPerformance(page),
    ]);

    let routeInfo = [];
    if (checkRouting) {
      routeInfo = await checkSpaRouting(page, url);
    }

    return {
      renderId,
      url,
      html: renderedContent.html,
      detectedFrameworks,
      renderedContent,
      renderPerformance,
      routeInfo,
      timestamp: new Date().toISOString(),
    };
  } finally {
    if (page) {
      try { await page.close(); } catch {}
    }
  }
}

module.exports = { jsRender };