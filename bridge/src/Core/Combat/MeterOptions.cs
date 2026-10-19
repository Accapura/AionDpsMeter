namespace AionMeter.Core.Combat;

public enum TargetMode
{
    /// <summary>Count damage to bosses only; falls back to everything while no boss is engaged.</summary>
    BossOnly,
    All,
}

public sealed class MeterOptions
{
    public TargetMode TargetMode { get; set; } = TargetMode.BossOnly;
    /// <summary>Режим «Данж: Босс»: считаем только бои в подземельях; в открытом мире (в том числе с мировыми боссами) не считаем.</summary>
    public bool DungeonOnly { get; set; }
    /// <summary>Блоки кодов NPC полевых (мировых) боссов: нужны, пока карта неизвестна (метр запущен уже внутри подземелья).</summary>
    public HashSet<int> FieldBlocks { get; } = new();
    /// <summary>Режим «Манекен»: считаем только удары по тренировочным манекенам; в остальных режимах манекены не считаются.</summary>
    public bool DummyMode { get; set; }
    /// <summary>Длина теста на манекене, секунды (0 — без ограничения). Тест идёт от первого удара.</summary>
    public int DummySeconds { get; set; } = 60;

    /// <summary>End the segment after this long without outgoing damage (no boss alive).</summary>
    public int IdleTimeoutMs { get; set; } = 10_000;

    /// <summary>Longer timeout while a boss is still alive — covers invulnerable phases and cut-scenes.</summary>
    public int BossIdleTimeoutMs { get; set; } = 30_000;

    /// <summary>Single hits above this are treated as parse errors and dropped.</summary>
    public long MaxSingleHit { get; set; } = 50_000_000;

    /// <summary>Segments shorter than this are not saved to history.</summary>
    public int MinSavedFightMs { get; set; } = 5_000;

    /// <summary>How many finished segments to keep in memory for the segment picker.</summary>
    public int MaxSegments { get; set; } = 30;
}
