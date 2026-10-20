using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public static class Cl
{
    public static int H(string hex)
    {
        hex = hex.TrimStart('#');
        return unchecked((int)0xFF000000) | Convert.ToInt32(hex, 16);
    }
    public static int R(int c) { return (c >> 16) & 255; }
    public static int G(int c) { return (c >> 8) & 255; }
    public static int B(int c) { return c & 255; }
    public static int Al(int c) { return (c >> 24) & 255; }
    public static int Rgb(int a, int r, int g, int b) { return (a << 24) | (r << 16) | (g << 8) | b; }
    public static int Mix(int a, int b, double t)
    {
        if (t < 0) t = 0; if (t > 1) t = 1;
        int r = (int)Math.Round(R(a) + (R(b) - R(a)) * t);
        int g = (int)Math.Round(G(a) + (G(b) - G(a)) * t);
        int bb = (int)Math.Round(B(a) + (B(b) - B(a)) * t);
        return Rgb(Al(a), r, g, bb);
    }
    public static int A(int c, int alpha) { return (c & 0xFFFFFF) | (alpha << 24); }
    public static readonly int DARK = H("1a1626");
    public static readonly int LIGHT = H("fff0d4");
    public static int Dk(int c, double t) { return Mix(c, DARK, t); }
    public static int Lt(int c, double t) { return Mix(c, LIGHT, t); }
    public static double Lum(int c) { return 0.299 * R(c) + 0.587 * G(c) + 0.114 * B(c); }
}

public class Img
{
    public int W, Hh, OX, OY;
    public int[] D;
    public Img(int w, int h) { W = w; Hh = h; D = new int[w * h]; }
    public bool In(int x, int y) { return x >= 0 && y >= 0 && x < W && y < Hh; }
    public int Get(int x, int y) { x += OX; y += OY; return In(x, y) ? D[y * W + x] : 0; }
    public void Put(int x, int y, int c) { x += OX; y += OY; if (In(x, y)) D[y * W + x] = c; }
    public void Grade(double desat, double dark)
    {
        for (int i = 0; i < D.Length; i++)
        {
            int c = D[i];
            if (Cl.Al(c) == 0) continue;
            int l = (int)Math.Round(Cl.Lum(c));
            int g = Cl.Rgb(Cl.Al(c), l, l, l);
            c = Cl.Mix(c, g, desat);
            c = Cl.Mix(c, Cl.Rgb(Cl.Al(c), 8, 8, 10), dark);
            D[i] = c;
        }
    }
    public void Set(int x, int y, int c)
    {
        x += OX; y += OY;
        if (!In(x, y)) return;
        int a = Cl.Al(c);
        if (a == 0) return;
        int i = y * W + x;
        if (a == 255) { D[i] = c; return; }
        int d = D[i];
        int da = Cl.Al(d);
        if (da == 0) { D[i] = c; return; }
        double t = a / 255.0;
        int r = (int)Math.Round(Cl.R(c) * t + Cl.R(d) * (1 - t));
        int g = (int)Math.Round(Cl.G(c) * t + Cl.G(d) * (1 - t));
        int b = (int)Math.Round(Cl.B(c) * t + Cl.B(d) * (1 - t));
        int oa = Math.Min(255, (int)Math.Round(a + da * (1 - t)));
        D[i] = Cl.Rgb(oa, r, g, b);
    }
    public void Fill(int x, int y, int w, int h, int c)
    {
        for (int j = y; j < y + h; j++) for (int i = x; i < x + w; i++) Set(i, j, c);
    }
    public void Span(int y, int xa, int xb, int c) { for (int x = xa; x <= xb; x++) Set(x, y, c); }
    public void Ellipse(double cx, double cy, double rx, double ry, int c)
    {
        for (int j = (int)Math.Floor(cy - ry) - 1; j <= (int)Math.Ceiling(cy + ry) + 1; j++)
            for (int i = (int)Math.Floor(cx - rx) - 1; i <= (int)Math.Ceiling(cx + rx) + 1; i++)
            {
                double dx = (i + 0.5 - cx) / rx, dy = (j + 0.5 - cy) / ry;
                if (dx * dx + dy * dy <= 1.0) Set(i, j, c);
            }
    }
    public void Ring(double cx, double cy, double rx, double ry, int c)
    {
        for (int j = (int)Math.Floor(cy - ry) - 1; j <= (int)Math.Ceiling(cy + ry) + 1; j++)
            for (int i = (int)Math.Floor(cx - rx) - 1; i <= (int)Math.Ceiling(cx + rx) + 1; i++)
            {
                double dx = (i + 0.5 - cx) / rx, dy = (j + 0.5 - cy) / ry;
                double d = dx * dx + dy * dy;
                double dx2 = (i + 0.5 - cx) / (rx - 1), dy2 = (j + 0.5 - cy) / (ry - 1);
                if (d <= 1.0 && dx2 * dx2 + dy2 * dy2 > 1.0) Set(i, j, c);
            }
    }
    public void Line(int x0, int y0, int x1, int y1, int c)
    {
        int dx = Math.Abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        int dy = -Math.Abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        int err = dx + dy;
        while (true)
        {
            Set(x0, y0, c);
            if (x0 == x1 && y0 == y1) break;
            int e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
    }
    public void Blit(Img s, int dx, int dy, int rot)
    {
        for (int sy = 0; sy < s.Hh; sy++)
            for (int sx = 0; sx < s.W; sx++)
            {
                int c = s.D[sy * s.W + sx];
                if (Cl.Al(c) == 0) continue;
                int tx, ty;
                if (rot == 1) { tx = s.Hh - 1 - sy; ty = sx; }
                else if (rot == 2) { tx = s.W - 1 - sx; ty = s.Hh - 1 - sy; }
                else if (rot == 3) { tx = sy; ty = s.W - 1 - sx; }
                else { tx = sx; ty = sy; }
                Set(dx + tx, dy + ty, c);
            }
    }
    public void AutoOutline(double t)
    {
        int[] src = (int[])D.Clone();
        int[] nx = { 1, -1, 0, 0 }, ny = { 0, 0, 1, -1 };
        for (int y = 0; y < Hh; y++)
            for (int x = 0; x < W; x++)
            {
                if (Cl.Al(src[y * W + x]) >= 128) continue;
                int best = 0; double bl = 9999; bool found = false;
                for (int k = 0; k < 4; k++)
                {
                    int xx = x + nx[k], yy = y + ny[k];
                    if (xx < 0 || yy < 0 || xx >= W || yy >= Hh) continue;
                    int c = src[yy * W + xx];
                    if (Cl.Al(c) < 200) continue;
                    double l = Cl.Lum(c);
                    if (l < bl) { bl = l; best = c; found = true; }
                }
                if (found) D[y * W + x] = Cl.A(Cl.Dk(best, t), 255);
            }
    }
    public Img Scale(int k)
    {
        var o = new Img(W * k, Hh * k);
        for (int y = 0; y < o.Hh; y++)
            for (int x = 0; x < o.W; x++)
                o.D[y * o.W + x] = D[(y / k) * W + (x / k)];
        return o;
    }
    public Img Crop(int x0, int y0, int w, int h)
    {
        var o = new Img(w, h);
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) o.D[y * w + x] = Get(x0 + x, y0 + y);
        return o;
    }
    public void Save(string path)
    {
        using (var bmp = new Bitmap(W, Hh, PixelFormat.Format32bppArgb))
        {
            var bd = bmp.LockBits(new Rectangle(0, 0, W, Hh), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
            Marshal.Copy(D, 0, bd.Scan0, D.Length);
            bmp.UnlockBits(bd);
            bmp.Save(path, ImageFormat.Png);
        }
    }
    public void Noise(int x, int y, int w, int h, int baseC, double amp, Random r)
    {
        for (int j = y; j < y + h; j++)
            for (int i = x; i < x + w; i++)
            {
                double v = r.NextDouble();
                int c = v < 0.5 ? Cl.Dk(baseC, (0.5 - v) * 2 * amp) : Cl.Lt(baseC, (v - 0.5) * 2 * amp);
                Set(i, j, c);
            }
    }
}

// ---------------------------------------------------------------- people (front view)
public class P
{
    public string build = "normal";
    public int skin = Cl.H("c68a5c"), hair = Cl.H("1f1a1a"), top = Cl.H("e8e6e0"), top2 = Cl.H("e8e6e0");
    public int pants = Cl.H("3c5a80"), shoe = Cl.H("e8e6e0"), shoe2 = Cl.H("c03a2b"), hat = Cl.H("202020");
    public string hairStyle = "short", hatStyle = "", topStyle = "tee", pantsStyle = "jeans", shoeStyle = "sneaker", beard = "";
    public bool shades, chain, scar, gloves, tattoo, knuckles, briefcase, earring, stetho, lips, mask, cigar, grill;
}

public class Geo
{
    public int cx = 16;
    public int hx0, hx1, hy0, hy1, nx0, nx1, ny0, ny1;
    public List<int[]> torso = new List<int[]>();
    public int aLx0, aLx1, aRx0, aRx1, ay0, ay1, hdy0, hdy1;
    public int belt, bx0, bx1, hipy0, hipy1, legy0, legy1, lLx0, lLx1, lRx0, lRx1;
    public int sy0, sy1, sLx0, sLx1, sRx0, sRx1;
    public int T0 { get { return torso[0][0]; } }
    public int TEnd { get { return torso[torso.Count - 1][0]; } }
    public int[] Row(int y) { foreach (var r in torso) if (r[0] == y) return r; return null; }
    void Rows(int y0, int y1, int xa, int xb) { for (int y = y0; y <= y1; y++) torso.Add(new int[] { y, xa, xb }); }

