$ErrorActionPreference = 'Stop'
$taskName = 'YearconSaleService'

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host 'Please run PowerShell as Administrator.' -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $task) {
  Write-Host 'Service task not found. Nothing to remove.' -ForegroundColor Yellow
  Read-Host 'Press Enter to exit'
  exit 0
}

Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Host 'Windows startup task removed. Database files remain in the data directory.' -ForegroundColor Green
Read-Host 'Press Enter to exit'
