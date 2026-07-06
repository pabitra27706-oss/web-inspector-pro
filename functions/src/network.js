const axios = require('axios');
const { URL } = require('url');
const cheerio = require('cheerio');

const THIRD_PARTY_CATEGORIES = {
  'google-analytics.com': { name: 'Google Analytics', category: 'Analytics' },
  'googletagmanager.com': { name: 'Google Tag Manager', category: 'Tag Manager' },
  'googlesyndication.com': { name: 'Google AdSense', category: 'Advertising' },
  'doubleclick.net': { name: 'Google DoubleClick', category: 'Advertising' },
  'facebook.net': { name: 'Facebook SDK', category: 'Social' },
  'facebook.com': { name: 'Facebook', category: 'Social' },
  'connect.facebook.net': { name: 'Facebook Connect', category: 'Social' },
  'twitter.com': { name: 'Twitter', category: 'Social' },
  'platform.twitter.com': { name: 'Twitter Platform', category: 'Social' },
  'linkedin.com': { name: 'LinkedIn', category: 'Social' },
  'hotjar.com': { name: 'Hotjar', category: 'Analytics' },
  'segment.com': { name: 'Segment', category: 'Analytics' },
  'mixpanel.com': { name: 'Mixpanel', category: 'Analytics' },
  'amplitude.com': { name: 'Amplitude', category: 'Analytics' },
  'fullstory.com': { name: 'FullStory', category: 'Analytics' },
  'intercom.io': { name: 'Intercom', category: 'Customer Support' },
  'intercom.com': { name: 'Intercom', category: 'Customer Support' },
  'zendesk.com': { name: 'Zendesk', category: 'Customer Support' },
  'stripe.com': { name: 'Stripe', category: 'Payments' },
  'paypal.com': { name: 'PayPal', category: 'Payments' },
  'braintreegateway.com': { name: 'Braintree', category: 'Payments' },
  'cloudflare.com': { name: 'Cloudflare', category: 'CDN/Security' },
  'cloudflare.net': { name: 'Cloudflare', category: 'CDN/Security' },
  'cdn.jsdelivr.net': { name: 'jsDelivr', category: 'CDN' },
  'cdnjs.cloudflare.com': { name: 'cdnjs', category: 'CDN' },
  'unpkg.com': { name: 'unpkg', category: 'CDN' },
  'fonts.googleapis.com': { name: 'Google Fonts', category: 'Fonts' },
  'fonts.gstatic.com': { name: 'Google Fonts Static', category: 'Fonts' },
  'sentry.io': { name: 'Sentry', category: 'Error Tracking' },
  'bugsnag.com': { name: 'Bugsnag', category: 'Error Tracking' },
  'datadog-browser-agent.com': { name: 'Datadog', category: 'Monitoring' },
  'newrelic.com': { name: 'New Relic', category: 'Monitoring' },
  'youtube.com': { name: 'YouTube', category: 'Media' },
  'vimeo.com': { name: 'Vimeo', category: 'Media' },
  'amazonaws.com': { name: 'Amazon AWS', category: 'Cloud' },
  'firebase.google.com': { name: 'Firebase', category: 'Cloud' },
  'firebaseapp.com': { name: 'Firebase App', category: 'Cloud' },
  'googleapis.com': { name: 'Google APIs', category: 'APIs' },
  'maps.google.com': { name: 'Google Maps', category: 'Maps' },
  'maps.googleapis.com': { name: 'Google Maps API', category: 'Maps' },
  'recaptcha.net': { name: 'reCAPTCHA', category: 'Security' },
  'google.com/recaptcha': { name: 'reCAPTCHA', category: 'Security' },
  'hubspot.com': { name: 'HubSpot', category: 'Marketing' },
  'mailchimp.com': { name: 'Mailchimp', category: 'Marketing' },
  'crisp.chat': { name: 'Crisp', category: 'Customer Support' },
  'tawk.to': { name: 'Tawk.to', category: 'Customer Support' },
  'pusher.com': { name: 'Pusher', category: 'Realtime' },
  'twilio.com': { name: 'Twilio', category: 'Communications' },
};

