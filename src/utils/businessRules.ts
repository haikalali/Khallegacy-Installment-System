import type {
  ActivityEvent,
  ApprovalStatus,
  Branch,
  CheckingChecklist,
  CollectionConfirmationStatus,
  CustomerStockDecision,
  FinancingInfo,
  InstallmentApplication,
  PermissionKey,
  PostageTrackingRecord,
  PostageTrackingStatus,
  ProductCategory,
  ProductItem,
  RoleConfig,
  SaleSubmissionList,
  StaffUser,
  StockChangeEntry,
  StockFollowUpState,
  StockStatus,
  StockWorkflowStage,
  TaskAgreementCheckingStatus,
  TaskAgreementClaimedStatus,
  TaskAgreementReceivedStatus,
  TaskAgreementSubmissionStatus,
  TaskCustomerDecision,
  TaskPassedStockStatus,
  TaskStatusState,
} from '../types/khallegacy';

export const SYSTEM_TODAY_DATE = '2026-11-17';

export function countApplicationsAddedOnDate(
  apps: InstallmentApplication[],
  targetDate: string = SYSTEM_TODAY_DATE,
): number {
  return apps.filter((a) => a.applicationDate === targetDate).length;
}

export function formatRM(amount: number): string {
  return `RM ${amount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(isoStr: string | null | undefined): string {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  return `${d.toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}, ${d.toLocaleTimeString('en-MY', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })}`;
}

/**
 * BUSINESS RULE (Page 4 - Agreement Management):
 * An application is eligible to appear in Agreement Management ONLY when:
 * 1. All products have Stock Status = OK.
 * 2. Date Pass Stock is filled for every product.
 * If even one product does not satisfy these requirements, the application must NOT appear.
 * Additionally, once an agreement is received (TERIMA), it moves out of the pending receipt list.
 */
export function hasAllProductsStockReady(products: ProductItem[]): boolean {
  if (products.length === 0) return false;
  return products.every(
    (p) => p.stockStatus === 'OK' && Boolean(p.datePassStock && p.datePassStock.trim().length > 0),
  );
}

export function isEligibleForAgreementReceipt(app: InstallmentApplication): boolean {
  if (app.approvalStatus !== 'Approved') return false;
  if (app.agreement.receivedAt !== null) return false;
  return hasAllProductsStockReady(app.products);
}

/**
 * Checks whether an agreement can be included in overall eligible agreement count
 * (either awaiting receipt or already received and passed stock gate).
 */
export function isAgreementEligibleOverall(app: InstallmentApplication): boolean {
  if (app.approvalStatus !== 'Approved') return false;
  return hasAllProductsStockReady(app.products);
}

export function isAgreementReadyToDispatch(app: InstallmentApplication): boolean {
  return (
    app.agreement.receivedAt !== null &&
    app.agreement.checkingStatus === 'Checking Passed' &&
    app.agreement.dispatchStatus !== 'Dispatched'
  );
}

export function isAgreementDispatched(app: InstallmentApplication): boolean {
  return app.agreement.dispatchStatus === 'Dispatched';
}

export function isAgreementReceivedByJcl(app: InstallmentApplication): boolean {
  return (
    app.agreement.dispatchStatus === 'Dispatched' &&
    app.agreement.jclReceiptStatus === 'Received by JCL'
  );
}

/**
 * State transition: Receive Agreement (TERIMA)
 */
export function receiveAgreementTransition(
  app: InstallmentApplication,
  staffName: string,
  timestampIso: string,
): InstallmentApplication {
  if (!isEligibleForAgreementReceipt(app)) {
    throw new Error(`Application ${app.caseId} is not eligible for agreement receipt.`);
  }
  const agreementNumber =
    app.agreement.agreementNumber || `AGR-${app.caseId.replace('KHL-', '')}`;
  const event: ActivityEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    caseId: app.caseId,
    customerName: app.customerName,
    actionType: 'Agreement Received',
    description: `Agreement ${agreementNumber} received via TERIMA by ${staffName}.`,
    staffName,
    timestamp: timestampIso,
  };

  const nextAgreement = {
    ...app.agreement,
    agreementNumber,
    receivedAt: timestampIso,
    receivedBy: staffName,
    checkingStatus: 'Pending Checking' as const,
  };
  const updatedApp: InstallmentApplication = {
    ...app,
    agreement: nextAgreement,
    timeline: [event, ...app.timeline],
  };

  return {
    ...updatedApp,
    taskStatus: {
      ...deriveTaskStatus(updatedApp),
      agreementReceived: 'RECEIVED',
    },
  };
}

/**
 * State transition: Checking actions (Start / Pass / Fail / Remarks)
 */
export function updateCheckingTransition(
  app: InstallmentApplication,
  nextStatus: 'Checking in Progress' | 'Checking Passed' | 'Checking Failed',
  checklist: CheckingChecklist,
  remarks: string,
  staffName: string,
  timestampIso: string,
  details?: { staff1?: string; staff2?: string; invoiceNumber?: string },
): InstallmentApplication {
  if (!app.agreement.receivedAt) {
    throw new Error(`Agreement ${app.caseId} must be received before checking.`);
  }
  if (app.agreement.dispatchStatus === 'Dispatched') {
    throw new Error(`Agreement ${app.caseId} is already dispatched.`);
  }

  const actionType =
    nextStatus === 'Checking in Progress'
      ? 'Checking Started'
      : nextStatus === 'Checking Passed'
        ? 'Checking Passed'
        : 'Checking Failed';

  const trimmedStaff1 = details?.staff1?.trim() ?? app.agreement.checkingStaff1 ?? '';
  const trimmedStaff2 = details?.staff2?.trim() ?? app.agreement.checkingStaff2 ?? '';
  const trimmedInvoice = details?.invoiceNumber?.trim() ?? app.agreement.invoiceNumber ?? '';
  const staffMeta = [
    trimmedStaff1 ? `STAFF 1: ${trimmedStaff1}` : '',
    trimmedStaff2 ? `STAFF 2: ${trimmedStaff2}` : '',
    trimmedInvoice ? `INVOICE: ${trimmedInvoice}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  const event: ActivityEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    caseId: app.caseId,
    customerName: app.customerName,
    actionType,
    description:
      nextStatus === 'Checking Passed'
        ? `Agreement checking passed by ${staffName}.${staffMeta ? ` (${staffMeta})` : ''} Ready for dispatch to JCL Credit.`
        : nextStatus === 'Checking Failed'
          ? `Agreement checking failed: ${remarks || 'Incomplete documentation.'}${staffMeta ? ` (${staffMeta})` : ''}`
          : `Agreement checking started by ${staffName}.${staffMeta ? ` (${staffMeta})` : ''}`,
    staffName,
    timestamp: timestampIso,
  };

  const mappedTaskChecking: TaskAgreementCheckingStatus =
    nextStatus === 'Checking Passed'
      ? 'PASSED'
      : nextStatus === 'Checking Failed'
        ? 'FAILED'
        : 'IN PROGRESS';
  const mappedTaskSubmission: TaskAgreementSubmissionStatus = 'PENDING';

  const updatedApp: InstallmentApplication = {
    ...app,
    agreement: {
      ...app.agreement,
      checkingStatus: nextStatus,
      checkedAt: nextStatus === 'Checking in Progress' ? app.agreement.checkedAt : timestampIso,
      checkedBy: staffName,
      checkingChecklist: checklist,
      checkingStaff1: trimmedStaff1,
      checkingStaff2: trimmedStaff2,
      invoiceNumber: trimmedInvoice,
      checkingRemarks: remarks,
      dispatchStatus: nextStatus === 'Checking Passed' ? 'Ready to Dispatch' : 'Not Ready',
    },
    timeline: [event, ...app.timeline],
  };

  return {
    ...updatedApp,
    taskStatus: {
      ...deriveTaskStatus(updatedApp),
      agreementChecking: mappedTaskChecking,
      agreementSubmission: mappedTaskSubmission,
    },
  };
}

/**
 * State transition: Dispatch to JCL Credit.
 * IMPORTANT: Dispatch and JCL receipt confirmation are strictly separate events.
 * Dispatch NEVER automatically sets JCL Receipt Status to 'Received by JCL'.
 */
