# Publishes the web client to GitHub Pages (https://lucky1097.github.io/hitsnlicks/).
# GitHub Pages lets phones cache files for 10 minutes, so every JS/CSS link gets a fresh ?v=<stamp>:
# all imports carry the same stamp, otherwise a module could load twice.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tools/publish.ps1 -Message "what changed"
param([Parameter(Mandatory = $true)][string]$Message)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$enc = New-Object Text.UTF8Encoding($false)
$v = Get-Date -Format 'yyyyMMddHHmmss'

# the character layers in assets/postava -> js/looks.js
& (Join-Path $PSScriptRoot 'looks.ps1')
# fight-animation cut-outs for weapon pictures that have none yet (a replaced picture: delete its assets\fx png)
$root = Split-Path $PSScriptRoot -Parent
$newFx = @(Get-ChildItem (Join-Path $root 'assets\art') -Filter 'w_*.jpg' | Where-Object { -not (Test-Path (Join-Path $root "assets\fx\$($_.BaseName).png")) } | ForEach-Object { $_.BaseName })
if ($newFx.Count) { & (Join-Path $PSScriptRoot 'cutout.ps1') -Ids $newFx }

foreach ($f in Get-ChildItem (Join-Path $root 'js') -Filter *.js) {
  $t = [IO.File]::ReadAllText($f.FullName, $enc)
  $n = [regex]::Replace($t, "(from\s+'\./[\w-]+\.js)(\?v=\d+)?'", "`$1?v=$v'")
  $n = [regex]::Replace($n, "(import\('\./[\w-]+\.js)(\?v=\d+)?'\)", "`$1?v=$v')")
  if ($n -ne $t) { [IO.File]::WriteAllText($f.FullName, $n, $enc) }
}
$html = Join-Path $root 'index.html'
$t = [IO.File]::ReadAllText($html, $enc)
$n = [regex]::Replace($t, '(js/main\.js|css/style\.css)(\?v=\d+)?"', "`$1?v=$v`"")
if ($n -ne $t) { [IO.File]::WriteAllText($html, $n, $enc) }

$env:GH_CONFIG_DIR = Join-Path $root 'tools\bin\gh-config'
$env:PATH = (Join-Path $root 'tools\bin\git\cmd') + ';' + (Join-Path $root 'tools\bin') + ';' + $env:PATH
Push-Location $root
try {
  git add -A
  git commit -q -m "$Message`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  git push -q
  "published v$v"
} finally {
  Pop-Location
}
