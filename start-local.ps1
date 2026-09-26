$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverPath = Join-Path $projectRoot "server.js"
$dataDirectory = Join-Path $projectRoot ".data"
$logPath = Join-Path $dataDirectory "server.log"
$nodePath = "C:\Users\Guts\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (-not (Test-Path $nodePath)) {
    $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
}

New-Item -ItemType Directory -Force -Path $dataDirectory | Out-Null
Set-Location $projectRoot
$env:HOST = "127.0.0.1"
$env:PORT = "4173"
$env:NODE_ENV = "development"
$env:DEMO_PAYMENTS = "true"

while ($true) {
    $listener = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue |
        Where-Object LocalAddress -eq "127.0.0.1" |
        Select-Object -First 1
    if ($listener) {
        Start-Sleep -Seconds 5
        continue
    }

    & $nodePath $serverPath *>> $logPath
    Start-Sleep -Seconds 3
}
