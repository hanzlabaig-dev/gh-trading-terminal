'use strict';
const { THEMES } = require('./themes');
const { DEFAULT_SHOW } = require('./render');

const ALLOWED = ['stats', 'heatmap', 'weekly', 'monthly', 'volume', 'tape', 'sma', 'bands'];
const bool = (v, d) => (v === undefined || v === '' ? d : !['false', '0', 'no', 'off'].includes(String(v).toLowerCase()));
const hex = (v) => (/^#?[0-9a-f]{3,8}$/i.test(v || '') ? (v[0] === '#' ? v : '#' + v) : undefined);
const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : undefined);

function parseOptions(r = {}) {
  const user = String(r.user || '');
  if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(user)) throw new Error('Invalid or missing GitHub username (?user=...)');
  let show = new Set(DEFAULT_SHOW);
  if (r.show) show = String(r.show) === 'all' ? new Set(ALLOWED) : new Set(String(r.show).split(',').map((s) => s.trim()).filter((s) => ALLOWED.includes(s)));
  if (r.hide) String(r.hide).split(',').forEach((s) => show.delete(s.trim()));
  const colors = {};
  for (const k of ['up', 'down', 'bg', 'panel', 'grid', 'text', 'muted', 'accent', 'ma']) if (hex(r[k])) colors[k] = hex(r[k]);
  const days = Math.min(730, Math.max(14, parseInt(r.days, 10) || 90));
  const alpha = Math.min(0.9, Math.max(0.1, parseFloat(r.alpha) || 0.5));
  return {
    user, days, from: date(r.from), to: date(r.to), theme: THEMES[r.theme] ? r.theme : 'tradingview', show,
    animate: bool(r.animate, true), colorblind: bool(r.colorblind, false), colors, alpha,
    demo: bool(r.demo, false), seed: parseInt(r.seed, 10) || 7,
  };
}
module.exports = { parseOptions };
