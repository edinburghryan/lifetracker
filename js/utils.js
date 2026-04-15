/* ============================================
   LifeTracker — Shared Utilities
   ============================================ */

const Utils = (() => {

  /* ---------- Pastel Palette ---------- */
  const PALETTE = [
    { name: 'Rose',     header: '#E8A0A0', tint: '#FDF0F0' },
    { name: 'Peach',    header: '#E8C4A0', tint: '#FDF5F0' },
    { name: 'Sand',     header: '#E8D8A0', tint: '#FDFAF0' },
    { name: 'Sage',     header: '#A0D8A0', tint: '#F0FDF0' },
    { name: 'Sky',      header: '#A0C4E8', tint: '#F0F5FD' },
    { name: 'Lavender', header: '#C4A0E8', tint: '#F5F0FD' },
    { name: 'Slate',    header: '#A0B8C8', tint: '#F0F4F8' },
    { name: 'Blush',    header: '#E8A0C4', tint: '#FDF0F5' },
  ];

  const DARK_PALETTE = [
    { name: 'Rose',     header: '#8B5E5E', tint: '#3A2A2A' },
    { name: 'Peach',    header: '#8B7A5E', tint: '#3A3228' },
    { name: 'Sand',     header: '#8B845E', tint: '#3A3828' },
    { name: 'Sage',     header: '#5E8B5E', tint: '#283A28' },
    { name: 'Sky',      header: '#5E7A8B', tint: '#28323A' },
    { name: 'Lavender', header: '#7A5E8B', tint: '#32283A' },
    { name: 'Slate',    header: '#5E7080', tint: '#282E34' },
    { name: 'Blush',    header: '#8B5E7A', tint: '#3A2832' },
  ];

  /* ---------- Helpers ---------- */

  function isDarkMode() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function getColourForGroup(colorHex) {
    const activePalette = isDarkMode() ? DARK_PALETTE : PALETTE;
    let idx = PALETTE.findIndex(p => p.header === colorHex);
    if (idx === -1) idx = DARK_PALETTE.findIndex(p => p.header === colorHex);
    if (idx === -1) return { header: colorHex, tint: colorHex + '20' };
    return activePalette[idx];
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatFullDate(timestamp) {
    if (!timestamp) return '';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatDate(dateVal) {
    if (!dateVal) return '';
    let d;
    if (dateVal.toDate) d = dateVal.toDate();
    else d = new Date(dateVal);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((d - now) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff < -1) return `${Math.abs(diff)}d overdue`;
    if (diff <= 7) return `${diff}d`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function computeNextDue(fromDate, frequency) {
    const d = new Date(fromDate);
    if (frequency === 'weekly') d.setDate(d.getDate() + 7);
    else if (frequency === 'fortnightly') d.setDate(d.getDate() + 14);
    else d.setMonth(d.getMonth() + 1);
    return d;
  }

  function formatFrequency(freq) {
    if (freq === 'weekly') return 'Weekly';
    if (freq === 'fortnightly') return 'Fortnightly';
    if (freq === 'monthly') return 'Monthly';
    return freq || '';
  }

  return {
    PALETTE,
    DARK_PALETTE,
    isDarkMode,
    getColourForGroup,
    escapeHtml,
    formatFullDate,
    formatDate,
    computeNextDue,
    formatFrequency
  };
})();
