// Optional serverless endpoint (Vercel). Not required: the GitHub Action route needs no hosting.
// /api/terminal?user=octocat&days=120&theme=bloomberg&show=all
const { buildSvg } = require('../src');
module.exports = async (req, res) => {
  try {
    const svg = await buildSvg(req.query || {}, { token: process.env.GITHUB_TOKEN });
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(svg);
  } catch (e) {
    const msg = String(e.message).replace(/[<>&]/g, '');
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.status(/Invalid|must|limited/.test(msg) ? 400 : 502).send(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="60"><rect width="640" height="60" fill="#131722"/><text x="16" y="36" font-family="monospace" font-size="13" fill="#ef5350">terminal error: ${msg.slice(0, 80)}</text></svg>`);
  }
};
