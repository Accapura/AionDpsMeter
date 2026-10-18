// Aion DPS Meter — мост чтения боя.
// Пассивно читает сетевой трафик AION 2 на этом ПК через Npcap: память игры не читается, в игру ничего не отправляется.
// Пишет в stdout по одному JSON-объекту на строку, принимает команды в stdin.
//
//   stdin:  mode boss | mode all | reset | detail <actorId> | lang ru|en | quit
//   stdout: {"t":"status",...} {"t":"snap",...} {"t":"boss",...} {"t":"self",...}
//
// GPL-3.0. Разбор протокола: AionMeter.Core (github.com/cyberbadger6969/aion2-dps-meter).

using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using AionMeter.Core.Capture;
using AionMeter.Core.Combat;
using AionMeter.Core.Events;
using AionMeter.Core.Game;

CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
Console.OutputEncoding = System.Text.Encoding.UTF8;

var dataDir = Path.Combine(AppContext.BaseDirectory, "data");
var json = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
};
var outLock = new object();
void Emit(object o)
{
    var line = JsonSerializer.Serialize(o, json);
    lock (outLock)
    {
        Console.Out.WriteLine(line);
        Console.Out.Flush();
    }
}

static string Ru(CaptureStatus s) => s.State switch
{
    CaptureState.Starting => "Запуск захвата…",
    CaptureState.Stopped => "Захват остановлен",
    CaptureState.Capturing => "Игра найдена" + (s.Message.Contains('·') ? " ·" + s.Message[(s.Message.IndexOf('·') + 1)..] : ""),
    CaptureState.WaitingForGame when s.Message.StartsWith("AION 2 is not running") => "AION 2 не запущена",
    CaptureState.WaitingForGame when s.Message.StartsWith("Connected") => "Подключено, но игра пока ничего не присылает",
    CaptureState.WaitingForGame => "Жду подключения игры…",
    CaptureState.Error when s.Message.StartsWith("Npcap") => "Npcap не установлен — скачайте с npcap.com",
    CaptureState.Error when s.Message.StartsWith("No Npcap adapter") => "Не найден сетевой адаптер с трафиком игры (VPN?)",
    CaptureState.Error => "Ошибка захвата: " + s.Message,
    _ => s.Message,
};

GameData data;
try
{
    data = GameData.Load(dataDir, "ru");
}
catch (Exception ex)
{
    Emit(new { t = "status", state = "error", msg = "Не удалось загрузить данные игры: " + ex.Message });
    return 2;
}

var options = new MeterOptions { TargetMode = TargetMode.BossOnly };
var tracker = new CombatTracker(data, options);
// Полевые боссы: карта -> блок кодов NPC. Известные карты — из field_boss_maps.json, остальные узнаём по замеченным боссам.
var knownMaps = new Dictionary<int, (int Block, string? Ru)>();
try
{
    using var doc = JsonDocument.Parse(AionDps.Bridge.EmbeddedData.ReadAllText(Path.Combine(dataDir, "field_boss_maps.json")));
    foreach (var m in doc.RootElement.GetProperty("maps").EnumerateObject())
        if (int.TryParse(m.Name, out var id))
            knownMaps[id] = (m.Value.GetProperty("block").GetInt32(), m.Value.TryGetProperty("ru", out var ru) ? ru.GetString() : null);
}
catch { /* не критично */ }
var seenBlocks = new Dictionary<int, HashSet<int>>();
var zoneOfMap = new Dictionary<int, string>();

