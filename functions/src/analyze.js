const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

const PROXY_LIST = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

async function fetchWithProxy(url, proxyIndex = 0, timeout = 20000) {
  if (proxyIndex >= PROXY_LIST.length) {
    throw new Error('All proxies exhausted');
  }
  try {
    const proxied = PROXY_LIST[proxyIndex](url);
    const response = await axios.get(proxied, {
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WebInspectorPro/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      maxRedirects: 5,
    });
    return { data: response.data, headers: response.headers, status: response.status };
  } catch {
    return fetchWithProxy(url, proxyIndex + 1, timeout);
  }
}

async function fetchDirect(url, timeout = 20000) {
  const response = await axios.get(url, {
    timeout,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; WebInspectorPro/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    maxRedirects: 5,
    validateStatus: () => true,
  });
  return { data: response.data, headers: response.headers, status: response.status };
}

function detectFramework($, html) {
  const lowerHtml = html.toLowerCase();
  const frameworks = [
    { name: 'React', patterns: ['react.js', 'react.min.js', 'react-dom', '__react', 'data-reactroot', 'data-reactid'] },
    { name: 'Vue.js', patterns: ['vue.js', 'vue.min.js', '__vue__', 'v-bind', 'v-model', 'v-on:', '@click'] },
    { name: 'Angular', patterns: ['angular.js', 'angular.min.js', 'ng-app', 'ng-controller', 'ng-model', 'angular/core'] },
    { name: 'Next.js', patterns: ['__next', '_next/static', '__NEXT_DATA__', 'next/dist'] },
    { name: 'Nuxt.js', patterns: ['__nuxt', '_nuxt/', '__NUXT__'] },
    { name: 'Svelte', patterns: ['svelte', '__svelte'] },
    { name: 'Gatsby', patterns: ['gatsby', '___gatsby'] },
    { name: 'WordPress', patterns: ['wp-content', 'wp-includes', 'wordpress'] },
    { name: 'Shopify', patterns: ['shopify', 'cdn.shopify.com', 'myshopify.com'] },
    { name: 'Bootstrap', patterns: ['bootstrap.css', 'bootstrap.min.css', 'bootstrap.js'] },
    { name: 'Tailwind CSS', patterns: ['tailwindcss', 'tailwind.css'] },
    { name: 'jQuery', patterns: ['jquery.js', 'jquery.min.js', 'jquery-'] },
    { name: 'Laravel', patterns: ['laravel', 'csrf-token', 'app.js', 'mix-manifest'] },
    { name: 'Django', patterns: ['django', 'csrfmiddlewaretoken'] },
    { name: 'Ruby on Rails', patterns: ['rails', 'action_cable', 'turbolinks'] },
  ];

  const detected = [];
  for (const fw of frameworks) {
    if (fw.patterns.some(p => lowerHtml.includes(p))) {
      detected.push(fw.name);
    }
  }
  return detected.length > 0 ? detected[0] : 'Custom/Unknown';
}

function detectLibraries($, html) {
  const lowerHtml = html.toLowerCase();
  const libraries = [
    'jquery', 'lodash', 'underscore', 'moment', 'dayjs', 'axios', 'fetch',
    'three.js', 'chart.js', 'd3.js', 'socket.io', 'gsap', 'anime.js',
    'swiper', 'slick', 'owl carousel', 'aos', 'scrollreveal',
    'webpack', 'parcel', 'rollup', 'vite', 'esbuild',
    'typescript', 'babel', 'eslint', 'prettier',
    'redux', 'mobx', 'zustand', 'pinia', 'vuex',
    'graphql', 'apollo', 'relay',
    'firebase', 'supabase', 'amplify',
    'stripe', 'paypal', 'braintree',
    'google analytics', 'gtag', 'hotjar', 'segment', 'mixpanel',
    'sentry', 'datadog', 'new relic',
    'cloudflare', 'fastly',
    'font awesome', 'material icons', 'heroicons',
  ];
  return libraries.filter(lib => lowerHtml.includes(lib));
}

