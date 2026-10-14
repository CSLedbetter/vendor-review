import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseDate, extract, review, detectKind } from '../lib/parse.js';
import { cleanIntake, tierFor } from '../lib/tiers.js';
import { normalizeId, CRITERIA_IDS } from '../lib/criteria.js';

const TODAY = new Date('2026-10-13T00:00:00Z');
const intake = (o = {}) => cleanIntake({ vendor: 'Test Co', data: [], access: [], criticality: 'medium', ai: 'none', ...o });

test('every date format in the spec parses', () => {
  assert.equal(parseDate('June 30, 2026'), '2026-06-30');
  assert.equal(parseDate('Jun 30 2026'), '2026-06-30');
  assert.equal(parseDate('30 June 2026'), '2026-06-30');
  assert.equal(parseDate('2026-06-30'), '2026-06-30');
  assert.equal(parseDate('06/30/2026'), '2026-06-30');
  assert.equal(parseDate('September 1st, 2025'), '2025-09-01');
  assert.equal(parseDate('February 30, 2026'), null);
  assert.equal(parseDate('13/45/2026'), null);
});

test('tier rules', () => {
  assert.equal(tierFor(intake({ data: ['phi'] }), TODAY).tier, 1);
  assert.equal(tierFor(intake({ data: ['secrets'] }), TODAY).tier, 1);
  assert.equal(tierFor(intake({ access: ['production'] }), TODAY).tier, 1);
  assert.equal(tierFor(intake({ criticality: 'high', access: ['stores'] }), TODAY).tier, 1);
  assert.equal(tierFor(intake({ criticality: 'high' }), TODAY).tier, 3);
  assert.equal(tierFor(intake({ data: ['personal'] }), TODAY).tier, 2);
  assert.equal(tierFor(intake({ access: ['admin'] }), TODAY).tier, 2);
  assert.equal(tierFor(intake({ ai: 'features' }), TODAY).tier, 2);
  assert.equal(tierFor(intake({ data: ['none'] }), TODAY).tier, 3);
  const t = tierFor(intake({ data: ['card'] }), TODAY);
  assert.equal(t.next_review, '2027-10-13');
  assert.match(t.reasons[0], /payment card data/);
  assert.equal(tierFor(intake(), TODAY).next_review, '2029-10-13');
});

test('intake cleaning drops unknown values and "none" next to real data', () => {
  const i = cleanIntake({ vendor: '  A\nB  ', data: ['none', 'personal', 'bogus', 'personal'], access: ['root'], criticality: 'extreme', ai: 'x' });
  assert.deepEqual(i.data, ['personal']);
  assert.deepEqual(i.access, []);
  assert.equal(i.vendor, 'A B');
  assert.equal(i.criticality, 'medium');
  assert.equal(i.ai, 'none');
});

test('document type detection', () => {
  assert.equal(detectKind('Acme SOC 2 Type II Report'), 'soc2_type2');
  assert.equal(detectKind('Acme SOC 2 Type 1 report'), 'soc2_type1');
  assert.equal(detectKind('Acme SOC 3 Report, based on our SOC 2 Type II'), 'soc3');
  assert.equal(detectKind('certified to ISO/IEC 27001:2022'), 'iso27001');
  assert.equal(detectKind('Our trust center: all data is encrypted at rest'), 'trust_page');
  assert.equal(detectKind('hello world, this is a grocery list'), 'unknown');
});

test('opinion detection', () => {
  assert.equal(extract('In our opinion, in all material respects, it presents fairly').opinion, 'unmodified');
  assert.equal(extract('In our opinion, except for the matter described above, in all material respects').opinion, 'qualified');
  assert.equal(extract('Adverse opinion. Controls were not effective').opinion, 'adverse');
  assert.equal(extract('We do not express an opinion').opinion, 'disclaimer');
  assert.equal(extract('nothing here').opinion, null);
});

