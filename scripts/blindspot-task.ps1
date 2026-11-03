param(
    [ValidateSet('Preview', 'Install', 'Status', 'Restart', 'Remove')][string]$Mode = 'Preview',
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
if ($Mode -eq 'Restart') {
    if (-not $workerExisting) { throw 'The owned worker task is not installed.' }
    $workerGuard = @'
import time
from blindspot.store import Store
store = Store('.blindspot/research.sqlite')
with store._db() as db:
    state = db.execute("SELECT token FROM monitor_state WHERE name='main'").fetchone()
    if state and state['token']:
        print('busy')
    else:
        db.execute("INSERT INTO monitor_state(name,token,lease_until,next_due,interval,runner) VALUES ('main',NULL,NULL,?,600,'scheduled') ON CONFLICT(name) DO UPDATE SET next_due=excluded.next_due", (time.time() + 60,))
        print('idle')
'@
    Push-Location -LiteralPath $workerRoot
    try {
        $workerIdle = $workerGuard | & $workerPython -
        if ($LASTEXITCODE -ne 0 -or "$workerIdle".Trim() -ne 'idle') { throw 'A worker cycle is active or its state is unavailable. Wait for completion before restarting.' }
        if ($workerExisting.State -eq 'Running') {
            Stop-ScheduledTask -TaskName $workerTaskName
            $workerStopDeadline = [DateTime]::UtcNow.AddSeconds(10)
            do {
                $workerStopped = (Get-ScheduledTask -TaskName $workerTaskName).State -ne 'Running'
                if (-not $workerStopped) { Start-Sleep -Milliseconds 200 }
            } while (-not $workerStopped -and [DateTime]::UtcNow -lt $workerStopDeadline)
            if (-not $workerStopped) { throw 'The prior worker has not confirmed stopping; no duplicate was started.' }
        }
        Start-ScheduledTask -TaskName $workerTaskName
        Get-ScheduledTask -TaskName $workerTaskName | Select-Object TaskName, State
    } finally { Pop-Location }
    return
}
$workerAction = New-ScheduledTaskAction -Execute $workerPythonw -Argument $workerArguments -WorkingDirectory $workerRoot
$workerTrigger = New-ScheduledTaskTrigger -AtLogOn -User $workerIdentity
$workerPrincipal = New-ScheduledTaskPrincipal -UserId $workerIdentity -LogonType Interactive -RunLevel Limited
$workerSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Hidden
Register-ScheduledTask -TaskName $workerTaskName -Action $workerAction -Trigger $workerTrigger -Principal $workerPrincipal -Settings $workerSettings -Description $workerDescription -Force | Out-Null
Start-ScheduledTask -TaskName $workerTaskName
Get-ScheduledTask -TaskName $workerTaskName | Select-Object TaskName, State