export function dispatchAgreementTransition(
  app: InstallmentApplication,
  payload: {
    courierId: string;
    courierName: string;
    trackingNumber: string;
    dispatchDate: string;
    dispatchedBy: string;
    remarks: string;
  },
  timestampIso: string,
): InstallmentApplication {
  if (!isAgreementReadyToDispatch(app)) {
    throw new Error(`Agreement ${app.caseId} is not ready for dispatch (must pass checking first).`);
  }
  if (!payload.courierId || !payload.trackingNumber.trim() || !payload.dispatchDate) {
    throw new Error('Courier, tracking number, and dispatch date are required.');
  }

  const event: ActivityEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    caseId: app.caseId,
    customerName: app.customerName,
    actionType: 'Agreement Dispatched',
    description: `Dispatched to JCL Credit via ${payload.courierName} (Tracking: ${payload.trackingNumber.trim()}).`,
    staffName: payload.dispatchedBy,
    timestamp: timestampIso,
  };

  const updatedApp: InstallmentApplication = {
    ...app,
    agreement: {
      ...app.agreement,
      dispatchStatus: 'Dispatched',
      destination: 'JCL Credit',
      courierId: payload.courierId,
      courierName: payload.courierName,
      trackingNumber: payload.trackingNumber.trim(),
      dispatchDate: payload.dispatchDate,
      dispatchedBy: payload.dispatchedBy,
      dispatchRemarks: payload.remarks.trim(),
      jclReceiptStatus: 'Pending JCL Confirmation',
    },
    timeline: [event, ...app.timeline],
  };

  return {
    ...updatedApp,
    taskStatus: {
      ...deriveTaskStatus(updatedApp),
      agreementSubmission: 'IN TRANSIT',
      agreementClaimed: 'PENDING JCL',
    },
  };
}

/**
 * State transition: Confirm Received by JCL (separate event after Dispatch).
 */
export function confirmJclReceiptTransition(
  app: InstallmentApplication,
  payload: {
    jclReceivedDate: string;
    confirmedBy: string;
    remarks: string;
  },
  timestampIso: string,
): InstallmentApplication {
  if (app.agreement.dispatchStatus !== 'Dispatched') {
    throw new Error(`Agreement ${app.caseId} must be dispatched before confirming JCL receipt.`);
  }
  if (!payload.jclReceivedDate || !payload.confirmedBy.trim()) {
    throw new Error('JCL received date and confirming staff are required.');
  }

  const event: ActivityEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    caseId: app.caseId,
    customerName: app.customerName,
    actionType: 'JCL Receipt Confirmed',
    description: `JCL Credit receipt confirmed (${formatDateShort(payload.jclReceivedDate)}) by ${payload.confirmedBy.trim()}.`,
    staffName: payload.confirmedBy.trim(),
    timestamp: timestampIso,
  };

  const updatedApp: InstallmentApplication = {
    ...app,
    agreement: {
      ...app.agreement,
      jclReceiptStatus: 'Received by JCL',
      jclReceivedDate: payload.jclReceivedDate,
      jclConfirmedBy: payload.confirmedBy.trim(),
      jclRemarks: payload.remarks.trim(),
    },
    timeline: [event, ...app.timeline],
  };

  return {
    ...updatedApp,
    taskStatus: {
      ...deriveTaskStatus(updatedApp),
      agreementClaimed: 'CLAIMED',
    },
  };
}

export function isAgreementDelivered(
  app: InstallmentApplication,
  postageTrackings?: PostageTrackingRecord[],
): boolean {
  const linkedPostage =
    postageTrackings && app.agreement.saleSubmissionId
      ? postageTrackings.find((t) => t.saleSubmissionId === app.agreement.saleSubmissionId)
      : undefined;
  if (linkedPostage) {
    return (
      linkedPostage.status === 'DELIVERED' ||
      app.taskStatus?.agreementSubmission === 'DELIVERED'
    );
  }
  return deriveTaskStatus(app, postageTrackings).agreementSubmission === 'DELIVERED';
}

export function isAgreementClaimed(app: InstallmentApplication): boolean {
  return (
    app.agreement.jclReceiptStatus === 'Received by JCL' ||
    app.taskStatus?.agreementClaimed === 'CLAIMED'
  );
}

export function resolveClaimDate(app: InstallmentApplication): string {
  return (
    app.agreement.jclReceivedDate ||
    app.agreement.saleSubmittedAt?.slice(0, 10) ||
    app.approvalDate ||
    app.applicationDate
  );
}

export function isEligibleForClaim(
  app: InstallmentApplication,
  postageTrackings?: PostageTrackingRecord[],
): boolean {
  if (app.approvalStatus !== 'Approved') return false;
  if (isAgreementClaimed(app)) return false;
  return isAgreementDelivered(app, postageTrackings);
}

export function claimAgreementTransition(
  app: InstallmentApplication,
  payload: {
    claimDate: string;
    claimedBy: string;
    remarks: string;
  },
  timestampIso: string,
  postageTrackings?: PostageTrackingRecord[],
): InstallmentApplication {
  if (!isEligibleForClaim(app, postageTrackings)) {
    throw new Error(
      `Agreement ${app.caseId} must be in Delivered status before it can be claimed.`,
    );
  }
  if (!payload.claimDate || !payload.claimedBy.trim()) {
    throw new Error('Claim date and staff name are required.');
  }

  const cashPayment = resolveActualCashPayment(app.financing);
  const event: ActivityEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    caseId: app.caseId,
    customerName: app.customerName,
    actionType: 'Agreement Claimed',
    description: `Agreement claimed (${formatDateShort(payload.claimDate)}) by ${payload.claimedBy.trim()}. Actual Cash Payment: ${formatRM(cashPayment)}.${
      payload.remarks.trim() ? ` Remarks: ${payload.remarks.trim()}` : ''
    }`,
    staffName: payload.claimedBy.trim(),
    timestamp: timestampIso,
  };

  const updatedApp: InstallmentApplication = {
    ...app,
    agreement: {
      ...app.agreement,
      jclReceiptStatus: 'Received by JCL',
      jclReceivedDate: payload.claimDate,
      jclConfirmedBy: payload.claimedBy.trim(),
      jclRemarks: payload.remarks.trim(),
    },
    timeline: [event, ...app.timeline],
  };

  return {
    ...updatedApp,
    taskStatus: {
      ...deriveTaskStatus(updatedApp, postageTrackings),
      agreementClaimed: 'CLAIMED',
    },
  };
}

export interface DashboardMetrics {
  totalApplications: number;
  pendingApproval: number;
  approvedApplications: number;
  rejectedApplications: number;
  agreementToBeReceived: number;
  agreementPendingChecking: number;
  readyToDispatch: number;
  dispatchedToJcl: number;
  receivedByJcl: number;
}

export function computeDashboardMetrics(apps: InstallmentApplication[]): DashboardMetrics {
  return {
    totalApplications: apps.length,
    pendingApproval: apps.filter((a) => a.approvalStatus === 'Pending').length,
    approvedApplications: apps.filter((a) => a.approvalStatus === 'Approved').length,
    rejectedApplications: apps.filter((a) => a.approvalStatus === 'Rejected').length,
    agreementToBeReceived: apps.filter(isEligibleForAgreementReceipt).length,
    agreementPendingChecking: apps.filter(
      (a) =>
        a.agreement.receivedAt !== null &&
        (a.agreement.checkingStatus === 'Pending Checking' ||
          a.agreement.checkingStatus === 'Checking in Progress'),
    ).length,
    readyToDispatch: apps.filter(isAgreementReadyToDispatch).length,
    dispatchedToJcl: apps.filter(isAgreementDispatched).length,
    receivedByJcl: apps.filter(isAgreementReceivedByJcl).length,
  };
}

export function filterApplicationsByDateRange(
  apps: InstallmentApplication[],
  startDate?: string,
  endDate?: string,
): InstallmentApplication[] {
  return apps.filter((app) => {
    if (startDate && app.applicationDate < startDate) return false;
    if (endDate && app.applicationDate > endDate) return false;
    return true;
  });
}

export interface BranchApprovalReportRow {
  branchId: string;
  branchName: string;
  totalApplications: number;
  approved: number;
  pending: number;
  rejected: number;
  approvalRate: number;
}

/**
 * REPORT A – Approval Performance by Branch
 * IMPORTANT BUSINESS RULE:
 * Approval performance MUST be calculated based on the original branch that handled the application:
 * customerFromBranchId (NOT pickupBranchId).
 */
