// Reads Data File.xlsx (read-only) and regenerates Risk_Test/data/*.json + root data.json.
// Node port of refresh-data.ps1 -- same schemas, same derived fields.

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const SOURCE_WORKBOOK = "C:\\Users\\khnq757\\OneDrive - AZCollaboration\\GFS Digital Delivery - 01. Requirements\\Data File.xlsx";
const DATA_FOLDER = path.join(__dirname, 'data');

const LEVEL_MAP = { VH: 'Very High', H: 'High', M: 'Medium', L: 'Low', VL: 'Very Low' };
function expandLevel(abbr) {
  if (!abbr) return '';
  return LEVEL_MAP[abbr] || abbr;
}

function readSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function writeWrapped(filePath, rows, key) {
  const wrapper = { rows: { [key]: rows } };
  fs.writeFileSync(filePath, JSON.stringify(wrapper, null, 2), 'utf8');
  console.log(`  wrote ${filePath} (${rows.length} rows)`);
}

// The Key Active Risks sheet's "Linked Principal Risk N" columns are free text and drift out
// of sync with the Enduring & Principal Risks sheet's canonical names (e.g. missing "or AI"),
// so an exact-string lookup misses real matches. Score by shared significant words instead.
const MATCH_STOPWORDS = new Set(['with', 'that', 'this', 'from', 'into', 'their', 'which', 'also', 'failure', 'and', 'or', 'to', 'of', 'in', 'by', 'a', 'an', 'the', 'is', 'are', 'for', 'our', 'on', 'as', 'at', 'be']);
function significantWords(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 2 && !MATCH_STOPWORDS.has(w));
}
function resolveEnduringRiskNumber(linkedName, epRaw) {
  const target = significantWords(linkedName);
  let best = null;
  let bestScore = 0;
  for (const ep of epRaw) {
    if (String(ep['Enduring Risk']).trim().toLowerCase() === String(linkedName).trim().toLowerCase()) return Number(ep['Enduring Risk Number']);
    const overlap = target.filter((w) => significantWords(ep['Enduring Risk']).includes(w)).length;
    if (overlap > bestScore) { bestScore = overlap; best = ep; }
  }
  return best ? Number(best['Enduring Risk Number']) : null;
}

const MITIGATION_COLS = [1, 2, 3, 4, 5, 6];
function buildMitigationList(r) {
  return MITIGATION_COLS
    .map((n) => {
      const text = String(r[`Mitigation ${n}`] || '').trim();
      if (!text) return null;
      const update = String(r[`Mitigation ${n} Update`] || '').trim();
      return `• ${text}${update ? ` (Update: ${update})` : ''}`;
    })
    .filter(Boolean)
    .join('\n');
}

