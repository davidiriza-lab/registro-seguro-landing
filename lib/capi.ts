import { createHash } from "node:crypto";

/** Envío mínimo a la Conversions API de Meta desde el servidor.
 *  Este archivo NO viene en la guía (ahí se importa como pieza dada); es una
 *  versión funcional para que route.ts compile. La deduplicación con el píxel
 *  de navegador depende de mandar el mismo eventId en ambos lados. */

interface CapiInput {
  eventName: string;
  eventId: string;
  email: string;
  telefono: string; // E.164
  nombre: string;
  ip: string;
  userAgent: string;
  fbp: string | null;
  fbc: string | null;
  sourceUrl: string;
}
type Resultado = { ok: true } | { ok: false; motivo: string };

function sha256(v: string): string {
  return createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
}

export async function enviarCapi(input: CapiInput): Promise<Resultado> {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixelId || !token) return { ok: false, motivo: "sin META_PIXEL_ID o META_CAPI_TOKEN" };

  const [firstName, ...resto] = input.nombre.split(" ");
  const userData: Record<string, string | string[]> = {
    em: [sha256(input.email)],
    ph: [sha256(input.telefono.replace(/\D/g, ""))],
    fn: [sha256(firstName ?? "")],
    client_ip_address: input.ip,
    client_user_agent: input.userAgent,
  };
  if (resto.length) userData.ln = [sha256(resto.join(" "))];
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;

  const payload = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: input.sourceUrl,
        user_data: userData,
      },
    ],
  };

  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) return { ok: true };
    return { ok: false, motivo: `${r.status} ${await r.text()}` };
  } catch (e) {
    return { ok: false, motivo: String(e) };
  }
}
