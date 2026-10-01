param([Parameter(Mandatory = $true)][string]$OutputDirectory)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = "Seleccione la configuración privada del negocio"
$dialog.Filter = "Configuración JSON (*.json)|*.json"
$dialog.CheckFileExists = $true
if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 2 }

$sourceFile = $dialog.FileName
$config = Get-Content -LiteralPath $sourceFile -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($name in @("businessName", "supabaseUrl", "supabaseAnonKey", "deviceEmail", "devicePassword", "localApiToken")) {
  if (-not $config.$name -or [string]$config.$name -match "REEMPLAZAR|TU-PROYECTO") {
    [System.Windows.Forms.MessageBox]::Show("Falta $name en el archivo privado.", "Configuración incompleta") | Out-Null
    exit 3
  }
}
if ([string]$config.localApiToken -notmatch '^.{32,}$') {
  [System.Windows.Forms.MessageBox]::Show("localApiToken necesita al menos 32 caracteres.", "Configuración incompleta") | Out-Null
  exit 3
}

$printers = @(Get-Printer | Select-Object -ExpandProperty Name)
if ($printers.Count -eq 0) {
  [System.Windows.Forms.MessageBox]::Show("Windows no tiene una impresora instalada.", "Impresora no encontrada") | Out-Null
  exit 4
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "PrintRocket - Elegir impresora USB"
$form.Size = New-Object System.Drawing.Size(470, 190)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false

$label = New-Object System.Windows.Forms.Label
$label.Text = "Seleccione la impresora térmica de $($config.businessName):"
$label.AutoSize = $true
$label.Location = New-Object System.Drawing.Point(20, 22)
$form.Controls.Add($label)

$combo = New-Object System.Windows.Forms.ComboBox
$combo.DropDownStyle = "DropDownList"
$combo.Location = New-Object System.Drawing.Point(20, 55)
$combo.Width = 420
foreach ($printer in $printers) { [void]$combo.Items.Add($printer) }
$selected = $combo.Items.IndexOf([string]$config.printerName)
$combo.SelectedIndex = if ($selected -ge 0) { $selected } else { 0 }
$form.Controls.Add($combo)

$button = New-Object System.Windows.Forms.Button
$button.Text = "Guardar y continuar"
$button.Location = New-Object System.Drawing.Point(270, 100)
$button.Width = 170
$button.DialogResult = [System.Windows.Forms.DialogResult]::OK
$form.AcceptButton = $button
$form.Controls.Add($button)
if ($form.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 2 }

$config.printerName = [string]$combo.SelectedItem
if (-not $config.dashboardPort) { $config | Add-Member -NotePropertyName dashboardPort -NotePropertyValue 8790 }
if (-not $config.brandColor) { $config | Add-Member -NotePropertyName brandColor -NotePropertyValue "#2563eb" }
if (-not $config.allowedOrigins) { $config | Add-Member -NotePropertyName allowedOrigins -NotePropertyValue @() }
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

if ($config.logoPath) {
  $logo = [string]$config.logoPath
  if (-not [System.IO.Path]::IsPathRooted($logo)) { $logo = Join-Path (Split-Path $sourceFile) $logo }
  if (Test-Path -LiteralPath $logo) {
    $logoDestination = Join-Path $OutputDirectory ("logo" + [System.IO.Path]::GetExtension($logo).ToLowerInvariant())
    Copy-Item -LiteralPath $logo -Destination $logoDestination -Force
    $config.logoPath = $logoDestination
  } else {
    $config.logoPath = ""
  }
}

$configFile = Join-Path $OutputDirectory "config.json"
$json = $config | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($configFile, $json, (New-Object System.Text.UTF8Encoding($false)))
& (Join-Path $PSScriptRoot "..\node.exe") (Join-Path $PSScriptRoot "..\src\check-config.js") $configFile
if ($LASTEXITCODE -ne 0) {
  Remove-Item -LiteralPath $configFile -Force
  [System.Windows.Forms.MessageBox]::Show("La configuración privada no pasó la validación. Revise la URL, el origen y las claves.", "Configuración inválida") | Out-Null
  exit 3
}

$port = [int]$config.dashboardPort
$urlShortcut = "[InternetShortcut]`r`nURL=http://127.0.0.1:$port/`r`n"
[System.IO.File]::WriteAllText((Join-Path $OutputDirectory "Panel Impresion.url"), $urlShortcut)

$acl = Get-Acl -LiteralPath $configFile
$acl.SetAccessRuleProtection($true, $false)
$system = New-Object System.Security.Principal.SecurityIdentifier("S-1-5-18")
$admins = New-Object System.Security.Principal.SecurityIdentifier("S-1-5-32-544")
$acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($system, "FullControl", "Allow")))
$acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($admins, "FullControl", "Allow")))
Set-Acl -LiteralPath $configFile -AclObject $acl
exit 0
