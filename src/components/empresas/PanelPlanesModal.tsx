import React, { useCallback, useEffect, useState } from 'react';
import { BadgeDollarSign, Check, Loader2, Plus, RefreshCw, Save, X } from 'lucide-react';
import { aurafinApi, type MarcaEmpresa, type PlanSuscripcion } from '../../services/aurafinApi';
import { FUNCIONES, type FuncionKey } from '../../config/navigation';

interface PanelPlanesModalProps {
  onClose: () => void;
  /** Se invoca tras asignar una suscripción a la empresa activa. */
  onSuscripcionCambiada?: () => void;
}

interface BorradorPlan {
  id?: string;
  slug: string;
  nombre: string;
  precio: string;
  moneda: string;
  duracionDias: string;
  estado: 'activo' | 'inactivo';
  features: Record<FuncionKey, boolean>;
}

const FUNCION_ETIQUETAS: Record<FuncionKey, string> = {
  finanzas: 'Finanzas & Pagos',
  notas: 'Notas de Voz',
  voz_analitica: 'Voice Analytics',
  radar: 'Radar de Mercado',
  galeria: 'Galería & Contactos',
  app_movil: 'App Móvil & Sync',
  ia: 'Asistente IA',
};

const planVacio = (): BorradorPlan => ({
  slug: '',
  nombre: '',
  precio: '0',
  moneda: 'USD',
  duracionDias: '30',
  estado: 'activo',
  features: FUNCIONES.reduce((acc, k) => ({ ...acc, [k]: false }), {} as Record<FuncionKey, boolean>),
});

const desdePlan = (plan: PlanSuscripcion): BorradorPlan => ({
  id: plan.id,
  slug: plan.slug,
  nombre: plan.nombre,
  precio: String(plan.precio),
  moneda: plan.moneda || 'USD',
  duracionDias: String(plan.duracionDias ?? 30),
  estado: 'activo',
  features: FUNCIONES.reduce(
    (acc, k) => ({ ...acc, [k]: plan.features?.[k] === true }),
    {} as Record<FuncionKey, boolean>
  ),
});

/**
 * Configuración del sistema → Planes (solo dueño del sistema).
 * Crea/edita planes marcando qué funciones activa cada uno y asigna
 * la suscripción de cada empresa.
 */
