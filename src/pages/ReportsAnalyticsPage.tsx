import React, { useMemo, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  PackageX,
  Truck,
  Calendar,
  Layers,
  Users,
  BarChart3,
  PieChart as PieIcon,
  Search,
  ArrowLeftRight,
} from 'lucide-react';
import type { Branch, InstallmentApplication, StaffUser } from '../types/khallegacy';
import {
  deriveStockFollowUp,
  filterApplicationsByApprovalDateRange,
  formatDateShort,
  hasAllProductsStockReady,
  isEligibleForAgreementReceipt,
  resolveApplicationCategory,
} from '../utils/businessRules';

interface ReportsAnalyticsPageProps {
  applications: InstallmentApplication[];
  branches: Branch[];
  users: StaffUser[];
  canExport: boolean;
  onExportCsv: (filename: string, rows: string[][]) => void;
  onExportPdfSummary: () => void;
}

// Helpers for Gender & Age derivation from Malaysian NRIC
function getGenderFromIc(ic: string): 'Lelaki' | 'Perempuan' {
  const clean = (ic || '').replace(/\D/g, '');
  if (!clean) return 'Lelaki';
  const lastDigit = parseInt(clean.slice(-1), 10);
  return lastDigit % 2 !== 0 ? 'Lelaki' : 'Perempuan';
}

function getAgeFromIc(ic: string, refYear: number = 2026): number {
  const clean = (ic || '').replace(/\D/g, '');
  if (clean.length < 2) return 28;
  const yy = parseInt(clean.slice(0, 2), 10);
  const birthYear = yy <= 26 ? 2000 + yy : 1900 + yy;
  return refYear - birthYear;
}

const AGE_GROUPS = [
  '18–19 years',
  '20–25 years',
  '26–29 years',
  '30–39 years',
  '40–49 years',
  'More than 50 years',
] as const;

type AgeGroupLabel = (typeof AGE_GROUPS)[number];

function getAgeGroupLabel(age: number): AgeGroupLabel {
  if (age >= 18 && age <= 19) return '18–19 years';
  if (age >= 20 && age <= 25) return '20–25 years';
  if (age >= 26 && age <= 29) return '26–29 years';
  if (age >= 30 && age <= 39) return '30–39 years';
  if (age >= 40 && age <= 49) return '40–49 years';
  return 'More than 50 years';
}

