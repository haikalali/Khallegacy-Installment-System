import type { NewApplicationPayload } from '../utils/businessRules';
import { supabase } from './supabase';

/** Loads CASE IDs for client-side duplicate feedback; database remains authoritative. */
export async function loadSupabaseApplicationCaseIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('applications')
    .select('case_id')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Senarai CASE ID daripada Supabase gagal dimuatkan.');
  }

  return (data ?? []).map((row) => String(row.case_id));
}

/**
 * Creates the application and all initial workflow rows in one PostgreSQL
 * transaction through an invoker-secured RPC. Staff identity and permission
 * are derived and checked server-side from the authenticated Supabase session.
 */
export async function createSupabaseApplication(
  payload: NewApplicationPayload,
): Promise<number> {
  const { data, error } = await supabase.rpc('create_installment_application', {
    p_payload: {
      caseId: payload.caseId,
      customerName: payload.customerName,
      icNumber: payload.icNumber,
      phone: payload.phone,
      ref1Id: payload.ref1Id.trim() || null,
      customerFromBranchId: payload.customerFromBranchId,
      pickupBranchId: payload.pickupBranchId || null,
      applicationDate: payload.applicationDate || null,
      bankName: payload.bankName,
      bankAccountNumber: payload.bankAccountNumber,
      applicationRemarks: payload.applicationRemarks,
      internalNotes: payload.internalNotes,
      category: payload.category ?? 'Apple',
      products: payload.products.map((product) => ({
        productName: product.productName,
        model: product.model ?? null,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
      })),
      deposit: payload.deposit,
      agreementFee: payload.agreementFee,
      processingFee: payload.processingFee,
      sstAmount: payload.sstAmount,
      stampDutyFee: payload.stampDutyFee,
      actualCashPayment: payload.actualCashPayment,
      monthlyInstallment: payload.monthlyInstallment ?? 0,
      installmentDuration: payload.installmentDuration ?? 24,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes('duplicate') ||
        error.message.toLowerCase().includes('already exists')) {
      throw new Error(`CASE ID "${payload.caseId}" sudah wujud. Sila gunakan CASE ID lain.`);
    }
    throw new Error(error.message || 'Permohonan gagal disimpan ke Supabase.');
  }

  const applicationId = Number(data);
  if (!Number.isSafeInteger(applicationId) || applicationId <= 0) {
    throw new Error('Supabase tidak memulangkan ID permohonan yang sah.');
  }

  return applicationId;
}
