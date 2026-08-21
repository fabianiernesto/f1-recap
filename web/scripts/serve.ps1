<#
    Starts the dev server so that it OUTLIVES the editor.

    The preview launcher spawns node as a child of claude.exe, so every time
    the app tidies up its process tree the server goes with it and the local
    site stops answering. Creating the process through WMI reparents it to the
    WMI host instead, which puts it outside that tree for good.

    Usage:  powershell -NoProfile -File web/scripts/serve.ps1 [-Port 3000] [-Restart]
#>
param([int]$Port = 3000, [switch]$Restart)

$web  = Split-Path -Parent $PSScriptRoot
$log  = Join-Path $web ".dev-server.log"
$node = (Get-Command node).Source

# a socket probe answers instantly whether the port is taken; an HTTP request
# would sit on its timeout on every miss and turn the wait loop into minutes
function Test-Up {
    $c = New-Object Net.Sockets.TcpClient
    try { $c.Connect("127.0.0.1", $Port); $true } catch { $false } finally { $c.Dispose() }
}

if (Test-Up) {
    if (-not $Restart) { Write-Output "already up on $Port"; exit 0 }
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
}

# cmd /c eats the outer pair of quotes, so the whole command needs its own
$inner = '""{0}" "{1}\scripts\dev.mjs" > "{2}" 2>&1"' -f $node, $web, $log
$res = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine      = "cmd.exe /c $inner"
    CurrentDirectory = $web
}
if ($res.ReturnValue -ne 0) { Write-Error "could not start (code $($res.ReturnValue))"; exit 1 }

for ($i = 0; $i -lt 40; $i++) {
    if (Test-Up) { Write-Output "up on $Port (pid $($res.ProcessId), detached)"; exit 0 }
    Start-Sleep -Milliseconds 500
}
Write-Error "started but never answered on $Port; see $log"
exit 1
