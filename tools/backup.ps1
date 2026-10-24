# Backs up the live database (players, gangs, the shared city) into zalohy\<date-time>\ on this PC.
# The folder is in .gitignore: it holds every player's save and must never be published.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tools/backup.ps1
# Restore: ask Claude, the files are plain JSON rows of each table.
param([string]$ProjectRef = 'ivzplchpakfkilnzvkyj')

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$cli = Join-Path $root 'tools\bin\supabase.exe'
$dir = Join-Path $root ('zalohy\' + (Get-Date -Format 'yyyy-MM-dd_HH-mm'))
New-Item -ItemType Directory -Force $dir | Out-Null
$enc = New-Object Text.UTF8Encoding($false)

foreach ($table in 'players', 'gangs', 'world') {
  # the whole table as one JSON array, so nothing depends on the CLI's table formatting
  # the CLI writes progress to stderr, which Windows PowerShell would turn into a stopping error
  $ErrorActionPreference = 'Continue'
  $out = & $cli db query --linked --project-ref $ProjectRef "select coalesce(json_agg(t), '[]'::json) as rows from public.$table t" 2>$null | Out-String
  $ErrorActionPreference = 'Stop'
  if ($LASTEXITCODE -ne 0) { throw "Záloha tabuľky $table zlyhala." }
  $parsed = $out | ConvertFrom-Json
  $rows = $parsed.rows[0].rows
  $json = ConvertTo-Json -InputObject @($rows) -Depth 64 -Compress
  [IO.File]::WriteAllText((Join-Path $dir "$table.json"), $json, $enc)
  "{0}: {1} riadkov" -f $table, @($rows).Count
}
"Záloha je v $dir"

# keep the newest 30 backups
Get-ChildItem (Join-Path $root 'zalohy') -Directory | Sort-Object Name -Descending | Select-Object -Skip 30 | Remove-Item -Recurse -Force
