Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = "C:\Users\khnq757\OneDrive - AZCollaboration\Shortcuts\Terence Intenal - Documents\Risk_Test"
objShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File run-auto-refresh-loop.ps1", 0, False
