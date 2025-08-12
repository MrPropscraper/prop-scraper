import { NextResponse } from "next/server";

// Store session cookies in memory (for testing only)
let prizePicksSessionCookie: string | null = null;

export async function POST(req: Request) {
  try {
    const { platform, email, password } = await req.json();

    if (!platform || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (platform === "PrizePicks") {
      const resp = await fetch("https://api.prizepicks.com/users/sign_in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0"
        },
        body: JSON.stringify({
          user: {
            email,
            password
          }
        })
      });

      if (!resp.ok) {
        return NextResponse.json({ error: "Login failed" }, { status: 401 });
      }

      const cookies = resp.headers.get("set-cookie");
      if (cookies) {
        prizePicksSessionCookie = cookies.split(";")[0]; // Store only session
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Platform not supported" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Export for use in /api/lines
export function getPrizePicksSessionCookie() {
  return prizePicksSessionCookie;
}
