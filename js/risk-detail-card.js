// Shared hover detail card used by risk-matrix.html and risk-wheel-test.html.
// Each page supplies its own field mapping + accent color; this just renders/positions the card.
const RiskDetailCard = (() => {
  let cardEl = null;

  function ensureCard() {
    if (cardEl) return cardEl;
    cardEl = document.createElement('div');
    cardEl.className = 'risk-detail-card';
    document.body.appendChild(cardEl);
    return cardEl;
  }

  function position(card, x, y) {
    const margin = 14;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;

    let left = x + margin;
    if (left + cw > vw - margin) left = x - cw - margin;
    if (left < margin) left = Math.max(margin, Math.min(vw - cw - margin, x));

    let top = y + margin;
    if (top + ch > vh - margin) top = Math.max(margin, vh - ch - margin);

    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  // data: { title, accent, sections: [{label, value}], metrics: [{label, value}],
  //         owner (string, optional), areasHtml (string, optional),
  //         ownerAsFooterBar (bool, optional) -- stacks areasHtml above a full-width owner bar
  //         instead of sharing one row with it,
  //         metricsColumns (number, optional, default 4) -- grid column count for the metrics
  //         row; a metric with no label renders as an icon-only cell (e.g. an area-icon row
  //         embedded alongside text metrics) }
  function show(x, y, data) {
    const card = ensureCard();
    card.style.setProperty('--risk-card-accent', data.accent || '#830051');

    const sections = (data.sections || [])
      .filter((s) => s.value !== undefined && s.value !== null && s.value !== '')
      .map((s) => `<div class="risk-detail-card-section"><div class="risk-detail-card-label">${s.label}</div><div class="risk-detail-card-value">${s.value}</div></div>`)
      .join('');

    const metrics = (data.metrics || []).length
      ? `<div class="risk-detail-card-metrics" style="grid-template-columns: repeat(${data.metricsColumns || 4}, 1fr);">${data.metrics.map((m) => `<div>${m.label ? `<div class="risk-detail-card-label">${m.label}</div>` : ''}<div class="risk-detail-card-value">${m.value ?? ''}</div></div>`).join('')}</div>`
      : '';

    // Default footer: owner pill and area icons share one row (used by the matrix/wheel pages).
    // ownerAsFooterBar: true switches to a stacked layout -- icons (with captions, via areasHtml)
    // on their own row, then the owner as a separate full-width bar underneath.
    let footer = '';
    if (data.ownerAsFooterBar) {
      const areasRow = data.areasHtml ? `<div class="risk-detail-card-areas-row">${data.areasHtml}</div>` : '';
      const ownerBar = data.owner ? `<div class="risk-detail-card-owner-bar">SET Risk Owner(s):<br>${data.owner}</div>` : '';
      footer = `${areasRow}${ownerBar}`;
    } else if (data.owner || data.areasHtml) {
      footer = `<div class="risk-detail-card-footer">
          <div class="risk-detail-card-owner">${data.owner ? `SET Risk Owner(s):<br>${data.owner}` : ''}</div>
          ${data.areasHtml ? `<div class="risk-detail-card-areas">${data.areasHtml}</div>` : ''}
        </div>`;
    }

    card.innerHTML = `
      <div class="risk-detail-card-header">${data.title || ''}</div>
      ${sections}
      ${metrics}
      ${footer}
    `;
    card.classList.add('is-visible');
    position(card, x, y);
  }

  function hide() {
    if (cardEl) cardEl.classList.remove('is-visible');
  }

  function reposition(x, y) {
    if (cardEl && cardEl.classList.contains('is-visible')) position(cardEl, x, y);
  }

  return { show, hide, reposition };
})();
