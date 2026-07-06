(function () {
  const PROXY_LIST = [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ];

  const state = {
    currentScan: null,
    currentUrl: null,
    scanResults: {},
    isScanning: false,
    currentTab: 'overview',
    user: null,
    settings: {
      deepScan: true,
      screenshot: true,
      aiAnalysis: true,
      autoSave: true,
      puppeteerUrl: '',
      openaiKey: '',
      geminiKey: ''
    }
  };

  function normalizeUrl(raw) {
    let url = raw.trim();
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try {
      const parsed = new URL(url);
      return parsed.href;
    } catch {
      return null;
    }
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type] || icons.info}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function showSection(sectionId) {
    const sections = [
      'scanSection', 'loaderSection', 'resultsSection',
      'historySection', 'favoritesSection', 'settingsSection', 'authSection'
    ];
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', id !== sectionId);
    });
  }

  function showModal(content) {
    const overlay = document.getElementById('modalOverlay');
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = content;
    overlay.classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
    document.getElementById('modalContent').innerHTML = '';
  }

  function setLoaderStep(steps, activeIndex, progress) {
    const container = document.getElementById('loaderSteps');
    const fill = document.getElementById('loaderProgressFill');
    if (fill) fill.style.width = `${progress}%`;
    if (container) {
      container.innerHTML = steps.map((step, i) => `
        <div class="loader-step ${i < activeIndex ? 'done' : ''}">
          <span class="loader-step-icon">${i < activeIndex ? '✓' : i === activeIndex ? '◌' : '○'}</span>
          <span>${step}</span>
        </div>
      `).join('');
    }
  }

  function updateLoaderStatus(msg) {
    const el = document.getElementById('loaderStatus');
    if (el) el.textContent = msg;
  }

  async function fetchWithProxy(url, proxyIndex = 0) {
    if (proxyIndex >= PROXY_LIST.length) throw new Error('All proxies failed');
    try {
      const proxied = PROXY_LIST[proxyIndex](url);
      const res = await fetch(proxied, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch {
      return fetchWithProxy(url, proxyIndex + 1);
    }
  }

  async function callFirebaseFunction(name, data) {
    const fn = window.WIP.functions.httpsCallable(name);
    const result = await fn(data);
    return result.data;
  }

  async function runScan(rawUrl) {
    if (state.isScanning) return;
    const url = normalizeUrl(rawUrl);
    if (!url) {
      showToast('Invalid URL. Please enter a valid website address.', 'error');
      return;
    }

    state.isScanning = true;
    state.currentUrl = url;
    state.scanResults = {};

    const scanBtn = document.getElementById('scanBtn');
    if (scanBtn) scanBtn.disabled = true;

    showSection('loaderSection');

    const steps = [
      'Fetching page source',
      'Analyzing HTML & DOM',
      'Scanning network requests',
      'Running security checks',
      'Measuring performance',
      'Inspecting design elements',
      'Analyzing SEO',
      'Checking storage',
      'Running AI analysis',
      'Building report'
    ];

    try {
      setLoaderStep(steps, 0, 5);
      updateLoaderStatus('Fetching page source...');

      let html = '';
      try {
        html = await fetchWithProxy(url);
      } catch {
        showToast('Could not fetch page. Trying server-side fetch...', 'warning');
      }

      const deepScan = document.getElementById('deepScanToggle')?.checked ?? true;
      const screenshot = document.getElementById('screenshotToggle')?.checked ?? true;
      const aiEnabled = document.getElementById('aiToggle')?.checked ?? true;

      setLoaderStep(steps, 1, 15);
      updateLoaderStatus('Analyzing HTML & DOM...');
      const analyzeResult = await callFirebaseFunction('analyzeUrl', {
        url,
        html,
        deepScan,
        screenshot,
        aiEnabled
      });

      state.scanResults = analyzeResult;

      setLoaderStep(steps, 2, 30);
      updateLoaderStatus('Processing network data...');
      await new Promise(r => setTimeout(r, 300));

      setLoaderStep(steps, 3, 45);
      updateLoaderStatus('Running security checks...');
      await new Promise(r => setTimeout(r, 300));

      setLoaderStep(steps, 4, 58);
      updateLoaderStatus('Measuring performance...');
      await new Promise(r => setTimeout(r, 300));

      setLoaderStep(steps, 5, 68);
      updateLoaderStatus('Inspecting design...');
      await new Promise(r => setTimeout(r, 300));

      setLoaderStep(steps, 6, 76);
      updateLoaderStatus('Analyzing SEO...');
      await new Promise(r => setTimeout(r, 300));

      setLoaderStep(steps, 7, 84);
      updateLoaderStatus('Checking storage...');
      await new Promise(r => setTimeout(r, 300));

      setLoaderStep(steps, 8, 92);
      updateLoaderStatus('Running AI analysis...');
      await new Promise(r => setTimeout(r, 300));

      setLoaderStep(steps, 9, 98);
      updateLoaderStatus('Building report...');
      await new Promise(r => setTimeout(r, 400));

      setLoaderStep(steps, steps.length, 100);

      if (state.settings.autoSave && state.user) {
        await saveScanToHistory(url, analyzeResult);
      }

      renderResults(analyzeResult, url);
      showSection('resultsSection');

    } catch (err) {
      console.error('Scan failed:', err);
      showToast(`Scan failed: ${err.message}`, 'error');
      showSection('scanSection');
    } finally {
      state.isScanning = false;
      if (scanBtn) scanBtn.disabled = false;
    }
  }

  function renderResults(data, url) {
    try {
      const parsed = new URL(url);
      const domain = parsed.hostname;

      const resultUrl = document.getElementById('resultUrl');
      const resultTimestamp = document.getElementById('resultTimestamp');
      const resultFavicon = document.getElementById('resultFavicon');

      if (resultUrl) resultUrl.textContent = domain;
      if (resultTimestamp) resultTimestamp.textContent = new Date().toLocaleString();
      if (resultFavicon) {
        resultFavicon.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        resultFavicon.onerror = () => { resultFavicon.src = ''; };
      }

      const scores = data.scores || {};
      updateScore('securityScore', scores.security ?? 0);
      updateScore('performanceScore', scores.performance ?? 0);
      updateScore('seoScore', scores.seo ?? 0);
      updateScore('designScore', scores.design ?? 0);

      renderOverviewTab(data);
      renderHtmlTab(data.html || {});
      renderNetworkTab(data.network || {});
      renderSecurityTab(data.security || {});
      renderPerformanceTab(data.performance || {});
      renderDesignTab(data.design || {});
      renderSeoTab(data.seo || {});
      renderStorageTab(data.storage || {});
      renderAiTab(data.ai || {});

      activateTab('overview');
    } catch (err) {
      console.error('Render error:', err);
      showToast('Error rendering results.', 'error');
    }
  }

  function updateScore(elementId, score) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = Math.round(score);
    const circle = el.closest('.score-circle');
    if (!circle) return;
    const color = score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--warning)' : 'var(--error)';
    circle.style.borderColor = color;
    circle.style.color = color;
  }

  function activateTab(tabId) {
    state.currentTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-${tabId}`);
    });
  }

  function renderOverviewTab(data) {
    const container = document.getElementById('overviewContent');
    if (!container) return;
    const scores = data.scores || {};
    const perf = data.performance || {};
    const sec = data.security || {};
    const seo = data.seo || {};

    container.innerHTML = `
      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">◈</span> Scan Summary</div>
        <div class="two-col">
          <div class="stat-box">
            <div class="stat-box-value">${perf.loadTime ? (perf.loadTime / 1000).toFixed(2) + 's' : '--'}</div>
            <div class="stat-box-label">Load Time</div>
          </div>
          <div class="stat-box">
            <div class="stat-box-value">${sec.issuesFound ?? '--'}</div>
            <div class="stat-box-label">Security Issues</div>
          </div>
          <div class="stat-box">
            <div class="stat-box-value">${seo.score ?? '--'}</div>
            <div class="stat-box-label">SEO Score</div>
          </div>
          <div class="stat-box">
            <div class="stat-box-value">${data.html?.totalElements ?? '--'}</div>
            <div class="stat-box-label">DOM Elements</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">⚡</span> Quick Stats</div>
        ${buildRow('Technology', data.html?.framework || 'Unknown')}
        ${buildRow('HTTPS', data.security?.https ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-error">No</span>')}
        ${buildRow('Mobile Friendly', data.seo?.mobileFriendly ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-warning">Unknown</span>')}
        ${buildRow('Resources', data.network?.totalRequests ?? '--')}
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🔒</span> Security Overview</div>
        ${buildRow('SSL', data.security?.ssl?.valid ? '<span class="badge badge-success">Valid</span>' : '<span class="badge badge-error">Invalid</span>')}
        ${buildRow('Headers', data.security?.headerScore ?? '--')}
        ${buildRow('API Keys Exposed', data.security?.apiKeys?.length > 0 ? `<span class="badge badge-error">${data.security.apiKeys.length} Found</span>` : '<span class="badge badge-success">None</span>')}
        ${buildRow('XSS Hints', data.security?.xssHints?.length > 0 ? `<span class="badge badge-warning">${data.security.xssHints.length}</span>` : '<span class="badge badge-success">None</span>')}
      </div>

      ${data.screenshot ? `
      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">📸</span> Screenshot</div>
        <img src="${data.screenshot}" class="screenshot-preview" alt="Website screenshot" loading="lazy">
      </div>` : ''}

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">🤖</span> AI Summary</div>
        <p style="font-size:12px;color:var(--muted);line-height:1.7">${data.ai?.summary || 'AI analysis not available.'}</p>
      </div>
    `;
  }

  function renderHtmlTab(html) {
    const container = document.getElementById('htmlContent');
    if (!container) return;
    container.innerHTML = `
      <div class="card">
        <div class="card-title"><span class="card-title-icon">📄</span> DOM Stats</div>
        ${buildRow('Total Elements', html.totalElements ?? '--')}
        ${buildRow('Links', html.links?.length ?? '--')}
        ${buildRow('Images', html.images?.length ?? '--')}
        ${buildRow('Scripts', html.scripts?.length ?? '--')}
        ${buildRow('Stylesheets', html.stylesheets?.length ?? '--')}
        ${buildRow('Forms', html.forms?.length ?? '--')}
        ${buildRow('iFrames', html.iframes?.length ?? '--')}
        ${buildRow('Hidden Elements', html.hiddenElements?.length ?? '--')}
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">💬</span> HTML Comments</div>
        ${html.comments?.length > 0
          ? html.comments.slice(0, 10).map(c => `<div class="code-block" style="margin-bottom:6px">${escapeHtml(c)}</div>`).join('')
          : '<div class="empty-state">No comments found</div>'
        }
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">📋</span> Forms Detected</div>
        ${html.forms?.length > 0
          ? html.forms.map(f => `
            <div class="list-item">
              <div>
                <div>${escapeHtml(f.action || 'No action')}</div>
                <div style="color:var(--muted);font-size:11px">Method: ${f.method || 'GET'} · Fields: ${f.fields || 0}</div>
              </div>
            </div>`).join('')
          : '<div class="empty-state">No forms found</div>'
        }
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🪟</span> iFrames</div>
        ${html.iframes?.length > 0
          ? html.iframes.map(f => `
            <div class="list-item">
              <span style="word-break:break-all;font-size:11px">${escapeHtml(f.src || 'No src')}</span>
            </div>`).join('')
          : '<div class="empty-state">No iFrames found</div>'
        }
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">🔗</span> External Links</div>
        ${html.links?.filter(l => l.external).slice(0, 20).map(l => `
          <div class="list-item">
            <span style="word-break:break-all;font-size:11px">${escapeHtml(l.href || '')}</span>
          </div>`).join('') || '<div class="empty-state">No external links found</div>'
        }
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">🧩</span> Framework Detected</div>
        <div class="card-row">
          <span class="card-row-label">Framework</span>
          <span class="card-row-value">${html.framework || 'Unknown'}</span>
        </div>
        ${html.libraries?.length > 0
          ? `<div style="margin-top:8px">${html.libraries.map(l => `<span class="tag">${escapeHtml(l)}</span>`).join('')}</div>`
          : ''
        }
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">📁</span> Source Viewer</div>
        <div class="code-block">${escapeHtml((html.rawSource || '').substring(0, 3000))}${html.rawSource?.length > 3000 ? '\n... (truncated)' : ''}</div>
      </div>
    `;
  }

  function renderNetworkTab(network) {
    const container = document.getElementById('networkContent');
    if (!container) return;
    container.innerHTML = `
      <div class="card">
        <div class="card-title"><span class="card-title-icon">🌐</span> Request Summary</div>
        ${buildRow('Total Requests', network.totalRequests ?? '--')}
        ${buildRow('Total Size', network.totalSize ? formatBytes(network.totalSize) : '--')}
        ${buildRow('Third Parties', network.thirdParties?.length ?? '--')}
        ${buildRow('CDN Detected', network.cdnDetected ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-muted">No</span>')}
        ${buildRow('API Endpoints', network.apiEndpoints?.length ?? '--')}
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🔑</span> Auth Tokens Found</div>
        ${network.authTokens?.length > 0
          ? network.authTokens.map(t => `<div class="list-item"><span class="badge badge-warning">${escapeHtml(t.type)}</span><span style="font-size:11px;margin-left:6px">${escapeHtml(t.value?.substring(0, 40))}...</span></div>`).join('')
          : '<div class="empty-state">No auth tokens detected</div>'
        }
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">📡</span> API Endpoints</div>
        ${network.apiEndpoints?.length > 0
          ? network.apiEndpoints.map(ep => `
            <div class="list-item">
              <span class="badge badge-muted">${escapeHtml(ep.method || 'GET')}</span>
              <span style="font-size:11px;word-break:break-all">${escapeHtml(ep.url || '')}</span>
            </div>`).join('')
          : '<div class="empty-state">No API endpoints found</div>'
        }
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">🏢</span> Third Party Services</div>
        ${network.thirdParties?.length > 0
          ? network.thirdParties.map(tp => `
            <div class="list-item">
              <div>
                <div style="font-weight:600">${escapeHtml(tp.name || tp.domain || '')}</div>
                <div style="color:var(--muted);font-size:11px">${escapeHtml(tp.category || '')}</div>
              </div>
            </div>`).join('')
          : '<div class="empty-state">No third party services detected</div>'
        }
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">📦</span> CDN Information</div>
        ${buildRow('CDN Provider', network.cdnProvider || 'Unknown')}
        ${buildRow('CDN Headers', network.cdnHeaders?.join(', ') || '--')}
      </div>
    `;
  }

  function renderSecurityTab(security) {
    const container = document.getElementById('securityContent');
    if (!container) return;
    container.innerHTML = `
      <div class="card">
        <div class="card-title"><span class="card-title-icon">🔐</span> SSL Certificate</div>
        ${buildRow('Valid', security.ssl?.valid ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-error">No</span>')}
        ${buildRow('Issuer', security.ssl?.issuer || '--')}
        ${buildRow('Expires', security.ssl?.expires || '--')}
        ${buildRow('Protocol', security.ssl?.protocol || '--')}
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">📋</span> Security Headers</div>
        ${(security.headers || []).map(h => `
          <div class="card-row">
            <span class="card-row-label">${escapeHtml(h.name)}</span>
            <span class="${h.present ? 'badge badge-success' : 'badge badge-error'}">${h.present ? 'Present' : 'Missing'}</span>
          </div>`).join('') || '<div class="empty-state">No header data</div>'
        }
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">🗝️</span> Exposed API Keys</div>
        ${security.apiKeys?.length > 0
          ? security.apiKeys.map(k => `
            <div class="list-item">
              <div>
                <span class="badge badge-error">${escapeHtml(k.type)}</span>
                <div class="code-block" style="margin-top:4px">${escapeHtml(k.value?.substring(0, 60))}...</div>
              </div>
            </div>`).join('')
          : '<div class="empty-state" style="color:var(--success)">✓ No exposed API keys found</div>'
        }
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">🔑</span> Credentials Found</div>
        ${security.credentials?.length > 0
          ? security.credentials.map(c => `
            <div class="list-item">
              <span class="badge badge-error">${escapeHtml(c.type)}</span>
              <span style="font-size:11px">${escapeHtml(c.context?.substring(0, 80))}</span>
            </div>`).join('')
          : '<div class="empty-state" style="color:var(--success)">✓ No credentials exposed</div>'
        }
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">⚠️</span> XSS Indicators</div>
        ${security.xssHints?.length > 0
          ? security.xssHints.map(x => `<div class="list-item"><span class="badge badge-warning">XSS</span><span style="font-size:11px">${escapeHtml(x)}</span></div>`).join('')
          : '<div class="empty-state" style="color:var(--success)">✓ No XSS indicators</div>'
        }
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">💉</span> SQL Injection Points</div>
        ${security.sqliPoints?.length > 0
          ? security.sqliPoints.map(s => `<div class="list-item"><span class="badge badge-error">SQLi</span><span style="font-size:11px">${escapeHtml(s)}</span></div>`).join('')
          : '<div class="empty-state" style="color:var(--success)">✓ No injection points found</div>'
        }
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🔄</span> CORS Analysis</div>
        ${buildRow('CORS Policy', security.cors?.policy || 'Unknown')}
        ${buildRow('Allow Origin', escapeHtml(security.cors?.allowOrigin || '--'))}
        ${buildRow('Allow Methods', escapeHtml(security.cors?.allowMethods || '--'))}
        ${buildRow('Risk Level', security.cors?.risk ? `<span class="badge badge-${security.cors.risk === 'high' ? 'error' : security.cors.risk === 'medium' ? 'warning' : 'success'}">${security.cors.risk}</span>` : '--')}
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🤖</span> robots.txt</div>
        <div class="code-block">${escapeHtml(security.robotsTxt || 'Not found')}</div>
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🗺️</span> Sitemap</div>
        ${buildRow('Found', security.sitemap?.found ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-muted">No</span>')}
        ${buildRow('URL', escapeHtml(security.sitemap?.url || '--'))}
        ${buildRow('Entries', security.sitemap?.entries ?? '--')}
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🗄️</span> Admin Panels Found</div>
        ${security.adminPanels?.length > 0
          ? security.adminPanels.map(a => `<div class="list-item"><span class="badge badge-warning">ADMIN</span><span style="font-size:11px">${escapeHtml(a)}</span></div>`).join('')
          : '<div class="empty-state">No admin panels found</div>'
        }
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🗺️</span> Source Maps</div>
        ${security.sourceMaps?.length > 0
          ? security.sourceMaps.map(s => `<div class="list-item"><span class="badge badge-warning">MAP</span><span style="font-size:11px;word-break:break-all">${escapeHtml(s)}</span></div>`).join('')
          : '<div class="empty-state">No source maps found</div>'
        }
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">🔑</span> JWT Tokens</div>
        ${security.jwtTokens?.length > 0
          ? security.jwtTokens.map(j => `
            <div class="card" style="margin-bottom:8px">
              <div style="font-size:11px;word-break:break-all;color:var(--warning)">${escapeHtml(j.token?.substring(0, 80))}...</div>
              ${j.decoded ? `<div class="code-block" style="margin-top:6px">${escapeHtml(JSON.stringify(j.decoded, null, 2))}</div>` : ''}
            </div>`).join('')
          : '<div class="empty-state">No JWT tokens found</div>'
        }
      </div>
    `;
  }

  function renderPerformanceTab(perf) {
    const container = document.getElementById('performanceContent');
    if (!container) return;
    container.innerHTML = `
      <div class="card">
        <div class="card-title"><span class="card-title-icon">⏱️</span> Core Metrics</div>
        ${buildRow('Load Time', perf.loadTime ? (perf.loadTime / 1000).toFixed(2) + 's' : '--')}
        ${buildRow('TTFB', perf.ttfb ? perf.ttfb + 'ms' : '--')}
        ${buildRow('FCP', perf.fcp ? perf.fcp + 'ms' : '--')}
        ${buildRow('LCP', perf.lcp ? perf.lcp + 'ms' : '--')}
        ${buildRow('Total Size', perf.totalSize ? formatBytes(perf.totalSize) : '--')}
        ${buildRow('Requests', perf.requestCount ?? '--')}
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🗜️</span> Compression</div>
        ${buildRow('Gzip', perf.gzip ? '<span class="badge badge-success">Enabled</span>' : '<span class="badge badge-warning">Not Detected</span>')}
        ${buildRow('Brotli', perf.brotli ? '<span class="badge badge-success">Enabled</span>' : '<span class="badge badge-muted">Not Detected</span>')}
        ${buildRow('HTML Size', perf.htmlSize ? formatBytes(perf.htmlSize) : '--')}
        ${buildRow('Compressed Size', perf.compressedSize ? formatBytes(perf.compressedSize) : '--')}
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">📦</span> Resource Breakdown</div>
        ${buildRow('JS Files', perf.resources?.js?.count ?? '--')}
        ${buildRow('CSS Files', perf.resources?.css?.count ?? '--')}
        ${buildRow('Images', perf.resources?.images?.count ?? '--')}
        ${buildRow('Fonts', perf.resources?.fonts?.count ?? '--')}
        ${buildRow('JS Size', perf.resources?.js?.size ? formatBytes(perf.resources.js.size) : '--')}
        ${buildRow('CSS Size', perf.resources?.css?.size ? formatBytes(perf.resources.css.size) : '--')}
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🚫</span> Render Blocking</div>
        ${perf.renderBlocking?.length > 0
          ? perf.renderBlocking.map(r => `<div class="list-item"><span class="badge badge-warning">BLOCKING</span><span style="font-size:11px;word-break:break-all">${escapeHtml(r)}</span></div>`).join('')
          : '<div class="empty-state" style="color:var(--success)">✓ No render blocking resources</div>'
        }
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🗑️</span> Unused Resources</div>
        ${perf.unusedCss?.length > 0
          ? perf.unusedCss.map(r => `<div class="list-item"><span class="badge badge-muted">CSS</span><span style="font-size:11px;word-break:break-all">${escapeHtml(r)}</span></div>`).join('')
          : '<div class="empty-state">No unused CSS detected</div>'
        }
        ${perf.unusedJs?.length > 0
          ? perf.unusedJs.map(r => `<div class="list-item"><span class="badge badge-muted">JS</span><span style="font-size:11px;word-break:break-all">${escapeHtml(r)}</span></div>`).join('')
          : ''
        }
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🖼️</span> Image Optimization</div>
        ${buildRow('Unoptimized Images', perf.unoptimizedImages?.length ?? 0)}
        ${buildRow('Modern Format', perf.modernImageFormats ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-warning">No</span>')}
        ${buildRow('Lazy Loading', perf.lazyLoading ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-warning">No</span>')}
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">💾</span> Cache Analysis</div>
        ${buildRow('Cache Control', escapeHtml(perf.cacheControl || '--'))}
        ${buildRow('ETag', perf.etag ? '<span class="badge badge-success">Present</span>' : '<span class="badge badge-muted">Missing</span>')}
        ${buildRow('Last Modified', escapeHtml(perf.lastModified || '--'))}
      </div>
    `;
  }

  function renderDesignTab(design) {
    const container = document.getElementById('designContent');
    if (!container) return;
    container.innerHTML = `
      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">🎨</span> Color Palette</div>
        <div class="swatch-grid">
          ${(design.colors || []).map(c => `
            <div class="color-swatch">
              <div class="color-swatch-box" style="background:${escapeHtml(c.value)}"></div>
              <span>${escapeHtml(c.value)}</span>
            </div>`).join('') || '<div class="empty-state">No colors extracted</div>'
          }
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🔤</span> Fonts</div>
        ${design.fonts?.length > 0
          ? design.fonts.map(f => `<div class="list-item"><span style="font-weight:600">${escapeHtml(f.name || f)}</span>${f.source ? `<span class="badge badge-muted">${escapeHtml(f.source)}</span>` : ''}</div>`).join('')
          : '<div class="empty-state">No fonts detected</div>'
        }
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">📐</span> Layout Info</div>
        ${buildRow('Framework', design.framework || 'Custom')}
        ${buildRow('Responsive', design.responsive ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-warning">No</span>')}
        ${buildRow('Dark Mode', design.darkMode ? '<span class="badge badge-success">Supported</span>' : '<span class="badge badge-muted">Not Detected</span>')}
        ${buildRow('Breakpoints', design.breakpoints?.join(', ') || '--')}
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">🎬</span> Animations</div>
        ${design.animations?.length > 0
          ? design.animations.map(a => `<div class="list-item"><span class="tag">${escapeHtml(a)}</span></div>`).join('')
          : '<div class="empty-state">No animations detected</div>'
        }
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">📦</span> CSS Variables</div>
        ${design.cssVariables?.length > 0
          ? `<div class="code-block">${design.cssVariables.slice(0, 30).map(v => escapeHtml(`${v.name}: ${v.value}`)).join('\n')}</div>`
          : '<div class="empty-state">No CSS variables found</div>'
        }
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">🖼️</span> Assets</div>
        ${design.assets?.length > 0
          ? design.assets.slice(0, 20).map(a => `
            <div class="list-item">
              <span class="badge badge-muted">${escapeHtml(a.type || 'FILE')}</span>
              <span style="font-size:11px;word-break:break-all">${escapeHtml(a.url || '')}</span>
            </div>`).join('')
          : '<div class="empty-state">No assets found</div>'
        }
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">◉</span> SVG Elements</div>
        ${buildRow('SVGs Found', design.svgs?.length ?? 0)}
        ${buildRow('Inline SVGs', design.inlineSvgs ?? '--')}
        ${buildRow('External SVGs', design.externalSvgs ?? '--')}
      </div>
    `;
  }

  function renderSeoTab(seo) {
    const container = document.getElementById('seoContent');
    if (!container) return;
    container.innerHTML = `
      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">📝</span> Meta Tags</div>
        ${buildRow('Title', escapeHtml(seo.title || '--'))}
        ${buildRow('Description', escapeHtml(seo.description || '--'))}
        ${buildRow('Keywords', escapeHtml(seo.keywords || '--'))}
        ${buildRow('Canonical', escapeHtml(seo.canonical || '--'))}
        ${buildRow('Robots', escapeHtml(seo.robots || '--'))}
        ${buildRow('Viewport', escapeHtml(seo.viewport || '--'))}
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">📊</span> Headings</div>
        ${['h1','h2','h3','h4','h5','h6'].map(h => buildRow(h.toUpperCase(), seo.headings?.[h]?.length ?? 0)).join('')}
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🔗</span> Open Graph</div>
        ${buildRow('og:title', escapeHtml(seo.ogTags?.['og:title'] || '--'))}
        ${buildRow('og:description', escapeHtml(seo.ogTags?.['og:description'] || '--'))}
        ${buildRow('og:image', seo.ogTags?.['og:image'] ? '<span class="badge badge-success">Present</span>' : '<span class="badge badge-error">Missing</span>')}
        ${buildRow('og:type', escapeHtml(seo.ogTags?.['og:type'] || '--'))}
        ${buildRow('og:url', escapeHtml(seo.ogTags?.['og:url'] || '--'))}
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🐦</span> Twitter Cards</div>
        ${buildRow('Card Type', escapeHtml(seo.twitterTags?.['twitter:card'] || '--'))}
        ${buildRow('Title', escapeHtml(seo.twitterTags?.['twitter:title'] || '--'))}
        ${buildRow('Image', seo.twitterTags?.['twitter:image'] ? '<span class="badge badge-success">Present</span>' : '<span class="badge badge-warning">Missing</span>')}
        ${buildRow('Site', escapeHtml(seo.twitterTags?.['twitter:site'] || '--'))}
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🖼️</span> Image Alt Tags</div>
        ${buildRow('Total Images', seo.images?.total ?? '--')}
        ${buildRow('With Alt', seo.images?.withAlt ?? '--')}
        ${buildRow('Without Alt', seo.images?.withoutAlt ?? '--')}
        ${buildRow('Coverage', seo.images?.total > 0 ? Math.round((seo.images.withAlt / seo.images.total) * 100) + '%' : '--')}
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">📋</span> Schema Markup</div>
        ${seo.schema?.length > 0
          ? seo.schema.map(s => `
            <div style="margin-bottom:8px">
              <span class="badge badge-muted">${escapeHtml(s.type || 'Schema')}</span>
              <div class="code-block" style="margin-top:4px">${escapeHtml(JSON.stringify(s.data, null, 2).substring(0, 500))}</div>
            </div>`).join('')
          : '<div class="empty-state">No schema markup found</div>'
        }
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">🔑</span> Keywords</div>
        <div style="margin-top:4px">
          ${(seo.topKeywords || []).map(k => `<span class="tag">${escapeHtml(k.word)} (${k.count})</span>`).join('') || '<span class="empty-state">No keywords extracted</span>'}
        </div>
      </div>
    `;
  }

  function renderStorageTab(storage) {
    const container = document.getElementById('storageContent');
    if (!container) return;
    container.innerHTML = `
      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">🍪</span> Cookies</div>
        ${storage.cookies?.length > 0
          ? storage.cookies.map(c => `
            <div class="card-row">
              <span class="card-row-label">${escapeHtml(c.name)}</span>
              <div style="text-align:right">
                <div style="font-size:11px;word-break:break-all">${escapeHtml((c.value || '').substring(0, 40))}</div>
                <div style="margin-top:2px">${c.secure ? '<span class="badge badge-success">Secure</span>' : '<span class="badge badge-warning">Insecure</span>'} ${c.httpOnly ? '<span class="badge badge-muted">HttpOnly</span>' : ''}</div>
              </div>
            </div>`).join('')
          : '<div class="empty-state">No cookies detected</div>'
        }
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">💾</span> Local Storage</div>
        ${storage.localStorage?.length > 0
          ? storage.localStorage.map(item => `
            <div class="card-row">
              <span class="card-row-label">${escapeHtml(item.key)}</span>
              <span style="font-size:11px;word-break:break-all;text-align:right">${escapeHtml((item.value || '').substring(0, 60))}</span>
            </div>`).join('')
          : '<div class="empty-state">No local storage items detected</div>'
        }
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">📂</span> Session Storage</div>
        ${storage.sessionStorage?.length > 0
          ? storage.sessionStorage.map(item => `
            <div class="card-row">
              <span class="card-row-label">${escapeHtml(item.key)}</span>
              <span style="font-size:11px;word-break:break-all;text-align:right">${escapeHtml((item.value || '').substring(0, 60))}</span>
            </div>`).join('')
          : '<div class="empty-state">No session storage items detected</div>'
        }
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🔧</span> Service Workers</div>
        ${storage.serviceWorkers?.length > 0
          ? storage.serviceWorkers.map(sw => `
            <div class="list-item">
              <div>
                <div style="font-weight:600">${escapeHtml(sw.url || '--')}</div>
                <div style="color:var(--muted);font-size:11px">Scope: ${escapeHtml(sw.scope || '--')}</div>
              </div>
            </div>`).join('')
          : '<div class="empty-state">No service workers found</div>'
        }
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🗃️</span> IndexedDB</div>
        ${storage.indexedDb?.length > 0
          ? storage.indexedDb.map(db => `<div class="list-item"><span style="font-weight:600">${escapeHtml(db.name || '')}</span><span class="badge badge-muted">${db.version || '--'}</span></div>`).join('')
          : '<div class="empty-state">No IndexedDB databases detected</div>'
        }
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🗄️</span> Cache Storage</div>
        ${storage.cacheStorage?.length > 0
          ? storage.cacheStorage.map(c => `<div class="list-item"><span>${escapeHtml(c.name || c)}</span></div>`).join('')
          : '<div class="empty-state">No cache storage detected</div>'
        }
      </div>
    `;
  }

  function renderAiTab(ai) {
    const container = document.getElementById('aiContent');
    if (!container) return;
    container.innerHTML = `
      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">🤖</span> AI Summary</div>
        <p style="font-size:12px;color:var(--muted);line-height:1.8">${escapeHtml(ai.summary || 'No summary available.')}</p>
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">🧱</span> Stack Detection</div>
        ${(ai.stack || []).map(s => `
          <div class="list-item">
            <span class="badge badge-muted">${escapeHtml(s.category || 'Tech')}</span>
            <span style="font-weight:600">${escapeHtml(s.name)}</span>
            ${s.version ? `<span style="color:var(--muted);font-size:11px">v${escapeHtml(s.version)}</span>` : ''}
          </div>`).join('') || '<div class="empty-state">Stack analysis unavailable</div>'
        }
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">🔒</span> Security Explanation</div>
        <p style="font-size:12px;color:var(--muted);line-height:1.8">${escapeHtml(ai.securityExplanation || 'Not available.')}</p>
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">⚡</span> Performance Explanation</div>
        <p style="font-size:12px;color:var(--muted);line-height:1.8">${escapeHtml(ai.performanceExplanation || 'Not available.')}</p>
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">🐛</span> Bugs Found</div>
        ${ai.bugs?.length > 0
          ? ai.bugs.map(b => `
            <div class="list-item">
              <div>
                <span class="badge badge-error">BUG</span>
                <div style="margin-top:4px;font-size:12px">${escapeHtml(b)}</div>
              </div>
            </div>`).join('')
          : '<div class="empty-state" style="color:var(--success)">✓ No bugs identified</div>'
        }
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">💡</span> Improvements</div>
        ${ai.improvements?.length > 0
          ? ai.improvements.map(imp => `
            <div class="list-item">
              <span style="color:var(--green);margin-right:4px">→</span>
              <span style="font-size:12px">${escapeHtml(imp)}</span>
            </div>`).join('')
          : '<div class="empty-state">No suggestions available</div>'
        }
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">♿</span> Accessibility</div>
        <p style="font-size:12px;color:var(--muted);line-height:1.8">${escapeHtml(ai.accessibility || 'Not available.')}</p>
        ${ai.accessibilityIssues?.length > 0
          ? ai.accessibilityIssues.map(i => `<div class="list-item"><span class="badge badge-warning">A11Y</span><span style="font-size:12px">${escapeHtml(i)}</span></div>`).join('')
          : ''
        }
      </div>

      <div class="card full-width">
        <div class="card-title"><span class="card-title-icon">💬</span> Code Explanation</div>
        <p style="font-size:12px;color:var(--muted);line-height:1.8">${escapeHtml(ai.codeExplanation || 'Not available.')}</p>
      </div>
    `;
  }

  function buildRow(label, value) {
    return `
      <div class="card-row">
        <span class="card-row-label">${label}</span>
        <span class="card-row-value">${value ?? '--'}</span>
      </div>
    `;
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async function saveScanToHistory(url, data) {
    if (!state.user) return;
    try {
      await window.WIP.db.collection('scans').add({
        userId: state.user.uid,
        url,
        scores: data.scores || {},
        status: 'completed',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        isPublic: false
      });
    } catch (err) {
      console.error('Save scan error:', err);
    }
  }

  async function loadHistory() {
    if (!state.user) {
      showToast('Sign in to view history', 'warning');
      return;
    }
    showSection('historySection');
    const list = document.getElementById('historyList');
    list.innerHTML = '<div class="empty-state">Loading...</div>';
    try {
      const snap = await window.WIP.db.collection('scans')
        .where('userId', '==', state.user.uid)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      if (snap.empty) {
        list.innerHTML = '<div class="empty-state">No scans yet</div>';
        return;
      }
      list.innerHTML = snap.docs.map(doc => {
        const d = doc.data();
        const ts = d.createdAt?.toDate?.()?.toLocaleString() || 'Unknown';
        return `
          <div class="history-item">
            <div class="history-item-info">
              <div class="history-item-url">${escapeHtml(d.url)}</div>
              <div class="history-item-meta">${ts}</div>
            </div>
            <div class="history-item-actions">
              <button class="icon-btn" onclick="window.WIP.rescanUrl('${escapeHtml(d.url)}')" title="Re-scan">↺</button>
              <button class="icon-btn" onclick="window.WIP.deleteScan('${doc.id}')" title="Delete">✕</button>
            </div>
          </div>`;
      }).join('');
    } catch (err) {
      list.innerHTML = `<div class="empty-state">Error: ${escapeHtml(err.message)}</div>`;
    }
  }

  async function loadFavorites() {
    if (!state.user) {
      showToast('Sign in to view favorites', 'warning');
      return;
    }
    showSection('favoritesSection');
    const list = document.getElementById('favoritesList');
    list.innerHTML = '<div class="empty-state">Loading...</div>';
    try {
      const snap = await window.WIP.db
        .collection('users').doc(state.user.uid)
        .collection('favorites')
        .orderBy('createdAt', 'desc')
        .get();
      if (snap.empty) {
        list.innerHTML = '<div class="empty-state">No favorites yet</div>';
        return;
      }
      list.innerHTML = snap.docs.map(doc => {
        const d = doc.data();
        return `
          <div class="favorite-item">
            <div class="history-item-info">
              <div class="history-item-url">${escapeHtml(d.url)}</div>
              <div class="history-item-meta">${d.createdAt?.toDate?.()?.toLocaleString() || ''}</div>
            </div>
            <div class="history-item-actions">
              <button class="icon-btn" onclick="window.WIP.rescanUrl('${escapeHtml(d.url)}')" title="Scan">→</button>
              <button class="icon-btn" onclick="window.WIP.removeFavorite('${doc.id}')" title="Remove">✕</button>
            </div>
          </div>`;
      }).join('');
    } catch (err) {
      list.innerHTML = `<div class="empty-state">Error: ${escapeHtml(err.message)}</div>`;
    }
  }

  async function addFavorite() {
    if (!state.user) { showToast('Sign in to save favorites', 'warning'); return; }
    if (!state.currentUrl) return;
    try {
      await window.WIP.db
        .collection('users').doc(state.user.uid)
        .collection('favorites')
        .add({
          url: state.currentUrl,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      showToast('Added to favorites', 'success');
    } catch (err) {
      showToast('Could not save favorite', 'error');
    }
  }

  async function shareResult() {
    if (!state.currentUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Web Inspector Pro', url: state.currentUrl });
      } else {
        await navigator.clipboard.writeText(state.currentUrl);
        showToast('URL copied to clipboard', 'success');
      }
    } catch {
      showToast('Could not share', 'error');
    }
  }

  async function exportPdf() {
    if (!state.currentUrl) return;
    showToast('Generating PDF report...', 'info');
    try {
      const result = await callFirebaseFunction('generateReport', {
        url: state.currentUrl,
        data: state.scanResults
      });
      if (result.downloadUrl) {
        window.open(result.downloadUrl, '_blank');
      }
    } catch (err) {
      showToast('PDF export failed: ' + err.message, 'error');
    }
  }

  function initEventListeners() {
    const scanForm = document.getElementById('scanForm');
    const urlInput = document.getElementById('urlInput');
    const clearUrlBtn = document.getElementById('clearUrlBtn');
    const newScanBtn = document.getElementById('newScanBtn');
    const historyBtn = document.getElementById('historyBtn');
    const favoritesBtn = document.getElementById('favoritesBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const authBtn = document.getElementById('authBtn');
    const favoriteBtn = document.getElementById('favoriteBtn');
    const shareBtn = document.getElementById('shareBtn');
    const pdfBtn = document.getElementById('pdfBtn');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const closeFavoritesBtn = document.getElementById('closeFavoritesBtn');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const closeAuthBtn = document.getElementById('closeAuthBtn');
    const modalOverlay = document.getElementById('modalOverlay');

    if (scanForm) scanForm.addEventListener('submit', e => { e.preventDefault(); runScan(urlInput?.value || ''); });
    if (clearUrlBtn) clearUrlBtn.addEventListener('click', () => { if (urlInput) urlInput.value = ''; urlInput?.focus(); });
    if (newScanBtn) newScanBtn.addEventListener('click', () => showSection('scanSection'));
    if (historyBtn) historyBtn.addEventListener('click', loadHistory);
    if (favoritesBtn) favoritesBtn.addEventListener('click', loadFavorites);
    if (settingsBtn) settingsBtn.addEventListener('click', () => { showSection('settingsSection'); if (window.WIP.renderSettings) window.WIP.renderSettings(); });
    if (authBtn) authBtn.addEventListener('click', () => { showSection('authSection'); if (window.WIP.renderAuth) window.WIP.renderAuth(); });
    if (favoriteBtn) favoriteBtn.addEventListener('click', addFavorite);
    if (shareBtn) shareBtn.addEventListener('click', shareResult);
    if (pdfBtn) pdfBtn.addEventListener('click', exportPdf);
    if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', () => showSection(state.scanResults && Object.keys(state.scanResults).length > 0 ? 'resultsSection' : 'scanSection'));
    if (closeFavoritesBtn) closeFavoritesBtn.addEventListener('click', () => showSection(state.scanResults && Object.keys(state.scanResults).length > 0 ? 'resultsSection' : 'scanSection'));
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => showSection(state.scanResults && Object.keys(state.scanResults).length > 0 ? 'resultsSection' : 'scanSection'));
    if (closeAuthBtn) closeAuthBtn.addEventListener('click', () => showSection(state.scanResults && Object.keys(state.scanResults).length > 0 ? 'resultsSection' : 'scanSection'));
    if (modalOverlay) modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    });
  }

  function initAuthListener() {
    window.WIP.auth.onAuthStateChanged(user => {
      state.user = user;
      const authBtn = document.getElementById('authBtn');
      if (authBtn) {
        authBtn.title = user ? 'Account' : 'Sign In';
        authBtn.style.color = user ? 'var(--green)' : '';
      }
    });
  }

  window.WIP.rescanUrl = function (url) {
    showSection('scanSection');
    const input = document.getElementById('urlInput');
    if (input) input.value = url;
    runScan(url);
  };

  window.WIP.deleteScan = async function (scanId) {
    try {
      await window.WIP.db.collection('scans').doc(scanId).delete();
      showToast('Scan deleted', 'success');
      loadHistory();
    } catch (err) {
      showToast('Delete failed', 'error');
    }
  };

  window.WIP.removeFavorite = async function (favId) {
    if (!state.user) return;
    try {
      await window.WIP.db.collection('users').doc(state.user.uid).collection('favorites').doc(favId).delete();
      showToast('Removed from favorites', 'success');
      loadFavorites();
    } catch {
      showToast('Remove failed', 'error');
    }
  };

  window.WIP.showToast = showToast;
  window.WIP.showModal = showModal;
  window.WIP.closeModal = closeModal;
  window.WIP.showSection = showSection;
  window.WIP.state = state;
  window.WIP.callFirebaseFunction = callFirebaseFunction;
  window.WIP.formatBytes = formatBytes;
  window.WIP.escapeHtml = escapeHtml;

  document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    initAuthListener();
    showSection('scanSection');
  });
})();