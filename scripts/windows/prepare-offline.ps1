param(
  [string]$OutputPath = (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) '..\yearcon-offline'),
  [switch]$Zip
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $root

if ($env:OS -ne 'Windows_NT') {
  throw 'This script must be run on Windows.'
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  throw 'Node.js not found. Install Node.js 24 LTS first.'
}
$nodeVersion = (& $nodeCommand.Source -p "process.versions.node")
$nodeMajor = [int]($nodeVersion.Split('.')[0])
if ($nodeMajor -lt 24) {
  throw "Node.js $nodeVersion found. Version 24 or newer is required."
}

if (-not (Test-Path 'node_modules')) {
  throw 'node_modules not found. Run npm ci on this online computer first.'
}

Write-Host '[1/3] Building frontend...'
& npm run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }

$out = [System.IO.Path]::GetFullPath($OutputPath)
if (Test-Path $out) {
  throw "Output folder already exists: $out. Remove it or use -OutputPath."
}

Write-Host "[2/3] Copying project files to $out ..."
New-Item -ItemType Directory -Path $out | Out-Null
$items = @(
  'package.json',
  'package-lock.json',
  '.npmrc',
  'config.json',
  'config.example.json',
  'README.md',
  'vite.config.js',
  'server',
  'client',
  'scripts',
  'public'
)
foreach ($item in $items) {
  if (Test-Path $item) {
    Copy-Item -Path $item -Destination $out -Recurse -Force
  }
}

$offlineReadmeSource = Join-Path $PSScriptRoot 'OFFLINE-README.txt'
if (Test-Path $offlineReadmeSource) {
  Copy-Item -Path $offlineReadmeSource -Destination (Join-Path $out 'OFFLINE-README.txt') -Force
}

$portableStart = Join-Path $out 'scripts\windows\start-portable.bat'
if (Test-Path $portableStart) {
  Copy-Item -Path $portableStart -Destination (Join-Path $out 'start-portable.bat') -Force
}

$rootStart = Join-Path $out 'scripts\windows\offline-root-start.bat'
if (Test-Path $rootStart) {
  Copy-Item -Path $rootStart -Destination (Join-Path $out 'start.bat') -Force
}

Write-Host '[3/3] Installing production dependencies into offline package...'
Push-Location $out
try {
  & npm ci --omit=dev --ignore-scripts
  if ($LASTEXITCODE -ne 0) { throw 'Production dependency installation failed.' }
}
finally {
  Pop-Location
}

if ($Zip) {
  $zipPath = "$out.zip"
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Write-Host 'Creating zip file...'
  Compress-Archive -Path (Join-Path $out '*') -DestinationPath $zipPath -CompressionLevel Optimal
  Write-Host "Offline zip created: $zipPath" -ForegroundColor Green
}

Write-Host ''
Write-Host 'Offline package created successfully.' -ForegroundColor Green
Write-Host "Folder: $out"
Write-Host 'Copy this folder and the Node.js 24 installer to the offline Windows computer.'
