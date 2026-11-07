$files = Get-ChildItem "C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust" -Recurse -Filter "*.js" -File | Where-Object { $_.FullName -notmatch "node_modules|dist|target|\.git|rust" } | Select-Object FullName
$files = $files.FullName
Write-Host "Total JS files: $($files.Count)"
$files | ForEach-Object { $_.Replace("C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust\", "").Replace("\", "/") }