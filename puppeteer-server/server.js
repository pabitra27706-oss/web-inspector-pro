require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const puppeteer = require('puppeteer');

const { takeScreenshot, takeMultiViewportScreenshots } = require('./src/screenshot');
const { deepScan } = require('./src/deepScan');
const { jsRender } = require('./src/jsRender');

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_SECRET = process.env.SERVER_SECRET || '';
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_BROWSERS || '3');

let browserPool = [];
let activeBrowsers = 0;

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '5mb' }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use(limiter);

function authMiddleware(req, res, next) {
  if (!SERVER_SECRET) return next();
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (token !== SERVER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function validateUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch { return false; }
}

async function getBrowser() {
  if (activeBrowsers >= MAX_CONCURRENT) {
    throw new Error('Browser pool exhausted. Please try again.');
  }
  activeBrowsers++;
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--window-size=1440,900',
    ],
    defaultViewport: { width: 1440, height: 900 },
    timeout: 30000,
  });
  return browser;
}

async function releaseBrowser(browser) {
  activeBrowsers = Math.max(0, activeBrowsers - 1);
  try { await browser.close(); } catch {}
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeBrowsers,
    maxConcurrent: MAX_CONCURRENT,
    timestamp: new Date().toISOString(),
  });
});

app.post('/screenshot', authMiddleware, async (req, res) => {
  const { url, viewport = 'desktop', fullPage = true, format = 'jpeg', quality = 80 } = req.body;
  
  if (!validateUrl(url)) {
    return res.status(400).json({ error: 'Invalid or missing URL.' });
  }
  
  let browser = null;
  try {
    browser = await getBrowser();
    const timeout = parseInt(process.env.SCREENSHOT_TIMEOUT || '25000');
    const result = await takeScreenshot(browser, url, { viewport, fullPage, format, quality, timeout });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Screenshot error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await releaseBrowser(browser);
  }
});

app.post('/screenshot/multi', authMiddleware, async (req, res) => {
  const { url } = req.body;
  
  if (!validateUrl(url)) {
    return res.status(400).json({ error: 'Invalid or missing URL.' });
  }
  
  let browser = null;
  try {
    browser = await getBrowser();
    const timeout = parseInt(process.env.SCREENSHOT_TIMEOUT || '25000');
    const results = await takeMultiViewportScreenshots(browser, url, timeout);
    res.json({ success: true, screenshots: results });
  } catch (err) {
    console.error('Multi-screenshot error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await releaseBrowser(browser);
  }
});

app.post('/deep-scan', authMiddleware, async (req, res) => {
  const { url } = req.body;
  
  if (!validateUrl(url)) {
    return res.status(400).json({ error: 'Invalid or missing URL.' });
  }
  
  let browser = null;
  try {
    browser = await getBrowser();
    const timeout = parseInt(process.env.DEEP_SCAN_TIMEOUT || '30000');
    const result = await deepScan(browser, url, timeout);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Deep scan error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await releaseBrowser(browser);
  }
});

app.post('/js-render', authMiddleware, async (req, res) => {
  const { url, checkRouting = false } = req.body;
  
  if (!validateUrl(url)) {
    return res.status(400).json({ error: 'Invalid or missing URL.' });
  }
  
  let browser = null;
  try {
    browser = await getBrowser();
    const timeout = parseInt(process.env.JS_RENDER_TIMEOUT || '30000');
    const result = await jsRender(browser, url, { timeout, checkRouting });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('JS render error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await releaseBrowser(browser);
  }
});

app.post('/full-scan', authMiddleware, async (req, res) => {
  const { url, includeScreenshot = true, includeDeepScan = true, includeJsRender = false } = req.body;
  
  if (!validateUrl(url)) {
    return res.status(400).json({ error: 'Invalid or missing URL.' });
  }
  
  if (activeBrowsers + 2 > MAX_CONCURRENT) {
    return res.status(429).json({ error: 'Server busy. Please try again shortly.' });
  }
  
  const results = {};
  const errors = {};
  
  if (includeDeepScan) {
    let browser = null;
    try {
      browser = await getBrowser();
      const timeout = parseInt(process.env.DEEP_SCAN_TIMEOUT || '30000');
      results.deepScan = await deepScan(browser, url, timeout);
    } catch (err) {
      errors.deepScan = err.message;
    } finally {
      if (browser) await releaseBrowser(browser);
    }
  }
  
  if (includeScreenshot) {
    let browser = null;
    try {
      browser = await getBrowser();
      const timeout = parseInt(process.env.SCREENSHOT_TIMEOUT || '25000');
      const screenshotResult = await takeScreenshot(browser, url, { viewport: 'desktop', fullPage: true, timeout });
      results.screenshot = screenshotResult.screenshot;
    } catch (err) {
      errors.screenshot = err.message;
    } finally {
      if (browser) await releaseBrowser(browser);
    }
  }
  
  if (includeJsRender) {
    let browser = null;
    try {
      browser = await getBrowser();
      const timeout = parseInt(process.env.JS_RENDER_TIMEOUT || '30000');
      results.jsRender = await jsRender(browser, url, { timeout });
    } catch (err) {
      errors.jsRender = err.message;
    } finally {
      if (browser) await releaseBrowser(browser);
    }
  }
  
  res.json({ success: true, url, results, errors, timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Puppeteer server running on port ${PORT}`);
});

module.exports = app;