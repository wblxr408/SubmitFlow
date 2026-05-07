# Check if PostgreSQL is installed
$pgBin = "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe"
$pgData = "C:\Program Files\PostgreSQL\17\data"
$pgLog = "C:\Users\wblxr\postgresql.log"

if (Test-Path $pgBin) {
    Write-Host "pg_ctl found at: $pgBin"
    Write-Host "Data dir: $pgData"
    
    # Try to start
    & $pgBin status -D $pgData 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "PostgreSQL not running, attempting to start..."
        & $pgBin start -D $pgData -l $pgLog -w 2>&1
        Write-Host "Start exit code: $LASTEXITCODE"
    }
} else {
    Write-Host "PostgreSQL 17 not found at: $pgBin"
    
    # Search for any PostgreSQL installation
    Get-ChildItem "C:\Program Files" -Filter "*postgresql*" -Recurse -Depth 2 -ErrorAction SilentlyContinue | Select-Object FullName
}