function refresh() {
  console.log(`Reading ${SOURCE_WORKBOOK} ...`);
  const workbook = XLSX.readFile(SOURCE_WORKBOOK);

  const emergingRisksRaw = readSheet(workbook, 'Emerging Risks');
  const emergingClustersRaw = readSheet(workbook, 'Emerging Risk Clusters');
  const epRaw = readSheet(workbook, 'Enduring & Principal Risks');
  const karRaw = readSheet(workbook, 'Key Active Risks');

  // ---- Emerging Risk Clusters -> e_bridge_risk_clusters.json ----
  console.log('Building e_bridge_risk_clusters.json...');
  const clusterNameById = {};
  const clusterRows = emergingClustersRaw.map((r) => {
    const id = Number(r['Cluster ID']);
    clusterNameById[String(id)] = r['Cluster'];
    return {
      'Cluster ID': id,
      'Cluster': r['Cluster'],
      'Risk Statement': r['Risk Statement'],
      'Why Emerging': r['Why Emerging'],
      'Action': r['Action'],
      'Action Detail': r['Action Detail'],
      'Time to Active Management': r['Time to Active Management'],
      'Potential Impact Rating': r['Potential Impact Rating'],
      'Potential Enterprise Impact': r['Potential Enterprise Impact'],
      'Key Active Triggers': r['Key Active Triggers'],
      'Mapped Emerging Risk IDs': r['Mapped Emerging Risk IDs'],
      'Related SET Areas': r['Related SET Areas'],
      'Science and Innovation': r['Science and Innovation'],
      'People and Sustainability': r['People and Sustainability'],
      'Growth and Therapy Area Leadership': r['Growth and Therapy Area Leadership'],
      'Achieve Group Financial Targets': r['Achieve Group Financial Targets']
    };
  });
  writeWrapped(path.join(DATA_FOLDER, 'e_bridge_risk_clusters.json'), clusterRows, 'rows');

  // ---- Emerging Risks -> e_dim_risk.json ----
  console.log('Building e_dim_risk.json...');
  const emergingRows = emergingRisksRaw.map((r) => {
    const id = r['ID'];
    const clusterMapping = String(r['Cluster Mapping']);
    return {
      'ER_ID': Number(id),
      'ID': String(id),
      'Emerging Risk': r['Emerging Risk'],
      'SET Risk Owner': r['SET Risk Owner'],
      'Risk Statement': r['Risk Statement'],
      'Science and Innovation': r['Science and Innovation'],
      'People and Sustainability': r['People and Sustainability'],
      'Growth and Therapy Area Leadership': r['Growth and Therapy Area Leadership'],
      'Achieve Group Financial Targets': r['Achieve Group Financial Targets'],
      'Thematic Category': r['Thematic Category'],
      'Potential Impact': r['Potential Impact'],
      'Overall Risk': r['Overall Risk'],
      'Time to Active Management': r['Time to Active Management'],
      'Previous Potential Impact': r['Previous Potential Impact'] || '',
      'Previous Time to Active Management': r['Previous Time to Active Management'] || '',
      'Action': r['Action'] || '',
      'Status Update': r['Status Update'] || '',
      'Action Status': '',
      'Why Emerging Now': r['Why Emerging Now'],
      'Potential Enterprise Impact': r['Potential Enterprise Impact'],
      'Key Active Risk Triggers': r['Key Active Risk Triggers'],
      'Cluster Mapping': clusterMapping,
      'ER_Cluster': clusterNameById[clusterMapping] || ''
    };
  });
  writeWrapped(path.join(DATA_FOLDER, 'e_dim_risk.json'), emergingRows, 'body');
  writeWrapped(path.join(__dirname, 'data.json'), emergingRows, 'body');

  // ---- Enduring & Principal Risks -> ep-dim-risktest.json ----
  console.log('Building ep-dim-risktest.json...');
  const epRows = epRaw.map((r) => {
    const linkedKars = [
      r['Linked Key Active Risk 1'], r['Linked Key Active Risk 2'],
      r['Linked Key Active Risk 3'], r['Linked Key Active Risk 4']
    ].filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
    return {
      'Enduring Risk Number': Number(r['Enduring Risk Number']),
      'Enduring Risk': r['Enduring Risk'],
      'Short Name': r['Short Name'],
      'SET Risk Owner': r['SET Risk Owner'],
      'Risk Statement': r['Risk Statement'],
      'Risk Category': r['Risk Category'],
      'Principal Risk?': r['Principal Risk?'],
      'Risk Type': r['Principal Risk?'] === 'Yes' ? 'Principal' : 'Endurance',
      'Trend': r['Trend'],
      'Current Year Update': r['Current Year Update'],
      'Count of Linked KAR': linkedKars.length,
      'Current Impact_Level': expandLevel(r['Current Impact']),
      'Current Likelihood_Level': expandLevel(r['Current Likelihood']),
      'Gross Impact_Level': expandLevel(r['Gross Impact']),
      'Gross Likelihood_Level': expandLevel(r['Gross Likelihood']),
      'Science and Innovation': r['Science and Innovation'],
      'People and Sustainability': r['People and Sustainability'],
      'Growth and Therapy Area Leadership': r['Growth and Therapy Area Leadership'],
      'Achieve Group Financial Targets': r['Achieve Group Financial Targets']
    };
  });
  writeWrapped(path.join(DATA_FOLDER, 'ep-dim-risktest.json'), epRows, 'rows');

  // ---- Enduring & Principal Risks (Linked Key Active Risk 1-4) -> ep-kar-links.json ----
  console.log('Building ep-kar-links.json...');
  const linkRows = [];
  for (const r of epRaw) {
    for (const col of ['Linked Key Active Risk 1', 'Linked Key Active Risk 2', 'Linked Key Active Risk 3', 'Linked Key Active Risk 4']) {
      const kar = r[col];
      if (kar !== undefined && kar !== null && String(kar).trim() !== '') {
        linkRows.push({ 'Short Name': r['Short Name'], 'Key Active Risk': kar });
      }
    }
  }
  writeWrapped(path.join(DATA_FOLDER, 'ep-kar-links.json'), linkRows, 'rows');

  // ---- Key Active Risks -> k-dim-risk.json ----
  console.log('Building k-dim-risk.json...');
  const LINKED_PRINCIPAL_RISK_COLS = ['Linked Principal Risk 1', 'Linked Principal Risk 2', 'Linked Principal Risk 3', 'Linked Principal Risk 4', 'Linked Principal Risk 5'];
  const karRows = karRaw.map((r, i) => {
    const linkedPrincipalRisks = LINKED_PRINCIPAL_RISK_COLS
      .map((col) => r[col])
      .filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
    const linkedPrincipalRiskIds = [...new Set(
      linkedPrincipalRisks.map((name) => resolveEnduringRiskNumber(name, epRaw)).filter((id) => id != null)
    )].sort((a, b) => a - b);
    return {
      'KAR_ID': i + 1,
      'Key Active Risk': r['Key Active Risk'],
      'SET Risk Owner': r['SET Risk Owner'],
      'Risk Statement': r['Risk Statement'],
      'Science and Innovation': r['Science and Innovation'],
      'People and Sustainability': r['People and Sustainability'],
      'Growth and Therapy Area Leadership': r['Growth and Therapy Area Leadership'],
      'Achieve Group Financial Targets': r['Achieve Group Financial Targets'],
      'Current Impact': r['Current Impact'],
      'Current Likelihood': r['Current Likelihood'],
      'Overall Risk': r['Overall Risk'],
      'Trend': r['Trend'],
      'Action': r['Action'] || '',
      'Quarterly Update': r['Quarterly Update'] || '',
      'KAR Mitigation List': buildMitigationList(r),
      'Linked Principal Risk Count': linkedPrincipalRisks.length,
      'Linked Principal Risks': linkedPrincipalRisks.join('; '),
      'Linked Principal Risk IDs': linkedPrincipalRiskIds.join(', ')
    };
  });
  writeWrapped(path.join(DATA_FOLDER, 'k-dim-risk.json'), karRows, 'rows');

  console.log('Done.');
}

module.exports = { refresh };

if (require.main === module) {
  refresh();
}
