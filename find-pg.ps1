$svc = Get-Service | Where-Object {$_.DisplayName -like '*PostgreSQL*'} | Select-Object -First 1
if ($svc) {
    Write-Host "Service found: $($svc.Name) Status=$($svc.Status)"
} else {
    Write-Host "No PostgreSQL service found"
}
