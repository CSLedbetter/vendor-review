// Request validation and secret removal shared by /api/check and /api/review.
import { cleanIntake, tierFor } from './tiers.js';
import { review } from './parse.js';

export const MIN_TEXT = 50;
export const MAX_TEXT = 30000;

export function redact(text) {
  let count = 0;
  const clean = text
    .replace(/\b(sk-ant-|sk-|sk_live_|rk_live_|ghp_|xox[bp]-|AKIA)[A-Za-z0-9_-]{8,}/g, () => (count++, '[REDACTED]'))
    .replace(/(client_secret|password|passwd|api[_-]?key|x-api-key|authorization|token)(["']?\s*[:=]\s*["']?)(?:Bearer\s+)?[^\s"'&,]{8,}/gi, (_, h, sep) => (count++, `${h}${sep}[REDACTED]`));
  return { text: clean, redactions: count };
}

// Returns { error } or { intake, tier, analysis, text, redactions }.
export function prepare(body, today = new Date()) {
  const b = body && typeof body === 'object' ? body : {};
  const intake = cleanIntake(b.intake);
  if (!intake.vendor) return { error: 'Add the vendor’s name first.' };
  const raw = typeof b.text === 'string' ? b.text.trim() : '';
  if (raw.length < MIN_TEXT) return { error: `Paste at least ${MIN_TEXT} characters of the vendor’s report, certificate, or trust page.` };
  if (raw.length > MAX_TEXT) return { error: `Keep it under ${MAX_TEXT.toLocaleString()} characters. Paste the opinion, system description, CUECs, and test results sections.` };
  const { text, redactions } = redact(raw);
  const tier = tierFor(intake, today);
  const analysis = review(intake, tier, text, today);
  return { intake, tier, analysis, text, redactions };
}

export function cleanSampleId(v) {
  return typeof v === 'string' && /^VR-\d{2}$/.test(v) ? v : null;
}
