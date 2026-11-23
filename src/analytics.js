'use strict';
const DAY = 864e5;
const parse = (s) => new Date(s + 'T00:00:00Z');
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => iso(new Date(parse(s).getTime() + n * DAY));
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const std = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length);
};
const percentile = (a, p) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const mondayOf = (s) => addDays(s, -((parse(s).getUTCDay() + 6) % 7));

/**
 * series: continuous [{date:'YYYY-MM-DD', count}] ascending, including warm-up days before `from`.
 *
 * Candle model (GitHub only exposes DAILY totals, so intraday OHLC is impossible; this is a
 * transparent, deterministic mapping, not fabricated data):
 *   level_t = level_{t-1} + alpha * (count_t - level_{t-1})      (EMA of activity = "price")
 *   open  = level_{t-1}     close = level_t
 *   high  = max(open, close, count_t, count_{t-1})
 *   low   = min(open, close, count_t, count_{t-1})
 *   green when close >= open (day beat the running level), red otherwise.
 */
function analyze(series, { from, today, alpha = 0.5 } = {}) {
  if (!series.length) throw new Error('empty series');
  const c = series.map((d) => d.count);
  const L = [];
  const all = [];
  for (let i = 0; i < c.length; i++) {
    const o = i ? L[i - 1] : c[0];
    const cl = o + alpha * (c[i] - o);
    L.push(cl);
    const prev = i ? c[i - 1] : c[0];
    all.push({
      date: series[i].date, count: c[i], o, c: cl,
      h: Math.max(o, cl, c[i], prev), l: Math.min(o, cl, c[i], prev),
      up: cl >= o, partial: series[i].date === today,
    });
  }

  const streak = [];
  let s = 0;
  for (let i = 0; i < c.length; i++) { s = c[i] > 0 ? s + 1 : 0; streak.push(s); }

  // Developer Index (0-1000): rolling 28-day blend of consistency, intensity, streak, stability.
  const WIN = 28;
  const diAll = c.map((_, i) => {
    const w = c.slice(Math.max(0, i - WIN + 1), i + 1);
    const m = mean(w);
    const consistency = w.filter((x) => x > 0).length / w.length;
    const intensity = Math.min(1, Math.log1p(m) / Math.log1p(10));
    const streakF = Math.min(1, streak[i] / 14);
    const stability = m > 0 ? 1 - Math.min(1, std(w) / m / 3) : 0;
    return Math.round(1000 * (0.35 * consistency + 0.25 * intensity + 0.2 * streakF + 0.2 * stability));
  });

  const sma = [], bu = [], bl = [];
  for (let i = 0; i < L.length; i++) {
    if (i < 19) { sma.push(null); bu.push(null); bl.push(null); continue; }
    const w = L.slice(i - 19, i + 1);
    const m = mean(w), sd = std(w);
    sma.push(m); bu.push(m + 2 * sd); bl.push(Math.max(0, m - 2 * sd));
  }

  let start = series.findIndex((d) => d.date >= from);
  if (start < 0) start = 0;
  const candles = all.slice(start);
  const vc = candles.map((k) => k.count);
  const diVis = diAll.slice(start);

  // current streak (full history); an empty in-progress day does not break it yet
  let idx = c.length - 1;
  if (c[idx] === 0 && all[idx].partial) idx--;
  const cur = idx >= 0 ? streak[idx] : 0;
  let run = 0, longest = 0;
  for (const x of vc) { run = x > 0 ? run + 1 : 0; if (run > longest) longest = run; }
  longest = Math.max(longest, cur);

  let peak = 0, maxDD = 0;
  for (const v of diVis) { peak = Math.max(peak, v); if (peak > 0) maxDD = Math.max(maxDD, (peak - v) / peak); } // drawdown of the Developer Index

  let best = candles[0];
  for (const k of candles) if (k.count > best.count) best = k;
  const dow = Array.from({ length: 7 }, () => []);
  for (const k of candles) dow[parse(k.date).getUTCDay()].push(k.count);
  let bestDow = 0;
  dow.forEach((a, i) => { if (mean(a) > mean(dow[bestDow])) bestDow = i; });

  const m = mean(vc), sd = std(vc);
  const stats = {
    total: vc.reduce((a, b) => a + b, 0), avg: m, activeDays: vc.filter((x) => x > 0).length,
    activeRatio: vc.length ? vc.filter((x) => x > 0).length / vc.length : 0,
    sigma: sd, sharpe: sd > 0 ? m / sd : 0, maxDD, currentStreak: cur, longestStreak: longest,
    best: { date: best.date, count: best.count }, bestWeekday: bestDow,
  };

  const di = {
    series: diVis, last: diVis[diVis.length - 1], prev: diVis.length > 1 ? diVis[diVis.length - 2] : diVis[0],
    hi: Math.max(...diVis), lo: Math.min(...diVis), avg: mean(diVis),
  };
  di.chg = di.last - di.prev;
  di.pct = di.prev ? (di.chg / di.prev) * 100 : 0;

  const lastDate = series[series.length - 1].date;

  // weekly volume (Mon-start), last 12 weeks of fetched history
  const wk = new Map();
  for (const d of series) { const k = mondayOf(d.date); wk.set(k, (wk.get(k) || 0) + d.count); }
  const weekly = [...wk].slice(-12).map(([st, total]) => ({ start: st, total, partial: addDays(st, 6) > lastDate }));

  // monthly totals, last 6 fully-covered months
  const mo = new Map();
  for (const d of series) { const k = d.date.slice(0, 7); mo.set(k, (mo.get(k) || 0) + d.count); }
  let months = [...mo].map(([key, total]) => ({ key, total }));
  if (series[0].date.slice(8) !== '01') months = months.slice(1);
  months = months.slice(-6).map((x, i, a) => ({
    ...x, partial: i === a.length - 1 && addDays(lastDate, 1).slice(0, 7) === x.key,
    pct: i && a[i - 1].total ? ((x.total - a[i - 1].total) / a[i - 1].total) * 100 : null,
  }));

  // 26-week weekday x week heatmap
  const byDate = new Map(series.map((d) => [d.date, d.count]));
  const lastStart = mondayOf(lastDate);
  const nz = c.filter((x) => x > 0);
  const q = [percentile(nz, 0.25), percentile(nz, 0.5), percentile(nz, 0.75)];
  const lvl = (x) => (x === 0 ? 0 : x <= q[0] ? 1 : x <= q[1] ? 2 : x <= q[2] ? 3 : 4);
  const heat = [];
  for (let col = 0; col < 26; col++) {
    const st = addDays(lastStart, -(25 - col) * 7);
    heat.push(Array.from({ length: 7 }, (_, r) => {
      const date = addDays(st, r);
      return byDate.has(date) ? { date, count: byDate.get(date), level: lvl(byDate.get(date)) } : null;
    }));
  }

  return {
    candles, sma: sma.slice(start), bandU: bu.slice(start), bandL: bl.slice(start),
    di, stats, weekly, months, heat, range: { from: candles[0].date, to: candles[candles.length - 1].date, n: candles.length },
  };
}

module.exports = { analyze, parse, iso, addDays, mean, std, percentile, DAY };
