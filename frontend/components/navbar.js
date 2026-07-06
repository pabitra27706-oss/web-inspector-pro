(function() {
  function updateNavbarAuthState(user) {
    const authBtn = document.getElementById('authBtn');
    if (!authBtn) return;
    
    if (user) {
      authBtn.title = user.displayName || user.email || 'Account';
      authBtn.style.color = 'var(--green)';
      authBtn.innerHTML = user.photoURL ?
        `<img src="${user.photoURL}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid var(--green)" onerror="this.parentElement.innerHTML='<svg viewBox=\\'0 0 24 24\\' width=\\'20\\' height=\\'20\\'><path fill=\\'currentColor\\' d=\\'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5z\\'/></svg>'">` :
        `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5z"/></svg>`;
    } else {
      authBtn.title = 'Sign In';
      authBtn.style.color = '';
      authBtn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5z"/></svg>`;
    }
  }
  
  function initNavbarScrollBehavior() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    
    let lastScroll = 0;
    let ticking = false;
    
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const currentScroll = window.scrollY;
          if (currentScroll > lastScroll && currentScroll > 60) {
            navbar.style.transform = 'translateY(-100%)';
            navbar.style.transition = 'transform 0.2s ease';
          } else {
            navbar.style.transform = 'translateY(0)';
            navbar.style.transition = 'transform 0.2s ease';
          }
          lastScroll = Math.max(0, currentScroll);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }
  
  function initNavbarTooltips() {
    const buttons = document.querySelectorAll('.navbar-actions .icon-btn');
    buttons.forEach(btn => {
      const title = btn.title;
      if (!title) return;
      
      btn.addEventListener('mouseenter', (e) => {
        const existing = document.getElementById('navbar-tooltip');
        if (existing) existing.remove();
        
        const tooltip = document.createElement('div');
        tooltip.id = 'navbar-tooltip';
        tooltip.textContent = title;
        tooltip.style.cssText = `
          position: fixed;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 11px;
          font-family: var(--font);
          color: var(--text);
          z-index: 9999;
          pointer-events: none;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(tooltip);
        const rect = btn.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        tooltip.style.top = `${rect.bottom + 6}px`;
        tooltip.style.left = `${Math.min(rect.left + rect.width / 2 - tooltipRect.width / 2, window.innerWidth - tooltipRect.width - 8)}px`;
      });
      
      btn.addEventListener('mouseleave', () => {
        const tooltip = document.getElementById('navbar-tooltip');
        if (tooltip) tooltip.remove();
      });
    });
  }
  
  function initActiveNavState() {
    const sections = ['scanSection', 'historySection', 'favoritesSection', 'settingsSection', 'authSection'];
    const buttonMap = {
      historySection: 'historyBtn',
      favoritesSection: 'favoritesBtn',
      settingsSection: 'settingsBtn',
      authSection: 'authBtn',
    };
    
    const observer = new MutationObserver(() => {
      const activeSection = sections.find(id => {
        const el = document.getElementById(id);
        return el && !el.classList.contains('hidden');
      });
      
      Object.values(buttonMap).forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) btn.style.color = '';
      });
      
      if (activeSection && buttonMap[activeSection]) {
        const btn = document.getElementById(buttonMap[activeSection]);
        if (btn) btn.style.color = 'var(--green)';
      }
    });
    
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  }
  
  function initBrandClick() {
    const brand = document.querySelector('.navbar-brand');
    if (!brand) return;
    brand.style.cursor = 'pointer';
    brand.addEventListener('click', () => {
      window.WIP.showSection('scanSection');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === 'Escape') {
        const sections = ['historySection', 'favoritesSection', 'settingsSection', 'authSection'];
        const activeSection = sections.find(id => {
          const el = document.getElementById(id);
          return el && !el.classList.contains('hidden');
        });
        if (activeSection) {
          const hasResults = window.WIP.state?.scanResults && Object.keys(window.WIP.state.scanResults).length > 0;
          window.WIP.showSection(hasResults ? 'resultsSection' : 'scanSection');
        }
        
        const modal = document.getElementById('modalOverlay');
        if (modal && !modal.classList.contains('hidden')) {
          window.WIP.closeModal();
        }
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        window.WIP.showSection('scanSection');
        document.getElementById('urlInput')?.focus();
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        document.getElementById('historyBtn')?.click();
      }
    });
  }
  
  function initPwaInstallPrompt() {
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      
      const existing = document.getElementById('installBanner');
      if (existing) return;
      
      const banner = document.createElement('div');
      banner.id = 'installBanner';
      banner.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--card);
        border: 1px solid var(--green);
        border-radius: 8px;
        padding: 10px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 500;
        font-family: var(--font);
        font-size: 12px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        white-space: nowrap;
      `;
      banner.innerHTML = `
        <span>◈ Install Web Inspector Pro</span>
        <button id="installAcceptBtn" style="background:var(--green);color:#000;border:none;border-radius:6px;padding:6px 12px;font-family:var(--font);font-size:11px;font-weight:700;cursor:pointer">Install</button>
        <button id="installDismissBtn" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px">✕</button>
      `;
      document.body.appendChild(banner);
      
      document.getElementById('installAcceptBtn')?.addEventListener('click', async () => {
        banner.remove();
        if (deferredPrompt) {
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
          deferredPrompt = null;
        }
      });
      
      document.getElementById('installDismissBtn')?.addEventListener('click', () => {
        banner.remove();
        deferredPrompt = null;
      });
    });
    
    window.addEventListener('appinstalled', () => {
      const banner = document.getElementById('installBanner');
      if (banner) banner.remove();
      window.WIP.showToast('App installed successfully.', 'success');
    });
  }
  
  function initNetworkStatusIndicator() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    
    const indicator = document.createElement('div');
    indicator.id = 'networkIndicator';
    indicator.style.cssText = `
      position: fixed;
      top: 56px;
      left: 0;
      right: 0;
      background: var(--error);
      color: #fff;
      text-align: center;
      font-family: var(--font);
      font-size: 11px;
      padding: 6px;
      z-index: 99;
      display: none;
    `;
    indicator.textContent = '⚠ No internet connection';
    document.body.appendChild(indicator);
    
    const update = () => {
      indicator.style.display = navigator.onLine ? 'none' : 'block';
      if (!navigator.onLine) {
        window.WIP.showToast('Connection lost. Some features may not work.', 'warning');
      }
    };
    
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }
  
  function init() {
    window.WIP.auth.onAuthStateChanged(user => {
      updateNavbarAuthState(user);
    });
    
    initNavbarScrollBehavior();
    initNavbarTooltips();
    initActiveNavState();
    initBrandClick();
    initKeyboardShortcuts();
    initPwaInstallPrompt();
    initNetworkStatusIndicator();
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  window.WIP.updateNavbarAuthState = updateNavbarAuthState;
})();