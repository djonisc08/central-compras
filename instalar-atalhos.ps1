# Cria os atalhos da Central de Compras (rode uma vez):
#   - "Central de Compras" na Area de Trabalho (abre o sistema)
#   - liga o sistema escondido sempre que o Windows iniciar
$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbs = Join-Path $pasta "Central de Compras.vbs"
$ws = New-Object -ComObject WScript.Shell
$destinos = @(
  @{ arquivo = Join-Path ([Environment]::GetFolderPath("Desktop")) "Central de Compras.lnk"; args = "" },
  @{ arquivo = Join-Path ([Environment]::GetFolderPath("Startup")) "Central de Compras.lnk"; args = " /inicio" }
)
foreach ($d in $destinos) {
  $s = $ws.CreateShortcut($d.arquivo)
  $s.TargetPath = "$env:WINDIR\System32\wscript.exe"
  $s.Arguments = '"' + $vbs + '"' + $d.args
  $s.WorkingDirectory = $pasta
  $s.IconLocation = "$env:WINDIR\System32\shell32.dll,12"
  $s.Save()
}
Write-Host "Pronto! Atalho na Area de Trabalho e inicio automatico com o Windows." -ForegroundColor Green
Start-Process $vbs
