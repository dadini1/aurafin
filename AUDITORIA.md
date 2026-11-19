# AuraFin · Auditoría de código, seguridad y auto-revisión

Fecha: 2026-11-14 · Alcance: migración a `G:\AURAFIN`, seguridad del servidor,
calidad de código, responsive y auto-auditoría de UI con correcciones.

## 1. Migración y capa de datos

- El proyecto vive completo en `G:\AURAFIN` (frontend React + servidor Express).
- Persistencia local del navegador: `localStorage` (estado) + **IndexedDB**
  (cola offline `indexedDbService`) + `BroadcastChannel` (multi-pestaña).
- Sincronización: polling a `GET/POST /api/sync/state`; el servidor persiste en
  `G:\AURAFIN\data\aurafin-db.json` con **escritura atómica** y **backups diarios**
  en `data/backups/` (retiene los 7 más recientes, `server.ts`).
- Modo offline real: las mutaciones se encolan en IndexedDB y se sincronizan al
  reconectar (`OfflineSyncIndicator`), con simulador de offline para pruebas.

## 2. Seguridad (hallazgos y correcciones)

| # | Hallazgo | Corrección |
| --- | --- | --- |
| 1 | La clave de Gemini podía quedar expuesta en el cliente | `GEMINI_API_KEY` se lee **sólo en el servidor** (`server.ts`); el cliente llama a `/api/assistant/*` |
| 2 | API de sync abierta a cualquiera en la red | `AURAFIN_SYNC_TOKEN` opcional + `requireSyncToken` en `/api/sync/*`; sin token = modo local |
| 3 | Servidor escuchaba en todas las interfaces | `HOST` por defecto `127.0.0.1`; para publicar se define `HOST` + token explícitamente |
| 4 | Sin límite de peticiones (abuso/coste) | `rateLimit(max/min)` por ruta (15–120 según coste) |
| 5 | Sin cabeceras de seguridad | Cabeceras + **CSP** en producción (`server.ts`) |
| 6 | Bodies sin límite (DoS por payload) | Límites por ruta; `mediaJson` para audio/imagen |
| 7 | Entradas sin validar | Validación de payload en los endpoints de asistente y sync |
| 8 | "APK" falsa que no era instalable | Eliminada; se ofrece **PWA honesta** (manifest + service worker + install prompt) |
| 9 | Iconos PWA placeholder 1×1 | Generados PNG reales 192/512 desde el logo (`scripts/generate-icons.mjs`) |

### Publicar de forma segura
```bash
npm run build
# variables de entorno (no commitear):
#   GEMINI_API_KEY=...        (obligatoria para IA)
#   AURAFIN_SYNC_TOKEN=...    (obligatoria si HOST != 127.0.0.1)
#   HOST=0.0.0.0  PORT=3000  NODE_ENV=production
npm start
```
En producción el servidor sirve `dist/` con fallback SPA y aplica CSP.

## 3. Calidad de código

- Sistema de diseño tokenizado (`src/index.css`) + primitivas reutilizables
  (`src/components/ui/index.tsx`): Button, Card, Field/Input/Select/Textarea,
  Badge, Chip, StatCard, ProgressBar, Modal, Skeleton/Spinner/EmptyState/ErrorState.
- Navegación **data-driven** desde `src/config/navigation.tsx`, compartida por
  `DesktopNav` y `MobileBottomNav`; se eliminaron ~150 líneas de nav duplicada.
- Lógica de negocio fuera de la UI (services/, utils/); la UI consume props.
- **Code-splitting**: `React.lazy` para Finances/VoiceAnalytics/Radar/Gallery/
  MobileApp + `Suspense` con skeleton. Bundle inicial 2116 kB → **897 kB**
  (gzip 557 → 271 kB); el resto se descarga al navegar.
- `npx tsc --noEmit` limpio; `npx vite build` correcto.

## 4. Auto-auditoría de UI (probado en navegador real)

Verificado en Chromium a **390×844**, **768×1024** y **1440×900**, temas
`nitido`/`dark`/`neon`, y modales en móvil.

Defectos detectados y **corregidos**:
1. **Desbordamiento horizontal a 768 px** (126 px): el header duplicaba país/
   notificaciones/ajustes que ya viven en "Más". Se gatearon a `lg+`. → overflow 0.
2. **Doble navegación en tablet** (DesktopNav + bottom nav a la vez): DesktopNav
   ahora sólo ≥1024 px; tablet usa bottom nav.
3. **CTA "Hablar a la IA" recortado** en tablet: resuelto al liberar espacio.
4. **Badge "Neón" visible en tema claro**: `isVibrant` es true en nitido+neon; se
   gateó el badge y el orbe a `theme === 'neon'`.
