using System.Collections.Generic;
using System.IO;

public static class IconSet
{
    public static void Run(string outDir)
    {
        var set = new Dictionary<string, string[]>();
        set["cash"] = new[] {
            "............", "............", "kkkkkkkkkkkk", "kGGGGGGGGGGk", "kGdGGddGGdGk", "kGGGdGGdGGGk",
            "kGGGdGGdGGGk", "kGdGGddGGdGk", "kggggggggggk", "kkkkkkkkkkkk", "kddddddddddk", "kkkkkkkkkkkk" };
        set["chain"] = new[] {
            "kk........kk", "kYk......kyk", "kyk......kYk", ".kYk....kyk.", ".kyk....kYk.", "..kYk..kyk..",
            "...kYkkyk...", "....kYYk....", "...kYyyok...", "...kyYYok...", "...kyyook...", "....kkkk...." };
        set["heat"] = new[] {
            "............", ".....kk.....", "..k..kk..k..", "...k....k...", "....kkkk....", "...kRRRrk...",
            "..kRwRRrrk..", "..kRRRRrrk..", "..kRRRrrrk..", ".kkkkkkkkkk.", ".knssssssnk.", ".kkkkkkkkkk." };
        set["xp"] = new[] {
            ".....kk.....", "....kBbk....", "....kBbk....", "kkkkkBbbkkkk", "kBBBBBbbbbbk", ".kBBBBbbbbk.",
            "..kBBBbbbk..", "..kBBBbbbk..", ".kBBBkkbbbk.", ".kBBk..kbbk.", "kBkk....kkbk", "kk........kk" };
        set["clock"] = new[] {
            "....kkkk....", "..kkwwwwkk..", ".kwwwkwwwSk.", ".kwwwkwwwSk.", "kwwwwkwwwwSk", "kwwwwkkkwwSk",
            "kwwwwwwwwwSk", "kwwwwwwwwwSk", ".kwwwwwwwSk.", ".kSwwwwwSSk.", "..kkSSSSkk..", "....kkkk...." };
        set["sila"] = new[] {
            "............", "..kkkkkkk...", ".kFkFkFkFk..", ".kfkfkfkfkk.", ".kfkfkfkfkek", ".kffffffffek",
            "kFkkkkfffek.", "kFfffFkffek.", ".kffffffeek.", "..kffffeek..", "...keeeek...", "...kkkkkk..." };
        set["odolnost"] = new[] {
            "............", ".kkkkkkkkkk.", ".kSSSSnnnnk.", ".kSwSSnsnnk.", ".kSSSSnnnnk.", ".kSSSSnnnnk.",
            ".kSSSSnnnnk.", "..kSSSnnnk..", "..kSSSnnnk..", "...kSSnnk...", "....kSnk....", ".....kk....." };
        set["obratnost"] = new[] {
            "......kkkk..", ".....kYYk...", "....kYYk....", "...kYYk.....", "..kYYkkkkk..", ".kYYYYYYYk..",
            "..kkkkYYk...", ".....kYk....", "....kYk.....", "...kyk......", "..kyk.......", "..kk........" };
        set["charizma"] = new[] {
            "............", "............", "..kkkkkkkk..", ".kwwwwwwwwk.", "kwwwwwwwwwSk", "kwkwwkwwkwSk",
            "kwwwwwwwwwSk", ".kwwwwwwwSk.", "..kkwwkkkk..", "...kwk......", "...kk.......", "............" };
        set["stastie"] = new[] {
            "............", ".kkkkkkkkkk.", ".kwwwwwwwSk.", ".kwkwwwwwSk.", ".kwwwwwwwSk.", ".kwwwkwwwSk.",
            ".kwwwwwwwSk.", ".kwwwwwkwSk.", ".kwwwwwwwSk.", ".kSSSSSSSSk.", ".kkkkkkkkkk.", "............" };
        set["lock"] = new[] {
            "....kkkk....", "...kSSSSk...", "..kSk..kSk..", "..kSk..kSk..", ".kkkkkkkkkk.", ".kyyyyyyyok.",
            ".kyyykkyyok.", ".kyyykkyyok.", ".kyyyykyyok.", ".kyyyyyyyok.", ".kooooooook.", ".kkkkkkkkkk." };
        foreach (var kv in set)
        {
            foreach (var row in kv.Value) if (row.Length != 12) throw new System.Exception(kv.Key + " row '" + row + "' len " + row.Length);
            Icons.FromGrid(kv.Value).Scale(2).Save(Path.Combine(outDir, "i_" + kv.Key + ".png"));
        }
    }
}