test('exceptions: "no exceptions noted" is not an exception, and criteria come from the row above', () => {
  const f = extract(`CC6.1 | MFA | Inspected | No exceptions noted.
CC6.3 | Terminations removed in 1 day
Inspected 25 | Exception noted: 4 of 25 were late.
Management's response: we automated deprovisioning.
A1.2 | Backups | Deviation noted: one failed backup was not rerun.`);
  assert.equal(f.exceptions.length, 2);
  assert.deepEqual(f.exceptions[0].criteria, ['CC6.3']);
  assert.match(f.exceptions[0].management_response, /automated/);
  assert.deepEqual(f.exceptions[1].criteria, ['A1.2']);
  assert.equal(f.exceptions[1].management_response, null);
  assert.equal(f.no_exceptions_statements, 1);
});

test('carve-out and inclusive subservice organizations', () => {
  const f = extract(`Subservice organizations
Acme uses Amazon Web Services for hosting. The carve-out method was used.
Acme uses Okta for identity under the inclusive method.`);
  assert.deepEqual(f.subservice, [{ name: 'Amazon Web Services', method: 'carved out' }, { name: 'Okta', method: 'inclusive' }]);
});

test('ISO certificate expiry', () => {
  const text = 'Certified to ISO/IEC 27001:2022\nCertificate No: ABC-1234\nValid until: 01/15/2026\nScope: payroll platform';
  const r = review(intake({ data: ['personal'] }), tierFor(intake({ data: ['personal'] }), TODAY), text, TODAY);
  assert.equal(r.facts.iso.certificate_number, 'ABC-1234');
  assert.equal(r.checks.find((c) => c.title === 'ISO certificate expiry').status, 'fail');
});

test('AI signals: training, negation, opt-out, retention, providers', () => {
  assert.equal(extract('We may use customer content to train our AI models.').ai.training, true);
  assert.equal(extract('We do not use customer data to train our models.').ai.training, false);
  const o = extract('Customer data may be used to improve our models unless you opt out in settings.').ai;
  assert.equal(o.training, true);
  assert.equal(o.opt_out, true);
  const r = extract('Inputs are retained for 30 days. Summaries use Anthropic and Azure OpenAI.').ai;
  assert.match(r.retention[0], /^30 days/);
  assert.deepEqual(r.providers, ['OpenAI', 'Anthropic']);
});

test('freshness: stale with and without a bridge letter', () => {
  const t = tierFor(intake({ data: ['personal'] }), TODAY);
  const stale = 'SOC 2 Type II report for the period January 1, 2024 to December 31, 2024. In all material respects.';
  assert.equal(review(intake(), t, stale, TODAY).checks.find((c) => c.title === 'Report freshness').status, 'fail');
  assert.equal(review(intake(), t, `${stale} A bridge letter covers the gap.`, TODAY).checks.find((c) => c.title === 'Report freshness').status, 'warn');
  assert.equal(review(intake(), t, 'SOC 2 Type II report. In all material respects.', TODAY).checks.find((c) => c.title === 'Report freshness').status, 'info');
});

test('criteria IDs normalize and stay inside the fixed list', () => {
  assert.equal(normalizeId('cc 6.2'), 'CC6.2');
  assert.equal(normalizeId('CC9.9'), null);
  assert.equal(CRITERIA_IDS.length, 61);
});

test('each sample matches data/expected.json', () => {
  const vendors = JSON.parse(fs.readFileSync(new URL('../public/vendors.json', import.meta.url)));
  const expected = JSON.parse(fs.readFileSync(new URL('../data/expected.json', import.meta.url)));
  assert.equal(vendors.length, 8);
  for (const v of vendors) {
    const i = cleanIntake(v.intake);
    const t = tierFor(i, TODAY);
    assert.equal(t.tier, expected[v.id].tier, `${v.id} tier`);
    const r = review(i, t, v.text, TODAY);
    for (const [status, title] of expected[v.id].checks) {
      assert.ok(r.checks.some((c) => c.status === status && c.title.startsWith(title)), `${v.id} should have ${status} ${title}`);
    }
  }
});
