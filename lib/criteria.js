// SOC 2 Trust Services Criteria IDs (2017 criteria, revised points of focus 2022).
// The one-line summaries are paraphrased for this tool, not the AICPA's wording.
// Claude may only cite IDs from this list: it's an enum in the response schema.

export const CRITERIA = {
  'CC1.1': 'Leadership shows a commitment to integrity and ethics',
  'CC1.2': 'The board oversees internal control independently',
  'CC1.3': 'Management sets structure, reporting lines, and authority',
  'CC1.4': 'The company hires, develops, and keeps competent people',
  'CC1.5': 'People are held accountable for their control duties',
  'CC2.1': 'Quality information is used to support controls',
  'CC2.2': 'Control information is communicated internally',
  'CC2.3': 'Control matters are communicated to outside parties',
  'CC3.1': 'Objectives are clear enough to assess risk against',
  'CC3.2': 'Risks to objectives are identified and analyzed',
  'CC3.3': 'Fraud risk is considered',
  'CC3.4': 'Significant changes that affect controls are assessed',
  'CC4.1': 'Controls are monitored through ongoing or separate evaluations',
  'CC4.2': 'Control deficiencies are reported and fixed in time',
  'CC5.1': 'Control activities are chosen to reduce risk',
  'CC5.2': 'General controls over technology are chosen',
  'CC5.3': 'Controls are put in place through policies and procedures',
  'CC6.1': 'Logical access security is in place for protected systems and data',
  'CC6.2': 'Users are registered and authorized before access is granted',
  'CC6.3': 'Access is granted, changed, and removed based on roles and need',
  'CC6.4': 'Physical access to facilities and hardware is restricted',
  'CC6.5': 'Data and hardware are disposed of securely',
  'CC6.6': 'Threats from outside the system boundary are blocked',
  'CC6.7': 'Data in transit and movement of data are protected',
  'CC6.8': 'Unauthorized or malicious software is prevented or detected',
  'CC7.1': 'Configuration and vulnerability problems are detected',
  'CC7.2': 'Systems are monitored for anomalies and attacks',
  'CC7.3': 'Security events are evaluated to decide if they are incidents',
  'CC7.4': 'Incidents are responded to with a defined process',
  'CC7.5': 'The company recovers from incidents',
  'CC8.1': 'Changes to systems are authorized, tested, approved, and tracked',
  'CC9.1': 'Business disruption risk is identified and reduced',
  'CC9.2': 'Risk from vendors and business partners is assessed and managed',
  'A1.1': 'Capacity is monitored and planned to meet availability commitments',
  'A1.2': 'Backups, recovery infrastructure, and environmental protections are in place',
  'A1.3': 'Recovery plans are tested',
  'C1.1': 'Confidential information is identified and protected',
  'C1.2': 'Confidential information is disposed of when no longer needed',
  'PI1.1': 'Processing definitions and specifications are documented',
  'PI1.2': 'Inputs are complete and accurate',
  'PI1.3': 'Processing is complete, accurate, and timely',
  'PI1.4': 'Outputs are complete, accurate, and delivered as intended',
  'PI1.5': 'Stored data is complete and accurate',
  'P1.1': 'Privacy notice is provided to data subjects',
  'P2.1': 'Choice and consent are communicated and obtained',
  'P3.1': 'Personal information is collected only for stated purposes',
  'P3.2': 'Explicit consent is obtained where required',
  'P4.1': 'Personal information is used only for stated purposes',
  'P4.2': 'Personal information is retained only as long as needed',
  'P4.3': 'Personal information is disposed of securely',
  'P5.1': 'Data subjects can access their personal information',
  'P5.2': 'Data subjects can correct their personal information',
  'P6.1': 'Personal information is disclosed to third parties only with consent',
  'P6.2': 'Authorized disclosures are recorded',
  'P6.3': 'Unauthorized disclosures are recorded',
  'P6.4': 'Third parties are held to privacy commitments',
  'P6.5': 'Third parties report unauthorized disclosures',
  'P6.6': 'Breach notifications are given to affected parties',
  'P6.7': 'Data subjects can get an accounting of their data held',
  'P7.1': 'Personal information is kept accurate and complete',
  'P8.1': 'Privacy inquiries, complaints, and disputes are handled',
};

export const CRITERIA_IDS = Object.keys(CRITERIA);

export const CATEGORIES = ['Security', 'Availability', 'Confidentiality', 'Processing Integrity', 'Privacy'];

// "CC 6.2", "CC6.2" and "cc6.2" all normalize to "CC6.2". Returns null for IDs not in the list.
export function normalizeId(raw) {
  const m = String(raw).toUpperCase().replace(/\s+/g, '').match(/^(CC|A|C|PI|P)(\d)\.(\d)$/);
  if (!m) return null;
  const id = `${m[1]}${m[2]}.${m[3]}`;
  return CRITERIA[id] ? id : null;
}
