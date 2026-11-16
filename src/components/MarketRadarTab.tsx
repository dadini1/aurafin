import React, { useState } from 'react';
import {
  Car,
  Home,
  Search,
  ExternalLink,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Globe,
  ArrowRight,
  ShieldCheck,
  Building,
  DollarSign,
  Compass,
} from 'lucide-react';
import { UserFinancialProfile, PaymentItem, FinancialAdviceReport, MarketSearchResult } from '../types';
import { POPULAR_COUNTRIES } from '../data/mockDeviceData';
import { fetchFinancialAdvice, searchMarketRealtime } from '../services/geminiService';

interface MarketRadarTabProps {
  profile: UserFinancialProfile;
  payments: PaymentItem[];
  onUpdateProfile: (updated: Partial<UserFinancialProfile>) => void;
}

export const MarketRadarTab: React.FC<MarketRadarTabProps> = ({
  profile,
  payments,
  onUpdateProfile,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'advisor' | 'cars' | 'housing'>('advisor');
  const [isLoading, setIsLoading] = useState(false);
  const [customCity, setCustomCity] = useState(profile.city || '');
  const [customBudget, setCustomBudget] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');

  // Search Results
  const [adviceReport, setAdviceReport] = useState<FinancialAdviceReport | null>(null);
  const [carSearchResult, setCarSearchResult] = useState<MarketSearchResult | null>(null);
  const [housingSearchResult, setHousingSearchResult] = useState<MarketSearchResult | null>(null);

  // Financial calculations
  const totalIncome = payments
    .filter((p) => p.type === 'ingreso')
    .reduce((sum, p) => sum + p.amount, 0) || profile.monthlyIncome;

  const transportExpense = payments
    .filter((p) => p.type === 'gasto' && p.category === 'transporte')
    .reduce((sum, p) => sum + p.amount, 0);

  const rentExpense = payments
    .filter((p) => p.type === 'gasto' && p.category === 'alquiler')
    .reduce((sum, p) => sum + p.amount, 0);

  const fixedExpenses = payments
    .filter((p) => p.type === 'gasto' && p.isFixed)
    .reduce((sum, p) => sum + p.amount, 0);

  const variableExpenses = payments
    .filter((p) => p.type === 'gasto' && !p.isFixed)
    .reduce((sum, p) => sum + p.amount, 0);

  // Threshold flags
  const transportExceeds = transportExpense >= profile.transportAlertThreshold;
  const rentExceeds = rentExpense >= profile.rentAlertThreshold;

  // Selected Country data
  const currentCountryData = POPULAR_COUNTRIES.find((c) => c.name === profile.country) || POPULAR_COUNTRIES[0];

  const handleRunFullAdvice = async () => {
    setIsLoading(true);
    try {
      const report = await fetchFinancialAdvice({
        country: profile.country,
        currency: profile.currency,
        monthlyIncome: totalIncome,
        fixedExpenses,
        variableExpenses,
        transportExpense,
        rentExpense,
        userQuestion: customQuestion.trim() || undefined,
      });
      setAdviceReport(report);
      setActiveSubTab('advisor');
    } catch (err: any) {
      console.error('Error fetching financial advice:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchCars = async () => {
    setIsLoading(true);
    try {
      const result = await searchMarketRealtime({
        category: 'cars',
        country: profile.country,
        city: customCity,
        budget: customBudget || `${profile.currencySymbol}${transportExpense * 0.9} cuota mensual`,
      });
      setCarSearchResult(result);
      setActiveSubTab('cars');
    } catch (err: any) {
      console.error('Error searching cars:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchHousing = async () => {
    setIsLoading(true);
    try {
      const result = await searchMarketRealtime({
        category: 'housing',
        country: profile.country,
        city: customCity,
        budget: customBudget || `${profile.currencySymbol}${rentExpense} mensual`,
      });
      setHousingSearchResult(result);
      setActiveSubTab('housing');
    } catch (err: any) {
      console.error('Error searching housing:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 mb-3">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>Inteligencia de Mercado en Tiempo Real (Google Search Grounding)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Radar de Inversión: Transporte & Vivienda
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
              Analizamos si tu gasto en transporte excede el costo de financiar un automóvil propio, y si tu alquiler acumulado justifica dar el salto a una casa o departamento. Buscamos opciones y precios reales en páginas de clasificados de <strong>{profile.country}</strong>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={handleRunFullAdvice}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-violet-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-cyan-500/25 active:scale-95 disabled:opacity-50 transition-all"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-cyan-200" />}
              <span>Generar Asesoría Completa con IA</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2 Core Evaluation Radars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Radar 1: Transporte vs Automóvil */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <Car className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Transporte vs Auto Propio</h3>
                <span className="text-xs text-slate-400">
                  Análisis de umbral y costo de oportunidad
                </span>
              </div>
            </div>

            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
              transportExceeds
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            }`}>
              {transportExceeds ? 'Umbral Excedido' : 'Gasto Controlado'}
            </span>
          </div>

          {/* Metric Comparison */}
          <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                Tu Gasto en Transporte
              </span>
              <span className="text-xl font-extrabold text-white">
                {profile.currencySymbol}{transportExpense.toLocaleString()}
                <span className="text-xs text-slate-400 font-normal"> / mes</span>
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">
                {profile.currencySymbol}{(transportExpense * 12).toLocaleString()} / año en taxis/Uber
              </span>
            </div>

            <div className="border-l border-slate-800 pl-3">
              <span className="text-[11px] font-semibold text-cyan-400 block mb-0.5">
                Cuota Auto Seminuevo
              </span>
              <span className="text-xl font-extrabold text-cyan-300">
                ~{profile.currencySymbol}{Math.round(transportExpense * 0.85).toLocaleString()}
                <span className="text-xs text-slate-400 font-normal"> / mes</span>
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                Autos económicos en {profile.country}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {transportExceeds
              ? `⚠️ Tu gasto de ${profile.currencySymbol}${transportExpense}/mes en traslados ya equivale o supera la cuota promedio de un auto utilitario confiable o híbrido con financiamiento en ${profile.country}. Adquirir un vehículo te daría patrimonio y movilidad propia.`
              : `Tu gasto en transporte está dentro de límites razonables frente a tus ingresos.`}
          </p>

          <button
            onClick={handleSearchCars}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Buscar Autos en Venta en {profile.country}</span>
          </button>
        </div>

        {/* Radar 2: Alquiler vs Compra de Vivienda */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                <Home className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Alquiler vs Casa Propia</h3>
                <span className="text-xs text-slate-400">
                  Evaluación de renta vs crédito hipotecario
                </span>
              </div>
            </div>

            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
              rentExceeds
                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            }`}>
              {rentExceeds ? 'Renta Significativa' : 'Alquiler Moderado'}
            </span>
          </div>

          {/* Metric Comparison */}
          <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                Tu Alquiler Mensual
              </span>
              <span className="text-xl font-extrabold text-white">
                {profile.currencySymbol}{rentExpense.toLocaleString()}
                <span className="text-xs text-slate-400 font-normal"> / mes</span>
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">
                {profile.currencySymbol}{(rentExpense * 12 * 5).toLocaleString()} en 5 años a fondo perdido
              </span>
            </div>

            <div className="border-l border-slate-800 pl-3">
              <span className="text-[11px] font-semibold text-indigo-400 block mb-0.5">
                Cuota Hipoteca Ref.
              </span>
              <span className="text-xl font-extrabold text-indigo-300">
                ~{profile.currencySymbol}{Math.round(rentExpense * 1.15).toLocaleString()}
                <span className="text-xs text-slate-400 font-normal"> / mes</span>
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                Amortizando plusvalía propia
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {rentExceeds
              ? `Estás destinando ${profile.currencySymbol}${rentExpense}/mes al alquiler. En 5 años habrás pagado ${profile.currencySymbol}${(rentExpense * 12 * 5).toLocaleString()} sin retorno patrimonial. Te recomendamos explorar opciones hipotecarias o departamentos en venta en ${profile.country}.`
              : `Tu alquiler representa una proporción moderada de tus ingresos mensuales.`}
          </p>

          <button
            onClick={handleSearchHousing}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Buscar Casas y Deptos en {profile.country}</span>
          </button>
        </div>
      </div>

      {/* Real-time Country Search Form Bar */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Parámetros de Búsqueda en Vivo
            </span>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>Portales verificados en {profile.country}:</span>
            <div className="flex gap-1.5 flex-wrap">
              {currentCountryData.portals.map((portal, idx) => (
                <span key={idx} className="bg-slate-800 px-2 py-0.5 rounded text-cyan-300">
                  {portal}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Ciudad / Zona (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: CDMX, Guadalajara, Madrid, Bogotá..."
              value={customCity}
              onChange={(e) => setCustomCity(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Presupuesto o Rango de Cuota
            </label>
            <input
              type="text"
              placeholder={`Ej: ${profile.currencySymbol}300/mes o ${profile.currencySymbol}25,000`}
              value={customBudget}
              onChange={(e) => setCustomBudget(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Pregunta Específica a la IA
            </label>
            <input
              type="text"
              placeholder="¿Qué modelo de auto usado rinde mejor gasolina?"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Sub-Tabs Selector for Results */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('advisor')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'advisor'
              ? 'bg-cyan-500 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Informe Financiero Integral</span>
          {adviceReport && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
        </button>

        <button
          onClick={() => setActiveSubTab('cars')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'cars'
              ? 'bg-amber-500 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Car className="w-3.5 h-3.5" />
          <span>Opciones de Autos en {profile.country}</span>
          {carSearchResult && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
        </button>

        <button
          onClick={() => setActiveSubTab('housing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'housing'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>Casas y Departamentos en {profile.country}</span>
          {housingSearchResult && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
        </button>
      </div>

      {/* Display Results */}
      {isLoading ? (
        <div className="p-12 text-center bg-slate-900/60 rounded-3xl border border-slate-800 space-y-4">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto" />
          <div>
            <h4 className="text-base font-bold text-white">Buscando ofertas reales en {profile.country}...</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Gemini 3.8 Flash está consultando portales de venta de autos, clasificados y bienes raíces con Google Search Grounding para entregarte datos y precios actualizados.
            </p>
          </div>
        </div>
      ) : (
        <div>
          {/* TAB 1: Complete Advisor Report */}
          {activeSubTab === 'advisor' && (
            <div>
              {adviceReport ? (
                <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> Informe Estratégico para {adviceReport.country}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Generado: {new Date(adviceReport.generatedAt).toLocaleTimeString('es-ES')}
                    </span>
                  </div>

                  {/* Render Markdown text cleanly */}
                  <div className="prose prose-invert max-w-none text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                    {adviceReport.analysis}
                  </div>

                  {/* Grounding Web Sources */}
                  {adviceReport.sources && adviceReport.sources.length > 0 && (
                    <div className="pt-4 border-t border-slate-800 space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Fuentes y Portales Consultados en Tiempo Real:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {adviceReport.sources.map((src, idx) => (
                          <a
                            key={idx}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs border border-slate-700/60 transition-colors"
                          >
                            <span>{src.title}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-900/60 rounded-3xl border border-slate-800">
                  <Sparkles className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-white">No has generado la asesoría aún</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto mb-4">
                    Haz clic en el botón superior para que la IA evalúe tus ingresos, tus gastos fijos y variables, y consulte en tiempo real los costos de autos e hipotecas en {profile.country}.
                  </p>
                  <button
                    onClick={handleRunFullAdvice}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-xs"
                  >
                    Generar Asesoría Ahora
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Cars Search Result */}
          {activeSubTab === 'cars' && (
            <div>
              {carSearchResult ? (
                <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                      <Car className="w-4 h-4" /> Ofertas de Autos en {carSearchResult.country}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Búsqueda en vivo: {new Date(carSearchResult.searchedAt).toLocaleTimeString('es-ES')}
                    </span>
                  </div>

                  <div className="prose prose-invert max-w-none text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {carSearchResult.result}
                  </div>

                  {carSearchResult.sources.length > 0 && (
                    <div className="pt-4 border-t border-slate-800 space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Portales de venta de autos consultados:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {carSearchResult.sources.map((src, idx) => (
                          <a
                            key={idx}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs border border-slate-700/60 transition-colors"
                          >
                            <span>{src.title}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-900/60 rounded-3xl border border-slate-800">
                  <Car className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-white">Buscar autos en vivo en {profile.country}</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto mb-4">
                    La IA buscará en portales como Kavak, MercadoLibre y clasificados las opciones más convenientes según tu gasto en transporte.
                  </p>
                  <button
                    onClick={handleSearchCars}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-xs"
                  >
                    Buscar Autos Ahora
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Housing Search Result */}
          {activeSubTab === 'housing' && (
            <div>
              {housingSearchResult ? (
                <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                      <Home className="w-4 h-4" /> Viviendas y Créditos en {housingSearchResult.country}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Búsqueda en vivo: {new Date(housingSearchResult.searchedAt).toLocaleTimeString('es-ES')}
                    </span>
                  </div>

                  <div className="prose prose-invert max-w-none text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {housingSearchResult.result}
                  </div>

                  {housingSearchResult.sources.length > 0 && (
                    <div className="pt-4 border-t border-slate-800 space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Portales de bienes raíces y clasificados:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {housingSearchResult.sources.map((src, idx) => (
                          <a
                            key={idx}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs border border-slate-700/60 transition-colors"
                          >
                            <span>{src.title}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-900/60 rounded-3xl border border-slate-800">
                  <Home className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-white">Buscar casas y departamentos en {profile.country}</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto mb-4">
                    Compara opciones de alquiler versus departamentos en venta e hipotecas disponibles en portales como Inmuebles24, Idealista, etc.
                  </p>
                  <button
                    onClick={handleSearchHousing}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                  >
                    Buscar Viviendas Ahora
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
