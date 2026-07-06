const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

function generateTextReport(url, data) {
  const scores = data.scores || {};
  const sec = data.security || {};
  const perf = data.performance || {};
  const seo = data.seo || {};
  const lines = [];

  lines.push('WEB INSPECTOR PRO - SCAN REPORT');
  lines.push('='.repeat(50));
  lines.push(`URL: ${url}`);
  lines.push(`Date: ${new Date().toISOString()}`);
  lines.push('');

  lines.push('SCORES');
  lines.push('-'.repeat(30));
  lines.push(`Security:    ${scores.security ?? 'N/A'}/100`);
  lines.push(`Performance: ${scores.performance ?? 'N/A'}/100`);
  lines.push(`SEO:         ${scores.seo ?? 'N/A'}/100`);
  lines.push(`Design:      ${scores.design ?? 'N/A'}/100`);
  lines.push('');

  lines.push('SECURITY');
  lines.push('-'.repeat(30));
  lines.push(`HTTPS: ${sec.https ? 'Yes' : 'No'}`);
  lines.push(`SSL Valid: ${sec.ssl?.valid ? 'Yes' : 'No'}`);
  lines.push(`Exposed API Keys: ${(sec.apiKeys || []).length}`);
  lines.push(`XSS Indicators: ${(sec.xssHints || []).length}`);
  lines.push(`SQLi Points: ${(sec.sqliPoints || []).length}`);
  lines.push(`Admin Panels: ${(sec.adminPanels || []).length}`);
  if (sec.apiKeys?.length > 0) {
    lines.push('API Keys Found:');
    sec.apiKeys.forEach(k => lines.push(`  - [${k.type}] ${k.value?.substring(0, 40)}...`));
  }
  lines.push('');

  lines.push('PERFORMANCE');
  lines.push('-'.repeat(30));
  lines.push(`Load Time: ${perf.loadTime ? (perf.loadTime / 1000).toFixed(2) + 's' : 'N/A'}`);
  lines.push(`TTFB: ${perf.ttfb ? perf.ttfb + 'ms' : 'N/A'}`);
  lines.push(`FCP: ${perf.fcp ? perf.fcp + 'ms' : 'N/A'}`);
  lines.push(`LCP: ${perf.lcp ? perf.lcp + 'ms' : 'N/A'}`);
  lines.push(`Total Size: ${perf.totalSize ? (perf.totalSize / 1024).toFixed(0) + 'KB' : 'N/A'}`);
  lines.push(`Gzip: ${perf.gzip ? 'Yes' : 'No'}`);
  lines.push(`Render Blocking: ${(perf.renderBlocking || []).length}`);
  lines.push('');

  lines.push('SEO');
  lines.push('-'.repeat(30));
  lines.push(`Title: ${seo.title || 'Missing'}`);
  lines.push(`Description: ${seo.description || 'Missing'}`);
  lines.push(`Canonical: ${seo.canonical || 'Missing'}`);
  lines.push(`H1 Tags: ${seo.headings?.h1?.length || 0}`);
  lines.push(`Images without alt: ${seo.images?.withoutAlt || 0}`);
  lines.push(`Schema Types: ${(seo.schema || []).map(s => s.type).join(', ') || 'None'}`);
  lines.push('');

  lines.push('AI INSIGHTS');
  lines.push('-'.repeat(30));
  if (data.ai?.summary) lines.push(`Summary: ${data.ai.summary}`);
  if (data.ai?.bugs?.length > 0) {
    lines.push('Bugs:');
    data.ai.bugs.forEach(b => lines.push(`  - ${b}`));
  }
  if (data.ai?.improvements?.length > 0) {
    lines.push('Improvements:');
    data.ai.improvements.forEach(i => lines.push(`  - ${i}`));
  }

  return lines.join('\n');
}

