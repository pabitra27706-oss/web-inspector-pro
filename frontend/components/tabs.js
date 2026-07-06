(function () {
  const TAB_ORDER = ['overview', 'html', 'network', 'security', 'performance', 'design', 'seo', 'storage', 'ai'];

  function initTabSwipe() {
    const tabContent = document.getElementById('tabContent');
    if (!tabContent) return;

    let startX = 0;
    let startY = 0;
    let isDragging = false;

    tabContent.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = false;
    }, { passive: true });

    tabContent.addEventListener('touchmove', (e) => {
      const deltaX = Math.abs(e.touches[0].clientX - startX);
      const deltaY = Math.abs(e.touches[0].clientY - startY);
      if (deltaX > deltaY && deltaX > 10) isDragging = true;
    }, { passive: true });

    tabContent.addEventListener('touchend', (e) => {
      if (!isDragging) return;
      const endX = e.changedTouches[0].clientX;
      const diff = startX - endX;
      const threshold = 60;

      if (Math.abs(diff) < threshold) return;

      const currentTab = window.WIP.state?.currentTab || 'overview';
      const currentIndex = TAB_ORDER.indexOf(currentTab);
      if (currentIndex === -1) return;

      if (diff > 0 && currentIndex < TAB_ORDER.length - 1) {
        switchTab(TAB_ORDER[currentIndex + 1]);
      } else if (diff < 0 && currentIndex > 0) {
        switchTab(TAB_ORDER[currentIndex - 1]);
      }
    }, { passive: true });
  }

  function switchTab(tabId) {
    if (!TAB_ORDER.includes(tabId)) return;

    const prevTab = window.WIP.state?.currentTab;

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-${tabId}`);
    });

    if (window.WIP.state) window.WIP.state.currentTab = tabId;

    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    const tabPane = document.getElementById(`tab-${tabId}`);
    if (tabPane && prevTab !== tabId) {
      tabPane.style.opacity = '0';
      tabPane.style.transform = 'translateY(4px)';
      requestAnimationFrame(() => {
        tabPane.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
        tabPane.style.opacity = '1';
        tabPane.style.transform = 'translateY(0)';
        setTimeout(() => {
          tabPane.style.transition = '';
          tabPane.style.opacity = '';
          tabPane.style.transform = '';
        }, 150);
      });
    }

    updateTabProgress(tabId);
  }

  function updateTabProgress(tabId) {
    const index = TAB_ORDER.indexOf(tabId);
    const progress = ((index + 1) / TAB_ORDER.length) * 100;

    let progressBar = document.getElementById('tabProgressBar');
    if (!progressBar) {
      progressBar = document.createElement('div');
      progressBar.id = 'tabProgressBar';
      progressBar.style.cssText = `
        position: absolute;
        bottom: 0;
        left: 0;
        height: 2px;
        background: var(--green);
        transition: width 0.2s ease;
        pointer-events: none;
      `;
      const nav = document.getElementById('tabsNav');
      if (nav) {
        nav.style.position = 'relative';
        nav.appendChild(progressBar);
      }
    }
    progressBar.style.width = `${progress}%`;
  }

  function initTabBadges(scanResults) {
    if (!scanResults) return;

    const badges = {
      security: getSecurityBadge(scanResults.security),
      network: getNetworkBadge(scanResults.network),
      performance: getPerformanceBadge(scanResults.performance),
    };

    Object.entries(badges).forEach(([tab, badge]) => {
      const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
      if (!btn || !badge) return;

      const existing = btn.querySelector('.tab-badge');
      if (existing) existing.remove();

      if (badge.count > 0) {
        const span = document.createElement('span');
        span.className = 'tab-badge';
        span.textContent = badge.count > 99 ? '99+' : badge.count;
        span.style.cssText = `
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 16px;
          height: 16px;
          border-radius: 8px;
          background: ${badge.color};
          color: #000;
          font-size: 9px;
          font-weight: 700;
          margin-left: 4px;
          padding: 0 4px;
        `;
        btn.appendChild(span);
      }
    });
  }

  function getSecurityBadge(security) {
    if (!security) return null;
    const issues = (security.apiKeys?.length || 0) +
      (security.credentials?.length || 0) +
      (security.xssHints?.length || 0) +
      (security.sqliPoints?.length || 0) +
      (!security.https ? 1 : 0);
    return {
      count: issues,
      color: issues > 0 ? 'var(--error)' : 'var(--success)',
    };
  }

  function getNetworkBadge(network) {
    if (!network) return null;
    return {
      count: network.apiEndpoints?.length || 0,
      color: 'var(--warning)',
    };
  }

  function getPerformanceBadge(performance) {
    if (!performance) return null;
    const issues = (performance.renderBlocking?.length || 0) +
      (performance.unoptimizedImages?.length || 0) +
      (!performance.gzip && !performance.brotli ? 1 : 0);
    return {
      count: issues,
      color: issues > 3 ? 'var(--error)' : issues > 0 ? 'var(--warning)' : 'var(--success)',
    };
  }

  function initTabKeyboardNav() {
    const tabsNav = document.getElementById('tabsNav');
    if (!tabsNav) return;

    tabsNav.addEventListener('keydown', (e) => {
      const currentTab = window.WIP.state?.currentTab || 'overview';
      const currentIndex = TAB_ORDER.indexOf(currentTab);

      if (e.key === 'ArrowRight' && currentIndex < TAB_ORDER.length - 1) {
        e.preventDefault();
        switchTab(TAB_ORDER[currentIndex + 1]);
        document.querySelector(`.tab-btn[data-tab="${TAB_ORDER[currentIndex + 1]}"]`)?.focus();
      }

      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        switchTab(TAB_ORDER[currentIndex - 1]);
        document.querySelector(`.tab-btn[data-tab="${TAB_ORDER[currentIndex - 1]}"]`)?.focus();
      }

      if (e.key === 'Home') {
        e.preventDefault();
        switchTab(TAB_ORDER[0]);
        document.querySelector(`.tab-btn[data-tab="${TAB_ORDER[0]}"]`)?.focus();
      }

      if (e.key === 'End') {
        e.preventDefault();
        switchTab(TAB_ORDER[TAB_ORDER.length - 1]);
        document.querySelector(`.tab-btn[data-tab="${TAB_ORDER[TAB_ORDER.length - 1]}"]`)?.focus();
      }
    });

    document.querySelectorAll('.tab-btn').forEach((btn, i) => {
      btn.setAttribute('tabindex', i === 0 ? '0' : '-1');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', btn.classList.contains('active'));
    });
  }

  function initTabClickListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
      });
    });
  }

  function initTabNumberShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const resultsSection = document.getElementById('resultsSection');
      if (!resultsSection || resultsSection.classList.contains('hidden')) return;

      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= TAB_ORDER.length) {
        switchTab(TAB_ORDER[num - 1]);
      }
    });
  }

  function initTabMemory() {
    const savedTab = sessionStorage.getItem('wip_active_tab');
    if (savedTab && TAB_ORDER.includes(savedTab)) {
      switchTab(savedTab);
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sessionStorage.setItem('wip_active_tab', btn.dataset.tab);
      });
    });
  }

  function initTabScrollSync() {
    const tabsNav = document.getElementById('tabsNav');
    if (!tabsNav) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    tabsNav.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX - tabsNav.offsetLeft;
      scrollLeft = tabsNav.scrollLeft;
    });

    tabsNav.addEventListener('mouseleave', () => { isDown = false; });
    tabsNav.addEventListener('mouseup', () => { isDown = false; });

    tabsNav.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - tabsNav.offsetLeft;
      const walk = (x - startX) * 1.5;
      tabsNav.scrollLeft = scrollLeft - walk;
    });
  }

  function init() {
    initTabClickListeners();
    initTabSwipe();
    initTabKeyboardNav();
    initTabNumberShortcuts();
    initTabMemory();
    initTabScrollSync();

    const originalRenderResults = window.WIP.renderResults;
    if (typeof originalRenderResults === 'function') {
      window.WIP.onResultsRendered = (scanResults) => {
        initTabBadges(scanResults);
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.WIP.switchTab = switchTab;
  window.WIP.initTabBadges = initTabBadges;
})();