    public static Geo Of(string build)
    {
        var g = new Geo();
        if (build == "bulky")
        {
            g.hx0 = 11; g.hx1 = 20; g.hy0 = 4; g.hy1 = 14; g.nx0 = 13; g.nx1 = 18; g.ny0 = 15; g.ny1 = 16;
            g.Rows(17, 17, 9, 22); g.Rows(18, 24, 6, 25); g.Rows(25, 30, 8, 23);
            g.aLx0 = 2; g.aLx1 = 5; g.aRx0 = 26; g.aRx1 = 29; g.ay0 = 18; g.ay1 = 29; g.hdy0 = 30; g.hdy1 = 33;
            g.belt = 31; g.bx0 = 9; g.bx1 = 22; g.hipy0 = 32; g.hipy1 = 36; g.legy0 = 37; g.legy1 = 45;
            g.lLx0 = 9; g.lLx1 = 14; g.lRx0 = 17; g.lRx1 = 22;
            g.sy0 = 46; g.sy1 = 48; g.sLx0 = 8; g.sLx1 = 14; g.sRx0 = 17; g.sRx1 = 23;
        }
        else if (build == "female")
        {
            g.hx0 = 12; g.hx1 = 19; g.hy0 = 4; g.hy1 = 13; g.nx0 = 14; g.nx1 = 17; g.ny0 = 14; g.ny1 = 15;
            g.Rows(16, 16, 12, 19); g.Rows(17, 21, 10, 21); g.Rows(22, 26, 11, 20); g.Rows(27, 30, 10, 21);
            g.aLx0 = 7; g.aLx1 = 9; g.aRx0 = 22; g.aRx1 = 24; g.ay0 = 17; g.ay1 = 28; g.hdy0 = 29; g.hdy1 = 31;
            g.belt = 31; g.bx0 = 10; g.bx1 = 21; g.hipy0 = 32; g.hipy1 = 36; g.legy0 = 37; g.legy1 = 45;
            g.lLx0 = 10; g.lLx1 = 14; g.lRx0 = 17; g.lRx1 = 21;
            g.sy0 = 46; g.sy1 = 48; g.sLx0 = 10; g.sLx1 = 14; g.sRx0 = 17; g.sRx1 = 21;
        }
        else
        {
            g.hx0 = 11; g.hx1 = 20; g.hy0 = 3; g.hy1 = 13; g.nx0 = 14; g.nx1 = 17; g.ny0 = 14; g.ny1 = 15;
            g.Rows(16, 16, 11, 20); g.Rows(17, 23, 9, 22); g.Rows(24, 30, 10, 21);
            g.aLx0 = 6; g.aLx1 = 8; g.aRx0 = 23; g.aRx1 = 25; g.ay0 = 17; g.ay1 = 29; g.hdy0 = 30; g.hdy1 = 32;
            g.belt = 31; g.bx0 = 10; g.bx1 = 21; g.hipy0 = 32; g.hipy1 = 36; g.legy0 = 37; g.legy1 = 45;
            g.lLx0 = 10; g.lLx1 = 14; g.lRx0 = 17; g.lRx1 = 21;
            g.sy0 = 46; g.sy1 = 48; g.sLx0 = 9; g.sLx1 = 14; g.sRx0 = 17; g.sRx1 = 22;
        }
        return g;
    }
}

public static class Person
{
    static void ShadedSpan(Img im, int y, int xa, int xb, int c)
    {
        for (int x = xa; x <= xb; x++) im.Put(x, y, c);
        im.Put(xa, y, Cl.Lt(c, 0.12));
        im.Put(xb, y, Cl.Dk(c, 0.32));
        if (xb - 1 > xa) im.Put(xb - 1, y, Cl.Dk(c, 0.14));
    }

    static string Sleeve(string s)
    {
        if (s == "tee" || s == "police" || s == "coverall") return "short";
        if (s == "tank") return "none";
        return "long";
    }

    public static Img Draw(P p)
    {
        var im = new Img(32, 54);
        im.OY = 2;
        var g = Geo.Of(p.build);
        int cx = g.cx;

        // 1. back layers: long hair, hoodie hood
        if (p.hairStyle == "long")
        {
            for (int y = g.hy0 + 2; y <= g.hy1 + 4; y++) { im.Put(g.hx0 - 1, y, Cl.Dk(p.hair, 0.1)); im.Put(g.hx1 + 1, y, Cl.Dk(p.hair, 0.3)); im.Put(g.hx0, y, p.hair); im.Put(g.hx1, y, Cl.Dk(p.hair, 0.15)); }
        }
        if (p.topStyle == "hoodie" && p.hatStyle == "hood")
        {
            for (int y = g.hy0 - 1; y <= g.hy1 + 2; y++)
            {
                int xa = g.hx0 - 2, xb = g.hx1 + 2;
                if (y == g.hy0 - 1) { xa += 2; xb -= 2; }
                else if (y == g.hy0) { xa += 1; xb -= 1; }
                ShadedSpan(im, y, xa, xb, p.top);
            }
        }

        // 2. legs, hips
        Legs(im, g, p);
        Shoes(im, g, p);
        // belt
        if (p.topStyle != "track" && p.pantsStyle != "track")
        {
            int bc = p.pantsStyle == "coverall" ? Cl.Dk(p.pants, 0.15) : Cl.H("2a211c");
            for (int x = g.bx0; x <= g.bx1; x++) im.Put(x, g.belt, bc);
            if (p.pantsStyle != "coverall") { im.Put(cx - 1, g.belt, Cl.H("b8bcc2")); im.Put(cx, g.belt, Cl.H("8a8f96")); }
        }
        else
        {
            for (int x = g.bx0; x <= g.bx1; x++) im.Put(x, g.belt, Cl.Dk(p.pants, 0.12));
        }

        // coat skirt
        if (p.topStyle == "coat" || p.topStyle == "labcoat")
        {
            for (int y = g.belt; y <= g.legy0 + 4; y++)
            {
                ShadedSpan(im, y, g.bx0 - 1, g.bx1 + 1, p.top);
                if (y > g.belt + 1) { im.Put(cx - 1, y, Cl.Dk(p.top, 0.45)); im.Put(cx, y, Cl.Dk(p.top, 0.25)); }
            }
            for (int x = g.bx0 - 1; x <= g.bx1 + 1; x++) im.Put(x, g.legy0 + 4, Cl.Dk(p.top, 0.2));
            if (p.topStyle == "labcoat")
            {
                for (int x = g.bx0 + 1; x <= g.bx0 + 3; x++) im.Put(x, g.belt + 3, Cl.Dk(p.top, 0.18));
                for (int x = g.bx1 - 3; x <= g.bx1 - 1; x++) im.Put(x, g.belt + 3, Cl.Dk(p.top, 0.18));
            }
        }

        // 3. torso
        Torso(im, g, p);
        // 4. arms
        Arms(im, g, p);
        // 5. neck
        for (int y = g.ny0; y <= g.ny1; y++) for (int x = g.nx0; x <= g.nx1; x++) im.Put(x, y, Cl.Dk(p.skin, x == g.nx1 ? 0.3 : 0.16));
        if (p.topStyle == "track" || p.topStyle == "police" || p.topStyle == "coverall")
            for (int x = g.nx0; x <= g.nx1; x++) im.Put(x, g.ny1, Cl.Dk(p.top, 0.1));
        // 6. head
        Head(im, g, p);
        // 7. accessories
        if (p.chain)
        {
            int t0 = g.T0;
            int[][] pts = {
                new int[]{cx-3,t0}, new int[]{cx-3,t0+1}, new int[]{cx-2,t0+2}, new int[]{cx-2,t0+3}, new int[]{cx-1,t0+4},
                new int[]{cx,t0+4}, new int[]{cx+1,t0+3}, new int[]{cx+1,t0+2}, new int[]{cx+2,t0+1}, new int[]{cx+2,t0} };
            int gold = Cl.H("e0b341"), goldD = Cl.H("9c6a1c");
            for (int i = 0; i < pts.Length; i++) im.Put(pts[i][0], pts[i][1], i % 2 == 0 ? gold : goldD);
            im.Put(cx - 1, t0 + 5, Cl.Lt(gold, 0.4)); im.Put(cx, t0 + 5, gold);
            im.Put(cx - 1, t0 + 6, gold); im.Put(cx, t0 + 6, goldD);
        }
        if (p.stetho)
        {
            int t0 = g.T0; int s = Cl.H("9aa3ab");
            for (int y = t0; y <= t0 + 4; y++) { im.Put(cx - 3, y, s); im.Put(cx + 2, y, s); }
            im.Put(cx - 2, t0 + 5, s); im.Put(cx + 1, t0 + 5, s); im.Put(cx - 1, t0 + 6, s); im.Put(cx, t0 + 6, Cl.Lt(s, 0.4));
        }
        if (p.briefcase)
        {
            int bx = g.aRx0 - 1, by = g.hdy1 - 1;
            int bc = Cl.H("5a3a24");
            for (int y = by; y <= by + 6; y++) ShadedSpan(im, y, bx, bx + 5, bc);
            im.Put(bx + 2, by - 1, Cl.H("2a1c12")); im.Put(bx + 3, by - 1, Cl.H("2a1c12"));
            im.Put(bx + 2, by + 2, Cl.H("c9a24a")); im.Put(bx + 3, by + 2, Cl.H("c9a24a"));
        }

        im.AutoOutline(0.62);
        im.OX = 0; im.OY = 0;
        return im;
    }