// Clean SVG Donut / Pie Chart Component
const GenderPieChart: React.FC<{
  title: string;
  subtitle: string;
  maleCount: number;
  femaleCount: number;
}> = ({ title, subtitle, maleCount, femaleCount }) => {
  const total = maleCount + femaleCount;
  const malePct = total > 0 ? (maleCount / total) * 100 : 50;
  const femalePct = total > 0 ? (femaleCount / total) * 100 : 50;

  // SVG circle circumference for r = 40 is 2 * PI * 40 = 251.327
  const circumference = 251.327;
  const maleStroke = (malePct / 100) * circumference;
  const femaleStroke = (femalePct / 100) * circumference;

  return (
    <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 flex flex-col items-center justify-between">
      <div className="w-full text-left mb-3">
        <h4 className="text-xs font-semibold text-slate-900">{title}</h4>
        <p className="text-[11px] text-slate-500">{subtitle}</p>
      </div>

      <div className="relative w-36 h-36 flex items-center justify-center my-2">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth="16"
          />
          {total === 0 ? (
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke="#cbd5e1"
              strokeWidth="16"
            />
          ) : (
            <>
              {/* Male Segment (Blue) */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#2563eb"
                strokeWidth="16"
                strokeDasharray={`${maleStroke} ${circumference}`}
                strokeDashoffset="0"
                className="transition-all duration-500"
              />
              {/* Female Segment (Pink/Rose) */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#ec4899"
                strokeWidth="16"
                strokeDasharray={`${femaleStroke} ${circumference}`}
                strokeDashoffset={`${-maleStroke}`}
                className="transition-all duration-500"
              />
            </>
          )}
        </svg>

        {/* Center Total Count */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-lg font-bold text-slate-900 tabular-nums">{total}</span>
          <span className="text-[10px] text-slate-500 uppercase font-medium">Total</span>
        </div>
      </div>

      {/* Legend & Breakdown */}
      <div className="w-full grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200/60 text-xs">
        <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-100 shadow-2xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
            <span className="text-slate-600 truncate font-medium">Lelaki</span>
          </div>
          <div className="text-right shrink-0">
            <span className="font-semibold text-slate-900 tabular-nums mr-1">{maleCount}</span>
            <span className="text-[11px] text-blue-600 font-medium tabular-nums">
              ({total > 0 ? malePct.toFixed(1) : '0'}%)
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-100 shadow-2xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500 shrink-0" />
            <span className="text-slate-600 truncate font-medium">Perempuan</span>
          </div>
          <div className="text-right shrink-0">
            <span className="font-semibold text-slate-900 tabular-nums mr-1">{femaleCount}</span>
            <span className="text-[11px] text-pink-600 font-medium tabular-nums">
              ({total > 0 ? femalePct.toFixed(1) : '0'}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Horizontal Line / Bar Chart for Report E: Full bar = total, Right bar = approved, Left bar = cancel
const GenderHorizontalBarChart: React.FC<{
  maleApproved: number;
  maleCancelled: number;
  femaleApproved: number;
  femaleCancelled: number;
}> = ({ maleApproved, maleCancelled, femaleApproved, femaleCancelled }) => {
  const [scaleMode, setScaleMode] = useState<'ratio' | 'volume'>('ratio');

  const maleTotal = maleApproved + maleCancelled;
  const femaleTotal = femaleApproved + femaleCancelled;
  const grandTotal = maleTotal + femaleTotal;
  const totalApproved = maleApproved + femaleApproved;
  const totalCancelled = maleCancelled + femaleCancelled;

  const maxTotal = Math.max(1, maleTotal, femaleTotal, grandTotal);

  const rows = [
    {
      key: 'male',
      title: 'Lelaki',
      subTitle: 'Last Digit IC Ganjil',
      dotColor: 'bg-blue-600',
      approved: maleApproved,
      cancelled: maleCancelled,
      total: maleTotal,
    },
    {
      key: 'female',
      title: 'Perempuan',
      subTitle: 'Last Digit IC Genap',
      dotColor: 'bg-pink-500',
      approved: femaleApproved,
      cancelled: femaleCancelled,
      total: femaleTotal,
    },
    {
      key: 'all',
      title: 'Keseluruhan (Semua Pemohon)',
      subTitle: 'Lelaki + Perempuan',
      dotColor: 'bg-indigo-600',
      approved: totalApproved,
      cancelled: totalCancelled,
      total: grandTotal,
      isTotal: true,
    },
  ];

  return (
    <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 sm:p-5 mb-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200/70">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-pink-100 text-pink-700 flex items-center justify-center">
              <ArrowLeftRight className="w-3 h-3" />
            </div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Horizontal Status Bar Chart — Applicant by Gender
            </h4>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Full bar = Total pemohon | Left bar = Customer Cancel | Right bar = Approved
          </p>
        </div>

        {/* Legend & Display Mode */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-3 text-xs bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
            <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium text-[11px]">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
              Left: Cancel
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium text-[11px]">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" />
              Right: Approved
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-200 border border-slate-300" />
              Full Bar: Total
            </span>
          </div>

          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setScaleMode('ratio')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                scaleMode === 'ratio'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              100% Ratio
            </button>
            <button
              type="button"
              onClick={() => setScaleMode('volume')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                scaleMode === 'volume'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Volume Scale
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Bar Lines */}
      <div className="space-y-3.5">
        {rows.map((row) => {
          const cancelPct = row.total > 0 ? (row.cancelled / row.total) * 100 : 0;
          const approvedPct = row.total > 0 ? (row.approved / row.total) * 100 : 0;
          const barContainerWidth =
            scaleMode === 'volume' ? Math.max(18, (row.total / maxTotal) * 100) : 100;

          return (
            <div
              key={row.key}
              className={`p-3.5 rounded-lg border transition-all ${
                row.isTotal
                  ? 'bg-indigo-50/40 border-indigo-200/80 shadow-2xs'
                  : 'bg-white border-slate-200/80 shadow-2xs'
              }`}
            >
              {/* Row Metric Summary */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${row.dotColor}`} />
                  <span className="text-xs font-bold text-slate-900">{row.title}</span>
                  <span className="text-[11px] text-slate-400">({row.subTitle})</span>
                </div>

                <div className="flex items-center gap-2 text-xs tabular-nums">
                  {/* Left Metric: Cancel */}
                  <span className="inline-flex items-center gap-1 font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 text-[11px]">
                    <span className="text-[10px] uppercase font-bold text-rose-500">Left:</span>
                    Cancel {row.cancelled}
                    <span className="text-slate-400 font-normal">
                      ({row.total > 0 ? cancelPct.toFixed(1) : 0}%)
                    </span>
                  </span>

                  {/* Right Metric: Approved */}
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[11px]">
                    <span className="text-[10px] uppercase font-bold text-emerald-600">Right:</span>
                    Approved {row.approved}
                    <span className="text-slate-400 font-normal">
                      ({row.total > 0 ? approvedPct.toFixed(1) : 0}%)
                    </span>
                  </span>

                  {/* Full Bar Metric: Total */}
                  <span className="inline-flex items-center gap-1 font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200 text-[11px]">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Full Bar:</span>
                    Total {row.total}
                  </span>
                </div>
              </div>

              {/* Horizontal Bar: Full bar = Total, Left bar = Cancel, Right bar = Approved */}
              <div className="w-full bg-slate-100/80 rounded-lg p-1 border border-slate-200/80">
                <div
                  style={{ width: `${barContainerWidth}%` }}
                  className="transition-all duration-500"
                >
                  <div className="relative w-full h-8 bg-slate-200 rounded-md overflow-hidden flex items-stretch shadow-inner">
                    {row.total === 0 ? (
                      <div className="w-full h-full flex items-center justify-center text-[11px] text-slate-400 font-medium">
                        0 Pemohon
                      </div>
                    ) : (
                      <>
                        {/* LEFT BAR = CANCEL */}
                        <div
                          style={{ width: `${cancelPct}%` }}
                          className="h-full bg-rose-500 text-white flex items-center justify-start px-2.5 transition-all duration-500 shrink-0 relative overflow-hidden group border-r border-white/20"
                          title={`Cancel (Left Bar): ${row.cancelled} (${cancelPct.toFixed(1)}%)`}
                        >
                          {cancelPct >= 14 && (
                            <div className="flex items-center gap-1 whitespace-nowrap text-[11px] font-bold tracking-tight">
                              <span>Cancel {row.cancelled}</span>
                              <span className="text-rose-100 text-[10px] font-normal">
                                ({cancelPct.toFixed(0)}%)
                              </span>
                            </div>
                          )}
                        </div>

                        {/* RIGHT BAR = APPROVED */}
                        <div
                          style={{ width: `${approvedPct}%` }}
                          className="h-full bg-emerald-600 text-white flex items-center justify-end px-2.5 transition-all duration-500 shrink-0 ml-auto relative overflow-hidden group"
                          title={`Approved (Right Bar): ${row.approved} (${approvedPct.toFixed(1)}%)`}
                        >
                          {approvedPct >= 14 && (
                            <div className="flex items-center gap-1 whitespace-nowrap text-[11px] font-bold tracking-tight">
                              <span>Approved {row.approved}</span>
                              <span className="text-emerald-100 text-[10px] font-normal">
                                ({approvedPct.toFixed(0)}%)
                              </span>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ReportsAnalyticsPage: React.FC<ReportsAnalyticsPageProps> = ({
  applications,
  branches,
  canExport,
  onExportCsv,
  onExportPdfSummary,
}) => {
  const [startDate, setStartDate] = useState('2026-10-01');
  const [endDate, setEndDate] = useState('2026-11-30');
  const [branchFilter, setBranchFilter] = useState('ALL');

  // Search queries for Report A and B tables
  const [noStockSearch, setNoStockSearch] = useState('');
  const [stockOtwSearch, setStockOtwSearch] = useState('');

  const getBranchLabel = (id: string | null) => {
    if (!id) return 'Belum Ditentukan';
    if (id === 'POSTAGE') return 'POSTAGE';
    if (id === 'WEB') return 'WEB';
    return branches.find((b) => b.id === id)?.name ?? id;
  };

  // Filter applications by date range (using approvalDate / applicationDate)
  const dateFilteredApps = useMemo(
    () => filterApplicationsByApprovalDateRange(applications, startDate, endDate),
    [applications, startDate, endDate],
  );

  // Filter applications by Branch (pickupBranchId or customerFromBranchId)
  const scopedApps = useMemo(() => {
    if (branchFilter === 'ALL') return dateFilteredApps;
    return dateFilteredApps.filter(
      (a) => a.pickupBranchId === branchFilter || a.customerFromBranchId === branchFilter,
    );
  }, [dateFilteredApps, branchFilter]);

  // ==========================================
  // REPORT A: NO STOCK LIST
  // ==========================================
  const reportANoStockList = useMemo(() => {
    return scopedApps.filter((app) => {
      const followUp = deriveStockFollowUp(app);
      return followUp.stockStage === 'NO STOCK';
    });
  }, [scopedApps]);

  const filteredNoStockList = useMemo(() => {
    const q = noStockSearch.trim().toLowerCase();
    if (!q) return reportANoStockList;
    return reportANoStockList.filter((app) => {
      const followUp = deriveStockFollowUp(app);
      const prd = app.products.map((p) => p.productName).join(' ');
      const branchName = getBranchLabel(app.pickupBranchId);
      return (
        app.customerName.toLowerCase().includes(q) ||
        prd.toLowerCase().includes(q) ||
        (followUp.colour || '').toLowerCase().includes(q) ||
        branchName.toLowerCase().includes(q) ||
        (followUp.remark || '').toLowerCase().includes(q)
      );
    });
  }, [reportANoStockList, noStockSearch, branches]);

  // ==========================================
  // REPORT B: STOCK OTW LIST
  // ==========================================
  const reportBStockOtwList = useMemo(() => {
    return scopedApps.filter((app) => {
      const followUp = deriveStockFollowUp(app);
      return followUp.stockStage === 'STOK OTW' || followUp.stockStage === 'IN TRANSIT';
    });
  }, [scopedApps]);

  const filteredStockOtwList = useMemo(() => {
    const q = stockOtwSearch.trim().toLowerCase();
    if (!q) return reportBStockOtwList;
    return reportBStockOtwList.filter((app) => {
      const followUp = deriveStockFollowUp(app);
      const prd = app.products.map((p) => p.productName).join(' ');
      const branchName = getBranchLabel(app.pickupBranchId);
      return (
        app.customerName.toLowerCase().includes(q) ||
        prd.toLowerCase().includes(q) ||
        (followUp.colour || '').toLowerCase().includes(q) ||
        branchName.toLowerCase().includes(q) ||
        (followUp.remark || '').toLowerCase().includes(q)
      );
    });
  }, [reportBStockOtwList, stockOtwSearch, branches]);

  // ==========================================
  // REPORT C: Monthly Performance
  // ==========================================
  const reportCMonthlyPerformance = useMemo(() => {
    // Extract unique months (YYYY-MM)
    const monthKeys = Array.from(
      new Set(
        scopedApps.map((a) => {
          const d = a.approvalDate || a.applicationDate || '2026-11-01';
          return d.slice(0, 7);
        }),
      ),
    ).sort((a, b) => b.localeCompare(a)); // Descending month

    if (monthKeys.length === 0) {
      monthKeys.push('2026-11', '2026-10');
    }

    return monthKeys.map((mKey) => {
      const monthApps = scopedApps.filter((a) => {
        const d = a.approvalDate || a.applicationDate || '';
        return d.startsWith(mKey);
      });

      const dObj = new Date(`${mKey}-01T00:00:00`);
      const monthLabel = !Number.isNaN(dObj.getTime())
        ? dObj.toLocaleDateString('en-MY', { month: 'short', year: 'numeric' })
        : mKey;

      const totalApproved = monthApps.filter((a) => a.approvalStatus === 'Approved').length;
      const customerCancelled = monthApps.filter(
        (a) => deriveStockFollowUp(a).customerDecision === 'CANCELLED',
      ).length;
      const totalAgreement = monthApps.filter(
        (a) => hasAllProductsStockReady(a.products) || a.taskStatus?.passedStock === 'PASSED',
      ).length;
      const agreementReceived = monthApps.filter((a) => a.agreement.receivedAt !== null).length;
      const agreementToBeReceived = monthApps.filter(isEligibleForAgreementReceipt).length;

      return {
        monthKey: mKey,
        monthLabel,
        totalApproved,
        customerCancelled,
        totalAgreement,
        agreementReceived,
        agreementToBeReceived,
      };
    });
  }, [scopedApps]);

  // ==========================================
  // REPORT D: Category Product by Month
  // ==========================================
  const reportDCategoryProductByMonth = useMemo(() => {
    const monthKeys = Array.from(
      new Set(
        scopedApps.map((a) => {
          const d = a.approvalDate || a.applicationDate || '2026-11-01';
          return d.slice(0, 7);
        }),
      ),
    ).sort((a, b) => b.localeCompare(a));

    if (monthKeys.length === 0) {
      monthKeys.push('2026-11', '2026-10');
    }

    return monthKeys.map((mKey) => {
      const monthApps = scopedApps.filter((a) => {
        const d = a.approvalDate || a.applicationDate || '';
        return d.startsWith(mKey);
      });

      const dObj = new Date(`${mKey}-01T00:00:00`);
      const monthLabel = !Number.isNaN(dObj.getTime())
        ? dObj.toLocaleDateString('en-MY', { month: 'short', year: 'numeric' })
        : mKey;

      const appleCount = monthApps.filter(
        (a) => resolveApplicationCategory(a) === 'Apple',
      ).length;
      const androidCount = monthApps.filter(
        (a) => resolveApplicationCategory(a) === 'Android',
      ).length;
      const gameConsoleCount = monthApps.filter(
        (a) => resolveApplicationCategory(a) === 'Game&Console',
      ).length;
      const homeApplianceCount = monthApps.filter(
        (a) => resolveApplicationCategory(a) === 'Home Appliance',
      ).length;

      return {
        monthKey: mKey,
        monthLabel,
        appleCount,
        androidCount,
        gameConsoleCount,
        homeApplianceCount,
        total: appleCount + androidCount + gameConsoleCount + homeApplianceCount,
      };
    });
  }, [scopedApps]);

  // ==========================================
  // REPORT E: Applicant by Gender
  // ==========================================
  const reportEGender = useMemo(() => {
    let maleApproved = 0;
    let maleCancelled = 0;
    let femaleApproved = 0;
    let femaleCancelled = 0;

    for (const app of scopedApps) {
      const gender = getGenderFromIc(app.icNumber);
      const isCancelled = deriveStockFollowUp(app).customerDecision === 'CANCELLED';

      if (gender === 'Lelaki') {
        if (isCancelled) maleCancelled += 1;
        else if (app.approvalStatus === 'Approved') maleApproved += 1;
      } else {
        if (isCancelled) femaleCancelled += 1;
        else if (app.approvalStatus === 'Approved') femaleApproved += 1;
      }
    }

    return {
      maleApproved,
      maleCancelled,
      maleTotal: maleApproved + maleCancelled,
      femaleApproved,
      femaleCancelled,
      femaleTotal: femaleApproved + femaleCancelled,
      totalApproved: maleApproved + femaleApproved,
      totalCancelled: maleCancelled + femaleCancelled,
      grandTotal: maleApproved + maleCancelled + femaleApproved + femaleCancelled,
    };
  }, [scopedApps]);

  // ==========================================
  // REPORT F: Applicant by Age Group
  // ==========================================
  const reportFAgeGroups = useMemo(() => {
    const map: Record<AgeGroupLabel, { approved: number; cancelled: number; total: number }> = {
      '18–19 years': { approved: 0, cancelled: 0, total: 0 },
      '20–25 years': { approved: 0, cancelled: 0, total: 0 },
      '26–29 years': { approved: 0, cancelled: 0, total: 0 },
      '30–39 years': { approved: 0, cancelled: 0, total: 0 },
      '40–49 years': { approved: 0, cancelled: 0, total: 0 },
      'More than 50 years': { approved: 0, cancelled: 0, total: 0 },
    };

    for (const app of scopedApps) {
      const age = getAgeFromIc(app.icNumber, 2026);
      const grp = getAgeGroupLabel(age);
      const isCancelled = deriveStockFollowUp(app).customerDecision === 'CANCELLED';

      if (isCancelled) {
        map[grp].cancelled += 1;
      } else if (app.approvalStatus === 'Approved') {
        map[grp].approved += 1;
      }
      map[grp].total += 1;
    }

    return AGE_GROUPS.map((label) => ({
      label,
      approved: map[label].approved,
      cancelled: map[label].cancelled,
      total: map[label].approved + map[label].cancelled,
    }));
  }, [scopedApps]);

  const maxAgeCount = useMemo(() => {
    return Math.max(1, ...reportFAgeGroups.map((g) => Math.max(g.approved, g.cancelled)));
  }, [reportFAgeGroups]);

  // Export to Excel / CSV with all 6 reports
  const handleExportExcel = () => {
    const csvRows: string[][] = [
      ['KHALLEGACY SYSTEM - REPORTS & ANALYTICS'],
      ['Date Range:', `${startDate} to ${endDate}`],
      ['Branch Filter:', branchFilter === 'ALL' ? 'All Branches' : getBranchLabel(branchFilter)],
      [],
      ['================================================================='],
      ['REPORT A - NO STOCK LIST'],
      ['Nama', 'Product', 'Colour', 'Pickup Branch', 'Remarks'],
      ...reportANoStockList.map((app) => {
        const followUp = deriveStockFollowUp(app);
        return [
          app.customerName,
          app.products.map((p) => p.productName).join(' + '),
          followUp.colour || app.products[0]?.model || '—',
          getBranchLabel(app.pickupBranchId),
          followUp.remark || app.approvalRemarks || '—',
        ];
      }),
      [],
      ['================================================================='],
      ['REPORT B - STOCK OTW LIST'],
      ['Nama', 'Product', 'Colour', 'Pickup Branch', 'Remarks'],
      ...reportBStockOtwList.map((app) => {
        const followUp = deriveStockFollowUp(app);
        return [
          app.customerName,
          app.products.map((p) => p.productName).join(' + '),
          followUp.colour || app.products[0]?.model || '—',
          getBranchLabel(app.pickupBranchId),
          followUp.remark || app.approvalRemarks || '—',
        ];
      }),
      [],
      ['================================================================='],
      ['REPORT C - MONTHLY PERFORMANCE'],
      [
        'Month',
        'Total Approved',
        'Customer Cancelled',
        'Total Agreement',
        'Agreement Received',
        'Agreement to be Received',
      ],
      ...reportCMonthlyPerformance.map((row) => [
        row.monthLabel,
        String(row.totalApproved),
        String(row.customerCancelled),
        String(row.totalAgreement),
        String(row.agreementReceived),
        String(row.agreementToBeReceived),
      ]),
      [],
      ['================================================================='],
      ['REPORT D - CATEGORY PRODUCT BY MONTH'],
      ['Month', 'APPLE', 'ANDROID', 'GAME CONSOLE', 'HOME APPLIANCE', 'TOTAL'],
      ...reportDCategoryProductByMonth.map((row) => [
        row.monthLabel,
        String(row.appleCount),
        String(row.androidCount),
        String(row.gameConsoleCount),
        String(row.homeApplianceCount),
        String(row.total),
      ]),
      [],
      ['================================================================='],
      ['REPORT E - APPLICANT BY GENDER'],
      ['Gender', 'Approved', 'Cancel', 'Total'],
      ['Lelaki', String(reportEGender.maleApproved), String(reportEGender.maleCancelled), String(reportEGender.maleTotal)],
      ['Perempuan', String(reportEGender.femaleApproved), String(reportEGender.femaleCancelled), String(reportEGender.femaleTotal)],
      ['Total', String(reportEGender.totalApproved), String(reportEGender.totalCancelled), String(reportEGender.grandTotal)],
      [],
      ['================================================================='],
      ['REPORT F - APPLICANT BY AGE GROUP'],
      ['Group Age', 'Total Approved', 'Total Cancel', 'Total Applications'],
      ...reportFAgeGroups.map((row) => [
        row.label,
        String(row.approved),
        String(row.cancelled),
        String(row.total),
      ]),
    ];

    onExportCsv(`khallegacy-reports-${startDate}-to-${endDate}.csv`, csvRows);
  };

  return (
    <div className="space-y-6">
      {/* Filters & Export Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4 shadow-sm no-print">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 flex-1">
          <div>
            <label htmlFor="rep-start" className="block text-[11px] font-medium text-slate-500 mb-1">
              Date From
            </label>
            <input
              id="rep-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="rep-end" className="block text-[11px] font-medium text-slate-500 mb-1">
              Date To
            </label>
            <input
              id="rep-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="rep-branch" className="block text-[11px] font-medium text-slate-500 mb-1">
              Branch Filter
            </label>
            <select
              id="rep-branch"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
              <option value="POSTAGE">POSTAGE</option>
              <option value="WEB">WEB</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setStartDate('2026-10-01');
                setEndDate('2026-11-30');
                setBranchFilter('ALL');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={!canExport}
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40 rounded-lg transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export Excel (All Reports)
          </button>
          <button
            type="button"
            disabled={!canExport}
            onClick={onExportPdfSummary}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 disabled:opacity-40 rounded-lg transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* REPORT A: NO STOCK LIST                                                  */}
      {/* ========================================================================= */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <PackageX className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Report A — NO STOCK LIST</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700">
                  {reportANoStockList.length} Records
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                List of customer orders currently awaiting stock availability
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-64 no-print">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search No Stock records..."
              value={noStockSearch}
              onChange={(e) => setNoStockSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-4 w-12 text-center">No</th>
                <th className="py-2.5 px-4">Nama</th>
                <th className="py-2.5 px-4">Product</th>
                <th className="py-2.5 px-4">Colour</th>
                <th className="py-2.5 px-4">Pickup Branch</th>
                <th className="py-2.5 px-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredNoStockList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No orders in "NO STOCK" stage for the selected filters.
                  </td>
                </tr>
              ) : (
                filteredNoStockList.map((app, idx) => {
                  const followUp = deriveStockFollowUp(app);
                  return (
                    <tr key={app.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-center tabular-nums text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {app.customerName}
                      </td>
                      <td className="py-3 px-4 text-slate-800">
                        {app.products.map((p) => p.productName).join(' + ')}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {followUp.colour || app.products[0]?.model || '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700">
                        {getBranchLabel(app.pickupBranchId)}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        {followUp.remark || app.approvalRemarks || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* REPORT B: STOCK OTW LIST                                                 */}
      {/* ========================================================================= */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Report B — STOCK OTW LIST</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700">
                  {reportBStockOtwList.length} Records
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Orders with stock currently in transit or on the way from suppliers
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-64 no-print">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Stock OTW records..."
              value={stockOtwSearch}
              onChange={(e) => setStockOtwSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-4 w-12 text-center">No</th>
                <th className="py-2.5 px-4">Nama</th>
                <th className="py-2.5 px-4">Product</th>
                <th className="py-2.5 px-4">Colour</th>
                <th className="py-2.5 px-4">Pickup Branch</th>
                <th className="py-2.5 px-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStockOtwList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No orders in "STOCK OTW / IN TRANSIT" stage for the selected filters.
                  </td>
                </tr>
              ) : (
                filteredStockOtwList.map((app, idx) => {
                  const followUp = deriveStockFollowUp(app);
                  return (
                    <tr key={app.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-center tabular-nums text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {app.customerName}
                      </td>
                      <td className="py-3 px-4 text-slate-800">
                        {app.products.map((p) => p.productName).join(' + ')}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {followUp.colour || app.products[0]?.model || '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700">
                        {getBranchLabel(app.pickupBranchId)}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        {followUp.remark || app.approvalRemarks || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* REPORT C: Monthly Performance                                            */}
      {/* ========================================================================= */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Report C — Monthly Performance
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Monthly breakdown of approvals, customer cancellations, stock readiness, and agreement workflow
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-4">Month</th>
                <th className="py-2.5 px-4 text-right">Total Approved</th>
                <th className="py-2.5 px-4 text-right text-rose-600">Customer Cancelled</th>
                <th className="py-2.5 px-4 text-right text-blue-600">Total Agreement</th>
                <th className="py-2.5 px-4 text-right text-emerald-600">Agreement Received</th>
                <th className="py-2.5 px-4 text-right text-amber-600">Agreement to be Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportCMonthlyPerformance.map((row) => (
                <tr key={row.monthKey} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                    {row.monthLabel}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-semibold text-slate-800">
                    {row.totalApproved}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-semibold text-rose-600">
                    {row.customerCancelled}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-semibold text-blue-600">
                    {row.totalAgreement}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-semibold text-emerald-600">
                    {row.agreementReceived}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-semibold text-amber-600">
                    {row.agreementToBeReceived}
                  </td>
                </tr>
              ))}
            </tbody>
            {reportCMonthlyPerformance.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50/80 font-bold text-xs text-slate-900">
                  <td className="py-3 px-4">Total</td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    {reportCMonthlyPerformance.reduce((sum, r) => sum + r.totalApproved, 0)}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-rose-600">
                    {reportCMonthlyPerformance.reduce((sum, r) => sum + r.customerCancelled, 0)}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-blue-600">
                    {reportCMonthlyPerformance.reduce((sum, r) => sum + r.totalAgreement, 0)}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-emerald-600">
                    {reportCMonthlyPerformance.reduce((sum, r) => sum + r.agreementReceived, 0)}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-amber-600">
                    {reportCMonthlyPerformance.reduce((sum, r) => sum + r.agreementToBeReceived, 0)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* REPORT D: Category Product by Month                                      */}
      {/* ========================================================================= */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Report D — Category Product by Month
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Monthly product category volume across Apple, Android, Game &amp; Console, and Home Appliance
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-4">Month</th>
                <th className="py-2.5 px-4 text-right">APPLE</th>
                <th className="py-2.5 px-4 text-right">ANDROID</th>
                <th className="py-2.5 px-4 text-right">GAME CONSOLE</th>
                <th className="py-2.5 px-4 text-right">HOME APPLIANCE</th>
                <th className="py-2.5 px-4 text-right font-bold text-slate-900">TOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportDCategoryProductByMonth.map((row) => (
                <tr key={row.monthKey} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                    {row.monthLabel}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-medium text-slate-800">
                    {row.appleCount}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-medium text-slate-800">
                    {row.androidCount}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-medium text-slate-800">
                    {row.gameConsoleCount}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-medium text-slate-800">
                    {row.homeApplianceCount}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-bold text-indigo-700">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
            {reportDCategoryProductByMonth.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50/80 font-bold text-xs text-slate-900">
                  <td className="py-3 px-4">Total</td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    {reportDCategoryProductByMonth.reduce((sum, r) => sum + r.appleCount, 0)}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    {reportDCategoryProductByMonth.reduce((sum, r) => sum + r.androidCount, 0)}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    {reportDCategoryProductByMonth.reduce((sum, r) => sum + r.gameConsoleCount, 0)}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    {reportDCategoryProductByMonth.reduce((sum, r) => sum + r.homeApplianceCount, 0)}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-indigo-700">
                    {reportDCategoryProductByMonth.reduce((sum, r) => sum + r.total, 0)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* REPORT E: Applicant by Gender                                            */}
      {/* ========================================================================= */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
            <PieIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Report E — Applicant by Gender</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Analysis based on Malaysian NRIC: Ganjil = Lelaki, Genap = Perempuan
            </p>
          </div>
        </div>

        {/* 2 Pie Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <GenderPieChart
            title="Approved Applicants by Gender"
            subtitle="Percentage breakdown of approved customers"
            maleCount={reportEGender.maleApproved}
            femaleCount={reportEGender.femaleApproved}
          />

          <GenderPieChart
            title="Cancelled Applicants by Gender"
            subtitle="Percentage breakdown of cancelled orders"
            maleCount={reportEGender.maleCancelled}
            femaleCount={reportEGender.femaleCancelled}
          />
        </div>

        {/* Horizontal Line / Bar Chart: Full bar = total, Right bar = approved, Left bar = cancel */}
        <GenderHorizontalBarChart
          maleApproved={reportEGender.maleApproved}
          maleCancelled={reportEGender.maleCancelled}
          femaleApproved={reportEGender.femaleApproved}
          femaleCancelled={reportEGender.femaleCancelled}
        />

        {/* Gender Breakdown Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-4">Gender</th>
                <th className="py-2.5 px-4 text-right text-emerald-600">Approved</th>
                <th className="py-2.5 px-4 text-right text-rose-600">Cancel</th>
                <th className="py-2.5 px-4 text-right font-bold text-slate-900">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 px-4 font-medium text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  Lelaki (Last Digit IC Ganjil)
                </td>
                <td className="py-3 px-4 text-right tabular-nums font-semibold text-emerald-700">
                  {reportEGender.maleApproved}
                </td>
                <td className="py-3 px-4 text-right tabular-nums font-semibold text-rose-600">
                  {reportEGender.maleCancelled}
                </td>
                <td className="py-3 px-4 text-right tabular-nums font-bold text-slate-900">
                  {reportEGender.maleTotal}
                </td>
              </tr>
              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 px-4 font-medium text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                  Perempuan (Last Digit IC Genap)
                </td>
                <td className="py-3 px-4 text-right tabular-nums font-semibold text-emerald-700">
                  {reportEGender.femaleApproved}
                </td>
                <td className="py-3 px-4 text-right tabular-nums font-semibold text-rose-600">
                  {reportEGender.femaleCancelled}
                </td>
                <td className="py-3 px-4 text-right tabular-nums font-bold text-slate-900">
                  {reportEGender.femaleTotal}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/80 font-bold text-xs text-slate-900">
                <td className="py-3 px-4">Total</td>
                <td className="py-3 px-4 text-right tabular-nums text-emerald-700">
                  {reportEGender.totalApproved}
                </td>
                <td className="py-3 px-4 text-right tabular-nums text-rose-600">
                  {reportEGender.totalCancelled}
                </td>
                <td className="py-3 px-4 text-right tabular-nums">
                  {reportEGender.grandTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* REPORT F: Applicant by Age Group                                         */}
      {/* ========================================================================= */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Report F — Applicant by Age Group</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribution of customer approvals and cancellations across six age brackets derived from MyKad birth year
            </p>
          </div>
        </div>

        {/* Age Group Bar Chart */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h4 className="text-xs font-semibold text-slate-900">
              Approved vs Cancelled Volume by Age Group
            </h4>
            <div className="flex items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" />
                Total Approved
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
                Total Cancel
              </span>
            </div>
          </div>

          <div className="h-56 flex items-end gap-3 sm:gap-6 pt-6 pb-2 border-b border-slate-200 relative">
            {/* Guide lines */}
            {[0.25, 0.5, 0.75, 1].map((pct) => (
              <div
                key={pct}
                style={{ bottom: `${pct * 100}%` }}
                className="absolute left-0 right-0 border-t border-dashed border-slate-200/70 pointer-events-none"
              />
            ))}

            {reportFAgeGroups.map((grp) => {
              const appHeight =
                grp.approved === 0 ? 3 : Math.max(8, Math.round((grp.approved / maxAgeCount) * 100));
              const canHeight =
                grp.cancelled === 0 ? 3 : Math.max(8, Math.round((grp.cancelled / maxAgeCount) * 100));

              return (
                <div
                  key={grp.label}
                  className="flex-1 h-full flex flex-col justify-end items-center group relative"
                >
                  {/* Tooltip on hover */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity z-10 px-2.5 py-1 bg-slate-900 text-white text-[11px] rounded-md shadow-md pointer-events-none whitespace-nowrap">
                    <span className="font-semibold">{grp.label}</span>: {grp.approved} Approved,{' '}
                    {grp.cancelled} Cancel
                  </div>

                  <div className="w-full max-w-[48px] h-[88%] flex items-end justify-center gap-1.5">
                    {/* Approved Bar */}
                    <div
                      style={{ height: `${appHeight}%` }}
                      className="flex-1 bg-emerald-600 group-hover:bg-emerald-500 rounded-t transition-all flex items-start justify-center pt-1"
                    >
                      {grp.approved > 0 && (
                        <span className="text-[10px] text-white font-bold tabular-nums">
                          {grp.approved}
                        </span>
                      )}
                    </div>
                    {/* Cancel Bar */}
                    <div
                      style={{ height: `${canHeight}%` }}
                      className="flex-1 bg-rose-500 group-hover:bg-rose-400 rounded-t transition-all flex items-start justify-center pt-1"
                    >
                      {grp.cancelled > 0 && (
                        <span className="text-[10px] text-white font-bold tabular-nums">
                          {grp.cancelled}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* X Axis Labels */}
          <div className="flex items-center gap-3 sm:gap-6 pt-2 text-center text-[11px] text-slate-600 font-medium">
            {reportFAgeGroups.map((grp) => (
              <div key={grp.label} className="flex-1 truncate">
                {grp.label}
              </div>
            ))}
          </div>
        </div>

        {/* Age Group Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-4">Group Age</th>
                <th className="py-2.5 px-4 text-right text-emerald-600">Total Approved</th>
                <th className="py-2.5 px-4 text-right text-rose-600">Total Cancel</th>
                <th className="py-2.5 px-4 text-right font-bold text-slate-900">Total Applicants</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportFAgeGroups.map((row) => (
                <tr key={row.label} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                    {row.label}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-semibold text-emerald-700">
                    {row.approved}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-semibold text-rose-600">
                    {row.cancelled}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-bold text-slate-900">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/80 font-bold text-xs text-slate-900">
                <td className="py-3 px-4">Total</td>
                <td className="py-3 px-4 text-right tabular-nums text-emerald-700">
                  {reportFAgeGroups.reduce((sum, r) => sum + r.approved, 0)}
                </td>
                <td className="py-3 px-4 text-right tabular-nums text-rose-600">
                  {reportFAgeGroups.reduce((sum, r) => sum + r.cancelled, 0)}
                </td>
                <td className="py-3 px-4 text-right tabular-nums">
                  {reportFAgeGroups.reduce((sum, r) => sum + r.total, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
};
