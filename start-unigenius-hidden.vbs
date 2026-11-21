' UniGenius AI launcher: starts the server with NO black window, then opens the app.
Option Explicit
Dim sh, fso, root, i, url
url = "http://localhost:5000"
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)

Function ServerIsUp()
  Dim http
  ServerIsUp = False
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.setTimeouts 1000, 1000, 1000, 1000
  http.open "GET", url & "/api/health", False
  http.send
  If Err.Number = 0 Then
    If http.status = 200 Then ServerIsUp = True
  End If
  On Error GoTo 0
End Function

Function ChromePath()
  Dim p
  ChromePath = ""
  On Error Resume Next
  p = sh.RegRead("HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe\")
  If Err.Number <> 0 Then
    Err.Clear
    p = sh.RegRead("HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe\")
  End If
  If Err.Number = 0 Then ChromePath = p
  On Error GoTo 0
End Function

If Not fso.FileExists(root & "\client\dist\index.html") Then
  MsgBox "First-time setup is not finished yet." & vbCrLf & vbCrLf & _
         "Double-click  build-app.bat  once, wait until it says DONE, then open this file again.", 48, "UniGenius AI"
  WScript.Quit
End If

If Not ServerIsUp() Then
  sh.CurrentDirectory = root & "\server"   ' the server reads its .env file from this folder
  sh.Run "cmd /c node index.js >> """ & root & "\unigenius.log"" 2>&1", 0, False
  For i = 1 To 30
    WScript.Sleep 500
    If ServerIsUp() Then Exit For
  Next
  If Not ServerIsUp() Then
    MsgBox "The server did not start." & vbCrLf & vbCrLf & _
           "Open the file unigenius.log in the UniGenius folder and send its text to Claude.", 16, "UniGenius AI"
    WScript.Quit
  End If
End If

' Open as an app window (no tabs, no address bar). Chrome if installed, otherwise Edge.
Dim chrome
chrome = ChromePath()
If chrome <> "" Then
  sh.Run """" & chrome & """ --app=" & url, 1, False
Else
  sh.Run "msedge --app=" & url, 1, False
End If