void EmitSelf()
{
    var sid = tracker.SelfServerId;
    Emit(new { t = "self", name = tracker.SelfName, serverId = sid, server = sid != 0 ? data.ServerName(sid) : null });
}
tracker.SelfIdentified += _ => EmitSelf();
tracker.BossNoticed += n =>
{
    if (n.MapId != 0)
    {
        (seenBlocks.TryGetValue(n.MapId, out var set) ? set : seenBlocks[n.MapId] = new()).Add(n.NpcCode / 1000);
        if (!string.IsNullOrEmpty(n.Zone)) zoneOfMap[n.MapId] = n.Zone!;
    }
    Emit(new { t = "boss", name = data.NpcName(n.NpcCode), zone = n.Zone, kind = n.Kind.ToString(), serverId = n.ServerId });
};
tracker.FieldBossListed += list =>
{
    var block = knownMaps.TryGetValue(list.MapId, out var km) ? km.Block : 0;
    if (block == 0 && seenBlocks.TryGetValue(list.MapId, out var blocks))
        block = blocks.FirstOrDefault(b => data.FieldBossesInBlock(b).Count == list.Count);
    var mapName = km.Ru ?? (zoneOfMap.TryGetValue(list.MapId, out var z) ? z : "Карта " + list.MapId);
    Emit(new
    {
        t = "fieldbosses",
        serverId = list.ServerId,
        server = list.ServerId != 0 ? data.ServerName(list.ServerId) : null,
        mapId = list.MapId,
        map = mapName,
        slots = list.Slots.Select(sl =>
        {
            var code = block != 0 ? data.FieldBossInSlot(block, list.MapId, sl.SlotId, list.Count) : 0;
            return new { slot = sl.SlotId, name = code != 0 ? data.NpcName(code) : "Полевой босс №" + (sl.SlotId - list.MapId * 100), alive = sl.Alive, atMs = sl.AtMs, x = sl.X, y = sl.Y, z = sl.Z };
        }),
    });
};

if (!LiveCapture.IsNpcapInstalled())
{
    Emit(new { t = "status", state = "no-npcap", msg = "Npcap не установлен — скачайте с npcap.com" });
}

// Разбивка по навыкам для одного игрока текущего (или последнего) боя.
// Лента ударов для вида «Ротация»: [мс от начала боя, номер навыка в names, урон, флаги]; тики DoT не включаем.
object RotationOf(CombatantDetail d, long durMs, int max)
{
    var names = new List<string>();
    var index = new Dictionary<int, int>();
    var list = new List<long[]>();
    var cut = d.Casts.Count >= 5_000; // в записанном бое хранятся первые 5000 ударов: дальше ленты нет
    foreach (var c in d.Casts)
    {
        if ((c.Flags & HitFlags.Dot) != 0) continue;
        if (!index.TryGetValue(c.SkillCode, out var ix)) { ix = names.Count; index[c.SkillCode] = ix; names.Add(data.SkillName(c.SkillCode)); }
        list.Add(new long[] { c.OffsetMs, ix, c.Damage, (long)c.Flags });
        if (list.Count >= max) { cut = true; break; }
    }
    // Если лента обрезана, ось времени кончается там, где кончились удары, а не растягивается на весь бой.
    if (cut && list.Count > 0) durMs = Math.Min(durMs, list[^1][0] + 1000);
    return new { names, c = list, dur = durMs };
}

void EmitDetail(uint actor, bool withCasts = false)
{
    var d = tracker.Detail(null, actor);
    if (d is null) { Emit(new { t = "detail", id = actor, missing = true }); return; }
    Emit(new
    {
        t = "detail",
        id = d.ActorId,
        name = d.Name,
        cls = d.Class.ToString(),
        self = d.IsSelf,
        dmg = d.Damage,
        dps = Math.Round(d.Dps),
        share = Math.Round(d.Share, 4),
        combatMs = d.CombatMs,
        taken = d.DamageTaken,
        heal = tracker.Snapshot(null, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds())?.Combatants.FirstOrDefault(c => c.ActorId == actor)?.Healing ?? 0,
        q = new
        {
            hits = d.Quality.Hits,
            dots = d.Quality.DotTicks,
            crit = d.Quality.CritRate,
            back = d.Quality.BackRate,
            perfect = d.Quality.PerfectRate,
            heavy = d.Quality.HeavyRate,
            front = d.Quality.FrontRate,
            multi = d.Quality.MultiRate,
            dbl = d.Quality.DoubleRate,
            maxHit = d.Quality.MaxHit,
            maxHitSkill = d.Quality.MaxHitSkill,
        },
        skills = d.Skills.Select(k => new
        {
            name = k.Name, hits = k.Hits, dots = k.DotTicks, dmg = k.Damage, dps = Math.Round(k.Dps), share = Math.Round(k.Share, 4),
            avg = k.Average, max = k.Max, crit = k.CritRate, back = k.BackRate, front = k.FrontRate, perfect = k.PerfectRate,
            heavy = k.HeavyRate, multi = k.MultiRate, dbl = k.DoubleRate,
        }),
        perSecond = d.PerSecond,
        rot = withCasts ? RotationOf(d, d.CombatMs, 6000) : null,
    });
}

