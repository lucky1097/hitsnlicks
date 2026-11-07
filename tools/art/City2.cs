using System;
using System.Collections.Generic;
using System.Linq;

// Mesto 2, after Prague's Old Town: the river in the north-west with the embankment, a bridge and a pier,
// the Parížska boulevard running down to the Old Town square, cobbled lanes for walkers only, and cars only on
// the edges, Parížska and Dlhá. Same pieces as Mesto 1 (straight street segments, exact street graph); City.Cur = 2.
public static partial class City
{
    static void Streets2()
    {
        // streets with cars: they run 40 px past the edge, so cars turn around out of sight
        Add("Nábrežie", 40, true, false, true, P(-40, 498), P(192, 363), P(363, 233), P(543, 113), P(705, -40));
        roads[roads.Count - 1].tram = true;
        Add("Čechov most", 34, true, true, false, P(363, 233), P(150, -40));
        Add("Parížska", 42, true, true, true, P(363, 233), P(640, 585));
        Add("17. novembra", 34, true, true, false, P(110, 411), P(110, 1000));
        Add("Široká", 30, true, false, false, P(110, 470), P(550, 470));
        Add("Bílkova", 30, true, false, false, P(439, 330), P(1240, 330));
        Add("Kaprova", 32, true, false, false, P(110, 690), P(470, 690), P(597, 530));
        Add("Dlhá", 32, true, false, false, P(640, 585), P(840, 585), P(1240, 310));
        Add("Revolučná", 40, true, true, false, P(1120, -40), P(1120, 1000));
        // cobbled lanes and the square: walkers only
        Add("Maiselova", 20, false, false, false, P(300, 281), P(300, 690));
        Add("Valentínska", 20, false, false, false, P(240, 690), P(240, 1000));
        Add("Žatecká", 20, false, false, false, P(300, 690), P(470, 840));
        Add("Karlova", 22, false, false, false, P(470, 840), P(-40, 925));
        Add("Železná", 20, false, false, false, P(470, 840), P(580, 810));
        Add("námestie", 16, false, false, false, P(580, 810), P(895, 845));
        Add("námestie", 16, false, false, false, P(640, 585), P(650, 895));
        Add("Melantrichova", 20, false, false, false, P(650, 895), P(632, 1000));
        Add("Celetná", 22, false, false, false, P(895, 845), P(1240, 890));
        Add("Dušná", 20, false, false, false, P(745, -40), P(760, 330), P(790, 585));
        Add("Kozia", 20, false, false, false, P(980, -40), P(980, 489));
        Add("Haštalská", 20, false, false, false, P(752, 170), P(1120, 170));
        Add("Vezenská", 20, false, false, false, P(612, 50), P(640, 330));
        Add("V Kolkovni", 20, false, false, false, P(526, 440), P(980, 440));
        // the pier where the boatman waits
        Add("mólo", 18, false, false, false, P(232, 333), P(185, 272));
        roads[roads.Count - 1].pier = true;
        // a gravel path through the walled garden (walkers only)
        Add("cesta", 10, false, false, false, P(190, 436), P(286, 342));
        roads[roads.Count - 1].path = true;
    }

    // the river (before the streets, so the bridge, the embankment and the pier lie over it)
    static readonly double[][] RIVER = { P(-60, -60), P(720, -60), P(650, -10), P(520, 80), P(340, 200), P(170, 330), P(0, 430), P(-60, 470) };
    // the Old Town square (after the streets: it takes land and sidewalks, never a car lane)
    static readonly double[][] SQUARE = { P(565, 620), P(880, 615), P(900, 880), P(580, 900) };
    const int PLAZA_X = 773, PLAZA_Y = 440, STATUE_X = 792, STATUE_Y = 457, MONUMENT_X = 775, MONUMENT_Y = 730;

    static void GroundBefore2() { PolyFill(RIVER, WATER, false); }

    static void GroundAfter2()
    {
        PolyFill(SQUARE, PLAZA, true);
        // the little square with the statue where Dušná meets V Kolkovni
        Blob(PLAZA_X, PLAZA_Y, 34, 26, PLAZA); // the statue stands in its corner, off the crossing
        // the walled garden: the block between the embankment, 17. novembra, Maiselova and Široká
        Flood(250, 400, LAND, PARK);
    }

