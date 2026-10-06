// Transforms the dashboard's data/*.json files into readable Markdown documents
// suitable for use as Copilot Studio knowledge sources (grounding), since
// Copilot Studio retrieves better from natural-language documents than raw JSON.
//
// Output goes to copilot-knowledge/ (gitignored -- these are inputs to a manual
// or future automated upload into Copilot Studio, not deployed site content).

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const OUT_DIR = path.join(__dirname, 'copilot-knowledge');

function readRows(fileName, key) {
  const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, fileName), 'utf8'));
  const rows = raw.rows;
  return rows[key] || rows.rows || rows.body || rows;
}

function write(fileName, content) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const filePath = path.join(OUT_DIR, fileName);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  wrote ${filePath}`);
}

function yesNoList(row) {
  const areas = ['Science and Innovation', 'People and Sustainability', 'Growth and Therapy Area Leadership', 'Achieve Group Financial Targets'];
  const yes = areas.filter((a) => String(row[a] || '').toLowerCase() === 'yes');
  return yes.length ? yes.join(', ') : 'None';
}

function clean(text) {
  return String(text || '').trim() || 'Not provided.';
}

// ---- Enduring & Principal Risks ----
function buildEnduringPrincipal() {
  const rows = readRows('ep-dim-risktest.json', 'rows');
  const lines = [
    '# Enduring & Principal Risks',
    '',
    'This document lists AstraZeneca\'s Enduring and Principal Risks. A Principal Risk is a',
    'subset of Enduring Risks considered most likely to significantly impact delivery of the',
    'Group\'s business strategy or future performance.',
    ''
  ];
  rows.forEach((r) => {
    lines.push(`## ${r['Enduring Risk']} (Risk #${r['Enduring Risk Number']}, "${r['Short Name']}")`);
    lines.push(`- **Type:** ${r['Risk Type']} risk (Principal Risk: ${r['Principal Risk?']})`);
    lines.push(`- **Risk Category:** ${clean(r['Risk Category'])}`);
    lines.push(`- **Risk Owner(s):** ${clean(r['SET Risk Owner'])}`);
    lines.push(`- **Trend:** ${clean(r['Trend'])}`);
    lines.push(`- **Current Impact / Probability:** ${r['Current Impact_Level']} / ${r['Current Likelihood_Level']}`);
    lines.push(`- **Gross Impact / Probability:** ${r['Gross Impact_Level']} / ${r['Gross Likelihood_Level']}`);
    lines.push(`- **Linked Strategic Areas:** ${yesNoList(r)}`);
    lines.push(`- **Count of Linked Key Active Risks:** ${r['Count of Linked KAR']}`);
    lines.push(`- **Count of Linked Material Controls:** ${r['Count of Linked Material Controls']}`);
    lines.push('');
    lines.push(`**Risk Statement:** ${clean(r['Risk Statement'])}`);
    lines.push('');
    lines.push(`**Current Year Update:** ${clean(r['Current Year Update'])}`);
    lines.push('');
    const controls = r['Material Controls'] || [];
    if (controls.length) {
      lines.push('**Material Controls:**');
      controls.forEach((c) => lines.push(`- ${c.Reference ? c.Reference + ' — ' : ''}${c.Name}: ${c.Description.replace(/\r?\n/g, ' ')}`));
      lines.push('');
    }
    const mitigations = r['Other Mitigations'] || [];
    if (mitigations.length) {
      lines.push('**Other Mitigations:**');
      mitigations.forEach((m) => lines.push(`- ${m.Activity}: ${m.Update}`));
      lines.push('');
    }
    const kris = r['KRIs'] || [];
    if (kris.length) {
      lines.push('**Key Risk Indicators (KRIs):**');
      kris.forEach((k) => {
        const current = k.Values.length ? k.Values[k.Values.length - 1] : 'n/a';
        lines.push(`- ${k.Name}: current value ${current} (Upper Threshold ${k.UpperThreshold ?? 'n/a'}, Upper Tolerance ${k.UpperTolerance ?? 'n/a'}, Lower Tolerance ${k.LowerTolerance ?? 'n/a'}, Lower Threshold ${k.LowerThreshold ?? 'n/a'})`);
      });
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  });
  write('enduring-principal-risks.md', lines.join('\n'));
}