    static void Legs(Img im, Geo g, P p)
    {
        int pc = p.pants;
        for (int y = g.hipy0; y <= g.hipy1; y++)
        {
            ShadedSpan(im, y, g.bx0, g.bx1, pc);
            if (p.pantsStyle == "jeans") { im.Put(g.cx - 3, y, Cl.Lt(pc, 0.12)); im.Put(g.cx + 2, y, Cl.Lt(pc, 0.08)); }
        }
        for (int y = g.hipy0 + 2; y <= g.hipy1; y++) { im.Put(g.cx - 1, y, Cl.Dk(pc, 0.2)); im.Put(g.cx, y, Cl.Dk(pc, 0.3)); }
        int[][] legs = { new int[] { g.lLx0, g.lLx1, 0 }, new int[] { g.lRx0, g.lRx1, 1 } };
        foreach (var L in legs)
        {
            for (int y = g.legy0; y <= g.legy1; y++)
            {
                bool bare = p.pantsStyle == "shorts" && y >= g.legy0 + 3;
                int c = bare ? p.skin : pc;
                ShadedSpan(im, y, L[0], L[1], c);
                if (!bare)
                {
                    if (p.pantsStyle == "jeans" && y <= g.legy0 + 4) im.Put(L[0] + 2, y, Cl.Lt(pc, 0.14));
                    if (p.pantsStyle == "slacks") im.Put((L[0] + L[1]) / 2, y, Cl.Lt(pc, 0.12));
                    if (p.pantsStyle == "track") im.Put(L[2] == 0 ? L[0] : L[1], y, p.top2);
                    if (p.pantsStyle == "cargo" && y >= g.legy0 + 1 && y <= g.legy0 + 4)
                    {
                        int px = L[2] == 0 ? L[0] : L[1] - 1;
                        im.Put(px, y, Cl.Dk(pc, 0.18)); im.Put(px + 1, y, Cl.Dk(pc, 0.12));
                    }
                }
                if (y == g.legy0 + 3 && !bare) im.Put(L[0] + 1, y, Cl.Lt(c, 0.1));
                if (y == g.legy1 && !bare) for (int x = L[0]; x <= L[1]; x++) im.Put(x, y, Cl.Dk(c, 0.15));
            }
        }
    }

    static void Shoes(Img im, Geo g, P p)
    {
        int[][] feet = { new int[] { g.sLx0, g.sLx1 }, new int[] { g.sRx0, g.sRx1 } };
        foreach (var f in feet)
        {
            int c = p.shoe;
            if (p.shoeStyle == "boots")
                for (int x = f[0] + 1; x <= f[1] - 1; x++) im.Put(x, g.sy0 - 1, Cl.Dk(c, 0.1));
            for (int x = f[0] + 1; x <= f[1] - 1; x++) im.Put(x, g.sy0, c);
            ShadedSpan(im, g.sy0 + 1, f[0], f[1], c);
            int sole = p.shoeStyle == "sneaker" ? Cl.H("a9a59c") : Cl.Dk(c, 0.5);
            for (int x = f[0]; x <= f[1]; x++) im.Put(x, g.sy1, sole);
            im.Put(f[0] + 1, g.sy0 + 1, Cl.Lt(c, 0.35));
            if (p.shoeStyle == "sneaker") { im.Put(f[0] + 2, g.sy0 + 1, p.shoe2); im.Put(f[0] + 3, g.sy0 + 1, p.shoe2); }
            if (p.shoeStyle == "dress") im.Put(f[0] + 2, g.sy0, Cl.Lt(c, 0.5));
        }
    }

