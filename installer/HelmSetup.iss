; Helm Windows installer — compile with Inno Setup 6:
;   ISCC installer\HelmSetup.iss
;
; Run installer\build-release.ps1 first to populate installer\dist

#define MyAppName "Helm"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "Helm"
#define MyAppURL "http://localhost:3001"
#define MyAppExeName "start-helm.bat"

[Setup]
AppId={{8F3A2B1C-4D5E-6F70-8192-A3B4C5D6E7F8}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\Helm
DefaultGroupName=Helm
DisableProgramGroupPage=no
OutputDir=output
OutputBaseFilename=HelmSetup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\scripts\start-helm.bat

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut to Start Helm"; GroupDescription: "Shortcuts:"; Flags: unchecked

[Files]
Source: "dist\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Start Helm"; Filename: "{app}\scripts\start-helm.bat"; WorkingDir: "{app}"; Comment: "Start API and dashboard"
Name: "{group}\Stop Helm"; Filename: "{app}\scripts\stop-helm.bat"; WorkingDir: "{app}"
Name: "{group}\Install prerequisites"; Filename: "{app}\scripts\install-prerequisites.bat"; WorkingDir: "{app}"; Comment: "Install Node.js and PostgreSQL"
Name: "{group}\Configure Helm"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -NoProfile -File ""{app}\scripts\configure.ps1"" -InstallRoot ""{app}"""; WorkingDir: "{app}"; Comment: "Database and admin setup"
Name: "{group}\Open Dashboard"; Filename: "http://localhost:3001"
Name: "{group}\Uninstall Helm"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Start Helm"; Filename: "{app}\scripts\start-helm.bat"; Tasks: desktopicon

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -NoProfile -File ""{app}\scripts\check-prerequisites.ps1"""; StatusMsg: "Checking prerequisites…"; Flags: waituntilterminated
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -NoProfile -File ""{app}\scripts\configure.ps1"" -InstallRoot ""{app}"""; Description: "Configure database and admin account"; Flags: postinstall skipifsilent

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -NoProfile -File ""{app}\scripts\stop-helm.ps1"""; Flags: runhidden

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;