// HP босса по секундам боя (для графика с фазами): id боя -> доля HP ×1000 на каждой секунде.
var bossHpLine = new Dictionary<Guid, List<int>>();
void SampleBossHp(EncounterSnapshot s)
{
    if (!s.IsActive || s.Boss is not { } b || b.MaxHp <= 0 || b.Hp < 0) return;
    if (!bossHpLine.TryGetValue(s.Id, out var line))
    {
        if (bossHpLine.Count > 8) bossHpLine.Clear();
        bossHpLine[s.Id] = line = new List<int>();
    }
    var sec = (int)(s.CombatMs / 1000);
    if (sec > 7200) return;
    var pct = (int)Math.Clamp(b.Hp * 1000 / b.MaxHp, 0, 1000);
    while (line.Count <= sec) line.Add(line.Count > 0 ? line[^1] : 1000);
    line[sec] = pct;
}

// Разбор смерти своего персонажа.
tracker.SelfDied += r => Emit(new
{
    t = "death",
    at = r.TimeMs,
    zone = r.Zone,
    boss = r.Boss,
    hits = r.Entries.Select(e => new { ms = e.Ms, src = e.Source, skill = e.Skill, amt = e.Amount, crit = e.Crit, heal = e.Heal }),
});

// Закончившийся бой — в историю приложения (боссы и длинные бои).
tracker.EncounterFinished += rec =>
{
    var s = rec.Summary;
    if (s.Boss is null && s.CombatMs < 60_000) return;
    Emit(new
    {
        t = "fight",
        id = s.Id,
        at = s.StartedAt.ToUnixTimeMilliseconds(),
        title = s.Title,
        boss = s.Boss?.Name,
        bossCode = s.Boss?.NpcCode ?? s.TargetCode,
        zone = s.Zone,
        dungeon = GameData.IsDungeonMap(tracker.MapId),
        result = s.Reason.ToString(),
        combatMs = s.CombatMs,
        total = s.TotalDamage,
        partyDps = Math.Round(s.PartyDps),
        partial = s.MostDamageUnsent,
        server = tracker.SelfServerId != 0 ? data.ServerName(tracker.SelfServerId) : null,
        players = s.Combatants.Where(c => !c.IsUnknownSummons && c.Damage > 0).OrderByDescending(c => c.Damage).Select(c => new
        {
            name = c.Name, cls = c.Class.ToString(), self = c.IsSelf, dmg = c.Damage, dps = Math.Round(c.Dps), share = Math.Round(c.Share, 4),
            hits = c.Hits, crit = Math.Round(c.CritRate, 3), maxHit = c.MaxHit,
            heal = c.Healing, hps = s.CombatMs > 0 ? Math.Round(c.Healing / (s.CombatMs / 1000.0)) : 0,
        }),
        // график: свой урон и урон группы по секундам, HP босса (×1000)
        timeline = new
        {
            self = rec.Details.FirstOrDefault(d => d.IsSelf)?.PerSecond,
            party = PartyPerSecond(rec.Details),
            boss = bossHpLine.Remove(s.Id, out var hpLine) ? hpLine : null,
        },
        rot = rec.Details.Where(d => d.IsSelf && d.Casts.Count > 0).Select(d => RotationOf(d, s.CombatMs, 4000)).FirstOrDefault(),
        details = rec.Details.Where(d => d.IsSelf).Select(d => new
        {
            name = d.Name,
            skills = d.Skills.Take(30).Select(k => new { name = k.Name, hits = k.Hits, dmg = k.Damage, share = Math.Round(k.Share, 4), crit = k.CritRate, max = k.Max }),
        }),
    });
};

static long[] PartyPerSecond(IEnumerable<CombatantDetail> details)
{
    var sum = new List<long>();
    foreach (var d in details)
        for (var i = 0; i < d.PerSecond.Count; i++)
        {
            while (sum.Count <= i) sum.Add(0);
            sum[i] += d.PerSecond[i];
        }
    return sum.ToArray();
}

LiveCapture? capture = null;
void StartCapture()
{
    try { capture?.Dispose(); } catch { /* ignore */ }
    capture = null;
    try
    {
        var c = new LiveCapture(data, new LiveCaptureOptions());
        c.EventDecoded += tracker.Process;
        // пинг по своим навыкам (работает и через ускорители/VPN)
        c.StatusChanged += st => Emit(new { t = "status", state = st.State.ToString(), msg = Ru(st) });
        c.Start();
        capture = c;
    }
    catch (Exception ex)
    {
        Emit(new { t = "status", state = "error", msg = "Захват не запустился: " + ex.Message });
    }
}
StartCapture();

