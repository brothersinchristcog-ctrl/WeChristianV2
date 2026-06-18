Write-Host "Free space before cleaning:"
Get-PSDrive C | Select-Object Used, Free

Write-Host "Cleaning Gradle Caches..."
Remove-Item -Path "C:\Users\sunil\.gradle\caches\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\sunil\.gradle\wrapper\dists\*" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Cleaning npm cache..."
npm cache clean --force

Write-Host "Free space after cleaning:"
Get-PSDrive C | Select-Object Used, Free
