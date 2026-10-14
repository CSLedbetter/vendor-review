import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import handler from '../api/review.js';
import check from '../api/check.js';
import { SCHEMA } from '../lib/prompt.js';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test';
process.env.ANTHROPIC_API_KEY = 'test';
const vendors = JSON.parse(readFileSync(new URL('../public/vendors.json', import.meta.url)));
const RESULT = {
  headline: 'Qualified opinion over access removal', decision: 'escalate', decision_reason: 'x', confidence: 'high',
  findings: [{ title: 'Late deprovisioning', severity: 'high', criteria: ['CC6.3', 'CC6.2'], why_it_matters: 'x', ask_vendor: 'y' }],
  conditions: [], cuec_actions: [{ control: 'Remove leavers', owner: 'IT' }], subservice_followups: ['Get GCP SOC 2'],
  ai_review: { summary: 'Not applicable', concerns: [] }, contract_terms: ['Breach notice within 72 hours'], vendor_questions: ['When was it fixed?'],
  security_memo: 'memo', business_summary: 'summary',
  risk_register: { risk_title: 'Vendor access control', description: 'd', likelihood: 'medium', impact: 'high', treatment: 'mitigate', owner: 'Security' },
};
let calls, gateReply;
const USER = '11111111-2222-4333-8444-555555555555';
beforeEach(() => {
  calls = [];
  gateReply = { ok: true, request_id: 9 };
  globalThis.fetch = async (url, opts) => {
    const body = opts.body ? JSON.parse(opts.body) : null;
    calls.push({ url, body });
    const json = (d, s = 200) => new Response(d === null ? '' : JSON.stringify(d), { status: s });
    if (url.endsWith('/auth/v1/user')) return opts.headers.Authorization === 'Bearer good-token-1234567890' ? json({ id: USER, email: 'tester@example.com' }) : json({}, 401);
    if (url.endsWith('/rpc/demo_begin_user')) return json(gateReply);
    if (url.endsWith('/rpc/demo_finish_call')) return json(null);
    if (url.endsWith('/rpc/demo_user_status')) return json({ status: 'approved', remaining_usd: 4.9 });
    if (url.includes('api.anthropic.com')) return new Response(JSON.stringify({ stop_reason: 'end_turn', model: 'claude-sonnet-5-5', usage: { input_tokens: 6000, output_tokens: 1500 }, content: [{ type: 'text', text: JSON.stringify(RESULT) }] }), { status: 200, headers: { 'request-id': 'req_test123' } });
    throw new Error(url);
  };
});
const call = (h, body, token = 'good-token-1234567890') => new Promise((resolve) => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { resolve({ status: this.statusCode, body: d }); } };
  h({ method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body }, res);
});
const relay = vendors.find((v) => v.id === 'VR-02');

test('reserves, calls Claude with tier and checks, settles, and returns the request ID', async () => {
  const r = await call(handler, { intake: relay.intake, text: relay.text, sample: relay.id });
  assert.equal(r.status, 200);
  const begin = calls.find((c) => c.url.endsWith('/rpc/demo_begin_user')).body;
  assert.equal(begin.p_tool, 'vendor-review');
  assert.equal(begin.p_ticket_id, 'VR-02');
  assert.ok(begin.p_max_cost_usd > 0.04 && begin.p_max_cost_usd < 0.1, `reserve ${begin.p_max_cost_usd}`);
  const sent = calls.find((c) => c.url.includes('anthropic')).body;
  assert.match(sent.messages[0].content, /Tier set by code: Tier 2/);
  assert.match(sent.messages[0].content, /\[FAIL\] Auditor’s opinion/);
  assert.equal(calls.find((c) => c.url.endsWith('/rpc/demo_finish_call')).body.p_cost_usd, 0.027);
  assert.equal(r.body.claude_request_id, 'req_test123');
  assert.deepEqual(r.body.result.findings[0].criteria.map((c) => c.id), ['CC6.3', 'CC6.2']);
  assert.match(r.body.result.findings[0].criteria[0].summary, /removed/);
  assert.equal(r.body.tier.tier, 2);
});

test('the schema only allows criteria IDs from the fixed list', () => {
  const ids = SCHEMA.properties.findings.items.properties.criteria.items.enum;
  assert.ok(ids.includes('CC6.1') && ids.includes('P8.1'));
  assert.ok(!ids.includes('CC10.1'));
});

test('signed out: 401 with the free checks, and no gate or Claude call', async () => {
  const r = await call(handler, { intake: relay.intake, text: relay.text }, null);
  assert.equal(r.status, 401);
  assert.ok(r.body.analysis.checks.some((c) => c.title === 'Auditor’s opinion' && c.status === 'fail'));
  assert.ok(!calls.some((c) => c.url.includes('/rpc/') || c.url.includes('anthropic')));
});

test('over the cap: free checks come back, Claude is not called', async () => {
  gateReply = { ok: false, reason: 'global_cap' };
  const r = await call(handler, { intake: relay.intake, text: relay.text });
  assert.equal(r.status, 402);
  assert.equal(r.body.tier.tier, 2);
  assert.ok(!calls.some((c) => c.url.includes('anthropic')));
});

test('secrets are removed before Claude sees the text', async () => {
  const text = `${relay.text}\nOur test key sk-ant-api03-abcdefghijklmnop and password: hunter2hunter2 and Authorization: Bearer abcdefghijklmnopqrstuv`;
  const r = await call(handler, { intake: relay.intake, text });
  const sent = calls.find((c) => c.url.includes('anthropic')).body.messages[0].content;
  assert.doesNotMatch(sent, /abcdefghijklmnop|hunter2|abcdefghijklmnopqrstuv/);
  assert.equal(r.body.redactions, 3);
});

test('a Claude failure settles at $0 and still returns the checks', async () => {
  const ok = globalThis.fetch;
  globalThis.fetch = async (url, opts) => (url.includes('anthropic') ? new Response(JSON.stringify({ error: { type: 'overloaded_error' } }), { status: 529 }) : ok(url, opts));
  const r = await call(handler, { intake: relay.intake, text: relay.text });
  assert.equal(r.status, 502);
  assert.ok(r.body.analysis);
  const fin = calls.find((c) => c.url.endsWith('/rpc/demo_finish_call')).body;
  assert.equal(fin.p_ok, false);
  assert.equal(fin.p_cost_usd, 0);
});

test('input validation', async () => {
  assert.equal((await call(check, { intake: { vendor: '' }, text: relay.text })).status, 400);
  assert.equal((await call(check, { intake: relay.intake, text: 'too short' })).status, 400);
  assert.equal((await call(check, { intake: relay.intake, text: 'x'.repeat(30001) })).status, 400);
  const ok = await call(check, { intake: relay.intake, text: relay.text }, null);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.tier.tier, 2);
  assert.ok(!calls.length, 'the free check makes no outside calls');
});
