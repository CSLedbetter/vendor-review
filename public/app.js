// Everything is rendered with textContent, so nothing pasted or returned can inject markup.
const $ = (id) => document.getElementById(id);
const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);
const state = { sample: null, tiers: null, last: null };
const MAX = 30000;
const MIN = 50;

// ---------- intake form ----------
async function buildIntake() {
  // The same tier rules the server uses (lib/tiers.js, copied to public/ and kept identical by a test).
  state.tiers = await import('/tiers.js');
  const { DATA, ACCESS, CRITICALITY, AI } = state.tiers;
  const box = (group, key, label, type = 'checkbox') => {
    const id = `${group}-${key}`;
    const wrap = el('label', { className: 'opt', htmlFor: id });
    wrap.append(el('input', { type, id, name: group, value: key }), el('span', { textContent: label }));
    return wrap;
  };
  $('data').append(...Object.entries(DATA).map(([k, v]) => box('data', k, v)));
  $('access').append(...Object.entries(ACCESS).map(([k, v]) => box('access', k, v)));
  $('criticality').append(...Object.entries(CRITICALITY).map(([k, v]) => box('criticality', k, v, 'radio')));
  $('ai').append(...Object.entries(AI).map(([k, v]) => box('ai', k, v, 'radio')));
  document.querySelectorAll('.opts input, #vendor, #service').forEach((i) => i.addEventListener('input', onEdit));
  // "None or public only" and real data types can't both be checked.
  $('data').addEventListener('change', (e) => {
    if (!e.target.checked) return;
    if (e.target.value === 'none') $('data').querySelectorAll('input').forEach((i) => { if (i.value !== 'none') i.checked = false; });
    else $('data-none').checked = false;
  });
  setIntake({});
}

function getIntake() {
  const vals = (name) => [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);
  return {
    vendor: $('vendor').value.trim(),
    service: $('service').value.trim(),
    data: vals('data'),
    access: vals('access'),
    criticality: vals('criticality')[0] || 'medium',
    ai: vals('ai')[0] || 'none',
  };
}

function setIntake(i) {
  $('vendor').value = i.vendor || '';
  $('service').value = i.service || '';
  document.querySelectorAll('.opts input').forEach((x) => {
    if (x.name === 'data') x.checked = (i.data || []).includes(x.value);
    else if (x.name === 'access') x.checked = (i.access || []).includes(x.value);
    else if (x.name === 'criticality') x.checked = x.value === (i.criticality || 'medium');
    else if (x.name === 'ai') x.checked = x.value === (i.ai || 'none');
  });
  refresh();
}

function showTier() {
  if (!state.tiers) return;
  const t = state.tiers.tierFor(state.tiers.cleanIntake(getIntake()));
  const box = $('tier-preview');
  box.className = `tier-preview t${t.tier}`;
  box.replaceChildren(
    el('b', { textContent: t.label }),
    el('span', { textContent: t.reasons.join('; ') }),
    el('span', { className: 'small', textContent: `Expected evidence: ${t.evidence}. Next review due ${t.next_review}.` }),
  );
}

// ---------- samples ----------
function sampleButton(s) {
  const b = el('button', { type: 'button', className: 'ticket' });
  b.setAttribute('aria-pressed', 'false');
  b.append(el('span', { className: 't-id', textContent: `${s.id} · fictional` }), el('span', { className: 't-sub', textContent: s.name }), el('span', { className: 't-who', textContent: s.summary }));
  b.addEventListener('click', () => {
    document.querySelectorAll('.ticket').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    state.sample = s;
    setIntake(s.intake);
    $('input').value = s.text;
    chip(`${s.id}: ${s.name}`);
    refresh();
    if (window.matchMedia('(max-width: 860px)').matches) $('intake-h').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  return b;
}

async function loadQueue() {
  let list = [];
  try { list = await (await fetch('/vendors.json')).json(); } catch { /* empty queue */ }
  for (const s of list) { const li = el('li'); li.append(sampleButton(s)); $('tickets').append(li); }
}

function chip(text) { $('ticket-chip').textContent = text; $('ticket-chip').hidden = !text; }

// Once the visitor changes a sample, it's their own input.
function onEdit() {
  const s = state.sample;
  if (s && ($('input').value !== s.text || JSON.stringify(state.tiers.cleanIntake(getIntake())) !== JSON.stringify(state.tiers.cleanIntake(s.intake)))) {
    state.sample = null;
    document.querySelectorAll('.ticket').forEach((x) => x.setAttribute('aria-pressed', 'false'));
  }
  if (!state.sample) chip($('input').value.trim() || $('vendor').value.trim() ? 'Your own input' : '');
  refresh();
}

function refresh() {
  $('count').textContent = `${$('input').value.length.toLocaleString()} / 30,000`;
  showTier();
  const ready = $('vendor').value.trim().length > 0 && $('input').value.trim().length >= MIN;
  $('check-only').disabled = !ready;
  const approved = Boolean(window.DemoAuth?.approved);
  $('explain').disabled = !approved || !ready;
  $('explain').title = approved ? '' : 'Sign in and get approved to run live reviews';
  $('vendor').setAttribute('aria-invalid', String(!$('vendor').value.trim() && $('input').value.trim().length > 0));
}

$('input').addEventListener('input', onEdit);
$('use-own').addEventListener('click', () => {
  $('clear').click();
  $('own').open = true;
  chip('Your own input');
  $('own').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  $('vendor').focus();
});
$('clear').addEventListener('click', () => {
  state.sample = null;
  $('input').value = '';
  setIntake({});
  chip('');
  document.querySelectorAll('.ticket').forEach((x) => x.setAttribute('aria-pressed', 'false'));
  $('vendor').focus();
});

// ---------- calls ----------
async function post(path, signedIn) {
  const headers = { 'content-type': 'application/json' };
  if (signedIn) headers.authorization = `Bearer ${window.DemoAuth.token()}`;
  const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify({ intake: getIntake(), text: $('input').value, sample: state.sample?.id || null }) });
  const body = await res.json().catch(() => ({ error: 'The server sent back something unexpected.' }));
  return { ok: res.ok, status: res.status, body };
}

