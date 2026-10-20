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
$atualizar = Join-Path ([Environment]::GetFolderPath("Desktop")) "Atualizar Central de Compras.lnk"
$a = $ws.CreateShortcut($atualizar)
$a.TargetPath = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"
$a.Arguments = '-ExecutionPolicy Bypass -File "' + (Join-Path $pasta "atualizar.ps1") + '"'
$a.WorkingDirectory = $pasta
$a.IconLocation = "$env:WINDIR\System32\shell32.dll,238"
$a.Save()
$entrada = Join-Path ([Environment]::GetFolderPath("Desktop")) "Orcamentos para importar.lnk"
New-Item -ItemType Directory -Force (Join-Path $pasta "entrada") | Out-Null
$e = $ws.CreateShortcut($entrada)
$e.TargetPath = Join-Path $pasta "entrada"
$e.Save()
foreach ($d in $destinos) {
  $s = $ws.CreateShortcut($d.arquivo)
  $s.TargetPath = "$env:WINDIR\System32\wscript.exe"
  $s.Arguments = '"' + $vbs + '"' + $d.args
  $s.WorkingDirectory = $pasta
  $s.IconLocation = "$env:WINDIR\System32\shell32.dll,12"
  $s.Save()
}
Write-Host "Pronto! Atalhos na Area de Trabalho (abrir, atualizar, pasta de orcamentos) e inicio automatico com o Windows." -ForegroundColor Green
Start-Process $vbs
