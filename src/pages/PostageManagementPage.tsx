import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Package,
  Pencil,
  PlusCircle,
  RotateCcw,
  Search,
  Truck,
} from 'lucide-react';
import type {
  Courier,
  InstallmentApplication,
  PostageTrackingRecord,
  PostageTrackingStatus,
  SaleSubmissionList,
} from '../types/khallegacy';
import {
  buildCourierTrackingUrl,
  formatDateShort,
  formatDateTime,
  SYSTEM_TODAY_DATE,
} from '../utils/businessRules';
import { EmptyState, PaginationBar } from '../components/StateViews';
import { Modal } from '../components/Modal';
import { SubmissionListDetailModal } from '../components/SubmissionListDetailModal';

interface PostageManagementPageProps {
  trackings: PostageTrackingRecord[];
  submissionLists: SaleSubmissionList[];
  applications: InstallmentApplication[];
  couriers: Courier[];
  canManage: boolean;
  defaultPageSize: number;
  onCreateTracking: (payload: {
    date: string;
    description: string;
    saleSubmissionId: string | null;
    trackingNumber: string;
    courier: string;
    status: PostageTrackingStatus;
  }) => void;
  onUpdateTrackingStatus: (
    trackingId: string,
    payload: {
      status: PostageTrackingStatus;
      remarks: string;
    },
  ) => void;
  onExportCsv: (filename: string, rows: string[][]) => void;
  onDownloadSubmissionPdf: (submission: SaleSubmissionList) => void;
  onViewDetails: (appId: string) => void;
}

const POSTAGE_STATUS_OPTIONS: PostageTrackingStatus[] = [
  'PENDING',
  'IN TRANSIT',
  'OUT FOR DELIVERY',
  'DELIVERED',
  'FAILED / RETURNED',
];

function getStatusBadgeClasses(status: PostageTrackingStatus): string {
  switch (status) {
    case 'DELIVERED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'OUT FOR DELIVERY':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'IN TRANSIT':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'FAILED / RETURNED':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'PENDING':
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200';
  }
}

