#!/usr/bin/env node
'use strict';
const { parseArgs } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const { buildSvg } = require('./index');

const keys = ['user', 'days', 'from', 'to', 'theme', 'show', 'hide', 'out', 'seed', 'alpha', 'up', 'down', 'bg', 'animate', 'colorblind'];
const options = Object.fromEntries(keys.map((k) => [k, { type: 'string' }]));
options.demo = { type: 'boolean' };
options.help = { type: 'boolean', short: 'h' };

(async () => {
  const { values } = parseArgs({ options, allowPositionals: false });
  if (values.help || !values.user) {
    console.log(`Usage: gh-trading-terminal --user <login> [--days 90] [--from YYYY-MM-DD --to YYYY-MM-DD]
  [--theme tradingview|bloomberg|midnight|light] [--show stats,heatmap,weekly,monthly,volume,tape,sma,bands|all]
  [--hide tape,...] [--animate false] [--colorblind true] [--up #hex --down #hex --bg #hex] [--alpha 0.5]
  [--demo] [--out file.svg]     Token: GITHUB_TOKEN env var (not needed with --demo)`);
    process.exit(values.help ? 0 : 1);
  }
  const svg = await buildSvg({ ...values }, { token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN });
  if (values.out) { fs.mkdirSync(path.dirname(path.resolve(values.out)), { recursive: true }); fs.writeFileSync(values.out, svg); console.log(`wrote ${values.out} (${svg.length} bytes)`); }
  else process.stdout.write(svg);
})().catch((e) => { console.error('error:', e.message); process.exit(1); });
