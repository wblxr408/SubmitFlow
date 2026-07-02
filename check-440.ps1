$b = [System.IO.File]::ReadAllBytes("d:\SubmitFlow\src\app\(app)\referrals\page.tsx")
$text = [System.Text.Encoding]::UTF8.GetString($b)
$lns = $text.Split("`n")
# Check lines 439-442
for ($i = 438; $i -le 442; $i++) {
    $ln = $lns[$i]
    Write-Host "L$($i+1) [len=$($ln.Length)]: '$($ln.Replace("`r","")'"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($ln)
    Write-Host "  Bytes: " + [System.BitConverter]::ToString($bytes)
}
Write-Host ""
Write-Host "Line 440 chars:"
for ($i = 0; $i -lt $lns[439].Length; $i++) {
    $c = $lns[439][$i]
    $bts = [System.Text.Encoding]::UTF8.GetBytes($c)
    Write-Host "  [$i] U+$([int][char]$c] '$c' = " + [System.BitConverter]::ToString($bts)
}
