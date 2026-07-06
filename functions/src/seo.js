const cheerio = require('cheerio');
const { URL } = require('url');

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
  'it', 'its', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'their',
  'what', 'which', 'who', 'how', 'when', 'where', 'why', 'not', 'no',
  'as', 'if', 'so', 'than', 'then', 'into', 'about', 'up', 'out', 'more',
]);

function extractMetaTags($) {
  const meta = {};
  $('meta').each((_, el) => {
    const name = $(el).attr('name') || $(el).attr('property') || $(el).attr('http-equiv');
    const content = $(el).attr('content');
    if (name && content) meta[name.toLowerCase()] = content;
  });
  return meta;
}

function extractTitle($) {
  return $('title').first().text().trim() || null;
}

function extractDescription($, meta) {
  return meta['description'] || meta['og:description'] || null;
}

function extractKeywords($, meta) {
  return meta['keywords'] || null;
}

function extractCanonical($) {
  return $('link[rel="canonical"]').attr('href') || null;
}

function extractRobots($, meta) {
  return meta['robots'] || $('meta[name="robots"]').attr('content') || null;
}

function extractViewport($) {
  return $('meta[name="viewport"]').attr('content') || null;
}

function extractOgTags($) {
  const og = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr('property');
    const content = $(el).attr('content');
    if (prop && content) og[prop] = content;
  });
  return og;
}

function extractTwitterTags($) {
  const twitter = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr('name');
    const content = $(el).attr('content');
    if (name && content) twitter[name] = content;
  });
  return twitter;
}

function extractHeadings($) {
  const headings = { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] };
  ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
    $(tag).each((_, el) => {
      const text = $(el).text().trim();
      if (text) headings[tag].push(text.substring(0, 200));
    });
  });
  return headings;
}

function analyzeImages($) {
  let total = 0;
  let withAlt = 0;
  let withoutAlt = 0;
  const missingAlt = [];

  $('img').each((_, el) => {
    total++;
    const alt = $(el).attr('alt');
    const src = $(el).attr('src') || '';
    if (alt !== undefined && alt !== null) {
      withAlt++;
    } else {
      withoutAlt++;
      if (missingAlt.length < 10) missingAlt.push(src.substring(0, 100));
    }
  });

  return { total, withAlt, withoutAlt, missingAlt };
}

function extractSchema($) {
  const schemas = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (!content) return;
      const parsed = JSON.parse(content);
      const type = parsed['@type'] || parsed['@graph']?.[0]?.['@type'] || 'Unknown';
      schemas.push({ type, data: parsed });
    } catch {}
  });

  $('[itemscope]').each((_, el) => {
    const itemtype = $(el).attr('itemtype') || '';
    const type = itemtype.split('/').pop() || 'Microdata';
    schemas.push({ type, data: { format: 'microdata', itemtype } });
  });

  return schemas.slice(0, 10);
}

function extractTopKeywords(html, $) {
  const text = $('body').text().toLowerCase();
  const words = text.match(/\b[a-zA-Z]{3,}\b/g) || [];
  const freq = {};
  for (const word of words) {
    if (!STOP_WORDS.has(word)) {
      freq[word] = (freq[word] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }));
}

function checkMobileFriendly($) {
  const viewport = $('meta[name="viewport"]').attr('content') || '';
  const hasViewport = viewport.includes('width=device-width');
  const hasMediaQueries = $('style').text().includes('@media');
  return hasViewport || hasMediaQueries;
}

function checkHreflang($) {
  const hreflang = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    hreflang.push({
      lang: $(el).attr('hreflang'),
      href: $(el).attr('href'),
    });
  });
  return hreflang;
}

function checkPagination($) {
  const prev = $('link[rel="prev"]').attr('href') || null;
  const next = $('link[rel="next"]').attr('href') || null;
  return { prev, next, hasPagination: !!(prev || next) };
}

function analyzeTitleLength(title) {
  if (!title) return { length: 0, status: 'missing' };
  const len = title.length;
  if (len < 30) return { length: len, status: 'too_short' };
  if (len > 60) return { length: len, status: 'too_long' };
  return { length: len, status: 'optimal' };
}

function analyzeDescriptionLength(description) {
  if (!description) return { length: 0, status: 'missing' };
  const len = description.length;
  if (len < 70) return { length: len, status: 'too_short' };
  if (len > 160) return { length: len, status: 'too_long' };
  return { length: len, status: 'optimal' };
}

