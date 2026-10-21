# Weapon cut-outs for fight animations: removes the coloured card background of an item picture.
# The background is a smooth gradient, so it is grown from the picture border to neighbours with a small
# colour step; the item's edge is a jump and stops it. Leftover sparkles (small islands) are cleared, and
# enclosed holes in the background's hue (trigger guards, rings, chain loops) too, except on gold cards.
# Usage: powershell -File tools\cutout.ps1 [-Ids w_bat,w_knife] [-Size 256] [-Step 34]
param([string[]]$Ids, [int]$Size = 256, [int]$Step = 34)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Collections.Generic; using System.Drawing; using System.Drawing.Imaging;
public static class Cut {
  static int Luma(Color c) { return (c.R * 299 + c.G * 587 + c.B * 114) / 1000; }
  static int Dist(Color a, Color b) { return Math.Abs(a.R - b.R) + Math.Abs(a.G - b.G) + Math.Abs(a.B - b.B); }
  public static Bitmap Run(Bitmap src, int size, int step) {
    var b = new Bitmap(src, size, size); int w = size, h = size;
    var px = new Color[w, h]; for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) px[x, y] = b.GetPixel(x, y);
    var bg = new bool[w, h]; var q = new Queue<int>();
    for (int i = 0; i < w; i++) { bg[i, 0] = bg[i, h - 1] = true; q.Enqueue(i); q.Enqueue((h - 1) * w + i); }
    for (int j = 0; j < h; j++) { bg[0, j] = bg[w - 1, j] = true; q.Enqueue(j * w); q.Enqueue(j * w + w - 1); }
    long sr = 0, sg = 0, sb = 0, n = 0;
    int[] dx = { 1, -1, 0, 0 }, dy = { 0, 0, 1, -1 };
    while (q.Count > 0) {
      int p = q.Dequeue(), x = p % w, y = p / w; var c = px[x, y]; sr += c.R; sg += c.G; sb += c.B; n++;
      for (int k = 0; k < 4; k++) {
        int xx = x + dx[k], yy = y + dy[k];
        if (xx < 0 || yy < 0 || xx >= w || yy >= h || bg[xx, yy]) continue;
        var t = px[xx, yy]; int sp = Math.Max(t.R, Math.Max(t.G, t.B)) - Math.Min(t.R, Math.Min(t.G, t.B));
        // never into dark grey (outlines, black guns): the card's dark vignette is still clearly coloured
        if (Dist(t, c) < step && (Luma(t) > 70 || sp > 60)) { bg[xx, yy] = true; q.Enqueue(yy * w + xx); }
      }
    }
    var avg = Color.FromArgb((int)(sr / n), (int)(sg / n), (int)(sb / n));
    float bh = avg.GetHue();
    // enclosed holes in the background's hue (not on gold cards: the gold item has that hue itself)
    if (!(bh > 20 && bh < 65)) for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
      if (bg[x, y]) continue; var c = px[x, y];
      float d = Math.Abs(c.GetHue() - bh); if (d > 180) d = 360 - d;
      if (d < 28 && c.GetSaturation() > 0.3 && Luma(c) > 90) bg[x, y] = true;
    }
    // keep only big pieces: sparkles and stray specks go
    var lab = new int[w, h]; var sizes = new List<int> { 0 };
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
      if (bg[x, y] || lab[x, y] != 0) continue;
      int id = sizes.Count, cnt = 0; var s = new Stack<int>(); s.Push(y * w + x); lab[x, y] = id;
      while (s.Count > 0) {
        int p = s.Pop(), cx = p % w, cy = p / w; cnt++;
        for (int k = 0; k < 4; k++) { int xx = cx + dx[k], yy = cy + dy[k]; if (xx < 0 || yy < 0 || xx >= w || yy >= h || bg[xx, yy] || lab[xx, yy] != 0) continue; lab[xx, yy] = id; s.Push(yy * w + xx); }
      }
      sizes.Add(cnt);
    }
    int max = 0; foreach (var z in sizes) max = Math.Max(max, z);
    var o = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
      bool keep = !bg[x, y] && sizes[lab[x, y]] >= max * 0.08;
      if (!keep) { o.SetPixel(x, y, Color.Transparent); continue; }
      int near = 0; for (int k = 0; k < 4; k++) { int xx = x + dx[k], yy = y + dy[k]; if (xx < 0 || yy < 0 || xx >= w || yy >= h || bg[xx, yy]) near++; }
      o.SetPixel(x, y, Color.FromArgb(near >= 2 ? 150 : 255, px[x, y]));
    }
    b.Dispose(); return o;
  }
}
'@
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root 'assets\fx'; New-Item -ItemType Directory -Force $out | Out-Null
if (-not $Ids) { $Ids = (Get-ChildItem (Join-Path $root 'assets\art') -Filter 'w_*.jpg').BaseName }
foreach ($id in $Ids) {
  $p = Join-Path $root "assets\art\$id.jpg"; if (-not (Test-Path $p)) { $p = Join-Path $root "assets\art\$id.png" }
  if (-not (Test-Path $p)) { "missing $id"; continue }
  $src = New-Object System.Drawing.Bitmap $p
  $o = [Cut]::Run($src, $Size, $Step); $o.Save((Join-Path $out "$id.png"), [System.Drawing.Imaging.ImageFormat]::Png); $o.Dispose(); $src.Dispose()
}
'done ' + $Ids.Count
