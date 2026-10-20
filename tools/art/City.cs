using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

// Mesto 1, inspired by Frankfurt: a river in the south, a half-ring park around the old town,
// diagonal and curved streets. Everything is generated from the street network below.
// Outputs: map_base.png (pixel art), city.json (collision grid, street graph for cars/walkers, landmarks).
public static class City
{
    public const int W = 1600, H = 1280, SW = 14, CELL = 4;
    // ground kinds
    const byte LAND = 0, WATER = 1, PARK = 2, WALK = 3, PLAZA = 4, ROAD = 5, BUILD = 6, YARD = 7;

    class Road { public string name; public double[][] pts; public int w; public bool car; public bool lines; public bool trees; public List<double[]> line = new List<double[]>(); }
    public class Mark { public string id; public int x0, y0, x1, y1; public string roof; public string icon; public int frame; public char door; public int dx, dy, rx, ry; public int lot; }

    static Random rnd;
    static byte[] K;
    static short[] RID;       // car road claiming a road pixel
    static bool[] JUNC, BRIDGE, SOLIDX;
    static int[] LOT;         // building lot id
    static List<Road> roads = new List<Road>();
    static List<int> lotRoof = new List<int>(), lotH = new List<int>();
    static List<string> lotKind = new List<string>();
    public static List<Mark> marks = new List<Mark>();

    static int I(int x, int y) { return y * W + x; }
    static bool In(int x, int y) { return x >= 0 && y >= 0 && x < W && y < H; }

    // ------------------------------------------------------------ geometry
    static double[] P(double x, double y) { return new[] { x, y }; }

    static List<double[]> CatmullRom(double[][] p, double step)
    {
        var o = new List<double[]>();
        for (int i = 0; i < p.Length - 1; i++)
        {
            var p0 = p[Math.Max(0, i - 1)]; var p1 = p[i]; var p2 = p[i + 1]; var p3 = p[Math.Min(p.Length - 1, i + 2)];
            double len = Math.Sqrt((p2[0] - p1[0]) * (p2[0] - p1[0]) + (p2[1] - p1[1]) * (p2[1] - p1[1]));
            int n = Math.Max(1, (int)(len / step));
            for (int k = 0; k < n; k++)
            {
                double t = k / (double)n, t2 = t * t, t3 = t2 * t;
                double x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
                double y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
                o.Add(new[] { x, y });
            }
        }
        o.Add(p[p.Length - 1]);
        return o;
    }

    static double SegDist(double px, double py, double ax, double ay, double bx, double by, out double t)
    {
        double vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
        t = l2 == 0 ? 0 : Math.Max(0, Math.Min(1, ((px - ax) * vx + (py - ay) * vy) / l2));
        double qx = ax + vx * t - px, qy = ay + vy * t - py;
        return Math.Sqrt(qx * qx + qy * qy);
    }

    // river centre line (y for a given x)
    static double[][] riverPts = { P(-40, 1016), P(0, 1010), P(320, 972), P(660, 1020), P(960, 986), P(1260, 962), P(1600, 996), P(1640, 1000) };
    static double[] riverY;
    const int RIVER_HW = 48;
    // ring park: an ellipse around the old town, only its northern half
    const double RCX = 870, RCY = 930, RRX = 560, RRY = 600;
    static double RingR(double x, double y) { double dx = (x - RCX) / RRX, dy = (y - RCY) / RRY; return Math.Sqrt(dx * dx + dy * dy); }

    static void AddRoad(string name, int w, bool car, bool lines, bool trees, params double[][] pts)
    {
        roads.Add(new Road { name = name, w = w, car = car, lines = lines, trees = trees, pts = pts });
    }

