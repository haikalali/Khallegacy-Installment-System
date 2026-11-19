import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Play,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import type {
  Branch,
  CheckingChecklist,
  CheckingStatus,
  InstallmentApplication,
} from '../types/khallegacy';
import { formatDateShort, formatDateTime, formatRM } from '../utils/businessRules';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, PaginationBar } from '../components/StateViews';
import { Modal } from '../components/Modal';

interface AgreementCheckingPageProps {
  applications: InstallmentApplication[];
  branches: Branch[];
  canCheck: boolean;
  defaultPageSize: number;
  onUpdateChecking: (
    appId: string,
    status: 'Checking in Progress' | 'Checking Passed' | 'Checking Failed',
    checklist: CheckingChecklist,
    remarks: string,
    staff1: string,
    staff2: string,
    invoiceNumber: string,
  ) => void;
  onSaveRemarksOnly: (
    appId: string,
    checklist: CheckingChecklist,
    remarks: string,
    staff1: string,
    staff2: string,
    invoiceNumber: string,
  ) => void;
}

const CHECKLIST_LABELS: { key: keyof CheckingChecklist; label: string }[] = [
  { key: 'signAndChopPages', label: '1. Sign and Chop required pages' },
  {
    key: 'customerSignatureComplete',
    label: '2. Customer signature complete on all agreement pages',
  },
  { key: 'invoiceDetails', label: '3. Invoice details' },
  { key: 'cafDetails', label: '4. CAF details' },
];

