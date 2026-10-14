# Vendor Risk Reviewer

## Objective

A live demo of the first step in a third-party risk (TPRM) review. A visitor describes a vendor at intake (what data it touches, how critical it is, whether it uses AI on that data), then pastes the vendor's assurance documents: SOC 2 report sections, a public SOC 3 report, an ISO 27001 certificate, or a trust page. Code assigns a risk tier and pulls out the hard facts. Claude then turns them into a decision, findings mapped to SOC 2 criteria, questions for the vendor, terms to raise with Legal, a memo for the security team, a summary for the business owner, and a risk register row.

It's for GRC hiring managers. It shows the work named in the target postings (Turo, Snowflake, Ambience, GitLab, Clerk, Reflection, april, Clear Capital): vendor tiering at intake, evaluating SOC 2 reports, translating findings into business-ready recommendations, reviewing AI vendors, and building AI tooling that removes manual GRC work. It's also the first piece of a later preliminary-scan product.

## Requirements

### Intake and tiering (code, free)
1. The page has an intake form with these fields:
   - Vendor name (required, 1 to 80 characters).
   - Service being bought (optional, up to 200 characters).
   - Data the vendor will touch (checkboxes): customer personal data, health data (PHI), payment card data, financial or bank data, credentials or secrets, source code, employee data, confidential business data, none or public only.
   - Access (checkboxes): stores or processes our data, connects to production systems, has SSO or admin access into our tools, network-level access.
   - Business criticality (one choice): low, medium, high (meaning an outage stops a core business process).
   - AI use (one choice): no AI on our data, AI features on our data, the vendor is an AI model provider.
2. Code assigns a tier from the intake:
   - **Tier 1 (high):** any of PHI, payment card, financial, credentials or secrets, or source code; or connects to production; or criticality high and stores our data.
   - **Tier 2 (medium):** any other data except "none or public", or any access box, or AI on our data.
   - **Tier 3 (low):** everything else.
3. Each tier sets what evidence is expected and when to review again:
   - Tier 1: SOC 2 Type II or ISO 27001 plus a penetration test summary, reviewed every 12 months.
   - Tier 2: SOC 2 Type II, SOC 2 Type I, or ISO 27001, reviewed every 24 months.
   - Tier 3: any public attestation, such as a SOC 3 report or a trust page, reviewed every 36 months.
4. The tier, the reason it was assigned (the exact intake items that triggered it), the expected evidence, and the next review date (today plus the interval) are shown before any paid call.

### Document parsing (code, free)
5. A text box accepts pasted report text up to 30,000 characters, with a live character count.
6. The parser detects the document type: SOC 2 Type II, SOC 2 Type I, SOC 3, ISO 27001 certificate, trust page or other, or unknown.
7. It extracts these facts when present:
   - Audit firm.
   - Opinion: unmodified, qualified ("except for"), adverse, or disclaimer.
   - Report period (start and end dates) or the "as of" date for a Type I.
   - Trust Services Categories in scope: Security, Availability, Confidentiality, Processing Integrity, Privacy.
   - The system or services named in the system description.
   - Subservice organizations, and whether each is carved out or included.
   - Complementary user entity controls (CUECs), as a list.
   - Exceptions or deviations, each with any criteria ID next to it (such as CC6.2) and whether management responded.
   - Criteria IDs mentioned anywhere.
   - Mentions of a bridge or gap letter.
   - For ISO certificates: certificate number, expiry date, certification body, and scope statement.
   - AI and data-use signals: model training on customer data, data retention periods, and named model providers.
8. Code runs these checks, each with pass, warn, fail, or info and a one-line detail:
   - **Evidence meets the tier:** for example, a SOC 3 alone for a Tier 1 vendor fails.
   - **Opinion:** qualified fails, adverse or disclaimer fails, unmodified passes.
   - **Freshness:** report period ended more than 12 months ago with no bridge letter fails; more than 12 months with a bridge letter warns; more than 9 months warns.
   - **Type I for Tier 1:** warns, because a Type I shows design only, not operating effectiveness.
   - **Category coverage:** Availability missing from scope when criticality is high warns; Confidentiality missing when confidential data is checked warns; Privacy missing when personal data or PHI is checked warns.
   - **Scope match:** if "service being bought" is filled in and none of its words appear in the system description, warn.
   - **Exceptions:** each exception is listed; an exception in CC6 (access) or CC7 (operations and monitoring) on a Tier 1 or Tier 2 vendor fails, other exceptions warn.
   - **Carved-out subservice orgs:** each one is listed as info, with a note to get its own report.
   - **CUECs:** count shown as info; more than 0 means the customer has controls to own.
   - **ISO certificate expired:** fails.
   - **AI:** "AI on our data" or "AI model provider" with a training-on-customer-data signal and no opt-out mentioned fails; AI use with no training or retention statement found warns.