var running = true;
new Thread(() =>
{
    string? line;
    while ((line = Console.In.ReadLine()) != null)
    {
        var parts = line.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) continue;
        if (parts[0] == "mode") { var mp = (parts.Length > 1 ? parts[1] : "").Split(' ', StringSplitOptions.RemoveEmptyEntries); var mv = mp.Length > 0 ? mp[0] : ""; options.DummyMode = mv == "dummy"; if (mv == "dummy" && mp.Length > 1 && int.TryParse(mp[1], out var ds)) options.DummySeconds = Math.Clamp(ds, 0, 3600); options.TargetMode = mv == "all" ? TargetMode.All : TargetMode.BossOnly; }
        else if (parts[0] == "reset") tracker.Reset();
        else if (parts[0] == "lang" && parts.Length > 1) data.ReloadNames(dataDir, parts[1] == "en" ? "en" : "ru");
        else if (parts[0] == "detail" && parts.Length > 1) { var dp = parts[1].Split(' ', StringSplitOptions.RemoveEmptyEntries); if (uint.TryParse(dp[0], out var actor)) EmitDetail(actor, dp.Length > 1 && dp[1] == "c"); }
        else if (parts[0] == "quit") break;
    }
    running = false; // приложение закрыло stdin — выходим вместе с ним
}) { IsBackground = true }.Start();

// Активное окно (только Windows): оверлей прячется, когда игра не на экране.
// game — игра впереди, app — окно самого Aion DPS Meter, other — другое окно, none — игра не запущена.
var hostPid = args.Length > 1 && args[0] == "--host" && int.TryParse(args[1], out var hp) ? hp : 0;
var gamePids = new HashSet<int>();
long gamePidsAt = 0;
string fgLast = "";
void CheckForeground()
{
    if (!OperatingSystem.IsWindows()) return;
    try
    {
        var nowMs = Environment.TickCount64;
        if (nowMs - gamePidsAt > 5000)
        {
            gamePidsAt = nowMs;
            gamePids.Clear();
            foreach (var n in GameProcessLocator.ProcessNames)
                foreach (var p in System.Diagnostics.Process.GetProcessesByName(n)) { gamePids.Add(p.Id); p.Dispose(); }
        }
        string state;
        if (gamePids.Count == 0) state = "none";
        else
        {
            Win32.GetWindowThreadProcessId(Win32.GetForegroundWindow(), out var pid);
            state = gamePids.Contains((int)pid) ? "game" : pid == hostPid && hostPid != 0 ? "app" : "other";
        }
        if (state != fgLast) { fgLast = state; Emit(new { t = "fg", state }); }
    }
    catch { /* не критично */ }
}

