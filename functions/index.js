const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');

admin.initializeApp();

const { fetchWithProxy, fetchDirect, analyzeHtml, calculateScores } = require('./src/analyze');
const { analyzeNetwork } = require('./src/network');
const { analyzeSecurity } = require('./src/security');
const { analyzePerformance } = require('./src/performance');
const { analyzeDesign } = require('./src/design');
const { analyzeSeo } = require('./src/seo');
const { analyzeWithAI } = require('./src/ai');
const { analyzeStorage } = require('./src/storage');
const { saveReport, saveShareLink, getSharedReport, getScanHistory, compareSites } = require('./src/reports');

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));

const runtimeOpts = {
  timeoutSeconds: 300,
  memory: '1GB',
};

function getConfig() {
  try {
    const cfg = functions.config();
    return {
      openaiKey: cfg.openai?.key || process.env.OPENAI_API_KEY || '',
      geminiKey: cfg.gemini?.key || process.env.GEMINI_API_KEY || '',
      puppeteerUrl: cfg.puppeteer?.url || process.env.PUPPETEER_SERVER_URL || '',
      puppeteerSecret: cfg.puppeteer?.secret || process.env.PUPPETEER_SERVER_SECRET || '',
    };
  } catch {
    return {
      openaiKey: process.env.OPENAI_API_KEY || '',
      geminiKey: process.env.GEMINI_API_KEY || '',
      puppeteerUrl: process.env.PUPPETEER_SERVER_URL || '',
      puppeteerSecret: process.env.PUPPETEER_SERVER_SECRET || '',
    };
  }
}

async function verifyAuth(context) {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  return context.auth.uid;
}

