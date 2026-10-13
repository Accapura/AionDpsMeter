namespace AionMeter.Core.Capture;

/// <summary>
/// AionDps: пинг до игрового сервера — пассивно, по уже идущему трафику игры (в игру и на сервер ничего не отправляется).
/// Время между нашим пакетом серверу и подтверждением (ACK) от сервера — это время «туда и обратно» (RTT).
/// Повторно отправленные пакеты не учитываются (алгоритм Карна). Показываем медиану последних замеров.
/// </summary>
public sealed class PingMeter
{
    private readonly object _gate = new();
    private readonly Dictionary<FlowKey, List<(uint End, long Us, bool Retx)>> _pending = new();
    private readonly List<(long Us, int Ms)> _samples = new();
    // Пинг самой игры: клиент раз в ~10 с шлёт серверу запрос со своим временем, сервер возвращает его в ответе (опкод 03 36).
    // Время отправки — счётчик Windows (QPC) в мс + 16 777 216 000 (смещение Unreal). Разница «сейчас − отправлено» — полный
    // путь туда и обратно, в том числе через ускоритель/VPN. В игру мы ничего не отправляем — только читаем ответ.
    private const long UnrealOffsetMs = 16_777_216_000L;
    private const long DotnetToUnixMs = 62_135_596_800_000L;
    // «Живой» пинг: точный замер игры (раз в ~10 с) — якорь; между замерами число двигается вместе с задержкой подтверждений
    // TCP в трафике игры (они идут постоянно). Берётся нижняя четверть последних замеров — это отсекает отложенные подтверждения.
    private double _anchor, _anchorPassive = -1;
    private double? _live;
    private long _echoAtMs;
    private int _echoCount, _echoLast;

    /// <summary>Пинг в мс; -1, пока нет замеров (или они устарели).</summary>
    public int PingMs
    {
        get
        {
            lock (_gate)
            {
                if (_samples.Count == 0) return -1;
                var now = _samples[^1].Us;
                var recent = _samples.Where(s => now - s.Us < 20_000_000).Select(s => s.Ms).OrderBy(x => x).ToArray();
                return recent.Length == 0 ? -1 : recent[recent.Length / 2];
            }
        }
    }
    public long LastSampleUs { get { lock (_gate) return _samples.Count == 0 ? 0 : _samples[^1].Us; } }

    /// <summary>Задержка подтверждений TCP за последние windowMs мс (нижняя четверть замеров); -1, если замеров меньше двух. Под замком.</summary>
    private double PassiveLow(long nowMs, int windowMs)
    {
        var a = _samples.Where(s => nowMs - s.Us / 1000 < windowMs).Select(s => s.Ms).OrderBy(x => x).ToArray();
        return a.Length < 2 ? -1 : a[a.Length / 4];
    }

    /// <summary>Живой пинг (мс): точный замер игры плюс изменение задержки соединения с момента этого замера. -1, если замера нет или он старше 60 с.</summary>
    public int LivePingMs(long nowMs)
    {
        lock (_gate)
        {
            if (_echoCount == 0 || nowMs - _echoAtMs >= 60_000) return -1;
            var p = PassiveLow(nowMs, 6000);
            var target = _anchor + (p >= 0 && _anchorPassive >= 0 ? p - _anchorPassive : 0);
            target = Math.Clamp(target, Math.Max(1, _anchor * 0.6), _anchor * 1.6 + 15);
            _live = _live is double l ? l + 0.6 * (target - l) : target;
            return (int)Math.Round(_live.Value);
        }
    }
    /// <summary>Для подсказки в оверлее: сколько ответов игры получено и последний замер, мс.</summary>
    public (int Count, int Last) EchoInfo { get { lock (_gate) return (_echoCount, _echoLast); } }

    private static long CounterMs()
    {
        var ts = System.Diagnostics.Stopwatch.GetTimestamp(); var f = System.Diagnostics.Stopwatch.Frequency;
        return ts / f * 1000 + ts % f * 1000 / f;
    }

    /// <summary>Ищет в данных от сервера ответ на пинг: 03 36 00 00 + i64 «время отправки клиента».</summary>
    private void ScanEcho(byte[] d, long arrivalUnixMs)
    {
        for (var i = 0; i + 12 <= d.Length; i++)
        {
            if (d[i] != 0x03 || d[i + 1] != 0x36 || d[i + 2] != 0 || d[i + 3] != 0) continue;
            var v = BitConverter.ToInt64(d, i + 4);
            var wallNow = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var counterNow = CounterMs();
            long rtt = -1;
            var sent = v - UnrealOffsetMs; // новый клиент: счётчик Windows в мс
            if (sent >= 0 && sent <= counterNow) rtt = counterNow - (wallNow - arrivalUnixMs) - sent;
            if (rtt < 1 || rtt > 2000) rtt = arrivalUnixMs - (v - DotnetToUnixMs); // старый клиент: часы в формате .NET
            if (rtt < 1 || rtt > 2000) continue;
            lock (_gate)
            {
                _anchor = rtt; _anchorPassive = PassiveLow(wallNow, 8000); _live = rtt;
                _echoAtMs = wallNow; _echoLast = (int)rtt; _echoCount++;
            }
        }
    }

    private static bool Le(uint a, uint b) => (int)(a - b) <= 0; // a ≤ b с учётом переполнения номеров

    /// <param name="serverFlow">Поток сервер→клиент, признанный игровым.</param>
    public void Observe(in SegmentReader.Segment s, Func<FlowKey, bool> isGameFlow)
    {
        if (s.Payload.Length >= 12 && isGameFlow(s.Key)) ScanEcho(s.Payload, s.TimeMs);
        var rev = new FlowKey(s.Key.Dst, s.Key.DstPort, s.Key.Src, s.Key.SrcPort);
        lock (_gate)
        {
            if (s.Payload.Length > 0 && isGameFlow(rev))
            {
                // наш пакет серверу: ждём его подтверждения
                if (!_pending.TryGetValue(rev, out var list)) _pending[rev] = list = new();
                var end = unchecked(s.Seq + (uint)s.Payload.Length);
                var i = list.FindIndex(p => p.End == end);
                if (i >= 0) list[i] = (end, list[i].Us, true); // повтор — замер по нему неточен
                else list.Add((end, s.Us, false));
                if (list.Count > 128) list.RemoveRange(0, list.Count - 128);
            }
            if (s.HasAck && isGameFlow(s.Key) && _pending.TryGetValue(s.Key, out var pend) && pend.Count > 0)
            {
                // подтверждение от сервера: берём самый новый подтверждённый пакет
                var best = -1;
                for (var k = 0; k < pend.Count; k++) if (Le(pend[k].End, s.Ack)) best = k;
                if (best < 0) return;
                var p = pend[best];
                pend.RemoveRange(0, best + 1);
                if (p.Retx) return;
                var rtt = (int)Math.Round((s.Us - p.Us) / 1000.0);
                if (rtt < 0 || rtt > 3000) return;
                _samples.Add((s.Us, rtt));
                if (_samples.Count > 60) _samples.RemoveRange(0, _samples.Count - 60);
            }
        }
    }
}