function showLoading(msg) {
  const out = $('result');
  out.hidden = false; out.className = 'panel result loading';
  out.replaceChildren(el('p', { textContent: msg }));
}
function showError(msg, body) {
  const out = $('result');
  out.className = 'panel result';
  out.replaceChildren(el('p', { className: 'error', textContent: msg }));
  if (body?.analysis) out.append(checksBlock(body.tier, body.analysis));
}

const runKey = () => window.RunCache.key({ tool: 'vendor', intake: state.tiers.cleanIntake(getIntake()), text: $('input').value });

$('check-only').addEventListener('click', async () => {
  showLoading('Tiering the vendor and checking the evidence…');
  try {
    const r = await post('/api/check', false);
    if (!r.ok) throw new Error(r.body.error || `Request failed (${r.status}).`);
    const out = $('result');
    out.className = 'panel result';
    out.replaceChildren(checksBlock(r.body.tier, r.body.analysis));
    const saved = window.RunCache.get(await runKey());
    if (saved) {
      const note = el('p', { className: 'saved-note' });
      const show = el('button', { type: 'button', className: 'link', textContent: 'Show saved review' });
      show.addEventListener('click', () => render(saved.data, saved));
      note.append(el('span', { textContent: `You already have a Claude review for this exact intake and text from ${window.RunCache.time(saved.savedAt)}. ` }), show);
      out.prepend(note);
    }
  } catch (err) { showError(err.message); }
});

let running = false;
async function explain(fresh) {
  if (running) return;
  const k = await runKey();
  const saved = !fresh && window.RunCache.get(k);
  if (saved) return render(saved.data, saved);
  running = true;
  showLoading('Running the checks, then asking Claude for the review. This takes about 20 to 40 seconds…');
  $('explain').disabled = true;
  try {
    const r = await post('/api/review', true);
    if (!r.ok) return showError(r.body.error || `Request failed (${r.status}).`, r.body);
    r.body.source = state.sample ? `sample ${state.sample.id}` : 'your input';
    window.RunCache.put(k, r.body);
    render(r.body);
    window.DemoAuth.afterCall(r.body.remaining_usd);
  } catch (err) { showError(err.message); } finally { running = false; refresh(); }
}
$('explain').addEventListener('click', () => explain(false));

// ---------- rendering ----------
function checksBlock(tier, a) {
  const frag = $('tpl-checks').content.cloneNode(true);
  const f = (n) => frag.querySelector(`[data-f="${n}"]`);
  f('kind').textContent = `What code found: ${a.kind_label}`;
  f('tier').append(el('span', { className: `badge tier t${tier.tier}`, textContent: tier.label }), el('span', { className: 'small', textContent: ` ${tier.reasons.join('; ')}. Next review due ${tier.next_review}.` }));
  const order = { fail: 0, warn: 1, info: 2, pass: 3 };
  f('checks').replaceChildren(...[...a.checks].sort((x, y) => order[x.status] - order[y.status]).map((c) => {
    const li = el('li');
    const body = el('div');
    body.append(el('b', { textContent: c.title }), el('span', { className: 'd', textContent: c.detail }));
    li.append(el('span', { className: `st ${c.status}`, textContent: c.status.toUpperCase() }), body);
    return li;
  }));
  return frag;
}

const DECISION = {
  approve: ['Approve', 'good'],
  approve_with_conditions: ['Approve with conditions', 'warn'],
  more_info_needed: ['More info needed', 'neutral'],
  escalate: ['Escalate to a risk owner', 'bad'],
};
const REG_HEAD = ['Vendor', 'Tier', 'Risk', 'Description', 'Likelihood', 'Impact', 'Treatment', 'Owner', 'Decision', 'Next review'];

