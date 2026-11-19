import {
  DollarSign,
  FileText,
  Compass,
  FolderOpen,
  Activity,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';

/** Clave única de cada pestaña principal de AuraFin. */
export type MainTabKey = 'finances' | 'notes' | 'voice-analytics' | 'radar' | 'gallery' | 'mobile-app';

/** Funciones activables por plan de suscripción (JSONB features en Supabase). */
export type FuncionKey = 'finanzas' | 'notas' | 'voz_analitica' | 'radar' | 'galeria' | 'app_movil' | 'ia';

export const FUNCIONES: FuncionKey[] = ['finanzas', 'notas', 'voz_analitica', 'radar', 'galeria', 'app_movil', 'ia'];

export interface TabDefinition {
  key: MainTabKey;
  /** Función de suscripción que activa esta pestaña. */
  funcion: FuncionKey;
  /** Etiqueta completa (navegación de escritorio). */
  label: string;
  /** Etiqueta corta (barra inferior móvil). */
  shortLabel: string;
  icon: LucideIcon;
  /** Descripción accesible / tooltip. */
  description: string;
}

/**
 * Fuente única de verdad para la navegación principal.
 * Consumida por DesktopNav (App) y MobileBottomNav para evitar duplicados.
 */
export const MAIN_TABS: TabDefinition[] = [
  {
    key: 'finances',
    funcion: 'finanzas',
    label: 'Finanzas & Pagos',
    shortLabel: 'Finanzas',
    icon: DollarSign,
    description: 'Pagos programados, presupuestos, metas de ahorro y reportes',
  },
  {
    key: 'notes',
    funcion: 'notas',
    label: 'Notas de Voz',
    shortLabel: 'Notas',
    icon: FileText,
    description: 'Notas inteligentes con dictado por voz y adjuntos automáticos',
  },
  {
    key: 'voice-analytics',
    funcion: 'voz_analitica',
    label: 'Voice Analytics',
    shortLabel: 'Analytics',
    icon: Activity,
    description: 'Analítica de uso de voz de los últimos 30 días',
  },
  {
    key: 'radar',
    funcion: 'radar',
    label: 'Radar de Mercado',
    shortLabel: 'Radar',
    icon: Compass,
    description: 'Búsqueda en tiempo real de vehículos y bienes raíces',
  },
  {
    key: 'gallery',
    funcion: 'galeria',
    label: 'Galería & Contactos',
    shortLabel: 'Galería',
    icon: FolderOpen,
    description: 'Archivos del dispositivo y contactos vinculados a tus notas',
  },
  {
    key: 'mobile-app',
    funcion: 'app_movil',
    label: 'App Móvil & Sync',
    shortLabel: 'App',
    icon: Smartphone,
    description: 'Instala AuraFin como PWA y sincroniza en tiempo real',
  },
];

export const getTab = (key: MainTabKey): TabDefinition =>
  MAIN_TABS.find((t) => t.key === key) ?? MAIN_TABS[0];

/**
 * Filtra las pestañas según las funciones activas de la suscripción.
 * `undefined`/`null` = sin datos de suscripción (modo local) → se muestran
 * todas. Un objeto vacío explícito = sin suscripción activa → sin pestañas
 * (App muestra la pantalla de pago).
 */
export function tabsPermitidos(funciones: Record<string, boolean> | null | undefined): TabDefinition[] {
  if (funciones === undefined || funciones === null) return MAIN_TABS;
  return MAIN_TABS.filter((t) => funciones[t.funcion] === true);
}