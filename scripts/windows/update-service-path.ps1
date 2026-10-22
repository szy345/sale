param(
  [Parameter(Mandatory = $true)]
  [string]$Root,
  [Parameter(Mandatory = $true)]
  [string]$NodePath
)

$ErrorActionPreference = 'Stop'
$taskName = 'YearconSaleService'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $task) {
  Write-Output 'not-installed'
  exit 2
}

$action = New-ScheduledTaskAction -Execute $NodePath -Argument 'server\index.js' -WorkingDirectory $Root
Set-ScheduledTask -TaskName $taskName -Action $action | Out-Null
Write-Output 'updated'
exit 0
