# Скачивает и ставит .NET 10 Runtime и Npcap для Aion DPS Meter. Запускается установщиком скрыто, ход пишет в текстовые файлы
# (net.txt, pcap.txt, done.txt в папке -Dir), установщик читает их и рисует прогресс. Скачивание только с официальных сайтов,
# запуск только файлов с действительной цифровой подписью.
param([string]$Dir, [int]$Net, [int]$Pcap)
$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
Add-Type -AssemblyName System.Net.Http
function W($n, $s) { try { [IO.File]::WriteAllText("$Dir\$n.txt", $s, [Text.Encoding]::ASCII) } catch {} }
function Cancelled { Test-Path "$Dir\cancel.flag" }
function Get-Remote($url, $out, $name) {
    $cli = New-Object System.Net.Http.HttpClient
    $cli.Timeout = [TimeSpan]::FromMinutes(30)
    $resp = $cli.GetAsync($url, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).Result
    $resp.EnsureSuccessStatusCode() | Out-Null
    $total = 0; if ($resp.Content.Headers.ContentLength) { $total = [long]$resp.Content.Headers.ContentLength }
    $in = $resp.Content.ReadAsStreamAsync().Result
    $fs = [IO.File]::Create($out)
    $buf = New-Object byte[] 65536; $done = 0; $sw = [Diagnostics.Stopwatch]::StartNew()
    try {
        while (($n = $in.Read($buf, 0, $buf.Length)) -gt 0) {
            $fs.Write($buf, 0, $n); $done += $n
            if ($sw.ElapsedMilliseconds -gt 150) {
                $sw.Restart()
                $pct = 0; if ($total -gt 0) { $pct = [int](100 * $done / $total) }
                W $name ("dl {0} {1} {2} ." -f $pct, [int]($done / 1MB), [int]($total / 1MB))
                if (Cancelled) { throw 'cancel' }
            }
        }
    } finally { $fs.Close(); $in.Close(); $cli.Dispose() }
}
function Check-Sign($file, $who) {
    $sig = Get-AuthenticodeSignature -FilePath $file
    if ($sig.Status -ne 'Valid') { throw 'badsignature' }
    if ($who -and $sig.SignerCertificate.Subject -notmatch $who) { throw 'badsigner' }
}

if ($Net -eq 1) {
    try {
        W net 'dl 0 0 0 .'
        $f = Join-Path $Dir 'dotnet-runtime.exe'
        Get-Remote 'https://aka.ms/dotnet/10.0/dotnet-runtime-win-x64.exe' $f net
        Check-Sign $f 'Microsoft'
        W net 'inst 100 0 0 .'
        $p = Start-Process -FilePath $f -ArgumentList '/install', '/quiet', '/norestart' -Verb RunAs -Wait -PassThru
        if (@(0, 3010, 1638) -contains $p.ExitCode) { W net 'ok 100 0 0 .' } else { W net 'fail 0 0 0 .' }
    } catch { W net 'fail 0 0 0 .' }
} else { W net 'skip 100 0 0 .' }

if ($Pcap -eq 1 -and -not (Cancelled)) {
    try {
        W pcap 'dl 0 0 0 .'
        $html = (Invoke-WebRequest -UseBasicParsing -Uri 'https://npcap.com/dist/' -TimeoutSec 30).Content
        $vs = [regex]::Matches($html, 'npcap-([0-9]+(?:\.[0-9]+)+)\.exe') | ForEach-Object { [version]$_.Groups[1].Value } | Sort-Object -Descending -Unique
        if (-not $vs) { throw 'nolink' }
        $f = Join-Path $Dir 'npcap.exe'
        Get-Remote ('https://npcap.com/dist/npcap-' + $vs[0].ToString() + '.exe') $f pcap
        Check-Sign $f ''
        W pcap 'run 100 0 0 .'
        Start-Process -FilePath $f -Verb RunAs -Wait | Out-Null
        if (Test-Path "$env:SystemRoot\System32\Npcap\wpcap.dll") { W pcap 'ok 100 0 0 .' } else { W pcap 'fail 0 0 0 .' }
    } catch { W pcap 'fail 0 0 0 .' }
} elseif ($Pcap -eq 0) { W pcap 'skip 100 0 0 .' }
W done '1 .'
