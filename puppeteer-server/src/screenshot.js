const { v4: uuidv4 } = require('uuid');

const VIEWPORT_CONFIGS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true },
  mobile: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true },
};

const BLOCKED_RESOURCE_TYPES = ['font', 'media'];

const BLOCKED_DOMAINS = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'facebook.net',
  'hotjar.com',
  'fullstory.com',
];

async function createPage(browser, viewport = 'desktop', blockAds = true) {
  const page = await browser.newPage();
  
  await page.setViewport(VIEWPORT_CONFIGS[viewport] || VIEWPORT_CONFIGS.desktop);
  
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );
  
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  });
  
  if (blockAds) {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      const url = req.url();
      if (BLOCKED_RESOURCE_TYPES.includes(type)) {
        req.abort();
        return;
      }
      if (BLOCKED_DOMAINS.some(d => url.includes(d))) {
        req.abort();
        return;
      }
      req.continue();
    });
  }
  
  page.on('error', () => {});
  page.on('pageerror', () => {});
  
  return page;
}

async function waitForPageLoad(page, timeout = 15000) {
  try {
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout }),
      new Promise(resolve => setTimeout(resolve, timeout)),
    ]);
  } catch {}
  
  try {
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 });
  } catch {}
}

async function dismissDialogs(page) {
  page.on('dialog', async (dialog) => {
    try { await dialog.dismiss(); } catch {}
  });
}

async function closeCookieBanners(page) {
  const selectors = [
    '[id*="cookie"] button[class*="accept"]',
    '[class*="cookie"] button[class*="accept"]',
    '[id*="gdpr"] button[class*="accept"]',
    '[class*="consent"] button[class*="agree"]',
    '#onetrust-accept-btn-handler',
    '.cc-accept',
    '.cookieConsent button',
    '[data-testid="cookie-accept"]',
  ];
  
  for (const selector of selectors) {
    try {
      const el = await page.$(selector);
      if (el) {
        await el.click();
        await new Promise(r => setTimeout(r, 500));
        break;
      }
    } catch {}
  }
}

async function takeScreenshot(browser, url, options = {}) {
  const {
    viewport = 'desktop',
      fullPage = true,
      format = 'jpeg',
      quality = 80,
      timeout = 25000,
      blockAds = true,
  } = options;
  
  const screenshotId = uuidv4();
  let page = null;
  
  try {
    page = await createPage(browser, viewport, blockAds);
    dismissDialogs(page);
    
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout,
    });
    
    await waitForPageLoad(page, Math.min(timeout - 5000, 12000));
    await closeCookieBanners(page);
    await new Promise(r => setTimeout(r, 1000));
    
    if (fullPage) {
      try {
        const bodyHeight = await page.evaluate(() => {
          return Math.min(document.body.scrollHeight, 15000);
        });
        await page.setViewport({
          ...VIEWPORT_CONFIGS[viewport],
          height: bodyHeight,
        });
      } catch {}
    }
    
    const screenshotBuffer = await page.screenshot({
      type: format,
      quality: format === 'jpeg' ? quality : undefined,
      fullPage,
      encoding: 'base64',
    });
    
    const metadata = await page.evaluate(() => ({
      title: document.title,
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      url: window.location.href,
    }));
    
    return {
      id: screenshotId,
      screenshot: `data:image/${format};base64,${screenshotBuffer}`,
      metadata,
      viewport,
      format,
      timestamp: new Date().toISOString(),
    };
  } finally {
    if (page) {
      try { await page.close(); } catch {}
    }
  }
}

async function takeMultiViewportScreenshots(browser, url, timeout = 25000) {
  const viewports = ['desktop', 'tablet', 'mobile'];
  const results = {};
  
  for (const vp of viewports) {
    try {
      const result = await takeScreenshot(browser, url, { viewport: vp, fullPage: false, timeout });
      results[vp] = result;
    } catch (err) {
      results[vp] = { error: err.message };
    }
  }
  
  return results;
}

async function captureElementScreenshot(browser, url, selector, timeout = 20000) {
  let page = null;
  try {
    page = await createPage(browser, 'desktop', false);
    dismissDialogs(page);
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    await waitForPageLoad(page, 8000);
    
    const element = await page.$(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);
    
    const screenshot = await element.screenshot({
      type: 'jpeg',
      quality: 85,
      encoding: 'base64',
    });
    
    const boundingBox = await element.boundingBox();
    return {
      screenshot: `data:image/jpeg;base64,${screenshot}`,
      selector,
      boundingBox,
      timestamp: new Date().toISOString(),
    };
  } finally {
    if (page) {
      try { await page.close(); } catch {}
    }
  }
}

module.exports = { takeScreenshot, takeMultiViewportScreenshots, captureElementScreenshot };