export function computeBranchApprovalReport(
  apps: InstallmentApplication[],
  branches: Branch[],
): BranchApprovalReportRow[] {
  const map = new Map<string, BranchApprovalReportRow>();
  for (const b of branches) {
    map.set(b.id, {
      branchId: b.id,
      branchName: b.name,
      totalApplications: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      approvalRate: 0,
    });
  }

  for (const app of apps) {
    const existing = map.get(app.customerFromBranchId) ?? {
      branchId: app.customerFromBranchId,
      branchName: app.customerFromBranchId,
      totalApplications: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      approvalRate: 0,
    };
    existing.totalApplications += 1;
    if (app.approvalStatus === 'Approved') existing.approved += 1;
    else if (app.approvalStatus === 'Pending') existing.pending += 1;
    else if (app.approvalStatus === 'Rejected') existing.rejected += 1;
    map.set(app.customerFromBranchId, existing);
  }

  return Array.from(map.values())
    .filter((r) => r.totalApplications > 0)
    .map((r) => ({
      ...r,
      approvalRate:
        r.totalApplications > 0 ? Math.round((r.approved / r.totalApplications) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.totalApplications - a.totalApplications);
}

export interface SistemRekodReportRow {
  pickupBranchId: string;
  pickupBranchName: string;
  totalApprovedApplications: number;
  numberOfCustomers: number;
  productRecords: number;
}

/**
 * REPORT B – Approval Sistem Rekod
 * IMPORTANT BUSINESS RULE:
 * Must use pickupBranchId (NOT customerFromBranchId).
 * If pickup branch has not been assigned (null/empty), display "Belum Ditentukan".
 * Do NOT allocate records with an undefined pickup branch to any branch.
 * One application contributes to both Report A and Report B without duplicate records.
 */
export function computeSistemRekodReport(
  apps: InstallmentApplication[],
  branches: Branch[],
): SistemRekodReportRow[] {
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
  const approvedApps = apps.filter((a) => a.approvalStatus === 'Approved');

  const grouped = new Map<
    string,
    {
      pickupBranchId: string;
      pickupBranchName: string;
      totalApprovedApplications: number;
      customerIcSet: Set<string>;
      productRecords: number;
    }
  >();

  for (const app of approvedApps) {
    const key =
      app.pickupBranchId && app.pickupBranchId.trim().length > 0
        ? app.pickupBranchId
        : '__UNASSIGNED__';
    const label =
      key === '__UNASSIGNED__'
        ? 'Belum Ditentukan'
        : branchNameById.get(key) || key;

    const bucket = grouped.get(key) ?? {
      pickupBranchId: key,
      pickupBranchName: label,
      totalApprovedApplications: 0,
      customerIcSet: new Set<string>(),
      productRecords: 0,
    };

    bucket.totalApprovedApplications += 1;
    bucket.customerIcSet.add(app.icNumber);
    bucket.productRecords += app.products.reduce((sum, p) => sum + p.quantity, 0);
    grouped.set(key, bucket);
  }

  return Array.from(grouped.values())
    .map((b) => ({
      pickupBranchId: b.pickupBranchId,
      pickupBranchName: b.pickupBranchName,
      totalApprovedApplications: b.totalApprovedApplications,
      numberOfCustomers: b.customerIcSet.size,
      productRecords: b.productRecords,
    }))
    .sort((a, b) => {
      if (a.pickupBranchId === '__UNASSIGNED__') return 1;
      if (b.pickupBranchId === '__UNASSIGNED__') return -1;
      return b.totalApprovedApplications - a.totalApprovedApplications;
    });
}

export interface AgreementPerformanceReport {
  agreementsEligible: number;
  agreementsReceived: number;
  pendingChecking: number;
  checkingPassed: number;
  checkingFailed: number;
  readyToDispatch: number;
  dispatched: number;
  receivedByJcl: number;
}

export function computeAgreementPerformanceReport(
  apps: InstallmentApplication[],
): AgreementPerformanceReport {
  return {
    agreementsEligible: apps.filter(isAgreementEligibleOverall).length,
    agreementsReceived: apps.filter((a) => a.agreement.receivedAt !== null).length,
    pendingChecking: apps.filter(
      (a) =>
        a.agreement.receivedAt !== null &&
        (a.agreement.checkingStatus === 'Pending Checking' ||
          a.agreement.checkingStatus === 'Checking in Progress'),
    ).length,
    checkingPassed: apps.filter((a) => a.agreement.checkingStatus === 'Checking Passed').length,
    checkingFailed: apps.filter((a) => a.agreement.checkingStatus === 'Checking Failed').length,
    readyToDispatch: apps.filter(isAgreementReadyToDispatch).length,
    dispatched: apps.filter(isAgreementDispatched).length,
    receivedByJcl: apps.filter(isAgreementReceivedByJcl).length,
  };
}

export interface StaffPerformanceRow {
  staffId: string;
  staffName: string;
  originalBranchName: string;
  applicationsManaged: number;
  agreementsReceived: number;
  agreementsChecked: number;
  agreementsDispatched: number;
}

export function computeStaffPerformanceReport(
  apps: InstallmentApplication[],
  users: StaffUser[],
  branches: Branch[],
): StaffPerformanceRow[] {
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  return users
    .map((u) => {
      const managed = apps.filter((a) => a.staffInChargeId === u.id).length;
      const received = apps.filter((a) => a.agreement.receivedBy === u.name).length;
      const checked = apps.filter(
        (a) =>
          a.agreement.checkedBy === u.name &&
          (a.agreement.checkingStatus === 'Checking Passed' ||
            a.agreement.checkingStatus === 'Checking Failed'),
      ).length;
      const dispatched = apps.filter((a) => a.agreement.dispatchedBy === u.name).length;

      return {
        staffId: u.id,
        staffName: u.name,
        originalBranchName: branchMap.get(u.branchId) || u.branchId,
        applicationsManaged: managed,
        agreementsReceived: received,
        agreementsChecked: checked,
        agreementsDispatched: dispatched,
      };
    })
    .filter(
      (r) =>
        r.applicationsManaged > 0 ||
        r.agreementsReceived > 0 ||
        r.agreementsChecked > 0 ||
        r.agreementsDispatched > 0,
    )
    .sort((a, b) => b.applicationsManaged - a.applicationsManaged);
}

export function getAgreementLifecycleStatus(app: InstallmentApplication): string {
  if (app.agreement.jclReceiptStatus === 'Received by JCL') return 'Received by JCL';
  if (app.agreement.dispatchStatus === 'Dispatched') return 'Dispatched to JCL';
  if (app.agreement.checkingStatus === 'Checking Passed') return 'Ready to Dispatch';
  if (app.agreement.checkingStatus === 'Checking Failed') return 'Checking Failed';
  if (app.agreement.checkingStatus === 'Checking in Progress') return 'Checking in Progress';
  if (app.agreement.checkingStatus === 'Pending Checking') return 'Pending Checking';
  if (isEligibleForAgreementReceipt(app)) return 'Awaiting Receipt (TERIMA)';
  if (app.approvalStatus === 'Approved') return 'Stock Pending';
  return app.approvalStatus;
}

export function userHasPermission(
  user: StaffUser,
  roles: RoleConfig[],
  permission: PermissionKey,
): boolean {
  const role = roles.find((r) => r.id === user.roleId);
  if (!role || !role.active) return false;
  return role.permissions.includes(permission);
}

export interface FinancingCalculationInput {
  products: { quantity: number; unitPrice: number }[];
  deposit: number;
  agreementFee: number;
  processingFee: number;
  sstAmount: number;
  stampDutyOverride?: number | null;
  cashPaymentOverride?: number | null;
  monthlyInstallmentOverride?: number | null;
  installmentDuration?: number;
}

export interface FinancingCalculationResult {
  totalProductPrice: number;
  totalUnits: number;
  deposit: number;
  financingAmount: number;
  agreementFee: number;
  processingFee: number;
  sstAmount: number;
  stampDutyFee: number;
  actualCashPayment: number;
  installmentDuration: number;
  monthlyInstallment: number;
}

export function calculateFinancingSummary(
  input: FinancingCalculationInput,
): FinancingCalculationResult {
  const totalProductPrice = input.products.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );
  const totalUnits = input.products.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const deposit = Math.max(0, Number(input.deposit) || 0);
  const financingAmount = Math.max(0, totalProductPrice - deposit);
  const agreementFee = Math.max(0, Number(input.agreementFee) || 0);
  const processingFee = Math.max(0, Number(input.processingFee) || 0);
  const sstAmount = Math.max(0, Number(input.sstAmount) || 0);

  const autoStampDuty = financingAmount > 0 ? Math.ceil(financingAmount / 1000) * 5 : 0;
  const stampDutyFee =
    input.stampDutyOverride !== null && input.stampDutyOverride !== undefined
      ? Math.max(0, Number(input.stampDutyOverride) || 0)
      : autoStampDuty;

  const autoCashPayment = Math.max(
    0,
    financingAmount - processingFee - sstAmount - stampDutyFee,
  );
  const actualCashPayment =
    input.cashPaymentOverride !== null && input.cashPaymentOverride !== undefined
      ? Math.max(0, Number(input.cashPaymentOverride) || 0)
      : autoCashPayment;

  const installmentDuration = Math.max(1, Number(input.installmentDuration) || 24);
  const autoMonthlyInstallment =
    financingAmount > 0
      ? Math.round((financingAmount * 1.18) / installmentDuration)
      : 0;
  const monthlyInstallment =
    input.monthlyInstallmentOverride !== null && input.monthlyInstallmentOverride !== undefined
      ? Math.max(0, Number(input.monthlyInstallmentOverride) || 0)
      : autoMonthlyInstallment;

  return {
    totalProductPrice,
    totalUnits,
    deposit,
    financingAmount,
    agreementFee,
    processingFee,
    sstAmount,
    stampDutyFee,
    actualCashPayment,
    installmentDuration,
    monthlyInstallment,
  };
}

export interface NewApplicationPayload {
  caseId: string;
  customerName: string;
  icNumber: string;
  phone: string;
  ref1Id: string;
  customerFromBranchId: string;
  pickupBranchId: string | null;
  applicationDate: string;
  bankName: string;
  bankAccountNumber: string;
  applicationRemarks: string;
  internalNotes: string;
  category?: ProductCategory;
  products: {
    productName: string;
    model?: string;
    quantity: number;
    unitPrice: number;
  }[];
  deposit: number;
  agreementFee: number;
  processingFee: number;
  sstAmount: number;
  stampDutyFee: number;
  actualCashPayment: number;
  monthlyInstallment?: number;
  installmentDuration?: number;
}

export function createNewApplicationTransition(
  existingApps: InstallmentApplication[],
  payload: NewApplicationPayload,
  staffUser: StaffUser,
  timestampIso: string,
): InstallmentApplication {
  const trimmedCaseId = payload.caseId.trim();
  if (!trimmedCaseId) {
    throw new Error('CASE ID is required.');
  }
  const duplicate = existingApps.some(
    (a) => a.caseId.trim().toLowerCase() === trimmedCaseId.toLowerCase(),
  );
  if (duplicate) {
    throw new Error(`CASE ID "${trimmedCaseId}" already exists. Each CASE ID must be unique.`);
  }
  if (!payload.customerName.trim() || !payload.icNumber.trim() || !payload.phone.trim()) {
    throw new Error('Customer Name, IC Number, and Phone Number are required.');
  }
  if (!payload.customerFromBranchId) {
    throw new Error('Customer From Branch is required.');
  }
  if (payload.products.length === 0) {
    throw new Error('At least one product is required.');
  }

  const calc = calculateFinancingSummary({
    products: payload.products.map((p) => ({ quantity: p.quantity, unitPrice: p.unitPrice })),
    deposit: payload.deposit,
    agreementFee: payload.agreementFee,
    processingFee: payload.processingFee,
    sstAmount: payload.sstAmount,
    stampDutyOverride: payload.stampDutyFee,
    cashPaymentOverride: payload.actualCashPayment,
    monthlyInstallmentOverride:
      payload.monthlyInstallment !== undefined ? payload.monthlyInstallment : null,
    installmentDuration: payload.installmentDuration ?? 24,
  });

  if (calc.totalProductPrice <= 0) {
    throw new Error('Total Product Price must be greater than RM 0.00.');
  }
  if (calc.deposit > calc.totalProductPrice) {
    throw new Error('Deposit cannot exceed Total Product Price.');
  }

  const appId = `app-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const products: ProductItem[] = payload.products.map((p, idx) => ({
    id: `prd-${Date.now()}-${idx}`,
    productName: p.productName.trim(),
    model: (p.model || '').trim() || 'Standard Spec',
    quantity: Math.max(1, Number(p.quantity) || 1),
    productPrice: Number(p.unitPrice) || 0,
    stockStatus: 'Pending Stock',
    datePassStock: null,
  }));

  const event: ActivityEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    caseId: trimmedCaseId,
    customerName: payload.customerName.trim(),
    actionType: 'Application Created',
    description: `New application submitted by ${staffUser.name} (Financing: ${formatRM(calc.financingAmount)}).`,
    staffName: staffUser.name,
    timestamp: timestampIso,
  };

  const effectiveAppDate = payload.applicationDate || timestampIso.slice(0, 10);

  return {
    id: appId,
    caseId: trimmedCaseId,
    applicationDate: effectiveAppDate,
    customerName: payload.customerName.trim(),
    icNumber: payload.icNumber.trim(),
    phone: payload.phone.trim(),
    address: 'Malaysia',
    ref1Id: payload.ref1Id.trim() || '—',
    bankName: payload.bankName.trim(),
    bankAccountNumber: payload.bankAccountNumber.trim(),
    applicationRemarks: payload.applicationRemarks.trim(),
    internalNotes: payload.internalNotes.trim(),
    customerFromBranchId: payload.customerFromBranchId,
    pickupBranchId: payload.pickupBranchId || null,
    staffInChargeId: staffUser.id,
    approvalStatus: 'Approved',
    approvalDate: effectiveAppDate,
    approvedBy: staffUser.name,
    approvalRemarks: payload.internalNotes.trim() || payload.applicationRemarks.trim(),
    category: payload.category ?? resolveApplicationCategory({ products }),
    products,
    financing: {
      totalProductPrice: calc.totalProductPrice,
      deposit: calc.deposit,
      financingAmount: calc.financingAmount,
      agreementFee: calc.agreementFee,
      processingFee: calc.processingFee,
      sstAmount: calc.sstAmount,
      stampDutyFee: calc.stampDutyFee,
      actualCashPayment: calc.actualCashPayment,
      installmentDuration: calc.installmentDuration,
      monthlyInstallment: calc.monthlyInstallment,
    },
    documents: [],
    agreement: {
      agreementNumber: null,
      receivedAt: null,
      receivedBy: null,
      checkingStatus: 'Not Received',
      checkedAt: null,
      checkedBy: null,
      checkingChecklist: {
        signAndChopPages: false,
        customerSignatureComplete: false,
        invoiceDetails: false,
        cafDetails: false,
      },
      checkingStaff1: '',
      checkingStaff2: '',
      invoiceNumber: '',
      checkingRemarks: '',
      dispatchStatus: 'Not Ready',
      destination: 'JCL Credit',
      courierId: null,
      courierName: null,
      trackingNumber: null,
      dispatchDate: null,
      dispatchedBy: null,
      dispatchRemarks: '',
      jclReceiptStatus: 'Not Dispatched',
      jclReceivedDate: null,
      jclConfirmedBy: null,
      jclRemarks: '',
    },
    stockFollowUp: {
      colour: products[0]?.model || '',
      stockStage: 'NOT YET CHECKING',
      customerDecision: 'PENDING DECISION',
      collectionConfirmation: 'PENDING',
      remark: payload.applicationRemarks.trim() || 'Awaiting stock check upon approval.',
      changes: [],
    },
    taskStatus: { ...DEFAULT_TASK_STATUS },
    timeline: [event],
  };
}

export const DEFAULT_TASK_STATUS: TaskStatusState = {
  stockStatus: 'NOT YET CHECKING',
  customerDecision: 'PENDING',
  collectionConfirmation: 'PENDING',
  passedStock: 'NOT YET',
  agreementReceived: 'PENDING',
  agreementChecking: 'PENDING',
  agreementSubmission: 'PENDING',
  agreementClaimed: 'PENDING',
};

export function mapPostageStatusToTaskSubmission(
  status: PostageTrackingStatus,
): TaskAgreementSubmissionStatus {
  if (status === 'FAILED / RETURNED') return 'FAILED/RETURNED';
  return status;
}

function normalizeTaskSubmissionStatus(
  status: string | undefined,
  fallback: TaskAgreementSubmissionStatus,
): TaskAgreementSubmissionStatus {
  if (!status) return fallback;
  if (status === 'FAILED / RETURNED' || status === 'FAILED/RETURNED') {
    return 'FAILED/RETURNED';
  }
  if (
    status === 'PENDING' ||
    status === 'IN TRANSIT' ||
    status === 'OUT FOR DELIVERY' ||
    status === 'DELIVERED'
  ) {
    return status;
  }
  if (status === 'SUBMITTED') {
    return fallback === 'PENDING' ? 'IN TRANSIT' : fallback;
  }
  if (status === 'READY TO DISPATCH') {
    return fallback;
  }
  return fallback;
}

export function deriveTaskStatus(
  app: InstallmentApplication,
  postageTrackings?: PostageTrackingRecord[],
): TaskStatusState {
  const linkedPostage =
    postageTrackings && app.agreement.saleSubmissionId
      ? postageTrackings.find((t) => t.saleSubmissionId === app.agreement.saleSubmissionId)
      : undefined;

  if (app.approvalStatus !== 'Approved' && !app.stockFollowUp && !app.taskStatus && !linkedPostage) {
    return { ...DEFAULT_TASK_STATUS };
  }

  const followUp = deriveStockFollowUp(app);
  const derivedDecision: TaskCustomerDecision =
    followUp.customerDecision === 'PENDING DECISION' ? 'PENDING' : followUp.customerDecision;
  const derivedPassedStock: TaskPassedStockStatus = hasAllProductsStockReady(app.products)
    ? 'PASSED'
    : 'NOT YET';
  const derivedReceived: TaskAgreementReceivedStatus = app.agreement.receivedAt
    ? 'RECEIVED'
    : 'PENDING';
  const derivedChecking: TaskAgreementCheckingStatus =
    app.agreement.checkingStatus === 'Checking Passed'
      ? 'PASSED'
      : app.agreement.checkingStatus === 'Checking Failed'
        ? 'FAILED'
        : app.agreement.checkingStatus === 'Checking in Progress'
          ? 'IN PROGRESS'
          : 'PENDING';
  const derivedSubmission: TaskAgreementSubmissionStatus = linkedPostage
    ? mapPostageStatusToTaskSubmission(linkedPostage.status)
    : app.agreement.dispatchStatus === 'Dispatched'
      ? app.agreement.jclReceiptStatus === 'Received by JCL'
        ? 'DELIVERED'
        : 'IN TRANSIT'
      : 'PENDING';
  const derivedClaimed: TaskAgreementClaimedStatus =
    app.agreement.jclReceiptStatus === 'Received by JCL'
      ? 'CLAIMED'
      : app.agreement.jclReceiptStatus === 'Pending JCL Confirmation'
        ? 'PENDING JCL'
        : 'PENDING';

  const resolvedSubmission = linkedPostage
    ? app.taskStatus?.agreementSubmission &&
      app.taskStatus.agreementSubmission !== 'PENDING' &&
      app.taskStatus.agreementSubmission !== ('READY TO DISPATCH' as string) &&
      app.taskStatus.agreementSubmission !== ('SUBMITTED' as string)
      ? normalizeTaskSubmissionStatus(app.taskStatus.agreementSubmission, derivedSubmission)
      : derivedSubmission
    : normalizeTaskSubmissionStatus(app.taskStatus?.agreementSubmission, derivedSubmission);

  return {
    stockStatus: app.taskStatus?.stockStatus ?? followUp.stockStage,
    customerDecision: app.taskStatus?.customerDecision ?? derivedDecision,
    collectionConfirmation:
      app.taskStatus?.collectionConfirmation ?? followUp.collectionConfirmation,
    passedStock: app.taskStatus?.passedStock ?? derivedPassedStock,
    agreementReceived: app.taskStatus?.agreementReceived ?? derivedReceived,
    agreementChecking: app.taskStatus?.agreementChecking ?? derivedChecking,
    agreementSubmission: resolvedSubmission,
    agreementClaimed: app.taskStatus?.agreementClaimed ?? derivedClaimed,
  };
}

export function mapStockStageToProductStatus(stage: StockWorkflowStage): StockStatus {
  if (stage === 'READY') return 'OK';
  if (stage === 'NO STOCK') return 'Out of Stock';
  return 'Pending Stock';
}

export function deriveStockFollowUp(app: InstallmentApplication): StockFollowUpState {
  if (app.stockFollowUp) return app.stockFollowUp;
  const allOk = app.products.every((p) => p.stockStatus === 'OK');
  const anyOut = app.products.some((p) => p.stockStatus === 'Out of Stock');
  const stage: StockWorkflowStage = allOk
    ? 'READY'
    : anyOut
      ? 'NO STOCK'
      : 'NOT YET CHECKING';
  const allPassed = hasAllProductsStockReady(app.products);
  return {
    colour: app.products[0]?.model || '—',
    stockStage: stage,
    customerDecision: allPassed ? 'ACCEPT' : 'PENDING DECISION',
    collectionConfirmation: allPassed ? 'CONFIRMED' : 'PENDING',
    remark: app.approvalRemarks || '',
    changes: [],
  };
}

export interface UpdateStockFollowUpPayload {
  customerFromBranchId: string;
  pickupBranchId: string | null;
  colour: string;
  colour2?: string;
  colour3?: string;
  stockStage: StockWorkflowStage;
  customerDecision: CustomerStockDecision;
  collectionConfirmation: CollectionConfirmationStatus;
  datePassStock: string | null;
  remark: string;
}

export function updateStockFollowUpTransition(
  app: InstallmentApplication,
  payload: UpdateStockFollowUpPayload,
  branches: Branch[],
  staffName: string,
  timestampIso: string,
): InstallmentApplication {
  if (payload.customerDecision === 'CANCELLED' && !payload.remark.trim()) {
    throw new Error('Please enter a cancellation reason in Remark.');
  }

  const normalizedDate = payload.datePassStock?.trim() ? payload.datePassStock.trim() : null;
  const canHavePassDate =
    payload.stockStage === 'READY' &&
    payload.collectionConfirmation === 'CONFIRMED' &&
    payload.customerDecision !== 'CANCELLED';

  if (normalizedDate && !canHavePassDate) {
    throw new Error(
      'Date Pass Stok can only be filled when Stock Status is READY and Collection Confirmation is CONFIRMED.',
    );
  }

  const branchLabel = (id: string | null) => {
    if (!id) return 'Belum Ditentukan';
    if (id === 'POSTAGE') return 'POSTAGE';
    if (id === 'WEB') return 'WEB';
    return branches.find((b) => b.id === id)?.name ?? id;
  };

  const prevFollowUp = deriveStockFollowUp(app);
  const prevPassDate = app.products[0]?.datePassStock || '';
  const nextCollection: CollectionConfirmationStatus =
    payload.customerDecision === 'CANCELLED' ? 'PENDING' : payload.collectionConfirmation;

  const comparisons: { field: string; before: string; after: string }[] = [
    {
      field: 'Customer From Branch',
      before: branchLabel(app.customerFromBranchId),
      after: branchLabel(payload.customerFromBranchId),
    },
    {
      field: 'Branch Pickup',
      before: branchLabel(app.pickupBranchId),
      after: branchLabel(payload.pickupBranchId),
    },
    {
      field: 'Colour 1',
      before: prevFollowUp.colour || '—',
      after: payload.colour.trim() || '—',
    },
    ...(app.products.length >= 2
      ? [
          {
            field: 'Colour 2',
            before: prevFollowUp.colour2 || '—',
            after: (payload.colour2 || '').trim() || '—',
          },
        ]
      : []),
    ...(app.products.length >= 3
      ? [
          {
            field: 'Colour 3',
            before: prevFollowUp.colour3 || '—',
            after: (payload.colour3 || '').trim() || '—',
          },
        ]
      : []),
    {
      field: 'Stock Status',
      before: prevFollowUp.stockStage,
      after: payload.stockStage,
    },
    {
      field: 'Customer Decision',
      before: prevFollowUp.customerDecision,
      after: payload.customerDecision,
    },
    {
      field: 'Collection Confirmation',
      before: prevFollowUp.collectionConfirmation,
      after: nextCollection,
    },
    {
      field: 'Date Pass Stok',
      before: prevPassDate || '—',
      after: normalizedDate || '—',
    },
    {
      field: 'Remark',
      before: prevFollowUp.remark || '—',
      after: payload.remark.trim() || '—',
    },
  ];

  const newChanges: StockChangeEntry[] = comparisons
    .filter((c) => c.before !== c.after)
    .map((c, idx) => ({
      id: `chg-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      field: c.field,
      before: c.before,
      after: c.after,
      timestamp: timestampIso,
      staffName,
    }));

  const mappedProductStatus = mapStockStageToProductStatus(payload.stockStage);
  const updatedProducts: ProductItem[] = app.products.map((p) => ({
    ...p,
    stockStatus: mappedProductStatus,
    datePassStock: normalizedDate,
  }));

  const event: ActivityEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    caseId: app.caseId,
    customerName: app.customerName,
    actionType: normalizedDate && !prevPassDate ? 'Stock Passed' : 'Stock Updated',
    description:
      newChanges.length > 0
        ? `Stock follow-up updated (${newChanges.map((c) => `${c.field}: ${c.after}`).join(', ')}).`
        : 'Stock follow-up saved.',
    staffName,
    timestamp: timestampIso,
  };

  const nextTaskCustomerDecision: TaskCustomerDecision =
    payload.customerDecision === 'PENDING DECISION' ? 'PENDING' : payload.customerDecision;

  return {
    ...app,
    customerFromBranchId: payload.customerFromBranchId,
    pickupBranchId: payload.pickupBranchId,
    products: updatedProducts,
    stockFollowUp: {
      colour: payload.colour.trim(),
      ...(app.products.length >= 2 ? { colour2: (payload.colour2 || '').trim() } : {}),
      ...(app.products.length >= 3 ? { colour3: (payload.colour3 || '').trim() } : {}),
      stockStage: payload.stockStage,
      customerDecision: payload.customerDecision,
      collectionConfirmation: nextCollection,
      remark: payload.remark.trim(),
      changes: [...prevFollowUp.changes, ...newChanges],
    },
    taskStatus: {
      ...deriveTaskStatus(app),
      stockStatus: payload.stockStage,
      customerDecision: nextTaskCustomerDecision,
      collectionConfirmation: nextCollection,
      passedStock: normalizedDate && mappedProductStatus === 'OK' ? 'PASSED' : 'NOT YET',
    },
    timeline: [event, ...app.timeline],
  };
}

