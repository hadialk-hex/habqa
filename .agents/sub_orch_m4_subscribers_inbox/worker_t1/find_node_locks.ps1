Get-Process -Name node | ForEach-Object {
    $proc = $_
    try {
        $modules = $proc.Modules
        foreach ($mod in $modules) {
            if ($mod.FileName -like "*query_engine-windows.dll.node*") {
                [PSCustomObject]@{
                    Id = $proc.Id
                    Name = $proc.Name
                    Path = $proc.Path
                    Module = $mod.FileName
                }
            }
        }
    } catch {}
}