export const PostageManagementPage: React.FC<PostageManagementPageProps> = ({
  trackings,
  submissionLists,
  applications,
  couriers,
  canManage,
  defaultPageSize,
  onCreateTracking,
  onUpdateTrackingStatus,
  onExportCsv,
  onDownloadSubmissionPdf,
  onViewDetails,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_TRANSIT_ACTIVE' | PostageTrackingStatus>('ALL');
  const [courierFilter, setCourierFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [viewingSubmission, setViewingSubmission] = useState<SaleSubmissionList | null>(null);

  const activeCouriers = useMemo(() => couriers.filter((c) => c.active), [couriers]);

  const submissionById = useMemo(
    () => new Map(submissionLists.map((s) => [s.submissionListId, s])),
    [submissionLists],
  );

  // Submission Lists not yet linked to any postage tracking record
  const availableSubmissionLists = useMemo(() => {
    const usedIds = new Set(
      trackings
        .map((t) => t.saleSubmissionId)
        .filter((id): id is string => Boolean(id && id.trim())),
    );
    return submissionLists.filter((sub) => !usedIds.has(sub.submissionListId));
  }, [trackings, submissionLists]);

  // Create New Tracking Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [newDate, setNewDate] = useState(SYSTEM_TODAY_DATE);
  const [newDescription, setNewDescription] = useState('');
  const [isSaleSubmission, setIsSaleSubmission] = useState<'Tidak' | 'Ya'>('Tidak');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState('');
  const [newTrackingNumber, setNewTrackingNumber] = useState('');
  const [newCourier, setNewCourier] = useState(activeCouriers[0]?.name ?? 'J&T Express');
  const [newStatus, setNewStatus] = useState<PostageTrackingStatus>('PENDING');
  const [createError, setCreateError] = useState('');

  // Manual Status Update Modal state
  const [updatingRecord, setUpdatingRecord] = useState<PostageTrackingRecord | null>(null);
  const [editStatus, setEditStatus] = useState<PostageTrackingStatus>('PENDING');
  const [editRemarks, setEditRemarks] = useState('');

  const summary = useMemo(() => {
    const total = trackings.length;
    const pending = trackings.filter((t) => t.status === 'PENDING').length;
    const inTransit = trackings.filter(
      (t) => t.status === 'IN TRANSIT' || t.status === 'OUT FOR DELIVERY',
    ).length;
    const delivered = trackings.filter((t) => t.status === 'DELIVERED').length;
    return { total, pending, inTransit, delivered };
  }, [trackings]);

  const courierOptions = useMemo(() => {
    const names = new Set<string>(activeCouriers.map((c) => c.name));
    trackings.forEach((t) => {
      if (t.courier.trim()) names.add(t.courier.trim());
    });
    return Array.from(names);
  }, [activeCouriers, trackings]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return trackings.filter((item) => {
      if (statusFilter === 'IN_TRANSIT_ACTIVE') {
        if (item.status !== 'IN TRANSIT' && item.status !== 'OUT FOR DELIVERY') return false;
      } else if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      if (courierFilter !== 'ALL' && item.courier !== courierFilter) return false;
      if (q) {
        const hit =
          item.description.toLowerCase().includes(q) ||
          (item.saleSubmissionId ?? '').toLowerCase().includes(q) ||
          item.trackingNumber.toLowerCase().includes(q) ||
          item.courier.toLowerCase().includes(q) ||
          item.status.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [trackings, statusFilter, courierFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  const hasFilters = Boolean(searchTerm.trim() || statusFilter !== 'ALL' || courierFilter !== 'ALL');

  const openCreateModal = () => {
    setNewDate(SYSTEM_TODAY_DATE);
    setNewDescription('');
    setIsSaleSubmission('Tidak');
    setSelectedSubmissionId(availableSubmissionLists[0]?.submissionListId ?? '');
    setNewTrackingNumber('');
    setNewCourier(activeCouriers[0]?.name ?? courierOptions[0] ?? 'J&T Express');
    setNewStatus('PENDING');
    setCreateError('');
    setCreateOpen(true);
  };

  const handleSaleSubmissionToggle = (choice: 'Tidak' | 'Ya') => {
    setIsSaleSubmission(choice);
    setCreateError('');
    if (choice === 'Ya') {
      const firstUnused = availableSubmissionLists[0]?.submissionListId ?? '';
      const targetId = selectedSubmissionId || firstUnused;
      setSelectedSubmissionId(targetId);
      if (targetId && !newDescription.trim()) {
        const sub = availableSubmissionLists.find((s) => s.submissionListId === targetId);
        if (sub) {
          setNewDescription(
            `Sale Submission ${sub.submissionListId} (${sub.agreementCount} agreement${
              sub.agreementCount === 1 ? '' : 's'
            })`,
          );
        }
      }
    }
  };

  const handleSelectSubmissionId = (subId: string) => {
    setSelectedSubmissionId(subId);
    setCreateError('');
    const sub = availableSubmissionLists.find((s) => s.submissionListId === subId);
    if (sub && (!newDescription.trim() || newDescription.startsWith('Sale Submission '))) {
      setNewDescription(
        `Sale Submission ${sub.submissionListId} (${sub.agreementCount} agreement${
          sub.agreementCount === 1 ? '' : 's'
        })`,
      );
    }
  };

  const handleSaveNewTracking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate.trim()) {
      setCreateError('Sila pilih tarikh (DATE).');
      return;
    }
    if (isSaleSubmission === 'Ya' && !selectedSubmissionId.trim()) {
      setCreateError('Sila pilih ID Submission List yang belum digunakan untuk postage.');
      return;
    }
    if (!newDescription.trim()) {
      setCreateError('Sila masukkan DESCRIPTION.');
      return;
    }
    if (!newTrackingNumber.trim()) {
      setCreateError('Sila masukkan NO TRACKING.');
      return;
    }
    if (!newCourier.trim()) {
      setCreateError('Sila pilih COURIER.');
      return;
    }

    onCreateTracking({
      date: newDate.trim(),
      description: newDescription.trim(),
      saleSubmissionId: isSaleSubmission === 'Ya' ? selectedSubmissionId.trim() : null,
      trackingNumber: newTrackingNumber.trim().toUpperCase(),
      courier: newCourier.trim(),
      status: newStatus,
    });
    setCreateOpen(false);
    setCurrentPage(1);
  };

  const openUpdateModal = (record: PostageTrackingRecord) => {
    setUpdatingRecord(record);
    setEditStatus(record.status);
    setEditRemarks(record.remarks ?? '');
  };

  const handleSaveStatusUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingRecord) return;
    onUpdateTrackingStatus(updatingRecord.id, {
      status: editStatus,
      remarks: editRemarks.trim(),
    });
    setUpdatingRecord(null);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards: Total Tracking, Pending, In Transit, Delivered */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => {
            setStatusFilter('ALL');
            setCurrentPage(1);
          }}
          className={`text-left bg-white border rounded-xl p-4 shadow-sm transition-colors ${
            statusFilter === 'ALL'
              ? 'border-blue-500 ring-1 ring-blue-500/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Total Tracking</p>
            <Package className="w-4 h-4 text-slate-600" aria-hidden="true" />
          </div>
          <p className="text-2xl font-semibold text-slate-900 tabular-nums mt-1.5">
            {summary.total}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">All recorded postage shipments</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter((prev) => (prev === 'PENDING' ? 'ALL' : 'PENDING'));
            setCurrentPage(1);
          }}
          className={`text-left bg-white border rounded-xl p-4 shadow-sm transition-colors ${
            statusFilter === 'PENDING'
              ? 'border-amber-500 ring-1 ring-amber-500/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Pending</p>
            <Clock className="w-4 h-4 text-amber-600" aria-hidden="true" />
          </div>
          <p className="text-2xl font-semibold text-amber-600 tabular-nums mt-1.5">
            {summary.pending}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Awaiting courier pickup / scan</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter((prev) => (prev === 'IN_TRANSIT_ACTIVE' ? 'ALL' : 'IN_TRANSIT_ACTIVE'));
            setCurrentPage(1);
          }}
          className={`text-left bg-white border rounded-xl p-4 shadow-sm transition-colors ${
            statusFilter === 'IN_TRANSIT_ACTIVE' || statusFilter === 'IN TRANSIT'
              ? 'border-blue-500 ring-1 ring-blue-500/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">In Transit</p>
            <Truck className="w-4 h-4 text-blue-600" aria-hidden="true" />
          </div>
          <p className="text-2xl font-semibold text-blue-600 tabular-nums mt-1.5">
            {summary.inTransit}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">On the way or out for delivery</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter((prev) => (prev === 'DELIVERED' ? 'ALL' : 'DELIVERED'));
            setCurrentPage(1);
          }}
          className={`text-left bg-white border rounded-xl p-4 shadow-sm transition-colors ${
            statusFilter === 'DELIVERED'
              ? 'border-emerald-500 ring-1 ring-emerald-500/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Delivered</p>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          </div>
          <p className="text-2xl font-semibold text-emerald-600 tabular-nums mt-1.5">
            {summary.delivered}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Confirmed delivered to recipient</p>
        </button>
      </div>

      {/* Filters & Create New Tracking Action Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
            <div className="sm:col-span-2">
              <label
                htmlFor="postage-search"
                className="block text-[11px] font-medium text-slate-500 mb-1"
              >
                Search Description, No Tracking, or Courier
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="postage-search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="e.g. JT6001294851MY, SUB-20261117, PosLaju..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="postage-courier-filter"
                className="block text-[11px] font-medium text-slate-500 mb-1"
              >
                Courier
              </label>
              <select
                id="postage-courier-filter"
                value={courierFilter}
                onChange={(e) => {
                  setCourierFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Couriers</option>
                {courierOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="postage-status-filter"
                className="block text-[11px] font-medium text-slate-500 mb-1"
              >
                Status
              </label>
              <select
                id="postage-status-filter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(
                    e.target.value as 'ALL' | 'IN_TRANSIT_ACTIVE' | PostageTrackingStatus,
                  );
                  setCurrentPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="IN_TRANSIT_ACTIVE">IN TRANSIT &amp; OUT FOR DELIVERY</option>
                {POSTAGE_STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('ALL');
                  setCourierFilter('ALL');
                  setCurrentPage(1);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Filters
              </button>
            )}

            <button
              type="button"
              disabled={!canManage}
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Create New Tracking
            </button>
          </div>
        </div>
      </div>

      {/* Postage Tracking Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No postage tracking records found"
          description={
            trackings.length === 0
              ? 'Click Create New Tracking to add your first courier tracking number.'
              : 'No postage tracking records match your current filters.'
          }
          actionLabel={hasFilters ? 'Reset Filters' : canManage ? 'Create New Tracking' : undefined}
          onAction={
            hasFilters
              ? () => {
                  setSearchTerm('');
                  setStatusFilter('ALL');
                  setCourierFilter('ALL');
                  setCurrentPage(1);
                }
              : canManage
                ? openCreateModal
                : undefined
          }
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 pl-4 pr-2 whitespace-nowrap">DATE</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">DESCRIPTION</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">SALE SUBMISSION</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">NO TRACKING</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">COURIER</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">STATUS</th>
                  <th className="py-3 pl-2.5 pr-4 text-right whitespace-nowrap">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginated.map((record) => {
                  const externalUrl = buildCourierTrackingUrl(
                    record.courier,
                    record.trackingNumber,
                    couriers,
                  );
                  return (
                    <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 pl-4 pr-2 whitespace-nowrap tabular-nums text-slate-700">
                        {formatDateShort(record.date)}
                      </td>
                      <td className="py-3 px-2.5 text-slate-800 max-w-[300px]">
                        <div className="font-medium truncate" title={record.description}>
                          {record.description}
                        </div>
                        {record.remarks && (
                          <div
                            className="text-[11px] text-slate-500 truncate mt-0.5"
                            title={record.remarks}
                          >
                            {record.remarks}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2.5 whitespace-nowrap">
                        {record.saleSubmissionId ? (
                          (() => {
                            const linkedSubmission = submissionById.get(record.saleSubmissionId);
                            return linkedSubmission ? (
                              <button
                                type="button"
                                onClick={() => setViewingSubmission(linkedSubmission)}
                                title={`View Submission List — ${record.saleSubmissionId}`}
                                className="font-mono-tabular font-semibold text-blue-600 hover:text-blue-700 hover:underline text-left"
                              >
                                {record.saleSubmissionId}
                              </button>
                            ) : (
                              <span className="font-mono-tabular font-semibold text-blue-700">
                                {record.saleSubmissionId}
                              </span>
                            );
                          })()
                        ) : (
                          <span className="text-slate-400">Tidak</span>
                        )}
                      </td>
                      <td className="py-3 px-2.5 whitespace-nowrap font-mono-tabular font-semibold text-slate-900">
                        {record.trackingNumber}
                      </td>
                      <td className="py-3 px-2.5 whitespace-nowrap text-slate-700 font-medium">
                        {record.courier}
                      </td>
                      <td className="py-3 px-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold tracking-tight ${getStatusBadgeClasses(
                            record.status,
                          )}`}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td className="py-3 pl-2.5 pr-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <a
                            href={externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Semak status ${record.trackingNumber} di laman ${record.courier}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Link
                          </a>
                          <button
                            type="button"
                            disabled={!canManage}
                            onClick={() => openUpdateModal(record)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-md transition-colors whitespace-nowrap"
                          >
                            <Pencil className="w-3 h-3" />
                            Update
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

      {/* Create New Tracking Detail Card Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create New Tracking"
        subtitle="Enter shipment details to create a new postage tracking record."
        maxWidthClass="max-w-lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-postage-tracking-form"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Save Tracking
            </button>
          </div>
        }
      >
        <form
          id="create-postage-tracking-form"
          onSubmit={handleSaveNewTracking}
          className="space-y-4 text-xs"
        >
          {createError && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 font-medium"
            >
              {createError}
            </div>
          )}

          <div>
            <label htmlFor="postage-create-date" className="block text-[11px] font-semibold text-slate-700 mb-1">
              DATE
            </label>
            <input
              id="postage-create-date"
              type="date"
              value={newDate}
              onChange={(e) => {
                setNewDate(e.target.value);
                setCreateError('');
              }}
              className="w-full px-3 py-2 text-xs tabular-nums border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Soalan: Sale Submission (Ya / Tidak) */}
          <div className="space-y-2.5">
            <div>
              <span className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                Sale Submission?
              </span>
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg">
                <button
                  type="button"
                  aria-pressed={isSaleSubmission === 'Tidak'}
                  onClick={() => handleSaleSubmissionToggle('Tidak')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md ${
                    isSaleSubmission === 'Tidak'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tidak
                </button>
                <button
                  type="button"
                  aria-pressed={isSaleSubmission === 'Ya'}
                  onClick={() => handleSaleSubmissionToggle('Ya')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md ${
                    isSaleSubmission === 'Ya'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ya
                </button>
              </div>
            </div>

            {isSaleSubmission === 'Ya' && (
              <div>
                <label
                  htmlFor="postage-create-submission-id"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  ID Submission List{' '}
                  <span className="font-normal text-slate-400">(Belum digunakan untuk postage)</span>
                </label>
                {availableSubmissionLists.length === 0 ? (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                    Tiada ID Submission List tersedia (semua senarai telah digunakan untuk postage atau belum dicipta di halaman Sale Submission).
                  </div>
                ) : (
                  <select
                    id="postage-create-submission-id"
                    value={selectedSubmissionId}
                    onChange={(e) => handleSelectSubmissionId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Pilih ID Submission List --</option>
                    {availableSubmissionLists.map((sub) => (
                      <option key={sub.id} value={sub.submissionListId}>
                        {sub.submissionListId} ({sub.agreementCount} agreements · {formatDateShort(sub.submissionDate)})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="postage-create-desc" className="block text-[11px] font-semibold text-slate-700 mb-1">
              DESCRIPTION
            </label>
            <input
              id="postage-create-desc"
              type="text"
              value={newDescription}
              onChange={(e) => {
                setNewDescription(e.target.value);
                setCreateError('');
              }}
              placeholder="e.g. Agreement Batch SUB-20261117-001 to JCL Credit HQ"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="postage-create-number" className="block text-[11px] font-semibold text-slate-700 mb-1">
              NO TRACKING
            </label>
            <input
              id="postage-create-number"
              type="text"
              value={newTrackingNumber}
              onChange={(e) => {
                setNewTrackingNumber(e.target.value);
                setCreateError('');
              }}
              placeholder="e.g. JT6001294851MY"
              className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="postage-create-courier" className="block text-[11px] font-semibold text-slate-700 mb-1">
                COURIER
              </label>
              <select
                id="postage-create-courier"
                value={newCourier}
                onChange={(e) => {
                  setNewCourier(e.target.value);
                  setCreateError('');
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
              >
                {courierOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="postage-create-status" className="block text-[11px] font-semibold text-slate-700 mb-1">
                STATUS
              </label>
              <select
                id="postage-create-status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as PostageTrackingStatus)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
              >
                {POSTAGE_STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* Manual Update Status Modal */}
      <Modal
        open={Boolean(updatingRecord)}
        onClose={() => setUpdatingRecord(null)}
        title="Update Postage Status"
        subtitle={
          updatingRecord
            ? `${updatingRecord.trackingNumber} · ${updatingRecord.courier}`
            : undefined
        }
        maxWidthClass="max-w-md"
        footer={
          updatingRecord && (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setUpdatingRecord(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="update-postage-status-form"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Update Status
              </button>
            </div>
          )
        }
      >
        {updatingRecord && (
          <form
            id="update-postage-status-form"
            onSubmit={handleSaveStatusUpdate}
            className="space-y-4 text-xs"
          >
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">DATE</span>
                <span className="font-medium text-slate-800 tabular-nums">
                  {formatDateShort(updatingRecord.date)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">SALE SUBMISSION</span>
                <span className="font-mono-tabular font-medium text-blue-700">
                  {updatingRecord.saleSubmissionId || 'Tidak'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">NO TRACKING</span>
                <span className="font-mono-tabular font-semibold text-slate-900">
                  {updatingRecord.trackingNumber}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">COURIER</span>
                <span className="font-medium text-slate-800">{updatingRecord.courier}</span>
              </div>
              <div className="pt-1 border-t border-slate-200">
                <span className="text-[11px] text-slate-500 block">DESCRIPTION</span>
                <span className="text-slate-800 font-medium">{updatingRecord.description}</span>
              </div>
            </div>

            <div>
              <label htmlFor="postage-update-status" className="block text-[11px] font-semibold text-slate-700 mb-1">
                STATUS
              </label>
              <select
                id="postage-update-status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as PostageTrackingStatus)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
              >
                {POSTAGE_STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="postage-update-remarks" className="block text-[11px] font-semibold text-slate-700 mb-1">
                Remarks <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <textarea
                id="postage-update-remarks"
                rows={2}
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
                placeholder="Catatan status penghantaran terkini..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>

            <p className="text-[11px] text-slate-500">
              Last updated by <strong className="text-slate-700">{updatingRecord.updatedBy}</strong> ·{' '}
              {formatDateTime(updatingRecord.updatedAt)}
            </p>
          </form>
        )}
      </Modal>

      {/* View Submission List — ID Modal */}
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
