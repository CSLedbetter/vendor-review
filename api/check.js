import { prepare } from '../lib/input.js';

// The free, code-only checks: tier plus document checks. No Claude call, so no sign-in.
export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  const p = prepare(req.body);
  if (p.error) return res.status(400).json({ error: p.error });
  return res.status(200).json({ tier: p.tier, analysis: p.analysis, redactions: p.redactions });
}
