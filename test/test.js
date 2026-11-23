'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { analyze, addDays } = require('../src/analytics');
const { buildSvg } = require('../src');
const { fetchCalendar, CHUNK_DAYS } = require('../src/github');
const { THEMES } = require('../src/themes');
const NOW = new Date('2026-11-22T10:00:00Z');

test('candle invariants + totals match raw data', () => {
  const series = Array.from({ length: 120 }, (_, i) => ({ date: addDays('2026-07-25', i), count: (i * 7) % 11 }));
  const a = analyze(series, { from: '2026-09-01', today: '2026-11-22' });
  for (const k of a.candles) {
    assert.ok(k.h >= Math.max(k.o, k.c, k.count) - 1e-9 && k.l <= Math.min(k.o, k.c, k.count) + 1e-9);
    assert.equal(k.up, k.c >= k.o);
  }
  assert.equal(a.stats.total, a.candles.reduce((s, k) => s + k.count, 0));
  assert.ok(a.di.last >= 0 && a.di.last <= 1000);
});

test('streak ignores an empty in-progress day', () => {
  const s = [3, 1, 2, 0].map((count, i) => ({ date: addDays('2026-11-19', i), count }));
  assert.equal(analyze(s, { from: '2026-11-19', today: '2026-11-22' }).stats.currentStreak, 3);
  assert.equal(analyze(s, { from: '2026-11-19', today: null }).stats.currentStreak, 0);
});

test('renders every theme: safe, self-contained SVG', async () => {
  for (const theme of Object.keys(THEMES)) {
    const svg = await buildSvg({ user: 'octocat', demo: 'true', theme, show: 'all', days: '120' }, { now: NOW });
    assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
    assert.match(svg, /data-n="120"/);
    assert.ok(!/<script|<style|<foreignObject|https?:\/\/(?!www\.w3\.org)/.test(svg), 'no scripts/css/external refs');
    assert.ok(svg.length < 60000, 'size ' + svg.length);
  }
});

test('display toggles and input safety', async () => {
  const min = await buildSvg({ user: 'a', demo: 'true', show: 'volume', animate: 'false' }, { now: NOW });
  assert.ok(!/animate/.test(min) && !/ANALYTICS/.test(min));
  await assert.rejects(buildSvg({ user: '<x>' }, { now: NOW }), /Invalid/);
  await assert.rejects(buildSvg({ user: 'a', from: '2026-11-20', to: '2026-11-01', demo: 'true' }, { now: NOW }), /before/);
});

test('fetch chunks long ranges under one year and dedupes', async () => {
  const calls = [];
  const fetchImpl = async (_, init) => {
    const v = JSON.parse(init.body).variables; calls.push(v);
    const days = []; for (let d = v.from.slice(0, 10); d <= v.to.slice(0, 10); d = addDays(d, 1)) days.push({ date: d, contributionCount: 2 });
    return { ok: true, status: 200, json: async () => ({ data: { user: { login: 'x', name: null, contributionsCollection: { contributionCalendar: { weeks: [{ contributionDays: days }] } } } } }) };
  };
  const r = await fetchCalendar({ login: 'x', from: '2025-01-01', to: '2026-11-22', token: 't', fetchImpl });
  assert.ok(calls.length >= 2);
  for (const v of calls) assert.ok((Date.parse(v.to) - Date.parse(v.from)) / 864e5 < 365);
  assert.equal(r.days.length, new Set(r.days.map((d) => d.date)).size);
  assert.equal(r.days[0].date, '2026-01-01'.replace('2026', '2025'));
  assert.equal(CHUNK_DAYS, 360);
});

test('scripts/run.sh (the GitHub Action entrypoint) writes dark + light SVGs', { skip: process.platform === 'win32' }, () => {
  const { execFileSync } = require('node:child_process');
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'term-'));
  execFileSync('bash', [path.join(__dirname, '..', 'scripts', 'run.sh')], {
    env: { ...process.env, INPUT_USERNAME: 'octocat', INPUT_OUTPUT_DIR: out, INPUT_EXTRA_ARGS: '--demo --hide tape', INPUT_DAYS: '60' },
  });
  for (const f of ['terminal-dark.svg', 'terminal-light.svg']) assert.match(fs.readFileSync(path.join(out, f), 'utf8'), /^<svg/);
  assert.notEqual(fs.readFileSync(path.join(out, 'terminal-dark.svg'), 'utf8'), fs.readFileSync(path.join(out, 'terminal-light.svg'), 'utf8'));
});
