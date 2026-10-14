// Reads pasted vendor assurance text (SOC 2, SOC 3, ISO 27001 certificate, trust page) with code,
// before Claude sees anything. Everything here is deterministic, free, and unit tested.

import { CATEGORIES, normalizeId } from './criteria.js';
import { TIERS, DATA } from './tiers.js';

export const KIND_LABEL = {
  soc2_type2: 'SOC 2 Type II report',
  soc2_type1: 'SOC 2 Type I report',
  soc3: 'SOC 3 report',
  iso27001: 'ISO 27001 certificate',
  trust_page: 'Trust page or security overview',
  unknown: 'Unknown document type',
};

// ---------- dates ----------
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MON = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?';
export const DATE = `(?:${MON}\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}|\\d{1,2}(?:st|nd|rd|th)?\\s+${MON},?\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\/\\d{1,2}\\/\\d{4})`;

export function parseDate(s) {
  if (!s) return null;
  const t = s.trim().replace(/(\d)(st|nd|rd|th)/, '$1').replace(/,/g, '').replace(/\./g, '');
  let y, m, d;
  let x;
  if ((x = t.match(/^(\d{4})-(\d{2})-(\d{2})$/))) [y, m, d] = [+x[1], +x[2], +x[3]];
  else if ((x = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) [y, m, d] = [+x[3], +x[1], +x[2]]; // US style
  else if ((x = t.match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/))) [y, m, d] = [+x[3], MONTHS.indexOf(x[1].slice(0, 3).toLowerCase()) + 1, +x[2]];
  else if ((x = t.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/))) [y, m, d] = [+x[3], MONTHS.indexOf(x[2].slice(0, 3).toLowerCase()) + 1, +x[1]];
  else return null;
  if (!m || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 ? date.toISOString().slice(0, 10) : null;
}

const monthsBetween = (iso, today) => (today - new Date(`${iso}T00:00:00Z`)) / (1000 * 60 * 60 * 24 * 30.44);

// ---------- detection ----------
export function detectKind(text) {
  const head = text.slice(0, 500);
  if (/\bSOC\s*3\b/i.test(head)) return 'soc3';
  if (/\bSOC\s*2\b[^\n]{0,60}\bType\s*(II|2)\b|\bType\s*(II|2)\s+(SOC\s*2\s+)?report\b/i.test(text)) return 'soc2_type2';
  if (/\bSOC\s*2\b[^\n]{0,60}\bType\s*(I|1)\b|\bType\s*(I|1)\s+(SOC\s*2\s+)?report\b/i.test(text)) return 'soc2_type1';
  if (/\bSOC\s*3\b/i.test(text)) return 'soc3';
  if (/ISO\/?\s?IEC\s*27001/i.test(text) && /certif/i.test(text)) return 'iso27001';
  if (/\b(trust (center|portal|page)|security (overview|page|practices)|we encrypt|encrypted at rest)\b/i.test(text)) return 'trust_page';
  return 'unknown';
}

// ---------- facts ----------
const PROVIDERS = [
  ['Amazon Web Services', /\b(Amazon Web Services|AWS)\b/],
  ['Google Cloud', /\b(Google Cloud(?: Platform)?|GCP)\b/],
  ['Microsoft Azure', /\bAzure\b(?!\s+OpenAI)/],
  ['Snowflake', /\bSnowflake\b/],
  ['Stripe', /\bStripe\b/],
  ['Twilio', /\bTwilio\b/],
  ['Cloudflare', /\bCloudflare\b/],
  ['MongoDB Atlas', /\bMongoDB\b/],
  ['Datadog', /\bDatadog\b/],
  ['Okta', /\bOkta\b/],
  ['Salesforce', /\bSalesforce\b/],
  ['Heroku', /\bHeroku\b/],
  ['Equinix', /\bEquinix\b/],
  ['OpenAI', /\bOpenAI\b/],
  ['Anthropic', /\bAnthropic\b/],
];
const AI_PROVIDERS = [
  ['OpenAI', /\b(Azure )?OpenAI\b/], ['Anthropic', /\bAnthropic\b|\bClaude\b/], ['Google Gemini', /\bGemini\b|\bVertex AI\b/],
  ['AWS Bedrock', /\bBedrock\b/], ['Cohere', /\bCohere\b/], ['Mistral', /\bMistral\b/], ['Meta Llama', /\bLlama\b/],
];

