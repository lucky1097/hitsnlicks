# App icons (home screen / PWA) from the ski-mask art on the game's black: assets/icons/app-*.png.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tools/icons.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$src = [System.Drawing.Image]::FromFile((Join-Path $root 'assets\art\maska.png'))
# the head and the chain, as a square
$crop = New-Object System.Drawing.Rectangle 0, 40, 600, 600
$bg = [System.Drawing.ColorTranslator]::FromHtml('#070707')
# name, size, share of the icon the art fills (maskable icons keep the art inside the central safe zone)
$icons = @(@('app-192', 192, 0.96), @('app-512', 512, 0.96), @('app-maskable-512', 512, 0.72), @('app-180', 180, 0.96))
foreach ($i in $icons) {
  $s = [int]$i[1]; $a = [int]($s * [double]$i[2]); $o = [int](($s - $a) / 2)
  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear($bg)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.SmoothingMode = 'HighQuality'
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle $o, ($o + [int]($s * 0.04 * [double]$i[2])), $a, $a), $crop, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $bmp.Save((Join-Path $root "assets\icons\$($i[0]).png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
$src.Dispose()
'icons done'
