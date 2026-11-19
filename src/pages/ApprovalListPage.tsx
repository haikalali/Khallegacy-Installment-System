import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  History,
  RotateCcw,
  Search,
} from 'lucide-react';
import type {
  Branch,
  InstallmentApplication,
  ProductCategory,
  StaffUser,
} from '../types/khallegacy';
import {
  formatDateShort,
  formatDateTime,
  PRODUCT_CATEGORIES,
  resolveApplicationCategory,
} from '../utils/businessRules';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, PaginationBar } from '../components/StateViews';
import { Modal } from '../components/Modal';

interface ApprovalListPageProps {
  applications: InstallmentApplication[];
  branches: Branch[];
  users?: StaffUser[];
  defaultPageSize: number;
  onViewDetails: (appId: string) => void;
}

type SortKey =
  | 'caseId'
  | 'approvalDate'
  | 'icNumber'
  | 'customerName'
  | 'category'
  | 'product'
  | 'customerFromBranchId';

export const ApprovalListPage: React.FC<ApprovalListPageProps> = ({
  applications,
  branches,
  defaultPageSize,
  onViewDetails,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | ProductCategory>('ALL');
  const [origBranchFilter, setOrigBranchFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');

  const [sortKey, setSortKey] = useState<SortKey>('approvalDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const [historyModalApp, setHistoryModalApp] = useState<InstallmentApplication | null>(null);

  const branchName = (id: string | null) => {
    if (!id) return 'Belum Ditentukan';
    if (id === 'POSTAGE') return 'POSTAGE';
    if (id === 'WEB') return 'WEB';
    return branches.find((b) => b.id === id)?.name ?? id;
  };

  const hasWebBranch = useMemo(
    () => applications.some((app) => app.customerFromBranchId === 'WEB'),
    [applications],
  );

  const summary = useMemo(() => {
    let apple = 0;
    let android = 0;
    let gameConsole = 0;
    for (const app of applications) {
      const cat = resolveApplicationCategory(app);
      if (cat === 'Apple') apple += 1;
      else if (cat === 'Android') android += 1;
      else if (cat === 'Game&Console') gameConsole += 1;
    }
    return {
      total: applications.length,
      apple,
      android,
      gameConsole,
    };
  }, [applications]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return applications
      .filter((app) => {
        if (q) {
          const hit =
            app.caseId.toLowerCase().includes(q) ||
            app.customerName.toLowerCase().includes(q) ||
            app.icNumber.toLowerCase().includes(q) ||
            app.phone.toLowerCase().includes(q);
          if (!hit) return false;
        }
        if (categoryFilter !== 'ALL' && resolveApplicationCategory(app) !== categoryFilter) {
          return false;
        }
        if (origBranchFilter !== 'ALL' && app.customerFromBranchId !== origBranchFilter) {
          return false;
        }
        if (dateFilter && app.applicationDate !== dateFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const getSortValue = (app: InstallmentApplication): string => {
          if (sortKey === 'caseId') return app.caseId;
          if (sortKey === 'approvalDate') return app.approvalDate || app.applicationDate;
          if (sortKey === 'icNumber') return app.icNumber;
          if (sortKey === 'customerName') return app.customerName;
          if (sortKey === 'category') return resolveApplicationCategory(app);
          if (sortKey === 'product') return app.products.map((p) => p.productName).join(', ');
          return branchName(app.customerFromBranchId);
        };
        const va = getSortValue(a);
        const vb = getSortValue(b);
        const cmp = va.localeCompare(vb);
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [
    applications,
    searchTerm,
    categoryFilter,
    origBranchFilter,
    dateFilter,
    sortKey,
    sortDir,
    branches,
  ]);

  const paginated = useMemo(() => {
    const safePage = Math.min(currentPage, Math.max(1, Math.ceil(filtered.length / pageSize)));
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('ALL');
    setOrigBranchFilter('ALL');
    setDateFilter('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-5">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => {
            setCategoryFilter('ALL');
            setCurrentPage(1);
          }}
          className={`text-left bg-white border rounded-xl p-4 transition-colors ${
            categoryFilter === 'ALL'
              ? 'border-blue-500 ring-1 ring-blue-500/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <p className="text-xs font-medium text-slate-500">Total Applications</p>
          <p className="text-2xl font-semibold text-slate-900 tabular-nums mt-1">
            {summary.total}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setCategoryFilter('Apple');
            setCurrentPage(1);
          }}
          className={`text-left bg-white border rounded-xl p-4 transition-colors ${
            categoryFilter === 'Apple'
              ? 'border-slate-700 ring-1 ring-slate-700/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <p className="text-xs font-medium text-slate-500">Category - Apple</p>
          <p className="text-2xl font-semibold text-slate-900 tabular-nums mt-1">
            {summary.apple}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setCategoryFilter('Android');
            setCurrentPage(1);
          }}
          className={`text-left bg-white border rounded-xl p-4 transition-colors ${
            categoryFilter === 'Android'
              ? 'border-emerald-500 ring-1 ring-emerald-500/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <p className="text-xs font-medium text-slate-500">Category - Android</p>
          <p className="text-2xl font-semibold text-emerald-600 tabular-nums mt-1">
            {summary.android}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setCategoryFilter('Game&Console');
            setCurrentPage(1);
          }}
          className={`text-left bg-white border rounded-xl p-4 transition-colors ${
            categoryFilter === 'Game&Console'
              ? 'border-blue-500 ring-1 ring-blue-500/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <p className="text-xs font-medium text-slate-500">Category - Game&amp;Console</p>
          <p className="text-2xl font-semibold text-blue-600 tabular-nums mt-1">
            {summary.gameConsole}
          </p>
        </button>
      </div>

      {/* Filters Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div className="sm:col-span-2 lg:col-span-2 relative">
            <label
              htmlFor="approval-search"
              className="block text-[11px] font-medium text-slate-500 mb-1"
            >
              Search CASE ID, Customer Name, IC, or Phone
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="approval-search"
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="e.g. KHL-2026-0841, Amirul, 970514, 012..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="category-filter"
              className="block text-[11px] font-medium text-slate-500 mb-1"
            >
              Category
            </label>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value as 'ALL' | ProductCategory);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Categories</option>
              {PRODUCT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="orig-branch-filter"
              className="block text-[11px] font-medium text-slate-500 mb-1"
            >
              Original Branch
            </label>
            <select
              id="orig-branch-filter"
              value={origBranchFilter}
              onChange={(e) => {
                setOrigBranchFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Original Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
              {hasWebBranch && <option value="WEB">WEB</option>}
            </select>
          </div>

          <div>
            <label
              htmlFor="app-date-filter"
              className="block text-[11px] font-medium text-slate-500 mb-1"
            >
              Application Date
            </label>
            <input
              id="app-date-filter"
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-start lg:justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No matching applications found"
          description="Try clearing or adjusting your CASE ID, customer name, IC, phone, category, original branch, or application date filters."
          actionLabel="Reset All Filters"
          onAction={resetFilters}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 pl-3 pr-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('caseId')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      CASE ID <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('approvalDate')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      APPROVAL DATE <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('icNumber')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      IC NUMBER <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('customerName')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      CUSTOMER NAME <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('category')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      CATEGORY <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('product')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      PRODUCT <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('customerFromBranchId')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      CUSTOMER FROM BRANCH <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 pl-1.5 pr-3 text-right whitespace-nowrap">ACTION BUTTON</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginated.map((app) => {
                  const category = resolveApplicationCategory(app);
                  const primaryProduct = app.products[0]?.productName ?? '—';
                  const extraCount = Math.max(0, app.products.length - 1);
                  const productTooltip =
                    app.products.length > 0
                      ? app.products
                          .map((p) => `${p.productName}${p.model ? ` (${p.model})` : ''}`)
                          .join(', ')
                      : 'No product';

                  return (
                    <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 pl-3 pr-1.5 whitespace-nowrap font-mono-tabular font-semibold text-blue-600">
                        <button
                          type="button"
                          onClick={() => onViewDetails(app.id)}
                          className="hover:underline"
                        >
                          {app.caseId}
                        </button>
                      </td>
                      <td
                        className="py-3 px-1.5 whitespace-nowrap tabular-nums text-slate-600"
                        title={`Application Date: ${formatDateShort(app.applicationDate)}`}
                      >
                        {app.approvalDate ? (
                          formatDateShort(app.approvalDate)
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-1.5 whitespace-nowrap font-mono-tabular text-slate-600">
                        {app.icNumber}
                      </td>
                      <td
                        className="py-3 px-1.5 whitespace-nowrap font-medium text-slate-900 max-w-[160px] truncate"
                        title={app.customerName}
                      >
                        {app.customerName}
                      </td>
                      <td className="py-3 px-1.5 whitespace-nowrap">
                        <StatusBadge status={category} compact />
                      </td>
                      <td
                        className="py-3 px-1.5 whitespace-nowrap text-slate-700 max-w-[180px] truncate"
                        title={productTooltip}
                      >
                        {extraCount > 0 ? `${primaryProduct} (+${extraCount})` : primaryProduct}
                      </td>
                      <td
                        className="py-3 px-1.5 whitespace-nowrap text-slate-700 max-w-[130px] truncate"
                        title={branchName(app.customerFromBranchId)}
                      >
                        {branchName(app.customerFromBranchId)}
                      </td>
                      <td className="py-3 pl-1.5 pr-3 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => setHistoryModalApp(app)}
                          aria-label={`View application history for ${app.caseId}`}
                          title="View Application History"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>History</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationBar
            totalItems={filtered.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      )}

      {/* Application History Quick Modal */}
      <Modal
        open={Boolean(historyModalApp)}
        onClose={() => setHistoryModalApp(null)}
        title="Application Activity History"
        subtitle={
          historyModalApp
            ? `${historyModalApp.caseId} · ${historyModalApp.customerName}`
            : undefined
        }
        maxWidthClass="max-w-xl"
      >
        {historyModalApp && (
          <ol className="space-y-4">
            {historyModalApp.timeline.map((evt) => (
              <li key={evt.id} className="flex gap-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                <div className="flex-1 pb-3 border-b border-slate-100 last:border-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{evt.actionType}</span>
                    <span className="tabular-nums text-[11px] text-slate-500">
                      {formatDateTime(evt.timestamp)}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5">{evt.description}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Staff: {evt.staffName}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Modal>
    </div>
  );
};
