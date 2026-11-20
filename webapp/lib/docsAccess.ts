/**
 * Who can see /docs, and when. Shared by middleware.ts (edge) and /api/docs-admin (server).
 *
 * Settings come from environment variables so an admin can change them in the Vercel dashboard
 * (Settings → Environment Variables, then Redeploy) without touching code:
 *   DOCS_ENABLED       "true" | "false"           master switch (default true)
 *   DOCS_START         ISO date-time with offset   window opens   (default 2026-11-20T00:00:00+06:00)
 *   DOCS_END           ISO date-time with offset   window closes  (default 2027-01-31T23:59:59+06:00)
 *   DOCS_DURATION_DAYS number                      optional: window = start + N days (overrides DOCS_END)
 *   DOCS_ADMIN_TOKEN   secret string               admins sign in at /docs/admin with this; admins can always
 *                                                  preview /docs, even when it is off or outside the window
 */

export interface DocsAccess {
  enabled: boolean;
  start: string;
  end: string;
  durationDays: number | null;
  adminConfigured: boolean;
}

export const DEFAULT_START = "2026-11-20T00:00:00+06:00";
export const DEFAULT_END = "2027-01-31T23:59:59+06:00";
export const ADMIN_COOKIE = "nn_docs_admin";

export function readAccess(env: Record<string, string | undefined>): DocsAccess {
  const start = env.DOCS_START || DEFAULT_START;
  const dur = env.DOCS_DURATION_DAYS ? Number(env.DOCS_DURATION_DAYS) : NaN;
  const durationDays = Number.isFinite(dur) && dur > 0 ? dur : null;
  const startMs = Date.parse(start);
  const end = durationDays !== null && Number.isFinite(startMs)
    ? new Date(startMs + durationDays * 86400000).toISOString()
    : env.DOCS_END || DEFAULT_END;
  return {
    enabled: (env.DOCS_ENABLED ?? "true").toLowerCase() !== "false",
    start,
    end,
    durationDays,
    adminConfigured: Boolean(env.DOCS_ADMIN_TOKEN),
  };
}

export type DocsState = "open" | "off" | "not-yet" | "closed";

export function docsState(a: DocsAccess, now = Date.now()): DocsState {
  if (!a.enabled) return "off";
  const s = Date.parse(a.start), e = Date.parse(a.end);
  if (Number.isFinite(s) && now < s) return "not-yet";
  if (Number.isFinite(e) && now > e) return "closed";
  return "open";
}

/** SHA-256 hex of the admin token. The cookie stores this, never the token itself. */
export async function tokenHash(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`nodinajar-docs:${token}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isAdmin(cookieValue: string | undefined, env: Record<string, string | undefined>): Promise<boolean> {
  if (!cookieValue || !env.DOCS_ADMIN_TOKEN) return false;
  return cookieValue === (await tokenHash(env.DOCS_ADMIN_TOKEN));
}

const fmt = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toUTCString().replace("GMT", "UTC") : iso;
};

export function closedPage(state: DocsState, a: DocsAccess): string {
  const why = state === "off"
    ? "The team has switched the documentation off for now."
    : state === "not-yet"
      ? `It opens on ${fmt(a.start)}.`
      : `The viewing window closed on ${fmt(a.end)}.`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NodiNajar docs · not available</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3efe6;color:#15282e;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.box{max-width:520px;padding:40px;background:#fff;border:1px solid #e7e0d3;border-radius:22px;box-shadow:0 8px 28px rgba(21,40,46,.07);text-align:center}
h1{font-family:Georgia,serif;font-weight:600;margin:0 0 10px;font-size:28px}p{color:#5d6e72;line-height:1.55}a{color:#0f7c8c;font-weight:600}
.code{display:inline-block;margin-bottom:14px;padding:4px 12px;border-radius:999px;background:#fbefd5;color:#8a5a00;font-size:12px;font-weight:700;letter-spacing:.08em}</style></head>
<body><div class="box"><span class="code">403 · NOT AVAILABLE</span><h1>Docs are not available right now</h1>
<p>${why}</p><p><a href="/">Open the NodiNajar app</a> · <a href="/docs/admin/">Admin sign-in</a></p></div></body></html>`;
}
