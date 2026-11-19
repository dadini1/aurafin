import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Sliders,
  Sparkles,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Car,
  Home,
  ShieldCheck,
  Check,
  X,
  Trash2,
  FileText,
  Paperclip,
  Target,
  User,
  FileDown,
  FileSpreadsheet,
  Camera,
  Calendar as CalendarIcon,
  List,
  Utensils,
  Gamepad2,
  Tag,
  Download,
} from 'lucide-react';
import { PaymentItem, UserFinancialProfile, SavingsGoal, NoteItem, DeviceFile, DeviceContact } from '../types';
import { SavingsGoalsSection } from './SavingsGoalsSection';
import { SavingsProgressWidget } from './SavingsProgressWidget';
import { RecurringPaymentTrendsChart } from './RecurringPaymentTrendsChart';
import { FinancialChartsPanel } from './FinancialChartsPanel';
import { BudgetAlertsPanel } from './BudgetAlertsPanel';
import { BudgetOptimizerModal } from './BudgetOptimizerModal';
import { ReceiptScannerModal } from './ReceiptScannerModal';
import { ProactiveAnalysisCard } from './ProactiveAnalysisCard';
import { FinancialSummaryWidgetsDashboard } from './FinancialSummaryWidgetsDashboard';
import { CategorizedExpenseDistributionWidget } from './CategorizedExpenseDistributionWidget';
import { FinancialCalendarView } from './FinancialCalendarView';
import { ExpenseRingChart } from './ExpenseRingChart';
import { SixMonthSavingsProjectionChart } from './SixMonthSavingsProjectionChart';
import { CategoryBudgetComparisonChart } from './CategoryBudgetComparisonChart';
import { SixMonthPredictiveBudgetSection } from './SixMonthPredictiveBudgetSection';
import { MonthlyBudgetConfigSection } from './MonthlyBudgetConfigSection';
import { SavingsGoalsProgressEvolutionChart } from './SavingsGoalsProgressEvolutionChart';
import { CumulativeSavingsProjectionLineChart } from './CumulativeSavingsProjectionLineChart';
import { RecentTransactionsHistory } from './RecentTransactionsHistory';
import { DateRangeCSVExportModal } from './DateRangeCSVExportModal';
import { SavingsStrategyModal } from './SavingsStrategyModal';
import { ExportDataModal } from './ExportDataModal';
import { BudgetAutocompleteModal } from './BudgetAutocompleteModal';
import { QuickBudgetVoiceCommandBar } from './QuickBudgetVoiceCommandBar';
import { SavingsStreakWidget } from './SavingsStreakWidget';
import { AIBudgetForecastWidget } from './AIBudgetForecastWidget';
import { AISandboxSimulator } from './AISandboxSimulator';
import {
  GoalMilestoneConfettiCelebration,
  GoalMilestoneEvent,
  GoalMilestoneTier,
} from './GoalMilestoneConfettiCelebration';
import { UpcomingPaymentAlertWidget } from './UpcomingPaymentAlertWidget';
import { FinancialMilestonesTimeline } from './FinancialMilestonesTimeline';
import { AIGoalOptimizerWidget } from './AIGoalOptimizerWidget';
import { AIDebtAvalancheSimulator } from './AIDebtAvalancheSimulator';
import { AIPaymentRecommenderWidget } from './AIPaymentRecommenderWidget';
import { exportPaymentsToCSV } from '../utils/csvExporter';
import { exportAllDataToStructuredCSV, exportTransactionsAndGoalsToCSV } from '../utils/financialDataExporter';
import { autoMatchTransaction } from '../services/geminiService';
import { classifyPaymentDescription, CategoryClassificationResult } from '../utils/paymentCategoryClassifier';
import { recordGoalDepositToStreak } from '../utils/savingsStreakEngine';
import { useTheme } from '../context/ThemeContext';

interface FinancesTabProps {
  payments: PaymentItem[];
  profile: UserFinancialProfile;
  goals: SavingsGoal[];
  notes?: NoteItem[];
  categoryBudgets: Record<string, number>;
  onUpdateCategoryBudgets: (updated: Record<string, number>) => void;
  alertThresholds?: Record<string, number>;
  globalAlertThreshold?: number;
  onUpdateAlertThresholds?: (thresholds: Record<string, number>, globalThreshold: number) => void;
  availableFiles: DeviceFile[];
  availableContacts: DeviceContact[];
  onAddPayment: (payment: Omit<PaymentItem, 'id' | 'createdAt'>) => void;
  onUpdatePayment: (id: string, updated: Partial<PaymentItem>) => void;
  onTogglePaymentStatus: (id: string) => void;
  onDeletePayment: (id: string) => void;
  onAddGoal: (goal: Omit<SavingsGoal, 'id' | 'createdAt'>) => void;
  onUpdateGoalAmount: (id: string, newAmount: number) => void;
  onUpdateGoalMonthlyContribution?: (id: string, newMonthlyContribution: number) => void;
  onDeleteGoal: (id: string) => void;
  onUpdateProfile: (updated: Partial<UserFinancialProfile>) => void;
  onNavigateToRadar: () => void;
  onSelectFilePreview: (file: DeviceFile, reason?: string) => void;
  onOpenVoiceAssistantWithPrompt?: (prompt: string) => void;
  onDownloadPDF?: () => void;
  onOpenNotificationCenter?: () => void;
  onAddFileToGallery?: (file: DeviceFile) => void;
  onOpenUserSettings?: (tab?: 'dnd' | 'priorities' | 'profile') => void;
  isDndActive?: boolean;
}

