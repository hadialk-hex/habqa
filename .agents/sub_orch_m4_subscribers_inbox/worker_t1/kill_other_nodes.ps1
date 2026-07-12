$our_pids = @()
$current_id = $PID
while ($current_id) {
    $our_pids += $current_id
    try {
        $proc = Get-Process -Id $current_id -ErrorAction SilentlyContinue
        $parent_id = $null
        if ($proc) {
            $parent_proc = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $current_id" -ErrorAction SilentlyContinue
            if ($parent_proc) {
                $parent_id = $parent_proc.ParentProcessId
            }
        }
        if ($parent_id -and $parent_id -ne 0) {
            $current_id = $parent_id
        } else {
            $current_id = $null
        }
    } catch {
        $current_id = $null
    }
}
Write-Output "Our parent PIDs: ($our_pids)"

Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object {
    $proc = $_
    $nodePid = $proc.Id
    
    if ($our_pids -contains $nodePid) {
        Write-Output "Keeping our parent node process: $nodePid"
        return
    }

    $proc_info = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $nodePid" -ErrorAction SilentlyContinue
    $cmd = $proc_info.CommandLine
    if ($cmd -and (($cmd -like "*antigravity*") -or ($cmd -like "*.gemini*"))) {
        Write-Output "Keeping agent node process: $nodePid ($cmd)"
        return
    }

    Write-Output "Killing other node process: $nodePid ($cmd)"
    try {
        Stop-Process -Id $nodePid -Force
    } catch {
        Write-Error "Failed to kill process $nodePid"
    }
}
