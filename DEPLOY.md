# 🚀 Guía de publicación de AuraFin (Supabase + Render + Cloudflare)

> **✅ ESTADO REAL (2026-11-17): sistema publicado y verificado.**
> - Web/API principal (Render): **https://aurafin-ai.onrender.com**
> - Front en CDN (Cloudflare Pages): **https://aurafin.pages.dev**
> - Supabase (proyecto AURAFIN · org DADINI): `https://nzutmifadcbsorjycsmn.supabase.co`
> - Repositorio: **https://github.com/dadini1/aurafin** (rama `master`, auto-deploy en Render y Pages)
> - Verificado: login superadmin, sync dual-write nube↔disco, aislamiento por empresa (403 cruzado), CORS `*.pages.dev`, login real desde la UI de Pages.

Esta guía deja el ecosistema multiempresa **activo y funcionando**: base de datos
en la nube (Supabase, gratis), espejo en el disco `G:`, API y web publicadas, y
una empresa matriz con su superadmin.

---

## 1. Supabase — base de datos en la nube (gratis)

1. Entra a <https://supabase.com/dashboard> y crea un proyecto (región cercana, p. ej. `East US`).
2. Guarda la **contraseña de la base** (no se usará, pero anótala).
3. Abre **SQL Editor → New query**, pega el contenido de
   [`database/supabase_schema.sql`](database/supabase_schema.sql) y pulsa **Run**.
   Crea las tablas `empresas`, `usuarios_empresa` y `datos_financieros` con RLS.
4. Ve a **Settings → API** y copia:
   - `Project URL` → `SUPABASE_URL`
   - `service_role key` (secreta) → `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ La `service_role` tiene acceso total: úsala solo en el servidor (Render), nunca en el cliente ni en el repo.

## 2. Render — API + web

1. Entra a <https://dashboard.render.com/> → **New → Web Service**.
2. Conecta el repositorio de GitHub de AuraFin.
3. Render detecta `render.yaml` (Blueprint). Si lo haces manual:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
   - **Runtime:** Node 20
4. En **Environment** agrega las variables de [`.env.example`](.env.example):
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AURAFIN_SESSION_SECRET`,
   `AURAFIN_ADMIN_EMAIL`, `AURAFIN_ADMIN_PASSWORD`, `HOST=0.0.0.0`,
   `NODE_ENV=production` y (opcional) `GEMINI_API_KEY`.
5. Despliega y verifica `https://TU-SERVICIO.onrender.com/api/health`:
   debe responder `"nube": { "habilitada": true, "disponible": true }`.

> En el plan gratuito de Render no hay disco persistente: el espejo real en `G:`
> vive en tu PC; la nube es la fuente de verdad y cada empresa tiene su carpeta.

## 3. Disco `G:` — espejo local por empresa

Cada empresa afiliada se materializa como una carpeta propia:

```
G:\AURAFIN\data\
├── empresas\<slug>\database.json     ← principal por empresa
├── empresas\<slug>\mirror\database.json ← espejo en caliente
├── backups\<slug>\database-AAAA-MM-DD.json ← respaldo diario (7 días)
└── outbox.json                       ← cola de reenvíos si la nube falla
```

- Escrituras atómicas (tmp + rename): un corte de energía no corrompe datos.
- Si Supabase está caído, los cambios quedan en la bandaja (`outbox.json`) y se
  reenvían automáticamente con espera exponencial.

## 4. Cloudflare Pages — front en CDN (opcional, recomendado)

La app también funciona servida desde Render (Express sirve `dist/`). Si además
quieres CDN global con Cloudflare Pages:

1. <https://dash.cloudflare.com> → **Workers & Pages → Create → Pages → Connect to Git**.
2. Selecciona el repo de AuraFin:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Variables:** `VITE_API_URL=https://TU-SERVICIO.onrender.com/api`
3. El frontend consume la API de Render; se recomienda dejar el dominio
   `*.pages.dev` como espejo y el dominio de Render como origen de la PWA.

## 5. Primer arranque y empresas afiliadas

1. Con Supabase configurado, el servidor crea automáticamente la empresa matriz
   `aurafin-central` y el superadmin (`AURAFIN_ADMIN_EMAIL` / `AURAFIN_ADMIN_PASSWORD`).
2. Inicia sesión en la web → botón **Acceso empresa**.
3. Botón **Empresas** (visible para administradores):
   - Afiliar empresas nuevas (slug + nombre) → se crean en la nube y en `G:`.
   - Editar branding: **logo**, **colores** (paleta o selector), eslogan.
   - Crear **usuarios con roles** por empresa: `dueno`, `admin_empresa`,
     `empleado`, `lectura` — autorizaciones independientes por empresa.
4. Los colores y el logo se aplican en caliente a la web y a la app (PWA).

## 6. Checklist de verificación

- [ ] `GET /api/health` → `nube.disponible: true`
- [ ] Login del superadmin funciona
- [ ] Crear empresa → aparece carpeta `G:\AURAFIN\data\empresas\<slug>\`
- [ ] Sync de datos → `G:` espejo y tabla `datos_financieros` en Supabase actualizados
- [ ] Logo y colores cambian la interfaz al instante
- [ ] Usuario de otra empresa NO ve datos de la primera (aislamiento RLS)
