import { getUser, begin, finish, userStatus, maxCost, actualCost, REASONS, PRICES } from '../lib/gate.js';
import { prepare, cleanSampleId } from '../lib/input.js';
import { callClaude, DEFAULT_MODEL } from '../lib/claude.js';
import { SYSTEM, SCHEMA, userMessage } from '../lib/prompt.js';
import { CRITERIA } from '../lib/criteria.js';

const MAX_TOKENS = 4000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  const p = prepare(req.body);
  if (p.error) return res.status(400).json({ error: p.error });
  const { intake, tier, analysis, text, redactions } = p;
  const sampleId = cleanSampleId(req.body?.sample);

  const model = PRICES[process.env.CLAUDE_MODEL] ? process.env.CLAUDE_MODEL : DEFAULT_MODEL;
  const user = userMessage({ intake, tier, analysis, text });
  const reserve = maxCost(model, SYSTEM.length + JSON.stringify(SCHEMA).length + user.length, MAX_TOKENS);
  const free = { tier, analysis, redactions };

  let gate;
  try {
    const who = await getUser(req);
    if (!who) return res.status(401).json({ error: REASONS.not_signed_in.message, reason: 'not_signed_in', ...free });
    gate = { ...(await begin(who.id, reserve, sampleId || intake.vendor.slice(0, 40))), user: who };
  } catch (err) {
    console.error(err);
    return res.status(503).json({ error: 'The demo’s access service is unavailable right now.', ...free });
  }
  if (!gate?.ok) {
    const r = REASONS[gate?.reason] || REASONS.disabled;
    // The code checks are free, so still return them when the budget is the only problem.
    return res.status(r.status).json({ error: r.message, reason: gate?.reason, ...free });
  }

  const started = Date.now();
  try {
    const { data, usage, model: used, requestId } = await callClaude({ model, system: SYSTEM, user, schema: SCHEMA, maxTokens: MAX_TOKENS });
    const cost = actualCost(model, usage);
    await finish(gate.request_id, true, cost, usage, used).catch((e) => console.error(e));
    const after = await userStatus(gate.user.id).catch(() => null);
    // Attach the paraphrased summary for each cited criterion, and drop anything outside the list.
    data.findings = data.findings.map((x) => ({ ...x, criteria: x.criteria.filter((id) => CRITERIA[id]).map((id) => ({ id, summary: CRITERIA[id] })) }));
    return res.status(200).json({
      ...free,
      intake,
      result: data,
      model: used,
      cost_usd: Number(cost.toFixed(4)),
      seconds: Math.round((Date.now() - started) / 100) / 10,
      claude_request_id: requestId,
      remaining_usd: after?.remaining_usd ?? null,
    });
  } catch (err) {
    console.error(err);
    const cost = err.usage ? actualCost(model, err.usage) : err.reachedClaude === 'unknown' ? reserve : 0;
    await finish(gate.request_id, false, cost, err.usage || {}, model).catch((e) => console.error(e));
    return res.status(502).json({ error: `Couldn’t finish the review: ${err.message}.`, ...free });
  }
}
