# AuraFin · Sistema de Diseño "Aurora Fintech"

Contrato visual y de componentes de la aplicación. Fuente de verdad de estilos:
[`src/index.css`](src/index.css) (tokens + capas `@theme`, `base`, `components`).
Primitivas reutilizables: [`src/components/ui/index.tsx`](src/components/ui/index.tsx).
Navegación data-driven: [`src/config/navigation.tsx`](src/config/navigation.tsx).

## 1. Identidad

AuraFin es un asistente financiero personal con IA. La identidad comunica
**claridad financiera + inteligencia**: superficies de tinta profunda (temas
oscuros) o papel luminoso (tema claro), un acento teal/menta que representa
dinero sano, y un acento iris/violeta reservado para todo lo que hace la IA.

- **Display / títulos:** `Space Grotesk` (`--font-display`).
- **UI / cuerpo:** `Plus Jakarta Sans` (`--font-sans`).
- **Cifras / datos:** `JetBrains Mono` con `font-variant-numeric: tabular-nums`
  (clases `.num` / `.tabular-nums`) para alinear columnas de dinero.

## 2. Color

Tokens semánticos por tema (no usar colores crudos de Tailwind en código nuevo).
El tema se aplica como clase en `<html>`: `theme-nitido` (claro, por defecto),
`theme-neon`, `theme-dark`. El acento se aplica como `accent-cyan|emerald|purple|amber`.

| Token | Rol |
| --- | --- |
| `--surface-0` | Fondo de página |
| `--surface-1` | Tarjeta / panel |
| `--surface-2` | Control / inset |
| `--surface-3` | Hover / elevado |
| `--surface-glass` | Header / nav translúcidos |
| `--text-primary` / `--text-secondary` / `--text-muted` / `--text-faint` | Jerarquía de texto |
| `--border-subtle` / `--border-strong` | Bordes |
| `--accent` / `--accent-2` | Marca (dinero) / IA |
| `--accent-soft` / `--accent-border` | Fondos y bordes de acento |
| `--income` / `--expense` / `--goal` / `--info` (+ `*-soft`) | Semánticos financieros |
| `--shadow-card` / `--shadow-pop` / `--glow-accent` | Elevación y brillo |
| `--app-bg-image` | Aurora radial de fondo (capa `body::before`) |

Reglas:
- Ingreso = `--income`, gasto = `--expense`, meta = `--goal`, IA = `--accent-2`.
- Los degradados de marca cruzan cian → índigo → violeta (`.bg-gradient-aura`,
  `.text-gradient-aura`); nunca un degradado de un solo tono.
- Texto sobre degradado de marca usa `.text-white-fixed` para no ser invertido
  por el puente de temas heredados.
- Contraste: todo par texto/control debe cumplir lectura cómoda en los 3 temas.

## 3. Espaciado, radios y elevación

- Rejilla de 4 px; contenedores `max-w-7xl` con `px-4 sm:px-6 lg:px-8`.
- Radios: controles `rounded-xl`, tarjetas `rounded-2xl`, pastillas `rounded-full`.
- Elevación por tokens de sombra, no sombras arbitrarias.
- Secciones separadas por `gap-4/6` y `.divider`; jerarquía con `.eyebrow` →
  `.section-title` → `.section-sub`.

## 4. Componentes (clases CSS + primitivas React)

| Clase CSS | Primitiva | Uso |
| --- | --- | --- |
| `.card` / `.card-hover` | `Card` | Contenedor de contenido |
| `.btn` + `-primary/-solid/-secondary/-ghost/-outline/-danger/-success`, `-sm/-lg/-icon` | `Button`, `IconButton` | Acciones |
| `.field` / `.label` / `.input` / `.select` / `.textarea` / `.hint` / `.error-text` | `Field`, `Input`, `Select`, `Textarea` | Formularios (id + label automáticos) |
| `.badge` + tonos | `Badge` | Estados y categorías |
| `.chip` / `.chip-active` | `Chip` | Filtros y navegación |
| `.stat-label` / `.stat-value` | `StatCard` | KPIs financieros |
| `.progress` | `ProgressBar` | Presupuestos / metas |
| `.modal-overlay` / `.modal-panel` | `Modal` | Diálogos (bottom-sheet ≤640 px) |
| `.skeleton` / `.aura-orb` | `Skeleton`, `Spinner`, `EmptyState`, `ErrorState` | Carga / vacío / error |
| `.inset` / `.glass-panel` | — | Superficies hundidas / translúcidas |

Reglas de uso:
- Preferir la primitiva React sobre markup crudo; hereda tokens y a11y.
- `Field` asocia `label↔control` automáticamente (`useId`); `Input/Select/Textarea`
  generan `id` si no se provee.
- `Modal` cierra con Escape y clic fuera, bloquea el scroll de fondo y se vuelve
  bottom-sheet en móvil vía CSS (sin JS de breakpoints).
- Estados obligatorios en toda vista con datos: carga (`Skeleton/Spinner`),
  vacío (`EmptyState`) y error (`ErrorState` con reintento).

## 5. Responsive

- **<640 px (móvil):** `MobileBottomNav` (5 slots + FAB de escaneo + "Más" que
  expone el resto de secciones). Modales = bottom-sheet. Stats en 1 columna.
- **640–1023 px (tablet):** sigue `MobileBottomNav`; stats en 2 columnas; el
  header colapsa país/notificaciones/ajustes en el menú "Más".
- **≥1024 px (escritorio):** `DesktopNav` superior (chips con scroll horizontal
  contenido), `MobileBottomNav` oculto; stats en 4 columnas; header completo.
- Sin desbordamiento horizontal en ningún breakpoint (verificado 390/768/1440).
- Áreas seguras iOS: `.pb-safe / .pt-safe / .mb-safe`; `viewport-fit=cover`.

## 6. Movimiento

- Keyframes propios: `af-fade-in`, `af-pop-in`, `af-sheet-in`, `af-shimmer`, `af-spin`.
- Transiciones cortas (150–300 ms) en hover/focus; feedback `active:scale-95`.
- `prefers-reduced-motion` desactiva animaciones y aurora de fondo.
- El brillo (`--glow-accent`) se reserva para IA y estados activos, no decorativo.

## 7. Puente de temas heredados

`src/index.css` incluye un mapeo que traduce clases Tailwind antiguas
(`bg-slate-900`, `text-white`, pasteles, etc.) a los tokens nuevos según el tema,
para que los ~48 componentes existentes hereden la identidad sin reescribirse.
Código nuevo debe usar tokens/clases del sistema, no el puente.