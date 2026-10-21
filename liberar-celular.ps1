# Libera a Central de Compras para o celular na rede do escritório/casa (firewall do Windows).
# Pede permissão de administrador uma vez.
$regra = "Central de Compras (celular)"
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`""
  exit
}
Get-NetFirewallRule -DisplayName $regra -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $regra -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private,Domain | Out-Null
Write-Host "Pronto! O celular no mesmo Wi-Fi ja pode abrir a Central de Compras." -ForegroundColor Green
Write-Host "Veja o endereco e o QR Code em Configuracoes > Abrir no celular."
Start-Sleep -Seconds 5
