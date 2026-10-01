$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

$nodeVersion = "v24.11.1"
$nodeArchive = "node-$nodeVersion-win-x64.zip"
$build = Join-Path $root "build"
$app = Join-Path $build "app"
if (Test-Path $build) { Remove-Item $build -Recurse -Force }
New-Item -ItemType Directory -Path $app -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $app "windows") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $root "dist") -Force | Out-Null

Invoke-WebRequest "https://nodejs.org/dist/$nodeVersion/$nodeArchive" -OutFile (Join-Path $build $nodeArchive)
Invoke-WebRequest "https://nodejs.org/dist/$nodeVersion/SHASUMS256.txt" -OutFile (Join-Path $build "SHASUMS256.txt")
$expectedLine = Get-Content (Join-Path $build "SHASUMS256.txt") | Where-Object { $_ -match [regex]::Escape($nodeArchive) + '$' } | Select-Object -First 1
if (-not $expectedLine) { throw "No se encontró el hash oficial de Node.js" }
$expected = ($expectedLine -split '\s+')[0].ToLowerInvariant()
$actual = (Get-FileHash (Join-Path $build $nodeArchive) -Algorithm SHA256).Hash.ToLowerInvariant()
if ($expected -ne $actual) { throw "El ZIP de Node.js no coincide con el hash oficial" }

Expand-Archive (Join-Path $build $nodeArchive) -DestinationPath $build
Copy-Item (Join-Path $build "node-$nodeVersion-win-x64\node.exe") $app

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
& $nsis (Join-Path $root "windows\installer.nsi")
if ($LASTEXITCODE -ne 0) { throw "No se pudo compilar el instalador" }

Get-FileHash (Join-Path $root "dist\PrintRocketClient-Setup.exe") -Algorithm SHA256 |
  ForEach-Object { "$($_.Hash.ToLowerInvariant())  PrintRocketClient-Setup.exe" } |
  Set-Content -Path (Join-Path $root "dist\SHA256SUMS.txt") -Encoding ascii
