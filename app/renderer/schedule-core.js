// Движок расписания: повторяющиеся ивенты -> конкретные моменты времени. Работает и в главном процессе, и в окнах.
(function (root) {
  'use strict';
  const REGIONS = {
    EU: { name: 'Европа', tz: 'Europe/Berlin' },
    NAE: { name: 'Северная Америка — Восток', tz: 'America/New_York' },
    NAW: { name: 'Северная Америка — Запад', tz: 'America/Los_Angeles' },
    LA: { name: 'Южная Америка', tz: 'America/Sao_Paulo' },
    AS: { name: 'Азия', tz: 'Asia/Singapore' },
    JP: { name: 'Япония', tz: 'Asia/Tokyo' },
  };
  const DAY = 86400000;
  // Часы серверов AION 2 Global (общие для всех регионов). Можно переопределить в файле расписания: serverTz.
  const SERVER_TZ = 'Asia/Seoul';
  const fmts = {};
  function parts(ms, tz) {
    const f = fmts[tz] || (fmts[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short' }));
    const o = {};
    for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
    return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second, wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(o.weekday) };
  }
  function offset(ms, tz) { const p = parts(ms, tz); return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000; }
  function zoned(y, mo, d, h, mi, tz) {
    const guess = Date.UTC(y, mo - 1, d, h, mi);
    let t = guess - offset(guess, tz);
    t = guess - offset(t, tz);
    return t;
  }
  function tzOf(rule, region) {
    if (rule.tz === 'utc') return 'UTC';
    if (rule.tz === 'region') return (REGIONS[region] || REGIONS.EU).tz;
    return Intl.DateTimeFormat().resolvedOptions().timeZone; // local
  }
  // Начала ивента, пересекающие [from, to].
  function occurrences(ev, from, to, region) {
    const r = ev.rule || {}, dur = (ev.duration || 0) * 60000, out = [];
    if (r.kind === 'interval') {
      const step = Math.max(1, r.everyMin || 60) * 60000;
      const [ah, am] = String(r.anchorUtc || '00:00').split(':').map(Number);
      const base = Date.UTC(2026, 0, 1, ah, am);
      let t = base + Math.ceil((from - dur - base) / step) * step;
      for (; t <= to; t += step) out.push(t);
    } else if (r.kind === 'weekly') {
      const tz = tzOf(r, region);
      const [hh, mm] = String(r.time || '00:00').split(':').map(Number);
      const seen = new Set();
      for (let x = from - dur - DAY; x <= to + DAY; x += DAY) {
        const p = parts(x, tz);
        const key = p.y + '-' + p.mo + '-' + p.d;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!(r.days || []).includes(p.wd)) continue;
        const t = zoned(p.y, p.mo, p.d, hh, mm, tz);
        if (t + dur >= from && t <= to) out.push(t);
      }
      out.sort((a, b) => a - b);
    }
    return out;
  }
  // Ивент пользователя (старый формат: days + time по местному времени) -> правило.
  function fromCustom(e) { return { ...e, custom: true, rule: { kind: 'weekly', days: e.days || [], time: e.time || '00:00', tz: 'local' } }; }
  // Части даты в нужном часовом поясе — для показа времени по часам сервера.
  const api = { REGIONS, SERVER_TZ, occurrences, fromCustom, parts, zoned };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ScheduleCore = api;
})(this);
