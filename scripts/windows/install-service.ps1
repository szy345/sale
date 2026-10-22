$ErrorActionPreference = 'Stop'
$taskName = 'YearconSaleService'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host 'Please run PowerShell as Administrator.' -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  Write-Host 'Node.js not found. Please install Node.js 24 LTS first.' -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}

$nodeVersion = (& $nodeCommand.Source -p "process.versions.node")
$nodeMajor = [int]($nodeVersion.Split('.')[0])
if ($nodeMajor -lt 24) {
  Write-Host "Node.js $nodeVersion found. Version 24 or newer is required." -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}

if (-not (Test-Path (Join-Path $root 'public\index.html'))) {
  Write-Host 'Frontend build not found. Please run scripts\windows\setup.bat first.' -ForegroundColor Yellow
  Read-Host 'Press Enter to exit'
  exit 1
}

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute $nodeCommand.Source -Argument 'server\index.js' -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 5 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description 'Yearcon Sales Service System Web Service' `
  -Force | Out-Null

Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 2

Write-Host ''
Write-Host 'Windows startup task installed and started.' -ForegroundColor Green
Write-Host "Task name: $taskName"
Write-Host "Program:   $root"
Write-Host 'Local URL: http://localhost:3000'
Write-Host ''
Write-Host 'LAN URLs:'
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' } |
  ForEach-Object { Write-Host ("  http://{0}:3000" -f $_.IPAddress) }
Write-Host ''
Write-Host 'If other computers cannot connect, run scripts\windows\open-firewall.ps1 as Administrator.'
Read-Host 'Press Enter to exit'