export const AgreementCheckingPage: React.FC<AgreementCheckingPageProps> = ({
  applications,
  branches,
  canCheck,
  defaultPageSize,
  onUpdateChecking,
  onSaveRemarksOnly,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | CheckingStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [draftChecklist, setDraftChecklist] = useState<CheckingChecklist>({
    signAndChopPages: false,
    customerSignatureComplete: false,
    invoiceDetails: false,
    cafDetails: false,
  });
  const [draftStaff1, setDraftStaff1] = useState('');
  const [draftStaff2, setDraftStaff2] = useState('');
  const [draftInvoice, setDraftInvoice] = useState('');
  const [draftRemarks, setDraftRemarks] = useState('');
  const [validationError, setValidationError] = useState('');

  const branchName = (id: string | null) =>
    id ? branches.find((b) => b.id === id)?.name ?? id : 'Belum Ditentukan';

  const receivedApps = useMemo(
    () => applications.filter((a) => a.agreement.receivedAt !== null),
    [applications],
  );

  const counts = useMemo(
    () => ({
      totalReceived: receivedApps.length,
      pending: receivedApps.filter((a) => a.agreement.checkingStatus === 'Pending Checking').length,
      inProgress: receivedApps.filter(
        (a) => a.agreement.checkingStatus === 'Checking in Progress',
      ).length,
      passed: receivedApps.filter((a) => a.agreement.checkingStatus === 'Checking Passed').length,
      failed: receivedApps.filter((a) => a.agreement.checkingStatus === 'Checking Failed').length,
    }),
    [receivedApps],
  );

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return receivedApps.filter((app) => {
      if (statusFilter !== 'ALL' && app.agreement.checkingStatus !== statusFilter) return false;
      if (q) {
        const hit =
          app.caseId.toLowerCase().includes(q) ||
          app.customerName.toLowerCase().includes(q) ||
          app.icNumber.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (branchFilter !== 'ALL' && app.pickupBranchId !== branchFilter) return false;
      return true;
    });
  }, [receivedApps, statusFilter, searchTerm, branchFilter]);

  const paginated = useMemo(() => {
    const safePage = Math.min(currentPage, Math.max(1, Math.ceil(filtered.length / pageSize)));
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const activeApp = useMemo(
    () => applications.find((a) => a.id === activeAppId) ?? null,
    [applications, activeAppId],
  );

  const openCheckingWorkspace = (app: InstallmentApplication) => {
    setActiveAppId(app.id);
    setDraftChecklist({
      signAndChopPages: Boolean(app.agreement.checkingChecklist.signAndChopPages),
      customerSignatureComplete: Boolean(app.agreement.checkingChecklist.customerSignatureComplete),
      invoiceDetails: Boolean(app.agreement.checkingChecklist.invoiceDetails),
      cafDetails: Boolean(app.agreement.checkingChecklist.cafDetails),
    });
    setDraftStaff1(app.agreement.checkingStaff1 || '');
    setDraftStaff2(app.agreement.checkingStaff2 || '');
    setDraftInvoice(app.agreement.invoiceNumber || '');
    setDraftRemarks(app.agreement.checkingRemarks || '');
    setValidationError('');
  };

  const completedChecklistCount = CHECKLIST_LABELS.filter((item) => draftChecklist[item.key]).length;
  const allChecklistSelected = completedChecklistCount === CHECKLIST_LABELS.length;

  return (
    <div className="space-y-5">
      {/* 5 Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {(
          [
            { key: 'ALL', label: 'Total Received', value: counts.totalReceived, color: 'text-slate-900' },
            { key: 'Pending Checking', label: 'Pending Checking', value: counts.pending, color: 'text-amber-600' },
            { key: 'Checking in Progress', label: 'Checking in Progress', value: counts.inProgress, color: 'text-blue-600' },
            { key: 'Checking Passed', label: 'Checking Passed', value: counts.passed, color: 'text-emerald-600' },
            { key: 'Checking Failed', label: 'Checking Failed', value: counts.failed, color: 'text-red-600' },
          ] as const
        ).map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => {
              setStatusFilter(card.key);
              setCurrentPage(1);
            }}
            className={`text-left bg-white border rounded-xl p-4 transition-colors ${
              statusFilter === card.key
                ? 'border-blue-500 ring-1 ring-blue-500/20'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <p className="text-xs font-medium text-slate-500">{card.label}</p>
            <p className={`text-2xl font-semibold tabular-nums mt-1 ${card.color}`}>
              {card.value}
            </p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label htmlFor="chk-search" className="block text-[11px] font-medium text-slate-500 mb-1">
              Search CASE ID, Name, or IC
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="chk-search"
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search CASE ID, customer, IC..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="chk-branch" className="block text-[11px] font-medium text-slate-500 mb-1">
              Pickup Branch
            </label>
            <select
              id="chk-branch"
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Pickup Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setSearchTerm('');
                setBranchFilter('ALL');
                setCurrentPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Checking Queue Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No received agreements in this checking view"
          description="Receive eligible agreements in Agreement Receive (TERIMA) or adjust your status filter."
          actionLabel="Show All Received"
          onAction={() => {
            setStatusFilter('ALL');
            setSearchTerm('');
            setBranchFilter('ALL');
          }}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 whitespace-nowrap">CASE ID</th>
                  <th className="py-3 px-3 whitespace-nowrap">CUSTOMER NAME</th>
                  <th className="py-3 px-3 whitespace-nowrap">IC NUMBER</th>
                  <th className="py-3 px-3 whitespace-nowrap">PICKUP BRANCH</th>
                  <th className="py-3 px-3 whitespace-nowrap">RECEIVED DATE</th>
                  <th className="py-3 px-3 whitespace-nowrap">RECEIVED BY</th>
                  <th className="py-3 px-3 whitespace-nowrap">CHECKING STATUS</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginated.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap font-mono-tabular font-semibold text-blue-600">
                      {app.caseId}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-900">
                      {app.customerName}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-mono-tabular text-slate-600">
                      {app.icNumber}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-slate-700">
                      {branchName(app.pickupBranchId)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap tabular-nums text-slate-600">
                      {formatDateShort(app.agreement.receivedAt)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-slate-700">
                      {app.agreement.receivedBy || '—'}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <StatusBadge status={app.agreement.checkingStatus} compact />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => openCheckingWorkspace(app)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        Open Checking
                      </button>
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

      {/* Agreement Checking Workspace Modal */}
      <Modal
        open={Boolean(activeApp)}
        onClose={() => setActiveAppId(null)}
        title={
          activeApp
            ? `Agreement Checking — ${activeApp.caseId}`
            : 'Agreement Checking'
        }
        subtitle={
          activeApp
            ? `Agreement No: ${activeApp.agreement.agreementNumber || '—'} · Received by ${
                activeApp.agreement.receivedBy
              }`
            : undefined
        }
        maxWidthClass="max-w-3xl"
        footer={
          activeApp && (
            <div className="w-full flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setActiveAppId(null)}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Close
              </button>

              {activeApp.agreement.dispatchStatus !== 'Dispatched' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!canCheck}
                    onClick={() => {
                      onSaveRemarksOnly(
                        activeApp.id,
                        draftChecklist,
                        draftRemarks,
                        draftStaff1,
                        draftStaff2,
                        draftInvoice,
                      );
                      setActiveAppId(null);
                    }}
                    className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                  >
                    Save Remarks
                  </button>

                  {activeApp.agreement.checkingStatus === 'Pending Checking' && (
                    <button
                      type="button"
                      disabled={!canCheck}
                      onClick={() => {
                        onUpdateChecking(
                          activeApp.id,
                          'Checking in Progress',
                          draftChecklist,
                          draftRemarks,
                          draftStaff1,
                          draftStaff2,
                          draftInvoice,
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg disabled:opacity-40"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Start Checking
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={!canCheck}
                    onClick={() => {
                      if (!draftRemarks.trim()) {
                        setValidationError(
                          'Please provide remarks explaining why checking failed.',
                        );
                        return;
                      }
                      onUpdateChecking(
                        activeApp.id,
                        'Checking Failed',
                        draftChecklist,
                        draftRemarks,
                        draftStaff1,
                        draftStaff2,
                        draftInvoice,
                      );
                      setActiveAppId(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg disabled:opacity-40"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Mark as Checking Failed
                  </button>

                  <button
                    type="button"
                    disabled={!canCheck}
                    onClick={() => {
                      if (completedChecklistCount < CHECKLIST_LABELS.length) {
                        setValidationError(
                          'All 4 checking checklist items must be verified before passing.',
                        );
                        return;
                      }
                      onUpdateChecking(
                        activeApp.id,
                        'Checking Passed',
                        draftChecklist,
                        draftRemarks,
                        draftStaff1,
                        draftStaff2,
                        draftInvoice,
                      );
                      setActiveAppId(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Mark as Checking Passed
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-500">
                  Dispatched to JCL Credit — checking record locked.
                </span>
              )}
            </div>
          )
        }
      >
        {activeApp && (
          <div className="space-y-5 text-xs">
            {validationError && (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 font-medium"
              >
                {validationError}
              </div>
            )}

            {/* Customer + Agreement Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">
                  Customer Information
                </p>
                <p className="font-semibold text-slate-900">{activeApp.customerName}</p>
                <p className="font-mono-tabular text-slate-600">
                  IC: {activeApp.icNumber} · {activeApp.phone}
                </p>
                <p className="text-slate-600">
                  Pickup Branch: {branchName(activeApp.pickupBranchId)}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">
                  Agreement &amp; Product Summary
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-mono-tabular font-semibold text-slate-900">
                    {activeApp.agreement.agreementNumber}
                  </span>
                  <StatusBadge status={activeApp.agreement.checkingStatus} compact />
                </div>
                <p className="text-slate-600">
                  {activeApp.products.map((p) => `${p.productName} (${p.quantity}x)`).join(', ')}
                </p>
                <div className="pt-1 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Total Product Price:</span>
                    <span className="font-mono-tabular font-medium text-slate-900">
                      {formatRM(activeApp.financing.totalProductPrice)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Deposit:</span>
                    <span className="font-mono-tabular font-medium text-slate-900">
                      {formatRM(activeApp.financing.deposit)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Monthly Installment:</span>
                    <span className="font-mono-tabular font-semibold text-blue-700">
                      {formatRM(activeApp.financing.monthlyInstallment)} ({activeApp.financing.installmentDuration} mos)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Staff & Invoice Details (STAFF 1, STAFF 2 & INVOICE) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label
                  htmlFor="checking-staff-1"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  STAFF 1 <span className="font-normal text-slate-500">(who prepared agreement)</span>
                </label>
                <input
                  id="checking-staff-1"
                  type="text"
                  disabled={!canCheck || activeApp.agreement.dispatchStatus === 'Dispatched'}
                  value={draftStaff1}
                  onChange={(e) => {
                    setDraftStaff1(e.target.value);
                    setValidationError('');
                  }}
                  placeholder="Nama staf yang menyediakan agreement"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label
                  htmlFor="checking-staff-2"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  STAFF 2 <span className="font-normal text-slate-500">(who served customer)</span>
                </label>
                <input
                  id="checking-staff-2"
                  type="text"
                  disabled={!canCheck || activeApp.agreement.dispatchStatus === 'Dispatched'}
                  value={draftStaff2}
                  onChange={(e) => {
                    setDraftStaff2(e.target.value);
                    setValidationError('');
                  }}
                  placeholder="Nama staf yang melayan pelanggan"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label
                  htmlFor="checking-invoice"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  INVOICE <span className="font-normal text-slate-500">(invoice number / ref)</span>
                </label>
                <input
                  id="checking-invoice"
                  type="text"
                  disabled={!canCheck || activeApp.agreement.dispatchStatus === 'Dispatched'}
                  value={draftInvoice}
                  onChange={(e) => {
                    setDraftInvoice(e.target.value);
                    setValidationError('');
                  }}
                  placeholder="e.g. INV-2026-0001"
                  className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Verification Checklist with Select All */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <h3 className="text-xs font-semibold text-slate-900">Verification Checklist</h3>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      disabled={!canCheck || activeApp.agreement.dispatchStatus === 'Dispatched'}
                      checked={allChecklistSelected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setDraftChecklist({
                          signAndChopPages: checked,
                          customerSignatureComplete: checked,
                          invoiceDetails: checked,
                          cafDetails: checked,
                        });
                        setValidationError('');
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Select All</span>
                  </label>
                  <span className="font-mono-tabular text-xs font-semibold text-blue-600">
                    {completedChecklistCount}/{CHECKLIST_LABELS.length} Verified
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CHECKLIST_LABELS.map((item) => (
                  <label
                    key={item.key}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      draftChecklist[item.key]
                        ? 'bg-emerald-50/50 border-emerald-200 text-slate-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!canCheck || activeApp.agreement.dispatchStatus === 'Dispatched'}
                      checked={draftChecklist[item.key]}
                      onChange={(e) => {
                        setDraftChecklist((prev) => ({
                          ...prev,
                          [item.key]: e.target.checked,
                        }));
                        setValidationError('');
                      }}
                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="leading-snug">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Internal Remarks */}
            <div>
              <label htmlFor="checking-remarks" className="block text-xs font-semibold text-slate-900 mb-1.5">
                Internal Remarks
              </label>
              <textarea
                id="checking-remarks"
                rows={3}
                disabled={!canCheck || activeApp.agreement.dispatchStatus === 'Dispatched'}
                value={draftRemarks}
                onChange={(e) => {
                  setDraftRemarks(e.target.value);
                  setValidationError('');
                }}
                placeholder="Add checking verification notes or missing document details..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Checking History */}
            <div>
              <h3 className="text-xs font-semibold text-slate-900 mb-2">Checking History</h3>
              <ul className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50">
                {activeApp.timeline.map((evt) => (
                  <li key={evt.id} className="flex items-start justify-between gap-3 text-[11px]">
                    <div>
                      <span className="font-semibold text-slate-800">{evt.actionType}:</span>{' '}
                      <span className="text-slate-600">{evt.description}</span>
                    </div>
                    <span className="tabular-nums text-slate-400 shrink-0">
                      {formatDateTime(evt.timestamp)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
