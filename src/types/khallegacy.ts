export type PageId =
  | 'dashboard'
  | 'new-application'
  | 'approval-list'
  | 'approval-details'
  | 'stock-management'
  | 'agreement-management'
  | 'agreement-checking'
  | 'sale-submission'
  | 'postage-management'
  | 'agreement-history'
  | 'to-be-claimed'
  | 'claimed-history'
  | 'reports-analytics'
  | 'backup-data'
  | 'user-permissions'
  | 'system-settings';

export type PermissionKey =
  | 'view_dashboard'
  | 'create_application'
  | 'view_approval_list'
  | 'manage_stock'
  | 'manage_agreement'
  | 'receive_agreement'
  | 'perform_checking'
  | 'sale_submission'
  | 'manage_postage'
  | 'view_agreement_history'
  | 'manage_to_be_claimed'
  | 'view_claimed_history'
  | 'dispatch_agreement'
  | 'view_reports'
  | 'export_reports'
  | 'manage_users'
  | 'manage_staff_permissions'
  | 'manage_settings'
  | 'key_in_product_pricing';

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';
export type StockStatus = 'OK' | 'Pending Stock' | 'Out of Stock';
export type ProductCategory = 'Apple' | 'Android' | 'Game&Console' | 'Home Appliance';

export type StockWorkflowStage =
  | 'NOT YET CHECKING'
  | 'READY'
  | 'NO STOCK'
  | 'IN TRANSIT'
  | 'STOK OTW';

export type CustomerStockDecision =
  | 'PENDING DECISION'
  | 'ACCEPT'
  | 'WAIT ORIGINAL COLOUR'
  | 'WAIT ALTERNATIVE COLOUR'
  | 'CANCELLED';

export type CollectionConfirmationStatus = 'PENDING' | 'CONFIRMED';

export interface StockChangeEntry {
  id: string;
  field: string;
  before: string;
  after: string;
  timestamp: string;
  staffName: string;
}

export type CheckingStatus =
  | 'Not Received'
  | 'Pending Checking'
  | 'Checking in Progress'
  | 'Checking Passed'
  | 'Checking Failed';

export type DispatchStatus = 'Not Ready' | 'Ready to Dispatch' | 'Dispatched';
export type JclReceiptStatus = 'Not Dispatched' | 'Pending JCL Confirmation' | 'Received by JCL';

export type TaskStockStatus =
  | 'NOT YET CHECKING'
  | 'READY'
  | 'NO STOCK'
  | 'IN TRANSIT'
  | 'STOK OTW';

export type TaskCustomerDecision =
  | 'PENDING'
  | 'ACCEPT'
  | 'WAIT ORIGINAL COLOUR'
  | 'WAIT ALTERNATIVE COLOUR'
  | 'CANCELLED';

export type TaskCollectionConfirmation = 'PENDING' | 'CONFIRMED';
export type TaskPassedStockStatus = 'NOT YET' | 'PASSED';
export type TaskAgreementReceivedStatus = 'PENDING' | 'RECEIVED';
export type TaskAgreementCheckingStatus = 'PENDING' | 'IN PROGRESS' | 'PASSED' | 'FAILED';
export type TaskAgreementSubmissionStatus =
  | 'PENDING'
  | 'IN TRANSIT'
  | 'OUT FOR DELIVERY'
  | 'DELIVERED'
  | 'FAILED/RETURNED';
export type TaskAgreementClaimedStatus = 'PENDING' | 'PENDING JCL' | 'CLAIMED';

export interface TaskStatusState {
  stockStatus: TaskStockStatus;
  customerDecision: TaskCustomerDecision;
  collectionConfirmation: TaskCollectionConfirmation;
  passedStock: TaskPassedStockStatus;
  agreementReceived: TaskAgreementReceivedStatus;
  agreementChecking: TaskAgreementCheckingStatus;
  agreementSubmission: TaskAgreementSubmissionStatus;
  agreementClaimed: TaskAgreementClaimedStatus;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  state: string;
  active: boolean;
  branchType?: 'PHYSICAL' | 'POSTAGE' | 'WEB' | 'AGENT';
}

export interface Courier {
  id: string;
  name: string;
  code: string;
  active: boolean;
  trackingUrl?: string;
}

export interface RoleConfig {
  id: string;
  name: string;
  description: string;
  active: boolean;
  permissions: PermissionKey[];
}

export interface StaffUser {
  id: string;
  name: string;
  username: string;
  email: string;
  password?: string;
  branchId: string;
  roleId: string;
  status: 'Active' | 'Inactive';
  lastActive: string;
}

export interface ProductItem {
  id: string;
  productName: string;
  model: string;
  quantity: number;
  productPrice: number;
  stockStatus: StockStatus;
  datePassStock: string | null;
}

export interface FinancingInfo {
  totalProductPrice: number;
  deposit: number;
  financingAmount: number;
  agreementFee: number;
  processingFee: number;
  sstAmount: number;
  stampDutyFee: number;
  actualCashPayment?: number;
  installmentDuration: number; // months
  monthlyInstallment: number;
}

