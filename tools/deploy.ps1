# Deploys the game server (Supabase Edge Function "game").
# The rules are the same JS modules the browser runs; they are copied next to the function first.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tools/deploy.ps1 -ProjectRef abcdefghijklmnop
param([Parameter(Mandatory = $true)][string]$ProjectRef)

$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root 'supabase\functions\game\game'
New-Item -ItemType Directory -Force $dest | Out-Null
$enc = New-Object Text.UTF8Encoding($false)
foreach ($m in 'config', 'data', 'combat', 'server', 'gangs', 'daily', 'api') {
  # the browser's cache-busting ?v= stamps (tools/publish.ps1) are dropped for Deno
  $t = [IO.File]::ReadAllText((Join-Path $root "js\$m.js"), $enc)
  [IO.File]::WriteAllText((Join-Path $dest "$m.js"), [regex]::Replace($t, '\.js\?v=\d+', '.js'), $enc)
}

# the Supabase CLI: tools\bin\supabase.exe, or one on the PATH
$cli = Join-Path $root 'tools\bin\supabase.exe'
if (-not (Test-Path $cli)) { $cli = (Get-Command supabase -ErrorAction SilentlyContinue).Source }
if (-not $cli) { Write-Error 'Supabase CLI nie je nainštalované (tools\bin\supabase.exe).'; exit 1 }

Push-Location $root
try {
  # --use-api: bundled on Supabase's side, no Docker needed on this PC
  & $cli functions deploy game --project-ref $ProjectRef --no-verify-jwt --use-api
} finally {
  Pop-Location
}