function extractLinks($, baseUrl) {
  const links = [];
  const base = new URL(baseUrl);
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    try {
      const resolved = new URL(href, baseUrl).href;
      const parsed = new URL(resolved);
      links.push({
        href: resolved,
        text: $(el).text().trim().substring(0, 100),
        external: parsed.hostname !== base.hostname,
        nofollow: ($(el).attr('rel') || '').includes('nofollow'),
      });
    } catch {}
  });
  return links;
}

function extractImages($, baseUrl) {
  const images = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy');
    if (!src) return;
    try {
      const resolved = new URL(src, baseUrl).href;
      images.push({
        src: resolved,
        alt: $(el).attr('alt') || '',
        hasAlt: !!($(el).attr('alt')),
        width: $(el).attr('width') || null,
        height: $(el).attr('height') || null,
        loading: $(el).attr('loading') || null,
      });
    } catch {}
  });
  return images;
}

function extractScripts($, baseUrl) {
  const scripts = [];
  $('script').each((_, el) => {
    const src = $(el).attr('src');
    const content = $(el).html();
    const isExternal = !!src;
    scripts.push({
      src: src ? (() => { try { return new URL(src, baseUrl).href; } catch { return src; } })() : null,
      type: $(el).attr('type') || 'text/javascript',
      async: $(el).attr('async') !== undefined,
      defer: $(el).attr('defer') !== undefined,
      external: isExternal,
      inline: !isExternal,
      contentLength: content ? content.length : 0,
    });
  });
  return scripts;
}

function extractStylesheets($, baseUrl) {
  const sheets = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      sheets.push({
        href: new URL(href, baseUrl).href,
        media: $(el).attr('media') || 'all',
      });
    } catch {}
  });
  $('style').each((_, el) => {
    sheets.push({ href: null, inline: true, contentLength: ($(el).html() || '').length });
  });
  return sheets;
}

function extractForms($) {
  const forms = [];
  $('form').each((_, el) => {
    const inputs = $(el).find('input, textarea, select');
    const fields = [];
    inputs.each((_, inp) => {
      fields.push({
        type: $(inp).attr('type') || $(inp).prop('tagName').toLowerCase(),
        name: $(inp).attr('name') || '',
        placeholder: $(inp).attr('placeholder') || '',
        required: $(inp).attr('required') !== undefined,
        autocomplete: $(inp).attr('autocomplete') || null,
      });
    });
    forms.push({
      action: $(el).attr('action') || '',
      method: ($(el).attr('method') || 'GET').toUpperCase(),
      fields: inputs.length,
      fieldDetails: fields,
      hasPasswordField: fields.some(f => f.type === 'password'),
      hasFileField: fields.some(f => f.type === 'file'),
      enctype: $(el).attr('enctype') || null,
    });
  });
  return forms;
}

function extractIframes($, baseUrl) {
  const iframes = [];
  $('iframe').each((_, el) => {
    const src = $(el).attr('src');
    iframes.push({
      src: src ? (() => { try { return new URL(src, baseUrl).href; } catch { return src; } })() : null,
      width: $(el).attr('width') || null,
      height: $(el).attr('height') || null,
      sandbox: $(el).attr('sandbox') || null,
      allowFullscreen: $(el).attr('allowfullscreen') !== undefined,
    });
  });
  return iframes;
}

function extractHiddenElements($) {
  const hidden = [];
  $('[style*="display:none"], [style*="display: none"], [hidden], [style*="visibility:hidden"]').each((_, el) => {
    hidden.push({
      tag: $(el).prop('tagName').toLowerCase(),
      id: $(el).attr('id') || null,
      class: $(el).attr('class') || null,
      text: $(el).text().trim().substring(0, 100),
    });
  });
  return hidden;
}

function extractComments(html) {
  const comments = [];
  const regex = /<!--([\s\S]*?)-->/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const comment = match[1].trim();
    if (comment && !comment.startsWith('[if') && !comment.startsWith('<![')) {
      comments.push(comment.substring(0, 300));
    }
  }
  return comments;
}