async function fetchPageContent(url, deepScan, puppeteerUrl, puppeteerSecret) {
  let html = '';
  let responseHeaders = {};
  let screenshot = null;

  try {
    const direct = await fetchDirect(url);
    html = typeof direct.data === 'string' ? direct.data : JSON.stringify(direct.data);
    responseHeaders = direct.headers || {};
  } catch {
    try {
      const proxied = await fetchWithProxy(url);
      html = proxied.data || '';
      responseHeaders = proxied.headers || {};
    } catch (err) {
      throw new Error(`Failed to fetch page: ${err.message}`);
    }
  }

  if (deepScan && puppeteerUrl) {
    try {
      const axios = require('axios');
      const puppeteerRes = await axios.post(
        `${puppeteerUrl}/deep-scan`,
        { url },
        {
          timeout: 30000,
          headers: {
            'Authorization': `Bearer ${puppeteerSecret}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (puppeteerRes.data?.html) html = puppeteerRes.data.html;
      if (puppeteerRes.data?.screenshot) screenshot = puppeteerRes.data.screenshot;
    } catch (err) {
      console.warn('Puppeteer deep scan failed:', err.message);
    }
  }

  return { html, responseHeaders, screenshot };
}

exports.analyzeUrl = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  await verifyAuth(context);

  const { url, deepScan = true, screenshot: wantScreenshot = true, aiEnabled = true } = data;

  if (!url || typeof url !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Valid URL is required.');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new functions.https.HttpsError('invalid-argument', 'Malformed URL.');
  }

  const config = getConfig();

  const { html, responseHeaders, screenshot } = await fetchPageContent(
    url,
    deepScan,
    config.puppeteerUrl,
    config.puppeteerSecret
  );

  const [
    htmlResult,
    networkResult,
    securityResult,
    performanceResult,
    designResult,
    seoResult,
    storageResult,
  ] = await Promise.allSettled([
    analyzeHtml(url, html),
    analyzeNetwork(url, html, responseHeaders),
    analyzeSecurity(url, html, responseHeaders),
    analyzePerformance(url, html, responseHeaders),
    analyzeDesign(url, html),
    analyzeSeo(url, html),
    analyzeStorage(html, responseHeaders),
  ]);

  const results = {
    html: htmlResult.status === 'fulfilled' ? htmlResult.value : { error: htmlResult.reason?.message },
    network: networkResult.status === 'fulfilled' ? networkResult.value : { error: networkResult.reason?.message },
    security: securityResult.status === 'fulfilled' ? securityResult.value : { error: securityResult.reason?.message },
    performance: performanceResult.status === 'fulfilled' ? performanceResult.value : { error: performanceResult.reason?.message },
    design: designResult.status === 'fulfilled' ? designResult.value : { error: designResult.reason?.message },
    seo: seoResult.status === 'fulfilled' ? seoResult.value : { error: seoResult.reason?.message },
    storage: storageResult.status === 'fulfilled' ? storageResult.value : { error: storageResult.reason?.message },
  };

  results.scores = calculateScores(results);

  if (aiEnabled && (config.openaiKey || config.geminiKey)) {
    try {
      results.ai = await analyzeWithAI(url, results, config.openaiKey, config.geminiKey);
    } catch (err) {
      console.error('AI analysis failed:', err.message);
      results.ai = { summary: 'AI analysis failed.', stack: [], bugs: [], improvements: [] };
    }
  } else {
    results.ai = { summary: 'AI analysis disabled or no API key configured.', stack: [], bugs: [], improvements: [] };
  }

  if (screenshot) results.screenshot = screenshot;

  if (wantScreenshot && !screenshot && config.puppeteerUrl) {
    try {
      const axios = require('axios');
      const screenshotRes = await axios.post(
        `${config.puppeteerUrl}/screenshot`,
        { url },
        {
          timeout: 25000,
          headers: {
            'Authorization': `Bearer ${config.puppeteerSecret}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (screenshotRes.data?.screenshot) results.screenshot = screenshotRes.data.screenshot;
    } catch (err) {
      console.warn('Screenshot failed:', err.message);
    }
  }

  try {
    const db = admin.firestore();
    const scanRef = await db.collection('scans').add({
      userId: context.auth.uid,
      url,
      scores: results.scores,
      status: 'completed',
      screenshot: results.screenshot || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isPublic: false,
    });
    results.scanId = scanRef.id;
  } catch (err) {
    console.error('Scan save failed:', err.message);
  }

  return results;
});

exports.generateReport = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const userId = await verifyAuth(context);
  const { url, data: scanData, scanId } = data;

  if (!url || !scanData) {
    throw new functions.https.HttpsError('invalid-argument', 'URL and scan data are required.');
  }

  try {
    const report = await saveReport(userId, scanId || null, url, scanData);
    return report;
  } catch (err) {
    throw new functions.https.HttpsError('internal', `Report generation failed: ${err.message}`);
  }
});

exports.createShareLink = functions.https.onCall(async (data, context) => {
  const userId = await verifyAuth(context);
  const { targetId, targetType, shareData } = data;

  if (!targetId || !targetType) {
    throw new functions.https.HttpsError('invalid-argument', 'targetId and targetType required.');
  }

  try {
    const share = await saveShareLink(userId, targetId, targetType, shareData || {});
    return share;
  } catch (err) {
    throw new functions.https.HttpsError('internal', `Share link creation failed: ${err.message}`);
  }
});

exports.getShare = functions.https.onCall(async (data) => {
  const { shareId } = data;
  if (!shareId) throw new functions.https.HttpsError('invalid-argument', 'shareId required.');

  try {
    const share = await getSharedReport(shareId);
    if (!share) throw new functions.https.HttpsError('not-found', 'Share not found.');
    return share;
  } catch (err) {
    if (err.code) throw err;
    throw new functions.https.HttpsError('internal', err.message);
  }
});

exports.getHistory = functions.https.onCall(async (data, context) => {
  const userId = await verifyAuth(context);
  const { limit = 50 } = data || {};

  try {
    const history = await getScanHistory(userId, limit);
    return { history };
  } catch (err) {
    throw new functions.https.HttpsError('internal', err.message);
  }
});

