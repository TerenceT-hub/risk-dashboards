# Regenerates data/*.json from Data File.xlsx and, if anything actually changed,
# commits and pushes to both the AZ Enterprise repo (origin) and the public
# personal repo (personal-origin). Safe to run on a schedule: it's a no-op
# (no commit, no push) when the source workbook hasn't changed.
#
# Note: native commands (git/node) are never run with 2>&1 here -- PowerShell
# wraps their stderr lines as terminating NativeCommandErrors even on success
# (e.g. git's routine "Bypassed rule violations" push notice), which would
# otherwise abort this script after the first git command. Output is captured
# via stdout only; exit codes are checked explicitly instead.

$projectDir = "C:\Users\khnq757\OneDrive - AZCollaboration\Shortcuts\Terence Intenal - Documents\Risk_Test"
$gitExe = "C:\Users\khnq757\AppData\Local\GitHubDesktop\app-3.6.6\resources\app\git\cmd\git.exe"
$nodeExe = "C:\Program Files\nodejs\node.exe"
$logFile = Join-Path $projectDir "auto-refresh.log"

function Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Add-Content -Path $logFile -Value $line
}

function Run($exe, $exeArgs) {
    $output = & $exe @exeArgs 2>$null
    $output | ForEach-Object { Log "  $_" }
    return $LASTEXITCODE
}

Set-Location $projectDir
Log "---- Auto-refresh run starting ----"

$refreshExit = Run $nodeExe @('refresh-data.js')
if ($refreshExit -ne 0) {
    Log "ERROR: refresh-data.js exited with code $refreshExit. Aborting (source workbook may be open/locked)."
    exit 1
}

# Regenerates copilot-knowledge/*.md from the freshly refreshed data/*.json, so the
# Copilot Studio knowledge source documents never drift from the live dashboard data.
# These are gitignored (not published) -- re-upload to Copilot Studio is currently a
# manual step until an automated sync path (e.g. via SharePoint or an API) is set up.
$knowledgeExit = Run $nodeExe @('build-copilot-knowledge.js')
if ($knowledgeExit -ne 0) {
    Log "WARNING: build-copilot-knowledge.js exited with code $knowledgeExit."
}

$statusOutput = & $gitExe status --porcelain
if ([string]::IsNullOrWhiteSpace($statusOutput)) {
    Log "No changes detected. Nothing to publish."
    exit 0
}

Log "Changes detected:"
$statusOutput | ForEach-Object { Log "  $_" }

Run $gitExe @('add', '-A') | Out-Null
Run $gitExe @('commit', '-m', "Auto-refresh data from source workbook ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))") | Out-Null

$pushOriginExit = Run $gitExe @('push', 'origin', 'main')
$pushPersonalExit = Run $gitExe @('push', 'personal-origin', 'main')

if ($pushOriginExit -eq 0 -and $pushPersonalExit -eq 0) {
    Log "Published to origin and personal-origin."
} else {
    Log "WARNING: push exit codes -- origin: $pushOriginExit, personal-origin: $pushPersonalExit"
}
Log "---- Auto-refresh run finished ----"
