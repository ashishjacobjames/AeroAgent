import React, { useState, useMemo, useRef, useEffect } from 'react';
// Build trigger: 2026-04-07 19:48
import {
  LayoutDashboard,
  PlaneTakeoff,
  MessageSquare,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Smartphone,
  Mail,
  MoreVertical,
  Star,
  Zap,
  Users,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Sun,
  Moon,
  ArrowUpRight,
  Download,
  ChevronDown,
  ChevronUp,
  X,
  Plane,
  Info,
  Sparkles,
  Printer,
  RotateCcw,
  BarChart,
  Clipboard,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList
} from 'recharts';
import { Passenger, ActionType, PaxStatus } from './types';
import { generateSeedData } from './seed';
import { computeEngineLocal, computeEngineAI } from './engine';
import { Card, Badge, Tooltip, KPICard, Combobox, Toast, RangeSlider } from './components/UI';
import { RationalePanel } from './components/RationalePanel';
import { cn } from './lib/utils';

// --- CFO Audit Tab ---
const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[#F9FAFB] text-[14px] font-bold font-display uppercase tracking-widest mb-4 pb-1.5 border-b border-gray-800">
    {children}
  </h3>
);

// --- CFO Audit Tab Components ---

const SubNav = ({ active, onChange }: { active: 'dashboard' | 'audit', onChange: (v: 'dashboard' | 'audit') => void }) => (
  <div className="flex items-center gap-1 bg-[#1F2937]/50 p-1 rounded-xl w-fit mb-4">
    <button
      onClick={() => onChange('dashboard')}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
        active === 'dashboard'
          ? "bg-#111827 text-indigo-400 shadow-sm border border-gray-700"
          : "text-gray-400 hover:text-gray-300"
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
          ? "bg-#111827 text-indigo-400 shadow-sm border border-gray-700"
          : "text-gray-400 hover:text-gray-300"
      )}
    >
      <Search className="w-3.5 h-3.5" />
      Audit Review
    </button>
  </div>
);

