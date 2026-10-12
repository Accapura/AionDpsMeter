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
    // Пинг «игры»: наш запрос навыка → объявление сервером, что мы этот навык применили (для своих навыков).
    // Работает и через ускорители/VPN: время замеряется между пакетами самой игры.
    private readonly List<(long Us, byte[] Data)> _client = new();
    private readonly List<(long Ms, int Rtt)> _app = new();

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

    /// <summary>Сервер объявил, что наш персонаж применил навык: ищем наш запрос с этим навыком за последние 2 с.</summary>
    public void MatchCast(long castMs, int skill)
    {
        Span<byte> key = stackalloc byte[4];
        BitConverter.TryWriteBytes(key, skill);
        lock (_gate)
        {
            for (var i = _client.Count - 1; i >= 0; i--)
            {
                var (us, data) = _client[i];
                var ms = us / 1000;
                if (ms > castMs) continue;
                if (castMs - ms > 2000) break;
                if (data.AsSpan().IndexOf(key) < 0) continue;
                var rtt = (int)(castMs - ms);
                _client.RemoveAt(i);
                if (rtt < 3) return;
                _app.Add((castMs, rtt));
                if (_app.Count > 20) _app.RemoveAt(0);
                return;
            }
        }
    }
    /// <summary>Пинг по навыкам: нижняя четверть последних замеров (без ожидания такта сервера); -1, если замеров мало.</summary>
    public int AppPingMs(long nowMs)
    {
        lock (_gate)
        {
            var r = _app.Where(x => nowMs - x.Ms < 120_000).Select(x => x.Rtt).OrderBy(x => x).ToArray();
            return r.Length < 3 ? -1 : r[r.Length / 4];
        }
    }

    private static bool Le(uint a, uint b) => (int)(a - b) <= 0; // a ≤ b с учётом переполнения номеров

    /// <param name="serverFlow">Поток сервер→клиент, признанный игровым.</param>
    public void Observe(in SegmentReader.Segment s, Func<FlowKey, bool> isGameFlow)
    {
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
                _client.Add((s.Us, s.Payload));
                var cut = s.Us - 3_000_000;
                var drop = 0;
                while (drop < _client.Count && _client[drop].Us < cut) drop++;
                if (drop > 0) _client.RemoveRange(0, drop);
                if (_client.Count > 400) _client.RemoveRange(0, _client.Count - 400);
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
