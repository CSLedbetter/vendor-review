// Intake tiering. One place to change the rules, so they match a real TPRM program.
// Shared by the server (api/) and, through /api/check, the page.

export const DATA = {
  personal: 'Customer personal data',
  phi: 'Health data (PHI)',
  card: 'Payment card data',
  financial: 'Financial or bank data',
  secrets: 'Credentials or secrets',
  source: 'Source code',
  employee: 'Employee data',
  confidential: 'Confidential business data',
  none: 'None or public only',
};

export const ACCESS = {
  stores: 'Stores or processes our data',
  production: 'Connects to production systems',
  admin: 'SSO or admin access into our tools',
  network: 'Network-level access',
};

export const CRITICALITY = { low: 'Low', medium: 'Medium', high: 'High: an outage stops a core process' };
export const AI = { none: 'No AI on our data', features: 'AI features on our data', provider: 'The vendor is an AI model provider' };

const HIGH_DATA = ['phi', 'card', 'financial', 'secrets', 'source'];

export const TIERS = {
  1: { label: 'Tier 1 (high)', evidence: 'SOC 2 Type II or ISO 27001, plus a penetration test summary', months: 12, accepts: ['soc2_type2', 'iso27001'], needsPentest: true },
  2: { label: 'Tier 2 (medium)', evidence: 'SOC 2 Type II, SOC 2 Type I, or ISO 27001', months: 24, accepts: ['soc2_type2', 'soc2_type1', 'iso27001'] },
  3: { label: 'Tier 3 (low)', evidence: 'Any public attestation, such as a SOC 3 report or a trust page', months: 36, accepts: ['soc2_type2', 'soc2_type1', 'iso27001', 'soc3', 'trust_page'] },
};

// Keep only known values, so nothing else from the request reaches the tier logic or the prompt.
export function cleanIntake(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const s = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
  const pick = (list, keys) => (Array.isArray(list) ? [...new Set(list.filter((k) => keys.includes(k)))] : []);
  let data = pick(r.data, Object.keys(DATA));
  if (data.length > 1) data = data.filter((k) => k !== 'none');
  return {
    vendor: s(r.vendor, 80),
    service: s(r.service, 200),
    data,
    access: pick(r.access, Object.keys(ACCESS)),
    criticality: Object.hasOwn(CRITICALITY, r.criticality) ? r.criticality : 'medium',
    ai: Object.hasOwn(AI, r.ai) ? r.ai : 'none',
  };
}

export function tierFor(intake, today = new Date()) {
  const reasons = [];
  const highData = intake.data.filter((k) => HIGH_DATA.includes(k));
  if (highData.length) reasons.push(`Touches ${highData.map((k) => DATA[k].toLowerCase()).join(', ')}`);
  if (intake.access.includes('production')) reasons.push('Connects to production systems');
  if (intake.criticality === 'high' && intake.access.includes('stores')) reasons.push('High criticality and stores our data');

  let tier = 3;
  if (reasons.length) tier = 1;
  else {
    const someData = intake.data.filter((k) => k !== 'none');
    if (someData.length) reasons.push(`Touches ${someData.map((k) => DATA[k].toLowerCase()).join(', ')}`);
    if (intake.access.length) reasons.push(intake.access.map((k) => ACCESS[k]).join(', '));
    if (intake.ai !== 'none') reasons.push(AI[intake.ai]);
    if (reasons.length) tier = 2;
    else reasons.push('No sensitive data, access, or AI use on our data');
  }

  const t = TIERS[tier];
  const next = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + t.months, today.getUTCDate()));
  return { tier, label: t.label, reasons, evidence: t.evidence, review_months: t.months, next_review: next.toISOString().slice(0, 10) };
}
