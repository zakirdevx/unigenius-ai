' Creates a "UniGenius AI" icon on your Desktop, and (optionally) starts it when Windows starts.
Option Explicit
Dim sh, fso, root, lnk, answer
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)

Sub MakeLink(folder)
  Set lnk = sh.CreateShortcut(folder & "\UniGenius AI.lnk")
  lnk.TargetPath = root & "\start-unigenius-hidden.vbs"
  lnk.WorkingDirectory = root
  lnk.Description = "UniGenius AI - Smart Student Assistant"
  If fso.FileExists(root & "\unigenius.ico") Then lnk.IconLocation = root & "\unigenius.ico"
  lnk.Save
End Sub

MakeLink sh.SpecialFolders("Desktop")
answer = MsgBox("A UniGenius AI icon was added to your Desktop." & vbCrLf & vbCrLf & _
                "Also start the server automatically when Windows starts?" & vbCrLf & _
                "(The app will then open faster. It runs hidden in the background.)", 36, "UniGenius AI")
If answer = 6 Then
  MakeLink sh.SpecialFolders("Startup")
  MsgBox "Done. UniGenius will start with Windows.", 64, "UniGenius AI"
End If
