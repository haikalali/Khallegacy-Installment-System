import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFinancingSummary,
  claimAgreementTransition,
  computeBranchApprovalReport,
  computeDashboardMetrics,
  computeSistemRekodReport,
  confirmJclReceiptTransition,
  countApplicationsAddedOnDate,
  countApplicationsCreatedOnDate,
  createNewApplicationTransition,
  createSaleSubmissionTransition,
  DEFAULT_TASK_STATUS,
  deleteApplicationTransition,
  deriveTaskStatus,
  dispatchAgreementTransition,
  generateUniqueSubmissionListId,
  getApprovalListCheckingStatus,
  getApprovalListClaimStatus,
  getApprovalListConfirmedStatus,
  isEligibleForAgreementReceipt,
  isEligibleForClaim,
  isEligibleForSaleSubmission,
  passStockToBranchTransition,
  PRODUCT_CATEGORIES,
  receiveAgreementTransition,
  resolveActualCashPayment,
  resolveApplicationCategory,
  SYSTEM_TODAY_DATE,
  updateApplicationDetailsTransition,
  updateCheckingTransition,
  updateStockFollowUpTransition,
} from './businessRules';
import type { Branch, InstallmentApplication, StaffUser } from '../types/khallegacy';

const BRANCHES: Branch[] = [
  { id: 'br-sa', code: 'SA', name: 'Shah Alam HQ', state: 'Selangor', active: true },
  { id: 'br-jb', code: 'JB', name: 'Johor Bahru', state: 'Johor', active: true },
  { id: 'br-kb', code: 'KB', name: 'Kota Bharu', state: 'Kelantan', active: true },
];

const OPERATOR: StaffUser = {
  id: 'usr-1',
  name: 'Muhammad Haikal',
  username: 'haikal.ops',
  email: 'haikal@khallegacy.com.my',
  branchId: 'br-sa',
  roleId: 'role-manager',
  status: 'Active',
  lastActive: '2026-11-17T09:00:00',
};

