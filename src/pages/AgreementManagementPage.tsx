import React, { useMemo, useState } from 'react';
import { CheckCircle2, Eye, FileCheck2, Info, RotateCcw, Search } from 'lucide-react';
import type { Branch, InstallmentApplication } from '../types/khallegacy';
import {
  formatDateShort,
  isEligibleForAgreementReceipt,
} from '../utils/businessRules';
import { EmptyState, PaginationBar } from '../components/StateViews';
import { Modal } from '../components/Modal';

interface AgreementManagementPageProps {
  applications: InstallmentApplication[];
  branches: Branch[];
  currentUserName: string;
  canReceive: boolean;
  defaultPageSize: number;
  onReceiveAgreement: (appId: string) => void;
  onViewDetails: (appId: string) => void;
}

export const AgreementManagementPage: React.FC<AgreementManagementPageProps> = ({
  applications,
  branches,
  currentUserName,
  canReceive,
  defaultPageSize,
  onReceiveAgreement,
  onViewDetails,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [pickupFilter, setPickupFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [confirmApp, setConfirmApp] = useState<InstallmentApplication | null>(null);

  const branchName = (id: string | null) =>
    id ? branches.find((b) => b.id === id)?.name ?? id : 'Belum Ditentukan';

  const eligibleApps = useMemo(
    () => applications.filter(isEligibleForAgreementReceipt),
    [applications],
  );

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return eligibleApps.filter((app) => {
      if (q) {
        const hit =
          app.customerName.toLowerCase().includes(q) ||
          app.icNumber.toLowerCase().includes(q) ||
          app.caseId.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (pickupFilter === 'UNASSIGNED') {
        if (app.pickupBranchId !== null) return false;
      } else if (pickupFilter !== 'ALL' && app.pickupBranchId !== pickupFilter) {
        return false;
      }
      if (dateFilter && app.applicationDate !== dateFilter) return false;
      return true;
    });
  }, [eligibleApps, searchTerm, pickupFilter, dateFilter]);

  const paginated = useMemo(() => {
    const safePage = Math.min(currentPage, Math.max(1, Math.ceil(filtered.length / pageSize)));
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const resetFilters = () => {
    setSearchTerm('');
    setPickupFilter('ALL');
    setDateFilter('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-5">
      {/* Prominent Summary Card + Business Rule Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div
          data-testid="agreement-to-be-receive-card"
          className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4"
        >
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              AGREEMENT TO BE RECEIVE
            </p>
            <p
              data-testid="agreement-to-be-receive-count"
              className="text-3xl font-bold text-amber-600 tabular-nums mt-1.5"
            >
              {eligibleApps.length}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Eligible agreements awaiting HQ TERIMA receipt
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FileCheck2 className="w-6 h-6" />
          </div>
        </div>

        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-slate-900">Eligibility Gate (Stock &amp; Pass Date)</p>
            <p className="text-slate-600 leading-relaxed">
              An approved application appears in this queue only when <strong>every product</strong>{' '}
              in the order has <strong>Stock Status = OK</strong> and a filled{' '}
              <strong>Date Pass Stock</strong>. Clicking <strong>TERIMA</strong> records receipt
              staff, date/time, and moves the record into Agreement Checking while preserving full
              audit history.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2">
            <label htmlFor="agm-search" className="block text-[11px] font-medium text-slate-500 mb-1">
              Search Customer Name, IC, or CASE ID
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="agm-search"
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search customer, IC number, or CASE ID..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="agm-pickup" className="block text-[11px] font-medium text-slate-500 mb-1">
              Pickup Branch
            </label>
            <select
              id="agm-pickup"
              value={pickupFilter}
              onChange={(e) => {
                setPickupFilter(e.target.value);
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
            </select>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="agm-date" className="block text-[11px] font-medium text-slate-500 mb-1">
                Application Date
              </label>
              <input
                id="agm-date"
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={resetFilters}
              title="Reset filters"
              aria-label="Reset filters"
              className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Eligible Agreements Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No eligible agreements awaiting receipt"
          description={
            eligibleApps.length === 0
              ? 'All stock-cleared agreements have been received via TERIMA.'
              : 'No eligible records matched your current filter criteria.'
          }
          actionLabel={eligibleApps.length > 0 ? 'Clear Filters' : undefined}
          onAction={eligibleApps.length > 0 ? resetFilters : undefined}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 whitespace-nowrap">IC NUMBER</th>
                  <th className="py-3 px-4 whitespace-nowrap">CUSTOMER NAME</th>
                  <th className="py-3 px-4 whitespace-nowrap">PICKUP BRANCH</th>
                  <th className="py-3 px-4 whitespace-nowrap">PHONE NUMBER</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginated.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-mono-tabular font-semibold text-slate-900">
                        {app.icNumber}
                      </div>
                      <div className="font-mono-tabular text-[11px] text-slate-500 mt-0.5">
                        {app.caseId} · {formatDateShort(app.applicationDate)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{app.customerName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {app.products.length} product{app.products.length > 1 ? 's' : ''} · Stock OK
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-700">
                      {branchName(app.pickupBranchId)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono-tabular text-slate-700">
                      {app.phone}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onViewDetails(app.id)}
                          aria-label={`View application ${app.caseId}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                        <button
                          type="button"
                          disabled={!canReceive}
                          onClick={() => setConfirmApp(app)}
                          aria-label={`TERIMA agreement for ${app.customerName} (${app.caseId})`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          TERIMA
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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

      {/* TERIMA Confirmation Modal */}
      <Modal
        open={Boolean(confirmApp)}
        onClose={() => setConfirmApp(null)}
        title="Confirm Agreement Receipt (TERIMA)"
        subtitle="Verify physical agreement receipt before logging into Agreement Checking"
        footer={
          confirmApp && (
            <>
              <button
                type="button"
                onClick={() => setConfirmApp(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onReceiveAgreement(confirmApp.id);
                  setConfirmApp(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Confirm TERIMA
              </button>
            </>
          )
        }
      >
        {confirmApp && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Customer Name</span>
                <span className="font-semibold text-slate-900">{confirmApp.customerName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">CASE ID</span>
                <span className="font-mono-tabular font-semibold text-blue-600">
                  {confirmApp.caseId}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">IC Number</span>
                <span className="font-mono-tabular text-slate-800">{confirmApp.icNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Pickup Branch</span>
                <span className="text-slate-800">{branchName(confirmApp.pickupBranchId)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-500">Receiving Staff</span>
                <span className="font-medium text-slate-900">{currentUserName}</span>
              </div>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Confirming receipt will record the timestamp and receiving staff, decrement the{' '}
              <strong>AGREEMENT TO BE RECEIVE</strong> queue, and move this agreement to{' '}
              <strong>Agreement Checking</strong>.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};
