import { cookies, headers } from "next/headers";

export const SESSION_COOKIE = "rzp_sid";
const SESSION_HEADER = "x-rzp-sid";

/**
 * Reads the visitor session id set by proxy.ts. On the very first request
 * from a new visitor, the `Set-Cookie` written by proxy.ts hasn't reached
 * the browser yet, so proxy.ts also forwards it as a request header —
 * that's the value we must use for this request to stay consistent with
 * the cookie the browser is about to store. Every later request reads it
 * straight from the cookie.
 */
export async function getSessionId(): Promise<string> {
  const headerList = await headers();
  const fromHeader = headerList.get(SESSION_HEADER);
  if (fromHeader) return fromHeader;

  const store = await cookies();
  const existing = store.get(SESSION_COOKIE)?.value;
  if (existing) return existing;

  return crypto.randomUUID();
}
