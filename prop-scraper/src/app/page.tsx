"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/* =============================== TYPES =============================== */

type Sport = "ALL" | "MLB" | "NBA" | "WNBA" | "Tennis" | "PGA" | "CS2";
type Platform = "PrizePicks" | "Parlay Play" | "Chalkboard";

type APIPick = {
  id: string | number;
  sport: Exclude<Sport, "ALL">;
  player: string;
  team?: string;
  platform: Platform;
  statUnit?: string; // "K", "PTS", etc.
  line: number;
  pickSide: "O" | "U";
  overMultiplier?: number;
  underMultiplier?: number;
  confidence?: number; // 0-100
  note?: string;
};

type PickWithUI = APIPick & {
  _lastLine?: number;
  _flash?: "up" | "down" | null;
  _flashUntil?: number;
};

/* ============================== CONFIG ============================== */

const SPORTS: Sport[] = ["ALL", "MLB", "NBA", "WNBA", "Tennis", "PGA", "CS2"];
const REFRESH_MS = 30_000; // auto-refresh interval

const EMOJI: Record<Sport, string> = {
  ALL: "🔥",
  MLB: "⚾",
  NBA: "🏀",
  WNBA: "👟", // fun vibe; swap to 🏀 if you prefer
  Tennis: "🎾",
  PGA: "⛳",
  CS2: "🎯",
};

/* ============================== PAGE ================================ */

