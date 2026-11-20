import { cookies } from "next/headers";
import { ADMIN_COOKIE, docsState, isAdmin, readAccess, tokenHash } from "@/lib/docsAccess";

export const dynamic = "force-dynamic";

const env = () => ({
  DOCS_ENABLED: process.env.DOCS_ENABLED,
  DOCS_START: process.env.DOCS_START,
  DOCS_END: process.env.DOCS_END,
  DOCS_DURATION_DAYS: process.env.DOCS_DURATION_DAYS,
  DOCS_ADMIN_TOKEN: process.env.DOCS_ADMIN_TOKEN,
} as Record<string, string | undefined>);

async function status() {
  const e = env();
  const access = readAccess(e);
  const jar = await cookies();
  return {
    access,
    state: docsState(access),
    admin: await isAdmin(jar.get(ADMIN_COOKIE)?.value, e),
    now: new Date().toISOString(),
    // Which settings come from Vercel env vars (true) and which are the built-in defaults (false).
    fromEnv: { DOCS_ENABLED: Boolean(e.DOCS_ENABLED), DOCS_START: Boolean(e.DOCS_START), DOCS_END: Boolean(e.DOCS_END), DOCS_DURATION_DAYS: Boolean(e.DOCS_DURATION_DAYS) },
  };
}

/** Current visibility, window and whether this browser is signed in as admin. */
export async function GET() {
  return Response.json(await status(), { headers: { "cache-control": "no-store" } });
}

/** Admin sign-in: body { token }. Sets an httpOnly cookie holding a hash of the token. */
export async function POST(req: Request) {
  const expected = env().DOCS_ADMIN_TOKEN;
  if (!expected) return Response.json({ error: "Admin sign-in is not set up: add DOCS_ADMIN_TOKEN in Vercel." }, { status: 503 });
  let token = "";
  try { token = String(((await req.json()) as { token?: unknown }).token ?? ""); } catch { /* empty body */ }
  // Small fixed delay so guesses are slow.
  await new Promise((r) => setTimeout(r, 400));
  if (!token || token !== expected) return Response.json({ error: "Wrong admin token." }, { status: 401 });
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, await tokenHash(expected), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  return Response.json(await status());
}

/** Sign out. */
export async function DELETE() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  return Response.json({ ok: true });
}