const CFODashboard = ({
  kpis,
  secondaryKpis,
  actionDistribution,
  processingModeData,
  financialComparisonData,
  ACTION_COLORS,
  MODE_COLORS,
  narrativeCache,
  filteredData
}: any) => {
  const stackedBarData = [
    {
      name: 'Strategies',
      ...actionDistribution.reduce((acc: any, curr: any) => ({
        ...acc,
        [curr.name]: curr.percentage
      }), {})
    }
  ];

  const waterfallData = [
    {
      name: 'Gross Exposure',
      display: kpis.legacy,
      range: [0, kpis.legacy],
      color: '#be123c',
      label: `€${(kpis.legacy/1000).toFixed(1)}k`
    },
    {
      name: 'Recovery Cost',
      display: kpis.aero,
      range: [kpis.savings, kpis.legacy],
      color: '#4f46e5',
      label: `€${(kpis.aero/1000).toFixed(1)}k`
    },
    {
      name: 'Net Savings',
      display: kpis.savings,
      range: [0, kpis.savings],
      color: '#059669',
      label: `€${(kpis.savings/1000).toFixed(1)}k`
    }
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Disrupted PAX"
          value={kpis.count.toLocaleString()}
          icon={Users}
          color="bg-slate-800"
          subtitle="Total volume in period"
          trend={{ value: "+2.4%", positive: false }}
        />
        <KPICard
          label="Gross Exposure Avoided"
          value={`€${kpis.legacy.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={TrendingUp}
          color="bg-warning-crimson"
          subtitle="Projected PSS Logic Risk"
          trend={{ value: "+12.1%", positive: false }}
        />
        <KPICard
          label="Actual Recovery Cost"
          value={`€${kpis.aero.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={Zap}
          color="bg-indigo-600"
          subtitle="Optimized Decision Path"
          trend={{ value: "-18.4%", positive: true }}
        />
        <KPICard
          label="Net Savings Delivered"
          value={`€${kpis.savings.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={DollarSign}
          color="bg-aero-teal"
          subtitle={`${kpis.savingsPercent.toFixed(1)}% Cost Reduction`}
          trend={{ value: "+4.2%", positive: true }}
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          variant="secondary"
          label="Manual Override Rate"
          value={`${secondaryKpis.overrideRate.toFixed(1)}%`}
          icon={RotateCcw}
          color="bg-amber-500"
          subtitle="Human intervention"
        />
        <KPICard
          variant="secondary"
          label="Avg Recovery Cost / PAX"
          value={`€${secondaryKpis.avgCost.toFixed(0)}`}
          icon={DollarSign}
          color="bg-slate-600"
          subtitle="Per passenger average"
        />
        <KPICard
          variant="secondary"
          label="Automation Rate"
          value={`${secondaryKpis.automationRate.toFixed(1)}%`}
          icon={Zap}
          color="bg-indigo-500"
          subtitle="Hands-off resolution"
        />
        <KPICard
          variant="secondary"
          label="AI Acceptance Rate"
          value={`${secondaryKpis.acceptanceRate.toFixed(1)}%`}
          icon={CheckCircle2}
          color="bg-emerald-500"
          subtitle="Model alignment"
        />
        <KPICard
          variant="secondary"
          label="AI Narratives Generated"
          value={Object.keys(narrativeCache || {}).length.toString()}
          icon={Clipboard}
          color="bg-indigo-600"
          subtitle={`${kpis.count > 0 ? ((Object.keys(narrativeCache || {}).length / kpis.count) * 100).toFixed(1) : 0}% coverage`}
        />
        <KPICard
          variant="secondary"
          label="Exceptions Flagged"
          value={Object.values(narrativeCache || {}).filter((n: any) => n.exceptionFlag).length.toString()}
          icon={AlertTriangle}
          color="bg-amber-500"
          subtitle="Cases requiring review"
        />
        <KPICard
          variant="secondary"
          label="Compliance Coverage"
          value={`${kpis.count > 0 ? ((Object.keys(narrativeCache || {}).length / kpis.count) * 100).toFixed(0) : 0}%`}
          icon={CheckCircle2}
          color="bg-emerald-600"
          subtitle="Audited and documented"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-#111827 border border-gray-800 rounded-xl p-4 shadow-sm h-[300px] flex flex-col hover:border-gray-700 transition-all">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[11px] font-bold font-display text-[#F9FAFB] uppercase tracking-wider">Resolution Strategy Split</h4>
            <span className="text-[10px] text-[#9CA3AF] font-medium">% of Total Cases</span>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <div className="h-10 w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={stackedBarData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide domain={[0, 100]} />
                  <YAxis type="category" dataKey="name" hide />
                  <RechartsTooltip
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Share']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
                  />
                  {actionDistribution.map((entry: any, index: number) => (
                    <Bar
                      key={entry.name}
                      dataKey={entry.name}
                      stackId="a"
                      fill={ACTION_COLORS[entry.name] || '#9ca3af'}
                      radius={index === 0 ? [4, 0, 0, 4] : index === actionDistribution.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 gap-y-1 overflow-y-auto max-h-[160px] pr-2 custom-scrollbar">
              {actionDistribution.map((entry: any) => (
                <div key={entry.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ACTION_COLORS[entry.name] || '#9ca3af' }} />
                    <span className="text-[10px] text-[#9CA3AF] truncate font-medium">{entry.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#F9FAFB] shrink-0">{entry.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-#111827 border border-gray-800 rounded-xl p-4 shadow-sm h-[300px] flex flex-col hover:border-gray-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[11px] font-bold font-display text-[#F9FAFB] uppercase tracking-wider">Processing Mode</h4>
            <span className="text-[10px] text-[#9CA3AF] font-medium">Automation vs Manual</span>
          </div>
          <div className="flex-1 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={processingModeData}
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="name"
                  stroke="none"
                >
                  {processingModeData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={MODE_COLORS[entry.name] || '#64748b'} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value: number, name: string) => [`${value} cases`, name]}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-4">
              <span className="text-[20px] font-bold text-[#F9FAFB] leading-none">{kpis.count}</span>
              <span className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-widest mt-1">Total Cases</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-gray-800">
            {processingModeData.map((entry: any) => (
              <div key={entry.name} className="flex flex-col items-center">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: MODE_COLORS[entry.name] }} />
                  <span className="text-[10px] font-bold text-[#F9FAFB]">{entry.percentage.toFixed(0)}%</span>
                </div>
                <span className="text-[8px] text-[#9CA3AF] font-bold uppercase tracking-tighter text-center leading-tight truncate w-full">
                  {entry.name.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-#111827 border border-gray-800 rounded-xl p-4 shadow-sm h-[300px] flex flex-col hover:border-gray-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[11px] font-bold font-display text-[#F9FAFB] uppercase tracking-wider">Financial Outcome Flow</h4>
            <span className="text-[10px] text-[#9CA3AF] font-medium">EUR (€)</span>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={waterfallData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 700 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9CA3AF', fontSize: 10 }}
                  tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                  cursor={{ fill: '#1F2937' }}
                  formatter={(value: any, name: string, props: any) => [
                    `€${props.payload.display.toLocaleString()}`,
                    props.payload.name
                  ]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #374151', backgroundColor: '#111827', color: '#F9FAFB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)', fontSize: '11px' }}
                />
                <Bar
                  dataKey="range"
                  radius={[4, 4, 4, 4]}
                  barSize={40}
                >
                  {waterfallData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="label"
                    position="top"
                    style={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 700 }}
                  />
                </Bar>
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
};

const AuditReview = ({
  search,
  setSearch,
  isFiltersOpen,
  setIsFiltersOpen,
  uniqueFlights,
  flightFilter,
  setFlightFilter,
  disruptionTypes,
  disruptionFilter,
  setDisruptionFilter,
  actionTypes,
  actionFilter,
  setActionFilter,
  overrideOnly,
  setOverrideOnly,
  filteredData,
  processedData,
  expandedRows,
  toggleRow,
  narrativeCache,
  expandedNarratives,
  narrativeLoading,
  loadNarrative,
  exportToCSV,
  cn
}: any) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <section>
      <div className="bg-#111827 border border-gray-800 rounded-xl shadow-sm overflow-hidden hover:border-gray-700 transition-all">
        <div className="p-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[280px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" />
            <input
              type="text"
              placeholder="Search PNR, Passenger, or Flight..."
              className="w-full pl-9 pr-4 py-2 bg-[#1F2937] border border-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans placeholder:text-[#6B7280] text-[#F9FAFB]"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold transition-all border uppercase tracking-wider",
                isFiltersOpen
                  ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-400"
                  : "bg-#111827 border-gray-700 text-[#9CA3AF] hover:border-gray-600"
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {isFiltersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold bg-indigo-600 text-white border border-indigo-500/50 hover:bg-indigo-700 transition-all uppercase tracking-wider"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isFiltersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-gray-800 bg-[#1F2937]/30"
            >
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Combobox
                    label="Flight Number"
                    options={uniqueFlights}
                    selected={flightFilter}
                    onChange={setFlightFilter}
                    placeholder="Select Flights..."
                  />
                  <Combobox
                    label="Disruption Type"
                    options={disruptionTypes}
                    selected={disruptionFilter}
                    onChange={setDisruptionFilter}
                    placeholder="Select Types..."
                  />
                  <Combobox
                    label="Action Taken"
                    options={actionTypes}
                    selected={actionFilter}
                    onChange={setActionFilter}
                    placeholder="Select Actions..."
                  />
                  <div className="flex items-center gap-2.5 p-2.5 bg-#111827 border border-gray-700 rounded-lg h-fit self-end">
                    <input
                      type="checkbox"
                      id="overrideOnly"
                      className="w-3.5 h-3.5 text-indigo-600 border-gray-600 rounded focus:ring-indigo-500"
                      checked={overrideOnly}
                      onChange={e => setOverrideOnly((e.target as HTMLInputElement).checked)}
                    />
                    <label htmlFor="overrideOnly" className="text-[11px] font-bold text-[#9CA3AF] cursor-pointer uppercase tracking-wider">Manual Overrides Only</label>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>

    <section>
      <div className="bg-#111827 border border-gray-800 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.3)] overflow-y-visible overflow-x-auto hover:border-gray-700 transition-all">
        <table className="w-full border-collapse text-[13px] font-sans">
          <thead className="sticky top-0 z-20">
            <tr className="bg-[#1F2937] border-b-2 border-gray-800">
              <th className="px-4 py-3 text-left text-[#9CA3AF] text-[10.5px] font-bold uppercase tracking-[0.8px] w-[80px]">PNR</th>
              <th className="px-4 py-3 text-left text-[#9CA3AF] text-[10.5px] font-bold uppercase tracking-[0.8px] w-[220px]">Passenger</th>
              <th className="px-4 py-3 text-left text-[#9CA3AF] text-[10.5px] font-bold uppercase tracking-[0.8px] w-[180px]">Flight & Routing</th>
              <th className="px-4 py-3 text-center text-[#9CA3AF] text-[10.5px] font-bold uppercase tracking-[0.8px]">Disruption</th>
              <th className="px-4 py-3 text-center text-[#9CA3AF] text-[10.5px] font-bold uppercase tracking-[0.8px]">Resolution Mode</th>
              <th className="px-4 py-3 text-center text-[#9CA3AF] text-[10.5px] font-bold uppercase tracking-[0.8px]">Override</th>
              <th className="px-4 py-3 text-center text-[#9CA3AF] text-[10.5px] font-bold uppercase tracking-[0.8px] min-w-[160px]">Final Action</th>
              <th className="px-4 py-3 text-right text-[#9CA3AF] text-[10.5px] font-bold uppercase tracking-[0.8px]">Net Savings</th>
              <th className="px-4 py-3 text-center text-[#9CA3AF] text-[10.5px] font-bold uppercase tracking-[0.8px]">AI Narrative</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredData.map((p: any) => {
              const isOverridden = p.overrideAction !== undefined;
              const isExpanded = expandedRows.has(p.pnr);
              return (
                <React.Fragment key={p.uid}>
                  <tr
                    onClick={() => toggleRow(p.pnr)}
                    className={cn(
                      "hover:bg-[#1F2937] transition-all duration-100 group cursor-pointer",
                      isOverridden && "bg-amber-500/10",
                      isExpanded && "bg-[#0D1424] border-l-4 border-l-indigo-500"
                    )}
                  >
                    <td className="px-4 py-2.5 font-pnr text-[12.5px] font-semibold text-[#F9FAFB] tracking-[0.3px]">
                      {p.pnr}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col">
                        <span className="text-[12.5px] font-bold text-[#F9FAFB] leading-tight">{p.name}</span>
                        <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest mt-0.5">{p.tier} · {p.cabin}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col">
                        <span className="text-[12.5px] font-bold text-[#F9FAFB] leading-tight">{p.flightNumber}</span>
                        <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest mt-0.5">{p.origin} ➔ {p.destination}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                          ['Crew Scheduling', 'Late Inbound', 'Technical'].includes(p.disruptionReason) ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                          p.disruptionReason === 'Weather' ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                          "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                        )}>
                          {p.disruptionReason}
                        </span>
                        <span className="text-[10px] text-[#6B7280] font-mono font-bold">
                          {Math.floor(p.delayHours)}:{String(Math.round((p.delayHours % 1) * 60)).padStart(2, '0')}h
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={
                        p.overrideAction ? 'slate' :
                        p.status === 'auto_processed' ? 'emerald' :
                        p.status === 'pending_validation' ? 'indigo' :
                        'amber'
                      }>
                        {p.overrideAction ? 'Manual' : p.status === 'auto_processed' ? 'Auto' : p.status === 'pending_validation' ? 'Assisted' : 'Manual'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={isOverridden ? 'crimson' : 'slate'}>
                        {isOverridden ? 'Yes' : 'No'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="min-w-[160px] max-w-[180px] mx-auto">
                        <Badge variant={
                          (p.overrideAction || p.analysis.recommendedAction) === 'Priority Concierge Triage' ? 'amber' :
                          (p.overrideAction || p.analysis.recommendedAction) === 'Interline Re-accommodation' ? 'emerald' :
                          (p.overrideAction || p.analysis.recommendedAction) === 'Same-Carrier Recovery' ? 'indigo' :
                          'slate'
                        } className="w-full whitespace-normal text-center leading-tight py-1.5 text-[11px]">
                          {p.overrideAction || p.analysis.recommendedAction}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-aero-teal tabular-nums font-bold">
                      €{p.analysis.netSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadNarrative(p);
                        }}
                        disabled={narrativeLoading.has(p.uid)}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded text-[11px] font-bold hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                      >
                        {narrativeLoading.has(p.uid) ? 'Generating...' : narrativeCache[p.uid] ? 'View' : 'Generate'}
                      </button>
                    </td>
                  </tr>
                  <AnimatePresence>
                    {isExpanded && (
                      <tr>
                        <td colSpan={9} className="p-0 border-none">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden bg-[#0D1424]"
                          >
                            {p.analysis.liabilityEngine && (
                              <RationalePanel
                                payload={p.analysis.liabilityEngine}
                                rationale={p.analysis.rationale}
                                recommendedAction={p.analysis.recommendedAction}
                                overrideAction={p.overrideAction}
                                overrideRationale={p.overrideRationale}
                                legacyTotal={p.analysis.legacy.total}
                                aiJustification={p.analysis.aiJustification}
                                aiDistressLevel={p.analysis.aiDistressLevel}
                                aiDistressReason={p.analysis.aiDistressReason}
                                aiRegulatoryBasis={p.analysis.aiRegulatoryBasis}
                                aiRegulatoryNote={p.analysis.aiRegulatoryNote}
                                aiPowered={p.analysis.aiPowered}
                              />
                            )}
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {expandedNarratives.has(p.uid) && narrativeCache[p.uid] && (
                      <tr>
                        <td colSpan={9} className="p-0 border-none">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden bg-indigo-500/10 border-t border-indigo-500/20"
                          >
                            <div className="p-6 space-y-4">
                              {/* Exception Flag */}
                              {narrativeCache[p.uid].exceptionFlag && (
                                <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg p-3 flex items-start gap-3">
                                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <div className="font-bold text-amber-300">⚠ Exception Flagged</div>
                                    <div className="text-sm text-amber-200 mt-1">{narrativeCache[p.uid].exceptionNote}</div>
                                  </div>
                                </div>
                              )}

                              {/* Audit Narrative */}
                              <div className="bg-indigo-500/5 border-l-2 border-indigo-500 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-indigo-400">✦</span>
                                  <h4 className="text-sm font-bold text-indigo-300">Audit Narrative</h4>
                                </div>
                                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{narrativeCache[p.uid].narrative}</p>
                                <p className="text-xs text-gray-600 italic text-right mt-3 pt-3 border-t border-indigo-500/20">Powered by Claude · Anthropic</p>
                              </div>

                              {/* Regulation & Liability Breakdown */}
                              <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Regulation Cited</h4>
                                  <div className="text-sm font-semibold text-gray-300">{narrativeCache[p.uid].regulationCited}</div>
                                </div>
                                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Liability Breakdown</h4>
                                  <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Gross:</span>
                                      <span className="font-semibold text-red-400">€{narrativeCache[p.uid].liabilityBreakdown.gross.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Recovery:</span>
                                      <span className="font-semibold text-blue-400">€{narrativeCache[p.uid].liabilityBreakdown.recovery.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-gray-700">
                                      <span className="text-gray-400 font-semibold">Net:</span>
                                      <span className="font-bold text-emerald-400">€{narrativeCache[p.uid].liabilityBreakdown.net.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Compliance & Risk Assessment */}
                              <div className="grid grid-cols-3 gap-4">
                                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Compliance Status</h4>
                                  <div className={cn(
                                    "inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-bold",
                                    narrativeCache[p.uid].complianceStatus === 'Compliant' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                                    narrativeCache[p.uid].complianceStatus === 'Review Required' ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                                    "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                  )}>
                                    {narrativeCache[p.uid].complianceStatus}
                                  </div>
                                </div>
                                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Audit Risk Level</h4>
                                  <div className={cn(
                                    "inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-bold",
                                    narrativeCache[p.uid].auditRiskLevel === 'Low' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                                    narrativeCache[p.uid].auditRiskLevel === 'Medium' ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                                    "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                  )}>
                                    {narrativeCache[p.uid].auditRiskLevel}
                                  </div>
                                </div>
                                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">AI Generated</h4>
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-indigo-400" />
                                    <span className="text-sm font-semibold text-indigo-300">{narrativeCache[p.uid].aiPowered ? 'Claude' : 'Template'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Recommended Documentation */}
                              {narrativeCache[p.uid].recommendedDocumentation && narrativeCache[p.uid].recommendedDocumentation.length > 0 && (
                                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Recommended Documentation</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {narrativeCache[p.uid].recommendedDocumentation.map((doc: string, idx: number) => (
                                      <div key={idx} className="bg-indigo-500/10 border border-indigo-500/30 rounded px-2.5 py-1.5 text-xs font-medium text-indigo-300 flex items-center gap-1.5">
                                        <Clipboard className="w-3 h-3" />
                                        {doc}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Calculation Explanation */}
                              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Calculation Explanation</h4>
                                <p className="text-sm text-gray-300 leading-relaxed">{narrativeCache[p.uid].liabilityBreakdown.description}</p>
                              </div>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        <div className="bg-[#1F2937] border-t border-gray-800 rounded-b-xl px-4 py-3 text-[12px] text-[#9CA3AF]">
          Showing {filteredData.length} of {processedData.length} records
        </div>
      </div>
    </section>
  </div>
);

const CFOAudit = ({ passengers }: { passengers: Passenger[] }) => {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'audit'>('dashboard');
  const [search, setSearch] = useState('');
  const [flightFilter, setFlightFilter] = useState<string[]>([]);
  const [disruptionFilter, setDisruptionFilter] = useState<string[]>([]);
  const [actionFilter, setActionFilter] = useState<string[]>([]);
  const [overrideOnly, setOverrideOnly] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [narrativeCache, setNarrativeCache] = useState<Record<string, any>>({});
  const [expandedNarratives, setExpandedNarratives] = useState<Set<string>>(new Set());
  const [narrativeLoading, setNarrativeLoading] = useState<Set<string>>(new Set());

  const toggleRow = (pnr: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(pnr)) newExpanded.delete(pnr);
    else newExpanded.add(pnr);
    setExpandedRows(newExpanded);
  };

  // Auto-generate narratives for first 3 passengers on load
  useEffect(() => {
    if (passengers.length === 0) return;

    const processedData = passengers.map(p => ({
      ...p,
      analysis: computeEngineLocal(p)
    }));

    // Generate narratives for first 3 passengers silently
    const firstThree = processedData.slice(0, 3);
    firstThree.forEach(pax => {
      if (!narrativeCache[pax.uid]) {
        loadNarrative(pax);
      }
    });

    // Expand first row by default
    if (processedData.length > 0) {
      setExpandedRows(new Set([processedData[0].pnr]));
    }
  }, [passengers]);

  const loadNarrative = async (pax: any) => {
    // Check cache first
    if (narrativeCache[pax.uid]) {
      setExpandedNarratives(prev => new Set(prev).add(pax.uid));
      return;
    }

    setNarrativeLoading(prev => new Set(prev).add(pax.uid));

    try {
      const response = await fetch('http://localhost:3001/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useCase: 'cfo-audit',
          payload: {
            passenger: pax,
            recommendedAction: pax.analysis.recommendedAction,
            overrideAction: pax.overrideAction,
            overrideRationale: pax.overrideRationale,
            legacy: pax.analysis.legacy,
            aeroAgentCost: pax.analysis.aeroAgentCost,
            netSavings: pax.analysis.netSavings
          }
        })
      });

      if (!response.ok) throw new Error('Failed to load narrative');

      const { data } = await response.json();
      setNarrativeCache(prev => ({ ...prev, [pax.uid]: data }));
      setExpandedNarratives(prev => new Set(prev).add(pax.uid));
    } catch (err) {
      console.error('Failed to load narrative:', err);
    } finally {
      setNarrativeLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(pax.uid);
        return newSet;
      });
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Passenger Name',
      'PNR',
      'Cabin Class',
      'Loyalty Tier',
      'Flight Number',
      'Route',
      'Disruption Type',
      'Disruption Reason',
      'Delay (Hours)',
      'Jurisdiction',
      'AI Recommended Action',
      'Final Action Taken',
      'Manual Override',
      'Override Rationale',
      'Gross Liability (€)',
      'Recovery Cost (€)',
      'Net Savings (€)',
      'Regulation Cited',
      'Compliance Status',
      'Exception Flag',
      'Audit Risk Level',
      'Full Audit Narrative'
    ];

    const rows = filteredData.map(p => [
      p.name,
      p.pnr,
      p.cabin,
      p.tier,
      p.flightNumber,
      `${p.origin} → ${p.destination}`,
      p.disruptionType || 'Unknown',
      p.disruptionReason,
      p.delayHours.toFixed(1),
      p.jurisdiction,
      p.analysis.recommendedAction,
      p.overrideAction || p.analysis.recommendedAction,
      p.overrideAction ? 'Yes' : 'No',
      p.overrideRationale || 'N/A',
      p.analysis.legacy?.total.toFixed(2) || '0.00',
      p.analysis.aeroAgentCost.toFixed(2),
      p.analysis.netSavings.toFixed(2),
      narrativeCache[p.uid]?.regulationCited || 'N/A',
      narrativeCache[p.uid]?.complianceStatus || 'Not Generated',
      narrativeCache[p.uid]?.exceptionFlag ? 'Yes' : 'No',
      narrativeCache[p.uid]?.auditRiskLevel || 'N/A',
      (narrativeCache[p.uid]?.narrative || 'Not generated').replace(/"/g, '""').substring(0, 500)
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const processedData = useMemo(() => {
    return passengers.map(p => ({
      ...p,
      analysis: computeEngineLocal(p)
    }));
  }, [passengers]);

  const filteredData = useMemo(() => {
    return processedData.filter(p => {
      const searchStr = `${p.pnr} ${p.name} ${p.flightNumber} ${p.origin} ${p.destination} ${p.disruptionReason}`.toLowerCase();
      const matchesSearch = search === '' || searchStr.includes(search.toLowerCase());
      const matchesFlight = flightFilter.length === 0 || flightFilter.includes(p.flightNumber);
      const matchesDisruption = disruptionFilter.length === 0 || disruptionFilter.includes(p.disruptionReason);
      const matchesAction = actionFilter.length === 0 || actionFilter.includes(p.analysis.recommendedAction);
      const matchesOverride = !overrideOnly || (p.overrideAction !== undefined);
      return matchesSearch && matchesFlight && matchesDisruption && matchesAction && matchesOverride;
    });
  }, [processedData, search, flightFilter, disruptionFilter, actionFilter, overrideOnly]);

  const kpis = useMemo(() => {
    const totalLegacy = filteredData.reduce((acc, p) => acc + p.analysis.legacy.total, 0);
    const totalAero = filteredData.reduce((acc, p) => acc + p.analysis.aeroAgentCost, 0);
    const totalSavings = filteredData.reduce((acc, p) => acc + p.analysis.netSavings, 0);
    return {
      count: filteredData.length,
      legacy: totalLegacy,
      aero: totalAero,
      savings: totalSavings,
      savingsPercent: totalLegacy > 0 ? (totalSavings / totalLegacy) * 100 : 0
    };
  }, [filteredData]);

  const secondaryKpis = useMemo(() => {
    const total = filteredData.length || 1;
    const overrides = filteredData.filter(p => p.overrideAction).length;
    const auto = filteredData.filter(p => p.status === 'auto_processed').length;
    const accepted = filteredData.filter(p => !p.overrideAction).length;
    return {
      overrideRate: (overrides / total) * 100,
      avgCost: kpis.aero / total,
      automationRate: (auto / total) * 100,
      acceptanceRate: (accepted / total) * 100
    };
  }, [filteredData, kpis]);

  const actionDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(p => {
      const finalAction = p.overrideAction || p.analysis.recommendedAction;
      counts[finalAction] = (counts[finalAction] || 0) + 1;
    });
    const total = filteredData.length;
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0
    })).sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const processingModeData = useMemo(() => {
    const counts = { 'Automated': 0, 'High Touch Personal Support': 0, 'Escalations': 0 };
    filteredData.forEach(p => {
      if (p.overrideAction || p.isEscalated) {
        counts['Escalations']++;
      } else if (['Platinum Lumo', 'oneworld Emerald', 'Platinum', 'Gold'].includes(p.tier) || p.cabin === 'Business') {
        counts['High Touch Personal Support']++;
      } else {
        counts['Automated']++;
      }
    });
    const total = filteredData.length || 1;
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      percentage: (value / total) * 100
    }));
  }, [filteredData]);

  const financialComparisonData = [
    { name: 'Gross Exposure', value: kpis.legacy, color: '#be123c' },
    { name: 'Recovery Cost', value: kpis.aero, color: '#4f46e5' },
    { name: 'Net Savings', value: kpis.savings, color: '#059669' }
  ];

  const overrideImpactData = useMemo(() => {
    const aiCases = filteredData.filter(p => !p.overrideAction);
    const overrideCases = filteredData.filter(p => p.overrideAction);
    const aiAvg = aiCases.length > 0 ? aiCases.reduce((acc, p) => acc + p.analysis.netSavings, 0) / aiCases.length : 0;
    const overrideAvg = overrideCases.length > 0 ? overrideCases.reduce((acc, p) => acc + p.analysis.netSavings, 0) / overrideCases.length : 0;
    return [
      { name: 'AI Recommended', avgSavings: Math.round(aiAvg) },
      { name: 'Manual Override', avgSavings: Math.round(overrideAvg) }
    ];
  }, [filteredData]);

  const ACTION_COLORS: Record<string, string> = {
    'Priority Concierge Triage': '#92400e',
    'Original Flight Maintained + Notification Only': '#9ca3af',
    'Original Flight Maintained + Lounge Access Issued': '#059669',
    'Original Flight Maintained + Meal Voucher Issued': '#3b82f6',
    'Same Metal Recovery + Hotel & Meal Vouchers': '#8b5cf6',
    'Partner Metal Recovery + Hotel & Meal Vouchers': '#f97316',
    'Interline Metal Recovery + Hotel & Meal Vouchers': '#be123c',
    'Manual Override': '#64748b'
  };

  const MODE_COLORS: Record<string, string> = {
    'Automated': '#059669',
    'High Touch Personal Support': '#4f46e5',
    'Escalations': '#be123c'
  };

  const uniqueFlights = Array.from(new Set(processedData.map(p => p.flightNumber))).sort() as string[];
  const disruptionTypes = ['Crew Scheduling', 'Late Inbound', 'Weather', 'ATC', 'Technical'];
  const actionTypes = [
    'Priority Concierge Triage',
    'Original Flight Maintained + Notification Only',
    'Original Flight Maintained + Lounge Access Issued',
    'Original Flight Maintained + Meal Voucher Issued',
    'Same Metal Recovery + Hotel & Meal Vouchers',
    'Partner Metal Recovery + Hotel & Meal Vouchers',
    'Interline Metal Recovery + Hotel & Meal Vouchers',
    'Manual Override'
  ];

  return (
    <div className="max-w-[1600px] mx-auto">
      <SubNav active={activeSubTab} onChange={setActiveSubTab} />

      {activeSubTab === 'dashboard' ? (
        <CFODashboard
          kpis={kpis}
          secondaryKpis={secondaryKpis}
          actionDistribution={actionDistribution}
          processingModeData={processingModeData}
          financialComparisonData={financialComparisonData}
          ACTION_COLORS={ACTION_COLORS}
          MODE_COLORS={MODE_COLORS}
          narrativeCache={narrativeCache}
          filteredData={filteredData}
        />
      ) : (
        <>
          {/* Summary Bar */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-#111827 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all -translate-y-0.5 hover:-translate-y-1">
              <div className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1">Total Disruptions</div>
              <div className="text-2xl font-bold text-[#F9FAFB]">{filteredData.length}</div>
            </div>
            <div className="bg-#111827 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all -translate-y-0.5 hover:-translate-y-1">
              <div className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1">Total Liability</div>
              <div className="text-2xl font-bold text-red-400">€{filteredData.reduce((acc, p) => acc + p.analysis.legacy.total, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="bg-#111827 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all -translate-y-0.5 hover:-translate-y-1">
              <div className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1">AI Narratives</div>
              <div className="text-2xl font-bold text-indigo-400">{Object.keys(narrativeCache).length}</div>
            </div>
            <div className="bg-#111827 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all -translate-y-0.5 hover:-translate-y-1">
              <div className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1">Exceptions Flagged</div>
              <div className="text-2xl font-bold text-amber-400">{Object.values(narrativeCache).filter((n: any) => n.exceptionFlag).length}</div>
            </div>
          </div>

          <AuditReview
            search={search}
            setSearch={setSearch}
            isFiltersOpen={isFiltersOpen}
            setIsFiltersOpen={setIsFiltersOpen}
            uniqueFlights={uniqueFlights}
            flightFilter={flightFilter}
            setFlightFilter={setFlightFilter}
            disruptionTypes={disruptionTypes}
            disruptionFilter={disruptionFilter}
            setDisruptionFilter={setDisruptionFilter}
            actionTypes={actionTypes}
            actionFilter={actionFilter}
            setActionFilter={setActionFilter}
            overrideOnly={overrideOnly}
            setOverrideOnly={setOverrideOnly}
            filteredData={filteredData}
            processedData={processedData}
            expandedRows={expandedRows}
            toggleRow={toggleRow}
            narrativeCache={narrativeCache}
            expandedNarratives={expandedNarratives}
            narrativeLoading={narrativeLoading}
            loadNarrative={loadNarrative}
            exportToCSV={exportToCSV}
            cn={cn}
          />
        </>
      )}
    </div>
  );
};

// --- Gate Agent Triage Tab ---
const GateAgentTriage = ({ passengers, onUpdatePax }: { passengers: Passenger[], onUpdatePax: (id: string, updates: Partial<Passenger>, useUid?: boolean) => void }) => {
  const flights = useMemo(() => Array.from(new Set(passengers.map(p => p.flightNumber))).sort(), [passengers]);
  const [selectedFlight, setSelectedFlight] = useState(flights[0] || '');
  const [selectedPaxUid, setSelectedPaxUid] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<ActionType | null>(null);
  const [overrideRationale, setOverrideRationale] = useState('');
  const [comms, setComms] = useState({ whatsapp: true, email: true, print: false });
  const [activeFilter, setActiveFilter] = useState<'auto' | 'pending' | 'priority'>('priority');
  const [selectedPaxAnalysis, setSelectedPaxAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);

  const flightPax = useMemo(() => passengers.filter(p => p.flightNumber === selectedFlight), [passengers, selectedFlight]);

  // Auto-select first escalated/critical passenger on load
  React.useEffect(() => {
    if (!selectedPaxUid && flightPax.length > 0) {
      // Priority: escalated passenger
      const escalated = flightPax.find(p => p.isEscalated);
      if (escalated) {
        setSelectedPaxUid(escalated.uid);
        return;
      }
      // Secondary: critical distress
      const critical = flightPax.find(p => p.analysis?.distressLevel === 'Critical');
      if (critical) {
        setSelectedPaxUid(critical.uid);
        return;
      }
      // Default: first passenger
      setSelectedPaxUid(flightPax[0].uid);
    }
  }, [selectedFlight, flightPax, selectedPaxUid]);

  // Fetch AI analysis when passenger is selected
  React.useEffect(() => {
    if (selectedPaxUid) {
      setAiLoading(true);
      setAiError(false);
      setSelectedPaxAnalysis(null);
      const pax = passengers.find(p => p.uid === selectedPaxUid);
      if (pax) {
        computeEngineAI(pax)
          .then(analysis => {
            setSelectedPaxAnalysis(analysis);
            setAiLoading(false);
          })
          .catch((error) => {
            console.error('AI analysis failed, using rule engine:', error);
            setSelectedPaxAnalysis(computeEngineLocal(pax));
            setAiError(true);
            setAiLoading(false);
          });
      } else {
        setAiLoading(false);
      }
    } else {
      setSelectedPaxAnalysis(null);
      setAiLoading(false);
      setAiError(false);
    }
  }, [selectedPaxUid, passengers]);

  const isPriority = (p: Passenger) =>
    ['Platinum Lumo', 'oneworld Emerald', 'Platinum', 'Gold'].includes(p.tier) ||
    ['UMNR', 'WCHR', 'MEDA', 'BLND', 'DEAF'].includes(p.ssrCode) ||
    p.cabin === 'Business' ||
    p.isEscalated;

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
    const pnrs = Object.keys(pnrGroups);
    const filtered = pnrs.filter(pnr => {
      const group = pnrGroups[pnr];
      const hasPriority = group.some(p => isPriority(p));
      const allResolved = group.every(p => p.status === 'resolved' || p.status === 'auto_processed');
      const anyPending = group.some(p => p.status === 'pending_triage');

      switch (activeFilter) {
        case 'priority':
          return anyPending && hasPriority;
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

      // ESCALATED PASSENGERS FIRST (highest priority)
      const hasEscalatedA = groupA.some(p => p.isEscalated);
      const hasEscalatedB = groupB.some(p => p.isEscalated);
      if (hasEscalatedA && !hasEscalatedB) return -1;
      if (!hasEscalatedA && hasEscalatedB) return 1;

      // Use AI priority score if available, otherwise use local scoring
      const firstA = groupA[0];
      const firstB = groupB[0];

      if (firstA && firstB && selectedPaxAnalysis) {
        const scoreA = firstA.uid === selectedPaxUid && selectedPaxAnalysis.aiPriorityScore ? selectedPaxAnalysis.aiPriorityScore : null;
        const scoreB = firstB.uid === selectedPaxUid && selectedPaxAnalysis.aiPriorityScore ? selectedPaxAnalysis.aiPriorityScore : null;

        if (scoreA !== null && scoreB !== null) {
          return scoreB - scoreA;
        }
      }

      const score = (group: Passenger[]) => {
        if (group.some(p => p.ssrCode === 'UMNR' || p.ssrCode === 'WCHR')) return 4;
        if (group.some(p => ['Platinum Lumo', 'oneworld Emerald', 'Platinum', 'Gold', 'Business'].includes(p.tier) || p.cabin === 'Business')) return 3;
        if (group.some(p => p.partySize > 1)) return 2;
        return 1;
      };

      return score(groupB) - score(groupA);
    });
  }, [pnrGroups, activeFilter, isPriority]);

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

    const allOptions: { action: ActionType, status: 'Recommended' | 'Available' | 'Restricted' | 'Requires Approval', description: string, inclusions: string[] }[] = [
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
    })).sort((a, b) => (a.status === 'Recommended' ? -1 : 1));
  }, [selectedPax]);

  const handleExecute = async () => {
    if (selectedPaxUid && selectedPax && selectedPaxAnalysis) {
      const updates: Partial<Passenger> = { status: 'resolved' };
      const recommendedAction = recoveryOptions.find(o => o.status === 'Recommended')?.action;
      const actionToExecute = selectedOption || recommendedAction || selectedPaxAnalysis.recommendedAction;

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
      {/* Demo Info Banner */}
      <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-lg p-3 flex items-start gap-3 text-sm text-indigo-200">
        <span className="text-lg">✦</span>
        <p>Select any passenger to trigger live Claude AI analysis</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-#111827 p-3 rounded-xl border border-gray-800 shadow-sm hover:border-gray-700 transition-all">
        <div>
          <h2 className="text-base font-bold text-[#F9FAFB] flex items-center gap-2">
            <Plane className="w-4.5 h-4.5 text-indigo-400" />
            Flight Triage Control
          </h2>
          <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-widest">Operational Recovery Queue</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Active Flight:</span>
          <div className="relative group">
            <select
              value={selectedFlight}
              onChange={(e) => {
                setSelectedFlight(e.target.value);
                setSelectedPaxUid(null);
              }}
              className="appearance-none bg-[#1F2937] border border-gray-700 text-[#F9FAFB] text-xs font-bold rounded-lg focus:ring-indigo-500/10 focus:border-indigo-500 block w-full pl-3 pr-8 py-2 cursor-pointer hover:border-gray-600 transition-colors uppercase tracking-wider"
            >
              {flights.map(f => (
                <option key={f} value={f}>{f} — {passengers.find(p => p.flightNumber === f)?.origin} to {passengers.find(p => p.flightNumber === f)?.destination}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#6B7280] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-indigo-400 transition-colors" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <KPICard
          label="Auto-Processed"
          value={kpis.auto.toString()}
          icon={CheckCircle2}
          color="bg-emerald-600"
          subtitle="Engine Resolved"
          onClick={() => setActiveFilter('auto')}
          className={activeFilter === 'auto' ? "ring-2 ring-indigo-500 ring-offset-2" : ""}
        />
        <KPICard
          label="Pending Triage"
          value={kpis.pending.toString()}
          icon={Clock}
          color="bg-indigo-600"
          subtitle="Manual Review"
          onClick={() => setActiveFilter('pending')}
          className={activeFilter === 'pending' ? "ring-2 ring-indigo-500 ring-offset-2" : ""}
        />
        <KPICard
          label="High-Risk"
          value={kpis.highRisk.toString()}
          icon={AlertTriangle}
          color="bg-warning-crimson"
          subtitle="Special Handling"
          onClick={() => setActiveFilter('priority')}
          className={activeFilter === 'priority' ? "ring-2 ring-indigo-500 ring-offset-2" : ""}
        />
        <div className="bg-#111827 rounded-xl p-3.5 border border-gray-800 shadow-sm flex flex-col justify-between h-full group hover:border-gray-700 transition-all duration-200 min-h-[88px] -translate-y-0.5 hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Pax Responses</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <div className="text-center">
              <p className="text-[15px] font-bold text-emerald-400 tabular-nums leading-none">{kpis.accepted}</p>
              <p className="text-[8px] text-[#6B7280] uppercase font-bold tracking-wider mt-1">Accepted</p>
            </div>
            <div className="text-center border-l border-gray-800">
              <p className="text-[15px] font-bold text-amber-400 tabular-nums leading-none">{kpis.escalated}</p>
              <p className="text-[8px] text-[#6B7280] uppercase font-bold tracking-wider mt-1">Escalated</p>
            </div>
            <div className="text-center border-l border-gray-800">
              <p className="text-[15px] font-bold text-[#F9FAFB] tabular-nums leading-none">{kpis.noResponse}</p>
              <p className="text-[8px] text-[#6B7280] uppercase font-bold tracking-wider mt-1">Pending</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-0 overflow-hidden flex flex-col h-[640px] bg-#111827 border-gray-800">
            <div className="p-3 bg-[#1F2937] border-b border-gray-800 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Clipboard className="w-3.5 h-3.5 text-[#6B7280]" />
                <span className="font-bold text-[11px] text-[#F9FAFB] uppercase tracking-widest">Triage Queue</span>
              </div>
              <Badge variant="indigo" className="min-w-0 px-2 bg-indigo-500/20 text-indigo-300 border-indigo-500/30">{sortedPnrs.length} PNRs</Badge>
            </div>

            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {sortedPnrs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-[#6B7280] p-8 text-center">
                    <CheckCircle2 className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm font-medium">Queue Clear</p>
                    <p className="text-xs opacity-60">All exceptions for this flight have been triaged.</p>
                  </div>
                ) : (
                  sortedPnrs.map(pnr => {
                    const group = pnrGroups[pnr];
                    const p = group[0];
                    const analysis = computeEngineLocal(p);
                    const isSelected = selectedPaxUid === p.uid;
                    const isResolved = group.every(p => p.status === 'resolved' || p.status === 'auto_processed');
                    const isAuto = group.every(p => p.status === 'auto_processed');
                    const hasPriority = group.some(p => isPriority(p));

                    return (
                      <motion.div
                        key={p.uid}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        onClick={() => setSelectedPaxUid(p.uid)}
                        className={cn(
                          "p-4 border-b border-gray-800 cursor-pointer transition-all relative group",
                          isSelected ? "bg-indigo-500/20 border-l-4 border-indigo-500" : "hover:bg-[#1F2937]/50 border-l-4 border-transparent"
                        )}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#F9FAFB]">{p.pnr}</span>
                            {group.length > 1 && (
                              <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 border border-indigo-500/30">
                                <Users className="w-3 h-3" /> +{group.length - 1}
                              </span>
                            )}
                          </div>
                          {isResolved ? (
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">
                                  {isAuto ? analysis.recommendedAction : (p.overrideAction || analysis.recommendedAction)}
                                </span>
                              </div>
                              <span className="text-[9px] text-gray-600 font-medium">Notified: 5m ago</span>
                            </div>
                          ) : (
                            <div className={cn(
                              "flex items-center gap-1.5 px-2 py-1 rounded-full border",
                              hasPriority ? "bg-rose-500/20 text-rose-400 border-rose-500/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                            )}>
                              <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", hasPriority ? "bg-rose-500" : "bg-amber-500")} />
                              <span className="text-[10px] font-bold uppercase tracking-wider">
                                {hasPriority ? "🔴 Pending Triage" : "🟠 Waiting Manual Handling"}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-[#F9FAFB]">{p.name}</p>
                            <p className="text-[10px] text-[#9CA3AF] font-medium mb-1">{getOperationalReason(p)}</p>
                            <div className="flex flex-wrap gap-1">
                              {getTriageReasons(p).map((reason, idx) => (
                                <span key={idx} className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-tight", reason.color)}>
                                  {reason.label}
                                </span>
                              ))}
                            </div>
                          </div>
                          <ChevronRight className={cn("w-4 h-4 text-[#6B7280] transition-transform", isSelected && "translate-x-1 text-indigo-400")} />
                        </div>
                      </motion.div>
                    );
                  })
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
                className="h-full flex flex-col items-center justify-center text-[#6B7280] bg-[#1F2937]/50 rounded-xl border-2 border-dashed border-gray-700 p-12 text-center"
              >
                <div className="w-16 h-16 bg-#111827 rounded-2xl shadow-sm border border-gray-700 flex items-center justify-center mb-6">
                  <LayoutDashboard className="w-8 h-8 opacity-20" />
                </div>
                <h3 className="text-lg font-bold text-[#F9FAFB] mb-2">Select a PNR to Triage</h3>
                <p className="text-sm max-w-xs text-[#9CA3AF]">Choose a passenger from the queue to begin the recovery execution workflow.</p>
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
                        <p className="font-bold">{selectedPax.status === 'auto_processed' ? 'Auto-Processed Successfully' : 'Recovery Executed Successfully'}</p>
                        <p className="text-xs text-emerald-100">Passenger notified via {comms.whatsapp ? 'WhatsApp' : ''} {comms.email ? '& Email' : ''}.</p>
                      </div>
                    </div>
                    <Badge className="bg-white/20 text-white border-none">LOCKED</Badge>
                  </motion.div>
                )}

                {/* Handoff Briefing Panel for Escalated Passengers */}
                {selectedPax?.isEscalated && selectedPax?.handoffBriefing && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-indigo-500/5 border-l-2 border-indigo-500 rounded-xl p-6 space-y-4"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-lg text-indigo-400">✦</span>
                      <h3 className="text-lg font-bold text-indigo-300">Agent Briefing — Escalated Passenger</h3>
                    </div>

                    {/* Summary */}
                    <div className="bg-[#1F2937] p-4 rounded-lg">
                      <p className="text-sm leading-relaxed text-[#F9FAFB]">{selectedPax.handoffBriefing.summary}</p>
                    </div>

                    {/* Passenger Concern */}
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1">What they really need:</p>
                        <p className="text-sm text-[#F9FAFB]">{selectedPax.handoffBriefing.passengerConcern}</p>
                      </div>

                      {/* Emotional State + Urgency */}
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1">Emotional State</p>
                          <span className="inline-block px-3 py-1 bg-gray-800/50 text-[#F9FAFB] rounded text-sm font-semibold border border-gray-700">
                            {selectedPax.handoffBriefing.emotionalState}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1">Urgency</p>
                          <span className={cn("inline-block px-3 py-1 rounded text-sm font-semibold border", {
                            'bg-red-500/20 text-red-400 border-red-500/30': selectedPax.handoffBriefing.urgencyLevel === 'Critical',
                            'bg-orange-500/20 text-orange-400 border-orange-500/30': selectedPax.handoffBriefing.urgencyLevel === 'High',
                            'bg-yellow-500/20 text-yellow-400 border-yellow-500/30': selectedPax.handoffBriefing.urgencyLevel === 'Medium',
                            'bg-green-500/20 text-green-400 border-green-500/30': selectedPax.handoffBriefing.urgencyLevel === 'Low'
                          })}>
                            {selectedPax.handoffBriefing.urgencyLevel}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* What Was Arranged */}
                    <div>
                      <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">What was arranged:</p>
                      <ul className="space-y-1">
                        {selectedPax.handoffBriefing.whatWasArranged.map((action, idx) => (
                          <li key={idx} className="text-sm text-[#F9FAFB] flex items-center gap-2">
                            <span className="text-indigo-400">•</span> {action}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Sensitive Issues */}
                    {selectedPax.handoffBriefing.sensitiveIssues.length > 0 && (
                      <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                        <p className="text-xs font-bold text-red-300 uppercase tracking-wider mb-2">🚩 Sensitive Issues:</p>
                        <ul className="space-y-1">
                          {selectedPax.handoffBriefing.sensitiveIssues.map((issue, idx) => (
                            <li key={idx} className="text-sm text-red-200">• {issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Suggested Opening */}
                    <div className="bg-indigo-500/5 border border-indigo-500/30 rounded-lg p-4 italic border-l-2 border-l-indigo-500">
                      <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">✦ Start the conversation with:</p>
                      <p className="text-sm text-indigo-100">"{selectedPax.handoffBriefing.suggestedOpeningLine}"</p>
                    </div>

                    {/* Recommended Action */}
                    <div>
                      <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">Recommended next step:</p>
                      <p className="text-sm text-[#F9FAFB]">{selectedPax.handoffBriefing.recommendedAction}</p>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-indigo-500/20">
                      <p className="text-xs text-[#6B7280]">Est. resolution: {selectedPax.handoffBriefing.estimatedResolutionTime}</p>
                      <p className="text-xs text-gray-600">Powered by Claude · Anthropic</p>
                    </div>

                    {/* Begin Conversation Button */}
                    <button
                      onClick={() => {
                        // Dismiss briefing panel - we could set a state flag here if needed
                        // The recovery panel below will show after this
                      }}
                      className="w-full mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold transition-colors"
                    >
                      Begin Conversation
                    </button>
                  </motion.div>
                )}

                <Card className="space-y-6 relative overflow-hidden bg-#111827 border-gray-800">
                  <div className="bg-indigo-500/20 p-4 rounded-xl border border-indigo-500/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-300" />
                        <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">PNR Group: {selectedPax.pnr}</span>
                      </div>
                      <Badge variant="indigo" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">{selectedPaxGroup?.length} Passengers</Badge>
                    </div>
                    <div className="space-y-2">
                      {selectedPaxGroup?.map(p => (
                        <div key={p.uid} className="flex items-center justify-between bg-[#1F2937] p-2 rounded-lg border border-indigo-500/20">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#1F2937] flex items-center justify-center text-[10px] font-bold text-[#9CA3AF] border border-gray-700">
                              {p.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#F9FAFB]">{p.name}</p>
                              <div className="flex gap-1 mt-0.5">
                                <p className="text-[9px] text-[#9CA3AF]">{p.tier} • {p.cabin}</p>
                                {p.ssrCode && <span className="text-[8px] font-bold text-rose-400 bg-rose-500/20 px-1 rounded border border-rose-500/30">Special Handling</span>}
                                {p.isEscalated && <span className="text-[8px] font-bold text-amber-400 bg-amber-500/20 px-1 rounded border border-amber-500/30">Escalated</span>}
                                {p.chatState === 'accepted' && <span className="text-[8px] font-bold text-emerald-400 bg-emerald-500/20 px-1 rounded border border-emerald-500/30">Responded</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {isPriority(p) && <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[8px]">Premium</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedPax?.isEscalated && selectedPax?.escalationReason && (
                      <div className="mt-3 pt-3 border-t border-indigo-500/20">
                        <p className="text-[9px] font-bold text-amber-300 uppercase tracking-wider mb-1">Escalation Reason:</p>
                        <p className="text-[10px] text-[#F9FAFB]">{selectedPax.escalationReason}</p>
                        {selectedPax?.escalatedAt && (
                          <p className="text-[8px] text-[#6B7280] mt-1">Escalated at: {new Date(selectedPax.escalatedAt).toLocaleTimeString()}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {aiError && (
                    <div className="text-[10px] text-[#9CA3AF] italic">
                      AI analysis unavailable — showing standard recommendation
                    </div>
                  )}

                  {selectedPaxAnalysis?.aiPowered && !aiLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-500/30 rounded-lg p-4 space-y-4"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-indigo-600 dark:text-indigo-400 text-lg">✦</span>
                        <h4 className="text-[11px] font-bold font-display text-indigo-700 dark:text-indigo-300 uppercase tracking-widest">AI Recovery Analysis</h4>
                      </div>

                      {/* Justification Section */}
                      <div className="bg-white dark:bg-[#1F2937] border border-indigo-200 dark:border-indigo-500/20 rounded-lg p-3">
                        <p className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-widest mb-2">Gate Agent Reasoning</p>
                        <p className="text-sm text-gray-700 dark:text-[#9CA3AF] leading-relaxed">{selectedPaxAnalysis.aiJustification}</p>
                      </div>

                      {/* Distress & Regulatory Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        {selectedPaxAnalysis.aiDistressLevel && (
                          <div>
                            <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-1">Distress Level</p>
                            <div className={cn('px-3 py-2 rounded-lg border text-[11px] font-bold text-center',
                              selectedPaxAnalysis.aiDistressLevel === 'Critical' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                              selectedPaxAnalysis.aiDistressLevel === 'High' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                              selectedPaxAnalysis.aiDistressLevel === 'Medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                              'bg-green-500/20 text-green-400 border-green-500/30'
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
                            <div className="px-3 py-2 rounded-lg border border-gray-700 bg-gray-800/50 text-[11px] font-bold text-gray-300 text-center">
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
                          <p className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest mb-2">When speaking to the passenger:</p>
                          <ul className="space-y-1.5">
                            {selectedPaxAnalysis.aiAgentTalkingPoints.map((point: string, idx: number) => (
                              <li key={idx} className="text-[9px] text-gray-300 leading-relaxed flex gap-2">
                                <span className="text-indigo-400 font-bold">•</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Flagged Issues Section */}
                      {selectedPaxAnalysis.aiFlaggedIssues && selectedPaxAnalysis.aiFlaggedIssues.length > 0 && (
                        <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg p-3">
                          <p className="text-[9px] font-bold text-amber-300 uppercase tracking-widest mb-2">⚠ Flagged Issues</p>
                          <ul className="space-y-1">
                            {selectedPaxAnalysis.aiFlaggedIssues.map((issue: string, idx: number) => (
                              <li key={idx} className="text-[8px] text-amber-200 leading-relaxed flex gap-2">
                                <span>•</span>
                                <span>{issue}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <p className="text-[8px] text-gray-600 italic text-center pt-2 border-t border-indigo-500/20">✦ Powered by Claude · Anthropic</p>
                    </motion.div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#6B7280]">
                      <Info className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Operational Rationale</span>
                    </div>
                    <p className="text-sm text-[#9CA3AF] leading-relaxed font-medium">
                      {selectedPaxAnalysis?.rationale || 'Loading...'}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#6B7280]">
                        <Zap className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Recovery Options</span>
                      </div>
                      <span className="text-[10px] text-[#6B7280] font-medium italic">
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
                        <span className="text-sm font-medium text-indigo-300">✦ Claude is thinking...</span>
                      </motion.div>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                      {(() => {
                        const recommendedAction = recoveryOptions.find(o => o.status === 'Recommended')?.action;
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
                                  : "bg-#1F2937 border-gray-700 hover:border-gray-600"
                              )}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-[#F9FAFB]">{opt.action}</span>
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
                              <p className="text-xs text-[#9CA3AF] leading-relaxed mb-2">{opt.description}</p>
                              <div className="flex gap-2">
                                {opt.inclusions.map(inc => (
                                  <span key={inc} className="text-[8px] font-bold text-[#9CA3AF] bg-[#0D1424] px-1.5 py-0.5 rounded border border-gray-700 uppercase tracking-tighter">
                                    {inc}
                                  </span>
                                ))}
                              </div>

                              {isSelected && (
                                <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                                  <CheckCircle2 className="w-3 h-3 text-white" />
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  <div className="bg-[#1F2937] border border-gray-800 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-gray-800 bg-[#0D1424]/50 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Execution Summary</span>
                      {selectedOption && selectedPaxAnalysis && selectedOption !== selectedPaxAnalysis.recommendedAction && (
                        <Badge variant="amber" className="animate-pulse bg-amber-500/20 text-amber-300 border-amber-500/30">Manual Override Active</Badge>
                      )}
                    </div>
                    {(() => {
                      const recommendedAction = recoveryOptions.find(o => o.status === 'Recommended')?.action;
                      const currentAction = selectedOption || recommendedAction || (selectedPaxAnalysis?.recommendedAction);
                      const currentLiability = selectedPaxAnalysis?.liabilityEngine;
                      const isOverride = selectedOption && selectedOption !== recommendedAction;

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-800">
                          <div className="p-4 space-y-3">
                            <div className="flex items-center gap-2 text-indigo-400">
                              <PlaneTakeoff className="w-4 h-4" />
                              <span className="text-xs font-bold uppercase tracking-wider">Itinerary</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs">
                                <span className="text-[#6B7280]">New ETD</span>
                                <span className="font-bold text-[#F9FAFB]">{currentLiability?.itinerary.newETD}</span>
                              </div>
                              {currentLiability?.itinerary.newFlight && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-[#6B7280]">New Flight</span>
                                  <span className="font-bold text-[#F9FAFB]">{currentLiability.itinerary.newFlight}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="p-4 space-y-3">
                            <div className="flex items-center gap-2 text-emerald-400">
                              <Smartphone className="w-4 h-4" />
                              <span className="text-xs font-bold uppercase tracking-wider">Care Included</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs">
                                <span className="text-[#6B7280]">Hotel</span>
                                <span className="font-bold text-[#F9FAFB] truncate max-w-[100px]">
                                  {currentLiability?.dutyOfCare.hotel.eligible ? (currentLiability.dutyOfCare.hotel.provider || 'Clarion HEL') : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-[#6B7280]">Meals</span>
                                <span className="font-bold text-[#F9FAFB]">
                                  {currentLiability?.dutyOfCare.meals.eligible ? `€${currentLiability.dutyOfCare.meals.voucherValue} Voucher` : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="p-4 space-y-3">
                            <div className="flex items-center gap-2 text-amber-400">
                              <AlertTriangle className="w-4 h-4" />
                              <span className="text-xs font-bold uppercase tracking-wider">Action Required</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-300">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Notify Passenger
                              </div>
                              {isOverride && (
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-300">
                                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Justification Required
                                </div>
                              )}
                              {currentAction === 'Manual Handling Required' && (
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-300">
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
                            <div className="flex items-center gap-2 text-amber-300">
                              <AlertTriangle className="w-4 h-4" />
                              <span className="text-xs font-bold uppercase tracking-wider">Reason for Override</span>
                            </div>
                            <textarea
                              value={overrideRationale}
                              onChange={(e) => setOverrideRationale(e.target.value)}
                              placeholder="Please provide a justification for audit purposes..."
                              className="w-full bg-[#1F2937] border border-amber-500/30 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 min-h-[80px] outline-none transition-all text-[#F9FAFB] placeholder:text-[#6B7280]"
                            />
                            <p className="text-[10px] text-amber-400 italic">This override will be visible to audit / CFO view.</p>
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
                                  ? "bg-gray-700 text-gray-400 cursor-not-allowed shadow-none"
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
                    <div className="pt-4 border-t border-gray-800">
                      <div className="bg-[#1F2937] rounded-xl p-4 border border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[#9CA3AF]">
                          <Clock className="w-5 h-5" />
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider">Action Logged</p>
                            <p className="text-[11px] text-[#6B7280]">Executed by Agent HEL-042 at {new Date().toLocaleTimeString()}</p>
                          </div>
                        </div>
                        <button className="text-indigo-400 font-bold text-xs hover:underline">View Full Audit Trail</button>
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

const PassengerExperience = ({ passengers, onUpdatePax }: { passengers: Passenger[], onUpdatePax: (id: string, updates: Partial<Passenger>, useUid?: boolean) => void }) => {
  const [selectedPax, setSelectedPax] = useState<Passenger | null>(null);
  const [whatsappMessage, setWhatsappMessage] = useState<any>(null);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; timestamp: string; stressSignals?: string[] }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [messageLoading, setMessageLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEscalated, setIsEscalated] = useState(false);
  const [conversationPhase, setConversationPhase] = useState<'message' | 'awaiting-action' | 'chat'>('message');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get the analysis for the selected passenger
  const selectedPaxAnalysis = selectedPax
    ? passengers.find(p => p.uid === selectedPax.uid)
    : null;

  // Auto-select first passenger with highest distress level on load
  useEffect(() => {
    if (!selectedPax && passengers.length > 0) {
      // Sort by distress level (Critical > High > Medium > Low)
      const distressOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
      const sortedByDistress = [...passengers].sort((a, b) => {
        const aScore = distressOrder[a.analysis?.distressLevel as keyof typeof distressOrder] || 0;
        const bScore = distressOrder[b.analysis?.distressLevel as keyof typeof distressOrder] || 0;
        return bScore - aScore;
      });
      if (sortedByDistress.length > 0) {
        setSelectedPax(sortedByDistress[0]);
      }
    }
  }, [passengers.length, selectedPax]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, whatsappMessage]);

  // Generate WhatsApp message when passenger is selected
  useEffect(() => {
    if (selectedPax && selectedPaxAnalysis && !whatsappMessage) {
      loadWhatsAppMessage();
    }
  }, [selectedPax]);

  const loadWhatsAppMessage = async () => {
    if (!selectedPax || !selectedPaxAnalysis) return;

    setMessageLoading(true);
    setError(null);
    setConversationPhase('message');

    try {
      // Call Claude API to generate WhatsApp message
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useCase: 'whatsapp-message',
          payload: {
            passengerContext: {
              pnr: selectedPax.pnr,
              name: selectedPax.name,
              cabin: selectedPax.cabin,
              tier: selectedPax.tier,
              loyaltyTier: selectedPax.loyaltyTier,
              ssrCode: selectedPax.ssrCode,
              flightNumber: selectedPax.flightNumber,
              origin: selectedPax.origin,
              destination: selectedPax.destination,
              disruptionType: selectedPax.disruptionType,
              disruptionCause: selectedPax.disruptionCause,
              delayHours: selectedPax.delayHours || 0,
              delayMinutes: Math.round((selectedPax.delayHours || 0) * 60),
              travelPartySize: selectedPax.travelPartySize,
              jurisdiction: selectedPax.jurisdiction
            },
            recoveryDecision: {
              primaryAction: selectedPaxAnalysis.recommendedAction,
              distressLevel: selectedPaxAnalysis.distressLevel,
              goodwillAction: selectedPaxAnalysis.goodwillAction,
              recoveryDecision: selectedPaxAnalysis.recoveryDecision
            }
          }
        })
      });

      if (response.ok) {
        const { data } = await response.json();
        setWhatsappMessage(data);
        setConversationPhase('awaiting-action');
      } else {
        throw new Error('Failed to generate message');
      }
    } catch (err) {
      console.error('Failed to load WhatsApp message:', err);
      // Don't show error, just proceed to chat
      setConversationPhase('chat');
      loadInitialChatMessage();
    } finally {
      setMessageLoading(false);
    }
  };

  const loadInitialChatMessage = async () => {
    if (!selectedPax) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useCase: 'passenger-chat',
          payload: {
            message: 'INIT',
            passengerContext: {
              pnr: selectedPax.pnr,
              name: selectedPax.name,
              flightNumber: selectedPax.flightNumber,
              origin: selectedPax.origin,
              destination: selectedPax.destination,
              disruptionType: selectedPax.disruptionType,
              delayHours: selectedPax.delayHours
            }
          }
        })
      });

      if (!response.ok) throw new Error('Failed to load initial message');

      const { data } = await response.json();
      setMessages([{
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
        stressSignals: data.stressSignals
      }]);
    } catch (err) {
      setError('Unable to connect to assistant. Please refresh and try again.');
      console.error('Failed to load initial message:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionButton = (action: 'got-it' | 'need-help') => {
    if (action === 'got-it') {
      // Show closing sequence
      setMessages([
        {
          role: 'assistant',
          content: whatsappMessage.message,
          timestamp: new Date().toISOString()
        },
        {
          role: 'user',
          content: '✅ Got it, thank you',
          timestamp: new Date().toISOString()
        },
        {
          role: 'assistant',
          content: 'Perfect! We appreciate your patience. Safe travels!',
          timestamp: new Date().toISOString()
        }
      ]);
      setConversationPhase('chat');
    } else if (action === 'need-help') {
      // Switch to chat phase
      setMessages([
        {
          role: 'assistant',
          content: whatsappMessage.message,
          timestamp: new Date().toISOString()
        },
        {
          role: 'user',
          content: '💬 I need help',
          timestamp: new Date().toISOString()
        }
      ]);
      setConversationPhase('chat');
      // Load follow-up message
      loadFollowUpChatMessage();
    }
  };

  const loadFollowUpChatMessage = async () => {
    if (!selectedPax) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useCase: 'passenger-chat',
          payload: {
            message: 'I need help',
            passengerContext: {
              pnr: selectedPax.pnr,
              name: selectedPax.name,
              flightNumber: selectedPax.flightNumber,
              origin: selectedPax.origin,
              destination: selectedPax.destination,
              disruptionType: selectedPax.disruptionType,
              delayHours: selectedPax.delayHours
            }
          }
        })
      });

      if (!response.ok) throw new Error('API error');

      const { data } = await response.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
        stressSignals: data.stressSignals
      }]);
    } catch (err) {
      console.error('Failed to load follow-up message:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !selectedPax || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');

    // Add user message to chat
    const newMessages = [...messages, {
      role: 'user' as const,
      content: userMessage,
      timestamp: new Date().toISOString()
    }];
    setMessages(newMessages);

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useCase: 'passenger-chat',
          payload: {
            message: userMessage,
            passengerContext: {
              pnr: selectedPax.pnr,
              name: selectedPax.name,
              flightNumber: selectedPax.flightNumber,
              origin: selectedPax.origin,
              destination: selectedPax.destination,
              disruptionType: selectedPax.disruptionType,
              delayHours: selectedPax.delayHours
            }
          }
        })
      });

      if (!response.ok) throw new Error('API error');

      const { data } = await response.json();

      // Add assistant message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
        stressSignals: data.stressSignals
      }]);

      // Handle escalation
      if (data.escalate) {
        // Step 1: Show escalation banner (state already set)
        setIsEscalated(true);

        // Step 2: Show typing indicator in chat (isLoading already set)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'I have let our team know about your situation. A gate agent will be with you shortly — they already have all your details and will not ask you to repeat yourself.',
          timestamp: new Date().toISOString()
        }]);

        // Step 3: Generate handoff briefing
        try {
          const briefingResponse = await fetch('/api/claude', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              useCase: 'escalation-handoff',
              payload: {
                passenger: {
                  pnr: selectedPax.pnr,
                  name: selectedPax.name,
                  cabin: selectedPax.cabin,
                  tier: selectedPax.tier,
                  loyaltyTier: selectedPax.loyaltyTier,
                  ssrCode: selectedPax.ssrCode,
                  flightNumber: selectedPax.flightNumber,
                  origin: selectedPax.origin,
                  destination: selectedPax.destination,
                  disruptionType: selectedPax.disruptionType,
                  disruptionCause: selectedPax.disruptionCause,
                  delayMinutes: Math.round((selectedPax.delayHours || 0) * 60),
                  jurisdiction: selectedPax.jurisdiction,
                  travelPartySize: selectedPax.travelPartySize,
                  hasInfant: selectedPax.hasInfant
                },
                recoveryArranged: {
                  primaryAction: selectedPaxAnalysis?.analysis?.recommendedAction || 'NOTIFICATION_ONLY',
                  mealVoucher: selectedPaxAnalysis?.analysis?.goodwillAction?.mealVoucherOffered || false,
                  loungeAccess: selectedPaxAnalysis?.analysis?.goodwillAction?.loungeAccessOffered || false,
                  hotelArranged: selectedPaxAnalysis?.analysis?.recoveryDecision?.hotelRequired || false,
                  rebookEligible: selectedPaxAnalysis?.analysis?.recoveryDecision?.rebookEligible || false
                },
                conversationHistory: newMessages,
                stressSignals: data.stressSignals,
                escalationReason: data.escalationReason,
                aiDistressLevel: selectedPaxAnalysis?.analysis?.aiDistressLevel,
                aiFlaggedIssues: selectedPaxAnalysis?.analysis?.aiFlaggedIssues
              }
            })
          });

          let handoffBriefing = null;
          if (briefingResponse.ok) {
            const briefingData = await briefingResponse.json();
            handoffBriefing = briefingData.data;
          }

          // Step 4: Update passenger state with escalation data
          onUpdatePax(selectedPax.uid, {
            isEscalated: true,
            escalationReason: data.escalationReason,
            escalatedAt: new Date().toISOString(),
            handoffBriefing
          }, true);

          // Step 5: Disable input and show waiting message
          setInputValue('');

          // Step 6: Show agent joined message after 3 second delay
          setTimeout(() => {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: '✓ Agent Connected',
              timestamp: new Date().toISOString()
            }]);

            // Step 7: Show suggested opening line from handoff briefing
            if (handoffBriefing) {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: handoffBriefing.suggestedOpeningLine,
                timestamp: new Date().toISOString()
              }]);
            }
          }, 3000);
        } catch (handoffErr) {
          console.error('Failed to generate handoff briefing:', handoffErr);
          // Still update passenger with escalation even if briefing fails
          onUpdatePax(selectedPax.uid, {
            isEscalated: true,
            escalationReason: data.escalationReason,
            escalatedAt: new Date().toISOString()
          }, true);

          // Show agent joined without briefing
          setTimeout(() => {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: '✓ Agent Connected\n\nHi ' + selectedPax.name.split(' ')[0] + ', I have your full situation in front of me. How can I help you today?',
              timestamp: new Date().toISOString()
            }]);
          }, 3000);
        }
      }
    } catch (err) {
      setError('Our assistant is temporarily unavailable. Please speak to a gate agent for assistance.');
      // Remove the user message on error
      setMessages(newMessages.slice(0, -1));
      console.error('Failed to send message:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-[#0D1424] to-[#0A0F1E] p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-[#F9FAFB] mb-4">Passenger Support</h2>

        {/* Passenger Selector */}
        <div className="flex gap-2 items-center mb-4">
          <label className="text-sm font-semibold text-[#9CA3AF]">Select Passenger:</label>
          <select
            value={selectedPax?.uid || ''}
            onChange={(e) => {
              const pax = passengers.find(p => p.uid === e.target.value);
              if (pax) {
                setSelectedPax(pax);
                setWhatsappMessage(null);
                setMessages([]);
                setIsEscalated(false);
                setError(null);
                setConversationPhase('message');
              }
            }}
            className="flex-1 px-3 py-2 border border-gray-700 rounded-lg text-sm bg-[#111827] text-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="">-- Choose a passenger --</option>
            {passengers.map(pax => (
              <option key={pax.uid} value={pax.uid}>
                {pax.name} ({pax.pnr}) - {pax.flightNumber}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedPax ? (
        <>
          {/* Flight Info Header */}
          <div className="bg-indigo-600 text-white rounded-lg p-4 mb-4 shadow-lg shadow-indigo-600/20">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-indigo-200 font-semibold">AeroAgent Assistant</p>
                <h3 className="text-lg font-bold mt-1">{selectedPax.flightNumber}</h3>
                <p className="text-sm text-indigo-200">{selectedPax.origin} → {selectedPax.destination}</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-indigo-200">Status</p>
                <p className="font-bold text-lg">● Online</p>
              </div>
            </div>
          </div>

          {/* Escalation Banner */}
          {isEscalated && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-500/20 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-lg mb-4 flex items-center gap-2"
            >
              <span className="text-lg">🔴</span>
              <span className="font-semibold">Connecting you to a gate agent...</span>
            </motion.div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* Chat/Message Area */}
          <div className="flex-1 overflow-y-auto mb-4 space-y-4 bg-[#111827] rounded-lg p-4 border border-gray-800">
            {conversationPhase === 'message' && messageLoading ? (
              <div className="flex justify-center items-center h-full">
                <div className="text-center">
                  <div className="flex gap-1 justify-center mb-3">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <p className="text-[#6B7280] text-sm">Generating message...</p>
                </div>
              </div>
            ) : conversationPhase === 'message' && whatsappMessage ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-start gap-3"
              >
                {/* Message Bubble */}
                <div className="max-w-md bg-indigo-500/5 text-[#F9FAFB] rounded-lg rounded-bl-none px-4 py-3 border-l-2 border-l-indigo-500 border border-indigo-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-indigo-400">✦ Claude Assistant</span>
                    <span className="text-xs text-gray-500">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-200">{whatsappMessage.message.replace(/\[QR CODE PLACEHOLDER\]/g, '[QR]')}</p>

                  {/* QR Code Placeholder */}
                  {whatsappMessage.qrCodeRequired && (
                    <div className="mt-3 p-3 border-2 border-dashed border-indigo-500/50 rounded bg-indigo-500/10 text-center">
                      <p className="text-xs text-indigo-300">📱 [QR CODE PLACEHOLDER]</p>
                      <p className="text-[10px] text-indigo-300/70 mt-1">Scan to access</p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 w-full mt-4">
                  <button
                    onClick={() => handleActionButton('got-it')}
                    className="flex-1 px-4 py-2 bg-green-600/20 border border-green-600/30 text-green-300 rounded-lg hover:bg-green-600/30 transition-all text-sm font-medium"
                  >
                    ✅ Got it, thank you
                  </button>
                  {whatsappMessage.messageType !== 'notification_only' && (
                    <button
                      onClick={() => handleActionButton('need-help')}
                      className="flex-1 px-4 py-2 bg-indigo-600/20 border border-indigo-600/30 text-indigo-300 rounded-lg hover:bg-indigo-600/30 transition-all text-sm font-medium"
                    >
                      💬 I need help
                    </button>
                  )}
                </div>
              </motion.div>
            ) : (
              <>
                {messages.length === 0 && !isLoading ? (
                  <div className="text-center text-[#6B7280] py-8">
                    <p>Loading conversation...</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs px-4 py-3 rounded-lg ${
                            msg.role === 'user'
                              ? 'bg-indigo-600 text-white rounded-br-none shadow-lg shadow-indigo-600/20'
                              : 'bg-indigo-500/5 text-gray-200 rounded-bl-none border-l-2 border-l-indigo-500 border border-indigo-500/30'
                          }`}
                        >
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs opacity-70">
                            <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {msg.stressSignals && msg.stressSignals.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {msg.stressSignals.map((signal, i) => (
                                <span
                                  key={i}
                                  className="inline-block bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded border border-amber-500/30"
                                >
                                  {signal}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-indigo-500/5 text-gray-200 rounded-lg rounded-bl-none px-4 py-3 border-l-2 border-l-indigo-500 border border-indigo-500/30">
                          <div className="flex gap-2 items-center">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                            </div>
                            <span className="text-xs text-indigo-300 font-medium">Claude is thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </>
            )}
          </div>

          {/* Input Area (only in chat phase) */}
          {conversationPhase === 'chat' && (
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={isLoading ? 'Waiting for response...' : 'Type your message...'}
                disabled={isLoading}
                className="flex-1 px-4 py-3 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-[#1F2937] disabled:text-[#6B7280] bg-[#111827] text-[#F9FAFB] placeholder:text-[#6B7280]"
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="px-4 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-all -translate-y-0.5 hover:-translate-y-1"
              >
                Send
              </button>
            </form>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[#9CA3AF] mb-2">Select a passenger to begin support</p>
          </div>
        </div>
      )}
    </div>
  );
};

const PersonaSelector = ({ onSelect }: { onSelect: (persona: 'CFO' | 'GateAgent' | 'Passenger') => void }) => {
  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 overflow-hidden relative">
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
          <h1 className="text-6xl font-extrabold text-white mb-4 font-display tracking-tight">
            AI-Powered Airline Disruption Recovery
          </h1>
          <p className="text-slate-300 text-lg max-w-3xl mx-auto font-medium mb-8">
            AeroAgent uses Claude to reason across passenger constraints, regulatory obligations, and recovery options — in real time.
          </p>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-8 mb-16 max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-xl p-6"
            >
              <div className="text-3xl font-bold text-emerald-400 font-mono mb-2">$35B+</div>
              <p className="text-slate-400 text-sm">Annual industry disruption cost</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-xl p-6"
            >
              <div className="text-3xl font-bold text-indigo-400 font-mono mb-2">250+</div>
              <p className="text-slate-400 text-sm">Passengers in this demo</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-xl p-6"
            >
              <div className="text-3xl font-bold text-amber-400 font-mono mb-2">3</div>
              <p className="text-slate-400 text-sm">AI-powered stakeholder views</p>
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
              color: 'text-emerald-400',
              bgColor: 'bg-emerald-500/10',
              borderColor: 'hover:border-emerald-500/50'
            },
            {
              id: 'GateAgent',
              title: 'Gate Agent',
              desc: 'Manage real-time passenger triage, handle escalations, and oversee automated rebooking at the gate.',
              icon: PlaneTakeoff,
              color: 'text-indigo-400',
              bgColor: 'bg-indigo-500/10',
              borderColor: 'hover:border-indigo-500/50'
            },
            {
              id: 'Passenger',
              title: 'Passenger',
              desc: 'Experience the AI-driven recovery journey through the mobile concierge interface.',
              icon: Smartphone,
              color: 'text-amber-400',
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
                onClick={() => onSelect(p.id as any)}
                className={cn(
                  "flex flex-col items-center text-center p-10 rounded-[32px] border-2 transition-all h-full",
                  "bg-slate-900/40 backdrop-blur-2xl border-slate-800 shadow-2xl",
                  p.borderColor
                )}
              >
                <div className={cn("w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-inner", p.bgColor)}>
                  <Icon className={cn("w-12 h-12", p.color)} />
                </div>
                <h2 className="text-2xl font-bold text-white mb-4 font-display">{p.title}</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-1">{p.desc}</p>
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
          <p className="text-slate-500 text-sm italic">
            Start with Gate Agent → select a passenger → watch Claude reason in real time
          </p>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-xl border-t border-slate-800 px-6 py-4 flex items-center justify-between text-xs text-slate-500">
        <div>AeroAgent v2.5</div>
        <div className="text-center flex-1">
          Built by Ashish Jacob James · Powered by Claude · Anthropic
        </div>
        <a
          href="https://linkedin.com/in/ashish-jacob-james"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
        >
          LinkedIn
        </a>
      </div>
    </div>
  );
};

export default function App() {
  const [persona, setPersona] = useState<'CFO' | 'GateAgent' | 'Passenger' | null>(null);
  const [activeTab, setActiveTab] = useState<'audit' | 'triage' | 'pax'>('audit');
  const [passengers, setPassengers] = useState<Passenger[]>(() => generateSeedData());
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

  const handleUpdatePax = (id: string, updates: Partial<Passenger>, useUid = false) => {
    setPassengers(prev => prev.map(p => {
      const match = useUid ? p.uid === id : p.pnr === id;
      return match ? { ...p, ...updates } : p;
    }));
  };

  const totalPax = passengers.length;
  const disruptedFlights = Array.from(new Set(passengers.filter(p => p.status === 'pending_triage').map(p => p.flightNumber))).length;

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
    <div className="min-h-screen bg-[#0A0F1E] text-[#F9FAFB] font-sans selection:bg-indigo-500/20 selection:text-indigo-300">
      {/* Announcement Banner */}
      <AnimatePresence>
        {!announcementDismissed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-indigo-600 text-white px-6 py-2 flex items-center justify-center gap-4 text-sm font-medium shadow-lg shadow-indigo-600/20"
          >
            <span>✦ AeroAgent — Now powered by Claude AI  |  Live demo  |  Built by Anthropic</span>
            <button
              onClick={() => setAnnouncementDismissed(true)}
              className="ml-auto text-white/80 hover:text-white transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="bg-rgba(10,15,30,0.8) px-6 py-3 flex items-center justify-between sticky top-0 z-[100] shadow-xl border-b border-gray-800 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPersona(null)}
            className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 hover:scale-105 transition-transform"
            title="Back to Persona Selector"
          >
            <Zap className="text-white w-5 h-5" />
          </button>
          <div>
            <h1 className="text-white text-base font-bold font-display tracking-tight leading-none">
              AeroAgent <span className="text-indigo-400 font-mono tabular-nums text-xs ml-1">v2.5</span>
            </h1>
            <p className="text-[#6B7280] text-[9px] font-bold text-indigo-400 uppercase tracking-[0.2em] mt-1">Airline IR OPS Recovery Orchestrator</p>
          </div>
          <div className="ml-6 pl-6 border-l border-gray-700/50 hidden md:block">
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-[#6B7280] uppercase tracking-wider">Active Pax</span>
                <span className="text-white text-sm font-mono tabular-nums font-bold">{totalPax.toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-[#6B7280] uppercase tracking-wider">Disruptions</span>
                <span className="text-white text-sm font-mono tabular-nums font-bold">{disruptedFlights} Flights</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => setPersona(null)}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-all"
          >
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[9px] font-bold text-white uppercase tracking-widest">Switch Persona</span>
          </button>

          <div className="flex items-center gap-3 pl-6 border-l border-gray-700/50">
            <div className="text-right hidden sm:block">
              <p className="text-white text-xs font-bold">
                {persona === 'CFO' ? 'Ashish Jacob' : persona === 'GateAgent' ? 'Sarah Miller' : 'Pekka Virtanen'}
              </p>
              <p className="text-[#6B7280] text-[9px] font-bold uppercase tracking-widest">
                {persona === 'CFO' ? 'Senior Auditor' : persona === 'GateAgent' ? 'Gate Supervisor' : 'Passenger'}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[#9CA3AF] font-bold text-xs">
              {persona === 'CFO' ? 'AJ' : persona === 'GateAgent' ? 'SM' : 'PV'}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto p-4 lg:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'audit' && <CFOAudit passengers={passengers} />}
            {activeTab === 'triage' && <GateAgentTriage passengers={passengers} onUpdatePax={handleUpdatePax} />}
            {activeTab === 'pax' && <PassengerExperience passengers={passengers} onUpdatePax={handleUpdatePax} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
