; FOXYN Installer - NSIS
!define APPNAME "FOXYN"
!define APPVERSION "1.0.0"
!define PUBLISHER "FOXYN"
!define EXE "FOXYN.exe"

Name "${APPNAME}"
OutFile "FOXYN-Installer.exe"
InstallDir "$PROGRAMFILES\FOXYN"
RequestExecutionLevel admin
Icon "foxyn.ico"

Page directory
Page instfiles

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "dist\FOXYN\*.*"
  CreateDirectory "$SMPROGRAMS\FOXYN"
  CreateShortcut "$SMPROGRAMS\FOXYN\FOXYN.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\foxyn.ico"
  CreateShortcut "$DESKTOP\FOXYN.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\foxyn.ico"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FOXYN" "DisplayName" "${APPNAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FOXYN" "UninstallString" "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\FOXYN\FOXYN.lnk"
  RMDir "$SMPROGRAMS\FOXYN"
  Delete "$DESKTOP\FOXYN.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FOXYN"
SectionEnd
