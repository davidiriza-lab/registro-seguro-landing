"use client";
import { useState, type FormEvent } from "react";

interface Resp { ok: boolean; error?: string; lead_id?: string }

export function FormularioRegistro() {
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "error">("idle");
  const [mensaje, setMensaje] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEstado("enviando");
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    const res = await fetch("/api/registro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, event_id: crypto.randomUUID() }),
    });
    const data = (await res.json()) as Resp;
    if (data.ok) { setEstado("ok"); return; }
    setEstado("error");
    setMensaje(data.error ?? "Algo salió mal.");
  }

  return (
    <form onSubmit={onSubmit}>
      <input name="nombre" required minLength={2} autoComplete="name" />
      <input name="email" type="email" required autoComplete="email" />
      <input name="telefono" type="tel" required inputMode="tel" autoComplete="tel" />
      <input type="hidden" name="pais" value="MX" />
      {/* Honeypot: oculto con CSS, no con type=hidden */}
      <input name="website" tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: "-9999px" }} aria-hidden="true" />
      <button disabled={estado === "enviando"}>Registrarme</button>
      {estado === "error" && <p role="alert">{mensaje}</p>}
    </form>
  );
}
