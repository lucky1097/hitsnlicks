using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Globalization;

// Mesto 1, after a slice of Düsseldorf (Unterbilk): a park with two ponds in the north, a wide diagonal boulevard
// under it, straight and diagonal streets, perimeter blocks with courtyards. Only straight street segments,
// so the street graph is exact: nodes sit on real crossings and cars/walkers never jump.
// Outputs: map_base.png (pixel art), city.json (collision grid, street graph, buildings).
public static class City
{
    public const int W = 1200, H = 960, SW = 14, CELL = 4;
    // ground kinds
    const byte LAND = 0, WATER = 1, PARK = 2, WALK = 3, PLAZA = 4, ROAD = 5, BUILD = 6, YARD = 7, PATH = 8;

    class Road { public string name; public List<double[]> pts; public int w; public bool car, lines, trees, path; }
    public class Mark { public string id; public int x0, y0, x1, y1; public string roof; public string icon; public int frame; public char door; public int dx, dy, rx, ry; public int lot; }
    class Node { public double x, y, r; public HashSet<int> roads = new HashSet<int>(); }

    static Random rnd;
    static byte[] K;
    static bool[] SOLIDX, NEARNODE;
    static int[] LOT;
    static List<Road> roads = new List<Road>();
    static List<Node> nodes = new List<Node>();
    static List<int[]> edges = new List<int[]>(); // a, b, road, car
    static List<int> lotRoof = new List<int>(), lotH = new List<int>();
    static List<string> lotKind = new List<string>();
    public static List<Mark> marks = new List<Mark>();

    static int I(int x, int y) { return y * W + x; }
    static bool In(int x, int y) { return x >= 0 && y >= 0 && x < W && y < H; }
    static double[] P(double x, double y) { return new[] { x, y }; }

    static double SegDist(double px, double py, double ax, double ay, double bx, double by, out double t)
    {
        double vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
        t = l2 == 0 ? 0 : Math.Max(0, Math.Min(1, ((px - ax) * vx + (py - ay) * vy) / l2));
        double qx = ax + vx * t - px, qy = ay + vy * t - py;
        return Math.Sqrt(qx * qx + qy * qy);
    }

    static void Add(string name, int w, bool car, bool lines, bool trees, params double[][] pts)
    {
        roads.Add(new Road { name = name, w = w, car = car, lines = lines, trees = trees, pts = pts.ToList() });
    }

    // ------------------------------------------------------------ the street network (straight segments only)
    static void Network()
    {
        roads.Clear();
        // streets run 40 px past the edge, so cars turn around out of sight
        Add("Grabenská", 38, true, true, false, P(-40, 40), P(1240, 40));
        Add("Haroldova", 52, true, true, true, P(-40, 372), P(380, 462), P(1240, 522));
        Add("Bilkerská", 40, true, true, false, P(-40, 700), P(1240, 700));
        Add("Kostolná", 36, true, false, false, P(-40, 890), P(1240, 890));
        Add("Západná", 34, true, false, false, P(60, -40), P(60, 1000));
        Add("Vodná", 34, true, false, true, P(210, 40), P(330, 250), P(330, 470));
        Add("Kronprinzova", 38, true, true, true, P(380, 462), P(170, 1000));
        Add("Florova", 30, true, false, false, P(404, 700), P(412, 1000));
        Add("Alžbetina", 40, true, true, false, P(840, -40), P(840, 1000));
        Add("Východná", 36, true, false, false, P(1090, -40), P(1090, 1000));
        Add("Kopernikova", 32, true, false, false, P(600, 470), P(600, 1000));
        Add("Jahnova", 30, true, false, false, P(840, 610), P(1090, 610));
        Add("Ladská", 30, true, false, false, P(60, 560), P(350, 560));
        Add("Sedanova", 28, true, false, false, P(60, 800), P(260, 800));
        Add("Talstraße", 28, true, false, false, P(600, 800), P(840, 800));
        // gravel paths through the park (walkers only)
        foreach (var p in new[] {
            new[] { P(370, 90), P(800, 90) }, new[] { P(800, 90), P(800, 428) }, new[] { P(370, 90), P(370, 428) },
            new[] { P(370, 428), P(800, 428) }, new[] { P(370, 272), P(800, 272) } })
        { Add("cesta", 10, false, false, false, p); roads[roads.Count - 1].path = true; }

        // snap street ends onto the street they touch
        for (int ri = 0; ri < roads.Count; ri++)
            foreach (int end in new[] { 0, roads[ri].pts.Count - 1 })
            {
                var p = roads[ri].pts[end];
                double best = 14; double[] snap = null;
                for (int rj = 0; rj < roads.Count; rj++)
                {
                    if (rj == ri || roads[rj].path != roads[ri].path) continue;
                    var q = roads[rj].pts;
                    for (int s = 0; s < q.Count - 1; s++)
                    {
                        double t; double d = SegDist(p[0], p[1], q[s][0], q[s][1], q[s + 1][0], q[s + 1][1], out t);
                        if (d < best) { best = d; snap = P(q[s][0] + (q[s + 1][0] - q[s][0]) * t, q[s][1] + (q[s + 1][1] - q[s][1]) * t); }
                    }
                }
                if (snap != null) roads[ri].pts[end] = snap;
            }

        // nodes: every vertex and every crossing; edges: consecutive nodes along each street
        nodes.Clear(); edges.Clear();
        Func<double, double, int, int> nodeAt = (x, y, ri) =>
        {
            for (int i = 0; i < nodes.Count; i++)
                if (Math.Abs(nodes[i].x - x) < 3 && Math.Abs(nodes[i].y - y) < 3) { nodes[i].roads.Add(ri); return i; }
            var n = new Node { x = x, y = y }; n.roads.Add(ri); nodes.Add(n); return nodes.Count - 1;
        };
        for (int ri = 0; ri < roads.Count; ri++)
        {
            var r = roads[ri];
            var cuts = new List<double[]>(); // [distance along road, x, y]
            double along = 0;
            for (int s = 0; s < r.pts.Count - 1; s++)
            {
                var a = r.pts[s]; var b = r.pts[s + 1];
                double len = Math.Sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
                cuts.Add(new[] { along, a[0], a[1] });
                for (int rj = 0; rj < roads.Count; rj++)
                {
                    if (rj == ri || roads[rj].path != r.path) continue;
                    var q = roads[rj].pts;
                    for (int u = 0; u < q.Count - 1; u++)
                    {
                        double[] x = Cross(a, b, q[u], q[u + 1]);
                        if (x != null) cuts.Add(new[] { along + x[2] * len, x[0], x[1] });
                    }
                }
                along += len;
            }
            cuts.Add(new[] { along, r.pts[r.pts.Count - 1][0], r.pts[r.pts.Count - 1][1] });
            cuts.Sort((p, q) => p[0].CompareTo(q[0]));
            int prev = -1;
            foreach (var c in cuts)
            {
                int id = nodeAt(c[1], c[2], ri);
                if (prev >= 0 && prev != id) edges.Add(new[] { prev, id, ri, r.car ? 1 : 0 });
                prev = id;
            }
        }
        // a crossing gets a radius (half the widest street there): turns and markings keep clear of it
        foreach (var n in nodes) n.r = n.roads.Count > 1 ? n.roads.Max(ri => roads[ri].w / 2.0) : 0;
    }

