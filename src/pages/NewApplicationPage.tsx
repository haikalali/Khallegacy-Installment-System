import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type { Branch, ProductCategory, StaffUser } from '../types/khallegacy';
import {
  calculateFinancingSummary,
  formatDateShort,
  formatRM,
  PRODUCT_CATEGORIES,
  type NewApplicationPayload,
} from '../utils/businessRules';

interface ProductDraft {
  id: string;
  productName: string;
  model: string;
  quantity: number;
  unitPrice: string;
}

interface NewApplicationPageProps {
  existingCaseIds: string[];
  branches: Branch[];
  currentUser: StaffUser;
  onCreateApplication: (payload: NewApplicationPayload, downloadCoverPage: boolean) => boolean | Promise<boolean>;
  onNavigateApprovalList: () => void;
  isSaving?: boolean;
}

const createInitialProductRow = (): ProductDraft => ({
  id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  productName: '',
  model: '',
  quantity: 1,
  unitPrice: '',
});

export const NewApplicationPage: React.FC<NewApplicationPageProps> = ({
  existingCaseIds,
  branches,
  currentUser,
  onCreateApplication,
  onNavigateApprovalList,
  isSaving = false,
}) => {
  const [caseId, setCaseId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [icNumber, setIcNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [ref1Id, setRef1Id] = useState('');
  const [customerFromBranchId, setCustomerFromBranchId] = useState('');
  const [pickupBranchId, setPickupBranchId] = useState('');
  const [applicationDate, setApplicationDate] = useState('2026-11-17');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [applicationRemarks, setApplicationRemarks] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Apple');

  const [products, setProducts] = useState<ProductDraft[]>([createInitialProductRow()]);

  const [depositStr, setDepositStr] = useState('0');
  const [agreementFeeStr, setAgreementFeeStr] = useState('88.00');
  const [processingFeeStr, setProcessingFeeStr] = useState('50.00');
  const [sstAmountStr, setSstAmountStr] = useState('4.00');
  const [stampDutyEdited, setStampDutyEdited] = useState(false);
  const [stampDutyManualStr, setStampDutyManualStr] = useState('0.00');
  const [cashPaymentEdited, setCashPaymentEdited] = useState(false);
  const [cashPaymentManualStr, setCashPaymentManualStr] = useState('0.00');
  const [installmentDuration, setInstallmentDuration] = useState<12 | 24 | 36>(24);
  const [monthlyInstallmentEdited, setMonthlyInstallmentEdited] = useState(false);
  const [monthlyInstallmentManualStr, setMonthlyInstallmentManualStr] = useState('0.00');

  const [internalNotes, setInternalNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [productRowWarning, setProductRowWarning] = useState<string | null>(null);
  const [lastSavedCaseId, setLastSavedCaseId] = useState<string | null>(null);

  const duplicateCaseId = useMemo(() => {
    const trimmed = caseId.trim().toLowerCase();
    if (!trimmed) return false;
    return existingCaseIds.some((id) => id.trim().toLowerCase() === trimmed);
  }, [caseId, existingCaseIds]);

  const financingCalc = useMemo(() => {
    return calculateFinancingSummary({
      products: products.map((p) => ({
        quantity: Number(p.quantity) || 0,
        unitPrice: Number(p.unitPrice) || 0,
      })),
      deposit: Number(depositStr) || 0,
      agreementFee: Number(agreementFeeStr) || 0,
      processingFee: Number(processingFeeStr) || 0,
      sstAmount: Number(sstAmountStr) || 0,
      stampDutyOverride: stampDutyEdited ? Number(stampDutyManualStr) || 0 : null,
      cashPaymentOverride: cashPaymentEdited ? Number(cashPaymentManualStr) || 0 : null,
      monthlyInstallmentOverride: monthlyInstallmentEdited
        ? Number(monthlyInstallmentManualStr) || 0
        : null,
      installmentDuration,
    });
  }, [
    products,
    depositStr,
    agreementFeeStr,
    processingFeeStr,
    sstAmountStr,
    stampDutyEdited,
    stampDutyManualStr,
    cashPaymentEdited,
    cashPaymentManualStr,
    installmentDuration,
    monthlyInstallmentEdited,
    monthlyInstallmentManualStr,
  ]);

  const depositExceedsTotal =
    financingCalc.deposit > 0 && financingCalc.deposit > financingCalc.totalProductPrice;

  const step1Done = Boolean(
    caseId.trim() &&
      !duplicateCaseId &&
      customerName.trim() &&
      icNumber.trim() &&
      phone.trim() &&
      customerFromBranchId,
  );
  const step2Done =
    products.some((p) => p.productName.trim().length > 0) &&
    financingCalc.totalProductPrice > 0 &&
    !depositExceedsTotal;

  const branchLabel = (id: string) => {
    if (!id) return 'Belum Ditentukan';
    if (id === 'WEB') return 'WEB';
    if (id === 'POSTAGE') return 'POSTAGE';
    return branches.find((b) => b.id === id)?.name ?? id;
  };

  const handleAddProduct = () => {
    setProductRowWarning(null);
    setProducts((prev) => [...prev, createInitialProductRow()]);
  };

  const handleRemoveProduct = (rowId: string) => {
    if (products.length <= 1) {
      setProductRowWarning('At least one product item is required.');
      return;
    }
    setProductRowWarning(null);
    setProducts((prev) => prev.filter((p) => p.id !== rowId));
  };

  const handleResetForm = () => {
    setCaseId('');
    setCustomerName('');
    setIcNumber('');
    setPhone('');
    setRef1Id('');
    setCustomerFromBranchId('');
    setPickupBranchId('');
    setApplicationDate('2026-11-17');
    setBankName('');
    setBankAccountNumber('');
    setApplicationRemarks('');
    setCategory('Apple');
    setProducts([createInitialProductRow()]);
    setDepositStr('0');
    setAgreementFeeStr('88.00');
    setProcessingFeeStr('50.00');
    setSstAmountStr('4.00');
    setStampDutyEdited(false);
    setStampDutyManualStr('0.00');
    setCashPaymentEdited(false);
    setCashPaymentManualStr('0.00');
    setInstallmentDuration(24);
    setMonthlyInstallmentEdited(false);
    setMonthlyInstallmentManualStr('0.00');
    setInternalNotes('');
    setFormError(null);
    setProductRowWarning(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    if (!caseId.trim()) {
      setFormError('Please enter a CASE ID.');
      return;
    }
    if (duplicateCaseId) {
      setFormError(`CASE ID "${caseId.trim()}" already exists. Each CASE ID must be unique.`);
      return;
    }
    if (!customerName.trim() || !icNumber.trim() || !phone.trim() || !customerFromBranchId) {
      setFormError('Please complete all required Customer Information fields (*).');
      return;
    }
    const validProducts = products.filter((p) => p.productName.trim().length > 0);
    if (validProducts.length === 0) {
      setFormError('Please enter at least one product name.');
      return;
    }
    if (financingCalc.totalProductPrice <= 0) {
      setFormError('Total Product Price must be greater than RM 0.00.');
      return;
    }
    if (depositExceedsTotal) {
      setFormError('Deposit cannot exceed Total Product Price.');
      return;
    }

    const payload: NewApplicationPayload = {
      caseId: caseId.trim(),
      customerName: customerName.trim(),
      icNumber: icNumber.trim(),
      phone: phone.trim(),
      ref1Id: ref1Id.trim(),
      customerFromBranchId,
      pickupBranchId: pickupBranchId || null,
      applicationDate,
      bankName: bankName.trim(),
      bankAccountNumber: bankAccountNumber.trim(),
      applicationRemarks: applicationRemarks.trim(),
      internalNotes: internalNotes.trim(),
      category,
      products: validProducts.map((p) => ({
        productName: p.productName.trim(),
        model: p.model.trim() || 'Standard Spec',
        quantity: Math.max(1, Number(p.quantity) || 1),
        unitPrice: Math.max(0, Number(p.unitPrice) || 0),
      })),
      deposit: financingCalc.deposit,
      agreementFee: financingCalc.agreementFee,
      processingFee: financingCalc.processingFee,
      sstAmount: financingCalc.sstAmount,
      stampDutyFee: financingCalc.stampDutyFee,
      actualCashPayment: financingCalc.actualCashPayment,
      monthlyInstallment: financingCalc.monthlyInstallment,
      installmentDuration: financingCalc.installmentDuration,
    };

    const ok = await onCreateApplication(payload, true);
    if (ok) {
      setLastSavedCaseId(payload.caseId);
      handleResetForm();
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
            Register New Installment Application
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftarkan permohonan agreement baharu dan lengkapkan maklumat pelanggan, produk serta pembiayaan. Semua agreement dihantar ke HQ.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetForm}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Form
          </button>
        </div>
      </div>

      {/* Confirmation Banner after saving */}
      {lastSavedCaseId && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Application <strong className="font-mono-tabular">{lastSavedCaseId}</strong> saved with
              status <strong>Approved</strong> and Cover Page downloaded.
            </span>
          </div>
          <button
            type="button"
            onClick={onNavigateApprovalList}
            className="px-3 py-1.5 font-medium text-emerald-800 bg-white border border-emerald-300 hover:bg-emerald-100 rounded-lg transition-colors self-start sm:self-auto"
          >
            Open Approval List
          </button>
        </div>
      )}

      {/* 3-Step Progress Card */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2.5 text-xs">
            <span
              className={`w-6 h-6 rounded-md flex items-center justify-center font-semibold tabular-nums shrink-0 ${
                step1Done
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-blue-600 text-white'
              }`}
            >
              1
            </span>
            <span className={step1Done ? 'font-semibold text-emerald-700' : 'font-semibold text-slate-900'}>
              Customer Information
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <span
              className={`w-6 h-6 rounded-md flex items-center justify-center font-semibold tabular-nums shrink-0 ${
                step2Done
                  ? 'bg-emerald-100 text-emerald-700'
                  : step1Done
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              2
            </span>
            <span
              className={
                step2Done
                  ? 'font-semibold text-emerald-700'
                  : step1Done
                    ? 'font-semibold text-slate-900'
                    : 'text-slate-500'
              }
            >
              Product &amp; Financing
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <span
              className={`w-6 h-6 rounded-md flex items-center justify-center font-semibold tabular-nums shrink-0 ${
                step1Done && step2Done
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              3
            </span>
            <span className={step1Done && step2Done ? 'font-semibold text-slate-900' : 'text-slate-500'}>
              Review &amp; Submit
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Form Layout */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* Left Main Form Sections */}
          <div className="xl:col-span-8 space-y-5 min-w-0">
            {formError && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2.5 text-xs text-red-800"
              >
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* 01. Customer Information */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3 pb-3.5 mb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    01. Customer Information
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Maklumat asas pelanggan untuk pendaftaran permohonan.
                  </p>
                </div>
                <span className="px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200/80 rounded-md whitespace-nowrap">
                  Required Information
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label htmlFor="new-app-case-id" className="block font-medium text-slate-700 mb-1">
                    CASE ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="new-app-case-id"
                    type="text"
                    required
                    value={caseId}
                    onChange={(e) => setCaseId(e.target.value)}
                    placeholder="e.g. KHL-2026-0850"
                    className={`w-full px-3 py-2 text-xs font-mono-tabular border rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 ${
                      duplicateCaseId
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
                        : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/15'
                    }`}
                  />
                  {duplicateCaseId ? (
                    <p className="text-[11px] text-red-600 mt-1">
                      CASE ID already exists. Please use a unique CASE ID.
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Masukkan CASE ID secara manual. Mesti unik bagi setiap permohonan.
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="new-app-name" className="block font-medium text-slate-700 mb-1">
                    Customer Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="new-app-name"
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Masukkan nama seperti IC"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>

                <div>
                  <label htmlFor="new-app-ic" className="block font-medium text-slate-700 mb-1">
                    IC Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="new-app-ic"
                    type="text"
                    required
                    value={icNumber}
                    onChange={(e) => setIcNumber(e.target.value)}
                    placeholder="Contoh: 900101-01-1234"
                    className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>

                <div>
                  <label htmlFor="new-app-phone" className="block font-medium text-slate-700 mb-1">
                    No Telefon <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="new-app-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Contoh: 01X-XXXXXXX"
                    className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>

                <div>
                  <label htmlFor="new-app-ref1" className="block font-medium text-slate-700 mb-1">
                    REF1 ID
                  </label>
                  <input
                    id="new-app-ref1"
                    type="text"
                    value={ref1Id}
                    onChange={(e) => setRef1Id(e.target.value)}
                    placeholder="Masukkan REF1 ID jika ada"
                    className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Optional — boleh dibiarkan kosong.
                  </p>
                </div>

                <div>
                  <label htmlFor="new-app-from-branch" className="block font-medium text-slate-700 mb-1">
                    Customer From Branch <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="new-app-from-branch"
                    required
                    value={customerFromBranchId}
                    onChange={(e) => setCustomerFromBranchId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  >
                    <option value="">Pilih cawangan asal</option>
                    {branches
                      .filter((b) => b.code !== 'POS' && b.name.toUpperCase() !== 'POSTAGE')
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    {!branches.some((b) => b.code === 'WEB' || b.id === 'WEB') && (
                      <option value="WEB">WEB</option>
                    )}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Cawangan asal yang menguruskan permohonan pelanggan.
                  </p>
                </div>

                <div>
                  <label htmlFor="new-app-pickup-branch" className="block font-medium text-slate-700 mb-1">
                    Pickup Branch
                  </label>
                  <select
                    id="new-app-pickup-branch"
                    value={pickupBranchId}
                    onChange={(e) => setPickupBranchId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  >
                    <option value="">Belum Ditentukan</option>
                    {branches
                      .filter((b) => b.code !== 'WEB' && b.name.toUpperCase() !== 'WEBSITE' && b.name.toUpperCase() !== 'WEB')
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    {!branches.some(
                      (b) => b.code === 'POS' || b.name.toUpperCase() === 'POSTAGE',
                    ) && <option value="POSTAGE">POSTAGE</option>}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Boleh ditentukan kemudian jika belum diketahui.
                  </p>
                </div>

                <div>
                  <label htmlFor="new-app-date" className="block font-medium text-slate-700 mb-1">
                    Approval / Application Date
                  </label>
                  <input
                    id="new-app-date"
                    type="date"
                    value={applicationDate}
                    onChange={(e) => setApplicationDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs tabular-nums border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>

                <div>
                  <label htmlFor="new-app-bank-name" className="block font-medium text-slate-700 mb-1">
                    Nama Bank
                  </label>
                  <input
                    id="new-app-bank-name"
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Contoh: Maybank / CIMB"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>

                <div>
                  <label htmlFor="new-app-bank-acc" className="block font-medium text-slate-700 mb-1">
                    No Akaun Bank
                  </label>
                  <input
                    id="new-app-bank-acc"
                    type="text"
                    inputMode="numeric"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    placeholder="Masukkan nombor akaun bank"
                    className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="new-app-remarks" className="block font-medium text-slate-700 mb-1">
                    Remarks
                  </label>
                  <textarea
                    id="new-app-remarks"
                    rows={2}
                    value={applicationRemarks}
                    onChange={(e) => setApplicationRemarks(e.target.value)}
                    placeholder="Catatan tambahan pelanggan atau permohonan (jika ada)"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>
              </div>
            </section>

            {/* 02. Product Information */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3 pb-3.5 mb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    02. Product Information
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Satu CASE ID boleh mempunyai lebih daripada satu produk.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddProduct}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Product
                </button>
              </div>

              <div className="mb-4 max-w-xs text-xs">
                <label htmlFor="new-app-category" className="block font-medium text-slate-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  id="new-app-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ProductCategory)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                >
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {productRowWarning && (
                <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  {productRowWarning}
                </div>
              )}

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3 w-[36%]">PRODUCT / DESCRIPTION</th>
                      <th className="py-2.5 px-3 w-[22%]">COLOUR PRODUCT</th>
                      <th className="py-2.5 px-3 w-[12%]">QTY</th>
                      <th className="py-2.5 px-3 w-[15%]">UNIT PRICE (RM)</th>
                      <th className="py-2.5 px-3 w-[12%] text-right">SUBTOTAL</th>
                      <th className="py-2.5 px-2 w-[3%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {products.map((row, idx) => {
                      const rowSubtotal =
                        (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);
                      return (
                        <tr key={row.id} className="align-middle">
                          <td className="p-2.5">
                            <input
                              type="text"
                              aria-label={`Product name ${idx + 1}`}
                              value={row.productName}
                              onChange={(e) => {
                                const val = e.target.value;
                                setProducts((prev) =>
                                  prev.map((p) => (p.id === row.id ? { ...p, productName: val } : p)),
                                );
                              }}
                              placeholder="Nama produk / model"
                              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              aria-label={`Spec or colour ${idx + 1}`}
                              value={row.model}
                              onChange={(e) => {
                                const val = e.target.value;
                                setProducts((prev) =>
                                  prev.map((p) => (p.id === row.id ? { ...p, model: val } : p)),
                                );
                              }}
                              placeholder="Colour"
                              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              min={1}
                              aria-label={`Quantity ${idx + 1}`}
                              value={row.quantity}
                              onChange={(e) => {
                                const val = Math.max(1, Number(e.target.value) || 1);
                                setProducts((prev) =>
                                  prev.map((p) => (p.id === row.id ? { ...p, quantity: val } : p)),
                                );
                              }}
                              className="w-full px-2.5 py-1.5 text-xs tabular-nums border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              aria-label={`Unit price ${idx + 1}`}
                              value={row.unitPrice}
                              onChange={(e) => {
                                const val = e.target.value;
                                setProducts((prev) =>
                                  prev.map((p) => (p.id === row.id ? { ...p, unitPrice: val } : p)),
                                );
                              }}
                              placeholder="0.00"
                              className="w-full px-2.5 py-1.5 text-xs font-mono-tabular border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="p-2.5 text-right font-mono-tabular font-semibold text-slate-900 whitespace-nowrap">
                            {formatRM(rowSubtotal)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveProduct(row.id)}
                              title="Remove product"
                              aria-label={`Remove product ${idx + 1}`}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 03. Financing Information */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3 pb-3.5 mb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    03. Financing Information
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Nilai pembiayaan dan caj berkaitan bagi CASE ID ini.
                  </p>
                </div>
                <span className="px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded-md whitespace-nowrap">
                  Auto Calculation
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label htmlFor="fin-total-price" className="block font-medium text-slate-700 mb-1">
                    Total Product Price (RM)
                  </label>
                  <input
                    id="fin-total-price"
                    type="text"
                    readOnly
                    value={financingCalc.totalProductPrice.toFixed(2)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-lg bg-slate-50 text-slate-800"
                  />
                </div>

                <div>
                  <label htmlFor="fin-deposit" className="block font-medium text-slate-700 mb-1">
                    Deposit (RM) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="fin-deposit"
                    type="number"
                    min={0}
                    step="0.01"
                    value={depositStr}
                    onChange={(e) => setDepositStr(e.target.value)}
                    className={`w-full px-3 py-2 text-xs font-mono-tabular border rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 ${
                      depositExceedsTotal
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
                        : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/15'
                    }`}
                  />
                  <p className={`text-[11px] mt-1 ${depositExceedsTotal ? 'text-red-600' : 'text-slate-400'}`}>
                    Deposit tidak boleh melebihi Total Product Price.
                  </p>
                </div>

                <div>
                  <label htmlFor="fin-amount" className="block font-medium text-slate-700 mb-1">
                    Financing Amount (RM)
                  </label>
                  <input
                    id="fin-amount"
                    type="text"
                    readOnly
                    value={financingCalc.financingAmount.toFixed(2)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular font-semibold border border-blue-200 rounded-lg bg-blue-50/70 text-blue-900"
                  />
                </div>

                <div>
                  <label htmlFor="fin-agreement-fee" className="block font-medium text-slate-700 mb-1">
                    Agreement Fee (RM)
                  </label>
                  <input
                    id="fin-agreement-fee"
                    type="number"
                    min={0}
                    step="0.01"
                    value={agreementFeeStr}
                    onChange={(e) => setAgreementFeeStr(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Default RM88.00 — boleh diedit.</p>
                </div>

                <div>
                  <label htmlFor="fin-processing-fee" className="block font-medium text-slate-700 mb-1">
                    Processing Fee (RM)
                  </label>
                  <input
                    id="fin-processing-fee"
                    type="number"
                    min={0}
                    step="0.01"
                    value={processingFeeStr}
                    onChange={(e) => setProcessingFeeStr(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Default RM50.00 per CASE ID — boleh diedit.
                  </p>
                </div>

                <div>
                  <label htmlFor="fin-sst" className="block font-medium text-slate-700 mb-1">
                    SST Amount (RM)
                  </label>
                  <input
                    id="fin-sst"
                    type="number"
                    min={0}
                    step="0.01"
                    value={sstAmountStr}
                    onChange={(e) => setSstAmountStr(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Default RM4.00 per CASE ID — boleh diedit.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="fin-stamp-duty" className="font-medium text-slate-700">
                      Stamp Duty Fee (RM)
                    </label>
                    {stampDutyEdited && (
                      <button
                        type="button"
                        onClick={() => setStampDutyEdited(false)}
                        className="text-[11px] text-blue-600 hover:underline"
                      >
                        Reset Auto
                      </button>
                    )}
                  </div>
                  <input
                    id="fin-stamp-duty"
                    type="number"
                    min={0}
                    step="0.01"
                    value={
                      stampDutyEdited
                        ? stampDutyManualStr
                        : financingCalc.stampDutyFee.toFixed(2)
                    }
                    onChange={(e) => {
                      setStampDutyEdited(true);
                      setStampDutyManualStr(e.target.value);
                    }}
                    className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Auto: RM5 bagi setiap RM1,000 pembiayaan atau sebahagiannya. Boleh dilaras manual.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="fin-cash-payment" className="font-medium text-slate-700">
                      Actual Cash Payment (RM)
                    </label>
                    {cashPaymentEdited && (
                      <button
                        type="button"
                        onClick={() => setCashPaymentEdited(false)}
                        className="text-[11px] text-blue-600 hover:underline"
                      >
                        Reset Auto
                      </button>
                    )}
                  </div>
                  <input
                    id="fin-cash-payment"
                    type="number"
                    min={0}
                    step="0.01"
                    value={
                      cashPaymentEdited
                        ? cashPaymentManualStr
                        : financingCalc.actualCashPayment.toFixed(2)
                    }
                    onChange={(e) => {
                      setCashPaymentEdited(true);
                      setCashPaymentManualStr(e.target.value);
                    }}
                    className="w-full px-3 py-2 text-xs font-mono-tabular font-semibold border border-emerald-200 rounded-lg bg-emerald-50/50 text-emerald-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Auto: Financing Amount − Processing − SST − Stamp Duty. Boleh diedit manual.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="fin-monthly-installment" className="font-medium text-slate-700">
                      Monthly Installment (RM)
                    </label>
                    {monthlyInstallmentEdited && (
                      <button
                        type="button"
                        onClick={() => setMonthlyInstallmentEdited(false)}
                        className="text-[11px] text-blue-600 hover:underline"
                      >
                        Reset Auto
                      </button>
                    )}
                  </div>
                  <input
                    id="fin-monthly-installment"
                    type="number"
                    min={0}
                    step="0.01"
                    value={
                      monthlyInstallmentEdited
                        ? monthlyInstallmentManualStr
                        : financingCalc.monthlyInstallment.toFixed(2)
                    }
                    onChange={(e) => {
                      setMonthlyInstallmentEdited(true);
                      setMonthlyInstallmentManualStr(e.target.value);
                    }}
                    className="w-full px-3 py-2 text-xs font-mono-tabular font-semibold border border-blue-200 rounded-lg bg-blue-50/40 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Auto: Anggaran bayaran bulanan ({financingCalc.installmentDuration} bulan). Masih boleh diisi secara manual.
                  </p>
                </div>

                <div>
                  <label htmlFor="fin-tenure" className="block font-medium text-slate-700 mb-1">
                    Tenure
                  </label>
                  <select
                    id="fin-tenure"
                    value={installmentDuration}
                    onChange={(e) => setInstallmentDuration(Number(e.target.value) as 12 | 24 | 36)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  >
                    <option value={12}>12 Bulan</option>
                    <option value={24}>24 Bulan</option>
                    <option value={36}>36 Bulan</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Pilihan tempoh bayaran balik: 12 / 24 / 36 bulan.
                  </p>
                </div>
              </div>
            </section>

            {/* 04. Collection Information */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3 pb-3.5 mb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    04. Collection Information
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Maklumat status awal dan rekod kutipan permohonan.
                  </p>
                </div>
                <span className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-md whitespace-nowrap">
                  Initial Collection
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label htmlFor="col-initial-status" className="block font-medium text-slate-700 mb-1">
                    Initial Status
                  </label>
                  <input
                    id="col-initial-status"
                    type="text"
                    readOnly
                    value="Approved"
                    className="w-full px-3 py-2 text-xs font-medium border border-emerald-200 rounded-lg bg-emerald-50/70 text-emerald-700"
                  />
                </div>

                <div>
                  <label htmlFor="col-entered-by" className="block font-medium text-slate-700 mb-1">
                    Entered By
                  </label>
                  <input
                    id="col-entered-by"
                    type="text"
                    readOnly
                    value={currentUser.name}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-800"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="col-internal-notes" className="block font-medium text-slate-700 mb-1">
                    Internal Notes
                  </label>
                  <textarea
                    id="col-internal-notes"
                    rows={3}
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Catatan dalaman untuk semakan management..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Right Sticky Live Summary Panel */}
          <aside className="xl:col-span-4 space-y-4 xl:sticky xl:top-20">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-100">
                Application Summary
              </h3>

              {/* Customer Information Summary */}
              <div className="mt-3.5 space-y-2 text-xs">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-blue-600">
                  Customer Information
                </p>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">CASE ID</span>
                  <strong className="font-mono-tabular text-slate-900 text-right">
                    {caseId.trim() || '—'}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Customer Name</span>
                  <strong className="text-slate-900 text-right break-words">
                    {customerName.trim() || '—'}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">IC Number</span>
                  <strong className="font-mono-tabular text-slate-900 text-right">
                    {icNumber.trim() || '—'}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">No Telefon</span>
                  <strong className="font-mono-tabular text-slate-900 text-right">
                    {phone.trim() || '—'}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">REF1 ID</span>
                  <strong className="font-mono-tabular text-slate-900 text-right">
                    {ref1Id.trim() || '—'}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">From Branch</span>
                  <strong className="text-slate-900 text-right">
                    {customerFromBranchId ? branchLabel(customerFromBranchId) : '—'}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Pickup Branch</span>
                  <strong className="text-slate-900 text-right">
                    {pickupBranchId ? branchLabel(pickupBranchId) : 'Belum Ditentukan'}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Approval Date</span>
                  <strong className="tabular-nums text-slate-900 text-right">
                    {applicationDate ? formatDateShort(applicationDate) : '—'}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Nama Bank</span>
                  <strong className="text-slate-900 text-right">{bankName.trim() || '—'}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">No Akaun Bank</span>
                  <strong className="font-mono-tabular text-slate-900 text-right">
                    {bankAccountNumber.trim() || '—'}
                  </strong>
                </div>
                {applicationRemarks.trim() && (
                  <div className="pt-1">
                    <span className="text-slate-500 block">Remarks</span>
                    <p className="text-slate-700 mt-0.5 whitespace-pre-wrap">
                      {applicationRemarks.trim()}
                    </p>
                  </div>
                )}
              </div>

              <hr className="my-3.5 border-slate-100" />

              {/* Product Information Summary */}
              <div className="space-y-2 text-xs">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-blue-600">
                  Product Information
                </p>
                <div className="space-y-1.5">
                  {products.map((p, idx) => {
                    const price = Number(p.unitPrice) || 0;
                    const qty = Number(p.quantity) || 0;
                    return (
                      <div
                        key={p.id}
                        className="pb-1.5 border-b border-slate-100 last:border-none"
                      >
                        <div className="flex justify-between gap-2 font-medium text-slate-900">
                          <span className="truncate">
                            {p.productName.trim() || `Product ${idx + 1}`}
                          </span>
                          <span className="font-mono-tabular shrink-0">
                            {formatRM(qty * price)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                          Qty: {qty} × {formatRM(price)}
                          {p.model.trim() ? ` · ${p.model.trim()}` : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between gap-2 pt-1">
                  <span className="text-slate-500">Total Products</span>
                  <strong className="tabular-nums text-slate-900">
                    {financingCalc.totalUnits} unit
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Total Product Price</span>
                  <strong className="font-mono-tabular text-slate-900">
                    {formatRM(financingCalc.totalProductPrice)}
                  </strong>
                </div>
              </div>

              <hr className="my-3.5 border-slate-100" />

              {/* Financing Summary */}
              <div className="space-y-2 text-xs">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-blue-600">
                  Financing Information
                </p>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Deposit</span>
                  <strong className="font-mono-tabular text-slate-900">
                    {formatRM(financingCalc.deposit)}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Financing Amount</span>
                  <strong className="font-mono-tabular text-slate-900">
                    {formatRM(financingCalc.financingAmount)}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Agreement Fee</span>
                  <strong className="font-mono-tabular text-slate-900">
                    {formatRM(financingCalc.agreementFee)}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Processing Fee</span>
                  <strong className="font-mono-tabular text-slate-900">
                    {formatRM(financingCalc.processingFee)}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">SST Amount</span>
                  <strong className="font-mono-tabular text-slate-900">
                    {formatRM(financingCalc.sstAmount)}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Stamp Duty Fee</span>
                  <strong className="font-mono-tabular text-slate-900">
                    {formatRM(financingCalc.stampDutyFee)}
                  </strong>
                </div>
                <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-100 text-[13px] font-semibold">
                  <span className="text-slate-900">Actual Cash Payment</span>
                  <strong className="font-mono-tabular text-blue-600">
                    {formatRM(financingCalc.actualCashPayment)}
                  </strong>
                </div>
                <div className="flex justify-between items-center gap-2 text-xs">
                  <span className="text-slate-500">Monthly Installment</span>
                  <strong className="font-mono-tabular text-slate-900">
                    {formatRM(financingCalc.monthlyInstallment)} / mo
                  </strong>
                </div>
                <div className="flex justify-between items-center gap-2 text-xs">
                  <span className="text-slate-500">Tenure</span>
                  <strong className="font-mono-tabular text-slate-900">
                    {financingCalc.installmentDuration} bulan
                  </strong>
                </div>
              </div>

              <hr className="my-3.5 border-slate-100" />

              {/* Collection Summary */}
              <div className="space-y-2 text-xs">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-blue-600">
                  Collection Information
                </p>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Initial Status</span>
                  <strong className="text-emerald-700">Approved</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Entered By</span>
                  <strong className="text-slate-900">{currentUser.name}</strong>
                </div>
                {internalNotes.trim() && (
                  <div>
                    <span className="text-slate-500 block">Internal Notes</span>
                    <p className="text-slate-700 mt-0.5 whitespace-pre-wrap">
                      {internalNotes.trim()}
                    </p>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
                Ringkasan ini dikemas kini secara automatik berdasarkan maklumat yang dimasukkan dalam borang.
              </p>
            </div>

            {/* Important Reminder Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-1">
              <p className="font-semibold">Important Reminder</p>
              <p className="leading-relaxed">
                Semak semua maklumat yang dimasukkan melalui Application Summary sebelum simpan.
                Pastikan CASE ID, nama dan nombor IC tepat.
              </p>
            </div>

            {/* Primary Save & Download CTA */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 text-xs font-semibold tracking-wide text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>{isSaving ? 'SAVING APPLICATION...' : 'SAVE APPLICATION &amp; DOWNLOAD COVER PAGE'}</span>
            </button>
          </aside>
        </div>
      </form>
    </div>
  );
};
