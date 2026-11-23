'use strict';
const { addDays } = require('./analytics');

const ENDPOINT = 'https://api.github.com/graphql';
const QUERY = `query($login:String!,$from:DateTime!,$to:DateTime!){
  user(login:$login){ login name
    contributionsCollection(from:$from,to:$to){
      contributionCalendar{ weeks{ contributionDays{ date contributionCount } } }
    } } }`;
const CHUNK_DAYS = 360; // GraphQL limits a contributionsCollection to < 1 year per request

async function post(body, token, fetchImpl) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'gh-trading-terminal' },
      body,
    });
    if (res.status >= 500 && attempt < 2) { await new Promise((r) => setTimeout(r, 800 * (attempt + 1))); continue; }
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    if (json.errors && !json.data?.user) throw new Error(json.errors.map((e) => e.message).join('; '));
    return json;
  }
}

/** Returns a continuous per-day series [{date,count}] for from..to (inclusive, UTC dates). */
async function fetchCalendar({ login, from, to, token, fetchImpl = globalThis.fetch }) {
  if (!token) throw new Error('Missing GITHUB_TOKEN (no scopes needed for public data; add read:user for private counts).');
  const counts = new Map();
  let profile = { login, name: null };
  for (let cur = from; cur <= to; cur = addDays(cur, CHUNK_DAYS)) {
    const end = addDays(cur, CHUNK_DAYS - 1) < to ? addDays(cur, CHUNK_DAYS - 1) : to;
    const variables = { login, from: `${cur}T00:00:00Z`, to: `${end}T23:59:59Z` };
    const json = await post(JSON.stringify({ query: QUERY, variables }), token, fetchImpl);
    const user = json.data?.user;
    if (!user) throw new Error(`GitHub user "${login}" not found`);
    profile = { login: user.login, name: user.name };
    for (const w of user.contributionsCollection.contributionCalendar.weeks)
      for (const d of w.contributionDays) if (d.date >= from && d.date <= to) counts.set(d.date, d.contributionCount);
  }
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push({ date: d, count: counts.get(d) || 0 });
  return { ...profile, days };
}

module.exports = { fetchCalendar, CHUNK_DAYS };
