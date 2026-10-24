$WshShell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath("Desktop")

# Acceso directo: Panel Impresion Amazing
$Shortcut = $WshShell.CreateShortcut("$desktop\Panel Impresion Amazing.lnk")
$Shortcut.TargetPath = "http://localhost:8790"
$Shortcut.IconLocation = "C:\Windows\System32\shell32.dll,14"
$Shortcut.Save()

# Acceso directo: REPARAR Impresion Amazing
$Shortcut2 = $WshShell.CreateShortcut("$desktop\REPARAR Impresion Amazing.lnk")
$Shortcut2.TargetPath = "powershell.exe"
$Shortcut2.Arguments = '-NoProfile -ExecutionPolicy Bypass -Command "Restart-Service PrinterClientAmazing -Force"'
$Shortcut2.IconLocation = "C:\Windows\System32\shell32.dll,279"
$Shortcut2.Save()

Write-Output "Accesos directos creados en: $desktop"
