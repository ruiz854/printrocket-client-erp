$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

$nodeVersion = "v24.11.1"
$build = Join-Path $root "build"
$app = Join-Path $build "app"
if (Test-Path $build) { Remove-Item $build -Recurse -Force }
New-Item -ItemType Directory -Path $app -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $app "windows") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $root "dist") -Force | Out-Null

$activeNodeVersion = node --version
if ($activeNodeVersion -ne $nodeVersion) { throw "La compilación requiere Node.js $nodeVersion" }
$nodeBinary = (Get-Command node).Source
Copy-Item $nodeBinary (Join-Path $app "node.exe")
$nodeLicense = Join-Path (Split-Path $nodeBinary) "LICENSE"
if (Test-Path $nodeLicense) { Copy-Item $nodeLicense (Join-Path $app "NODE-LICENSE.txt") }

Invoke-WebRequest "https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe" -OutFile (Join-Path $app "PrintRocketService.exe")
Copy-Item (Join-Path $root "windows\PrintRocketService.xml") $app
Copy-Item (Join-Path $root "src") (Join-Path $app "src") -Recurse
Copy-Item (Join-Path $root "windows\print.ps1") (Join-Path $app "windows")
Copy-Item (Join-Path $root "windows\configure.ps1") (Join-Path $app "windows")

npm ci --omit=dev
if ($LASTEXITCODE -ne 0) { throw "npm ci falló" }
Copy-Item (Join-Path $root "node_modules") (Join-Path $app "node_modules") -Recurse

node --test
if ($LASTEXITCODE -ne 0) { throw "Las pruebas fallaron" }

$nsis = "${env:ProgramFiles(x86)}\NSIS\makensis.exe"
if (-not (Test-Path $nsis)) { throw "No se encontró makensis.exe en $nsis" }
$nsisOutput = & $nsis (Join-Path $root "windows\installer.nsi") 2>&1
$nsisOutput | Write-Output
if ($LASTEXITCODE -ne 0) { throw "No se pudo compilar el instalador" }
if ($nsisOutput -match 'warning 6000') { throw "NSIS encontró una variable o constante desconocida" }

Get-FileHash (Join-Path $root "dist\PrintRocketClient-Setup.exe") -Algorithm SHA256 |
  ForEach-Object { "$($_.Hash.ToLowerInvariant())  PrintRocketClient-Setup.exe" } |
  Set-Content -Path (Join-Path $root "dist\SHA256SUMS.txt") -Encoding ascii
