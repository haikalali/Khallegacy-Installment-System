import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  Download,
  Eye,
  FileCheck2,
  ListChecks,
  PlusCircle,
  RotateCcw,
  Search,
  Wallet,
} from 'lucide-react';
import type {
  Branch,
  InstallmentApplication,
  SaleSubmissionList,
} from '../types/khallegacy';
import {
  formatDateShort,
  formatRM,
  generateUniqueSubmissionListId,
  isEligibleForSaleSubmission,
  resolveActualCashPayment,
  SYSTEM_TODAY_DATE,
} from '../utils/businessRules';
import { EmptyState, PaginationBar } from '../components/StateViews';
import { Modal } from '../components/Modal';
import { SubmissionListDetailModal } from '../components/SubmissionListDetailModal';

interface SaleSubmissionPageProps {
  applications: InstallmentApplication[];
  branches: Branch[];
  submissionLists: SaleSubmissionList[];
  canSubmit: boolean;
  defaultPageSize: number;
  onCreateSubmissionList: (payload: {
    submissionListId: string;
    submissionDate: string;
    agreementIds: string[];
    remarks: string;
  }) => boolean;
  onExportCsv: (filename: string, rows: string[][]) => void;
  onDownloadSubmissionPdf: (submission: SaleSubmissionList) => void;
  onViewDetails: (appId: string) => void;
}

