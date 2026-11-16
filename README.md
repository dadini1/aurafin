# AuraFin AI · Ecosistema financiero multiempresa

PWA de finanzas con IA para **empresas afiliadas**: notas por voz con
auto-adjuntos, control de pagos/presupuestos, metas de ahorro, radar de mercado
y reportes PDF. Funciona offline (IndexedDB) y sincroniza en tiempo real entre
**Supabase (nube)** y el **espejo en disco `G:`** — cada empresa con su carpeta,
su marca y sus autorizaciones propias.

- Despliegue completo: [`DEPLOY.md`](DEPLOY.md)
- Sistema de diseño: [`DESIGN.md`](DESIGN.md)
- Auditoría de código/seguridad y auto-revisión: [`AUDITORIA.md`](AUDITORIA.md)

## Arquitectura multiempresa

| Capa | Tecnología | Rol |
|---|---|---|
| Nube | Supabase (Postgres + PostgREST) | Fuente de verdad, RLS por empresa |
| Espejo local | Disco `G:` (JSON atómico + respaldos) | Respaldo por empresa, sobrevive cortes |
| API | Express 4 (`server.ts` + `server/`) | Auth HMAC, roles, dual-write, IA Gemini |
| Web/App | React 19 + Vite 8 + Tailwind 4 | Branding dinámico por empresa |

- **Empresas:** CRUD con logo, colores y eslogan editables (aplicados en caliente).
- **Autorizaciones:** roles `superadmin · dueno · admin_empresa · empleado · lectura`, independientes por empresa.
- **Sincronización:** dual-write con bandaja de reenvío y reconciliador (nube ↔ `G:`).

## Ejecutar en local (disco G:)

```bash
cd G:\AURAFIN
npm install
npm run dev          # http://127.0.0.1:3000
```

Variables en `.env` (ver [`.env.example`](.env.example)): `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `AURAFIN_SESSION_SECRET`, `AURAFIN_SYNC_TOKEN`,
`HOST`, `PORT`, `NODE_ENV`, `GEMINI_API_KEY`. Sin Supabase configurado el
sistema funciona en modo disco local.

## Scripts

| Comando | Acción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (Vite + Express) |
| `npm run build` | Build de producción |
| `npm start` | Servidor de producción (sirve `dist/`) |
| `npm run lint` | Type-check (`tsc --noEmit`) |
| `node scripts/generate-icons.mjs` | Regenera iconos PWA 192/512 |

## Estructura

```
src/
  components/       UI por pestaña + shell (Header, navs, orbe IA)
  components/ui/    Primitivas del sistema de diseño (Button, Card, Modal, …)
  components/empresas/  Acceso empresarial + panel de marcas y usuarios
  context/          ThemeContext (nitido/neon/dark) · EmpresaContext (marca + sesión)
  services/         indexedDbService, realtimeSyncService, aurafinApi
  utils/            pdfGenerator, notificationService, …
  index.css         Tokens + sistema de diseño "Aurora Fintech"
server.ts           Express: IA server-side, seguridad, estáticos
server/             config · almacenamiento (local G: / Supabase / sync) · seguridad · rutas
database/           supabase_schema.sql (tablas + RLS + triggers)
data/               espejo por empresa + backups/ (generado en runtime)
public/             manifest.json, sw.js, iconos PWA
```
