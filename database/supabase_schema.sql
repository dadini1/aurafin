-- ============================================================
-- AuraFin · Esquema Supabase (multiempresa con aislamiento total)
-- Ejecutar en Supabase → SQL Editor → New query → pegar y Run.
-- Idempotente: se puede ejecutar más de una vez sin romper datos.
-- ============================================================

-- Empresas afiliadas (marca editable: logo, colores, configuración)
create table if not exists public.empresas (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}$'),
  nombre      text not null,
  eslogan     text not null default '',
  logo_url    text not null default '',                    -- data URL o URL de Storage
  colores     jsonb not null default '{"primario":"#3D47E0","secundario":"#7D85FF","acento":"#0F9F7A"}',
  config      jsonb not null default '{}',                 -- moneda, zona horaria, etc.
  estado      text not null default 'activa' check (estado in ('activa','suspendida')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Usuarios con autorizaciones independientes por empresa
create table if not exists public.usuarios_empresa (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  correo        text not null,
  nombre        text not null,
  password_hash text not null,                             -- scrypt:sal:hash (servidor AuraFin)
  rol           text not null check (rol in ('superadmin','dueno','admin_empresa','empleado','lectura')),
  estado        text not null default 'activo' check (estado in ('activo','inactivo')),
  created_at    timestamptz not null default now()
);

-- "Carpeta" de datos financieros por empresa (payload completo del sync)
create table if not exists public.datos_financieros (
  empresa_id  uuid primary key references public.empresas(id) on delete cascade,
  payload     jsonb not null default '{}',
  version     bigint not null default 0,
  updated_at  timestamptz not null default now()
);

-- Índices de consulta frecuente
create index if not exists idx_usuarios_empresa     on public.usuarios_empresa (empresa_id);
create index if not exists idx_usuarios_empresa_correo on public.usuarios_empresa (lower(correo));
create index if not exists idx_empresas_estado      on public.empresas (estado);

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_empresas_updated on public.empresas;
create trigger trg_empresas_updated
  before update on public.empresas
  for each row execute function public.set_updated_at();

drop trigger if exists trg_datos_updated on public.datos_financieros;
create trigger trg_datos_updated
  before update on public.datos_financieros
  for each row execute function public.set_updated_at();

-- ============================================================
-- Seguridad (RLS)
-- El backend usa la service_role key, que salta RLS. Estas
-- políticas habilitan el acceso directo del cliente en el futuro
-- (p. ej. Supabase Realtime) sin exponer datos entre empresas.
-- ============================================================
alter table public.empresas          enable row level security;
alter table public.usuarios_empresa  enable row level security;
alter table public.datos_financieros enable row level security;

-- Marca pública de empresas activas (pantalla de acceso y theming)
drop policy if exists "lectura_publica_marca" on public.empresas;
create policy "lectura_publica_marca"
  on public.empresas for select
  using (estado = 'activa');

-- Datos y usuarios: sin políticas públicas; el acceso directo requiere
-- un JWT con empresa_id (se agrega al migrar la auth a Supabase Auth).
-- Con service_role el servidor aplica el aislamiento por empresa.
