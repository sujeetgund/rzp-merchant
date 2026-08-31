import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const SESSION_COOKIE = "rzp_sid";
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function POST() {
  const newSessionId = crypto.randomUUID();
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, newSessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });

  return NextResponse.json({ success: true, sessionId: newSessionId });
}
