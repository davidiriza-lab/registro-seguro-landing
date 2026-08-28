import { NextRequest, NextResponse, after } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { normalizarTelefono, validarTelefono } from "@/lib/telefono";
import { rateLimit, ipDe } from "@/lib/rate-limit";
import { upsertCrm } from "@/lib/crm";
import { enviarCapi } from "@/lib/capi";

/** Presupuesto del lambda. Sin esto corre con el default de la plataforma y
 *  el trabajo de after() puede morir a la mitad sin dejar rastro. */
export const maxDuration = 30;

interface RegistroBody {
  nombre?: unknown;
  email?: unknown;
  telefono?: unknown;
  pais?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  utm_content?: unknown;
  utm_term?: unknown;
  event_id?: unknown;
  fbp?: unknown;
  fbc?: unknown;
  /** Honeypot: campo oculto que un humano nunca llena. */
  website?: unknown;
}

interface RegistroValido {
  nombre: string;
  email: string;
  telefono: string;
  pais: "MX" | "US" | "OTRO";
  utm: Record<"utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term", string | null>;
  eventId: string;
  fbp: string | null;
  fbc: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function utm(v: unknown): string | null {
  let s = str(v, 256);
  try { s = decodeURIComponent(s.replace(/\+/g, " ")).trim(); } catch { /* se queda como venía */ }
  // Plantillas sin rellenar de la plataforma de anuncios: {{campaign.name}}
  if (/^\{\{.+\}\}$/.test(s)) return null;
  return s || null;
}

function validar(body: RegistroBody): { ok: true; data: RegistroValido } | { ok: false; error: string } {
  const nombre = str(body.nombre, 120);
  const email = str(body.email, 254).toLowerCase();
  const paisRaw = str(body.pais, 2).toUpperCase();
  const pais: RegistroValido["pais"] = paisRaw === "MX" || paisRaw === "US" ? paisRaw : "OTRO";
  const telefono = normalizarTelefono(str(body.telefono, 32), pais);

  if (nombre.length < 2) return { ok: false, error: "Escribe tu nombre." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Revisa tu correo." };
  const errTel = validarTelefono(telefono);
  if (errTel) return { ok: false, error: errTel };

  const eventId = str(body.event_id, 64) || crypto.randomUUID();

  return {
    ok: true,
    data: {
      nombre, email, telefono, pais, eventId,
      utm: {
        utm_source: utm(body.utm_source),
        utm_medium: utm(body.utm_medium),
        utm_campaign: utm(body.utm_campaign),
        utm_content: utm(body.utm_content),
        utm_term: utm(body.utm_term),
      },
      fbp: str(body.fbp, 128) || null,
      fbc: str(body.fbc, 256) || null,
    },
  };
}

export async function POST(req: NextRequest) {
  // 1. Rate limit por IP: 10 registros por minuto es de sobra para humanos.
  const ip = ipDe(req);
  if (!rateLimit(`registro:${ip}`, 10, 60_000)) {
    return NextResponse.json({ ok: false, error: "Demasiados intentos. Espera un momento." }, { status: 429 });
  }

  // 2. JSON válido
  let body: RegistroBody;
  try {
    body = (await req.json()) as RegistroBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // 3. Honeypot: si el campo oculto trae algo, es un bot. Se le responde OK
  //    para que no aprenda, y no se guarda nada.
  if (str(body.website, 10).length > 0) {
    return NextResponse.json({ ok: true });
  }

  // 4. Validación y normalización
  const v = validar(body);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
  }
  const d = v.data;

  const userAgent = req.headers.get("user-agent") ?? "";
  const ipCountry = req.headers.get("x-vercel-ip-country") ?? null;

  // 5. La ÚNICA escritura que se espera: si esto falla, el registro no existe.
  const supabase = getSupabaseServer();
  const { error } = await supabase.from("registros").insert({
    nombre: d.nombre,
    email: d.email,
    telefono: d.telefono,
    pais: d.pais,
    event_id: d.eventId,
    ...d.utm,
    fbp: d.fbp,
    fbc: d.fbc,
    ip_country: ipCountry,
    user_agent: userAgent.slice(0, 512),
  });

  let yaRegistrado = false;
  if (error) {
    // 23505 = unique violation (email + embudo). No es error para la persona.
    if (error.code === "23505") {
      yaRegistrado = true;
    } else {
      console.error("[registro] supabase:", error.message);
      return NextResponse.json({ ok: false, error: "No pudimos guardar tu registro." }, { status: 500 });
    }
  }

  // 6. Todo lo demás corre DESPUÉS de responder. Si el CRM cae, el registro ya está.
  after(async () => {
    const r = await upsertCrm({
      nombre: d.nombre,
      email: d.email,
      telefono: d.telefono,   // ya en E.164
      tags: ["landing-registro"],
      utm: d.utm,
    });
    if (!r.ok) console.error("[registro] crm:", r.motivo);
  });

  if (!yaRegistrado) {
    after(async () => {
      const r = await enviarCapi({
        eventName: "Lead",
        eventId: d.eventId,     // el mismo que disparó el píxel en el navegador
        email: d.email,
        telefono: d.telefono,
        nombre: d.nombre,
        ip,
        userAgent,
        fbp: d.fbp,
        fbc: d.fbc,
        sourceUrl: req.headers.get("referer") ?? "",
      });
      if (!r.ok) console.error("[registro] capi:", r.motivo);
    });
  }

  return NextResponse.json({ ok: true, lead_id: d.eventId, already_registered: yaRegistrado });
}
