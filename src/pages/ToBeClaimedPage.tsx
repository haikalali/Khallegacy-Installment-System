import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  FileCheck2,
  RotateCcw,
  Search,
  Wallet,
} from 'lucide-react';
import type {
  Branch,
  InstallmentApplication,
  PostageTrackingRecord,
} from '../types/khallegacy';
import {
  formatRM,
  isEligibleForClaim,
  resolveActualCashPayment,
  SYSTEM_TODAY_DATE,
} from '../utils/businessRules';
import { EmptyState, PaginationBar } from '../components/StateViews';
import { Modal } from '../components/Modal';

interface ToBeClaimedPageProps {
  applications: InstallmentApplication[];
  branches: Branch[];
  postageTrackings: PostageTrackingRecord[];
  currentUserName: string;
  canClaim: boolean;
  defaultPageSize: number;
  onClaimAgreement: (
    appId: string,
    payload: {
      claimDate: string;
      remarks: string;
    },
  ) => boolean;
  onViewDetails: (appId: string) => void;
}

export const ToBeClaimedPage: React.FC<ToBeClaimedPageProps> = ({
  applications,
  branches,
  postageTrackings,
  currentUserName,
  canClaim,
  defaultPageSize,
  onClaimAgreement,
  onViewDetails,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const [claimingApp, setClaimingApp] = useState<InstallmentApplication | null>(null);
  const [claimDate, setClaimDate] = useState(SYSTEM_TODAY_DATE);
  const [claimRemarks, setClaimRemarks] = useState('');
  const [claimError, setClaimError] = useState('');

  const toBeClaimedApps = useMemo(
    () => applications.filter((app) => isEligibleForClaim(app, postageTrackings)),
    [applications, postageTrackings],
  );

  const summaryTotals = useMemo(() => {
    const totalActualCashPayment = toBeClaimedApps.reduce(
      (sum, app) => sum + resolveActualCashPayment(app.financing),
      0,
    );
    return {
      count: toBeClaimedApps.length,
      totalActualCashPayment,
    };
  }, [toBeClaimedApps]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return toBeClaimedApps.filter((app) => {
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
          app.customerName.toLowerCase().includes(q) ||
          app.icNumber.toLowerCase().includes(q) ||
          app.caseId.toLowerCase().includes(q) ||
          productText.includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [toBeClaimedApps, branchFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  const resetFilters = () => {
    setSearchTerm('');
    setBranchFilter('ALL');
    setCurrentPage(1);
  };

  const openClaimModal = (app: InstallmentApplication) => {
    setClaimingApp(app);
    setClaimDate(SYSTEM_TODAY_DATE);
    setClaimRemarks('');
    setClaimError('');
  };

  const handleConfirmClaim = () => {
    if (!claimingApp) return;
    if (!claimDate.trim()) {
      setClaimError('Sila pilih tarikh claim.');
      return;
    }
    const ok = onClaimAgreement(claimingApp.id, {
      claimDate,
      remarks: claimRemarks,
    });
    if (ok) {
      setClaimingApp(null);
    }
  };

  const hasFilters = Boolean(searchTerm.trim() || branchFilter !== 'ALL');

  return (
    <div className="space-y-5">
      {/* 2 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          data-testid="agreement-to-be-claimed-card"
          className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4"
        >
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              Agreement To Be Claimed
            </p>
            <p
              data-testid="agreement-to-be-claimed-count"
              className="text-3xl font-bold text-blue-600 tabular-nums mt-1.5"
            >
              {summaryTotals.count}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Delivered customer agreements awaiting claim confirmation
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FileCheck2 className="w-6 h-6" />
          </div>
        </div>

        <div
          data-testid="total-actual-cash-payment-card"
          className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4"
        >
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              Total Actual Cash Payment
            </p>
            <p
              data-testid="total-actual-cash-payment-amount"
              className="text-3xl font-bold text-emerald-600 font-mono-tabular mt-1.5"
            >
              {formatRM(summaryTotals.totalActualCashPayment)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Total net cash payout across agreements to be claimed
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2">
            <label htmlFor="claim-search" className="block text-[11px] font-medium text-slate-500 mb-1">
              Search Name Customer, IC Number, CASE ID, or Product
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="claim-search"
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search customer, IC, CASE ID, or product..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="claim-branch" className="block text-[11px] font-medium text-slate-500 mb-1">
              Pickup Branch
            </label>
            <select
              id="claim-branch"
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

          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 rounded-lg"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No agreements pending claim"
          description={
            toBeClaimedApps.length === 0
              ? 'Customer agreements with Delivered postage status awaiting claim confirmation will appear here.'
              : 'No records matched your current search or branch filter.'
          }
          actionLabel={hasFilters ? 'Clear Filters' : undefined}
          onAction={hasFilters ? resetFilters : undefined}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wide leading-tight">
                  <th className="py-2.5 pl-2.5 pr-1 whitespace-nowrap">No</th>
                  <th className="py-2.5 px-1">Name Customer</th>
                  <th className="py-2.5 px-1 whitespace-nowrap">IC Number</th>
                  <th className="py-2.5 px-1">Product</th>
                  <th className="py-2.5 px-1 text-right">Financing Amount</th>
                  <th className="py-2.5 px-1 text-right">Processing Fee</th>
                  <th className="py-2.5 px-1 text-right">SST Amount</th>
                  <th className="py-2.5 px-1 text-right">Stamping Fee</th>
                  <th className="py-2.5 px-1 text-right">Actual Cash Payment</th>
                  <th className="py-2.5 pl-1 pr-2.5 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11.5px]">
                {paginated.map((app, index) => {
                  const rowNo = pageStart + index + 1;
                  const productSummary = app.products
                    .map((p) => `${p.productName}${p.quantity > 1 ? ` ×${p.quantity}` : ''}`)
                    .join(', ');
                  const actualCash = resolveActualCashPayment(app.financing);

                  return (
                    <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 pl-2.5 pr-1 tabular-nums text-slate-500 whitespace-nowrap">
                        {rowNo}
                      </td>
                      <td className="py-2.5 px-1 max-w-[140px]">
                        <div className="font-medium text-slate-900 truncate" title={app.customerName}>
                          {app.customerName}
                        </div>
                        <div className="font-mono-tabular text-[10.5px] text-slate-500 truncate">
                          {app.caseId}
                          {app.agreement.saleSubmissionId ? ` · ${app.agreement.saleSubmissionId}` : ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-1 whitespace-nowrap font-mono-tabular text-slate-700">
                        {app.icNumber}
                      </td>
                      <td className="py-2.5 px-1 max-w-[150px] text-slate-700">
                        <span className="block truncate" title={productSummary}>
                          {productSummary || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-1 text-right whitespace-nowrap font-mono-tabular text-slate-800">
                        {formatRM(app.financing.financingAmount)}
                      </td>
                      <td className="py-2.5 px-1 text-right whitespace-nowrap font-mono-tabular text-slate-700">
                        {formatRM(app.financing.processingFee)}
                      </td>
                      <td className="py-2.5 px-1 text-right whitespace-nowrap font-mono-tabular text-slate-700">
                        {formatRM(app.financing.sstAmount)}
                      </td>
                      <td className="py-2.5 px-1 text-right whitespace-nowrap font-mono-tabular text-slate-700">
                        {formatRM(app.financing.stampDutyFee)}
                      </td>
                      <td className="py-2.5 px-1 text-right whitespace-nowrap font-mono-tabular font-semibold text-emerald-700">
                        {formatRM(actualCash)}
                      </td>
                      <td className="py-2.5 pl-1 pr-2.5 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onViewDetails(app.id)}
                            aria-label={`View details for ${app.caseId}`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                          <button
                            type="button"
                            disabled={!canClaim}
                            onClick={() => openClaimModal(app)}
                            aria-label={`Mark ${app.caseId} as Claimed`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-md whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Claimed
                          </button>
                        </div>
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

      {/* Claim Confirmation Modal */}
      <Modal
        open={Boolean(claimingApp)}
        onClose={() => setClaimingApp(null)}
        title="Confirm Agreement Claimed"
        subtitle={
          claimingApp
            ? `${claimingApp.caseId} · ${claimingApp.customerName}`
            : undefined
        }
        footer={
          claimingApp && (
            <>
              <button
                type="button"
                onClick={() => setClaimingApp(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClaim}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Confirm Claimed
              </button>
            </>
          )
        }
      >
        {claimingApp && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Customer Name</span>
                <span className="font-semibold text-slate-900">{claimingApp.customerName}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">IC Number</span>
                <span className="font-mono-tabular text-slate-800">{claimingApp.icNumber}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Product</span>
                <span className="text-slate-800 text-right">
                  {claimingApp.products.map((p) => p.productName).join(', ')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <span className="text-slate-500">Actual Cash Payment</span>
                <span className="font-mono-tabular font-bold text-emerald-700">
                  {formatRM(resolveActualCashPayment(claimingApp.financing))}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Claimed By</span>
                <span className="font-medium text-slate-900">{currentUserName}</span>
              </div>
            </div>

            <div>
              <label htmlFor="claim-confirm-date" className="block text-slate-600 font-medium mb-1">
                Claim Date <span className="text-red-500">*</span>
              </label>
              <input
                id="claim-confirm-date"
                type="date"
                value={claimDate}
                onChange={(e) => {
                  setClaimDate(e.target.value);
                  setClaimError('');
                }}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="claim-confirm-remarks" className="block text-slate-600 font-medium mb-1">
                Remarks (Optional)
              </label>
              <textarea
                id="claim-confirm-remarks"
                rows={2}
                value={claimRemarks}
                onChange={(e) => setClaimRemarks(e.target.value)}
                placeholder="Payment reference or JCL claim notes..."
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>

            {claimError && (
              <p className="text-xs text-red-600 font-medium">{claimError}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
