(function () {
  const SCAN_STEPS = [
    { id: 'fetch', label: 'Fetching page source', icon: '🌐', duration: 2000 },
    { id: 'html', label: 'Analyzing HTML & DOM', icon: '📄', duration: 1500 },
    { id: 'network', label: 'Scanning network requests', icon: '📡', duration: 1500 },
    { id: 'security', label: 'Running security checks', icon: '🔒', duration: 2000 },
    { id: 'performance', label: 'Measuring performance', icon: '⚡', duration: 1500 },
    { id: 'design', label: 'Inspecting design elements', icon: '🎨', duration: 1000 },
    { id: 'seo', label: 'Analyzing SEO', icon: '🔍', duration: 1000 },
    { id: 'storage', label: 'Checking storage', icon: '💾', duration: 800 },
    { id: 'ai', label: 'Running AI analysis', icon: '🤖', duration: 3000 },
    { id: 'report', label: 'Building report', icon: '📊', duration: 500 },
  ];

  let animationTimer = null;
  let currentStepIndex = 0;
  let isRunning = false;

  function renderLoaderSteps(completedSteps = [], activeStep = null) {
    const container = document.getElementById('loaderSteps');
    if (!container) return;

    container.innerHTML = SCAN_STEPS.map((step, i) => {
      const isCompleted = completedSteps.includes(step.id);
      const isActive = step.id === activeStep;
      const isPending = !isCompleted && !isActive;

      return `
        <div class="loader-step ${isCompleted ? 'done' : ''}" id="step-${step.id}">
          <span class="loader-step-icon">
            ${isCompleted ? '✓' : isActive ? `<span class="step-spinner"></span>` : '○'}
          </span>
          <span style="color:${isCompleted ? 'var(--green)' : isActive ? 'var(--text)' : 'var(--muted)'}">
            ${step.icon} ${step.label}
          </span>
          ${isActive ? `<span class="step-dots"></span>` : ''}
        </div>
      `;
    }).join('');

    injectStepStyles();
  }

  function injectStepStyles() {
    if (document.getElementById('loader-step-styles')) return;
    const style = document.createElement('style');
    style.id = 'loader-step-styles';
    style.textContent = `
      .step-spinner {
        display: inline-block;
        width: 10px;
        height: 10px;
        border: 2px solid var(--border);
        border-top-color: var(--green);
        border-radius: 50%;
        animation: stepSpin 0.6s linear infinite;
        vertical-align: middle;
      }
      @keyframes stepSpin {
        to { transform: rotate(360deg); }
      }
      .step-dots::after {
        content: '';
        animation: stepDots 1.2s steps(4, end) infinite;
      }
      @keyframes stepDots {
        0%, 100% { content: ''; }
        25% { content: '.'; }
        50% { content: '..'; }
        75% { content: '...'; }
      }
      #loaderSteps {
        max-height: 280px;
        overflow-y: auto;
        scrollbar-width: none;
      }
      #loaderSteps::-webkit-scrollbar { display: none; }
    `;
    document.head.appendChild(style);
  }

  function setProgress(percent) {
    const fill = document.getElementById('loaderProgressFill');
    if (fill) {
      fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
  }

  function setStatus(message) {
    const el = document.getElementById('loaderStatus');
    if (el) el.textContent = message;
  }

  function showRandomTip() {
    const tips = [
      '💡 Tip: Use keyboard shortcuts 1-9 to switch tabs quickly',
      '💡 Tip: Double-tap any code block to copy its content',
      '💡 Tip: Swipe left/right on results to change tabs',
      '💡 Tip: Long-press any card to copy its content',
      '💡 Tip: Press Ctrl+K to quickly start a new scan',
      '💡 Tip: Press Escape to close any panel',
      '💡 Tip: Sign in to save your scan history',
      '💡 Tip: Share results with a public link using the share button',
      '💡 Tip: Add sites to favorites for quick re-scanning',
      '💡 Tip: Export reports as PDF for offline viewing',
    ];

    const tipEl = document.getElementById('loaderTip');
    if (!tipEl) return;
    const tip = tips[Math.floor(Math.random() * tips.length)];
    tipEl.style.opacity = '0';
    setTimeout(() => {
      tipEl.textContent = tip;
      tipEl.style.transition = 'opacity 0.3s ease';
      tipEl.style.opacity = '1';
    }, 300);
  }

  function initLoaderTip() {
    const loaderContainer = document.querySelector('.loader-container');
    if (!loaderContainer) return;

    let tipEl = document.getElementById('loaderTip');
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.id = 'loaderTip';
      tipEl.style.cssText = `
        font-size: 11px;
        color: var(--muted);
        text-align: center;
        margin-top: 8px;
        min-height: 20px;
        transition: opacity 0.3s ease;
      `;
      loaderContainer.appendChild(tipEl);
    }

    showRandomTip();
    return setInterval(showRandomTip, 5000);
  }

  function initScanAnimation() {
    if (isRunning) return;
    isRunning = true;
    currentStepIndex = 0;

    const completedSteps = [];
    let tipInterval = null;

    const loaderSection = document.getElementById('loaderSection');
    if (loaderSection) {
      loaderSection.style.display = 'flex';
    }

    renderLoaderSteps(completedSteps, SCAN_STEPS[0]?.id);
    setProgress(5);
    setStatus(SCAN_STEPS[0]?.label || 'Initializing...');

    tipInterval = initLoaderTip();

    const runStep = (index) => {
      if (index >= SCAN_STEPS.length) {
        setProgress(100);
        setStatus('Scan complete!');
        renderLoaderSteps(SCAN_STEPS.map(s => s.id), null);
        isRunning = false;
        if (tipInterval) clearInterval(tipInterval);
        return;
      }

      const step = SCAN_STEPS[index];
      const progress = Math.round(5 + (index / SCAN_STEPS.length) * 90);

      setProgress(progress);
      setStatus(step.label);
      renderLoaderSteps(completedSteps, step.id);

      const stepEl = document.getElementById(`step-${step.id}`);
      if (stepEl) {
        stepEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      animationTimer = setTimeout(() => {
        completedSteps.push(step.id);
        currentStepIndex = index + 1;
        runStep(index + 1);
      }, step.duration);
    };

    runStep(0);
  }

  function stopScanAnimation() {
    if (animationTimer) {
      clearTimeout(animationTimer);
      animationTimer = null;
    }
    isRunning = false;
    currentStepIndex = 0;
  }

  function updateLoaderStep(stepId, status = 'done') {
    const stepEl = document.getElementById(`step-${stepId}`);
    if (!stepEl) return;

    const iconEl = stepEl.querySelector('.loader-step-icon');
    if (!iconEl) return;

    if (status === 'done') {
      stepEl.classList.add('done');
      iconEl.innerHTML = '✓';
      const step = SCAN_STEPS.find(s => s.id === stepId);
      if (step) {
        stepEl.querySelector('span:last-child')?.remove();
      }
    } else if (status === 'error') {
      iconEl.innerHTML = '✕';
      iconEl.style.color = 'var(--error)';
    } else if (status === 'active') {
      iconEl.innerHTML = '<span class="step-spinner"></span>';
    }
  }

  function showScanError(message) {
    stopScanAnimation();
    const container = document.querySelector('.loader-container');
    if (!container) return;

    container.innerHTML = `
      <div style="text-align:center;padding:20px">
        <div style="font-size:36px;margin-bottom:12px">❌</div>
        <div style="font-size:14px;font-weight:700;color:var(--error);margin-bottom:8px">Scan Failed</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:16px">${window.WIP.escapeHtml(message)}</div>
        <button onclick="window.WIP.showSection('scanSection')" class="form-btn" style="display:inline-flex">Try Again</button>
      </div>
    `;
  }

  function showScanSuccess() {
    setProgress(100);
    setStatus('Analysis complete!');
    renderLoaderSteps(SCAN_STEPS.map(s => s.id), null);

    const spinner = document.querySelector('.loader-spinner');
    if (spinner) {
      spinner.style.borderTopColor = 'var(--green)';
      spinner.style.borderRightColor = 'var(--green)';
      spinner.style.borderBottomColor = 'var(--green)';
      spinner.style.borderLeftColor = 'var(--green)';
      spinner.style.animation = 'none';
    }
  }

  function createMiniLoader(containerId, message = 'Loading...') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const mini = document.createElement('div');
    mini.className = 'mini-loader';
    mini.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      color: var(--muted);
      font-size: 12px;
    `;
    mini.innerHTML = `
      <div style="width:16px;height:16px;border:2px solid var(--border);border-top-color:var(--green);border-radius:50%;animation:spin 0.6s linear infinite;flex-shrink:0"></div>
      <span>${window.WIP.escapeHtml(message)}</span>
    `;
    container.innerHTML = '';
    container.appendChild(mini);
  }

  function removeMiniLoader(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const mini = container.querySelector('.mini-loader');
    if (mini) mini.remove();
  }

  function initPulseEffect() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      .loader-section .scan-hero-mini {
        animation: pulse 2s ease infinite;
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    initPulseEffect();

    const originalShowSection = window.WIP.showSection;
    if (typeof originalShowSection === 'function') {
      window.WIP.showSection = function (sectionId) {
        if (sectionId === 'loaderSection') {
          initScanAnimation();
        } else if (sectionId !== 'loaderSection' && isRunning) {
          stopScanAnimation();
        }
        originalShowSection(sectionId);
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.WIP.loader = {
    start: initScanAnimation,
    stop: stopScanAnimation,
    updateStep: updateLoaderStep,
    setProgress,
    setStatus,
    showError: showScanError,
    showSuccess: showScanSuccess,
    createMini: createMiniLoader,
    removeMini: removeMiniLoader,
  };
})();