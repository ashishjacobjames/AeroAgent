import React, { useState, useMemo, useRef, useEffect } from 'react';
// Build trigger: 2026-04-07 19:48
import {
  LayoutDashboard,
  PlaneTakeoff,
  Search,
  ChevronRight,
  CheckCircle2,
  Clock,
  Smartphone,
  Zap,
  Users,
  AlertTriangle,
  ChevronDown,
  X,
  Plane,
  Info,
  Sparkles,
  BarChart,
  Clipboard,
  Coins,
  UserCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Tooltip,
} from 'recharts';
import { Passenger, ActionType, AnalysisResult, RecoveryOption, WhatsAppMessage } from './types';

// ── Local composite types ─────────────────────────────────────────────────────
// Passenger enriched with analysis cache entry and optional group-aggregation
// fields added by CFODashboard's deduplication step.
type EnrichedPassenger = Passenger & {
  analysis: AnalysisResult;
  _groupSize?: number;
  _otherNames?: string[];
  _hasManual?: boolean;
};

// Persona IDs used on the landing selector screen
type PersonaId = 'CFO' | 'GateAgent' | 'Passenger';

import { generateSeedData } from './seed';
import { computeEngineAI, generateWhatsAppMessage } from './engine';
import {
  MEAL_VOUCHER_RATE,
  HOTEL_RATE_PER_NIGHT,
  HOTEL_TRANSFER,
  OVERNIGHT_THRESHOLD_MINUTES,
  CLV_HORIZON_YEARS,
  CLV_BASE_ECONOMY,
  CLV_BASE_PREMIUM_ECONOMY,
  CLV_BASE_BUSINESS,
  CLV_BASE_FIRST,
  CLV_TIER_BASIC,
  CLV_TIER_SILVER,
  CLV_TIER_GOLD,
  CLV_TIER_PLATINUM,
  CLV_TIER_EMERALD,
  CHURN_BASE_CANCELLED,
  CHURN_BASE_8H_PLUS,
  CHURN_BASE_4_TO_8H,
  CHURN_BASE_2_TO_4H,
  CHURN_BASE_UNDER_2H,
  CHURN_TRADITIONAL_MULTIPLIER,
  CHURN_TRADITIONAL_CAP,
  CHURN_SAVING_CAP_PCT,
  CHURN_FLOOR,
  CHURN_REDUCTION_SILVER,
  CHURN_REDUCTION_GOLD,
  CHURN_REDUCTION_PLATINUM,
  CHURN_REDUCTION_EMERALD,
  CONNECTION_COST_TRADITIONAL,
  CONNECTION_COST_AEROAGENT,
  SPECIAL_NEEDS_COST_TRADITIONAL,
  SPECIAL_NEEDS_COST_AEROAGENT,
  REBOOKING_TRADITIONAL_MULTIPLIER,
  REBOOKING_AEROAGENT_MULTIPLIER,
} from './constants';
import { getPassengerMessage, getFirstName, type PassengerMessage } from './passengerTemplates';
import { Card, Badge, KPICard } from './components/UI';
import { cn } from './lib/utils';

// --- CFO Audit Tab Components ---

const SubNav = ({ active, onChange }: { active: 'dashboard' | 'audit', onChange: (v: 'dashboard' | 'audit') => void }) => (
  <div className="flex items-center gap-1 bg-gray-50/50 p-1 rounded-xl w-fit mb-4">
    <button
      onClick={() => onChange('dashboard')}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
        active === 'dashboard'
          ? "bg-white text-indigo-600 shadow-sm border border-gray-200"
          : "text-gray-500 hover:text-gray-600"
      )}
    >
      <LayoutDashboard className="w-3.5 h-3.5" />
      Financial Dashboard
    </button>
    <button
      onClick={() => onChange('audit')}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
        active === 'audit'
          ? "bg-white text-indigo-600 shadow-sm border border-gray-200"
          : "text-gray-500 hover:text-gray-600"
      )}
    >
      <Search className="w-3.5 h-3.5" />
      Audit Review
    </button>
  </div>
);


// ── computePLSummary: shared 7-driver P&L calculation ──────────────────────
// Single source of truth used by CFODashboard hero cards, Savings by Driver
// chart, and AuditReview COST SAVING column. Guarantees mathematical consistency.
function computePLSummary(p: EnrichedPassenger) {
  const CLV_BASE: Record<string, number> = {
    'Economy': CLV_BASE_ECONOMY,
    'Premium Economy': CLV_BASE_PREMIUM_ECONOMY,
    'Business': CLV_BASE_BUSINESS,
    'F': CLV_BASE_FIRST,
    'J': CLV_BASE_BUSINESS,
  };
  const CLV_TIER: Record<string, number> = {
    'Basic': CLV_TIER_BASIC, 'Silver': CLV_TIER_SILVER, 'Gold': CLV_TIER_GOLD,
    'Platinum': CLV_TIER_PLATINUM, 'Platinum Lumo': CLV_TIER_PLATINUM,
    'oneworld Emerald': CLV_TIER_EMERALD, 'Standard': CLV_TIER_BASIC, 'None': CLV_TIER_BASIC,
  };
  const CHURN_TIER_RED: Record<string, number> = {
    'Basic': 0, 'Silver': CHURN_REDUCTION_SILVER, 'Gold': CHURN_REDUCTION_GOLD,
    'Platinum': CHURN_REDUCTION_PLATINUM, 'Platinum Lumo': CHURN_REDUCTION_PLATINUM,
    'oneworld Emerald': CHURN_REDUCTION_EMERALD, 'Standard': 0, 'None': 0,
  };

  const grpSize   = p._groupSize || 1;
  const delayH    = p.delayHours || 0;
  const isCancelled    = p.disruptionType === 'CANCELLATION';
  const isExtraordinary = ['Weather', 'ATC', 'WEATHER', 'SECURITY'].includes(p.disruptionReason) ||
    p.disruptionCause === 'SECURITY';
  const isOvernight    = delayH >= OVERNIGHT_THRESHOLD_MINUTES / 60 || p.analysis?.recoveryDecision?.hotelRequired === true;
  const hasConn = p.hasConnection === true;
  const ssrCode = p.ssrCode || '';
  const hasSSR  = ['WCHR','UMNR','MEDA','WCHC','WCHS','DPNA'].includes(ssrCode);
  const recAction = (p.analysis?.recommendedAction || '').toLowerCase();
  const hasRebook = isCancelled || recAction.includes('rebook') ||
    recAction.includes('same metal') || recAction.includes('partner') ||
    recAction.includes('interline') || recAction.includes('recovery');

  const clvPerPax = (CLV_BASE[p.cabin] || CLV_BASE_ECONOMY) * (CLV_TIER[p.tier] || CLV_TIER_BASIC) * CLV_HORIZON_YEARS;
  const clvTotal  = clvPerPax * grpSize;

  let churnBase: number;
  if (isCancelled)                          churnBase = CHURN_BASE_CANCELLED;
  else if (delayH >= OVERNIGHT_THRESHOLD_MINUTES / 60) churnBase = CHURN_BASE_8H_PLUS;
  else if (delayH >= 4)                     churnBase = CHURN_BASE_4_TO_8H;
  else if (delayH >= 2)                     churnBase = CHURN_BASE_2_TO_4H;
  else                                      churnBase = CHURN_BASE_UNDER_2H;

  const tierRed   = CHURN_TIER_RED[p.tier] || 0;
  const aeroChurn = Math.max(CHURN_FLOOR, churnBase - tierRed);
  const tradChurn = Math.min(CHURN_TRADITIONAL_CAP, churnBase * CHURN_TRADITIONAL_MULTIPLIER);

  const mealBoth  = MEAL_VOUCHER_RATE * grpSize;                                              // R1 — same both sides
  const hotelBoth = isOvernight ? (HOTEL_RATE_PER_NIGHT + HOTEL_TRANSFER) * grpSize : 0;     // R2 — same both sides

  const eu261Aero   = p.analysis?.legacy?.eu261 || 0;
  const eu261Waived = isExtraordinary && eu261Aero === 0 &&
    (p.baseEU261Comp || p.analysis?.eu261Max || 0) > 0;
  const eu261Trad   = eu261Waived
    ? (p.baseEU261Comp || p.analysis?.eu261Max || 0) * grpSize
    : eu261Aero;

  const reBookTrad = hasRebook ? Math.round(p.ticketValue * REBOOKING_TRADITIONAL_MULTIPLIER) * grpSize : 0;
  const reBookAero = hasRebook ? Math.round(p.ticketValue * REBOOKING_AEROAGENT_MULTIPLIER) * grpSize : 0;

  const connTrad = hasConn ? CONNECTION_COST_TRADITIONAL * grpSize : 0;
  const connAero = hasConn ? CONNECTION_COST_AEROAGENT * grpSize : 0;

  const loyaltyTradRaw   = Math.round(tradChurn * clvTotal);
  const loyaltyAeroRaw   = Math.round(aeroChurn * clvTotal);
  const loyaltySavingCap    = Math.round(clvTotal * CHURN_SAVING_CAP_PCT);
  const loyaltySavingRaw    = Math.max(0, loyaltyTradRaw - loyaltyAeroRaw);
  const loyaltySavingCapped = Math.min(loyaltySavingRaw, loyaltySavingCap);
  const loyaltyTrad = loyaltyTradRaw;
  const loyaltyAero = loyaltyTradRaw - loyaltySavingCapped;

  const ssrTrad = hasSSR ? SPECIAL_NEEDS_COST_TRADITIONAL * grpSize : 0;
  const ssrAero = hasSSR ? SPECIAL_NEEDS_COST_AEROAGENT * grpSize : 0;

  const grandTrad   = mealBoth + hotelBoth + eu261Trad + reBookTrad + connTrad + loyaltyTrad + ssrTrad;
  const grandAero   = mealBoth + hotelBoth + eu261Aero + reBookAero + connAero + loyaltyAero + ssrAero;
  const grandSaving = Math.max(0, grandTrad - grandAero);

  return {
    trad: grandTrad,
    aero: grandAero,
    saving: grandSaving,
    drivers: {
      eu261:   Math.max(0, eu261Trad   - eu261Aero),
      rebook:  Math.max(0, reBookTrad  - reBookAero),
      conn:    Math.max(0, connTrad    - connAero),
      loyalty: Math.max(0, loyaltyTrad - loyaltyAero),
      ssr:     Math.max(0, ssrTrad     - ssrAero),
    },
    // Intermediate values for the P&L expansion panel
    grpSize,
    mealBoth,
    hotelBoth,
    isOvernight,
    eu261Trad,
    eu261Aero,
    eu261Waived,
    reBookTrad,
    reBookAero,
    hasRebook,
    connTrad,
    connAero,
    hasConn,
    tradChurn,
    aeroChurn,
    clvPerPax,
    loyaltyTrad,
    loyaltyAero,
    loyaltySavingCapped,
    loyaltySavingRaw,
    ssrTrad,
    ssrAero,
    hasSSR,
    ssrCode,
  };
}

