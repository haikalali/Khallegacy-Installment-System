import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  FileCheck2,
  FileText,
  RefreshCw,
  Building2,
  Tag,
  Clock,
} from 'lucide-react';
import type {
  ActivityEvent,
  Branch,
  DashboardPeriod,
  InstallmentApplication,
  PageId,
  ProductCategory,
  SaleSubmissionList,
} from '../types/khallegacy';
import {
  deriveStockFollowUp,
  filterApplicationsByApprovalDateRange,
  formatDateShort,
  formatDateTime,
  formatRM,
  hasAllProductsStockReady,
  resolveApplicationCategory,
  resolveActualCashPayment,
  isEligibleForAgreementReceipt,
} from '../utils/businessRules';
import { TableSkeleton } from '../components/StateViews';

interface DashboardPageProps {
  applications: InstallmentApplication[];
  branches: Branch[];
  saleSubmissions: SaleSubmissionList[];
  recentActivities: ActivityEvent[];
  onNavigate: (page: PageId) => void;
  onSelectApplication: (appId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  applications,
  branches,
  saleSubmissions,
  recentActivities,
  onNavigate,
  onSelectApplication,
}) => {
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [customStart, setCustomStart] = useState('2026-11-01');
  const [customEnd, setCustomEnd] = useState('2026-11-17');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const periodRange = useMemo(() => {
    if (period === 'today') {
      return { start: '2026-11-17', end: '2026-11-17' };
    }
    if (period === 'week') {
      return { start: '2026-11-11', end: '2026-11-17' };
    }
    if (period === 'month') {
      return { start: '2026-11-01', end: '2026-11-30' };
    }
    if (period === 'year') {
      return { start: '2026-01-01', end: '2026-12-31' };
    }
    return { start: customStart, end: customEnd };
  }, [period, customStart, customEnd]);

  const filteredApps = useMemo(() => {
    return filterApplicationsByApprovalDateRange(
      applications,
      periodRange.start,
      periodRange.end,
    );
  }, [applications, periodRange]);

  const filteredSubmissions = useMemo(() => {
    return saleSubmissions
      .filter((sub) => {
        if (periodRange.start && sub.submissionDate < periodRange.start) return false;
        if (periodRange.end && sub.submissionDate > periodRange.end) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.submissionDate !== b.submissionDate) {
          return b.submissionDate.localeCompare(a.submissionDate);
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [saleSubmissions, periodRange]);

  const totalSubmissionProductAmount = useMemo(
    () => filteredSubmissions.reduce((sum, s) => sum + s.totalProductAmount, 0),
    [filteredSubmissions],
  );

  const totalSubmissionAgreements = useMemo(
    () => filteredSubmissions.reduce((sum, s) => sum + s.agreementCount, 0),
    [filteredSubmissions],
  );

  // Executive Dashboard Metrics
  const totalApproved = useMemo(
    () => filteredApps.filter((a) => a.approvalStatus === 'Approved').length,
    [filteredApps],
  );

  const cancelledCount = useMemo(
    () =>
      filteredApps.filter(
        (a) => deriveStockFollowUp(a).customerDecision === 'CANCELLED',
      ).length,
    [filteredApps],
  );

  const agreementReceivedCount = useMemo(
    () => filteredApps.filter((a) => a.agreement.receivedAt !== null).length,
    [filteredApps],
  );

  const agreementToBeReceiveCount = useMemo(
    () => applications.filter(isEligibleForAgreementReceipt).length,
    [applications],
  );

  // Agreement To Be Receive by Pickup Branch (including virtual branches)
  const branchBreakdown = useMemo(() => {
    const virtualBranchIds = ['POSTAGE', 'WEB'];
    const virtualBranchNames: Record<string, string> = {
      POSTAGE: 'POSTAGE',
      WEB: 'WEB',
    };

    const allBranchList = [
      ...branches.map((b) => ({ id: b.id, name: b.name })),
      ...virtualBranchIds.map((id) => ({ id, name: virtualBranchNames[id] })),
    ];

    return allBranchList
      .map((b) => {
        const branchApps = filteredApps.filter(
          (a) => a.pickupBranchId === b.id,
        );
        const approved = branchApps.filter(
          (a) => a.approvalStatus === 'Approved',
        ).length;
        const passedStock = branchApps.filter(
          (a) =>
            hasAllProductsStockReady(a.products) ||
            a.taskStatus?.passedStock === 'PASSED',
        ).length;
        const received = branchApps.filter(
          (a) => a.agreement.receivedAt !== null,
        ).length;
        const unreceived = branchApps.filter(isEligibleForAgreementReceipt).filter(
          (a) => a.pickupBranchId === b.id,
        ).length;
        return {
          branchId: b.id,
          branchName: b.name,
          approved,
          passedStock,
          received,
          unreceived,
        };
      })
      .filter(
        (r) =>
          r.approved > 0 ||
          r.passedStock > 0 ||
          r.received > 0 ||
          r.unreceived > 0,
      )
      .sort((a, b) => b.approved - a.approved);
  }, [filteredApps, branches]);

  // Summary Category Breakdown
  const categoryBreakdown = useMemo(() => {
    const categories: ProductCategory[] = [
      'Apple',
      'Android',
      'Game&Console',
      'Home Appliance',
    ];
    return categories.map((cat) => {
      const catApps = filteredApps.filter(
        (a) => resolveApplicationCategory(a) === cat,
      );
      const totalApps = catApps.length;
      const approved = catApps.filter(
        (a) => a.approvalStatus === 'Approved',
      ).length;
      const totalFinance = catApps.reduce(
        (sum, a) => sum + a.financing.financingAmount,
        0,
      );
      const totalCash = catApps.reduce(
        (sum, a) => sum + resolveActualCashPayment(a.financing),
        0,
      );
      const totalUnits = catApps.reduce(
        (sum, a) =>
          sum + a.products.reduce((s, p) => s + p.quantity, 0),
        0,
      );
      return {
        category: cat,
        totalApps,
        approved,
        totalFinance,
        totalCash,
        totalUnits,
      };
    });
  }, [filteredApps]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 350);
  };

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Executive Operations Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time tracking of approvals, stock verification, agreement receipt, and category performance
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/80"
            role="tablist"
            aria-label="Dashboard date range"
          >
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' },
                { id: 'year', label: 'This Year' },
                { id: 'custom', label: 'Custom Range' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={period === opt.id}
                onClick={() => setPeriod(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  period === opt.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="Start date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                aria-label="End date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Refresh dashboard data"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {isRefreshing ? (
        <TableSkeleton rows={6} />
      ) : (
        <>
          {/* Top Summary Metric Cards (4 cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Total Approved */}
            <button
              type="button"
              onClick={() => onNavigate('approval-list')}
              className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 transition-colors group shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500 truncate">Total Approved</p>
                  <p className="text-2xl font-semibold text-slate-900 tabular-nums mt-1.5">
                    {totalApproved}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Passed credit review</span>
                <span className="text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  View &rarr;
                </span>
              </div>
            </button>

            {/* 2. Cancelled */}
            <button
              type="button"
              onClick={() => onNavigate('approval-list')}
              className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-red-300 transition-colors group shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500 truncate">Cancelled</p>
                  <p className="text-2xl font-semibold text-rose-600 tabular-nums mt-1.5">
                    {cancelledCount}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <XCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Customer cancelled order</span>
                <span className="text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  View &rarr;
                </span>
              </div>
            </button>

            {/* 3. Agreement Received */}
            <button
              type="button"
              onClick={() => onNavigate('agreement-checking')}
              className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 transition-colors group shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500 truncate">Agreement Received</p>
                  <p className="text-2xl font-semibold text-slate-900 tabular-nums mt-1.5">
                    {agreementReceivedCount}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <FileCheck2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Received TERIMA log</span>
                <span className="text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  View &rarr;
                </span>
              </div>
            </button>

            {/* 4. Agreement To Be Receive */}
            <button
              type="button"
              onClick={() => onNavigate('agreement-management')}
              className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-amber-300 transition-colors group shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500 truncate">Agreement To Be Receive</p>
                  <p className="text-2xl font-semibold text-amber-600 tabular-nums mt-1.5">
                    {agreementToBeReceiveCount}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Stock OK, awaiting TERIMA</span>
                <span className="text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  View &rarr;
                </span>
              </div>
            </button>
          </div>

          {/* Section: Submission List */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-900">Submission List</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('sale-submission')}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
              >
                View Sale Submission &rarr;
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Submission Date</th>
                    <th className="py-2.5 px-4 text-right">Total Product Amount</th>
                    <th className="py-2.5 px-4 text-right">Total Agreement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-400">
                        No sale submission lists created for the selected period.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub) => (
                      <tr
                        key={sub.id}
                        onClick={() => onNavigate('sale-submission')}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 font-medium text-slate-900">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{formatDateShort(sub.submissionDate)}</span>
                            <span className="font-mono-tabular text-[11px] text-slate-500">
                              ({sub.submissionListId})
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-medium text-slate-900">
                          {formatRM(sub.totalProductAmount)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-semibold text-blue-600">
                          {sub.agreementCount}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50/80 font-semibold text-xs text-slate-900">
                    <td className="py-3 px-4 uppercase tracking-wider">TOTAL</td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {formatRM(totalSubmissionProductAmount)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-blue-600">
                      {totalSubmissionAgreements}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Section: Agreement To Be Receive by Pickup Branch */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Agreement To Be Receive by Pickup Branch
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Branch-wise distribution of approved applications, stock passed, and agreement receipt queue
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Branch Name</th>
                    <th className="py-2.5 px-4 text-right">Total Approved</th>
                    <th className="py-2.5 px-4 text-right">Agreement Received</th>
                    <th className="py-2.5 px-4 text-right text-amber-600">Agreement To Be Receive</th>
                    <th className="py-2.5 px-4 text-right text-blue-600">Total Agreement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {branchBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No branch activity records found for the selected period.
                      </td>
                    </tr>
                  ) : (
                    branchBreakdown.map((row) => (
                      <tr key={row.branchId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-900">{row.branchName}</td>
                        <td className="py-3 px-4 text-right tabular-nums font-semibold text-slate-800">
                          {row.approved}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-emerald-600 font-medium">
                          {row.received}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-amber-600 font-semibold">
                          {row.unreceived}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-blue-600 font-medium">
                          {row.passedStock}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {branchBreakdown.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50/80 font-semibold text-xs text-slate-900">
                      <td className="py-3 px-4">Total</td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {branchBreakdown.reduce((sum, r) => sum + r.approved, 0)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-emerald-600">
                        {branchBreakdown.reduce((sum, r) => sum + r.received, 0)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-amber-600">
                        {branchBreakdown.reduce((sum, r) => sum + r.unreceived, 0)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-blue-600">
                        {branchBreakdown.reduce((sum, r) => sum + r.passedStock, 0)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Section: Summary Category */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">Summary Category</h3>
              </div>
              <span className="text-xs text-slate-500">
                Breakdown by Product Category (Apple, Android, Game&amp;Console, Home Appliance)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
              {categoryBreakdown.map((cat) => (
                <div
                  key={cat.category}
                  className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                        {cat.category}
                      </span>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {cat.totalApps} applications
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="text-xs text-slate-500">Approved</span>
                      <span className="text-lg font-bold text-slate-900 tabular-nums">
                        {cat.approved}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-xs text-slate-500">Units Sold</span>
                      <span className="text-sm font-semibold text-slate-800 tabular-nums">
                        {cat.totalUnits}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200/60 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Financing:</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {formatRM(cat.totalFinance)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Actual Cash:</span>
                      <span className="font-semibold text-emerald-600 tabular-nums">
                        {formatRM(cat.totalCash)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4 text-right">Total Applications</th>
                    <th className="py-2.5 px-4 text-right">Approved</th>
                    <th className="py-2.5 px-4 text-right">Total Units</th>
                    <th className="py-2.5 px-4 text-right">Total Financing Amount</th>
                    <th className="py-2.5 px-4 text-right">Total Actual Cash Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {categoryBreakdown.map((row) => (
                    <tr key={row.category} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        {row.category}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-800">
                        {row.totalApps}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-emerald-600">
                        {row.approved}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-800">
                        {row.totalUnits}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-slate-900">
                        {formatRM(row.totalFinance)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-emerald-600">
                        {formatRM(row.totalCash)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50/80 font-semibold text-xs text-slate-900">
                    <td className="py-3 px-4">Overall Total</td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {categoryBreakdown.reduce((sum, r) => sum + r.totalApps, 0)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-emerald-600">
                      {categoryBreakdown.reduce((sum, r) => sum + r.approved, 0)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {categoryBreakdown.reduce((sum, r) => sum + r.totalUnits, 0)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {formatRM(categoryBreakdown.reduce((sum, r) => sum + r.totalFinance, 0))}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-emerald-600">
                      {formatRM(categoryBreakdown.reduce((sum, r) => sum + r.totalCash, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Recent System Activities Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Recent System Activities</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Audit log across approvals, TERIMA receipt, checking, dispatch &amp; JCL confirmation
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('agreement-history')}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
              >
                Full Archive &rarr;
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {recentActivities.slice(0, 6).map((act) => {
                const targetApp = applications.find((a) => a.caseId === act.caseId);
                return (
                  <div
                    key={act.id}
                    className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-900">{act.actionType}</span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        {targetApp ? (
                          <button
                            type="button"
                            onClick={() => onSelectApplication(targetApp.id)}
                            className="font-mono-tabular font-medium text-blue-600 hover:underline"
                          >
                            {act.caseId}
                          </button>
                        ) : (
                          <span className="font-mono-tabular text-slate-600">{act.caseId}</span>
                        )}
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-slate-700 truncate">{act.customerName}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{act.description}</p>
                    </div>

                    <div className="text-[11px] text-slate-500 sm:text-right shrink-0 tabular-nums">
                      <div className="font-medium text-slate-700">{act.staffName}</div>
                      <div>{formatDateTime(act.timestamp)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