    static void Torso(Img im, Geo g, P p)
    {
        int cx = g.cx, t0 = g.T0, te = g.TEnd;
        foreach (var r in g.torso) ShadedSpan(im, r[0], r[1], r[2], p.top);
        int[] last = g.Row(te);
        for (int x = last[1]; x <= last[2]; x++) im.Put(x, te, Cl.Dk(p.top, 0.14));
        int skin = p.skin;
        string s = p.topStyle;
        if (s == "tee")
        {
            for (int x = cx - 2; x <= cx + 1; x++) im.Put(x, t0, Cl.Dk(skin, 0.18));
            im.Put(cx - 1, t0 + 1, Cl.Dk(skin, 0.1)); im.Put(cx, t0 + 1, Cl.Dk(skin, 0.16));
            int tr = Cl.Dk(p.top, 0.16);
            im.Put(cx - 3, t0, tr); im.Put(cx + 2, t0, tr); im.Put(cx - 2, t0 + 1, tr); im.Put(cx + 1, t0 + 1, tr); im.Put(cx - 1, t0 + 2, tr); im.Put(cx, t0 + 2, tr);
            if (p.build == "bulky") { for (int x = cx - 5; x <= cx - 1; x++) im.Put(x, t0 + 6, Cl.Dk(p.top, 0.1)); for (int x = cx; x <= cx + 4; x++) im.Put(x, t0 + 6, Cl.Dk(p.top, 0.16)); }
        }
        else if (s == "tank")
        {
            for (int y = t0; y <= t0 + 3; y++)
            {
                int[] r = g.Row(y);
                ShadedSpan(im, y, r[1], r[2], skin);
                im.Put(cx - 5, y, p.top); im.Put(cx - 4, y, p.top); im.Put(cx + 3, y, p.top); im.Put(cx + 4, y, Cl.Dk(p.top, 0.1));
            }
            for (int x = cx - 3; x <= cx + 2; x++) im.Put(x, t0 + 4, Cl.Dk(skin, 0.1));
            im.Put(cx - 1, t0 + 5, Cl.Dk(skin, 0.15)); im.Put(cx, t0 + 5, Cl.Dk(skin, 0.2));
            for (int x = cx - 4; x <= cx - 1; x++) im.Put(x, t0 + 7, Cl.Dk(p.top, 0.08));
            for (int x = cx; x <= cx + 3; x++) im.Put(x, t0 + 7, Cl.Dk(p.top, 0.14));
        }
        else if (s == "hoodie")
        {
            for (int x = cx - 4; x <= cx + 3; x++) { im.Put(x, t0, Cl.Dk(p.top, 0.2)); im.Put(x, t0 + 1, Cl.Dk(p.top, 0.1)); }
            im.Put(cx - 1, t0, Cl.Dk(skin, 0.3)); im.Put(cx, t0, Cl.Dk(skin, 0.35));
            for (int y = t0 + 1; y <= t0 + 5; y++) { im.Put(cx - 2, y, Cl.Lt(p.top, 0.45)); im.Put(cx + 1, y, Cl.Lt(p.top, 0.35)); }
            int py = te - 5;
            for (int x = cx - 4; x <= cx + 3; x++) { im.Put(x, py, Cl.Dk(p.top, 0.25)); for (int y = py + 1; y <= py + 3; y++) im.Put(x, y, Cl.Dk(p.top, 0.1)); }
            im.Put(cx - 4, py + 1, Cl.Dk(p.top, 0.25)); im.Put(cx + 3, py + 1, Cl.Dk(p.top, 0.3));
        }
        else if (s == "leather" || s == "coat" || s == "labcoat")
        {
            for (int y = t0; y <= te; y++)
                for (int x = cx - 2; x <= cx + 1; x++)
                    im.Put(x, y, x >= cx ? Cl.Dk(p.top2, 0.12) : p.top2);
            im.Put(cx - 1, t0, Cl.Dk(skin, 0.2)); im.Put(cx, t0, Cl.Dk(skin, 0.28));
            if (s == "labcoat") { im.Put(cx - 1, t0 + 1, Cl.Dk(skin, 0.15)); im.Put(cx, t0 + 1, Cl.Dk(skin, 0.2)); }
            for (int y = t0; y <= t0 + 3; y++)
            {
                im.Put(cx - 4, y, Cl.Lt(p.top, 0.18)); im.Put(cx - 3, y, Cl.Lt(p.top, 0.1));
                im.Put(cx + 2, y, Cl.Dk(p.top, 0.05)); im.Put(cx + 3, y, Cl.Lt(p.top, 0.08));
            }
            for (int y = t0 + 4; y <= te; y++) { im.Put(cx - 3, y, Cl.Dk(p.top, 0.3)); im.Put(cx + 2, y, Cl.Dk(p.top, 0.4)); }
            if (s == "leather" || s == "coat")
            {
                int sh = Cl.Lt(p.top, 0.32);
                int[] r = g.Row(t0 + 2);
                im.Put(r[1] + 2, t0 + 2, sh); im.Put(r[1] + 3, t0 + 3, sh); im.Put(r[1] + 2, t0 + 3, Cl.Lt(p.top, 0.2));
                im.Put(r[2] - 4, t0 + 2, Cl.Lt(p.top, 0.18));
            }
            if (s == "labcoat")
            {
                int[] r = g.Row(te - 3);
                for (int x = r[1] + 1; x <= r[1] + 3; x++) im.Put(x, te - 3, Cl.Dk(p.top, 0.18));
                im.Put(r[2] - 2, t0 + 4, Cl.H("3f6fb0")); im.Put(r[2] - 2, t0 + 5, Cl.H("3f6fb0"));
            }
        }
        else if (s == "track")
        {
            for (int x = cx - 3; x <= cx + 2; x++) { im.Put(x, t0, Cl.Dk(p.top, 0.18)); im.Put(x, t0 + 1, Cl.Dk(p.top, 0.08)); }
            for (int y = t0 + 1; y <= te; y++) im.Put(cx, y, Cl.Lt(p.top, 0.4));
            for (int y = t0 + 5; y <= t0 + 6; y++) { int[] r = g.Row(y); for (int x = r[1]; x <= r[2]; x++) if (x != cx) im.Put(x, y, x > r[2] - 2 ? Cl.Dk(p.top2, 0.2) : p.top2); }
        }
        else if (s == "suit")
        {
            int shirt = Cl.H("e8e6e0");
            int[][] v = { new int[] { -3, 2 }, new int[] { -3, 2 }, new int[] { -2, 1 }, new int[] { -2, 1 }, new int[] { -1, 0 }, new int[] { -1, 0 } };
            for (int i = 0; i < v.Length; i++)
            {
                for (int x = cx + v[i][0]; x <= cx + v[i][1]; x++) im.Put(x, t0 + i, x > cx ? Cl.Dk(shirt, 0.12) : shirt);
                im.Put(cx + v[i][0] - 1, t0 + i, Cl.Lt(p.top, 0.22)); im.Put(cx + v[i][1] + 1, t0 + i, Cl.Lt(p.top, 0.1));
            }
            for (int y = t0; y <= t0 + 7; y++) { im.Put(cx - 1, y, p.top2); im.Put(cx, y, Cl.Dk(p.top2, 0.25)); }
            im.Put(cx - 1, t0, Cl.Dk(p.top2, 0.3)); im.Put(cx, t0, Cl.Dk(p.top2, 0.4));
            im.Put(cx - 1, t0 + 9, Cl.Dk(p.top, 0.5)); im.Put(cx - 1, t0 + 11, Cl.Dk(p.top, 0.5));
            for (int y = t0 + 6; y <= te; y++) im.Put(cx, y, Cl.Dk(p.top, 0.3));
            int[] rr = g.Row(t0 + 3);
            im.Put(rr[1] + 2, t0 + 3, Cl.H("e8e6e0"));
        }
        else if (s == "police")
        {
            for (int x = cx - 3; x <= cx + 2; x++) im.Put(x, t0, Cl.Lt(p.top, 0.15));
            im.Put(cx - 1, t0, Cl.Dk(skin, 0.2)); im.Put(cx, t0, Cl.Dk(skin, 0.28));
            for (int y = t0 + 1; y <= t0 + 6; y++) { im.Put(cx - 1, y, Cl.H("1d2330")); im.Put(cx, y, Cl.H("2a3242")); }
            for (int y = t0 + 7; y <= te; y++) im.Put(cx - 1, y, Cl.Dk(p.top, 0.15));
            for (int x = cx - 5; x <= cx - 3; x++) im.Put(x, t0 + 3, Cl.Dk(p.top, 0.2));
            for (int x = cx + 2; x <= cx + 4; x++) im.Put(x, t0 + 3, Cl.Dk(p.top, 0.25));
            im.Put(cx - 4, t0 + 4, Cl.H("e0b341")); im.Put(cx - 3, t0 + 4, Cl.H("b8862a")); im.Put(cx - 4, t0 + 5, Cl.H("b8862a"));
            im.Put(cx + 3, t0 + 4, Cl.H("c8ccd2"));
            int[] r1 = g.Row(t0 + 1);
            for (int x = r1[1]; x <= r1[1] + 2; x++) im.Put(x, t0 + 1, Cl.Dk(p.top, 0.35));
            for (int x = r1[2] - 2; x <= r1[2]; x++) im.Put(x, t0 + 1, Cl.Dk(p.top, 0.4));
            im.Put(r1[2] - 3, t0 + 2, Cl.H("1a1a1e")); im.Put(r1[2] - 3, t0 + 3, Cl.H("1a1a1e")); im.Put(r1[2] - 2, t0 + 3, Cl.H("2a2a30"));
        }
        else if (s == "vest")
        {
            for (int y = t0 + 2; y <= te; y += 3) { int[] r = g.Row(y); if (r == null) continue; for (int x = r[1]; x <= r[2]; x++) im.Put(x, y, Cl.Dk(p.top, 0.22)); }
            for (int y = t0; y <= te; y++) im.Put(cx, y, Cl.Dk(p.top, 0.35));
            for (int x = cx - 3; x <= cx + 2; x++) im.Put(x, t0, Cl.Dk(p.top, 0.12));
            im.Put(cx - 1, t0, Cl.Dk(skin, 0.25));
            int[] r0 = g.Row(t0 + 1);
            im.Put(r0[1], t0 + 1, p.top2); im.Put(r0[2], t0 + 1, Cl.Dk(p.top2, 0.3));
        }
        else if (s == "coverall")
        {
            for (int x = cx - 3; x <= cx + 2; x++) im.Put(x, t0, Cl.Dk(p.top, 0.18));
            im.Put(cx - 1, t0, Cl.Dk(skin, 0.2)); im.Put(cx, t0, Cl.Dk(skin, 0.25));
            for (int y = t0 + 1; y <= te; y++) im.Put(cx, y, Cl.Lt(p.top, 0.25));
            for (int y = t0 + 3; y <= t0 + 5; y++) for (int x = cx + 2; x <= cx + 4; x++) im.Put(x, y, Cl.Dk(p.top, 0.14));
            for (int x = cx - 5; x <= cx - 3; x++) im.Put(x, t0 + 3, Cl.H("e6e2d8"));
            int grease = Cl.Dk(p.top, 0.4);
            im.Put(cx - 4, t0 + 9, grease); im.Put(cx - 3, t0 + 10, grease); im.Put(cx + 3, t0 + 12, grease); im.Put(cx + 2, t0 + 7, Cl.Dk(p.top, 0.3));
        }
        if (s == "labcoat" && p.stetho) { }
    }

