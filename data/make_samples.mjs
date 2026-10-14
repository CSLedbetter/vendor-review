// Generates public/vendors.json (the sample queue) and data/expected.json (what code should find).
// Every company, auditor, and person here is fictional. Run: node data/make_samples.mjs
import fs from 'node:fs';

const opinionClean = (auditor, vendor, system, period) => `SECTION 1: INDEPENDENT SERVICE AUDITOR'S REPORT

To the management of ${vendor}:

Scope
We examined ${vendor}'s description of its ${system} system for the period ${period}, and the suitability of the design and operating effectiveness of controls stated in the description to meet the applicable trust services criteria.

Opinion
In our opinion, in all material respects, the description presents the system that was designed and implemented throughout the period, the controls were suitably designed, and the controls operated effectively throughout the period.

/s/ ${auditor}`;

const samples = [
  {
    id: 'VR-01',
    name: 'Tallyhaus Payroll',
    summary: 'Payroll provider. Clean Type II, but heavy user controls and AWS carved out.',
    intake: { vendor: 'Tallyhaus Payroll', service: 'Payroll processing and direct deposit', data: ['employee', 'financial'], access: ['stores', 'admin'], criticality: 'high', ai: 'none' },
    expected: { tier: 1, checks: [['pass', 'Evidence for the tier'], ['pass', 'Auditor’s opinion'], ['pass', 'Report freshness'], ['pass', 'Exceptions'], ['info', 'Subservice: Amazon Web Services'], ['info', 'Controls you own (CUECs)'], ['pass', 'Penetration test']] },
    text: `Tallyhaus Payroll, Inc.
SOC 2 Type II Report
Report on Tallyhaus's Description of Its Payroll Processing System and on the Suitability of the Design and Operating Effectiveness of Its Controls Relevant to Security, Availability, Confidentiality, and Privacy

${opinionClean('Halvorsen & Pike LLP', 'Tallyhaus Payroll, Inc.', 'Payroll Processing', 'January 1, 2026 to June 30, 2026')}
Halvorsen & Pike LLP
August 14, 2026

SECTION 3: SYSTEM DESCRIPTION
Services provided: Tallyhaus provides payroll processing, tax filing, and direct deposit services to small and mid-size businesses. The applicable trust services criteria are Security, Availability, Confidentiality, and Privacy.

Subservice organizations
Tallyhaus uses Amazon Web Services (AWS) for cloud hosting and data storage. The carve-out method was used, so the controls at AWS are excluded from the scope of this examination.

Penetration testing
An independent penetration test of the payroll platform was completed on March 9, 2026. All high findings were remediated.

Complementary User Entity Controls
- User entities are responsible for approving and removing their own administrator accounts in the Tallyhaus portal.
- User entities are responsible for reviewing payroll registers before each pay run is released.
- User entities are responsible for enabling SSO and multi-factor authentication for their users.
- User entities are responsible for reviewing access to the portal at least quarterly.
- User entities are responsible for reporting suspected unauthorized access within 24 hours.
- User entities are responsible for verifying bank account changes requested by employees.

SECTION 4: TESTS OF CONTROLS
CC6.1 | Access to production requires MFA | Inspected configuration | No exceptions noted.
CC6.2 | New user access is approved | Inspected 25 of 112 new users | No exceptions noted.
CC6.3 | Terminated users removed within 1 business day | Inspected 25 of 64 terminations | No exceptions noted.
CC7.2 | Alerts are reviewed daily | Inspected 40 days of alert reviews | No exceptions noted.
CC8.1 | Changes are peer reviewed and approved | Inspected 25 of 410 changes | No exceptions noted.
A1.2 | Backups run daily and restores are tested quarterly | Inspected backup logs and 2 restore tests | No exceptions noted.`,
  },
  {
    id: 'VR-02',
    name: 'Relaybird CRM',
    summary: 'CRM with customer contacts. Qualified opinion over access exceptions.',
    intake: { vendor: 'Relaybird CRM', service: 'Customer relationship management for the sales team', data: ['personal', 'confidential'], access: ['stores', 'admin'], criticality: 'medium', ai: 'none' },
    expected: { tier: 2, checks: [['fail', 'Auditor’s opinion'], ['fail', 'Exception in CC6.3'], ['fail', 'Exception in CC6.2'], ['warn', 'Categories in scope'], ['pass', 'Report freshness']] },
    text: `Relaybird Software Ltd.
SOC 2 Type II Report
Description of the Relaybird CRM Platform for the period April 1, 2025 to March 31, 2026, relevant to the Security and Confidentiality trust services criteria.

SECTION 1: INDEPENDENT SERVICE AUDITOR'S REPORT
To the Board and Management of Relaybird Software Ltd.

Basis for Qualified Opinion
Relaybird states in its description that access for terminated employees is removed within one business day. As described in Section 4, our tests found that access was not removed in a timely manner for several terminated users, so the control was not operating effectively to meet CC6.3 during the period.

Qualified Opinion
In our opinion, except for the matter described in the Basis for Qualified Opinion paragraph, in all material respects, the description presents the Relaybird CRM Platform as designed and implemented, and the controls operated effectively throughout the period April 1, 2025 to March 31, 2026.

/s/ Marrow Ridge CPAs, LLC
May 20, 2026

SECTION 3: SYSTEM DESCRIPTION
Relaybird CRM is a customer relationship management platform used by sales teams to track contacts, deals, and customer communications.

Subservice organizations: Relaybird hosts the platform on Google Cloud Platform (GCP). The carve-out method was used.

SECTION 4: TESTS OF CONTROLS
CC6.1 | MFA is enforced for workforce access | Inspected IdP policy | No exceptions noted.
CC6.2 | New access is approved by a manager before it is provisioned
Inspected 25 of 140 new access requests | Exception noted: 2 of 25 requests had no documented approval.
Management's response: Relaybird has added a required approval step in its ticketing workflow as of February 2026.
CC6.3 | Access for terminated users is removed within one business day
Inspected 25 of 58 terminations | Exception noted: access was removed between 4 and 23 days late for 6 of 25 terminated users.
CC7.2 | Security events are logged and reviewed | Inspected 30 days | No exceptions noted.
C1.1 | Customer data is classified as confidential and encrypted | Inspected configuration | No exceptions noted.

Complementary User Entity Controls
- User entities are responsible for removing their own users from Relaybird when they leave.
- User entities are responsible for configuring SSO for their workspace.`,
  },
  {
    id: 'VR-03',
    name: 'Murmur Notes',
    summary: 'AI meeting notes. Type I only, trains on customer recordings, 3-year retention.',
    intake: { vendor: 'Murmur Notes', service: 'AI meeting transcription and summaries', data: ['personal', 'confidential'], access: ['stores'], criticality: 'medium', ai: 'features' },
    expected: { tier: 2, checks: [['warn', 'Type I report'], ['fail', 'AI training on your data'], ['info', 'Retention'], ['pass', 'Auditor’s opinion']] },
    text: `Murmur Labs, Inc.
SOC 2 Type I Report
Description of the Murmur Notes Transcription System as of May 15, 2026, relevant to the Security trust services criteria.

SECTION 1: INDEPENDENT SERVICE AUDITOR'S REPORT
We examined Murmur Labs' description of its Murmur Notes Transcription system as of May 15, 2026, and the suitability of the design of controls to meet the applicable trust services criteria. We did not test operating effectiveness.

Opinion
In our opinion, in all material respects, the description presents the system as designed and implemented as of May 15, 2026, and the controls were suitably designed.

/s/ Quillstone Assurance LLP

SECTION 3: SYSTEM DESCRIPTION
Murmur Notes joins video meetings, records audio, and produces AI transcripts, summaries, and action items.

Artificial intelligence
Murmur uses large language models from OpenAI to generate summaries. Murmur may use customer recordings and transcripts to train and improve our AI models and speech recognition.

Data retention
Recordings and transcripts are retained for 3 years after a meeting unless the workspace owner deletes them.

Subservice organizations: Amazon Web Services hosts the application (carve-out method). OpenAI is a subservice organization for summarization (carve-out method).`,
  },
  {
    id: 'VR-04',
    name: 'Cargoloop Logistics',
    summary: 'Shipping partner. Report period ended long ago, no bridge letter.',
    intake: { vendor: 'Cargoloop Logistics', service: 'Shipment tracking and label printing', data: ['personal'], access: ['stores'], criticality: 'medium', ai: 'none' },
    expected: { tier: 2, checks: [['fail', 'Report freshness'], ['pass', 'Auditor’s opinion'], ['pass', 'Scope match']] },
    text: `Cargoloop Logistics Corp.
SOC 2 Type II Report
${opinionClean('Halvorsen & Pike LLP', 'Cargoloop Logistics Corp.', 'Shipment Tracking', 'January 1, 2024 through December 31, 2024')}
Halvorsen & Pike LLP
March 3, 2025

SECTION 3: SYSTEM DESCRIPTION
Cargoloop provides shipment tracking, label printing, and delivery notifications. This report covers the Security trust services criteria.

SECTION 4: TESTS OF CONTROLS
CC6.1 | Unique IDs and MFA are required | Inspected configuration | No exceptions noted.
CC7.4 | Incidents follow the response plan | Inspected 3 incidents | No exceptions noted.`,
  },
  {
    id: 'VR-05',
    name: 'Sketchwell',
    summary: 'Whiteboard tool for public marketing work. SOC 3 is enough here.',
    intake: { vendor: 'Sketchwell', service: 'Online whiteboard for marketing brainstorms', data: ['none'], access: [], criticality: 'low', ai: 'none' },
    expected: { tier: 3, checks: [['pass', 'Evidence for the tier'], ['pass', 'Auditor’s opinion'], ['pass', 'Report freshness']] },
    text: `Sketchwell, Inc. SOC 3 Report
Report on Sketchwell's Whiteboard System Relevant to Security and Availability for the period July 1, 2025 to June 30, 2026

Independent Service Auditor's Report
We examined management's assertion that Sketchwell maintained effective controls over its Whiteboard system to provide reasonable assurance that its service commitments were achieved based on the trust services criteria relevant to Security and Availability, throughout the period July 1, 2025 to June 30, 2026.

Opinion
In our opinion, management's assertion that the controls were effective throughout the period is fairly stated, in all material respects.

Marrow Ridge CPAs, LLC
August 2, 2026`,
  },
  {
    id: 'VR-06',
    name: 'Lockwarden',
    summary: 'Secrets manager. ISO certificate expired and scope skips the product.',
    intake: { vendor: 'Lockwarden', service: 'Secrets vault for production credentials', data: ['secrets'], access: ['production', 'stores'], criticality: 'high', ai: 'none' },
    expected: { tier: 1, checks: [['fail', 'ISO certificate expiry'], ['warn', 'Scope match'], ['warn', 'Penetration test'], ['pass', 'Evidence for the tier']] },
    text: `CERTIFICATE OF REGISTRATION

This is to certify that the Information Security Management System of
Lockwarden Security GmbH
has been assessed and found to conform to the requirements of ISO/IEC 27001:2022.

Scope: Corporate IT operations, human resources, and finance systems at the Munich office.

Certificate No: NGC-ISMS-40817
Original certification date: September 1, 2023
Expiry date: August 31, 2026

Issued by: Northgate Certification Services (fictional)`,
  },
  {
    id: 'VR-07',
    name: 'Deskloom',
    summary: 'Help desk for every customer ticket. Security only in scope, change exception.',
    intake: { vendor: 'Deskloom', service: 'Customer support ticketing and help desk', data: ['personal'], access: ['stores'], criticality: 'high', ai: 'none' },
    expected: { tier: 1, checks: [['warn', 'Categories in scope'], ['warn', 'Exception in CC8.1'], ['pass', 'Auditor’s opinion'], ['pass', 'Penetration test']] },
    text: `Deskloom, Inc.
SOC 2 Type II Report
${opinionClean('Quillstone Assurance LLP', 'Deskloom, Inc.', 'Help Desk', 'October 1, 2025 to March 31, 2026')}

SECTION 3: SYSTEM DESCRIPTION
Deskloom provides customer support ticketing, a help desk inbox, and a knowledge base. The trust services criteria in scope for this report are the Security criteria only.

Deskloom completed an external penetration test in January 2026.

Subservice organizations: Deskloom uses Microsoft Azure for hosting under the inclusive method.

SECTION 4: TESTS OF CONTROLS
CC6.1 | SSO and MFA are required for staff | Inspected configuration | No exceptions noted.
CC7.2 | Logs are monitored by the security team | Inspected 30 days | No exceptions noted.
CC8.1 | Changes to production are approved before deployment
Inspected 40 of 820 changes | Exception noted: 3 of 40 changes were deployed before approval was recorded.
Management's response: Deskloom added a branch protection rule in March 2026 that blocks merges without an approval.

Complementary User Entity Controls
- User entities are responsible for removing agents who leave their support team.`,
  },
  {
    id: 'VR-08',
    name: 'Paycadence',
    summary: 'Payment processor. Clean report, but no pen test summary for a Tier 1.',
    intake: { vendor: 'Paycadence', service: 'Card payment processing at checkout', data: ['card', 'personal'], access: ['stores', 'production'], criticality: 'high', ai: 'none' },
    expected: { tier: 1, checks: [['warn', 'Penetration test'], ['pass', 'Auditor’s opinion'], ['pass', 'Exceptions'], ['info', 'Subservice: Google Cloud']] },
    text: `Paycadence Payments, Inc.
SOC 2 Type II Report
Relevant to Security, Availability, Confidentiality, and Privacy trust services criteria

${opinionClean('Marrow Ridge CPAs, LLC', 'Paycadence Payments, Inc.', 'Card Payment Processing', 'January 1, 2026 to June 30, 2026')}

SECTION 3: SYSTEM DESCRIPTION
Paycadence provides card payment processing, tokenization, and payouts for online checkout.
Subservice organizations: Paycadence uses Google Cloud for hosting. The carve-out method was used.

SECTION 4: TESTS OF CONTROLS
CC6.1 | Cardholder data is tokenized and encrypted | Inspected configuration | No exceptions noted.
CC6.7 | TLS 1.2 or higher is enforced | Inspected configuration | No exceptions noted.
CC7.2 | A 24/7 team monitors alerts | Inspected 30 days | No exceptions noted.
A1.2 | Systems fail over between regions | Inspected failover test | No exceptions noted.

Complementary User Entity Controls
- User entities are responsible for protecting their API keys.
- User entities are responsible for reviewing payouts and disputes.`,
  },
];

fs.writeFileSync(new URL('../public/vendors.json', import.meta.url), JSON.stringify(samples.map(({ expected, ...s }) => s), null, 2) + '\n');
fs.writeFileSync(new URL('./expected.json', import.meta.url), JSON.stringify(Object.fromEntries(samples.map((s) => [s.id, s.expected])), null, 2) + '\n');
console.log(`Wrote ${samples.length} samples.`);
