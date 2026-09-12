// Free live football events — no API key required
// Sources: TheSportsDB livescore (free) + ESPN scoreboard (free, no key)
// Returns unified LiveEvent[] for Live TV header. Good signal: polls every 60s.

export interface LiveEvent {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number | null;
  awayScore?: number | null;
  status: string; // 'LIVE', 'HT', 'FT', 'NS', '1H', '2H'
  minute?: string;
  time?: string;
  strEvent?: string;
}

const THESPORTSDB_LIVESCORE = 'https://www.thesportsdb.com/api/v1/json/3/livescore.php?s=Soccer';
const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard'; // EPL as default, fallback tries multiple leagues

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

async function fetchTheSportsDB(): Promise<LiveEvent[]> {
  try {
    const res = await fetch(THESPORTSDB_LIVESCORE);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const events: any[] = data.events ?? data.livescore ?? [];
    return events.slice(0, 12).map((e: any, i: number) => ({
      id: e.idEvent ?? e.idLiveScore ?? `tsdb-${i}`,
      league: e.strLeague ?? e.strSport ?? 'Live',
      homeTeam: e.strHomeTeam ?? e.homeTeam ?? 'Home',
      awayTeam: e.strAwayTeam ?? e.awayTeam ?? 'Away',
      homeScore: e.intHomeScore != null ? Number(e.intHomeScore) : e.intHomeScore,
      awayScore: e.intAwayScore != null ? Number(e.intAwayScore) : e.intAwayScore,
      status: e.strStatus ?? e.strProgress ?? 'LIVE',
      minute: e.strProgress ?? e.strTime,
      time: e.strTime ?? e.dateEvent,
      strEvent: e.strEvent ?? `${e.strHomeTeam} vs ${e.strAwayTeam}`,
    }));
  } catch (e) {
    console.warn('[liveEvents] TheSportsDB failed', e);
    return [];
  }
}

async function fetchESPN(): Promise<LiveEvent[]> {
  // Try EPL + LaLiga + UCL + Saudi — free endpoints
  const leagues = ['eng.1', 'esp.1', 'uefa.champions', 'ksa.1'];
  for (const lg of leagues) {
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/scoreboard`);
      if (!res.ok) continue;
      const data = await res.json();
      const events: any[] = data.events ?? [];
      if (events.length === 0) continue;
      return events.slice(0, 10).map((ev: any) => {
        const c = ev.competitions?.[0];
        const comp = c?.competitors ?? [];
        const home = comp.find((x: any) => x.homeAway === 'home') ?? comp[0];
        const away = comp.find((x: any) => x.homeAway === 'away') ?? comp[1];
        return {
          id: ev.id,
          league: ev.league?.name ?? c?.league?.name ?? lg,
          homeTeam: home?.team?.displayName ?? home?.team?.abbreviation ?? 'Home',
          awayTeam: away?.team?.displayName ?? away?.team?.abbreviation ?? 'Away',
          homeScore: home?.score != null ? Number(home.score) : null,
          awayScore: away?.score != null ? Number(away.score) : null,
          status: c?.status?.type?.state === 'in' ? 'LIVE' : c?.status?.type?.description ?? 'NS',
          minute: c?.status?.displayClock ?? '',
          time: ev.date,
          strEvent: ev.name,
        } as LiveEvent;
      });
    } catch {}
  }
  return [];
}

export async function fetchLiveEvents(): Promise<LiveEvent[]> {
  const [a, b] = await Promise.all([fetchTheSportsDB(), fetchESPN()]);
  // Merge, dedupe by id
  const map = new Map<string, LiveEvent>();
  for (const e of [...a, ...b]) {
    if (!map.has(e.id)) map.set(e.id, e);
  }
  const merged = [...map.values()];
  // Sort live first
  merged.sort((x, y) => (x.status === 'LIVE' ? -1 : 1));
  return merged.slice(0, 12);
}