    static void Arms(Img im, Geo g, P p)
    {
        string sl = Sleeve(p.topStyle);
        int sleeveC = p.topStyle == "vest" ? p.top2 : p.top;
        int shortEnd = g.ay0 + 4;
        if (p.topStyle == "coverall") shortEnd = g.ay0 + 6;
        for (int side = 0; side < 2; side++)
        {
            int x0 = side == 0 ? g.aLx0 : g.aRx0, x1 = side == 0 ? g.aLx1 : g.aRx1;
            for (int y = g.ay0; y <= g.ay1; y++)
            {
                bool sleeve = sl == "long" || (sl == "short" && y <= shortEnd);
                int c = sleeve ? sleeveC : p.skin;
                int xa = x0, xb = x1;
                if (y == g.ay0) { if (side == 0) xa = x0 + 1; else xb = x1 - 1; }
                for (int x = xa; x <= xb; x++) im.Put(x, y, c);
                if (side == 0) { im.Put(xa, y, Cl.Lt(c, 0.12)); im.Put(x1, y, Cl.Dk(c, 0.24)); }
                else { im.Put(x0, y, Cl.Dk(c, 0.2)); im.Put(xb, y, Cl.Dk(c, 0.34)); }
                if (sleeve && sl == "short" && y == shortEnd) for (int x = xa; x <= xb; x++) im.Put(x, y, Cl.Dk(c, 0.2));
                if (sleeve && sl == "long" && y == g.ay1) for (int x = xa; x <= xb; x++) im.Put(x, y, Cl.Dk(c, 0.18));
                if (sleeve && p.topStyle == "track") im.Put(side == 0 ? x0 : x1, y, side == 0 ? p.top2 : Cl.Dk(p.top2, 0.2));
                if (!sleeve && p.tattoo && y >= g.ay0 + 6 && y <= g.ay1 - 2)
                {
                    int ink = Cl.Mix(p.skin, Cl.H("23314f"), 0.55);
                    int ox = side == 0 ? x0 + 1 : x1 - 1;
                    if ((y + side) % 3 != 0) im.Put(ox, y, ink);
                    if ((y + side) % 4 == 1) im.Put(side == 0 ? ox + 1 : ox - 1, y, ink);
                }
                if (!sleeve && p.build == "bulky" && (y == g.ay0 + 2 || y == g.ay0 + 3)) im.Put(x0 + 1, y, Cl.Lt(p.skin, 0.18));
            }
            int hc = p.gloves ? Cl.H("1e1c20") : p.skin;
            for (int y = g.hdy0; y <= g.hdy1; y++)
            {
                for (int x = x0; x <= x1; x++) im.Put(x, y, hc);
                im.Put(side == 0 ? x1 : x0, y, Cl.Dk(hc, 0.22));
                if (side == 1) im.Put(x1, y, Cl.Dk(hc, 0.3));
            }
            for (int x = x0; x <= x1; x++) if ((x + side) % 2 == 0) im.Put(x, g.hdy1, Cl.Dk(hc, 0.25));
            if (p.knuckles) for (int x = x0; x <= x1; x++) im.Put(x, g.hdy0 + 1, x == x0 ? Cl.H("f2d27a") : Cl.H("d9a63a"));
        }
    }

