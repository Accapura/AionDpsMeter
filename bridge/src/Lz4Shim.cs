// Minimal LZ4 block decoder (replaces the K4os.Compression.LZ4 package: only Decode is used by the core).
namespace K4os.Compression.LZ4;

public static class LZ4Codec
{
    /// <summary>Decodes one LZ4 block. Returns the number of bytes written, or -1 on malformed input.</summary>
    public static int Decode(ReadOnlySpan<byte> source, Span<byte> target)
    {
        int s = 0, d = 0;
        while (s < source.Length)
        {
            int token = source[s++];
            int lit = token >> 4;
            if (lit == 15)
            {
                int b;
                do { if (s >= source.Length) return -1; b = source[s++]; lit += b; } while (b == 255);
            }
            if (s + lit > source.Length || d + lit > target.Length) return -1;
            source.Slice(s, lit).CopyTo(target.Slice(d));
            s += lit; d += lit;
            if (s >= source.Length) break; // the last sequence carries literals only
            if (s + 2 > source.Length) return -1;
            int off = source[s] | (source[s + 1] << 8);
            s += 2;
            if (off == 0 || off > d) return -1;
            int ml = token & 15;
            if (ml == 15)
            {
                int b;
                do { if (s >= source.Length) return -1; b = source[s++]; ml += b; } while (b == 255);
            }
            ml += 4;
            if (d + ml > target.Length) return -1;
            int m = d - off;
            for (int i = 0; i < ml; i++) target[d++] = target[m++];
        }
        return d;
    }
}