function makeApp(overrides: Partial<InstallmentApplication> = {}): InstallmentApplication {
  return {
    id: 'app-1',
    caseId: 'KHL-2026-0001',
    applicationDate: '2026-11-15',
    customerName: 'Ahmad Faizal',
    icNumber: '950101-10-1234',
    phone: '012-3456789',
    address: 'No 12, Jalan Kenanga, Shah Alam',
    ref1Id: 'REF-001',
    customerFromBranchId: 'br-sa',
    pickupBranchId: 'br-jb',
    staffInChargeId: 'usr-1',
    approvalStatus: 'Approved',
    approvalDate: '2026-11-15',
    approvedBy: 'Nurul Huda',
    approvalRemarks: 'Verified',
    products: [
      {
        id: 'p1',
        productName: 'Apple iPhone 16 Pro',
        model: '256GB Desert Titanium',
        quantity: 1,
        productPrice: 4999,
        stockStatus: 'OK',
        datePassStock: '2026-11-16',
      },
    ],
    financing: {
      totalProductPrice: 4999,
      deposit: 500,
      financingAmount: 4499,
      agreementFee: 120,
      processingFee: 80,
      sstAmount: 16,
      stampDutyFee: 10,
      installmentDuration: 24,
      monthlyInstallment: 245,
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
    timeline: [],
    ...overrides,
  };
}

test('Agreement Management eligibility requires ALL products Stock=OK AND Date Pass Stock filled', () => {
  const eligible = makeApp();
  assert.equal(isEligibleForAgreementReceipt(eligible), true);

  // One product missing Date Pass Stock -> NOT eligible
  const missingDate = makeApp({
    products: [
      {
        id: 'p1',
        productName: 'iPhone 16 Pro',
        model: '256GB',
        quantity: 1,
        productPrice: 4999,
        stockStatus: 'OK',
        datePassStock: '2026-11-16',
      },
      {
        id: 'p2',
        productName: 'AirPods Pro 2',
        model: 'USB-C',
        quantity: 1,
        productPrice: 1099,
        stockStatus: 'OK',
        datePassStock: null,
      },
    ],
  });
  assert.equal(isEligibleForAgreementReceipt(missingDate), false);

  // One product Stock Status != OK -> NOT eligible
  const pendingStock = makeApp({
    products: [
      {
        id: 'p1',
        productName: 'iPhone 16 Pro',
        model: '256GB',
        quantity: 1,
        productPrice: 4999,
        stockStatus: 'Pending Stock',
        datePassStock: '2026-11-16',
      },
    ],
  });
  assert.equal(isEligibleForAgreementReceipt(pendingStock), false);
});

test('TERIMA -> Checking -> Dispatch -> JCL Receipt Confirmation lifecycle keeps Dispatch and JCL Confirmation strictly separate', () => {
  const initial = makeApp();

  // Step 1: TERIMA
  const received = receiveAgreementTransition(initial, 'Siti Aminah', '2026-11-17T09:00:00');
  assert.equal(isEligibleForAgreementReceipt(received), false); // removed from pending receipt list
  assert.equal(received.agreement.checkingStatus, 'Pending Checking');
  assert.equal(received.agreement.receivedBy, 'Siti Aminah');

  // Cannot dispatch before Checking Passed
  assert.throws(() =>
    dispatchAgreementTransition(
      received,
      {
        courierId: 'c1',
        courierName: 'J&T Express',
        trackingNumber: 'JT123456789',
        dispatchDate: '2026-11-17',
        dispatchedBy: 'Siti Aminah',
        remarks: '',
      },
      '2026-11-17T10:00:00',
    ),
  );

  // Step 2: Checking Passed (with 4-item checklist + Staff 1 & Staff 2)
  const passed = updateCheckingTransition(
    received,
    'Checking Passed',
    {
      signAndChopPages: true,
      customerSignatureComplete: true,
      invoiceDetails: true,
      cafDetails: true,
    },
    'All documents verified.',
    'Siti Aminah',
    '2026-11-17T10:15:00',
    { staff1: 'Nurul Huda', staff2: 'Muhammad Haikal' },
  );
  assert.equal(passed.agreement.dispatchStatus, 'Ready to Dispatch');
  assert.equal(passed.agreement.checkingStaff1, 'Nurul Huda');
  assert.equal(passed.agreement.checkingStaff2, 'Muhammad Haikal');
  assert.match(passed.timeline[0].description, /STAFF 1: Nurul Huda/);
  assert.match(passed.timeline[0].description, /STAFF 2: Muhammad Haikal/);

  // Step 3: Dispatch to JCL Credit (JCL status MUST remain Pending JCL Confirmation)
  const dispatched = dispatchAgreementTransition(
    passed,
    {
      courierId: 'c1',
      courierName: 'J&T Express',
      trackingNumber: 'JT99887766',
      dispatchDate: '2026-11-17',
      dispatchedBy: 'Hafizuddin',
      remarks: 'Parcel sealed',
    },
    '2026-11-17T14:00:00',
  );
  assert.equal(dispatched.agreement.dispatchStatus, 'Dispatched');
  assert.equal(dispatched.agreement.destination, 'JCL Credit');
  assert.equal(dispatched.agreement.jclReceiptStatus, 'Pending JCL Confirmation');
  assert.equal(dispatched.agreement.jclReceivedDate, null);

  // Step 4: Confirm Received by JCL
  const confirmed = confirmJclReceiptTransition(
    dispatched,
    {
      jclReceivedDate: '2026-11-18',
      confirmedBy: 'Siti Aminah',
      remarks: 'Signed by JCL admin',
    },
    '2026-11-18T11:30:00',
  );
  assert.equal(confirmed.agreement.jclReceiptStatus, 'Received by JCL');
  assert.equal(confirmed.agreement.jclReceivedDate, '2026-11-18');
  assert.equal(confirmed.timeline.length, 4);
});

test('Report A uses customerFromBranchId while Report B uses pickupBranchId with Belum Ditentukan for unassigned', () => {
  const apps: InstallmentApplication[] = [
    // Original: Shah Alam, Pickup: Johor Bahru, Approved
    makeApp({
      id: 'a1',
      caseId: 'KHL-1',
      customerFromBranchId: 'br-sa',
      pickupBranchId: 'br-jb',
      approvalStatus: 'Approved',
      icNumber: '900101-10-0001',
    }),
    // Original: Shah Alam, Pickup: null (unassigned), Approved
    makeApp({
      id: 'a2',
      caseId: 'KHL-2',
      customerFromBranchId: 'br-sa',
      pickupBranchId: null,
      approvalStatus: 'Approved',
      icNumber: '900101-10-0002',
    }),
    // Original: Kota Bharu, Pickup: Johor Bahru, Pending
    makeApp({
      id: 'a3',
      caseId: 'KHL-3',
      customerFromBranchId: 'br-kb',
      pickupBranchId: 'br-jb',
      approvalStatus: 'Pending',
      icNumber: '900101-10-0003',
    }),
  ];

  // Report A: grouped by customerFromBranchId
  const reportA = computeBranchApprovalReport(apps, BRANCHES);
  const saRow = reportA.find((r) => r.branchId === 'br-sa');
  const jbRow = reportA.find((r) => r.branchId === 'br-jb');
  const kbRow = reportA.find((r) => r.branchId === 'br-kb');

  assert.equal(saRow?.totalApplications, 2);
  assert.equal(saRow?.approved, 2);
  assert.equal(jbRow, undefined); // JB had 0 original applications
  assert.equal(kbRow?.pending, 1);

  // Report B: Approved only, grouped by pickupBranchId, null -> Belum Ditentukan
  const reportB = computeSistemRekodReport(apps, BRANCHES);
  const jbPickup = reportB.find((r) => r.pickupBranchId === 'br-jb');
  const unassignedPickup = reportB.find((r) => r.pickupBranchName === 'Belum Ditentukan');

  assert.equal(jbPickup?.totalApprovedApplications, 1); // only a1 (a3 is Pending)
  assert.equal(unassignedPickup?.totalApprovedApplications, 1); // a2
  assert.equal(
    reportB.reduce((sum, r) => sum + r.totalApprovedApplications, 0),
    2,
  ); // zero duplication
});

test('Dashboard metrics accurately reflect counts across stages', () => {
  const apps = [makeApp({ id: '1' }), makeApp({ id: '2', approvalStatus: 'Pending' })];
  const metrics = computeDashboardMetrics(apps);
  assert.equal(metrics.totalApplications, 2);
  assert.equal(metrics.approvedApplications, 1);
  assert.equal(metrics.pendingApproval, 1);
  assert.equal(metrics.agreementToBeReceived, 1);
});

test('New Application financing formula & creation validates uniqueness, deposit, and stamp duty', () => {
  const calc = calculateFinancingSummary({
    products: [
      { quantity: 1, unitPrice: 5000 },
      { quantity: 2, unitPrice: 250 },
    ],
    deposit: 500,
    agreementFee: 88,
    processingFee: 50,
    sstAmount: 4,
  });

  // Total 5500 - 500 = 5000 financing; stamp duty ceil(5000/1000)*5 = 25; actual cash = 5000 - 50 - 4 - 25 = 4921
  assert.equal(calc.totalProductPrice, 5500);
  assert.equal(calc.totalUnits, 3);
  assert.equal(calc.financingAmount, 5000);
  assert.equal(calc.stampDutyFee, 25);
  assert.equal(calc.actualCashPayment, 4921);
  assert.equal(calc.monthlyInstallment, Math.round((5000 * 1.18) / 24));

  const calcManual = calculateFinancingSummary({
    products: [{ quantity: 1, unitPrice: 5000 }],
    deposit: 500,
    agreementFee: 88,
    processingFee: 50,
    sstAmount: 4,
    installmentDuration: 24,
    monthlyInstallmentOverride: 215,
  });
  assert.equal(calcManual.monthlyInstallment, 215);

  const existing = [makeApp({ caseId: 'KHL-2026-0001' })];

  // Duplicate CASE ID rejected
  assert.throws(() =>
    createNewApplicationTransition(
      existing,
      {
        caseId: 'KHL-2026-0001',
        customerName: 'Nadia Amira',
        icNumber: '980202-10-4455',
        phone: '012-9988776',
        ref1Id: '',
        customerFromBranchId: 'br-sa',
        pickupBranchId: null,
        applicationDate: '2026-11-17',
        bankName: 'Maybank',
        bankAccountNumber: '164012345678',
        applicationRemarks: '',
        internalNotes: '',
        products: [{ productName: 'iPhone 16', quantity: 1, unitPrice: 3999 }],
        deposit: 0,
        agreementFee: 88,
        processingFee: 50,
        sstAmount: 4,
        stampDutyFee: 20,
        actualCashPayment: 3925,
      },
      OPERATOR,
      '2026-11-17T10:00:00',
    ),
  );

  // Valid creation produces Approved application by default
  const created = createNewApplicationTransition(
    existing,
    {
      caseId: 'KHL-2026-0999',
      customerName: 'Nadia Amira',
      icNumber: '980202-10-4455',
      phone: '012-9988776',
      ref1Id: 'REF-999',
      customerFromBranchId: 'br-sa',
      pickupBranchId: 'br-jb',
      applicationDate: '2026-11-17',
      bankName: 'Maybank',
      bankAccountNumber: '164012345678',
      applicationRemarks: 'Urgent',
      internalNotes: 'Payslip attached',
      products: [{ productName: 'iPhone 16 Pro', quantity: 1, unitPrice: 4999 }],
      deposit: 499,
      agreementFee: 88,
      processingFee: 50,
      sstAmount: 4,
      stampDutyFee: 25,
      actualCashPayment: 4421,
      monthlyInstallment: 210,
    },
    OPERATOR,
    '2026-11-17T10:00:00',
  );
  assert.equal(created.approvalStatus, 'Approved');
  assert.equal(created.approvalDate, '2026-11-17');
  assert.equal(created.approvedBy, OPERATOR.name);
  assert.equal(created.caseId, 'KHL-2026-0999');
  assert.equal(created.financing.actualCashPayment, 4421);
  assert.equal(created.financing.monthlyInstallment, 210);
  assert.equal(created.timeline.length, 1);
  assert.equal(countApplicationsAddedOnDate([created, ...existing], SYSTEM_TODAY_DATE), 1);
  assert.equal(countApplicationsCreatedOnDate([created, ...existing], '2026-11-17'), 1);
  assert.equal(countApplicationsCreatedOnDate([created, ...existing], '2026-11-20'), 0);

  const createdTodayBackdated = createNewApplicationTransition(
    [created, ...existing],
    {
      caseId: 'KHL-2026-1000',
      customerName: 'Aina Sofea',
      icNumber: '990101-01-1234',
      phone: '012-3456789',
      ref1Id: 'REF-100',
      customerFromBranchId: 'br-sa',
      pickupBranchId: 'br-sa',
      applicationDate: '2026-11-10',
      bankName: 'Maybank',
      bankAccountNumber: '1234567890',
      applicationRemarks: '',
      internalNotes: '',
      products: [{ productName: 'iPhone 17', model: 'Black', quantity: 1, unitPrice: 4000 }],
      deposit: 0,
      agreementFee: 88,
      processingFee: 50,
      sstAmount: 4,
      stampDutyFee: 25,
      actualCashPayment: 167,
      monthlyInstallment: 200,
    },
    OPERATOR,
    '2026-11-20T09:30:00',
  );
  assert.equal(countApplicationsCreatedOnDate([createdTodayBackdated, created, ...existing], '2026-11-20'), 1);
});

test('Stock Management follow-up validates cancellation remarks, logs field changes, and Pass Stock unlocks TERIMA', () => {
  const approvedPendingStock = makeApp({
    approvalStatus: 'Approved',
    products: [
      {
        id: 'p1',
        productName: 'iPhone 17 Pro 256GB',
        model: 'Desert Titanium',
        quantity: 1,
        productPrice: 5499,
        stockStatus: 'Pending Stock',
        datePassStock: null,
      },
    ],
    stockFollowUp: {
      colour: 'Desert Titanium',
      stockStage: 'NOT YET CHECKING',
      customerDecision: 'PENDING DECISION',
      collectionConfirmation: 'PENDING',
      remark: 'Awaiting check',
      changes: [],
    },
  });

  // Not yet eligible for TERIMA
  assert.equal(isEligibleForAgreementReceipt(approvedPendingStock), false);

  // Cancellation without remark fails
  assert.throws(() =>
    updateStockFollowUpTransition(
      approvedPendingStock,
      {
        customerFromBranchId: 'br-sa',
        pickupBranchId: 'br-jb',
        colour: 'Desert Titanium',
        stockStage: 'NO STOCK',
        customerDecision: 'CANCELLED',
        collectionConfirmation: 'CONFIRMED',
        datePassStock: null,
        remark: '   ',
      },
      BRANCHES,
      OPERATOR.name,
      '2026-11-17T11:00:00',
    ),
  );

  // Update to READY + ACCEPT + CONFIRMED (no date yet)
  const readyConfirmed = updateStockFollowUpTransition(
    approvedPendingStock,
    {
      customerFromBranchId: 'br-sa',
      pickupBranchId: 'br-jb',
      colour: 'Natural Titanium',
      stockStage: 'READY',
      customerDecision: 'ACCEPT',
      collectionConfirmation: 'CONFIRMED',
      datePassStock: null,
      remark: 'Customer agreed to Natural Titanium',
    },
    BRANCHES,
    OPERATOR.name,
    '2026-11-17T11:05:00',
  );
  assert.equal(readyConfirmed.stockFollowUp?.changes.length, 5);
  assert.equal(isEligibleForAgreementReceipt(readyConfirmed), false); // still missing Date Pass Stok

  // Pass Stock unlocks TERIMA eligibility
  const passed = passStockToBranchTransition(
    readyConfirmed,
    '2026-11-17',
    OPERATOR.name,
    '2026-11-17T11:10:00',
  );
  assert.equal(passed.products[0].stockStatus, 'OK');
  assert.equal(passed.products[0].datePassStock, '2026-11-17');
  assert.equal(isEligibleForAgreementReceipt(passed), true);
});

test('Approval List status helpers derive Status Confirmed, Status Checking, and Status Claim across workflow stages', () => {
  const pendingApp = makeApp({
    approvalStatus: 'Pending',
    approvalDate: null,
    approvedBy: null,
  });
  assert.equal(getApprovalListConfirmedStatus(pendingApp), 'Pending Approval');
  assert.equal(getApprovalListCheckingStatus(pendingApp), 'Not Received');
  assert.equal(getApprovalListClaimStatus(pendingApp), 'Not Ready');

  const rejectedApp = makeApp({
    approvalStatus: 'Rejected',
    approvalDate: '2026-11-12',
  });
  assert.equal(getApprovalListConfirmedStatus(rejectedApp), 'Rejected');
  assert.equal(getApprovalListCheckingStatus(rejectedApp), '—');
  assert.equal(getApprovalListClaimStatus(rejectedApp), '—');

  const approvedUnconfirmed = makeApp({
    approvalStatus: 'Approved',
    products: [
      {
        id: 'p1',
        productName: 'iPhone 16',
        model: 'Black',
        quantity: 1,
        productPrice: 3999,
        stockStatus: 'Pending Stock',
        datePassStock: null,
      },
    ],
  });
  assert.equal(getApprovalListConfirmedStatus(approvedUnconfirmed), 'Pending');
  assert.equal(getApprovalListCheckingStatus(approvedUnconfirmed), 'Not Received');
  assert.equal(getApprovalListClaimStatus(approvedUnconfirmed), 'Not Ready');

  const readyToClaim = makeApp({
    approvalStatus: 'Approved',
    agreement: {
      ...makeApp().agreement,
      receivedAt: '2026-11-16T10:00:00',
      checkingStatus: 'Checking Passed',
      dispatchStatus: 'Ready to Dispatch',
    },
  });
  assert.equal(getApprovalListConfirmedStatus(readyToClaim), 'Confirmed');
  assert.equal(getApprovalListCheckingStatus(readyToClaim), 'Checking Passed');
  assert.equal(getApprovalListClaimStatus(readyToClaim), 'Ready to Claim');

  const dispatchedPendingJcl = makeApp({
    approvalStatus: 'Approved',
    agreement: {
      ...readyToClaim.agreement,
      dispatchStatus: 'Dispatched',
      jclReceiptStatus: 'Pending JCL Confirmation',
    },
  });
  assert.equal(getApprovalListClaimStatus(dispatchedPendingJcl), 'Pending JCL');

  const claimedByJcl = makeApp({
    approvalStatus: 'Approved',
    agreement: {
      ...dispatchedPendingJcl.agreement,
      jclReceiptStatus: 'Received by JCL',
    },
  });
  assert.equal(getApprovalListClaimStatus(claimedByJcl), 'Claimed');
});

test('PRODUCT_CATEGORIES and resolveApplicationCategory resolve Apple, Android, Game&Console, and Home Appliance', () => {
  assert.deepEqual(PRODUCT_CATEGORIES, [
    'Apple',
    'Android',
    'Game&Console',
    'Home Appliance',
  ]);

  assert.equal(
    resolveApplicationCategory({
      products: [
        {
          id: 'p1',
          productName: 'Apple iPhone 16 Pro 256GB',
          model: 'Desert Titanium',
          quantity: 1,
          productPrice: 4999,
          stockStatus: 'OK',
          datePassStock: null,
        },
      ],
    }),
    'Apple',
  );

  assert.equal(
    resolveApplicationCategory({
      products: [
        {
          id: 'p2',
          productName: 'Samsung Galaxy S25 256GB',
          model: 'Navy',
          quantity: 1,
          productPrice: 4199,
          stockStatus: 'OK',
          datePassStock: null,
        },
      ],
    }),
    'Android',
  );

  assert.equal(
    resolveApplicationCategory({
      products: [
        {
          id: 'p3',
          productName: 'Sony PlayStation 5 Slim 1TB',
          model: 'White',
          quantity: 1,
          productPrice: 2499,
          stockStatus: 'Pending Stock',
          datePassStock: null,
        },
      ],
    }),
    'Game&Console',
  );

  assert.equal(
    resolveApplicationCategory({
      category: 'Home Appliance',
      products: [
        {
          id: 'p4',
          productName: 'Custom Package',
          model: 'Silver',
          quantity: 1,
          productPrice: 2899,
          stockStatus: 'OK',
          datePassStock: null,
        },
      ],
    }),
    'Home Appliance',
  );

  const created = createNewApplicationTransition(
    [],
    {
      caseId: 'KHL-2026-9901',
      customerName: 'Nadia Salleh',
      icNumber: '950101-10-5001',
      phone: '012-3456789',
      ref1Id: 'REF-9901',
      customerFromBranchId: 'br-sa',
      pickupBranchId: 'br-jb',
      applicationDate: '2026-11-17',
      bankName: 'Maybank',
      bankAccountNumber: '1122334455',
      applicationRemarks: 'Console order',
      internalNotes: '',
      category: 'Game&Console',
      products: [{ productName: 'Nintendo Switch OLED', model: 'White', quantity: 1, unitPrice: 1599 }],
      deposit: 199,
      agreementFee: 88,
      processingFee: 50,
      sstAmount: 4,
      stampDutyFee: 10,
      actualCashPayment: 1336,
    },
    OPERATOR,
    '2026-11-17T10:00:00',
  );

  assert.equal(created.category, 'Game&Console');
  assert.equal(resolveApplicationCategory(created), 'Game&Console');
});

test('updateApplicationDetailsTransition logs every edited detail into Activity Timeline and deleteApplicationTransition removes record', () => {
  const baseApp = makeApp({
    id: 'app-edit-1',
    caseId: 'KHL-2026-8801',
    customerName: 'Ahmad Faiz',
    phone: '012-1112222',
    bankName: 'Maybank',
    bankAccountNumber: '111122223333',
    applicationRemarks: 'Initial remark',
    internalNotes: 'Initial note',
    category: 'Apple',
  });
  const secondApp = makeApp({ id: 'app-edit-2', caseId: 'KHL-2026-8802' });

  // Reject duplicate CASE ID
  assert.throws(() =>
    updateApplicationDetailsTransition(
      [baseApp, secondApp],
      baseApp.id,
      {
        caseId: 'KHL-2026-8802',
        customerName: baseApp.customerName,
        icNumber: baseApp.icNumber,
        phone: baseApp.phone,
        ref1Id: baseApp.ref1Id,
        applicationDate: baseApp.applicationDate,
        customerFromBranchId: baseApp.customerFromBranchId,
        pickupBranchId: baseApp.pickupBranchId,
        bankName: baseApp.bankName || '',
        bankAccountNumber: baseApp.bankAccountNumber || '',
        applicationRemarks: baseApp.applicationRemarks || '',
        approvalStatus: baseApp.approvalStatus,
        approvalDate: baseApp.approvalDate,
        staffInChargeId: baseApp.staffInChargeId,
        internalNotes: baseApp.internalNotes || '',
        category: 'Apple',
        products: baseApp.products.map((p) => ({
          id: p.id,
          productName: p.productName,
          model: p.model,
          quantity: p.quantity,
          unitPrice: p.productPrice,
        })),
        deposit: baseApp.financing.deposit,
        agreementFee: baseApp.financing.agreementFee,
        processingFee: baseApp.financing.processingFee,
        sstAmount: baseApp.financing.sstAmount,
        stampDutyFee: baseApp.financing.stampDutyFee,
        actualCashPayment: baseApp.financing.actualCashPayment ?? 0,
        installmentDuration: baseApp.financing.installmentDuration,
        monthlyInstallment: baseApp.financing.monthlyInstallment,
      },
      BRANCHES,
      [OPERATOR],
      OPERATOR.name,
      '2026-11-18T09:00:00',
    ),
  );

  const updated = updateApplicationDetailsTransition(
    [baseApp, secondApp],
    baseApp.id,
    {
      caseId: 'KHL-2026-8801',
      customerName: 'Ahmad Faiz Bin Omar',
      icNumber: baseApp.icNumber,
      phone: '019-9998888',
      ref1Id: 'REF-8801-NEW',
      applicationDate: baseApp.applicationDate,
      customerFromBranchId: 'br-jb',
      pickupBranchId: 'POSTAGE',
      bankName: 'CIMB',
      bankAccountNumber: '999988887777',
      applicationRemarks: 'Updated delivery remark',
      approvalStatus: 'Approved',
      approvalDate: '2026-11-18',
      staffInChargeId: OPERATOR.id,
      internalNotes: 'Updated counter note',
      category: 'Game&Console',
      products: [
        {
          id: baseApp.products[0].id,
          productName: 'Sony PlayStation 5 Pro',
          model: '2TB White',
          quantity: 1,
          unitPrice: 3800,
        },
      ],
      deposit: 500,
      agreementFee: 88,
      processingFee: 50,
      sstAmount: 4,
      stampDutyFee: 20,
      actualCashPayment: 3226,
      installmentDuration: 24,
      monthlyInstallment: 162,
    },
    BRANCHES,
    [OPERATOR],
    OPERATOR.name,
    '2026-11-18T09:05:00',
  );

  assert.equal(updated.customerName, 'Ahmad Faiz Bin Omar');
  assert.equal(updated.category, 'Game&Console');
  assert.equal(updated.financing.financingAmount, 3300);
  assert.equal(updated.timeline[0].actionType, 'Information Updated');
  assert.match(updated.timeline[0].description, /Customer Name: "Ahmad Faiz" → "Ahmad Faiz Bin Omar"/);
  assert.match(updated.timeline[0].description, /Phone Number: "012-1112222" → "019-9998888"/);
  assert.match(updated.timeline[0].description, /Bank Name: "Maybank" → "CIMB"/);
  assert.match(updated.timeline[0].description, /Category: "Apple" → "Game&Console"/);
  assert.match(updated.timeline[0].description, /Internal Notes: "Initial note" → "Updated counter note"/);

  const remaining = deleteApplicationTransition([updated, secondApp], updated.id);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, secondApp.id);
});

