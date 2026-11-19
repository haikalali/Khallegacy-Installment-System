import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Landmark,
  RotateCcw,
  Search,
  Wallet,
} from 'lucide-react';
import type { Branch, InstallmentApplication } from '../types/khallegacy';
import {
  formatDateShort,
  formatRM,
  isAgreementClaimed,
  resolveActualCashPayment,
  resolveClaimDate,
} from '../utils/businessRules';
import { EmptyState, PaginationBar } from '../components/StateViews';

interface ClaimedHistoryPageProps {
  applications: InstallmentApplication[];
  branches: Branch[];
  defaultPageSize: number;
  onExportCsv: (filename: string, rows: string[][]) => void;
  onExportPdf: (
    rows: InstallmentApplication[],
    filterSummary: {
      branchLabel: string;
      startDate: string;
      endDate: string;
      searchTerm: string;
    },
  ) => void;
  onViewDetails: (appId: string) => void;
}

export const ClaimedHistoryPage: React.FC<ClaimedHistoryPageProps> = ({
  applications,
  branches,
  defaultPageSize,
  onExportCsv,
  onExportPdf,
  onViewDetails,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const branchName = (id: string | null) => {
    if (!id) return 'Belum Ditentukan';
    if (id === 'POSTAGE' || id === 'WEB') return id;
    return branches.find((b) => b.id === id)?.name ?? id;
  };

  const claimedApps = useMemo(
    () =>
      applications
        .filter(isAgreementClaimed)
        .sort((a, b) => resolveClaimDate(b).localeCompare(resolveClaimDate(a))),
    [applications],
  );

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return claimedApps.filter((app) => {
      if (branchFilter === 'UNASSIGNED') {
        if (app.pickupBranchId !== null) return false;
      } else if (branchFilter !== 'ALL' && app.pickupBranchId !== branchFilter) {
        return false;
      }

      const claimDate = resolveClaimDate(app);
      if (startDate && claimDate < startDate) return false;
      if (endDate && claimDate > endDate) return false;

      if (q) {
        const productText = app.products
          .map((p) => `${p.productName} ${p.model}`)
          .join(' ')
          .toLowerCase();
        const hit =
          app.customerName.toLowerCase().includes(q) ||
          app.icNumber.toLowerCase().includes(q) ||
          app.caseId.toLowerCase().includes(q) ||
          productText.includes(q) ||
          (app.agreement.invoiceNumber ?? '').toLowerCase().includes(q) ||
          (app.agreement.checkingStaff1 ?? '').toLowerCase().includes(q) ||
          (app.agreement.checkingStaff2 ?? '').toLowerCase().includes(q) ||
          branchName(app.pickupBranchId).toLowerCase().includes(q);
        if (!hit) return false;
      }

      return true;
    });
  }, [claimedApps, branchFilter, startDate, endDate, searchTerm, branches]);

  const summary = useMemo(() => {
    const totalFinance = filtered.reduce((sum, app) => sum + app.financing.financingAmount, 0);
    const totalActual = filtered.reduce(
      (sum, app) => sum + resolveActualCashPayment(app.financing),
      0,
    );
    return {
      count: filtered.length,
      totalFinance,
      totalActual,
    };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  const hasFilters = Boolean(
    searchTerm.trim() || branchFilter !== 'ALL' || startDate || endDate,
  );

  const resetFilters = () => {
    setSearchTerm('');
    setBranchFilter('ALL');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const selectedBranchLabel =
    branchFilter === 'ALL'
      ? 'All Branches'
      : branchFilter === 'UNASSIGNED'
        ? 'Belum Ditentukan'
        : branchName(branchFilter);

  const handleExportCsvClick = () => {
    setExportMenuOpen(false);
    const headers = [
      'No',
      'Nama',
      'Product',
      'Finance Amount (RM)',
      'Deposit (RM)',
      'Stamp Duty Fee (RM)',
      'Processing Fee (RM)',
      'Actual Payment (RM)',
      'Branch Pickup',
      'INVOICE',
      'STAFF 1',
      'STAFF 2',
    ];
    const dataRows = filtered.map((app, index) => {
      const productLabel = app.products
        .map((p) => `${p.productName}${p.quantity > 1 ? ` x${p.quantity}` : ''}`)
        .join(', ');
      const actualPayment = resolveActualCashPayment(app.financing);
      return [
        String(index + 1),
        app.customerName,
        productLabel || '-',
        app.financing.financingAmount.toFixed(2),
        app.financing.deposit.toFixed(2),
        app.financing.stampDutyFee.toFixed(2),
        app.financing.processingFee.toFixed(2),
        actualPayment.toFixed(2),
        branchName(app.pickupBranchId),
        app.agreement.invoiceNumber || '-',
        app.agreement.checkingStaff1 || '-',
        app.agreement.checkingStaff2 || '-',
      ];
    });
    onExportCsv('claimed-history-data.csv', [headers, ...dataRows]);
  };

  const handleExportPdfClick = () => {
    setExportMenuOpen(false);
    onExportPdf(filtered, {
      branchLabel: selectedBranchLabel,
      startDate,
      endDate,
      searchTerm: searchTerm.trim(),
    });
  };

  return (
    <div className="space-y-5">
      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              Total Claimed Agreements
            </p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
              {summary.count}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Completed claims matching active filters
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <FileCheck2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              Total Finance Amount
            </p>
            <p className="text-2xl font-bold text-blue-600 font-mono-tabular mt-1">
              {formatRM(summary.totalFinance)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Aggregate financed value claimed
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              Total Actual Payment
            </p>
            <p className="text-2xl font-bold text-emerald-600 font-mono-tabular mt-1">
              {formatRM(summary.totalActual)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Net payout across claimed agreements
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Export Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-4">
            <label
              htmlFor="claimed-hist-search"
              className="block text-[11px] font-medium text-slate-500 mb-1"
            >
              Search Nama, Product, INVOICE, or Staff
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="claimed-hist-search"
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search nama, product, INVOICE, STAFF..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="claimed-hist-branch"
              className="block text-[11px] font-medium text-slate-500 mb-1"
            >
              Cawangan (Branch Pickup)
            </label>
            <select
              id="claimed-hist-branch"
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Semua Cawangan</option>
              <option value="UNASSIGNED">Belum Ditentukan</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
              <option value="POSTAGE">POSTAGE</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="claimed-hist-start"
              className="block text-[11px] font-medium text-slate-500 mb-1"
            >
              Date From
            </label>
            <input
              id="claimed-hist-start"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs tabular-nums border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="claimed-hist-end"
              className="block text-[11px] font-medium text-slate-500 mb-1"
            >
              Date To
            </label>
            <input
              id="claimed-hist-end"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs tabular-nums border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="lg:col-span-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 rounded-lg whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>

            <div ref={exportRef} className="relative">
              <button
                type="button"
                disabled={filtered.length === 0}
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
                onClick={() => setExportMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Export
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {exportMenuOpen && (
                <div
                  role="menu"
                  aria-label="Export options"
                  className="absolute right-0 mt-1.5 w-40 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleExportPdfClick}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-red-600" />
                    Export PDF
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleExportCsvClick}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    Export CSV
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No claimed agreements found"
          description={
            claimedApps.length === 0
              ? 'Agreements confirmed as Claimed in To Be Claimed will appear here.'
              : 'No claimed records matched your search, branch, or date range filter.'
          }
          actionLabel={hasFilters ? 'Reset Filters' : undefined}
          onAction={hasFilters ? resetFilters : undefined}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wide leading-tight">
                  <th className="py-2.5 pl-2.5 pr-1 whitespace-nowrap">No</th>
                  <th className="py-2.5 px-1">Nama</th>
                  <th className="py-2.5 px-1">Product</th>
                  <th className="py-2.5 px-1 text-right">Finance Amount</th>
                  <th className="py-2.5 px-1 text-right">Deposit</th>
                  <th className="py-2.5 px-1 text-right">Stamp Duty Fee</th>
                  <th className="py-2.5 px-1 text-right">Processing Fee</th>
                  <th className="py-2.5 px-1 text-right">Actual Payment</th>
                  <th className="py-2.5 px-1">Branch Pickup</th>
                  <th className="py-2.5 px-1 whitespace-nowrap">INVOICE</th>
                  <th className="py-2.5 px-1 whitespace-nowrap">STAFF 1</th>
                  <th className="py-2.5 pl-1 pr-2.5 whitespace-nowrap">STAFF 2</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11.5px]">
                {paginated.map((app, idx) => {
                  const rowNo = pageStart + idx + 1;
                  const productSummary = app.products
                    .map((p) => `${p.productName}${p.quantity > 1 ? ` ×${p.quantity}` : ''}`)
                    .join(', ');
                  const actualPayment = resolveActualCashPayment(app.financing);
                  const claimDate = resolveClaimDate(app);

                  return (
                    <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 pl-2.5 pr-1 tabular-nums text-slate-500 whitespace-nowrap">
                        {rowNo}
                      </td>
                      <td className="py-2.5 px-1 max-w-[136px]">
                        <button
                          type="button"
                          onClick={() => onViewDetails(app.id)}
                          title={`${app.customerName} (${app.caseId})`}
                          className="font-medium text-slate-900 hover:text-blue-600 text-left block w-full truncate transition-colors"
                        >
                          {app.customerName}
                        </button>
                        <div className="font-mono-tabular text-[10px] text-slate-500 truncate">
                          {app.caseId} · {formatDateShort(claimDate)}
                        </div>
                      </td>
                      <td className="py-2.5 px-1 max-w-[132px] text-slate-700">
                        <span className="block truncate" title={productSummary}>
                          {productSummary || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-1 text-right whitespace-nowrap font-mono-tabular text-slate-800">
                        {formatRM(app.financing.financingAmount)}
                      </td>
                      <td className="py-2.5 px-1 text-right whitespace-nowrap font-mono-tabular text-slate-700">
                        {formatRM(app.financing.deposit)}
                      </td>
                      <td className="py-2.5 px-1 text-right whitespace-nowrap font-mono-tabular text-slate-700">
                        {formatRM(app.financing.stampDutyFee)}
                      </td>
                      <td className="py-2.5 px-1 text-right whitespace-nowrap font-mono-tabular text-slate-700">
                        {formatRM(app.financing.processingFee)}
                      </td>
                      <td className="py-2.5 px-1 text-right whitespace-nowrap font-mono-tabular font-semibold text-emerald-700">
                        {formatRM(actualPayment)}
                      </td>
                      <td className="py-2.5 px-1 max-w-[96px] text-slate-700">
                        <span className="block truncate" title={branchName(app.pickupBranchId)}>
                          {branchName(app.pickupBranchId)}
                        </span>
                      </td>
                      <td className="py-2.5 px-1 max-w-[92px] font-mono-tabular text-slate-800">
                        <span
                          className="block truncate"
                          title={app.agreement.invoiceNumber || undefined}
                        >
                          {app.agreement.invoiceNumber || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-1 max-w-[92px] text-slate-700">
                        <span
                          className="block truncate"
                          title={app.agreement.checkingStaff1 || undefined}
                        >
                          {app.agreement.checkingStaff1 || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 pl-1 pr-2.5 max-w-[92px] text-slate-700">
                        <span
                          className="block truncate"
                          title={app.agreement.checkingStaff2 || undefined}
                        >
                          {app.agreement.checkingStaff2 || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationBar
            totalItems={filtered.length}
            currentPage={safePage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
};