function registerRow(data) {
  const r = data.result.risk_register;
  return [data.intake.vendor, data.tier.label, r.risk_title, r.description, r.likelihood, r.impact, r.treatment, r.owner, DECISION[data.result.decision][0], data.tier.next_review];
}
const csvCell = (v) => (/[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const toCsv = (data) => [REG_HEAD, registerRow(data)].map((row) => row.map(csvCell).join(',')).join('\r\n');

function savedBanner(saved) {
  const box = el('div', { className: 'saved-note' });
  const again = el('button', { type: 'button', className: 'link', textContent: 'Run a fresh review' });
  again.disabled = !window.DemoAuth?.approved;
  again.addEventListener('click', () => explain(true));
  box.append(el('span', { textContent: `Saved review from ${window.RunCache.time(saved.savedAt)} for this exact intake and text. No new Claude call, no cost. ` }), again);
  return box;
}

function render(data, saved) {
  state.last = data;
  const r = data.result;
  const out = $('result');
  out.hidden = false;
  out.className = 'panel result';
  out.replaceChildren($('tpl-result').content.cloneNode(true));
  if (saved) out.prepend(savedBanner(saved));
  const f = (n) => out.querySelector(`[data-f="${n}"]`);
  const list = (node, items) => node.replaceChildren(...items.map((x) => el('li', { textContent: x })));
  const hideIfEmpty = (wrap, items) => { if (!items.length) f(wrap).remove(); };

  f('headline').textContent = r.headline;
  const [dLabel, dCls] = DECISION[r.decision];
  f('badges').replaceChildren(
    el('span', { className: `badge decision ${dCls}`, textContent: dLabel }),
    el('span', { className: `badge tier t${data.tier.tier}`, textContent: data.tier.label }),
    el('span', { className: 'badge', textContent: `${r.confidence} confidence` }),
  );
  f('reason').textContent = r.decision_reason;
  f('checks-slot').replaceWith(checksBlock(data.tier, data.analysis));

  f('findings').replaceChildren(...r.findings.map((x) => {
    const li = el('li', { className: `finding ${x.severity}` });
    const head = el('div', { className: 'f-head' });
    head.append(el('span', { className: `sev ${x.severity}`, textContent: x.severity.toUpperCase() }), el('b', { textContent: x.title }));
    li.append(head);
    if (x.criteria.length) {
      const crit = el('div', { className: 'crit' });
      for (const c of x.criteria) crit.append(el('span', { className: 'crit-id', textContent: c.id, title: c.summary }));
      crit.append(el('span', { className: 'small muted', textContent: x.criteria.map((c) => c.summary).join('; ') }));
      li.append(crit);
    }
    li.append(el('p', { textContent: x.why_it_matters }), el('p', { className: 'ask', textContent: `Ask the vendor: ${x.ask_vendor}` }));
    return li;
  }));
  if (!r.findings.length) f('findings').replaceChildren(el('li', { textContent: 'No findings.' }));

  list(f('conditions'), r.conditions); hideIfEmpty('conditions-wrap', r.conditions);
  f('cuec').replaceChildren(...r.cuec_actions.map((c) => { const li = el('li'); li.append(el('span', { className: 'owner', textContent: c.owner }), el('span', { textContent: c.control })); return li; }));
  hideIfEmpty('cuec-wrap', r.cuec_actions);
  list(f('sub'), r.subservice_followups); hideIfEmpty('sub-wrap', r.subservice_followups);
  f('ai').textContent = r.ai_review.summary;
  list(f('ai-concerns'), r.ai_review.concerns);
  list(f('terms'), r.contract_terms.length ? r.contract_terms : ['Nothing beyond your standard terms.']);
  list(f('questions'), r.vendor_questions.length ? r.vendor_questions : ['None.']);
  f('memo').textContent = r.security_memo;
  f('biz').textContent = r.business_summary;
  f('reg-head').replaceChildren(...REG_HEAD.map((h) => el('th', { textContent: h })));
  f('reg-row').replaceChildren(...registerRow(data).map((v) => el('td', { textContent: v })));

  const when = saved ? `Generated live at ${window.RunCache.time(saved.savedAt)}` : 'Generated live just now';
  f('meta').textContent = `${when} from ${data.source || 'your input'} by ${data.model} in ${data.seconds} s · Claude request ID ${data.claude_request_id || 'not returned'} · ${saved ? 'that run' : 'this run'} cost $${data.cost_usd.toFixed(4)}${data.redactions ? ` · removed ${data.redactions} secret${data.redactions > 1 ? 's' : ''}` : ''}`;

  out.querySelectorAll('.copy').forEach((b) => b.addEventListener('click', async () => {
    const text = { memo: r.security_memo, biz: r.business_summary, csv: toCsv(data) }[b.dataset.copy];
    const label = b.textContent;
    try { await navigator.clipboard.writeText(text); b.textContent = 'Copied'; } catch { b.textContent = 'Select and copy'; }
    setTimeout(() => { b.textContent = label; }, 1800);
  }));
  out.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- start ----------
(async function start() {
  await buildIntake();
  await loadQueue();
  window.DemoAuth?.onChange(refresh);
  refresh();
})();
