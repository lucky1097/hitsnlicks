using System;
using System.Collections.Generic;

// Rooftop logos and lit entrances, so every shop and service reads at a glance on the map.
public static class Signs
{
    static readonly Dictionary<string, string[]> G = new Dictionary<string, string[]>
    {
        { "pistol", new[] { "............", "............", "..kkkkkkkkk.", ".kSSSSSSSSSk", ".knnnnnnnnk.", ".kkknkkkkk..", "..kCnk.k....", "..kCCkk.....", ".kCCk.......", ".kCCk.......", ".kkkk.......", "............" } },
        { "shirt", new[] { "............", "...kk..kk...", ".kkwwkkwwkk.", "kwwwwwwwwwwk", "kwwwwwwwwwwk", "kkkwwwwwwkkk", "..kwwwwwwk..", "..kwwwwwwk..", "..kwwwwwwk..", "..kwwwwwwk..", "..kkkkkkkk..", "............" } },
        { "diamond", new[] { "............", "............", "...kkkkkk...", "..kBBwBBBk..", ".kBwBBBBbBk.", "kkkkkkkkkkkk", ".kBBbBBbBBk.", "..kBBbbBBk..", "...kBbbBk...", "....kBBk....", ".....kk.....", "............" } },
        { "needle", new[] { ".........kk.", "........kSSk", ".......kSSk.", "......kSSk..", ".....knSk...", "....knnk....", "...knnk.....", "..kRnk......", "..kRk.......", ".kRk........", ".kk.........", "............" } },
        { "dumbbell", new[] { "............", "............", "............", ".kk......kk.", "kSSk....kSSk", "kSSkkkkkkSSk", "kSSnnnnnnSSk", "kSSkkkkkkSSk", "kSSk....kSSk", ".kk......kk.", "............", "............" } },
        { "scales", new[] { ".....kk.....", "oooooyyooooo", ".y...yy...y.", ".y...yy...y.", "yyy..yy..yyy", "kyyk.yy.kyyk", ".kk..yy..kk.", ".....yy.....", ".....yy.....", "...yyyyyy...", "..kkkkkkkk..", "............" } },
        { "wrench", new[] { ".........k.k", "........kSkS", ".......kSSSk", "......kSSk..", ".....kSSk...", "....kSSk....", "...kSSk.....", "..kSSk......", "kkSSk.......", "kSSSk.......", "kSkSk.......", "k.k........." } },
        { "crate", new[] { "............", ".kkkkkkkkkk.", ".kCCCCCCCCk.", ".kCkCCCCkCk.", ".kCCkCCkCCk.", ".kkkkkkkkkk.", ".kCCkCCkCCk.", ".kCkCCCCkCk.", ".kCCCCCCCCk.", ".kcccccccck.", ".kkkkkkkkkk.", "............" } },
        { "car", new[] { "............", "............", "............", "...kkkkk....", "..kBBkBBk...", ".kkkkkkkkkk.", "kRRRRRRRRRRk", "kRRRRRRRRRRk", "kkkkkkkkkkkk", ".knk....knk.", "..k......k..", "............" } },
    };

    // 28 x 28 plate painted on a roof with the icon at 2x
    public static void Plate(Img im, int cx, int cy, string icon, int frame)
    {
        int x0 = cx - 14, y0 = cy - 14;
        im.Fill(x0 + 3, y0 + 3, 28, 28, Cl.A(Cl.H("000000"), 110));
        im.Fill(x0, y0, 28, 28, frame);
        im.Fill(x0 + 1, y0 + 1, 26, 26, Cl.H("121214"));
        im.Fill(x0 + 2, y0 + 2, 24, 24, Cl.H("19191c"));
        im.Blit(Icons.FromGrid(G[icon]).Scale(2), x0 + 2, y0 + 2, 0);
    }

    // warm light spilling out of an entrance onto the sidewalk
    public static void Door(Img im, int x, int y)
    {
        im.Ellipse(x, y + 2, 12, 6, Cl.A(Cl.H("ffb04a"), 34));
        im.Ellipse(x, y + 1, 6, 3, Cl.A(Cl.H("ffd28a"), 40));
        im.Fill(x - 5, y - 1, 10, 3, Cl.H("1e1a16"));
        im.Fill(x - 4, y - 1, 8, 1, Cl.H("6a5030"));
    }

    public static void All(Img im)
    {
        int bone = Cl.H("c9c4b8"), gold = Cl.H("c9a24a"), red = Cl.H("b8322a");
        Plate(im, 311, 162, "pistol", bone);
        Plate(im, 379, 162, "shirt", bone);
        Plate(im, 447, 162, "diamond", bone);
        Plate(im, 517, 162, "needle", bone);
        Plate(im, 732, 148, "dumbbell", gold);
        Plate(im, 722, 612, "scales", gold);
        Plate(im, 878, 395, "wrench", gold);
        Plate(im, 771, 439, "car", bone);
        Plate(im, 395, 607, "crate", red);
        foreach (var d in new int[][] {
            new[] { 311, 207 }, new[] { 379, 207 }, new[] { 447, 207 }, new[] { 517, 207 }, new[] { 735, 206 },
            new[] { 104, 571 }, new[] { 722, 571 }, new[] { 350, 571 }, new[] { 492, 571 }, new[] { 171, 330 } })
            Door(im, d[0], d[1]);
    }
}