const CDN_SIGNATURES = {
  'cloudflare': ['cf-ray', 'cf-cache-status', 'cf-request-id'],
  'fastly': ['x-fastly-request-id', 'fastly-restarts'],
  'akamai': ['x-akamai-request-id', 'x-check-cacheable'],
  'aws-cloudfront': ['x-amz-cf-id', 'x-amz-cf-pop'],
  'vercel': ['x-vercel-id', 'x-vercel-cache'],
  'netlify': ['x-nf-request-id', 'netlify-vary'],
  'bunnycdn': ['cdn-requestid', 'cdn-cache'],
  'keycdn': ['x-edge-location', 'x-cache'],
  'maxcdn': ['x-pull', 'x-cache'],
  'sucuri': ['x-sucuri-id', 'x-sucuri-cache'],
};

const API_ENDPOINT_PATTERNS = [
  /\/api\/v?\d*\//i,
  /\/rest\//i,
  /\/graphql/i,
  /\/gql/i,
  /\/endpoint/i,
  /\/service\//i,
  /\/rpc\//i,
  /\.json$/i,
  /\.xml$/i,
  /\/ajax\//i,
  /\/xhr\//i,
  /\/fetch\//i,
];

const AUTH_TOKEN_PATTERNS = [
  { pattern: /Bearer\s+([A-Za-z0-9\-._~+/]+=*)/g, type: 'Bearer Token' },
  { pattern: /Authorization:\s*([^\s"'<>\n]+)/gi, type: 'Authorization Header' },
  { pattern: /api[_-]?key['":\s=]+([A-Za-z0-9\-_]{20,})/gi, type: 'API Key' },
  { pattern: /access[_-]?token['":\s=]+([A-Za-z0-9\-_]{20,})/gi, type: 'Access Token' },
  { pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/]*/g, type: 'JWT Token' },
  { pattern: /oauth[_-]?token['":\s=]+([A-Za-z0-9\-_]{20,})/gi, type: 'OAuth Token' },
];

function extractUrlsFromHtml(html, baseUrl) {
  const urls = new Set();
  const $ = cheerio.load(html);
  
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) {
      try { urls.add(new URL(src, baseUrl).href); } catch {}
    }
  });
  
  $('link[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      try { urls.add(new URL(href, baseUrl).href); } catch {}
    }
  });
  
  $('img[src], img[data-src]').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (src) {
      try { urls.add(new URL(src, baseUrl).href); } catch {}
    }
  });
  
  $('source[src], source[srcset]').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('srcset');
    if (src) {
      try { urls.add(new URL(src.split(' ')[0], baseUrl).href); } catch {}
    }
  });
  
  const inlineScripts = [];
  $('script:not([src])').each((_, el) => {
    inlineScripts.push($(el).html() || '');
  });
  const inlineContent = inlineScripts.join('\n');
  const urlRegex = /https?:\/\/[^\s"'<>\)]+/g;
  let match;
  while ((match = urlRegex.exec(inlineContent)) !== null) {
    try { urls.add(new URL(match[0]).href); } catch {}
  }
  
  return Array.from(urls);
}

function detectThirdParties(urls, baseHostname) {
  const detected = new Map();
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;
      if (hostname === baseHostname) continue;
      for (const [domain, info] of Object.entries(THIRD_PARTY_CATEGORIES)) {
        if (hostname.endsWith(domain) || hostname.includes(domain)) {
          if (!detected.has(info.name)) {
            detected.set(info.name, { ...info, domain: hostname, url });
          }
        }
      }
      if (!Array.from(detected.values()).some(d => d.domain === hostname)) {
        detected.set(hostname, { name: hostname, category: 'Unknown', domain: hostname, url });
      }
    } catch {}
  }
  return Array.from(detected.values());
}

function detectCdn(headers) {
  for (const [cdn, signatures] of Object.entries(CDN_SIGNATURES)) {
    const headerKeys = Object.keys(headers).map(k => k.toLowerCase());
    if (signatures.some(sig => headerKeys.includes(sig.toLowerCase()))) {
      return { detected: true, provider: cdn, headers: signatures.filter(s => headerKeys.includes(s.toLowerCase())) };
    }
  }
  return { detected: false, provider: null, headers: [] };
}