    static void Head(Img im, Geo g, P p)
    {
        int x0 = g.hx0, x1 = g.hx1, y0 = g.hy0, y1 = g.hy1, cx = g.cx;
        int sk = p.skin;
        for (int y = y0; y <= y1; y++)
        {
            int xa = x0, xb = x1;
            if (y == y0 || y == y1) { xa += 2; xb -= 2; }
            else if (y == y0 + 1 || y == y1 - 1) { xa += 1; xb -= 1; }
            for (int x = xa; x <= xb; x++) im.Put(x, y, sk);
            im.Put(xb, y, Cl.Dk(sk, 0.24)); if (xb - 1 > xa) im.Put(xb - 1, y, Cl.Dk(sk, 0.1));
        }
        for (int y = y0 + 2; y <= y0 + 5; y++) im.Put(x0, y, Cl.Lt(sk, 0.12));
        for (int x = x0 + 2; x <= x1 - 2; x++) im.Put(x, y1, Cl.Dk(sk, 0.2));
        // ears
        int ey = y0 + 5;
        for (int y = ey - 1; y <= ey + 1; y++) { im.Put(x0 - 1, y, Cl.Dk(sk, 0.05)); im.Put(x1 + 1, y, Cl.Dk(sk, 0.3)); }
        // features
        int brow = p.hairStyle == "bald" || p.hairStyle == "buzz" ? Cl.Dk(sk, 0.4) : Cl.Dk(p.hair, 0.1);
        im.Put(cx - 3, ey - 1, brow); im.Put(cx - 2, ey - 1, brow); im.Put(cx + 1, ey - 1, brow); im.Put(cx + 2, ey - 1, brow);
        int eye = Cl.H("221a18"), white = Cl.Lt(sk, 0.55);
        im.Put(cx - 3, ey, white); im.Put(cx - 2, ey, eye); im.Put(cx + 1, ey, eye); im.Put(cx + 2, ey, white);
        if (p.lips) { im.Put(cx - 3, ey - 1, Cl.H("221a18")); im.Put(cx + 2, ey - 1, Cl.H("221a18")); }
        im.Put(cx, ey + 1, Cl.Dk(sk, 0.14)); im.Put(cx, ey + 2, Cl.Dk(sk, 0.26)); im.Put(cx - 1, ey + 2, Cl.Dk(sk, 0.12));
        int my = ey + 4;
        if (my >= y1) my = y1 - 1;
        int mouth = p.lips ? Cl.Mix(sk, Cl.H("8a2a35"), 0.55) : Cl.Mix(sk, Cl.H("4a2020"), 0.45);
        im.Put(cx - 1, my, p.grill ? Cl.H("e0b341") : mouth); im.Put(cx, my, p.grill ? Cl.H("a87a22") : mouth);
        if (p.lips) { im.Put(cx - 2, my, Cl.Mix(sk, Cl.H("8a2a35"), 0.3)); im.Put(cx + 1, my, Cl.Mix(sk, Cl.H("8a2a35"), 0.3)); }
        // beard
        if (p.beard == "full")
        {
            for (int y = ey + 2; y <= y1; y++)
            {
                int xa = x0, xb = x1;
                if (y == y1) { xa += 1; xb -= 1; }
                for (int x = xa; x <= xb; x++) if (!(y == ey + 2 && x >= cx - 1 && x <= cx)) im.Put(x, y, x >= xb - 1 ? Cl.Dk(p.hair, 0.2) : p.hair);
            }
            for (int x = x0 + 2; x <= x1 - 2; x++) im.Put(x, y1 + 1, Cl.Dk(p.hair, 0.15));
            im.Put(cx - 1, my, Cl.Mix(sk, Cl.H("4a2020"), 0.6)); im.Put(cx, my, Cl.Mix(sk, Cl.H("4a2020"), 0.6));
            for (int y = ey - 1; y <= ey + 1; y++) { im.Put(x0, y, p.hair); im.Put(x1, y, Cl.Dk(p.hair, 0.2)); }
        }
        else if (p.beard == "goatee")
        {
            for (int x = cx - 2; x <= cx + 1; x++) im.Put(x, my - 1, p.hair);
            for (int y = my + 1; y <= y1; y++) { im.Put(cx - 1, y, p.hair); im.Put(cx, y, Cl.Dk(p.hair, 0.2)); }
        }
        else if (p.beard == "stubble")
        {
            int st = Cl.Mix(sk, p.hair, 0.35);
            for (int y = my - 1; y <= y1; y++)
            {
                int xa = x0 + 1, xb = x1 - 1; if (y == y1) { xa = x0 + 2; xb = x1 - 2; }
                for (int x = xa; x <= xb; x++) if (!(y == my && (x == cx - 1 || x == cx))) im.Put(x, y, (x + y) % 2 == 0 ? st : Cl.Dk(st, 0.1));
            }
        }
        if (p.scar)
        {
            int sc = Cl.Mix(sk, Cl.H("e6c2b0"), 0.6);
            im.Put(cx - 4, ey - 2, sc); im.Put(cx - 3, ey - 1, sc); im.Put(cx - 3, ey + 1, sc); im.Put(cx - 2, ey + 2, sc);
        }
        if (p.shades)
        {
            int gl = Cl.H("101216");
            for (int x = x0 + 1; x <= x1 - 1; x++) im.Put(x, ey, gl);
            im.Put(cx - 3, ey + 1, gl); im.Put(cx - 2, ey + 1, gl); im.Put(cx + 1, ey + 1, gl); im.Put(cx + 2, ey + 1, gl);
            im.Put(cx - 3, ey, Cl.H("6a7f96")); im.Put(cx + 1, ey, Cl.H("4a5a6e"));
        }
        if (p.earring) im.Put(x0 - 1, ey + 2, Cl.H("e0b341"));
        // hair
        int hc = p.hair;
        string hs = p.hairStyle;
        if (hs == "short" || hs == "long" || hs == "bun" || hs == "slick")
        {
            for (int y = y0; y <= y0 + 2; y++)
            {
                int xa = x0, xb = x1;
                if (y == y0) { xa += 2; xb -= 2; } else if (y == y0 + 1) { xa += 1; xb -= 1; }
                for (int x = xa; x <= xb; x++) im.Put(x, y, x >= xb - 1 ? Cl.Dk(hc, 0.2) : hc);
            }
            im.Put(x0, y0 + 3, hc); im.Put(x0 + 1, y0 + 3, hc); im.Put(x1, y0 + 3, Cl.Dk(hc, 0.2)); im.Put(x1 - 1, y0 + 3, Cl.Dk(hc, 0.1));
            im.Put(x0, y0 + 4, hc); im.Put(x1, y0 + 4, Cl.Dk(hc, 0.2));
            im.Put(x0 + 2, y0, Cl.Lt(hc, 0.3)); im.Put(x0 + 3, y0 + 1, Cl.Lt(hc, 0.22)); im.Put(x0 + 2, y0 + 1, Cl.Lt(hc, 0.15));
            if (hs == "slick")
            {
                for (int x = x0 + 2; x <= x1 - 2; x++) im.Put(x, y0 - 1, x >= x1 - 3 ? Cl.Dk(hc, 0.2) : hc);
                for (int x = x0 + 2; x <= x1 - 3; x += 2) im.Put(x, y0, Cl.Lt(hc, 0.3));
            }
            if (hs == "bun") { im.Ellipse(cx, y0 - 1.5, 2.6, 2.0, hc); im.Put(cx - 1, y0 - 2, Cl.Lt(hc, 0.3)); }
            if (hs == "long") { for (int y = y0 + 3; y <= y0 + 7; y++) { im.Put(x0, y, hc); im.Put(x1, y, Cl.Dk(hc, 0.2)); } }
        }
        else if (hs == "buzz")
        {
            int bz = Cl.Mix(hc, sk, 0.35);
            for (int x = x0 + 2; x <= x1 - 2; x++) im.Put(x, y0, bz);
            for (int x = x0 + 1; x <= x1 - 1; x++) im.Put(x, y0 + 1, x % 2 == 0 ? bz : Cl.Dk(bz, 0.1));
            im.Put(x0, y0 + 2, bz); im.Put(x1, y0 + 2, Cl.Dk(bz, 0.2));
        }
        else if (hs == "bald")
        {
            im.Put(x0 + 2, y0 + 1, Cl.Lt(sk, 0.35)); im.Put(x0 + 3, y0 + 1, Cl.Lt(sk, 0.25)); im.Put(x0 + 2, y0 + 2, Cl.Lt(sk, 0.2));
        }
        if (p.cigar)
        {
            im.Put(cx + 1, my, Cl.H("4a2e1a")); im.Put(cx + 2, my, Cl.H("6b4a2a")); im.Put(cx + 3, my, Cl.H("7a5532")); im.Put(cx + 4, my, Cl.H("ff7a3a"));
            im.Put(cx + 5, my - 2, Cl.A(Cl.H("bdb8ae"), 150)); im.Put(cx + 4, my - 3, Cl.A(Cl.H("bdb8ae"), 110)); im.Put(cx + 5, my - 4, Cl.A(Cl.H("bdb8ae"), 80));
        }
        if (p.mask)
        {
            int mk = Cl.H("e6e3dc");
            for (int y = y0 - 1; y <= y1 + 2; y++)
            {
                int xa = x0 - 1, xb = x1 + 1;
                if (y == y0 - 1) { xa = x0 + 1; xb = x1 - 1; }
                else if (y == y0) { xa = x0; xb = x1; }
                else if (y > y1) { xa = g.nx0 - 1; xb = g.nx1 + 1; }
                for (int x = xa; x <= xb; x++)
                {
                    int c = (x % 2 == 0) ? mk : Cl.Dk(mk, 0.1);
                    if (x >= xb - 1) c = Cl.Dk(c, 0.24);
                    else if (x == xa) c = Cl.Lt(c, 0.12);
                    if (y > y1) c = Cl.Dk(c, 0.12);
                    im.Put(x, y, c);
                }
            }
            for (int x = cx - 4; x <= cx - 2; x++) { im.Put(x, ey - 1, Cl.Dk(sk, 0.4)); im.Put(x, ey, Cl.Dk(sk, 0.1)); }
            for (int x = cx + 1; x <= cx + 3; x++) { im.Put(x, ey - 1, Cl.Dk(sk, 0.45)); im.Put(x, ey, Cl.Dk(sk, 0.2)); }
            im.Put(cx - 3, ey, white); im.Put(cx - 2, ey, eye); im.Put(cx + 1, ey, eye); im.Put(cx + 2, ey, white);
            int lip = Cl.Mix(sk, Cl.H("4a2020"), 0.5);
            im.Put(cx - 2, my, lip); im.Put(cx + 1, my, lip);
            im.Put(cx - 1, my, p.grill ? Cl.H("f0c860") : Cl.H("e8e4da")); im.Put(cx, my, p.grill ? Cl.H("b8862a") : Cl.H("c8c4ba"));
            im.Put(cx - 1, my + 1, lip); im.Put(cx, my + 1, Cl.Dk(lip, 0.2));
        }
        // hats
        string ht = p.hatStyle;
        if (ht == "fedora")
        {
            int c = p.hat;
            for (int y = y0 - 3; y <= y0 + 1; y++)
            {
                int xa = x0, xb = x1;
                if (y == y0 - 3) { xa = x0 + 2; xb = x1 - 2; }
                else if (y == y0 - 2) { xa = x0 + 1; xb = x1 - 1; }
                for (int x = xa; x <= xb; x++) im.Put(x, y, x >= xb - 1 ? Cl.Dk(c, 0.25) : (x <= xa + 1 ? Cl.Lt(c, 0.12) : c));
            }
            im.Put(cx - 1, y0 - 3, Cl.Dk(c, 0.4)); im.Put(cx, y0 - 3, Cl.Dk(c, 0.4)); im.Put(cx - 1, y0 - 2, Cl.Dk(c, 0.22));
            for (int x = x0; x <= x1; x++) im.Put(x, y0 + 1, Cl.H("141216"));
            for (int x = x0 - 3; x <= x1 + 3; x++) im.Put(x, y0 + 2, x >= x1 + 1 ? Cl.Dk(c, 0.3) : Cl.Dk(c, 0.08));
            for (int x = x0 - 3; x <= x1 + 3; x++) if (x < x0 - 1 || x > x1 + 1) im.Put(x, y0 + 3, Cl.Dk(c, 0.35));
            for (int y = y0 + 3; y <= y0 + 4; y++) for (int x = x0; x <= x1; x++) { int cc = im.Get(x, y); if (Cl.Al(cc) > 0) im.Put(x, y, Cl.Dk(cc, y == y0 + 3 ? 0.38 : 0.2)); }
        }
        else if (ht == "cap")
        {
            int c = p.hat;
            for (int y = y0 - 1; y <= y0 + 2; y++)
            {
                int xa = x0, xb = x1;
                if (y == y0 - 1) { xa += 2; xb -= 2; } else if (y == y0) { xa += 1; xb -= 1; }
                for (int x = xa; x <= xb; x++) im.Put(x, y, x >= xb - 1 ? Cl.Dk(c, 0.22) : c);
            }
            im.Put(x0 + 2, y0, Cl.Lt(c, 0.25));
            im.Put(cx - 1, y0 + 1, Cl.Lt(c, 0.6)); im.Put(cx, y0 + 1, Cl.Lt(c, 0.5));
            for (int x = x0 - 1; x <= x1 + 1; x++) im.Put(x, y0 + 3, Cl.Dk(c, 0.3));
            for (int x = x0; x <= x1; x++) if (Cl.Al(im.Get(x, y0 + 4)) > 0 && x != x0 - 1) im.Put(x, y0 + 4, Cl.Dk(im.Get(x, y0 + 4), 0.18));
        }
        else if (ht == "beanie")
        {
            int c = p.hat;
            for (int y = y0 - 2; y <= y0 + 3; y++)
            {
                int xa = x0, xb = x1;
                if (y == y0 - 2) { xa += 2; xb -= 2; } else if (y == y0 - 1) { xa += 1; xb -= 1; }
                bool fold = y >= y0 + 2;
                for (int x = xa; x <= xb; x++)
                {
                    int cc = fold ? ((x % 2 == 0) ? Cl.Lt(c, 0.08) : Cl.Dk(c, 0.08)) : c;
                    if (x >= xb - 1) cc = Cl.Dk(cc, 0.2);
                    im.Put(x, y, cc);
                }
            }
            im.Put(x0 + 2, y0 - 1, Cl.Lt(c, 0.25));
        }
        else if (ht == "police")
        {
            int c = p.hat;
            for (int y = y0 - 2; y <= y0 + 2; y++)
                for (int x = x0 - 1; x <= x1 + 1; x++) im.Put(x, y, x >= x1 ? Cl.Dk(c, 0.25) : c);
            for (int x = x0 - 1; x <= x1 + 1; x++) im.Put(x, y0 + 2, Cl.H("101014"));
            im.Put(cx - 1, y0 - 1, Cl.H("e0b341")); im.Put(cx, y0 - 1, Cl.H("b8862a")); im.Put(cx - 1, y0, Cl.H("b8862a"));
            for (int x = x0; x <= x1; x++) im.Put(x, y0 + 3, Cl.H("16161a"));
            im.Put(x0 + 1, y0 + 3, Cl.H("4a4a56"));
        }
        else if (ht == "hood")
        {
            int c = p.top;
            for (int y = y0 - 1; y <= y0 + 1; y++)
            {
                int xa = x0 - 1, xb = x1 + 1;
                if (y == y0 - 1) { xa += 2; xb -= 2; }
                for (int x = xa; x <= xb; x++) im.Put(x, y, x >= xb - 1 ? Cl.Dk(c, 0.25) : c);
            }
            for (int x = x0; x <= x1; x++) im.Put(x, y0 + 2, Cl.Dk(c, 0.35));
            for (int y = y0 + 2; y <= y1 + 1; y++) { im.Put(x0 - 1, y, Cl.Dk(c, 0.1)); im.Put(x1 + 1, y, Cl.Dk(c, 0.35)); }
            for (int x = x0; x <= x1; x++) { int cc = im.Get(x, y0 + 3); if (Cl.Al(cc) > 0) im.Put(x, y0 + 3, Cl.Dk(cc, 0.3)); }
            for (int y = y0 + 4; y <= y1; y++) { int cc = im.Get(x0, y); if (Cl.Al(cc) > 0) im.Put(x0, y, Cl.Dk(cc, 0.25)); cc = im.Get(x1, y); if (Cl.Al(cc) > 0) im.Put(x1, y, Cl.Dk(cc, 0.3)); }
        }
    }