5. **Iconos PWA 1×1** (warning de manifest): regenerados a 192/512 reales.
6. **Formularios sin id/label**: primitivas con `useId` + asociación automática;
   formulario de pago (concepto/monto/naturaleza/categoría/frecuencia/fecha) y
   buscadores etiquetados. Issue de DevTools 34 → 1 en la vista por defecto.
7. **Controles oscuros hardcodeados en modal claro** (frecuencia/fecha): ahora
   respetan el tema activo.

Resultado tras correcciones: sin errores de runtime en consola; warning de
manifest eliminado; HMR conectado; sin overflow en los 3 anchos; bottom-sheet de
modales correcto en móvil; las pestañas lazy cargan con skeleton y renderizan.

## 5. Pendientes conocidos (backlog prioritizado)

- **A11y por widget**: campos crudos sin id/label en widgets secundarios de
  Finanzas y otras pestañas (gráficas, metas, presupuestos). Causa sistémica ya
  resuelta en primitivas; falta migrar esos widgets a `Field/Input/Select`.
- **Peso de chunk**: `FinancesTab` (~699 kB) sigue >500 kB (aviso, no error);
  candidato a subdividir sus widgets de gráficas en imports dinámicos.
- **Micrófono**: el asistente de voz solicita permiso al abrir (esperado); en
  entornos sin permiso muestra error y no rompe la app.
- **HMR/puertos**: en desarrollo con varios proyectos Vite simultáneos puede
  haber conflicto de puerto WS; no afecta carga ni build.
---

# 2ª auditoría (2026-11-16) · Ecosistema multiempresa (Supabase + G:)

## Code review senior de la nueva capa

**Fortalezas**

- Dual-write nube↔disco con *outbox* persistido y reintentos exponenciales: la nube caída no pierde cambios.
- Sesiones HMAC sin dependencias externas, contraseñas scrypt con sal y comparación `timingSafeEqual`.
- Roles jerárquicos (`superadmin > dueno > admin_empresa > empleado > lectura`) aplicados por middleware, no dispersos en las rutas.
- Validación de payloads heredada (`payments/notes/goals` limitados, presupuestos numéricos finitos) en ambas rutas.
- RLS en Supabase + aislamiento por `empresa_id` en el servidor; el cliente nunca recibe `password_hash`.
- Compatibilidad: el token heredado `AURAFIN_SYNC_TOKEN` sigue funcionando para clientes antiguos.

**Deuda detectada y recomendaciones concretas**

1. `usuarios_empresa.correo` es `unique` global: recomendación migrar a `(empresa_id, correo)` unique compuesto si dos empresas comparten un empleado con distinta contraseña.
2. Los endpoints de empresas hacen N llamadas REST para listar usuarios por empresa; al crecer el catálogo, agregar una vista RPC (`get_usuarios_por_empresa`) o caché en memoria con TTL 30 s.
3. `listarEmpresas()` del login devuelve todas las empresas activas: correcto para un catálogo pequeño; si pasa de ~200, paginar con `limit/offset` en PostgREST.
4. El logo se guarda como data URL en `logo_url`: para logos grandes conviene mover a Supabase Storage (bucket `logos/<slug>/`) y guardar solo la URL pública.
5. El reconciliador solo repara nube→disco en lectura; añadir verificación de `version` por empresa en un cron diario para detectar divergencias silenciosas.
6. Migrar la autenticación a Supabase Auth cuando se requiera SSO/OTP; los roles actuales ya mapean a custom claims.
7. Tests: añadir suite de integración para el motor de sync (escritura dual, caída de nube, reenvío, corrupción del espejo).

## Checklist de publicación verificado en local

- [x] `npm run lint` (tsc --noEmit) sin errores
- [x] `npm run build` de producción OK
- [x] `/api/health` con diagnóstico nube/disco/sync
- [x] Sync legado `POST/GET /api/sync/state` (token heredado) → `data/aurafin-db.json` versión incrementada
- [x] Login sin Supabase → 503 controlado con mensaje claro
- [x] Espejo por empresa `data/empresas/<slug>/` creado al afiliar

---

# 3ª verificación (2026-11-17) · Publicación en producción

## Correcciones aplicadas durante el despliegue

1. `.gitignore` con `data/` excluía tambien `src/data/` (mocks de la app) y rompia el build de Render → se cambio a `/data/` (solo raiz).
2. `bun.lock` desactualizado (de AI Studio) hacia fallar el build de Cloudflare (`bun install --frozen-lockfile`) → retirado; estandarizado en npm.
3. `npm start` con `node server.ts` no resuelve imports `.js` → `.ts` en Node → arranque con `tsx` (movido a dependencias de runtime).
4. CORS ausente: el front de Pages llama a la API de Render (cross-origin) → middleware `Access-Control-Allow-Origin` para `ALLOWED_ORIGINS` + `*.pages.dev`, con preflight OPTIONS.
5. `VITE_API_URL` soportado en `aurafinApi.ts` para despliegues en CDN.
6. dotenv se movio a `server/config.ts` (los imports ESM se evaluan antes del cuerpo del modulo).
7. Doble codificacion de valores en filtros PostgREST (`encodeURIComponent` + `URLSearchParams`) impedia el login.

