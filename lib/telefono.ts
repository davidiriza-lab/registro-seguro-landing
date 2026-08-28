export type PaisTel = "MX" | "US" | "OTRO";

/** Normaliza a E.164 (+<lada><número>). Respeta lo que ya trae "+";
 *  a un nacional de 10 dígitos le antepone la lada del país. */
export function normalizarTelefono(raw: string, pais: PaisTel): string {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2); // prefijo internacional

  if (pais === "MX") {
    if (digits.startsWith("5252")) digits = digits.slice(2);                 // lada duplicada
    if (digits.startsWith("521") && digits.length === 13) return "+" + digits; // formato viejo 52 1
    if (digits.startsWith("52") && digits.length === 12) return "+" + digits;
    if (digits.length === 10) return "+52" + digits;
    return "+" + digits;
  }
  if (pais === "US") {
    if (digits.startsWith("11") && digits.length === 12) digits = digits.slice(1);
    if (digits.startsWith("1") && digits.length === 11) return "+" + digits;
    if (digits.length === 10) return "+1" + digits;
    return "+" + digits;
  }
  return "+" + digits; // multipaís: no se infiere lada
}

/** null = válido; string = mensaje para la persona. MX y US exigen 10 dígitos
 *  nacionales exactos: el typo clásico es uno de más o uno de menos. */
export function validarTelefono(e164: string): string | null {
  const digits = e164.replace(/\D/g, "");
  if (!digits) return "Escribe tu WhatsApp.";
  if (e164.startsWith("+52")) {
    const n = digits.slice(2);
    return n.length === 10 ? null : `Tu número de México debe tener 10 dígitos después de la lada (escribiste ${n.length}).`;
  }
  if (e164.startsWith("+1")) {
    const n = digits.slice(1);
    if (n.length !== 10) return `Tu número debe tener 10 dígitos después de la lada (escribiste ${n.length}).`;
    if (/^[01]/.test(n) || /^[01]/.test(n.slice(3))) return "Ese número no parece válido, revísalo.";
    return null;
  }
  if (digits.length < 8 || digits.length > 14) return "Revisa tu número, parece incompleto.";
  return null;
}
