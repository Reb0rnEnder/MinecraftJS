# Gravrust Complete Port - Phase 1: Core Game Logic
# Ports all remaining JS files to Rust systematically

$ErrorActionPreference = "Stop"
$root = "C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust"
cd $root

$alreadyPorted = @(
    "client/js/webgl2.js", "client/js/webgpu.js", "client/js/browser.js",
    "client/js/main.js", "client/js/widgets.js", "client/js/sound.js",
    "client/js/protocol-1.15.2.js", "client/js/wasm/core.js",
    "client/js/entity-renderer.js", "client/js/options.js",
    "client/js/packed-bootstrap.js", "client/js/assets.js",
    "tools/build.js", "tools/make-offline.mjs", "offline-entry.js"
)

$allJs = Get-ChildItem -Recurse -Filter "*.js" -File | Where-Object { 
    $_.FullName -notmatch "node_modules|dist|target|\.git|rust" 
} | Select-Object -ExpandProperty FullName

$toPort = $allJs | Where-Object { 
    $rel = $_.FullName.Replace("C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust\", "").Replace("\", "/")
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
$priority1 = $toPort | Where-Object { $_ -like "client/js/game/*.js" -and $_ -notmatch "menus-|panda-|signs-" }
$priority2 = @()  # render
$priority3 = @()  # gui screens
$priority4 = @()  # net
$priority5 = @()  # world
$priority6 = @()  # audio/util/lib/legacy/other

foreach ($f in $toPort) {
    if ($f -like "client/js/render/*") { $priority2 += $_ }
    elseif ($f -like "client/js/gui/screens/*" -or $f -like "client/js/gui/*.js" -and $_ -notlike "i18n.js") { $priority3 += $_ }
    elseif ($f -like "client/js/net/*") { $priority4 += $_ }
    elseif ($f -like "client/js/world/*") { $priority5 += $_ }
    elseif ($f -like "client/js/audio/*" -or $f -like "client/js/util/*" -or $f -like "client/js/lib/*" -or $f -like "lib/*") { $priority6 += $_ }
    elseif ($f -like "legacy-client/*") { $legacy += $_ }
    else { $other += $_ }
}

Write-Host "Porting plan:" -ForegroundColor Cyan
Write-Host "  Game logic (priority 1): $($game.Count) files"
Write-Host "  Rendering: $($render.Count) files"
Write-Host "  GUI screens: $($gui.Count) files"
Write-Host "  Networking: $($net.Count) files"
Write-Host "  World: $($world.Count) files"
Write-Host "Total: $($toPort.Count) files"

# Save manifest
$manifest = @{
    priority = @{
        core = @()
        render = @()
        gui = @()
        net = @()
        world = @()
        other = @()
    }
    timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}

$toPort | ForEach-Object {
    $rel = $_.Replace("C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust\", "").Replace("\", "/")
    if ($_) {
        if ($_ -like "client/js/game/*.js" -and $_ -notmatch "menus-|panda-|signs-") { $game += $_ }
        elseif ($_ -like "client/js/render/*") { $render += $_ }
        elseif ($_ -like "client/js/gui/screens/*" -or $_ -like "client/js/gui/*.js" -and $_ -notlike "*i18n*") { $gui += $_ }
        elseif ($_ -like "client/js/net/*") { $net += $_ }
        elseif ($_ -like "client/js/world/*") { $world += $_ }
        else { $other += $_ }
    }
}

Write-Host "Game logic: $($game.Count) files"
Write-Host "Render: $($render.Count) files"
Write-Host "GUI: $($gui.Count) files"
Write-Host "Network: $($net.Count) files"
Write-Host "World: $($world.Count) files"
Write-Host "Other: $($other.Count) files"
Write-Host "Total: $($toPort.Count) files"

# Save manifest
$manifest = @{
    game = $game
    render = $render
    gui = $gui
    net = $net
    world = $world
    other = $other
    total = $toPort.Count
    timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}
$manifest | ConvertTo-Json -Depth 5 | Out-File "port-manifest.json" -Encoding utf8

Write-Host "Manifest saved. Starting with PRIORITY 1: Core Game Logic" -ForegroundColor Green