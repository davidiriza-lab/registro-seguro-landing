import type { NextConfig } from "next";

/** Cabeceras de seguridad para toda la landing. Ver la sección "Cabeceras de
 *  seguridad y la decisión sobre CORS" de la guía. */
const cabeceras = [
  // HTTPS siempre, también en subdominios, por 2 años
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Nadie mete tu landing en un iframe (X-Frame-Options es el respaldo para navegadores viejos)
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // El navegador no "adivina" tipos de archivo
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Al salir a otro dominio solo viaja el origen, no la URL completa con UTMs
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Una landing no usa cámara, micrófono ni GPS
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: cabeceras }];
  },
};

export default nextConfig;
