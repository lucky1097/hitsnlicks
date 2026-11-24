# Deploys the game server (Supabase Edge Functions "game" and "pay").
# The rules are the same JS modules the browser runs; they are copied next to the function first.
# "pay" (Stripe payments) gets a copy of js/config.js for the bar packs and their prices.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tools/deploy.ps1 -ProjectRef abcdefghijklmnop [-Functions game]
param([Parameter(Mandatory = $true)][string]$ProjectRef, [string[]]$Functions = @('game', 'pay'))

$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root 'supabase\functions\game\game'
New-Item -ItemType Directory -Force $dest | Out-Null
$enc = New-Object Text.UTF8Encoding($false)
# every module the server imports must be listed here (a missing one breaks the function at start)
foreach ($m in 'config', 'data', 'combat', 'server', 'gangs', 'daily', 'events', 'medals', 'api') {
  # the browser's cache-busting ?v= stamps (tools/publish.ps1) are dropped for Deno
  $t = [IO.File]::ReadAllText((Join-Path $root "js\$m.js"), $enc)
  [IO.File]::WriteAllText((Join-Path $dest "$m.js"), [regex]::Replace($t, '\.js\?v=\d+', '.js'), $enc)
}
Copy-Item (Join-Path $dest 'config.js') (Join-Path $root 'supabase\functions\pay\config.js') -Force

# the Supabase CLI: tools\bin\supabase.exe, or one on the PATH
$cli = Join-Path $root 'tools\bin\supabase.exe'
if (-not (Test-Path $cli)) { $cli = (Get-Command supabase -ErrorAction SilentlyContinue).Source }
if (-not $cli) { Write-Error 'Supabase CLI nie je nainštalované (tools\bin\supabase.exe).'; exit 1 }

Push-Location $root
try {
  # --use-api: bundled on Supabase's side, no Docker needed on this PC
  # --no-verify-jwt: both functions check the login themselves, and pay/webhook is called by Stripe (checked by signature)
  foreach ($f in $Functions) {
    & $cli functions deploy $f --project-ref $ProjectRef --no-verify-jwt --use-api
    if ($LASTEXITCODE -ne 0) { Write-Error "deploy $f failed"; exit 1 }
  }
} finally {
  Pop-Location
}