function buildHtmlReport(url, data) {
  const scores = data.scores || {};
  const sec = data.security || {};
  const perf = data.performance || {};
  const seo = data.seo || {};
  const ai = data.ai || {};

  const scoreColor = (s) => s >= 80 ? '#00ff88' : s >= 50 ? '#ffb74d' : '#ff5370';
  const badge = (val, good, warn) => {
    if (val === good) return `<span style="color:#00ff88">✓ ${val}</span>`;
    if (val === warn) return `<span style="color:#ffb74d">⚠ ${val}</span>`;
    return `<span style="color:#ff5370">✕ ${val}</span>`;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Web Inspector Pro Report - ${url}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a0a; color: #fff; font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.6; padding: 20px; }
  .header { border-bottom: 2px solid #00ff88; padding-bottom: 20px; margin-bottom: 30px; }
  .brand { color: #00ff88; font-size: 20px; font-weight: 800; }
  .url { font-size: 15px; margin-top: 8px; color: #aaa; }
  .date { font-size: 11px; color: #666; margin-top: 4px; }
  .scores { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 30px; }
  .score-box { background: #111; border: 1px solid #222; border-radius: 8px; padding: 16px; text-align: center; }
  .score-num { font-size: 28px; font-weight: 800; }
  .score-label { font-size: 11px; color: #888; margin-top: 4px; text-transform: uppercase; }
  .section { background: #111; border: 1px solid #222; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  .section-title { font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #00ff88; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #1a1a1a; font-size: 12px; }
  .row:last-child { border-bottom: none; }
  .label { color: #888; }
  .list-item { padding: 6px 0; border-bottom: 1px solid #1a1a1a; font-size: 12px; }
  .list-item:last-child { border-bottom: none; }
  .tag { display: inline-block; background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 2px 8px; font-size: 10px; margin: 2px; }
  @media print { body { background: white; color: black; } .section { border: 1px solid #ccc; } }
</style>
</head>
<body>
<div class="header">
  <div class="brand">◈ Web Inspector Pro</div>
  <div class="url">${url}</div>
  <div class="date">Generated: ${new Date().toLocaleString()}</div>
</div>

<div class="scores">
  <div class="score-box">
    <div class="score-num" style="color:${scoreColor(scores.security || 0)}">${scores.security ?? 0}</div>
    <div class="score-label">Security</div>
  </div>
  <div class="score-box">
    <div class="score-num" style="color:${scoreColor(scores.performance || 0)}">${scores.performance ?? 0}</div>
    <div class="score-label">Performance</div>
  </div>
  <div class="score-box">
    <div class="score-num" style="color:${scoreColor(scores.seo || 0)}">${scores.seo ?? 0}</div>
    <div class="score-label">SEO</div>
  </div>
  <div class="score-box">
    <div class="score-num" style="color:${scoreColor(scores.design || 0)}">${scores.design ?? 0}</div>
    <div class="score-label">Design</div>
  </div>
</div>

${ai.summary ? `
<div class="section">
  <div class="section-title">🤖 AI Summary</div>
  <p style="color:#aaa;font-size:12px;line-height:1.8">${ai.summary}</p>
</div>` : ''}

<div class="section">
  <div class="section-title">🔒 Security</div>
  <div class="row"><span class="label">HTTPS</span><span>${sec.https ? '<span style="color:#00ff88">✓ Enabled</span>' : '<span style="color:#ff5370">✕ Not Enabled</span>'}</span></div>
  <div class="row"><span class="label">SSL Valid</span><span>${sec.ssl?.valid ? '<span style="color:#00ff88">✓ Yes</span>' : '<span style="color:#ff5370">✕ No</span>'}</span></div>
  <div class="row"><span class="label">Exposed API Keys</span><span style="color:${(sec.apiKeys || []).length > 0 ? '#ff5370' : '#00ff88'}">${(sec.apiKeys || []).length}</span></div>
  <div class="row"><span class="label">XSS Indicators</span><span style="color:${(sec.xssHints || []).length > 0 ? '#ffb74d' : '#00ff88'}">${(sec.xssHints || []).length}</span></div>
  <div class="row"><span class="label">SQLi Points</span><span style="color:${(sec.sqliPoints || []).length > 0 ? '#ff5370' : '#00ff88'}">${(sec.sqliPoints || []).length}</span></div>
  <div class="row"><span class="label">Security Header Score</span><span>${sec.headerScore || '--'}</span></div>
  <div class="row"><span class="label">CORS Risk</span><span style="color:${sec.cors?.risk === 'high' ? '#ff5370' : sec.cors?.risk === 'medium' ? '#ffb74d' : '#00ff88'}">${sec.cors?.risk || 'Unknown'}</span></div>
  <div class="row"><span class="label">Admin Panels Found</span><span>${(sec.adminPanels || []).length}</span></div>
</div>

<div class="section">
  <div class="section-title">⚡ Performance</div>
  <div class="row"><span class="label">Load Time</span><span>${perf.loadTime ? (perf.loadTime / 1000).toFixed(2) + 's' : 'N/A'}</span></div>
  <div class="row"><span class="label">TTFB</span><span>${perf.ttfb ? perf.ttfb + 'ms' : 'N/A'}</span></div>
  <div class="row"><span class="label">FCP</span><span>${perf.fcp ? perf.fcp + 'ms' : 'N/A'}</span></div>
  <div class="row"><span class="label">LCP</span><span>${perf.lcp ? perf.lcp + 'ms' : 'N/A'}</span></div>
  <div class="row"><span class="label">Total Size</span><span>${perf.totalSize ? (perf.totalSize / 1024).toFixed(0) + 'KB' : 'N/A'}</span></div>
  <div class="row"><span class="label">Compression</span><span>${perf.brotli ? 'Brotli' : perf.gzip ? 'Gzip' : 'None'}</span></div>
  <div class="row"><span class="label">Render Blocking</span><span>${(perf.renderBlocking || []).length}</span></div>
  <div class="row"><span class="label">Unoptimized Images</span><span>${(perf.unoptimizedImages || []).length}</span></div>
</div>

<div class="section">
  <div class="section-title">🔍 SEO</div>
  <div class="row"><span class="label">Title</span><span style="word-break:break-all;text-align:right;max-width:60%">${seo.title || '<span style="color:#ff5370">Missing</span>'}</span></div>
  <div class="row"><span class="label">Description</span><span style="word-break:break-all;text-align:right;max-width:60%">${seo.description ? seo.description.substring(0, 80) + '...' : '<span style="color:#ff5370">Missing</span>'}</span></div>
  <div class="row"><span class="label">Canonical</span><span>${seo.canonical || '<span style="color:#ffb74d">Missing</span>'}</span></div>
  <div class="row"><span class="label">H1 Tags</span><span style="color:${(seo.headings?.h1?.length || 0) === 1 ? '#00ff88' : '#ffb74d'}">${seo.headings?.h1?.length || 0}</span></div>
  <div class="row"><span class="label">Images without alt</span><span style="color:${(seo.images?.withoutAlt || 0) > 0 ? '#ffb74d' : '#00ff88'}">${seo.images?.withoutAlt || 0}</span></div>
  <div class="row"><span class="label">Mobile Friendly</span><span>${seo.mobileFriendly ? '<span style="color:#00ff88">Yes</span>' : '<span style="color:#ffb74d">Unknown</span>'}</span></div>
  <div class="row"><span class="label">Schema Markup</span><span>${(seo.schema || []).length > 0 ? '<span style="color:#00ff88">Present</span>' : '<span style="color:#ffb74d">Missing</span>'}</span></div>
</div>

${ai.improvements?.length > 0 ? `
<div class="section">
  <div class="section-title">💡 AI Improvements</div>
  ${ai.improvements.map(i => `<div class="list-item">→ ${i}</div>`).join('')}
</div>` : ''}

${ai.bugs?.length > 0 ? `
<div class="section">
  <div class="section-title">🐛 Bugs Found</div>
  ${ai.bugs.map(b => `<div class="list-item" style="color:#ff5370">✕ ${b}</div>`).join('')}
</div>` : ''}

<div style="text-align:center;color:#444;font-size:11px;margin-top:30px;padding-top:20px;border-top:1px solid #222">
  Generated by Web Inspector Pro · ${new Date().toISOString()}
</div>
</body>
</html>`;
}

async function saveReport(userId, scanId, url, data) {
  const db = admin.firestore();
  const storage = admin.storage().bucket();
  const reportId = uuidv4();

  const textContent = generateTextReport(url, data);
  const htmlContent = buildHtmlReport(url, data);

  const textPath = `reports/${userId}/${reportId}/report.txt`;
  const htmlPath = `reports/${userId}/${reportId}/report.html`;

  const textFile = storage.file(textPath);
  const htmlFile = storage.file(htmlPath);

  await Promise.all([
    textFile.save(textContent, { contentType: 'text/plain', metadata: { cacheControl: 'private, max-age=3600' } }),
    htmlFile.save(htmlContent, { contentType: 'text/html', metadata: { cacheControl: 'private, max-age=3600' } }),
  ]);

  const [textUrl] = await textFile.getSignedUrl({ action: 'read', expires: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const [htmlUrl] = await htmlFile.getSignedUrl({ action: 'read', expires: Date.now() + 7 * 24 * 60 * 60 * 1000 });

  await db.collection('reports').doc(reportId).set({
    reportId,
    userId,
    scanId: scanId || null,
    url,
    scores: data.scores || {},
    textReportPath: textPath,
    htmlReportPath: htmlPath,
    textDownloadUrl: textUrl,
    htmlDownloadUrl: htmlUrl,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    isPublic: false,
  });

  return { reportId, textDownloadUrl: textUrl, htmlDownloadUrl: htmlUrl, downloadUrl: htmlUrl };
}

async function saveShareLink(userId, targetId, targetType, data) {
  const db = admin.firestore();
  const shareId = uuidv4();

  await db.collection('shares').doc(shareId).set({
    shareId,
    userId,
    targetId,
    targetType,
    data: JSON.stringify(data).substring(0, 900000),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    viewCount: 0,
  });

  return { shareId, shareUrl: `https://web-inspector-pro.web.app/share/${shareId}` };
}

async function getSharedReport(shareId) {
  const db = admin.firestore();
  const doc = await db.collection('shares').doc(shareId).get();
  if (!doc.exists) return null;

  await db.collection('shares').doc(shareId).update({
    viewCount: admin.firestore.FieldValue.increment(1),
  });

  const d = doc.data();
  return { ...d, data: d.data ? JSON.parse(d.data) : {} };
}

async function getScanHistory(userId, limit = 50) {
  const db = admin.firestore();
  const snap = await db.collection('scans')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function compareSites(userId, urlA, urlB, dataA, dataB) {
  const db = admin.firestore();
  const compareId = uuidv4();

  const comparison = {
    compareId,
    userId,
    urls: [urlA, urlB],
    scores: {
      [urlA]: dataA.scores || {},
      [urlB]: dataB.scores || {},
    },
    winner: {
      security: (dataA.scores?.security || 0) >= (dataB.scores?.security || 0) ? urlA : urlB,
      performance: (dataA.scores?.performance || 0) >= (dataB.scores?.performance || 0) ? urlA : urlB,
      seo: (dataA.scores?.seo || 0) >= (dataB.scores?.seo || 0) ? urlA : urlB,
      design: (dataA.scores?.design || 0) >= (dataB.scores?.design || 0) ? urlA : urlB,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('compareResults').doc(compareId).set(comparison);
  return comparison;
}

module.exports = { saveReport, saveShareLink, getSharedReport, getScanHistory, compareSites, generateTextReport, buildHtmlReport };