    // segment crossing: returns x, y and the position along the first segment (0..1)
    static double[] Cross(double[] a, double[] b, double[] c, double[] d)
    {
        double rX = b[0] - a[0], rY = b[1] - a[1], sX = d[0] - c[0], sY = d[1] - c[1];
        double den = rX * sY - rY * sX;
        if (Math.Abs(den) < 1e-9) return null;
        double t = ((c[0] - a[0]) * sY - (c[1] - a[1]) * sX) / den, u = ((c[0] - a[0]) * rY - (c[1] - a[1]) * rX) / den;
        if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null;
        return new[] { a[0] + rX * t, a[1] + rY * t, t };
    }

    // ------------------------------------------------------------ ground masks
    static void Paint(Road r, byte want, double ow, byte[] rank)
    {
        double hw = r.w / 2.0;
        for (int s = 0; s < r.pts.Count - 1; s++)
        {
            var a = r.pts[s]; var b = r.pts[s + 1];
            int x0 = (int)Math.Floor(Math.Min(a[0], b[0]) - ow - 1), x1 = (int)Math.Ceiling(Math.Max(a[0], b[0]) + ow + 1);
            int y0 = (int)Math.Floor(Math.Min(a[1], b[1]) - ow - 1), y1 = (int)Math.Ceiling(Math.Max(a[1], b[1]) + ow + 1);
            for (int y = Math.Max(0, y0); y <= Math.Min(H - 1, y1); y++)
                for (int x = Math.Max(0, x0); x <= Math.Min(W - 1, x1); x++)
                {
                    double t; double d = SegDist(x + 0.5, y + 0.5, a[0], a[1], b[0], b[1], out t);
                    if (d > ow) continue;
                    byte k = d <= hw ? want : WALK;
                    int i = I(x, y);
                    if (rank[k] > rank[K[i]]) K[i] = k;
                }
        }
    }

    static void Masks()
    {
        K = new byte[W * H]; SOLIDX = new bool[W * H]; LOT = new int[W * H]; NEARNODE = new bool[W * H];
        for (int i = 0; i < LOT.Length; i++) LOT[i] = -1;
        Network();
        //            land water park walk plaza road build yard path
        var rank = new byte[] { 0, 0, 1, 3, 4, 5, 0, 0, 2 };
        foreach (var r in roads) if (!r.path) Paint(r, r.car ? ROAD : PLAZA, r.car ? r.w / 2.0 + SW : r.w / 2.0, rank);
        // the square by the church (Don's corner)
        Blob(700, 760, 70, 34, PLAZA);
        // the park: the block between Grabenská, Vodná, Haroldova and Alžbetina
        Flood(600, 250, LAND, PARK);
        Blob(560, 165, 130, 62, WATER); Blob(650, 190, 80, 48, WATER);
        Blob(620, 350, 110, 52, WATER); Blob(712, 330, 66, 44, WATER);
        foreach (var r in roads) if (r.path) Paint(r, PATH, r.w / 2.0, new byte[] { 0, 0, 1, 3, 4, 5, 0, 0, 2 });
        // markings stay out of crossings
        foreach (var n in nodes)
        {
            if (n.r <= 0) continue;
            int rr = (int)Math.Ceiling(n.r + 6);
            for (int y = (int)n.y - rr; y <= (int)n.y + rr; y++) for (int x = (int)n.x - rr; x <= (int)n.x + rr; x++)
                    if (In(x, y) && (x - n.x) * (x - n.x) + (y - n.y) * (y - n.y) <= rr * rr) NEARNODE[I(x, y)] = true;
        }
    }

