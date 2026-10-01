$ErrorActionPreference = "Stop"
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
$process = Start-Process -FilePath $installer -ArgumentList "/S" -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "Instalador falló: $($process.ExitCode)" }

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

try {
  Invoke-WebRequest "http://127.0.0.1:8790/api/drawer/open" -Method Post -Headers @{ Origin = "https://evil.example.com"; "X-Local-Token" = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } -Body "{}" -UseBasicParsing | Out-Null
  throw "La API aceptó un origen no autorizado"
} catch [System.Net.WebException] {
  if ([int]$_.Exception.Response.StatusCode -ne 403) { throw }
}

$originalConfig = Get-Content (Join-Path $programDataDirectory "config.json") -Raw
$uninstaller = Join-Path $env:ProgramFiles "PrintRocketClient\Uninstall.exe"
$process = Start-Process -FilePath $uninstaller -ArgumentList "/S" -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "Desinstalador falló: $($process.ExitCode)" }
if ((Get-Content (Join-Path $programDataDirectory "config.json") -Raw) -ne $originalConfig) { throw "La desinstalación alteró la configuración" }

Write-Output "Instalación, panel, aislamiento local y conservación de configuración verificados."
