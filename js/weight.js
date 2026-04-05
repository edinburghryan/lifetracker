/* ============================================
   LifeTracker — Weight Tracker Page
   ============================================ */

const Weight = (() => {
  const HEIGHT_CM = 183;
  const HEIGHT_M = HEIGHT_CM / 100;
  const MILESTONES = [150, 135, 120];

  let entries = [];
  let chartInstance = null;
  let editingEntryId = null;
  let collapseState = {};
  let sortableInstance = null;

  const DEFAULT_SECTION_ORDER = ['stats', 'milestones', 'log', 'chart', 'history'];

  function getSectionOrder() {
    try {
      const saved = localStorage.getItem('lt_weight_section_order');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_SECTION_ORDER;
  }

  function saveSectionOrder(order) {
    localStorage.setItem('lt_weight_section_order', JSON.stringify(order));
  }

  const escapeHtml = Utils.escapeHtml;
  const isDarkMode = Utils.isDarkMode;
  const getColourForGroup = Utils.getColourForGroup;

  /* ---------- Init ---------- */

  async function init() {
    await Store.seedWeightEntries();

    Store.onWeightEntriesChanged(newEntries => {
      entries = newEntries;
      render();
    });

    initEventListeners();
  }

  /* ---------- Calculations ---------- */

  function bmi(weight) {
    return (weight / (HEIGHT_M * HEIGHT_M)).toFixed(1);
  }

  function getStarting() {
    return entries.length > 0 ? entries[0] : null;
  }

  function getCurrent() {
    return entries.length > 0 ? entries[entries.length - 1] : null;
  }

  function totalLost() {
    const s = getStarting();
    const c = getCurrent();
    if (!s || !c) return 0;
    return s.weight - c.weight;
  }

  function avgWeeklyLoss() {
    if (entries.length < 2) return 0;
    const first = entryDate(entries[0]);
    const last = entryDate(entries[entries.length - 1]);
    const weeks = (last - first) / (1000 * 60 * 60 * 24 * 7);
    if (weeks <= 0) return 0;
    return totalLost() / weeks;
  }

  function bestWeek() {
    let best = 0;
    const recent = entries.slice(-4);
    for (let i = 1; i < recent.length; i++) {
      const diff = recent[i - 1].weight - recent[i].weight;
      if (diff > best) best = diff;
    }
    return best;
  }

  function movingAverage(windowSize) {
    if (entries.length === 0) return null;
    const slice = entries.slice(-windowSize);
    const sum = slice.reduce((acc, e) => acc + e.weight, 0);
    return sum / slice.length;
  }

  function entryDate(entry) {
    if (!entry || !entry.date) return new Date();
    return entry.date.toDate ? entry.date.toDate() : new Date(entry.date);
  }

  function formatDateShort(d) {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function projectDate(targetWeight) {
    const rate = avgWeeklyLoss();
    const current = getCurrent();
    if (!current || rate <= 0) return null;
    const remaining = current.weight - targetWeight;
    if (remaining <= 0) return 'Reached!';
    const weeksToGo = remaining / rate;
    const projected = new Date();
    projected.setDate(projected.getDate() + weeksToGo * 7);
    return projected.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  }

  /* ---------- Rendering ---------- */

  function render() {
    const page = document.getElementById('page-weight');
    page.innerHTML = '';

    const renderers = {
      stats: renderStats,
      milestones: renderMilestones,
      log: renderLogForm,
      chart: renderChart,
      history: renderHistory
    };

    const order = getSectionOrder();
    order.forEach(id => {
      if (renderers[id]) renderers[id](page);
    });

    // Init sortable for section reordering
    if (sortableInstance) sortableInstance.destroy();
    sortableInstance = new Sortable(page, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      handle: '.group-header',
      delay: 300,
      delayOnTouchOnly: true,
      touchStartThreshold: 5,
      onEnd: () => {
        const sections = page.querySelectorAll('.weight-section');
        const newOrder = Array.from(sections).map(s => s.dataset.sectionId);
        saveSectionOrder(newOrder);
      }
    });
  }

  function createSection(id, title, colour, content) {
    const colours = getColourForGroup(colour);
    const isCollapsed = collapseState[id] || false;

    const section = document.createElement('section');
    section.className = 'group weight-section';
    section.dataset.sectionId = id;
    section.innerHTML = `
      <div class="group-header" style="background: linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(0,0,0,0.4) 100%), ${colours.header}">
        <button class="collapse-btn ${isCollapsed ? 'collapsed' : ''}" data-group="${id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <span class="group-name">${escapeHtml(title)}</span>
      </div>
      <div class="weight-section-body ${isCollapsed ? 'collapsed' : ''}" id="weight-body-${id}">
      </div>
    `;

    const body = section.querySelector('.weight-section-body');
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      body.appendChild(content);
    }

    return section;
  }

  function renderStats(page) {
    const starting = getStarting();
    const current = getCurrent();
    const lost = totalLost();
    const avgLoss = avgWeeklyLoss();
    const best = bestWeek();
    const ma4 = movingAverage(4);

    const html = `
      <div class="weight-stats-grid">
        <div class="weight-stat-card">
          <div class="weight-stat-value">${starting ? starting.weight.toFixed(1) : '—'}</div>
          <div class="weight-stat-label">Starting (BMI ${starting ? bmi(starting.weight) : '—'})</div>
        </div>
        <div class="weight-stat-card">
          <div class="weight-stat-value">${current ? current.weight.toFixed(1) : '—'}</div>
          <div class="weight-stat-label">Current (BMI ${current ? bmi(current.weight) : '—'})</div>
        </div>
        <div class="weight-stat-card">
          <div class="weight-stat-value">${lost.toFixed(1)} kg</div>
          <div class="weight-stat-label">Total Lost</div>
        </div>
        <div class="weight-stat-card">
          <div class="weight-stat-value">${avgLoss.toFixed(1)} kg</div>
          <div class="weight-stat-label">Avg / Week</div>
        </div>
        <div class="weight-stat-card">
          <div class="weight-stat-value">${best.toFixed(1)} kg</div>
          <div class="weight-stat-label">Best (last 4 wks)</div>
        </div>
        <div class="weight-stat-card">
          <div class="weight-stat-value">${ma4 ? ma4.toFixed(1) : '—'}</div>
          <div class="weight-stat-label">4-wk Average</div>
        </div>
      </div>
    `;

    page.appendChild(createSection('stats', 'Summary', '#A0B8C8', html));
  }

  function renderMilestones(page) {
    const current = getCurrent();
    const starting = getStarting();
    if (!current || !starting) return;

    const totalRange = starting.weight - MILESTONES[MILESTONES.length - 1];

    let html = '<div class="weight-milestones">';
    MILESTONES.forEach(target => {
      const remaining = current.weight - target;
      const progress = Math.min(100, Math.max(0, ((starting.weight - current.weight) / (starting.weight - target)) * 100));
      const projected = projectDate(target);
      const reached = remaining <= 0;

      html += `
        <div class="milestone-card">
          <div class="milestone-header">
            <span class="milestone-target">${target} kg</span>
            <span class="milestone-remaining">${reached ? 'Reached!' : remaining.toFixed(1) + ' kg to go'}</span>
          </div>
          <div class="milestone-bar">
            <div class="milestone-progress" style="width: ${progress}%"></div>
          </div>
          ${projected && !reached ? `<div class="milestone-projected">Projected: ${projected}</div>` : ''}
        </div>
      `;
    });
    html += '</div>';

    page.appendChild(createSection('milestones', 'Milestones', '#A0D8A0', html));
  }

  function renderLogForm(page) {
    const today = new Date().toISOString().split('T')[0];

    const html = `
      <div class="weight-log-form">
        <div class="weight-log-field">
          <label>Weight (kg)</label>
          <input type="number" id="weight-input" step="0.1" min="50" max="300" inputmode="decimal" placeholder="e.g. 161.5">
        </div>
        <div class="weight-log-field">
          <label>Date</label>
          <input type="date" id="weight-date-input" value="${today}">
        </div>
        <button class="weight-log-save" id="weight-save-btn">Save</button>
      </div>
    `;

    page.appendChild(createSection('log', 'Log Entry', '#E8D8A0', html));
  }

  function renderChart(page) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<div class="weight-chart-body"><canvas id="weight-chart"></canvas></div>';

    page.appendChild(createSection('chart', 'Progress', '#A0C4E8', wrapper.firstElementChild));

    // Build chart after DOM insertion
    requestAnimationFrame(() => buildChart());
  }

  function buildChart() {
    const canvas = document.getElementById('weight-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    if (entries.length === 0) return;

    const dark = isDarkMode();
    const textColor = dark ? '#98989D' : '#6E6E73';
    const gridColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    const labels = entries.map(e => formatDateShort(entryDate(e)));
    const weights = entries.map(e => e.weight);

    // Compute 4-week moving average line
    const maLine = entries.map((_, i) => {
      const start = Math.max(0, i - 3);
      const slice = entries.slice(start, i + 1);
      return slice.reduce((sum, e) => sum + e.weight, 0) / slice.length;
    });

    // Milestone datasets
    const milestoneDatasets = MILESTONES.map((target, idx) => ({
      label: `${target} kg`,
      data: entries.map(() => target),
      borderColor: dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
      borderDash: [5, 5],
      borderWidth: 1,
      pointRadius: 0,
      pointHitRadius: 0,
      fill: false
    }));

    chartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Weight',
            data: weights,
            borderColor: dark ? '#5E9BDB' : '#3B82C4',
            backgroundColor: dark ? 'rgba(94,155,219,0.1)' : 'rgba(59,130,196,0.1)',
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: dark ? '#5E9BDB' : '#3B82C4',
            fill: true,
            tension: 0.3
          },
          {
            label: '4-wk Avg',
            data: maLine,
            borderColor: dark ? 'rgba(255,185,0,0.6)' : 'rgba(255,185,0,0.7)',
            borderWidth: 2,
            borderDash: [4, 4],
            pointRadius: 0,
            fill: false,
            tension: 0.3
          },
          ...milestoneDatasets
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.6,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} kg`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: textColor, font: { size: 10 } },
            grid: { color: gridColor }
          },
          y: {
            ticks: { color: textColor, font: { size: 10 } },
            grid: { color: gridColor }
          }
        }
      }
    });
  }

  function renderHistory(page) {
    let html = '<div class="weight-history">';

    if (entries.length === 0) {
      html += '<p class="empty-message">No entries yet</p>';
    } else {
      // Most recent first
      const reversed = [...entries].reverse();
      reversed.forEach((entry, idx) => {
        const d = entryDate(entry);
        const dateStr = formatDateShort(d);
        const prevEntry = reversed[idx + 1]; // next in reversed = previous chronologically
        let diffStr = '';
        let diffClass = 'neutral';

        if (prevEntry) {
          const diff = entry.weight - prevEntry.weight;
          if (diff < 0) {
            diffStr = diff.toFixed(1);
            diffClass = 'negative';
          } else if (diff > 0) {
            diffStr = '+' + diff.toFixed(1);
            diffClass = 'positive';
          } else {
            diffStr = '0.0';
            diffClass = 'neutral';
          }
        }

        html += `
          <div class="weight-history-row" data-entry-id="${entry.id}">
            <span class="weight-date">${dateStr}</span>
            <span class="weight-value">${entry.weight.toFixed(1)} kg</span>
            <span class="weight-diff ${diffClass}">${diffStr}</span>
          </div>
        `;
      });
    }

    html += '</div>';
    page.appendChild(createSection('history', 'History', '#C4A0E8', html));
  }

  /* ---------- Theme Refresh ---------- */

  function refreshTheme() {
    if (entries.length > 0) {
      buildChart();
    }
  }

  /* ---------- Event Listeners ---------- */

  function initEventListeners() {
    // Collapse toggles (delegated within weight page)
    document.getElementById('page-weight').addEventListener('click', (e) => {
      const collapseBtn = e.target.closest('.collapse-btn');
      if (!collapseBtn) return;

      const sectionId = collapseBtn.dataset.group;
      collapseBtn.classList.toggle('collapsed');

      const body = document.getElementById('weight-body-' + sectionId);
      if (body) body.classList.toggle('collapsed');
      collapseState[sectionId] = body ? body.classList.contains('collapsed') : false;
    });

    // Save weight entry
    document.getElementById('page-weight').addEventListener('click', (e) => {
      if (!e.target.closest('#weight-save-btn')) return;

      const weightInput = document.getElementById('weight-input');
      const dateInput = document.getElementById('weight-date-input');

      const weight = parseFloat(weightInput.value);
      const date = dateInput.value;

      if (!weight || weight < 50 || weight > 300) return;
      if (!date) return;

      Store.createWeightEntry(date, weight);
      weightInput.value = '';
    });

    // History row click -> edit modal
    document.getElementById('page-weight').addEventListener('click', (e) => {
      const row = e.target.closest('.weight-history-row');
      if (!row) return;
      openWeightEditModal(row.dataset.entryId);
    });

    // Weight edit modal
    document.getElementById('weight-edit-modal-close').addEventListener('click', closeWeightEditModal);
    document.getElementById('weight-edit-ok').addEventListener('click', saveWeightEditModal);
    document.getElementById('weight-edit-modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeWeightEditModal();
    });
    document.getElementById('weight-edit-delete').addEventListener('click', () => {
      if (!editingEntryId) return;
      if (confirm('Permanently delete this weight entry?')) {
        Store.deleteWeightEntry(editingEntryId);
        document.getElementById('weight-edit-modal-overlay').classList.add('hidden');
        editingEntryId = null;
      }
    });
  }

  function openWeightEditModal(entryId) {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    editingEntryId = entryId;

    document.getElementById('weight-edit-input').value = entry.weight;
    const d = entryDate(entry);
    document.getElementById('weight-edit-date').value = d.toISOString().split('T')[0];

    document.getElementById('weight-edit-modal-overlay').classList.remove('hidden');
  }

  function closeWeightEditModal() {
    document.getElementById('weight-edit-modal-overlay').classList.add('hidden');
    editingEntryId = null;
  }

  function saveWeightEditModal() {
    if (!editingEntryId) return;

    const weight = parseFloat(document.getElementById('weight-edit-input').value);
    const date = document.getElementById('weight-edit-date').value;

    if (!weight || weight < 50 || weight > 300 || !date) {
      closeWeightEditModal();
      return;
    }

    const entry = entries.find(e => e.id === editingEntryId);
    const updates = {};

    if (entry && weight !== entry.weight) updates.weight = weight;

    const currentDate = entryDate(entry).toISOString().split('T')[0];
    if (date !== currentDate) updates.date = date;

    if (Object.keys(updates).length > 0) {
      Store.updateWeightEntry(editingEntryId, updates);
    }

    closeWeightEditModal();
  }

  return { init, refreshTheme };
})();