export function passStockToBranchTransition(
  app: InstallmentApplication,
  passDate: string,
  staffName: string,
  timestampIso: string,
): InstallmentApplication {
  if (!passDate.trim()) {
    throw new Error('Please select Date Pass Stok.');
  }
  const followUp = deriveStockFollowUp(app);
  if (
    !(
      followUp.stockStage === 'READY' &&
      followUp.collectionConfirmation === 'CONFIRMED' &&
      followUp.customerDecision !== 'CANCELLED'
    )
  ) {
    throw new Error(
      'Pass Stock is only allowed when Stock Status is READY and Collection Confirmation is CONFIRMED.',
    );
  }

  const prevPassDate = app.products[0]?.datePassStock || '—';
  const changeEntry: StockChangeEntry = {
    id: `chg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    field: 'Date Pass Stok',
    before: prevPassDate,
    after: passDate.trim(),
    timestamp: timestampIso,
    staffName,
  };

  const event: ActivityEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    caseId: app.caseId,
    customerName: app.customerName,
    actionType: 'Stock Passed',
    description: `Stock passed to pickup branch on ${formatDateShort(passDate.trim())} by ${staffName}.`,
    staffName,
    timestamp: timestampIso,
  };

  return {
    ...app,
    products: app.products.map((p) => ({
      ...p,
      stockStatus: 'OK',
      datePassStock: passDate.trim(),
    })),
    stockFollowUp: {
      ...followUp,
      changes: [...followUp.changes, changeEntry],
    },
    taskStatus: {
      ...deriveTaskStatus(app),
      passedStock: 'PASSED',
    },
    timeline: [event, ...app.timeline],
  };
}

export type ApprovalListConfirmedStatus =
  | 'Confirmed'
  | 'Pending'
  | 'Pending Approval'
  | 'Rejected'
  | 'Cancelled';

export type ApprovalListClaimStatus =
  | 'Claimed'
  | 'Pending JCL'
  | 'Ready to Claim'
  | 'Not Ready'
  | '—';

export function getApprovalListConfirmedStatus(
  app: InstallmentApplication,
): ApprovalListConfirmedStatus {
  if (app.approvalStatus === 'Pending') return 'Pending Approval';
  if (app.approvalStatus === 'Rejected') return 'Rejected';
  const followUp = deriveStockFollowUp(app);
  if (followUp.customerDecision === 'CANCELLED') return 'Cancelled';
  if (followUp.collectionConfirmation === 'CONFIRMED') return 'Confirmed';
  return 'Pending';
}

export function getApprovalListCheckingStatus(
  app: InstallmentApplication,
): InstallmentApplication['agreement']['checkingStatus'] | '—' {
  if (app.approvalStatus === 'Rejected') return '—';
  const followUp = deriveStockFollowUp(app);
  if (followUp.customerDecision === 'CANCELLED') return '—';
  return app.agreement.checkingStatus;
}

export function getApprovalListClaimStatus(
  app: InstallmentApplication,
): ApprovalListClaimStatus {
  if (app.approvalStatus === 'Rejected') return '—';
  const followUp = deriveStockFollowUp(app);
  if (followUp.customerDecision === 'CANCELLED') return '—';
  if (app.agreement.jclReceiptStatus === 'Received by JCL') return 'Claimed';
  if (app.agreement.dispatchStatus === 'Dispatched') return 'Pending JCL';
  if (
    app.agreement.checkingStatus === 'Checking Passed' ||
    app.agreement.dispatchStatus === 'Ready to Dispatch'
  ) {
    return 'Ready to Claim';
  }
  return 'Not Ready';
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Apple',
  'Android',
  'Game&Console',
  'Home Appliance',
];

export function resolveApplicationCategory(
  app: Pick<InstallmentApplication, 'category' | 'products'>,
): ProductCategory {
  if (app.category && PRODUCT_CATEGORIES.includes(app.category)) {
    return app.category;
  }

  const haystack = app.products
    .map((p) => `${p.productName} ${p.model || ''}`.toLowerCase())
    .join(' ');

  if (
    /\b(ps5|ps4|playstation|xbox|nintendo|switch|rog ally|steam deck|console|game)\b/.test(
      haystack,
    )
  ) {
    return 'Game&Console';
  }

  if (
    /\b(dyson|puricare|purifier|washer|washing machine|fridge|refrigerator|vacuum|aircond|air cond|microwave|appliance|tv|television|sharp|panasonic|philips|lg )\b/.test(
      haystack,
    )
  ) {
    return 'Home Appliance';
  }

  if (/\b(apple|iphone|ipad|macbook|imac|airpods|apple watch)\b/.test(haystack)) {
    return 'Apple';
  }

  return 'Android';
}

export interface UpdateApplicationDetailsPayload {
  caseId: string;
  customerName: string;
  icNumber: string;
  phone: string;
  ref1Id: string;
  applicationDate: string;
  customerFromBranchId: string;
  pickupBranchId: string | null;
  bankName: string;
  bankAccountNumber: string;
  applicationRemarks: string;
  approvalStatus: ApprovalStatus;
  approvalDate: string | null;
  staffInChargeId: string;
  internalNotes: string;
  category: ProductCategory;
  products: {
    id?: string;
    productName: string;
    model: string;
    quantity: number;
    unitPrice: number;
  }[];
  deposit: number;
  agreementFee: number;
  processingFee: number;
  sstAmount: number;
  stampDutyFee: number;
  actualCashPayment: number;
  installmentDuration: number;
  monthlyInstallment: number;
  taskStatus?: TaskStatusState;
}

export function updateApplicationDetailsTransition(
  existingApps: InstallmentApplication[],
  appId: string,
  payload: UpdateApplicationDetailsPayload,
  branches: Branch[],
  users: StaffUser[],
  editorName: string,
  timestampIso: string,
): InstallmentApplication {
  const current = existingApps.find((a) => a.id === appId);
  if (!current) {
    throw new Error('Application record not found.');
  }

  const trimmedCaseId = payload.caseId.trim();
  if (!trimmedCaseId) {
    throw new Error('CASE ID is required.');
  }
  const duplicate = existingApps.some(
    (a) => a.id !== appId && a.caseId.trim().toLowerCase() === trimmedCaseId.toLowerCase(),
  );
  if (duplicate) {
    throw new Error(`CASE ID "${trimmedCaseId}" already exists. Each CASE ID must be unique.`);
  }
  if (!payload.customerName.trim() || !payload.icNumber.trim() || !payload.phone.trim()) {
    throw new Error('Customer Name, IC Number, and Phone Number are required.');
  }
  if (!payload.customerFromBranchId) {
    throw new Error('Customer From Branch is required.');
  }
  const validProducts = payload.products.filter((p) => p.productName.trim().length > 0);
  if (validProducts.length === 0) {
    throw new Error('At least one product is required.');
  }

  const totalProductPrice = Number(
    validProducts
      .reduce(
        (sum, p) => sum + Math.max(1, Number(p.quantity) || 1) * Math.max(0, Number(p.unitPrice) || 0),
        0,
      )
      .toFixed(2),
  );
  if (totalProductPrice <= 0) {
    throw new Error('Total Product Price must be greater than RM 0.00.');
  }
  const deposit = Math.max(0, Number(payload.deposit) || 0);
  if (deposit > totalProductPrice) {
    throw new Error('Deposit cannot exceed Total Product Price.');
  }

  const financingAmount = Number(Math.max(0, totalProductPrice - deposit).toFixed(2));
  const agreementFee = Math.max(0, Number(payload.agreementFee) || 0);
  const processingFee = Math.max(0, Number(payload.processingFee) || 0);
  const sstAmount = Math.max(0, Number(payload.sstAmount) || 0);
  const stampDutyFee = Math.max(0, Number(payload.stampDutyFee) || 0);
  const actualCashPayment = Math.max(0, Number(payload.actualCashPayment) || 0);
  const installmentDuration = Math.max(1, Math.round(Number(payload.installmentDuration) || 24));
  const monthlyInstallment = Math.max(0, Number(payload.monthlyInstallment) || 0);

  const nextProducts: ProductItem[] = validProducts.map((p, idx) => {
    const existingProd = p.id ? current.products.find((ep) => ep.id === p.id) : undefined;
    return {
      id: existingProd?.id ?? p.id ?? `prd-${Date.now()}-${idx}`,
      productName: p.productName.trim(),
      model: p.model.trim() || 'Standard Spec',
      quantity: Math.max(1, Number(p.quantity) || 1),
      productPrice: Math.max(0, Number(p.unitPrice) || 0),
      stockStatus: existingProd?.stockStatus ?? 'Pending Stock',
      datePassStock: existingProd?.datePassStock ?? null,
    };
  });

  const branchLabel = (id: string | null) => {
    if (!id) return 'Belum Ditentukan';
    if (id === 'WEB' || id === 'POSTAGE') return id;
    return branches.find((b) => b.id === id)?.name ?? id;
  };
  const staffLabel = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const productsSummary = (items: ProductItem[]) =>
    items
      .map((p) => `${p.productName} (${p.model}) x${p.quantity} @ ${formatRM(p.productPrice)}`)
      .join('; ');

  const prevActualCash =
    current.financing.actualCashPayment ??
    Math.max(
      0,
      current.financing.financingAmount -
        current.financing.processingFee -
        current.financing.sstAmount -
        current.financing.stampDutyFee,
    );

  const nextRef1 = payload.ref1Id.trim() || '—';
  const nextPickup = payload.pickupBranchId || null;
  const nextApprovalDate = payload.approvalDate?.trim() ? payload.approvalDate.trim() : null;
  const nextBankName = payload.bankName.trim();
  const nextBankAccount = payload.bankAccountNumber.trim();
  const nextAppRemarks = payload.applicationRemarks.trim();
  const nextInternalNotes = payload.internalNotes.trim();
  const prevCategory = resolveApplicationCategory(current);
  const prevTaskStatus = deriveTaskStatus(current);
  const nextTaskStatus: TaskStatusState = payload.taskStatus
    ? { ...payload.taskStatus }
    : prevTaskStatus;

  const diffs: { label: string; before: string; after: string }[] = [
    { label: 'CASE ID', before: current.caseId, after: trimmedCaseId },
    { label: 'REF1 ID', before: current.ref1Id || '—', after: nextRef1 },
    { label: 'Customer Name', before: current.customerName, after: payload.customerName.trim() },
    { label: 'IC Number', before: current.icNumber, after: payload.icNumber.trim() },
    { label: 'Phone Number', before: current.phone, after: payload.phone.trim() },
    { label: 'Application Date', before: current.applicationDate, after: payload.applicationDate },
    {
      label: 'Original Branch',
      before: branchLabel(current.customerFromBranchId),
      after: branchLabel(payload.customerFromBranchId),
    },
    {
      label: 'Pickup Branch',
      before: branchLabel(current.pickupBranchId),
      after: branchLabel(nextPickup),
    },
    { label: 'Bank Name', before: current.bankName || '—', after: nextBankName || '—' },
    {
      label: 'Bank Account No.',
      before: current.bankAccountNumber || '—',
      after: nextBankAccount || '—',
    },
    {
      label: 'Application Remarks',
      before: current.applicationRemarks || '—',
      after: nextAppRemarks || '—',
    },
    { label: 'Approval Status', before: current.approvalStatus, after: payload.approvalStatus },
    {
      label: 'Entered By',
      before: staffLabel(current.staffInChargeId),
      after: staffLabel(payload.staffInChargeId),
    },
    {
      label: 'Approval Date',
      before: current.approvalDate || '—',
      after: nextApprovalDate || '—',
    },
    {
      label: 'Internal Notes',
      before: current.internalNotes || '—',
      after: nextInternalNotes || '—',
    },
    { label: 'Category', before: prevCategory, after: payload.category },
    {
      label: 'Products',
      before: productsSummary(current.products),
      after: productsSummary(nextProducts),
    },
    {
      label: 'Total Product Price',
      before: formatRM(current.financing.totalProductPrice),
      after: formatRM(totalProductPrice),
    },
    { label: 'Deposit', before: formatRM(current.financing.deposit), after: formatRM(deposit) },
    {
      label: 'Financing Amount',
      before: formatRM(current.financing.financingAmount),
      after: formatRM(financingAmount),
    },
    {
      label: 'Agreement Fee',
      before: formatRM(current.financing.agreementFee),
      after: formatRM(agreementFee),
    },
    {
      label: 'Processing Fee',
      before: formatRM(current.financing.processingFee),
      after: formatRM(processingFee),
    },
    {
      label: 'SST Amount',
      before: formatRM(current.financing.sstAmount),
      after: formatRM(sstAmount),
    },
    {
      label: 'Stamp Duty Fee',
      before: formatRM(current.financing.stampDutyFee),
      after: formatRM(stampDutyFee),
    },
    {
      label: 'Actual Cash Payment',
      before: formatRM(prevActualCash),
      after: formatRM(actualCashPayment),
    },
    {
      label: 'Installment Duration',
      before: `${current.financing.installmentDuration} Months`,
      after: `${installmentDuration} Months`,
    },
    {
      label: 'Monthly Installment',
      before: formatRM(current.financing.monthlyInstallment),
      after: formatRM(monthlyInstallment),
    },
    {
      label: 'Task Status (Stock Status)',
      before: prevTaskStatus.stockStatus,
      after: nextTaskStatus.stockStatus,
    },
    {
      label: 'Task Status (Customer Decision)',
      before: prevTaskStatus.customerDecision,
      after: nextTaskStatus.customerDecision,
    },
    {
      label: 'Task Status (Collection Confirmation)',
      before: prevTaskStatus.collectionConfirmation,
      after: nextTaskStatus.collectionConfirmation,
    },
    {
      label: 'Task Status (Passed Stock)',
      before: prevTaskStatus.passedStock,
      after: nextTaskStatus.passedStock,
    },
    {
      label: 'Task Status (Agreement Received)',
      before: prevTaskStatus.agreementReceived,
      after: nextTaskStatus.agreementReceived,
    },
    {
      label: 'Task Status (Agreement Checking)',
      before: prevTaskStatus.agreementChecking,
      after: nextTaskStatus.agreementChecking,
    },
    {
      label: 'Task Status (Agreement Submission)',
      before: prevTaskStatus.agreementSubmission,
      after: nextTaskStatus.agreementSubmission,
    },
    {
      label: 'Task Status (Agreement Claimed)',
      before: prevTaskStatus.agreementClaimed,
      after: nextTaskStatus.agreementClaimed,
    },
  ];

  const changed = diffs.filter((d) => d.before !== d.after);
  const changeDetails =
    changed.length > 0
      ? changed.map((d) => `${d.label}: "${d.before}" → "${d.after}"`).join(' | ')
      : 'No field values modified.';

  const event: ActivityEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    caseId: trimmedCaseId,
    customerName: payload.customerName.trim(),
    actionType: 'Information Updated',
    description: `Edited application details (${changed.length} field${
      changed.length === 1 ? '' : 's'
    }): ${changeDetails}`,
    staffName: editorName,
    timestamp: timestampIso,
  };

  const prevFollowUp = deriveStockFollowUp(current);
  const syncedDecision: CustomerStockDecision =
    nextTaskStatus.customerDecision === 'PENDING'
      ? 'PENDING DECISION'
      : nextTaskStatus.customerDecision;

  return {
    ...current,
    caseId: trimmedCaseId,
    ref1Id: nextRef1,
    customerName: payload.customerName.trim(),
    icNumber: payload.icNumber.trim(),
    phone: payload.phone.trim(),
    applicationDate: payload.applicationDate,
    customerFromBranchId: payload.customerFromBranchId,
    pickupBranchId: nextPickup,
    bankName: nextBankName,
    bankAccountNumber: nextBankAccount,
    applicationRemarks: nextAppRemarks,
    approvalStatus: payload.approvalStatus,
    approvalDate: nextApprovalDate,
    staffInChargeId: payload.staffInChargeId,
    internalNotes: nextInternalNotes,
    category: payload.category,
    products: nextProducts,
    financing: {
      totalProductPrice,
      deposit,
      financingAmount,
      agreementFee,
      processingFee,
      sstAmount,
      stampDutyFee,
      actualCashPayment,
      installmentDuration,
      monthlyInstallment,
    },
    stockFollowUp: {
      ...prevFollowUp,
      stockStage: nextTaskStatus.stockStatus,
      customerDecision: syncedDecision,
      collectionConfirmation: nextTaskStatus.collectionConfirmation,
    },
    taskStatus: nextTaskStatus,
    timeline: [event, ...current.timeline],
  };
}

export function deleteApplicationTransition(
  existingApps: InstallmentApplication[],
  appId: string,
): InstallmentApplication[] {
  return existingApps.filter((a) => a.id !== appId);
}

export function resolveActualCashPayment(financing: FinancingInfo): number {
  if (financing.actualCashPayment !== undefined && financing.actualCashPayment !== null) {
    return financing.actualCashPayment;
  }
  return Math.max(
    0,
    financing.financingAmount -
      financing.processingFee -
      financing.sstAmount -
      financing.stampDutyFee,
  );
}

export function isEligibleForSaleSubmission(app: InstallmentApplication): boolean {
  return (
    app.agreement.receivedAt !== null &&
    app.agreement.checkingStatus === 'Checking Passed' &&
    app.agreement.dispatchStatus !== 'Dispatched' &&
    !app.agreement.saleSubmissionId
  );
}

export function generateUniqueSubmissionListId(
  submissionDate: string,
  existingLists: SaleSubmissionList[],
): string {
  const compactDate = (submissionDate || SYSTEM_TODAY_DATE).replace(/[^0-9]/g, '').slice(0, 8) || '20261117';
  const existingIds = new Set(existingLists.map((l) => l.submissionListId.toUpperCase()));
  let seq = 1;
  while (true) {
    const candidate = `SUB-${compactDate}-${String(seq).padStart(3, '0')}`;
    if (!existingIds.has(candidate.toUpperCase())) {
      return candidate;
    }
    seq += 1;
  }
}

export interface CreateSaleSubmissionPayload {
  submissionListId?: string;
  submissionDate: string;
  agreementIds: string[];
  remarks?: string;
}

export function createSaleSubmissionTransition(
  existingApps: InstallmentApplication[],
  existingLists: SaleSubmissionList[],
  payload: CreateSaleSubmissionPayload,
  staffName: string,
  timestampIso: string,
): { submission: SaleSubmissionList; applications: InstallmentApplication[] } {
  const uniqueSelectedIds = Array.from(new Set(payload.agreementIds));
  if (uniqueSelectedIds.length === 0) {
    throw new Error('Please select at least one agreement to create a submission list.');
  }
  if (!payload.submissionDate || !payload.submissionDate.trim()) {
    throw new Error('Submission creation date is required.');
  }

  const selectedApps = uniqueSelectedIds.map((id) => {
    const found = existingApps.find((a) => a.id === id);
    if (!found) {
      throw new Error(`Selected agreement "${id}" was not found.`);
    }
    if (!isEligibleForSaleSubmission(found)) {
      throw new Error(
        `Agreement ${found.caseId} is not eligible for Sale Submission (already submitted or not Checking Passed).`,
      );
    }
    return found;
  });

  const existingIds = new Set(existingLists.map((l) => l.submissionListId.toUpperCase()));
  const requestedId = payload.submissionListId?.trim();
  const submissionListId =
    requestedId && !existingIds.has(requestedId.toUpperCase())
      ? requestedId
      : generateUniqueSubmissionListId(payload.submissionDate, existingLists);

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

  const submission: SaleSubmissionList = {
    id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    submissionListId,
    submissionDate: payload.submissionDate.trim(),
    createdAt: timestampIso,
    createdBy: staffName,
    agreementIds: selectedApps.map((a) => a.id),
    agreementCount: selectedApps.length,
    totalProductAmount,
    totalFinanceAmount,
    totalActualCashPayment,
    remarks: (payload.remarks || '').trim(),
  };

  const selectedIdSet = new Set(uniqueSelectedIds);
  const applications = existingApps.map((app) => {
    if (!selectedIdSet.has(app.id)) return app;
    const event: ActivityEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      caseId: app.caseId,
      customerName: app.customerName,
      actionType: 'Sale Submission Created',
      description: `Included in Sale Submission List ${submissionListId} (${formatDateShort(
        submission.submissionDate,
      )}) by ${staffName}. Actual Cash Payment: ${formatRM(resolveActualCashPayment(app.financing))}.`,
      staffName,
      timestamp: timestampIso,
    };
    return {
      ...app,
      agreement: {
        ...app.agreement,
        saleSubmissionId: submissionListId,
        saleSubmittedAt: timestampIso,
      },
      timeline: [event, ...app.timeline],
    };
  });

  return { submission, applications };
}

export function buildCourierTrackingUrl(courier: string, trackingNumber: string): string {
  const trk = encodeURIComponent(trackingNumber.trim());
  const normalized = courier.trim().toLowerCase();

  if (normalized.includes('j&t') || normalized.includes('jte')) {
    return `https://www.jtexpress.my/tracking/${trk}`;
  }
  if (normalized.includes('poslaju') || normalized.includes('pos laju') || normalized === 'pos') {
    return `https://tracking.pos.com.my/postal-services/quick-access/?track-trace=${trk}`;
  }
  if (normalized.includes('dhl')) {
    return `https://ecommerceportal.dhl.com/track/?locale=en&trackingNumber=${trk}`;
  }
  if (normalized.includes('gdex')) {
    return `https://www.gdexpress.com/malaysia/e-tracking/?consignment=${trk}`;
  }
  if (normalized.includes('ninja')) {
    return `https://www.ninjavan.co/en-my/tracking?id=${trk}`;
  }
  return `https://www.tracking.my/track/${trk}`;
}

export function filterApplicationsByApprovalDateRange(
  apps: InstallmentApplication[],
  startDate?: string,
  endDate?: string,
): InstallmentApplication[] {
  return apps.filter((app) => {
    const targetDate = app.approvalDate || app.applicationDate;
    if (startDate && targetDate < startDate) return false;
    if (endDate && targetDate > endDate) return false;
    return true;
  });
}