    static void Network()
    {
        roads.Clear();
        var north = new List<double[]>(); var south = new List<double[]>();
        for (int x = -40; x <= 1640; x += 80) { north.Add(P(x, RiverAt(x) - 80)); south.Add(P(x, RiverAt(x) + 82)); }
        AddRoad("Nábrežie", 40, true, true, true, north.ToArray());
        AddRoad("Južné nábrežie", 36, true, false, true, south.ToArray());
        var ring = new List<double[]>();
        for (int a = 180; a <= 360; a += 10) { double r = a * Math.PI / 180; ring.Add(P(RCX + Math.Cos(r) * 630, RCY + Math.Sin(r) * 672)); }
        AddRoad("Okružná", 44, true, true, false, ring.ToArray());
        AddRoad("Cisárska", 46, true, true, false, P(-40, 780), P(40, 770), P(300, 720), P(520, 650), P(700, 600));
        AddRoad("Mostová", 44, true, true, false, P(760, 620), P(745, 720), P(722, 830), P(707, 905), P(706, 925));
        AddRoad("Starý most", 44, true, true, false, P(706, 905), P(708, 1000), P(712, 1092));
        AddRoad("Berlínska", 42, true, true, false, P(250, 830), P(380, 805), P(600, 772), P(880, 760), P(1150, 774), P(1370, 800), P(1490, 820));
        AddRoad("Operná", 44, true, true, true, P(745, 530), P(690, 420), P(640, 300), P(612, 170), P(600, 0), P(598, -40));
        AddRoad("Bockenheimská", 42, true, true, false, P(-40, 245), P(0, 240), P(300, 214), P(612, 172), P(900, 150), P(1200, 176), P(1600, 150), P(1640, 148));
        AddRoad("Bankový bulvár", 44, true, true, true, P(138, -40), P(140, 0), P(150, 250), P(162, 500), P(172, 760));
        AddRoad("Mainzerská", 38, true, false, false, P(-40, 466), P(0, 468), P(162, 480), P(300, 492), P(400, 500));
        AddRoad("Moselská", 34, true, false, false, P(60, 470), P(80, 620), P(90, 770), P(96, 930));
        AddRoad("Taunuská", 32, true, false, false, P(90, 860), P(180, 870), P(260, 880));
        AddRoad("Hanauská", 44, true, true, false, P(1380, 560), P(1480, 572), P(1600, 590), P(1640, 594));
        AddRoad("Prístavná", 40, true, true, false, P(1480, -40), P(1480, 0), P(1484, 160), P(1492, 400), P(1500, 650), P(1508, 900), P(1508, 930));
        AddRoad("Konštábelská", 36, true, false, false, P(1150, 0), P(1150, 176), P(1180, 330), P(1190, 450), P(1160, 560));
        AddRoad("Krčmová", 40, true, true, false, P(712, 1090), P(730, 1180), P(745, 1280), P(746, 1320));
        AddRoad("Švajčiarska", 36, true, false, true, P(-40, 1196), P(0, 1194), P(300, 1186), P(500, 1172), P(730, 1180), P(1000, 1192), P(1300, 1176), P(1600, 1186), P(1640, 1186));
        AddRoad("Lodná", 32, true, false, false, P(330, 1066), P(312, 1186), P(300, 1280), P(300, 1320));
        AddRoad("Dolná", 32, true, false, false, P(1092, 1060), P(1100, 1186), P(1118, 1280), P(1120, 1320));
        // pedestrian: Zeil, the footbridge, old-town lanes
        AddRoad("Zeil", 46, false, false, true, P(820, 572), P(1000, 562), P(1150, 560), P(1262, 556), P(1390, 560));
        AddRoad("Lávka", 24, false, false, false, P(1088, 888), P(1090, 975), P(1092, 1062));
        AddRoad("Ulička A", 20, false, false, false, P(600, 680), P(650, 760), P(640, 860), P(650, 912));
        AddRoad("Ulička B", 20, false, false, false, P(745, 830), P(820, 800), P(900, 838), P(1000, 828), P(1080, 862), P(1100, 912));
        AddRoad("Ulička C", 20, false, false, false, P(880, 640), P(940, 690), P(960, 772));
        AddRoad("Ulička D", 20, false, false, false, P(1080, 640), P(1150, 700), P(1240, 722), P(1300, 790));
        AddRoad("Ulička E", 20, false, false, false, P(480, 560), P(560, 600), P(600, 680));
        AddRoad("Ulička F", 20, false, false, false, P(1000, 562), P(1020, 650), P(1080, 640));
        foreach (var r in roads) r.line = CatmullRom(r.pts, 3);
    }

    static double RiverAt(double x)
    {
        int xi = (int)Math.Round(Math.Max(0, Math.Min(W - 1, x)));
        return riverY[xi];
    }

