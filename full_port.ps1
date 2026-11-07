# Gravrust Complete Port - Phase 1: Core Game Logic
# Ports ALL remaining JS files to Rust

$ErrorActionPreference = "Stop"
$root = "C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust"
cd $root

# Already ported files (10 original request)
$alreadyPorted = @(
    "client\js\webgl2.js", "client\js\webgpu.js", "client\js\browser.js",
    "client\js\main.js", "client\js\widgets.js", "client\js\sound.js",
    "client\js\protocol-1.15.2.js", "client\js\wasm\core.js",
    "client\js\entity-renderer.js", "client\js\options.js",
    "client\js\packed-bootstrap.js", "client\js\assets.js",
    "tools\build.js", "tools\make-offline.mjs", "offline-entry.js"
)

# Get all JS files
$allJs = Get-ChildItem -Recurse -Filter "*.js" -File | Where-Object { 
    $_.FullName -notmatch "node_modules|dist|target|\.git|rust" 
} | Select-Object -ExpandProperty FullName

# Convert to relative paths
$toPort = $allJs | Where-Object { 
    $rel = $_.Replace("C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust\", "").Replace("\", "/")
    $rel -notin @(
        "client/js/webgl2.js", "client/js/webgpu.js", "client/js/browser.js",
        "client/js/main.js", "client/js/widgets.js", "client/js/sound.js",
        "client/js/protocol-1.15.2.js", "client/js/wasm/core.js",
        "client/js/entity-renderer.js", "client/js/options.js",
        "client/js/packed-bootstrap.js", "client/js/assets.js",
        "tools/build.js", "tools/make-offline.mjs", "offline-entry.js"
    )
}

Write-Host "Total JS files to port: $($toPort.Count)" -ForegroundColor Cyan

# Group by priority
$categories = @{
    core = @()      # game logic, physics, entities
    render = @()    # rendering, shaders, mesher
    gui = @()       # gui screens, widgets
    net = @()       # networking
    world = @()     # world, chunks, blocks
    other = @()     # audio, util, lib, legacy, etc.
}

foreach ($file in $toPort) {
    $rel = $file.Replace("C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust\", "").Replace("\", "/")
    if ($file -like "*\game\*.js" -and $file -notmatch "menus-|panda-|signs-") { $priority1 += $file }
    elseif ($file -like "*\render\*.js") { $priority2 += $file }
    elseif ($file -like "*\gui\screens\*" -or $file -like "*\gui\*.js" -and $file -notlike "*i18n*") { $priority3 += $file }
    elseif ($file -like "*\net\*.js") { $priority4 += $file }
    elseif ($file -like "*\world\*.js") { $priority5 += $file }
    else { $priority6 += $file }
}

Write-Host "Porting plan:"
Write-Host "  Core game logic: $($priority1.Count) files"
Write-Host "  Rendering: $($priority2.Count) files"
Write-Host "  GUI screens: $($priority3.Count) files"
Write-Host "  Network: $($priority4.Count) files"
Write-Host "  World: $($priority5.Count) files"
Write-Host "Other: $($priority6.Count) files"
Write-Host "Total: $($toPort.Count) files"

# Save manifest
$manifest = @{
    core = $priority1
    render = $priority2
    gui = $priority3
    net = $priority4
    world = $priority6
    other = $priority6
    total = $toPort.Count
}
$manifest | ConvertTo-Json -Depth 5 | Out-File "port-manifest.json" -Encoding utf8