using AionMeter.Core.Events;

namespace AionMeter.Core.Combat;

/// <summary>AionDps: один удар (или лечение) по своему персонажу. Ms — за сколько миллисекунд до смерти.</summary>
public sealed record RecapEntry(long Ms, string Source, string Skill, long Amount, bool Crit, bool Heal);

/// <summary>AionDps: что прилетело в своего персонажа за последние секунды перед смертью.</summary>
public sealed record DeathRecap(long TimeMs, string? Zone, string? Boss, IReadOnlyList<RecapEntry> Entries);

public sealed partial class CombatTracker
{
    private const long RecapWindowMs = 12_000;
    private readonly List<(long TimeMs, uint Source, int Skill, long Amount, bool Crit, bool Heal)> _recap = new();
    private DeathRecap? _pendingDeath;

    /// <summary>Свой персонаж погиб (вызывается вне блокировки).</summary>
    public event Action<DeathRecap>? SelfDied;

    /// <summary>Под блокировкой: запоминаем удары и лечение по себе, на смерти собираем разбор.</summary>
    private void RecapNote(GameEvent e)
    {
        if (_entities.SelfId is not { } me) return;
        switch (e)
        {
            case DamageEvent d when d.TargetId == me && d.Damage > 0 && d.SourceId != me && !_data.IsNonDamageSkill(d.SkillCode):
                _recap.Add((d.TimeMs, d.SourceId, d.SkillCode, d.Damage, (d.Flags & HitFlags.Critical) != 0, false));
                break;
            case HealEvent h when h.TargetId == me && h.Amount > 0:
                _recap.Add((h.TimeMs, h.SourceId, h.SkillCode, h.Amount, (h.Flags & HitFlags.Critical) != 0, true));
                break;
            case DeathEvent death when death.ActorId == me && !death.AlreadyDead:
                BuildRecap(death.TimeMs);
                return;
            case NpcHpEvent hp when hp.ActorId == me && !hp.IsNpc && hp.CurrentHp == 0 && hp.MaxHp > 0:
                BuildRecap(hp.TimeMs); // HP своего персонажа упало до нуля (если отдельного пакета смерти нет)
                return;
            default:
                return;
        }
        // старше окна — не нужно
        var cut = e.TimeMs - RecapWindowMs;
        var drop = 0;
        while (drop < _recap.Count && _recap[drop].TimeMs < cut) drop++;
        if (drop > 0) _recap.RemoveRange(0, drop);
        if (_recap.Count > 400) _recap.RemoveRange(0, _recap.Count - 400);
    }

    private void BuildRecap(long deathMs)
    {
        var from = deathMs - RecapWindowMs;
        var list = new List<RecapEntry>();
        foreach (var r in _recap)
        {
            if (r.TimeMs < from || r.TimeMs > deathMs + 1000) continue;
            list.Add(new RecapEntry(Math.Max(0, deathMs - r.TimeMs), WhoIs(r.Source), _data.SkillName(r.Skill), r.Amount, r.Crit, r.Heal));
        }
        _recap.Clear();
        if (list.Count == 0) return;
        _pendingDeath = new DeathRecap(deathMs, _entities.ZoneName, _current is { IsActive: true } enc ? enc.BossName : null, list);
    }

    private string WhoIs(uint id)
    {
        var owner = _entities.ResolveOwner(id);
        if (_entities.TryGetPlayer(owner, out var p) && p.Name.Length > 0) return p.Name;
        return _entities.NpcName(owner);
    }

    private void RecapFlush()
    {
        DeathRecap? d;
        lock (_gate) { d = _pendingDeath; _pendingDeath = null; }
        if (d is not null) SelfDied?.Invoke(d);
    }
}