const sentences = (text) => text.replace(/[ \t]*\n[ \t]*/g, '\n').split(/(?<=[.!?])\s+|\n(?=[-•*\d])|\n{2,}/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);

function findPeriod(text) {
  const range = new RegExp(`(?:period|from)\\s+(?:of\\s+|from\\s+|beginning\\s+)?(${DATE})\\s*(?:to|through|thru|until|-|–|—|and ending)\\s*(${DATE})`, 'i');
  const m = text.match(range);
  if (m) return { start: parseDate(m[1]), end: parseDate(m[2]), as_of: null };
  const asOf = text.match(new RegExp(`\\bas of\\s+(${DATE})`, 'i'));
  if (asOf) return { start: null, end: null, as_of: parseDate(asOf[1]) };
  return { start: null, end: null, as_of: null };
}

function findOpinion(text) {
  if (/do not express an opinion|disclaimer of opinion/i.test(text)) return 'disclaimer';
  if (/adverse opinion/i.test(text)) return 'adverse';
  if (/\bexcept for the (matter|matters|effects?)\b|qualified opinion/i.test(text)) return 'qualified';
  if (/in all material respects/i.test(text)) return 'unmodified';
  return null;
}

function findAuditor(text) {
  const m = text.match(/\b([A-Z][A-Za-z&.'-]*(?:[ \t]+(?:&[ \t]+)?[A-Z][A-Za-z&.'-]*){0,4},?[ \t]+(?:LLP|LLC|P\.C\.|CPAs(?:, LLC)?))(?![\w])/)
    || text.match(/(?:certification body|certified by|issued by|audit(?:ed)? by)\s*[:-]?\s*([A-Z][^\n,;]{2,60})/i);
  return m ? m[1].trim() : null;
}

function findCategories(text) {
  const found = new Set();
  const re = /trust services (criteria|categor\w*)|categories in scope|in-scope categories/gi;
  let m;
  while ((m = re.exec(text))) {
    const win = text.slice(Math.max(0, m.index - 160), m.index + 260);
    for (const c of CATEGORIES) if (new RegExp(`\\b${c}\\b`, 'i').test(win)) found.add(c);
  }
  return CATEGORIES.filter((c) => found.has(c));
}

function findSystem(text) {
  const m = text.match(/description of (?:its |the |their )?([A-Z][\w&'’ -]{2,80}?) (?:system|services|platform)\b/i)
    || text.match(/(?:system description|services provided)\s*[:-]\s*([^\n]{5,200})/i);
  return m ? m[1].trim() : null;
}

function findSubservice(text) {
  const out = [];
  const list = sentences(text);
  list.forEach((s, i) => {
    if (!/subservice|sub-service|carve[- ]?out|carved out|inclusive method/i.test(s)) return;
    const how = (x) => (/inclusive/i.test(x) ? 'inclusive' : /carve|carved|excluded? from|not included/i.test(x) ? 'carved out' : null);
    const method = how(s) || how(list[i + 1] || '') || 'not stated';
    for (const [name, re] of PROVIDERS) {
      if (re.test(s) && !out.some((o) => o.name === name)) out.push({ name, method });
    }
    const named = s.match(/subservice organization\s*[:-]\s*([A-Z][\w.&-]*(?:\s+[A-Z][\w.&-]*){0,3})/i);
    if (named && !PROVIDERS.some(([, re]) => re.test(named[1])) && !out.some((o) => o.name === named[1])) out.push({ name: named[1], method });
  });
  return out;
}

function findCuecs(text) {
  const at = text.search(/complementary user[- ]entity controls/i);
  if (at < 0) return [];
  const lines = text.slice(at).split('\n').slice(1);
  const out = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { if (out.length) break; continue; }
    if (/^(section\b|complementary subservice|[A-Z][A-Z &]{6,}$)/i.test(line) && out.length) break;
    if (/^(?:[-•*]|\d+[.)])\s+/.test(line) || /^user entities (are|should)/i.test(line)) out.push(line.replace(/^(?:[-•*]|\d+[.)])\s+/, '').slice(0, 300));
    if (out.length >= 25) break;
  }
  return out;
}

