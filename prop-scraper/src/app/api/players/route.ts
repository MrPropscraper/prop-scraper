import { NextResponse } from "next/server";

type Player = { id: string; name: string; team?: string };

// Revalidate every 6 hours so we don't hammer the API
export const revalidate = 60 * 60 * 6;

/**
 * GET /api/players
 * Returns every active MLB player (id, name, team) sorted by name.
 * Uses MLB StatsAPI (no key needed). Falls back to a tiny list if anything fails.
 */
export async function GET() {
  try {
    // 1) fetch all MLB teams
    const teamsRes = await fetch("https://statsapi.mlb.com/api/v1/teams?sportId=1&activeStatus=Y");
    if (!teamsRes.ok) throw new Error("Teams fetch failed");
    const teamsData = await teamsRes.json();
    const teams: Array<{ id: number; abbr: string }> =
      (teamsData?.teams || []).map((t: any) => ({ id: t.id, abbr: t.abbreviation }));

    // 2) fetch each team’s active roster
    const rosterArrays = await Promise.all(
      teams.map(async (t) => {
        const r = await fetch(`https://statsapi.mlb.com/api/v1/teams/${t.id}/roster?rosterType=active`);
        if (!r.ok) return [];
        const j = await r.json();
        const players: Player[] = (j?.roster || []).map((e: any) => ({
          id: String(e.person.id),
          name: String(e.person.fullName),
          team: t.abbr,
        }));
        return players;
      })
    );

    // 3) dedupe + sort
    const map = new Map<string, Player>();
    for (const p of rosterArrays.flat()) if (!map.has(p.id)) map.set(p.id, p);
    const players = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ players });
  } catch {
    // tiny fallback so the UI never breaks
    return NextResponse.json({
      players: [
        { id: "592866", name: "Logan Webb", team: "SF" },
        { id: "621043", name: "Gerrit Cole", team: "NYY" },
        { id: "592789", name: "Luis Castillo", team: "SEA" },
      ],
    });
  }
}
