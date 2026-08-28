interface CrmInput {
  nombre: string;
  email: string;
  telefono: string; // E.164
  tags: string[];
  utm: Record<string, string | null>;
}
type Resultado = { ok: true } | { ok: false; motivo: string };

export async function upsertCrm(input: CrmInput): Promise<Resultado> {
  const token = process.env.CRM_API_TOKEN;
  if (!token) return { ok: false, motivo: "sin CRM_API_TOKEN" };

  const [firstName, ...resto] = input.nombre.split(" ");
  const body = {
    firstName,
    lastName: resto.join(" "),
    email: input.email,
    phone: input.telefono,
    tags: input.tags,
    customFields: Object.entries(input.utm)
      .filter((par): par is [string, string] => par[1] !== null)
      .map(([key, value]) => ({ key, value })),
  };

  const MAX = 3;
  let ultimo = "";
  for (let i = 1; i <= MAX; i++) {
    try {
      const r = await fetch("https://api.tu-crm.com/contacts/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) return { ok: true };
      ultimo = `${r.status} ${await r.text()}`;
      if (r.status !== 429 && r.status < 500) break; // permanente: no reintentar
    } catch (e) {
      ultimo = String(e);
    }
    if (i < MAX) await new Promise((res) => setTimeout(res, 1000 * 2 ** (i - 1)));
  }
  return { ok: false, motivo: ultimo };
}