    static void Blob(int cx, int cy, int rx, int ry, byte kind)
    {
        for (int y = cy - ry; y <= cy + ry; y++) for (int x = cx - rx; x <= cx + rx; x++)
            {
                if (!In(x, y)) continue;
                double dx = (x - cx) / (double)rx, dy = (y - cy) / (double)ry;
                if (dx * dx + dy * dy <= 1 && (kind != WATER || K[I(x, y)] == PARK)) K[I(x, y)] = kind;
            }
    }

    static void Flood(int sx, int sy, byte from, byte to)
    {
        var q = new Queue<int>(); q.Enqueue(I(sx, sy));
        while (q.Count > 0)
        {
            int i = q.Dequeue();
            if (K[i] != from) continue;
            K[i] = to;
            int x = i % W, y = i / W;
            if (x > 0) q.Enqueue(i - 1); if (x < W - 1) q.Enqueue(i + 1); if (y > 0) q.Enqueue(i - W); if (y < H - 1) q.Enqueue(i + W);
        }
    }

    // ------------------------------------------------------------ blocks and lots
    static string[] RoofsFor(int x, int y)
    {
        if (y < 430 && x > 860) return new[] { "glass", "white", "metal", "slate" };       // offices east of the park
        if (y < 600 && x < 330) return new[] { "slate", "brick", "tar", "gravel" };        // old houses west
        if (y > 700) return new[] { "brick", "brick", "slate", "tar", "gravel" };          // the quiet south
        return new[] { "tar", "gravel", "brick", "slate", "white" };
    }

    static int RoofColor(string roof)
    {
        switch (roof)
        {
            case "tar": return Cl.H("4a4743");
            case "gravel": return Cl.H("6d675d");
            case "metal": return Cl.H("7a7f86");
            case "white": return Cl.H("c9c8c0");
            case "club": return Cl.H("26222c");
            case "brick": return Cl.H("7a4636");
            case "slate": return Cl.H("4b5058");
            case "glass": return Cl.H("41586a");
            default: return Cl.H("8e887c");
        }
    }

    static void Lots()
    {
        var seen = new bool[W * H];
        var qx = new int[W * H]; var qy = new int[W * H];
        lotRoof.Clear(); lotH.Clear(); lotKind.Clear();
        foreach (var m in marks)
        {
            m.lot = lotRoof.Count;
            lotRoof.Add(RoofColor(m.roof)); lotH.Add(m.roof == "glass" ? 10 : 7); lotKind.Add(m.roof);
        }
        // landmarks inside the park (the museum) are built on the grass
        foreach (var m in marks)
            for (int y = m.y0; y <= m.y1; y++) for (int x = m.x0; x <= m.x1; x++)
                    if (In(x, y) && K[I(x, y)] == PARK) { K[I(x, y)] = BUILD; LOT[I(x, y)] = m.lot; }
        for (int sy = 0; sy < H; sy++) for (int sx = 0; sx < W; sx++)
            {
                int si = I(sx, sy);
                if (K[si] != LAND || seen[si]) continue;
                int n = 0, head = 0; qx[n] = sx; qy[n] = sy; n++; seen[si] = true;
                int bx0 = sx, bx1 = sx, by0 = sy, by1 = sy;
                while (head < n)
                {
                    int x = qx[head], y = qy[head]; head++;
                    bx0 = Math.Min(bx0, x); bx1 = Math.Max(bx1, x); by0 = Math.Min(by0, y); by1 = Math.Max(by1, y);
                    int[] nx = { x + 1, x - 1, x, x }, ny = { y, y, y + 1, y - 1 };
                    for (int k = 0; k < 4; k++)
                    {
                        if (!In(nx[k], ny[k])) continue;
                        int ii = I(nx[k], ny[k]);
                        if (seen[ii] || K[ii] != LAND) continue;
                        seen[ii] = true; qx[n] = nx[k]; qy[n] = ny[k]; n++;
                    }
                }
                if (n < 220) { for (int k = 0; k < n; k++) K[I(qx[k], qy[k])] = WALK; continue; }
                var roofs = RoofsFor((bx0 + bx1) / 2, (by0 + by1) / 2);
                int spacing = 54;
                var seeds = new List<int[]>();
                for (int y = by0 + spacing / 2; y <= by1; y += spacing)
                    for (int x = bx0 + spacing / 2; x <= bx1; x += spacing)
                    {
                        int jx = x + rnd.Next(spacing / 2) - spacing / 4, jy = y + rnd.Next(spacing / 2) - spacing / 4;
                        if (In(jx, jy) && seen[I(jx, jy)] && K[I(jx, jy)] == LAND) seeds.Add(new[] { jx, jy, lotRoof.Count + seeds.Count });
                    }
                if (seeds.Count == 0) seeds.Add(new[] { qx[0], qy[0], lotRoof.Count });
                foreach (var s in seeds)
                {
                    string roof = roofs[rnd.Next(roofs.Length)];
                    lotRoof.Add(RoofColor(roof)); lotH.Add(roof == "glass" ? 9 + rnd.Next(4) : 4 + rnd.Next(5)); lotKind.Add(roof);
                }
                for (int k = 0; k < n; k++)
                {
                    int x = qx[k], y = qy[k], i = I(x, y);
                    var mk = marks.FirstOrDefault(m => x >= m.x0 && x <= m.x1 && y >= m.y0 && y <= m.y1);
                    if (mk != null) { LOT[i] = mk.lot; K[i] = BUILD; continue; }
                    int best = -1; double bd = 1e18;
                    foreach (var s in seeds) { double d = (s[0] - x) * (s[0] - x) + (s[1] - y) * (s[1] - y); if (d < bd) { bd = d; best = s[2]; } }
                    LOT[i] = best; K[i] = BUILD;
                }
                // lots that never touch the street become courtyards (perimeter blocks like the reference)
                var touches = new HashSet<int>();
                for (int k = 0; k < n; k++)
                {
                    int x = qx[k], y = qy[k];
                    for (int d = 0; d < 4; d++)
                    {
                        int xx = x + (d == 0 ? 1 : d == 1 ? -1 : 0), yy = y + (d == 2 ? 1 : d == 3 ? -1 : 0);
                        if (In(xx, yy) && K[I(xx, yy)] != BUILD && K[I(xx, yy)] != YARD) touches.Add(LOT[I(x, y)]);
                    }
                }
                foreach (var s in seeds)
                    if (!touches.Contains(s[2]) && !marks.Any(m => m.lot == s[2])) lotKind[s[2]] = "yard";
                for (int k = 0; k < n; k++) { int i = I(qx[k], qy[k]); if (LOT[i] >= 0 && lotKind[LOT[i]] == "yard") K[i] = YARD; }
            }
    }

