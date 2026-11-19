import React, { useMemo, useState } from 'react';
import { Eye, History, RotateCcw, Search } from 'lucide-react';
import type {
  Branch,
  InstallmentApplication,
  PostageTrackingRecord,
} from '../types/khallegacy';
import { formatDateShort, formatDateTime } from '../utils/businessRules';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, PaginationBar } from '../components/StateViews';
import { Modal } from '../components/Modal';

interface AgreementHistoryPageProps {
  applications: InstallmentApplication[];
  branches: Branch[];
  postageTrackings: PostageTrackingRecord[];
  defaultPageSize: number;
  onViewDetails: (appId: string) => void;
}

interface ResolvedPostageInfo {
  postageDate: string | null;
  courier: string | null;
  trackingNumber: string | null;
  postageStatus: string;
}

function resolvePostageInfo(
  app: InstallmentApplication,
  postageBySubmissionId: Map<string, PostageTrackingRecord>,
): ResolvedPostageInfo {
  const linkedPostage = app.agreement.saleSubmissionId
    ? postageBySubmissionId.get(app.agreement.saleSubmissionId)
    : undefined;

  if (linkedPostage) {
    return {
      postageDate: linkedPostage.date,
      courier: linkedPostage.courier,
      trackingNumber: linkedPostage.trackingNumber,
      postageStatus: linkedPostage.status,
    };
  }

  if (app.agreement.dispatchStatus === 'Dispatched') {
    return {
      postageDate: app.agreement.dispatchDate,
      courier: app.agreement.courierName,
      trackingNumber: app.agreement.trackingNumber,
      postageStatus:
        app.agreement.jclReceiptStatus === 'Received by JCL' ? 'DELIVERED' : 'IN TRANSIT',
    };
  }

  return {
    postageDate: null,
    courier: null,
    trackingNumber: null,
    postageStatus: 'NOT POSTED',
  };
}

