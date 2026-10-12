// Данные игры (названия навыков, NPC, карт) зашиты внутрь AionDpsBridge.dll —
// рядом с программой не нужна папка data. Если папка всё же есть, берётся она.
using System.Reflection;

namespace AionDps.Bridge;

public static class EmbeddedData
{
    static readonly Assembly Asm = typeof(EmbeddedData).Assembly;

    static string Key(string path) =>
        Path.GetRelativePath(AppContext.BaseDirectory, path).Replace('\\', '/');

    public static bool Exists(string path) =>
        File.Exists(path) || Asm.GetManifestResourceInfo(Key(path)) != null;

    public static string ReadAllText(string path)
    {
        if (File.Exists(path)) return File.ReadAllText(path);
        using var s = Asm.GetManifestResourceStream(Key(path)) ?? throw new FileNotFoundException(path);
        using var r = new StreamReader(s);
        return r.ReadToEnd();
    }
}