test('Section G Task Status defaults and edits are tracked and logged in Activity Timeline', () => {
  const created = createNewApplicationTransition(
    [],
    {
      caseId: 'KHL-2026-9950',
      customerName: 'Farah Nadia',
      icNumber: '960404-10-4455',
      phone: '013-2223344',
      ref1Id: 'REF-9950',
      customerFromBranchId: 'br-sa',
      pickupBranchId: 'br-jb',
      applicationDate: '2026-11-18',
      bankName: 'Maybank',
      bankAccountNumber: '1122334455',
      applicationRemarks: '',
      internalNotes: '',
      category: 'Apple',
      products: [{ productName: 'iPhone 16', model: 'Black', quantity: 1, unitPrice: 3999 }],
      deposit: 399,
      agreementFee: 100,
      processingFee: 80,
      sstAmount: 10,
      stampDutyFee: 20,
      actualCashPayment: 3490,
    },
    OPERATOR,
    '2026-11-18T10:00:00',
  );

  const initialTask = deriveTaskStatus(created);
  assert.deepEqual(initialTask, DEFAULT_TASK_STATUS);
  assert.equal(initialTask.stockStatus, 'NOT YET CHECKING');
  assert.equal(initialTask.customerDecision, 'PENDING');
  assert.equal(initialTask.collectionConfirmation, 'PENDING');
  assert.equal(initialTask.passedStock, 'NOT YET');
  assert.equal(initialTask.agreementReceived, 'PENDING');
  assert.equal(initialTask.agreementChecking, 'PENDING');
  assert.equal(initialTask.agreementSubmission, 'PENDING');
  assert.equal(initialTask.agreementClaimed, 'PENDING');

  const edited = updateApplicationDetailsTransition(
    [created],
    created.id,
    {
      caseId: created.caseId,
      customerName: created.customerName,
      icNumber: created.icNumber,
      phone: created.phone,
      ref1Id: created.ref1Id,
      applicationDate: created.applicationDate,
      customerFromBranchId: created.customerFromBranchId,
      pickupBranchId: created.pickupBranchId,
      bankName: created.bankName || '',
      bankAccountNumber: created.bankAccountNumber || '',
      applicationRemarks: created.applicationRemarks || '',
      approvalStatus: created.approvalStatus,
      approvalDate: created.approvalDate,
      staffInChargeId: created.staffInChargeId,
      internalNotes: created.internalNotes || '',
      category: 'Apple',
      products: created.products.map((p) => ({
        id: p.id,
        productName: p.productName,
        model: p.model,
        quantity: p.quantity,
        unitPrice: p.productPrice,
      })),
      deposit: created.financing.deposit,
      agreementFee: created.financing.agreementFee,
      processingFee: created.financing.processingFee,
      sstAmount: created.financing.sstAmount,
      stampDutyFee: created.financing.stampDutyFee,
      actualCashPayment: created.financing.actualCashPayment ?? 0,
      installmentDuration: created.financing.installmentDuration,
      monthlyInstallment: created.financing.monthlyInstallment,
      taskStatus: {
        stockStatus: 'READY',
        customerDecision: 'ACCEPT',
        collectionConfirmation: 'CONFIRMED',
        passedStock: 'PASSED',
        agreementReceived: 'RECEIVED',
        agreementChecking: 'PASSED',
        agreementSubmission: 'OUT FOR DELIVERY',
        agreementClaimed: 'CLAIMED',
      },
    },
    BRANCHES,
    [OPERATOR],
    OPERATOR.name,
    '2026-11-18T10:15:00',
  );

  const afterTask = deriveTaskStatus(edited);
  assert.equal(afterTask.stockStatus, 'READY');
  assert.equal(afterTask.passedStock, 'PASSED');
  assert.equal(afterTask.agreementSubmission, 'OUT FOR DELIVERY');
  assert.equal(afterTask.agreementClaimed, 'CLAIMED');
  assert.match(
    edited.timeline[0].description,
    /Task Status \(Stock Status\): "NOT YET CHECKING" → "READY"/,
  );
  assert.match(
    edited.timeline[0].description,
    /Task Status \(Passed Stock\): "NOT YET" → "PASSED"/,
  );
  assert.match(
    edited.timeline[0].description,
    /Task Status \(Agreement Submission\): "PENDING" → "OUT FOR DELIVERY"/,
  );
  assert.match(
    edited.timeline[0].description,
    /Task Status \(Agreement Claimed\): "PENDING" → "CLAIMED"/,
  );

  const withSubmission = makeApp({
    id: 'postage-sync-app',
    agreement: {
      ...makeApp().agreement,
      receivedAt: '2026-11-16T09:00:00',
      checkingStatus: 'Checking Passed',
      saleSubmissionId: 'SUB-20261118-001',
    },
  });
  assert.equal(
    deriveTaskStatus(withSubmission, [
      {
        id: 'post-1',
        date: '2026-11-18',
        description: 'Batch JCL',
        saleSubmissionId: 'SUB-20261118-001',
        trackingNumber: 'JT123456MY',
        courier: 'J&T Express',
        status: 'IN TRANSIT',
        updatedAt: '2026-11-18T11:00:00',
        updatedBy: OPERATOR.name,
      },
    ]).agreementSubmission,
    'IN TRANSIT',
  );
  assert.equal(
    deriveTaskStatus(withSubmission, [
      {
        id: 'post-1',
        date: '2026-11-18',
        description: 'Batch JCL',
        saleSubmissionId: 'SUB-20261118-001',
        trackingNumber: 'JT123456MY',
        courier: 'J&T Express',
        status: 'FAILED / RETURNED',
        updatedAt: '2026-11-18T11:30:00',
        updatedBy: OPERATOR.name,
      },
    ]).agreementSubmission,
    'FAILED/RETURNED',
  );
});