    // ------------------------------------------------------------ top-down sprite (16x16), facing down
    public static Img Top(P p)
    {
        var im = new Img(16, 16);
        bool bulky = p.build == "bulky";
        int cx = 8;
        string sl = Sleeve(p.topStyle);
        int armC = sl == "long" ? (p.topStyle == "vest" ? p.top2 : p.top) : p.skin;
        // feet & legs (walking)
        int sh = Cl.Dk(p.shoe, 0.1);
        im.Put(5, 12, sh); im.Put(6, 12, sh); im.Put(5, 13, Cl.Dk(sh, 0.2)); im.Put(6, 13, Cl.Dk(sh, 0.2));
        im.Put(5, 11, p.pants); im.Put(6, 11, Cl.Dk(p.pants, 0.2));
        im.Put(9, 10, sh); im.Put(10, 10, sh); im.Put(9, 11, Cl.Dk(sh, 0.25)); im.Put(10, 11, Cl.Dk(sh, 0.25));
        im.Put(9, 9, p.pants); im.Put(10, 9, Cl.Dk(p.pants, 0.2));
        // arms
        int ax0 = bulky ? 1 : 2, ax1 = bulky ? 14 : 13;
        for (int y = 6; y <= 8; y++) { im.Put(ax0, y, Cl.Lt(armC, 0.1)); im.Put(ax0 + 1, y, armC); im.Put(ax1 - 1, y, Cl.Dk(armC, 0.15)); im.Put(ax1, y, Cl.Dk(armC, 0.3)); }
        int hd = p.gloves ? Cl.H("1e1c20") : p.skin;
        im.Put(ax0, 9, hd); im.Put(ax0 + 1, 9, hd); im.Put(ax1 - 1, 9, Cl.Dk(hd, 0.2)); im.Put(ax1, 9, Cl.Dk(hd, 0.25));
        // torso / shoulders
        double rx = bulky ? 6.0 : 5.0;
        int tc = p.topStyle == "tank" ? p.top : p.top;
        im.Ellipse(cx, 7.5, rx, 3.3, tc);
        for (int y = 4; y <= 11; y++)
            for (int x = 1; x <= 14; x++)
            {
                int c = im.Get(x, y);
                if (c != tc) continue;
                if (x >= cx + 2 || y >= 9) im.Put(x, y, Cl.Dk(tc, 0.2));
                else if (x <= cx - 2 && y <= 6) im.Put(x, y, Cl.Lt(tc, 0.12));
            }
        if (p.topStyle == "tank") { im.Put(cx - 3, 6, p.skin); im.Put(cx + 2, 6, Cl.Dk(p.skin, 0.2)); im.Put(cx - 4, 7, p.skin); im.Put(cx + 3, 7, Cl.Dk(p.skin, 0.2)); }
        if (p.topStyle == "leather" || p.topStyle == "coat" || p.topStyle == "labcoat" || p.topStyle == "suit")
        { im.Put(cx - 1, 9, p.top2); im.Put(cx, 9, Cl.Dk(p.top2, 0.15)); im.Put(cx - 1, 10, p.top2); }
        if (p.topStyle == "police") { im.Put(cx - 3, 6, Cl.H("e0b341")); }
        if (p.chain) { im.Put(cx - 1, 9, Cl.H("e0b341")); im.Put(cx, 9, Cl.H("b8862a")); }
        // head
        int headC = p.hatStyle == "cap" || p.hatStyle == "beanie" || p.hatStyle == "police" || p.hatStyle == "fedora" ? p.hat
                  : p.hatStyle == "hood" ? p.top
                  : p.mask ? Cl.H("e6e3dc")
                  : (p.hairStyle == "bald" ? p.skin : (p.hairStyle == "buzz" ? Cl.Mix(p.hair, p.skin, 0.4) : p.hair));
        if (p.hatStyle == "fedora") im.Ellipse(cx, 6.2, 4.2, 3.8, Cl.Dk(p.hat, 0.15));
        im.Ellipse(cx, 6.2, 2.7, 2.7, headC);
        if (p.hatStyle == "fedora") { im.Put(cx - 1, 5, Cl.Dk(p.hat, 0.35)); im.Put(cx, 5, Cl.Dk(p.hat, 0.35)); for (int x = 5; x <= 11; x++) if (im.Get(x, 8) == headC) im.Put(x, 8, Cl.H("141216")); }
        im.Put(cx - 2, 4, Cl.Lt(headC, 0.32)); im.Put(cx - 1, 4, Cl.Lt(headC, 0.18)); im.Put(cx - 2, 5, Cl.Lt(headC, 0.15));
        im.Put(cx + 2, 7, Cl.Dk(headC, 0.25)); im.Put(cx + 1, 8, Cl.Dk(headC, 0.2));
        if (p.hatStyle == "cap" || p.hatStyle == "police") { im.Put(cx - 1, 9, Cl.Dk(p.hat, 0.3)); im.Put(cx, 9, Cl.Dk(p.hat, 0.35)); im.Put(cx + 1, 9, Cl.Dk(p.hat, 0.4)); }
        else if (p.hatStyle != "hood") { im.Put(cx - 1, 8, p.skin); im.Put(cx, 8, Cl.Dk(p.skin, 0.15)); }
        else { im.Put(cx - 1, 8, Cl.Dk(p.skin, 0.4)); im.Put(cx, 8, Cl.Dk(p.skin, 0.45)); }
        if (p.hairStyle == "bun" && p.hatStyle == "") { im.Put(cx, 3, Cl.Dk(p.hair, 0.1)); im.Put(cx - 1, 3, p.hair); }
        if (p.hairStyle == "long" && p.hatStyle == "") { im.Put(cx - 3, 7, p.hair); im.Put(cx + 3, 7, Cl.Dk(p.hair, 0.2)); im.Put(cx - 2, 8, p.hair); im.Put(cx + 2, 8, Cl.Dk(p.hair, 0.2)); }
        im.AutoOutline(0.6);
        return im;
    }