function checkInternalLinks($, baseUrl) {
  let internal = 0;
  let external = 0;
  let nofollow = 0;
  let broken = [];
  try {
    const base = new URL(baseUrl);
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const rel = $(el).attr('rel') || '';
      if (rel.includes('nofollow')) nofollow++;
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      try {
        const parsed = new URL(href, baseUrl);
        if (parsed.hostname === base.hostname) internal++;
        else external++;
      } catch {}
    });
  } catch {}
  return { internal, external, nofollow };
}

function extractFavicon($, baseUrl) {
  const favicon = $('link[rel="icon"]').attr('href') ||
    $('link[rel="shortcut icon"]').attr('href') ||
    $('link[rel="apple-touch-icon"]').attr('href') || null;
  if (!favicon) return null;
  try { return new URL(favicon, baseUrl).href; } catch { return favicon; }
}

function checkAmpVersion($) {
  const ampLink = $('link[rel="amphtml"]').attr('href') || null;
  const isAmp = $('html[amp], html[⚡]').length > 0;
  return { hasAmp: !!ampLink || isAmp, ampUrl: ampLink };
}

function extractSocialProfiles($) {
  const profiles = [];
  const socialDomains = ['twitter.com', 'facebook.com', 'linkedin.com', 'instagram.com', 'youtube.com', 'github.com', 'pinterest.com', 'tiktok.com'];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    try {
      const parsed = new URL(href);
      if (socialDomains.some(d => parsed.hostname.includes(d))) {
        if (!profiles.includes(href)) profiles.push(href);
      }
    } catch {}
  });
  return profiles.slice(0, 10);
}

function calculateSeoScore(data) {
  let score = 100;
  if (!data.title) score -= 20;
  else if (data.titleAnalysis?.status !== 'optimal') score -= 8;
  if (!data.description) score -= 15;
  else if (data.descriptionAnalysis?.status !== 'optimal') score -= 5;
  if (!data.canonical) score -= 5;
  if (!data.ogTags?.['og:title']) score -= 5;
  if (!data.ogTags?.['og:image']) score -= 5;
  if (!data.ogTags?.['og:description']) score -= 3;
  const h1Count = data.headings?.h1?.length || 0;
  if (h1Count === 0) score -= 10;
  if (h1Count > 1) score -= 5;
  const withoutAlt = data.images?.withoutAlt || 0;
  if (withoutAlt > 0) score -= Math.min(15, withoutAlt * 2);
  if (!data.schema?.length) score -= 5;
  if (!data.mobileFriendly) score -= 10;
  if (!data.hreflang?.length) score -= 2;
  return Math.max(0, Math.min(100, score));
}

function analyzeSeo(url, html) {
  if (!html) return { error: 'No HTML content' };
  const $ = cheerio.load(html);

  const meta = extractMetaTags($);
  const title = extractTitle($);
  const description = extractDescription($, meta);
  const keywords = extractKeywords($, meta);
  const canonical = extractCanonical($);
  const robots = extractRobots($, meta);
  const viewport = extractViewport($);
  const ogTags = extractOgTags($);
  const twitterTags = extractTwitterTags($);
  const headings = extractHeadings($);
  const images = analyzeImages($);
  const schema = extractSchema($);
  const topKeywords = extractTopKeywords(html, $);
  const mobileFriendly = checkMobileFriendly($);
  const hreflang = checkHreflang($);
  const pagination = checkPagination($);
  const titleAnalysis = analyzeTitleLength(title);
  const descriptionAnalysis = analyzeDescriptionLength(description);
  const links = checkInternalLinks($, url);
  const favicon = extractFavicon($, url);
  const amp = checkAmpVersion($);
  const socialProfiles = extractSocialProfiles($);

  const seoData = {
    title,
    description,
    keywords,
    canonical,
    robots,
    viewport,
    ogTags,
    twitterTags,
    headings,
    images,
    schema,
    topKeywords,
    mobileFriendly,
    hreflang,
    pagination,
    titleAnalysis,
    descriptionAnalysis,
    links,
    favicon,
    amp,
    socialProfiles,
    metaCount: Object.keys(meta).length,
    allMeta: meta,
  };

  seoData.score = calculateSeoScore(seoData);
  return seoData;
}

module.exports = { analyzeSeo };