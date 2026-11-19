export type NoteCategory = 'finanzas' | 'vivienda' | 'transporte' | 'trabajo' | 'personal' | 'salud' | 'general' | 'meta_ahorro';

export type VoiceIntentType = 'nota' | 'transaccion' | 'meta_ahorro' | 'consulta';

export interface VoiceShortcut {
  id: string;
  trigger: string;
  promptTemplate: string;
  category: VoiceIntentType;
  description?: string;
  isCustom?: boolean;
}

export interface VoiceCommandLogItem {
  id: string;
  commandText: string;
  intent: VoiceIntentType | 'auto';
  executedAt: string;
  summaryResult?: string;
  success: boolean;
}

export interface FileMatchDetail {
  fileId: string;
  confidence: number; // 0 - 100
  reason: string;
  matchedKeywords: string[];
}

export interface ContactMatchDetail {
  contactId: string;
  confidence: number; // 0 - 100
  reason: string;
}

export interface CategoryBudget {
  category: string;
  budgetLimit: number;
}

export interface CategoryAlert {
  category: string;
  categoryLabel: string;
  spent: number;
  budget: number;
  percentage: number;
  threshold?: number;
  status: 'safe' | 'warning' | 'exceeded'; // safe: <threshold%, warning: threshold-99%, exceeded: >=100%
  message: string;
  aiRecommendation?: string;
}

export interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string; // YYYY-MM-DD
  category: 'auto' | 'vivienda' | 'emergencia' | 'retiro' | 'viaje' | 'otro';
  monthlyContribution: number;
  notes?: string;
  createdAt: string;
}

export interface DeviceFile {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'document' | 'receipt';
  size: string;
  url: string;
  description: string;
  tags: string[];
  uploadDate: string;
  category: 'vehiculo' | 'vivienda' | 'factura' | 'documento' | 'salud' | 'otro';
}

export interface DeviceContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  avatar?: string;
  notes: string;
  category: 'mecanico' | 'inmobiliaria' | 'bienes_raices' | 'servicios' | 'personal' | 'medico' | 'otro';
}

export interface PaymentItem {
  id: string;
  title: string;
  amount: number;
  type: 'gasto' | 'ingreso';
  isFixed: boolean; // true = Gasto Fijo, false = Gasto Variable
  category: 'alquiler' | 'transporte' | 'alimentacion' | 'servicios' | 'ocio' | 'salud' | 'educacion' | 'sueldo' | 'freelance' | 'otro';
  frequency: 'unico' | 'mensual' | 'quincenal' | 'anual';
  dueDate: string; // YYYY-MM-DD
  status: 'pendiente' | 'pagado' | 'vencido';
  noteId?: string;
  matchedFileIds?: string[];
  matchedContactIds?: string[];
  receiptImage?: string;
  merchant?: string;
  /** Persona o entidad que recibe/cobra el pago (detectada por la IA). */
  beneficiary?: string;
  /** Detalle breve con el contexto del pago (detectado por la IA). */
  detail?: string;
  itemsBreakdown?: { name: string; price?: number }[];
  createdAt: string;
}

export interface ScannedReceiptResult {
  merchant: string;
  title: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: 'alquiler' | 'transporte' | 'alimentacion' | 'servicios' | 'ocio' | 'salud' | 'educacion' | 'otro';
  isFixed: boolean;
  frequency: 'unico' | 'mensual' | 'quincenal' | 'anual';
  items?: { name: string; price?: number }[];
  tax?: number;
  confidence: number;
  notes?: string;
  tags?: string[];
  receiptImage?: string;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  formattedContent: string;
  rawTranscript?: string;
  intent?: VoiceIntentType;
  tags: string[];
  category: NoteCategory;
  createdAt: string;
  updatedAt: string;
  matchedFileIds: string[];
  matchedContactIds: string[];
  matchReasons: string[];
  fileMatchDetails?: FileMatchDetail[];
  contactMatchDetails?: ContactMatchDetail[];
  isPinned?: boolean;
  linkedPaymentId?: string;
  linkedGoalId?: string;
}

export interface UserFinancialProfile {
  country: string;
  city: string;
  currency: string;
  currencySymbol: string;
  monthlyIncome: number;
  savingsGoalPercent: number; // e.g. 20%
  transportAlertThreshold: number; // e.g. $250
  rentAlertThreshold: number; // e.g. $600
}

