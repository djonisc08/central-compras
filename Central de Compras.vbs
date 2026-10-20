' Central de Compras: liga o sistema escondido (sem janela) e abre o navegador.
' Se ja estiver ligado, so abre o navegador. Com /inicio (ao ligar o Windows) nao abre o navegador.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
sh.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)

If Not Rodando() Then
  sh.Run "cmd /c npm run --silent backup > data\backup.log 2>&1 & npm run dev > data\servidor.log 2>&1", 0, False
  For i = 1 To 60
    WScript.Sleep 1000
    If Rodando() Then Exit For
  Next
End If

abrir = True
For Each a In WScript.Arguments
  If LCase(a) = "/inicio" Then abrir = False
Next
If abrir Then sh.Run "http://localhost:3000"

Function Rodando()
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.setTimeouts 1500, 1500, 1500, 3000
  http.Open "GET", "http://localhost:3000/", False
  http.Send
  Rodando = (Err.Number = 0 And http.Status = 200)
  Err.Clear
End Function
