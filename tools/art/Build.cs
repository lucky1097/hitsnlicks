using System;
using System.Collections.Generic;
using System.IO;

public static class World
{
    static Random rnd;
    public static bool Actors = true;
    public static List<int[]> Solids = new List<int[]>();
    static int BLACK = Cl.H("000000");

    // ------------------------------------------------------------ ground textures
    static void Asphalt(Img im, int x, int y, int w, int h)
    {
        int bc = Cl.H("393a3f");
        im.Noise(x, y, w, h, bc, 0.07, rnd);
        for (int i = 0; i < w * h / 900; i++)
        {
            int px = x + rnd.Next(w), py = y + rnd.Next(h);
            int pw = 6 + rnd.Next(22), ph = 4 + rnd.Next(14);
            im.Fill(px, py, Math.Min(pw, x + w - px), Math.Min(ph, y + h - py), Cl.A(rnd.Next(2) == 0 ? Cl.H("2e2f33") : Cl.H("45464b"), 70));
        }
        for (int i = 0; i < w * h / 2500; i++)
        {
            int cx = x + rnd.Next(w), cy = y + rnd.Next(h);
            int len = 6 + rnd.Next(18);
            for (int k = 0; k < len; k++)
            {
                im.Set(cx, cy, Cl.H("232428"));
                cx += rnd.Next(3) - 1; cy += rnd.Next(3) - 1;
                if (cx < x || cy < y || cx >= x + w || cy >= y + h) break;
            }
        }
    }

    static void Concrete(Img im, int x, int y, int w, int h, int bc, int grid)
    {
        im.Noise(x, y, w, h, bc, 0.06, rnd);
        if (grid > 0)
        {
            for (int j = y; j < y + h; j++) for (int i = x; i < x + w; i++)
                    if ((i - x) % grid == 0 || (j - y) % grid == 0) im.Set(i, j, Cl.A(Cl.Dk(bc, 0.5), 70));
        }
        for (int i = 0; i < w * h / 700; i++)
            im.Ellipse(x + rnd.Next(w), y + rnd.Next(h), 1 + rnd.Next(3), 1 + rnd.Next(2), Cl.A(Cl.Dk(bc, 0.4), 40));
    }

    static void Grass(Img im, int x, int y, int w, int h)
    {
        int bc = Cl.H("4b6a3c");
        im.Noise(x, y, w, h, bc, 0.14, rnd);
        for (int i = 0; i < w * h / 120; i++)
        {
            int px = x + rnd.Next(w), py = y + rnd.Next(h);
            im.Set(px, py, rnd.Next(3) == 0 ? Cl.H("6f8f4f") : Cl.H("3a5530"));
            im.Set(px, py + 1, Cl.H("3a5530"));
        }
        for (int i = 0; i < w * h / 1500; i++)
            im.Ellipse(x + rnd.Next(w), y + rnd.Next(h), 3 + rnd.Next(5), 2 + rnd.Next(4), Cl.A(Cl.H("2f4528"), 60));
    }

    static void Gravel(Img im, int x, int y, int w, int h)
    {
        im.Noise(x, y, w, h, Cl.H("9e9580"), 0.16, rnd);
    }

    // ------------------------------------------------------------ props
    static void Shadow(Img im, int x, int y, int w, int h, int off)
    {
        im.Fill(x + off, y + off, w, h, Cl.A(BLACK, 95));
    }

    static void AC(Img im, int x, int y)
    {
        im.Fill(x + 2, y + 2, 10, 7, Cl.A(BLACK, 90));
        int c = Cl.H("9da1a6");
        im.Fill(x, y, 10, 7, c);
        for (int i = x; i < x + 10; i++) { im.Put(i, y, Cl.Lt(c, 0.25)); im.Put(i, y + 6, Cl.Dk(c, 0.35)); }
        for (int j = y; j < y + 7; j++) { im.Put(x, j, Cl.Lt(c, 0.2)); im.Put(x + 9, j, Cl.Dk(c, 0.3)); }
        im.Ellipse(x + 5.5, y + 3.5, 2.4, 2.4, Cl.H("41454c"));
        im.Put(x + 5, y + 3, Cl.H("8a8f96"));
    }

    static void Vent(Img im, int x, int y)
    {
        im.Fill(x + 1, y + 1, 4, 4, Cl.A(BLACK, 80));
        im.Fill(x, y, 4, 4, Cl.H("7c8086"));
        im.Fill(x + 1, y + 1, 2, 2, Cl.H("3a3d42"));
        im.Put(x, y, Cl.H("b0b4ba"));
    }

    static void WaterTank(Img im, int cx, int cy)
    {
        im.Ellipse(cx + 4, cy + 4, 8, 8, Cl.A(BLACK, 100));
        int c = Cl.H("6b4a32");
        im.Ellipse(cx, cy, 8, 8, Cl.Dk(c, 0.3));
        im.Ellipse(cx, cy, 7, 7, c);
        im.Ring(cx, cy, 5, 5, Cl.Dk(c, 0.25));
        im.Ellipse(cx, cy, 2.5, 2.5, Cl.Lt(c, 0.2));
        im.Put((int)cx - 3, (int)cy - 4, Cl.Lt(c, 0.35)); im.Put((int)cx - 4, (int)cy - 3, Cl.Lt(c, 0.25));
    }

    static void Skylight(Img im, int x, int y, int w, int h)
    {
        im.Fill(x, y, w, h, Cl.H("cfd3d6"));
        im.Fill(x + 1, y + 1, w - 2, h - 2, Cl.H("5f7d96"));
        for (int i = x + 1; i < x + w - 1; i += 4) for (int j = y + 1; j < y + h - 1; j++) im.Put(i, j, Cl.H("b9c0c6"));
        im.Put(x + 2, y + 2, Cl.H("a9c6dc")); im.Put(x + 3, y + 2, Cl.H("8fb0c8"));
    }

