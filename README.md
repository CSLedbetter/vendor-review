# Vendor Risk Reviewer

The first step of a third-party risk (TPRM) review. Describe what a vendor will touch at intake, paste its SOC 2 report sections, SOC 3 report, ISO 27001 certificate, or trust page, and code sets the risk tier and checks the evidence. Claude then makes the call: a decision, findings mapped to SOC 2 Trust Services Criteria, conditions, the controls your own team owns, AI and data-use concerns, terms to raise with Legal, questions for the vendor, a security memo, a business summary, and a risk register row you can copy as CSV.

- **Live demo:** https://vendor-review.caseyledbetter.com (the free checks need no sign-in; live reviews need an approved sign-in)
- **Spec:** [`specs/vendor-risk-reviewer.md`](specs/vendor-risk-reviewer.md)
- **Family:** [Doc Gap Finder](https://doc-gap-finder.caseyledbetter.com), [API Error Explainer](https://api-error-explainer.caseyledbetter.com), and [SSO Assistant](https://sso-assistant.caseyledbetter.com) share the same sign-in, approval, and budget.
- **Stack:** static HTML/CSS/JS, Vercel functions in Node (no framework, no dependencies), Claude API with structured outputs, Supabase Auth and Postgres for approvals and the spend cap.

## Why it exists

Vendor security review shows up as a core duty in most GRC analyst and engineer postings: tier the vendor at intake, read its SOC 2, translate the findings into a business-ready recommendation, review AI vendors, and track renewals. Several postings also ask for tooling that removes manual GRC work. This tool does the mechanical half with code and leaves the judgment to a model held to fixed criteria.

## How it works

1. **Tier at intake (code).** Data types, access, criticality, and AI use set Tier 1, 2, or 3 in `lib/tiers.js`. The tier decides what evidence is expected (for example, Tier 1 needs a SOC 2 Type II or ISO 27001 plus a pen test summary) and when the vendor is reviewed again (12, 24, or 36 months).
2. **Check the evidence (code).** `lib/parse.js` detects the document type and pulls out the auditor, opinion (clean, qualified, adverse, disclaimer), report period, categories in scope, system description, subservice organizations (carved out or inclusive), complementary user entity controls, exceptions with their criteria and management responses, bridge letters, ISO certificate details, pen test mentions, and AI training and retention statements. It then runs pass/warn/fail checks: evidence vs. tier, opinion, freshness, Type I vs. II, category coverage, scope match, exceptions, carve-outs, ISO expiry, and AI training.
3. **Review (Claude).** One call with a JSON schema. Criteria IDs are an enum of the 61 SOC 2 criteria, so Claude can't cite one that doesn't exist. Summaries of each criterion are paraphrased for this tool, not the AICPA text.
4. **Remove secrets.** API keys, bearer tokens, and passwords in the pasted text are replaced with `[REDACTED]` first.
5. **Save the result.** A repeat click on the same intake and text shows the saved review from the browser tab instead of paying for a second call.

## Sign-in, approval, and the $15 cap

Shared with the other tools. Visitors sign in with Google or an email link, start as pending, and Casey approves them on the [admin page](https://api-error-explainer.caseyledbetter.com/admin). Each call reserves its worst-case cost in Postgres before Claude is called and settles to the real cost after. Limits: $15 total across all tools, $5 per person, 30 requests per hour, 30,000 characters per review. A review costs about $0.03 to $0.07.

`supabase/migrations/` holds the change that adds `vendor-review` to the shared `demo_calls` table. The base schema lives in the API Error Explainer repo.

## Sample data

The 8 vendors in `public/vendors.json`, their auditors, and their reports are **fictional**. `node data/make_samples.mjs` regenerates them along with `data/expected.json`, which the tests check. Freshness is measured against today, so a clean sample report will start to show as stale about a year after its period ends.

Real SOC 2 reports are confidential and shared under NDA, so the "Try your own vendor" option points visitors to public material: SOC 3 reports, ISO certificates, and trust pages.

## Run it locally

```
npm test        # parser, tier, sample, and handler tests with fake Supabase and Claude
npx vercel dev  # serves public/ and api/ at http://localhost:3000
```

`public/tiers.js` is a copy of `lib/tiers.js` so the page can show the tier as the intake changes. A test fails if they drift apart.

## Environment variables

Server-side only, set in Vercel. See `.env.example`: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ADMIN_EMAIL`, and optional `CLAUDE_MODEL` (defaults to `claude-sonnet-5-5`).

## Next

- PDF upload.
- A passive check of the vendor's public domain: email authentication records, TLS, security headers, `security.txt`, and a trust page. Public information only, no scanning.
- Mapping to ISO 27001 Annex A and NIST CSF 2.0.
