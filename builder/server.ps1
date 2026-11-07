# ============================================================
#  Gravrust Builder - super mini backend server (PowerShell)
#  Serves a drag-and-drop web UI, accepts a Minecraft client
#  jar, bakes it into:
#    output/gravrust-site.zip    <- zip version for website hosting
#    output/gravrust-compact.html <- compact single-file build
# ============================================================

$ErrorActionPreference = 'Stop'
$root     = $PSScriptRoot
$outDir   = Join-Path $root 'output'
$workDir  = Join-Path $root 'work'
$clientDir = Join-Path $root 'client'
$port     = 8477

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Ensure-Dir([string]$p) { if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null } }
Ensure-Dir $outDir
Ensure-Dir $workDir

$mime = @{
  '.html'='text/html; charset=utf-8'; '.js'='text/javascript'; '.css'='text/css'
  '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.gif'='image/gif'
  '.ogg'='audio/ogg'; '.json'='application/json'; '.wasm'='application/wasm'
  '.zip'='application/zip'; '.txt'='text/plain; charset=utf-8'
}

function Write-Log([string]$msg) { Write-Host ("[{0}] {1}" -f (Get-Date -Format HH:mm:ss), $msg) }

# ------------------- BUILD PIPELINE ------------------------
function Invoke-Build([byte[]]$jarBytes, [string]$filename) {
  $log = New-Object System.Collections.Generic.List[string]
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $jarPath = Join-Path $workDir ("input-{0}.jar" -f $stamp)

  # clean previous outputs
  Remove-Item (Join-Path $outDir '*') -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $workDir 'site') -Recurse -Force -ErrorAction SilentlyContinue
  Ensure-Dir $outDir

  [System.IO.File]::WriteAllBytes($jarPath, $jarBytes)
  $log.Add("Received jar: $filename ($([math]::Round($jarBytes.Length/1MB,1)) MB)")

  # 1) extract assets/minecraft/** from the jar
  $zip = [System.IO.Compression.ZipFile]::OpenRead($jarPath)
  $assetCount = 0; $assetBytes = 0
  $siteDir = Join-Path $workDir 'site'
  Ensure-Dir $siteDir
  try {
    foreach ($entry in $zip.Entries) {
      if (-not $entry.FullName.StartsWith('assets/')) { continue }
      if ($entry.FullName.EndsWith('/')) { continue }
      $dest = Join-Path $siteDir ($entry.FullName -replace '/', '\')
      $destParent = Split-Path $dest -Parent
      if (-not (Test-Path $destParent)) { New-Item -ItemType Directory -Path $destParent -Force | Out-Null }
      [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $dest, $true)
      $assetCount++; $assetBytes += $entry.Length
      if ($assetCount % 500 -eq 0) { $log.Add("  extracted $assetCount assets...") }
    }
  } finally { $zip.Dispose() }
  $log.Add("Extracted $assetCount assets ($([math]::Round($assetBytes/1MB,1)) MB) from assets/")

  # 2) compact single-file HTML: WASM inlined as base64
  $wasmPath  = Join-Path $clientDir 'gravrust_core_bg.wasm'
  $tplPath   = Join-Path $clientDir 'offlineclient-template.html'
  $wasmB64   = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($wasmPath))
  $tpl       = [System.IO.File]::ReadAllText($tplPath)
  $compact   = $tpl.Replace('__WASM_B64__', $wasmB64)
  # asset manifest so the page knows what was baked
  $manifest = @()
  Get-ChildItem $siteDir -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    $manifest += @{ p = $_.FullName.Substring($siteDir.Length + 1).Replace('\','/'); s = $_.Length }
  }
  $manifestJson = ConvertTo-Json -InputObject $manifest -Compress -Depth 3
  $compact = $compact.Replace('__ASSET_MANIFEST__', $manifestJson)
  $compactPath = Join-Path $outDir 'gravrust-compact.html'
  [System.IO.File]::WriteAllText($compactPath, $compact, [System.Text.UTF8Encoding]::new($false))
  $log.Add("Compact build: $([math]::Round((Get-Item $compactPath).Length/1MB,2)) MB (WASM inlined)")

  # 3) zip version for website hosting
  $indexHtml = $compact  # same self-contained page works hosted or from disk
  [System.IO.File]::WriteAllText((Join-Path $siteDir 'index.html'), $indexHtml, [System.Text.UTF8Encoding]::new($false))
  Copy-Item (Join-Path $clientDir 'gravrust_core_bg.wasm') (Join-Path $siteDir 'gravrust_core_bg.wasm') -Force
  Copy-Item (Join-Path $clientDir 'gravrust_core.js')      (Join-Path $siteDir 'gravrust_core.js')      -Force
  $zipOut = Join-Path $outDir 'gravrust-site.zip'
  if (Test-Path $zipOut) { Remove-Item $zipOut -Force }
  [System.IO.Compression.ZipFile]::CreateFromDirectory($siteDir, $zipOut, [System.IO.Compression.CompressionLevel]::Optimal, $false)
  $log.Add("Site zip: $([math]::Round((Get-Item $zipOut).Length/1MB,2)) MB (index.html + WASM + $assetCount assets)")

  # 4) copy raw outputs for direct download
  Copy-Item $jarPath (Join-Path $outDir 'input-client.jar') -Force

  return @{
    ok       = $true
    jar      = $filename
    jarMB    = [math]::Round($jarBytes.Length/1MB,2)
    assets   = $assetCount
    assetsMB = [math]::Round($assetBytes/1MB,1)
    compact  = "/download/gravrust-compact.html"
    zip      = "/download/gravrust-site.zip"
    log      = $log
  }
}

