import type { NextRequest } from "next/server";

/** Ventana fija en memoria. Suficiente contra un bot tonto y contra el doble
 *  clic; en serverless cada instancia tiene su propio mapa, así que no es un
 *  límite global. Para eso usa un store compartido (Redis/Upstash). */
const buckets = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  b.n += 1;
  return b.n <= max;
}

export function ipDe(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "";
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}