    static void Tree(Img im, int cx, int cy, int r)
    {
        Solids.Add(new int[] { cx - 3, cy - 3, 6, 6 });
        im.Ellipse(cx + 4, cy + 4, r, r * 0.9, Cl.A(BLACK, 100));
        int c = Cl.H("3d5e33");
        im.Ellipse(cx, cy, r, r, Cl.Dk(c, 0.35));
        im.Ellipse(cx - 0.5, cy - 0.5, r - 1, r - 1, c);
        for (int i = 0; i < 6; i++)
        {
            double a = rnd.NextDouble() * Math.PI * 2, d = rnd.NextDouble() * r * 0.55;
            double bx = cx + Math.Cos(a) * d, by = cy + Math.Sin(a) * d;
            bool lit = bx < cx && by < cy;
            im.Ellipse(bx, by, r * 0.38, r * 0.38, lit ? Cl.Lt(c, 0.16) : (bx > cx && by > cy ? Cl.Dk(c, 0.18) : Cl.Lt(c, 0.05)));
        }
        im.Ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.3, r * 0.25, Cl.Lt(c, 0.28));
    }

    static void Bench(Img im, int x, int y, bool vertical)
    {
        int w = vertical ? 4 : 12, h = vertical ? 12 : 4;
        im.Fill(x + 2, y + 2, w, h, Cl.A(BLACK, 90));
        int c = Cl.H("7a5236");
        im.Fill(x, y, w, h, c);
        if (vertical) for (int j = y; j < y + h; j++) im.Put(x + 1, j, Cl.Dk(c, 0.3));
        else for (int i = x; i < x + w; i++) im.Put(i, y + 1, Cl.Dk(c, 0.3));
        im.Put(x, y, Cl.Lt(c, 0.25));
    }

    static List<Action> post = new List<Action>();

    static void Lamp(Img im, int x, int y, int dir)
    {
        post.Add(() =>
        {
            im.Ellipse(x + 1, y + 1, 16, 13, Cl.A(Cl.H("ffb04a"), 22));
            im.Ellipse(x + 1, y + 1, 8, 7, Cl.A(Cl.H("ffc46a"), 24));
        });
        im.Fill(x + 1, y + 1, 3, 3, Cl.A(BLACK, 90));
        im.Fill(x, y, 2, 2, Cl.H("2c2e33"));
        int lx = x + (dir == 1 ? 3 : dir == 3 ? -3 : 0), ly = y + (dir == 2 ? 3 : dir == 0 ? -3 : 0);
        im.Fill(lx, ly, 2, 2, Cl.H("fff0b8"));
        im.Line(x, y, lx, ly, Cl.H("3a3d42"));
    }

    static void Hydrant(Img im, int x, int y)
    {
        im.Fill(x + 1, y + 1, 3, 3, Cl.A(BLACK, 90));
        im.Fill(x, y, 3, 3, Cl.H("b8322a"));
        im.Put(x, y, Cl.H("e8645a"));
    }

    static void Dumpster(Img im, int x, int y)
    {
        Solids.Add(new int[] { x, y, 14, 8 });
        im.Fill(x + 3, y + 3, 14, 8, Cl.A(BLACK, 100));
        int c = Cl.H("3e5b3c");
        im.Fill(x, y, 14, 8, c);
        for (int i = x; i < x + 14; i++) { im.Put(i, y, Cl.Lt(c, 0.2)); im.Put(i, y + 4, Cl.Dk(c, 0.35)); im.Put(i, y + 7, Cl.Dk(c, 0.3)); }
        im.Put(x + 13, y + 2, Cl.Dk(c, 0.3));
        for (int i = 0; i < 3; i++) { int bx = x + 15 + rnd.Next(5), by = y + rnd.Next(8); im.Ellipse(bx, by, 2.2, 2, Cl.H("23252a")); im.Put(bx - 1, by - 1, Cl.H("4a4e56")); }
    }

    static void Manhole(Img im, int cx, int cy)
    {
        im.Ellipse(cx, cy, 5, 5, Cl.H("2a2b2f"));
        im.Ellipse(cx, cy, 4, 4, Cl.H("47484d"));
        for (int i = -3; i <= 3; i += 2) im.Line(cx + i, cy - 3, cx + i, cy + 3, Cl.H("34353a"));
    }

    static void Tag(Img im, int cx, int cy, int w, int c)
    {
        var r = rnd;
        int px = cx - w / 2, py = cy + r.Next(5) - 2;
        int steps = w;
        double ph = r.NextDouble() * 6;
        int prevx = px, prevy = py;
        for (int i = 0; i < steps; i++)
        {
            int x = cx - w / 2 + i;
            int y = cy + (int)Math.Round(Math.Sin(i * 0.9 + ph) * (w / 6.0) + Math.Sin(i * 0.31) * 2);
            im.Line(prevx, prevy, x, y, c);
            im.Set(x, y + 1, Cl.A(c, 160));
            prevx = x; prevy = y;
        }
        im.Line(cx - w / 2, cy + w / 5, cx + w / 2, cy + w / 5 - 2, Cl.A(c, 200));
        for (int i = 0; i < 12; i++) im.Set(cx - w / 2 + r.Next(w), cy - w / 4 + r.Next(w / 2 + 1), Cl.A(c, 120));
    }

    static void Awning(Img im, int x0, int x1, int y, int depth, int ca, int cb)
    {
        im.Fill(x0 + 2, y + depth, x1 - x0 + 1, 3, Cl.A(BLACK, 70));
        for (int x = x0; x <= x1; x++)
        {
            int c = ((x - x0) / 3) % 2 == 0 ? ca : cb;
            for (int j = y; j < y + depth; j++) im.Put(x, j, j == y ? Cl.Lt(c, 0.15) : c);
            im.Put(x, y + depth - 1, (x % 2 == 0) ? Cl.Dk(c, 0.35) : Cl.Dk(c, 0.15));
        }
    }

    static void Building(Img im, int x0, int y0, int x1, int y1, string roof, int height)
    {
        int w = x1 - x0 + 1, h = y1 - y0 + 1;
        Solids.Add(new int[] { x0, y0, w, h });
        Shadow(im, x0, y0, w, h, height);
        int bc;
        if (roof == "tar") bc = Cl.H("4a4743");
        else if (roof == "gravel") bc = Cl.H("6d675d");
        else if (roof == "metal") bc = Cl.H("7a7f86");
        else if (roof == "white") bc = Cl.H("cfcfc8");
        else if (roof == "club") bc = Cl.H("26222c");
        else if (roof == "brick") bc = Cl.H("7a4636");
        else bc = Cl.H("8e887c");
        if (roof == "gravel") im.Noise(x0, y0, w, h, bc, 0.22, rnd);
        else im.Noise(x0, y0, w, h, bc, roof == "white" ? 0.04 : 0.08, rnd);
        if (roof == "metal")
            for (int x = x0; x <= x1; x++) if ((x - x0) % 3 == 0) for (int y = y0; y <= y1; y++) im.Set(x, y, Cl.A(Cl.Dk(bc, 0.4), 120));
        if (roof == "metal") for (int i = 0; i < 4; i++) im.Ellipse(x0 + rnd.Next(w), y0 + rnd.Next(h), 4 + rnd.Next(6), 3 + rnd.Next(4), Cl.A(Cl.H("8a5a3a"), 55));
        if (roof == "tar") for (int i = 0; i < w * h / 600; i++) im.Fill(x0 + rnd.Next(w - 8), y0 + rnd.Next(h - 6), 6 + rnd.Next(14), 4 + rnd.Next(8), Cl.A(Cl.H("3c3a37"), 120));
        // parapet
        int hi = Cl.Lt(bc, 0.28), lo = Cl.Dk(bc, 0.4);
        for (int x = x0; x <= x1; x++) { im.Put(x, y0, hi); im.Put(x, y0 + 1, Cl.Lt(bc, 0.15)); im.Put(x, y1, lo); im.Put(x, y1 - 1, Cl.Dk(bc, 0.2)); }
        for (int y = y0; y <= y1; y++) { im.Put(x0, y, hi); im.Put(x0 + 1, y, Cl.Lt(bc, 0.15)); im.Put(x1, y, lo); im.Put(x1 - 1, y, Cl.Dk(bc, 0.2)); }
        for (int x = x0 + 2; x <= x1 - 2; x++) im.Set(x, y0 + 2, Cl.A(BLACK, 60));
        for (int y = y0 + 2; y <= y1 - 2; y++) im.Set(x0 + 2, y, Cl.A(BLACK, 60));
    }

    static void CarAt(Img im, int body, string kind, int x, int y, int rot)
    {
        var c = Car.Make(body, kind);
        int sw = rot % 2 == 0 ? 18 : 32, sh = rot % 2 == 0 ? 32 : 18;
        Solids.Add(new int[] { x + 1, y + 1, sw - 2, sh - 2 });
        im.Fill(x + 3, y + 3, sw - 2, sh - 2, Cl.A(BLACK, 85));
        im.Blit(c, x, y, rot);
    }

    static void PersonAt(Img im, P p, int x, int y, int rot)
    {
        im.Ellipse(x + 9, y + 10, 5, 3, Cl.A(BLACK, 80));
        im.Blit(Person.Top(p), x, y, rot);
    }

    public static void Bubble(Img im, int x, int y, int fill, char glyph)
    {
        int k = Cl.H("141218");
        for (int j = 0; j < 9; j++) for (int i = 0; i < 7; i++)
            {
                bool corner = (i == 0 || i == 6) && (j == 0 || j == 8);
                if (!corner) im.Put(x + i, y + j, k);
            }
        for (int j = 1; j < 8; j++) for (int i = 1; i < 6; i++) im.Put(x + i, y + j, fill);
        im.Put(x + 1, y + 1, Cl.Lt(fill, 0.4));
        im.Put(x + 3, y + 9, k); im.Put(x + 3, y + 10, k); im.Put(x + 2, y + 9, k); im.Put(x + 4, y + 9, k);
        im.Put(x + 3, y + 8, fill);
        if (glyph == '!') { for (int j = 2; j <= 5; j++) im.Put(x + 3, y + j, k); im.Put(x + 3, y + 7, k); }
        else if (glyph == '$') { im.Put(x + 3, y + 1, k); im.Put(x + 2, y + 2, k); im.Put(x + 3, y + 2, k); im.Put(x + 4, y + 2, k); im.Put(x + 2, y + 3, k); im.Put(x + 3, y + 4, k); im.Put(x + 4, y + 5, k); im.Put(x + 2, y + 6, k); im.Put(x + 3, y + 6, k); im.Put(x + 4, y + 6, k); im.Put(x + 3, y + 7, k); }
    }

    // ------------------------------------------------------------ cast
    public static Dictionary<string, P> Cast()
    {
        var d = new Dictionary<string, P>();
        var p = new P(); p.build = "bulky"; p.skin = Cl.H("8a5a3c"); p.hair = Cl.H("1a1414"); p.hairStyle = "buzz"; p.topStyle = "tank"; p.top = Cl.H("e6e3dc");
        p.pantsStyle = "jeans"; p.pants = Cl.H("34507a"); p.shoeStyle = "boots"; p.shoe = Cl.H("3a2a20"); p.chain = true; p.tattoo = true; p.beard = "goatee";
        d["svalovec"] = p;
        p = new P(); p.skin = Cl.H("8a5a3c"); p.hair = Cl.H("1a1414"); p.hairStyle = "bald"; p.topStyle = "hoodie"; p.hatStyle = "hood"; p.top = Cl.H("1c1d20");
        p.pantsStyle = "cargo"; p.pants = Cl.H("1a1b1e"); p.shoe = Cl.H("e8e6e0"); p.shoe2 = Cl.H("1a1b1e"); p.gloves = false; p.tattoo = true; p.mask = true; p.grill = true; p.chain = true;
        d["zlodej"] = p;
        var hr = new P(); hr.skin = p.skin; hr.hair = p.hair; hr.hairStyle = "bald"; hr.topStyle = "hoodie"; hr.top = p.top; hr.pantsStyle = "cargo"; hr.pants = p.pants; hr.shoe = p.shoe; hr.shoe2 = p.shoe2; hr.mask = true; hr.grill = true; hr.chain = true; hr.tattoo = true;
        d["hrac"] = hr;
        p = new P(); p.skin = Cl.H("c68a5c"); p.hair = Cl.H("1f1a1a"); p.hairStyle = "short"; p.hatStyle = "cap"; p.hat = Cl.H("141416"); p.topStyle = "track";
        p.top = Cl.H("1a1a1d"); p.top2 = Cl.H("e6e3dc"); p.pantsStyle = "track"; p.pants = Cl.H("1a1a1d"); p.shoe = Cl.H("f0eee8"); p.shoe2 = Cl.H("1a1a1d");
        p.chain = true; p.shades = true; p.earring = true;
        d["dealer"] = p;
        p = new P(); p.build = "bulky"; p.skin = Cl.H("e0ae8c"); p.hair = Cl.H("2a201a"); p.hairStyle = "bald"; p.beard = "full"; p.scar = true;
        p.topStyle = "coat"; p.top = Cl.H("151517"); p.top2 = Cl.H("d8d4ca"); p.pantsStyle = "slacks"; p.pants = Cl.H("18181b"); p.shoeStyle = "boots"; p.shoe = Cl.H("101012");
        p.knuckles = true; p.chain = true; p.gloves = true;
        d["boss"] = p;
        p = new P(); p.skin = Cl.H("d8a07c"); p.hair = Cl.H("9a948e"); p.hairStyle = "slick"; p.hatStyle = "fedora"; p.hat = Cl.H("2a2a2e"); p.topStyle = "suit"; p.top = Cl.H("141417"); p.top2 = Cl.H("5a1414");
        p.pantsStyle = "slacks"; p.pants = Cl.H("141417"); p.shoeStyle = "dress"; p.shoe = Cl.H("1a1716"); p.cigar = true;
        d["zadavatel"] = p;
        p = new P(); p.skin = Cl.H("6b4430"); p.hair = Cl.H("161212"); p.hairStyle = "short"; p.hatStyle = "beanie"; p.hat = Cl.H("141416"); p.topStyle = "vest";
        p.top = Cl.H("17181b"); p.top2 = Cl.H("5a5e66"); p.pantsStyle = "jeans"; p.pants = Cl.H("2b3a52"); p.shoe = Cl.H("e8e6e0"); p.shoe2 = Cl.H("141416"); p.beard = "stubble";
        d["diler"] = p;
        p = new P(); p.skin = Cl.H("e3b494"); p.hair = Cl.H("5a3a24"); p.hairStyle = "short"; p.hatStyle = "cap"; p.hat = Cl.H("b0582a"); p.topStyle = "coverall";
        p.top = Cl.H("4a5868"); p.pantsStyle = "coverall"; p.pants = Cl.H("4a5868"); p.shoeStyle = "boots"; p.shoe = Cl.H("3a2a20"); p.beard = "full"; p.hair = Cl.H("5a3a24");
        d["mechanik"] = p;
        p = new P(); p.build = "female"; p.skin = Cl.H("e8bfa0"); p.hair = Cl.H("2a1c16"); p.hairStyle = "bun"; p.topStyle = "suit"; p.top = Cl.H("3a3a42"); p.top2 = Cl.H("3a3a42");
        p.pantsStyle = "slacks"; p.pants = Cl.H("3a3a42"); p.shoeStyle = "dress"; p.shoe = Cl.H("1a1716"); p.briefcase = true; p.lips = true;
        d["pravnicka"] = p;
        p = new P(); p.build = "female"; p.skin = Cl.H("9a6444"); p.hair = Cl.H("1a1212"); p.hairStyle = "long"; p.topStyle = "labcoat"; p.top = Cl.H("e4e6e6"); p.top2 = Cl.H("3f8a86");
        p.pantsStyle = "slacks"; p.pants = Cl.H("3f8a86"); p.shoe = Cl.H("e8e6e0"); p.shoe2 = Cl.H("3f8a86"); p.stetho = true; p.lips = true;
        d["lekarka"] = p;
        p = new P(); p.skin = Cl.H("d39a78"); p.hair = Cl.H("2a2020"); p.hairStyle = "short"; p.hatStyle = "police"; p.hat = Cl.H("1f2a44"); p.topStyle = "police";
        p.top = Cl.H("8fb3d9"); p.pantsStyle = "slacks"; p.pants = Cl.H("1f2a44"); p.shoeStyle = "dress"; p.shoe = Cl.H("141414"); p.beard = "";
        d["policajt"] = p;
        p = new P(); p.build = "female"; p.skin = Cl.H("f0c8a8"); p.hair = Cl.H("b88a4a"); p.hairStyle = "long"; p.topStyle = "leather"; p.top = Cl.H("6a7a52"); p.top2 = Cl.H("d8d2c4");
        p.pantsStyle = "jeans"; p.pants = Cl.H("23252a"); p.shoe = Cl.H("e8e6e0"); p.shoe2 = Cl.H("c8a24a"); p.lips = true;
        d["chodkyna"] = p;
        p = new P(); p.skin = Cl.H("b07a52"); p.hair = Cl.H("2a2020"); p.hairStyle = "short"; p.topStyle = "leather"; p.top = Cl.H("4a3426"); p.top2 = Cl.H("8a8f96");
        p.pantsStyle = "jeans"; p.pants = Cl.H("3c5a80"); p.shoeStyle = "boots"; p.shoe = Cl.H("4a3426"); p.beard = "stubble";
        d["chodec"] = p;
        return d;
    }

    // ------------------------------------------------------------ the district map (1x, 896x640)
    public static Img Map(Dictionary<string, P> cast, out int playerX, out int playerY)
    {
        rnd = new Random(11);
        var im = new Img(896, 640);
        Concrete(im, 0, 0, 896, 640, Cl.H("57534b"), 0);

        // roads
        Asphalt(im, 192, 0, 64, 640); Asphalt(im, 576, 0, 64, 640);
        Asphalt(im, 0, 224, 896, 64); Asphalt(im, 0, 480, 896, 64);

        // blocks: x0,y0,x1,y1 and road-adjacent sides L,T,R,B
        int[][] blocks = {
            new int[]{0,0,191,223, 0,0,1,1}, new int[]{256,0,575,223, 1,0,1,1}, new int[]{640,0,895,223, 1,0,0,1},
            new int[]{0,288,191,479, 0,1,1,1}, new int[]{256,288,575,479, 1,1,1,1}, new int[]{640,288,895,479, 1,1,0,1},
            new int[]{0,544,191,639, 0,1,1,0}, new int[]{256,544,575,639, 1,1,1,0}, new int[]{640,544,895,639, 1,1,0,0} };
        int SW = 24;
        int side = Cl.H("8d897f");
        foreach (var b in blocks)
        {
            if (b[4] == 1) Concrete(im, b[0], b[1], SW, b[3] - b[1] + 1, side, 12);
            if (b[6] == 1) Concrete(im, b[2] - SW + 1, b[1], SW, b[3] - b[1] + 1, side, 12);
            if (b[5] == 1) Concrete(im, b[0], b[1], b[2] - b[0] + 1, SW, side, 12);
            if (b[7] == 1) Concrete(im, b[0], b[3] - SW + 1, b[2] - b[0] + 1, SW, side, 12);
            int curb = Cl.H("b3afa4"), cs = Cl.H("26272b");
            if (b[4] == 1) for (int y = b[1]; y <= b[3]; y++) { im.Put(b[0], y, curb); im.Put(b[0] - 1, y, cs); }
            if (b[6] == 1) for (int y = b[1]; y <= b[3]; y++) { im.Put(b[2], y, Cl.Dk(curb, 0.25)); im.Put(b[2] + 1, y, cs); }
            if (b[5] == 1) for (int x = b[0]; x <= b[2]; x++) { im.Put(x, b[1], curb); im.Put(x, b[1] - 1, cs); }
            if (b[7] == 1) for (int x = b[0]; x <= b[2]; x++) { im.Put(x, b[3], Cl.Dk(curb, 0.25)); im.Put(x, b[3] + 1, cs); }
        }

        // lane markings
        int yel = Cl.H("c9a227");
        Func<int, bool> nearH = v => (v >= 224 - 16 && v <= 287 + 16) || (v >= 480 - 16 && v <= 543 + 16);
        Func<int, bool> nearV = v => (v >= 192 - 16 && v <= 255 + 16) || (v >= 576 - 16 && v <= 639 + 16);
        foreach (int lx in new int[] { 222, 606 })
            for (int y = 0; y < 640; y++) if (!nearH(y) && rnd.Next(10) > 0) { im.Put(lx, y, yel); im.Put(lx + 3, y, yel); }
        foreach (int ly in new int[] { 254, 510 })
            for (int x = 0; x < 896; x++) if (!nearV(x) && rnd.Next(10) > 0) { im.Put(x, ly, yel); im.Put(x, ly + 3, yel); }
        int zw = Cl.H("d6d3ca");
        foreach (int vx in new int[] { 192, 576 })
            foreach (int hy in new int[] { 224, 480 })
            {
                for (int x = vx + 3; x < vx + 61; x += 6) { im.Fill(x, hy - 12, 3, 9, Cl.A(zw, 210)); im.Fill(x, hy + 67, 3, 9, Cl.A(zw, 210)); }
                for (int y = hy + 3; y < hy + 61; y += 6) { im.Fill(vx - 12, y, 9, 3, Cl.A(zw, 210)); im.Fill(vx + 67, y, 9, 3, Cl.A(zw, 210)); }
            }
        foreach (var m in new int[][] { new int[] { 240, 130 }, new int[] { 430, 262 }, new int[] { 600, 410 }, new int[] { 760, 500 }, new int[] { 150, 518 }, new int[] { 208, 600 } }) Manhole(im, m[0], m[1]);
        for (int i = 0; i < 26; i++)
        {
            int ox, oy;
            if (i % 2 == 0) { ox = (rnd.Next(2) == 0 ? 200 : 584) + rnd.Next(48); oy = rnd.Next(640); }
            else { ox = rnd.Next(896); oy = (rnd.Next(2) == 0 ? 232 : 488) + rnd.Next(48); }
            im.Ellipse(ox, oy, 3 + rnd.Next(4), 2 + rnd.Next(3), Cl.A(Cl.H("1c1c20"), 70));
        }

        post.Clear();
        int gold = Cl.H("e0b444"), red = Cl.H("d8392e");

        // ---- W-N: apartments + parking
        Building(im, 0, 0, 100, 118, "tar", 8);
        WaterTank(im, 30, 30); AC(im, 60, 20); AC(im, 74, 20); AC(im, 60, 70); Vent(im, 20, 90); Vent(im, 44, 100);
        Building(im, 108, 0, 167, 86, "gravel", 6);
        Skylight(im, 120, 20, 14, 9); Skylight(im, 140, 20, 14, 9); AC(im, 128, 56);
        Building(im, 108, 94, 167, 199, "brick", 5);
        AC(im, 120, 110); Vent(im, 150, 170); Vent(im, 128, 150);
        Asphalt(im, 0, 126, 100, 74);
        for (int x = 4; x < 100; x += 22) for (int y = 130; y < 162; y++) im.Put(x, y, Cl.A(zw, 170));
        CarAt(im, Cl.H("6b6f78"), "sedan", 8, 130, 0); CarAt(im, Cl.H("2f4a6e"), "sedan", 52, 130, 0);
        Dumpster(im, 10, 176);

        // ---- C-N: apartments, alley, shops facing road
        Building(im, 280, 0, 451, 110, "tar", 9);
        WaterTank(im, 310, 30); AC(im, 340, 16); AC(im, 354, 16); AC(im, 368, 16); AC(im, 400, 70); Vent(im, 430, 40); Vent(im, 300, 80);
        im.Fill(360, 46, 18, 14, Cl.H("3d3a37")); Building(im, 360, 46, 377, 59, "tar", 3);
        Building(im, 460, 0, 551, 110, "metal", 8);
        Concrete(im, 280, 111, 272, 18, Cl.H("4d4a44"), 0);
        Dumpster(im, 300, 114); Dumpster(im, 420, 114); Dumpster(im, 500, 114);
        string[] shops = { "gun", "cloth", "jewel", "tattoo" };
        int[][] shopX = { new int[] { 280, 343 }, new int[] { 348, 411 }, new int[] { 416, 479 }, new int[] { 484, 551 } };
        int[][] awn = { new int[] { Cl.H("2a3a2e"), Cl.H("4a5a3e") }, new int[] { Cl.H("b8322a"), Cl.H("e6e2d8") }, new int[] { Cl.H("1f2a44"), Cl.H("c9a227") }, new int[] { Cl.H("2a2026"), Cl.H("7a2f5a") } };
        string[] roofs = { "gravel", "tar", "brick", "gravel" };
        for (int i = 0; i < 4; i++)
        {
            Building(im, shopX[i][0], 130, shopX[i][1], 199, roofs[i], 4);
            AC(im, shopX[i][0] + 10, 150); Vent(im, shopX[i][0] + 40, 170);
            Awning(im, shopX[i][0] + 4, shopX[i][1] - 4, 200, 6, awn[i][0], awn[i][1]);
        }

        // ---- E-N: apartments, gym, parking
        Building(im, 664, 0, 895, 88, "tar", 9);
        AC(im, 690, 20); AC(im, 704, 20); WaterTank(im, 760, 40); AC(im, 820, 50); AC(im, 834, 50); Vent(im, 870, 20);
        Building(im, 664, 96, 800, 199, "metal", 6);
        Skylight(im, 680, 116, 24, 12); Skylight(im, 716, 116, 24, 12); Skylight(im, 752, 116, 24, 12); Skylight(im, 680, 150, 24, 12); Skylight(im, 716, 150, 24, 12);
        Awning(im, 690, 780, 200, 5, Cl.H("e6e2d8"), Cl.H("2a2a30"));
        Asphalt(im, 808, 96, 88, 104);
        for (int x = 810; x < 896; x += 22) for (int y = 100; y < 134; y++) im.Put(x, y, Cl.A(zw, 170));
        CarAt(im, Cl.H("e6e3dc"), "pickup", 813, 101, 0); CarAt(im, Cl.H("8a1f2a"), "sedan", 857, 101, 0);
        Tree(im, 840, 170, 9);

        // ---- W-M: apartments + CORNER (rival tag)
        Building(im, 0, 312, 104, 455, "tar", 8);
        AC(im, 20, 330); AC(im, 34, 330); WaterTank(im, 70, 360); Vent(im, 20, 420); AC(im, 50, 410);
        Building(im, 112, 312, 167, 376, "brick", 4);
        // owner graffiti is drawn live by the game (gang wars)
        Building(im, 112, 384, 167, 455, "gravel", 5);
        AC(im, 124, 400); Vent(im, 150, 430);
        // owner graffiti is drawn live by the game (gang wars)

        // ---- C-M: the park
        Grass(im, 280, 312, 272, 144);
        Gravel(im, 280, 376, 272, 12);
        Gravel(im, 410, 312, 12, 144);
        im.Ellipse(416, 382, 18, 18, Cl.H("9e9580")); Gravel(im, 402, 368, 0, 0);
        Solids.Add(new int[] { 406, 372, 21, 21 });
        im.Ellipse(416, 382, 10, 10, Cl.H("8d9096")); im.Ellipse(416, 382, 8, 8, Cl.H("4f7e9e"));
        im.Ring(416, 382, 5, 5, Cl.H("7aa6c4")); im.Ellipse(416, 382, 2, 2, Cl.H("c8dae6"));
        // court
        int court = Cl.H("8a4f3a");
        im.Fill(444, 320, 100, 50, court); im.Noise(444, 320, 100, 50, court, 0.05, rnd);
        im.Fill(444, 334, 14, 22, Cl.H("6d3e30")); im.Fill(530, 334, 14, 22, Cl.H("6d3e30"));
        int cw = Cl.H("e6e2d8");
        for (int x = 444; x < 544; x++) { im.Put(x, 320, cw); im.Put(x, 369, cw); }
        for (int y = 320; y < 370; y++) { im.Put(444, y, cw); im.Put(543, y, cw); im.Put(493, y, cw); }
        im.Ring(494, 345, 7, 7, cw);
        im.Ring(458, 345, 6, 6, cw); im.Ring(530, 345, 6, 6, cw);
        im.Fill(446, 343, 2, 5, cw); im.Fill(540, 343, 2, 5, cw); im.Put(449, 345, Cl.H("e07a2a")); im.Put(538, 345, Cl.H("e07a2a"));
        for (int x = 440; x <= 548; x += 2) { im.Put(x, 316, Cl.H("9aa0a6")); im.Put(x, 373, Cl.H("9aa0a6")); }
        for (int y = 316; y <= 373; y += 2) { im.Put(440, y, Cl.H("9aa0a6")); im.Put(548, y, Cl.H("9aa0a6")); }
        foreach (var t in new int[][] { new int[] { 300, 332 }, new int[] { 338, 324 }, new int[] { 382, 336 }, new int[] { 296, 432 }, new int[] { 340, 440 }, new int[] { 384, 424 }, new int[] { 460, 420 }, new int[] { 520, 432 }, new int[] { 480, 398 }, new int[] { 540, 400 } })
            Tree(im, t[0], t[1], 9 + rnd.Next(4));
        Bench(im, 344, 368, false); Bench(im, 372, 368, false); Bench(im, 450, 390, false);
        Lamp(im, 398, 370, 0); Lamp(im, 398, 392, 2);

        // ---- E-M: car lot + garage (player tag)
        Asphalt(im, 664, 312, 126, 144);
        for (int x = 668; x < 790; x += 22) { for (int y = 318; y < 352; y++) im.Put(x, y, Cl.A(zw, 170)); for (int y = 380; y < 414; y++) im.Put(x, y, Cl.A(zw, 170)); }
        int[] lotCols = { Cl.H("c9a227"), Cl.H("2f4a6e"), Cl.H("8a1f2a"), Cl.H("e6e3dc"), Cl.H("3a3d44"), Cl.H("4a6a3a") };
        for (int i = 0; i < 5; i++) CarAt(im, lotCols[i], i == 3 ? "pickup" : "sedan", 671 + i * 22, 320, 2);
        for (int i = 0; i < 4; i++) CarAt(im, lotCols[(i + 2) % 6], "sedan", 671 + i * 22, 382, 0);
        for (int x = 664; x < 790; x++) { int[] fl = { Cl.H("e04a3f"), Cl.H("c9a227"), Cl.H("2f74c0"), Cl.H("4f9a45") }; if (x % 4 != 3) im.Put(x, 314, fl[(x / 4) % 4]); }
        Building(im, 754, 424, 789, 455, "white", 3);
        Building(im, 800, 312, 895, 420, "metal", 7);
        // owner graffiti is drawn live by the game (gang wars)
        Concrete(im, 800, 421, 96, 35, Cl.H("6a665e"), 0);
        for (int i = 0; i < 5; i++) im.Ellipse(810 + rnd.Next(70), 428 + rnd.Next(22), 4, 2, Cl.A(Cl.H("1c1c20"), 90));
        CarAt(im, Cl.H("5a6a7a"), "sedan", 830, 404, 2);
        // owner graffiti is drawn live by the game (gang wars)

        // ---- W-S: clinic
        Building(im, 40, 576, 167, 639, "white", 5);
        im.Fill(94, 590, 6, 22, Cl.H("c8332b")); im.Fill(86, 598, 22, 6, Cl.H("c8332b"));
        AC(im, 60, 620); AC(im, 140, 590);
        CarAt(im, Cl.H("e8e8e2"), "van", 8, 590, 0);

        // ---- C-S: warehouse (rival) + club (free)
        Building(im, 280, 576, 420, 639, "metal", 7);
        // owner graffiti is drawn live by the game (gang wars)
        Building(im, 432, 576, 551, 639, "club", 6);
        post.Add(() =>
        {
            int neon = Cl.H("f6e2a8");
            for (int x = 438; x <= 545; x++) { im.Put(x, 582, neon); im.Put(x, 633, neon); im.Set(x, 583, Cl.A(neon, 90)); im.Set(x, 581, Cl.A(neon, 60)); }
            for (int y = 582; y <= 633; y++) { im.Put(438, y, neon); im.Put(545, y, neon); im.Set(439, y, Cl.A(neon, 90)); im.Set(544, y, Cl.A(neon, 90)); }
            im.Ellipse(492, 607, 22, 14, Cl.A(Cl.H("e0b444"), 26));
            int dsign = Cl.H("e0b444");
            for (int i = 0; i < 9; i++) { im.Put(484 + i, 600, dsign); im.Put(488 - i / 2, 600 + i, dsign); im.Put(484 + i - (i / 2) + 4, 600 + i, dsign); }
            for (int y = 609; y <= 616; y++) im.Put(488, y, dsign);
            for (int x = 440; x < 548; x += 4) im.Put(x, 572, Cl.H("a8231c"));
            im.Fill(440, 571, 2, 3, Cl.H("e0b341")); im.Fill(500, 571, 2, 3, Cl.H("e0b341"));
        });

        // ---- E-S: lawyer office + building
        Building(im, 664, 576, 780, 639, "white", 8);
        AC(im, 680, 590); AC(im, 694, 590); AC(im, 708, 590); Skylight(im, 740, 600, 22, 12);
        Building(im, 790, 576, 895, 639, "tar", 6);
        WaterTank(im, 830, 606); Vent(im, 870, 590);

        // ---- street furniture
        foreach (var l in new int[][] { new int[] { 176, 40, 1 }, new int[] { 176, 150, 1 }, new int[] { 264, 60, 3 }, new int[] { 264, 170, 3 }, new int[] { 560, 80, 1 }, new int[] { 648, 120, 3 },
                                         new int[] { 120, 208, 2 }, new int[] { 400, 208, 2 }, new int[] { 520, 208, 2 }, new int[] { 720, 208, 2 }, new int[] { 860, 208, 2 },
                                         new int[] { 80, 296, 0 }, new int[] { 330, 296, 0 }, new int[] { 520, 296, 0 }, new int[] { 740, 296, 0 },
                                         new int[] { 176, 400, 1 }, new int[] { 264, 420, 3 }, new int[] { 560, 360, 1 }, new int[] { 648, 440, 3 },
                                         new int[] { 80, 464, 2 }, new int[] { 380, 464, 2 }, new int[] { 700, 464, 2 }, new int[] { 300, 552, 0 }, new int[] { 720, 552, 0 } })
            Lamp(im, l[0], l[1], l[2]);
        foreach (var t in new int[][] { new int[] { 180, 100 }, new int[] { 268, 120 }, new int[] { 564, 30 }, new int[] { 300, 212 }, new int[] { 620, 212 }, new int[] { 40, 212 }, new int[] { 820, 212 },
                                         new int[] { 120, 300 }, new int[] { 620, 300 }, new int[] { 880, 300 }, new int[] { 180, 440 }, new int[] { 268, 340 }, new int[] { 564, 440 }, new int[] { 40, 468 }, new int[] { 500, 468 }, new int[] { 860, 468 }, new int[] { 120, 556 }, new int[] { 600, 556 } })
            Tree(im, t[0], t[1], 7);
        Hydrant(im, 182, 70); Hydrant(im, 270, 400); Hydrant(im, 600, 470); Hydrant(im, 760, 556);
        Dumpster(im, 106, 460);

        post.Add(() => Signs.All(im));
        if (Actors) {
        // ---- traffic
        CarAt(im, Cl.H("2f4a6e"), "sedan", 198, 50, 2);
        CarAt(im, Cl.H("c9a227"), "taxi", 230, 380, 0);
        CarAt(im, Cl.H("e6e6e2"), "police", 470, 230, 3);
        CarAt(im, Cl.H("8a1f2a"), "sedan", 110, 262, 1);
        CarAt(im, Cl.H("3a3d44"), "van", 330, 516, 1);
        CarAt(im, Cl.H("4a6a3a"), "sedan", 700, 486, 3);
        CarAt(im, Cl.H("6b6f78"), "pickup", 582, 150, 2);
        CarAt(im, Cl.H("e6e3dc"), "sedan", 614, 560, 0);

        // ---- people
        PersonAt(im, cast["chodkyna"], 270, 250 - 30, 2);
        PersonAt(im, cast["chodec"], 150, 204, 3);
        PersonAt(im, cast["policajt"], 600, 296, 2);
        PersonAt(im, cast["chodec"], 470, 290, 1);
        PersonAt(im, cast["chodkyna"], 300, 380, 1);
        PersonAt(im, cast["lekarka"], 120, 560, 2);
        PersonAt(im, cast["pravnicka"], 700, 556, 1);
        int bub = Cl.H("f2ede2");
        PersonAt(im, cast["mechanik"], 820, 428, 0);
        post.Add(() => Bubble(im, 824, 412, bub, '!'));
        PersonAt(im, cast["diler"], 168, 380, 3);
        post.Add(() => Bubble(im, 172, 364, bub, '!'));
        for (int i = 0; i < 4; i++) PersonAt(im, i % 2 == 0 ? cast["chodec"] : cast["chodkyna"], 446 + i * 14, 552, 2);
        PersonAt(im, cast["policajt"], 488, 236, 3);
        // mission giver on the bench + player
        PersonAt(im, cast["zadavatel"], 346, 360, 2);
        post.Add(() => Bubble(im, 351, 344, bub, '!'));
        int pxl = 372, pyl = 384;
        playerX = pxl; playerY = pyl;
        post.Add(() =>
        {
            im.Ring(pxl + 8.5, pyl + 10.5, 9, 5, Cl.A(gold, 235));
            im.Ring(pxl + 8.5, pyl + 10.5, 11, 6.5, Cl.A(gold, 90));
            PersonAt(im, cast["hrac"], pxl, pyl, 0);
        });
        } else { playerX = 372; playerY = 384; }
        im.Grade(0.55, 0.42);
        foreach (var a in post) a();
        post.Clear();
        return im;
    }

    // ------------------------------------------------------------ title backdrop (130x281)
    public static Img Title(Dictionary<string, P> cast)
    {
        rnd = new Random(5);
        var im = new Img(130, 281);
        int[] sky = { Cl.H("0c0d1c"), Cl.H("131428"), Cl.H("1c1a34"), Cl.H("2a1f3c"), Cl.H("3d2440"), Cl.H("5a2b40"), Cl.H("7a3438"), Cl.H("9a4632") };
        int bandH = 22;
        for (int y = 0; y < 200; y++)
        {
            int b = Math.Min(sky.Length - 1, y / bandH);
            int nb = Math.Min(sky.Length - 1, b + 1);
            int within = y % bandH;
            for (int x = 0; x < 130; x++)
            {
                bool dither = within > bandH - 6 && ((x + y) % 2 == 0) && (within > bandH - 3 || (x % 4 == 0));
                im.Put(x, y, dither ? sky[nb] : sky[b]);
            }
        }
        for (int i = 0; i < 40; i++) { int sx = rnd.Next(130), sy = rnd.Next(70); im.Put(sx, sy, rnd.Next(4) == 0 ? Cl.H("e8e4f0") : Cl.H("6a6880")); }
        im.Ellipse(98, 30, 7, 7, Cl.H("e6e0cc")); im.Ellipse(101, 28, 6, 6, Cl.H("131428"));
        // far skyline
        int far = Cl.H("261f38");
        for (int x = -4; x < 134;)
        {
            int w = 8 + rnd.Next(14), h = 40 + rnd.Next(60);
            im.Fill(x, 200 - h, w, h + 40, far);
            for (int wy = 200 - h + 4; wy < 200; wy += 5) for (int wx = x + 2; wx < x + w - 2; wx += 3) if (rnd.Next(7) == 0) im.Put(wx, wy, Cl.H("5a4466"));
            if (rnd.Next(3) == 0) im.Line(x + w / 2, 200 - h, x + w / 2, 200 - h - 8, far);
            x += w + rnd.Next(2);
        }
        // near skyline
        int near = Cl.H("120f1c");
        for (int x = -6; x < 136;)
        {
            int w = 14 + rnd.Next(18), h = 50 + rnd.Next(55);
            int top = 232 - h;
            im.Fill(x, top, w, h + 10, near);
            for (int wy = top + 5; wy < 226; wy += 6) for (int wx = x + 3; wx < x + w - 3; wx += 4)
                {
                    int v = rnd.Next(10);
                    if (v < 2) { im.Put(wx, wy, Cl.H("f2c35b")); im.Put(wx + 1, wy, Cl.H("d9893a")); im.Put(wx, wy + 1, Cl.H("b8702e")); }
                    else if (v < 3) { im.Put(wx, wy, Cl.H("6a8ab0")); }
                    else { im.Put(wx, wy, Cl.H("1d1a2a")); im.Put(wx + 1, wy, Cl.H("1d1a2a")); }
                }
            if (rnd.Next(2) == 0) { int tx = x + 3 + rnd.Next(Math.Max(1, w - 10)); im.Fill(tx, top - 7, 7, 6, near); im.Fill(tx + 1, top - 9, 5, 2, near); im.Line(tx + 1, top - 1, tx + 1, top, near); }
            x += w;
        }
        // street
        for (int y = 232; y < 281; y++) for (int x = 0; x < 130; x++) im.Put(x, y, Cl.Mix(Cl.H("1a1822"), Cl.H("0c0b12"), (y - 232) / 49.0));
        for (int x = 0; x < 130; x++) { im.Put(x, 232, Cl.H("3a3446")); im.Put(x, 233, Cl.H("26222e")); }
        for (int x = 0; x < 130; x += 9) im.Put(x, 233, Cl.H("4a4256"));
        // street lamp + glow
        int lampX = 14;
        for (int y = 168; y < 233; y++) im.Put(lampX, y, Cl.H("1a1724"));
        im.Line(lampX, 168, lampX + 8, 168, Cl.H("1a1724")); im.Fill(lampX + 7, 168, 4, 2, Cl.H("ffe2a0"));
        for (int y = 170; y < 281; y++)
        {
            double t = (y - 170) / 111.0;
            int half = (int)(4 + t * 34);
            for (int x = lampX + 9 - half; x <= lampX + 9 + half; x++) im.Set(x, y, Cl.A(Cl.H("ffb04a"), (int)(34 * (1 - t * 0.6))));
        }
        im.Ellipse(lampX + 9, 240, 26, 6, Cl.A(Cl.H("ffb04a"), 40));
        // characters
        int night = Cl.H("0e0c18"), rim = Cl.H("ffb46a");
        var a = Person.Silhouette(Person.Draw(cast["zlodej"]), night, rim);
        var b2 = Person.Silhouette(Person.Draw(cast["svalovec"]), night, rim);
        var c = Person.Silhouette(Person.Draw(cast["dealer"]), night, rim);
        im.Ellipse(65, 279, 52, 3, Cl.A(BLACK, 120));
        im.Blit(a, 14, 226, 0); im.Blit(c, 84, 226, 0); im.Blit(b2, 49, 229, 0);
        return im;
    }

    // ------------------------------------------------------------ fight backdrop (130x100)
    public static Img Alley()
    {
        rnd = new Random(3);
        var im = new Img(130, 100);
        int mortar = Cl.H("2e2422");
        im.Fill(0, 0, 130, 74, mortar);
        for (int row = 0; row * 4 < 74; row++)
        {
            int off = row % 2 == 0 ? 0 : 4;
            for (int x = -off; x < 130; x += 8)
            {
                double v = rnd.NextDouble();
                int bc = Cl.Mix(Cl.H("6e3a2e"), v < 0.5 ? Cl.H("3e2420") : Cl.H("8a4a38"), Math.Abs(v - 0.5) * 0.7);
                double dark = Math.Max(0, (40 - row * 4) / 60.0);
                bc = Cl.Dk(bc, dark);
                for (int j = row * 4; j < row * 4 + 3 && j < 74; j++) for (int i = x; i < x + 7; i++) im.Put(i, j, bc);
                im.Put(x, row * 4, Cl.Lt(bc, 0.1));
            }
        }
        for (int y = 60; y < 74; y++) for (int x = 0; x < 130; x++) im.Set(x, y, Cl.A(BLACK, (y - 60) * 6));
        // door
        im.Fill(10, 30, 26, 44, Cl.H("1c1a1e"));
        im.Fill(12, 32, 22, 42, Cl.H("3c4650"));
        for (int y = 32; y < 74; y++) { im.Put(12, y, Cl.H("566270")); im.Put(33, y, Cl.H("28303a")); }
        for (int x = 14; x < 32; x += 6) { im.Put(x, 35, Cl.H("6a7684")); im.Put(x, 70, Cl.H("6a7684")); }
        im.Fill(29, 52, 3, 2, Cl.H("8a96a4"));
        // lamp over door + glow
        im.Fill(19, 22, 8, 3, Cl.H("1c1a1e")); im.Fill(20, 25, 6, 1, Cl.H("ffe2a0"));
        for (int y = 26; y < 100; y++)
        {
            double t = (y - 26) / 74.0; int half = (int)(3 + t * 26);
            for (int x = 23 - half; x <= 23 + half; x++) im.Set(x, y, Cl.A(Cl.H("ffb04a"), (int)(40 * (1 - t * 0.7))));
        }
        // graffiti
        int red = Cl.H("e04a3f");
        rnd = new Random(9);
        for (int k = 0; k < 3; k++)
        {
            int px = 48, py = 36 + k;
            for (int i = 0; i < 40; i++)
            {
                int x = 48 + i, y = 38 + (int)Math.Round(Math.Sin(i * 0.7 + k) * 6 + Math.Sin(i * 0.23) * 2);
                im.Line(px, py, x, y, Cl.A(red, 220 - k * 50)); px = x; py = y;
            }
        }
        for (int i = 0; i < 6; i++) { int dx = 50 + rnd.Next(36); for (int j = 0; j < 2 + rnd.Next(6); j++) im.Set(dx, 44 + j, Cl.A(red, 170)); }
        // pipe
        for (int y = 0; y < 74; y++) { im.Put(112, y, Cl.H("5a5e64")); im.Put(113, y, Cl.H("3a3e44")); }
        for (int y = 10; y < 74; y += 18) { im.Put(111, y, Cl.H("6a6e74")); im.Put(114, y, Cl.H("2a2e34")); }
        // ground
        for (int y = 74; y < 100; y++) for (int x = 0; x < 130; x++)
            {
                double v = rnd.NextDouble();
                int c = Cl.Mix(Cl.H("2a2a30"), Cl.H("16161a"), (y - 74) / 30.0);
                im.Put(x, y, v < 0.08 ? Cl.Lt(c, 0.12) : (v > 0.94 ? Cl.Dk(c, 0.3) : c));
            }
        for (int x = 0; x < 130; x++) { im.Put(x, 74, Cl.H("4a4650")); im.Put(x, 75, Cl.H("34303a")); }
        im.Ellipse(70, 90, 20, 3.5, Cl.A(Cl.H("3b4a5e"), 150));
        im.Ellipse(66, 89, 6, 1.2, Cl.A(Cl.H("ffb04a"), 90));
        // dumpster
        im.Fill(96, 54, 30, 22, Cl.H("1e2a1e"));
        im.Fill(97, 55, 28, 20, Cl.H("3e5b3c"));
        for (int x = 97; x < 125; x++) { im.Put(x, 55, Cl.H("5a7a56")); im.Put(x, 60, Cl.H("2a3e28")); }
        for (int y = 61; y < 75; y += 4) for (int x = 99; x < 123; x++) im.Put(x, y, Cl.H("34503a"));
        im.Fill(94, 52, 34, 3, Cl.H("2a3a28"));
        im.Ellipse(90, 74, 5, 4, Cl.H("1a1c20")); im.Put(88, 72, Cl.H("4a4e56"));
        // vignette
        for (int y = 0; y < 100; y++) for (int x = 0; x < 130; x++)
            {
                double dx = (x - 65) / 65.0, dy = (y - 55) / 60.0;
                double d = dx * dx + dy * dy;
                if (d > 0.45) im.Set(x, y, Cl.A(BLACK, Math.Min(150, (int)((d - 0.45) * 160))));
            }
        return im;
    }
}