    // ------------------------------------------------------------ masks
    static void Masks()
    {
        K = new byte[W * H]; RID = new short[W * H]; JUNC = new bool[W * H]; BRIDGE = new bool[W * H]; SOLIDX = new bool[W * H]; LOT = new int[W * H];
        for (int i = 0; i < RID.Length; i++) { RID[i] = -1; LOT[i] = -1; }
        // river
        riverY = new double[W];
        var rl = CatmullRom(riverPts, 2);
        for (int x = 0; x < W; x++)
        {
            double best = 1e9, by = 0;
            foreach (var p in rl) { double d = Math.Abs(p[0] - x); if (d < best) { best = d; by = p[1]; } }
            riverY[x] = by;
        }
        Network();
        for (int y = 0; y < H; y++) for (int x = 0; x < W; x++)
            {
                if (Math.Abs(y - riverY[x]) <= RIVER_HW) K[I(x, y)] = WATER;
                else
                {
                    double r = RingR(x, y);
                    if (y < riverY[x] - 100 && r > 0.93 && r < 1.07) K[I(x, y)] = PARK;
                }
            }
        // plazas
        Blob(770, 585, 92, 64, PLAZA); Blob(612, 172, 62, 50, PLAZA);
        // streets
        var rank = new byte[] { 0, 0, 1, 2, 3, 4, 0, 0 }; // land, water, park, walk, plaza, road
        for (int ri = 0; ri < roads.Count; ri++)
        {
            var r = roads[ri];
            double hw = r.w / 2.0, ow = r.car ? hw + SW : hw; // pedestrian streets are paved wall to wall
            for (int s = 0; s < r.line.Count - 1; s++)
            {
                var a = r.line[s]; var b = r.line[s + 1];
                int x0 = (int)Math.Floor(Math.Min(a[0], b[0]) - ow - 1), x1 = (int)Math.Ceiling(Math.Max(a[0], b[0]) + ow + 1);
                int y0 = (int)Math.Floor(Math.Min(a[1], b[1]) - ow - 1), y1 = (int)Math.Ceiling(Math.Max(a[1], b[1]) + ow + 1);
                for (int y = Math.Max(0, y0); y <= Math.Min(H - 1, y1); y++)
                    for (int x = Math.Max(0, x0); x <= Math.Min(W - 1, x1); x++)
                    {
                        double t; double d = SegDist(x + 0.5, y + 0.5, a[0], a[1], b[0], b[1], out t);
                        if (d > ow) continue;
                        int i = I(x, y);
                        byte want = d <= hw ? (r.car ? ROAD : PLAZA) : WALK;
                        if (K[i] == WATER && want != WALK) BRIDGE[i] = true;
                        if (K[i] == WATER && want == WALK) { BRIDGE[i] = true; }
                        byte cur = K[i];
                        int cr = cur == WATER ? 0 : rank[cur];
                        if (rank[want] > cr || cur == WATER) K[i] = want;
                        if (want == ROAD && r.car)
                        {
                            if (RID[i] >= 0 && RID[i] != ri) JUNC[i] = true;
                            else RID[i] = (short)ri;
                        }
                    }
            }
        }
        // grow junction zones a little so markings stop before crossings
        var j2 = (bool[])JUNC.Clone();
        for (int y = 2; y < H - 2; y++) for (int x = 2; x < W - 2; x++) if (JUNC[I(x, y)])
                    for (int dy = -6; dy <= 6; dy++) for (int dx = -6; dx <= 6; dx++) { int xx = x + dx, yy = y + dy; if (In(xx, yy) && K[I(xx, yy)] == ROAD) j2[I(xx, yy)] = true; }
        JUNC = j2;
    }

    static void Blob(int cx, int cy, int rx, int ry, byte kind)
    {
        for (int y = cy - ry; y <= cy + ry; y++) for (int x = cx - rx; x <= cx + rx; x++)
            {
                if (!In(x, y)) continue;
                double dx = (x - cx) / (double)rx, dy = (y - cy) / (double)ry;
                if (dx * dx + dy * dy <= 1) K[I(x, y)] = kind;
            }
    }

    // ------------------------------------------------------------ blocks and lots
    static string District(int x, int y)
    {
        if (y > riverY[Math.Min(W - 1, Math.Max(0, x))]) return "south";
        double r = RingR(x, y);
        if (r < 0.93) return x > 980 && y < 720 ? "zeil" : "old";
        if (y < 200) return "north";
        if (x < 330 && y > 640) return "station";
        if (x < 420) return "banks";
        if (x > 1380) return "east";
        return "north";
    }

