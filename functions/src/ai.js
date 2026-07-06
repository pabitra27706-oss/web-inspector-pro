const { URL } = require('url');

async function callOpenAI(prompt, apiKey, model = 'gpt-4o-mini') {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1500,
    temperature: 0.3,
  });
  return response.choices[0]?.message?.content || '';
}

async function callGemini(prompt, apiKey) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function callAI(prompt, openaiKey, geminiKey) {
  if (openaiKey) {
    try {
      return await callOpenAI(prompt, openaiKey);
    } catch (err) {
      console.warn('OpenAI failed, trying Gemini:', err.message);
    }
  }
  if (geminiKey) {
    try {
      return await callGemini(prompt, geminiKey);
    } catch (err) {
      console.warn('Gemini failed:', err.message);
    }
  }
  return null;
}

function buildSummaryPrompt(url, data) {
  const sec = data.security || {};
  const perf = data.performance || {};
  const seo = data.seo || {};
  const html = data.html || {};
  return `You are a web security and performance expert. Analyze this website scan data and provide a concise 3-4 sentence summary.

URL: ${url}
Framework: ${html.framework || 'Unknown'}
HTTPS: ${sec.https ? 'Yes' : 'No'}
Security Issues: ${sec.issuesFound || 0}
Load Time: ${perf.loadTime ? (perf.loadTime / 1000).toFixed(2) + 's' : 'Unknown'}
SEO Score: ${seo.score || 'Unknown'}
API Keys Exposed: ${sec.apiKeys?.length || 0}
XSS Hints: ${sec.xssHints?.length || 0}
Missing Security Headers: ${(sec.headers || []).filter(h => !h.present && h.critical).length}

Write a professional summary covering overall health, main concerns, and key strengths. Be specific and actionable.`;
}

function buildStackPrompt(url, html, scripts, stylesheets) {
  const scriptSrcs = (scripts || []).filter(s => s.src).map(s => s.src).slice(0, 20).join('\n');
  const cssSrcs = (stylesheets || []).filter(s => s.href).map(s => s.href).slice(0, 10).join('\n');
  return `Analyze this website's technology stack based on the data below. Return a JSON array of objects with fields: name, category, version (if detectable), confidence (high/medium/low).

URL: ${url}
Framework detected: ${html?.framework || 'Unknown'}
Libraries: ${(html?.libraries || []).join(', ') || 'None detected'}

Script sources:
${scriptSrcs || 'None'}

Stylesheet sources:
${cssSrcs || 'None'}

Return ONLY valid JSON array. Example: [{"name":"React","category":"Frontend Framework","version":"18","confidence":"high"}]`;
}

function buildSecurityPrompt(url, security) {
  const apiKeys = (security.apiKeys || []).map(k => k.type).join(', ') || 'None';
  const missingHeaders = (security.headers || []).filter(h => !h.present && h.critical).map(h => h.name).join(', ') || 'None';
  return `You are a cybersecurity expert. Explain the security findings for this website in simple terms for a developer.

URL: ${url}
HTTPS Enabled: ${security.https ? 'Yes' : 'No'}
SSL Valid: ${security.ssl?.valid ? 'Yes' : 'No'}
Exposed API Key Types: ${apiKeys}
Missing Critical Headers: ${missingHeaders}
XSS Indicators: ${(security.xssHints || []).join(', ') || 'None'}
SQL Injection Points: ${(security.sqliPoints || []).join(', ') || 'None'}
CORS Risk: ${security.cors?.risk || 'Unknown'}
Admin Panels Found: ${(security.adminPanels || []).length}

Explain the top 3 security concerns, their impact, and how to fix them. Be specific and developer-friendly.`;
}

