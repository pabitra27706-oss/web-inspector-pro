(function () {
  function createCard(title, icon, content, options = {}) {
    const { fullWidth = false, collapsible = false, id = '' } = options;
    const cardId = id || `card-${Math.random().toString(36).substr(2, 9)}`;
    return `
      <div class="card ${fullWidth ? 'full-width' : ''}" id="${cardId}">
        <div class="card-title ${collapsible ? 'collapsible-trigger' : ''}" ${collapsible ? `data-target="${cardId}-body" style="cursor:pointer;user-select:none"` : ''}>
          <span class="card-title-icon">${icon}</span>
          ${window.WIP.escapeHtml(title)}
          ${collapsible ? `<span class="collapse-arrow" style="margin-left:auto;transition:transform 0.2s">▾</span>` : ''}
        </div>
        <div class="${collapsible ? 'collapsible-body' : ''}" id="${cardId}-body">
          ${content}
        </div>
      </div>
    `;
  }

  function createStatCard(stats) {
    const items = stats.map(s => `
      <div class="stat-box">
        <div class="stat-box-value" style="color:${s.color || 'var(--green)'}">${window.WIP.escapeHtml(String(s.value ?? '--'))}</div>
        <div class="stat-box-label">${window.WIP.escapeHtml(s.label)}</div>
      </div>
    `).join('');
    return `<div class="two-col">${items}</div>`;
  }

  function createTableCard(headers, rows, emptyMessage = 'No data') {
    if (!rows || rows.length === 0) {
      return `<div class="empty-state">${window.WIP.escapeHtml(emptyMessage)}</div>`;
    }
    const headerHtml = headers.map(h => `<th style="text-align:left;padding:6px 8px;color:var(--muted);font-size:11px;border-bottom:1px solid var(--border);white-space:nowrap">${window.WIP.escapeHtml(h)}</th>`).join('');
    const rowsHtml = rows.map(row => {
      const cells = row.map(cell => `<td style="padding:6px 8px;font-size:11px;border-bottom:1px solid var(--border);word-break:break-all">${cell}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  function createProgressCard(items) {
    return items.map(item => `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">
          <span>${window.WIP.escapeHtml(item.label)}</span>
          <span style="color:${item.color || 'var(--green)'}">${window.WIP.escapeHtml(String(item.value))}</span>
        </div>
        <div class="progress-bar-mini">
          <div class="progress-bar-mini-fill" style="width:${Math.min(100, Math.max(0, item.percent || 0))}%;background:${item.color || 'var(--green)'}"></div>
        </div>
      </div>
    `).join('');
  }

  function createBadgeList(items, emptyMessage = 'None found') {
    if (!items || items.length === 0) {
      return `<div class="empty-state">${window.WIP.escapeHtml(emptyMessage)}</div>`;
    }
    return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
      ${items.map(item => {
        const text = typeof item === 'string' ? item : item.label || item.name || '';
        const type = typeof item === 'object' ? (item.type || 'muted') : 'muted';
        return `<span class="badge badge-${type}">${window.WIP.escapeHtml(text)}</span>`;
      }).join('')}
    </div>`;
  }

  function createCodeCard(code, language = '', maxHeight = 300) {
    if (!code) return `<div class="empty-state">No content</div>`;
    return `
      <div class="code-block" style="max-height:${maxHeight}px;position:relative">
        ${language ? `<div style="position:absolute;top:6px;right:8px;font-size:10px;color:var(--muted)">${window.WIP.escapeHtml(language)}</div>` : ''}
        ${window.WIP.escapeHtml(code)}
      </div>
    `;
  }

  function createIssueCard(issues, title, icon, severity = 'error') {
    if (!issues || issues.length === 0) {
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;font-size:12px;color:var(--success)">
          <span>✓</span>
          <span>No ${title.toLowerCase()} found</span>
        </div>
      `;
    }
    return issues.map(issue => {
      const text = typeof issue === 'string' ? issue : issue.description || issue.message || JSON.stringify(issue);
      const detail = typeof issue === 'object' ? (issue.value || issue.context || '') : '';
      return `
        <div class="list-item">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:${detail ? 4 : 0}px">
              <span class="badge badge-${severity}">${window.WIP.escapeHtml(title)}</span>
              <span style="font-size:12px">${window.WIP.escapeHtml(text)}</span>
            </div>
            ${detail ? `<div class="code-block" style="margin-top:4px;font-size:10px">${window.WIP.escapeHtml(String(detail).substring(0, 100))}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function createTimelineCard(events) {
    if (!events || events.length === 0) return `<div class="empty-state">No timeline data</div>`;
    return `
      <div style="position:relative;padding-left:16px">
        <div style="position:absolute;left:6px;top:0;bottom:0;width:2px;background:var(--border)"></div>
        ${events.map((event, i) => `
          <div style="position:relative;margin-bottom:${i < events.length - 1 ? '12px' : '0'}">
            <div style="position:absolute;left:-13px;top:4px;width:10px;height:10px;border-radius:50%;background:${event.color || 'var(--green)'};border:2px solid var(--bg)"></div>
            <div style="font-size:12px;font-weight:600">${window.WIP.escapeHtml(event.label)}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${window.WIP.escapeHtml(event.time || '')}</div>
            ${event.detail ? `<div style="font-size:11px;color:var(--text);margin-top:2px">${window.WIP.escapeHtml(event.detail)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  function createCompareCard(urlA, urlB, dataA, dataB, metric) {
    const valA = dataA ?? 0;
    const valB = dataB ?? 0;
    const maxVal = Math.max(valA, valB, 1);
    const winnerA = valA >= valB;

    return `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:11px">
            <span style="color:var(--muted);max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${window.WIP.escapeHtml(urlA)}</span>
            <span style="font-weight:700;color:${winnerA ? 'var(--green)' : 'var(--text)'}">${window.WIP.escapeHtml(String(valA))}${winnerA ? ' ✓' : ''}</span>
          </div>
          <div class="progress-bar-mini">
            <div class="progress-bar-mini-fill" style="width:${(valA / maxVal) * 100}%;background:${winnerA ? 'var(--green)' : 'var(--muted)'}"></div>
          </div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:11px">
            <span style="color:var(--muted);max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${window.WIP.escapeHtml(urlB)}</span>
            <span style="font-weight:700;color:${!winnerA ? 'var(--green)' : 'var(--text)'}">${window.WIP.escapeHtml(String(valB))}${!winnerA ? ' ✓' : ''}</span>
          </div>
          <div class="progress-bar-mini">
            <div class="progress-bar-mini-fill" style="width:${(valB / maxVal) * 100}%;background:${!winnerA ? 'var(--green)' : 'var(--muted)'}"></div>
          </div>
        </div>
      </div>
    `;
  }

  function createExpandableList(items, maxVisible = 5, labelKey = null) {
    if (!items || items.length === 0) return `<div class="empty-state">No items</div>`;

    const visible = items.slice(0, maxVisible);
    const hidden = items.slice(maxVisible);
    const getId = () => `expand-${Math.random().toString(36).substr(2, 9)}`;
    const expandId = getId();

    const renderItem = (item) => {
      const text = labelKey ? item[labelKey] : (typeof item === 'string' ? item : JSON.stringify(item));
      return `<div class="list-item"><span style="font-size:12px;word-break:break-all">${window.WIP.escapeHtml(text)}</span></div>`;
    };

    return `
      ${visible.map(renderItem).join('')}
      ${hidden.length > 0 ? `
        <div id="${expandId}-hidden" class="hidden">
          ${hidden.map(renderItem).join('')}
        </div>
        <button onclick="
          document.getElementById('${expandId}-hidden').classList.toggle('hidden');
          this.textContent = this.textContent.includes('Show') ? 'Show less' : 'Show ${hidden.length} more';
        " style="margin-top:8px;font-size:11px;color:var(--green);background:none;border:none;cursor:pointer;font-family:var(--font);padding:4px 0">
          Show ${hidden.length} more
        </button>
      ` : ''}
    `;
  }

  function createCopyableValue(value, label = '') {
    const id = `copy-${Math.random().toString(36).substr(2, 9)}`;
    return `
      <div style="display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 10px">
        ${label ? `<span style="color:var(--muted);font-size:11px;flex-shrink:0">${window.WIP.escapeHtml(label)}</span>` : ''}
        <span id="${id}" style="font-size:11px;word-break:break-all;flex:1">${window.WIP.escapeHtml(value)}</span>
        <button onclick="
          navigator.clipboard.writeText('${value.replace(/'/g, "\\'")}')
            .then(() => window.WIP.showToast('Copied!', 'success'))
            .catch(() => window.WIP.showToast('Copy failed', 'error'));
        " style="flex-shrink:0;font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;font-family:var(--font);padding:2px 4px" title="Copy">
          ⧉
        </button>
      </div>
    `;
  }

  function createScoreGauge(score, label) {
    const color = score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--warning)' : 'var(--error)';
    const circumference = 2 * Math.PI * 20;
    const offset = circumference - (score / 100) * circumference;
    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
        <svg width="60" height="60" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="20" fill="none" stroke="var(--border)" stroke-width="6"/>
          <circle cx="30" cy="30" r="20" fill="none" stroke="${color}" stroke-width="6"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
            stroke-linecap="round" transform="rotate(-90 30 30)"
            style="transition:stroke-dashoffset 0.5s ease"/>
          <text x="30" y="35" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="12" font-weight="800" fill="${color}">${Math.round(score)}</text>
        </svg>
        <span style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px">${window.WIP.escapeHtml(label)}</span>
      </div>
    `;
  }

  function createWaterfallCard(resources) {
    if (!resources || resources.length === 0) return `<div class="empty-state">No resource data</div>`;

    const maxDuration = Math.max(...resources.map(r => r.duration || 0), 1);

    return resources.slice(0, 20).map(r => {
      const pct = Math.max(2, ((r.duration || 0) / maxDuration) * 100);
      const color = r.type === 'script' ? '#64b5f6' : r.type === 'css' ? '#ba68c8' : r.type === 'img' ? '#ffb74d' : 'var(--green)';
      const name = (r.name || r.url || '').split('/').pop().split('?')[0].substring(0, 40) || 'unknown';
      return `
        <div style="margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:2px">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%">${window.WIP.escapeHtml(name)}</span>
            <span>${r.duration ? r.duration + 'ms' : '--'}</span>
          </div>
          <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${color};border-radius:4px"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function initCollapsibleCards() {
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('.collapsible-trigger');
      if (!trigger) return;

      const targetId = trigger.dataset.target;
      if (!targetId) return;

      const body = document.getElementById(targetId);
      if (!body) return;

      const isHidden = body.classList.toggle('hidden');
      const arrow = trigger.querySelector('.collapse-arrow');
      if (arrow) arrow.style.transform = isHidden ? 'rotate(-90deg)' : '';
    });
  }

  function initCardCopyOnDoubleTap() {
    document.addEventListener('dblclick', (e) => {
      const codeBlock = e.target.closest('.code-block');
      if (!codeBlock) return;

      const text = codeBlock.textContent || '';
      navigator.clipboard.writeText(text)
        .then(() => window.WIP.showToast('Code copied to clipboard', 'success'))
        .catch(() => {});
    });
  }

  function initCardLongPress() {
    let pressTimer = null;
    let pressTarget = null;

    document.addEventListener('touchstart', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      pressTarget = card;
      pressTimer = setTimeout(() => {
        showCardActions(card);
      }, 600);
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    }, { passive: true });

    document.addEventListener('touchmove', () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    }, { passive: true });
  }

  function showCardActions(card) {
    const cardTitle = card.querySelector('.card-title')?.textContent?.trim() || 'Card';
    const cardText = card.textContent?.trim() || '';

    window.WIP.showModal(`
      <div style="display:flex;flex-direction:column;gap:10px">
        <h3 style="font-size:14px;font-weight:700">${window.WIP.escapeHtml(cardTitle.substring(0, 50))}</h3>
        <button onclick="
          navigator.clipboard.writeText(${JSON.stringify(cardText.substring(0, 5000))})
            .then(() => { window.WIP.showToast('Content copied', 'success'); window.WIP.closeModal(); })
            .catch(() => window.WIP.showToast('Copy failed', 'error'));
        " class="form-btn form-btn-secondary">Copy Card Content</button>
        <button onclick="window.WIP.closeModal()" class="form-btn form-btn-secondary">Cancel</button>
      </div>
    `);
  }

  function init() {
    initCollapsibleCards();
    initCardCopyOnDoubleTap();
    initCardLongPress();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.WIP.cards = {
    createCard,
    createStatCard,
    createTableCard,
    createProgressCard,
    createBadgeList,
    createCodeCard,
    createIssueCard,
    createTimelineCard,
    createCompareCard,
    createExpandableList,
    createCopyableValue,
    createScoreGauge,
    createWaterfallCard,
  };
})();