import { NextResponse } from "next/server";
import { getPrizePicksSessionCookie } from "../login/route";

function normalizeString(str: string) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");
  const playerName = searchParams.get("playerName") || "";

  if (!platform || !playerName) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  if (platform === "PrizePicks") {
    const cookie = getPrizePicksSessionCookie();
    if (!cookie) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const resp = await fetch("https://api.prizepicks.com/projections", {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0",
        "Cookie": cookie
      }
    });

    if (!resp.ok) {
      return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
    }

    const data: unknown = await resp.json();
    const projections = Array.isArray((data as { data?: unknown[] }).data)
      ? (data as { data: unknown[] }).data
      : [];
    type Projection = { attributes?: { name?: string; stat_type?: string; line_score?: number } };
    const searchName = normalizeString(playerName);

    const projection = (projections as Projection[]).find(
      (p) =>
        normalizeString(p.attributes?.name || "").includes(searchName) &&
        normalizeString(p.attributes?.stat_type || "") === "pitcher strikeouts"
    );

    if (projection) {
      return NextResponse.json({
        player: projection.attributes.name,
        statType: projection.attributes.stat_type,
        line: projection.attributes.line_score
      });
    } else {
      return NextResponse.json({ error: "Line not found" }, { status: 404 });
    }
  }

  return NextResponse.json({ error: "Platform not supported" }, { status: 400 });
}