function buildPerformancePrompt(url, performance) {
  return `You are a web performance expert. Explain these performance metrics and give actionable advice.

URL: ${url}
Load Time: ${performance.loadTime ? (performance.loadTime / 1000).toFixed(2) + 's' : 'Unknown'}
TTFB: ${performance.ttfb ? performance.ttfb + 'ms' : 'Unknown'}
FCP: ${performance.fcp ? performance.fcp + 'ms' : 'Unknown'}
LCP: ${performance.lcp ? performance.lcp + 'ms' : 'Unknown'}
Total Size: ${performance.totalSize ? (performance.totalSize / 1024).toFixed(0) + 'KB' : 'Unknown'}
Gzip: ${performance.gzip ? 'Yes' : 'No'}
Brotli: ${performance.brotli ? 'Yes' : 'No'}
Render Blocking Resources: ${(performance.renderBlocking || []).length}
Unoptimized Images: ${(performance.unoptimizedImages || []).length}
Unused CSS: ${(performance.unusedCss || []).length}

Explain the performance state, what the metrics mean, and the top 3 improvements with expected impact.`;
}

function buildBugsPrompt(url, html, security) {
  const forms = (html?.forms || []);
  const hasPasswordForm = forms.some(f => f.hasPasswordField);
  const insecurePasswordForm = hasPasswordForm && !security?.https;
  return `You are a code quality expert. Identify potential bugs and issues in this website.

URL: ${url}
Framework: ${html?.framework || 'Unknown'}
Forms Found: ${forms.length}
Password Form Over HTTP: ${insecurePasswordForm ? 'YES - Critical' : 'No'}
XSS Indicators: ${(security?.xssHints || []).join(', ') || 'None'}
SQL Injection Points: ${(security?.sqliPoints || []).join(', ') || 'None'}
JWT Tokens Exposed: ${(security?.jwtTokens || []).length}
Source Maps Exposed: ${(security?.sourceMaps || []).length}
iFrames: ${(html?.iframes || []).length}
Hidden Elements: ${(html?.hiddenElements || []).length}
HTML Comments: ${(html?.comments || []).length}

List up to 5 specific bugs or security issues as a JSON array of strings. Each item should be one sentence.
Return ONLY valid JSON array. Example: ["Password form submits over HTTP exposing credentials","JWT token visible in source code"]`;
}

function buildImprovementsPrompt(url, data) {
  const scores = data.scores || {};
  return `You are a web development expert. Based on this website analysis, provide the top 6 most impactful improvements.

URL: ${url}
Security Score: ${scores.security || 0}/100
Performance Score: ${scores.performance || 0}/100
SEO Score: ${scores.seo || 0}/100
Design Score: ${scores.design || 0}/100
Missing Security Headers: ${(data.security?.headers || []).filter(h => !h.present).map(h => h.name).join(', ') || 'None'}
No HTTPS: ${!data.security?.https}
Render Blocking Resources: ${(data.performance?.renderBlocking || []).length}
Missing Meta Description: ${!data.seo?.description}
Missing Alt Tags: ${data.seo?.images?.withoutAlt || 0}
Unoptimized Images: ${(data.performance?.unoptimizedImages || []).length}

Return ONLY a valid JSON array of 6 improvement strings, each one actionable and specific.`;
}

function buildAccessibilityPrompt(url, html, seo) {
  return `You are a web accessibility expert (WCAG 2.1). Analyze this website for accessibility issues.

URL: ${url}
Images without alt text: ${seo?.images?.withoutAlt || 0} out of ${seo?.images?.total || 0}
Language attribute: ${html?.lang || 'Not set'}
Forms found: ${(html?.forms || []).length}
Form fields: ${(html?.forms || []).map(f => f.fieldDetails?.map(fd => fd.type).join(',')).join('; ') || 'None'}
iFrames: ${(html?.iframes || []).length}
Has H1: ${(seo?.headings?.h1?.length || 0) > 0 ? 'Yes' : 'No'}
Heading structure: H1:${seo?.headings?.h1?.length || 0}, H2:${seo?.headings?.h2?.length || 0}, H3:${seo?.headings?.h3?.length || 0}

Give a brief accessibility assessment and list up to 5 specific WCAG issues as JSON.
Return: {"summary": "text", "issues": ["issue1","issue2"]}`;
}