test('Sale Submission eligibility, unique ID generation, and Create Submission List transition', () => {
  const readyA = makeApp({
    id: 'sub-a',
    caseId: 'KHL-2026-7101',
    financing: {
      totalProductPrice: 5000,
      deposit: 500,
      financingAmount: 4500,
      agreementFee: 88,
      processingFee: 50,
      sstAmount: 4,
      stampDutyFee: 25,
      installmentDuration: 24,
      monthlyInstallment: 221,
    },
    agreement: {
      ...makeApp().agreement,
      receivedAt: '2026-11-16T09:00:00',
      checkingStatus: 'Checking Passed',
      dispatchStatus: 'Ready to Dispatch',
    },
  });
  const readyB = makeApp({
    id: 'sub-b',
    caseId: 'KHL-2026-7102',
    financing: {
      totalProductPrice: 3000,
      deposit: 300,
      financingAmount: 2700,
      agreementFee: 88,
      processingFee: 50,
      sstAmount: 4,
      stampDutyFee: 15,
      actualCashPayment: 2631,
      installmentDuration: 24,
      monthlyInstallment: 133,
    },
    agreement: {
      ...makeApp().agreement,
      receivedAt: '2026-11-16T09:30:00',
      checkingStatus: 'Checking Passed',
      dispatchStatus: 'Ready to Dispatch',
    },
  });
  const notChecked = makeApp({
    id: 'sub-c',
    caseId: 'KHL-2026-7103',
    agreement: {
      ...makeApp().agreement,
      receivedAt: '2026-11-16T10:00:00',
      checkingStatus: 'Pending Checking',
      dispatchStatus: 'Not Ready',
    },
  });

  // Fallback actualCashPayment calculation when actualCashPayment is undefined
  assert.equal(resolveActualCashPayment(readyA.financing), 4500 - 50 - 4 - 25);
  assert.equal(resolveActualCashPayment(readyB.financing), 2631);

  assert.equal(isEligibleForSaleSubmission(readyA), true);
  assert.equal(isEligibleForSaleSubmission(readyB), true);
  assert.equal(isEligibleForSaleSubmission(notChecked), false);

  const firstId = generateUniqueSubmissionListId('2026-11-17', []);
  assert.equal(firstId, 'SUB-20261117-001');

  const { submission, applications: afterFirst } = createSaleSubmissionTransition(
    [readyA, readyB, notChecked],
    [],
    {
      submissionListId: firstId,
      submissionDate: '2026-11-17',
      agreementIds: ['sub-a', 'sub-b'],
      remarks: 'Batch 1 ready',
    },
    OPERATOR.name,
    '2026-11-17T16:00:00',
  );

  assert.equal(submission.submissionListId, 'SUB-20261117-001');
  assert.equal(submission.agreementCount, 2);
  assert.equal(submission.totalProductAmount, 8000);
  assert.equal(submission.totalFinanceAmount, 7200);
  assert.equal(submission.totalActualCashPayment, 4421 + 2631);

  // Selected agreements are no longer eligible for Sale Submission, and timeline is logged
  const updatedA = afterFirst.find((a) => a.id === 'sub-a')!;
  const updatedB = afterFirst.find((a) => a.id === 'sub-b')!;
  assert.equal(isEligibleForSaleSubmission(updatedA), false);
  assert.equal(isEligibleForSaleSubmission(updatedB), false);
  assert.equal(updatedA.agreement.saleSubmissionId, 'SUB-20261117-001');
  assert.equal(updatedA.timeline[0].actionType, 'Sale Submission Created');

  // Next auto-generated ID is guaranteed unique
  const secondId = generateUniqueSubmissionListId('2026-11-17', [submission]);
  assert.equal(secondId, 'SUB-20261117-002');
});

