Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = "C:\Users\khnq757\OneDrive - AZCollaboration\Shortcuts\Terence Intenal - Documents\Risk_Test"
objShell.Run "cmd /c node watch-and-sync.js >> watcher.log 2>&1", 0, False
