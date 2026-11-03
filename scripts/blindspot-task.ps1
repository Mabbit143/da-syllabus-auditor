param(
    [ValidateSet('Preview', 'Install', 'Status', 'Remove')][string]$Mode = 'Preview',
    [ValidateRange(1, 1440)][int]$IntervalMinutes = 10,
    [ValidateRange(1, 100)][int]$DailyModelCalls = 12,
    [switch]$CreditsVerified
)
$ErrorActionPreference = 'Stop'
$workerRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$workerPython = (Get-Command python.exe -ErrorAction Stop).Source
$workerPythonw = Join-Path (Split-Path -Parent $workerPython) 'pythonw.exe'
if (-not (Test-Path -LiteralPath $workerPythonw)) { throw 'pythonw.exe is required for the quiet local worker.' }
if (-not (Test-Path -LiteralPath (Join-Path $workerRoot 'blindspot\service.py'))) { throw 'Worker entry point is missing.' }
$workerHasher = [Security.Cryptography.SHA256]::Create()
try { $workerHash = [BitConverter]::ToString($workerHasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($workerRoot.ToLowerInvariant()))).Replace('-', '').Substring(0, 8) }
finally { $workerHasher.Dispose() }
$workerTaskName = "BlindspotEngine-$workerHash"
$workerDescription = "Private Blindspot Engine worker for $workerRoot"
$workerArguments = "-m blindspot.service --interval $($IntervalMinutes * 60) --max-jobs 3 --daily-model-calls $DailyModelCalls"
if ($CreditsVerified) { $workerArguments += ' --credits-verified' }
$workerIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$workerExisting = Get-ScheduledTask -TaskName $workerTaskName -ErrorAction SilentlyContinue
if ($workerExisting -and ($workerExisting.Description -ne $workerDescription -or $workerExisting.Actions.Count -ne 1 -or $workerExisting.Actions[0].WorkingDirectory -ne $workerRoot -or $workerExisting.Actions[0].Execute -ne $workerPythonw)) {
    throw 'The task name belongs to a different configuration; it will not be changed.'
}
if ($Mode -eq 'Preview') {
    [pscustomobject]@{ TaskName = $workerTaskName; Account = $workerIdentity; Execute = $workerPythonw; Arguments = $workerArguments; WorkingDirectory = $workerRoot; Trigger = 'At user logon, plus immediate start on install'; ModelAnalysis = [bool]$CreditsVerified; DailyLogicalCallLimit = $DailyModelCalls; HostRequirement = 'This computer must remain on and the user logged in'; Installed = [bool]$workerExisting }
    return
}
if ($Mode -eq 'Status') {
    if (-not $workerExisting) { Write-Output 'Not installed'; return }
    $workerExisting | Select-Object TaskName, State
    Get-ScheduledTaskInfo -TaskName $workerTaskName | Select-Object LastRunTime, LastTaskResult, NextRunTime
    return
}
if ($Mode -eq 'Remove') {
    if ($workerExisting) {
        Stop-ScheduledTask -TaskName $workerTaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $workerTaskName -Confirm:$false
    }
    Write-Output 'Owned worker task removed. Research data remains in .blindspot.'
    return
}
$workerAction = New-ScheduledTaskAction -Execute $workerPythonw -Argument $workerArguments -WorkingDirectory $workerRoot
$workerTrigger = New-ScheduledTaskTrigger -AtLogOn -User $workerIdentity
$workerPrincipal = New-ScheduledTaskPrincipal -UserId $workerIdentity -LogonType Interactive -RunLevel Limited
$workerSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Hidden
Register-ScheduledTask -TaskName $workerTaskName -Action $workerAction -Trigger $workerTrigger -Principal $workerPrincipal -Settings $workerSettings -Description $workerDescription -Force | Out-Null
Start-ScheduledTask -TaskName $workerTaskName
Get-ScheduledTask -TaskName $workerTaskName | Select-Object TaskName, State