export const PanelPlanesModal: React.FC<PanelPlanesModalProps> = ({ onClose, onSuscripcionCambiada }) => {
  const [planes, setPlanes] = useState<PlanSuscripcion[]>([]);
  const [empresas, setEmpresas] = useState<MarcaEmpresa[]>([]);
  const [borrador, setBorrador] = useState<BorradorPlan>(planVacio());
  const [empresaSel, setEmpresaSel] = useState('');
  const [planSel, setPlanSel] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [rPlanes, rEmpresas] = await Promise.all([aurafinApi.listarPlanes(), aurafinApi.listarEmpresasAdmin()]);
      setPlanes(rPlanes.planes || []);
      setEmpresas(rEmpresas.empresas || []);
      if (!planSel && rPlanes.planes?.length) setPlanSel(rPlanes.planes[0].id);
      if (!empresaSel && rEmpresas.empresas?.length) setEmpresaSel(rEmpresas.empresas[0].slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los planes');
    } finally {
      setCargando(false);
    }
  }, [planSel, empresaSel]);

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alternarFuncion = (clave: FuncionKey) => {
    setBorrador((prev) => ({ ...prev, features: { ...prev.features, [clave]: !prev.features[clave] } }));
  };

  const guardarPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const datos = {
        slug: borrador.slug,
        nombre: borrador.nombre,
        precio: Number(borrador.precio) || 0,
        moneda: borrador.moneda,
        duracionDias: Number(borrador.duracionDias) || 30,
        estado: borrador.estado,
        features: borrador.features,
      };
      if (borrador.id) {
        const { slug: _slug, ...cambios } = datos;
        void _slug;
        await aurafinApi.actualizarPlan(borrador.id, cambios);
        setAviso('Plan actualizado.');
      } else {
        await aurafinApi.crearPlan(datos);
        setAviso('Plan creado.');
      }
      setBorrador(planVacio());
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el plan');
    } finally {
      setGuardando(false);
    }
  };

  const asignar = async () => {
    const empresa = empresas.find((e) => e.slug === empresaSel);
    if (!empresa?.id || !planSel) {
      setError('Selecciona empresa y plan.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await aurafinApi.asignarSuscripcion(empresa.id, planSel);
      setAviso(`Suscripción activada para ${empresa.nombre}.`);
      onSuscripcionCambiada?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo activar la suscripción');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-start sm:items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl card p-5 sm:p-6 space-y-5 my-4" role="dialog" aria-modal="true" aria-label="Planes y suscripciones">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl inset flex items-center justify-center text-accent">
              <BadgeDollarSign className="w-5 h-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-black text-primary">Planes y suscripciones</h2>
              <p className="text-xs text-muted">El dueño del sistema activa funciones por plan.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon !p-1.5" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="text-xs font-semibold text-[var(--expense)]">{error}</p>}
        {aviso && <p className="text-xs font-semibold text-[var(--income)]">{aviso}</p>}

        {cargando ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando planes…
          </div>
        ) : (
          <>
            {/* Catálogo */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="eyebrow !text-[10px]">Catálogo de planes</h3>
                <button type="button" onClick={() => setBorrador(planVacio())} className="btn btn-ghost !text-xs">
                  <Plus className="w-3.5 h-3.5" /> Nuevo
                </button>
              </div>
              <div className="grid gap-2">
                {planes.map((plan) => (
                  <div key={plan.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-subtle)]">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-primary">
                        {plan.nombre}{' '}
                        <span className="text-[10px] font-semibold text-muted">
                          {plan.moneda} {plan.precio} / {plan.duracionDias ?? 30} días
                        </span>
                      </p>
                      <p className="text-[10px] text-muted truncate">
                        {FUNCIONES.filter((k) => plan.features?.[k]).map((k) => FUNCION_ETIQUETAS[k]).join(' · ') || 'Sin funciones'}
                      </p>
                    </div>
                    <button type="button" onClick={() => setBorrador(desdePlan(plan))} className="btn btn-ghost !text-xs shrink-0">
                      Editar
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Editor */}
            <form onSubmit={guardarPlan} className="space-y-3 p-3 rounded-xl border border-[var(--border-subtle)]">
              <h3 className="eyebrow !text-[10px]">{borrador.id ? 'Editar plan' : 'Nuevo plan'}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <label className="block col-span-2">
                  <span className="text-[10px] font-semibold text-muted">Nombre</span>
                  <input
                    value={borrador.nombre}
                    onChange={(e) => setBorrador((p) => ({ ...p, nombre: e.target.value }))}
                    required
                    className="input w-full mt-0.5"
                    placeholder="Profesional"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-muted">Slug</span>
                  <input
                    value={borrador.slug}
                    onChange={(e) => setBorrador((p) => ({ ...p, slug: e.target.value }))}
                    required
                    disabled={Boolean(borrador.id)}
                    pattern="[a-z0-9][a-z0-9-]{1,38}"
                    className="input w-full mt-0.5 disabled:opacity-60"
                    placeholder="profesional"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-muted">Precio</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={borrador.precio}
                    onChange={(e) => setBorrador((p) => ({ ...p, precio: e.target.value }))}
                    className="input w-full mt-0.5"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-muted">Moneda</span>
                  <input
                    value={borrador.moneda}
                    onChange={(e) => setBorrador((p) => ({ ...p, moneda: e.target.value.toUpperCase() }))}
                    className="input w-full mt-0.5"
                    maxLength={4}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-muted">Duración (días)</span>
                  <input
                    type="number"
                    min={1}
                    value={borrador.duracionDias}
                    onChange={(e) => setBorrador((p) => ({ ...p, duracionDias: e.target.value }))}
                    className="input w-full mt-0.5"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-muted">Estado</span>
                  <select
                    value={borrador.estado}
                    onChange={(e) => setBorrador((p) => ({ ...p, estado: e.target.value as 'activo' | 'inactivo' }))}
                    className="input w-full mt-0.5"
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </label>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-muted">Funciones que activa este plan</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-1">
                  {FUNCIONES.map((clave) => (
                    <button
                      key={clave}
                      type="button"
                      onClick={() => alternarFuncion(clave)}
                      aria-pressed={borrador.features[clave]}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-xs font-semibold transition-colors ${
                        borrador.features[clave]
                          ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-accent'
                          : 'border-[var(--border-subtle)] text-muted'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          borrador.features[clave] ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-[var(--border-default)]'
                        }`}
                      >
                        {borrador.features[clave] && <Check className="w-3 h-3" />}
                      </span>
                      {FUNCION_ETIQUETAS[clave]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button type="submit" disabled={guardando} className="btn btn-primary !text-xs">
                  {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {borrador.id ? 'Guardar cambios' : 'Crear plan'}
                </button>
                {borrador.id && (
                  <button type="button" onClick={() => setBorrador(planVacio())} className="btn btn-ghost !text-xs">
                    Cancelar edición
                  </button>
                )}
              </div>
            </form>

            {/* Asignación de suscripción */}
            <section className="space-y-2 p-3 rounded-xl border border-[var(--border-subtle)]">
              <h3 className="eyebrow !text-[10px]">Activar suscripción por empresa</h3>
              <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <label className="block">
                  <span className="text-[10px] font-semibold text-muted">Empresa</span>
                  <select value={empresaSel} onChange={(e) => setEmpresaSel(e.target.value)} className="input w-full mt-0.5">
                    {empresas.map((e) => (
                      <option key={e.slug} value={e.slug}>{e.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-muted">Plan</span>
                  <select value={planSel} onChange={(e) => setPlanSel(e.target.value)} className="input w-full mt-0.5">
                    {planes.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre} ({p.moneda} {p.precio})</option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={asignar} disabled={guardando} className="btn btn-primary !text-xs">
                  {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Activar
                </button>
              </div>
              <p className="text-[10px] text-muted">
                Al activar, la empresa obtiene las funciones marcadas en el plan elegido. La suscripción anterior se cancela.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
};
