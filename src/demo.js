'use strict';
const { addDays, parse } = require('./analytics');
function rng(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Deterministic synthetic data for previews/tests (only used when demo=true). */
function demoSeries(from, to, seed = 7) {
  const r = rng(seed); const days = []; let mood = 1, left = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (left-- <= 0) { mood = [0.15, 0.7, 1.4, 2.4][Math.floor(r() * 4)]; left = 7 + Math.floor(r() * 14); }
    const wd = parse(d).getUTCDay(); const wkend = wd === 0 || wd === 6;
    const p = Math.min(0.95, (0.22 + 0.3 * mood) * (wkend ? 0.5 : 1));
    let n = r() < p ? Math.round(1 - Math.log(1 - r()) * 2.2 * mood) : 0;
    if (n && r() < 0.03) n *= 5;
    days.push({ date: d, count: n });
  }
  return { login: 'demo', name: null, days };
}
module.exports = { demoSeries };