function extractApiEndpoints(urls, html) {
  const endpoints = new Set();
  
  for (const url of urls) {
    if (API_ENDPOINT_PATTERNS.some(p => p.test(url))) {
      try {
        const parsed = new URL(url);
        endpoints.add(JSON.stringify({ url: parsed.href, method: 'GET', source: 'resource' }));
      } catch {}
    }
  }
  
  const fetchRegex = /fetch\s*\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*\{[^}]*method\s*:\s*['"`]([A-Z]+)['"`])?/gi;
  const axiosRegex = /axios\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  const xhrRegex = /\.open\s*\(\s*['"`]([A-Z]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]/gi;
  const $ = cheerio.load(html);
  
  const inlineJs = [];
  $('script:not([src])').each((_, el) => inlineJs.push($(el).html() || ''));
  const jsContent = inlineJs.join('\n');
  
  let match;
  while ((match = fetchRegex.exec(jsContent)) !== null) {
    endpoints.add(JSON.stringify({ url: match[1], method: match[2] || 'GET', source: 'fetch()' }));
  }
  while ((match = axiosRegex.exec(jsContent)) !== null) {
    endpoints.add(JSON.stringify({ url: match[2], method: match[1].toUpperCase(), source: 'axios' }));
  }
  while ((match = xhrRegex.exec(jsContent)) !== null) {
    endpoints.add(JSON.stringify({ url: match[2], method: match[1], source: 'XMLHttpRequest' }));
  }
  
  return Array.from(endpoints).map(e => {
    try { return JSON.parse(e); } catch { return null; }
  }).filter(Boolean).slice(0, 50);
}

function extractAuthTokens(html) {
  const found = [];
  for (const { pattern, type } of AUTH_TOKEN_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(html)) !== null) {
      const value = match[1] || match[0];
      if (value && value.length > 10) {
        found.push({ type, value: value.substring(0, 100) });
        if (found.length >= 20) break;
      }
    }
  }
  return found;
}

function estimateResourceSizes(urls) {
  const resources = { js: { count: 0, size: 0 }, css: { count: 0, size: 0 }, images: { count: 0, size: 0 }, fonts: { count: 0, size: 0 }, other: { count: 0, size: 0 } };
  for (const url of urls) {
    try {
      const pathname = new URL(url).pathname.toLowerCase();
      if (pathname.endsWith('.js') || pathname.includes('.js?')) { resources.js.count++; }
      else if (pathname.endsWith('.css') || pathname.includes('.css?')) { resources.css.count++; }
      else if (/\.(png|jpg|jpeg|gif|webp|avif|svg|ico)/.test(pathname)) { resources.images.count++; }
      else if (/\.(woff|woff2|ttf|eot|otf)/.test(pathname)) { resources.fonts.count++; }
      else { resources.other.count++; }
    } catch {}
  }
  return resources;
}

async function analyzeNetwork(url, html, responseHeaders) {
  const parsed = new URL(url);
  const baseHostname = parsed.hostname;
  
  const allUrls = extractUrlsFromHtml(html, url);
  const thirdParties = detectThirdParties(allUrls, baseHostname);
  const cdnInfo = detectCdn(responseHeaders || {});
  const apiEndpoints = extractApiEndpoints(allUrls, html);
  const authTokens = extractAuthTokens(html);
  const resources = estimateResourceSizes(allUrls);
  
  const totalRequests = allUrls.length;
  const totalSize = Object.values(resources).reduce((acc, r) => acc + (r.size || 0), 0);
  
  return {
    totalRequests,
    totalSize,
    allUrls: allUrls.slice(0, 100),
    thirdParties,
    cdnDetected: cdnInfo.detected,
    cdnProvider: cdnInfo.provider,
    cdnHeaders: cdnInfo.headers,
    apiEndpoints,
    authTokens,
    resources,
    responseHeaders: responseHeaders || {},
  };
}

module.exports = { analyzeNetwork };