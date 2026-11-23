'use strict';
const { analyze, addDays, parse, iso } = require('./analytics');
const { fetchCalendar } = require('./github');
const { demoSeries } = require('./demo');
const { render } = require('./render');
const { parseOptions } = require('./options');

const WARMUP = 60, MIN_HISTORY = 210; // warm-up for EMA/streak/DI; enough history for 26w heatmap + 6 months

async function buildSvg(raw, { token, fetchImpl, now = new Date() } = {}) {
  const o = parseOptions(raw);
  const today = iso(now);
  const to = o.to && o.to <= today ? o.to : today;
  const from = o.from || addDays(to, -(o.days - 1));
  if (from > to) throw new Error('"from" must be before "to"');
  if ((parse(to) - parse(from)) / 864e5 > 730) throw new Error('Range limited to 730 days');
  const fetchFrom = [addDays(from, -WARMUP), addDays(to, -(MIN_HISTORY - 1))].sort()[0];
  const src = o.demo ? { ...demoSeries(fetchFrom, to, o.seed), login: o.user } : await fetchCalendar({ login: o.user, from: fetchFrom, to, token, fetchImpl });
  const data = analyze(src.days, { from, today: to === today ? today : null, alpha: o.alpha });
  return render({ ...data, user: { login: src.login, name: src.name }, generatedAt: now.toISOString().slice(0, 16).replace('T', ' ') + 'Z' }, o);
}
module.exports = { buildSvg };
