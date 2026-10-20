using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Text.RegularExpressions;

// Tiny vector renderer: SVG path syntax + a line-based layer DSL, rendered with GDI+.
public static class Vec
{
    static readonly CultureInfo IC = CultureInfo.InvariantCulture;

    public static GraphicsPath ParsePath(string d)
    {
        var gp = new GraphicsPath(FillMode.Winding);
        var toks = new List<string>();
        foreach (Match m in Regex.Matches(d, @"[MmLlHhVvCcSsQqTtZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE]-?\d+)?")) toks.Add(m.Value);
        int i = 0; char cmd = 'M';
        PointF cur = new PointF(0, 0), start = cur, lastCtrl = cur; char lastCmd = ' ';
        Func<float> N = () => float.Parse(toks[i++], IC);
        bool open = false;
        while (i < toks.Count)
        {
            if (Regex.IsMatch(toks[i], "^[A-Za-z]$")) { cmd = toks[i][0]; i++; if (cmd == 'Z' || cmd == 'z') { if (open) gp.CloseFigure(); open = false; cur = start; lastCmd = 'Z'; continue; } }
            bool rel = char.IsLower(cmd);
            char C = char.ToUpper(cmd);
            float ox = rel ? cur.X : 0, oy = rel ? cur.Y : 0;
            switch (C)
            {
                case 'M':
                    {
                        var p = new PointF(N() + ox, N() + oy);
                        if (open) gp.StartFigure();
                        gp.StartFigure(); cur = start = p; open = true;
                        cmd = rel ? 'l' : 'L'; lastCmd = 'M';
                        break;
                    }
                case 'L':
                    { var p = new PointF(N() + ox, N() + oy); gp.AddLine(cur, p); cur = p; lastCmd = 'L'; break; }
                case 'H':
                    { var p = new PointF(N() + ox, cur.Y); gp.AddLine(cur, p); cur = p; lastCmd = 'L'; break; }
                case 'V':
                    { var p = new PointF(cur.X, N() + oy); gp.AddLine(cur, p); cur = p; lastCmd = 'L'; break; }
                case 'C':
                    {
                        var c1 = new PointF(N() + ox, N() + oy); var c2 = new PointF(N() + ox, N() + oy); var p = new PointF(N() + ox, N() + oy);
                        gp.AddBezier(cur, c1, c2, p); lastCtrl = c2; cur = p; lastCmd = 'C'; break;
                    }
                case 'S':
                    {
                        var c1 = (lastCmd == 'C') ? new PointF(2 * cur.X - lastCtrl.X, 2 * cur.Y - lastCtrl.Y) : cur;
                        var c2 = new PointF(N() + ox, N() + oy); var p = new PointF(N() + ox, N() + oy);
                        gp.AddBezier(cur, c1, c2, p); lastCtrl = c2; cur = p; lastCmd = 'C'; break;
                    }
                case 'Q':
                    {
                        var q = new PointF(N() + ox, N() + oy); var p = new PointF(N() + ox, N() + oy);
                        var c1 = new PointF(cur.X + 2f / 3f * (q.X - cur.X), cur.Y + 2f / 3f * (q.Y - cur.Y));
                        var c2 = new PointF(p.X + 2f / 3f * (q.X - p.X), p.Y + 2f / 3f * (q.Y - p.Y));
                        gp.AddBezier(cur, c1, c2, p); lastCtrl = q; cur = p; lastCmd = 'Q'; break;
                    }
                case 'T':
                    {
                        var q = (lastCmd == 'Q') ? new PointF(2 * cur.X - lastCtrl.X, 2 * cur.Y - lastCtrl.Y) : cur;
                        var p = new PointF(N() + ox, N() + oy);
                        var c1 = new PointF(cur.X + 2f / 3f * (q.X - cur.X), cur.Y + 2f / 3f * (q.Y - cur.Y));
                        var c2 = new PointF(p.X + 2f / 3f * (q.X - p.X), p.Y + 2f / 3f * (q.Y - p.Y));
                        gp.AddBezier(cur, c1, c2, p); lastCtrl = q; cur = p; lastCmd = 'Q'; break;
                    }
                default: i++; break;
            }
        }
        return gp;
    }

