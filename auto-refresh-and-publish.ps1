# Regenerates data/*.json from Data File.xlsx and, if anything actually changed,
# commits and pushes to both the AZ Enterprise repo (origin) and the public
# personal repo (personal-origin). Safe to run on a schedule: it's a no-op
# (no commit, no push) when the source workbook hasn't changed.

$ErrorActionPreference = 'Stop'
$projectDir = "C:\Users\khnq757\OneDrive - AZCollaboration\Shortcuts\Terence Intenal - Documents\Risk_Test"
$gitExe = "C:\Users\khnq757\AppData\Local\GitHubDesktop\app-3.6.6\resources\app\git\cmd\git.exe"
$nodeExe = "C:\Program Files\nodejs\node.exe"
$logFile = Join-Path $projectDir "auto-refresh.log"

function Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Add-Content -Path $logFile -Value $line
}

Set-Location $projectDir
Log "---- Auto-refresh run starting ----"

try {
    $refreshOutput = & $nodeExe refresh-data.js 2>&1
    $refreshOutput | ForEach-Object { Log $_ }
} catch {
    Log "ERROR: refresh-data.js failed: $($_.Exception.Message)"
    exit 1
}

$statusOutput = & $gitExe status --porcelain
if ([string]::IsNullOrWhiteSpace($statusOutput)) {
    Log "No changes detected. Nothing to publish."
    exit 0
}

Log "Changes detected:"
$statusOutput | ForEach-Object { Log "  $_" }

& $gitExe add -A
& $gitExe commit -m "Auto-refresh data from source workbook ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))" 2>&1 | ForEach-Object { Log $_ }

& $gitExe push origin main 2>&1 | ForEach-Object { Log $_ }
& $gitExe push personal-origin main 2>&1 | ForEach-Object { Log $_ }

Log "Published to origin and personal-origin."
Log "---- Auto-refresh run finished ----"
