# Contact sheet for checking character layers: rows x columns of combinations, each tile = base + layers.
# Usage: looksheet.ps1 -Rows "dirA" -Cols "dirB" [-Extra "file1.png,file2.png"] [-Crop "x,y,w,h"] -Out sheet.png
param([string]$Rows, [string]$Cols, [string]$Extra = '', [string]$Pre = '', [string]$Crop = '0,0,1024,1024', [int]$Tile = 200, [string]$Out, [switch]$NoneRow, [switch]$NoneCol, [switch]$ColsFirst)
Add-Type -AssemblyName System.Drawing
$d = Join-Path (Split-Path -Parent $PSScriptRoot) 'assets\postava'
$base = [System.Drawing.Image]::FromFile((Get-ChildItem $d -Recurse -Filter 'base_*.png' | Select-Object -First 1).FullName)
$r = @(Get-ChildItem (Join-Path $d $Rows) -Filter *.png | Where-Object { $_.Name -notlike 'base_*' } | Sort-Object Name | % { $_.FullName })
$c = @(Get-ChildItem (Join-Path $d $Cols) -Filter *.png | Where-Object { $_.Name -notlike 'base_*' } | Sort-Object Name | % { $_.FullName })
if ($NoneRow) { $r = @($null) + $r }; if ($NoneCol) { $c = @($null) + $c }
$ex = @($Extra.Split(',') | Where-Object { $_ } | % { (Get-ChildItem $d -Recurse -Filter $_ | Select-Object -First 1).FullName })
$preL = @($Pre.Split(',') | Where-Object { $_ } | % { (Get-ChildItem $d -Recurse -Filter $_ | Select-Object -First 1).FullName })
$cr = $Crop.Split(',') | % { [int]$_ }; $rect = New-Object System.Drawing.Rectangle $cr[0], $cr[1], $cr[2], $cr[3]
$th = [int]($Tile * $cr[3] / $cr[2])
$cache = @{}; $img = { param($p) if (-not $cache[$p]) { $cache[$p] = [System.Drawing.Image]::FromFile($p) }; $cache[$p] }
$sheet = New-Object System.Drawing.Bitmap ($Tile * $c.Count), ($th * $r.Count)
$g = [System.Drawing.Graphics]::FromImage($sheet); $g.InterpolationMode = 'HighQualityBicubic'
$font = New-Object System.Drawing.Font 'Arial', 7
for ($i = 0; $i -lt $r.Count; $i++) { for ($j = 0; $j -lt $c.Count; $j++) {
  $t = New-Object System.Drawing.Bitmap 1024, 1024; $tg = [System.Drawing.Graphics]::FromImage($t); $tg.DrawImage($base, 0, 0, 1024, 1024)
  $order = if ($ColsFirst) { @($c[$j], $r[$i]) } else { @($r[$i], $c[$j]) }
  foreach ($p in ($preL + $order + $ex)) { if ($p) { $tg.DrawImage((& $img $p), 0, 0, 1024, 1024) } }
  $tg.Dispose()
  $g.DrawImage($t, (New-Object System.Drawing.Rectangle ($j * $Tile), ($i * $th), $Tile, $th), $rect, [System.Drawing.GraphicsUnit]::Pixel); $t.Dispose()
  $lab = (@($r[$i], $c[$j]) | % { if ($_) { [IO.Path]::GetFileNameWithoutExtension($_) -replace '^[a-z]+_\d+_', '' } else { '-' } }) -join ' + '
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(160, 0, 0, 0))), ($j * $Tile), ($i * $th), $Tile, 12)
  $g.DrawString($lab, $font, [System.Drawing.Brushes]::White, ($j * $Tile) + 2, ($i * $th))
} }
$g.Dispose(); $sheet.Save($Out); $sheet.Dispose(); $cache.Values | % { $_.Dispose() }; $base.Dispose(); $Out