function countTotalElements($) {
  return $('*').length;
}

async function analyzeHtml(url, html) {
  if (!html || html.length < 10) return { error: 'No HTML content' };
  const $ = cheerio.load(html);
  const framework = detectFramework($, html);
  const libraries = detectLibraries($, html);
  const links = extractLinks($, url);
  const images = extractImages($, url);
  const scripts = extractScripts($, url);
  const stylesheets = extractStylesheets($, url);
  const forms = extractForms($);
  const iframes = extractIframes($, url);
  const hiddenElements = extractHiddenElements($);
  const comments = extractComments(html);
  const totalElements = countTotalElements($);

  return {
    framework,
    libraries,
    links,
    images,
    scripts,
    stylesheets,
    forms,
    iframes,
    hiddenElements,
    comments,
    totalElements,
    rawSource: html.substring(0, 50000),
    title: $('title').text().trim(),
    lang: $('html').attr('lang') || null,
    charset: $('meta[charset]').attr('charset') || $('meta[http-equiv="Content-Type"]').attr('content') || null,
  };
}

function calculateScores(results) {
  const scores = {};

  let secScore = 100;
  const sec = results.security || {};
  if (!sec.https) secScore -= 30;
  if (!sec.ssl?.valid) secScore -= 20;
  if (sec.apiKeys?.length > 0) secScore -= sec.apiKeys.length * 10;
  if (sec.credentials?.length > 0) secScore -= sec.credentials.length * 15;
  if (sec.xssHints?.length > 0) secScore -= sec.xssHints.length * 5;
  if (sec.sqliPoints?.length > 0) secScore -= sec.sqliPoints.length * 8;
  const missingHeaders = (sec.headers || []).filter(h => !h.present).length;
  secScore -= missingHeaders * 4;
  if (sec.cors?.risk === 'high') secScore -= 10;
  scores.security = Math.max(0, Math.min(100, secScore));

  let perfScore = 100;
  const perf = results.performance || {};
  if (perf.loadTime > 5000) perfScore -= 30;
  else if (perf.loadTime > 3000) perfScore -= 15;
  else if (perf.loadTime > 1500) perfScore -= 5;
  if (perf.renderBlocking?.length > 0) perfScore -= perf.renderBlocking.length * 5;
  if (perf.unoptimizedImages?.length > 0) perfScore -= Math.min(20, perf.unoptimizedImages.length * 3);
  if (!perf.gzip && !perf.brotli) perfScore -= 10;
  if (perf.totalSize > 5000000) perfScore -= 15;
  else if (perf.totalSize > 2000000) perfScore -= 8;
  scores.performance = Math.max(0, Math.min(100, perfScore));

  let seoScore = 100;
  const seo = results.seo || {};
  if (!seo.title) seoScore -= 20;
  if (!seo.description) seoScore -= 15;
  if (!seo.canonical) seoScore -= 5;
  if (!seo.ogTags?.['og:title']) seoScore -= 5;
  if (!seo.ogTags?.['og:image']) seoScore -= 5;
  const h1Count = seo.headings?.h1?.length || 0;
  if (h1Count === 0) seoScore -= 10;
  if (h1Count > 1) seoScore -= 5;
  const imgWithoutAlt = seo.images?.withoutAlt || 0;
  if (imgWithoutAlt > 0) seoScore -= Math.min(15, imgWithoutAlt * 2);
  if (!seo.schema?.length) seoScore -= 5;
  scores.seo = Math.max(0, Math.min(100, seoScore));

  let designScore = 100;
  const design = results.design || {};
  if (!design.responsive) designScore -= 25;
  if (!design.colors?.length) designScore -= 10;
  if (!design.fonts?.length) designScore -= 5;
  if (!design.framework) designScore -= 5;
  scores.design = Math.max(0, Math.min(100, designScore));

  return scores;
}

module.exports = {
  fetchWithProxy,
  fetchDirect,
  analyzeHtml,
  calculateScores,
  detectFramework,
  detectLibraries,
};