string last = "";
var icmpPing = new IcmpPinger(() => capture?.ServerIp);
icmpPing.Start();
long pingAt = 0;
int pingLast = int.MinValue;
while (running)
{
    var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    tracker.Tick(now);
    var s = tracker.Snapshot(null, now);
    var mapId = tracker.MapId;
    if (s is not null) SampleBossHp(s);
    // Пока ничего не меняется (между боями), ничего не шлём.
    var mtk = s is null ? null : tracker.MainTarget(null);
    var key = s is null ? "none" : $"{s.Id}|{s.TotalDamage}|{s.Combatants.Sum(c => c.Healing)}|{s.IsActive}|{s.Boss?.Hp}|{mtk?.Hp}|{mtk?.Name}|{s.Combatants.Count}|{(s.IsActive ? s.CombatMs / 1000 : 0)}";
    if (key != last)
    {
        last = key;
        Emit(s is null ? (object)new { t = "snap", empty = true } : new
        {
            t = "snap",
            title = s.Title,
            zone = s.Zone,
            dungeon = GameData.IsDungeonMap(mapId),
            active = s.IsActive,
            combatMs = s.CombatMs,
            total = s.TotalDamage,
            partyDps = s.PartyDps,
            fighting = s.Fighting,
            partial = s.MostDamageUnsent,
            boss = s.Boss is { } b ? new { name = b.Name, hp = b.Hp, maxHp = b.MaxHp } : null,
            target = tracker.MainTarget(null) is { } mt ? new { name = mt.NameKnown ? mt.Name : null, hp = mt.Hp, maxHp = mt.MaxHp, maxKnown = mt.MaxKnown, count = mt.Targets } : null,
            players = s.Combatants
                .Where(c => !c.IsUnknownSummons)
                .OrderByDescending(c => c.Damage)
                .Select(c => new
                {
                    id = c.ActorId,
                    hits = c.Hits,
                    crit = Math.Round(c.CritRate, 3),
                    maxHit = c.MaxHit,
                    name = c.Name,
                    cls = c.Class.ToString(),
                    self = c.IsSelf,
                    dmg = c.Damage,
                    dps = Math.Round(c.Dps),
                    share = Math.Round(c.Share, 4),
                    heal = c.Healing,
                    hps = s.CombatMs > 0 ? Math.Round(c.Healing / (s.CombatMs / 1000.0)) : 0,
                    gs = c.GearScore,
                    cp = c.CombatPower,
                }),
        });
    }
    CheckForeground();
    // пинг до игрового сервера: раз в 3 секунды, если изменился
    if (now - pingAt >= 3000)
    {
        pingAt = now;
        // Главный источник — сама игра: раз в ~10 секунд клиент шлёт серверу запрос пинга со своим временем, сервер возвращает его
        // в ответе (03 36). Это полный путь «клиент → ускоритель/VPN → сервер → обратно» — тот пинг, который реально у персонажа.
        // Пока ответа игры не было, показываем оценку (помечена «~»): ICMP до адреса сервера или подтверждения TCP.
        // Ответ быстрее 2–3 мс даёт не сервер, а местный посредник (ускоритель/VPN) — тогда оценки нет вовсе (-2).
        var icmp = icmpPing.Value(now);
        var passive = capture?.Ping.PingMs ?? -1;
        var lastUs = capture?.Ping.LastSampleUs ?? 0;
        if (lastUs > 0 && now - lastUs / 1000 > 15_000) passive = -1;
        var echo = capture?.Ping.LivePingMs(now) ?? -1;
        int ping; var est = false;
        if (echo >= 1) ping = echo;
        else if (icmp >= 2) { ping = icmp; est = true; }
        else if (passive >= 3) { ping = passive; est = true; }
        else ping = icmp >= 0 || passive >= 0 ? -2 : -1;
        var info = capture?.Ping.EchoInfo ?? (0, 0);
        var pk = HashCode.Combine(ping, est, info.Item1);
        if (pk != pingLast) { pingLast = pk; Emit(new { t = "ping", ms = ping, est, n = info.Item1 }); }
    }
    Thread.Sleep(250);
}

capture?.Dispose();
return 0;

// Пинг до сервера игры, как команда ping: эхо-запрос ICMP на адрес сервера раз в 2 секунды (в саму игру ничего не идёт).
// Работает и с ускорителями/VPN: они перехватывают соединение игры, а эхо-запрос идёт напрямую — это «прямой» пинг.
sealed class IcmpPinger(Func<System.Net.IPAddress?> target)
{
    private readonly object _gate = new();
    private readonly List<(long At, int Ms)> _samples = new();
    private int _fails;
    public void Start() => new Thread(Loop) { IsBackground = true, Name = "ping" }.Start();
    private void Loop()
    {
        using var p = new System.Net.NetworkInformation.Ping();
        var buf = new byte[32];
        while (true)
        {
            var ip = target();
            if (ip is not null && !System.Net.IPAddress.IsLoopback(ip))
            {
                try
                {
                    var r = p.Send(ip, 1500, buf);
                    var at = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                    lock (_gate)
                    {
                        if (r.Status == System.Net.NetworkInformation.IPStatus.Success)
                        {
                            _fails = 0;
                            _samples.Add((at, (int)r.RoundtripTime));
                            if (_samples.Count > 10) _samples.RemoveAt(0);
                        }
                        else _fails++;
                    }
                }
                catch { lock (_gate) _fails++; }
            }
            Thread.Sleep(2000);
        }
    }
    /// <summary>Медиана последних ответов; -1, если сервер не отвечает на эхо-запросы.</summary>
    public int Value(long now)
    {
        lock (_gate)
        {
            if (_fails >= 3) return -1;
            var recent = _samples.Where(x => now - x.At < 15_000).Select(x => x.Ms).OrderBy(x => x).ToArray();
            return recent.Length == 0 ? -1 : recent[recent.Length / 2];
        }
    }
}