    public static Img Silhouette(Img src, int night, int rim)
    {
        var o = new Img(src.W, src.Hh);
        for (int y = 0; y < src.Hh; y++)
            for (int x = 0; x < src.W; x++)
            {
                int c = src.Get(x, y);
                if (Cl.Al(c) < 128) continue;
                int d = Cl.Mix(c, night, 0.62);
                bool edgeR = Cl.Al(src.Get(x + 1, y)) < 128 || Cl.Al(src.Get(x + 2, y)) < 128;
                bool edgeT = Cl.Al(src.Get(x, y - 1)) < 128;
                if (edgeR) d = Cl.Mix(d, rim, 0.55);
                else if (edgeT) d = Cl.Mix(d, rim, 0.3);
                o.Put(x, y, Cl.A(d, 255));
            }
        return o;
    }
}

// ---------------------------------------------------------------- vehicles (pointing up, 18x32)
public static class Car
{
    public static Img Make(int body, string kind)
    {
        var im = new Img(18, 32);
        int x0 = 1, x1 = 16, y0 = 1, y1 = 30;
        int glass = Cl.H("26313e");
        bool police = kind == "police";
        int bc = police ? Cl.H("e6e6e2") : body;
        for (int y = y0; y <= y1; y++)
        {
            int xa = x0, xb = x1;
            if (y == y0 || y == y1) { xa += 2; xb -= 2; } else if (y == y0 + 1 || y == y1 - 1) { xa += 1; xb -= 1; }
            for (int x = xa; x <= xb; x++) im.Put(x, y, bc);
            im.Put(xa, y, Cl.Lt(bc, 0.15)); im.Put(xb, y, Cl.Dk(bc, 0.3)); im.Put(xb - 1, y, Cl.Dk(bc, 0.12));
        }
        if (kind == "van")
        {
            for (int y = y0 + 4; y <= y0 + 6; y++) for (int x = x0 + 2; x <= x1 - 2; x++) im.Put(x, y, y == y0 + 4 ? Cl.Lt(glass, 0.15) : glass);
            for (int y = y0 + 7; y <= y1 - 1; y++) for (int x = x0 + 1; x <= x1 - 1; x++) im.Put(x, y, Cl.Lt(bc, 0.06));
            for (int y = y0 + 9; y <= y1 - 2; y++) { im.Put(x0 + 3, y, Cl.Dk(bc, 0.18)); im.Put(x1 - 3, y, Cl.Dk(bc, 0.22)); }
            for (int y = y0 + 9; y <= y1 - 2; y += 4) for (int x = x0 + 4; x <= x1 - 4; x++) im.Put(x, y, Cl.Dk(bc, 0.1));
            if (body == Cl.H("e8e8e2"))
            {
                for (int y = y0 + 12; y <= y0 + 17; y++) for (int x = x0 + 5; x <= x1 - 5; x++) im.Put(x, y, Cl.H("c8332b"));
                for (int y = y0 + 14; y <= y0 + 15; y++) for (int x = x0 + 3; x <= x1 - 3; x++) im.Put(x, y, Cl.H("c8332b"));
                im.Put(x0 + 4, y0 + 8, Cl.H("e0352b")); im.Put(x1 - 4, y0 + 8, Cl.H("2f6fe0"));
            }
        }
        else if (kind == "pickup")
        {
            for (int y = y0 + 8; y <= y0 + 10; y++) for (int x = x0 + 2; x <= x1 - 2; x++) im.Put(x, y, y == y0 + 8 ? Cl.Lt(glass, 0.15) : glass);
            for (int y = y0 + 11; y <= y0 + 15; y++) for (int x = x0 + 1; x <= x1 - 1; x++) im.Put(x, y, Cl.Lt(bc, 0.08));
            for (int x = x0 + 2; x <= x1 - 2; x++) im.Put(x, y0 + 16, glass);
            for (int y = y0 + 18; y <= y1 - 2; y++) for (int x = x0 + 2; x <= x1 - 2; x++) im.Put(x, y, Cl.Dk(bc, 0.35));
            im.Fill(x0 + 4, y0 + 20, 5, 4, Cl.H("6b5a42"));
        }
        else
        {
            for (int y = y0 + 3; y <= y0 + 7; y++) { im.Put(8, y, Cl.Lt(bc, 0.12)); im.Put(9, y, Cl.Lt(bc, 0.06)); }
            for (int y = y0 + 9; y <= y0 + 12; y++)
            {
                int xa = y == y0 + 9 ? x0 + 3 : x0 + 2, xb = y == y0 + 9 ? x1 - 3 : x1 - 2;
                for (int x = xa; x <= xb; x++) im.Put(x, y, glass);
            }
            im.Put(x0 + 4, y0 + 10, Cl.Lt(glass, 0.35)); im.Put(x0 + 5, y0 + 10, Cl.Lt(glass, 0.25)); im.Put(x0 + 3, y0 + 11, Cl.Lt(glass, 0.2));
            for (int y = y0 + 13; y <= y0 + 20; y++) for (int x = x0 + 2; x <= x1 - 2; x++) im.Put(x, y, x >= x1 - 3 ? Cl.Dk(bc, 0.1) : Cl.Lt(bc, 0.1));
            for (int y = y0 + 21; y <= y0 + 23; y++) for (int x = x0 + 2; x <= x1 - 2; x++) im.Put(x, y, glass);
            im.Put(x0 + 3, y0 + 21, Cl.Lt(glass, 0.25));
            if (police)
            {
                int blk = Cl.H("1b1d22");
                for (int y = y0; y <= y0 + 8; y++) for (int x = x0; x <= x1; x++) if (Cl.Al(im.Get(x, y)) > 0) im.Put(x, y, x >= x1 - 1 ? Cl.Dk(blk, 0.2) : blk);
                for (int y = y0 + 24; y <= y1; y++) for (int x = x0; x <= x1; x++) if (Cl.Al(im.Get(x, y)) > 0) im.Put(x, y, x >= x1 - 1 ? Cl.Dk(blk, 0.2) : blk);
                for (int x = x0 + 2; x <= x1 - 2; x++) { im.Put(x, y0 + 15, x < 9 ? Cl.H("e0352b") : Cl.H("2f6fe0")); im.Put(x, y0 + 16, x < 9 ? Cl.H("9c1f18") : Cl.H("1d4aa8")); }
                im.Put(8, y0 + 15, Cl.H("f4f4f0")); im.Put(9, y0 + 15, Cl.H("f4f4f0"));
            }
            if (kind == "taxi")
            {
                im.Fill(x0 + 5, y0 + 16, 6, 2, Cl.H("f4e9b0"));
            }
        }
        int hl = Cl.H("f6eeb8"), tl = Cl.H("c8302a");
        im.Put(x0 + 2, y0 + 1, hl); im.Put(x0 + 3, y0, hl); im.Put(x1 - 2, y0 + 1, hl); im.Put(x1 - 3, y0, hl);
        im.Put(x0 + 2, y1 - 1, tl); im.Put(x0 + 3, y1, tl); im.Put(x1 - 2, y1 - 1, tl); im.Put(x1 - 3, y1, tl);
        im.Put(0, y0 + 9, Cl.Dk(bc, 0.3)); im.Put(17, y0 + 9, Cl.Dk(bc, 0.35));
        im.AutoOutline(0.55);
        return im;
    }
}

// ---------------------------------------------------------------- icons from text grids
public static class Icons
{
    static Dictionary<char, int> pal;
    static void Init()
    {
        if (pal != null) return;
        pal = new Dictionary<char, int>();
        pal['k'] = Cl.H("141218"); pal['g'] = Cl.H("4f9a45"); pal['G'] = Cl.H("86d06f"); pal['d'] = Cl.H("2f6a2f");
        pal['y'] = Cl.H("d9a032"); pal['Y'] = Cl.H("ffe08a"); pal['o'] = Cl.H("8f5f1a");
        pal['r'] = Cl.H("b8321f"); pal['R'] = Cl.H("ff6a4d"); pal['b'] = Cl.H("2f74c0"); pal['B'] = Cl.H("8cc8ff");
        pal['w'] = Cl.H("f2efe6"); pal['s'] = Cl.H("8a8b90"); pal['S'] = Cl.H("c4c4c8"); pal['n'] = Cl.H("4a4b52");
        pal['p'] = Cl.H("7a4fd6"); pal['P'] = Cl.H("b394ff"); pal['f'] = Cl.H("d9a066"); pal['F'] = Cl.H("f0c38e"); pal['e'] = Cl.H("a8703f");
        pal['c'] = Cl.H("6e4426"); pal['C'] = Cl.H("a0663a");
    }
    public static Img FromGrid(string[] rows)
    {
        Init();
        var im = new Img(rows[0].Length, rows.Length);
        for (int y = 0; y < rows.Length; y++)
            for (int x = 0; x < rows[y].Length; x++)
            {
                char ch = rows[y][x];
                int c;
                if (pal.TryGetValue(ch, out c)) im.Put(x, y, c);
            }
        return im;
    }
}
