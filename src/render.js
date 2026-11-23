'use strict';
const { THEMES, COLORBLIND } = require('./themes');
const { percentile } = require('./analytics');

const FONT = "'JetBrains Mono','SF Mono',SFMono-Regular,Menlo,Consolas,'Liberation Mono','DejaVu Sans Mono',monospace";
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEFAULT_SHOW = ['stats', 'heatmap', 'weekly', 'monthly', 'volume', 'tape', 'sma'];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f = (n) => String(Math.round(n * 100) / 100);
const int = (n) => Math.round(n).toLocaleString('en-US');
const sgn = (n, d = 1) => (n >= 0 ? '+' : '-') + Math.abs(n).toFixed(d);
const mdate = (s) => `${MONTHS[+s.slice(5, 7) - 1]} ${+s.slice(8)}`;

function niceTicks(max, n = 5) {
  const raw = max / n, mag = 10 ** Math.floor(Math.log10(raw)), norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const ticks = [];
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(v);
  return { ticks, top: Math.ceil(max / step - 1e-9) * step };
}

function render(d, o = {}) {
  const T = { ...(THEMES[o.theme] || THEMES.tradingview), ...(o.colorblind ? COLORBLIND : {}), ...(o.colors || {}) };
  const show = o.show instanceof Set ? o.show : new Set(o.show || DEFAULT_SHOW);
  const animate = o.animate !== false;
  const W = 960, H = 540, PAD = 12, SIDE = 296, AX = 52;
  const hasSide = ['stats', 'heatmap', 'weekly', 'monthly'].some((k) => show.has(k));
  const leftW = hasSide ? W - SIDE - PAD * 3 : W - PAD * 2;
  const px0 = PAD, px1 = PAD + leftW - AX, pw = px1 - px0;
  const sx = W - PAD - SIDE;
  const { candles, di, stats, range } = d;
  const n = candles.length, last = candles[n - 1];
  const col = (up) => (up ? T.up : T.down);
  const o2 = [];
  const txt = (x, y, s, a = {}) =>
    `<text x="${f(x)}" y="${f(y)}" font-size="${a.size || 10}" fill="${a.fill || T.text}"${a.anchor ? ` text-anchor="${a.anchor}"` : ''}${a.bold ? ' font-weight="700"' : ''}${a.ls ? ` letter-spacing="${a.ls}"` : ''}>${esc(s)}</text>`;
  const tri = (x, y, s, up, fill) => `<path d="M${f(x - s)} ${f(y + (up ? s : -s))}L${f(x)} ${f(y + (up ? -s : s))}L${f(x + s)} ${f(y + (up ? s : -s))}Z" fill="${fill}"/>`;
  const panel = (x, y, w, h) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="4" fill="${T.panel}" stroke="${T.grid}"/>`;
  const title = (x, y, s, right) => txt(x, y, s, { size: 9.5, fill: T.accent, bold: 1, ls: 1 }) + (right || '');

  o2.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">`);
  o2.push(`<title id="t">${esc(d.user.login)} developer terminal</title><desc id="d">Candlestick chart of GitHub contributions ${range.from} to ${range.to}. Developer Index ${di.last}.</desc>`);
  o2.push(`<rect width="${W}" height="${H}" rx="10" fill="${T.bg}"/><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="10" fill="none" stroke="${T.grid}"/>`);
  o2.push(`<g font-family="${FONT}">`);

  // ---- header
  const diCol = col(di.chg >= 0);
  o2.push(`<rect x="12" y="10" width="3" height="28" rx="1.5" fill="${T.accent}"/>`);
  o2.push(txt(24, 24, '@' + d.user.login, { size: 14, bold: 1 }) + txt(24, 38, 'DEVELOPER INDEX  DEVX', { size: 9, fill: T.muted, ls: 1 }));
  o2.push(txt(250, 35, int(di.last), { size: 26, bold: 1, fill: diCol }));
  o2.push(tri(338, 20, 4.5, di.chg >= 0, diCol) + txt(348, 24, sgn(di.chg, 0), { size: 12, bold: 1, fill: diCol }) + txt(338, 38, sgn(di.pct, 2) + '%', { size: 10, fill: diCol }));
  const sp = di.series, smin = Math.min(...sp), smax = Math.max(...sp), sr = smax - smin || 1;
  const spPts = sp.map((v, i) => `${f(430 + (150 * i) / Math.max(1, sp.length - 1))},${f(36 - (24 * (v - smin)) / sr)}`);
  o2.push(`<polygon points="430,36 ${spPts.join(' ')} 580,36" fill="${diCol}" fill-opacity=".12"/><polyline points="${spPts.join(' ')}" fill="none" stroke="${diCol}" stroke-width="1.3" stroke-linejoin="round"/>`);
  [['DI HIGH', di.hi, 610], ['DI LOW', di.lo, 690], ['DI AVG', Math.round(di.avg), 770]].forEach(([l, v, x]) => {
    o2.push(txt(x, 20, l, { size: 8.5, fill: T.muted, ls: 1 }) + txt(x, 35, int(v), { size: 13, bold: 1 }));
  });
  o2.push(`<circle cx="893" cy="23" r="3.5" fill="${T.up}">${animate ? '<animate attributeName="opacity" values="1;.2;1" dur="1.8s" repeatCount="indefinite"/>' : ''}</circle>` + txt(W - 14, 27, 'LIVE', { size: 10, bold: 1, anchor: 'end', fill: T.up, ls: 1 }));
  o2.push(`<line x1="12" y1="46" x2="${W - 12}" y2="46" stroke="${T.grid}"/>`);
  o2.push(txt(14, 59, `1D  ${range.from} > ${range.to}  ${n} SESSIONS  SRC GITHUB GRAPHQL`, { size: 9, fill: T.muted }));
  o2.push(txt(W - 14, 59, `UPDATED ${d.generatedAt}`, { size: 9, fill: T.muted, anchor: 'end' }));

  // ---- price pane geometry
  const pTop = 92, pH = show.has('volume') ? 300 : 360, vTop = pTop + pH + 8, vH = 60;
  const panelBottom = 488;
  o2.push(panel(PAD, 68, leftW, panelBottom - 68));
  const highs = candles.map((k) => k.h), maxH = Math.max(...highs);
  const yDataMax = Math.max(4, Math.min(maxH, percentile(highs, 0.97) * 1.2));
  const nt = niceTicks(yDataMax), yMax = nt.top;
  const yp = (v) => pTop + pH * (1 - Math.min(v, yMax) / yMax);
  const step = pw / n, bw = Math.max(1, Math.min(14, step * 0.66));
  const cx = (i) => px0 + step * (i + 0.5);

  nt.ticks.forEach((v) => {
    o2.push(`<line x1="${px0}" y1="${f(yp(v))}" x2="${px1}" y2="${f(yp(v))}" stroke="${T.grid}" stroke-dasharray="2 4"/>` + txt(px1 + 6, yp(v) + 3.5, v % 1 ? v.toFixed(1) : String(v), { size: 9, fill: T.muted }));
  });
  const lab = Math.max(1, Math.round(n / 6));
  for (let i = 0; i < n; i += lab) {
    const x = cx(i);
    o2.push(`<line x1="${f(x)}" y1="${pTop}" x2="${f(x)}" y2="${show.has('volume') ? vTop + vH : pTop + pH}" stroke="${T.grid}" stroke-dasharray="2 5" opacity=".55"/>` + txt(Math.max(px0 + 4, Math.min(px1 - 20, x)), vTop + vH + 16 - (show.has('volume') ? 0 : vH + 8 - 8), mdate(candles[i].date), { size: 9, fill: T.muted, anchor: i === 0 ? 'start' : 'middle' }));
  }

  if (show.has('bands')) {
    const up = [], lo = [];
    candles.forEach((_, i) => { if (d.bandU[i] != null) { up.push(`${f(cx(i))},${f(yp(d.bandU[i]))}`); lo.unshift(`${f(cx(i))},${f(yp(d.bandL[i]))}`); } });
    if (up.length > 1) o2.push(`<polygon points="${up.join(' ')} ${lo.join(' ')}" fill="${T.accent}" fill-opacity=".09"/>`);
  }

  const P = { u: [], d: [], ub: [], db: [] };
  let partial = '';
  const clipped = [];
  candles.forEach((k, i) => {
    const x = cx(i), yh = yp(k.h), yl = yp(k.l), yo = yp(k.o), yc = yp(k.c);
    const top = Math.min(yo, yc), bh = Math.max(1, Math.abs(yo - yc));
    if (k.h > yMax) clipped.push(x);
    if (k.partial) {
      partial = `<g stroke="${col(k.up)}"><path d="M${f(x)} ${f(yh)}V${f(yl)}" fill="none"/><rect x="${f(x - bw / 2)}" y="${f(top)}" width="${f(bw)}" height="${f(bh)}" fill="${col(k.up)}" fill-opacity=".3">${animate ? '<animate attributeName="fill-opacity" values=".15;.5;.15" dur="2s" repeatCount="indefinite"/>' : ''}</rect></g>`;
      return;
    }
    const w = `M${f(x)} ${f(yh)}V${f(yl)}`, b = `M${f(x - bw / 2)} ${f(top)}h${f(bw)}v${f(bh)}h${f(-bw)}z`;
    (k.up ? P.u : P.d).push(w); (k.up ? P.ub : P.db).push(b);
  });
  o2.push(`<g id="candles" data-n="${n}">`);
  [['u', 'ub', T.up], ['d', 'db', T.down]].forEach(([w, b, c]) => {
    if (P[w].length) o2.push(`<path d="${P[w].join('')}" stroke="${c}" stroke-width="1" fill="none"/><path d="${P[b].join('')}" fill="${c}"/>`);
  });
  o2.push(partial + '</g>');
  clipped.forEach((x) => o2.push(tri(x, pTop + 4, 2.2, true, T.muted)));

  if (show.has('sma')) {
    const pts = candles.map((_, i) => (d.sma[i] == null ? null : `${f(cx(i))},${f(yp(d.sma[i]))}`)).filter(Boolean);
    if (pts.length > 1) o2.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${T.ma}" stroke-width="1.3" stroke-linejoin="round"/>`);
  }

  // best day annotation
  const bi = candles.findIndex((k) => k.date === stats.best.date);
  if (bi >= 0 && stats.best.count > 0) {
    const bx = Math.max(px0 + 18, Math.min(px1 - 18, cx(bi))), by = yp(candles[bi].h) - 5;
    o2.push(txt(bx, Math.max(pTop + 12, by - 4), `${stats.best.count}`, { size: 9, bold: 1, anchor: 'middle' }) + tri(cx(bi), Math.max(pTop + 14, by + 1), 2.5, false, T.text));
  }

  // last price line + tag
  const ly = yp(last.c);
  o2.push(`<line x1="${px0}" y1="${f(ly)}" x2="${px1}" y2="${f(ly)}" stroke="${col(last.up)}" stroke-dasharray="3 3" opacity=".8"/><rect x="${px1 + 2}" y="${f(ly - 7.5)}" width="${AX - 6}" height="15" rx="2" fill="${col(last.up)}"/>` + txt(px1 + 2 + (AX - 6) / 2, ly + 3.5, last.c.toFixed(1), { size: 9.5, bold: 1, anchor: 'middle', fill: T.bg }));

  // legend
  const smaLast = d.sma[n - 1];
  o2.push(`<text x="${px0 + 8}" y="84" font-size="10"><tspan fill="${T.text}" font-weight="700">DEVX 1D</tspan><tspan dx="10" fill="${T.muted}">O</tspan><tspan dx="3" fill="${col(last.up)}">${last.o.toFixed(1)}</tspan><tspan dx="8" fill="${T.muted}">H</tspan><tspan dx="3" fill="${col(last.up)}">${last.h.toFixed(1)}</tspan><tspan dx="8" fill="${T.muted}">L</tspan><tspan dx="3" fill="${col(last.up)}">${last.l.toFixed(1)}</tspan><tspan dx="8" fill="${T.muted}">C</tspan><tspan dx="3" fill="${col(last.up)}">${last.c.toFixed(1)}</tspan><tspan dx="8" fill="${T.muted}">RAW</tspan><tspan dx="3" fill="${T.text}">${last.count}</tspan>${show.has('sma') && smaLast != null ? `<tspan dx="12" fill="${T.ma}">SMA20 ${smaLast.toFixed(1)}</tspan>` : ''}</text>`);

  // volume
  if (show.has('volume')) {
    const cnt = candles.map((k) => k.count), vMax = Math.max(4, Math.min(Math.max(...cnt), percentile(cnt, 0.97) * 1.2));
    const vu = [], vd = [];
    candles.forEach((k, i) => {
      if (!k.count) return;
      const h = (Math.min(k.count, vMax) / vMax) * (vH - 4);
      (k.up ? vu : vd).push(`M${f(cx(i) - bw / 2)} ${f(vTop + vH - h)}h${f(bw)}v${f(h)}h${f(-bw)}z`);
    });
    o2.push(`<line x1="${px0}" y1="${vTop}" x2="${px1}" y2="${vTop}" stroke="${T.grid}"/><line x1="${px0}" y1="${vTop + vH}" x2="${px1}" y2="${vTop + vH}" stroke="${T.grid}"/>`);
    if (vu.length) o2.push(`<path d="${vu.join('')}" fill="${T.up}" fill-opacity=".6"/>`);
    if (vd.length) o2.push(`<path d="${vd.join('')}" fill="${T.down}" fill-opacity=".6"/>`);
    o2.push(txt(px0 + 6, vTop + 11, 'VOLUME  CONTRIBUTIONS/DAY', { size: 8.5, fill: T.muted, ls: 1 }) + txt(px1 + 6, vTop + 9, String(Math.round(vMax)), { size: 9, fill: T.muted }) + txt(px1 + 6, vTop + vH, '0', { size: 9, fill: T.muted }));
  }

  // ---- sidebar
  if (show.has('stats')) {
    o2.push(panel(sx, 68, SIDE, 160) + title(sx + 12, 84, 'ANALYTICS'));
    const cells = [
      ['TOTAL', int(stats.total), T.text], ['AVG / DAY', stats.avg.toFixed(2), T.text],
      ['ACTIVE DAYS', `${stats.activeDays} (${Math.round(stats.activeRatio * 100)}%)`, T.text], ['CUR STREAK', `${stats.currentStreak}d`, stats.currentStreak ? T.up : T.down],
      ['LONGEST', `${stats.longestStreak}d`, T.text], ['BEST DAY', `${stats.best.count} ${mdate(stats.best.date)}`, T.up],
      ['VOLATILITY', `\u03c3 ${stats.sigma.toFixed(2)}`, T.text], ['SHARPE', stats.sharpe.toFixed(2), T.text],
      ['MAX DRAWDOWN', `-${(stats.maxDD * 100).toFixed(0)}%`, T.down], ['BEST WEEKDAY', DOW[stats.bestWeekday], T.ma],
    ];
    cells.forEach(([l, v, c], i) => {
      const x = sx + 12 + (i % 2) * 140, y = 98 + Math.floor(i / 2) * 25.5;
      o2.push(txt(x, y + 6, l, { size: 8, fill: T.muted, ls: 0.8 }) + txt(x, y + 19, v, { size: 11.5, bold: 1, fill: c }));
    });
  }
  if (show.has('heatmap')) {
    const y0 = 234;
    o2.push(panel(sx, y0, SIDE, 104) + title(sx + 12, y0 + 16, 'ACTIVITY HEATMAP  26W'));
    const cs = (SIDE - 24) / 26;
    const fills = [[T.grid, 0.9], [T.up, 0.3], [T.up, 0.52], [T.up, 0.76], [T.up, 1]];
    d.heat.forEach((colm, ci) => colm.forEach((cell, r) => {
      if (!cell) return;
      const [c, op] = fills[cell.level];
      o2.push(`<rect x="${f(sx + 12 + ci * cs)}" y="${f(y0 + 24 + r * 10)}" width="${f(cs - 1.8)}" height="8.2" rx="1.5" fill="${c}" fill-opacity="${op}"/>`);
    }));
  }
  if (show.has('weekly')) {
    const y0 = 344, wk = d.weekly, done = wk.filter((w) => !w.partial);
    const wow = done.length > 2 && done[done.length - 2].total ? ((done[done.length - 1].total - done[done.length - 2].total) / done[done.length - 2].total) * 100 : null;
    o2.push(panel(sx, y0, SIDE, 68) + title(sx + 12, y0 + 15, 'WEEKLY VOLUME  12W', wow == null ? '' : txt(sx + SIDE - 12, y0 + 15, `WoW ${sgn(wow, 0)}%`, { size: 9.5, bold: 1, anchor: 'end', fill: col(wow >= 0) })));
    const mx = Math.max(1, ...wk.map((w) => w.total)), bwid = (SIDE - 24) / 12;
    wk.forEach((w, i) => {
      const h = Math.max(1.5, (w.total / mx) * 34), up = i === 0 || w.total >= wk[i - 1].total;
      o2.push(`<rect x="${f(sx + 12 + i * bwid)}" y="${f(y0 + 60 - h)}" width="${f(bwid - 3)}" height="${f(h)}" rx="1" fill="${col(up)}" fill-opacity="${w.partial ? 0.35 : 0.85}"/>`);
    });
  }
  if (show.has('monthly')) {
    const y0 = 418, ms = d.months;
    o2.push(panel(sx, y0, SIDE, 70) + title(sx + 12, y0 + 15, 'MONTHLY CLOSE  6M'));
    const cw = (SIDE - 24) / 6;
    ms.forEach((m, i) => {
      const x = sx + 12 + i * cw + cw / 2;
      o2.push(txt(x, y0 + 30, MONTHS[+m.key.slice(5) - 1] + (m.partial ? '*' : ''), { size: 8.5, fill: T.muted, anchor: 'middle' }) + txt(x, y0 + 46, int(m.total), { size: 11, bold: 1, anchor: 'middle' }) + (m.pct == null ? '' : txt(x, y0 + 60, sgn(m.pct, 0) + '%', { size: 8.5, anchor: 'middle', fill: col(m.pct >= 0) })));
    });
  }

  // ---- ticker tape
  if (show.has('tape')) {
    const y0 = 498;
    o2.push(`<rect x="${PAD}" y="${y0}" width="${W - PAD * 2}" height="28" rx="4" fill="${T.panel}" stroke="${T.grid}"/>`);
    const unit = [
      `DEVX ${di.last} ${sgn(di.chg, 0)} (${sgn(di.pct, 2)}%)`, `TOTAL ${int(stats.total)}`, `STREAK ${stats.currentStreak}d`,
      `BEST ${stats.best.count} ${mdate(stats.best.date)}`, `AVG ${stats.avg.toFixed(2)}/d`, `SIGMA ${stats.sigma.toFixed(2)}`, `SHARPE ${stats.sharpe.toFixed(2)}`,
    ].join('   |   ') + '   |   ';
    const cw = 6.3, view = W - PAD * 2 - 16;
    let s = unit; while (s.length * cw < view + unit.length * cw) s += unit;
    const tw = Math.round(s.length * cw);
    o2.push(`<clipPath id="tp"><rect x="${PAD + 8}" y="${y0}" width="${view}" height="28"/></clipPath><g clip-path="url(#tp)"><g>`);
    if (animate) o2.push(`<animateTransform attributeName="transform" type="translate" from="0 0" to="-${Math.round(unit.length * cw)} 0" dur="${Math.round((unit.length * cw) / 38)}s" repeatCount="indefinite"/>`);
    o2.push(`<text x="${PAD + 8}" y="${y0 + 18}" font-size="10.5" fill="${T.text}" textLength="${tw}" lengthAdjust="spacing" xml:space="preserve">${esc(animate ? s : unit)}</text></g></g>`);
  }

  o2.push('</g></svg>');
  return o2.join('\n');
}

module.exports = { render, DEFAULT_SHOW };
