using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class Layers
{
    public static int[] Load(string path, out int w, out int h)
    {
        using (var src = new Bitmap(path))
        using (var bmp = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb))
        {
            using (var g = Graphics.FromImage(bmp)) g.DrawImage(src, 0, 0, src.Width, src.Height);
            w = bmp.Width; h = bmp.Height;
            var d = new int[w * h];
            var bd = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            Marshal.Copy(bd.Scan0, d, 0, d.Length);
            bmp.UnlockBits(bd);
            return d;
        }
    }

    public static void Save(int[] d, int w, int h, string path)
    {
        using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb))
        {
            var bd = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
            Marshal.Copy(d, 0, bd.Scan0, d.Length);
            bmp.UnlockBits(bd);
            bmp.Save(path, ImageFormat.Png);
        }
    }

    static int Diff(int a, int b)
    {
        return Math.Abs(((a >> 16) & 255) - ((b >> 16) & 255)) + Math.Abs(((a >> 8) & 255) - ((b >> 8) & 255)) + Math.Abs((a & 255) - (b & 255));
    }

    // keep only what a layer really changes: pixels equal to the base fade out (diff lo..hi -> alpha 0..1)
    public static string Trim(string basePath, string layerPath, string outPath, int lo, int hi)
    {
        int w, h, w2, h2;
        var b = Load(basePath, out w, out h);
        var l = Load(layerPath, out w2, out h2);
        int kept = 0, cut = 0;
        for (int i = 0; i < l.Length; i++)
        {
            int c = l[i]; int a = (c >> 24) & 255;
            if (a == 0) continue;
            int d = Diff(c, b[i]);
            double k = d <= lo ? 0 : d >= hi ? 1 : (d - lo) / (double)(hi - lo);
            int na = (int)Math.Round(a * k);
            if (na < a) cut++; if (na > 0) kept++;
            l[i] = (na << 24) | (c & 0xFFFFFF);
        }
        Save(l, w2, h2, outPath);
        return kept + " kept, " + cut + " faded";
    }

    // paint over a box with skin interpolated from its edges (vertical and horizontal blend), soft border
    public static void Erase(int[] d, int w, int x0, int y0, int x1, int y1, int feather)
    {
        var src = (int[])d.Clone();
        for (int y = y0; y <= y1; y++)
            for (int x = x0; x <= x1; x++)
            {
                double ty = (y - y0 + 1) / (double)(y1 - y0 + 2), tx = (x - x0 + 1) / (double)(x1 - x0 + 2);
                int T = src[(y0 - 1) * w + x], B = src[(y1 + 1) * w + x], L = src[y * w + x0 - 1], R = src[y * w + x1 + 1];
                double wy = 1.0 / (Math.Min(ty, 1 - ty) + 0.05), wx = 1.0 / (Math.Min(tx, 1 - tx) + 0.05);
                // blend along the shorter direction more strongly
                double k = wy / (wy + wx);
                int c = 0;
                for (int sh = 0; sh <= 16; sh += 8)
                {
                    double v = ((T >> sh) & 255) * (1 - ty) + ((B >> sh) & 255) * ty;
                    double hh = ((L >> sh) & 255) * (1 - tx) + ((R >> sh) & 255) * tx;
                    c |= ((int)Math.Round(v * k + hh * (1 - k)) & 255) << sh;
                }
                // soft edge back into the original picture
                int e = Math.Min(Math.Min(x - x0, x1 - x), Math.Min(y - y0, y1 - y));
                double m = e >= feather ? 1 : (e + 1) / (double)(feather + 1);
                int o = src[y * w + x], r = 0;
                for (int sh = 0; sh <= 16; sh += 8) r |= ((int)Math.Round(((c >> sh) & 255) * m + ((o >> sh) & 255) * (1 - m)) & 255) << sh;
                d[y * w + x] = unchecked((int)0xFF000000) | r;
            }
    }

    // fill an ellipse-ish box with plain skin: the median of the light pixels around it, a touch darker at the bottom
    public static void Skin(int[] d, int w, int x0, int y0, int x1, int y1, int feather)
    {
        var rs = new System.Collections.Generic.List<int>(); var gs = new System.Collections.Generic.List<int>(); var bs = new System.Collections.Generic.List<int>();
        for (int y = y0 - 12; y <= y1 + 12; y++) for (int x = x0 - 12; x <= x1 + 12; x++)
            {
                if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue;
                int c = d[y * w + x], r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
                if (0.299 * r + 0.587 * g + 0.114 * b < 95) continue; // skip ink lines and brows, keep the mid tones
                rs.Add(r); gs.Add(g); bs.Add(b);
            }
        rs.Sort(); gs.Sort(); bs.Sort();
        int R = rs[rs.Count / 2], G = gs[gs.Count / 2], B = bs[bs.Count / 2];
        double cx = (x0 + x1) / 2.0, cy = (y0 + y1) / 2.0, ax = (x1 - x0) / 2.0, ay = (y1 - y0) / 2.0;
        for (int y = y0 - feather; y <= y1 + feather; y++)
            for (int x = x0 - feather; x <= x1 + feather; x++)
            {
                double nx = (x - cx) / (ax + feather), ny = (y - cy) / (ay + feather);
                double dist = Math.Sqrt(nx * nx + ny * ny);
                double inner = 1 - feather / (Math.Min(ax, ay) + feather);
                double m = dist <= inner ? 1 : dist >= 1 ? 0 : (1 - dist) / (1 - inner);
                if (m <= 0) continue;
                double shade = 1 - 0.08 * Math.Max(0, (y - cy) / ay); // slightly darker under the eye
                int o = d[y * w + x];
                int r2 = (int)Math.Round(R * shade * m + ((o >> 16) & 255) * (1 - m));
                int g2 = (int)Math.Round(G * shade * m + ((o >> 8) & 255) * (1 - m));
                int b2 = (int)Math.Round(B * shade * m + (o & 255) * (1 - m));
                d[y * w + x] = unchecked((int)0xFF000000) | (r2 << 16) | (g2 << 8) | b2;
            }
    }

    public static void CleanBase(string inPath, string outPath, int[] boxes, int feather)
    {
        int w, h;
        var d = Load(inPath, out w, out h);
        for (int i = 0; i + 3 < boxes.Length; i += 4) Skin(d, w, boxes[i], boxes[i + 1], boxes[i + 2], boxes[i + 3], feather);
        Save(d, w, h, outPath);
    }

    // fade a layer in from transparent at row y0 to its own alpha at row y1 (hides a hard top edge)
    public static void FadeTop(string inPath, string outPath, int y0, int y1)
    {
        int w, h;
        var d = Load(inPath, out w, out h);
        for (int y = 0; y < Math.Min(h, y1); y++)
        {
            double k = y <= y0 ? 0 : (y - y0) / (double)(y1 - y0);
            for (int x = 0; x < w; x++)
            {
                int c = d[y * w + x], a = (c >> 24) & 255;
                if (a == 0) continue;
                d[y * w + x] = ((int)Math.Round(a * k) << 24) | (c & 0xFFFFFF);
            }
        }
        Save(d, w, h, outPath);
    }

    // opaque bbox, and bbox of pixels that really differ from the base, plus a row histogram of the differing pixels
    public static string Stats(string basePath, string layerPath, int thr)
    {
        int w, h, w2, h2;
        var b = Load(basePath, out w, out h);
        var l = Load(layerPath, out w2, out h2);
        int ox0 = w, oy0 = h, ox1 = -1, oy1 = -1, dx0 = w, dy0 = h, dx1 = -1, dy1 = -1, n = 0, nd = 0;
        var rows = new int[h / 16 + 1];
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++)
            {
                int c = l[y * w + x];
                if (((c >> 24) & 255) < 20) continue;
                n++;
                ox0 = Math.Min(ox0, x); ox1 = Math.Max(ox1, x); oy0 = Math.Min(oy0, y); oy1 = Math.Max(oy1, y);
                if (Diff(c, b[y * w + x]) > thr) { nd++; dx0 = Math.Min(dx0, x); dx1 = Math.Max(dx1, x); dy0 = Math.Min(dy0, y); dy1 = Math.Max(dy1, y); rows[y / 16]++; }
            }
        var sb = new System.Text.StringBuilder();
        for (int i = 0; i < rows.Length; i++) if (rows[i] > 0) sb.Append(i * 16).Append(':').Append(rows[i]).Append(' ');
        return string.Format("opaque {0} [{1},{2}..{3},{4}] differ {5} [{6},{7}..{8},{9}] rows {10}", n, ox0, oy0, ox1, oy1, nd, dx0, dy0, dx1, dy1, sb);
    }
}
