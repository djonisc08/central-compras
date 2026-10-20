# Atualiza a Central de Compras (programa novo do GitHub) SEM mexer nos dados, e reinicia.
#   powershell -ExecutionPolicy Bypass -File .\atualizar.ps1
$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $pasta
Write-Host "1/3 Baixando a versao nova..." -ForegroundColor Cyan
git pull
if ($LASTEXITCODE -ne 0) { Write-Host "Falhou o git pull. Mande um print para o Claude." -ForegroundColor Red; Read-Host "Enter para fechar"; exit 1 }
Write-Host "2/3 Conferindo dependencias..." -ForegroundColor Cyan
npm install --no-audit --no-fund
Write-Host "3/3 Reiniciando..." -ForegroundColor Cyan
& (Join-Path $pasta "reiniciar.ps1")
Start-Sleep -Seconds 3