export const FinancesTab: React.FC<FinancesTabProps> = ({
  payments,
  profile,
  goals,
  notes = [],
  categoryBudgets,
  onUpdateCategoryBudgets,
  alertThresholds,
  globalAlertThreshold,
  onUpdateAlertThresholds,
  availableFiles,
  availableContacts,
  onAddPayment,
  onUpdatePayment,
  onTogglePaymentStatus,
  onDeletePayment,
  onAddGoal,
  onUpdateGoalAmount,
  onUpdateGoalMonthlyContribution,
  onDeleteGoal,
  onUpdateProfile,
  onNavigateToRadar,
  onSelectFilePreview,
  onOpenVoiceAssistantWithPrompt,
  onDownloadPDF,
  onOpenNotificationCenter,
  onAddFileToGallery,
  onOpenUserSettings,
  isDndActive = false,
}) => {
  const { isNitido, isVibrant } = useTheme();
  const [filterType, setFilterType] = useState<'todos' | 'fijos' | 'variables' | 'ingresos'>('todos');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditIncomeOpen, setIsEditIncomeOpen] = useState(false);
  const [matchingPaymentId, setMatchingPaymentId] = useState<string | null>(null);
  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);
  const [isSavingsStrategyOpen, setIsSavingsStrategyOpen] = useState(false);
  const [isAutocompleteModalOpen, setIsAutocompleteModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isReceiptScannerOpen, setIsReceiptScannerOpen] = useState(false);
  const [isDateRangeCSVOpen, setIsDateRangeCSVOpen] = useState(false);
  const [csvNotification, setCsvNotification] = useState<string | null>(null);
  const [paymentsViewMode, setPaymentsViewMode] = useState<'calendar' | 'list'>('calendar');
  const [manualMilestoneEvent, setManualMilestoneEvent] = useState<GoalMilestoneEvent | null>(null);

  const handleAddPaymentOnDate = (dateStr: string) => {
    setNewDueDate(dateStr);
    setIsAddModalOpen(true);
  };

  const handleExportCSV = () => {
    const { totalRecords, filename } = exportAllDataToStructuredCSV(
      payments,
      goals,
      notes,
      profile,
      categoryBudgets
    );
    setCsvNotification(`¡${totalRecords} registros (pagos, metas y notas) exportados exitosamente a ${filename}!`);
    setTimeout(() => {
      setCsvNotification(null);
    }, 4500);
  };

  const handleExportTransactionsAndGoalsCSV = () => {
    const { transactionsCount, goalsCount, filename } = exportTransactionsAndGoalsToCSV(
      payments,
      goals,
      profile
    );
    setCsvNotification(
      `Historial completo exportado: ${transactionsCount} transacciones y ${goalsCount} metas de ahorro guardadas en ${filename}.`
    );
    setTimeout(() => {
      setCsvNotification(null);
    }, 5000);
  };

  // New Payment Form state
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState<number | ''>('');
  const [newType, setNewType] = useState<'gasto' | 'ingreso'>('gasto');
  const [newIsFixed, setNewIsFixed] = useState(true);
  const [newCategory, setNewCategory] = useState<PaymentItem['category']>('servicios');
  const [newDueDate, setNewDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [newFrequency, setNewFrequency] = useState<PaymentItem['frequency']>('mensual');

  // Automatic category classification state
  const [hasManuallySelectedCategory, setHasManuallySelectedCategory] = useState(false);
  const [hasManuallySelectedIsFixed, setHasManuallySelectedIsFixed] = useState(false);

  // Compute live classification suggestion based on payment description
  const categorySuggestion = useMemo(() => {
    if (!newTitle.trim()) return null;
    return classifyPaymentDescription(newTitle, newType);
  }, [newTitle, newType]);

  const handleTitleChange = (val: string) => {
    setNewTitle(val);
    if (!val.trim()) return;
    const suggestion = classifyPaymentDescription(val, newType);
    if (suggestion) {
      if (!hasManuallySelectedCategory) {
        setNewCategory(suggestion.category);
      }
      if (!hasManuallySelectedIsFixed && newType === 'gasto') {
        setNewIsFixed(suggestion.suggestedIsFixed);
      }
    }
  };

  const handleApplyCategorySuggestion = (cat: PaymentItem['category'], isFixed?: boolean) => {
    setNewCategory(cat);
    if (isFixed !== undefined && newType === 'gasto') {
      setNewIsFixed(isFixed);
    }
    setHasManuallySelectedCategory(false);
  };

  // New Income edit state
  const [tempIncome, setTempIncome] = useState(profile.monthlyIncome);

  // Calculate totals
  const totalIncome =
    payments
      .filter((p) => p.type === 'ingreso')
      .reduce((sum, p) => sum + p.amount, 0) || profile.monthlyIncome;

  const fixedExpenses = payments
    .filter((p) => p.type === 'gasto' && p.isFixed)
    .reduce((sum, p) => sum + p.amount, 0);

  const variableExpenses = payments
    .filter((p) => p.type === 'gasto' && !p.isFixed)
    .reduce((sum, p) => sum + p.amount, 0);

  const totalExpenses = fixedExpenses + variableExpenses;
  const netSavings = totalIncome - totalExpenses;
  const savingsPercent = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;
  const annualSavingsProjection = Math.max(0, netSavings) * 12;

  // Specific expenses for smart triggers
  const transportExpenses = payments
    .filter((p) => p.type === 'gasto' && p.category === 'transporte')
    .reduce((sum, p) => sum + p.amount, 0);

  const rentExpenses = payments
    .filter((p) => p.type === 'gasto' && p.category === 'alquiler')
    .reduce((sum, p) => sum + p.amount, 0);

  const transportExceeds = transportExpenses >= profile.transportAlertThreshold;
  const rentExceeds = rentExpenses >= profile.rentAlertThreshold;

  // 50/30/20 proportions
  const needsPercent = totalIncome > 0 ? Math.round((fixedExpenses / totalIncome) * 100) : 0;
  const wantsPercent = totalIncome > 0 ? Math.round((variableExpenses / totalIncome) * 100) : 0;

  // Filter payments
  const filteredPayments = payments.filter((p) => {
    if (filterType === 'fijos') return p.type === 'gasto' && p.isFixed;
    if (filterType === 'variables') return p.type === 'gasto' && !p.isFixed;
    if (filterType === 'ingresos') return p.type === 'ingreso';
    return true;
  });

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAmount || Number(newAmount) <= 0) return;

    onAddPayment({
      title: newTitle.trim(),
      amount: Number(newAmount),
      type: newType,
      isFixed: newType === 'ingreso' ? true : newIsFixed,
      category: newCategory,
      frequency: newFrequency,
      dueDate: newDueDate,
      status: 'pendiente',
    });

    setNewTitle('');
    setNewAmount('');
    setHasManuallySelectedCategory(false);
    setHasManuallySelectedIsFixed(false);
    setIsAddModalOpen(false);
  };

  const handleSaveIncome = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({ monthlyIncome: Number(tempIncome) });
    setIsEditIncomeOpen(false);
  };

  const handleGoalAmountUpdateWithStreak = (id: string, newAmount: number) => {
    const targetGoal = goals.find((g) => g.id === id);
    const delta = targetGoal ? newAmount - (Number(targetGoal.currentAmount) || 0) : 0;
    onUpdateGoalAmount(id, newAmount);
    if (delta > 0) {
      recordGoalDepositToStreak(delta, profile, `Abono a ${targetGoal?.title || 'meta de ahorro'}`);
    }
  };

  const handleAutoMatchForPayment = async (payment: PaymentItem) => {
    setMatchingPaymentId(payment.id);
    try {
      const matchRes = await autoMatchTransaction(payment, availableFiles, availableContacts);
      if (matchRes.matchedFileIds.length > 0 || matchRes.matchedContactIds.length > 0) {
        onUpdatePayment(payment.id, {
          matchedFileIds: matchRes.matchedFileIds,
          matchedContactIds: matchRes.matchedContactIds,
        });
      }
    } catch (err) {
      console.warn('Auto match failed:', err);
    } finally {
      setMatchingPaymentId(null);
    }
  };

  return (
    <div className="space-y-6 pb-28 sm:pb-12">
      {/* Top Overview Cards with Crisp, Restful surfaces */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Income Card */}
        <div className={`p-5 rounded-3xl ${
          isNitido
            ? 'bg-white border border-slate-200/90 shadow-sm hover:shadow-md'
            : isVibrant
            ? 'bg-gradient-to-br from-emerald-950/60 via-[#0a1228] to-[#060a1e] border border-[#00f59b]/40 hover:border-[#00f59b]/70 shadow-xl shadow-emerald-950/30 ring-1 ring-[#00f59b]/20'
            : 'bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 hover:border-emerald-500/50 shadow-xl shadow-emerald-950/20'
        } flex flex-col justify-between transition-all group`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${isNitido ? 'text-slate-700' : 'text-emerald-300'}`}>Ingreso Mensual</span>
            <button
              onClick={() => {
                setTempIncome(profile.monthlyIncome);
                setIsEditIncomeOpen(true);
              }}
              title="Ajustar cuánto ganas"
              className={`p-1 rounded-lg transition-colors ${isNitido ? 'hover:bg-slate-100 text-slate-500 hover:text-emerald-700' : 'hover:bg-emerald-900/30 text-emerald-400'}`}
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-black tracking-tight ${isNitido ? 'text-slate-900' : 'text-white'}`}>
              {profile.currencySymbol}{totalIncome.toLocaleString()}
            </span>
            <span className={`text-xs font-extrabold flex items-center px-2 py-0.5 rounded-full border ${
              isNitido
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-xs'
                : isVibrant 
                ? 'bg-[#00f59b]/15 text-emerald-400 border-[#00f59b]/40 shadow-[0_0_8px_rgba(0,245,155,0.2)]' 
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            }`}>
              <ArrowUpRight className="w-3 h-3" /> Fijo + Extras
            </span>
          </div>
          <span className={`text-[11px] mt-2 block ${isNitido ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
            Base mensual neta disponible para administrar
          </span>
        </div>

        {/* Fixed Expenses Card */}
        <div className={`p-5 rounded-3xl ${
          isNitido
            ? 'bg-white border border-slate-200/90 shadow-sm hover:shadow-md'
            : isVibrant
            ? 'bg-gradient-to-br from-amber-950/60 via-[#0a1228] to-[#060a1e] border border-amber-400/40 hover:border-amber-400/70 shadow-xl shadow-amber-950/30 ring-1 ring-amber-400/20'
            : 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 hover:border-amber-500/50 shadow-xl shadow-amber-950/20'
        } flex flex-col justify-between transition-all group`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${isNitido ? 'text-slate-700' : 'text-amber-300'}`}>Pagos Fijos (Obligatorios)</span>
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black ${
              isNitido
                ? 'bg-amber-50 text-amber-900 border border-amber-200'
                : isVibrant 
                ? 'bg-amber-500/25 text-amber-300 border border-amber-400/40 shadow-[0_0_8px_rgba(251,191,36,0.25)]' 
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              {needsPercent}%
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-black tracking-tight ${isNitido ? 'text-slate-900' : 'text-amber-300'}`}>
              {profile.currencySymbol}{fixedExpenses.toLocaleString()}
            </span>
            <span className={`text-xs font-semibold ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>/ mes</span>
          </div>
          <span className={`text-[11px] mt-2 block ${isNitido ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
            Renta, servicios, seguros y compromisos estables
          </span>
        </div>

        {/* Variable Expenses Card */}
        <div className={`p-5 rounded-3xl ${
          isNitido
            ? 'bg-white border border-slate-200/90 shadow-sm hover:shadow-md'
            : isVibrant
            ? 'bg-gradient-to-br from-fuchsia-950/60 via-[#0a1228] to-[#060a1e] border border-fuchsia-400/40 hover:border-fuchsia-400/70 shadow-xl shadow-fuchsia-950/30 ring-1 ring-fuchsia-400/20'
            : 'bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/30 hover:border-rose-500/50 shadow-xl shadow-rose-950/20'
        } flex flex-col justify-between transition-all group`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${isNitido ? 'text-slate-700' : 'text-fuchsia-300'}`}>Pagos Variables</span>
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black ${
              isNitido
                ? 'bg-rose-50 text-rose-900 border border-rose-200'
                : isVibrant 
                ? 'bg-fuchsia-500/25 text-fuchsia-300 border border-fuchsia-400/40 shadow-[0_0_8px_rgba(217,70,239,0.25)]' 
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}>
              {wantsPercent}%
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-black tracking-tight ${isNitido ? 'text-slate-900' : 'text-fuchsia-300'}`}>
              {profile.currencySymbol}{variableExpenses.toLocaleString()}
            </span>
            <span className={`text-xs font-semibold ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>/ mes</span>
          </div>
          <span className={`text-[11px] mt-2 block ${isNitido ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
            Transporte, despensa, salidas y gastos flexibles
          </span>
        </div>

        {/* Savings Capacity Card */}
        <div className={`p-5 rounded-3xl ${
          isNitido
            ? 'bg-white border border-slate-200/90 shadow-sm hover:shadow-md'
            : isVibrant
            ? 'bg-gradient-to-br from-cyan-950/70 via-[#081030] to-[#060a1e] border border-cyan-400/50 hover:border-cyan-400/80 shadow-[0_0_25px_rgba(0,210,255,0.18)] ring-1 ring-cyan-400/30'
            : 'bg-gradient-to-br from-cyan-950/50 via-indigo-950/40 to-slate-900 border border-cyan-500/40 shadow-xl shadow-cyan-950/30'
        } flex flex-col justify-between transition-all group`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${isNitido ? 'text-slate-700' : 'text-cyan-300'}`}>
              Capacidad de Ahorro
            </span>
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black ${
              isNitido
                ? 'bg-cyan-50 text-cyan-900 border border-cyan-200'
                : isVibrant 
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40 shadow-[0_0_8px_rgba(0,240,255,0.25)]' 
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {savingsPercent}%
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-black tracking-tight ${
              netSavings >= 0 
                ? (isNitido ? 'text-slate-900' : isVibrant ? 'text-cyan-300' : 'text-emerald-400') 
                : 'text-rose-600'
            }`}>
              {profile.currencySymbol}{netSavings.toLocaleString()}
            </span>
            <span className={`text-xs font-semibold ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>/ mes</span>
          </div>
          <span className={`text-[11px] mt-2 block ${isNitido ? 'text-slate-600 font-medium' : 'text-cyan-200/80'}`}>
            Proyección anual: <strong className={isNitido ? 'text-slate-900 font-extrabold' : 'text-white'}>{profile.currencySymbol}{annualSavingsProjection.toLocaleString()}</strong>
          </span>
        </div>
      </div>

      {/* COMANDO RÁPIDO POR VOZ PARA ACTUALIZAR PRESUPUESTOS DE CATEGORÍAS */}
      <QuickBudgetVoiceCommandBar
        categoryBudgets={categoryBudgets}
        onUpdateCategoryBudgets={onUpdateCategoryBudgets}
        profile={profile}
        onJumpToBudgets={() => {
          document.getElementById('monthly-budget-config-section')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }}
      />

      {/* 50 / 30 / 20 Rule Education & Health Progress Bar */}
      <div className={`p-6 rounded-3xl border shadow-sm space-y-4 ${
        isNitido ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className={`text-base font-bold flex items-center gap-2 ${isNitido ? 'text-slate-900' : 'text-white'}`}>
              <PieChart className="w-4 h-4 text-cyan-600" />
              Metodología de Ahorro y Regla 50 / 30 / 20
            </h3>
            <p className={`text-xs mt-0.5 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              Administración financiera equilibrada: 50% Gastos Fijos, 30% Variables, 20% Ahorro.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
              savingsPercent >= 20
                ? isNitido ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : savingsPercent > 5
                ? isNitido ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : isNitido ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
            }`}>
              {savingsPercent >= 20 ? 'Excelente Salud Financiera' : savingsPercent > 5 ? 'Ahorro Moderado' : 'Alerta de Presupuesto'}
            </span>
          </div>
        </div>

        {/* Visual Stacked Bar */}
        <div className="space-y-2">
          <div className={`h-4 w-full rounded-full overflow-hidden flex shadow-inner ${isNitido ? 'bg-slate-100' : 'bg-slate-800'}`}>
            <div
              style={{ width: `${Math.min(100, needsPercent)}%` }}
              className="bg-amber-500 transition-all duration-500"
              title={`Fijos: ${needsPercent}%`}
            />
            <div
              style={{ width: `${Math.min(100 - needsPercent, wantsPercent)}%` }}
              className="bg-rose-500 transition-all duration-500"
              title={`Variables: ${wantsPercent}%`}
            />
            <div
              style={{ width: `${Math.max(0, Math.min(100, savingsPercent))}%` }}
              className="bg-emerald-500 transition-all duration-500"
              title={`Ahorro: ${savingsPercent}%`}
            />
          </div>

          <div className={`flex items-center justify-between text-xs flex-wrap gap-3 pt-1 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Fijos: <strong className={isNitido ? 'text-slate-900 font-bold' : 'text-white'}>{needsPercent}%</strong> (meta: ≤50%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Variables: <strong className={isNitido ? 'text-slate-900 font-bold' : 'text-white'}>{wantsPercent}%</strong> (meta: ≤30%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Ahorro: <strong className={isNitido ? 'text-slate-900 font-bold' : 'text-white'}>{savingsPercent}%</strong> (meta: ≥20%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* DASHBOARD VISUAL CON WIDGETS DE RESUMEN FINANCIERO (GASTO VS INGRESO DEL DÍA, GASTO POR CATEGORÍA) */}
      <FinancialSummaryWidgetsDashboard
        payments={payments}
        profile={profile}
        categoryBudgets={categoryBudgets}
        onOpenAddModal={() => setIsAddModalOpen(true)}
      />

      {/* WIDGET ALERTA DE PRÓXIMOS 3 PAGOS CON CUENTA REGRESIVA VISUAL DE 24H */}
      <UpcomingPaymentAlertWidget
        payments={payments}
        profile={profile}
        onTogglePaymentStatus={onTogglePaymentStatus}
        onRescheduleToTomorrow={(id, nextDateStr) =>
          onUpdatePayment(id, { dueDate: nextDateStr, status: 'pendiente' })
        }
        onOpenAddModal={() => setIsAddModalOpen(true)}
      />

      {/* AI PAYMENT RECOMMENDER WIDGET (FECHAS ÓPTIMAS DE PAGO PARA MAXIMIZAR FLUJO Y EVITAR MORA) */}
      <AIPaymentRecommenderWidget
        payments={payments}
        profile={profile}
        onUpdatePayment={onUpdatePayment}
        onOpenVoiceAssistant={onOpenVoiceAssistantWithPrompt}
      />

      {/* WIDGET RACHA DE AHORRO Y LOGROS (3+ DÍAS CONSECUTIVOS & METAS DIARIA/SEMANAL) */}
      <SavingsStreakWidget profile={profile} />

      {/* WIDGET PRONÓSTICO DE PRESUPUESTO IA PARA EL PRÓXIMO MES (CONFIRMAR / IGNORAR) */}
      <AIBudgetForecastWidget
        payments={payments}
        categoryBudgets={categoryBudgets}
        onUpdateCategoryBudgets={onUpdateCategoryBudgets}
        profile={profile}
        goals={goals}
      />

      {/* AI SANDBOX SIMULATOR (ESCENARIOS HIPOTÉTICOS DE INGRESOS/GASTOS VS METAS DE AHORRO) */}
      <AISandboxSimulator
        goals={goals}
        profile={profile}
        totalIncome={totalIncome}
        fixedExpenses={fixedExpenses}
        variableExpenses={variableExpenses}
        onOpenVoiceAssistant={onOpenVoiceAssistantWithPrompt}
      />

      {/* AI DEBT AVALANCHE SIMULATOR (LIQUIDACIÓN ÓPTIMA MAYOR TASA APR PRIMERO) */}
      <AIDebtAvalancheSimulator
        payments={payments}
        profile={profile}
        netSavings={netSavings}
        onOpenVoiceAssistant={onOpenVoiceAssistantWithPrompt}
      />

      {/* WIDGET DISTRIBUCIÓN CATEGORIZADA DE GASTOS (RECHARTS DONUT CHART) */}
      <CategorizedExpenseDistributionWidget
        payments={payments}
        profile={profile}
      />

      {/* PROACTIVE FINANCIAL HEALTH ANALYSIS (REAL SAVINGS VS DEFINED GOAL & HEALTH BADGE) */}
      <ProactiveAnalysisCard
        totalIncome={totalIncome}
        fixedExpenses={fixedExpenses}
        variableExpenses={variableExpenses}
        netSavings={netSavings}
        savingsPercent={savingsPercent}
        goals={goals}
        profile={profile}
        onUpdateProfile={onUpdateProfile}
        onOpenOptimizer={() => setIsOptimizerOpen(true)}
        onOpenSavingsStrategy={() => setIsSavingsStrategyOpen(true)}
        onOpenVoiceAssistant={onOpenVoiceAssistantWithPrompt}
        onDownloadPDF={onDownloadPDF}
      />

      {/* RECHARTS FINANCIAL CHARTS PANEL (SAVINGS PROGRESS & HISTORICAL TRENDS) */}
      <FinancialChartsPanel
        payments={payments}
        profile={profile}
        onNavigateToRadar={onNavigateToRadar}
      />

      {/* RECHARTS EXPENSE RING CHART (DISTRIBUCIÓN DE GASTOS POR CATEGORÍA EN ANILLOS) */}
      <ExpenseRingChart
        payments={payments}
        profile={profile}
        categoryBudgets={categoryBudgets}
        onNavigateToRadar={onNavigateToRadar}
      />

      {/* RECHARTS 6-MONTH SAVINGS PROJECTION CHART (generateSavingsStrategy) */}
      <SixMonthSavingsProjectionChart
        payments={payments}
        profile={profile}
        goals={goals}
        categoryBudgets={categoryBudgets}
        onOpenSavingsStrategyModal={() => setIsSavingsStrategyOpen(true)}
      />

      {/* RECHARTS CATEGORY BUDGET COMPARISON CHART (Gasto Real vs Presupuesto Asignado) */}
      <CategoryBudgetComparisonChart
        payments={payments}
        categoryBudgets={categoryBudgets}
        profile={profile}
        alertThresholds={alertThresholds}
        globalAlertThreshold={globalAlertThreshold}
        onOpenOptimizer={() => setIsOptimizerOpen(true)}
        onOpenAutocomplete={() => setIsAutocompleteModalOpen(true)}
      />

      {/* RECHARTS RECURRING PAYMENT TRENDS (LAST 6 MONTHS: PROJECTED VS ACTUAL PAID) */}
      <RecurringPaymentTrendsChart
        payments={payments}
        profile={profile}
        categoryBudgets={categoryBudgets}
      />

      {/* MODELO PREDICTIVO BASADO EN LOS ÚLTIMOS 6 MESES PARA ESTIMAR GASTOS Y AJUSTAR PRESUPUESTO */}
      <SixMonthPredictiveBudgetSection
        payments={payments}
        categoryBudgets={categoryBudgets}
        onUpdateCategoryBudgets={onUpdateCategoryBudgets}
        profile={profile}
      />

      {/* SECCIÓN CONFIGURACIÓN DE PRESUPUESTO MENSUAL (VALORES NUMÉRICOS EDITABLES CON AUTO-GUARDADO) */}
      <div id="monthly-budget-config-section" className="scroll-mt-6">
        <MonthlyBudgetConfigSection
          categoryBudgets={categoryBudgets}
          onUpdateCategoryBudgets={onUpdateCategoryBudgets}
          payments={payments}
          profile={profile}
          onOpenOptimizer={() => setIsOptimizerOpen(true)}
          onOpenAutocomplete={() => setIsAutocompleteModalOpen(true)}
        />
      </div>

      {/* INTELLIGENT BUDGET ALERTS PANEL (DYNAMIC THRESHOLDS 50%, 75%, 90%) */}
      <BudgetAlertsPanel
        payments={payments}
        profile={profile}
        categoryBudgets={categoryBudgets}
        onUpdateCategoryBudgets={onUpdateCategoryBudgets}
        alertThresholds={alertThresholds}
        globalAlertThreshold={globalAlertThreshold}
        onUpdateAlertThresholds={onUpdateAlertThresholds}
        onTogglePaymentStatus={onTogglePaymentStatus}
        onNavigateToRadar={onNavigateToRadar}
        onOpenVoiceAssistant={onOpenVoiceAssistantWithPrompt}
        onOpenNotificationCenter={onOpenNotificationCenter}
        onOpenOptimizer={() => setIsOptimizerOpen(true)}
        onOpenAutocomplete={() => setIsAutocompleteModalOpen(true)}
        onOpenUserSettings={onOpenUserSettings}
        isDndActive={isDndActive}
      />

      {/* WIDGET DE PROGRESO DE AHORRO (RECHARTS BARRA DE PROGRESO INTERACTIVA) */}
      <SavingsProgressWidget
        goals={goals}
        profile={profile}
        netSavings={netSavings}
        onUpdateGoalAmount={handleGoalAmountUpdateWithStreak}
        onOpenAddGoal={() => {
          const addGoalBtn = document.querySelector('[data-testid="add-goal-btn"]') as HTMLButtonElement | null;
          if (addGoalBtn) addGoalBtn.click();
        }}
      />

      {/* METAS DE AHORRO PROGRAMADAS COMPONENT */}
      <SavingsGoalsSection
        goals={goals}
        profile={profile}
        onAddGoal={onAddGoal}
        onUpdateGoalAmount={handleGoalAmountUpdateWithStreak}
        onDeleteGoal={onDeleteGoal}
        onOpenVoiceAssistantWithPrompt={onOpenVoiceAssistantWithPrompt}
        onCelebrateMilestone={(goal, tier: GoalMilestoneTier) => {
          const pct =
            goal.targetAmount > 0
              ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
              : tier;
          setManualMilestoneEvent({
            id: `${goal.id}-replay-${tier}-${Date.now()}`,
            goalId: goal.id,
            goalTitle: goal.title,
            milestone: tier,
            currentAmount: goal.currentAmount,
            targetAmount: goal.targetAmount,
            exactPercent: pct,
            isReplay: true,
          });
        }}
      />

      {/* INTERACTIVE CONFETTI CELEBRATION FOR 50%, 75%, 100% GOAL MILESTONES */}
      <GoalMilestoneConfettiCelebration
        goals={goals}
        profile={profile}
        manualReplayEvent={manualMilestoneEvent}
        onClearManualReplay={() => setManualMilestoneEvent(null)}
      />

      {/* INTERACTIVE FINANCIAL MILESTONES TIMELINE (FIRST $1000, DEBT-FREE DATE, GOALS) */}
      <FinancialMilestonesTimeline
        goals={goals}
        payments={payments}
        profile={profile}
        netSavings={netSavings}
        onOpenAddGoal={() => {
          const addGoalBtn = document.querySelector('[data-testid="add-goal-btn"]') as HTMLButtonElement | null;
          if (addGoalBtn) addGoalBtn.click();
        }}
      />

      {/* AI GOAL OPTIMIZER WIDGET (SPENDING TREND ANALYSIS & INCREMENTAL CONTRIBUTION ACCELERATION) */}
      <AIGoalOptimizerWidget
        goals={goals}
        payments={payments}
        categoryBudgets={categoryBudgets}
        profile={profile}
        netSavings={netSavings}
        onUpdateGoalMonthlyContribution={(id, newMonthly) =>
          onUpdateGoalMonthlyContribution?.(id, newMonthly)
        }
        onOpenAddGoal={() => {
          const addGoalBtn = document.querySelector('[data-testid="add-goal-btn"]') as HTMLButtonElement | null;
          if (addGoalBtn) addGoalBtn.click();
        }}
      />

      {/* RECHARTS SAVINGS GOALS PROGRESS EVOLUTION LINE CHART (EVOLUCIÓN TEMPORAL DEL CUMPLIMIENTO) */}
      <SavingsGoalsProgressEvolutionChart
        goals={goals}
        profile={profile}
        onOpenAddGoal={() => {
          const addGoalBtn = document.querySelector('[data-testid="add-goal-btn"]') as HTMLButtonElement | null;
          if (addGoalBtn) addGoalBtn.click();
        }}
      />

      {/* RECHARTS CUMULATIVE MONTHLY SAVINGS PROJECTION LINE CHART */}
      <CumulativeSavingsProjectionLineChart
        goals={goals}
        profile={profile}
        totalIncome={totalIncome}
        fixedExpenses={fixedExpenses}
        variableExpenses={variableExpenses}
        netSavings={netSavings}
        onOpenAddGoal={() => {
          // Trigger add goal
          const addGoalBtn = document.querySelector('[data-testid="add-goal-btn"]') as HTMLButtonElement | null;
          if (addGoalBtn) addGoalBtn.click();
        }}
        onOpenVoiceAssistant={
          onOpenVoiceAssistantWithPrompt
            ? (prompt) => onOpenVoiceAssistantWithPrompt(prompt || '')
            : undefined
        }
      />

      {/* SMART FINANCIAL ALERTS (Transport & Rent Triggers) */}
      {(transportExceeds || rentExceeds) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {transportExceeds && (
            <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-700/50 shadow-md flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <Car className="w-6 h-6" />
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-amber-200">
                    Gasto Elevado en Transporte ({profile.currencySymbol}{transportExpenses}/mes)
                  </h4>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300">
                    Alerta IA
                  </span>
                </div>
                <p className="text-xs text-amber-100/80 leading-relaxed">
                  Tu gasto en taxis y transporte supera el umbral crítico. Este monto ya cubre la cuota mensual de crédito para un automóvil económico o híbrido seminuevo en {profile.country}.
                </p>
                <button
                  onClick={onNavigateToRadar}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-300 hover:text-cyan-200 underline pt-1"
                >
                  <span>Ver comparativa y buscar autos en tiempo real</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {rentExceeds && (
            <div className="p-5 rounded-2xl bg-indigo-950/30 border border-indigo-700/50 shadow-md flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
                <Home className="w-6 h-6" />
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-indigo-200">
                    Alquiler Significativo ({profile.currencySymbol}{rentExpenses}/mes)
                  </h4>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300">
                    Estrategia IA
                  </span>
                </div>
                <p className="text-xs text-indigo-100/80 leading-relaxed">
                  Estás pagando {profile.currencySymbol}{rentExpenses} en alquiler cada mes ({profile.currencySymbol}{rentExpenses * 12}/año a fondo perdido). La IA puede evaluar viviendas en venta con hipotecas comparables en {profile.country}.
                </p>
                <button
                  onClick={onNavigateToRadar}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-300 hover:text-cyan-200 underline pt-1"
                >
                  <span>Ver opciones de vivienda y créditos</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HISTORIAL RECIENTE (ÚLTIMOS 5 MOVIMIENTOS FINANCIEROS CON EDICIÓN Y ELIMINACIÓN) */}
      <RecentTransactionsHistory
        payments={payments}
        profile={profile}
        onUpdatePayment={onUpdatePayment}
        onDeletePayment={onDeletePayment}
        onTogglePaymentStatus={onTogglePaymentStatus}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenDateRangeCSV={() => setIsDateRangeCSVOpen(true)}
      />

      {/* Programmed Payments & Calendar Controls */}
      <div className="space-y-4">
        {/* Top Control Bar with View Mode Toggle and Ordered Action Buttons Ribbon */}
        <div className={`flex flex-col gap-3.5 p-3.5 sm:p-4 rounded-3xl border ${
          isNitido ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/95 backdrop-blur-md border-slate-800/80 shadow-xl'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold pl-1 uppercase tracking-wider ${isNitido ? 'text-slate-700' : 'text-slate-400'}`}>Vista de Pagos:</span>
              <div className={`flex items-center p-1 rounded-2xl border ${isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                <button
                  type="button"
                  onClick={() => setPaymentsViewMode('calendar')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    paymentsViewMode === 'calendar'
                      ? isNitido
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : isVibrant
                        ? 'bg-gradient-to-r from-[#00d2ff] via-[#7928ca] to-[#d946ef] text-white shadow-[0_0_15px_rgba(0,210,255,0.4)]'
                        : 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md'
                      : isNitido ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  <span>Calendario Mensual</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentsViewMode('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    paymentsViewMode === 'list'
                      ? isNitido
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : isVibrant
                        ? 'bg-gradient-to-r from-[#00d2ff] via-[#7928ca] to-[#d946ef] text-white shadow-[0_0_15px_rgba(0,210,255,0.4)]'
                        : 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md'
                      : isNitido ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lista ({payments.length})</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={handleExportTransactionsAndGoalsCSV}
                className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all active:scale-95 border whitespace-nowrap shrink-0 ${
                  isNitido
                    ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-xs'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-600 shadow-sm'
                }`}
                title="Descargar historial completo de transacciones y metas de ahorro en CSV"
              >
                <Download className="w-4 h-4 text-emerald-500" />
                <span>Exportar Historial y Metas (CSV)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDateRangeCSVOpen(true)}
                className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all active:scale-95 border whitespace-nowrap shrink-0 ${
                  isNitido
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-md'
                }`}
                title="Descargar reporte CSV filtrado por rango de fechas seleccionado"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Reporte CSV por Fechas</span>
              </button>

              {/* Main Primary Action: New Payment Button */}
              <button
                onClick={() => setIsAddModalOpen(true)}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-2xl text-white text-xs sm:text-sm transition-all active:scale-95 ${
                  isNitido
                    ? 'bg-indigo-600 hover:bg-indigo-700 font-bold shadow-xs text-white-fixed'
                    : isVibrant
                    ? 'bg-gradient-to-r from-[#00d2ff] via-[#7928ca] to-[#ff0080] font-black shadow-[0_0_20px_rgba(0,210,255,0.45)] ring-1 ring-cyan-300 hover:scale-105'
                    : 'bg-gradient-to-r from-cyan-500 via-indigo-600 to-violet-600 hover:from-cyan-400 hover:to-violet-500 font-extrabold shadow-lg shadow-cyan-500/25'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Programar Pago o Gasto</span>
              </button>
            </div>
          </div>

          {/* Ordered Quick-Actions Deck Ribbon */}
          <div className={`flex items-center gap-2 overflow-x-auto no-scrollbar py-1 border-t pt-2.5 ${isNitido ? 'border-slate-100' : 'border-slate-800/80'}`}>
            <button
              onClick={() => setIsReceiptScannerOpen(true)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all shadow-xs active:scale-95 border ${
                isNitido
                  ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border-emerald-500/30'
              }`}
              title="Escanear recibo o ticket físico con la cámara"
            >
              <Camera className="w-4 h-4 text-emerald-600" />
              <span>Escanear Recibo</span>
            </button>

            <button
              onClick={() => setIsSavingsStrategyOpen(true)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all shadow-xs active:scale-95 border ${
                isNitido
                  ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  : 'bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border-cyan-500/30'
              }`}
              title="Generar plan de ahorro personalizado a 6 meses"
            >
              <TrendingUp className="w-4 h-4 text-cyan-600" />
              <span>Plan de Ahorro 6M</span>
            </button>

            <button
              onClick={() => setIsAutocompleteModalOpen(true)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all shadow-xs active:scale-95 border ${
                isNitido
                  ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  : 'bg-teal-950/60 hover:bg-teal-900/60 text-teal-300 border-teal-500/30'
              }`}
              title="Autocompletar límites de gasto con promedio de 3 meses"
            >
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>Autocompletar (3M)</span>
            </button>

            <button
              onClick={() => setIsOptimizerOpen(true)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all shadow-xs active:scale-95 border ${
                isNitido
                  ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  : 'bg-violet-950/60 hover:bg-violet-900/60 text-violet-300 border-violet-500/30'
              }`}
              title="Optimizar presupuestos con IA"
            >
              <Sparkles className="w-4 h-4 text-violet-600" />
              <span>Optimizar IA</span>
            </button>

            <button
              onClick={() => setIsDateRangeCSVOpen(true)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all shadow-xs active:scale-95 border ${
                isNitido
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                  : 'bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border-emerald-700/60'
              }`}
              title="Generar y descargar reporte CSV detallado filtrado por rango de fechas"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Reporte CSV por Fechas</span>
            </button>

            <button
              type="button"
              onClick={handleExportTransactionsAndGoalsCSV}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 transition-colors active:scale-95 border ${
                isNitido
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                  : 'bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border-emerald-700/60'
              }`}
              title="Descargar inmediatamente historial completo de transacciones y metas de ahorro en CSV"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>CSV Transacciones y Metas</span>
            </button>

            <button
              onClick={() => setIsExportModalOpen(true)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 transition-colors active:scale-95 border ${
                isNitido
                  ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-emerald-300 border-slate-700'
              }`}
              title="Personalizar exportación avanzada de pagos, metas, notas y estrategia en CSV o JSON"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Exportar Avanzado (CSV/JSON)</span>
            </button>

            {onDownloadPDF && (
              <button
                onClick={onDownloadPDF}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 transition-colors active:scale-95 border ${
                  isNitido
                    ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-700'
                }`}
                title="Generar y descargar informe financiero en PDF"
              >
                <FileDown className="w-4 h-4 text-cyan-600" />
                <span>Informe PDF</span>
              </button>
            )}
          </div>
        </div>

        {/* CSV Export Success Feedback Banner */}
        {csvNotification && (
          <div className="p-3 sm:p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3 shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <span className="font-semibold">{csvNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => setCsvNotification(null)}
              className="text-emerald-700 hover:text-emerald-950 text-xs px-2 py-1 rounded-md hover:bg-emerald-100 transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        {/* Render Calendar View or List View */}
        {paymentsViewMode === 'calendar' ? (
          <FinancialCalendarView
            payments={payments}
            profile={profile}
            onTogglePaymentStatus={onTogglePaymentStatus}
            onAddPaymentOnDate={handleAddPaymentOnDate}
            onReschedulePayment={(id, newDueDate) => onUpdatePayment(id, { dueDate: newDueDate })}
          />
        ) : (
          <div className="space-y-4">
            {/* Filter buttons & CSV Export for List View */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className={`flex items-center gap-1.5 p-1 rounded-xl border w-fit ${
                isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-800'
              }`}>
                <button
                  onClick={() => setFilterType('todos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterType === 'todos' 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : isNitido ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Todos ({payments.length})
                </button>
                <button
                  onClick={() => setFilterType('fijos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterType === 'fijos' 
                      ? 'bg-amber-600 text-white shadow-xs' 
                      : isNitido ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Fijos ({payments.filter((p) => p.type === 'gasto' && p.isFixed).length})
                </button>
                <button
                  onClick={() => setFilterType('variables')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterType === 'variables' 
                      ? 'bg-rose-600 text-white shadow-xs' 
                      : isNitido ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Variables ({payments.filter((p) => p.type === 'gasto' && !p.isFixed).length})
                </button>
                <button
                  onClick={() => setFilterType('ingresos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterType === 'ingresos' 
                      ? 'bg-emerald-600 text-white shadow-xs' 
                      : isNitido ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Ingresos ({payments.filter((p) => p.type === 'ingreso').length})
                </button>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={handleExportTransactionsAndGoalsCSV}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-2xs ${
                    isNitido
                      ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                  title="Descargar historial completo de transacciones y metas de ahorro en archivo CSV"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Exportar Todo + Metas (CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDateRangeCSVOpen(true)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-2xs ${
                    isNitido
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                      : 'bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border-emerald-700/60'
                  }`}
                  title="Generar y descargar reporte CSV de movimientos filtrados por rango de fechas"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Exportar CSV por Fechas</span>
                </button>
              </div>
            </div>

            {/* Payments Table / Cards with Grouped Auto-Attachments */}
            <div className={`rounded-2xl border overflow-hidden shadow-sm divide-y ${
              isNitido 
                ? 'bg-white border-slate-200 divide-slate-100' 
                : 'bg-slate-900 border-slate-800 divide-slate-800/80 shadow-lg'
            }`}>
          {filteredPayments.map((payment) => {
            const isIncome = payment.type === 'ingreso';
            const isPaid = payment.status === 'pagado';
            const matchedFiles = availableFiles.filter((f) =>
              payment.matchedFileIds?.includes(f.id)
            );
            const matchedContacts = availableContacts.filter((c) =>
              payment.matchedContactIds?.includes(c.id)
            );
            const isMatching = matchingPaymentId === payment.id;

            return (
              <div
                key={payment.id}
                className={`p-4 sm:p-5 flex flex-col gap-3 transition-colors ${
                  isNitido ? 'hover:bg-slate-50/80' : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <button
                      onClick={() => onTogglePaymentStatus(payment.id)}
                      title={isPaid ? 'Marcar como pendiente' : 'Marcar como pagado'}
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                        isPaid
                          ? 'bg-emerald-600 border-emerald-500 text-white shadow-xs'
                          : isNitido ? 'border-slate-300 hover:border-slate-500 text-transparent' : 'border-slate-600 hover:border-slate-400 text-transparent'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </button>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`text-sm font-bold ${
                          isPaid 
                            ? 'line-through text-slate-400' 
                            : isNitido ? 'text-slate-900' : 'text-white'
                        }`}>
                          {payment.title}
                        </h4>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          isIncome
                            ? isNitido ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : payment.isFixed
                            ? isNitido ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : isNitido ? 'bg-rose-50 text-rose-900 border-rose-200' : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        }`}>
                          {isIncome ? 'Ingreso' : payment.isFixed ? 'Gasto Fijo' : 'Gasto Variable'}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md ${
                          isNitido ? 'text-slate-700 bg-slate-100 border border-slate-200' : 'text-slate-400 bg-slate-800'
                        }`}>
                          {payment.category}
                        </span>
                        {payment.merchant && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${
                            isNitido ? 'text-cyan-900 bg-cyan-50 border-cyan-200' : 'text-cyan-300 bg-cyan-950/60 border-cyan-800/40'
                          }`}>
                            📍 {payment.merchant}
                          </span>
                        )}
                        {payment.receiptImage && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectFilePreview({
                                id: `recibo-${payment.id}`,
                                name: `Ticket de ${payment.merchant || payment.title}`,
                                type: 'receipt',
                                size: 'Comprobante',
                                url: payment.receiptImage!,
                                description: `Recibo físico escaneado con cámara. Monto: ${profile.currencySymbol}${payment.amount}.`,
                                tags: ['#recibo', '#ticket', `#${payment.category}`],
                                uploadDate: payment.dueDate,
                                category: 'factura',
                              }, 'Comprobante escaneado con cámara');
                            }}
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors border ${
                              isNitido
                                ? 'text-emerald-800 hover:text-emerald-950 bg-emerald-50 border-emerald-200'
                                : 'text-emerald-300 hover:text-emerald-200 bg-emerald-950/60 border-emerald-700/50'
                            }`}
                          >
                            <Camera className="w-3 h-3 text-emerald-600" />
                            <span>Ver Recibo</span>
                          </button>
                        )}
                      </div>

                      <div className={`flex items-center gap-3 text-xs mt-1 flex-wrap ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> {payment.status === 'pagado' ? 'Pagado:' : 'Vence:'} {payment.dueDate}
                        </span>
                        <span>·</span>
                        <span className="capitalize">{payment.frequency}</span>
                        {payment.beneficiary && (
                          <>
                            <span>·</span>
                            <span className={`font-semibold ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                              👤 {payment.beneficiary}
                            </span>
                          </>
                        )}
                      </div>
                      {payment.detail && (
                        <p className={`text-[11px] mt-1 leading-snug ${isNitido ? 'text-slate-500' : 'text-slate-500'}`}>
                          {payment.detail}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    <div className="text-right">
                      <span className={`text-base sm:text-lg font-black block ${
                        isIncome 
                          ? isNitido ? 'text-emerald-700' : 'text-emerald-400' 
                          : isNitido ? 'text-slate-900' : 'text-white'
                      }`}>
                        {isIncome ? '+' : '-'}{profile.currencySymbol}{payment.amount.toLocaleString()}
                      </span>
                      <span className={`text-[11px] font-semibold ${
                        isPaid 
                          ? isNitido ? 'text-emerald-700' : 'text-emerald-400'
                          : isNitido ? 'text-amber-800' : 'text-amber-400'
                      }`}>
                        {isPaid ? 'Pagado ✓' : 'Pendiente'}
                      </span>
                    </div>

                    <button
                      onClick={() => onDeletePayment(payment.id)}
                      title="Eliminar pago"
                      className={`p-2 rounded-lg transition-colors ${
                        isNitido ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' : 'text-slate-500 hover:text-rose-400 hover:bg-slate-800'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Grouped Auto-Attachments for this transaction */}
                {(matchedFiles.length > 0 || matchedContacts.length > 0) ? (
                  <div className={`p-2.5 rounded-xl border flex items-center gap-3 flex-wrap text-xs ${
                    isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-cyan-900/30'
                  }`}>
                    <span className={`text-[11px] font-bold flex items-center gap-1 ${isNitido ? 'text-indigo-900' : 'text-cyan-400'}`}>
                      <Sparkles className={`w-3 h-3 ${isNitido ? 'text-indigo-600' : 'text-cyan-400'}`} />
                      Auto-Adjuntos:
                    </span>
                    {matchedFiles.map((file) => (
                      <div
                        key={file.id}
                        onClick={() => onSelectFilePreview(file, 'Comprobante / archivo vinculado al pago')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border cursor-pointer text-[11px] transition-colors ${
                          isNitido
                            ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800'
                            : 'bg-slate-900 hover:bg-slate-800 border-slate-700/60 text-slate-200 hover:text-cyan-300'
                        }`}
                      >
                        <Paperclip className={`w-3 h-3 ${isNitido ? 'text-indigo-600' : 'text-cyan-400'}`} />
                        <span className="truncate max-w-[150px]">{file.name}</span>
                      </div>
                    ))}
                    {matchedContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] ${
                          isNitido ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-700/60 text-slate-300'
                        }`}
                      >
                        <User className={`w-3 h-3 ${isNitido ? 'text-indigo-600' : 'text-indigo-400'}`} />
                        <span>{contact.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`flex items-center justify-between text-xs pt-1 ${isNitido ? 'text-slate-500' : 'text-slate-500'}`}>
                    <span>Sin comprobantes adjuntos</span>
                    <button
                      onClick={() => handleAutoMatchForPayment(payment)}
                      disabled={isMatching}
                      className={`text-[11px] font-bold flex items-center gap-1 ${
                        isNitido ? 'text-indigo-700 hover:text-indigo-900' : 'text-cyan-400 hover:text-cyan-300'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      {isMatching ? 'Escaneando galería...' : 'Escanear Galería y Auto-Adjuntar'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    )}
  </div>

      {/* Modal: Ajustar Ingreso Mensual */}
      {isEditIncomeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className={`border rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 ${
            isNitido ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-base font-bold flex items-center gap-2 ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                <Sliders className={`w-4 h-4 ${isNitido ? 'text-indigo-600' : 'text-cyan-400'}`} />
                Ajustar Ingreso Mensual
              </h3>
              <button
                onClick={() => setIsEditIncomeOpen(false)}
                className={`p-1 rounded-lg ${isNitido ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveIncome} className="space-y-4">
              <div>
                <label className={`text-xs font-bold block mb-1.5 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                  ¿Cuánto ganas mensualmente en total? ({profile.currency})
                </label>
                <div className="relative">
                  <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                    {profile.currencySymbol}
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={tempIncome}
                    onChange={(e) => setTempIncome(Number(e.target.value))}
                    className={`w-full pl-8 pr-4 py-2.5 rounded-xl font-bold focus:ring-2 focus:outline-none border ${
                      isNitido
                        ? 'bg-white border-slate-300 text-slate-900 focus:ring-indigo-500'
                        : 'bg-slate-950 border-slate-800 text-white focus:ring-cyan-500/40'
                    }`}
                    required
                  />
                </div>
              </div>
              <div className={`flex justify-end gap-2 pt-2 border-t ${isNitido ? 'border-slate-200' : 'border-slate-800'}`}>
                <button
                  type="button"
                  onClick={() => setIsEditIncomeOpen(false)}
                  className={`px-4 py-2 text-xs font-bold rounded-xl ${
                    isNitido ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-colors"
                >
                  Guardar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Programar Nuevo Pago */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className={`border rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
            isNitido ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-base font-bold flex items-center gap-2 ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                <Plus className={`w-4 h-4 ${isNitido ? 'text-indigo-600' : 'text-cyan-400'}`} />
                Programar Pago Fijo o Variable
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className={`p-1 rounded-lg ${isNitido ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4">
              {/* Shortcut to Camera Scanner */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-slate-900 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">¿Tienes un ticket o recibo en papel?</p>
                    <p className="text-[11px] text-slate-400">Escanéalo con la cámara para extraer monto, fecha y categoría</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsReceiptScannerOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Usar Cámara</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setNewType('gasto')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    newType === 'gasto' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Gasto / Pago
                </button>
                <button
                  type="button"
                  onClick={() => setNewType('ingreso')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    newType === 'ingreso' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Ingreso Extra / Sueldo
                </button>
              </div>

              <div>
                <label htmlFor="payment-concept" className={`text-xs font-semibold block mb-1 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                  Concepto o Descripción del Pago
                </label>
                <input
                  id="payment-concept"
                  name="concept"
                  type="text"
                  autoComplete="off"
                  placeholder="Ej: Cena en restaurante, Uber al trabajo, Renta departamento, Boletos de cine..."
                  value={newTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:outline-none border ${
                    isNitido
                      ? 'bg-white border-slate-300 text-slate-900 focus:ring-indigo-500'
                      : 'bg-slate-950 border-slate-800 text-white focus:ring-cyan-500/40'
                  }`}
                  required
                />

                {/* Quick Examples for Auto-Classification testing */}
                {!newTitle && (
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-semibold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                      Prueba con ejemplos:
                    </span>
                    {[
                      { text: 'Cena en restaurante sushi', label: '🍕 Comida' },
                      { text: 'Gasolina auto / Uber', label: '🚗 Transporte' },
                      { text: 'Renta mensual departamento', label: '🏠 Hogar' },
                      { text: 'Boletos de cine y palomitas', label: '🎮 Ocio' },
                    ].map((sample) => (
                      <button
                        key={sample.text}
                        type="button"
                        onClick={() => handleTitleChange(sample.text)}
                        className={`text-[10px] px-2 py-0.5 rounded-md border font-medium transition-all ${
                          isNitido
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                      >
                        {sample.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Live Classification Suggestion Box */}
                {categorySuggestion && (
                  <div
                    className={`mt-2.5 p-3 rounded-2xl border transition-all ${
                      isNitido
                        ? 'bg-indigo-50/70 border-indigo-200 text-slate-800 shadow-2xs'
                        : 'bg-indigo-950/40 border-indigo-700/60 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                              Clasificación sugerida:
                            </span>
                            <span className="text-xs font-black text-indigo-700 dark:text-indigo-400">
                              {categorySuggestion.categoryLabel}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-600 dark:text-slate-400">
                            {categorySuggestion.explanation}
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                        {categorySuggestion.confidence}% coincidencia
                      </span>
                    </div>

                    {/* Quick Category Suggestion Pills */}
                    <div className="mt-2.5 pt-2 border-t border-indigo-100 dark:border-indigo-800/60 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-semibold text-slate-500">Categoría sugerida:</span>
                        <button
                          type="button"
                          onClick={() => handleApplyCategorySuggestion(categorySuggestion.category, categorySuggestion.suggestedIsFixed)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                            newCategory === categorySuggestion.category
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-indigo-900 dark:text-indigo-300 border-indigo-200 hover:bg-indigo-50'
                          }`}
                        >
                          ✓ {categorySuggestion.categoryLabel} ({categorySuggestion.confidence}%)
                        </button>

                        {categorySuggestion.alternatives.map((alt: { category: PaymentItem['category']; label: string; confidence: number }) => (
                          <button
                            key={alt.category}
                            type="button"
                            onClick={() => handleApplyCategorySuggestion(alt.category)}
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-all ${
                              newCategory === alt.category
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {alt.label}
                          </button>
                        ))}
                      </div>

                      {newCategory === categorySuggestion.category ? (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Asignada al registro
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleApplyCategorySuggestion(categorySuggestion.category, categorySuggestion.suggestedIsFixed)}
                          className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                        >
                          Reasignar a sugerida
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="payment-amount" className={`text-xs font-semibold block mb-1 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                    Monto ({profile.currencySymbol})
                  </label>
                  <input
                    id="payment-amount"
                    name="amount"
                    type="number"
                    min="0.1"
                    step="any"
                    placeholder="0.00"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className={`w-full px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:outline-none border ${
                      isNitido
                        ? 'bg-white border-slate-300 text-slate-900 focus:ring-indigo-500'
                        : 'bg-slate-950 border-slate-800 text-white focus:ring-cyan-500/40'
                    }`}
                    required
                  />
                </div>

                {newType === 'gasto' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="payment-nature" className={`text-xs font-semibold ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                        Naturaleza del Gasto
                      </label>
                      {categorySuggestion && (
                        <span className="text-[9px] font-semibold text-slate-500">
                          Sugerido: {categorySuggestion.suggestedIsFixed ? 'Fijo' : 'Variable'}
                        </span>
                      )}
                    </div>
                    <select
                      id="payment-nature"
                      name="nature"
                      value={newIsFixed ? 'fijo' : 'variable'}
                      onChange={(e) => {
                        setNewIsFixed(e.target.value === 'fijo');
                        setHasManuallySelectedIsFixed(true);
                      }}
                      className={`w-full px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:outline-none cursor-pointer border ${
                        isNitido
                          ? 'bg-white border-slate-300 text-slate-900 focus:ring-indigo-500'
                          : 'bg-slate-950 border-slate-800 text-white focus:ring-cyan-500/40'
                      }`}
                    >
                      <option value="fijo">Gasto Fijo (recurrente obligatorio)</option>
                      <option value="variable">Gasto Variable (consumo fluctuante)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="payment-category" className={`text-xs font-semibold ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                      Categoría
                    </label>
                    {categorySuggestion && newCategory === categorySuggestion.category && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                        Auto-sugerida ✓
                      </span>
                    )}
                  </div>
                  <select
                    id="payment-category"
                    name="category"
                    value={newCategory}
                    onChange={(e) => {
                      setNewCategory(e.target.value as any);
                      setHasManuallySelectedCategory(true);
                    }}
                    className={`w-full px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:outline-none cursor-pointer border ${
                      isNitido
                        ? 'bg-white border-slate-300 text-slate-900 focus:ring-indigo-500'
                        : 'bg-slate-950 border-slate-800 text-white focus:ring-cyan-500/40'
                    }`}
                  >
                    <option value="alquiler">🏠 Hogar / Vivienda / Alquiler</option>
                    <option value="transporte">🚗 Transporte / Vehículo / Movilidad</option>
                    <option value="alimentacion">🍕 Comida / Alimentación / Supermercado</option>
                    <option value="ocio">🎮 Ocio / Entretenimiento / Salidas</option>
                    <option value="servicios">⚡ Servicios Básicos (Luz, Agua, Net)</option>
                    <option value="salud">🩺 Salud y Medicamentos</option>
                    <option value="educacion">📚 Educación</option>
                    <option value="sueldo">💵 Nómina / Sueldo</option>
                    <option value="freelance">💼 Honorarios / Freelance</option>
                    <option value="otro">📦 Otro</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="payment-frequency" className={`text-xs font-semibold block mb-1 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                    Frecuencia
                  </label>
                  <select
                    id="payment-frequency"
                    name="frequency"
                    value={newFrequency}
                    onChange={(e) => setNewFrequency(e.target.value as any)}
                    className={`w-full px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:outline-none cursor-pointer border ${
                      isNitido
                        ? 'bg-white border-slate-300 text-slate-900 focus:ring-indigo-500'
                        : 'bg-slate-950 border-slate-800 text-white focus:ring-cyan-500/40'
                    }`}
                  >
                    <option value="mensual">Mensual</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="unico">Pago Único</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="payment-duedate" className={`text-xs font-semibold block mb-1 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                  Fecha de Vencimiento / Pago
                </label>
                <input
                  id="payment-duedate"
                  name="duedate"
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:outline-none border ${
                    isNitido
                      ? 'bg-white border-slate-300 text-slate-900 focus:ring-indigo-500'
                      : 'bg-slate-950 border-slate-800 text-white focus:ring-cyan-500/40'
                  }`}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-md"
                >
                  Registrar en Calendario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3-MONTH BUDGET OPTIMIZER MODAL */}
      <BudgetOptimizerModal
        isOpen={isOptimizerOpen}
        onClose={() => setIsOptimizerOpen(false)}
        payments={payments}
        profile={profile}
        goals={goals}
        categoryBudgets={categoryBudgets}
        onApplyCategoryBudgets={onUpdateCategoryBudgets}
      />

      {/* 6-MONTH SAVINGS STRATEGY MODAL */}
      <SavingsStrategyModal
        isOpen={isSavingsStrategyOpen}
        onClose={() => setIsSavingsStrategyOpen(false)}
        payments={payments}
        profile={profile}
        goals={goals}
        categoryBudgets={categoryBudgets}
        onApplyCategoryBudgets={onUpdateCategoryBudgets}
      />

      {/* BUDGET AUTOCOMPLETE MODAL (BASED ON LAST 3 MONTHS AVERAGE) */}
      <BudgetAutocompleteModal
        isOpen={isAutocompleteModalOpen}
        onClose={() => setIsAutocompleteModalOpen(false)}
        payments={payments}
        profile={profile}
        categoryBudgets={categoryBudgets}
        onApplyBudgets={onUpdateCategoryBudgets}
        onSuccessMessage={(msg) => {
          setCsvNotification(msg);
          setTimeout(() => setCsvNotification(null), 5000);
        }}
      />

      {/* EXPORT DATA MODAL (CSV OR JSON FOR EXTERNAL ANALYSIS) */}
      <ExportDataModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        payments={payments}
        goals={goals}
        notes={notes}
        profile={profile}
        categoryBudgets={categoryBudgets}
        onExportSuccess={(msg) => {
          setCsvNotification(msg);
          setTimeout(() => setCsvNotification(null), 5000);
        }}
      />

      {/* DATE RANGE FILTERED CSV EXPORT MODAL */}
      <DateRangeCSVExportModal
        isOpen={isDateRangeCSVOpen}
        onClose={() => setIsDateRangeCSVOpen(false)}
        payments={payments}
        profile={profile}
        onExportSuccess={(msg) => {
          setCsvNotification(msg);
          setTimeout(() => setCsvNotification(null), 5000);
        }}
      />

      {/* RECEIPT SCANNER MODAL (CAMERA & AI VISION) */}
      <ReceiptScannerModal
        isOpen={isReceiptScannerOpen}
        onClose={() => setIsReceiptScannerOpen(false)}
        onAddPayment={onAddPayment}
        profile={profile}
        onAddFileToGallery={onAddFileToGallery}
      />
    </div>
  );
};
