@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -Command "$task = Get-ScheduledTask -TaskName 'YearconSaleService' -ErrorAction SilentlyContinue; if ($task) { Stop-ScheduledTask -TaskName 'YearconSaleService' -ErrorAction SilentlyContinue; Write-Host 'Stopped scheduled task YearconSaleService.' }; $conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($conn) { Stop-Process -Id $conn.OwningProcess -Force; Write-Host ('Stopped process ' + $conn.OwningProcess + ' on port 3000.') } else { Write-Host 'No process is listening on port 3000.' }"

pause
