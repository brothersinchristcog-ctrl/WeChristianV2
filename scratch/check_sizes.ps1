$dirs = @(
    "C:\Users\sunil\Downloads",
    "C:\Users\sunil\Documents",
    "C:\Users\sunil\Desktop",
    "C:\Users\sunil\.gradle",
    "C:\Users\sunil\.android",
    "C:\Users\sunil\AppData\Local\Android\Sdk",
    "C:\Users\sunil\AppData\Local\Temp"
)

$results = @()
foreach ($d in $dirs) {
    if (Test-Path $d) {
        $files = Get-ChildItem -Path $d -Recurse -File -ErrorAction SilentlyContinue
        $sum = 0
        if ($files) {
            $sum = ($files | Measure-Object -Property Length -Sum).Sum
        }
        $results += [PSCustomObject]@{
            Path = $d
            SizeGB = [Math]::Round($sum / 1GB, 2)
        }
    }
}

$results | Sort-Object SizeGB -Descending | Format-Table -AutoSize
