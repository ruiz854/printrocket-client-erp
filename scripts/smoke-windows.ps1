$ErrorActionPreference = "Stop"
function Show-InstallerDiagnostics {
  Get-Process | Where-Object { $_.ProcessName -match 'PrintRocket|powershell|nsis' } |
    Select-Object ProcessName, Id, Path | Format-Table -AutoSize | Out-String | Write-Output
  Get-Service PrintRocketClient -ErrorAction SilentlyContinue | Format-List * | Out-String | Write-Output
  $logDirectory = Join-Path $env:ProgramData "PrintRocket\logs"
  if (Test-Path $logDirectory) {
    Get-ChildItem $logDirectory -File | ForEach-Object {
      Write-Output "Log: $($_.FullName)"
      Get-Content $_.FullName -Tail 25 -ErrorAction SilentlyContinue
    }
  }
}
function Invoke-Setup([string]$path, [string]$label) {
  Write-Output "Iniciando: $label"
  $process = Start-Process -FilePath $path -ArgumentList "/S" -PassThru
  if (-not $process.WaitForExit(60000)) {
    Show-InstallerDiagnostics
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    throw "$label excedió 60 segundos"
  }
  if ($process.ExitCode -ne 0) {
    Show-InstallerDiagnostics
    throw "$label falló: $($process.ExitCode)"
  }
  Write-Output "Completado: $label"
}
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$programDataDirectory = Join-Path $env:ProgramData "PrintRocket"
New-Item -ItemType Directory -Path $programDataDirectory -Force | Out-Null
$config = @{
  businessName = "Prueba CI"
  printerName = "Impresora ficticia"
  supabaseUrl = "https://example.supabase.co"
  supabaseAnonKey = "sb_publishable_fake"
  deviceEmail = "printer@example.com"
  devicePassword = "fakepassword"
  allowedOrigins = @("https://erp.example.com")
  localApiToken = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  dashboardPort = 8790
} | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText((Join-Path $programDataDirectory "config.json"), $config, (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText((Join-Path $programDataDirectory "Panel Impresion.url"), "[InternetShortcut]`r`nURL=http://127.0.0.1:8790/`r`n")

$installer = Join-Path $root "dist\PrintRocketClient-Setup.exe"
Invoke-Setup $installer "Instalación inicial"

$bundledNode = Join-Path $env:ProgramFiles "PrintRocketClient\node.exe"
if (-not (Test-Path $bundledNode)) { throw "El instalador no incluyó Node.js" }

$status = $null
for ($i = 0; $i -lt 25; $i++) {
  try {
    $status = Invoke-RestMethod "http://127.0.0.1:8790/api/status" -TimeoutSec 2
    break
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $status -or $status.businessName -ne "Prueba CI") { throw "El panel no respondió después de instalar" }

$originalConfig = Get-Content (Join-Path $programDataDirectory "config.json") -Raw
$stateFile = Join-Path $programDataDirectory "state.json"
[System.IO.File]::WriteAllText($stateFile, '{"jobsPrinted":7,"jobsFailed":0,"lastJobId":"ci-upgrade"}')
Invoke-Setup $installer "Actualización"
if ((Get-Content (Join-Path $programDataDirectory "config.json") -Raw) -ne $originalConfig) { throw "La actualización alteró la configuración" }
if ((Get-Content $stateFile -Raw) -notmatch 'ci-upgrade') { throw "La actualización alteró el historial local" }
$status = $null
for ($i = 0; $i -lt 25; $i++) {
  try {
    $status = Invoke-RestMethod "http://127.0.0.1:8790/api/status" -TimeoutSec 2
    break
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $status) { throw "El panel no respondió después de actualizar" }

try {
  Invoke-WebRequest "http://127.0.0.1:8790/api/drawer/open" -Method Post -Headers @{ Origin = "https://evil.example.com"; "X-Local-Token" = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } -Body "{}" -UseBasicParsing | Out-Null
  throw "La API aceptó un origen no autorizado"
} catch [System.Net.WebException] {
  if ([int]$_.Exception.Response.StatusCode -ne 403) { throw }
}

$uninstaller = Join-Path $env:ProgramFiles "PrintRocketClient\Uninstall.exe"
Invoke-Setup $uninstaller "Desinstalación"
if ((Get-Content (Join-Path $programDataDirectory "config.json") -Raw) -ne $originalConfig) { throw "La desinstalación alteró la configuración" }

Write-Output "Instalación, panel, aislamiento local y conservación de configuración verificados."
