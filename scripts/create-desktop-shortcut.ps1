$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "WorkPulse.lnk"
$TargetPath = Resolve-Path "$PSScriptRoot\..\src-tauri\target\release\workpulse.exe" -ErrorAction SilentlyContinue

if ($TargetPath) {
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = $TargetPath.Path
    $Shortcut.WorkingDirectory = Split-Path -Path $TargetPath.Path
    $Shortcut.Description = "WorkPulse - Windows Desktop Workload Companion & AI Monitor"
    $Shortcut.Save()
    Write-Host "[WorkPulse] Desktop shortcut created successfully at: $ShortcutPath"
} else {
    Write-Host "[WorkPulse] Target workpulse.exe not found yet."
}
