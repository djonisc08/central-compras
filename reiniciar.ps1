# Reinicia a Central de Compras: desliga o servidor desta pasta e liga de novo (escondido).
#   powershell -ExecutionPolicy Bypass -File .\reiniciar.ps1
$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
$alvo = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -and (($_.CommandLine -like "*$pasta*" -and $_.CommandLine -match "next") -or $_.CommandLine -match "servir\.mjs") }
foreach ($p in $alvo) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
Write-Host "Servidor desligado ($(@($alvo).Count) processo(s)). Ligando de novo (se o programa mudou, leva 1 a 2 minutos)..."
Start-Sleep -Seconds 2
Start-Process "$env:WINDIR\System32\wscript.exe" -ArgumentList ('"' + (Join-Path $pasta "Central de Compras.vbs") + '"')
for ($i = 0; $i -lt 240; $i++) {
  Start-Sleep -Seconds 1
  try { if ((Invoke-WebRequest http://localhost:3000/ -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { Write-Host "Central de Compras no ar: http://localhost:3000" -ForegroundColor Green; exit 0 } } catch {}
}
Write-Host "Nao respondeu em 4 minutos. Veja data\servidor.log" -ForegroundColor Red
exit 1
