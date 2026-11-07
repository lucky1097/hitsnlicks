# Generates the city maps (map_base.png + city.json) from tools/art/City.cs and City2.cs.
#   Mesto 1 -> assets/world/          Mesto 2 -> assets/world/mesto2/
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tools/mapa.ps1 [-Mesto 1|2|0] [-Debug] [-Out folder]
#   -Mesto 0 (default) makes both; -Debug also draws the street graph and grid into zdroj_art\mapa_debug (not published);
#   -Out writes into another folder instead of assets/world (for a preview).
param([int]$Mesto = 0, [switch]$Debug, [string]$Out = '')

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$files = @(Get-ChildItem (Join-Path $root 'tools\art') -Filter *.cs | ForEach-Object { $_.FullName })
$runner = Join-Path $env:TEMP 'hitsnlicks_mapa_runner.cs'
[IO.File]::WriteAllText($runner, @'
public static class MapaRunner
{
    public static string Go(int cur, string outDir, bool debug)
    {
        System.IO.Directory.CreateDirectory(outDir);
        City.Cur = cur;
        City.Layout();
        string dbg = "";
        if (debug)
        {
            string d = System.IO.Path.Combine(outDir, "debug");
            System.IO.Directory.CreateDirectory(d);
            dbg = City.Export(d, true) + " | ";
        }
        string s = City.Export(outDir, false);
        City.Cur = 1;
        return dbg + s;
    }
}
'@)
Add-Type -ReferencedAssemblies System.Drawing -Path ($files + $runner)

foreach ($n in 1, 2) {
  if ($Mesto -ne 0 -and $Mesto -ne $n) { continue }
  $dir = if ($Out) { Join-Path $Out "mesto$n" } elseif ($n -eq 1) { Join-Path $root 'assets\world' } else { Join-Path $root 'assets\world\mesto2' }
  $r = [MapaRunner]::Go($n, $dir, [bool]$Debug)
  if ($Debug -and -not $Out) {
    # the debug picture never goes to assets (it would be published)
    $dd = Join-Path $root "zdroj_art\mapa_debug\mesto$n"
    New-Item -ItemType Directory -Force $dd | Out-Null
    Move-Item -Force (Join-Path $dir 'debug\city_debug.png') $dd
    Remove-Item -Recurse -Force (Join-Path $dir 'debug')
  }
  "Mesto ${n}: " + $r.Substring(0, [Math]::Min(160, $r.Length))
}
