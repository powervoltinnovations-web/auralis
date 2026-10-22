import { NextResponse, type NextRequest } from "next/server";
import { securityHeaders } from "./lib/security";
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const headers = securityHeaders(
    nonce,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NODE_ENV !== "production",
  );
  const incoming = new Headers(request.headers);
  incoming.set("x-nonce", nonce);
  incoming.set("Content-Security-Policy", headers["Content-Security-Policy"]);
  const response = NextResponse.next({ request: { headers: incoming } });
  for (const [key, value] of Object.entries(headers))
    response.headers.set(key, value);
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
