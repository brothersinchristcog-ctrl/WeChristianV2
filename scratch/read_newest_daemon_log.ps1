$newest = Get-ChildItem "C:\Users\sunil\.gradle\daemon\8.14.3\*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($newest) {
    Write-Host "Newest log file is: $($newest.FullName)"
    Write-Host "Last 200 lines:"
    Get-Content $newest.FullName -Tail 200
} else {
    Write-Host "No log file found."
}
