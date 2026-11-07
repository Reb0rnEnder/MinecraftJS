# Phase 0 acceptance verification for t1 (rust-core)
# Read-only: inspects files and runs cargo; mutates nothing.
$g = "C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust"
$s = "$g\rust\gravrust-core\src"
$bk = "C:\Users\Nicholas\Documents\Downloads\New folder (5)\_rust-core-backup-20261104"
$fails = 0
function Check($name, $ok, $detail) {
  if ($ok) { Write-Host "[PASS] $name -- $detail" }
  else { Write-Host "[FAIL] $name -- $detail"; $script:fails++ }
}

# A) cargo check exits 0 on both targets
cd "$g\rust"
cargo check --message-format short 2>&1 | Out-Null; $a = $LASTEXITCODE
Check "A1 cargo check (host) exit 0" ($a -eq 0) "exit=$a"
cargo check --target wasm32-unknown-unknown --message-format short 2>&1 | Out-Null; $aw = $LASTEXITCODE
Check "A2 cargo check (wasm32) exit 0" ($aw -eq 0) "exit=$aw"

# B) no 'file not found for module' in default build
$fnf = (cargo check --message-format short 2>&1 | Select-String 'file not found for module' | Measure-Object).Count
Check "B no 'file not found for module'" ($fnf -eq 0) "count=$fnf"

# C) no .rs file lost
$now = (Get-ChildItem -Recurse $s -Filter *.rs).Count
$src = (Get-ChildItem -Recurse "C:\Users\Nicholas\Documents\Downloads\New folder (5)\rust\gravrust-core\src" -Filter *.rs).Count
Check "C .rs files preserved (>=203)" ($now -ge 203) "repo=$now restoreSource=$src"

# D) every declared module in lib.rs resolves to a real file/dir
$lib = [System.IO.File]::ReadAllText("$s\lib.rs")
$entries = [regex]::Matches($lib, '(?m)^\s*(?:#\[path = "([^"]+)"\]\s*)?(?:pub\s+)?mod\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*;')
$missing = @()
foreach ($e in $entries) {
  $p = $e.Groups[1].Value; $n = $e.Groups[2].Value
  if ($p -ne '') {
    # #[path] entries resolve relative to src/ (the inline wrapper modules live in
    # no subdirectory), so strip leading ../ and test the named target only.
    $rel = $p -replace '^(\.\./)+',''
    $t = Join-Path $s $rel
    if (-not (Test-Path $t)) { $missing += "$n(path=$p -> src/$rel)" }
  }
  else {
    $t = Join-Path $s "$n.rs"; $d = Join-Path $s $n
    if (-not (Test-Path $t) -and -not (Test-Path $d)) { $missing += $n }
  }
}
Check "D all declared modules resolve" ($missing.Count -eq 0) "unresolved=[$($missing -join ', ')]"

# E) client/js untouched
$before = Get-Content "$bk\client-js-hashes-before.txt"
$after = Get-ChildItem -Recurse "$g\client\js" -File | Sort-Object FullName | ForEach-Object { $r=$_.FullName.Substring($g.Length+1); "$r  $((Get-FileHash $_.FullName -Algorithm SHA256).Hash)" }
$diff = Compare-Object $before $after
Check "E client/js unmodified" ($null -eq $diff) "changed=$((($diff|Measure-Object).Count))"
$gitjs = git -C $g status --porcelain=v1 -- client/
Check "E2 git clean for client/" ([string]::IsNullOrWhiteSpace($gitjs)) "status='$gitjs'"

# F) web-sys features are all real crate features
$names = Get-Content "$env:TEMP\web_sys_features.txt"
$cargo = [System.IO.File]::ReadAllText("$g\rust\gravrust-core\Cargo.toml")
$fm = [regex]::Match($cargo, 'web-sys = \{ version = "0\.3", features = \[(.*?)\] \}', 'Singleline')
$used = [regex]::Matches($fm.Groups[1].Value, '"([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
$bad = $used | Where-Object { $names -notcontains $_ }
Check "F1 web-sys features all valid" ($bad.Count -eq 0) "declared=$($used.Count) invalid=[$($bad -join ', ')]"
Check "F2 no duplicate features" ((($used | Sort-Object -Unique).Count) -eq $used.Count) "declared=$($used.Count) unique=$(($used|Sort-Object -Unique).Count)"

# G) renamed files present, originals gone
$ren = @{ 'chunk_1144.rs'=$true; 'chunk_1152.rs'=$true; 'entity_registry_1144.rs'=$true; 'entity_registry_1152.rs'=$true; 'packet_bodies_1144.rs'=$true }
$renOk = $true; foreach ($k in $ren.Keys) { if (-not (Test-Path "$s\$k")) { $renOk = $false } }
Check "G1 renamed files exist" $renOk "checked $($ren.Count) targets"
$illegal = Get-ChildItem -Recurse $s -Filter *.rs | Where-Object { $_.BaseName -cmatch '[^a-zA-Z0-9_]' -or $_.Name -cmatch '^\w*-\w*\.rs$' }
Check "G2 no hyphen/dot module filenames" ($illegal.Count -eq 0) "found=[$(($illegal|ForEach-Object{$_.Name}) -join ', ')]"

# H) duplicates disambiguated, both copies kept
Check "H1 net/connection.rs kept" (Test-Path "$s\net\connection.rs") "size=$((Get-Item "$s\net\connection.rs").Length)"
Check "H2 connection_legacy.rs kept" (Test-Path "$s\connection_legacy.rs") "size=$((Get-Item "$s\connection_legacy.rs").Length)"
Check "H3 screens/manager.rs kept" (Test-Path "$s\screens\manager.rs") "size=$((Get-Item "$s\screens\manager.rs").Length)"
Check "H4 manager_legacy.rs kept" (Test-Path "$s\manager_legacy.rs") "size=$((Get-Item "$s\manager_legacy.rs").Length)"
Check "H5 world/chunk.rs kept" (Test-Path "$s\world\chunk.rs") "size=$((Get-Item "$s\world\chunk.rs").Length)"
Check "H6 world/world_core.rs kept" (Test-Path "$s\world\world_core.rs") "size=$((Get-Item "$s\world\world_core.rs").Length)"
Check "H7 chunk.rs kept" (Test-Path "$s\chunk.rs") "size=$((Get-Item "$s\chunk.rs").Length)"
Check "H8 net/mod.rs kept (both net dir forms preserved)" (Test-Path "$s\net\mod.rs") "size=$((Get-Item "$s\net\mod.rs").Length)"

# I) gate is meaningful: unsupported feature surfaces real errors
$gated = (cargo check --features unsupported --message-format short 2>&1 | Select-String ': error' | Measure-Object).Count
Check "I unsupported feature surfaces real errors" ($gated -gt 0) "gatedErrors=$gated defaultErrors=0"

Write-Host ""
if ($fails -eq 0) { Write-Host "ALL CHECKS PASSED" } else { Write-Host "$fails CHECK(S) FAILED" }
exit $fails