function findExceptions(text) {
  const lines = text.split('\n');
  const out = [];
  lines.forEach((line, i) => {
    if (/\bno (exceptions|deviations) (were )?noted\b/i.test(line)) return;
    if (!/\b(exceptions?|deviations?) (were )?noted\b|\b(exception|deviation)\s*:/i.test(line)) return;
    const near = [line, ...lines.slice(Math.max(0, i - 3), i).reverse()];
    let ids = [];
    for (const l of near) {
      ids = [...l.matchAll(/\b(CC|PI|A|C|P)\s?(\d)\.(\d)\b/g)].map((m) => normalizeId(m[0])).filter(Boolean);
      if (ids.length) break;
    }
    const after = lines.slice(i + 1, i + 7).join('\n');
    const resp = after.match(/management(?:'s|’s)? response\s*[:-]?\s*([^\n]{5,400})/i);
    out.push({
      criteria: [...new Set(ids)],
      detail: line.replace(/\s*\|\s*/g, ' | ').replace(/\s+/g, ' ').trim().slice(0, 400),
      management_response: resp ? resp[1].trim() : null,
    });
  });
  return out;
}

function findIso(text) {
  const num = text.match(/certificate\s*(?:no\.?|number|#|id)\s*[:-]?\s*([A-Z0-9][A-Z0-9/-]{3,})/i);
  const exp = text.match(new RegExp(`(?:expir(?:y|es|ation)(?:\\s+date)?|valid\\s+(?:until|through|to)|expiry)\\s*[:-]?\\s*(${DATE})`, 'i'));
  const body = text.match(/(?:certification body|certified by|issued by)\s*[:-]?\s*([^\n]{3,80})/i);
  const scope = text.match(/scope(?:\s+of\s+(?:the\s+)?certification)?\s*[:-]\s*([^\n]{10,400})/i);
  return {
    certificate_number: num ? num[1] : null,
    expires: exp ? parseDate(exp[1]) : null,
    certification_body: body ? body[1].trim() : null,
    scope: scope ? scope[1].trim() : null,
  };
}

function findPentest(text) {
  const m = text.match(new RegExp(`penetration test[^\\n.]{0,160}?(${DATE})`, 'i'));
  if (m) return { mentioned: true, date: parseDate(m[1]) };
  return { mentioned: /penetration test|pen test|pentest/i.test(text), date: null };
}

function findAi(text) {
  const out = { training: null, opt_out: false, statements: [], retention: [], providers: [] };
  for (const s of sentences(text)) {
    const aiWord = /\b(models?|AI|artificial intelligence|machine learning|LLMs?)\b/i.test(s);
    const dataWord = /\b(customer|your|user|client)\s+(data|content|inputs?|prompts?|recordings?|transcripts?)\b/i.test(s);
    if (aiWord && dataWord && /\b(train\w*|fine-tun\w*|improv\w*)\b/i.test(s)) {
      const neg = /\b(do(?:es)? not|never|will not|won['’]t|isn['’]t|is not|are not)\b[^.]{0,40}\b(use|train|used)/i.test(s);
      if (neg) { if (out.training === null) out.training = false; }
      else { out.training = true; if (/opt[- ]?out|turn (?:it )?off|disable|setting/i.test(s)) out.opt_out = true; }
      out.statements.push(s.slice(0, 300));
    }
    const r = s.match(/\b(retain\w*|retention|stored? for|delete\w* after|kept for|keep \w+ for)\b[^.]{0,80}?\b(\d+)\s*(days?|months?|years?)/i);
    if (r) out.retention.push(`${r[2]} ${r[3]}: ${s.slice(0, 200)}`);
  }
  for (const [name, re] of AI_PROVIDERS) if (re.test(text)) out.providers.push(name);
  out.retention = out.retention.slice(0, 5);
  out.statements = out.statements.slice(0, 5);
  return out;
}

export function extract(text) {
  const kind = detectKind(text);
  const ids = [...new Set([...text.matchAll(/\b(CC|PI|A|C|P)\s?(\d)\.(\d)\b/g)].map((m) => normalizeId(m[0])).filter(Boolean))];
  return {
    kind,
    auditor: findAuditor(text),
    opinion: findOpinion(text),
    period: findPeriod(text),
    categories: findCategories(text),
    system: findSystem(text),
    subservice: findSubservice(text),
    cuecs: findCuecs(text),
    exceptions: findExceptions(text),
    no_exceptions_statements: (text.match(/\bno (exceptions|deviations) (were )?noted\b/gi) || []).length,
    criteria_mentioned: ids,
    bridge_letter: /\b(bridge|gap) letter\b/i.test(text),
    iso: kind === 'iso27001' || /ISO\/?\s?IEC\s*27001/i.test(text) ? findIso(text) : null,
    pentest: findPentest(text),
    ai: findAi(text),
  };
}

// ---------- checks ----------
const an = (label) => `${/^[AEIOU]/.test(label) ? 'An' : 'A'} ${label}`;
const STOP = new Set(['service', 'services', 'platform', 'software', 'tool', 'tools', 'system', 'with', 'from', 'that', 'this', 'their', 'for', 'and', 'the', 'our', 'into', 'app', 'apps', 'online', 'based', 'cloud', 'saas', 'solution', 'vendor']);

export function review(intake, tier, text, today = new Date()) {
  const f = extract(text);
  const checks = [];
  const add = (status, title, detail) => checks.push({ status, title, detail });
  const t = TIERS[tier.tier];
  const soc = f.kind.startsWith('soc');

  // Evidence against the tier
  if (f.kind === 'unknown') add('info', 'Document type', 'Couldn’t tell what this is. Paste a SOC 2 or SOC 3 report, an ISO 27001 certificate, or a trust page.');
  else if (tier.tier === 1 && f.kind === 'soc2_type1') add('warn', 'Evidence for the tier', 'A Type I report only shows controls were designed on one date, not that they worked over time. Tier 1 expects a Type II.');
  else if (t.accepts.includes(f.kind)) add('pass', 'Evidence for the tier', `${an(KIND_LABEL[f.kind])} meets ${tier.label}.`);
  else add('fail', 'Evidence for the tier', `${an(KIND_LABEL[f.kind])} alone doesn’t meet ${tier.label}, which expects ${t.evidence.charAt(0).toLowerCase()}${t.evidence.slice(1)}.`);
  if (tier.tier === 2 && f.kind === 'soc2_type1') add('warn', 'Type I report', 'Design only, at one point in time. Ask when their Type II will be ready.');
  if (t.needsPentest) {
    if (f.pentest.mentioned) add('pass', 'Penetration test', f.pentest.date ? `Mentions a penetration test dated ${f.pentest.date}.` : 'Mentions a penetration test. Ask for the summary letter.');
    else add('warn', 'Penetration test', 'No penetration test found. Tier 1 expects a recent summary from the vendor.');
  }

  // Opinion
  if (soc) {
    if (f.opinion === 'unmodified') add('pass', 'Auditor’s opinion', `Unmodified (clean)${f.auditor ? `, from ${f.auditor}` : ''}.`);
    else if (f.opinion === 'qualified') add('fail', 'Auditor’s opinion', `Qualified: the auditor says “except for” a problem${f.auditor ? ` (${f.auditor})` : ''}. Read what it covers.`);
    else if (f.opinion === 'adverse') add('fail', 'Auditor’s opinion', 'Adverse: the auditor found controls were not effective.');
    else if (f.opinion === 'disclaimer') add('fail', 'Auditor’s opinion', 'Disclaimer: the auditor couldn’t form an opinion.');
    else add('info', 'Auditor’s opinion', 'No opinion paragraph found in what was pasted.');
  }

  // Freshness
  if (soc) {
    const end = f.period.end || f.period.as_of;
    if (!end) add('info', 'Report freshness', 'No report period found.');
    else {
      const age = monthsBetween(end, today);
      const span = f.period.start ? `${f.period.start} to ${end}` : `as of ${end}`;
      if (age > 12 && !f.bridge_letter) add('fail', 'Report freshness', `Period ${span} ended ${Math.floor(age)} months ago, with no bridge letter. Ask for the current report or a bridge letter.`);
      else if (age > 12) add('warn', 'Report freshness', `Period ${span} ended ${Math.floor(age)} months ago. A bridge letter is mentioned; check it covers the gap to today.`);
      else if (age > 9) add('warn', 'Report freshness', `Period ${span} ended ${Math.floor(age)} months ago. A new report should be close; ask when.`);
      else add('pass', 'Report freshness', `Period ${span} (${Math.max(0, Math.floor(age))} months ago).`);
    }
  }

  // ISO certificate
  if (f.iso) {
    if (!f.iso.expires) add('info', 'ISO certificate expiry', 'No expiry date found.');
    else if (new Date(`${f.iso.expires}T00:00:00Z`) < today) add('fail', 'ISO certificate expiry', `Expired on ${f.iso.expires}. Ask for the renewed certificate.`);
    else add('pass', 'ISO certificate expiry', `Valid until ${f.iso.expires}.`);
  }

  // Categories in scope
  if (soc) {
    if (!f.categories.length) add('info', 'Categories in scope', 'Couldn’t find which Trust Services Categories are covered.');
    else {
      const missing = [];
      if (intake.criticality === 'high' && !f.categories.includes('Availability')) missing.push('Availability (this vendor is high criticality)');
      if (intake.data.includes('confidential') && !f.categories.includes('Confidentiality')) missing.push('Confidentiality (it touches confidential business data)');
      if ((intake.data.includes('personal') || intake.data.includes('phi')) && !f.categories.includes('Privacy')) missing.push('Privacy (it touches personal or health data)');
      if (missing.length) add('warn', 'Categories in scope', `Covers ${f.categories.join(', ')}. Not covered: ${missing.join('; ')}.`);
      else add('pass', 'Categories in scope', `Covers ${f.categories.join(', ')}.`);
    }
  }

  // Scope match
  if (intake.service) {
    const words = [...new Set(intake.service.toLowerCase().match(/[a-z][a-z-]{3,}/g) || [])].filter((w) => !STOP.has(w));
    const lower = text.toLowerCase();
    const hit = words.filter((w) => lower.includes(w.replace(/s$/, '')));
    const scopeText = f.iso?.scope || f.system;
    if (!words.length) add('info', 'Scope match', 'The service description is too general to check against the report.');
    else if (hit.length) add('pass', 'Scope match', `The document mentions ${hit.slice(0, 3).map((w) => `“${w}”`).join(', ')} from the service you’re buying.`);
    else add('warn', 'Scope match', `Nothing about “${intake.service}” appears in the document${scopeText ? ` (scope: ${scopeText.slice(0, 120)})` : ''}. Confirm the report covers what you’re buying.`);
  }

  // Exceptions
  if (f.exceptions.length) {
    for (const e of f.exceptions) {
      const key = e.criteria.some((id) => /^CC[67]\./.test(id)) && tier.tier <= 2;
      add(key ? 'fail' : 'warn', `Exception${e.criteria.length ? ` in ${e.criteria.join(', ')}` : ''}`,
        `${e.detail}${e.management_response ? ` Management response: ${e.management_response}` : ' No management response found.'}`);
    }
  } else if (f.kind === 'soc2_type2' && f.no_exceptions_statements) {
    add('pass', 'Exceptions', `No exceptions found in the test results (${f.no_exceptions_statements} “no exceptions noted”).`);
  }

  // Subservice orgs and CUECs
  for (const s of f.subservice) {
    add('info', `Subservice: ${s.name}`, s.method === 'carved out'
      ? 'Carved out, so their controls aren’t tested in this report. Get and review their own SOC 2.'
      : s.method === 'inclusive' ? 'Included in this report’s testing.' : 'Named as a subservice organization; method not stated.');
  }
  if (f.cuecs.length) add('info', 'Controls you own (CUECs)', `${f.cuecs.length} complementary user entity control${f.cuecs.length === 1 ? '' : 's'}. Your team has to run these for the vendor’s controls to work.`);

  // AI
  const ai = f.ai;
  if (intake.ai !== 'none') {
    if (ai.training === true && !ai.opt_out) add('fail', 'AI training on your data', 'The vendor says it uses customer data to train or improve its models, and no opt-out is mentioned.');
    else if (ai.training === true) add('warn', 'AI training on your data', 'Customer data is used to train or improve models unless you opt out. Make the opt-out a contract term.');
    else if (ai.training === false) add('pass', 'AI training on your data', 'The vendor says customer data isn’t used to train models.');
    else add('warn', 'AI training on your data', 'No statement about training on customer data was found. Ask directly.');
    if (!ai.retention.length) add('warn', 'Data retention', 'No retention period found for your data or AI inputs.');
  } else if (ai.training === true || ai.providers.length) {
    add('warn', 'AI use not in intake', `The document mentions ${ai.providers.length ? ai.providers.join(', ') : 'training models on customer data'}, but the intake says no AI on your data. Check which is right.`);
  }
  for (const r of ai.retention) add('info', 'Retention', r);

  return { kind: f.kind, kind_label: KIND_LABEL[f.kind], facts: f, checks };
}

export function intakeSummary(intake) {
  return {
    vendor: intake.vendor,
    service: intake.service || null,
    data: intake.data.map((k) => DATA[k]),
    access: intake.access,
    criticality: intake.criticality,
    ai: intake.ai,
  };
}
