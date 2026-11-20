import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  PackageCheck,
  RotateCcw,
  Search,
} from 'lucide-react';
import type {
  Branch,
  CollectionConfirmationStatus,
  CustomerStockDecision,
  InstallmentApplication,
  StockWorkflowStage,
} from '../types/khallegacy';
import {
  deriveStockFollowUp,
  formatDateShort,
  formatDateTime,
  type UpdateStockFollowUpPayload,
} from '../utils/businessRules';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { EmptyState, PaginationBar } from '../components/StateViews';

interface StockManagementPageProps {
  applications: InstallmentApplication[];
  branches: Branch[];
  canManage: boolean;
  onUpdateStockFollowUp: (appId: string, payload: UpdateStockFollowUpPayload) => void;
  onPassStockToBranch: (appId: string, passDate: string) => void;
}

type StatFilterKey =
  | ''
  | 'NOT YET CHECKING'
  | 'READY'
  | 'NO STOCK'
  | 'IN TRANSIT'
  | 'STOK OTW'
  | 'PENDING'
  | 'CONFIRMED'
  | 'STOCK PASSED';

type StockSortKey =
  | 'approvalDate'
  | 'customerName'
  | 'pickupBranch'
  | 'product'
  | 'colour'
  | 'stockStage'
  | 'customerDecision'
  | 'collectionConfirmation'
  | 'passDate'
  | 'action'
  | 'remark';