function buildCodeExplainerPrompt(url, html) {
  const snippet = (html?.rawSource || '').substring(0, 2000);
  return `You are a senior web developer. Briefly explain what this website does based on its code structure.

URL: ${url}
Framework: ${html?.framework || 'Unknown'}
Libraries: ${(html?.libraries || []).slice(0, 8).join(', ') || 'None'}
Forms: ${(html?.forms || []).length}
iFrames: ${(html?.iframes || []).length}
Script count: ${(html?.scripts || []).length}

HTML snippet (first 2000 chars):
${snippet}

Write 2-3 sentences explaining the website's purpose, technology choices, and overall code quality. Be professional.`;
}

function parseJsonSafe(text) {
  if (!text) return null;
  try {
    const match = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return null;
}

async function analyzeWithAI(url, allData, openaiKey, geminiKey) {
  if (!openaiKey && !geminiKey) {
    return {
      summary: 'AI analysis unavailable. No API keys configured.',
      stack: [],
      securityExplanation: null,
      performanceExplanation: null,
      bugs: [],
      improvements: [],
      accessibility: null,
      accessibilityIssues: [],
      codeExplanation: null,
    };
  }
  
  const results = {};
  
  const [
    summaryRes,
    stackRes,
    securityRes,
    performanceRes,
    bugsRes,
    improvementsRes,
    accessibilityRes,
    codeRes,
  ] = await Promise.allSettled([
    callAI(buildSummaryPrompt(url, allData), openaiKey, geminiKey),
    callAI(buildStackPrompt(url, allData.html, allData.html?.scripts, allData.html?.stylesheets), openaiKey, geminiKey),
    callAI(buildSecurityPrompt(url, allData.security || {}), openaiKey, geminiKey),
    callAI(buildPerformancePrompt(url, allData.performance || {}), openaiKey, geminiKey),
    callAI(buildBugsPrompt(url, allData.html || {}, allData.security || {}), openaiKey, geminiKey),
    callAI(buildImprovementsPrompt(url, allData), openaiKey, geminiKey),
    callAI(buildAccessibilityPrompt(url, allData.html || {}, allData.seo || {}), openaiKey, geminiKey),
    callAI(buildCodeExplainerPrompt(url, allData.html || {}), openaiKey, geminiKey),
  ]);
  
  results.summary = summaryRes.status === 'fulfilled' ? summaryRes.value : 'Summary generation failed.';
  
  const stackParsed = stackRes.status === 'fulfilled' ? parseJsonSafe(stackRes.value) : null;
  results.stack = Array.isArray(stackParsed) ? stackParsed : [];
  
  results.securityExplanation = securityRes.status === 'fulfilled' ? securityRes.value : 'Security explanation unavailable.';
  results.performanceExplanation = performanceRes.status === 'fulfilled' ? performanceRes.value : 'Performance explanation unavailable.';
  
  const bugsParsed = bugsRes.status === 'fulfilled' ? parseJsonSafe(bugsRes.value) : null;
  results.bugs = Array.isArray(bugsParsed) ? bugsParsed : [];
  
  const improvParsed = improvementsRes.status === 'fulfilled' ? parseJsonSafe(improvementsRes.value) : null;
  results.improvements = Array.isArray(improvParsed) ? improvParsed : [];
  
  const accParsed = accessibilityRes.status === 'fulfilled' ? parseJsonSafe(accessibilityRes.value) : null;
  results.accessibility = accParsed?.summary || (accessibilityRes.status === 'fulfilled' ? accessibilityRes.value : 'Accessibility analysis unavailable.');
  results.accessibilityIssues = Array.isArray(accParsed?.issues) ? accParsed.issues : [];
  
  results.codeExplanation = codeRes.status === 'fulfilled' ? codeRes.value : 'Code explanation unavailable.';
  
  return results;
}

module.exports = { analyzeWithAI };