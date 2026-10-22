$ErrorActionPreference = 'Stop'
$ruleName = 'Yearcon Sale System (TCP 3000)'

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host 'Please run PowerShell as Administrator.' -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}

Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule `
  -DisplayName $ruleName `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 3000 `
  -Profile Private, Domain | Out-Null

Write-Host 'TCP port 3000 is now allowed for Private and Domain networks.' -ForegroundColor Green
Write-Host 'Other LAN devices can access http://THIS-COMPUTER-IP:3000'
Read-Host 'Press Enter to exit'
