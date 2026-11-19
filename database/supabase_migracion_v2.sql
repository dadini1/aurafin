-- ============================================================
-- AuraFin · Migración v2 (dueño Admin, usuarios con WhatsApp,
-- planes de suscripción con funciones activables)
-- Ejecutar en Supabase → SQL Editor → New query → pegar y Run.
-- Idempotente: se puede ejecutar más de una vez sin romper datos.
-- ============================================================

-- ---------- 1. Nuevas columnas en usuarios_empresa ----------
alter table public.usuarios_empresa add column if not exists usuario            text not null default '';
alter table public.usuarios_empresa add column if not exists telefono_whatsapp  text not null default '';
alter table public.usuarios_empresa add column if not exists debe_cambiar_password boolean not null default false;

-- Usuario (Admin) y correo únicos, sin importar mayúsculas/minúsculas.
create unique index if not exists uq_usuarios_usuario
  on public.usuarios_empresa (lower(usuario)) where usuario <> '';
create unique index if not exists uq_usuarios_correo
  on public.usuarios_empresa (lower(correo));

-- ---------- 2. Planes de suscripción ----------
create table if not exists public.planes (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}$'),
  nombre        text not null,
  precio        numeric(12,2) not null default 0,
  moneda        text not null default 'USD',
  duracion_dias integer not null default 30 check (duracion_dias > 0),
  -- Funciones activadas por el plan. Claves admitidas (7):
  --   finanzas, notas, voz_analitica, radar, galeria, app_movil, ia
  features      jsonb not null default '{}',
  estado        text not null default 'activo' check (estado in ('activo','inactivo')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- 3. Suscripciones por empresa ----------
create table if not exists public.suscripciones (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  plan_id      uuid not null references public.planes(id) on delete restrict,
  estado       text not null default 'activa' check (estado in ('activa','cancelada','vencida')),
  fecha_inicio timestamptz not null default now(),
  fecha_fin    timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_suscripciones_empresa on public.suscripciones (empresa_id);
create index if not exists idx_suscripciones_plan    on public.suscripciones (plan_id);
create index if not exists idx_planes_estado         on public.planes (estado);

-- updated_at automático
drop trigger if exists trg_planes_updated on public.planes;
create trigger trg_planes_updated
  before update on public.planes
  for each row execute function public.set_updated_at();

-- ---------- 4. RLS ----------
alter table public.planes         enable row level security;
alter table public.suscripciones  enable row level security;

-- Catálogo de planes: lectura pública solo de los activos
-- (la gestión CRUD la hace el backend con service_role).
drop policy if exists "lectura_publica_planes_activos" on public.planes;
create policy "lectura_publica_planes_activos"
  on public.planes for select
  using (estado = 'activo');

-- Suscripciones: sin políticas públicas; el backend (service_role)
-- resuelve la suscripción vigente y expone solo las funciones activas.
