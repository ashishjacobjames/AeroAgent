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

        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          {legacyTotal !== undefined && (
            <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 shadow-sm">
              <p className="text-[8px] font-bold text-gray-500 uppercase mb-1 tracking-widest">
                LEGACY COST (PSS)
              </p>
              <p className="text-xl font-bold font-mono tabular-nums text-warning-crimson">
                €
                {legacyTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-[8px] text-gray-600 mt-1 italic">
                * Original system logic
              </p>
            </div>
          )}

          <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 shadow-sm transition-all hover:border-indigo-500/50">
            <p className="text-[8px] font-bold text-gray-500 uppercase mb-1 tracking-widest">
              EST. DUTY OF CARE (LOCAL)
            </p>
            <Tooltip
              content={
                financialExposure.dutyOfCare.breakdown
              }
            >
              <p className="text-xl font-bold font-mono tabular-nums text-gray-200 cursor-help underline decoration-dotted decoration-gray-600 underline-offset-4">
                €
                {financialExposure.dutyOfCare.local.toLocaleString(
                  undefined,
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                )}
              </p>
            </Tooltip>
            <p className="text-[8px] text-gray-600 mt-1 italic">
              * Dynamic variable cost
            </p>
          </div>

          <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 shadow-sm transition-all hover:border-indigo-500/50">
            <div className="flex items-center gap-1 mb-1">
              <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">
                EU261 EXPOSURE (EV)
              </p>
              <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
            </div>
            <p className="text-xl font-bold font-mono tabular-nums text-gray-200">
              €
              {financialExposure.eu261.ev.toLocaleString(
                undefined,
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </p>
            <p className="text-[9px] text-gray-600 font-sans mt-0.5">
              Max: €
              {financialExposure.eu261.max.toLocaleString(
                undefined,
                { maximumFractionDigits: 0 }
              )}{' '}
              | {(financialExposure.eu261.likelihood * 100).toFixed(0)}%
              Likelihood
            </p>
          </div>

          <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 shadow-sm transition-all hover:border-indigo-500/50">
            <div className="flex items-center gap-1 mb-1">
              <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">
                CHURN RISK (EV)
              </p>
              <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
            </div>
            <p className="text-xl font-bold font-mono tabular-nums text-gray-200">
              €
              {financialExposure.churn.ev.toLocaleString(
                undefined,
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </p>
            <p className="text-[9px] text-gray-600 font-sans mt-0.5">
              CLV: €
              {financialExposure.churn.clv.toLocaleString(
                undefined,
                { maximumFractionDigits: 0 }
              )}{' '}
              | {(financialExposure.churn.propensity * 100).toFixed(1)}%
              Propensity
            </p>
          </div>

          <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 shadow-sm transition-all hover:border-indigo-500/50">
            <p className="text-[8px] font-bold text-gray-500 uppercase mb-1 tracking-widest">
              TOTAL AERO COST (EV)
            </p>
            <p className="text-xl font-bold font-mono tabular-nums text-aero-teal">
              €
              {financialExposure.totalAero.ev.toLocaleString(
                undefined,
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </p>
            <p className="text-[9px] text-gray-600 font-sans mt-0.5">
              Total Expected Liability
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 shadow-sm h-fit">
        <div className="mb-3">
          <h5 className="text-[9px] font-bold font-display text-gray-500 uppercase tracking-widest">
            Deterministic Costs
          </h5>
        </div>
        <div className="space-y-2.5">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-gray-400">OAL Rebook Cost</span>
            <span className="font-mono tabular-nums font-bold text-gray-300">
              €
              {financialExposure.deterministic.oalRebook.toLocaleString(
                undefined,
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-gray-400">
              Est. Duty of Care
            </span>
            <span className="font-mono tabular-nums font-bold text-gray-300">
              €
              {financialExposure.deterministic.dutyOfCare.toLocaleString(
                undefined,
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </span>
          </div>

          <div className="my-3 border-b border-gray-700" />

          <div className="mb-3 flex items-center gap-2">
            <h5 className="text-[9px] font-bold font-display text-gray-500 uppercase tracking-widest">
              Predictive Costs
            </h5>
            <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
          </div>

          <div className="flex justify-between items-center text-[11px]">
            <span className="text-gray-400">Expected EU261</span>
            <span className="font-mono tabular-nums font-bold text-gray-300">
              €
              {financialExposure.predictive.expectedEU261.toLocaleString(
                undefined,
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-gray-400">Expected Churn</span>
            <span className="font-mono tabular-nums font-bold text-gray-300">
              €
              {financialExposure.predictive.expectedChurn.toLocaleString(
                undefined,
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </span>
          </div>

          <div className="pt-3 mt-3 border-t border-gray-700 flex justify-between items-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Optimized Path
            </span>
            <span
              className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border"
              style={{
                color: financialExposure.optimizedPath.color,
                backgroundColor: `${financialExposure.optimizedPath.color}10`,
                borderColor: `${financialExposure.optimizedPath.color}20`,
              }}
            >
              {financialExposure.optimizedPath.label}
            </span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
