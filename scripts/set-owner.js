#!/usr/bin/env node
// Replaces the OWNER placeholder with your GitHub username (works on any OS).
const fs = require('fs'), path = require('path');
const owner = process.argv[2];
if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(owner || '')) { console.error('usage: node scripts/set-owner.js <github-username>'); process.exit(1); }
for (const f of ['README.md', 'package.json', 'action.yml', 'LICENSE', 'examples/profile-workflow.yml']) {
  const p = path.join(__dirname, '..', f);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/OWNER/g, owner));
  console.log('updated', f);
}