exports.compareSites = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const userId = await verifyAuth(context);
  const { urlA, urlB } = data;

  if (!urlA || !urlB) {
    throw new functions.https.HttpsError('invalid-argument', 'Both URLs required for comparison.');
  }

  const config = getConfig();

  try {
    const [resA, resB] = await Promise.all([
      fetchPageContent(urlA, false, config.puppeteerUrl, config.puppeteerSecret),
      fetchPageContent(urlB, false, config.puppeteerUrl, config.puppeteerSecret),
    ]);

    const [dataA, dataB] = await Promise.all([
      Promise.allSettled([
        analyzeHtml(urlA, resA.html),
        analyzeSecurity(urlA, resA.html, resA.responseHeaders),
        analyzePerformance(urlA, resA.html, resA.responseHeaders),
        analyzeSeo(urlA, resA.html),
      ]).then(([h, s, p, seo]) => ({
        html: h.value || {},
        security: s.value || {},
        performance: p.value || {},
        seo: seo.value || {},
        scores: calculateScores({ security: s.value || {}, performance: p.value || {}, seo: seo.value || {}, design: {} }),
      })),
      Promise.allSettled([
        analyzeHtml(urlB, resB.html),
        analyzeSecurity(urlB, resB.html, resB.responseHeaders),
        analyzePerformance(urlB, resB.html, resB.responseHeaders),
        analyzeSeo(urlB, resB.html),
      ]).then(([h, s, p, seo]) => ({
        html: h.value || {},
        security: s.value || {},
        performance: p.value || {},
        seo: seo.value || {},
        scores: calculateScores({ security: s.value || {}, performance: p.value || {}, seo: seo.value || {}, design: {} }),
      })),
    ]);

    const comparison = await compareSites(userId, urlA, urlB, dataA, dataB);
    return comparison;
  } catch (err) {
    throw new functions.https.HttpsError('internal', `Comparison failed: ${err.message}`);
  }
});

exports.addFavorite = functions.https.onCall(async (data, context) => {
  const userId = await verifyAuth(context);
  const { url } = data;
  if (!url) throw new functions.https.HttpsError('invalid-argument', 'URL required.');

  try {
    const db = admin.firestore();
    const ref = await db.collection('users').doc(userId).collection('favorites').add({
      url,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { id: ref.id };
  } catch (err) {
    throw new functions.https.HttpsError('internal', err.message);
  }
});

exports.deleteScan = functions.https.onCall(async (data, context) => {
  const userId = await verifyAuth(context);
  const { scanId } = data;
  if (!scanId) throw new functions.https.HttpsError('invalid-argument', 'scanId required.');

  try {
    const db = admin.firestore();
    const doc = await db.collection('scans').doc(scanId).get();
    if (!doc.exists) throw new functions.https.HttpsError('not-found', 'Scan not found.');
    if (doc.data().userId !== userId) throw new functions.https.HttpsError('permission-denied', 'Not your scan.');
    await db.collection('scans').doc(scanId).delete();
    return { success: true };
  } catch (err) {
    if (err.code) throw err;
    throw new functions.https.HttpsError('internal', err.message);
  }
});

exports.getUserStats = functions.https.onCall(async (data, context) => {
  const userId = await verifyAuth(context);

  try {
    const db = admin.firestore();
    const [scansSnap, reportsSnap, favSnap] = await Promise.all([
      db.collection('scans').where('userId', '==', userId).get(),
      db.collection('reports').where('userId', '==', userId).get(),
      db.collection('users').doc(userId).collection('favorites').get(),
    ]);

    const scans = scansSnap.docs.map(d => d.data());
    const avgSecurity = scans.length > 0
      ? Math.round(scans.reduce((a, s) => a + (s.scores?.security || 0), 0) / scans.length)
      : 0;
    const avgPerformance = scans.length > 0
      ? Math.round(scans.reduce((a, s) => a + (s.scores?.performance || 0), 0) / scans.length)
      : 0;

    return {
      totalScans: scansSnap.size,
      totalReports: reportsSnap.size,
      totalFavorites: favSnap.size,
      avgSecurityScore: avgSecurity,
      avgPerformanceScore: avgPerformance,
    };
  } catch (err) {
    throw new functions.https.HttpsError('internal', err.message);
  }
});

exports.api = functions.runWith(runtimeOpts).https.onRequest(app);