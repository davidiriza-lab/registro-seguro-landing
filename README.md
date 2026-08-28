# Escrituras seguras desde una landing

API route de Next.js que recibe registros de una landing, valida sin librerías, guarda en Supabase con la llave secreta (que nunca toca el navegador) y manda CRM y píxel en segundo plano con `after()`.

Guía completa, con el porqué de cada línea: https://www.davidiriza.com/lab/escrituras-seguras-desde-una-landing

## Estructura

```
app/api/registro/route.ts     # el endpoint: rate limit, honeypot, validación, 1 escritura, after()
lib/supabase-server.ts        # único cliente con service role (solo servidor)
lib/telefono.ts               # normalización a E.164 y validación MX/US
lib/rate-limit.ts             # ventana fija en memoria + IP del request
lib/crm.ts                    # upsert genérico al CRM con timeout y reintentos
lib/capi.ts                   # envío a la Conversions API de Meta (no viene en la guía; ver abajo)
components/FormularioRegistro.tsx  # formulario mínimo con honeypot
sql/schema.sql                # tabla registros con RLS activado y sin policies
sql/funciones-cerradas.sql    # REVOKE EXECUTE de PUBLIC en funciones
.env.example                  # variables necesarias
```

## Instalación

Requiere un proyecto Next.js (App Router, TypeScript) con el alias `@/` apuntando a la raíz.

1. Clona y copia las carpetas a tu proyecto:
   ```bash
   git clone https://github.com/davidiriza-lab/registro-seguro-landing.git
   cp -r registro-seguro-landing/app registro-seguro-landing/lib registro-seguro-landing/components tu-proyecto/
   ```
2. Instala la dependencia:
   ```bash
   npm install @supabase/supabase-js
   ```
3. Corre en el SQL editor de Supabase `sql/schema.sql` y después `sql/funciones-cerradas.sql`.
4. Copia `.env.example` a `.env.local` y llena las variables:

   | Variable | Para qué |
   |---|---|
   | `SUPABASE_URL` | URL del proyecto |
   | `SUPABASE_SERVICE_ROLE_KEY` | llave secreta; solo la lee `lib/supabase-server.ts`. Jamás con `NEXT_PUBLIC_` |
   | `CRM_API_TOKEN` | token del CRM (`lib/crm.ts`, dentro de `after()`) |
   | `META_PIXEL_ID` | ID del píxel (`lib/capi.ts`) |
   | `META_CAPI_TOKEN` | token de la Conversions API (`lib/capi.ts`, dentro de `after()`) |

   En Vercel agrégalas con `vercel env add NOMBRE production --value "..."`.
5. Cambia el endpoint y el cuerpo de `lib/crm.ts` por los de tu CRM.
6. Monta `<FormularioRegistro />` en tu landing y prueba:
   ```bash
   curl -s -X POST http://localhost:3000/api/registro \
     -H "Content-Type: application/json" \
     -d '{"nombre":"Prueba","email":"prueba@ejemplo.com","telefono":"3312345678","pais":"MX"}'
   ```
   Un teléfono de 9 dígitos debe regresar 400 con mensaje claro; el honeypot (`website`) lleno regresa 200 y no crea fila.
7. Verifica que anon no lee la tabla:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $PUBLISHABLE_KEY" \
     "https://tu-proyecto.supabase.co/rest/v1/registros?select=email&limit=1"
   ```
   Esperas 200 con arreglo vacío o 401/403. Nunca una fila con datos.

Sobre `lib/capi.ts`: la guía lo importa como pieza dada y no lo muestra; aquí va una versión funcional mínima (hash SHA-256 de email/teléfono/nombre, mismo `event_id` que el píxel de navegador). El detalle está en la guía relacionada `pixel-capi-sin-duplicar`.

## Trampas conocidas

- El teléfono nacional sin lada se guarda feliz en Supabase y el CRM lo rechaza en silencio dentro de `after()`: el lead existe en tu base y nunca llega al CRM. Normaliza a E.164 antes de cualquier upsert.
- Sin `maxDuration` en la ruta, el lambda muere con el envío al CRM a medias y sin registrar nada. Ponle además `AbortSignal.timeout` a cada fetch de segundo plano.
- Revocar EXECUTE solo de `anon` y `authenticated` NO basta: heredan de PUBLIC. Una función SECURITY DEFINER abierta vuelca PII aunque la tabla tenga RLS deny-all.
- `after()` corre aunque hayas respondido 500 o hecho redirect: llámalo después de la escritura, nunca antes.
- El rate limit en memoria no es global en serverless (cada instancia tiene su mapa). Sirve contra el doble clic; contra un ataque real usa Upstash/Redis. El honeypot filtra más.
- En Vercel, `env add` por stdin puede guardar una cadena vacía; usa `--value`.
