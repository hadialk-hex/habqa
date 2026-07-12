Get-CimInstance Win32_Process -Filter "name = 'node.exe'" | ForEach-Object {
    $cmd = $_.CommandLine
    $pid = $_.ProcessId
    if ($cmd -and ($cmd -notlike "*antigravity*") -and ($cmd -notlike "*.gemini*")) {
        Write-Output "Killing process $pid : $cmd"
        try {
            Stop-Process -Id $pid -Force
        } catch {
            Write-Error "Failed to kill process $pid"
        }
    } else {
        Write-Output "Keeping process $pid : $cmd"
    }
}
