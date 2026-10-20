using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

// Exports the assets the browser prototype needs: base map without actors, collision rects, 1x sprites.
public static class GameExport
{
    public static string Run(string outDir)
    {
        Directory.CreateDirectory(outDir);
        var cast = World.Cast();
        World.Actors = false;
        World.Solids = new List<int[]>();
        int px, py;
        var map = World.Map(cast, out px, out py);
        map.Save(Path.Combine(outDir, "map_base.png"));

        var sb = new StringBuilder();
        sb.Append("{\"w\":896,\"h\":640,\"solids\":[");
        for (int i = 0; i < World.Solids.Count; i++)
        {
            var s = World.Solids[i];
            if (i > 0) sb.Append(',');
            sb.Append('[').Append(s[0]).Append(',').Append(s[1]).Append(',').Append(s[2]).Append(',').Append(s[3]).Append(']');
        }
        sb.Append("]}");
        File.WriteAllText(Path.Combine(outDir, "map.json"), sb.ToString());

        foreach (var kv in cast)
        {
            var img = Person.Top(kv.Value);
            if (kv.Key != "hrac") img.Grade(0.4, 0.28);
            img.Save(Path.Combine(outDir, "p_" + kv.Key + ".png"));
        }

        string[][] cars = {
            new[] { "sedan_blue", "sedan", "2f4a6e" }, new[] { "sedan_red", "sedan", "8a1f2a" }, new[] { "sedan_green", "sedan", "4a6a3a" },
            new[] { "sedan_white", "sedan", "e6e3dc" }, new[] { "taxi", "taxi", "c9a227" }, new[] { "police", "police", "e6e6e2" },
            new[] { "van", "van", "3a3d44" }, new[] { "pickup", "pickup", "6b6f78" } };
        foreach (var c in cars)
        {
            var img = Car.Make(Cl.H(c[2]), c[1]);
            img.Grade(0.45, 0.3);
            img.Save(Path.Combine(outDir, "car_" + c[0] + ".png"));
        }

        var bub = new Img(7, 11);
        World.Bubble(bub, 0, 0, Cl.H("f2ede2"), '!');
        bub.Save(Path.Combine(outDir, "bubble.png"));
        var bubG = new Img(7, 11);
        World.Bubble(bubG, 0, 0, Cl.H("e0b444"), '!');
        bubG.Save(Path.Combine(outDir, "bubble_gold.png"));

        World.Actors = true;
        return "solids " + World.Solids.Count;
    }
}
