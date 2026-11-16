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

export interface TabDefinition {
  key: MainTabKey;
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
    label: 'Finanzas & Pagos',
    shortLabel: 'Finanzas',
    icon: DollarSign,
    description: 'Pagos programados, presupuestos, metas de ahorro y reportes',
  },
  {
    key: 'notes',
    label: 'Notas de Voz',
    shortLabel: 'Notas',
    icon: FileText,
    description: 'Notas inteligentes con dictado por voz y adjuntos automáticos',
  },
  {
    key: 'voice-analytics',
    label: 'Voice Analytics',
    shortLabel: 'Analytics',
    icon: Activity,
    description: 'Analítica de uso de voz de los últimos 30 días',
  },
  {
    key: 'radar',
    label: 'Radar de Mercado',
    shortLabel: 'Radar',
    icon: Compass,
    description: 'Búsqueda en tiempo real de vehículos y bienes raíces',
  },
  {
    key: 'gallery',
    label: 'Galería & Contactos',
    shortLabel: 'Galería',
    icon: FolderOpen,
    description: 'Archivos del dispositivo y contactos vinculados a tus notas',
  },
  {
    key: 'mobile-app',
    label: 'App Móvil & Sync',
    shortLabel: 'App',
    icon: Smartphone,
    description: 'Instala AuraFin como PWA y sincroniza en tiempo real',
  },
];

export const getTab = (key: MainTabKey): TabDefinition =>
  MAIN_TABS.find((t) => t.key === key) ?? MAIN_TABS[0];