export default function Page() {
  const [activeSport, setActiveSport] = useState<Sport>("ALL");
  const [picks, setPicks] = useState<PickWithUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // fetch board on mount + every REFRESH_MS
  useEffect(() => {
    let alive = true;

    const fetchAll = async () => {
      try {
        setLoading(true);
        const data = await loadBoardData();
        if (!alive) return;

        setPicks((prev) => mergeWithFlashes(prev, data));
        setLastUpdated(new Date());
      } catch {
        // keep previous if error
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchAll();
    timerRef.current = setInterval(fetchAll, REFRESH_MS);

    return () => {
      alive = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // remove flash class after animation ends
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setPicks((prev) =>
        prev.map((p) =>
          p._flashUntil && p._flashUntil <= now ? { ...p, _flash: null, _flashUntil: undefined } : p
        )
      );
    }, 250);
    return () => clearInterval(t);
  }, []);

  const shown = useMemo(
    () => picks.filter((p) => activeSport === "ALL" || p.sport === activeSport),
    [picks, activeSport]
  );

  return (
    <div style={styles.page}>
      {/* keyframes for emoji bounce + flashes */}
      <style>{`
        @keyframes tab-bounce {
          0%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
          60% { transform: translateY(-2px); }
        }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Prop Scraper</h1>
        <div style={styles.rightHeader}>
          {lastUpdated ? (
            <span style={styles.updated}>
              Updated {timeAgo(lastUpdated)}
            </span>
          ) : null}
          <button
            onClick={() => manualRefresh(setLoading, setPicks, setLastUpdated)}
            style={styles.refreshBtn}
            title="Refresh now"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Tabs with emojis */}
      <div style={styles.tabs}>
        {SPORTS.map((s) => {
          const isActive = activeSport === s;
          return (
            <button
              key={s}
              onClick={() => setActiveSport(s)}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  fontSize: 16,
                  lineHeight: 1,
                  marginRight: 6,
                  ...(isActive ? { animation: "tab-bounce 700ms ease" } : {}),
                }}
                aria-hidden
              >
                {EMOJI[s]}
              </span>
              <span>{s}</span>
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div style={styles.body}>
        {loading && picks.length === 0 ? (
          <div style={styles.empty}>Loading picks…</div>
        ) : shown.length === 0 ? (
          <div style={styles.empty}>No picks available.</div>
        ) : (
          <div style={styles.cards}>
            {shown.map((row) => (
              <PickCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </div>

      {/* Sticky bottom sport switcher (mobile) */}
      <div style={styles.bottomBar}>
        {SPORTS.map((s) => {
          const isActive = activeSport === s;
          return (
            <button
              key={s}
              onClick={() => setActiveSport(s)}
              style={{
                ...styles.bottomBtn,
                ...(isActive ? styles.bottomBtnActive : {}),
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  lineHeight: 1,
                  ...(isActive ? { animation: "tab-bounce 700ms ease" } : {}),
                }}
                aria-hidden
              >
                {EMOJI[s]}
              </span>
              <span style={{ fontSize: 11 }}>{s}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* =========================== COMPONENTS ============================= */

function PickCard({ row }: { row: PickWithUI }) {
  const percent = typeof row.confidence === "number" ? Math.round(row.confidence) : undefined;
  const flashStyle =
    row._flash === "up"
      ? styles.flashUp
      : row._flash === "down"
      ? styles.flashDown
      : undefined;

  const copyPick = async () => {
    const text = `${row.player} — ${row.platform} — ${row.pickSide} ${fmtLine(row.line)} ${row.statUnit ?? ""}`.trim();
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied!");
    } catch {
      toast("Copy failed");
    }
  };

  return (
    <div style={{ ...styles.card, ...(flashStyle ?? {}) }}>
      {/* Left: avatar + team */}
      <div style={styles.leftCol}>
        <Avatar name={row.player} />
        {row.team ? <span style={styles.teamBadge}>{row.team}</span> : null}
      </div>

      {/* Mid: pick info */}
      <div style={styles.midCol}>
        <div style={styles.pickRow}>
          <span
            style={{
              ...styles.side,
              color: row.pickSide === "O" ? "#60a5fa" : "#22c55e",
            }}
          >
            {row.pickSide}
          </span>
          <span style={styles.lineBig}>
            {fmtLine(row.line)} {row.statUnit ?? ""}
          </span>
          <span style={styles.playerName}>{row.player}</span>
        </div>

        <div style={styles.metaRow}>
          <span style={styles.platform}>{row.platform}</span>
          {typeof percent === "number" ? (
            <span style={{ ...styles.confBadge, ...confColor(percent) }}>
              {percent}% CONF
            </span>
          ) : null}
        </div>

        <div style={styles.bookRow}>
          <div style={styles.bookCol}>
            <div style={styles.bookLabel}>Over</div>
            <div style={styles.bookValue}>
              {row.overMultiplier ? row.overMultiplier.toFixed(2) + "x" : "—"}
            </div>
          </div>
          <div style={styles.divider} />
          <div style={styles.bookCol}>
            <div style={styles.bookLabel}>Under</div>
            <div style={styles.bookValue}>
              {row.underMultiplier ? row.underMultiplier.toFixed(2) + "x" : "—"}
            </div>
          </div>
        </div>

        {row.note ? <div style={styles.footerNote}>{row.note}</div> : null}
      </div>

      {/* Right: actions */}
      <div style={styles.rightCol}>
        <span style={styles.sportPill}>
          <span aria-hidden style={{ marginRight: 6 }}>{EMOJI[row.sport]}</span>
          {row.sport}
        </span>
        <button onClick={copyPick} style={styles.copyBtn} title="Copy pick">
          Copy
        </button>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((s) => s[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
  return (
    <div style={styles.avatarWrap}>
      <div style={styles.avatar}>{initials}</div>
    </div>
  );
}

/* ============================== DATA FX ============================== */

async function loadBoardData(): Promise<APIPick[]> {
  // Try /api/picks -> /api/board -> /api/lines?mode=all
  const urls = ["/api/picks", "/api/board", "/api/lines?mode=all"];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      // Expect either array or { picks: [...] }
      const arr = Array.isArray(data) ? data : Array.isArray(data?.picks) ? data.picks : null;
      if (arr && arr.length > 0) {
        // Normalize a bit
        return arr.map((x: any) => ({
          id: x.id ?? `${x.player}-${x.platform}-${x.sport}`,
          sport: x.sport,
          player: x.player,
          team: x.team,
          platform: x.platform,
          statUnit: x.statUnit ?? "",
          line: Number(x.line),
          pickSide: x.pickSide,
          overMultiplier: typeof x.overMultiplier === "number" ? x.overMultiplier : undefined,
          underMultiplier: typeof x.underMultiplier === "number" ? x.underMultiplier : undefined,
          confidence: typeof x.confidence === "number" ? x.confidence : undefined,
          note: x.note,
        })) as APIPick[];
      }
    } catch {
      // try next
    }
  }
  return [];
}

function mergeWithFlashes(prev: PickWithUI[], nextArr: APIPick[]): PickWithUI[] {
  const now = Date.now();
  const prevMap = new Map<string | number, PickWithUI>();
  prev.forEach((p) => prevMap.set(p.id, p));

  return nextArr.map((n) => {
    const old = prevMap.get(n.id);
    if (!old) return { ...n, _lastLine: n.line, _flash: null };

    let flash: PickWithUI["_flash"] = null;
    if (typeof old.line === "number" && typeof n.line === "number" && old.line !== n.line) {
      flash = n.line > old.line ? "up" : "down";
    }
    return {
      ...n,
      _lastLine: old.line,
      _flash: flash,
      _flashUntil: flash ? now + 1200 : undefined, // 1.2s flash
    };
  });
}

async function manualRefresh(
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setPicks: React.Dispatch<React.SetStateAction<PickWithUI[]>>,
  setLastUpdated: React.Dispatch<React.SetStateAction<Date | null>>
) {
  try {
    setLoading(true);
    const data = await loadBoardData();
    setPicks((prev) => mergeWithFlashes(prev, data));
    setLastUpdated(new Date());
  } finally {
    setLoading(false);
  }
}

/* ============================== STYLES =============================== */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg,#061018 0%, #0a1016 100%)",
    color: "#E7E7E7",
    padding: 16,
    fontFamily: "Inter, system-ui, Arial, sans-serif",
    maxWidth: 980,
    margin: "0 auto",
    position: "relative",
    paddingBottom: 74, // space for sticky bottom bar
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: 800, letterSpacing: 0.3 },
  rightHeader: { display: "flex", alignItems: "center", gap: 8 },
  updated: { fontSize: 12, color: "#9AA0A6" },
  refreshBtn: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#E7E7E7",
    borderRadius: 10,
    padding: "6px 10px",
    cursor: "pointer",
  },
  tabs: {
    display: "flex",
    gap: 10,
    margin: "6px 0 14px",
    flexWrap: "wrap",
  },
  tab: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.04)",
    color: "#cbd5e1",
    fontSize: 13,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  tabActive: {
    background: "rgba(63,131,248,0.18)",
    border: "1px solid rgba(63,131,248,0.35)",
    color: "#e5f0ff",
  },
  body: { display: "grid" },
  cards: { display: "grid", gap: 14 },
  card: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
    border: "1px solid rgba(255,255,255,0.08)",
    transition: "background-color 300ms ease, box-shadow 300ms ease, border-color 300ms ease",
  },
  flashUp: {
    boxShadow: "0 0 0 999px rgba(16,185,129,0.10) inset",
    borderColor: "rgba(16,185,129,0.35)",
  },
  flashDown: {
    boxShadow: "0 0 0 999px rgba(239,68,68,0.10) inset",
    borderColor: "rgba(239,68,68,0.35)",
  },
  leftCol: { display: "flex", alignItems: "center", gap: 8 },
  midCol: { display: "grid", gap: 8, alignContent: "center" },
  rightCol: { display: "grid", alignContent: "center", textAlign: "right", gap: 8 },
  playerName: { fontWeight: 800, color: "#e5e7eb" },
  pickRow: { display: "flex", alignItems: "baseline", gap: 10, fontSize: 20, fontWeight: 800, flexWrap: "wrap" },
  side: { fontWeight: 900, letterSpacing: 0.4 },
  lineBig: { fontWeight: 900, color: "#e2e8f0" },
  metaRow: { display: "flex", alignItems: "center", gap: 10, color: "#A3B0BD", fontSize: 13, flexWrap: "wrap" },
  platform: { color: "#cbd5e1", fontWeight: 600 },
  confBadge: {
    padding: "3px 8px",
    borderRadius: 999,
    fontWeight: 800,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
  },
  bookRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1px 1fr",
    alignItems: "center",
  },
  bookCol: { display: "grid", gap: 4 },
  bookLabel: { color: "#9AA0A6", fontSize: 12 },
  bookValue: { fontWeight: 800, fontSize: 16 },
  divider: { width: 1, height: 24, background: "rgba(255,255,255,0.12)", margin: "0 8px" },
  footerNote: { marginTop: 6, color: "#9AA0A6", fontSize: 13 },
  teamBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 28,
    height: 28,
    padding: "0 6px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    fontSize: 12,
    color: "#e2e8f0",
    letterSpacing: 0.3,
  },
  avatarWrap: { width: 48, height: 48, borderRadius: "50%", overflow: "hidden", border: "2px solid #2B3340" },
  avatar: {
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
    background: "radial-gradient(45% 45% at 50% 50%, #0f172a, #1f2937)",
    color: "#E8EEF9",
    fontWeight: 800,
    fontSize: 16,
  },
  sportPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    color: "#d1d5db",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    justifySelf: "end",
  },
  copyBtn: {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#E7E7E7",
    cursor: "pointer",
    fontWeight: 700,
  },
  empty: {
    padding: 18,
    textAlign: "center",
    color: "#9AA0A6",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
  },
  bottomBar: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 8,
    margin: "0 auto",
    maxWidth: 980,
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 6,
    padding: 6,
    borderRadius: 12,
    background: "rgba(8,12,16,0.8)",
    border: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(6px)",
  },
  bottomBtn: {
    display: "grid",
    placeItems: "center",
    gap: 4,
    padding: "6px 4px",
    color: "#cbd5e1",
    borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  bottomBtnActive: {
    color: "#e5f0ff",
    background: "rgba(63,131,248,0.18)",
    border: "1px solid rgba(63,131,248,0.35)",
  },
};

/* ============================== HELPERS ============================== */

function fmtLine(n?: number) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  // keep .5/.0 as they are
  return n % 1 === 0 ? `${n.toFixed(1)}` : `${n}`;
}

function confColor(v: number) {
  if (v >= 80) return { color: "#86efac", borderColor: "rgba(134,239,172,0.35)" };
  if (v >= 65) return { color: "#93c5fd", borderColor: "rgba(147,197,253,0.35)" };
  return { color: "#fca5a5", borderColor: "rgba(252,165,165,0.35)" };
}

function timeAgo(d: Date) {
  const s = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function toast(msg: string) {
  // ultra-lightweight toast
  const id = "mini-toast";
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    Object.assign(el.style, {
      position: "fixed",
      left: "50%",
      transform: "translateX(-50%)",
      bottom: "84px",
      background: "rgba(0,0,0,0.8)",
      color: "#fff",
      padding: "8px 12px",
      borderRadius: "10px",
      fontSize: "13px",
      zIndex: "9999",
      transition: "opacity 200ms ease",
    } as CSSStyleDeclaration);
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = "1";
  setTimeout(() => (el!.style.opacity = "0"), 1200);
}