# ------------------- HTTP SERVER ---------------------------
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()
Write-Log "Gravrust Builder listening on http://localhost:$port"
Write-Log "Open that address in your browser and drop your client.jar"

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $req = $ctx.Request; $res = $ctx.Response
    $path = $req.Url.AbsolutePath

    if ($req.HttpMethod -eq 'POST' -and $path -eq '/build') {
      $ms = New-Object System.IO.MemoryStream
      $req.InputStream.CopyTo($ms)
      $bytes = $ms.ToArray(); $ms.Dispose()
      $filename = 'client.jar'
      if ($req.Headers['X-Filename']) { $filename = $req.Headers['X-Filename'] }
      Write-Log "Build request: $filename ($([math]::Round($bytes.Length/1MB,1)) MB)"
      try {
        $result = Invoke-Build $bytes $filename
        $json = $result | ConvertTo-Json -Depth 3
        $buf = [System.Text.Encoding]::UTF8.GetBytes($json)
        $res.ContentType = 'application/json'; $res.StatusCode = 200
      } catch {
        Write-Log "BUILD FAILED: $_"
        $json = ConvertTo-Json @{ ok = $false; error = "$_" } -Depth 2
        $buf = [System.Text.Encoding]::UTF8.GetBytes($json)
        $res.ContentType = 'application/json'; $res.StatusCode = 500
      }
      $res.ContentLength64 = $buf.Length
      $res.OutputStream.Write($buf, 0, $buf.Length)
      $res.OutputStream.Close()
      continue
    }

    if ($req.HttpMethod -eq 'GET' -and $path.StartsWith('/download/')) {
      $name = [IO.Path]::GetFileName($path.Substring('/download/'.Length))
      $file = Join-Path $outDir $name
      if (Test-Path $file) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ext = [IO.Path]::GetExtension($name).ToLower()
        if ($mime.ContainsKey($ext)) { $res.ContentType = $mime[$ext] } else { $res.ContentType = 'application/octet-stream' }
        $res.Headers['Content-Disposition'] = "attachment; filename=`"$name`""
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else { $res.StatusCode = 404 }
      $res.OutputStream.Close(); continue
    }

    # static: / -> web/index.html, /client-file/<name> -> builder client files
    if ($path -eq '/' -or $path -eq '/index.html') {
      $file = Join-Path $root 'web\index.html'
    } elseif ($path.StartsWith('/client-file/')) {
      $name = [IO.Path]::GetFileName($path)
      $file = Join-Path $clientDir $name
    } elseif ($path -eq '/favicon.ico') {
      $res.StatusCode = 204; $res.OutputStream.Close(); continue
    } else { $file = $null }

    if ($file -and (Test-Path $file)) {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      if ($mime.ContainsKey($ext)) { $res.ContentType = $mime[$ext] } else { $res.ContentType = 'application/octet-stream' }
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $res.StatusCode = 404; $buf = [System.Text.Encoding]::UTF8.GetBytes('404'); $res.OutputStream.Write($buf,0,$buf.Length) }
    $res.OutputStream.Close()
  } catch {
    Write-Log "HTTP ERROR: $_"
    try { $ctx.Response.StatusCode = 500; $ctx.Response.OutputStream.Close() } catch {}
  }
}
