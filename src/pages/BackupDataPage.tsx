import React, { useMemo, useState } from 'react';
import { Download, RotateCcw, Search } from 'lucide-react';
import type { Branch, InstallmentApplication } from '../types/khallegacy';
import {
  deriveStockFollowUp,
  deriveTaskStatus,
  formatDateShort,
  resolveApplicationCategory,
} from '../utils/businessRules';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, PaginationBar } from '../components/StateViews';

interface BackupDataPageProps {
  applications: InstallmentApplication[];
  branches: Branch[];
  defaultPageSize: number;
  onExportCsv: (filename: string, rows: string[][]) => void;
}

const NOW = new Date();
const DEFAULT_CURRENT_YEAR = String(NOW.getFullYear());
const DEFAULT_CURRENT_MONTH = String(NOW.getMonth() + 1).padStart(2, '0');

const MONTH_NAMES: { value: string; label: string }[] = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

export const BackupDataPage: React.FC<BackupDataPageProps> = ({
  applications,
  branches,
  defaultPageSize,
  onExportCsv,
}) => {
  const [monthFilter, setMonthFilter] = useState(DEFAULT_CURRENT_MONTH);
  const [yearFilter, setYearFilter] = useState(DEFAULT_CURRENT_YEAR);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const branchLabel = (id: string | null) => {
    if (!id) return 'Belum Ditentukan';
    if (id === 'POSTAGE') return 'POSTAGE';
    if (id === 'WEB') return 'WEB';
    return branches.find((b) => b.id === id)?.name ?? id;
  };

  const yearOptions = useMemo(() => {
    const years = new Set<string>([DEFAULT_CURRENT_YEAR]);
    applications.forEach((app) => {
      const dateStr = app.approvalDate || app.applicationDate;
      const y = dateStr.slice(0, 4);
      if (y) years.add(y);
    });
    return Array.from(years).sort().reverse();
  }, [applications]);

  const records = useMemo(() => {
    return applications
      .map((app) => {
        const approvalDate = app.approvalDate || app.applicationDate;
        const followUp = deriveStockFollowUp(app);
        const taskStatus = deriveTaskStatus(app);
        const category = resolveApplicationCategory(app);
        const productText =
          app.products
            .map((p) => (p.quantity > 1 ? `${p.productName} (x${p.quantity})` : p.productName))
            .join(', ') || '—';

        const colorList = app.products
          .map((p, idx) => {
            if (idx === 0) return followUp.colour || p.model;
            if (idx === 1) return followUp.colour2 || p.model;
            if (idx === 2) return followUp.colour3 || p.model;
            return p.model;
          })
          .map((c) => (c || '').trim())
          .filter(Boolean);
        const colorText = colorList.length > 0 ? colorList.join(', ') : '—';

        const uniquePassDates = Array.from(
          new Set(
            app.products
              .map((p) => p.datePassStock)
              .filter((d): d is string => Boolean(d)),
          ),
        );

        const isAgreementReceived =
          Boolean(app.agreement.receivedAt) || taskStatus.agreementReceived === 'RECEIVED';

        const stockStatusText =
          followUp.customerDecision === 'CANCELLED' ? 'CANCELLED' : followUp.stockStage;

        const remarksText =
          (followUp.remark || app.approvalRemarks || app.applicationRemarks || '').trim() || '—';

        return {
          app,
          approvalDate,
          fromBranch: branchLabel(app.customerFromBranchId),
          pickupBranch: branchLabel(app.pickupBranchId),
          category,
          productText,
          colorText,
          stockStatusText,
          remarksText,
          uniquePassDates,
          isAgreementReceived,
          receivedStatusText: isAgreementReceived ? 'RECEIVED' : 'NOT YET',
        };
      })
      .sort((a, b) => b.approvalDate.localeCompare(a.approvalDate));
  }, [applications, branches]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return records.filter((rec) => {
      const [y, m] = (rec.approvalDate || '').slice(0, 7).split('-');
      if (yearFilter && y !== yearFilter) return false;
      if (monthFilter && m !== monthFilter) return false;
      if (q) {
        const hit =
          rec.app.customerName.toLowerCase().includes(q) ||
          rec.app.icNumber.toLowerCase().includes(q) ||
          rec.app.caseId.toLowerCase().includes(q) ||
          rec.productText.toLowerCase().includes(q) ||
          rec.fromBranch.toLowerCase().includes(q) ||
          rec.pickupBranch.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [records, yearFilter, monthFilter, searchTerm]);

  const safePage = Math.min(currentPage, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const resetFilters = () => {
    setMonthFilter(DEFAULT_CURRENT_MONTH);
    setYearFilter(DEFAULT_CURRENT_YEAR);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleDownloadCsv = () => {
    const headers = [
      'FROM BRANCH',
      'APPROVAL DATE',
      'IC NUMBER',
      'NAMA CUSTOMER',
      'CATEGORY',
      'PRODUCT',
      'COLOR',
      'PICKUP BRANCH',
      'STOCK STATUS',
      'REMARKS',
      'DATE PASS STOCK',
      'RECEIVED AGREEMENT ?',
    ];

    const dataRows = filtered.map((rec) => [
      rec.fromBranch,
      rec.approvalDate || '-',
      rec.app.icNumber || '-',
      rec.app.customerName,
      rec.category,
      rec.productText === '—' ? '-' : rec.productText,
      rec.colorText === '—' ? '-' : rec.colorText,
      rec.pickupBranch,
      rec.stockStatusText,
      rec.remarksText === '—' ? '-' : rec.remarksText,
      rec.uniquePassDates.length > 0 ? rec.uniquePassDates.join(', ') : '-',
      rec.receivedStatusText,
    ]);

    const yearSlug = yearFilter || 'all-years';
    const monthSlug = monthFilter || 'all-months';
    onExportCsv(`backup-data-${yearSlug}-${monthSlug}.csv`, [headers, ...dataRows]);
  };

  const activePeriodLabel = `${
    monthFilter ? MONTH_NAMES.find((m) => m.value === monthFilter)?.label ?? monthFilter : 'All Months'
  } ${yearFilter || 'All Years'}`;

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">Backup Data Permohonan</h2>
          <p className="text-xs text-slate-500 mt-1">
            <span>{activePeriodLabel}</span>
            <span className="mx-1.5" aria-hidden="true">
              ·
            </span>
            <span className="tabular-nums font-medium text-slate-700">
              {filtered.length} rekod
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-3">
            <label
              htmlFor="backup-month-filter"
              className="block text-[11px] font-medium text-slate-500 mb-1"
            >
              Month
            </label>
            <select
              id="backup-month-filter"
              value={monthFilter}
              onChange={(e) => {
                setMonthFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Months</option>
              {MONTH_NAMES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="backup-year-filter"
              className="block text-[11px] font-medium text-slate-500 mb-1"
            >
              Year
            </label>
            <select
              id="backup-year-filter"
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 tabular-nums focus:outline-none focus:border-blue-500"
            >
              <option value="">All Years</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-5">
            <label
              htmlFor="backup-search-input"
              className="block text-[11px] font-medium text-slate-500 mb-1"
            >
              Search Record
            </label>
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="backup-search-input"
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari Nama Customer, IC Number, Produk, atau Cawangan..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="lg:col-span-2 flex justify-start lg:justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="Tiada rekod Backup Data ditemui"
          description="Tiada data permohonan sepadan dengan pilihan bulan, tahun, atau carian semasa."
          actionLabel="Show All Months & Years"
          onAction={() => {
            setMonthFilter('');
            setYearFilter('');
            setSearchTerm('');
            setCurrentPage(1);
          }}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 pl-4 pr-2 whitespace-nowrap">FROM BRANCH</th>
                  <th className="py-3 px-2 whitespace-nowrap">APPROVAL DATE</th>
                  <th className="py-3 px-2 whitespace-nowrap">IC NUMBER</th>
                  <th className="py-3 px-2 whitespace-nowrap">NAMA CUSTOMER</th>
                  <th className="py-3 px-2 whitespace-nowrap">CATEGORY</th>
                  <th className="py-3 px-2 whitespace-nowrap">PRODUCT</th>
                  <th className="py-3 px-2 whitespace-nowrap">COLOR</th>
                  <th className="py-3 px-2 whitespace-nowrap">PICKUP BRANCH</th>
                  <th className="py-3 px-2 whitespace-nowrap">STOCK STATUS</th>
                  <th className="py-3 px-2 whitespace-nowrap">REMARKS</th>
                  <th className="py-3 px-2 whitespace-nowrap">DATE PASS STOCK</th>
                  <th className="py-3 pl-2 pr-4 whitespace-nowrap">RECEIVED AGREEMENT ?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginated.map((rec) => (
                  <tr key={rec.app.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 pl-4 pr-2 whitespace-nowrap text-slate-700 font-medium">
                      {rec.fromBranch}
                    </td>
                    <td className="py-3 px-2 whitespace-nowrap tabular-nums text-slate-600">
                      {rec.approvalDate ? formatDateShort(rec.approvalDate) : '—'}
                    </td>
                    <td className="py-3 px-2 whitespace-nowrap font-mono-tabular text-slate-700">
                      {rec.app.icNumber || '—'}
                    </td>
                    <td className="py-3 px-2 whitespace-nowrap font-medium text-slate-900">
                      {rec.app.customerName}
                    </td>
                    <td className="py-3 px-2 whitespace-nowrap text-slate-700">{rec.category}</td>
                    <td
                      className="py-3 px-2 whitespace-nowrap text-slate-700 max-w-[220px] truncate"
                      title={rec.productText}
                    >
                      {rec.productText}
                    </td>
                    <td
                      className="py-3 px-2 whitespace-nowrap text-slate-700 max-w-[140px] truncate"
                      title={rec.colorText}
                    >
                      {rec.colorText}
                    </td>
                    <td className="py-3 px-2 whitespace-nowrap text-slate-700">
                      {rec.pickupBranch}
                    </td>
                    <td className="py-3 px-2 whitespace-nowrap">
                      <StatusBadge status={rec.stockStatusText} compact />
                    </td>
                    <td
                      className="py-3 px-2 whitespace-nowrap text-slate-600 max-w-[200px] truncate"
                      title={rec.remarksText}
                    >
                      {rec.remarksText}
                    </td>
                    <td className="py-3 px-2 whitespace-nowrap tabular-nums text-slate-600">
                      {rec.uniquePassDates.length > 0
                        ? rec.uniquePassDates.map((d) => formatDateShort(d)).join(', ')
                        : '—'}
                    </td>
                    <td className="py-3 pl-2 pr-4 whitespace-nowrap">
                      <StatusBadge
                        status={rec.receivedStatusText}
                        tone={rec.isAgreementReceived ? 'green' : 'slate'}
                        compact
                      />
                    </td>
                  </tr>
                ))}
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
