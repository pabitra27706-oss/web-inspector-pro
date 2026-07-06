const cheerio = require('cheerio');
const { URL } = require('url');

const CSS_COLOR_PATTERNS = [
  /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g,
  /rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/g,
  /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)/g,
  /hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)/g,
  /hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*[\d.]+\s*\)/g,
];

const COMMON_COLORS_TO_SKIP = new Set([
  '#ffffff', '#fff', '#000000', '#000', '#f0f0f0', '#eeeeee', '#333333',
  'rgb(0,0,0)', 'rgb(255,255,255)', 'rgba(0,0,0,0)', 'rgba(255,255,255,0)',
]);

const FONT_SOURCES = [
  { pattern: /fonts\.googleapis\.com\/css[^"']*family=([^"'&:;]+)/gi, source: 'Google Fonts' },
  { pattern: /fonts\.adobe\.com[^"']*\/([^"'?]+)/gi, source: 'Adobe Fonts' },
  { pattern: /use\.typekit\.net/gi, source: 'Adobe Typekit' },
  { pattern: /cloud\.typography\.com/gi, source: 'Cloud.typography' },
  { pattern: /fast\.fonts\.net/gi, source: 'Fonts.com' },
];

const DESIGN_FRAMEWORKS = [
  { name: 'Bootstrap', patterns: ['bootstrap.css', 'bootstrap.min.css', 'class="container"', 'class="row"', 'class="col-'] },
  { name: 'Tailwind CSS', patterns: ['tailwind', 'class="flex ', 'class="grid ', 'class="text-', 'class="bg-', 'class="p-', 'class="m-'] },
  { name: 'Material UI', patterns: ['mui', 'material-ui', 'MuiButton', 'MuiBox', 'makeStyles'] },
  { name: 'Bulma', patterns: ['bulma.css', 'class="columns"', 'class="column"', 'class="hero"'] },
  { name: 'Foundation', patterns: ['foundation.css', 'class="grid-x"', 'class="cell"'] },
  { name: 'Chakra UI', patterns: ['chakra', '@chakra-ui'] },
  { name: 'Ant Design', patterns: ['antd', 'ant-design', 'class="ant-'] },
  { name: 'Semantic UI', patterns: ['semantic.css', 'semantic-ui', 'class="ui button"', 'class="ui container"'] },
];

const ANIMATION_LIBRARIES = [
  { name: 'GSAP', patterns: ['gsap.js', 'gsap.min.js', 'TweenMax', 'TweenLite', 'gsap.to(', 'gsap.from('] },
  { name: 'Anime.js', patterns: ['anime.js', 'anime.min.js', 'anime({'] },
  { name: 'AOS', patterns: ['aos.js', 'aos.css', 'data-aos='] },
  { name: 'ScrollReveal', patterns: ['scrollreveal', 'ScrollReveal('] },
  { name: 'Framer Motion', patterns: ['framer-motion', 'motion.div', 'useAnimation'] },
  { name: 'Lottie', patterns: ['lottie', 'bodymovin'] },
  { name: 'CSS Animations', patterns: ['@keyframes', 'animation:', 'animation-name:'] },
  { name: 'CSS Transitions', patterns: ['transition:', 'transition-property:'] },
];

function extractColors(html, $) {
  const colorSet = new Map();
  
  const inlineStyles = [];
  $('[style]').each((_, el) => inlineStyles.push($(el).attr('style') || ''));
  $('style').each((_, el) => inlineStyles.push($(el).html() || ''));
  const styleContent = inlineStyles.join(' ') + html;
  
  for (const pattern of CSS_COLOR_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(styleContent)) !== null) {
      const color = match[0].toLowerCase().replace(/\s/g, '');
      if (!COMMON_COLORS_TO_SKIP.has(color) && !colorSet.has(color)) {
        colorSet.set(color, { value: match[0], normalized: color });
      }
      if (colorSet.size >= 30) break;
    }
  }
  
  $('[color]').each((_, el) => {
    const color = $(el).attr('color');
    if (color && !COMMON_COLORS_TO_SKIP.has(color.toLowerCase())) {
      colorSet.set(color.toLowerCase(), { value: color, normalized: color.toLowerCase() });
    }
  });
  
  return Array.from(colorSet.values()).slice(0, 25);
}

function extractFonts(html, $) {
  const fonts = new Map();
  
  for (const { pattern, source } of FONT_SOURCES) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(html)) !== null) {
      const raw = match[1] || match[0];
      const names = raw.replace(/\+/g, ' ').split('|');
      for (const name of names) {
        const clean = name.split(':')[0].trim();
        if (clean && !fonts.has(clean)) {
          fonts.set(clean, { name: clean, source });
        }
      }
    }
  }
  
  const fontFaceRegex = /@font-face\s*\{[^}]*font-family\s*:\s*['"]?([^'";]+)['"]?/gi;
  let match;
  while ((match = fontFaceRegex.exec(html)) !== null) {
    const name = match[1].trim();
    if (name && !fonts.has(name)) {
      fonts.set(name, { name, source: '@font-face' });
    }
  }
  
  const stackRegex = /font-family\s*:\s*([^;}"']+)/gi;
  while ((match = stackRegex.exec(html)) !== null) {
    const stack = match[1].split(',');
    for (const f of stack) {
      const name = f.replace(/['"]/g, '').trim();
      if (name && name.length > 1 && !name.startsWith('var(') && !/^(serif|sans-serif|monospace|cursive|fantasy|inherit|initial|unset)$/.test(name.toLowerCase())) {
        if (!fonts.has(name)) fonts.set(name, { name, source: 'CSS font-family' });
      }
    }
  }
  
  return Array.from(fonts.values()).slice(0, 15);
}

function extractCssVariables(html) {
  const variables = [];
  const regex = /--([\w-]+)\s*:\s*([^;}"']+)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    variables.push({ name: `--${match[1].trim()}`, value: match[2].trim().substring(0, 100) });
    if (variables.length >= 50) break;
  }
  return variables;
}

function detectDesignFramework(html) {
  const lower = html.toLowerCase();
  for (const fw of DESIGN_FRAMEWORKS) {
    if (fw.patterns.some(p => lower.includes(p.toLowerCase()))) {
      return fw.name;
    }
  }
  return null;
}

function detectAnimations(html) {
  const detected = [];
  const lower = html.toLowerCase();
  for (const lib of ANIMATION_LIBRARIES) {
    if (lib.patterns.some(p => lower.includes(p.toLowerCase()))) {
      detected.push(lib.name);
    }
  }
  return detected;
}

function checkResponsive($, html) {
  const hasViewport = $('meta[name="viewport"]').length > 0;
  const hasMediaQueries = /@media\s+/i.test(html);
  const hasFlexbox = /display\s*:\s*flex/i.test(html);
  const hasGrid = /display\s*:\s*grid/i.test(html);
  return hasViewport && (hasMediaQueries || hasFlexbox || hasGrid);
}

function extractBreakpoints(html) {
  const breakpoints = [];
  const regex = /@media[^{]*\(\s*(?:max|min)-width\s*:\s*(\d+(?:\.\d+)?(?:px|em|rem))\s*\)/gi;
  let match;
  const seen = new Set();
  while ((match = regex.exec(html)) !== null) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      breakpoints.push(match[1]);
    }
    if (breakpoints.length >= 10) break;
  }
  return breakpoints.sort((a, b) => parseFloat(a) - parseFloat(b));
}

function checkDarkMode(html, $) {
  const hasColorScheme = /prefers-color-scheme\s*:\s*dark/i.test(html);
  const hasDarkClass = $('[class*="dark"]').length > 0;
  const hasDarkVariable = /--[\w-]*(?:dark|night)[\w-]*/i.test(html);
  return hasColorScheme || hasDarkClass || hasDarkVariable;
}

function extractAssets($, baseUrl) {
  const assets = [];
  const seen = new Set();
  
  const addAsset = (src, type) => {
    if (!src) return;
    try {
      const resolved = new URL(src, baseUrl).href;
      if (!seen.has(resolved)) {
        seen.add(resolved);
        assets.push({ url: resolved, type });
      }
    } catch {}
  };
  
  $('img').each((_, el) => addAsset($(el).attr('src') || $(el).attr('data-src'), 'image'));
  $('video source, video[src]').each((_, el) => addAsset($(el).attr('src'), 'video'));
  $('audio source, audio[src]').each((_, el) => addAsset($(el).attr('src'), 'audio'));
  $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').each((_, el) => addAsset($(el).attr('href'), 'icon'));
  $('link[rel="preload"][as="font"]').each((_, el) => addAsset($(el).attr('href'), 'font'));
  
  const bgRegex = /url\(['"]?([^'")]+)['"]?\)/g;
  let match;
  const styleContent = $('style').map((_, el) => $(el).html()).get().join('');
  while ((match = bgRegex.exec(styleContent)) !== null) {
    const src = match[1];
    if (!src.startsWith('data:')) addAsset(src, 'background');
  }
  
  return assets.slice(0, 60);
}

function extractSvgInfo($) {
  const inlineSvgs = $('svg').length;
  const externalSvgs = $('img[src$=".svg"], use[href$=".svg"], use[xlink\\:href$=".svg"]').length;
  const svgIds = [];
  $('svg[id]').each((_, el) => svgIds.push($(el).attr('id')));
  return { inlineSvgs, externalSvgs, total: inlineSvgs + externalSvgs, ids: svgIds };
}

function analyzeDesign(url, html) {
  if (!html) return { error: 'No HTML content' };
  const $ = cheerio.load(html);
  
  const colors = extractColors(html, $);
  const fonts = extractFonts(html, $);
  const cssVariables = extractCssVariables(html);
  const framework = detectDesignFramework(html);
  const animations = detectAnimations(html);
  const responsive = checkResponsive($, html);
  const breakpoints = extractBreakpoints(html);
  const darkMode = checkDarkMode(html, $);
  const assets = extractAssets($, url);
  const svgInfo = extractSvgInfo($);
  
  return {
    colors,
    fonts,
    cssVariables,
    framework: framework || 'Custom',
    animations,
    responsive,
    breakpoints,
    darkMode,
    assets,
    svgs: svgInfo.ids,
    inlineSvgs: svgInfo.inlineSvgs,
    externalSvgs: svgInfo.externalSvgs,
    totalSvgs: svgInfo.total,
  };
}

module.exports = { analyzeDesign };