## Checklist de produccion verificado

- [x] Render `aurafin-ai` Live (commit CORS), `/api/health` con nube disponible
- [x] Cloudflare Pages `aurafin.pages.dev` desplegado (build npm run build → dist)
- [x] Login superadmin y login de empresa en produccion OK
- [x] Sync dual-write: version incrementada, `nubeOk:true`, `espejoLocalOk:true`
- [x] Aislamiento: usuario de empresa A recibe 403 al listar usuarios de empresa B
- [x] CORS preflight desde origen pages.dev: cabecera ACAO presente
- [x] Login real desde la UI de Pages (sesion multiempresa funcionando)

## Pendientes recomendados

- Mover el superadmin a una contrasena fuerte (credencial por defecto `AuraFin2026!`).
- Disco persistente en Render (plan pago) si se quiere espejo server-side; hoy el espejo real vive en G: y la nube es la fuente de verdad.
- Migrar logo a Supabase Storage cuando los logos superen ~1 MB.

# 4ª verificación (2026-11-18) · Dueño Admin, contraseñas por WhatsApp/correo y planes

## Implementado

- Dueño del sistema: usuario `Admin` con contraseña temporal `Admin123!` (migración one-shot del superadmin existente; el login acepta correo o nombre de usuario).
- Contraseñas temporales de 12 caracteres; mínimo 8 en cualquier contraseña. `debe_cambiar_password` obliga al cambio en el primer ingreso (modal no cerrable).
- Entrega de la contraseña temporal solo al admin que la genera: enlace `wa.me` real (WhatsApp) y `mailto:` (correo), con envío real vía Resend si `RESEND_API_KEY` está definida.
- Planes de suscripción (`planes.features` JSONB) con 7 funciones: finanzas, notas, voz_analitica, radar, galeria, app_movil, ia. CRUD y asignación por empresa desde el panel "Planes" (solo superadmin).
- Gating en el frontend: pestañas filtradas por funciones del plan vigente; sin suscripción activa se muestra pantalla de pago. Migración `database/supabase_migracion_v2.sql` aplicada en Supabase.
- Asistente IA enruta cada dictado a la sección correcta: extrae beneficiario, detalle, fecha resuelta y si el pago ya se realizó; al registrar un pago o meta salta automáticamente a Finanzas, las notas a Notas.

## Deuda técnica reconocida

- El gating de funciones es de interfaz: los endpoints de IA siguen abiertos a cualquier sesión válida. Para cerrarlo, validar `resolverFunciones(empresaId).funciones.ia` en las rutas `/api/assistant/*`.
- `RESEND_API_KEY` aún no configurada en Render: el correo se entrega por enlace `mailto:`; WhatsApp funciona con enlace `wa.me`.
- `solo-finanzas` quedó como plan de ejemplo inactivo en Supabase (no visible al público).

## Motor IA de respaldo (analizador local en español)

`GEMINI_API_KEY` no está configurada en Render ni en local. Para que el dictado
nunca se quede sin registrar, `/api/assistant/process-note` usa
`server/ia/analisisLocal.ts` cuando falta la clave o cuando Gemini falla:

- Resuelve fechas ("17 de noviembre", "17/11", "ayer", "hoy") al año actual.
- Extrae el monto sin confundirlo con el día ni con plazos ("en 10 meses").
- Clasifica la categoría (alquiler, servicios, transporte, alimentación, salud, educación, ocio, sueldo, freelance).
- Detecta beneficiario (prioriza la agenda de contactos) y detalle del pago.
- Distingue pagado ("pagué", "cancelé", "cobré") de pendiente ("hay que pagar", "vence").
- Auto-adjunta archivos por palabras clave y devuelve `section` para el salto de pestaña.

Probado de punta a punta: "El 17 de noviembre le pagué el alquiler de 650 a
Richar, hijo del dueño del edificio" → gasto `alquiler`, `2026-11-17`, `pagado`,
beneficiario `Richar`, contacto y contrato adjuntos, salto automático a Finanzas.

Además se normalizan los pagos heredados (`monto`/`fecha`/`tipo`) con
`src/utils/pagos.ts`: un registro antiguo con `monto` rompía el render de
`RecentTransactionsHistory` (`undefined.toLocaleString`).
