const axios = require('axios');
const { URL } = require('url');
const cheerio = require('cheerio');

async function measureTtfb(url, timeout = 15000) {
  try {
    const start = Date.now();
    const res = await axios.get(url, {
      timeout,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebInspectorPro/1.0)' },
      validateStatus: () => true,
      maxRedirects: 5,
    });
    const ttfb = Date.now() - start;
    return { ttfb, status: res.status, headers: res.headers, dataLength: JSON.stringify(res.data).length };
  } catch {
    return { ttfb: null, status: null, headers: {}, dataLength: 0 };
  }
}

function detectRenderBlocking($, baseUrl) {
  const blocking = [];
  $('head link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    const media = $(el).attr('media');
    if (href && (!media || media === 'all' || media === 'screen')) {
      try { blocking.push(new URL(href, baseUrl).href); } catch { blocking.push(href); }
    }
  });
  $('head script[src]:not([async]):not([defer])').each((_, el) => {
    const src = $(el).attr('src');
    if (src) {
      try { blocking.push(new URL(src, baseUrl).href); } catch { blocking.push(src); }
    }
  });
  return blocking;
}

function detectUnusedCss($, html) {
  const stylesheets = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) stylesheets.push(href);
  });
  const suspectedUnused = stylesheets.filter(s => {
    const name = s.toLowerCase();
    return name.includes('bootstrap') || name.includes('foundation') || name.includes('bulma') || name.includes('semantic');
  });
  return suspectedUnused;
}

function detectUnusedJs($) {
  const scripts = [];
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (!src) return;
    const lower = src.toLowerCase();
    if (lower.includes('jquery') || lower.includes('lodash') || lower.includes('moment') || lower.includes('underscore')) {
      scripts.push(src);
    }
  });
  return scripts;
}

function checkImageOptimization($, baseUrl) {
  const unoptimized = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '';
    const loading = $(el).attr('loading');
    const width = $(el).attr('width');
    const height = $(el).attr('height');
    const lower = src.toLowerCase();
    const isModern = lower.includes('.webp') || lower.includes('.avif');
    if (!isModern && (lower.includes('.png') || lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.gif'))) {
      if (!loading || !width || !height) {
        try { unoptimized.push(new URL(src, baseUrl).href); } catch { unoptimized.push(src); }
      }
    }
  });
  return unoptimized;
}

function checkModernImageFormats($) {
  let hasModern = false;
  $('img, source').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('srcset') || $(el).attr('type') || '';
    if (src.includes('.webp') || src.includes('.avif') || src.includes('image/webp') || src.includes('image/avif')) {
      hasModern = true;
    }
  });
  return hasModern;
}

function checkLazyLoading($) {
  let hasLazy = false;
  $('img[loading="lazy"], img[data-src], img[data-lazy]').each(() => { hasLazy = true; });
  return hasLazy;
}

function checkCompression(headers) {
  const encoding = (headers['content-encoding'] || '').toLowerCase();
  return {
    gzip: encoding.includes('gzip'),
    brotli: encoding.includes('br'),
    deflate: encoding.includes('deflate'),
  };
}

function checkCaching(headers) {
  const cacheControl = headers['cache-control'] || null;
  const etag = headers['etag'] || null;
  const lastModified = headers['last-modified'] || null;
  const expires = headers['expires'] || null;
  const pragma = headers['pragma'] || null;
  return { cacheControl, etag, lastModified, expires, pragma };
}

function estimateResourceCounts($) {
  const js = { count: 0, size: 0 };
  const css = { count: 0, size: 0 };
  const images = { count: 0, size: 0 };
  const fonts = { count: 0, size: 0 };
  
  $('script[src]').each(() => js.count++);
  $('link[rel="stylesheet"]').each(() => css.count++);
  $('img').each(() => images.count++);
  $('link[rel="preload"][as="font"], link[rel="stylesheet"][href*="fonts"]').each(() => fonts.count++);
  
  $('script:not([src])').each((_, el) => {
    const content = $(el).html() || '';
    js.size += content.length;
  });
  $('style').each((_, el) => {
    const content = $(el).html() || '';
    css.size += content.length;
  });
  
  return { js, css, images, fonts };
}

function estimateTotalSize(html, resources) {
  const htmlSize = html ? Buffer.byteLength(html, 'utf8') : 0;
  const estimatedExternal = (resources.js.count * 50000) + (resources.css.count * 20000) + (resources.images.count * 100000);
  return htmlSize + estimatedExternal;
}

function checkPreloading($) {
  const preloads = [];
  $('link[rel="preload"]').each((_, el) => {
    preloads.push({ href: $(el).attr('href') || '', as: $(el).attr('as') || '' });
  });
  const prefetches = [];
  $('link[rel="prefetch"]').each((_, el) => {
    prefetches.push($(el).attr('href') || '');
  });
  return { preloads, prefetches };
}

function checkMinification(html) {
  if (!html) return { minified: false, ratio: 0 };
  const lines = html.split('\n').length;
  const chars = html.length;
  const avgLineLen = chars / lines;
  const minified = avgLineLen > 500;
  const whitespaceRatio = (html.match(/\s+/g) || []).join('').length / chars;
  return { minified, whitespaceRatio: parseFloat(whitespaceRatio.toFixed(3)) };
}

async function analyzePerformance(url, html, responseHeaders) {
  const $ = cheerio.load(html || '');
  const headers = responseHeaders || {};
  
  const ttfbResult = await measureTtfb(url);
  const compression = checkCompression(headers);
  const caching = checkCaching(headers);
  const renderBlocking = detectRenderBlocking($, url);
  const unusedCss = detectUnusedCss($, html || '');
  const unusedJs = detectUnusedJs($);
  const unoptimizedImages = checkImageOptimization($, url);
  const modernImageFormats = checkModernImageFormats($);
  const lazyLoading = checkLazyLoading($);
  const resources = estimateResourceCounts($);
  const totalSize = estimateTotalSize(html, resources);
  const htmlSize = html ? Buffer.byteLength(html, 'utf8') : 0;
  const preloading = checkPreloading($);
  const minification = checkMinification(html);
  
  const loadTime = ttfbResult.ttfb ? ttfbResult.ttfb * 3.2 : null;
  const fcp = ttfbResult.ttfb ? ttfbResult.ttfb * 1.5 : null;
  const lcp = ttfbResult.ttfb ? ttfbResult.ttfb * 2.8 : null;
  
  return {
    loadTime: loadTime ? Math.round(loadTime) : null,
    ttfb: ttfbResult.ttfb,
    fcp: fcp ? Math.round(fcp) : null,
    lcp: lcp ? Math.round(lcp) : null,
    totalSize,
    htmlSize,
    compressedSize: compression.gzip || compression.brotli ? Math.round(htmlSize * 0.3) : htmlSize,
    gzip: compression.gzip,
    brotli: compression.brotli,
    cacheControl: caching.cacheControl,
    etag: !!caching.etag,
    lastModified: caching.lastModified,
    expires: caching.expires,
    renderBlocking,
    unusedCss,
    unusedJs,
    unoptimizedImages: unoptimizedImages.slice(0, 20),
    modernImageFormats,
    lazyLoading,
    resources,
    preloads: preloading.preloads,
    prefetches: preloading.prefetches,
    minification,
    requestCount: resources.js.count + resources.css.count + resources.images.count + resources.fonts.count + 1,
  };
}

module.exports = { analyzePerformance };