9. A **Run checks (free)** button runs intake tiering and parsing with no sign-in and no Claude call, through `POST /api/check`.

### Review (Claude, paid, signed in and approved)
10. A **Run checks and review** button calls `POST /api/review`. It requires an approved sign-in and goes through the same spending gate as the other tools.
11. Claude gets the intake, the tier, the code findings, and the pasted text with secrets removed. It returns JSON that matches a fixed schema:
    - `headline`: one sentence.
    - `decision`: one of `approve`, `approve_with_conditions`, `more_info_needed`, `escalate`.
    - `decision_reason`.
    - `confidence`: low, medium, or high.
    - `findings[]`: each with title, severity (high, medium, low), criteria IDs, why it matters to this customer, and what to ask the vendor.
    - `conditions[]`: required before or after signing; empty unless the decision is approve with conditions.
    - `cuec_actions[]`: each with the control and a suggested owning team.
    - `subservice_followups[]`.
    - `ai_review`: summary plus concerns; "Not applicable" when no AI is involved.
    - `contract_terms[]`: terms to raise with Legal (such as breach notice timing, right to audit, subprocessor notice, data deletion, AI training opt-out).
    - `vendor_questions[]`.
    - `security_memo`: for the security team.
    - `business_summary`: plain language for the business owner, under 120 words.
    - `risk_register`: risk title, description, likelihood, impact, treatment (accept, mitigate, transfer, avoid), and suggested owner.
12. Criteria IDs in findings must come from a fixed list of SOC 2 Trust Services Criteria IDs (CC1.1 to CC9.2, A1.1 to A1.3, C1.1 to C1.2, PI1.1 to PI1.5, P1.1 to P8.1), enforced by an enum in the schema. Each ID has a one-line summary written in my own words, not the AICPA text.
13. The result shows: decision badge, tier badge, headline, code checks, findings, conditions, CUEC actions, subservice follow-ups, AI review, contract terms, vendor questions, the memo, the business summary, and the risk register row.
14. Copy buttons for the memo, the business summary, and the risk register row. The register row is copied as one CSV line (vendor, tier, risk title, description, likelihood, impact, treatment, owner, decision, next review date) with a header line.
15. Each result ends with: "Generated live just now from {sample or your input} by {model} in {s} s · Claude request ID {id} · this run cost ${cost}".
16. Paid results are saved in the browser tab, keyed by a hash of the intake plus the text, the same way as the other two tools. A repeat click shows the saved result with a "Saved review from {time}" note and a **Run a fresh review** link.

### Samples and bring-your-own
17. A queue of 8 fictional vendors, each with prefilled intake and report text, with planted issues covering: clean report with heavy CUECs and a carved-out cloud host; qualified opinion over access exceptions; Type I only for an AI vendor that trains on customer data; stale report with no bridge letter; SOC 3 only for a low-risk tool; expired ISO certificate whose scope excludes the product; Availability missing for a high-criticality vendor plus a change-management exception with a management response; and a payment vendor that's clean except for a missing pen test summary.
18. Every sample is marked fictional, and the README says so.
19. A **Try your own vendor** button clears the form and opens a section explaining that real SOC 2 reports are confidential and shared under NDA, so visitors should paste a public SOC 3 report, an ISO certificate, or a trust page, and shouldn't paste anything confidential.
20. A "Your own input" chip appears when the visitor edits a sample or types their own text.

### Access, cost, and the family
21. Sign-in, approval, and the admin page reuse the existing Supabase setup: Google or email sign-in, pending until Casey approves, and `/admin` limited to `ADMIN_EMAIL`.
22. Calls count toward the existing $15 total and $5 per person caps, and the 30 requests per hour limit. The `demo_calls.tool` check allows `vendor-review`, and the admin list shows a vendor request count.
23. API keys, bearer tokens, and passwords in the pasted text are replaced with `[REDACTED]` before Claude sees it, and the result says how many were removed.
24. The family nav on all four sites (Doc Gap Finder, API Error Explainer, SSO Assistant, Vendor Risk Reviewer) links to each other.
25. A portfolio card with a 1200 by 750 screenshot is added to `data/projects.json`.