export const AgreementHistoryPage: React.FC<AgreementHistoryPageProps> = ({
  applications,
  branches,
  postageTrackings,
  defaultPageSize,
  onViewDetails,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [origBranch, setOrigBranch] = useState('ALL');
  const [pickupBranch, setPickupBranch] = useState('ALL');
  const [receiptDate, setReceiptDate] = useState('');
  const [checkingStatus, setCheckingStatus] = useState('ALL');
  const [postageStatus, setPostageStatus] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [historyApp, setHistoryApp] = useState<InstallmentApplication | null>(null);

  const branchName = (id: string | null) => {
    if (!id) return 'Belum Ditentukan';
    if (id === 'POSTAGE' || id === 'WEB') return id;
    return branches.find((b) => b.id === id)?.name ?? id;
  };

  const postageBySubmissionId = useMemo(() => {
    const map = new Map<string, PostageTrackingRecord>();
    postageTrackings.forEach((t) => {
      if (t.saleSubmissionId && !map.has(t.saleSubmissionId)) {
        map.set(t.saleSubmissionId, t);
      }
    });
    return map;
  }, [postageTrackings]);

  const enrichedRows = useMemo(
    () =>
      applications.map((app) => ({
        app,
        postage: resolvePostageInfo(app, postageBySubmissionId),
      })),
    [applications, postageBySubmissionId],
  );

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return enrichedRows.filter(({ app, postage }) => {
      if (q) {
        const hit =
          app.caseId.toLowerCase().includes(q) ||
          app.customerName.toLowerCase().includes(q) ||
          app.icNumber.toLowerCase().includes(q) ||
          (postage.trackingNumber ?? '').toLowerCase().includes(q) ||
          (postage.courier ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (origBranch !== 'ALL' && app.customerFromBranchId !== origBranch) return false;
      if (pickupBranch === 'UNASSIGNED') {
        if (app.pickupBranchId !== null) return false;
      } else if (pickupBranch !== 'ALL' && app.pickupBranchId !== pickupBranch) {
        return false;
      }
      if (receiptDate) {
        if (!app.agreement.receivedAt || !app.agreement.receivedAt.startsWith(receiptDate)) {
          return false;
        }
      }
      if (checkingStatus !== 'ALL' && app.agreement.checkingStatus !== checkingStatus) return false;
      if (postageStatus !== 'ALL' && postage.postageStatus !== postageStatus) return false;
      if (startDate && app.applicationDate < startDate) return false;
      if (endDate && app.applicationDate > endDate) return false;
      return true;
    });
  }, [
    enrichedRows,
    searchTerm,
    origBranch,
    pickupBranch,
    receiptDate,
    checkingStatus,
    postageStatus,
    startDate,
    endDate,
  ]);

  const paginated = useMemo(() => {
    const safePage = Math.min(currentPage, Math.max(1, Math.ceil(filtered.length / pageSize)));
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const resetFilters = () => {
    setSearchTerm('');
    setOrigBranch('ALL');
    setPickupBranch('ALL');
    setReceiptDate('');
    setCheckingStatus('ALL');
    setPostageStatus('ALL');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const historyPostage = useMemo(
    () => (historyApp ? resolvePostageInfo(historyApp, postageBySubmissionId) : null),
    [historyApp, postageBySubmissionId],
  );

  return (
    <div className="space-y-5">
      {/* Comprehensive Multi-Filter Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="hist-search" className="block text-[11px] font-medium text-slate-500 mb-1">
              CASE ID, Customer Name, IC, Courier, or Tracking No
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="hist-search"
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search CASE ID, name, IC, or tracking..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="hist-orig" className="block text-[11px] font-medium text-slate-500 mb-1">
              Original Branch
            </label>
            <select
              id="hist-orig"
              value={origBranch}
              onChange={(e) => {
                setOrigBranch(e.target.value);
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
            </select>
          </div>

          <div>
            <label htmlFor="hist-pickup" className="block text-[11px] font-medium text-slate-500 mb-1">
              Pickup Branch
            </label>
            <select
              id="hist-pickup"
              value={pickupBranch}
              onChange={(e) => {
                setPickupBranch(e.target.value);
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

          <div>
            <label htmlFor="hist-receipt-date" className="block text-[11px] font-medium text-slate-500 mb-1">
              Agreement Received Date
            </label>
            <input
              id="hist-receipt-date"
              type="date"
              value={receiptDate}
              onChange={(e) => {
                setReceiptDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100 items-end">
          <div>
            <label htmlFor="hist-chk" className="block text-[11px] font-medium text-slate-500 mb-1">
              Checking Status
            </label>
            <select
              id="hist-chk"
              value={checkingStatus}
              onChange={(e) => {
                setCheckingStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Checking Statuses</option>
              <option value="Not Received">Not Received</option>
              <option value="Pending Checking">Pending Checking</option>
              <option value="Checking in Progress">Checking in Progress</option>
              <option value="Checking Passed">Checking Passed</option>
              <option value="Checking Failed">Checking Failed</option>
            </select>
          </div>

          <div>
            <label htmlFor="hist-postage" className="block text-[11px] font-medium text-slate-500 mb-1">
              Postage Status
            </label>
            <select
              id="hist-postage"
              value={postageStatus}
              onChange={(e) => {
                setPostageStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Postage Statuses</option>
              <option value="NOT POSTED">NOT POSTED</option>
              <option value="PENDING">PENDING</option>
              <option value="IN TRANSIT">IN TRANSIT</option>
              <option value="OUT FOR DELIVERY">OUT FOR DELIVERY</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="FAILED / RETURNED">FAILED / RETURNED</option>
            </select>
          </div>

          <div>
            <label htmlFor="hist-start" className="block text-[11px] font-medium text-slate-500 mb-1">
              Date From
            </label>
            <input
              id="hist-start"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="hist-end" className="block text-[11px] font-medium text-slate-500 mb-1">
              Date To
            </label>
            <input
              id="hist-end"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Archive Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No agreement archive records found"
          description="No historical agreement records match your current filters."
          actionLabel="Reset Archive Filters"
          onAction={resetFilters}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wide leading-tight">
                  <th className="py-2.5 pl-2.5 pr-1 whitespace-nowrap">CASE ID</th>
                  <th className="py-2.5 px-1">Customer Name</th>
                  <th className="py-2.5 px-1">Pickup Branch</th>
                  <th className="py-2.5 px-1 max-w-[92px]">Agreement Received Date</th>
                  <th className="py-2.5 px-1">Checking Status</th>
                  <th className="py-2.5 px-1">Postage Date</th>
                  <th className="py-2.5 px-1">Courier</th>
                  <th className="py-2.5 px-1 max-w-[104px]">Tracking Number</th>
                  <th className="py-2.5 px-1">Postage Status</th>
                  <th className="py-2.5 pl-1 pr-2.5 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11.5px]">
                {paginated.map(({ app, postage }) => (
                  <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 pl-2.5 pr-1 whitespace-nowrap font-mono-tabular font-semibold text-blue-600">
                      {app.caseId}
                    </td>
                    <td className="py-2.5 px-1 max-w-[132px]">
                      <div className="font-medium text-slate-900 truncate" title={app.customerName}>
                        {app.customerName}
                      </div>
                      <div className="font-mono-tabular text-[10.5px] text-slate-500 truncate">
                        {app.icNumber}
                      </div>
                    </td>
                    <td className="py-2.5 px-1 max-w-[96px] text-slate-700">
                      <span className="block truncate" title={branchName(app.pickupBranchId)}>
                        {branchName(app.pickupBranchId)}
                      </span>
                    </td>
                    <td className="py-2.5 px-1 whitespace-nowrap tabular-nums text-slate-600">
                      {formatDateShort(app.agreement.receivedAt)}
                    </td>
                    <td className="py-2.5 px-1 max-w-[116px]">
                      <StatusBadge status={app.agreement.checkingStatus} compact wrap />
                    </td>
                    <td className="py-2.5 px-1 whitespace-nowrap tabular-nums text-slate-600">
                      {formatDateShort(postage.postageDate)}
                    </td>
                    <td className="py-2.5 px-1 max-w-[78px] text-slate-700">
                      <span className="block truncate" title={postage.courier || undefined}>
                        {postage.courier || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-1 max-w-[106px] font-mono-tabular text-slate-700">
                      <span className="block truncate" title={postage.trackingNumber || undefined}>
                        {postage.trackingNumber || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-1 max-w-[112px]">
                      <StatusBadge status={postage.postageStatus} compact wrap />
                    </td>
                    <td className="py-2.5 pl-1 pr-2.5 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setHistoryApp(app)}
                          className="inline-flex items-center gap-1 px-1.5 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 rounded-md whitespace-nowrap"
                        >
                          <History className="w-3.5 h-3.5" />
                          History
                        </button>
                        <button
                          type="button"
                          onClick={() => onViewDetails(app.id)}
                          aria-label={`View full details for ${app.caseId}`}
                          title="View"
                          className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                        >
                          <Eye className="w-3.5 h-3.5" />
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

      {/* Complete Agreement History Modal */}
      <Modal
        open={Boolean(historyApp)}
        onClose={() => setHistoryApp(null)}
        title={
          historyApp ? `Complete Agreement History — ${historyApp.caseId}` : 'Agreement History'
        }
        subtitle={
          historyApp
            ? `${historyApp.customerName} · ${historyApp.agreement.agreementNumber || 'Pending Agreement No.'}`
            : undefined
        }
        maxWidthClass="max-w-2xl"
        footer={
          historyApp && (
            <>
              <button
                type="button"
                onClick={() => setHistoryApp(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = historyApp.id;
                  setHistoryApp(null);
                  onViewDetails(id);
                }}
                className="px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Open Application Details
              </button>
            </>
          )
        }
      >
        {historyApp && historyPostage && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <p className="text-slate-500">TERIMA Receipt</p>
                <p className="font-medium text-slate-900 mt-0.5">
                  {formatDateShort(historyApp.agreement.receivedAt)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Checking Status</p>
                <div className="mt-0.5">
                  <StatusBadge status={historyApp.agreement.checkingStatus} compact />
                </div>
              </div>
              <div>
                <p className="text-slate-500">Postage &amp; Courier</p>
                <p className="font-medium text-slate-900 mt-0.5">
                  {historyPostage.courier
                    ? `${historyPostage.courier} (${historyPostage.trackingNumber})`
                    : 'Not Posted'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Postage Status</p>
                <div className="mt-0.5">
                  <StatusBadge status={historyPostage.postageStatus} compact />
                </div>
                {historyPostage.postageDate && (
                  <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                    {formatDateShort(historyPostage.postageDate)}
                  </p>
                )}
              </div>
            </div>

            <ol className="space-y-3">
              {historyApp.timeline.map((evt) => (
                <li key={evt.id} className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                  <div className="flex-1 pb-2.5 border-b border-slate-100 last:border-none">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{evt.actionType}</span>
                      <span className="tabular-nums text-[11px] text-slate-500">
                        {formatDateTime(evt.timestamp)}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-0.5">{evt.description}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Staff: {evt.staffName}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Modal>
    </div>
  );
};