export const StockManagementPage: React.FC<StockManagementPageProps> = ({
  applications,
  branches,
  canManage,
  onUpdateStockFollowUp,
  onPassStockToBranch,
}) => {
  const [monthFilter, setMonthFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('');
  const [fromBranchFilter, setFromBranchFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [passStatusFilter, setPassStatusFilter] = useState('');
  const [approvalDateFilter, setApprovalDateFilter] = useState('');
  const [activeStatFilter, setActiveStatFilter] = useState<StatFilterKey>('');
  const [sortKey, setSortKey] = useState<StockSortKey>('approvalDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  // Follow-up Card Modal State
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [formFromBranch, setFormFromBranch] = useState('');
  const [formPickupBranch, setFormPickupBranch] = useState('');
  const [formColour, setFormColour] = useState('');
  const [formColour2, setFormColour2] = useState('');
  const [formColour3, setFormColour3] = useState('');
  const [formStockStage, setFormStockStage] = useState<StockWorkflowStage>('NOT YET CHECKING');
  const [formDecision, setFormDecision] = useState<CustomerStockDecision>('PENDING DECISION');
  const [formCollection, setFormCollection] = useState<CollectionConfirmationStatus>('PENDING');
  const [formPassDate, setFormPassDate] = useState('');
  const [formRemark, setFormRemark] = useState('');
  const [cardError, setCardError] = useState<string | null>(null);

  // Pass Stock Modal State
  const [passModalAppId, setPassModalAppId] = useState<string | null>(null);
  const [passDateInput, setPassDateInput] = useState('2026-11-17');
  const [passError, setPassError] = useState<string | null>(null);

  const branchLabel = (id: string | null) => {
    if (!id) return 'Belum Ditentukan';
    if (id === 'POSTAGE') return 'POSTAGE';
    if (id === 'WEB') return 'WEB';
    return branches.find((b) => b.id === id)?.name ?? id;
  };

  // Approved applications flow automatically into Stock Management
  const approvedRecords = useMemo(() => {
    return applications
      .filter((a) => a.approvalStatus === 'Approved')
      .map((app) => {
        const followUp = deriveStockFollowUp(app);
        const approvalDate = app.approvalDate || app.applicationDate;
        const productTitle = app.products
          .map((p) => (p.quantity > 1 ? `${p.productName} (×${p.quantity})` : p.productName))
          .join(', ');
        const passDate = app.products.every((p) => Boolean(p.datePassStock))
          ? app.products[0]?.datePassStock || ''
          : '';
        return {
          app,
          followUp,
          approvalDate,
          monthKey: approvalDate.slice(0, 7),
          productTitle,
          passDate,
        };
      })
      .sort((a, b) => b.approvalDate.localeCompare(a.approvalDate));
  }, [applications]);

  const monthOptions = useMemo(() => {
    const keys = Array.from(new Set(approvedRecords.map((r) => r.monthKey).filter(Boolean)))
      .sort()
      .reverse();
    return keys.map((k) => {
      const [y, m] = k.split('-');
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-MY', {
        month: 'long',
        year: 'numeric',
      });
      return { value: k, label };
    });
  }, [approvedRecords]);

  const monthRecords = useMemo(() => {
    if (!monthFilter) return approvedRecords;
    return approvedRecords.filter((r) => r.monthKey === monthFilter);
  }, [approvedRecords, monthFilter]);

  const stats = useMemo(() => {
    const active = monthRecords.filter((r) => r.followUp.customerDecision !== 'CANCELLED');
    return {
      notYetChecking: active.filter((r) => r.followUp.stockStage === 'NOT YET CHECKING').length,
      ready: active.filter((r) => r.followUp.stockStage === 'READY').length,
      noStock: active.filter((r) => r.followUp.stockStage === 'NO STOCK').length,
      inTransit: active.filter((r) => r.followUp.stockStage === 'IN TRANSIT').length,
      stokOtw: active.filter((r) => r.followUp.stockStage === 'STOK OTW').length,
      pendingCustomer: active.filter((r) => r.followUp.collectionConfirmation !== 'CONFIRMED')
        .length,
      confirmedCustomer: monthRecords.filter(
        (r) =>
          r.followUp.collectionConfirmation === 'CONFIRMED' &&
          r.followUp.customerDecision !== 'CANCELLED',
      ).length,
      stockPassed: active.filter((r) => Boolean(r.passDate)).length,
    };
  }, [monthRecords]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return monthRecords
      .filter((r) => {
        const f = r.followUp;
        const canPass =
          f.stockStage === 'READY' &&
          f.collectionConfirmation === 'CONFIRMED' &&
          f.customerDecision !== 'CANCELLED';

        const statMatch =
          !activeStatFilter ||
          (activeStatFilter === 'PENDING'
            ? f.collectionConfirmation !== 'CONFIRMED' && f.customerDecision !== 'CANCELLED'
            : activeStatFilter === 'CONFIRMED'
              ? f.collectionConfirmation === 'CONFIRMED' && f.customerDecision !== 'CANCELLED'
              : activeStatFilter === 'STOCK PASSED'
                ? Boolean(r.passDate) && f.customerDecision !== 'CANCELLED'
                : f.stockStage === activeStatFilter && f.customerDecision !== 'CANCELLED');

        const searchMatch =
          !q ||
          r.app.caseId.toLowerCase().includes(q) ||
          r.app.customerName.toLowerCase().includes(q) ||
          r.productTitle.toLowerCase().includes(q) ||
          f.colour.toLowerCase().includes(q) ||
          f.remark.toLowerCase().includes(q);

        const stockMatch = !stockFilter || f.stockStage === stockFilter;
        const decisionMatch = !decisionFilter || f.customerDecision === decisionFilter;
        const collectionMatch = !collectionFilter || f.collectionConfirmation === collectionFilter;
        const fromBranchMatch =
          !fromBranchFilter || r.app.customerFromBranchId === fromBranchFilter;

        const branchMatch =
          !branchFilter ||
          (branchFilter === 'UNASSIGNED'
            ? r.app.pickupBranchId === null
            : r.app.pickupBranchId === branchFilter);

        const passStatusMatch =
          !passStatusFilter ||
          (passStatusFilter === 'READY_TO_PASS'
            ? canPass && !r.passDate
            : passStatusFilter === 'PASSED'
              ? Boolean(r.passDate)
              : !canPass && !r.passDate);

        const dateMatch = !approvalDateFilter || r.approvalDate === approvalDateFilter;

        return (
          statMatch &&
          searchMatch &&
          stockMatch &&
          decisionMatch &&
          collectionMatch &&
          fromBranchMatch &&
          branchMatch &&
          passStatusMatch &&
          dateMatch
        );
      })
      .sort((a, b) => {
        const getActionOrder = (rec: typeof a) => {
          const ready =
            rec.followUp.stockStage === 'READY' &&
            rec.followUp.collectionConfirmation === 'CONFIRMED' &&
            rec.followUp.customerDecision !== 'CANCELLED';
          if (ready && !rec.passDate) return '1-READY_TO_PASS';
          if (rec.passDate) return '2-PASSED';
          return '3-PENDING';
        };

        const getValue = (rec: typeof a): string => {
          switch (sortKey) {
            case 'approvalDate':
              return rec.approvalDate || '';
            case 'customerName':
              return rec.app.customerName || '';
            case 'pickupBranch':
              return branchLabel(rec.app.pickupBranchId);
            case 'product':
              return rec.productTitle || '';
            case 'colour':
              return rec.followUp.colour || '';
            case 'stockStage':
              return rec.followUp.stockStage;
            case 'customerDecision':
              return rec.followUp.customerDecision;
            case 'collectionConfirmation':
              return rec.followUp.collectionConfirmation;
            case 'passDate':
              return rec.passDate || '';
            case 'action':
              return getActionOrder(rec);
            case 'remark':
              return rec.followUp.remark || '';
            default:
              return rec.approvalDate || '';
          }
        };

        const va = getValue(a);
        const vb = getValue(b);
        const cmp = va.localeCompare(vb);
        if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp;
        return b.approvalDate.localeCompare(a.approvalDate);
      });
  }, [
    monthRecords,
    activeStatFilter,
    searchQuery,
    stockFilter,
    decisionFilter,
    collectionFilter,
    fromBranchFilter,
    branchFilter,
    passStatusFilter,
    approvalDateFilter,
    sortKey,
    sortDir,
    branches,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageRecords = filteredRecords.slice(pageStart, pageStart + pageSize);

  const toggleStatFilter = (key: StatFilterKey) => {
    setActiveStatFilter((prev) => (prev === key ? '' : key));
    setStockFilter('');
    setDecisionFilter('');
    setCollectionFilter('');
    setPassStatusFilter('');
    setCurrentPage(1);
  };

  const toggleSort = (key: StockSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'approvalDate' || key === 'passDate' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  const resetAllFilters = () => {
    setMonthFilter('');
    setSearchQuery('');
    setStockFilter('');
    setDecisionFilter('');
    setCollectionFilter('');
    setFromBranchFilter('');
    setBranchFilter('');
    setPassStatusFilter('');
    setApprovalDateFilter('');
    setActiveStatFilter('');
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    activeStatFilter ||
      stockFilter ||
      decisionFilter ||
      collectionFilter ||
      fromBranchFilter ||
      branchFilter ||
      passStatusFilter ||
      approvalDateFilter ||
      searchQuery ||
      monthFilter,
  );

  const editingRecord = useMemo(
    () => approvedRecords.find((r) => r.app.id === editingAppId) ?? null,
    [approvedRecords, editingAppId],
  );

  const passModalRecord = useMemo(
    () => approvedRecords.find((r) => r.app.id === passModalAppId) ?? null,
    [approvedRecords, passModalAppId],
  );

  const openFollowUpCard = (appId: string) => {
    const rec = approvedRecords.find((r) => r.app.id === appId);
    if (!rec) return;
    setEditingAppId(appId);
    setFormFromBranch(rec.app.customerFromBranchId);
    setFormPickupBranch(rec.app.pickupBranchId ?? '');
    setFormColour(rec.followUp.colour);
    setFormColour2(rec.followUp.colour2 || '');
    setFormColour3(rec.followUp.colour3 || '');
    setFormStockStage(rec.followUp.stockStage);
    setFormDecision(rec.followUp.customerDecision);
    setFormCollection(rec.followUp.collectionConfirmation);
    setFormPassDate(rec.passDate || '');
    setFormRemark(rec.followUp.remark);
    setCardError(null);
  };

  const handleSaveCard = () => {
    if (!editingRecord) return;
    if (formDecision === 'CANCELLED' && !formRemark.trim()) {
      setCardError('Sila isi sebab cancellation dalam Remark.');
      return;
    }
    const normalizedPass = formPassDate.trim() || null;
    if (
      normalizedPass &&
      !(formStockStage === 'READY' && formCollection === 'CONFIRMED' && formDecision !== 'CANCELLED')
    ) {
      setCardError(
        'Date Pass Stok hanya boleh diisi apabila Stock Status READY dan Collection Confirmation CONFIRMED.',
      );
      return;
    }

    onUpdateStockFollowUp(editingRecord.app.id, {
      customerFromBranchId: formFromBranch,
      pickupBranchId: formPickupBranch || null,
      colour: formColour,
      colour2: formColour2,
      colour3: formColour3,
      stockStage: formStockStage,
      customerDecision: formDecision,
      collectionConfirmation: formCollection,
      datePassStock: normalizedPass,
      remark: formRemark,
    });
    setEditingAppId(null);
  };

  const openPassModal = (appId: string) => {
    const rec = approvedRecords.find((r) => r.app.id === appId);
    if (!rec) return;
    setPassModalAppId(appId);
    setPassDateInput(rec.passDate || '2026-11-17');
    setPassError(null);
  };

  const handleConfirmPass = () => {
    if (!passModalRecord) return;
    if (!passDateInput.trim()) {
      setPassError('Sila pilih Date Pass Stok.');
      return;
    }
    onPassStockToBranch(passModalRecord.app.id, passDateInput.trim());
    setPassModalAppId(null);
  };

  const statCards: {
    key: StatFilterKey;
    label: string;
    value: number;
    hint: string;
    toneClass: string;
    ringClass: string;
  }[] = [
    {
      key: 'NOT YET CHECKING',
      label: 'NOT YET CHECKING',
      value: stats.notYetChecking,
      hint: 'Stok belum diperiksa',
      toneClass: 'text-slate-900',
      ringClass: 'border-slate-500 ring-1 ring-slate-500/20',
    },
    {
      key: 'READY',
      label: 'STOCK READY',
      value: stats.ready,
      hint: 'Produk customer tersedia',
      toneClass: 'text-emerald-600',
      ringClass: 'border-emerald-500 ring-1 ring-emerald-500/20',
    },
    {
      key: 'NO STOCK',
      label: 'NO STOCK',
      value: stats.noStock,
      hint: 'Produk belum tersedia',
      toneClass: 'text-red-600',
      ringClass: 'border-red-500 ring-1 ring-red-500/20',
    },
    {
      key: 'IN TRANSIT',
      label: 'IN TRANSIT',
      value: stats.inTransit,
      hint: 'Stok dalam penghantaran',
      toneClass: 'text-amber-600',
      ringClass: 'border-amber-500 ring-1 ring-amber-500/20',
    },
    {
      key: 'STOK OTW',
      label: 'STOK OTW',
      value: stats.stokOtw,
      hint: 'Stok sedang dalam perjalanan',
      toneClass: 'text-amber-600',
      ringClass: 'border-amber-500 ring-1 ring-amber-500/20',
    },
    {
      key: 'PENDING',
      label: 'PENDING CUSTOMER',
      value: stats.pendingCustomer,
      hint: 'Menunggu keputusan / pengesahan',
      toneClass: 'text-slate-900',
      ringClass: 'border-blue-500 ring-1 ring-blue-500/20',
    },
    {
      key: 'CONFIRMED',
      label: 'CONFIRMED CUSTOMER',
      value: stats.confirmedCustomer,
      hint: 'Customer sahkan collection',
      toneClass: 'text-emerald-600',
      ringClass: 'border-emerald-500 ring-1 ring-emerald-500/20',
    },
    {
      key: 'STOCK PASSED',
      label: 'STOK PASSED',
      value: stats.stockPassed,
      hint: 'Stok telah dipass ke branch',
      toneClass: 'text-blue-600',
      ringClass: 'border-blue-500 ring-1 ring-blue-500/20',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header + Month Filter */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
            Stock Management &amp; Branch Handover
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Semak status stok, pilihan warna dan pengesahan customer sebelum serahan kepada branch &amp; Agreement Receive.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <label
            htmlFor="stock-month-filter"
            className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap"
          >
            Filter Month
          </label>
          <select
            id="stock-month-filter"
            value={monthFilter}
            onChange={(e) => {
              setMonthFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="min-w-[180px] px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          >
            <option value="">All Months</option>
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 8 Interactive Click-to-Filter KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {statCards.map((card) => {
          const isActive = activeStatFilter === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => toggleStatFilter(card.key)}
              aria-pressed={isActive}
              className={`text-left bg-white border rounded-xl p-4 transition-colors ${
                isActive ? card.ringClass : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {card.label}
              </p>
              <p className={`text-2xl font-semibold tabular-nums mt-1.5 ${card.toneClass}`}>
                {card.value}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">{card.hint}</p>
            </button>
          );
        })}
      </div>

      {/* Filters Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Customer Stock List</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Permohonan yang telah lulus akan muncul di sini secara automatik. Klik baris untuk mengemaskini follow-up.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <span className="text-[11px] text-slate-500 tabular-nums">
              <strong className="text-slate-800">{filteredRecords.length}</strong> rekod dipaparkan
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Filters
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
          <div className="lg:col-span-4 relative">
            <label htmlFor="stock-search-input" className="sr-only">
              Search customer name, CASE ID, product, colour, or remark
            </label>
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="stock-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari nama, CASE ID, product, colour, remark..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="stock-status-filter" className="sr-only">
              Filter by Stock Status
            </label>
            <select
              id="stock-status-filter"
              value={stockFilter}
              onChange={(e) => {
                setActiveStatFilter('');
                setStockFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Stock Status</option>
              <option value="NOT YET CHECKING">NOT YET CHECKING</option>
              <option value="READY">READY</option>
              <option value="NO STOCK">NO STOCK</option>
              <option value="IN TRANSIT">IN TRANSIT</option>
              <option value="STOK OTW">STOK OTW</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="stock-decision-filter" className="sr-only">
              Filter by Customer Decision
            </label>
            <select
              id="stock-decision-filter"
              value={decisionFilter}
              onChange={(e) => {
                setActiveStatFilter('');
                setDecisionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Customer Decision</option>
              <option value="PENDING DECISION">PENDING DECISION</option>
              <option value="ACCEPT">ACCEPT</option>
              <option value="WAIT ORIGINAL COLOUR">WAIT ORIGINAL COLOUR</option>
              <option value="WAIT ALTERNATIVE COLOUR">WAIT ALTERNATIVE COLOUR</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="stock-collection-filter" className="sr-only">
              Filter by Collection Confirmation
            </label>
            <select
              id="stock-collection-filter"
              value={collectionFilter}
              onChange={(e) => {
                setActiveStatFilter('');
                setCollectionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Collection Confirm</option>
              <option value="PENDING">PENDING</option>
              <option value="CONFIRMED">CONFIRMED</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="stock-pass-filter" className="sr-only">
              Filter by Pass Stock Status
            </label>
            <select
              id="stock-pass-filter"
              value={passStatusFilter}
              onChange={(e) => {
                setActiveStatFilter('');
                setPassStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Pass Stock</option>
              <option value="READY_TO_PASS">Ready to Pass</option>
              <option value="PASSED">Already Passed</option>
              <option value="NOT_READY">Not Ready Yet</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
          <div className="lg:col-span-4">
            <label htmlFor="stock-from-branch-filter" className="sr-only">
              Filter by Customer Original Branch
            </label>
            <select
              id="stock-from-branch-filter"
              value={fromBranchFilter}
              onChange={(e) => {
                setFromBranchFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Original Branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
              <option value="WEB">WEB</option>
            </select>
          </div>

          <div className="lg:col-span-4">
            <label htmlFor="stock-pickup-filter" className="sr-only">
              Filter by Pickup Branch
            </label>
            <select
              id="stock-pickup-filter"
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Branch Pickup</option>
              <option value="UNASSIGNED">Belum Ditentukan</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
              <option value="POSTAGE">POSTAGE</option>
            </select>
          </div>

          <div className="lg:col-span-4">
            <label htmlFor="stock-approval-date-filter" className="sr-only">
              Filter by Approval Date
            </label>
            <input
              id="stock-approval-date-filter"
              type="date"
              value={approvalDateFilter}
              onChange={(e) => {
                setApprovalDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by Approval Date"
              title="Filter by Approval Date"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 tabular-nums focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Data Table (Approval List style) */}
      {filteredRecords.length === 0 ? (
        <EmptyState
          title="Tiada rekod customer dalam Stock Management"
          description="Tiada permohonan diluluskan yang sepadan dengan tapisan bulan, carian, atau status stok semasa."
          actionLabel="Reset Filters"
          onAction={resetAllFilters}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 pl-3 pr-1.5 whitespace-nowrap">BIL.</th>
                  {(
                    [
                      { key: 'approvalDate', label: 'APPROVAL DATE' },
                      { key: 'customerName', label: 'NAMA CUSTOMER' },
                      { key: 'pickupBranch', label: 'BRANCH PICKUP' },
                      { key: 'product', label: 'PRODUCT' },
                      { key: 'colour', label: 'COLOUR' },
                      { key: 'stockStage', label: 'STOK STATUS' },
                      { key: 'customerDecision', label: 'CUSTOMER DECISION' },
                      { key: 'collectionConfirmation', label: 'COLLECTION CONFIRM' },
                      { key: 'passDate', label: 'DATE PASS STOK' },
                      { key: 'action', label: 'ACTION' },
                      { key: 'remark', label: 'REMARK' },
                    ] as { key: StockSortKey; label: string }[]
                  ).map((col, colIdx, arr) => {
                    const isActive = sortKey === col.key;
                    const isLast = colIdx === arr.length - 1;
                    return (
                      <th
                        key={col.key}
                        aria-sort={
                          isActive
                            ? sortDir === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                        className={`py-3 ${isLast ? 'pl-1.5 pr-3' : 'px-1.5'} whitespace-nowrap`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          className={`inline-flex items-center gap-1 hover:text-slate-900 transition-colors ${
                            isActive ? 'text-blue-600' : ''
                          }`}
                        >
                          <span>{col.label}</span>
                          {isActive ? (
                            sortDir === 'asc' ? (
                              <ArrowUp className="w-3 h-3 shrink-0" aria-hidden="true" />
                            ) : (
                              <ArrowDown className="w-3 h-3 shrink-0" aria-hidden="true" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 shrink-0" aria-hidden="true" />
                          )}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {pageRecords.map((rec, idx) => {
                  const { app, followUp, approvalDate, productTitle, passDate } = rec;
                  const canPass =
                    followUp.stockStage === 'READY' &&
                    followUp.collectionConfirmation === 'CONFIRMED' &&
                    followUp.customerDecision !== 'CANCELLED';
                  const pickupText =
                    app.pickupBranchId === null
                      ? 'Belum Ditentukan'
                      : branchLabel(app.pickupBranchId);

                  return (
                    <tr
                      key={app.id}
                      onClick={() => openFollowUpCard(app.id)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3 pl-3 pr-1.5 whitespace-nowrap tabular-nums text-slate-500">
                        {pageStart + idx + 1}
                      </td>
                      <td className="py-3 px-1.5 whitespace-nowrap tabular-nums text-slate-600">
                        {formatDateShort(approvalDate)}
                      </td>
                      <td
                        className="py-3 px-1.5 whitespace-nowrap max-w-[180px] truncate"
                        title={`${app.customerName} (${app.caseId} · ${branchLabel(
                          app.customerFromBranchId,
                        )})`}
                      >
                        <div className="font-medium text-slate-900 truncate">
                          {app.customerName}
                        </div>
                        <div className="font-mono-tabular text-[10.5px] text-slate-500 truncate">
                          {app.caseId} · {branchLabel(app.customerFromBranchId)}
                        </div>
                      </td>
                      <td
                        className="py-3 px-1.5 whitespace-nowrap text-slate-700 max-w-[130px] truncate"
                        title={pickupText}
                      >
                        {app.pickupBranchId === 'POSTAGE' ? (
                          <StatusBadge status="POSTAGE" compact />
                        ) : app.pickupBranchId === null ? (
                          <span className="text-amber-700 font-medium">Belum Ditentukan</span>
                        ) : (
                          branchLabel(app.pickupBranchId)
                        )}
                      </td>
                      <td
                        className="py-3 px-1.5 whitespace-nowrap text-slate-700 max-w-[180px] truncate"
                        title={productTitle}
                      >
                        {productTitle}
                      </td>
                      <td
                        className="py-3 px-1.5 whitespace-nowrap text-slate-700 max-w-[120px] truncate"
                        title={followUp.colour || '—'}
                      >
                        {followUp.colour || '—'}
                      </td>
                      <td className="py-3 px-1.5 whitespace-nowrap">
                        <StatusBadge status={followUp.stockStage} compact />
                      </td>
                      <td className="py-3 px-1.5 whitespace-nowrap">
                        <StatusBadge status={followUp.customerDecision} compact />
                      </td>
                      <td className="py-3 px-1.5 whitespace-nowrap">
                        <StatusBadge status={followUp.collectionConfirmation} compact />
                      </td>
                      <td className="py-3 px-1.5 whitespace-nowrap tabular-nums text-slate-600">
                        {passDate ? formatDateShort(passDate) : '—'}
                      </td>
                      <td className="py-3 px-1.5 whitespace-nowrap">
                        {canPass ? (
                          passDate ? (
                            <StatusBadge status="PASSED" tone="green" compact />
                          ) : (
                            <button
                              type="button"
                              disabled={!canManage}
                              onClick={(e) => {
                                e.stopPropagation();
                                openPassModal(app.id);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-md transition-colors whitespace-nowrap"
                            >
                              <PackageCheck className="w-3.5 h-3.5 shrink-0" />
                              Pass Stock
                            </button>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td
                        className="py-3 pl-1.5 pr-3 whitespace-nowrap text-slate-600 max-w-[180px] truncate"
                        title={followUp.remark || '—'}
                      >
                        {followUp.remark || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationBar
            totalItems={filteredRecords.length}
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

      {/* Customer Follow-up Card Modal */}
      <Modal
        open={Boolean(editingRecord)}
        onClose={() => setEditingAppId(null)}
        title="Customer Follow-up Card"
        subtitle={
          editingRecord
            ? `${editingRecord.app.caseId} · ${editingRecord.app.customerName} · ${branchLabel(
                editingRecord.app.pickupBranchId,
              )}`
            : undefined
        }
        maxWidthClass="max-w-3xl"
        footer={
          editingRecord && (
            <div className="w-full flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <StatusBadge status={formStockStage} compact />
                <StatusBadge status={formCollection} compact />
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingAppId(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={handleSaveCard}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg transition-colors"
                >
                  Save Follow-up
                </button>
              </div>
            </div>
          )
        }
      >
        {editingRecord && (
          <div className="space-y-5 text-xs">
            {cardError && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 flex items-center gap-2.5 text-red-800"
              >
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{cardError}</span>
              </div>
            )}

            {/* 1. Read-Only Application Reference Summary */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-3">
                <div>
                  <span className="block text-[10.5px] font-semibold tracking-wider text-slate-400">
                    CASE ID
                  </span>
                  <span className="block mt-0.5 text-xs font-semibold text-slate-900 font-mono-tabular">
                    {editingRecord.app.caseId}
                  </span>
                </div>

                <div>
                  <span className="block text-[10.5px] font-semibold tracking-wider text-slate-400">
                    APPROVAL DATE
                  </span>
                  <span className="block mt-0.5 text-xs font-medium text-slate-800 tabular-nums">
                    {formatDateShort(editingRecord.approvalDate)}
                  </span>
                </div>

                <div className="sm:col-span-2 lg:col-span-2">
                  <span className="block text-[10.5px] font-semibold tracking-wider text-slate-400">
                    CUSTOMER NAME
                  </span>
                  <span className="block mt-0.5 text-xs font-semibold text-slate-900">
                    {editingRecord.app.customerName}
                  </span>
                </div>

                <div className="sm:col-span-2 lg:col-span-4 pt-2.5 border-t border-slate-200/80">
                  <span className="block text-[10.5px] font-semibold tracking-wider text-slate-400">
                    PRODUCT
                  </span>
                  <span className="block mt-0.5 text-xs font-medium text-slate-800">
                    {editingRecord.productTitle}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Branch & Colour Assignment */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-semibold text-slate-900">
                  Branch &amp; Colour Details
                </h4>
                <span className="text-[11px] text-slate-400">
                  Cawangan &amp; warna pilihan
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3.5">
                <div>
                  <label
                    htmlFor="card-from-branch"
                    className="block text-[11px] font-medium text-slate-700 mb-1"
                  >
                    CUSTOMER FROM BRANCH
                  </label>
                  <select
                    id="card-from-branch"
                    value={formFromBranch}
                    onChange={(e) => setFormFromBranch(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                    <option value="WEB">WEB</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="card-pickup-branch"
                    className="block text-[11px] font-medium text-slate-700 mb-1"
                  >
                    BRANCH PICKUP
                  </label>
                  <select
                    id="card-pickup-branch"
                    value={formPickupBranch}
                    onChange={(e) => setFormPickupBranch(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  >
                    <option value="">Belum Ditentukan</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                    <option value="POSTAGE">POSTAGE</option>
                  </select>
                </div>
              </div>

              {/* Product Colours (Dynamic based on product count) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                    Product Colour(s) ({editingRecord.app.products.length} Product
                    {editingRecord.app.products.length > 1 ? 's' : ''})
                  </span>
                </div>

                <div
                  className={`grid grid-cols-1 ${
                    editingRecord.app.products.length >= 2 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-1'
                  } gap-3`}
                >
                  <div>
                    <label
                      htmlFor="card-colour-1"
                      className="block text-[11px] font-medium text-slate-700 mb-1"
                    >
                      COLOUR 1 {editingRecord.app.products[0] ? `(${editingRecord.app.products[0].productName})` : ''}
                    </label>
                    <input
                      id="card-colour-1"
                      type="text"
                      value={formColour}
                      onChange={(e) => setFormColour(e.target.value)}
                      placeholder="e.g. GREEN / DESERT TITANIUM"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                    />
                  </div>

                  {editingRecord.app.products.length >= 2 && (
                    <div>
                      <label
                        htmlFor="card-colour-2"
                        className="block text-[11px] font-medium text-slate-700 mb-1"
                      >
                        COLOUR 2 {editingRecord.app.products[1] ? `(${editingRecord.app.products[1].productName})` : ''}
                      </label>
                      <input
                        id="card-colour-2"
                        type="text"
                        value={formColour2}
                        onChange={(e) => setFormColour2(e.target.value)}
                        placeholder="e.g. BLACK / SPACE GRAY"
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                      />
                    </div>
                  )}

                  {editingRecord.app.products.length >= 3 && (
                    <div>
                      <label
                        htmlFor="card-colour-3"
                        className="block text-[11px] font-medium text-slate-700 mb-1"
                      >
                        COLOUR 3 {editingRecord.app.products[2] ? `(${editingRecord.app.products[2].productName})` : ''}
                      </label>
                      <input
                        id="card-colour-3"
                        type="text"
                        value={formColour3}
                        onChange={(e) => setFormColour3(e.target.value)}
                        placeholder="e.g. SILVER / WHITE"
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Stock Status, Customer Decision & Pass Stock */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-semibold text-slate-900">
                  Follow-up Status &amp; Pass Stock
                </h4>
                <span className="text-[11px] text-slate-400">
                  Kemaskini status stok &amp; pengesahan customer
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label
                    htmlFor="card-stock-status"
                    className="block text-[11px] font-medium text-slate-700 mb-1"
                  >
                    STOCK STATUS
                  </label>
                  <select
                    id="card-stock-status"
                    value={formStockStage}
                    onChange={(e) => setFormStockStage(e.target.value as StockWorkflowStage)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  >
                    <option value="NOT YET CHECKING">NOT YET CHECKING</option>
                    <option value="READY">READY</option>
                    <option value="NO STOCK">NO STOCK</option>
                    <option value="IN TRANSIT">IN TRANSIT</option>
                    <option value="STOK OTW">STOK OTW</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="card-customer-decision"
                    className="block text-[11px] font-medium text-slate-700 mb-1"
                  >
                    CUSTOMER DECISION
                  </label>
                  <select
                    id="card-customer-decision"
                    value={formDecision}
                    onChange={(e) => setFormDecision(e.target.value as CustomerStockDecision)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  >
                    <option value="PENDING DECISION">PENDING DECISION</option>
                    <option value="ACCEPT">ACCEPT</option>
                    <option value="WAIT ORIGINAL COLOUR">WAIT ORIGINAL COLOUR</option>
                    <option value="WAIT ALTERNATIVE COLOUR">WAIT ALTERNATIVE COLOUR</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="card-collection-confirm"
                    className="block text-[11px] font-medium text-slate-700 mb-1"
                  >
                    COLLECTION CONFIRMATION
                  </label>
                  <select
                    id="card-collection-confirm"
                    value={formCollection}
                    onChange={(e) =>
                      setFormCollection(e.target.value as CollectionConfirmationStatus)
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="CONFIRMED">CONFIRMED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-start">
                <div>
                  <label
                    htmlFor="card-pass-date"
                    className="block text-[11px] font-medium text-slate-700 mb-1"
                  >
                    DATE PASS STOK
                  </label>
                  <input
                    id="card-pass-date"
                    type="date"
                    value={formPassDate}
                    onChange={(e) => setFormPassDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 tabular-nums focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                  <p className="text-[10.5px] text-slate-400 mt-1 leading-snug">
                    Diperlukan apabila READY &amp; CONFIRMED.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="card-remark"
                    className="block text-[11px] font-medium text-slate-700 mb-1"
                  >
                    REMARK {formDecision === 'CANCELLED' && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    id="card-remark"
                    rows={2}
                    value={formRemark}
                    onChange={(e) => setFormRemark(e.target.value)}
                    placeholder="Masukkan catatan berkaitan stok atau keputusan customer..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>
              </div>
            </div>

            {/* 4. Change History Section */}
            <div className="pt-3.5 border-t border-slate-200">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <h4 className="text-xs font-semibold text-slate-900">Change History</h4>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {editingRecord.followUp.changes.length}{' '}
                  {editingRecord.followUp.changes.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>

              {editingRecord.followUp.changes.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">Tiada perubahan direkodkan.</p>
              ) : (
                <ul className="divide-y divide-slate-100 max-h-44 overflow-y-auto border border-slate-200/80 rounded-lg px-3.5 bg-slate-50/40">
                  {editingRecord.followUp.changes
                    .slice()
                    .reverse()
                    .map((chg) => (
                      <li key={chg.id} className="py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">{chg.field}</span>
                          <span className="text-[11px] text-slate-400 tabular-nums">
                            {formatDateTime(chg.timestamp)} · {chg.staffName}
                          </span>
                        </div>
                        <p className="text-slate-600 mt-0.5">
                          <span>{chg.before || '—'}</span>
                          <span className="mx-1.5 text-slate-400" aria-hidden="true">
                            &rarr;
                          </span>
                          <strong className="text-slate-900">{chg.after || '—'}</strong>
                        </p>
                      </li>
                    ))}
                </ul>
              )}
              <p className="text-[11px] text-slate-400 mt-2">
                Setiap perubahan yang disimpan direkodkan bersama nilai sebelum dan selepas, tarikh, masa dan staff.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Pass Stok to Branch Modal */}
      <Modal
        open={Boolean(passModalRecord)}
        onClose={() => setPassModalAppId(null)}
        title="Pass Stok to Branch"
        subtitle={
          passModalRecord
            ? `${passModalRecord.app.caseId} · ${passModalRecord.app.customerName}`
            : undefined
        }
        maxWidthClass="max-w-md"
        footer={
          passModalRecord && (
            <>
              <button
                type="button"
                onClick={() => setPassModalAppId(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!canManage}
                onClick={handleConfirmPass}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-lg"
              >
                <PackageCheck className="w-3.5 h-3.5" />
                Confirm Pass
              </button>
            </>
          )
        }
      >
        {passModalRecord && (
          <div className="space-y-4 text-xs">
            {passError && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-800"
              >
                {passError}
              </div>
            )}

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
              <div className="font-semibold text-slate-900">{passModalRecord.app.customerName}</div>
              <div className="text-slate-600">
                <span className="font-mono-tabular font-medium text-blue-600">
                  {passModalRecord.app.caseId}
                </span>{' '}
                · {passModalRecord.productTitle}
              </div>
              <div className="text-slate-600">
                Branch Pickup:{' '}
                <strong className="text-slate-900">
                  {branchLabel(passModalRecord.app.pickupBranchId)}
                </strong>
              </div>
            </div>

            <div>
              <label
                htmlFor="pass-stock-date-input"
                className="block text-[11px] font-medium text-slate-700 mb-1"
              >
                DATE PASS STOK
              </label>
              <input
                id="pass-stock-date-input"
                type="date"
                value={passDateInput}
                onChange={(e) => setPassDateInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 tabular-nums focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                Mengesahkan tarikh pass stok akan membuka laluan permohonan ini ke{' '}
                <strong>Agreement Receive (TERIMA)</strong> secara automatik.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