## Out of scope
- Uploading PDFs. Visitors paste text. (PDF upload is a good v2.)
- Any scanning of a vendor's domain or systems. That's the next phase, and it'll be passive only.
- ISO 27001 Annex A mapping, NIST CSF mapping, and other frameworks beyond recognizing an ISO certificate.
- Saving reviews to a database or building a vendor inventory.
- Legal advice. Contract terms are framed as items to raise with Legal.

## Constraints
- Same stack as the other tools: static HTML, CSS, and JS in `public/`, Node functions in `api/`, no framework, no dependencies, Vercel Hobby.
- Claude Messages API with structured outputs, model `claude-sonnet-5-5`, server-side only.
- Supabase project `floagxzbvqxrscnqotyn`. Schema changes go in `supabase/migrations/` and only add or replace objects.
- Content Security Policy matching the other tools.
- Mobile layout works at 360 px wide with no sideways scroll.
- Expected cost per review: about $0.03 to $0.07.

## Edge cases
- **Empty text or under 50 characters:** buttons are disabled.
- **Over 30,000 characters:** the text box stops at 30,000 and the server rejects anything longer with a clear message.
- **No vendor name:** buttons are disabled and the field shows it's required.
- **Document type unknown:** the checks still run, with an info line saying the type couldn't be detected, and Claude is told not to assume it's a SOC 2.
- **No dates found:** the freshness check shows info, "No report period found", not a pass.
- **Dates in different formats** (June 30, 2026; 2026-06-30; 06/30/2026; 30 June 2026): all parse.
- **"No exceptions noted" next to a criteria ID:** isn't counted as an exception.
- **A sample's dates age over time:** freshness is computed against today, so a clean sample can turn stale later. The README notes this.
- **Signed out, pending, revoked, over a cap, or demo disabled:** the same messages and status codes as the other tools, and the free checks still work.
- **Claude refuses, times out, or returns a bad response:** an error message shows with the free checks, and the reservation settles the same way as the other tools.
- **Visitor pastes something that isn't vendor material:** the checks say nothing was found, and Claude returns `more_info_needed` with low confidence.

## Definition of done
- [ ] The intake form has every field in requirement 1, and the buttons are disabled until a vendor name and 50+ characters of text exist.
- [ ] Each of the 8 samples gives the tier and the key failing or warning check listed for it in `data/expected.json`, checked by a unit test.
- [ ] Unit tests cover the tier rules, every date format in the edge cases, opinion detection, exception parsing (including "no exceptions noted"), carve-out detection, ISO expiry, and AI signals.
- [ ] `POST /api/check` works signed out and returns tier and checks, with no Claude call.
- [ ] `POST /api/review` returns 401 signed out, and handler tests with fake Supabase and Claude show reserve, call, and settle.
- [ ] The schema limits criteria IDs to the fixed enum, and the system prompt forbids inventing criteria or URLs.
- [ ] Secrets in pasted text are removed before the Claude call, checked by a test.
- [ ] A repeat paid click on the same intake and text makes no new request, and editing either one makes a new request, checked in the browser.
- [ ] The risk register copy produces a header line plus one valid CSV row.
- [ ] The page has no sideways scroll at 360 px and no console errors.
- [ ] The live site loads at `https://vendor-review.caseyledbetter.com`, the free check works there, and `/api/review` returns 401 signed out.
- [ ] `demo_calls` accepts `vendor-review`, and `/admin` shows the vendor count.
- [ ] All four sites link to each other in the family nav.
- [ ] The portfolio card is live after Casey approves the merge.

## Assumptions and open questions
- **Slug and name:** `vendor-review`, "Vendor Risk Reviewer". Chosen by Claude.
- **Tier rules and review intervals** follow common TPRM practice and are set in one file (`lib/tiers.js`) so they're easy to change.
- **Criteria summaries** are paraphrased by Claude, not quoted from the AICPA.
- **Added beyond the agreed changes:** scope match, bridge letter and Type I checks, the risk register row with CSV copy, and the next review date. All come from the postings or standard TPRM practice.
- **Open:** whether to add PDF upload and the passive domain check in v2.