const CFODashboard = ({ filteredData }: { filteredData: EnrichedPassenger[] }) => {
  const [methodologyExpanded, setMethodologyExpanded] = useState(false);

  // ── Loading gate ───────────────────────────────────────────────────
  // Analysis is pre-computed in seed; this gate handles the rare cold-start case.
  const isReady = filteredData.length > 0 &&
    filteredData.every(p => p.analysis?.rationale !== 'Analysis in progress...');

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="text-center space-y-3">
          <div className="text-[13px] text-gray-500 font-medium">Preparing dashboard…</div>
          <div className="flex gap-1.5 justify-center">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Aggregate P&L using shared computePLSummary helper ────────────
  const plResults = filteredData.map(p => computePLSummary(p));

  // ── Row 1: hero values (derived from same formula as P&L panel) ────
  const totalPax     = filteredData.length;
  const grossExp     = plResults.reduce((s, r) => s + r.trad, 0);
  const actualCost   = plResults.reduce((s, r) => s + r.aero, 0);
  const netSav       = plResults.reduce((s, r) => s + r.saving, 0);
  const belowPct     = grossExp > 0 ? ((grossExp - actualCost) / grossExp * 100).toFixed(1) : '0';

  // ── Row 2: operational KPI values ────────────────────────────────────
  const autoCount = filteredData.filter(p => p.status === 'auto_processed').length;
  const autoRate  = totalPax > 0 ? Math.round(autoCount / totalPax * 100) : 0;
  const avgCost   = totalPax > 0 ? Math.round(actualCost / totalPax)      : 0;

  // ── Savings by driver (summed from per-passenger P&L drivers) ─────
  const eu261Save   = plResults.reduce((s, r) => s + r.drivers.eu261,   0);
  const rebookSave  = plResults.reduce((s, r) => s + r.drivers.rebook,  0);
  const loyaltySave = plResults.reduce((s, r) => s + r.drivers.loyalty, 0);
  const connSave    = plResults.reduce((s, r) => s + r.drivers.conn,    0);
  const ssrSave     = plResults.reduce((s, r) => s + r.drivers.ssr,     0);

  const totalDriverSav = [eu261Save, rebookSave, loyaltySave, connSave, ssrSave].reduce((s, v) => s + v, 0);

  // ── Row 4: compliance counts ───────────────────────────────────────
  const extraordinaryCount = filteredData.filter(p =>
    ['Weather', 'ATC', 'WEATHER', 'SECURITY'].includes(p.disruptionReason) ||
    p.disruptionCause === 'SECURITY'
  ).length;

  // ── Helpers ────────────────────────────────────────────────────────
  const eur = (n: number) => `€${Math.round(n).toLocaleString()}`;

  // ── Additional computed values ─────────────────────────────────────
  const flightCount = Array.from(new Set(filteredData.map(p => p.flightNumber))).length;
  const agentAssistedCount = filteredData.filter(p => p.overrideAction !== undefined).length;
  const agentAssistedRate = totalPax > 0 ? Math.round(agentAssistedCount / totalPax * 100) : 0;

  // ── Resolution breakdown donut data ──────────────────────────────
  const actionCounts: Record<string, number> = {
    'Notification Only': 0,
    'Meal Voucher': 0,
    'Lounge Access': 0,
    'Rebook · Same Airline': 0,
    'Rebook · Partner': 0,
    'Hotel + Rebook': 0,
    'Pending': 0,
  };
  filteredData.forEach(p => {
    const action = (p.overrideAction || p.analysis?.recommendedAction || '').toLowerCase();
    if (!action || action.includes('analyzing') || action.includes('pending')) actionCounts['Pending']++;
    else if (action.includes('notification')) actionCounts['Notification Only']++;
    else if (action.includes('meal') || action.includes('voucher')) actionCounts['Meal Voucher']++;
    else if (action.includes('lounge')) actionCounts['Lounge Access']++;
    else if (action.includes('hotel')) actionCounts['Hotel + Rebook']++;
    else if (action.includes('partner') || action.includes('interline') || action.includes('oal')) actionCounts['Rebook · Partner']++;
    else if (action.includes('same') || action.includes('metal')) actionCounts['Rebook · Same Airline']++;
    else actionCounts['Pending']++;
  });
  const donutData = [
    { name: 'Notification Only',     value: actionCounts['Notification Only'],     fill: '#9CA3AF' },
    { name: 'Meal Voucher',          value: actionCounts['Meal Voucher'],          fill: '#34D399' },
    { name: 'Lounge Access',         value: actionCounts['Lounge Access'],         fill: '#2DD4BF' },
    { name: 'Rebook · Same Airline', value: actionCounts['Rebook · Same Airline'], fill: '#818CF8' },
    { name: 'Rebook · Partner',      value: actionCounts['Rebook · Partner'],      fill: '#A78BFA' },
    { name: 'Hotel + Rebook',        value: actionCounts['Hotel + Rebook'],        fill: '#FCD34D' },
    { name: 'Pending',               value: actionCounts['Pending'],               fill: '#E5E7EB' },
  ].filter(d => d.value > 0);
  const totalCases = donutData.reduce((s, d) => s + d.value, 0);

  // ── Savings by driver (reordered) ─────────────────────────────────
  const savingDrivers = [
    { name: 'Rebooking optimisation',    value: rebookSave,  color: '#818CF8' },
    { name: 'EU261 waiver applied',      value: eu261Save,   color: '#97C459' },
    { name: 'Loyalty risk protection *', value: loyaltySave, color: '#A78BFA' },
    { name: 'Connection management',     value: connSave,    color: '#2DD4BF' },
    { name: 'Special needs handling',    value: ssrSave,     color: '#FCD34D' },
  ].filter(d => d.value > 0);

  const maxDriverVal   = savingDrivers.length > 0 ? Math.max(...savingDrivers.map(d => d.value)) : 1;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">

      {/* ── ROW 1 — Three Hero Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Card 1 — Cost without AeroAgent */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col min-h-[160px]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-gray-500">Cost without AeroAgent</span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Indicative</span>
          </div>
          <div className="text-[30px] font-medium text-gray-900 leading-none mt-3">{eur(grossExp)}</div>
          <div className="text-[11px] text-gray-500 mt-1">Unoptimised legacy handling</div>
          <div className="mt-auto"><hr className="border-gray-200 my-3" /></div>
          <div className="text-[11px] text-gray-500">{totalPax} passengers · {flightCount} flights</div>
        </div>

        {/* Card 2 — Actual cost incurred */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col min-h-[160px]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-gray-500">Actual cost incurred</span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">−{belowPct}% vs baseline</span>
          </div>
          <div className="text-[30px] font-medium text-gray-900 leading-none mt-3">{eur(actualCost)}</div>
          <div className="text-[11px] text-gray-500 mt-1">AeroAgent-optimised recovery</div>
          <div className="mt-auto"><hr className="border-gray-200 my-3" /></div>
          <div className="text-[11px] text-gray-500">Across all disruption types</div>
        </div>

        {/* Card 3 — Net savings delivered (green tint) */}
        <div className="bg-[#EAF3DE] border border-[#97C459] rounded-xl p-5 flex flex-col min-h-[160px]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium" style={{ color: '#5a8a25' }}>Net savings delivered</span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{belowPct}% reduction</span>
          </div>
          <div className="text-[30px] font-medium leading-none mt-3" style={{ color: '#2d5a0f' }}>{eur(netSav)}</div>
          <div className="text-[11px] mt-1" style={{ color: '#6aaa1c' }}>vs unoptimised handling</div>
          <div className="mt-auto"><hr className="border-[#97C459]/40 my-3" /></div>
          <div className="text-[11px]" style={{ color: '#6aaa1c' }}>{totalPax} pax · {flightCount} disrupted flights</div>
        </div>
      </div>

      {/* ── ROW 2 — Four Metric Cards ────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">

        {/* Card 1 — Auto-resolution rate */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <Zap className="text-gray-400" style={{ width: 18, height: 18 }} />
          <div className="text-[24px] font-medium text-gray-900 leading-none mt-2">{autoRate}%</div>
          <div className="text-[13px] font-medium text-gray-600 mt-1">Auto-resolution rate</div>
          <div className="text-[11px] text-gray-400 mt-0.5">of cases handled automatically</div>
        </div>

        {/* Card 2 — Avg resolution time */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <Clock className="text-gray-400" style={{ width: 18, height: 18 }} />
          <div className="text-[24px] font-medium text-gray-900 leading-none mt-2">&lt; 2 min</div>
          <div className="text-[13px] font-medium text-gray-600 mt-1">Avg resolution time</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Auto cases · end-to-end</div>
        </div>

        {/* Card 3 — Avg cost per pax */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <Coins className="text-gray-400" style={{ width: 18, height: 18 }} />
          <div className="text-[24px] font-medium text-gray-900 leading-none mt-2">{eur(avgCost)}</div>
          <div className="text-[13px] font-medium text-gray-600 mt-1">Avg cost per pax</div>
          <div className="text-[11px] text-gray-400 mt-0.5">vs €1,400 industry average</div>
        </div>

        {/* Card 4 — Agent assisted rate */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <UserCheck className="text-gray-400" style={{ width: 18, height: 18 }} />
          <div className="text-[24px] font-medium text-gray-900 leading-none mt-2">{agentAssistedRate}%</div>
          <div className="text-[13px] font-medium text-gray-600 mt-1">Agent assisted rate</div>
          <div className="text-[11px] text-gray-400 mt-0.5">{agentAssistedCount} cases required human input</div>
        </div>
      </div>

      {/* ── ROW 3 — Two Charts ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Chart A — Resolution breakdown donut */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-[9px] font-bold text-gray-500 uppercase tracking-[1.2px] mb-3">Resolution breakdown</div>
          <div className="relative h-[180px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={58} outerRadius={82}
                  dataKey="value" paddingAngle={2} strokeWidth={0}>
                  {donutData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[22px] font-medium text-gray-900">{totalCases}</span>
              <span className="text-[10px] text-gray-500">cases</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
            {donutData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                <span className="text-[10px] text-gray-500">{d.name}</span>
                <span className="text-[10px] font-medium text-gray-700">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart B — Savings by Driver */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col">
          <div className="text-[9px] font-bold text-gray-500 uppercase tracking-[1.2px] mb-4">Savings by Driver</div>
          {savingDrivers.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-700 text-sm">No savings data yet</div>
          ) : (
            <div className="flex-1 space-y-3">
              {savingDrivers.map(d => (
                <div key={d.name} className="flex items-center gap-3">
                  <div className="text-[10px] text-gray-500 font-medium w-[37%] shrink-0">{d.name}</div>
                  <div className="flex-1 h-[6px] bg-gray-50 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.round(d.value / maxDriverVal * 100)}%`, background: d.color }} />
                  </div>
                  <div className="text-[10px] font-mono font-bold text-gray-600 w-[15%] text-right shrink-0">{eur(d.value)}</div>
                  <div className="text-[10px] text-gray-400 w-[12%] text-right shrink-0">{totalDriverSav > 0 ? Math.round(d.value / totalDriverSav * 100) : 0}%</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end flex-col items-end">
            <span className="text-[11px] font-bold text-emerald-700">€{Math.round(totalDriverSav).toLocaleString()} total savings · {totalPax} pax</span>
            <div className="text-[9px] text-gray-400 mt-1">* Indicative — based on CLV model</div>
          </div>
        </div>
      </div>

      {/* ── ROW 4 — Compliance Strip ─────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { title: 'EU261 · Fully compliant', sub: 'All eligible pax actioned correctly' },
          { title: 'Duty of care · Met', sub: 'Meals and hotel correctly triggered' },
          { title: `Extraordinary circumstances · ${extraordinaryCount} waived`, sub: 'Weather, ATC and Security correctly documented' },
        ] as const).map((card, i) => (
          <div key={i}
            className="bg-emerald-50 border border-emerald-800/40 rounded-xl p-4 flex items-center gap-3 hover:border-emerald-700/50 transition-all">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-emerald-700">{card.title}</div>
              <div className="text-[9.5px] text-emerald-700 mt-0.5">{card.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Methodology collapsed link */}
      <div className="pt-3 border-t border-gray-200">
        <button
          onClick={() => setMethodologyExpanded(v => !v)}
          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          <span>ⓘ</span>
          <span>Data source &amp; methodology</span>
          <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${methodologyExpanded ? 'rotate-180' : ''}`} />
        </button>
        {methodologyExpanded && (
          <p className="mt-2 text-[10px] text-gray-400 leading-relaxed max-w-3xl">
            All figures are indicative based on the AeroAgent rule engine with AI enhancements. Regulatory figures per EU261/2004, US DOT Part 250, Canada APPR. Operational figures use industry benchmarks. Live PSS/GDS/CRM data supersedes all estimates. * Loyalty risk protection figures use the AeroAgent CLV model and are indicative only.
          </p>
        )}
      </div>
    </div>
  );
};

// Map recommendedAction string → styled pill config
function getActionPill(action: string): { label: string; cls: string } {
  const a = (action || '').toLowerCase();
  if (!a || a === 'analyzing') return { label: 'Pending…', cls: 'bg-gray-500/20 text-gray-500 border-gray-500/30' };
  if (a.includes('notification only')) return { label: 'Notification Only', cls: 'bg-gray-500/20 text-gray-500 border-gray-500/30' };
  if (a.includes('lounge')) return { label: 'Lounge Access', cls: 'bg-teal-500/20 text-teal-700 border-teal-500/30' };
  if (a.includes('meal') || a.includes('voucher')) return { label: 'Meal Voucher', cls: 'bg-green-500/20 text-green-700 border-green-500/30' };
  if (a.includes('hotel')) return { label: 'Hotel + Meal', cls: 'bg-amber-500/20 text-amber-700 border-amber-500/30' };
  if (a.includes('partner') || a.includes('oal') || a.includes('interline')) return { label: 'Rebook · Partner Airline', cls: 'bg-purple-500/20 text-purple-700 border-purple-500/30' };
  if (a.includes('same metal') || a.includes('same-carrier') || a.includes('same carrier') || a.includes('same_carrier')) return { label: 'Rebook · Same Airline', cls: 'bg-indigo-500/20 text-indigo-600 border-indigo-500/30' };
  if (a.includes('concierge') || a.includes('priority')) return { label: 'Concierge Triage', cls: 'bg-amber-500/20 text-amber-700 border-amber-500/30' };
  if (a.includes('cancel')) return { label: 'Cancelled — Pending', cls: 'bg-red-500/20 text-red-700 border-red-500/30' };
  return { label: action, cls: 'bg-slate-500/20 text-gray-500 border-slate-500/30' };
}

interface AuditReviewProps {
  deduplicatedData: EnrichedPassenger[];
  expandedCostRow: string | null;
  toggleCostRow: (uid: string) => void;
}

const AuditReview = ({
  deduplicatedData,
  expandedCostRow,
  toggleCostRow,
}: AuditReviewProps) => (
  <div className="animate-in fade-in duration-500">
    <section>
      <div className="bg-white border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-y-visible overflow-x-auto hover:border-gray-300 transition-all">
        <table className="w-full border-collapse text-[13px] font-sans">
          <thead className="sticky top-0 z-20">
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              <th className="px-4 py-3 text-left text-gray-500 text-[10.5px] font-bold uppercase tracking-[0.8px] w-[7%]">PNR</th>
              <th className="px-4 py-3 text-left text-gray-500 text-[10.5px] font-bold uppercase tracking-[0.8px] w-[28%]">Passenger</th>
              <th className="px-4 py-3 text-left text-gray-500 text-[10.5px] font-bold uppercase tracking-[0.8px] w-[14%]">Flight & Routing</th>
              <th className="px-4 py-3 text-center text-gray-500 text-[10.5px] font-bold uppercase tracking-[0.8px] w-[14%]">Disruption</th>
              <th className="px-4 py-3 text-center text-gray-500 text-[10.5px] font-bold uppercase tracking-[0.8px] w-[10%]">Resolution Mode</th>
              <th className="px-4 py-3 text-center text-gray-500 text-[10.5px] font-bold uppercase tracking-[0.8px] w-[7%]">Override</th>
              <th className="px-4 py-3 text-center text-gray-500 text-[10.5px] font-bold uppercase tracking-[0.8px] w-[10%]">Final Action</th>
              <th className="px-4 py-3 text-right text-gray-500 text-[10.5px] font-bold uppercase tracking-[0.8px] w-[10%]">Cost Saving</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {deduplicatedData.map((p: EnrichedPassenger) => {
              const isOverridden = p.overrideAction !== undefined;
              const isCostExpanded = expandedCostRow === p.uid;
              return (
                <React.Fragment key={p.uid}>
                  <tr
                    onClick={() => toggleCostRow(p.uid)}
                    className={cn(
                      "hover:bg-gray-50 transition-all duration-100 group cursor-pointer",
                      isOverridden && "bg-amber-500/10",
                      isCostExpanded && "bg-gray-100 border-l-4 border-l-indigo-500"
                    )}
                  >
                    <td className="px-4 py-2.5 font-pnr text-[12.5px] font-semibold text-gray-900 tracking-[0.3px]">
                      {p.pnr}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12.5px] font-bold text-gray-900 leading-tight">{p.name}</span>
                          {(p._groupSize ?? 1) > 1 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/20 text-indigo-700 border border-indigo-500/30 whitespace-nowrap">
                              +{(p._groupSize ?? 1) - 1} traveller{(p._groupSize ?? 1) - 1 > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{p.tier} · {p.cabin}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col">
                        <span className="text-[12.5px] font-bold text-gray-900 leading-tight">{p.flightNumber}</span>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{p.origin} ➔ {p.destination}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                          ['Crew Scheduling', 'Late Inbound', 'Technical'].includes(p.disruptionReason) ? "bg-red-500/20 text-red-700 border border-red-500/30" :
                          p.disruptionReason === 'Weather' ? "bg-blue-500/20 text-blue-700 border border-blue-500/30" :
                          "bg-gray-500/20 text-gray-500 border border-gray-500/30"
                        )}>
                          {p.disruptionReason}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono font-bold">
                          {Math.floor(p.delayHours)}:{String(Math.round((p.delayHours % 1) * 60)).padStart(2, '0')}h
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={
                        (p._hasManual || p.overrideAction) ? 'slate' :
                        p.status === 'auto_processed' ? 'emerald' :
                        p.status === 'pending_triage' ? 'slate' :
                        p.status === 'pending_validation' ? 'indigo' :
                        'amber'
                      }>
                        {(p._hasManual || p.overrideAction) ? 'Agent Assisted' :
                         p.status === 'auto_processed' ? 'AI Resolved' :
                         p.status === 'pending_triage' ? 'Pending' :
                         p.status === 'pending_validation' ? 'Assisted' :
                         'Agent Assisted'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={isOverridden ? 'crimson' : 'slate'}>
                        {isOverridden ? 'Yes' : 'No'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {p.status === 'pending_triage' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border bg-amber-500/15 text-amber-700 border-amber-500/30">Awaiting Resolution</span>
                      ) : (() => { const { label, cls } = getActionPill(p.overrideAction || p.analysis.recommendedAction); return (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${cls}`}>{label}</span>
                      ); })()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {p.status === 'pending_triage' ? (
                        <span className="font-mono tabular-nums font-bold text-gray-400">—</span>
                      ) : (
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <span className="font-mono tabular-nums font-bold text-emerald-700">
                            €{Math.round(computePLSummary(p).saving).toLocaleString()}
                          </span>
                          <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform duration-150 ${isCostExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      )}
                    </td>
                  </tr>
                  {/* ── P&L Comparison Panel ──────────────────────────────── */}
                  <AnimatePresence>
                    {expandedCostRow === p.uid && (() => {
                      // ── P&L values from shared engine ───────────────────
                      const {
                        trad: grandTrad, aero: grandAero, saving: grandSaving,
                        grpSize, mealBoth, hotelBoth, isOvernight,
                        eu261Trad, eu261Aero, eu261Waived,
                        reBookTrad, reBookAero, hasRebook,
                        connTrad, connAero, hasConn,
                        tradChurn, aeroChurn, clvPerPax,
                        loyaltyTrad, loyaltyAero, loyaltySavingCapped, loyaltySavingRaw,
                        ssrTrad, ssrAero, hasSSR, ssrCode,
                      } = computePLSummary(p);
                      const savingPct = grandTrad > 0 ? Math.round((grandSaving / grandTrad) * 100) : 0;

                      // ── Helpers ─────────────────────────────────────────
                      const eur = (n: number) => `€${Math.round(n).toLocaleString()}`;
                      const SavingCell = ({ s }: { s: number }) => s > 0
                        ? <span className="font-mono font-bold text-emerald-700 text-[11.5px]">{eur(s)}</span>
                        : <span className="text-gray-700 text-[11px]">—</span>;
                      const MonoCell = ({ v, zero }: { v: number; zero?: boolean }) =>
                        v > 0
                          ? <span className="font-mono tabular-nums text-gray-600">{eur(v)}</span>
                          : <span className={zero ? 'font-mono tabular-nums text-emerald-700 font-bold' : 'text-gray-600 text-[11px]'}>
                              {zero ? '€0 ✓' : '—'}
                            </span>;

                      const badgeReg  = <span className="text-[8px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-700 border border-blue-500/25 px-1.5 py-0.5 rounded">Regulatory</span>;
                      const badgeOps  = <span className="text-[8px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 border border-amber-500/25 px-1.5 py-0.5 rounded">Operational</span>;
                      const badgeProp = <span className="text-[8px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-700 border border-purple-500/25 px-1.5 py-0.5 rounded">AeroAgent</span>;
                      const badgeWaived = <span className="text-[8px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 border border-emerald-500/25 px-1.5 py-0.5 rounded">Waived by AeroAgent ✓</span>;

                      return (
                        <tr>
                          <td colSpan={8} className="p-0 border-none">
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.18, ease: 'easeInOut' }}
                              style={{ background: '#F8F9FA' }}
                              className="overflow-hidden border-b border-gray-200"
                            >
                              <div className="px-5 py-4 max-h-[50vh] overflow-y-auto">

                                {/* ── Hero Cards ─────────────────────────── */}
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                  {/* Without AeroAgent */}
                                  <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                                    <div className="text-[8.5px] font-bold text-gray-600 uppercase tracking-widest mb-1.5">Without AeroAgent</div>
                                    <div className="text-[19px] font-bold font-mono text-gray-500">{eur(grandTrad)}</div>
                                  </div>
                                  {/* With AeroAgent */}
                                  <div className="bg-gray-50 border border-gray-300/40 rounded-lg px-4 py-3">
                                    <div className="text-[8.5px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">With AeroAgent</div>
                                    <div className="text-[19px] font-bold font-mono text-gray-700">{eur(grandAero)}</div>
                                  </div>
                                  {/* Cost Saving */}
                                  <div className="rounded-lg px-4 py-3" style={{ background: '#EAF3DE', border: '1px solid #b8daa0' }}>
                                    <div className="text-[8.5px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#5a8a25' }}>Cost Saving</div>
                                    <div className="text-[19px] font-bold font-mono" style={{ color: '#3B6D11' }}>{eur(grandSaving)}</div>
                                    {savingPct > 0 && <div className="text-[10px] font-semibold mt-0.5" style={{ color: '#6aaa1c' }}>−{savingPct}% reduction</div>}
                                  </div>
                                </div>

                                {/* ── P&L Table ───────────────────────────── */}
                                <table className="w-full text-[11.5px]">
                                  <thead>
                                    <tr className="border-b border-gray-200">
                                      <th className="text-left text-[9px] font-bold text-gray-600 uppercase tracking-wider pb-1.5 w-[42%]">Cost Driver</th>
                                      <th className="text-right text-[9px] font-bold text-gray-600 uppercase tracking-wider pb-1.5 w-[18%]">Traditional</th>
                                      <th className="text-right text-[9px] font-bold text-gray-600 uppercase tracking-wider pb-1.5 w-[18%]">AeroAgent</th>
                                      <th className="text-right text-[9px] font-bold text-gray-600 uppercase tracking-wider pb-1.5 w-[14%]">Saving</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200/40">

                                    {/* R1 — Duty of Care · Meals */}
                                    <tr>
                                      <td className="py-1.5">
                                        <div className="flex items-center gap-1.5 mb-0.5">{badgeReg}<span className="text-gray-600 font-medium">Duty of Care · Meals</span></div>
                                        <div className="text-[9px] text-gray-600 ml-0">EU261 Art. 9 · €20 per pax</div>
                                      </td>
                                      <td className="py-1.5 text-right"><MonoCell v={mealBoth} /></td>
                                      <td className="py-1.5 text-right"><MonoCell v={mealBoth} /></td>
                                      <td className="py-1.5 text-right"><SavingCell s={0} /></td>
                                    </tr>

                                    {/* R2 — Duty of Care · Hotel */}
                                    <tr>
                                      <td className="py-1.5">
                                        <div className="flex items-center gap-1.5 mb-0.5">{badgeReg}<span className="text-gray-600 font-medium">Duty of Care · Hotel</span></div>
                                        <div className="text-[9px] text-gray-600">
                                          {isOvernight ? `Overnight stranding · 1 night · €${HOTEL_RATE_PER_NIGHT} + €${HOTEL_TRANSFER} transfer` : 'No overnight — not triggered'}
                                        </div>
                                      </td>
                                      <td className="py-1.5 text-right"><MonoCell v={hotelBoth} /></td>
                                      <td className="py-1.5 text-right"><MonoCell v={hotelBoth} /></td>
                                      <td className="py-1.5 text-right"><SavingCell s={0} /></td>
                                    </tr>

                                    {/* R3 — EU261 Cash Compensation */}
                                    <tr>
                                      <td className="py-1.5">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                          {eu261Waived ? badgeWaived : badgeReg}
                                          <span className="text-gray-600 font-medium">EU261 Cash Compensation</span>
                                        </div>
                                        <div className="text-[9px] text-gray-600">
                                          {eu261Waived
                                            ? `${p.disruptionReason} · Extraordinary circumstances — waiver correctly applied`
                                            : `${p.disruptionReason} · Compensation eligibility assessed`}
                                        </div>
                                      </td>
                                      <td className="py-1.5 text-right"><MonoCell v={eu261Trad} /></td>
                                      <td className="py-1.5 text-right"><MonoCell v={eu261Aero} zero={eu261Waived} /></td>
                                      <td className="py-1.5 text-right"><SavingCell s={Math.max(0, eu261Trad - eu261Aero)} /></td>
                                    </tr>

                                    {/* R4 — Rebooking Cost */}
                                    <tr>
                                      <td className="py-1.5">
                                        <div className="flex items-center gap-1.5 mb-0.5">{badgeOps}<span className="text-gray-600 font-medium">Rebooking Cost</span></div>
                                        <div className="text-[9px] text-gray-600">
                                          {hasRebook ? 'Optimal carrier selected · Same cabin · Pre-negotiated rate' : 'No rebooking required'}
                                        </div>
                                      </td>
                                      <td className="py-1.5 text-right"><MonoCell v={reBookTrad} /></td>
                                      <td className="py-1.5 text-right"><MonoCell v={reBookAero} /></td>
                                      <td className="py-1.5 text-right"><SavingCell s={Math.max(0, reBookTrad - reBookAero)} /></td>
                                    </tr>

                                    {/* R5 — Connection Miss Cost */}
                                    <tr>
                                      <td className="py-1.5">
                                        <div className="flex items-center gap-1.5 mb-0.5">{badgeOps}<span className="text-gray-600 font-medium">Connection Miss Cost</span></div>
                                        <div className="text-[9px] text-gray-600">
                                          {hasConn ? 'Proactive detection · Earlier rebooking vs reactive' : 'No onward connection'}
                                        </div>
                                      </td>
                                      <td className="py-1.5 text-right"><MonoCell v={connTrad} /></td>
                                      <td className="py-1.5 text-right"><MonoCell v={connAero} /></td>
                                      <td className="py-1.5 text-right"><SavingCell s={Math.max(0, connTrad - connAero)} /></td>
                                    </tr>

                                    {/* R6 — Loyalty Risk Score */}
                                    <tr>
                                      <td className="py-1.5">
                                        <div className="flex items-center gap-1.5 mb-0.5">{badgeProp}<span className="text-gray-600 font-medium">Loyalty Risk Score</span></div>
                                        <div className="text-[9px] text-gray-600 space-y-0.5">
                                          <div>Trad: {(tradChurn * 100).toFixed(1)}% churn × {eur(clvPerPax)} CLV/pax × {grpSize} pax</div>
                                          <div>Aero: {(aeroChurn * 100).toFixed(1)}% churn · Priority triage
                                            {loyaltySavingCapped < loyaltySavingRaw && <span className="text-amber-600"> · capped at 15% CLV</span>}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="py-1.5 text-right align-top"><MonoCell v={loyaltyTrad} /></td>
                                      <td className="py-1.5 text-right align-top"><MonoCell v={loyaltyAero} /></td>
                                      <td className="py-1.5 text-right align-top"><SavingCell s={Math.max(0, loyaltyTrad - loyaltyAero)} /></td>
                                    </tr>

                                    {/* R7 — Special Needs Handling */}
                                    <tr>
                                      <td className="py-1.5">
                                        <div className="flex items-center gap-1.5 mb-0.5">{badgeOps}<span className="text-gray-600 font-medium">Special Needs Handling</span></div>
                                        <div className="text-[9px] text-gray-600">
                                          {hasSSR ? `${ssrCode} · Pre-flagged, auto-coordinated vs manual` : 'No special needs declared'}
                                        </div>
                                      </td>
                                      <td className="py-1.5 text-right"><MonoCell v={ssrTrad} /></td>
                                      <td className="py-1.5 text-right"><MonoCell v={ssrAero} /></td>
                                      <td className="py-1.5 text-right"><SavingCell s={Math.max(0, ssrTrad - ssrAero)} /></td>
                                    </tr>

                                    {/* Total Row */}
                                    <tr className="border-t-2 border-gray-200">
                                      <td className="py-2 text-[11px] font-bold text-gray-600 uppercase tracking-wider">Total Exposure</td>
                                      <td className="py-2 text-right font-mono font-bold text-[12px] text-gray-600">{eur(grandTrad)}</td>
                                      <td className="py-2 text-right font-mono font-bold text-[12px] text-gray-900">{eur(grandAero)}</td>
                                      <td className="py-2 text-right">
                                        {grandSaving > 0
                                          ? <span className="font-mono font-bold text-[13px] text-emerald-700">{eur(grandSaving)}</span>
                                          : <span className="text-gray-700 text-[11px]">—</span>
                                        }
                                      </td>
                                    </tr>

                                  </tbody>
                                </table>

                                {/* Group note */}
                                {grpSize > 1 && (
                                  <div className="mt-2 text-[9px] text-gray-600">
                                    Costs shown for PNR group · {grpSize} traveller{grpSize > 1 ? 's' : ''}
                                  </div>
                                )}

                                {/* ── Justification Section ──────────────────── */}
                                {(() => {
                                  const hasRecovery = !!p.analysis?.recoveryDecision;
                                  const hasManual   = !!(p._hasManual || p.overrideAction);
                                  const hasEscalation = !!(p.isEscalated && p.handoffBriefing);
                                  if (!hasRecovery && !hasManual && !hasEscalation) return null;
                                  const cardCount = [hasRecovery, hasManual, hasEscalation].filter(Boolean).length;
                                  const rd = p.analysis?.recoveryDecision;
                                  const hb = p.handoffBriefing;
                                  return (
                                    <div className="mt-4 pt-3 border-t border-gray-200">
                                      <div className="text-[8.5px] font-bold text-gray-600 uppercase tracking-[1.2px] mb-2.5">Decision Rationale</div>
                                      <div className={`grid gap-2.5 ${cardCount > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>

                                        {/* Card A — Recovery Decision */}
                                        {hasRecovery && (
                                          <div className="bg-indigo-50 border border-indigo-500/20 rounded-lg px-3 py-2.5">
                                            <div className="text-[8.5px] font-bold text-indigo-600 uppercase tracking-wider mb-1">Recovery Action</div>
                                            <div className="text-[11px] text-gray-600 leading-snug font-medium">
                                              {rd?.primaryAction
                                                ? rd.primaryAction.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                                                : p.analysis.recommendedAction}
                                            </div>
                                            {rd?.agentInterventionReason && (
                                              <div className="text-[10px] text-gray-500 mt-1 leading-snug">{rd.agentInterventionReason}</div>
                                            )}
                                            {rd && (
                                              <div className="flex flex-wrap gap-1 mt-1.5">
                                                {rd.hotelRequired && <span className="text-[8px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Hotel</span>}
                                                {rd.mealsRequired && <span className="text-[8px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Meals</span>}
                                                {rd.loungeRequired && <span className="text-[8px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Lounge</span>}
                                                {rd.rebookEligible && <span className="text-[8px] bg-indigo-500/15 text-indigo-600 px-1.5 py-0.5 rounded">Rebook eligible</span>}
                                                {rd.offerRefundAlternative && <span className="text-[8px] bg-amber-500/15 text-amber-700 px-1.5 py-0.5 rounded">Refund option</span>}
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {/* Card B — Manual Override */}
                                        {hasManual && (
                                          <div className="bg-amber-50 border border-amber-500/20 rounded-lg px-3 py-2.5">
                                            <div className="text-[8.5px] font-bold text-amber-700 uppercase tracking-wider mb-1">Manual Override</div>
                                            <div className="text-[11px] text-gray-600 leading-snug">
                                              {p.overrideRationale || 'Gate agent manually reviewed and approved this recovery action.'}
                                            </div>
                                            {p.overrideAction && (
                                              <div className="text-[9px] text-amber-500/70 mt-1">Action: {p.overrideAction}</div>
                                            )}
                                          </div>
                                        )}

                                        {/* Card C — Passenger Escalation */}
                                        {hasEscalation && hb && (
                                          <div className="bg-purple-50 border border-purple-500/20 rounded-lg px-3 py-2.5">
                                            <div className="text-[8.5px] font-bold text-purple-700 uppercase tracking-wider mb-1">Passenger Concern</div>
                                            <div className="text-[11px] text-gray-600 leading-snug">
                                              {hb.passengerConcern}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                                ['Frustrated','Angry','Distressed'].includes(hb.emotionalState)
                                                  ? 'bg-red-500/20 text-red-700'
                                                  : hb.emotionalState === 'Anxious'
                                                    ? 'bg-amber-500/20 text-amber-700'
                                                    : 'bg-gray-100 text-gray-500'
                                              }`}>{hb.emotionalState}</span>
                                              {(hb.urgencyLevel === 'Critical' || hb.urgencyLevel === 'High') && (
                                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-red-500/15 text-red-700">
                                                  {hb.urgencyLevel} Priority
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* Footnote */}
                                <div className="mt-2.5 pt-2 border-t border-gray-200 text-[8.5px] text-gray-700 leading-relaxed">
                                  ⓘ Regulatory amounts fixed by law · Operational figures use industry benchmarks · Loyalty Risk Score uses proprietary AeroAgent methodology · All figures indicative
                                </div>

                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      );
                    })()}
                  </AnimatePresence>

                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        <div className="bg-gray-50 border-t border-gray-200 rounded-b-xl px-4 py-3 text-[12px] text-gray-500">
          Showing {deduplicatedData.length} PNR group{deduplicatedData.length !== 1 ? 's' : ''}
        </div>
      </div>
    </section>
  </div>
);

const MethodologyNote = () => {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div className="mt-4 border-t border-gray-200 pt-3">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 text-[10px] text-gray-600 hover:text-gray-500 transition-colors"
      >
        <span>ⓘ</span>
        <span>Data source &amp; methodology</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <p className="mt-2 text-[10px] text-gray-500 leading-relaxed max-w-3xl">
          All figures are indicative based on the AeroAgent rule engine with AI enhancements. Regulatory figures per EU261/2004, US DOT Part 250, Canada APPR. Operational figures use industry benchmarks. Live PSS/GDS/CRM data supersedes all estimates.
        </p>
      )}
    </div>
  );
};

const CFOAudit = ({ passengers, analysisCache }: { passengers: Passenger[]; analysisCache: Record<string, AnalysisResult> }) => {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'audit'>('dashboard');
  const [expandedCostRow, setExpandedCostRow] = useState<string | null>(null);

  const toggleCostRow = (uid: string) => {
    setExpandedCostRow(prev => prev === uid ? null : uid);
  };

  const processedData = useMemo(() => {
    return passengers.map(p => ({
      ...p,
      analysis: analysisCache[p.uid] || { // Use cached analysis or empty object as fallback
        recommendedAction: 'ANALYZING',
        aeroAgentCost: 0,
        netSavings: 0,
        legacy: { total: 0, dutyOfCare: 0, eu261: 0, usDot: 0, churnPenalty: 0 },
        clv: 0,
        churnPropensity: 0,
        churnEV: 0,
        totalEV: 0,
        eu261Max: 0,
        eu261Likelihood: 0,
        eu261EV: 0,
        isVIP: false,
        isOALEligible: false,
        suggestedStatus: 'pending_triage',
        valueTag: 'standard',
        rationale: 'Analysis in progress...',
        distressLevel: 'Medium'
      }
    }));
  }, [passengers, analysisCache]);

  const filteredData = useMemo(() => processedData, [processedData]);

  const TIER_RANK: Record<string, number> = {
    'Platinum Lumo': 7, 'oneworld Emerald': 6, 'Platinum': 5,
    'Gold': 4, 'Silver': 3, 'Bronze': 2, 'Classic Plus': 1, 'Classic': 0, 'Basic': 0
  };

  const deduplicatedData = useMemo(() => {
    const groups: Record<string, typeof processedData> = {};
    processedData.forEach(p => {
      if (!groups[p.pnr]) groups[p.pnr] = [];
      groups[p.pnr].push(p);
    });
    return Object.values(groups).map(group => {
      const sorted = [...group].sort((a, b) =>
        (TIER_RANK[b.tier] ?? 0) - (TIER_RANK[a.tier] ?? 0)
      );
      const primary = sorted[0];
      const others = sorted.slice(1);
      return {
        ...primary,
        analysis: {
          ...primary.analysis,
          legacy: {
            ...primary.analysis.legacy,
            total: group.reduce((s, p) => s + (p.analysis.legacy?.total || 0), 0),
            dutyOfCare: group.reduce((s, p) => s + (p.analysis.legacy?.dutyOfCare || 0), 0),
            eu261: group.reduce((s, p) => s + (p.analysis.legacy?.eu261 || 0), 0),
          },
          aeroAgentCost: group.reduce((s, p) => s + p.analysis.aeroAgentCost, 0),
          netSavings: group.reduce((s, p) => s + p.analysis.netSavings, 0),
        },
        _groupSize: group.length,
        _otherNames: others.map(p => p.name),
        _hasManual: group.some(p => p.overrideAction !== undefined),
      };
    }).sort((a, b) => a.pnr.localeCompare(b.pnr)); // Default sort: PNR ascending
  }, [processedData]);

  return (
    <div className="max-w-[1600px] mx-auto">
      <SubNav active={activeSubTab} onChange={setActiveSubTab} />

      {activeSubTab === 'dashboard' ? (
        <CFODashboard filteredData={filteredData} />
      ) : (
        <>
          {/* Summary Bar */}
          {(() => {
            const flightCount = Array.from(new Set(deduplicatedData.map(p => p.flightNumber))).length;
            const totalPassengers = filteredData.length;
            const autoResolvedCount = filteredData.filter(p => p.status === 'auto_processed').length;
            const agentAssistedCount = deduplicatedData.filter(p => p._hasManual || p.overrideAction).length;
            const overrideCount = deduplicatedData.filter(p => p._hasManual || p.overrideAction).length;
            const overridePct = deduplicatedData.length > 0 ? Math.round(overrideCount / deduplicatedData.length * 100) : 0;
            const escalatedCount = filteredData.filter(p => p.isEscalated).length;
            const escalatedPct = totalPassengers > 0 ? Math.round(escalatedCount / totalPassengers * 100) : 0;
            const complianceFlags = filteredData.filter(p =>
              (p.analysis.legacy?.eu261 || 0) > 0 &&
              (p.analysis.recommendedAction || '').toLowerCase().includes('notification')
            ).length;
            return (
              <div className="grid grid-cols-4 gap-4 mb-6">
                {/* Card 1 — Disrupted passengers */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col min-h-[160px]">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-medium text-gray-500">Disrupted passengers</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{flightCount} flights</span>
                  </div>
                  <div className="text-[30px] font-medium text-gray-900 leading-none mt-3">{totalPassengers}</div>
                  <div className="text-[11px] text-gray-500 mt-1">Total impacted this event</div>
                  <div className="mt-auto"><hr className="border-gray-200 my-3" /></div>
                  <div className="text-[11px] text-gray-500">{autoResolvedCount} AI resolved · {agentAssistedCount} agent assisted</div>
                </div>

                {/* Card 2 — Agent override rate */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col min-h-[160px]">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-medium text-gray-500">Agent override rate</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      overridePct < 10 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      overridePct < 20 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {overridePct < 10 ? `< 10%` : `${overridePct}%`}
                    </span>
                  </div>
                  <div className="text-[30px] font-medium text-gray-900 leading-none mt-3">{overridePct}%</div>
                  <div className="text-[11px] text-gray-500 mt-1">Agents deviated from AI recommendation</div>
                  <div className="mt-auto"><hr className="border-gray-200 my-3" /></div>
                  <div className="text-[11px] text-gray-500">{overrideCount} of {deduplicatedData.length} cases overridden</div>
                </div>

                {/* Card 3 — Escalations */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col min-h-[160px]">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-medium text-gray-500">Escalations</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{escalatedCount} total</span>
                  </div>
                  <div className="text-[30px] font-medium text-gray-900 leading-none mt-3">{escalatedCount}</div>
                  <div className="text-[11px] text-gray-500 mt-1">Passengers who requested human help</div>
                  <div className="mt-auto"><hr className="border-gray-200 my-3" /></div>
                  <div className="text-[11px] text-gray-500">{escalatedPct}% of total passengers</div>
                </div>

                {/* Card 4 — Exceptions flagged */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col min-h-[160px]">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-medium text-gray-500">Exceptions flagged</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      complianceFlags === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {complianceFlags === 0 ? 'All clear ✅' : 'Review needed'}
                    </span>
                  </div>
                  <div className={`text-[30px] font-medium leading-none mt-3 ${complianceFlags > 0 ? 'text-red-700' : 'text-gray-900'}`}>{complianceFlags}</div>
                  <div className="text-[11px] text-gray-500 mt-1">Compliance anomalies detected</div>
                  <div className="mt-auto"><hr className="border-gray-200 my-3" /></div>
                  <div className="text-[11px] text-gray-500">EU261 · Duty of care · APPR</div>
                </div>
              </div>
            );
          })()}

          <AuditReview
            deduplicatedData={deduplicatedData}
            expandedCostRow={expandedCostRow}
            toggleCostRow={toggleCostRow}
          />
          <MethodologyNote />
        </>
      )}
    </div>
  );
};

// --- Gate Agent Triage Tab ---
const GateAgentTriage = ({ passengers, onUpdatePax, analysisCache, setAnalysisCache, filterOverride }: {
  passengers: Passenger[];
  onUpdatePax: (id: string, updates: Partial<Passenger>, useUid?: boolean) => void;
  analysisCache: Record<string, AnalysisResult>;
  setAnalysisCache: (cache: Record<string, AnalysisResult>) => void;
  filterOverride?: 'auto' | 'pending' | 'priority' | 'urgent';
}) => {
  const flights = useMemo(() => Array.from(new Set(passengers.map(p => p.flightNumber))).sort(), [passengers]);
  const [flightFilter, setFlightFilter] = useState('');
  const [selectedPaxUid, setSelectedPaxUid] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<ActionType | null>(null);
  const [overrideRationale, setOverrideRationale] = useState('');
  const comms = { whatsapp: true, email: true, print: false };
  const [activeFilter, setActiveFilter] = useState<'auto' | 'pending' | 'priority' | 'urgent'>(filterOverride ?? 'pending');
  const [briefingDismissed, setBriefingDismissed] = useState(false);

  // Sync external filter override (from header KPI card clicks)
  React.useEffect(() => {
    if (filterOverride) setActiveFilter(filterOverride);
  }, [filterOverride]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);

  const flightPax = useMemo(() => passengers.filter(p => !p.portalOnly && (!flightFilter || p.flightNumber === flightFilter)), [passengers, flightFilter]);

  // selectedPaxAnalysis derived from cache — no auto-fire API call
  const selectedPaxAnalysis = useMemo(
    () => (selectedPaxUid ? analysisCache[selectedPaxUid] ?? null : null),
    [selectedPaxUid, analysisCache]
  );

  // Auto-select first escalated/critical passenger on load
  React.useEffect(() => {
    if (!selectedPaxUid && flightPax.length > 0) {
      const escalated = flightPax.find(p => p.isEscalated);
      if (escalated) { setSelectedPaxUid(escalated.uid); return; }
      const pending = flightPax.find(p => p.status === 'pending_triage');
      if (pending) { setSelectedPaxUid(pending.uid); return; }
      setSelectedPaxUid(flightPax[0].uid);
    }
  }, [flightPax, selectedPaxUid]);

  // Reset briefing dismissed state when passenger changes
  React.useEffect(() => {
    setBriefingDismissed(false);
    setAiError(false);
  }, [selectedPaxUid]);

  // Explicit AI analysis on demand
  const handleAnalyseWithAI = async () => {
    if (!selectedPaxUid) return;
    const pax = passengers.find(p => p.uid === selectedPaxUid);
    if (!pax) return;
    setAiLoading(true);
    setAiError(false);
    try {
      const result = await computeEngineAI(pax);
      setAnalysisCache({ ...analysisCache, [selectedPaxUid]: result });
    } catch (err) {
      console.error('AI analysis failed:', err);
      setAiError(true);
    } finally {
      setAiLoading(false);
    }
  };

  const getQueueTier = (group: Passenger[]): 'URGENT' | 'PRIORITY' | 'MONITOR' | 'STANDARD' => {
    // URGENT: only explicitly escalated passengers
    if (group.some(p => p.isEscalated || p.status === 'escalated')) return 'URGENT';

    // PRIORITY: WCHR/UMNR/MEDA SSR codes,
    //   OR Platinum/Platinum Lumo/oneworld Emerald on long-haul with ≥5h delay or cancellation
    const hasPrioritySsr = group.some(p => ['WCHR', 'UMNR', 'MEDA'].includes(p.ssrCode));
    const hasTopTierLongHaul = group.some(p => {
      const isTopTier = ['Platinum', 'Platinum Lumo', 'oneworld Emerald'].includes(p.tier);
      const delayMin = p.delayMinutes ?? Math.round((p.delayHours ?? 0) * 60);
      const isLongHaul = p.haul === 'Long';
      const isCancellation = p.disruptionType === 'CANCELLATION';
      return isTopTier && delayMin >= 300 && (isLongHaul || isCancellation);
    });
    if (hasPrioritySsr || hasTopTierLongHaul) return 'PRIORITY';

    // MONITOR: connection at risk only
    if (group.some(p => p.hasConnection === true)) return 'MONITOR';

    return 'STANDARD';
  };

  const getTriageReasons = (p: Passenger) => {
    const reasons: { label: string, color: string }[] = [];

    if (p.ssrCode === 'UMNR') {
      reasons.push({ label: 'UMNR', color: 'bg-rose-100 text-rose-700 border-rose-200' });
    } else if (['WCHR', 'MEDA', 'BLND', 'DEAF'].includes(p.ssrCode)) {
      reasons.push({ label: 'WCHR', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' });
    } else if (p.ssrCode !== '') {
      reasons.push({ label: 'Special Handling', color: 'bg-slate-100 text-slate-700 border-slate-200' });
    }

    if (p.isEscalated) {
      reasons.push({ label: 'Escalated', color: 'bg-red-100 text-red-700 border-red-200' });
    }

    if (p.tier === 'Platinum Lumo' || p.tier === 'oneworld Emerald') {
      reasons.push({ label: 'VIP', color: 'bg-purple-100 text-purple-700 border-purple-200' });
    } else if (['Platinum', 'Gold'].includes(p.tier) || p.cabin === 'Business') {
      reasons.push({ label: 'Premium', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' });
    }

    if (p.delayHours > 4) {
      reasons.push({ label: 'EU261 Risk', color: 'bg-amber-100 text-amber-700 border-amber-200' });
    }

    if (p.hasConnection === true) {
      reasons.push({ label: '⚡ Connection', color: 'bg-blue-100 text-blue-700 border-blue-200' });
    }

    return reasons;
  };

  const getOperationalReason = (p: Passenger) => {
    if (p.ssrCode !== '') return 'Special assistance required';
    if (p.isEscalated) return 'Manual validation required';
    if (p.delayHours > 8) return 'Overnight disruption';
    if (p.delayHours > 4) return 'EU261 risk';
    return 'Standard triage';
  };

  const pnrGroups = useMemo(() => {
    const groups: Record<string, Passenger[]> = {};
    flightPax.forEach(p => {
      if (!groups[p.pnr]) groups[p.pnr] = [];
      groups[p.pnr].push(p);
    });
    return groups;
  }, [flightPax]);

  const sortedPnrs = useMemo(() => {
    const tierOrder: Record<string, number> = { URGENT: 0, PRIORITY: 1, MONITOR: 2, STANDARD: 3 };
    const pnrs = Object.keys(pnrGroups);
    const filtered = pnrs.filter(pnr => {
      const group = pnrGroups[pnr];
      const tier = getQueueTier(group);
      const allResolved = group.every(p => p.status === 'resolved' || p.status === 'auto_processed');
      const anyPending = group.some(p => p.status === 'pending_triage' || p.status === 'escalated');

      switch (activeFilter) {
        case 'urgent':
          return group.some(p => p.isEscalated || p.status === 'escalated');
        case 'priority':
          return anyPending && (tier === 'URGENT' || tier === 'PRIORITY');
        case 'pending':
          return anyPending;
        case 'auto':
          return allResolved;
        default:
          return true;
      }
    });

    return filtered.sort((a, b) => {
      const groupA = pnrGroups[a];
      const groupB = pnrGroups[b];
      const tierA = tierOrder[getQueueTier(groupA)];
      const tierB = tierOrder[getQueueTier(groupB)];
      if (tierA !== tierB) return tierA - tierB;
      // Secondary: max delay descending within tier (longer delay sorts higher)
      const maxDelayA = Math.max(...groupA.map(p => p.delayMinutes ?? Math.round((p.delayHours ?? 0) * 60)));
      const maxDelayB = Math.max(...groupB.map(p => p.delayMinutes ?? Math.round((p.delayHours ?? 0) * 60)));
      return maxDelayB - maxDelayA;
    });
  }, [pnrGroups, activeFilter]);

  const selectedPax = useMemo(() => passengers.find(p => p.uid === selectedPaxUid), [passengers, selectedPaxUid]);
  const selectedPaxGroup = useMemo(() => selectedPax ? pnrGroups[selectedPax.pnr] : null, [pnrGroups, selectedPax]);

  const kpis = useMemo(() => {
    const groups = Object.values(pnrGroups) as Passenger[][];
    const auto = groups.filter(group => group.every(p => p.status === 'auto_processed' || p.status === 'resolved')).length;
    const pending = groups.filter(group => group.some(p => p.status === 'pending_triage')).length;
    const highRisk = groups.filter(group => group.some(p => p.status === 'pending_triage' && (p.ssrCode !== '' || p.isEscalated))).length;

    const accepted = passengers.filter(p => p.chatState === 'accepted').length;
    const escalated = passengers.filter(p => p.isEscalated).length;
    const noResponse = passengers.filter(p => p.chatState === 'plan_sent' || p.chatState === 'initial').length;

    return { auto, pending, highRisk, accepted, escalated, noResponse };
  }, [pnrGroups, passengers]);

  const recoveryOptions = useMemo(() => {
    if (!selectedPax || !selectedPaxAnalysis) return [];

    // MOD 3: Use API-generated recovery options if available
    if (selectedPaxAnalysis.recoveryOptions && selectedPaxAnalysis.recoveryOptions.length > 0) {
      return selectedPaxAnalysis.recoveryOptions.map((apiOption: RecoveryOption) => ({
        action: (apiOption.primaryAction || 'Notification Only') as ActionType,
        status: (apiOption.id === 'option-1' ? 'Recommended' : 'Available') as 'Recommended' | 'Available',
        description: (apiOption.description || '') as string,
        inclusions: apiOption.passengerValue
          ? (apiOption.passengerValue as string).split(' + ').map((s: string) => s.trim())
          : [],
        title: (apiOption.title || apiOption.primaryAction || 'Recovery Option') as string,
        timeline: (apiOption.timeline || '') as string,
        regulatoryBasis: (apiOption.regulatoryBasis || '') as string,
        suitabilityReason: (apiOption.suitabilityReason || '') as string,
        costToAeroAgent: (apiOption.costToAeroAgent ?? 0) as number,
        flaggedConcerns: (apiOption.flaggedConcerns || undefined) as string[] | undefined
      })).sort((a, _b) => (a.status === 'Recommended' ? -1 : 1));
    }

    // Fallback: Local generation if API options not available
    const recommended = selectedPaxAnalysis.recommendedAction;

    const mapToUI = (action: ActionType): ActionType => {
      if (action.includes('Same Metal') || action.includes('Recovery')) {
        return action.includes('Hotel') ? 'Alternative Flight + Hotel' : 'Alternative Flight Only';
      }
      if (action.includes('Interline')) return 'Premium Recovery Option';
      if (action.includes('Concierge') || action.includes('Manual')) return 'Manual Handling Required';
      return action;
    };

    const uiRecommended = mapToUI(recommended);

    type RecoveryOptionUI = {
      action: ActionType;
      status: 'Recommended' | 'Available' | 'Restricted' | 'Requires Approval';
      description: string;
      inclusions: string[];
      title?: string;
      timeline?: string;
      regulatoryBasis?: string;
      suitabilityReason?: string;
      costToAeroAgent?: number;
      flaggedConcerns?: string[];
    };
    const allOptions: RecoveryOptionUI[] = [
      {
        action: 'Alternative Flight + Hotel',
        status: 'Available',
        description: 'Next available Finnair flight with overnight accommodation.',
        inclusions: ['Flight', 'Hotel', 'Meals']
      },
      {
        action: 'Alternative Flight Only',
        status: 'Available',
        description: 'Same-day recovery on Finnair or partner metal.',
        inclusions: ['Flight', 'Voucher']
      },
      {
        action: 'Premium Recovery Option',
        status: 'Restricted',
        description: 'Interline recovery on competitor metal for high-tier passengers.',
        inclusions: ['Flight', 'Lounge', 'Voucher']
      },
      {
        action: 'Manual Handling Required',
        status: 'Requires Approval',
        description: 'Complex case requiring manual rebooking and supervisor approval.',
        inclusions: ['Manual Approval']
      }
    ];

    return allOptions.map(opt => ({
      ...opt,
      status: opt.action === uiRecommended ? 'Recommended' : opt.status
    })).sort((a, _b) => (a.status === 'Recommended' ? -1 : 1));
  }, [selectedPax, selectedPaxAnalysis]);

  const handleExecute = async () => {
    if (selectedPaxUid && selectedPax && selectedPaxAnalysis) {
      const recommendedAction = recoveryOptions.find(o => o.status === 'Recommended')?.action;
      const actionToExecute = selectedOption || recommendedAction || selectedPaxAnalysis.recommendedAction;

      if (!actionToExecute) return;

      const updates: Partial<Passenger> = { status: 'resolved' };
      updates.overrideAction = actionToExecute;
      if (selectedOption && selectedOption !== recommendedAction) {
        updates.overrideRationale = overrideRationale;
      }

      const pax = passengers.find(p => p.uid === selectedPaxUid);
      if (pax) {
        const resolutionMsg = {
          role: 'assistant' as const,
          content: `Great news! Your recovery has been processed. We have ${actionToExecute} for you. You can see the details below.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        updates.messages = [...(pax.messages || []), resolutionMsg];

        const actionStr = actionToExecute.toLowerCase();
        if (actionStr.includes('flight')) updates.chatState = 'rebooked';
        else if (actionStr.includes('hotel')) updates.chatState = 'hotel';
      }

      onUpdatePax(selectedPaxUid, updates, true);
      setSelectedOption(null);
      setOverrideRationale('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Demo Info Banner — Hidden for cleaner layout */}
      {false && (
      <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-lg p-3 flex items-start gap-3 text-sm text-indigo-700">
        <span className="text-lg">✦</span>
        <p>Select a passenger, then click <strong>Analyse with AI</strong> to trigger a live Claude analysis</p>
      </div>
      )}

      {/* Summary line — Removed for cleaner layout */}
      {false && (
      <div className="flex items-center gap-2 px-1">
        <span className="text-sm font-bold text-gray-900">
          {kpis.pending} case{kpis.pending !== 1 ? 's' : ''} require your attention
        </span>
        <span className="text-gray-300">·</span>
        <span className="text-sm text-gray-500">
          {kpis.auto} auto-resolved without intervention
        </span>
      </div>
      )}

      {/* Flight Triage Control Header — Integrated with KPI Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Plane className="w-4.5 h-4.5 text-indigo-600" />
            Flight Triage Control
          </h2>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Operational Recovery Queue</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Filter by Flight:</span>
          <div className="relative group">
            <select
              value={flightFilter}
              onChange={(e) => {
                setFlightFilter(e.target.value);
                setSelectedPaxUid(null);
              }}
              className="appearance-none bg-gray-50 border border-gray-200 text-gray-900 text-xs font-bold rounded-lg focus:ring-indigo-500/10 focus:border-indigo-500 block w-full pl-3 pr-8 py-2 cursor-pointer hover:border-gray-300 transition-colors uppercase tracking-wider"
            >
              <option value="">All flights</option>
              {flights.map(f => (
                <option key={f} value={f}>{f} — {passengers.find(p => p.flightNumber === f)?.origin} to {passengers.find(p => p.flightNumber === f)?.destination}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-indigo-600 transition-colors" />
          </div>
        </div>
      </div>

      {/* KPI Cards Grid — Matching CFO Dashboard Row 2 style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Card 1 — AI Resolved */}
        <button
          onClick={() => setActiveFilter('auto')}
          className={`bg-white border border-gray-200 rounded-xl p-4 text-left transition-all hover:border-indigo-400 ${activeFilter === 'auto' ? "ring-2 ring-indigo-500 ring-offset-2" : ""}`}
        >
          <CheckCircle2 className="text-gray-400" style={{ width: 18, height: 18 }} />
          <div className="text-[24px] font-medium text-gray-900 leading-none mt-2">{kpis.auto}</div>
          <div className="text-[13px] font-medium text-gray-600 mt-1">AI Resolved</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Resolved automatically · No agent needed</div>
        </button>

        {/* Card 2 — Pending */}
        <button
          onClick={() => setActiveFilter('pending')}
          className={`bg-white border border-gray-200 rounded-xl p-4 text-left transition-all hover:border-indigo-400 ${activeFilter === 'pending' ? "ring-2 ring-indigo-500 ring-offset-2" : ""}`}
        >
          <Clock className="text-gray-400" style={{ width: 18, height: 18 }} />
          <div className="text-[24px] font-medium text-gray-900 leading-none mt-2">{kpis.pending}</div>
          <div className="text-[13px] font-medium text-gray-600 mt-1">Pending</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Awaiting agent action</div>
        </button>

        {/* Card 3 — High-Risk */}
        <button
          onClick={() => setActiveFilter('priority')}
          className={`bg-white border border-gray-200 rounded-xl p-4 text-left transition-all hover:border-indigo-400 ${activeFilter === 'priority' ? "ring-2 ring-indigo-500 ring-offset-2" : ""}`}
        >
          <AlertTriangle className="text-gray-400" style={{ width: 18, height: 18 }} />
          <div className="text-[24px] font-medium text-gray-900 leading-none mt-2">{kpis.highRisk}</div>
          <div className="text-[13px] font-medium text-gray-600 mt-1">High-Risk</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Special handling required</div>
        </button>

        {/* Card 4 — Escalated */}
        <button
          onClick={() => setActiveFilter('urgent')}
          className={`bg-white border border-gray-200 rounded-xl p-4 text-left transition-all hover:border-indigo-400 ${activeFilter === 'urgent' ? "ring-2 ring-indigo-500 ring-offset-2" : ""}`}
        >
          <AlertTriangle className="text-gray-400" style={{ width: 18, height: 18 }} />
          <div className="text-[24px] font-medium text-gray-900 leading-none mt-2">{kpis.escalated}</div>
          <div className="text-[13px] font-medium text-gray-600 mt-1">Escalated</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Require immediate attention</div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-0 overflow-hidden flex flex-col h-[640px] bg-white border-gray-200">
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Clipboard className="w-3.5 h-3.5 text-gray-500" />
                <span className="font-bold text-[11px] text-gray-900 uppercase tracking-widest">Triage Queue</span>
              </div>
              <Badge variant="indigo" className="min-w-0 px-2 bg-indigo-500/20 text-indigo-700 border-indigo-500/30">{sortedPnrs.length} PNRs</Badge>
            </div>

            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {sortedPnrs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 p-8 text-center">
                    <CheckCircle2 className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm font-medium">Queue Clear</p>
                    <p className="text-xs opacity-60">All exceptions have been triaged.</p>
                  </div>
                ) : (
                  (() => {
                    type QTier = 'URGENT' | 'PRIORITY' | 'MONITOR' | 'STANDARD';
                    const tierConfig: Record<QTier, { header: string; headerBg: string; headerText: string; badgeBg: string; badgeText: string; badgeBorder: string; dot: string }> = {
                      URGENT:   { header: '🔴 URGENT · Immediate intervention',   headerBg: 'bg-rose-500/10',  headerText: 'text-rose-700',  badgeBg: 'bg-rose-500/20',  badgeText: 'text-rose-700',  badgeBorder: 'border-rose-500/30',  dot: 'bg-rose-500'  },
                      PRIORITY: { header: '🟠 PRIORITY · Specialist handling',    headerBg: 'bg-amber-500/10', headerText: 'text-amber-700', badgeBg: 'bg-amber-500/20', badgeText: 'text-amber-700', badgeBorder: 'border-amber-500/30', dot: 'bg-amber-500' },
                      MONITOR:  { header: '🟡 MONITOR · Watch for changes',       headerBg: 'bg-blue-500/10',  headerText: 'text-blue-700',  badgeBg: 'bg-blue-500/20',  badgeText: 'text-blue-700',  badgeBorder: 'border-blue-500/30',  dot: 'bg-blue-400'  },
                      STANDARD: { header: '⚪ STANDARD · No action required',     headerBg: 'bg-gray-100',     headerText: 'text-gray-500',  badgeBg: 'bg-gray-100',     badgeText: 'text-gray-500',  badgeBorder: 'border-gray-200',     dot: 'bg-gray-500'  },
                    };
                    // Count per tier
                    const tierCounts: Partial<Record<QTier, number>> = {};
                    sortedPnrs.forEach(pnr => {
                      const t = getQueueTier(pnrGroups[pnr]) as QTier;
                      tierCounts[t] = (tierCounts[t] ?? 0) + 1;
                    });
                    // Build flat items: interleave section headers before first row of each tier
                    type QItem = { type: 'header'; tier: QTier; count: number } | { type: 'row'; pnr: string; tier: QTier };
                    const items: QItem[] = [];
                    let lastTier: QTier | null = null;
                    sortedPnrs.forEach(pnr => {
                      const t = getQueueTier(pnrGroups[pnr]) as QTier;
                      if (t !== lastTier) {
                        // tierCounts[t] is always set because t came from iterating the same sortedPnrs
                        items.push({ type: 'header', tier: t, count: tierCounts[t] ?? 0 });
                        lastTier = t;
                      }
                      items.push({ type: 'row', pnr, tier: t });
                    });
                    return items.map((item) => {
                      if (item.type === 'header') {
                        const cfg = tierConfig[item.tier];
                        return (
                          <div key={`hdr-${item.tier}`} className={cn('sticky top-0 z-10 px-4 py-1.5 border-b border-gray-200 flex items-center justify-between', cfg.headerBg)}>
                            <span className={cn('text-[10px] font-bold uppercase tracking-widest', cfg.headerText)}>{cfg.header}</span>
                            <span className={cn('text-[10px] font-bold tabular-nums', cfg.headerText)}>{item.count}</span>
                          </div>
                        );
                      }
                      const { pnr } = item;
                      const group = pnrGroups[pnr];
                      const p = group[0];
                      const analysis = analysisCache[p.uid] || { recommendedAction: 'ANALYZING', aeroAgentCost: 0, netSavings: 0 };
                      const isSelected = selectedPaxUid === p.uid;
                      const isResolved = group.every(q => q.status === 'resolved' || q.status === 'auto_processed');
                      const isAuto = group.every(q => q.status === 'auto_processed');
                      const cfg = tierConfig[item.tier];
                      return (
                        <motion.div
                          key={p.uid}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          onClick={() => setSelectedPaxUid(p.uid)}
                          className={cn(
                            'p-4 border-b border-gray-200 cursor-pointer transition-all relative group',
                            isSelected ? 'bg-indigo-500/20 border-l-4 border-indigo-500' : 'hover:bg-gray-50/50 border-l-4 border-transparent'
                          )}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-gray-900">{p.pnr}</span>
                              {group.length > 1 && (
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 border border-indigo-500/30">
                                  <Users className="w-3 h-3" /> +{group.length - 1}
                                </span>
                              )}
                            </div>
                            {isResolved ? (
                              <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/20 text-emerald-700 rounded-full border border-emerald-500/30">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider">
                                    {isAuto ? analysis.recommendedAction : (p.overrideAction || analysis.recommendedAction)}
                                  </span>
                                </div>
                                <span className="text-[9px] text-gray-600 font-medium">Notified: 5m ago</span>
                              </div>
                            ) : (
                              <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-full border', cfg.badgeBg, cfg.badgeText, cfg.badgeBorder)}>
                                <div className={cn('w-1.5 h-1.5 rounded-full animate-pulse', cfg.dot)} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">{cfg.header}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-gray-900">{p.name}</p>
                              <p className="text-[10px] text-gray-500 font-medium mb-1">{getOperationalReason(p)}</p>
                              <div className="flex flex-wrap gap-1">
                                {getTriageReasons(p).map((reason, ridx) => (
                                  <span key={ridx} className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-tight', reason.color)}>
                                    {reason.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <ChevronRight className={cn('w-4 h-4 text-gray-500 transition-transform', isSelected && 'translate-x-1 text-indigo-600')} />
                          </div>
                        </motion.div>
                      );
                    });
                  })()
                )}
              </AnimatePresence>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {!selectedPax ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-gray-500 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200 p-12 text-center"
              >
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-200 flex items-center justify-center mb-6">
                  <LayoutDashboard className="w-8 h-8 opacity-20" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Select a PNR to Triage</h3>
                <p className="text-sm max-w-xs text-gray-500">Choose a passenger from the queue to begin the recovery execution workflow.</p>
              </motion.div>
            ) : (
              <motion.div
                key={selectedPax.uid}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {(selectedPax.status === 'resolved' || selectedPax.status === 'auto_processed') && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="bg-emerald-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold">{selectedPax.status === 'auto_processed' ? 'AI Resolved Successfully' : 'Recovery Executed Successfully'}</p>
                        <p className="text-xs text-emerald-100">Passenger notified via {comms.whatsapp ? 'WhatsApp' : ''} {comms.email ? '& Email' : ''}.</p>
                      </div>
                    </div>
                    <Badge className="bg-white/20 text-white border-none">LOCKED</Badge>
                  </motion.div>
                )}

                {/* Escalation Card — Passenger Chat escalation (FIX 2) */}
                {selectedPax?.isEscalated && selectedPax?.handoffBriefing !== undefined && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-rose-500/10 border border-rose-500/40 rounded-xl p-5 space-y-4"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔴</span>
                      <span className="text-sm font-bold text-rose-700 uppercase tracking-wider">Escalated from Passenger Chat</span>
                      {selectedPax.escalatedAt && (
                        <span className="ml-auto text-[10px] text-rose-700/70">
                          {new Date(selectedPax.escalatedAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-1">Concern</p>
                        <p className="text-sm text-gray-900">{selectedPax.handoffBriefing.passengerConcern}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <div>
                          <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-1">Emotional State</p>
                          <span className="inline-block px-2 py-0.5 bg-gray-50 text-gray-900 rounded text-xs font-semibold border border-gray-200">
                            {selectedPax.handoffBriefing.emotionalState}
                          </span>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-1">Urgency</p>
                          <span className={cn('inline-block px-2 py-0.5 rounded text-xs font-bold border', selectedPax.handoffBriefing.urgencyFlag ? 'bg-red-500/20 text-red-700 border-red-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30')}>
                            {selectedPax.handoffBriefing.urgencyFlag ? 'HIGH' : 'NORMAL'}
                          </span>
                        </div>
                        {selectedPax.handoffBriefing.distressLevel && (
                          <div>
                            <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-1">Distress</p>
                            <span className={cn('inline-block px-2 py-0.5 rounded text-xs font-bold border', {
                              'bg-red-500/20 text-red-700 border-red-500/30': selectedPax.handoffBriefing.distressLevel === 'Critical',
                              'bg-orange-500/20 text-orange-700 border-orange-500/30': selectedPax.handoffBriefing.distressLevel === 'High',
                              'bg-yellow-500/20 text-yellow-400 border-yellow-500/30': selectedPax.handoffBriefing.distressLevel === 'Medium',
                              'bg-gray-500/20 text-gray-500 border-gray-500/30': selectedPax.handoffBriefing.distressLevel === 'Low',
                            })}>
                              {selectedPax.handoffBriefing.distressLevel}
                            </span>
                          </div>
                        )}
                      </div>

                      {(selectedPax.handoffBriefing.stressSignals?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-1">Stress Signals</p>
                          <div className="flex flex-wrap gap-1">
                            {(selectedPax.handoffBriefing.stressSignals ?? []).map((sig, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-rose-500/10 text-rose-700 border border-rose-500/20 rounded text-[10px] font-semibold uppercase tracking-wide">
                                {sig}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {(selectedPax.handoffBriefing.keyDetails?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-1">What they said</p>
                          <ul className="space-y-1">
                            {(selectedPax.handoffBriefing.keyDetails ?? []).map((detail, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-900">
                                <span className="text-rose-700 mt-0.5">•</span> {detail}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedPax.handoffBriefing.preferredResolution && (
                        <div>
                          <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-1">Preferred Resolution</p>
                          <p className="text-sm text-gray-900">{selectedPax.handoffBriefing.preferredResolution}</p>
                        </div>
                      )}

                      {/* FIX 1: Conversation Summary */}
                      {(selectedPax.handoffBriefing.conversationSummary || (selectedPax.handoffBriefing.keyDetails?.length ?? 0) > 0) && (
                        <div className="pt-2 border-t border-rose-500/20">
                          <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-2">Conversation Summary</p>
                          {selectedPax.handoffBriefing.conversationSummary ? (
                            <p className="text-sm text-gray-900 leading-relaxed">{selectedPax.handoffBriefing.conversationSummary}</p>
                          ) : (
                            <ul className="space-y-1">
                              {(selectedPax.handoffBriefing.keyDetails ?? []).map((detail, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-900">
                                  <span className="text-rose-700 mt-0.5">•</span> {detail}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {/* FIX 1: Suggested Opening */}
                      {selectedPax.handoffBriefing.suggestedOpeningLine && (
                        <div className="pt-2 border-t border-rose-500/20">
                          <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-2">Suggested Opening</p>
                          <p className="text-sm text-indigo-900 italic leading-relaxed">"{selectedPax.handoffBriefing.suggestedOpeningLine}"</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Handoff Briefing Panel for Escalated Passengers */}
                {selectedPax?.isEscalated && selectedPax?.handoffBriefing && !briefingDismissed && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-indigo-500/5 border-l-2 border-indigo-500 rounded-xl p-6 space-y-4"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-lg text-indigo-600">✦</span>
                      <h3 className="text-lg font-bold text-indigo-700">Agent Briefing — Escalated Passenger</h3>
                    </div>

                    {/* Summary */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm leading-relaxed text-gray-900">{selectedPax.handoffBriefing.summary}</p>
                    </div>

                    {/* Passenger Concern */}
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">What they really need:</p>
                        <p className="text-sm text-gray-900">{selectedPax.handoffBriefing.passengerConcern}</p>
                      </div>

                      {/* Emotional State + Urgency */}
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">Emotional State</p>
                          <span className="inline-block px-3 py-1 bg-gray-50 text-gray-900 rounded text-sm font-semibold border border-gray-200">
                            {selectedPax.handoffBriefing.emotionalState}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">Urgency</p>
                          <span className={cn("inline-block px-3 py-1 rounded text-sm font-semibold border", {
                            'bg-red-500/20 text-red-700 border-red-500/30': selectedPax.handoffBriefing.urgencyLevel === 'Critical',
                            'bg-orange-500/20 text-orange-700 border-orange-500/30': selectedPax.handoffBriefing.urgencyLevel === 'High',
                            'bg-yellow-500/20 text-yellow-400 border-yellow-500/30': selectedPax.handoffBriefing.urgencyLevel === 'Medium',
                            'bg-green-500/20 text-green-700 border-green-500/30': selectedPax.handoffBriefing.urgencyLevel === 'Low'
                          })}>
                            {selectedPax.handoffBriefing.urgencyLevel}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* What Was Arranged */}
                    <div>
                      <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">What was arranged:</p>
                      <ul className="space-y-1">
                        {selectedPax.handoffBriefing.whatWasArranged.map((action, idx) => (
                          <li key={idx} className="text-sm text-gray-900 flex items-center gap-2">
                            <span className="text-indigo-600">•</span> {action}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Sensitive Issues */}
                    {selectedPax.handoffBriefing.sensitiveIssues.length > 0 && (
                      <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                        <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">🚩 Sensitive Issues:</p>
                        <ul className="space-y-1">
                          {selectedPax.handoffBriefing.sensitiveIssues.map((issue, idx) => (
                            <li key={idx} className="text-sm text-red-700">• {issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Suggested Opening */}
                    <div className="bg-indigo-500/5 border border-indigo-500/30 rounded-lg p-4 italic border-l-2 border-l-indigo-500">
                      <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">✦ Start the conversation with:</p>
                      <p className="text-sm text-indigo-800">"{selectedPax.handoffBriefing.suggestedOpeningLine}"</p>
                    </div>

                    {/* Recommended Action */}
                    <div>
                      <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Recommended next step:</p>
                      <p className="text-sm text-gray-900">{selectedPax.handoffBriefing.recommendedAction}</p>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-indigo-500/20">
                      <p className="text-xs text-gray-500">Est. resolution: {selectedPax.handoffBriefing.estimatedResolutionTime}</p>
                      <p className="text-xs text-gray-600">AeroAgent · Powered by Claude AI</p>
                    </div>

                    {/* Begin Conversation Button */}
                    <button
                      onClick={() => setBriefingDismissed(true)}
                      className="w-full mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold transition-colors"
                    >
                      Begin Conversation
                    </button>
                  </motion.div>
                )}

                <Card className="space-y-6 relative overflow-hidden bg-white border-gray-200">
                  <div className="bg-indigo-500/20 p-4 rounded-xl border border-indigo-500/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-700" />
                        <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">PNR Group: {selectedPax.pnr}</span>
                      </div>
                      <Badge variant="indigo" className="bg-indigo-500/20 text-indigo-700 border-indigo-500/30">{selectedPaxGroup?.length} Passengers</Badge>
                    </div>
                    <div className="space-y-2">
                      {selectedPaxGroup?.map(p => (
                        <div key={p.uid} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-indigo-500/20">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-[10px] font-bold text-gray-500 border border-gray-200">
                              {p.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-900">{p.name}</p>
                              <div className="flex gap-1 mt-0.5">
                                <p className="text-[9px] text-gray-500">{p.tier} • {p.cabin}</p>
                                {p.ssrCode && <span className="text-[8px] font-bold text-rose-700 bg-rose-500/20 px-1 rounded border border-rose-500/30">Special Handling</span>}
                                {p.isEscalated && <span className="text-[8px] font-bold text-amber-700 bg-amber-500/20 px-1 rounded border border-amber-500/30">Escalated</span>}
                                {p.chatState === 'accepted' && <span className="text-[8px] font-bold text-emerald-700 bg-emerald-500/20 px-1 rounded border border-emerald-500/30">Responded</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {(getQueueTier([p]) === 'PRIORITY' || getQueueTier([p]) === 'URGENT') && <Badge className="bg-indigo-500/20 text-indigo-700 border-indigo-500/30 text-[8px]">Premium</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedPax?.isEscalated && selectedPax?.escalationReason && (
                      <div className="mt-3 pt-3 border-t border-indigo-500/20">
                        <p className="text-[9px] font-bold text-amber-800 uppercase tracking-wider mb-1">Escalation Reason:</p>
                        <p className="text-[10px] text-gray-900">{selectedPax.escalationReason}</p>
                        {selectedPax?.escalatedAt && (
                          <p className="text-[8px] text-gray-500 mt-1">Escalated at: {new Date(selectedPax.escalatedAt).toLocaleTimeString()}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Analyse with AI button — shown when no AI analysis yet and not loading */}
                  {!selectedPaxAnalysis?.aiPowered && !aiLoading && selectedPax?.status === 'pending_triage' && (
                    <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                      <div>
                        <p className="text-xs font-bold text-gray-600">Rule engine baseline ready</p>
                        <p className="text-[10px] text-gray-500">Run Claude AI for distress assessment, regulatory validation & recovery options</p>
                      </div>
                      <button
                        onClick={handleAnalyseWithAI}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all shrink-0 ml-4"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Analyse with AI
                      </button>
                    </div>
                  )}

                  {aiError && (
                    <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
                      <p className="text-[10px] text-amber-800">AI analysis unavailable — showing rule engine recommendation</p>
                      <button
                        onClick={handleAnalyseWithAI}
                        className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-lg transition-all ml-4"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {selectedPaxAnalysis?.aiPowered && !aiLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-500/30 rounded-lg p-4 space-y-4"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-indigo-600 dark:text-indigo-600 text-lg">✦</span>
                        <h4 className="text-[11px] font-bold font-display text-indigo-700 dark:text-indigo-700 uppercase tracking-widest">AI Recovery Analysis</h4>
                      </div>

                      {/* Justification Section */}
                      <div className="bg-white dark:bg-gray-50 border border-indigo-200 dark:border-indigo-500/20 rounded-lg p-3">
                        <p className="text-[9px] font-bold text-indigo-700 dark:text-indigo-700 uppercase tracking-widest mb-2">Gate Agent Reasoning</p>
                        <p className="text-sm text-gray-700 dark:text-gray-500 leading-relaxed">{selectedPaxAnalysis.aiJustification}</p>
                      </div>

                      {/* Distress & Regulatory Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        {selectedPaxAnalysis.aiDistressLevel && (
                          <div>
                            <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-1">Distress Level</p>
                            <div className={cn('px-3 py-2 rounded-lg border text-[11px] font-bold text-center',
                              selectedPaxAnalysis.aiDistressLevel === 'Critical' ? 'bg-red-500/20 text-red-700 border-red-500/30' :
                              selectedPaxAnalysis.aiDistressLevel === 'High' ? 'bg-orange-500/20 text-orange-700 border-orange-500/30' :
                              selectedPaxAnalysis.aiDistressLevel === 'Medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                              'bg-green-500/20 text-green-700 border-green-500/30'
                            )}>
                              {selectedPaxAnalysis.aiDistressLevel}
                            </div>
                            {selectedPaxAnalysis.aiDistressReason && (
                              <p className="text-[8px] text-gray-500 mt-1.5 italic">{selectedPaxAnalysis.aiDistressReason}</p>
                            )}
                          </div>
                        )}

                        {selectedPaxAnalysis.aiRegulatoryBasis && (
                          <div>
                            <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-1">Regulatory Basis</p>
                            <div className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-600 text-center">
                              {selectedPaxAnalysis.aiRegulatoryBasis}
                            </div>
                            {selectedPaxAnalysis.aiRegulatoryNote && (
                              <p className="text-[8px] text-gray-500 mt-1.5 italic">{selectedPaxAnalysis.aiRegulatoryNote}</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Talking Points Section */}
                      {selectedPaxAnalysis.aiAgentTalkingPoints && selectedPaxAnalysis.aiAgentTalkingPoints.length > 0 && (
                        <div>
                          <p className="text-[9px] font-bold text-indigo-700 uppercase tracking-widest mb-2">When speaking to the passenger:</p>
                          <ul className="space-y-1.5">
                            {selectedPaxAnalysis.aiAgentTalkingPoints.map((point: string, idx: number) => (
                              <li key={idx} className="text-[9px] text-gray-600 leading-relaxed flex gap-2">
                                <span className="text-indigo-600 font-bold">•</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Flagged Issues Section */}
                      {selectedPaxAnalysis.aiFlaggedIssues && selectedPaxAnalysis.aiFlaggedIssues.length > 0 && (
                        <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg p-3">
                          <p className="text-[9px] font-bold text-amber-800 uppercase tracking-widest mb-2">⚠ Flagged Issues</p>
                          <ul className="space-y-1">
                            {selectedPaxAnalysis.aiFlaggedIssues.map((issue: string, idx: number) => (
                              <li key={idx} className="text-[8px] text-amber-800 leading-relaxed flex gap-2">
                                <span>•</span>
                                <span>{issue}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <p className="text-[8px] text-gray-600 italic text-center pt-2 border-t border-indigo-500/20">✦ AeroAgent · Powered by Claude AI</p>
                    </motion.div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Info className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Operational Rationale</span>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed font-medium">
                      {selectedPaxAnalysis?.rationale || 'Loading...'}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Zap className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Recovery Options</span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium italic">
                        {aiLoading
                          ? '✦ Claude is thinking...'
                          : selectedPaxAnalysis && !selectedPaxAnalysis.aiPowered
                            ? '⚙️ Standard recommendation'
                            : 'Select an option to execute'}
                      </span>
                    </div>

                    {aiLoading && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="bg-indigo-500/20 border border-indigo-500/30 rounded-lg p-4 flex items-center justify-center gap-3"
                      >
                        <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                        <span className="text-sm font-medium text-indigo-700">✦ Claude is thinking...</span>
                      </motion.div>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                      {(() => {
                        return recoveryOptions.map((opt, idx) => {
                          const isRecommended = opt.status === 'Recommended';
                          const isSelected = selectedOption === opt.action || (!selectedOption && isRecommended);

                          return (
                            <div
                              key={idx}
                              onClick={() => setSelectedOption(opt.action)}
                              className={cn(
                                "p-4 rounded-xl border-2 transition-all cursor-pointer relative group",
                                isSelected
                                  ? "bg-indigo-500/20 border-indigo-500 shadow-lg shadow-indigo-500/20"
                                  : "bg-gray-50 border-gray-200 hover:border-gray-300"
                              )}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-gray-900">{opt.title || opt.action}</span>
                                  {isRecommended && (
                                    <span className="bg-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                      <Sparkles className="w-2.5 h-2.5 fill-white" /> Recommended
                                    </span>
                                  )}
                                </div>
                                <Badge variant={
                                  opt.status === 'Recommended' ? 'indigo' :
                                  opt.status === 'Available' ? 'emerald' :
                                  opt.status === 'Restricted' ? 'amber' :
                                  opt.status === 'Requires Approval' ? 'crimson' :
                                  'slate'
                                }>
                                  {opt.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-500 leading-relaxed mb-2">{opt.description}</p>

                              {/* MOD 3: Show timeline and suitability if available */}
                              {(opt.timeline || opt.suitabilityReason) && (
                                <div className="text-xs text-[#D1D5DB] space-y-1 mb-2">
                                  {opt.timeline && <p>⏱️ <span className="text-gray-900">{opt.timeline}</span></p>}
                                  {opt.suitabilityReason && <p>✓ {opt.suitabilityReason}</p>}
                                </div>
                              )}

                              <div className="flex gap-2 flex-wrap">
                                {opt.inclusions.map(inc => (
                                  <span key={inc} className="text-[8px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 uppercase tracking-tighter">
                                    {inc}
                                  </span>
                                ))}
                              </div>

                              {/* MOD 3: Show concerns if flagged */}
                              {opt.flaggedConcerns && opt.flaggedConcerns.length > 0 && (
                                <div className="mt-2 text-xs text-amber-800 space-y-1">
                                  {opt.flaggedConcerns.map((concern: string) => (
                                    <p key={concern} className="text-[8px]">⚠️ {concern}</p>
                                  ))}
                                </div>
                              )}

                              {isSelected && (
                                <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                                  <CheckCircle2 className="w-3 h-3 text-gray-900" />
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-100/50 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Execution Summary</span>
                      {selectedOption && selectedPaxAnalysis && selectedOption !== selectedPaxAnalysis.recommendedAction && (
                        <Badge variant="amber" className="animate-pulse bg-amber-500/20 text-amber-800 border-amber-500/30">Manual Override Active</Badge>
                      )}
                    </div>
                    {(() => {
                      const recommendedAction = recoveryOptions.find(o => o.status === 'Recommended')?.action;
                      const currentAction = selectedOption || recommendedAction || (selectedPaxAnalysis?.recommendedAction);
                      const currentLiability = selectedPaxAnalysis?.liabilityEngine;
                      const isOverride = selectedOption && selectedOption !== recommendedAction;

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                          <div className="p-4 space-y-3">
                            <div className="flex items-center gap-2 text-indigo-600">
                              <PlaneTakeoff className="w-4 h-4" />
                              <span className="text-xs font-bold uppercase tracking-wider">Itinerary</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">New ETD</span>
                                <span className="font-bold text-gray-900">{currentLiability?.itinerary.newETD}</span>
                              </div>
                              {currentLiability?.itinerary.newFlight && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-500">New Flight</span>
                                  <span className="font-bold text-gray-900">{currentLiability.itinerary.newFlight}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="p-4 space-y-3">
                            <div className="flex items-center gap-2 text-emerald-700">
                              <Smartphone className="w-4 h-4" />
                              <span className="text-xs font-bold uppercase tracking-wider">Care Included</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Hotel</span>
                                <span className="font-bold text-gray-900 truncate max-w-[100px]">
                                  {currentLiability?.dutyOfCare.hotel.eligible ? (currentLiability.dutyOfCare.hotel.provider || 'Clarion HEL') : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Meals</span>
                                <span className="font-bold text-gray-900">
                                  {currentLiability?.dutyOfCare.meals.eligible ? `€${currentLiability.dutyOfCare.meals.voucherValue} Voucher` : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="p-4 space-y-3">
                            <div className="flex items-center gap-2 text-amber-700">
                              <AlertTriangle className="w-4 h-4" />
                              <span className="text-xs font-bold uppercase tracking-wider">Action Required</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-700">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Notify Passenger
                              </div>
                              {isOverride && (
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-800">
                                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Justification Required
                                </div>
                              )}
                              {currentAction === 'Manual Handling Required' && (
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-700">
                                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Supervisor Approval
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {selectedPax.status === 'pending_triage' ? (
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      {(() => {
                        const recommendedAction = recoveryOptions.find(o => o.status === 'Recommended')?.action;
                        const isOverride = selectedOption && selectedOption !== recommendedAction;

                        return isOverride && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-amber-500/20 border border-amber-500/30 rounded-xl p-4 space-y-3"
                          >
                            <div className="flex items-center gap-2 text-amber-800">
                              <AlertTriangle className="w-4 h-4" />
                              <span className="text-xs font-bold uppercase tracking-wider">Reason for Override</span>
                            </div>
                            <textarea
                              value={overrideRationale}
                              onChange={(e) => setOverrideRationale(e.target.value)}
                              placeholder="Please provide a justification for audit purposes..."
                              className="w-full bg-gray-50 border border-amber-500/30 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 min-h-[80px] outline-none transition-all text-gray-900 placeholder:text-gray-500"
                            />
                            <p className="text-[10px] text-amber-700 italic">This override will be visible to audit / CFO view.</p>
                          </motion.div>
                        );
                      })()}

                      <div className="flex flex-wrap gap-3">
                        {(() => {
                          const recommendedAction = recoveryOptions.find(o => o.status === 'Recommended')?.action;
                          const isOverride = selectedOption && selectedOption !== recommendedAction;
                          const canExecute = (!isOverride || overrideRationale.trim().length > 0) && !aiLoading;

                          return (
                            <button
                              onClick={handleExecute}
                              disabled={!canExecute || aiLoading}
                              className={cn(
                                "flex-1 min-w-[200px] font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 group -translate-y-0.5 hover:-translate-y-1",
                                !canExecute || aiLoading
                                  ? "bg-gray-100 text-gray-500 cursor-not-allowed shadow-none"
                                  : isOverride
                                    ? "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20"
                                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20"
                              )}
                            >
                              <Zap className="w-5 h-5 fill-white group-hover:scale-110 transition-transform" />
                              {isOverride ? 'Execute Override Option' : 'Execute Selected Option'}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="pt-4 border-t border-gray-200">
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-gray-500">
                          <Clock className="w-5 h-5" />
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider">Action Logged</p>
                            <p className="text-[11px] text-gray-500">Executed by Agent HEL-042 at {new Date().toLocaleTimeString()}</p>
                          </div>
                        </div>
                        <button className="text-indigo-600 font-bold text-xs hover:underline">View Full Audit Trail</button>
                      </div>
                    </div>
                  )}

                  {selectedPax.status === 'resolved' && (
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] pointer-events-none" />
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// ─── QR Code SVG placeholder ──────────────────────────────────────────────────
const QRPlaceholder = ({ payload }: { payload: string }) => (
  <div className="flex flex-col items-center gap-2 mt-3 p-3 rounded-xl bg-white/5 border border-indigo-500/30">
    <svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" className="rounded">
      {/* top-left finder */}
      <rect x="4" y="4" width="28" height="28" rx="2" fill="none" stroke="#818cf8" strokeWidth="3"/>
      <rect x="10" y="10" width="16" height="16" rx="1" fill="#818cf8"/>
      {/* top-right finder */}
      <rect x="64" y="4" width="28" height="28" rx="2" fill="none" stroke="#818cf8" strokeWidth="3"/>
      <rect x="70" y="10" width="16" height="16" rx="1" fill="#818cf8"/>
      {/* bottom-left finder */}
      <rect x="4" y="64" width="28" height="28" rx="2" fill="none" stroke="#818cf8" strokeWidth="3"/>
      <rect x="10" y="70" width="16" height="16" rx="1" fill="#818cf8"/>
      {/* data cells — deterministic pattern from payload length */}
      {[40,48,56,64,36,44,52,60,40,50,60,36,46,56,42,54,38,50,62,44,58].map((x, i) => (
        <rect key={i} x={x % 58 + 4} y={Math.floor(i * 4.3) % 58 + 4}
          width="4" height="4" rx="0.5" fill="#818cf8" opacity={0.6 + (i % 5) * 0.08}/>
      ))}
    </svg>
    <p className="text-[9px] font-mono text-indigo-700/60 tracking-wider text-center max-w-[120px] truncate">{payload}</p>
  </div>
);

// ─── Render markdown-lite (bold only) ────────────────────────────────────────
const MsgText = ({ text }: { text: string }) => (
  <p className="text-sm leading-relaxed whitespace-pre-wrap">
    {text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    )}
  </p>
);

// ─── Typing indicator ────────────────────────────────────────────────────────
const TypingBubble = () => (
  <div className="flex justify-start">
    <div className="bg-gray-100 border border-indigo-500/20 rounded-2xl rounded-tl-sm px-4 py-3">
      <div className="flex gap-1.5 items-center">
        {[0, 0.2, 0.4].map(d => (
          <div key={d} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
            style={{ animationDelay: `${d}s`, animationDuration: '1s' }}/>
        ))}
      </div>
    </div>
  </div>
);

// ─── PassengerExperience ─────────────────────────────────────────────────────
type ChatPhase = 'template' | 'confirmed' | 'chat' | 'escalating' | 'escalated';
type ChatMsg = { role: 'user' | 'assistant'; content: string; timestamp: string; isClaudeGenerated?: boolean };
type GatheredCtx = {
  passengerConcern: string;
  preferredResolution: string;
  emotionalState: 'Calm' | 'Frustrated' | 'Anxious' | 'Angry' | 'Distressed';
  keyDetails: string[];
};

const PassengerExperience = ({
  passengers,
  analysisCache,
  onUpdatePax,
}: {
  passengers: Passenger[];
  analysisCache: Record<string, AnalysisResult>;
  onUpdatePax: (id: string, updates: Partial<Passenger>, useUid?: boolean) => void;
}) => {
  const [selectedPax, setSelectedPax] = useState<Passenger | null>(null);
  const [templateMsg, setTemplateMsg] = useState<PassengerMessage | null>(null);
  const [whatsappMessage, setWhatsappMessage] = useState<WhatsAppMessage | null>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [phase, setPhase] = useState<ChatPhase>('template');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [gatheredCtx, setGatheredCtx] = useState<GatheredCtx | null>(null);
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── Generate WhatsApp message when passenger selected ─────────────────────
  useEffect(() => {
    if (!selectedPax) {
      setWhatsappMessage(null);
      setMessageError(null);
      return;
    }

    const generateMessage = async () => {
      setMessageLoading(true);
      setMessageError(null);
      try {
        const result = analysisCache[selectedPax.uid] ?? {};
        const message = await generateWhatsAppMessage(selectedPax, result);
        setWhatsappMessage(message);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to generate message';
        console.error('WhatsApp message generation failed:', errorMsg);
        setMessageError(errorMsg);
        setWhatsappMessage(null);
      } finally {
        setMessageLoading(false);
      }
    };

    generateMessage();
  }, [selectedPax]);

  // ── Passenger selection ───────────────────────────────────────────────────
  const selectPax = (pax: Passenger) => {
    const result = analysisCache[pax.uid] ?? {};
    const msg = getPassengerMessage(pax, result);
    setSelectedPax(pax);
    setTemplateMsg(msg);
    setWhatsappMessage(null);
    setMessageLoading(false);
    setMessageError(null);
    setPhase('template');
    setMessages([]);
    setInputValue('');
    setIsTyping(false);
    setGatheredCtx(null);
  };

  // ── Filtered list — passenger portal shows only Group C + escalated pax ──
  const filteredPax = passengers.filter(
    p =>
      (p.uid.startsWith('C') || p.isEscalated || p.status === 'escalated') &&
      (!search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.pnr.toLowerCase().includes(search.toLowerCase()))
  );

  const distressBadge = (level: string | undefined) => {
    if (level === 'Critical') return 'bg-red-500/20 text-red-700 border-red-500/30';
    if (level === 'High') return 'bg-orange-500/20 text-orange-700 border-orange-500/30';
    if (level === 'Medium') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30';
  };

  // ── Got it / Accept ───────────────────────────────────────────────────────
  const handleGotIt = () => {
    setPhase('confirmed');
  };

  // ── I need help → static opener (no API call) ────────────────────────────
  const handleNeedHelp = () => {
    if (!selectedPax) return;
    const firstName = getFirstName(selectedPax.name);
    const opener = `We're sorry about the disruption to your flight, ${firstName}. We're here to support you. Please tell us what's on your mind.`;
    setMessages([{
      role: 'assistant',
      content: opener,
      timestamp: new Date().toISOString(),
    }]);
    setPhase('chat');
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !selectedPax || isTyping || phase === 'escalated') return;

    const userText = inputValue.trim();
    setInputValue('');
    const userMsg: ChatMsg = { role: 'user', content: userText, timestamp: new Date().toISOString() };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setIsTyping(true);

    // ── Check for immediate escalation signals (on every message) ────────────
    const IMMEDIATE_SIGNALS = [
      'medical', 'appointment', 'doctor',
      'hospital', 'surgery', 'urgent',
      'emergency', 'meeting', 'interview',
      'funeral', 'wedding', 'connection',
      'agent', 'manager', 'supervisor', 'human',
      'lawyer', 'legal', 'complaint'
    ];

    const hasImmediateSignal = IMMEDIATE_SIGNALS.some(signal =>
      userText.toLowerCase().includes(signal)
    );

    const passengerMessageCount = nextHistory.filter(m => m.role === 'user').length;

    // If immediate signal detected, escalate without calling Claude
    if (hasImmediateSignal) {
      const now = new Date().toISOString();
      const closingMessage = `Thank you ${getFirstName(selectedPax.name)} — we completely understand your situation. A gate agent will join this conversation shortly and will help you resolve this at the earliest. Please stay on this chat.`;
      setMessages([...nextHistory, {
        role: 'assistant',
        content: closingMessage,
        timestamp: now,
      }]);

      onUpdatePax(selectedPax.uid, {
        isEscalated: true,
        status: 'escalated',
        escalationReason: 'Immediate escalation signal detected',
        escalatedAt: now,
        portalOnly: false,
        handoffBriefing: {
          summary: `Passenger escalated immediately. Message: "${userText}"`,
          passengerConcern: userText,
          emotionalState: 'Distressed',
          urgencyLevel: 'High',
          whatWasArranged: [],
          suggestedOpeningLine: `I can see this is urgent — let me help you right away.`,
          sensitiveIssues: [],
          recommendedAction: 'Assist passenger with priority.',
          estimatedResolutionTime: '10 mins',
          generatedAt: now,
          passengerPnr: selectedPax.pnr,
          conversationLength: 1,
          keyDetails: [userText],
          urgencyFlag: true,
          preferredResolution: 'Immediate agent assistance',
          conversationSummary: userText,
          stressSignals: [],
          distressLevel: 'High',
        },
      }, true);
      setPhase('escalated');
      setIsTyping(false);
      return;
    }

    // Build conversation history for Claude (exclude static opener)
    const claudeHistory = nextHistory.filter(m => m.role === 'user' || (m.role === 'assistant' && m.isClaudeGenerated === true));

    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useCase: 'passenger-chat',
          payload: {
            message: userText,
            passengerContext: {
              firstName: getFirstName(selectedPax.name),
              destination: selectedPax.destination,
              delayMinutes: selectedPax.delayMinutes,
              disruptionType: selectedPax.disruptionType,
            },
            conversationHistory: claudeHistory.map(m => ({ role: m.role, content: m.content })),
          },
        }),
      });
      const json = await response.json();
      const data = json.data ?? json;

      const assistantMsg: ChatMsg = {
        role: 'assistant',
        content: data.message ?? 'I apologise — something went wrong. Please speak to a gate agent.',
        timestamp: new Date().toISOString(),
        isClaudeGenerated: true,
      };
      const finalHistory = [...nextHistory, assistantMsg];
      setMessages(finalHistory);

      // React enforces hard ceiling: 3 messages OR Claude escalation ready
      const shouldEscalate = data.escalationReady === true || passengerMessageCount >= 3;

      if (shouldEscalate) {
        const now = new Date().toISOString();
        const firstName = getFirstName(selectedPax.name);
        const passengerMessages = finalHistory.filter(m => m.role === 'user');
        const conversationSummary = passengerMessages.map(m => m.content).join(' | ');

        // FIX 3: Robust fallback for gatheredContext from Claude
        const gatheredCtx = data.gatheredContext ?? {
          passengerConcern: conversationSummary || userText,
          emotionalState: 'Distressed' as const,
          urgencyFlag: true,
          cooperationLevel: 'cooperative' as const,
          keyDetails: [userText]
        };

        // Show static closing message
        const closingMessage = `Thank you ${firstName} — we completely understand your situation. A gate agent will join this conversation shortly and will help you resolve this at the earliest. Please stay on this chat.`;
        setMessages([...finalHistory, {
          role: 'assistant',
          content: closingMessage,
          timestamp: now,
        }]);

        onUpdatePax(selectedPax.uid, {
          isEscalated: true,
          status: 'escalated',
          escalationReason: data.escalationReady ? 'Claude escalation' : 'Message limit reached (3 messages)',
          escalatedAt: now,
          portalOnly: false,
          handoffBriefing: {
            summary: `Passenger escalated from chat after ${passengerMessages.length} message${passengerMessages.length !== 1 ? 's' : ''}.`,
            passengerConcern: gatheredCtx.passengerConcern || conversationSummary,
            emotionalState: gatheredCtx.emotionalState || 'Distressed',
            urgencyLevel: gatheredCtx.urgencyFlag ? 'High' : 'Medium',
            whatWasArranged: [],
            suggestedOpeningLine: `I can see you need help — let me look into this for you right away.`,
            sensitiveIssues: [],
            recommendedAction: 'Assist passenger and provide recovery options.',
            estimatedResolutionTime: '10 mins',
            generatedAt: now,
            passengerPnr: selectedPax.pnr,
            conversationLength: passengerMessages.length,
            keyDetails: gatheredCtx.keyDetails || [userText],
            urgencyFlag: gatheredCtx.urgencyFlag ?? true,
            preferredResolution: 'Agent assistance',
            conversationSummary: conversationSummary,
            stressSignals: [],
            distressLevel: gatheredCtx.emotionalState === 'Calm' ? 'Medium' : 'High',
          },
        }, true);
        setPhase('escalated');
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Our assistant is temporarily unavailable. Please speak to a gate agent for immediate help.',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  // ── Status helpers ───────────────────────────────────────────────────────
  const initials = (name: string) =>
    name.split(' ').slice(0, 2).map(n => n[0] ?? '').join('').toUpperCase();

  const paxStatusDot = (pax: Passenger): string => {
    if (pax.isEscalated) return 'bg-red-400';
    if (selectedPax?.uid === pax.uid) {
      if (phase === 'confirmed') return 'bg-emerald-400';
      if (phase === 'chat' || phase === 'escalating') return 'bg-orange-400';
      if (phase === 'escalated') return 'bg-red-400';
    }
    return 'bg-gray-600';
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100dvh-80px)] flex overflow-hidden bg-gray-50">

      {/* ── LEFT PANEL — passenger queue ───────────────────────────────────── */}
      <div className="w-[260px] flex-shrink-0 flex flex-col border-r border-gray-200" style={{ background: '#F8F9FA' }}>

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-200">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-3">
            Passenger Queue
          </p>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or PNR…"
            className="w-full px-3 py-2 text-xs rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none"
            style={{ background: '#F1F3F5', border: '1px solid #E2E8F0' }}
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filteredPax.map(pax => {
            const analysis = analysisCache[pax.uid];
            const distress = analysis?.distressLevel as string | undefined;
            const isSelected = selectedPax?.uid === pax.uid;
            const dot = paxStatusDot(pax);
            return (
              <button
                key={pax.uid}
                onClick={() => selectPax(pax)}
                className={`w-full text-left px-4 py-3 transition-all duration-100 ${
                  isSelected
                    ? 'border-l-2 border-l-indigo-500'
                    : 'border-l-2 border-l-transparent hover:border-l-white/10'
                }`}
                style={{
                  background: isSelected ? 'rgba(99,102,241,0.08)' : undefined,
                  borderBottom: '1px solid #E2E8F0',
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Status dot */}
                  <span className={`block w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${dot}`} />
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1.5">
                      <p className="text-[12px] font-semibold text-gray-900 truncate leading-snug">{pax.name}</p>
                      {distress && (
                        <span className={`flex-shrink-0 text-[8px] px-1.5 py-0.5 rounded-full border font-bold leading-none ${distressBadge(distress)}`}>
                          {distress}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">{pax.pnr} · {pax.flightNumber}</p>
                    <p className="text-[10px] text-gray-500">{pax.origin} → {pax.destination}</p>
                  </div>
                </div>
              </button>
            );
          })}
          {filteredPax.length === 0 && (
            <p className="text-gray-500 text-xs text-center py-10">No passengers found</p>
          )}
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-gray-200 flex flex-wrap gap-x-3 gap-y-1">
          {[
            { dot: 'bg-gray-600', label: 'Not contacted' },
            { dot: 'bg-emerald-400', label: 'Resolved' },
            { dot: 'bg-orange-400', label: 'In chat' },
            { dot: 'bg-red-400', label: 'Escalated' },
          ].map(({ dot, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
              <span className="text-[9px] text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL — chat window ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0" style={{ background: '#FFFFFF' }}>
        {!selectedPax ? (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center select-none">
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4"
                style={{ background: '#F1F3F5', border: '1px solid #E2E8F0' }}
              >
                <Smartphone className="w-9 h-9 text-gray-600" />
              </div>
              <p className="text-gray-500 text-sm">Select a passenger to begin</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── Chat header ────────────────────────────────────────────────── */}
            <div
              className="flex items-center gap-3 px-5 py-4 flex-shrink-0 border-b border-gray-200"
              style={{ background: '#F8F9FA' }}
            >
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
              >
                <span className="text-gray-900 text-[11px] font-bold tracking-wide">{initials(selectedPax.name)}</span>
              </div>

              {/* Name + flight */}
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-semibold text-sm truncate leading-tight">{selectedPax.name}</p>
                <p className="text-gray-500 text-xs truncate">
                  {selectedPax.flightNumber} · {selectedPax.origin} → {selectedPax.destination}
                </p>
              </div>

              {/* AeroAgent watermark + online dot */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-[9px] text-gray-500 font-medium tracking-widest uppercase select-none">✦ AeroAgent</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-xs text-emerald-700 font-medium">Online</span>
                </div>
              </div>
            </div>

            {/* ── Escalation strip ───────────────────────────────────────────── */}
            {(phase === 'escalating' || phase === 'escalated') && (
              <div
                className="flex items-center gap-2 px-5 py-2 flex-shrink-0"
                style={{ background: 'rgba(245,158,11,0.12)', borderBottom: '1px solid rgba(245,158,11,0.2)' }}
              >
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse flex-shrink-0" />
                <span className="text-xs text-amber-800 font-medium leading-tight">
                  {phase === 'escalating'
                    ? 'Preparing handoff to gate agent…'
                    : '✓ Gate agent notified — they have your full details'}
                </span>
              </div>
            )}

            {/* ── Message area ───────────────────────────────────────────────── */}
            <div
              className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0"
              style={{ background: '#FFFFFF' }}
            >
              {/* Watermark */}
              <p className="text-center text-[8px] text-gray-600 tracking-[0.2em] font-medium uppercase mb-1 select-none">
                ✦ AeroAgent
              </p>

              {/* ── Loading state ──────────────────────────────────────── */}
              {phase === 'template' && messageLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-start gap-2"
                >
                  <div
                    className="max-w-[75%] rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-4 py-3"
                    style={{ background: '#F1F3F5', border: '1px solid rgba(99,102,241,0.15)' }}
                  >
                    <p className="text-[12px] text-gray-600">Initializing conversation.</p>
                    <div className="flex gap-1 mt-2">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── WhatsApp message (AI-generated) ────────────────────── */}
              {phase === 'template' && !messageLoading && whatsappMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-start"
                >
                  <div
                    className="max-w-[75%] rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-4 py-3"
                    style={{ background: '#F1F3F5', border: '1px solid rgba(99,102,241,0.15)' }}
                  >
                    {/* AI badge */}
                    {whatsappMessage.aiPowered && (
                      <div className="flex items-center gap-1 mb-2">
                        <Sparkles className="w-3 h-3 text-indigo-600" />
                        <span className="text-[9px] font-semibold text-indigo-600">AI Generated</span>
                      </div>
                    )}

                    <MsgText text={whatsappMessage.message} />

                    {/* QR attachment card */}
                    {whatsappMessage.qrCodeRequired && (
                      <div
                        className="mt-3 rounded-xl overflow-hidden"
                        style={{ background: '#F8F9FA', border: '1px solid #E2E8F0' }}
                      >
                        <div className="px-3 pt-3 pb-2 flex flex-col items-center">
                          <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                            <span className="text-[10px] text-gray-500 text-center px-2">QR Code: {whatsappMessage.qrCodeType}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="text-[10px] text-gray-500 text-right mt-2">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ── Template message (fallback) ───────────────────────── */}
              {phase === 'template' && !messageLoading && !whatsappMessage && templateMsg && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-start"
                >
                  <div
                    className="max-w-[75%] rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-4 py-3"
                    style={{ background: '#F1F3F5', border: '1px solid rgba(99,102,241,0.15)' }}
                  >
                    <MsgText text={templateMsg.messageBody} />

                    {/* QR attachment card */}
                    {templateMsg.qrPayload && (
                      <div
                        className="mt-2 rounded-xl overflow-hidden"
                        style={{ background: '#F8F9FA', border: '1px solid #E2E8F0' }}
                      >
                        <div className="px-3 pt-3 pb-2 flex flex-col items-center">
                          <QRPlaceholder payload={templateMsg.qrPayload} />
                        </div>
                      </div>
                    )}

                    {/* Offer summary pill */}
                    {templateMsg.offerSummary && (
                      <div
                        className="mt-2 px-3 py-1.5 rounded-lg"
                        style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
                      >
                        <p className="text-[11px] text-indigo-700/90 font-medium">{templateMsg.offerSummary}</p>
                      </div>
                    )}

                    <p className="text-[10px] text-gray-500 text-right mt-2">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ── Confirmed ───────────────────────────────────────────── */}
              {phase === 'confirmed' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                    style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)' }}
                  >
                    <CheckCircle2 className="w-8 h-8 text-emerald-700" />
                  </div>
                  <p className="text-gray-900 font-bold text-base mb-1">All sorted!</p>
                  <p className="text-gray-500 text-sm px-8 leading-relaxed">
                    {getFirstName(selectedPax.name)} acknowledged their recovery arrangement.
                  </p>
                  <p className="text-gray-500 text-[10px] mt-3 uppercase tracking-widest">Case resolved</p>
                </motion.div>
              )}

              {/* ── Chat history ────────────────────────────────────────── */}
              {(phase === 'chat' || phase === 'escalating' || phase === 'escalated') &&
                messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] px-4 py-2.5 ${msg.role === 'user' ? 'text-white' : 'text-gray-800'}`}
                      style={{
                        background: msg.role === 'user' ? '#4338ca' : '#F1F3F5',
                        borderRadius: msg.role === 'user'
                          ? '18px 18px 4px 18px'
                          : '18px 18px 18px 4px',
                        border: msg.role === 'user' ? 'none' : '1px solid rgba(99,102,241,0.15)',
                      }}
                    >
                      <MsgText text={msg.content} />
                      <p className={`text-[10px] mt-1 text-right ${msg.role === 'user' ? 'text-indigo-200/70' : 'text-gray-500'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {msg.role === 'user' && ' ✓✓'}
                      </p>
                    </div>
                  </motion.div>
                ))
              }

              {/* Typing indicator */}
              {isTyping && <TypingBubble />}
              <div ref={messagesEndRef} />
            </div>

            {/* ── CTA buttons ──────────────────────────────────────────────── */}
            {phase === 'template' && !messageLoading && (
              <div
                className="px-5 py-3 space-y-2.5 flex-shrink-0 border-t border-gray-200"
                style={{ background: '#F8F9FA' }}
              >
                {/* WhatsApp message buttons */}
                {whatsappMessage && (
                  <>
                    <button
                      onClick={handleGotIt}
                      className="w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                      style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: '#047857' }}
                    >
                      <span>✓</span>
                      <span>Got it, thank you</span>
                    </button>
                    {selectedPax && analysisCache[selectedPax.uid]?.goodwillAction?.talkToAgentOption && (
                      <button
                        onClick={handleNeedHelp}
                        className="w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                        style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.35)', color: '#4f46e5' }}
                      >
                        <span>💬</span>
                        <span>I need help</span>
                      </button>
                    )}
                  </>
                )}

                {/* Template message buttons */}
                {!whatsappMessage && templateMsg && templateMsg.ctaType !== 'none' && (
                  <>
                    {templateMsg.ctaType === 'accept-or-help' && (
                      <button
                        onClick={handleGotIt}
                        className="w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                        style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: '#047857' }}
                      >
                        <span>✓</span>
                        <span>Accept offer</span>
                      </button>
                    )}
                    <button
                      onClick={handleNeedHelp}
                      className="w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                      style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.35)', color: '#4f46e5' }}
                    >
                      <span>💬</span>
                      <span>I need help</span>
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ── Chat input bar (chat phases only) ────────────────────────── */}
            {(phase === 'chat' || phase === 'escalating' || phase === 'escalated') && (
              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-3 px-5 py-3 flex-shrink-0 border-t border-gray-200"
                style={{ background: '#F8F9FA' }}
              >
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  disabled={isTyping || phase === 'escalated'}
                  placeholder={
                    phase === 'escalated' ? 'Agent has been notified…' :
                    isTyping ? 'AeroAgent is typing…' :
                    'Message…'
                  }
                  className="flex-1 px-4 py-2.5 text-sm rounded-full text-gray-900 placeholder-gray-400 focus:outline-none disabled:opacity-40"
                  style={{ background: '#F1F3F5', border: '1px solid #E2E8F0' }}
                />
                <button
                  type="submit"
                  disabled={isTyping || !inputValue.trim() || phase === 'escalated'}
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-25"
                  style={{ background: (isTyping || !inputValue.trim() || phase === 'escalated') ? '#E2E8F0' : '#4338ca' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const PersonaSelector = ({ onSelect }: { onSelect: (persona: 'CFO' | 'GateAgent' | 'Passenger') => void }) => {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6 overflow-hidden relative">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl w-full relative z-10 flex flex-col">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/40 mx-auto mb-8">
            <Zap className="text-white w-12 h-12" />
          </div>
          <h1 className="text-6xl font-extrabold text-gray-900 mb-4 font-display tracking-tight">
            AI-Powered Airline Disruption Recovery
          </h1>
          <p className="text-gray-600 text-lg max-w-3xl mx-auto font-medium mb-8">
            AeroAgent uses Claude to reason across passenger constraints, regulatory obligations, and recovery options — in real time.
          </p>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-8 mb-16 max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-white backdrop-blur-xl border border-gray-200 rounded-xl p-6"
            >
              <div className="text-3xl font-bold text-emerald-700 font-mono mb-2">$35B+</div>
              <p className="text-gray-500 text-sm">Annual industry disruption cost</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="bg-white backdrop-blur-xl border border-gray-200 rounded-xl p-6"
            >
              <div className="text-3xl font-bold text-indigo-600 font-mono mb-2">250+</div>
              <p className="text-gray-500 text-sm">Passengers in this demo</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white backdrop-blur-xl border border-gray-200 rounded-xl p-6"
            >
              <div className="text-3xl font-bold text-amber-700 font-mono mb-2">3</div>
              <p className="text-gray-500 text-sm">AI-powered stakeholder views</p>
            </motion.div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              id: 'CFO',
              title: 'CFO / Auditor',
              desc: 'Monitor financial exposure, audit recovery trails, and track net savings from automated resolutions.',
              icon: BarChart,
              color: 'text-emerald-700',
              bgColor: 'bg-emerald-500/10',
              borderColor: 'hover:border-emerald-500/50'
            },
            {
              id: 'GateAgent',
              title: 'Gate Agent',
              desc: 'Manage real-time passenger triage, handle escalations, and oversee automated rebooking at the gate.',
              icon: PlaneTakeoff,
              color: 'text-indigo-600',
              bgColor: 'bg-indigo-500/10',
              borderColor: 'hover:border-indigo-500/50'
            },
            {
              id: 'Passenger',
              title: 'Passenger',
              desc: 'Experience the AI-driven recovery journey through the mobile concierge interface.',
              icon: Smartphone,
              color: 'text-amber-700',
              bgColor: 'bg-amber-500/10',
              borderColor: 'hover:border-amber-500/50'
            }
          ].map((p, idx) => {
            const Icon = p.icon;
            return (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -12, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelect(p.id as PersonaId)}
                className={cn(
                  "flex flex-col items-center text-center p-10 rounded-[32px] border-2 transition-all h-full",
                  "bg-white backdrop-blur-2xl border-gray-200 shadow-2xl",
                  p.borderColor
                )}
              >
                <div className={cn("w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-inner", p.bgColor)}>
                  <Icon className={cn("w-12 h-12", p.color)} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 font-display">{p.title}</h2>
                <p className="text-gray-500 text-sm leading-relaxed mb-8 flex-1">{p.desc}</p>
                <div className={cn("flex items-center gap-2 font-bold text-xs uppercase tracking-[0.2em] group", p.color)}>
                  Enter Portal
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Demo Hint */}
        <div className="mt-16 text-center">
          <p className="text-gray-500 text-sm italic">
            Start with Gate Agent → select a passenger → watch Claude reason in real time
          </p>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-200 px-6 py-4 flex items-center justify-between text-xs text-gray-500">
        <div>AeroAgent v2.5</div>
        <div className="text-center flex-1">
          AeroAgent · Powered by Claude AI
        </div>
        <a
          href="https://linkedin.com/in/ashish-jacob-james"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-700 transition-colors font-medium"
        >
          LinkedIn
        </a>
      </div>
    </div>
  );
};

// Pre-compute seed data once at module level — zero Claude API calls on page load
const SEED = generateSeedData();

export default function App() {
  const [persona, setPersona] = useState<'CFO' | 'GateAgent' | 'Passenger' | null>(null);
  const [activeTab, setActiveTab] = useState<'audit' | 'triage' | 'pax'>('audit');
  const [passengers, setPassengers] = useState<Passenger[]>(SEED.passengers);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [analysisCache, setAnalysisCache] = useState<Record<string, AnalysisResult>>(SEED.analysisCache);
  const [resetKey, setResetKey] = useState(0);

  const handleReset = () => {
    const fresh = generateSeedData();
    setPassengers(fresh.passengers);
    setAnalysisCache(fresh.analysisCache);
    setResetKey(k => k + 1);
  };

  const handleUpdatePax = (id: string, updates: Partial<Passenger>, useUid = false) => {
    setPassengers(prev => prev.map(p => {
      const match = useUid ? p.uid === id : p.pnr === id;
      return match ? { ...p, ...updates } : p;
    }));
  };

  const totalPax = passengers.length;
  const disruptedFlights = Array.from(new Set(passengers.map(p => p.flightNumber))).length;

  if (!persona) {
    return (
      <PersonaSelector
        onSelect={(p) => {
          setPersona(p);
          if (p === 'CFO') setActiveTab('audit');
          if (p === 'GateAgent') setActiveTab('triage');
          if (p === 'Passenger') setActiveTab('pax');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-indigo-500/20 selection:text-indigo-700">
      {/* Announcement Banner */}
      <AnimatePresence>
        {!announcementDismissed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-indigo-600 text-white px-6 py-2 flex items-center justify-center gap-4 text-sm font-medium shadow-lg shadow-indigo-600/20"
          >
            <span>✦ AeroAgent · Powered by Claude AI  |  Live demo</span>
            <button
              onClick={() => setAnnouncementDismissed(true)}
              className="ml-auto text-gray-900/80 hover:text-gray-900 transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="bg-white px-6 py-3 flex items-center justify-between sticky top-0 z-[100] shadow-sm border-b border-gray-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPersona(null)}
            className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 hover:scale-105 transition-transform"
            title="Back to Persona Selector"
          >
            <Zap className="text-white w-5 h-5" />
          </button>
          <div>
            <h1 className="text-gray-900 text-base font-bold font-display tracking-tight leading-none">
              AeroAgent <span className="text-indigo-600 font-mono tabular-nums text-xs ml-1">v2.5</span>
            </h1>
            <p className="text-gray-500 text-[9px] font-bold text-indigo-600 uppercase tracking-[0.2em] mt-1">Airline IR OPS Recovery Orchestrator</p>
          </div>
          <div className="ml-6 pl-6 border-l border-gray-200 hidden md:block">
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Active Pax</span>
                <span className="text-gray-900 text-sm font-mono tabular-nums font-bold">{totalPax.toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Disruptions</span>
                <span className="text-gray-900 text-sm font-mono tabular-nums font-bold">{disruptedFlights} Flights</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => setPersona(null)}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-all"
          >
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-[9px] font-bold text-gray-900 uppercase tracking-widest">Switch Persona</span>
          </button>

          <div className="flex items-center gap-3 pl-6 border-l border-gray-200">
            <div className="text-right hidden sm:block">
              <p className="text-gray-900 text-xs font-bold">
                {persona === 'CFO' ? 'Ashish Jacob' : persona === 'GateAgent' ? 'Sarah Miller' : 'Pekka Virtanen'}
              </p>
              <p className="text-gray-500 text-[9px] font-bold uppercase tracking-widest">
                {persona === 'CFO' ? 'Senior Auditor' : persona === 'GateAgent' ? 'Gate Supervisor' : 'Passenger'}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs">
              {persona === 'CFO' ? 'AJ' : persona === 'GateAgent' ? 'SM' : 'PV'}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] w-full mx-auto p-4 lg:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'audit' && <CFOAudit passengers={passengers} analysisCache={analysisCache} />}
            {activeTab === 'triage' && <GateAgentTriage passengers={passengers} onUpdatePax={handleUpdatePax} analysisCache={analysisCache} setAnalysisCache={setAnalysisCache} />}
            {activeTab === 'pax' && <PassengerExperience key={resetKey} passengers={passengers} analysisCache={analysisCache} onUpdatePax={handleUpdatePax} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Unobtrusive footer reset */}
      <div className="flex justify-center pb-6 pt-2">
        <button
          onClick={handleReset}
          className="text-gray-400 hover:text-gray-600 text-[11px] transition-colors"
        >
          ↺ Reset demo
        </button>
      </div>
    </div>
  );
}