test('Claim Management To Be Claimed eligibility and claimAgreementTransition', () => {
  const submitted = makeApp({
    id: 'claim-1',
    caseId: 'KHL-2026-8801',
    agreement: {
      ...makeApp().agreement,
      receivedAt: '2026-11-16T09:00:00',
      checkingStatus: 'Checking Passed',
      saleSubmissionId: 'SUB-20261117-001',
      jclReceiptStatus: 'Not Dispatched',
    },
  });
  const notSubmitted = makeApp({
    id: 'claim-2',
    caseId: 'KHL-2026-8802',
    agreement: {
      ...makeApp().agreement,
      receivedAt: '2026-11-16T09:00:00',
      checkingStatus: 'Checking Passed',
      dispatchStatus: 'Ready to Dispatch',
    },
  });

  assert.equal(isEligibleForClaim(submitted), true);
  assert.equal(isEligibleForClaim(notSubmitted), false);

  const claimed = claimAgreementTransition(
    submitted,
    {
      claimDate: '2026-11-18',
      claimedBy: OPERATOR.name,
      remarks: 'Payout cleared via JCL portal',
    },
    '2026-11-18T14:00:00',
  );

  assert.equal(isEligibleForClaim(claimed), false);
  assert.equal(claimed.agreement.jclReceiptStatus, 'Received by JCL');
  assert.equal(claimed.agreement.jclReceivedDate, '2026-11-18');
  assert.equal(deriveTaskStatus(claimed).agreementClaimed, 'CLAIMED');
  assert.equal(getApprovalListClaimStatus(claimed), 'Claimed');
  assert.equal(claimed.timeline[0].actionType, 'Agreement Claimed');
});
