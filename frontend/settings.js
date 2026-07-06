(function() {
  const db = window.WIP.db;
  const auth = window.WIP.auth;
  
  const DEFAULT_SETTINGS = {
    deepScan: true,
    screenshot: true,
    aiAnalysis: true,
    autoSave: true,
    openaiKey: '',
    geminiKey: '',
    puppeteerUrl: '',
    theme: 'dark',
    defaultViewport: 'desktop',
    maxScanHistory: 50,
    notifications: true,
    compactMode: false,
    showScores: true,
    autoShare: false,
  };
  
  let localSettings = { ...DEFAULT_SETTINGS };
  
  async function loadSettings() {
    const stored = localStorage.getItem('wip_settings');
    if (stored) {
      try {
        localSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } catch {}
    }
    
    if (auth.currentUser) {
      try {
        const doc = await db.collection('users').doc(auth.currentUser.uid)
          .collection('settings').doc('preferences').get();
        if (doc.exists) {
          localSettings = { ...localSettings, ...doc.data() };
        }
      } catch {}
    }
    
    applySettings();
    return localSettings;
  }
  
  async function saveSettings(newSettings) {
    localSettings = { ...localSettings, ...newSettings };
    
    const safeSettings = { ...localSettings };
    delete safeSettings.openaiKey;
    delete safeSettings.geminiKey;
    delete safeSettings.puppeteerUrl;
    
    localStorage.setItem('wip_settings', JSON.stringify(safeSettings));
    
    if (auth.currentUser) {
      try {
        await db.collection('users').doc(auth.currentUser.uid)
          .collection('settings').doc('preferences').set({
            ...safeSettings,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
      } catch (err) {
        console.error('Save settings error:', err);
      }
    }
    
    window.WIP.state.settings = localSettings;
    applySettings();
  }
  
  function applySettings() {
    const deepToggle = document.getElementById('deepScanToggle');
    const screenshotToggle = document.getElementById('screenshotToggle');
    const aiToggle = document.getElementById('aiToggle');
    if (deepToggle) deepToggle.checked = localSettings.deepScan;
    if (screenshotToggle) screenshotToggle.checked = localSettings.screenshot;
    if (aiToggle) aiToggle.checked = localSettings.aiAnalysis;
    window.WIP.state.settings = localSettings;
  }
  
  function renderSettings() {
    const container = document.getElementById('settingsContent');
    if (!container) return;
    
    container.innerHTML = `
      <div class="card">
        <div class="card-title"><span class="card-title-icon">🔍</span> Scan Options</div>
        ${renderToggleItem('Deep Scan', 'Enable Puppeteer-powered deep DOM scanning', 'setting_deepScan', localSettings.deepScan)}
        ${renderToggleItem('Screenshot', 'Capture full page screenshot during scan', 'setting_screenshot', localSettings.screenshot)}
        ${renderToggleItem('AI Analysis', 'Run AI-powered insights on scan results', 'setting_aiAnalysis', localSettings.aiAnalysis)}
        ${renderToggleItem('Auto Save', 'Automatically save scan results to history', 'setting_autoSave', localSettings.autoSave)}
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🎨</span> Display</div>
        ${renderToggleItem('Show Scores', 'Show score cards on results page', 'setting_showScores', localSettings.showScores)}
        ${renderToggleItem('Compact Mode', 'Use compact layout for cards', 'setting_compactMode', localSettings.compactMode)}
        <div class="settings-item">
          <div>
            <div class="settings-item-label">Default Viewport</div>
            <div class="settings-item-desc">Screenshot viewport size</div>
          </div>
          <select id="setting_defaultViewport" class="form-input" style="width:auto;height:36px;padding:0 8px">
            <option value="desktop" ${localSettings.defaultViewport === 'desktop' ? 'selected' : ''}>Desktop</option>
            <option value="tablet" ${localSettings.defaultViewport === 'tablet' ? 'selected' : ''}>Tablet</option>
            <option value="mobile" ${localSettings.defaultViewport === 'mobile' ? 'selected' : ''}>Mobile</option>
          </select>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">🔑</span> API Keys <span style="font-size:10px;color:var(--muted)">(stored locally only)</span></div>
        <div class="form-group" style="margin-bottom:10px">
          <label class="form-label">OpenAI API Key</label>
          <input type="password" id="setting_openaiKey" class="form-input" placeholder="sk-..." value="${window.WIP.escapeHtml(localSettings.openaiKey || '')}">
        </div>
        <div class="form-group" style="margin-bottom:10px">
          <label class="form-label">Gemini API Key</label>
          <input type="password" id="setting_geminiKey" class="form-input" placeholder="AIza..." value="${window.WIP.escapeHtml(localSettings.geminiKey || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Puppeteer Server URL</label>
          <input type="url" id="setting_puppeteerUrl" class="form-input" placeholder="https://your-replit-app.repl.co" value="${window.WIP.escapeHtml(localSettings.puppeteerUrl || '')}">
        </div>
        <div style="margin-top:8px;padding:8px;background:var(--bg);border-radius:6px;font-size:11px;color:var(--muted)">
          ⚠ API keys are stored in your browser only and never sent to our servers.
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">📜</span> History</div>
        <div class="settings-item">
          <div>
            <div class="settings-item-label">Max History Items</div>
            <div class="settings-item-desc">How many scans to keep in history</div>
          </div>
          <select id="setting_maxScanHistory" class="form-input" style="width:auto;height:36px;padding:0 8px">
            <option value="20" ${localSettings.maxScanHistory === 20 ? 'selected' : ''}>20</option>
            <option value="50" ${localSettings.maxScanHistory === 50 ? 'selected' : ''}>50</option>
            <option value="100" ${localSettings.maxScanHistory === 100 ? 'selected' : ''}>100</option>
          </select>
        </div>
        <div style="margin-top:10px">
          <button id="clearHistoryBtn" class="form-btn form-btn-secondary" style="width:100%;color:var(--error);border-color:var(--error)">
            Clear All History
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">ℹ</span> About</div>
        <div class="card-row">
          <span class="card-row-label">Version</span>
          <span class="card-row-value">1.0.0</span>
        </div>
        <div class="card-row">
          <span class="card-row-label">Build</span>
          <span class="card-row-value">Production</span>
        </div>
        <div class="card-row">
          <span class="card-row-label">Stack</span>
          <span class="card-row-value">Firebase + Puppeteer + OpenAI</span>
        </div>
      </div>

      <button id="saveSettingsBtn" class="form-btn" style="margin-top:4px">Save Settings</button>
      <button id="resetSettingsBtn" class="form-btn form-btn-secondary">Reset to Defaults</button>
    `;
    
    initToggleListeners();
    initSettingsActions();
  }
  
  function renderToggleItem(label, desc, id, value) {
    return `
      <div class="settings-item">
        <div>
          <div class="settings-item-label">${label}</div>
          <div class="settings-item-desc">${desc}</div>
        </div>
        <div class="toggle-switch ${value ? 'active' : ''}" id="${id}" role="switch" aria-checked="${value}" tabindex="0">
          <div class="toggle-switch-knob"></div>
        </div>
      </div>
    `;
  }
  
  function initToggleListeners() {
    const toggleIds = ['setting_deepScan', 'setting_screenshot', 'setting_aiAnalysis', 'setting_autoSave', 'setting_showScores', 'setting_compactMode'];
    for (const id of toggleIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('click', () => {
        el.classList.toggle('active');
        el.setAttribute('aria-checked', el.classList.contains('active'));
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          el.click();
        }
      });
    }
  }
  
  function initSettingsActions() {
    document.getElementById('saveSettingsBtn')?.addEventListener('click', async () => {
      const getToggleValue = (id) => document.getElementById(id)?.classList.contains('active') ?? false;
      
      const newSettings = {
        deepScan: getToggleValue('setting_deepScan'),
        screenshot: getToggleValue('setting_screenshot'),
        aiAnalysis: getToggleValue('setting_aiAnalysis'),
        autoSave: getToggleValue('setting_autoSave'),
        showScores: getToggleValue('setting_showScores'),
        compactMode: getToggleValue('setting_compactMode'),
        defaultViewport: document.getElementById('setting_defaultViewport')?.value || 'desktop',
        maxScanHistory: parseInt(document.getElementById('setting_maxScanHistory')?.value || '50'),
        openaiKey: document.getElementById('setting_openaiKey')?.value?.trim() || '',
        geminiKey: document.getElementById('setting_geminiKey')?.value?.trim() || '',
        puppeteerUrl: document.getElementById('setting_puppeteerUrl')?.value?.trim() || '',
      };
      
      await saveSettings(newSettings);
      window.WIP.showToast('Settings saved.', 'success');
    });
    
    document.getElementById('resetSettingsBtn')?.addEventListener('click', async () => {
      await saveSettings(DEFAULT_SETTINGS);
      renderSettings();
      window.WIP.showToast('Settings reset to defaults.', 'success');
    });
    
    document.getElementById('clearHistoryBtn')?.addEventListener('click', async () => {
      window.WIP.showModal(`
        <div style="display:flex;flex-direction:column;gap:12px">
          <h3 style="font-size:15px;font-weight:700">Clear History</h3>
          <p style="font-size:12px;color:var(--muted)">This will permanently delete all scan history. Continue?</p>
          <button id="confirmClearBtn" class="form-btn" style="background:var(--error)">Clear All</button>
          <button onclick="window.WIP.closeModal()" class="form-btn form-btn-secondary">Cancel</button>
        </div>
      `);
      
      document.getElementById('confirmClearBtn')?.addEventListener('click', async () => {
        window.WIP.closeModal();
        if (!auth.currentUser) {
          window.WIP.showToast('Sign in to manage history.', 'warning');
          return;
        }
        try {
          const snap = await db.collection('scans')
            .where('userId', '==', auth.currentUser.uid)
            .limit(500)
            .get();
          
          const batch = db.batch();
          snap.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
          window.WIP.showToast('History cleared.', 'success');
        } catch (err) {
          window.WIP.showToast('Failed to clear history.', 'error');
        }
      });
    });
  }
  
  auth.onAuthStateChanged(async () => {
    await loadSettings();
  });
  
  loadSettings();
  
  window.WIP.renderSettings = renderSettings;
  window.WIP.loadSettings = loadSettings;
  window.WIP.saveSettings = saveSettings;
})();