export interface DocumentItem {
  id: string;
  name: string;
  category: string;
  uploadDate: string;
  fileSize: string;
  fileType: 'PDF' | 'JPG' | 'PNG';
  summary: string;
}

export interface CheckingChecklist {
  signAndChopPages: boolean;
  customerSignatureComplete: boolean;
  invoiceDetails: boolean;
  cafDetails: boolean;
}

export interface AgreementState {
  agreementNumber: string | null;
  receivedAt: string | null;
  receivedBy: string | null;
  checkingStatus: CheckingStatus;
  checkedAt: string | null;
  checkedBy: string | null;
  checkingChecklist: CheckingChecklist;
  checkingStaff1?: string;
  checkingStaff2?: string;
  invoiceNumber?: string;
  checkingRemarks: string;
  saleSubmissionId?: string | null;
  saleSubmittedAt?: string | null;
  dispatchStatus: DispatchStatus;
  destination: 'JCL Credit';
  courierId: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  dispatchDate: string | null;
  dispatchedBy: string | null;
  dispatchRemarks: string;
  jclReceiptStatus: JclReceiptStatus;
  jclReceivedDate: string | null;
  jclConfirmedBy: string | null;
  jclRemarks: string;
  claimedDate?: string | null;
  claimedBy?: string | null;
  claimRemarks?: string;
}

export interface ActivityEvent {
  id: string;
  caseId: string;
  customerName: string;
  actionType:
    | 'Application Created'
    | 'Information Updated'
    | 'Application Approved'
    | 'Application Rejected'
    | 'Stock Updated'
    | 'Stock Passed'
    | 'Agreement Received'
    | 'Checking Started'
    | 'Checking Passed'
    | 'Checking Failed'
    | 'Sale Submission Created'
    | 'Agreement Dispatched'
    | 'Tracking Updated'
    | 'JCL Receipt Confirmed'
    | 'Agreement Claimed';
  description: string;
  staffName: string;
  timestamp: string; // ISO string YYYY-MM-DDTHH:mm:ss
}

export interface StockFollowUpState {
  colour: string;
  colour2?: string;
  colour3?: string;
  stockStage: StockWorkflowStage;
  customerDecision: CustomerStockDecision;
  collectionConfirmation: CollectionConfirmationStatus;
  remark: string;
  changes: StockChangeEntry[];
}

export interface InstallmentApplication {
  id: string;
  caseId: string;
  applicationDate: string; // YYYY-MM-DD
  customerName: string;
  icNumber: string;
  phone: string;
  address: string;
  ref1Id: string;
  bankName?: string;
  bankAccountNumber?: string;
  applicationRemarks?: string;
  internalNotes?: string;
  customerFromBranchId: string;
  pickupBranchId: string | null; // null = Belum Ditentukan, 'POSTAGE' = POSTAGE
  staffInChargeId: string;
  approvalStatus: ApprovalStatus;
  approvalDate: string | null;
  approvedBy: string | null;
  approvalRemarks: string;
  category?: ProductCategory;
  products: ProductItem[];
  financing: FinancingInfo;
  documents: DocumentItem[];
  agreement: AgreementState;
  stockFollowUp?: StockFollowUpState;
  taskStatus?: TaskStatusState;
  timeline: ActivityEvent[];
}

export interface NotificationPreferences {
  // Approval Management (New Application & Approval List)
  notifyOnNewApplication: boolean;
  notifyOnApprovalDecision: boolean;

  // Stock Management
  notifyOnStockStatusChange: boolean;
  notifyOnActionPassedStock: boolean;

  // Agreement Management (Receive, Checking, Sale Submission, Postage Tracking)
  notifyOnAgreementReceived: boolean;
  notifyOnCheckingPassed: boolean;
  notifyOnCheckingFailed: boolean;
  notifyOnSaleSubmissionCreated: boolean;
  notifyOnPostageTrackingUpdate: boolean;

  // Claim Management (To Be Claimed & Claimed History)
  notifyOnReadyToBeClaimed: boolean;
  notifyOnAgreementClaimed: boolean;

  // Overview & Daily Digest
  dailyDigestEnabled: boolean;
  dailyDigestTime: string;
}

export interface SystemPreferences {
  companyName: string;
  systemName: string;
  defaultCurrency: string;
  defaultPageSize: number;
  fixedDispatchDestination: string;
  autoArchiveDays: number;
  directoryVersion?: number;
}

export type DashboardPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface SaleSubmissionList {
  id: string;
  submissionListId: string;
  submissionDate: string; // YYYY-MM-DD
  createdAt: string; // ISO string
  createdBy: string;
  agreementIds: string[];
  agreementCount: number;
  totalProductAmount: number;
  totalFinanceAmount: number;
  totalActualCashPayment: number;
  remarks: string;
}

export type PostageTrackingStatus =
  | 'PENDING'
  | 'IN TRANSIT'
  | 'OUT FOR DELIVERY'
  | 'DELIVERED'
  | 'FAILED / RETURNED';

export interface PostageTrackingRecord {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  saleSubmissionId?: string | null;
  trackingNumber: string;
  courier: string;
  status: PostageTrackingStatus;
  remarks?: string;
  updatedAt: string; // ISO string
  updatedBy: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  description?: string;
}
