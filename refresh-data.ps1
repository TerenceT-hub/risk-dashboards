<#
Refreshes Risk_Test/data/*.json from the master SharePoint/OneDrive workbook.
Opens the workbook read-only via Excel COM (nothing in the workbook is modified or saved).

Run this any time "Data File.xlsx" changes, then re-publish the Risk_Test files to GitHub.
#>

$ErrorActionPreference = 'Stop'

$SourceWorkbook = "C:\Users\khnq757\OneDrive - AZCollaboration\GFS Digital Delivery - 01. Requirements\Data File.xlsx"
$DataFolder = Join-Path $PSScriptRoot "data"

$LevelMap = @{ 'VH' = 'Very High'; 'H' = 'High'; 'M' = 'Medium'; 'L' = 'Low'; 'VL' = 'Very Low' }
function Expand-Level($abbr) {
  if ([string]::IsNullOrWhiteSpace($abbr)) { return '' }
  if ($LevelMap.ContainsKey($abbr)) { return $LevelMap[$abbr] }
  return $abbr
}

function Read-Sheet($ws) {
  $used = $ws.UsedRange
  $rowCount = $used.Rows.Count
  $colCount = $used.Columns.Count
  $headers = @()
  for ($c = 1; $c -le $colCount; $c++) { $headers += $ws.Cells.Item(1, $c).Text }

  $rows = @()
  for ($r = 2; $r -le $rowCount; $r++) {
    $row = [ordered]@{}
    for ($c = 1; $c -le $colCount; $c++) {
      $row[$headers[$c - 1]] = $ws.Cells.Item($r, $c).Text
    }
    $rows += [PSCustomObject]$row
  }
  return $rows
}

function Write-Wrapped($path, $rows, $key) {
  $wrapper = @{ rows = @{ $key = $rows } }
  $wrapper | ConvertTo-Json -Depth 10 | Set-Content -Path $path -Encoding UTF8
  Write-Output "  wrote $path ($($rows.Count) rows)"
}

Write-Output "Opening $SourceWorkbook (read-only)..."
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
  $wb = $excel.Workbooks.Open($SourceWorkbook, 0, $true)

  Write-Output "Reading sheets..."
  $emergingRisksRaw = Read-Sheet $wb.Sheets.Item("Emerging Risks")
  $emergingClustersRaw = Read-Sheet $wb.Sheets.Item("Emerging Risk Clusters")
  $epRaw = Read-Sheet $wb.Sheets.Item("Enduring & Principal Risks")
  $karRaw = Read-Sheet $wb.Sheets.Item("Key Active Risks")

  $wb.Close($false)
} finally {
  $excel.Quit()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
  [gc]::Collect()
}

# ---- Emerging Risk Clusters -> e_bridge_risk_clusters.json (already one row per cluster) ----
Write-Output "Building e_bridge_risk_clusters.json..."
$clusterNameById = @{}
$clusterRows = $emergingClustersRaw | ForEach-Object {
  $clusterNameById[$_.'Cluster ID'] = $_.'Cluster'
  [PSCustomObject]@{
    'Cluster ID'                          = [int]$_.'Cluster ID'
    'Cluster'                             = $_.'Cluster'
    'Risk Statement'                      = $_.'Risk Statement'
    'Why Emerging'                        = $_.'Why Emerging'
    'Action'                              = $_.'Action'
    'Action Detail'                       = $_.'Action Detail'
    'Time to Active Management'           = $_.'Time to Active Management'
    'Potential Impact Rating'             = $_.'Potential Impact Rating'
    'Potential Enterprise Impact'         = $_.'Potential Enterprise Impact'
    'Key Active Triggers'                 = $_.'Key Active Triggers'
    'Mapped Emerging Risk IDs'            = $_.'Mapped Emerging Risk IDs'
    'Related SET Areas'                   = $_.'Related SET Areas'
    'Science and Innovation'              = $_.'Science and Innovation'
    'People and Sustainability'           = $_.'People and Sustainability'
    'Growth and Therapy Area Leadership'  = $_.'Growth and Therapy Area Leadership'
    'Achieve Group Financial Targets'     = $_.'Achieve Group Financial Targets'
  }
}
Write-Wrapped (Join-Path $DataFolder "e_bridge_risk_clusters.json") $clusterRows "rows"

# ---- Emerging Risks -> e_dim_risk.json ----
Write-Output "Building e_dim_risk.json..."
$emergingRows = $emergingRisksRaw | ForEach-Object {
  $id = $_.'ID'
  [PSCustomObject]@{
    'ER_ID'                                = [int]$id
    'ID'                                   = "$id"
    'Emerging Risk'                        = $_.'Emerging Risk'
    'SET Risk Owner'                       = $_.'SET Risk Owner'
    'Risk Statement'                       = $_.'Risk Statement'
    'Science and Innovation'               = $_.'Science and Innovation'
    'People and Sustainability'            = $_.'People and Sustainability'
    'Growth and Therapy Area Leadership'   = $_.'Growth and Therapy Area Leadership'
    'Achieve Group Financial Targets'      = $_.'Achieve Group Financial Targets'
    'Thematic Category'                    = $_.'Thematic Category'
    'Potential Impact'                     = $_.'Potential Impact'
    'Overall Risk'                         = $_.'Overall Risk'
    'Time to Active Management'            = $_.'Time to Active Management'
    'Previous Potential Impact'            = $_.'Previous Potential Impact'
    'Previous Time to Active Management'   = $_.'Previous Time to Active Management'
    'Action'                               = $_.'Action'
    'Status Update'                        = $_.'Status Update'
    'Action Status'                        = ''
    'Why Emerging Now'                     = $_.'Why Emerging Now'
    'Potential Enterprise Impact'          = $_.'Potential Enterprise Impact'
    'Key Active Risk Triggers'             = $_.'Key Active Risk Triggers'
    'Cluster Mapping'                      = "$($_.'Cluster Mapping')"
    'ER_Cluster'                           = $clusterNameById[$_.'Cluster Mapping']
  }
}
Write-Wrapped (Join-Path $DataFolder "e_dim_risk.json") $emergingRows "body"
# data.json (repo root) mirrors e_dim_risk.json for the fallback data source
Write-Wrapped (Join-Path $PSScriptRoot "data.json") $emergingRows "body"

# ---- Enduring & Principal Risks -> ep-dim-risktest.json ----
Write-Output "Building ep-dim-risktest.json..."
$epRows = $epRaw | ForEach-Object {
  $linkedKars = @($_.'Linked Key Active Risk 1', $_.'Linked Key Active Risk 2', $_.'Linked Key Active Risk 3', $_.'Linked Key Active Risk 4') |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  [PSCustomObject]@{
    'Enduring Risk Number'                = [int]$_.'Enduring Risk Number'
    'Enduring Risk'                       = $_.'Enduring Risk'
    'Short Name'                          = $_.'Short Name'
    'SET Risk Owner'                      = $_.'SET Risk Owner'
    'Risk Statement'                      = $_.'Risk Statement'
    'Risk Category'                       = $_.'Risk Category'
    'Principal Risk?'                     = $_.'Principal Risk?'
    'Risk Type'                           = if ($_.'Principal Risk?' -eq 'Yes') { 'Principal' } else { 'Endurance' }
    'Trend'                               = $_.'Trend'
    'Current Year Update'                 = $_.'Current Year Update'
    'Count of Linked KAR'                 = $linkedKars.Count
    'Current Impact_Level'                = Expand-Level $_.'Current Impact'
    'Current Likelihood_Level'            = Expand-Level $_.'Current Likelihood'
    'Gross Impact_Level'                  = Expand-Level $_.'Gross Impact'
    'Gross Likelihood_Level'              = Expand-Level $_.'Gross Likelihood'
    'Science and Innovation'              = $_.'Science and Innovation'
    'People and Sustainability'           = $_.'People and Sustainability'
    'Growth and Therapy Area Leadership'  = $_.'Growth and Therapy Area Leadership'
    'Achieve Group Financial Targets'     = $_.'Achieve Group Financial Targets'
  }
}
Write-Wrapped (Join-Path $DataFolder "ep-dim-risktest.json") $epRows "rows"

# ---- Enduring & Principal Risks (Linked Key Active Risk 1-4) -> ep-kar-links.json ----
Write-Output "Building ep-kar-links.json..."
$linkRows = @()
foreach ($row in $epRaw) {
  foreach ($col in @('Linked Key Active Risk 1', 'Linked Key Active Risk 2', 'Linked Key Active Risk 3', 'Linked Key Active Risk 4')) {
    $kar = $row.$col
    if (-not [string]::IsNullOrWhiteSpace($kar)) {
      $linkRows += [PSCustomObject]@{ 'Short Name' = $row.'Short Name'; 'Key Active Risk' = $kar }
    }
  }
}
Write-Wrapped (Join-Path $DataFolder "ep-kar-links.json") $linkRows "rows"

# ---- Key Active Risks -> k-dim-risk.json ----
Write-Output "Building k-dim-risk.json..."
$karId = 0
$karRows = $karRaw | ForEach-Object {
  $karId++
  [PSCustomObject]@{
    'KAR_ID'          = $karId
    'Key Active Risk' = $_.'Key Active Risk'
    'SET Risk Owner'  = $_.'SET Risk Owner'
    'Risk Statement'  = $_.'Risk Statement'
    'Current Impact'  = $_.'Current Impact'
    'Current Likelihood' = $_.'Current Likelihood'
    'Trend'           = $_.'Trend'
  }
}
Write-Wrapped (Join-Path $DataFolder "k-dim-risk.json") $karRows "rows"

Write-Output "Done."
