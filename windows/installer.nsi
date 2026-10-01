Unicode True
Name "PrintRocket Cliente ERP"
OutFile "dist\PrintRocketClient-Setup.exe"
InstallDir "$PROGRAMFILES64\PrintRocketClient"
RequestExecutionLevel admin
ShowInstDetails show
ShowUninstDetails show

!include "MUI2.nsh"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Spanish"

Section "Instalar" SecMain
  SetShellVarContext all
  IfFileExists "$INSTDIR\PrintRocketService.exe" 0 +2
    nsExec::ExecToLog '"$INSTDIR\PrintRocketService.exe" stop'
  SetOutPath "$INSTDIR"
  File /r "build\app\*"
  CreateDirectory "$PROGRAMDATA\PrintRocket\logs"
  IfFileExists "$PROGRAMDATA\PrintRocket\config.json" configured
    ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\windows\configure.ps1" -OutputDirectory "$PROGRAMDATA\PrintRocket"' $0
    IntCmp $0 0 configured
    MessageBox MB_ICONSTOP "No se importó una configuración válida. La instalación se detendrá."
    Abort
  configured:
  nsExec::ExecToStack 'sc.exe query PrintRocketClient'
  Pop $0
  Pop $1
  StrCmp $0 "0" installed
    nsExec::ExecToStack '"$INSTDIR\PrintRocketService.exe" install'
    Pop $0
    Pop $1
    StrCmp $0 "0" installed
      MessageBox MB_ICONSTOP "No se pudo registrar el servicio de Windows: $1"
      Abort
  installed:
  nsExec::ExecToStack '"$INSTDIR\PrintRocketService.exe" start'
  Pop $0
  Pop $1
  StrCmp $0 "0" started
    MessageBox MB_ICONSTOP "No se pudo iniciar el servicio de Windows: $1"
    Abort
  started:
  CopyFiles /SILENT "$PROGRAMDATA\PrintRocket\Panel Impresion.url" "$DESKTOP\Panel Impresion PrintRocket.url"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PrintRocketClient" "DisplayName" "PrintRocket Cliente ERP"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PrintRocketClient" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PrintRocketClient" "DisplayVersion" "0.1.0"
SectionEnd

Section "Uninstall"
  SetShellVarContext all
  nsExec::ExecToLog '"$INSTDIR\PrintRocketService.exe" stop'
  nsExec::ExecToLog '"$INSTDIR\PrintRocketService.exe" uninstall'
  Delete "$DESKTOP\Panel Impresion PrintRocket.url"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PrintRocketClient"
  RMDir /r "$INSTDIR"
  DetailPrint "La configuración privada en ProgramData\PrintRocket se conserva para una reinstalación."
SectionEnd