    static bool InPoly(double[][] poly, double x, double y)
    {
        bool inside = false;
        for (int i = 0, j = poly.Length - 1; i < poly.Length; j = i++)
        {
            double xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
            if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
    }

    static void PolyFill(double[][] poly, byte kind, bool keepRoads)
    {
        for (int y = 0; y < H; y++) for (int x = 0; x < W; x++)
            {
                if (!InPoly(poly, x + 0.5, y + 0.5)) continue;
                int i = I(x, y);
                if (keepRoads && K[i] != LAND && K[i] != WALK) continue;
                K[i] = kind;
            }
    }

    static string[] RoofsFor2(int x, int y)
    {
        // Parížska: newer, bigger houses; everywhere else red clay tiles
        if (y < 470 && x > 430 && x < 800) return new[] { "slate", "tile", "white", "tile2" };
        if (x > 1120) return new[] { "tar", "gravel", "tile2" };
        return new[] { "tile", "tile", "tile2", "tile", "brick", "slate" };
    }

    // cobbles: rows of small stones, every other row shifted
    static void Cobble(Img im, int x, int y)
    {
        int c = Cl.H("8f887b");
        Noise(im, x, y, c, 0.1);
        int row = y / 4;
        if (y % 4 == 0 || (x + (row % 2) * 2) % 4 == 0) im.Set(x, y, Cl.A(Cl.Dk(c, 0.45), 85));
    }

    static void River2(Img im)
    {
        // the current: short light strokes along the river
        for (int n = 0; n < 900; n++)
        {
            int x = rnd.Next(W), y = rnd.Next(H);
            if (K[I(x, y)] != WATER) continue;
            int len = 4 + rnd.Next(8);
            for (int k = 0; k < len; k++)
            {
                int xx = x + k, yy = y - (int)Math.Round(k * 0.72);
                if (In(xx, yy) && K[I(xx, yy)] == WATER) im.Set(xx, yy, Cl.A(Cl.H("6f93a6"), 70));
            }
        }
        // boats: moored at the pier and along the bank, two out on the river
        Boat(im, 168, 300, 34, 9, Cl.H("d6d1c4"));
        Boat(im, 214, 262, 26, 8, Cl.H("6b4a32"));
        Boat(im, 120, 330, 30, 9, Cl.H("6b4a32"));
        Boat(im, 300, 180, 44, 12, Cl.H("c9c4b8"));
        Boat(im, 470, 60, 38, 10, Cl.H("d6d1c4"));
        Boat(im, 60, 250, 50, 13, Cl.H("3a3d44"));
    }

    // a hull along the river (direction 0.79, -0.61), pointed bow, dark gunwale and a cabin
    static void Boat(Img im, int cx, int cy, int len, int wid, int c)
    {
        double ux = 0.79, uy = -0.61, vx = 0.61, vy = 0.79;
        for (double t = -len / 2.0; t <= len / 2.0; t += 0.5)
        {
            double half = wid / 2.0 * (t > len / 2.0 - wid ? (len / 2.0 - t) / wid : 1);
            for (double s = -half; s <= half; s += 0.5)
            {
                int x = (int)Math.Round(cx + ux * t + vx * s), y = (int)Math.Round(cy + uy * t + vy * s);
                if (!In(x, y) || K[I(x, y)] != WATER) continue;
                im.Put(x + 3, y + 3, Cl.A(Cl.H("000000"), 60));
                bool edge = Math.Abs(s) > half - 1.2;
                bool cabin = t > -len / 4.0 && t < len / 8.0 && Math.Abs(s) < half - 2.5;
                im.Put(x, y, edge ? Cl.Dk(c, 0.45) : cabin ? Cl.Dk(c, 0.2) : c);
            }
        }
    }

    static void Decor2(Img im)
    {
        // tram rails in the middle of the embankment
        int steel = Cl.H("8a8a86");
        AlongEdges(1, r => r.tram, (r, x, y, dx, dy, k) =>
        {
            int cx = (int)x, cy = (int)y;
            if (!In(cx, cy) || NEARNODE[I(cx, cy)]) return;
            foreach (double off in new[] { -9.0, -5.0, 5.0, 9.0 })
            {
                int px = (int)Math.Round(x - dy * off), py = (int)Math.Round(y + dx * off);
                if (In(px, py) && K[I(px, py)] == ROAD) im.Set(px, py, Cl.A(steel, 170));
            }
        });
        // the pier: planks across and posts
        foreach (var r in roads.Where(rr => rr.pier))
        {
            var a = r.pts[0]; var b = r.pts[r.pts.Count - 1];
            for (int y = 0; y < H; y++) for (int x = 0; x < W; x++)
                {
                    double t; double d = SegDist(x + 0.5, y + 0.5, a[0], a[1], b[0], b[1], out t);
                    if (d > r.w / 2.0 || K[I(x, y)] != PLAZA) continue;
                    double along = t * Math.Sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
                    int c = Cl.H("6b4a32");
                    im.Put(x, y, ((int)along) % 4 == 0 ? Cl.Dk(c, 0.35) : d > r.w / 2.0 - 1.5 ? Cl.Dk(c, 0.25) : Cl.Lt(c, rnd.NextDouble() * 0.1));
                }
        }
        // the statue on its little square
        im.Ellipse(STATUE_X + 4, STATUE_Y + 4, 8, 7, Cl.A(Cl.H("000000"), 90));
        im.Fill(STATUE_X - 6, STATUE_Y - 6, 12, 12, Cl.H("8a857a"));
        im.Fill(STATUE_X - 6, STATUE_Y - 6, 12, 1, Cl.H("b3aea2"));
        im.Fill(STATUE_X - 2, STATUE_Y - 4, 5, 7, Cl.H("3c3f3b"));
        im.Fill(STATUE_X - 1, STATUE_Y - 6, 3, 3, Cl.H("4e524c"));
        for (int y = STATUE_Y - 6; y < STATUE_Y + 6; y++) for (int x = STATUE_X - 6; x < STATUE_X + 6; x++) SOLIDX[I(x, y)] = true;
        // the monument in the middle of the square: a stone ring with a dark bronze group
        im.Ellipse(MONUMENT_X + 5, MONUMENT_Y + 5, 24, 18, Cl.A(Cl.H("000000"), 90));
        im.Ellipse(MONUMENT_X, MONUMENT_Y, 24, 18, Cl.H("6b675e"));
        im.Ellipse(MONUMENT_X, MONUMENT_Y, 21, 15, Cl.H("8a857a"));
        for (int g = 0; g < 9; g++)
        {
            double a = g * 0.7, d = 4 + (g % 3) * 4;
            im.Ellipse(MONUMENT_X + Math.Cos(a) * d, MONUMENT_Y + Math.Sin(a) * d * 0.7, 3.2, 3.2, g % 2 == 0 ? Cl.H("3c4a42") : Cl.H("4d5d52"));
        }
        for (int y = MONUMENT_Y - 15; y <= MONUMENT_Y + 15; y++) for (int x = MONUMENT_X - 21; x <= MONUMENT_X + 21; x++)
                if ((x - MONUMENT_X) * (x - MONUMENT_X) / 441.0 + (y - MONUMENT_Y) * (y - MONUMENT_Y) / 225.0 <= 1) SOLIDX[I(x, y)] = true;
        foreach (var m in marks.Where(mm => mm.roof == "church")) Landmark2(im, m);
        // the square: rings of darker setts around the monument, benches facing it, trees along the edges
        for (int y = 0; y < H; y++) for (int x = 0; x < W; x++)
            {
                if (K[I(x, y)] != PLAZA || !InPoly(SQUARE, x + 0.5, y + 0.5)) continue;
                double e = Math.Sqrt((x - MONUMENT_X) * (x - MONUMENT_X) + (y - MONUMENT_Y) * (y - MONUMENT_Y) * 1.6);
                if (e > 30 && ((int)e % 34 < 3)) im.Set(x, y, Cl.A(Cl.H("4f4a42"), 120));
            }
        foreach (var b in new[] { new[] { MONUMENT_X - 40, MONUMENT_Y - 6, 4, 12 }, new[] { MONUMENT_X + 37, MONUMENT_Y - 6, 4, 12 }, new[] { MONUMENT_X - 6, MONUMENT_Y - 30, 12, 4 }, new[] { MONUMENT_X - 6, MONUMENT_Y + 27, 12, 4 } })
        {
            im.Fill(b[0] + 2, b[1] + 2, b[2], b[3], Cl.A(Cl.H("000000"), 90));
            im.Fill(b[0], b[1], b[2], b[3], Cl.H("7a5236"));
        }
        foreach (var t in new[] { new[] { 605, 652 }, new[] { 730, 640 }, new[] { 848, 650 }, new[] { 872, 765 }, new[] { 610, 868 }, new[] { 790, 868 } })
            Tree(im, t[0], t[1], 9);
        // the garden wall: stone around the grass, open at the gates
        var gates = new[] { new[] { 190, 436 }, new[] { 286, 342 }, new[] { 215, 381 } };
        for (int y = 2; y < H - 2; y++) for (int x = 2; x < W - 2; x++)
            {
                if (K[I(x, y)] != PARK) continue;
                bool edge = false, path = false;
                for (int dy = -6; dy <= 6; dy++) for (int dx = -6; dx <= 6; dx++)
                    {
                        if (!In(x + dx, y + dy)) continue;
                        byte k = K[I(x + dx, y + dy)];
                        if (Math.Abs(dx) <= 3 && Math.Abs(dy) <= 3 && (k == WALK || k == ROAD || k == PLAZA)) edge = true;
                        if (k == PATH) path = true; // the gravel path runs right along the wall: keep it open
                    }
                if (!edge || path || gates.Any(g => (g[0] - x) * (g[0] - x) + (g[1] - y) * (g[1] - y) < 144)) continue;
                im.Put(x, y, ((x + y) % 5 == 0) ? Cl.H("5f5a51") : Cl.H("7a756a"));
                SOLIDX[I(x, y)] = true;
            }
        // lanterns along the cobbled lanes
        AlongEdges(96, r => !r.car && !r.path && !r.pier && r.name != "námestie", (r, x, y, dx, dy, k) =>
        {
            double off = (r.w / 2.0 - 2) * (k % 2 == 0 ? 1 : -1);
            int lx = (int)Math.Round(x - dy * off), ly = (int)Math.Round(y + dx * off);
            if (In(lx, ly) && K[I(lx, ly)] == PLAZA && !NearSolid(lx, ly, 8) && !NEARNODE[I(lx, ly)]) Lamp(im, lx, ly);
        });
    }

    // the town hall tower with the astronomical clock, and the church with two spires
    static void Landmark2(Img im, Mark m)
    {
        int cx = (m.x0 + m.x1) / 2, cy = (m.y0 + m.y1) / 2;
        if (m.roof == "tower")
        {
            double r = Math.Min(m.x1 - m.x0, m.y1 - m.y0) / 3.2;
            im.Ellipse(cx, cy, r + 2, r + 2, Cl.H("8a6a2c"));
            im.Ellipse(cx, cy, r, r, Cl.H("23262b"));
            im.Ring(cx, cy, r * 0.7, r * 0.7, Cl.H("c9a24a"));
            im.Line(cx, cy, cx, (int)(cy - r * 0.8), Cl.H("e8c873"));
            im.Line(cx, cy, (int)(cx + r * 0.55), cy, Cl.H("e8c873"));
            im.Ellipse(cx, cy, 1.5, 1.5, Cl.H("e8c873"));
            return;
        }
        // the nave: a pitched roof running east from the towers, lit from the north
        int roofC = lotRoof[m.lot];
        for (int y = m.y0 + 2; y < m.y1 - 1; y++) for (int x = m.x0 + 30; x < m.x1 - 1; x++)
            {
                if (!In(x, y) || K[I(x, y)] != BUILD || LOT[I(x, y)] != m.lot) continue;
                im.Put(x, y, y < cy ? Cl.Lt(roofC, 0.12) : Cl.Dk(roofC, 0.25));
                if ((x - m.x0) % 6 == 0) im.Set(x, y, Cl.A(Cl.Dk(roofC, 0.4), 90));
            }
        for (int x = m.x0 + 30; x < m.x1 - 1; x++) { im.Put(x, cy, Cl.Lt(roofC, 0.4)); im.Put(x, cy + 1, Cl.Dk(roofC, 0.45)); }
        // two tall pointed towers at the front (west) end: four shaded faces, small corner spires, a gold tip
        foreach (int sy in new[] { m.y0 + 4, m.y1 - 34 })
        {
            int sx = m.x0 + 1, s = 30;
            int c = Cl.H("3a3d44");
            double tx = sx + s / 2.0, ty = sy + s / 2.0;
            im.Fill(sx + 6, sy + 6, s, s, Cl.A(Cl.H("000000"), 120));
            for (int y = sy; y < sy + s; y++) for (int x = sx; x < sx + s; x++)
                {
                    double dx = x + 0.5 - tx, dy = y + 0.5 - ty;
                    int face = Math.Abs(dx) > Math.Abs(dy) ? (dx < 0 ? Cl.Lt(c, 0.12) : Cl.Dk(c, 0.25)) : (dy < 0 ? Cl.Lt(c, 0.3) : Cl.Dk(c, 0.42));
                    if (Math.Abs(Math.Abs(dx) - Math.Abs(dy)) < 0.8) face = Cl.Lt(c, 0.45); // the hips
                    im.Put(x, y, face);
                }
            foreach (int ox in new[] { 0, s - 4 }) foreach (int oy in new[] { 0, s - 4 })
                {
                    im.Fill(sx + ox, sy + oy, 4, 4, Cl.Dk(c, 0.2));
                    im.Put(sx + ox + 1, sy + oy + 1, Cl.Lt(c, 0.5));
                }
            im.Ellipse(tx, ty, 2, 2, Cl.H("c9a24a"));
            im.Put((int)tx, (int)ty, Cl.H("f1dc9a"));
        }
    }

    // Mesto 2 street lights: an old iron lantern on a post instead of the modern lamp
    static void Lantern(Img im, int x, int y)
    {
        post.Add(() => { im.Ellipse(x + 1, y - 1, 18, 15, Cl.A(Cl.H("ffa640"), 24)); im.Ellipse(x + 1, y - 1, 8, 7, Cl.A(Cl.H("ffc46a"), 30)); });
        im.Fill(x + 2, y + 2, 3, 3, Cl.A(Cl.H("000000"), 100));
        im.Fill(x, y, 2, 2, Cl.H("1f2023"));
        im.Fill(x - 1, y - 5, 4, 4, Cl.H("1f2023"));
        im.Fill(x, y - 4, 2, 2, Cl.H("ffd27a"));
    }

    // every building Mesto 2 needs (the numbers are the ones in the approved sketch)
    static void Layout2()
    {
        AddMark("hotel", 455, 210, 560, 290, "white", null, null, 'S');        // 2 Grand hotel: Wexler
        AddMark("sperky", 560, 365, 615, 420, "slate", "diamond", "c9c4b8", 'N'); // 3 Parížska shops
        AddMark("oblecenie", 625, 365, 680, 420, "tile", "shirt", "c9c4b8", 'N');
        AddMark("pravnicka", 690, 365, 745, 420, "white", "scales", "c9a24a", 'N');
        AddMark("arena", 150, 510, 280, 655, "copper", null, null, 'N');        // 4 the gallery = Aréna
        AddMark("veza", 530, 700, 590, 770, "tower", null, null, 'E');          // 5 town hall tower: bosses
        AddMark("kostol", 925, 650, 1010, 790, "church", null, null, 'W');      // 6 the church (scenery)
        AddMark("alchymista", 880, 362, 955, 425, "tile2", null, null, 'E');    // 7 giver 1
        AddMark("skrysa", 150, 740, 222, 800, "tile", null, null, 'E');         // 9 the hideout cellar
        AddMark("mechanik", 1020, 800, 1075, 840, "metal", "wrench", "c9a24a", 'E'); // 10
        AddMark("zbrane", 860, 452, 915, 495, "gravel", "pistol", "c9c4b8", 'N'); // 11 back lane by Dlhá
        // Gang Wars: 5 corners in the lanes, 3 garages by the car streets, 2 warehouses up north, 2 cellar clubs
        AddMark("corner1", 252, 740, 300, 790, "tile", null, null, 'W');
        AddMark("corner2", 400, 725, 460, 775, "tile2", null, null, 'S');
        AddMark("corner3", 300, 905, 360, 950, "tile", null, null, 'N');
        AddMark("corner4", 995, 350, 1050, 400, "tile2", null, null, 'W');
        AddMark("corner5", 580, 915, 625, 960, "tile", null, null, 'E');
        AddMark("garaz1", 20, 520, 85, 580, "metal", null, null, 'E');
        AddMark("garaz2", 1160, 420, 1200, 480, "metal", null, null, 'W');
        AddMark("garaz3", 330, 725, 380, 758, "metal", null, null, 'N'); // clear of Žatecká, which runs past its corner
        AddMark("sklad1", 790, 200, 890, 290, "metal", null, null, 'S');
        AddMark("sklad2", 1000, 55, 1080, 155, "metal", null, null, 'S');
        AddMark("klub1", 930, 895, 1020, 950, "club", null, null, 'N');
        AddMark("klub2", 480, 850, 565, 915, "club", null, null, 'N');
    }
}
