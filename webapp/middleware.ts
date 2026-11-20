import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, closedPage, docsState, isAdmin, readAccess } from "@/lib/docsAccess";

/**
 * Gate /docs by the admin switch and viewing window (see lib/docsAccess.ts).
 * Checked on every request, so the window opens and closes on time without a redeploy.
 * /docs/admin is never gated: it is where admins sign in.
 */
export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path.startsWith("/docs/admin")) return NextResponse.next();
  const env = ({
  DOCS_ENABLED: process.env.DOCS_ENABLED,
  DOCS_START: process.env.DOCS_START,
  DOCS_END: process.env.DOCS_END,
  DOCS_DURATION_DAYS: process.env.DOCS_DURATION_DAYS,
  DOCS_ADMIN_TOKEN: process.env.DOCS_ADMIN_TOKEN,
} as Record<string, string | undefined>);
  const access = readAccess(env);
  const state = docsState(access);
  if (state === "open") return NextResponse.next();
  if (await isAdmin(req.cookies.get(ADMIN_COOKIE)?.value, env)) {
    const res = NextResponse.next();
    res.headers.set("x-docs-preview", state);
    return res;
  }
  return new NextResponse(closedPage(state, access), {
    status: 403,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export const config = { matcher: ["/docs", "/docs/:path*"] };