export const SaleSubmissionPage: React.FC<SaleSubmissionPageProps> = ({
  applications,
  branches,
  submissionLists,
  canSubmit,
  defaultPageSize,
  onCreateSubmissionList,
  onExportCsv,
  onDownloadSubmissionPdf,
  onViewDetails,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Create Submission List Card modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submissionDate, setSubmissionDate] = useState(SYSTEM_TODAY_DATE);
  const [submissionRemarks, setSubmissionRemarks] = useState('');
  const [modalError, setModalError] = useState('');

  // View Created Submission List Detail modal
  const [viewingSubmission, setViewingSubmission] = useState<SaleSubmissionList | null>(null);

  const toBeSubmittedApps = useMemo(
    () => applications.filter(isEligibleForSaleSubmission),
    [applications],
  );

  // Summary card metrics for Agreement To Be Submit queue
  const queueTotals = useMemo(() => {
    const totalProductAmount = toBeSubmittedApps.reduce(
      (sum, app) => sum + app.financing.totalProductPrice,
      0,
    );
    const totalActualCashPayment = toBeSubmittedApps.reduce(
      (sum, app) => sum + resolveActualCashPayment(app.financing),
      0,
    );
    return {
      count: toBeSubmittedApps.length,
      totalProductAmount,
      totalActualCashPayment,
    };
  }, [toBeSubmittedApps]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return toBeSubmittedApps.filter((app) => {
      if (branchFilter === 'UNASSIGNED') {
        if (app.pickupBranchId !== null) return false;
      } else if (branchFilter !== 'ALL' && app.pickupBranchId !== branchFilter) {
        return false;
      }
      if (q) {
        const productText = app.products
          .map((p) => `${p.productName} ${p.model}`)
          .join(' ')
          .toLowerCase();
        const hit =
          app.caseId.toLowerCase().includes(q) ||
          app.customerName.toLowerCase().includes(q) ||
          app.icNumber.toLowerCase().includes(q) ||
          productText.includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [toBeSubmittedApps, branchFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  const validSelectedIdSet = useMemo(() => {
    const eligibleSet = new Set(toBeSubmittedApps.map((a) => a.id));
    return new Set(selectedIds.filter((id) => eligibleSet.has(id)));
  }, [selectedIds, toBeSubmittedApps]);

  const selectedApps = useMemo(
    () => toBeSubmittedApps.filter((app) => validSelectedIdSet.has(app.id)),
    [toBeSubmittedApps, validSelectedIdSet],
  );

  const selectedSummary = useMemo(() => {
    const totalProductAmount = selectedApps.reduce(
      (sum, a) => sum + a.financing.totalProductPrice,
      0,
    );
    const totalFinanceAmount = selectedApps.reduce(
      (sum, a) => sum + a.financing.financingAmount,
      0,
    );
    const totalActualCashPayment = selectedApps.reduce(
      (sum, a) => sum + resolveActualCashPayment(a.financing),
      0,
    );
    return {
      count: selectedApps.length,
      totalProductAmount,
      totalFinanceAmount,
      totalActualCashPayment,
    };
  }, [selectedApps]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((app) => validSelectedIdSet.has(app.id));

  const toggleSelectOne = (appId: string) => {
    setSelectedIds((prev) =>
      prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId],
    );
  };

  const toggleSelectAllFiltered = () => {
    const filteredIds = filtered.map((a) => a.id);
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredIds);
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const generatedSubmissionListId = useMemo(
    () => generateUniqueSubmissionListId(submissionDate, submissionLists),
    [submissionDate, submissionLists],
  );

  const openCreateCard = () => {
    if (selectedApps.length === 0) return;
    setSubmissionDate(SYSTEM_TODAY_DATE);
    setSubmissionRemarks('');
    setModalError('');
    setCreateModalOpen(true);
  };

  const handleConfirmCreate = () => {
    if (!submissionDate.trim()) {
      setModalError('Sila pilih tarikh submission creation.');
      return;
    }
    if (selectedApps.length === 0) {
      setModalError('Tiada agreement dipilih.');
      return;
    }

    const ok = onCreateSubmissionList({
      submissionListId: generatedSubmissionListId,
      submissionDate,
      agreementIds: selectedApps.map((a) => a.id),
      remarks: submissionRemarks,
    });
    if (ok) {
      setSelectedIds([]);
      setCreateModalOpen(false);
    }
  };

  const hasFilters = Boolean(searchTerm.trim() || branchFilter !== 'ALL');

  return (
    <div className="space-y-6">
      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Agreement To Be Submit</p>
            <FileCheck2 className="w-4 h-4 text-blue-600" aria-hidden="true" />
          </div>
          <p className="text-2xl font-semibold text-blue-600 tabular-nums mt-1.5">
            {queueTotals.count}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Agreements passed checking &amp; pending submission list
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Total Product Amount (RM)</p>
            <ListChecks className="w-4 h-4 text-slate-700" aria-hidden="true" />
          </div>
          <p className="text-2xl font-semibold text-slate-900 font-mono-tabular mt-1.5">
            {formatRM(queueTotals.totalProductAmount)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Aggregate product price across agreements to submit
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Total Actual Cash Payment (RM)</p>
            <Wallet className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          </div>
          <p className="text-2xl font-semibold text-emerald-600 font-mono-tabular mt-1.5">
            {formatRM(queueTotals.totalActualCashPayment)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Net cash payout total for eligible agreements
          </p>
        </div>
      </div>

      {/* Filters & Create Submission List Action Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 flex-1">
            <div className="sm:col-span-2 lg:col-span-2">
              <label
                htmlFor="sale-sub-search"
                className="block text-[11px] font-medium text-slate-500 mb-1"
              >
                Search IC Number, Customer Name, CASE ID, or Product
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="sale-sub-search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="e.g. 950218-10-5042, KHL-2026-0824, iPhone 16 Pro..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="sale-sub-branch"
                className="block text-[11px] font-medium text-slate-500 mb-1"
              >
                Pickup Branch
              </label>
              <select
                id="sale-sub-branch"
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Pickup Branches</option>
                <option value="UNASSIGNED">Belum Ditentukan</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
                <option value="POSTAGE">POSTAGE</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setBranchFilter('ALL');
                  setCurrentPage(1);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Filters
              </button>
            )}

            {selectedSummary.count > 0 && (
              <span className="text-xs text-slate-600 font-mono-tabular whitespace-nowrap">
                <strong className="text-slate-900">{selectedSummary.count}</strong> selected ·{' '}
                <strong className="text-blue-600">
                  {formatRM(selectedSummary.totalActualCashPayment)}
                </strong>
              </span>
            )}

            <button
              type="button"
              disabled={!canSubmit || selectedSummary.count === 0}
              onClick={openCreateCard}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Create Submission List
            </button>
          </div>
        </div>
      </div>

      {/* Main Table: Agreements To Be Submitted */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No agreements pending sale submission"
          description={
            toBeSubmittedApps.length === 0
              ? 'All Checking Passed agreements have already been included in a Submission List or dispatched.'
              : 'No agreements match your current search or pickup branch filter.'
          }
          actionLabel={hasFilters ? 'Reset Filters' : undefined}
          onAction={
            hasFilters
              ? () => {
                  setSearchTerm('');
                  setBranchFilter('ALL');
                  setCurrentPage(1);
                }
              : undefined
          }
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 pl-3 pr-1.5 whitespace-nowrap">No</th>
                  <th className="py-3 px-1.5 whitespace-nowrap">IC Number</th>
                  <th className="py-3 px-1.5 whitespace-nowrap">Product</th>
                  <th className="py-3 px-1.5 text-right whitespace-nowrap">Total Product Price</th>
                  <th className="py-3 px-1.5 text-right whitespace-nowrap">Deposit</th>
                  <th className="py-3 px-1.5 text-right whitespace-nowrap">Stamp Duty Fee</th>
                  <th className="py-3 px-1.5 text-right whitespace-nowrap">Processing Fee + SST</th>
                  <th className="py-3 px-1.5 text-right whitespace-nowrap">Actual Cash Payment</th>
                  <th className="py-3 pl-1.5 pr-3 text-center whitespace-nowrap">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        aria-label="Select all agreements in list"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Select Checklist</span>
                    </label>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginated.map((app, idx) => {
                  const isSelected = validSelectedIdSet.has(app.id);
                  const primaryProduct = app.products[0]?.productName ?? '—';
                  const extraCount = Math.max(0, app.products.length - 1);
                  const productTooltip = app.products
                    .map((p) => `${p.productName}${p.model ? ` (${p.model})` : ''}`)
                    .join(', ');
                  const actualCash = resolveActualCashPayment(app.financing);
                  const processingFeeWithSst = app.financing.processingFee + app.financing.sstAmount;

                  return (
                    <tr
                      key={app.id}
                      onClick={() => toggleSelectOne(app.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/50 hover:bg-blue-50/70' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3 pl-3 pr-1.5 whitespace-nowrap tabular-nums text-slate-500">
                        {pageStart + idx + 1}
                      </td>
                      <td
                        className="py-3 px-1.5 whitespace-nowrap font-mono-tabular text-slate-800 max-w-[165px]"
                        title={`${app.icNumber} · ${app.caseId} · ${app.customerName}`}
                      >
                        <div>{app.icNumber}</div>
                        <div className="text-[10.5px] text-slate-500 truncate">
                          {app.caseId} · {app.customerName}
                        </div>
                      </td>
                      <td
                        className="py-3 px-1.5 whitespace-nowrap text-slate-700 max-w-[160px] truncate"
                        title={productTooltip}
                      >
                        {extraCount > 0 ? `${primaryProduct} (+${extraCount})` : primaryProduct}
                      </td>
                      <td className="py-3 px-1.5 whitespace-nowrap text-right font-mono-tabular text-slate-700">
                        {formatRM(app.financing.totalProductPrice)}
                      </td>
                      <td className="py-3 px-1.5 whitespace-nowrap text-right font-mono-tabular text-slate-700">
                        {formatRM(app.financing.deposit)}
                      </td>
                      <td className="py-3 px-1.5 whitespace-nowrap text-right font-mono-tabular text-slate-700">
                        {formatRM(app.financing.stampDutyFee)}
                      </td>
                      <td className="py-3 px-1.5 whitespace-nowrap text-right font-mono-tabular text-slate-700">
                        {formatRM(processingFeeWithSst)}
                      </td>
                      <td className="py-3 px-1.5 whitespace-nowrap text-right font-mono-tabular font-semibold text-blue-700">
                        {formatRM(actualCash)}
                      </td>
                      <td
                        className="py-3 pl-1.5 pr-3 whitespace-nowrap text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select ${app.caseId} (${app.icNumber})`}
                          checked={isSelected}
                          onChange={() => toggleSelectOne(app.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
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

      {/* Created Submission Lists Section */}
      {submissionLists.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Created Submission Lists</h2>
              <p className="text-xs text-slate-500">
                Batches generated from verified agreements with unique Submission List IDs.
              </p>
            </div>
            <span className="text-xs text-slate-500 tabular-nums">
              {submissionLists.length} batch{submissionLists.length === 1 ? '' : 'es'}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 pl-4 pr-2 whitespace-nowrap">ID Submission List</th>
                    <th className="py-3 px-2.5 whitespace-nowrap">Submission Date</th>
                    <th className="py-3 px-2.5 text-right whitespace-nowrap">Agreements Selected</th>
                    <th className="py-3 px-2.5 text-right whitespace-nowrap">Total Product Amount</th>
                    <th className="py-3 px-2.5 text-right whitespace-nowrap">Total Actual Cash Payment</th>
                    <th className="py-3 px-2.5 whitespace-nowrap">Created By</th>
                    <th className="py-3 pl-2.5 pr-4 text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {submissionLists.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 pl-4 pr-2 whitespace-nowrap font-mono-tabular font-semibold text-blue-600">
                        {sub.submissionListId}
                      </td>
                      <td className="py-3 px-2.5 whitespace-nowrap tabular-nums text-slate-700">
                        {formatDateShort(sub.submissionDate)}
                      </td>
                      <td className="py-3 px-2.5 whitespace-nowrap text-right tabular-nums font-medium text-slate-900">
                        {sub.agreementCount}
                      </td>
                      <td className="py-3 px-2.5 whitespace-nowrap text-right font-mono-tabular text-slate-700">
                        {formatRM(sub.totalProductAmount)}
                      </td>
                      <td className="py-3 px-2.5 whitespace-nowrap text-right font-mono-tabular font-semibold text-emerald-700">
                        {formatRM(sub.totalActualCashPayment)}
                      </td>
                      <td className="py-3 px-2.5 whitespace-nowrap text-slate-700">
                        {sub.createdBy}
                      </td>
                      <td className="py-3 pl-2.5 pr-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingSubmission(sub)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => onDownloadSubmissionPdf(sub)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-md transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Create Submission List Card Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Submission List"
        subtitle="Review batch metadata and summary totals before creating the Sale Submission List."
        maxWidthClass="max-w-3xl"
        footer={
          <div className="w-full flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500">
              {selectedSummary.count} agreement{selectedSummary.count === 1 ? '' : 's'} will be locked into{' '}
              <strong className="font-mono-tabular text-slate-800">{generatedSubmissionListId}</strong>
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSubmit || selectedSummary.count === 0}
                onClick={handleConfirmCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg transition-colors"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Confirm &amp; Create Submission List
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-5 text-xs">
          {modalError && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 font-medium"
            >
              {modalError}
            </div>
          )}

          {/* ID Submission List + Submission Creation Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="submission-list-id"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                ID Submission List <span className="font-normal text-slate-400">(Auto-generated &amp; Unique)</span>
              </label>
              <input
                id="submission-list-id"
                type="text"
                readOnly
                value={generatedSubmissionListId}
                className="w-full px-3 py-2 text-xs font-mono-tabular font-semibold border border-slate-200 rounded-lg bg-slate-50 text-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="submission-creation-date"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Submission Creation Date
              </label>
              <input
                id="submission-creation-date"
                type="date"
                value={submissionDate}
                onChange={(e) => {
                  setSubmissionDate(e.target.value);
                  setModalError('');
                }}
                className="w-full px-3 py-2 text-xs tabular-nums border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              />
            </div>
          </div>

          {/* Card Summary: Selected Agreements & Actual Cash Payment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-[11px] font-medium text-slate-500">Total Agreement Selected</p>
              <p className="text-xl font-semibold text-slate-900 tabular-nums mt-1">
                {selectedSummary.count} Agreement{selectedSummary.count === 1 ? '' : 's'}
              </p>
            </div>

            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
              <p className="text-[11px] font-medium text-emerald-700">Total Actual Cash Payment</p>
              <p className="text-xl font-semibold text-emerald-700 font-mono-tabular mt-1">
                {formatRM(selectedSummary.totalActualCashPayment)}
              </p>
            </div>
          </div>

          {/* Selected Agreements Preview Table */}
          <div>
            <p className="text-[11px] font-semibold text-slate-700 mb-2">
              Selected Agreements ({selectedSummary.count})
            </p>
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-2 pl-3 pr-2">No</th>
                    <th className="py-2 px-2">CASE ID</th>
                    <th className="py-2 px-2">IC Number</th>
                    <th className="py-2 px-2">Product</th>
                    <th className="py-2 pl-2 pr-3 text-right">Actual Cash Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {selectedApps.map((app, idx) => (
                    <tr key={app.id}>
                      <td className="py-2 pl-3 pr-2 tabular-nums text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-2 font-mono-tabular font-semibold text-blue-600">
                        {app.caseId}
                      </td>
                      <td className="py-2 px-2 font-mono-tabular text-slate-700">
                        {app.icNumber}
                      </td>
                      <td className="py-2 px-2 text-slate-700 max-w-[190px] truncate">
                        {app.products.map((p) => p.productName).join(', ')}
                      </td>
                      <td className="py-2 pl-2 pr-3 text-right font-mono-tabular font-semibold text-slate-900">
                        {formatRM(resolveActualCashPayment(app.financing))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Optional Remarks */}
          <div>
            <label
              htmlFor="submission-remarks"
              className="block text-[11px] font-semibold text-slate-700 mb-1"
            >
              Remarks <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <textarea
              id="submission-remarks"
              rows={2}
              value={submissionRemarks}
              onChange={(e) => setSubmissionRemarks(e.target.value)}
              placeholder="Catatan batch submission..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </Modal>

      {/* View Created Submission List Modal */}
      <SubmissionListDetailModal
        submission={viewingSubmission}
        applications={applications}
        onClose={() => setViewingSubmission(null)}
        onExportCsv={onExportCsv}
        onDownloadPdf={onDownloadSubmissionPdf}
        onViewDetails={onViewDetails}
      />
    </div>
  );
};