public static class Build
{
    public static string Run(string outDir)
    {
        Directory.CreateDirectory(outDir);
        var cast = World.Cast();
        var log = new System.Text.StringBuilder();
        foreach (var kv in cast)
        {
            Person.Draw(kv.Value).Scale(4).Save(Path.Combine(outDir, "p_" + kv.Key + ".png"));
            Person.Top(kv.Value).Scale(4).Save(Path.Combine(outDir, "t_" + kv.Key + ".png"));
        }
        // vehicles sheet
        var sheet = new Img(4 * 24, 32);
        string[] kinds = { "sedan", "police", "van", "pickup" };
        int[] cols = { Cl.H("2f4a6e"), Cl.H("e6e6e2"), Cl.H("3a3d44"), Cl.H("8a1f2a") };
        for (int i = 0; i < 4; i++) sheet.Blit(Car.Make(cols[i], kinds[i]), i * 24 + 3, 0, 0);
        sheet.Scale(4).Save(Path.Combine(outDir, "cars.png"));
        int px, py;
        var map = World.Map(cast, out px, out py);
        map.Scale(2).Save(Path.Combine(outDir, "map.png"));
        int cx0 = px + 8 - 65, cy0 = py + 8 - 160;
        map.Crop(cx0, cy0, 130, 281).Scale(3).Save(Path.Combine(outDir, "hud.png"));
        log.AppendLine("hud crop " + cx0 + "," + cy0 + " player " + px + "," + py);
        return log.ToString();
    }
}