// ---- Key Active Risks ----
function buildKeyActiveRisks() {
  const rows = readRows('k-dim-risk.json', 'rows');
  const lines = [
    '# Key Active Risks',
    '',
    'Key Active Risks are real and specific risks (often cutting across a number of Principal',
    'Risks) that could prevent AstraZeneca from achieving its objectives. These are reported',
    'quarterly to the Audit Committee and Board.',
    ''
  ];
  rows.forEach((r) => {
    lines.push(`## ${r['Key Active Risk']} (KAR #${r['KAR_ID']})`);
    lines.push(`- **Risk Owner(s):** ${clean(r['SET Risk Owner'])}`);
    lines.push(`- **Trend:** ${clean(r['Trend'])}`);
    lines.push(`- **Current Impact / Likelihood:** ${r['Current Impact']} / ${r['Current Likelihood']} (Overall: ${r['Overall Risk']})`);
    lines.push(`- **Linked Strategic Areas:** ${yesNoList(r)}`);
    lines.push(`- **Linked Principal Risks (${r['Linked Principal Risk Count']}):** ${clean(r['Linked Principal Risks'])}`);
    lines.push('');
    lines.push(`**Risk Statement:** ${clean(r['Risk Statement'])}`);
    lines.push('');
    if (clean(r['Action']) !== 'Not provided.') {
      lines.push(`**Action:** ${clean(r['Action'])}`);
      lines.push('');
    }
    if (clean(r['Quarterly Update']) !== 'Not provided.') {
      lines.push(`**Quarterly Update:** ${clean(r['Quarterly Update'])}`);
      lines.push('');
    }
    if (r['KAR Mitigation List']) {
      lines.push('**Mitigations:**');
      lines.push(r['KAR Mitigation List']);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  });
  write('key-active-risks.md', lines.join('\n'));
}

// ---- Emerging Risks & Clusters ----
function buildEmergingRisks() {
  const clusters = readRows('e_bridge_risk_clusters.json', 'rows');
  const risks = readRows('e_dim_risk.json', 'body');
  const seenClusters = new Map();
  clusters.forEach((c) => { if (!seenClusters.has(c['Cluster ID'])) seenClusters.set(c['Cluster ID'], c); });

  const lines = [
    '# Emerging Risks',
    '',
    'Emerging risks may constantly change, can materialise quickly, and their impact and',
    'probability are often difficult to assess and quantify at present. They have the potential',
    'to become enduring, active, or principal risks in the future. Individual emerging risks are',
    'grouped into clusters covering a common theme.',
    ''
  ];

  lines.push('## Emerging Risk Clusters');
  lines.push('');
  [...seenClusters.values()].forEach((c) => {
    lines.push(`### Cluster: ${c['Cluster']} (Cluster #${c['Cluster ID']})`);
    lines.push(`- **Potential Impact Rating:** ${clean(c['Potential Impact Rating'])}`);
    lines.push(`- **Time to Active Management:** ${clean(c['Time to Active Management'])}`);
    lines.push(`- **Related Strategic Areas:** ${yesNoList(c)}`);
    lines.push('');
    lines.push(`**Risk Statement:** ${clean(c['Risk Statement'])}`);
    lines.push(`**Why Emerging:** ${clean(c['Why Emerging'])}`);
    lines.push(`**Potential Enterprise Impact:** ${clean(c['Potential Enterprise Impact'])}`);
    lines.push(`**Action (${clean(c['Action'])}):** ${clean(c['Action Detail'])}`);
    lines.push(`**Key Active Triggers:** ${clean(c['Key Active Triggers'])}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  lines.push('## Individual Emerging Risks');
  lines.push('');
  risks.forEach((r) => {
    lines.push(`### ${r['Emerging Risk']} (ER #${r['ER_ID']}, Cluster: ${clean(r['ER_Cluster'])})`);
    lines.push(`- **Risk Owner(s):** ${clean(r['SET Risk Owner'])}`);
    lines.push(`- **Potential Impact:** ${clean(r['Potential Impact'])} | **Overall Risk:** ${clean(r['Overall Risk'])}`);
    lines.push(`- **Time to Active Management:** ${clean(r['Time to Active Management'])}`);
    lines.push(`- **Thematic Category:** ${clean(r['Thematic Category'])}`);
    lines.push(`- **Linked Strategic Areas:** ${yesNoList(r)}`);
    lines.push('');
    lines.push(`**Risk Statement:** ${clean(r['Risk Statement'])}`);
    lines.push(`**Why Emerging Now:** ${clean(r['Why Emerging Now'])}`);
    lines.push(`**Potential Enterprise Impact:** ${clean(r['Potential Enterprise Impact'])}`);
    lines.push(`**Key Active Risk Triggers:** ${clean(r['Key Active Risk Triggers'])}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  });
  write('emerging-risks.md', lines.join('\n'));
}

// ---- Material Controls ----
function buildMaterialControls() {
  const rows = readRows('material-control.json', 'rows');
  const lines = [
    '# Material Controls',
    '',
    'Material Controls are the most important controls relied upon to mitigate material',
    'financial, operational, compliance and reporting risks to an acceptable level.',
    ''
  ];
  rows.forEach((r) => {
    lines.push(`## ${r['Control Name']} (${clean(r['Control Reference'])})`);
    lines.push(`- **Control Owner:** ${clean(r['Control Owner'])}`);
    lines.push(`- **Linked Enduring Risks:** ${clean(r['Linked Enduring Risks'])}`);
    lines.push('');
    lines.push(`**Description:** ${clean(r['Control Description']).replace(/\r?\n/g, ' ')}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  });
  write('material-controls.md', lines.join('\n'));
}

function build() {
  console.log('Building Copilot Studio knowledge documents...');
  buildEnduringPrincipal();
  buildKeyActiveRisks();
  buildEmergingRisks();
  buildMaterialControls();
  console.log('Done.');
}

module.exports = { build };

if (require.main === module) {
  build();
}
