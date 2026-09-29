# Runs auto-refresh-and-publish.ps1 on a loop, forever, spawning a brand-new
# PowerShell/Node process every cycle. Unlike a long-lived watcher process that
# require()s refresh-data.js once and keeps that in-memory copy forever (the
# bug that caused months of stale data getting force-pushed over real fixes),
# each cycle here always reads the current file from disk fresh.

$scriptPath = "C:\Users\khnq757\OneDrive - AZCollaboration\Shortcuts\Terence Intenal - Documents\Risk_Test\auto-refresh-and-publish.ps1"
$intervalMinutes = 30

while ($true) {
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath
    Start-Sleep -Seconds ($intervalMinutes * 60)
}