    static string[] RoofsFor(string d)
    {
        switch (d)
        {
            case "old": return new[] { "brick", "brick", "tar", "slate", "gravel" };
            case "zeil": return new[] { "tar", "gravel", "metal", "white", "brick" };
            case "banks": return new[] { "glass", "glass", "metal", "white", "tar" };
            case "station": return new[] { "tar", "tar", "gravel", "brick", "metal" };
            case "east": return new[] { "metal", "metal", "tar", "gravel" };
            case "south": return new[] { "brick", "slate", "tar", "gravel" };
            default: return new[] { "slate", "tar", "white", "gravel", "brick" };
        }
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
        // landmarks claim their rectangles first
        foreach (var m in marks)
        {
            m.lot = lotRoof.Count;
            lotRoof.Add(RoofColor(m.roof)); lotH.Add(m.roof == "glass" ? 12 : 7); lotKind.Add(m.roof);
        }
        for (int sy = 0; sy < H; sy++) for (int sx = 0; sx < W; sx++)
            {
                int si = I(sx, sy);
                if (K[si] != LAND || seen[si]) continue;
                // flood fill one block
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
                if (n < 220) { for (int k = 0; k < n; k++) K[I(qx[k], qy[k])] = WALK; continue; } // slivers become pavement
                string dist = District((bx0 + bx1) / 2, (by0 + by1) / 2);
                var roofs = RoofsFor(dist);
                int spacing = dist == "banks" ? 80 : dist == "old" ? 52 : 64;
                // seeds on a jittered grid, kept only where the block is
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
                    lotRoof.Add(RoofColor(roof)); lotH.Add(roof == "glass" ? 10 + rnd.Next(5) : 4 + rnd.Next(5)); lotKind.Add(roof);
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
                // inner lots that never touch the street become courtyards
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
                    if (!touches.Contains(s[2]) && rnd.Next(100) < 60) lotKind[s[2]] = "yard";
                for (int k = 0; k < n; k++) { int i = I(qx[k], qy[k]); if (lotKind[LOT[i]] == "yard") K[i] = YARD; }
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

    // ------------------------------------------------------------ the map
    public static Img Build(bool debug)
    {
        rnd = new Random(23);
        Masks();
        Lots();
        var im = new Img(W, H);
        int sidewalk = Cl.H("8d897f"), asphalt = Cl.H("393a3f"), land = Cl.H("57534b"), grass = Cl.H("4b6a3c"), water = Cl.H("2a4656"), plaza = Cl.H("9a9488");
        for (int y = 0; y < H; y++) for (int x = 0; x < W; x++)
            {
                int i = I(x, y);
                switch (K[i])
                {
                    case WATER: Noise(im, x, y, water, 0.06); break;
                    case PARK: Noise(im, x, y, grass, 0.14); if (rnd.Next(60) == 0) im.Put(x, y, Cl.H("6f8f4f")); break;
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
        for (int n = 0; n < 900; n++)
        {
            int x = rnd.Next(W), y = rnd.Next(H);
            if (K[I(x, y)] != ROAD) continue;
            if (n % 3 == 0) { for (int k = 0; k < 10 + rnd.Next(14); k++) { if (In(x, y) && K[I(x, y)] == ROAD) im.Put(x, y, Cl.H("232428")); x += rnd.Next(3) - 1; y += rnd.Next(3) - 1; } }
            else im.Ellipse(x, y, 3 + rnd.Next(6), 2 + rnd.Next(4), Cl.A(rnd.Next(2) == 0 ? Cl.H("2e2f33") : Cl.H("45464b"), 70));
        }
        // water: ripples and stone banks
        for (int n = 0; n < 1400; n++)
        {
            int x = rnd.Next(W), y = rnd.Next(H);
            if (K[I(x, y)] != WATER || BRIDGE[I(x, y)]) continue;
            int len = 3 + rnd.Next(6);
            for (int k = 0; k < len; k++) if (In(x + k, y) && K[I(x + k, y)] == WATER) im.Set(x + k, y, Cl.A(Cl.H("6f93a6"), 90));
        }
        // curbs, banks, parapets, bridge railings
        for (int y = 1; y < H - 1; y++) for (int x = 1; x < W - 1; x++)
            {
                int i = I(x, y); byte k = K[i];
                byte up = K[I(x, y - 1)], dn = K[I(x, y + 1)], lf = K[I(x - 1, y)], rt = K[I(x + 1, y)];
                if (k == WALK && (up == ROAD || dn == ROAD || lf == ROAD || rt == ROAD)) im.Put(x, y, Cl.H("b3afa4"));
                if (k == ROAD && (up == WALK || dn == WALK || lf == WALK || rt == WALK)) im.Put(x, y, Cl.H("26272b"));
                if (k == WATER && !BRIDGE[i] && (up != WATER || dn != WATER || lf != WATER || rt != WATER)) { im.Put(x, y, Cl.H("6b675e")); }
                if (BRIDGE[i] && k == WALK && (up == WATER || dn == WATER || lf == WATER || rt == WATER) && !(BRIDGE[I(x, y - 1)] && BRIDGE[I(x, y + 1)] && BRIDGE[I(x - 1, y)] && BRIDGE[I(x + 1, y)]))
                {
                    im.Put(x, y, Cl.H("2a2b30")); SOLIDX[i] = true;
                }
                if (k == BUILD || k == YARD)
                {
                    int lot = LOT[i];
                    bool eu = K[I(x, y - 1)] != BUILD || LOT[I(x, y - 1)] != lot, el = K[I(x - 1, y)] != BUILD || LOT[I(x - 1, y)] != lot;
                    bool ed = K[I(x, y + 1)] != BUILD || LOT[I(x, y + 1)] != lot, er = K[I(x + 1, y)] != BUILD || LOT[I(x + 1, y)] != lot;
                    if (k == BUILD)
                    {
                        int c = lotRoof[lot];
                        if (eu || el) im.Put(x, y, Cl.Lt(c, 0.28));
                        else if (ed || er) im.Put(x, y, Cl.Dk(c, 0.4));
                    }
                }
            }
        // shadows of buildings on the ground
        for (int y = 0; y < H; y++) for (int x = 0; x < W; x++)
            {
                int i = I(x, y);
                if (K[i] == BUILD) continue;
                for (int s = 1; s <= 12; s++)
                {
                    int xx = x - s, yy = y - s;
                    if (!In(xx, yy)) break;
                    int j = I(xx, yy);
                    if (K[j] == BUILD) { if (lotH[LOT[j]] >= s) im.Set(x, y, Cl.A(Cl.H("000000"), 95)); break; }
                }
            }
        // roof clutter
        for (int n = 0; n < 2600; n++)
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
        // markings: centre lines and zebra crossings
        int yel = Cl.H("c9a227"), zw = Cl.H("d6d3ca");
        for (int ri = 0; ri < roads.Count; ri++)
        {
            var r = roads[ri];
            if (!r.car) continue;
            bool wasJ = false; double acc = 0;
            for (int s = 1; s < r.line.Count; s++)
            {
                var a = r.line[s - 1]; var b = r.line[s];
                double dx = b[0] - a[0], dy = b[1] - a[1], len = Math.Sqrt(dx * dx + dy * dy);
                if (len == 0) continue;
                double nx = -dy / len, ny = dx / len;
                int cx = (int)b[0], cy = (int)b[1];
                bool j = In(cx, cy) && JUNC[I(cx, cy)];
                acc += len;
                if (r.lines && !j && In(cx, cy) && K[I(cx, cy)] == ROAD && (int)(acc / 6) % 3 != 0)
                {
                    im.Put((int)Math.Round(b[0] + nx * 1.5), (int)Math.Round(b[1] + ny * 1.5), yel);
                    im.Put((int)Math.Round(b[0] - nx * 1.5), (int)Math.Round(b[1] - ny * 1.5), yel);
                }
                if (j != wasJ && r.w >= 36)
                {
                    // zebra just outside the junction
                    double sx = j ? -dx / len : dx / len, sy = j ? -dy / len : dy / len;
                    double zx = b[0] + sx * 9, zy = b[1] + sy * 9;
                    for (double o = -r.w / 2.0 + 4; o <= r.w / 2.0 - 4; o += 6)
                        for (int l = 0; l < 9; l++)
                            for (int th = 0; th < 3; th++)
                            {
                                int px = (int)Math.Round(zx + nx * (o + th) + sx * l), py = (int)Math.Round(zy + ny * (o + th) + sy * l);
                                if (In(px, py) && K[I(px, py)] == ROAD && !JUNC[I(px, py)]) im.Set(px, py, Cl.A(zw, 200));
                            }
                }
                wasJ = j;
            }
        }
        // trees: park, boulevards, yards
        for (int n = 0; n < 5000; n++)
        {
            int x = 20 + rnd.Next(W - 40), y = 20 + rnd.Next(H - 40);
            int i = I(x, y);
            if (K[i] == PARK)
            {
                double r = RingR(x, y);
                if (Math.Abs(r - 1.0) < 0.012) continue; // the footpath
                if (NearAny(x, y, 13)) continue;
                if (rnd.Next(4) == 0) Tree(im, x, y, 8 + rnd.Next(4));
            }
            else if (K[i] == YARD && rnd.Next(30) == 0 && !NearAny(x, y, 10)) Tree(im, x, y, 6 + rnd.Next(3));
        }
        // park footpath
        for (int y = 0; y < H; y++) for (int x = 0; x < W; x++)
                if (K[I(x, y)] == PARK && Math.Abs(RingR(x, y) - 1.0) < 0.01) { Noise(im, x, y, Cl.H("9e9580"), 0.16); SOLIDX[I(x, y)] = false; }
        foreach (var r in roads)
        {
            if (!r.trees) continue;
            double acc = 0, side = 1;
            for (int s = 1; s < r.line.Count; s++)
            {
                var a = r.line[s - 1]; var b = r.line[s];
                double dx = b[0] - a[0], dy = b[1] - a[1], len = Math.Sqrt(dx * dx + dy * dy);
                if (len == 0) continue;
                acc += len;
                if (acc < 74) continue;
                acc = 0; side = -side;
                double off = r.w / 2.0 + SW / 2.0;
                int tx = (int)Math.Round(b[0] - dy / len * off * side), ty = (int)Math.Round(b[1] + dx / len * off * side);
                if (In(tx, ty) && K[I(tx, ty)] == WALK && !NearAny(tx, ty, 12) && !NearKind(tx, ty, 6, ROAD) ) Tree(im, tx, ty, 6);
            }
        }
        // street lamps
        foreach (var r in roads)
        {
            double acc = 0, side = 1;
            for (int s = 1; s < r.line.Count; s++)
            {
                var a = r.line[s - 1]; var b = r.line[s];
                double dx = b[0] - a[0], dy = b[1] - a[1], len = Math.Sqrt(dx * dx + dy * dy);
                if (len == 0) continue;
                acc += len;
                if (acc < 120) continue;
                acc = 0; side = -side;
                double off = r.w / 2.0 + 3;
                int lx = (int)Math.Round(b[0] - dy / len * off * side), ly = (int)Math.Round(b[1] + dx / len * off * side);
                if (In(lx, ly) && K[I(lx, ly)] == WALK) Lamp(im, lx, ly);
            }
        }
        // the river's piers in the harbour
        for (int px = 1380; px < 1600; px += 54)
        {
            int top = (int)riverY[px] - RIVER_HW;
            for (int y = top; y < top + 30; y++) for (int x = px; x < px + 10; x++)
                    if (In(x, y) && K[I(x, y)] == WATER) { im.Put(x, y, (y % 3 == 0) ? Cl.H("4a3a2a") : Cl.H("6b5238")); }
        }
        // landmark decorations
        foreach (var m in marks)
        {
            if (m.roof == "club")
            {
                int neon = Cl.H("f6e2a8");
                post.Add(() =>
                {
                    for (int x = m.x0 + 5; x <= m.x1 - 5; x++) for (int y = m.y0 + 5; y <= m.y1 - 5; y++)
                            if ((x == m.x0 + 5 || x == m.x1 - 5 || y == m.y0 + 5 || y == m.y1 - 5) && In(x, y) && K[I(x, y)] == BUILD) im.Put(x, y, neon);
                });
            }
            if (m.icon != null) { var mm = m; post.Add(() => Signs.Plate(im, mm.rx, mm.ry, mm.icon, mm.frame)); }
            { var mm = m; post.Add(() => Signs.Door(im, mm.dx, mm.dy)); }
        }
        if (debug)
            foreach (var m in marks)
            {
                for (int x = m.x0; x <= m.x1; x++) { im.Put(x, m.y0, Cl.H("00ff66")); im.Put(x, m.y1, Cl.H("00ff66")); }
                for (int y = m.y0; y <= m.y1; y++) { im.Put(m.x0, y, Cl.H("00ff66")); im.Put(m.x1, y, Cl.H("00ff66")); }
                im.Fill(m.dx - 3, m.dy - 3, 7, 7, Cl.H("ff00ff"));
            }
        if (debug)
            for (int y = 0; y < H; y++) for (int x = 0; x < W; x++)
                    if (x % 100 == 0 || y % 100 == 0) im.Set(x, y, Cl.A(x % 500 == 0 || y % 500 == 0 ? Cl.H("ff3030") : Cl.H("ffffff"), 140));
        im.Grade(0.55, 0.42);
        foreach (var a in post) a();
        post.Clear();
        return im;
    }

    static bool NearAny(int x, int y, int r)
    {
        for (int yy = y - r; yy <= y + r; yy += 3) for (int xx = x - r; xx <= x + r; xx += 3) if (In(xx, yy) && SOLIDX[I(xx, yy)]) return true;
        return false;
    }

    static bool NearKind(int x, int y, int r, byte k)
    {
        for (int yy = y - r; yy <= y + r; yy++) for (int xx = x - r; xx <= x + r; xx++) if (In(xx, yy) && K[I(xx, yy)] == k) return true;
        return false;
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
                if (kk == WALK || kk == PLAZA || kk == ROAD || kk == PARK) break;
                x += sx; y += sy;
            }
            m.dx = x + sx * 3; m.dy = y + sy * 3;
            m.rx = cx; m.ry = cy;
        }
    }

    static bool Solid(int i) { byte k = K[i]; return k == BUILD || k == YARD || (k == WATER && !BRIDGE[i]) || SOLIDX[i]; }

    public static string Export(string outDir, bool debug)
    {
        var im = Build(debug);
        PlaceMarks();
        im = Build(debug); // second pass draws doors/plates at the computed spots
        PlaceMarks();
        im.Save(Path.Combine(outDir, debug ? "city_debug.png" : "map_base.png"));
        if (debug)
            foreach (var m in marks)
            {
                for (int x = m.x0; x <= m.x1; x++) { im.Put(x, m.y0, Cl.H("00ff66")); im.Put(x, m.y1, Cl.H("00ff66")); }
                for (int y = m.y0; y <= m.y1; y++) { im.Put(m.x0, y, Cl.H("00ff66")); im.Put(m.x1, y, Cl.H("00ff66")); }
                im.Fill(m.dx - 3, m.dy - 3, 7, 7, Cl.H("ff00ff"));
            }
        if (debug) return "debug";

        // collision grid, CELL px per cell: solid when most of the cell is solid
        int gw = W / CELL, gh = H / CELL;
        var bits = new byte[(gw * gh + 7) / 8];
        for (int cy = 0; cy < gh; cy++) for (int cx = 0; cx < gw; cx++)
            {
                int s = 0;
                for (int y = 0; y < CELL; y++) for (int x = 0; x < CELL; x++) if (Solid(I(cx * CELL + x, cy * CELL + y))) s++;
                if (s * 2 > CELL * CELL) { int b = cy * gw + cx; bits[b >> 3] |= (byte)(1 << (b & 7)); }
            }

        // street graph: nodes every ~30 px along each street, plus links where streets meet
        var nodes = new List<double[]>(); var edges = new List<int[]>(); var nodeRoad = new List<int>(); var nodeHw = new List<int>();
        for (int ri = 0; ri < roads.Count; ri++)
        {
            var r = roads[ri]; int prev = -1; double acc = 1e9;
            for (int s = 0; s < r.line.Count; s++)
            {
                var p = r.line[s];
                if (s > 0) { var q = r.line[s - 1]; acc += Math.Sqrt((p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1])); }
                bool last = s == r.line.Count - 1;
                if (acc < 30 && !last) continue;
                if (p[0] < -10 || p[1] < -10 || p[0] > W + 10 || p[1] > H + 10) { prev = -1; acc = 0; continue; }
                acc = 0;
                nodes.Add(new[] { Math.Round(p[0]), Math.Round(p[1]) }); nodeRoad.Add(ri); nodeHw.Add(r.w / 2);
                int id = nodes.Count - 1;
                if (prev >= 0) edges.Add(new[] { prev, id, r.car ? 1 : 0 });
                prev = id;
            }
        }
        for (int a = 0; a < nodes.Count; a++) for (int b = a + 1; b < nodes.Count; b++)
            {
                if (nodeRoad[a] == nodeRoad[b]) continue;
                double dx = nodes[b][0] - nodes[a][0], dy = nodes[b][1] - nodes[a][1], d = Math.Sqrt(dx * dx + dy * dy);
                if (d > 34) continue;
                bool car = roads[nodeRoad[a]].car && roads[nodeRoad[b]].car, ok = true;
                for (double t = 0; t <= 1; t += 0.05)
                {
                    int x = (int)(nodes[a][0] + dx * t), y = (int)(nodes[a][1] + dy * t);
                    if (!In(x, y)) { ok = false; break; }
                    byte k = K[I(x, y)];
                    if (k != ROAD && k != PLAZA && k != WALK) { ok = false; break; }
                    if (k != ROAD) car = false;
                }
                if (ok) edges.Add(new[] { a, b, car ? 1 : 0 });
            }

        var sb = new StringBuilder();
        sb.Append("{\"w\":").Append(W).Append(",\"h\":").Append(H).Append(",\"cell\":").Append(CELL);
        sb.Append(",\"grid\":\"").Append(Convert.ToBase64String(bits)).Append('"');
        sb.Append(",\"nodes\":[").Append(string.Join(",", nodes.Select((n, i) => "[" + n[0] + "," + n[1] + "," + nodeHw[i] + "]"))).Append(']');
        sb.Append(",\"edges\":[").Append(string.Join(",", edges.Select(e => "[" + e[0] + "," + e[1] + "," + e[2] + "]"))).Append(']');
        sb.Append(",\"marks\":{").Append(string.Join(",", marks.Select(m => "\"" + m.id + "\":[" + m.dx + "," + m.dy + "," + m.rx + "," + m.ry + "]"))).Append('}');
        sb.Append('}');
        File.WriteAllText(Path.Combine(outDir, "city.json"), sb.ToString());
        return "nodes " + nodes.Count + " edges " + edges.Count + " marks " + string.Join(" ", marks.Select(m => m.id + "@" + m.dx + "," + m.dy));
    }

    // every building the game needs: shops, services, NPC homes and the 12 Gang Wars objects
    public static void Layout()
    {
        marks.Clear();
        // Zeil: the shopping street north side
        AddMark("zbrane", 790, 470, 858, 535, "gravel", "pistol", "c9c4b8", 'S');
        AddMark("oblecenie", 868, 470, 936, 535, "tar", "shirt", "c9c4b8", 'S');
        AddMark("sperky", 946, 470, 1014, 535, "brick", "diamond", "c9c4b8", 'S');
        AddMark("tetovanie", 1024, 470, 1092, 535, "gravel", "needle", "c9c4b8", 'S');
        AddMark("arena", 790, 615, 900, 700, "white", null, null, 'N');
        AddMark("posilnovna", 660, 205, 760, 262, "metal", "dumbbell", "c9a24a", 'N');
        AddMark("pravnicka", 200, 380, 300, 460, "white", "scales", "c9a24a", 'W');
        AddMark("lekarka", 480, 822, 600, 880, "white", null, null, 'S');
        AddMark("mechanik", 1400, 640, 1470, 720, "metal", "wrench", "c9a24a", 'E');
        AddMark("diler", 0, 640, 55, 720, "tar", null, null, 'E');
        AddMark("kladivo", 0, 780, 55, 860, "tar", null, null, 'E');
        // Gang Wars: 5 corners, 3 garages, 2 warehouses, 2 clubs
        AddMark("corner1", 900, 392, 970, 450, "brick", null, null, 'N');
        AddMark("corner2", 470, 700, 540, 758, "tar", null, null, 'S');
        AddMark("corner3", 950, 200, 1020, 250, "slate", null, null, 'N');
        AddMark("corner4", 400, 1120, 470, 1165, "brick", null, null, 'S');
        AddMark("corner5", 100, 640, 150, 700, "tar", null, null, 'W');
        AddMark("garaz1", 1400, 740, 1470, 800, "metal", "car", "c9c4b8", 'E');
        AddMark("garaz2", 190, 30, 280, 100, "metal", "car", "c9c4b8", 'W');
        AddMark("garaz3", 1160, 1110, 1260, 1165, "metal", "car", "c9c4b8", 'S');
        AddMark("sklad1", 1380, 1110, 1500, 1165, "metal", "crate", "b8322a", 'S');
        AddMark("sklad2", 10, 20, 110, 110, "metal", "crate", "b8322a", 'E');
        AddMark("klub1", 110, 775, 230, 840, "club", null, null, 'S');
        AddMark("klub2", 800, 1110, 920, 1165, "club", null, null, 'S');
    }

    public static void AddMark(string id, int x0, int y0, int x1, int y1, string roof, string icon, string frame, char door)
    {
        marks.Add(new Mark { id = id, x0 = x0, y0 = y0, x1 = x1, y1 = y1, roof = roof, icon = icon, frame = frame == null ? 0 : Cl.H(frame), door = door });
    }
}
