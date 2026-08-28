-- Tabla de registros cerrada al público: RLS activado y sin policies.
create table if not exists public.registros (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  nombre       text not null,
  email        text not null,
  telefono     text not null,
  pais         text,
  event_id     text,
  utm_source   text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  fbp          text, fbc text,
  ip_country   text,
  user_agent   text,
  unique (email)
);

alter table public.registros enable row level security;

-- Sin policies: anon y authenticated no leen ni escriben.
revoke all on table public.registros from anon, authenticated;
