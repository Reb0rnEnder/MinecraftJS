# Gravrust Full Port - Phase 1: Discovery
# Run this in the Gravrust directory

$ErrorActionPreference = "Stop"

$root = "C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust"
cd $root

# Get all JS files excluding certain directories
$allJs = Get-ChildItem -Recurse -Filter "*.js" -File | Where-Object { 
    $_.FullName -notmatch "node_modules|dist|target|\.git|rust" 
} | Select-Object -ExpandProperty FullName

# Already ported (10 files + old build files)
$alreadyPorted = @(
    "client\js\webgl2.js",
    "client\js\webgpu.js",
    "client\js\browser.js",
    "client\js\main.js",
    "client\js\widgets.js",
    "client\js\sound.js",
    "client\js\protocol-1.15.2.js",
    "client\js\wasm\core.js",
    "client\js\entity-renderer.js",
    "client\js\options.js",
    "client\js\packed-bootstrap.js",
    "client\js\assets.js",
    "tools\build.js",
    "tools\make-offline.mjs",
    "offline-entry.js"
)

# Get all JS files
$allJs = Get-ChildItem -Recurse -Filter "*.js" -File | Where-Object { 
    $_.FullName -notmatch "node_modules|dist|target|\.git|rust" 
} | Select-Object -ExpandProperty FullName

# Convert to relative paths
$allJsRel = $allJs | ForEach-Object { $_.Replace("C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust\", "").Replace("\", "/") }

# Already ported
$alreadyPortedSet = @(
    "client/js/webgl2.js",
    "client/js/webgpu.js",
    "client/js/browser.js",
    "client/js/main.js",
    "client/js/widgets.js",
    "client/js/sound.js",
    "client/js/protocol-1.15.2.js",
    "client/js/wasm/core.js",
    "client/js/entity-renderer.js",
    "client/js/options.js",
    "client/js/packed-bootstrap.js",
    "client/js/assets.js",
    "tools/build.js",
    "tools/make-offline.mjs",
    "offline-entry.js"
)

$toPort = $allJsRel | Where-Object { $_ -notin $alreadyPortedSet }

# Group by category
$categories = @{
    game = @()
    render = @()
    gui = @()
    net = @()
    world = @()
    audio = @()
    util = @()
    lib = @()
    legacy = @()
    root = @()
    other = @()
}

foreach ($file in $toPort) {
    if ($file -like "client/js/game/*") { $categories.game += $file }
    elseif ($file -like "client/js/render/*") { $categories.render += $file }
    elseif ($file -like "client/js/gui/*") { $categories.gui += $file }
    elseif ($file -like "client/js/net/*") { $categories.net += $file }
    elseif ($file -like "client/js/world/*") { $categories.world += $file }
    elseif ($file -like "client/js/audio/*") { $categories.audio += $file }
    elseif ($file -like "client/js/util/*" -or $file -like "client/js/lib/*") { $categories.util += $file }
    elseif ($file -like "lib/*") { $categories.lib += $file }
    elseif ($file -like "legacy-client/*") { $categories.legacy += $file }
    elseif ($file -like "client/js/*.js") { $categories.root += $file }
    else { $categories.other += $file }
}

# Output summary
Write-Host "=== PORTING PLAN ==="
foreach ($cat in $categories.Keys | Sort-Object) {
    $count = $categories[$cat].Count
    if ($count -gt 0) {
        Write-Host "  $cat: $count files"
    }
}
$total = ($toPort | Measure-Object).Count
Write-Host "Total files to port: $total"

# Save manifest
$manifest = @{
    categories = $categories
    total = $toPort.Count
    timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}
$manifest | ConvertTo-Json -Depth 5 | Out-File "port-manifest.json" -Encoding utf8

Write-Host "Manifest saved to port-manifest.json"