export interface GroundingSource {
  title: string;
  url: string;
}

export interface FinancialAdviceReport {
  analysis: string;
  sources: GroundingSource[];
  country: string;
  generatedAt: string;
  vehicleRecommendation?: {
    recommended: boolean;
    monthlySavingsPotential: number;
    suggestedModels: string[];
  };
  housingRecommendation?: {
    recommended: boolean;
    equityGainProjection5Years: number;
    estimatedMortgageQuota: number;
  };
}

export interface MarketSearchResult {
  category: 'cars' | 'housing';
  result: string;
  sources: GroundingSource[];
  country: string;
  searchedAt: string;
}

export interface CategorySpendingPattern {
  category: string;
  categoryLabel: string;
  month1Spend: number;
  month2Spend: number;
  month3Spend: number;
  averageSpend: number;
  currentBudget: number;
  suggestedBudget: number;
  potentialMonthlySavings: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
  optimizationRationale: string;
  isFixed: boolean;
  cutPercentage: number;
}

export interface GoalAccelerationImpact {
  goalTitle: string;
  targetAmount: number;
  currentAmount: number;
  originalMonthsRemaining: number;
  acceleratedMonthsRemaining: number;
  monthsSaved: number;
}

export interface BudgetOptimizationResult {
  categories: CategorySpendingPattern[];
  totalCurrentBudget: number;
  totalSuggestedBudget: number;
  totalMonthlySavingsGain: number;
  annualProjectedSavings: number;
  currentSavingsRate: number;
  optimizedSavingsRate: number;
  monthsAnalyzed: [string, string, string];
  aiStrategicOverview: string;
  keyActionItems: string[];
  goalsImpact: GoalAccelerationImpact[];
}

export interface CategoryCutRecommendation {
  category: string;
  categoryLabel: string;
  currentSpend: number;
  historicalAverage: number;
  excessAmount: number;
  excessPercentage: number;
  suggestedMonthlyCut: number;
  suggestedTargetSpend: number;
  cutRationale: string;
  priority: 'alta' | 'media' | 'baja';
  isFixed: boolean;
}

export interface ControlledCategoryStatus {
  category: string;
  categoryLabel: string;
  currentSpend: number;
  historicalAverage: number;
  marginBelowAverage: number;
  isFixed: boolean;
  statusMessage: string;
}

export interface MonthSavingsMilestone {
  monthIndex: number; // 1 to 6
  monthName: string;
  projectedMonthlySavings: number;
  cumulativeSavings: number;
  activeCutsTotal: number;
  milestoneTitle: string;
  focusRecommendation: string;
  isCompleted?: boolean;
}

export interface AcceleratedGoalProjection {
  goalId: string;
  goalTitle: string;
  targetAmount: number;
  currentAmount: number;
  originalMonthsRemaining: number;
  acceleratedMonthsRemaining: number;
  monthsSaved: number;
  newEstimatedDate: string;
}

export interface SixMonthSavingsStrategy {
  generatedAt: string;
  totalMonthlyCutPotential: number;
  totalSixMonthProjectedSavings: number;
  baselineMonthlySavings: number;
  optimizedMonthlySavings: number;
  currentSavingsRate: number;
  optimizedSavingsRate: number;
  exceededCategories: CategoryCutRecommendation[];
  controlledCategories: ControlledCategoryStatus[];
  sixMonthTimeline: MonthSavingsMilestone[];
  strategicSummary: string;
  acceleratedGoals: AcceleratedGoalProjection[];
  actionPlanSteps: string[];
}

export type AlertPriorityLevel = 'critica' | 'alta' | 'media' | 'baja';

export interface QuietHoursBlock {
  id: string;
  name: string;
  presetType: 'sleep' | 'work' | 'custom';
  enabled: boolean;
  startTime: string; // HH:mm (24h)
  endTime: string;   // HH:mm (24h)
  days: number[];    // 0 (Dom) - 6 (Sab)
  allowCriticalOverride: boolean;
}

export interface ExpenseNotificationRule {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  priority: AlertPriorityLevel;
  minAmountThreshold: number;
}

export interface NotificationPreferences {
  dndMasterEnabled: boolean;
  quietSchedules: QuietHoursBlock[];
  minimumActivePriority: AlertPriorityLevel;
  digestModeDuringDnd: boolean;
  expenseRules: ExpenseNotificationRule[];
  categoryPriorities: Record<string, AlertPriorityLevel>;
}


