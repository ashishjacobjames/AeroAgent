import React from 'react';
import { Info, Sparkles, AlertTriangle } from 'lucide-react';
import {
  DisruptionLiabilityEngine,
  ActionType,
} from '../types';
import { Tooltip } from './UI';
import { cn } from '../types';

interface RationalePanelProps {
  payload: DisruptionLiabilityEngine;
  rationale: string;
  recommendedAction: ActionType;
  overrideAction?: ActionType;
  overrideRationale?: string;
  legacyTotal?: number;
  aiJustification?: string;
  aiDistressLevel?: 'Critical' | 'High' | 'Medium' | 'Low';
  aiDistressReason?: string;
  aiRegulatoryBasis?: string;
  aiRegulatoryNote?: string;
  aiFlaggedIssues?: string[];
  aiAgentTalkingPoints?: string[];
  aiPowered?: boolean;
  // New cost-related props (FIX 5)
  aeroAgentCost?: number;
  netSavings?: number;
  churnPropensity?: number;
  clv?: number;
  extraordinaryCircumstancesSaving?: number;
  regulatorySavingsPercent?: number;
  isPremiumCabin?: boolean;
}

export const RationalePanel: React.FC<RationalePanelProps> = ({
  payload,
  rationale,
  recommendedAction,
  overrideAction,
  overrideRationale,
  legacyTotal,
  aiJustification,
  aiDistressLevel,
  aiDistressReason,
  aiRegulatoryBasis,
  aiRegulatoryNote,
  aiFlaggedIssues,
  aiAgentTalkingPoints,
  aiPowered,
  aeroAgentCost,
  netSavings,
  churnPropensity,
  clv,
  extraordinaryCircumstancesSaving,
  regulatorySavingsPercent,
  isPremiumCabin,
}) => {
  const { jurisdiction, financialExposure } = payload;

  const distressColors: Record<string, string> = {
    Critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    High: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    Medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    Low: 'bg-green-500/20 text-green-400 border-green-500/30'
  };

  return (
    <div className="space-y-5 ml-4 my-2">
      {aiPowered && (
        <div className="bg-indigo-500/5 border-l-2 border-indigo-500 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-indigo-400 text-lg">✦</span>
            <h4 className="text-[11px] font-bold font-display text-indigo-300 uppercase tracking-widest">AI Recovery Analysis</h4>
          </div>

          <div className="space-y-4">
            <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-lg p-3.5">
              <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Gate Agent Reasoning</p>
              <p className="text-sm text-gray-300 leading-relaxed">{aiJustification}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {aiDistressLevel && (
                <div>
                  <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-1">Distress Level</p>
                  <div className={cn('px-3 py-2 rounded-lg border text-[11px] font-bold', distressColors[aiDistressLevel] || 'bg-gray-500/20 text-gray-400 border-gray-500/30')}>
                    {aiDistressLevel}
                  </div>
                  {aiDistressReason && (
                    <p className="text-[8px] text-gray-500 mt-1.5 italic">{aiDistressReason}</p>
                  )}
                </div>
              )}

              {aiRegulatoryBasis && (
                <div>
                  <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-1">Regulatory Basis</p>
                  <div className="px-3 py-2 rounded-lg border border-gray-600 bg-gray-900/30 text-[11px] font-bold text-gray-300">
                    {aiRegulatoryBasis}
                  </div>
                  {aiRegulatoryNote && (
                    <p className="text-[8px] text-gray-500 mt-1.5 italic">{aiRegulatoryNote}</p>
                  )}
                </div>
              )}
            </div>

            {aiAgentTalkingPoints && aiAgentTalkingPoints.length > 0 && (
              <div className="border-t border-indigo-500/20 pt-3">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">When speaking to the passenger:</p>
                <ul className="space-y-1.5">
                  {aiAgentTalkingPoints.map((point, idx) => (
                    <li key={idx} className="text-[9px] text-gray-300 leading-relaxed flex gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiFlaggedIssues && aiFlaggedIssues.length > 0 && (
              <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg p-3 mt-3">
                <p className="text-[9px] font-bold text-amber-300 uppercase tracking-widest mb-2">⚠ Flagged Issues</p>
                <ul className="space-y-1">
                  {aiFlaggedIssues.map((issue, idx) => (
                    <li key={idx} className="text-[8px] text-amber-200 leading-relaxed flex gap-2">
                      <span>•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-[8px] text-gray-600 italic text-center pt-2 border-t border-indigo-500/20">Powered by Claude · Anthropic</p>
          </div>
        </div>
      )}

      <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-6 border-l-2 border-l-indigo-500">
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h5 className="text-[10px] font-bold font-display text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Info className="w-3.5 h-3.5" /> GLASS BOX AI RATIONALE
            </h5>
            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-gray-800 text-gray-400 border border-gray-700 uppercase tracking-wider">
              {jurisdiction.primaryFramework}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              AI Rec:
            </span>
            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30 uppercase tracking-wider">
              {recommendedAction}
            </span>
          </div>
        </div>

        <p className="text-sm text-gray-300 leading-relaxed font-sans">
          {rationale}
        </p>

        {overrideAction && (
          <div className="mt-5 p-3.5 bg-amber-500/20 border border-amber-500/30 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="text-[9px] font-bold uppercase tracking-widest">
                Manual Override Justification
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-tight">
                Action: {overrideAction}
              </span>
              <p className="text-sm text-amber-200 italic leading-relaxed">
                "{overrideRationale || 'No justification provided.'}"
              </p>
            </div>
          </div>
        )}

        {/* ===== FIX 5: NEW 5-SECTION COST DISPLAY ===== */}
        <div className="mt-5 space-y-4">
          {/* SECTION 1: WHAT WAS SPENT */}
          {aeroAgentCost !== undefined && (
            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
              <h5 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                AeroAgent Recovery Cost
              </h5>
              {aeroAgentCost <= 0.1 ? (
                <p className="text-sm text-gray-400 italic">
                  Notification only — minimal operational cost
                </p>
              ) : (
                <div className="space-y-2">
                  {/* Line items only if > €0 */}
                  {/* Regulatory Compensation (EU261/APPR/USDOT) */}
                  {financialExposure.eu261.max > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">
                        Regulatory Compensation ({payload.jurisdiction.primaryFramework})
                      </span>
                      <span className="font-mono font-bold text-gray-300">
                        €{financialExposure.eu261.max.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {/* Duty of Care - Meals */}
                  {financialExposure.dutyOfCare.local > 0 && financialExposure.dutyOfCare.meals.eligible && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Duty of Care — Meals</span>
                      <span className="font-mono font-bold text-gray-300">
                        €{financialExposure.dutyOfCare.meals.voucherValue.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {/* Duty of Care - Hotel */}
                  {financialExposure.dutyOfCare.local > 0 && financialExposure.dutyOfCare.hotel.eligible && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Duty of Care — Hotel</span>
                      <span className="font-mono font-bold text-gray-300">
                        €150.00
                      </span>
                    </div>
                  )}
                  {/* Rebook Cost */}
                  {financialExposure.deterministic.oalRebook > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Rebook Cost</span>
                      <span className="font-mono font-bold text-gray-300">
                        €{financialExposure.deterministic.oalRebook.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {/* Total line - must equal sum of items above */}
                  <div className="flex justify-between text-sm font-bold border-t border-gray-700 pt-2 mt-2">
                    <span className="text-gray-300">Total</span>
                    <span className="font-mono text-white">
                      €{aeroAgentCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: LEGACY COMPARISON */}
          {legacyTotal !== undefined && (
            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
              <h5 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Without AeroAgent (estimated)
              </h5>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Legacy estimated spend</span>
                  <span className="font-mono font-bold text-gray-300">
                    €{legacyTotal.toFixed(2)}
                  </span>
                </div>
                <p className="text-[8px] text-gray-600 italic">
                  Based on industry standard handling
                </p>
                {netSavings !== undefined && (
                  <div className={`flex justify-between text-sm font-bold border-t border-gray-700 pt-2 mt-2 ${netSavings > 0 ? 'text-green-400' : 'text-amber-400'}`}>
                    <span>Net Saving</span>
                    <span className="font-mono">
                      €{netSavings.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 3: REGULATORY OPTIMIZATION (conditional) */}
          {extraordinaryCircumstancesSaving && extraordinaryCircumstancesSaving > 0 && (
            <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-emerald-400 text-lg">✓</span>
                <h5 className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                  Regulatory Optimisation
                </h5>
              </div>
              <p className="text-sm text-emerald-300 mb-3">
                Compensation correctly waived under EU261 Article 5(3)
              </p>
              <div className="flex justify-between items-center text-sm font-bold text-emerald-300">
                <span>Amount Preserved</span>
                <span className="font-mono">€{extraordinaryCircumstancesSaving.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* SECTION 4: CHURN RISK */}
          {churnPropensity !== undefined && clv !== undefined && (
            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
              <h5 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Passenger Retention Risk
              </h5>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Churn Propensity</span>
                  <span className="font-mono font-bold text-gray-300">
                    {(churnPropensity * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Customer Lifetime Value</span>
                  <span className="font-mono font-bold text-gray-300">
                    €{clv.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Expected Churn Cost</span>
                  <span className="font-mono font-bold text-gray-300">
                    €{(clv * churnPropensity).toFixed(2)}
                  </span>
                </div>
                <p className="text-[8px] text-gray-600 italic mt-2">
                  * Indicative, based on industry benchmarks
                </p>
              </div>
            </div>
          )}

          {/* SECTION 5: METHODOLOGY NOTE */}
          <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-3 h-3 text-gray-500" />
              <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">
                Cost Model Methodology
              </p>
            </div>
            <p className="text-[8px] text-gray-600 leading-relaxed">
              Regulatory amounts: EU261/2004, US DOT, Canada APPR fixed schedules. Operational costs: Industry benchmarks. Churn impact: Airline loyalty research. All figures indicative — live PSS/GDS/CRM integration replaces benchmarks with exact operational data.
            </p>
          </div>
        </div>
      </div>

      {/* Right sidebar - keep existing expense breakdown if needed */}
      {false && (
      <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 shadow-sm h-fit">
        <div className="mb-3">
          <h5 className="text-[9px] font-bold font-display text-gray-500 uppercase tracking-widest">
            Additional Detail
          </h5>
        </div>
      </div>
      )}
      </div>
    </div>
  );
};
