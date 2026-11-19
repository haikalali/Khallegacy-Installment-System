import React, { useState } from 'react';
import type { BranchApprovalReportRow } from '../utils/businessRules';

interface ApprovalChartPoint {
  label: string;
  approved: number;
  pending: number;
}

interface ApprovalPerformanceChartProps {
  viewMode: 'daily' | 'weekly' | 'monthly';
  onViewModeChange: (mode: 'daily' | 'weekly' | 'monthly') => void;
  dailyData: ApprovalChartPoint[];
  weeklyData: ApprovalChartPoint[];
  monthlyData: ApprovalChartPoint[];
}

export const ApprovalPerformanceChart: React.FC<ApprovalPerformanceChartProps> = ({
  viewMode,
  onViewModeChange,
  dailyData,
  weeklyData,
  monthlyData,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const data =
    viewMode === 'daily' ? dailyData : viewMode === 'weekly' ? weeklyData : monthlyData;
  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.approved, d.pending)));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Approval Performance</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Approved versus pending customer applications
          </p>
        </div>
        <div
          className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/80"
          role="tablist"
          aria-label="Approval performance granularity"
        >
          {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={viewMode === mode}
              onClick={() => onViewModeChange(mode)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap ${
                viewMode === mode
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-slate-600 mb-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block" />
          Approved
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
          Pending
        </span>
      </div>

      {/* Responsive Bar Grid */}
      <div className="relative h-52 flex items-end gap-2 sm:gap-4 pt-6 pb-2 border-b border-slate-200">
        {/* Horizontal reference lines */}
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <div
            key={pct}
            style={{ bottom: `${pct * 100}%` }}
            className="absolute left-0 right-0 border-t border-dashed border-slate-100 pointer-events-none"
          />
        ))}

        {data.map((pt, idx) => {
          const appHeight = pt.approved === 0 ? 2 : Math.max(10, Math.round((pt.approved / maxVal) * 100));
          const penHeight = pt.pending === 0 ? 2 : Math.max(10, Math.round((pt.pending / maxVal) * 100));
          return (
            <div
              key={pt.label}
              onMouseEnter={() => setHoverIdx(idx)}
              onMouseLeave={() => setHoverIdx(null)}
              className="flex-1 h-full flex flex-col justify-end items-center relative group"
            >
              {hoverIdx === idx && (
                <div className="absolute -top-2 z-10 px-2.5 py-1.5 bg-slate-900 text-white text-[11px] rounded-md shadow-md whitespace-nowrap pointer-events-none">
                  <div className="font-semibold">{pt.label}</div>
                  <div className="tabular-nums text-emerald-300">Approved: {pt.approved}</div>
                  <div className="tabular-nums text-amber-300">Pending: {pt.pending}</div>
                </div>
              )}

              <div className="w-full max-w-[44px] h-[85%] flex items-end justify-center gap-1.5">
                <div
                  style={{ height: `${appHeight}%` }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 rounded-t transition-all"
                  title={`${pt.label}: ${pt.approved} Approved`}
                />
                <div
                  style={{ height: `${penHeight}%` }}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 rounded-t transition-all"
                  title={`${pt.label}: ${pt.pending} Pending`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* X Axis Labels */}
      <div className="flex items-center gap-2 sm:gap-4 pt-2">
        {data.map((pt) => (
          <div
            key={pt.label}
            className="flex-1 text-center text-[11px] text-slate-500 font-medium truncate"
          >
            {pt.label}
          </div>
        ))}
      </div>
    </div>
  );
};

interface BranchPerformanceChartProps {
  rows: BranchApprovalReportRow[];
}

export const BranchPerformanceChart: React.FC<BranchPerformanceChartProps> = ({ rows }) => {
  const maxTotal = Math.max(1, ...rows.map((r) => r.totalApplications));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">Performance by Branch</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Approval volume attributed to customer original branch
        </p>
      </div>

      <div className="space-y-3.5">
        {rows.map((row) => {
          const approvedPct = (row.approved / maxTotal) * 100;
          const pendingPct = (row.pending / maxTotal) * 100;
          const rejectedPct = (row.rejected / maxTotal) * 100;
          return (
            <div key={row.branchId}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-800 truncate">{row.branchName}</span>
                <span className="tabular-nums text-slate-500 shrink-0">
                  <strong className="text-slate-900">{row.approved}</strong>/{row.totalApplications}{' '}
                  approved ({row.approvalRate}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                {approvedPct > 0 && (
                  <div
                    style={{ width: `${approvedPct}%` }}
                    className="bg-emerald-600 h-full"
                    title={`Approved: ${row.approved}`}
                  />
                )}
                {pendingPct > 0 && (
                  <div
                    style={{ width: `${pendingPct}%` }}
                    className="bg-amber-500 h-full"
                    title={`Pending: ${row.pending}`}
                  />
                )}
                {rejectedPct > 0 && (
                  <div
                    style={{ width: `${rejectedPct}%` }}
                    className="bg-red-500 h-full"
                    title={`Rejected: ${row.rejected}`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-4 mt-4 border-t border-slate-100">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-emerald-600" />
          Approved
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-amber-500" />
          Pending
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-red-500" />
          Rejected
        </span>
      </div>
    </div>
  );
};

interface AgreementWorkflowChartProps {
  stages: {
    label: string;
    count: number;
    colorClass: string;
  }[];
  onStageClick?: (label: string) => void;
}

export const AgreementWorkflowChart: React.FC<AgreementWorkflowChartProps> = ({
  stages,
  onStageClick,
}) => {
  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">Agreement Workflow Pipeline</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Live counts across receiving, checking, JCL Credit dispatch &amp; confirmation
        </p>
      </div>

      <div className="space-y-3">
        {stages.map((stage) => {
          const widthPct = Math.max(stage.count > 0 ? 8 : 0, (stage.count / maxCount) * 100);
          return (
            <button
              key={stage.label}
              type="button"
              onClick={() => onStageClick?.(stage.label)}
              className="w-full text-left group rounded-lg p-1.5 -mx-1.5 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-slate-700 group-hover:text-slate-900">
                  {stage.label}
                </span>
                <span className="font-mono-tabular font-semibold text-slate-900">
                  {stage.count}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  style={{ width: `${widthPct}%` }}
                  className={`h-full rounded-full transition-all ${stage.colorClass}`}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