    // ------------------------------------------------------------ drawing helpers
    static void Noise(Img im, int x, int y, int c, double amp)
    {
        double v = rnd.NextDouble();
        im.Put(x, y, v < 0.5 ? Cl.Dk(c, (0.5 - v) * 2 * amp) : Cl.Lt(c, (v - 0.5) * 2 * amp));
    }

    static void Tree(Img im, int cx, int cy, int r)
    {
        for (int y = cy - 3; y < cy + 3; y++) for (int x = cx - 3; x < cx + 3; x++) if (In(x, y)) SOLIDX[I(x, y)] = true;
        im.Ellipse(cx + 4, cy + 4, r, r * 0.9, Cl.A(Cl.H("000000"), 100));
        int c = Cl.H("3d5e33");
        im.Ellipse(cx, cy, r, r, Cl.Dk(c, 0.35));
        im.Ellipse(cx - 0.5, cy - 0.5, r - 1, r - 1, c);
        for (int i = 0; i < 6; i++)
        {
            double a = rnd.NextDouble() * Math.PI * 2, d = rnd.NextDouble() * r * 0.55;
            double bx = cx + Math.Cos(a) * d, by = cy + Math.Sin(a) * d;
            im.Ellipse(bx, by, r * 0.38, r * 0.38, bx < cx && by < cy ? Cl.Lt(c, 0.16) : (bx > cx && by > cy ? Cl.Dk(c, 0.18) : Cl.Lt(c, 0.05)));
        }
        im.Ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.3, r * 0.25, Cl.Lt(c, 0.28));
    }

    static List<Action> post = new List<Action>();

    static void Lamp(Img im, int x, int y)
    {
        post.Add(() => { im.Ellipse(x + 1, y + 1, 16, 13, Cl.A(Cl.H("ffb04a"), 22)); im.Ellipse(x + 1, y + 1, 8, 7, Cl.A(Cl.H("ffc46a"), 24)); });
        im.Fill(x + 1, y + 1, 3, 3, Cl.A(Cl.H("000000"), 90));
        im.Fill(x, y, 2, 2, Cl.H("2c2e33"));
        im.Fill(x, y - 3, 2, 2, Cl.H("fff0b8"));
    }

    static bool Free(int x0, int y0, int w, int h, int lot)
    {
        for (int y = y0 - 1; y <= y0 + h; y++) for (int x = x0 - 1; x <= x0 + w; x++)
            {
                if (!In(x, y)) return false;
                int i = I(x, y);
                if (K[i] != BUILD || LOT[i] != lot) return false;
            }
        return true;
    }

    static bool NearSolid(int x, int y, int r)
    {
        for (int yy = y - r; yy <= y + r; yy += 2) for (int xx = x - r; xx <= x + r; xx += 2)
                if (In(xx, yy) && (SOLIDX[I(xx, yy)] || K[I(xx, yy)] == WATER || K[I(xx, yy)] == PATH)) return true;
        return false;
    }

    static bool NearKind(int x, int y, int r, byte k)
    {
        for (int yy = y - r; yy <= y + r; yy++) for (int xx = x - r; xx <= x + r; xx++) if (In(xx, yy) && K[I(xx, yy)] == k) return true;
        return false;
    }

    // walk along each street edge, calling back every `every` px with the point and its direction
    static void AlongEdges(double every, Func<Road, bool> which, Action<Road, double, double, double, double, int> at)
    {
        foreach (var e in edges)
        {
            var r = roads[e[2]];
            if (!which(r)) continue;
            var a = nodes[e[0]]; var b = nodes[e[1]];
            double dx = b.x - a.x, dy = b.y - a.y, len = Math.Sqrt(dx * dx + dy * dy);
            if (len < 1) continue;
            int k = 0;
            for (double s = every / 2; s < len; s += every, k++) at(r, a.x + dx * s / len, a.y + dy * s / len, dx / len, dy / len, k);
        }
    }

    // ------------------------------------------------------------ the map
    public static Img Build(bool debug)
    {
        rnd = new Random(23);
        Masks();
        Lots();
        var im = new Img(W, H);
        int sidewalk = Cl.H("8d897f"), asphalt = Cl.H("393a3f"), land = Cl.H("57534b"), grass = Cl.H("4b6a3c"), water = Cl.H("2f4d5c"), plaza = Cl.H("9a9488"), gravel = Cl.H("9e9580");
        for (int y = 0; y < H; y++) for (int x = 0; x < W; x++)
            {
                int i = I(x, y);
                switch (K[i])
                {
                    case WATER: Noise(im, x, y, water, 0.06); break;
                    case PARK: Noise(im, x, y, grass, 0.14); if (rnd.Next(60) == 0) im.Put(x, y, Cl.H("6f8f4f")); break;
                    case PATH: Noise(im, x, y, gravel, 0.16); break;
                    case WALK:
                        Noise(im, x, y, sidewalk, 0.06);
                        if (x % 12 == 0 || y % 12 == 0) im.Set(x, y, Cl.A(Cl.Dk(sidewalk, 0.5), 60));
                        break;
                    case PLAZA:
                        Noise(im, x, y, plaza, 0.07);
                        if ((x + (y / 6 % 2) * 4) % 8 == 0 || y % 6 == 0) im.Set(x, y, Cl.A(Cl.Dk(plaza, 0.45), 70));
                        break;
                    case ROAD: Noise(im, x, y, asphalt, 0.07); break;
                    case YARD: Noise(im, x, y, rnd.Next(3) == 0 ? Cl.H("4d5a3e") : Cl.H("5f5a50"), 0.12); break;
                    case BUILD:
                        {
                            int lot = LOT[i]; int c = lotRoof[lot]; string kind = lotKind[lot];
                            Noise(im, x, y, c, kind == "gravel" ? 0.22 : kind == "white" ? 0.04 : 0.08);
                            if (kind == "metal" && x % 3 == 0) im.Set(x, y, Cl.A(Cl.Dk(c, 0.4), 120));
                            if (kind == "slate" && (y % 4 == 0 || (x + (y / 4) * 3) % 9 == 0)) im.Set(x, y, Cl.A(Cl.Dk(c, 0.35), 110));
                            if (kind == "brick" && y % 5 == 0) im.Set(x, y, Cl.A(Cl.Dk(c, 0.3), 90));
                            if (kind == "glass" && (x % 10 == 0 || y % 10 == 0)) im.Set(x, y, Cl.A(Cl.Lt(c, 0.35), 120));
                            break;
                        }
                    default: Noise(im, x, y, land, 0.06); break;
                }
            }
        // asphalt patches and cracks
        for (int n = 0; n < 500; n++)
        {
            int x = rnd.Next(W), y = rnd.Next(H);
            if (K[I(x, y)] != ROAD) continue;
            if (n % 3 == 0) { for (int k = 0; k < 10 + rnd.Next(14); k++) { if (In(x, y) && K[I(x, y)] == ROAD) im.Put(x, y, Cl.H("232428")); x += rnd.Next(3) - 1; y += rnd.Next(3) - 1; } }
            else im.Ellipse(x, y, 3 + rnd.Next(6), 2 + rnd.Next(4), Cl.A(rnd.Next(2) == 0 ? Cl.H("2e2f33") : Cl.H("45464b"), 70));
        }
        // pond ripples and lily pads
        for (int n = 0; n < 500; n++)
        {
            int x = rnd.Next(W), y = rnd.Next(H);
            if (K[I(x, y)] != WATER) continue;
            if (n % 5 == 0) im.Ellipse(x, y, 2.5, 2, Cl.H("3f6a3a"));
            else for (int k = 0; k < 3 + rnd.Next(5); k++) if (In(x + k, y) && K[I(x + k, y)] == WATER) im.Set(x + k, y, Cl.A(Cl.H("6f93a6"), 90));
        }
        // curbs, pond banks, parapets
        for (int y = 1; y < H - 1; y++) for (int x = 1; x < W - 1; x++)
            {
                int i = I(x, y); byte k = K[i];
                byte up = K[I(x, y - 1)], dn = K[I(x, y + 1)], lf = K[I(x - 1, y)], rt = K[I(x + 1, y)];
                if (k == WALK && (up == ROAD || dn == ROAD || lf == ROAD || rt == ROAD)) im.Put(x, y, Cl.H("b3afa4"));
                if (k == ROAD && (up == WALK || dn == WALK || lf == WALK || rt == WALK)) im.Put(x, y, Cl.H("26272b"));
                if (k == WATER && (up != WATER || dn != WATER || lf != WATER || rt != WATER)) im.Put(x, y, Cl.H("6b675e"));
                if (k == BUILD)
                {
                    int lot = LOT[i], c = lotRoof[lot];
                    bool eu = K[I(x, y - 1)] != BUILD || LOT[I(x, y - 1)] != lot, el = K[I(x - 1, y)] != BUILD || LOT[I(x - 1, y)] != lot;
                    bool ed = K[I(x, y + 1)] != BUILD || LOT[I(x, y + 1)] != lot, er = K[I(x + 1, y)] != BUILD || LOT[I(x + 1, y)] != lot;
                    if (eu || el) im.Put(x, y, Cl.Lt(c, 0.28));
                    else if (ed || er) im.Put(x, y, Cl.Dk(c, 0.4));
                }
            }
        // building shadows
        for (int y = 0; y < H; y++) for (int x = 0; x < W; x++)
            {
                if (K[I(x, y)] == BUILD) continue;
                for (int s = 1; s <= 12; s++)
                {
                    int xx = x - s, yy = y - s;
                    if (!In(xx, yy)) break;
                    int j = I(xx, yy);
                    if (K[j] == BUILD) { if (lotH[LOT[j]] >= s) im.Set(x, y, Cl.A(Cl.H("000000"), 95)); break; }
                }
            }
        // roof clutter
        for (int n = 0; n < 1500; n++)
        {
            int x = rnd.Next(W), y = rnd.Next(H);
            int i = I(x, y);
            if (K[i] != BUILD) continue;
            int lot = LOT[i];
            if (marks.Any(m => m.lot == lot)) continue;
            string kind = lotKind[lot];
            int t = rnd.Next(10);
            if (t < 5 && Free(x, y, 10, 7, lot))
            {
                im.Fill(x + 2, y + 2, 10, 7, Cl.A(Cl.H("000000"), 90));
                int c = Cl.H("9da1a6"); im.Fill(x, y, 10, 7, c);
                for (int k = x; k < x + 10; k++) { im.Put(k, y, Cl.Lt(c, 0.25)); im.Put(k, y + 6, Cl.Dk(c, 0.35)); }
                im.Ellipse(x + 5.5, y + 3.5, 2.4, 2.4, Cl.H("41454c"));
            }
            else if (t < 8 && Free(x, y, 4, 4, lot))
            {
                im.Fill(x + 1, y + 1, 4, 4, Cl.A(Cl.H("000000"), 80)); im.Fill(x, y, 4, 4, Cl.H("7c8086")); im.Fill(x + 1, y + 1, 2, 2, Cl.H("3a3d42"));
            }
            else if (t < 9 && kind != "glass" && Free(x - 8, y - 8, 17, 17, lot))
            {
                im.Ellipse(x + 4, y + 4, 8, 8, Cl.A(Cl.H("000000"), 100));
                int c = Cl.H("6b4a32"); im.Ellipse(x, y, 8, 8, Cl.Dk(c, 0.3)); im.Ellipse(x, y, 7, 7, c); im.Ring(x, y, 5, 5, Cl.Dk(c, 0.25));
            }
            else if (Free(x, y, 16, 10, lot))
            {
                im.Fill(x, y, 16, 10, Cl.H("cfd3d6")); im.Fill(x + 1, y + 1, 14, 8, Cl.H("5f7d96"));
                for (int k = x + 1; k < x + 15; k += 4) for (int j = y + 1; j < y + 9; j++) im.Put(k, j, Cl.H("b9c0c6"));
            }
        }
        // markings: yellow centre line on main streets, zebras at crossings
        int yel = Cl.H("c9a227"), zw = Cl.H("d6d3ca");
        AlongEdges(1, r => r.car && r.lines, (r, x, y, dx, dy, k) =>
        {
            int cx = (int)x, cy = (int)y;
            if (!In(cx, cy) || NEARNODE[I(cx, cy)] || K[I(cx, cy)] != ROAD || (k / 6) % 3 == 0) return;
            im.Put((int)Math.Round(x - dy * 1.5), (int)Math.Round(y + dx * 1.5), yel);
            im.Put((int)Math.Round(x + dy * 1.5), (int)Math.Round(y - dx * 1.5), yel);
        });
        foreach (var e in edges)
        {
            var r = roads[e[2]];
            if (!r.car) continue;
            for (int end = 0; end < 2; end++)
            {
                var n = nodes[e[end]]; var o = nodes[e[1 - end]];
                if (n.r <= 0) continue;
                double dx = o.x - n.x, dy = o.y - n.y, len = Math.Sqrt(dx * dx + dy * dy);
                if (len < n.r + 20) continue;
                dx /= len; dy /= len;
                double zx = n.x + dx * (n.r + 4), zy = n.y + dy * (n.r + 4);
                for (double off = -r.w / 2.0 + 4; off <= r.w / 2.0 - 4; off += 6)
                    for (int l = 0; l < 9; l++) for (int th = 0; th < 3; th++)
                        {
                            int px = (int)Math.Round(zx - dy * (off + th) + dx * l), py = (int)Math.Round(zy + dx * (off + th) + dy * l);
                            if (In(px, py) && K[I(px, py)] == ROAD) im.Set(px, py, Cl.A(zw, 200));
                        }
            }
        }
        // trees: park, boulevard sidewalks, courtyards
        for (int n = 0; n < 4000; n++)
        {
            int x = 10 + rnd.Next(W - 20), y = 10 + rnd.Next(H - 20);
            int i = I(x, y);
            if (K[i] == PARK && !NearSolid(x, y, 13) && rnd.Next(3) == 0) Tree(im, x, y, 8 + rnd.Next(4));
            else if (K[i] == YARD && rnd.Next(25) == 0 && !NearSolid(x, y, 10)) Tree(im, x, y, 6 + rnd.Next(3));
        }
        AlongEdges(64, r => r.trees, (r, x, y, dx, dy, k) =>
        {
            // at the curb, so the middle of the sidewalk stays free for walkers
            double off = (r.w / 2.0 + 3) * (k % 2 == 0 ? 1 : -1);
            int tx = (int)Math.Round(x - dy * off), ty = (int)Math.Round(y + dx * off);
            if (In(tx, ty) && K[I(tx, ty)] == WALK && !NearSolid(tx, ty, 12) && !nodes.Any(nd => nd.r > 0 && (nd.x - tx) * (nd.x - tx) + (nd.y - ty) * (nd.y - ty) < (nd.r + SW + 18) * (nd.r + SW + 18))) Tree(im, tx, ty, 6); // corners stay clear for walkers turning
        });
        // benches along park paths
        AlongEdges(70, r => r.path, (r, x, y, dx, dy, k) =>
        {
            int bx = (int)Math.Round(x - dy * 9), by = (int)Math.Round(y + dx * 9);
            if (!In(bx, by) || K[I(bx, by)] != PARK || NearSolid(bx, by, 4)) return;
            bool vert = Math.Abs(dy) > Math.Abs(dx);
            int w = vert ? 4 : 12, h = vert ? 12 : 4;
            im.Fill(bx + 2, by + 2, w, h, Cl.A(Cl.H("000000"), 90)); im.Fill(bx, by, w, h, Cl.H("7a5236"));
        });
        // street lamps
        AlongEdges(110, r => r.car, (r, x, y, dx, dy, k) =>
        {
            double off = (r.w / 2.0 + 3) * (k % 2 == 0 ? 1 : -1);
            int lx = (int)Math.Round(x - dy * off), ly = (int)Math.Round(y + dx * off);
            if (In(lx, ly) && K[I(lx, ly)] == WALK && !NearSolid(lx, ly, 8)) Lamp(im, lx, ly);
        });
        // landmark decorations
        foreach (var m in marks)
        {
            var mm = m;
            if (m.roof == "club")
            {
                int neon = Cl.H("f6e2a8");
                post.Add(() =>
                {
                    for (int x = mm.x0 + 5; x <= mm.x1 - 5; x++) for (int y = mm.y0 + 5; y <= mm.y1 - 5; y++)
                            if ((x == mm.x0 + 5 || x == mm.x1 - 5 || y == mm.y0 + 5 || y == mm.y1 - 5) && In(x, y) && K[I(x, y)] == BUILD) im.Put(x, y, neon);
                });
            }
            if (m.icon != null) post.Add(() => Signs.Plate(im, mm.rx, mm.ry, mm.icon, mm.frame));
            post.Add(() => Signs.Door(im, mm.dx, mm.dy));
        }
        if (debug)
        {
            foreach (var m in marks)
            {
                for (int x = m.x0; x <= m.x1; x++) { im.Put(x, m.y0, Cl.H("00ff66")); im.Put(x, m.y1, Cl.H("00ff66")); }
                for (int y = m.y0; y <= m.y1; y++) { im.Put(m.x0, y, Cl.H("00ff66")); im.Put(m.x1, y, Cl.H("00ff66")); }
            }
            foreach (var n in nodes) im.Fill((int)n.x - 2, (int)n.y - 2, 5, 5, n.r > 0 ? Cl.H("ff00ff") : Cl.H("00ffff"));
            for (int y = 0; y < H; y++) for (int x = 0; x < W; x++)
                    if (x % 100 == 0 || y % 100 == 0) im.Set(x, y, Cl.A(x % 500 == 0 || y % 500 == 0 ? Cl.H("ff3030") : Cl.H("ffffff"), 140));
        }
        im.Grade(0.55, 0.42);
        foreach (var a in post) a();
        post.Clear();
        return im;
    }

    // landmark door: from the middle of the chosen side walk outwards to the first walkable pixel
    static void PlaceMarks()
    {
        foreach (var m in marks)
        {
            int cx = (m.x0 + m.x1) / 2, cy = (m.y0 + m.y1) / 2;
            int sx = 0, sy = 0, x = cx, y = cy;
            if (m.door == 'S') { sy = 1; y = m.y1; } else if (m.door == 'N') { sy = -1; y = m.y0; } else if (m.door == 'E') { sx = 1; x = m.x1; } else { sx = -1; x = m.x0; }
            for (int k = 0; k < 80 && In(x, y); k++)
            {
                byte kk = K[I(x, y)];
                if (kk == WALK || kk == PLAZA || kk == ROAD || kk == PARK || kk == PATH) break;
                x += sx; y += sy;
            }
            m.dx = x + sx * 3; m.dy = y + sy * 3;
            m.rx = cx; m.ry = cy;
        }
    }

    static string F(double v) { return Math.Round(v, 1).ToString(CultureInfo.InvariantCulture); }

    static bool Solid(int i) { byte k = K[i]; return k == BUILD || k == YARD || k == WATER || SOLIDX[i]; }

    public static string Export(string outDir, bool debug)
    {
        Build(debug);
        PlaceMarks();
        var im = Build(debug); // second pass draws doors and plates at the computed spots
        im.Save(Path.Combine(outDir, debug ? "city_debug.png" : "map_base.png"));
        if (debug) return "debug nodes " + nodes.Count + " edges " + edges.Count;

        int gw = W / CELL, gh = H / CELL;
        var bits = new byte[(gw * gh + 7) / 8];
        for (int cy = 0; cy < gh; cy++) for (int cx = 0; cx < gw; cx++)
            {
                int s = 0;
                for (int y = 0; y < CELL; y++) for (int x = 0; x < CELL; x++) if (Solid(I(cx * CELL + x, cy * CELL + y))) s++;
                if (s * 2 > CELL * CELL) { int b = cy * gw + cx; bits[b >> 3] |= (byte)(1 << (b & 7)); }
            }
        var sb = new StringBuilder();
        sb.Append("{\"w\":").Append(W).Append(",\"h\":").Append(H).Append(",\"cell\":").Append(CELL).Append(",\"sw\":").Append(SW);
        sb.Append(",\"grid\":\"").Append(Convert.ToBase64String(bits)).Append('"');
        sb.Append(",\"nodes\":[").Append(string.Join(",", nodes.Select(n => "[" + F(n.x) + "," + F(n.y) + "," + F(n.r) + "]"))).Append(']'); // invariant: this PC writes 599,5
        sb.Append(",\"edges\":[").Append(string.Join(",", edges.Select(e => "[" + e[0] + "," + e[1] + "," + F(roads[e[2]].w / 2.0) + "," + e[3] + "]"))).Append(']');
        sb.Append(",\"marks\":{").Append(string.Join(",", marks.Select(m => "\"" + m.id + "\":[" + m.dx + "," + m.dy + "," + m.rx + "," + m.ry + "]"))).Append('}');
        sb.Append('}');
        File.WriteAllText(Path.Combine(outDir, "city.json"), sb.ToString());
        return "nodes " + nodes.Count + " edges " + edges.Count + " marks " + string.Join(" ", marks.Select(m => m.id + "@" + m.dx + "," + m.dy));
    }

    // every building the game needs: shops, services, NPC homes and the 12 Gang Wars objects
    public static void Layout()
    {
        marks.Clear();
        // the museum in the park is the arena
        AddMark("arena", 388, 296, 488, 410, "glass", null, null, 'N');
        // shops facing the boulevard
        AddMark("zbrane", 634, 530, 688, 582, "gravel", "pistol", "c9c4b8", 'N');
        AddMark("oblecenie", 694, 532, 748, 584, "tar", "shirt", "c9c4b8", 'N');
        AddMark("sperky", 754, 534, 808, 586, "brick", "diamond", "c9c4b8", 'N');
        AddMark("tetovanie", 524, 522, 580, 572, "gravel", "needle", "c9c4b8", 'N');
        AddMark("posilnovna", 872, 82, 962, 142, "metal", "dumbbell", "c9a24a", 'W');
        AddMark("pravnicka", 970, 300, 1054, 380, "white", "scales", "c9a24a", 'E');
        AddMark("lekarka", 872, 730, 960, 790, "white", null, null, 'N');
        AddMark("mechanik", 872, 632, 952, 680, "metal", "wrench", "c9a24a", 'S');
        AddMark("diler", 100, 428, 160, 500, "tar", null, null, 'W');
        AddMark("kladivo", 100, 730, 180, 780, "tar", null, null, 'W');
        // Gang Wars: 5 corners, 3 garages, 2 warehouses, 2 clubs
        AddMark("corner1", 110, 82, 170, 140, "brick", null, null, 'N');
        AddMark("corner2", 230, 470, 300, 528, "tar", null, null, 'S');
        AddMark("corner3", 280, 730, 380, 790, "slate", null, null, 'N');
        AddMark("corner4", 430, 916, 500, 958, "brick", null, null, 'N');
        AddMark("corner5", 1116, 300, 1180, 360, "tar", null, null, 'W');
        AddMark("garaz1", 872, 530, 962, 580, "metal", null, null, 'N');
        AddMark("garaz2", 100, 590, 180, 670, "metal", null, null, 'W');
        AddMark("garaz3", 862, 916, 952, 958, "metal", null, null, 'N');
        AddMark("sklad1", 1116, 730, 1190, 820, "metal", null, null, 'W');
        AddMark("sklad2", 1116, 82, 1190, 170, "metal", null, null, 'W');
        AddMark("klub1", 440, 730, 580, 800, "club", null, null, 'N');
        AddMark("klub2", 980, 730, 1066, 820, "club", null, null, 'N');
    }

    public static void AddMark(string id, int x0, int y0, int x1, int y1, string roof, string icon, string frame, char door)
    {
        marks.Add(new Mark { id = id, x0 = x0, y0 = y0, x1 = x1, y1 = y1, roof = roof, icon = icon, frame = frame == null ? 0 : Cl.H(frame), door = door });
    }
}