    static Color Col(string hex, double alpha)
    {
        hex = hex.TrimStart('#');
        int v = Convert.ToInt32(hex, 16);
        return Color.FromArgb((int)Math.Round(255 * alpha), (v >> 16) & 255, (v >> 8) & 255, v & 255);
    }

    static Dictionary<string, string> vars;

    static string Sub(string s)
    {
        if (vars == null) return s;
        foreach (var kv in vars) s = s.Replace("$" + kv.Key, kv.Value);
        return s;
    }

    // Commands (one per line, '#' comment lines allowed, '|' splits args from path):
    //  size W H SCALE                      canvas in design units, render scale
    //  set NAME VALUE                      text substitution $NAME
    //  fill HEX [ALPHA] | PATH
    //  grad HEX1 HEX2 ANGLE [A1 A2] | PATH
    //  stroke HEX WIDTH [ALPHA] | PATH
    //  clip | PATH            unclip
    //  glow HEX ALPHA CX CY RX RY          radial falloff
    //  ellipse HEX ALPHA CX CY RX RY
    //  ribs HEX ALPHA WIDTH X0 X1 STEP Y0 Y1 CX BEND
    //  chain HEX1 HEX2 X0 Y0 C1X C1Y C2X C2Y X1 Y1 N RX RY
    //  teeth X Y W H N
    //  push rotate CX CY DEG | push scale SX SY CX CY | pop
    //  noise ALPHA SEED                    grain over everything drawn so far (alpha-masked)
    public static string Render(string dslPath, string outPng)
    {
        string[] lines = File.ReadAllLines(dslPath);
        vars = new Dictionary<string, string>();
        int W = 300, H = 300; float S = 2;
        Bitmap bmp = null; Graphics g = null;
        var stack = new Stack<Matrix>();
        foreach (var raw0 in lines)
        {
            string raw = raw0.Trim();
            if (raw.Length == 0 || raw.StartsWith("#")) continue;
            raw = Sub(raw);
            string head = raw, path = null;
            int bar = raw.IndexOf('|');
            if (bar >= 0) { head = raw.Substring(0, bar).Trim(); path = raw.Substring(bar + 1).Trim(); }
            string[] a = Regex.Split(head, @"\s+");
            string op = a[0];
            Func<int, float> F = k => float.Parse(a[k], IC);
            if (op == "size")
            {
                W = int.Parse(a[1]); H = int.Parse(a[2]); S = F(3);
                bmp = new Bitmap((int)(W * S), (int)(H * S), PixelFormat.Format32bppArgb);
                g = Graphics.FromImage(bmp);
                g.SmoothingMode = SmoothingMode.AntiAlias; g.PixelOffsetMode = PixelOffsetMode.HighQuality; g.CompositingQuality = CompositingQuality.HighQuality;
                g.ScaleTransform(S, S);
                continue;
            }
            if (op == "set") { var sm = Regex.Match(raw, @"^set\s+(\S+)\s+(.*)$"); vars[sm.Groups[1].Value] = sm.Groups[2].Value.Trim(); continue; }
            if (op == "fill")
            {
                using (var gp = ParsePath(path)) using (var br = new SolidBrush(Col(a[1], a.Length > 2 ? F(2) : 1))) g.FillPath(br, gp);
            }
            else if (op == "grad")
            {
                using (var gp = ParsePath(path))
                {
                    var r = gp.GetBounds(); if (r.Width < 0.5f) r.Width = 1; if (r.Height < 0.5f) r.Height = 1;
                    r.Inflate(1, 1);
                    double a1 = a.Length > 4 ? F(4) : 1, a2 = a.Length > 5 ? F(5) : 1;
                    using (var br = new LinearGradientBrush(r, Col(a[1], a1), Col(a[2], a2), F(3))) g.FillPath(br, gp);
                }
            }
            else if (op == "stroke")
            {
                using (var gp = ParsePath(path)) using (var pen = new Pen(Col(a[1], a.Length > 3 ? F(3) : 1), F(2)))
                { pen.StartCap = LineCap.Round; pen.EndCap = LineCap.Round; pen.LineJoin = LineJoin.Round; g.DrawPath(pen, gp); }
            }
            else if (op == "clip") { var gp = ParsePath(path); g.SetClip(gp, CombineMode.Replace); }
            else if (op == "unclip") g.ResetClip();
            else if (op == "glow" || op == "ellipse")
            {
                float cx = F(3), cy = F(4), rx = F(5), ry = F(6);
                using (var gp = new GraphicsPath())
                {
                    gp.AddEllipse(cx - rx, cy - ry, rx * 2, ry * 2);
                    if (op == "ellipse") using (var br = new SolidBrush(Col(a[1], F(2)))) g.FillPath(br, gp);
                    else using (var br = new PathGradientBrush(gp))
                        {
                            br.CenterColor = Col(a[1], F(2));
                            br.SurroundColors = new[] { Col(a[1], 0) };
                            br.CenterPoint = new PointF(cx, cy);
                            g.FillPath(br, gp);
                        }
                }
            }
            else if (op == "ribs")
            {
                var c = Col(a[1], F(2)); float w = F(3), x0 = F(4), x1 = F(5), step = F(6), y0 = F(7), y1 = F(8), cx = F(9), bend = F(10);
                using (var pen = new Pen(c, w))
                    for (float x = x0; x <= x1; x += step)
                    {
                        float off = (x - cx) * bend;
                        g.DrawBezier(pen, x, y0, x + off, y0 + (y1 - y0) * 0.33f, x + off, y0 + (y1 - y0) * 0.66f, x, y1);
                    }
            }
            else if (op == "chain")
            {
                var c1 = Col(a[1], 1); var c2 = Col(a[2], 1);
                PointF p0 = new PointF(F(3), F(4)), q1 = new PointF(F(5), F(6)), q2 = new PointF(F(7), F(8)), p1 = new PointF(F(9), F(10));
                int n = int.Parse(a[11]); float rx = F(12), ry = F(13);
                for (int k = 0; k < n; k++)
                {
                    float t = n == 1 ? 0 : (float)k / (n - 1);
                    PointF p = Bez(p0, q1, q2, p1, t);
                    PointF p2 = Bez(p0, q1, q2, p1, Math.Min(1, t + 0.01f));
                    float ang = (float)(Math.Atan2(p2.Y - p.Y, p2.X - p.X) * 180 / Math.PI);
                    var st = g.Save();
                    g.TranslateTransform(p.X, p.Y); g.RotateTransform(ang);
                    float erx = rx, ery = (k % 2 == 0) ? ry : ry * 0.55f;
                    using (var br = new SolidBrush(Color.FromArgb(255, 20, 16, 10))) g.FillEllipse(br, -erx - 0.8f, -ery - 0.8f, erx * 2 + 1.6f, ery * 2 + 1.6f);
                    using (var br = new LinearGradientBrush(new RectangleF(-erx, -ery, erx * 2, ery * 2), c1, c2, 90f)) g.FillEllipse(br, -erx, -ery, erx * 2, ery * 2);
                    if (k % 2 == 0) using (var br = new SolidBrush(Color.FromArgb(255, 40, 30, 14))) g.FillEllipse(br, -erx * 0.45f, -ery * 0.35f, erx * 0.9f, ery * 0.7f);
                    using (var br = new SolidBrush(Color.FromArgb(200, 255, 244, 200))) g.FillEllipse(br, -erx * 0.6f, -ery * 0.85f, erx * 0.5f, ery * 0.35f);
                    g.Restore(st);
                }
            }
            else if (op == "teeth")
            {
                float x = F(1), y = F(2), w = F(3), h = F(4); int n = int.Parse(a[5]);
                float tw = w / n;
                for (int k = 0; k < n; k++)
                {
                    var r = new RectangleF(x + k * tw + 0.4f, y, tw - 0.8f, h - Math.Abs(k - (n - 1) / 2f) * 0.5f);
                    using (var br = new LinearGradientBrush(new RectangleF(r.X, r.Y - 0.5f, r.Width, r.Height + 1), Col("f6d878", 1), Col("8a6418", 1), 90f)) g.FillRectangle(br, r);
                    using (var br = new SolidBrush(Col("fff6d0", 0.9))) g.FillRectangle(br, r.X + 0.4f, r.Y + 0.6f, r.Width * 0.35f, r.Height * 0.35f);
                }
            }
            else if (op == "bricks")
            {
                float x0 = F(1), y0 = F(2), w = F(3), h = F(4), bw = F(5), bh = F(6);
                var rnd = new Random(int.Parse(a[9]));
                Color m = Col(a[7], 1), b = Col(a[8], 1);
                using (var br = new SolidBrush(m)) g.FillRectangle(br, x0, y0, w, h);
                int row = 0;
                for (float y = y0; y < y0 + h; y += bh, row++)
                    for (float x = x0 - (row % 2) * bw / 2; x < x0 + w; x += bw)
                    {
                        double v = (rnd.NextDouble() - 0.5) * 0.35;
                        Color c = Color.FromArgb(255, Clamp((int)(b.R * (1 + v))), Clamp((int)(b.G * (1 + v))), Clamp((int)(b.B * (1 + v))));
                        using (var br = new SolidBrush(c)) g.FillRectangle(br, x + 0.7f, y + 0.7f, bw - 1.4f, bh - 1.4f);
                        using (var br = new SolidBrush(Color.FromArgb(40, 255, 240, 220))) g.FillRectangle(br, x + 0.7f, y + 0.7f, bw - 1.4f, 0.8f);
                    }
            }
            else if (op == "push")
            {
                stack.Push(g.Transform.Clone());
                if (a[1] == "rotate") { g.TranslateTransform(F(2), F(3)); g.RotateTransform(F(4)); g.TranslateTransform(-F(2), -F(3)); }
                else if (a[1] == "scale") { g.TranslateTransform(F(4), F(5)); g.ScaleTransform(F(2), F(3)); g.TranslateTransform(-F(4), -F(5)); }
                else if (a[1] == "move") { g.TranslateTransform(F(2), F(3)); }
            }
            else if (op == "pop") { g.Transform = stack.Pop(); }
            else if (op == "noise")
            {
                g.Flush();
                var rnd = new Random(int.Parse(a[2])); float amp = F(1);
                var bd = bmp.LockBits(new Rectangle(0, 0, bmp.Width, bmp.Height), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
                int[] px = new int[bmp.Width * bmp.Height];
                System.Runtime.InteropServices.Marshal.Copy(bd.Scan0, px, 0, px.Length);
                for (int k = 0; k < px.Length; k++)
                {
                    int c = px[k]; int al = (c >> 24) & 255; if (al == 0) continue;
                    double v = (rnd.NextDouble() - 0.5) * 2 * amp * 255;
                    int r = Clamp(((c >> 16) & 255) + (int)v), gg = Clamp(((c >> 8) & 255) + (int)v), b = Clamp((c & 255) + (int)v);
                    px[k] = (al << 24) | (r << 16) | (gg << 8) | b;
                }
                System.Runtime.InteropServices.Marshal.Copy(px, 0, bd.Scan0, px.Length);
                bmp.UnlockBits(bd);
            }
            else throw new Exception("unknown op: " + op + " in " + dslPath);
        }
        g.Dispose();
        bmp.Save(outPng, ImageFormat.Png);
        bmp.Dispose();
        return outPng;
    }

    static int Clamp(int v) { return v < 0 ? 0 : (v > 255 ? 255 : v); }

    static PointF Bez(PointF a, PointF b, PointF c, PointF d, float t)
    {
        float u = 1 - t;
        return new PointF(u * u * u * a.X + 3 * u * u * t * b.X + 3 * u * t * t * c.X + t * t * t * d.X,
                          u * u * u * a.Y + 3 * u * u * t * b.Y + 3 * u * t * t * c.Y + t * t * t * d.Y);
    }

    public static string RenderAll(string dir, string outDir)
    {
        Directory.CreateDirectory(outDir);
        var sb = new System.Text.StringBuilder();
        foreach (var f in Directory.GetFiles(dir, "*.vec"))
        {
            string o = Path.Combine(outDir, Path.GetFileNameWithoutExtension(f) + ".png");
            Render(f, o);
            sb.AppendLine(o);
        }
        return sb.ToString();
    }
}
