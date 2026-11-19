import { useCallback, useMemo, useState } from 'react';
import {
  INITIAL_APPLICATIONS,
  INITIAL_BRANCHES,
  INITIAL_COURIERS,
  INITIAL_NOTIFICATION_PREFS,
  INITIAL_POSTAGE_TRACKINGS,
  INITIAL_ROLES,
  INITIAL_SYSTEM_PREFS,
  INITIAL_USERS,
} from './data/mockData';
import type {
  ActivityEvent,
  Branch,
  CheckingChecklist,
  Courier,
  InstallmentApplication,
  NotificationPreferences,
  PageId,
  PermissionKey,
  PostageTrackingRecord,
  PostageTrackingStatus,
  RoleConfig,
  SaleSubmissionList,
  StaffUser,
  SystemPreferences,
  ToastMessage,
} from './types/khallegacy';
import {
  claimAgreementTransition,
  computeDashboardMetrics,
  countApplicationsAddedOnDate,
  createNewApplicationTransition,
  createSaleSubmissionTransition,
  deleteApplicationTransition,
  deriveStockFollowUp,
  deriveTaskStatus,
  formatRM,
  isEligibleForClaim,
  isEligibleForSaleSubmission,
  mapPostageStatusToTaskSubmission,
  passStockToBranchTransition,
  receiveAgreementTransition,
  SYSTEM_TODAY_DATE,
  updateApplicationDetailsTransition,
  updateCheckingTransition,
  updateStockFollowUpTransition,
  userHasPermission,
  type NewApplicationPayload,
  type UpdateApplicationDetailsPayload,
  type UpdateStockFollowUpPayload,
} from './utils/businessRules';
import { buildCoverPagePdfBlob } from './utils/coverPagePdf';
import { buildSaleSubmissionPdfBlob } from './utils/submissionPdf';
import { buildClaimedHistoryPdfBlob } from './utils/claimedHistoryPdf';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ToastContainer } from './components/ToastContainer';
import { DashboardPage } from './pages/DashboardPage';
import { NewApplicationPage } from './pages/NewApplicationPage';
import { ApprovalListPage } from './pages/ApprovalListPage';
import { ApprovalDetailsPage } from './pages/ApprovalDetailsPage';
import { StockManagementPage } from './pages/StockManagementPage';
import { AgreementManagementPage } from './pages/AgreementManagementPage';
import { AgreementCheckingPage } from './pages/AgreementCheckingPage';
import { SaleSubmissionPage } from './pages/SaleSubmissionPage';
import { PostageManagementPage } from './pages/PostageManagementPage';
import { AgreementHistoryPage } from './pages/AgreementHistoryPage';
import { ToBeClaimedPage } from './pages/ToBeClaimedPage';
import { ClaimedHistoryPage } from './pages/ClaimedHistoryPage';
import { ReportsAnalyticsPage } from './pages/ReportsAnalyticsPage';
import { UserPermissionsPage } from './pages/UserPermissionsPage';
import { SystemSettingsPage } from './pages/SystemSettingsPage';
import { ErrorState } from './components/StateViews';

export default function App() {
  const [applications, setApplications] = useState<InstallmentApplication[]>(INITIAL_APPLICATIONS);
  const [branches, setBranches] = useState<Branch[]>(INITIAL_BRANCHES);
  const [couriers, setCouriers] = useState<Courier[]>(INITIAL_COURIERS);
  const [roles, setRoles] = useState<RoleConfig[]>(INITIAL_ROLES);
  const [users, setUsers] = useState<StaffUser[]>(INITIAL_USERS);
  const [notifications, setNotifications] = useState<NotificationPreferences>(
    INITIAL_NOTIFICATION_PREFS,
  );
  const [systemPrefs, setSystemPrefs] = useState<SystemPreferences>(INITIAL_SYSTEM_PREFS);

  const [currentUserId, setCurrentUserId] = useState<string>('usr-1');
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [saleSubmissions, setSaleSubmissions] = useState<SaleSubmissionList[]>([]);
  const [postageTrackings, setPostageTrackings] = useState<PostageTrackingRecord[]>(
    INITIAL_POSTAGE_TRACKINGS,
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const currentUser = useMemo(
    () => users.find((u) => u.id === currentUserId) ?? users[0],
    [users, currentUserId],
  );
  const currentRole = useMemo(
    () => roles.find((r) => r.id === currentUser.roleId) ?? roles[0],
    [roles, currentUser],
  );

  const addToast = useCallback(
    (type: ToastMessage['type'], title: string, description?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, title, description }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const hasPermission = useCallback(
    (perm: PermissionKey) => userHasPermission(currentUser, roles, perm),
    [currentUser, roles],
  );

  const navigateTo = useCallback(
    (page: PageId) => {
      setActivePage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [],
  );

  const openApplicationDetails = useCallback((appId: string) => {
    setSelectedAppId(appId);
    setActivePage('approval-details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const recentActivities = useMemo<ActivityEvent[]>(() => {
    return applications
      .flatMap((a) => a.timeline)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [applications]);

  const metrics = useMemo(() => computeDashboardMetrics(applications), [applications]);

  const todayNewApplicationsCount = useMemo(
    () => countApplicationsAddedOnDate(applications, SYSTEM_TODAY_DATE),
    [applications],
  );

  const toBeSubmittedCount = useMemo(
    () => applications.filter(isEligibleForSaleSubmission).length,
    [applications],
  );
  const toBeClaimedCount = useMemo(
    () => applications.filter((a) => isEligibleForClaim(a, postageTrackings)).length,
    [applications, postageTrackings],
  );

  const stockPendingCount = useMemo(
    () =>
      applications.filter((a) => {
        if (a.approvalStatus !== 'Approved') return false;
        const followUp = deriveStockFollowUp(a);
        if (followUp.customerDecision === 'CANCELLED') return false;
        return !a.products.every((p) => Boolean(p.datePassStock));
      }).length,
    [applications],
  );

  const selectedApplication = useMemo(
    () => applications.find((a) => a.id === selectedAppId) ?? applications[0],
    [applications, selectedAppId],
  );

  // Handlers
  const downloadApplicationCoverPage = (app: InstallmentApplication) => {
    const branchLabel = (id: string | null) => {
      if (!id) return 'Belum Ditentukan';
      if (id === 'WEB' || id === 'POSTAGE') return id;
      return branches.find((b) => b.id === id)?.name ?? id;
    };
    const lines = [
      '====================================================================',
      'KHALLEGACY INSTALLMENT SYSTEM — APPLICATION COVER PAGE',
      '====================================================================',
      `CASE ID              : ${app.caseId}`,
      `Application Date     : ${app.applicationDate}`,
      `Initial Status       : ${app.approvalStatus}`,
      `Entered By           : ${currentUser.name}`,
      '',
      '--- 01. CUSTOMER INFORMATION ---',
      `Customer Name        : ${app.customerName}`,
      `IC Number            : ${app.icNumber}`,
      `Phone Number         : ${app.phone}`,
      `REF1 ID              : ${app.ref1Id}`,
      `From Branch          : ${branchLabel(app.customerFromBranchId)}`,
      `Pickup Branch        : ${branchLabel(app.pickupBranchId)}`,
      `Bank Name            : ${app.bankName || '—'}`,
      `Bank Account No.     : ${app.bankAccountNumber || '—'}`,
      `Remarks              : ${app.applicationRemarks || '—'}`,
      '',
      '--- 02. PRODUCT INFORMATION ---',
      ...app.products.map(
        (p, idx) =>
          `${idx + 1}. ${p.productName} (${p.model}) | Qty: ${p.quantity} × ${formatRM(
            p.productPrice,
          )} = ${formatRM(p.quantity * p.productPrice)}`,
      ),
      '',
      '--- 03. FINANCING INFORMATION ---',
      `Total Product Price  : ${formatRM(app.financing.totalProductPrice)}`,
      `Deposit              : ${formatRM(app.financing.deposit)}`,
      `Financing Amount     : ${formatRM(app.financing.financingAmount)}`,
      `Agreement Fee        : ${formatRM(app.financing.agreementFee)}`,
      `Processing Fee       : ${formatRM(app.financing.processingFee)}`,
      `SST Amount           : ${formatRM(app.financing.sstAmount)}`,
      `Stamp Duty Fee       : ${formatRM(app.financing.stampDutyFee)}`,
      `Actual Cash Payment  : ${formatRM(app.financing.actualCashPayment ?? 0)}`,
      '',
      '--- 04. COLLECTION & INTERNAL NOTES ---',
      `Internal Notes       : ${app.internalNotes || '—'}`,
      '====================================================================',
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${app.caseId}-Cover-Page.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateApplication = (
    payload: NewApplicationPayload,
    downloadCoverPage: boolean,
  ): boolean => {
    const nowIso = new Date().toISOString().slice(0, 19);
    try {
      const created = createNewApplicationTransition(applications, payload, currentUser, nowIso);
      setApplications((prev) => [created, ...prev]);
      if (downloadCoverPage) {
        downloadApplicationCoverPage(created);
      }
      addToast(
        'success',
        `Application ${created.caseId} Saved`,
        'Added to Approval List (Approved) & Cover Page downloaded.',
      );
      return true;
    } catch (err) {
      addToast(
        'error',
        'Unable to Save Application',
        err instanceof Error ? err.message : 'Validation failed.',
      );
      return false;
    }
  };

  const handleUpdateStockFollowUp = (appId: string, payload: UpdateStockFollowUpPayload) => {
    const nowIso = new Date().toISOString().slice(0, 19);
    try {
      setApplications((prev) =>
        prev.map((app) =>
          app.id === appId
            ? updateStockFollowUpTransition(app, payload, branches, currentUser.name, nowIso)
            : app,
        ),
      );
      addToast('success', 'Customer Follow-up Saved', 'Change history and stock status updated.');
    } catch (err) {
      addToast('error', 'Stock Update Failed', err instanceof Error ? err.message : 'Error');
    }
  };

  const handlePassStockToBranch = (appId: string, passDate: string) => {
    const nowIso = new Date().toISOString().slice(0, 19);
    try {
      let passedCase = '';
      setApplications((prev) =>
        prev.map((app) => {
          if (app.id !== appId) return app;
          passedCase = app.caseId;
          return passStockToBranchTransition(app, passDate, currentUser.name, nowIso);
        }),
      );
      addToast(
        'success',
        'Stock Passed to Branch',
        `${passedCase} (${passDate}) is now eligible for Agreement Receive (TERIMA).`,
      );
    } catch (err) {
      addToast('error', 'Pass Stock Failed', err instanceof Error ? err.message : 'Error');
    }
  };

  const handleUpdateApplicationDetails = (
    appId: string,
    payload: UpdateApplicationDetailsPayload,
  ): boolean => {
    const nowIso = new Date().toISOString().slice(0, 19);
    try {
      let updatedCaseId = '';
      setApplications((prev) =>
        prev.map((app) => {
          if (app.id !== appId) return app;
          const next = updateApplicationDetailsTransition(
            prev,
            appId,
            payload,
            branches,
            users,
            currentUser.name,
            nowIso,
          );
          updatedCaseId = next.caseId;
          return next;
        }),
      );
      addToast(
        'success',
        'Application Details Updated',
        `${updatedCaseId || payload.caseId} changes saved and logged to Activity Timeline.`,
      );
      return true;
    } catch (err) {
      addToast(
        'error',
        'Unable to Update Application',
        err instanceof Error ? err.message : 'Validation failed.',
      );
      return false;
    }
  };

  const handleDeleteApplication = (appId: string) => {
    const target = applications.find((a) => a.id === appId);
    const remaining = deleteApplicationTransition(applications, appId);
    setApplications(remaining);
    setSelectedAppId(remaining[0]?.id ?? '');
    setActivePage('approval-list');
    addToast(
      'warning',
      'Application Deleted',
      target
        ? `${target.caseId} (${target.customerName}) has been deleted.`
        : 'Application record deleted.',
    );
  };

  const handleReceiveAgreement = (appId: string) => {
    const nowIso = new Date().toISOString().slice(0, 19);
    try {
      let receivedCase = '';
      setApplications((prev) =>
        prev.map((app) => {
          if (app.id !== appId) return app;
          receivedCase = app.caseId;
          return receiveAgreementTransition(app, currentUser.name, nowIso);
        }),
      );
      addToast(
        'success',
        'Agreement Received (TERIMA)',
        `${receivedCase} moved to Agreement Checking queue.`,
      );
    } catch (err) {
      addToast('error', 'TERIMA Failed', err instanceof Error ? err.message : 'Unable to receive.');
    }
  };

  const handleUpdateChecking = (
    appId: string,
    status: 'Checking in Progress' | 'Checking Passed' | 'Checking Failed',
    checklist: CheckingChecklist,
    remarks: string,
    staff1 = '',
    staff2 = '',
    invoiceNumber = '',
  ) => {
    const nowIso = new Date().toISOString().slice(0, 19);
    try {
      setApplications((prev) =>
        prev.map((app) =>
          app.id === appId
            ? updateCheckingTransition(app, status, checklist, remarks, currentUser.name, nowIso, {
                staff1,
                staff2,
                invoiceNumber,
              })
            : app,
        ),
      );
      addToast(
        status === 'Checking Failed' ? 'warning' : 'success',
        `Agreement ${status}`,
        status === 'Checking Passed'
          ? 'Agreement is now Ready to Dispatch to JCL Credit.'
          : 'Checking status updated in audit timeline.',
      );
    } catch (err) {
      addToast('error', 'Checking Update Failed', err instanceof Error ? err.message : 'Error');
    }
  };

  const handleSaveCheckingRemarks = (
    appId: string,
    checklist: CheckingChecklist,
    remarks: string,
    staff1 = '',
    staff2 = '',
    invoiceNumber = '',
  ) => {
    const nowIso = new Date().toISOString().slice(0, 19);
    const trimmedStaff1 = staff1.trim();
    const trimmedStaff2 = staff2.trim();
    const trimmedInvoice = invoiceNumber.trim();
    const staffMeta = [
      trimmedStaff1 ? `STAFF 1: ${trimmedStaff1}` : '',
      trimmedStaff2 ? `STAFF 2: ${trimmedStaff2}` : '',
      trimmedInvoice ? `INVOICE: ${trimmedInvoice}` : '',
    ]
      .filter(Boolean)
      .join(', ');
    setApplications((prev) =>
      prev.map((app) => {
        if (app.id !== appId) return app;
        const evt: ActivityEvent = {
          id: `evt-${Date.now()}`,
          caseId: app.caseId,
          customerName: app.customerName,
          actionType: 'Information Updated',
          description: `Checking details saved: ${remarks || 'Checklist updated.'}${staffMeta ? ` (${staffMeta})` : ''}`,
          staffName: currentUser.name,
          timestamp: nowIso,
        };
        return {
          ...app,
          agreement: {
            ...app.agreement,
            checkingChecklist: checklist,
            checkingStaff1: trimmedStaff1,
            checkingStaff2: trimmedStaff2,
            invoiceNumber: trimmedInvoice,
            checkingRemarks: remarks,
          },
          timeline: [evt, ...app.timeline],
        };
      }),
    );
    addToast('info', 'Checking Notes Saved');
  };

  const handleCreateSaleSubmission = (payload: {
    submissionListId: string;
    submissionDate: string;
    agreementIds: string[];
    remarks: string;
  }): boolean => {
    const nowIso = new Date().toISOString().slice(0, 19);
    try {
      const result = createSaleSubmissionTransition(
        applications,
        saleSubmissions,
        payload,
        currentUser.name,
        nowIso,
      );
      setApplications(result.applications);
      setSaleSubmissions((prev) => [result.submission, ...prev]);
      addToast(
        'success',
        `Submission List ${result.submission.submissionListId} Created`,
        `${result.submission.agreementCount} agreement(s) · Actual Cash Payment ${formatRM(
          result.submission.totalActualCashPayment,
        )}.`,
      );
      return true;
    } catch (err) {
      addToast(
        'error',
        'Unable to Create Submission List',
        err instanceof Error ? err.message : 'Validation failed.',
      );
      return false;
    }
  };

  const handleCreatePostageTracking = (payload: {
    date: string;
    description: string;
    saleSubmissionId: string | null;
    trackingNumber: string;
    courier: string;
    status: PostageTrackingStatus;
  }) => {
    const nowIso = new Date().toISOString().slice(0, 19);
    const newRecord: PostageTrackingRecord = {
      id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: payload.date,
      description: payload.description,
      saleSubmissionId: payload.saleSubmissionId,
      trackingNumber: payload.trackingNumber,
      courier: payload.courier,
      status: payload.status,
      updatedAt: nowIso,
      updatedBy: currentUser.name,
    };
    setPostageTrackings((prev) => [newRecord, ...prev]);
    if (payload.saleSubmissionId) {
      const nextSubmissionTaskStatus = mapPostageStatusToTaskSubmission(payload.status);
      setApplications((prev) =>
        prev.map((app) =>
          app.agreement.saleSubmissionId === payload.saleSubmissionId
            ? {
                ...app,
                taskStatus: {
                  ...deriveTaskStatus(app),
                  agreementSubmission: nextSubmissionTaskStatus,
                },
              }
            : app,
        ),
      );
    }
    addToast(
      'success',
      'New Tracking Created',
      `${newRecord.trackingNumber} (${newRecord.courier}) · ${newRecord.status}`,
    );
  };

  const handleUpdatePostageStatus = (
    trackingId: string,
    payload: {
      status: PostageTrackingStatus;
      remarks: string;
    },
  ) => {
    const nowIso = new Date().toISOString().slice(0, 19);
    const targetTracking = postageTrackings.find((item) => item.id === trackingId);
    const updatedTrk = targetTracking?.trackingNumber ?? '';
    setPostageTrackings((prev) =>
      prev.map((item) => {
        if (item.id !== trackingId) return item;
        return {
          ...item,
          status: payload.status,
          remarks: payload.remarks,
          updatedAt: nowIso,
          updatedBy: currentUser.name,
        };
      }),
    );
    if (targetTracking?.saleSubmissionId) {
      const nextSubmissionTaskStatus = mapPostageStatusToTaskSubmission(payload.status);
      setApplications((prev) =>
        prev.map((app) =>
          app.agreement.saleSubmissionId === targetTracking.saleSubmissionId
            ? {
                ...app,
                taskStatus: {
                  ...deriveTaskStatus(app),
                  agreementSubmission: nextSubmissionTaskStatus,
                },
              }
            : app,
        ),
      );
    }
    addToast(
      'success',
      'Postage Status Updated',
      updatedTrk ? `${updatedTrk} updated to ${payload.status}` : `Updated to ${payload.status}`,
    );
  };

  const handleClaimAgreement = (
    appId: string,
    payload: {
      claimDate: string;
      remarks: string;
    },
  ): boolean => {
    const nowIso = new Date().toISOString().slice(0, 19);
    try {
      let claimedCase = '';
      setApplications((prev) =>
        prev.map((app) => {
          if (app.id !== appId) return app;
          claimedCase = app.caseId;
          return claimAgreementTransition(
            app,
            {
              claimDate: payload.claimDate,
              claimedBy: currentUser.name,
              remarks: payload.remarks,
            },
            nowIso,
            postageTrackings,
          );
        }),
      );
      addToast(
        'success',
        'Agreement Claimed',
        `${claimedCase} marked as Claimed and logged to Activity Timeline.`,
      );
      return true;
    } catch (err) {
      addToast(
        'error',
        'Unable to Claim Agreement',
        err instanceof Error ? err.message : 'Claim failed.',
      );
      return false;
    }
  };

  const handleDownloadCoverPagePdf = (app: InstallmentApplication) => {
    const blob = buildCoverPagePdfBlob(app, branches, users);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${app.caseId}-COVER-PAGE.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('info', 'COVER PAGE.pdf Downloaded', `${app.caseId}-COVER-PAGE.pdf`);
  };

  const handleDownloadSaleSubmissionPdf = (submission: SaleSubmissionList) => {
    const appMap = new Map(applications.map((a) => [a.id, a]));
    const apps = submission.agreementIds
      .map((id) => appMap.get(id))
      .filter((a): a is InstallmentApplication => Boolean(a));
    const blob = buildSaleSubmissionPdfBlob(submission, apps);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${submission.submissionListId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Submission List Downloaded', `${submission.submissionListId}.pdf`);
  };

  const handleExportCsv = (filename: string, rows: string[][]) => {
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      )
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Excel / CSV Report Exported', filename);
  };

  const handleExportClaimedHistoryPdf = (
    rows: InstallmentApplication[],
    filterSummary: {
      branchLabel: string;
      startDate: string;
      endDate: string;
      searchTerm: string;
    },
  ) => {
    const blob = buildClaimedHistoryPdfBlob(rows, branches, filterSummary);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'claimed-history-data.pdf';
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'PDF Report Exported', 'claimed-history-data.pdf');
  };

  const handleExportPdfSummary = () => {
    addToast('info', 'Opening Print / Save as PDF Dialog', 'Select "Save as PDF" in your browser print dialog.');
    setTimeout(() => window.print(), 250);
  };

  // User & Settings handlers
  const handleToggleUserStatus = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' } : u,
      ),
    );
    addToast('info', 'User Account Status Updated');
  };

  const handleSaveUser = (
    payload: Omit<StaffUser, 'id' | 'lastActive'>,
    existingId?: string,
  ) => {
    const nowIso = new Date().toISOString().slice(0, 19);
    if (existingId) {
      setUsers((prev) =>
        prev.map((u) => (u.id === existingId ? { ...u, ...payload } : u)),
      );
      addToast('success', 'Staff Account Updated', payload.name);
    } else {
      setUsers((prev) => [
        ...prev,
        { ...payload, id: `usr-${Date.now()}`, lastActive: nowIso },
      ]);
      addToast('success', 'Staff Account Created', payload.name);
    }
  };

  const handleToggleRolePermission = (roleId: string, permission: PermissionKey) => {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== roleId) return r;
        const exists = r.permissions.includes(permission);
        return {
          ...r,
          permissions: exists
            ? r.permissions.filter((p) => p !== permission)
            : [...r.permissions, permission],
        };
      }),
    );
    addToast('info', 'Role Permission Updated');
  };

  const handleAddBranch = (branch: Omit<Branch, 'id'>) => {
    setBranches((prev) => [...prev, { ...branch, id: `br-${Date.now()}` }]);
    addToast('success', 'Branch Added', branch.name);
  };

  const handleUpdateBranch = (
    id: string,
    payload: { code: string; name: string; state: string },
  ) => {
    setBranches((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...payload } : b)),
    );
    addToast('success', 'Branch Updated', `${payload.code} · ${payload.name}`);
  };

  const handleToggleBranch = (id: string) => {
    setBranches((prev) =>
      prev.map((b) => (b.id === id ? { ...b, active: !b.active } : b)),
    );
    addToast('info', 'Branch Status Updated');
  };

  const handleAddCourier = (courier: Omit<Courier, 'id'>) => {
    setCouriers((prev) => [...prev, { ...courier, id: `cur-${Date.now()}` }]);
    addToast('success', 'Courier Added', courier.name);
  };

  const handleUpdateCourier = (
    id: string,
    payload: { code: string; name: string },
  ) => {
    setCouriers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...payload } : c)),
    );
    addToast('success', 'Courier Updated', `${payload.code} · ${payload.name}`);
  };

  const handleToggleCourier = (id: string) => {
    setCouriers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c)),
    );
    addToast('info', 'Courier Status Updated');
  };

  const handleToggleRoleActive = (id: string) => {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
    addToast('info', 'Role Status Updated');
  };

  const handleSwitchUser = (userId: string) => {
    setCurrentUserId(userId);
    const nextUser = users.find((u) => u.id === userId);
    const nextRole = roles.find((r) => r.id === nextUser?.roleId);
    addToast(
      'info',
      `Switched Operator: ${nextUser?.name}`,
      `Active Role: ${nextRole?.name}. Permissions updated.`,
    );
    setActivePage('dashboard');
  };

  const renderPage = () => {
    if (activePage === 'dashboard') {
      if (!hasPermission('view_dashboard')) {
        return <ErrorState message="Your role does not have permission to view the Dashboard." />;
      }
      return (
        <DashboardPage
          applications={applications}
          branches={branches}
          recentActivities={recentActivities}
          onNavigate={navigateTo}
          onSelectApplication={openApplicationDetails}
        />
      );
    }

    if (activePage === 'new-application') {
      if (!hasPermission('create_application')) {
        return <ErrorState message="Your role does not have permission to create applications." />;
      }
      return (
        <NewApplicationPage
          existingCaseIds={applications.map((a) => a.caseId)}
          branches={branches}
          currentUser={currentUser}
          onCreateApplication={handleCreateApplication}
          onNavigateApprovalList={() => navigateTo('approval-list')}
        />
      );
    }

    if (activePage === 'approval-list') {
      if (!hasPermission('view_approval_list')) {
        return <ErrorState message="Your role does not have permission to view Approval List." />;
      }
      return (
        <ApprovalListPage
          applications={applications}
          branches={branches}
          users={users}
          defaultPageSize={systemPrefs.defaultPageSize}
          onViewDetails={openApplicationDetails}
        />
      );
    }

    if (activePage === 'stock-management') {
      if (!hasPermission('manage_stock')) {
        return <ErrorState message="Your role does not have permission to manage Stock." />;
      }
      return (
        <StockManagementPage
          applications={applications}
          branches={branches}
          canManage={hasPermission('manage_stock')}
          onUpdateStockFollowUp={handleUpdateStockFollowUp}
          onPassStockToBranch={handlePassStockToBranch}
        />
      );
    }

    if (activePage === 'approval-details') {
      if (!selectedApplication) {
        return (
          <ApprovalListPage
            applications={applications}
            branches={branches}
            users={users}
            defaultPageSize={systemPrefs.defaultPageSize}
            onViewDetails={openApplicationDetails}
          />
        );
      }
      return (
        <ApprovalDetailsPage
          application={selectedApplication}
          existingCaseIds={applications.map((a) => ({ id: a.id, caseId: a.caseId }))}
          branches={branches}
          users={users}
          postageTrackings={postageTrackings}
          currentUserName={currentUser.name}
          onBack={() => navigateTo('approval-list')}
          onUpdateDetails={handleUpdateApplicationDetails}
          onDeleteApplication={handleDeleteApplication}
          onDownloadCoverPage={handleDownloadCoverPagePdf}
        />
      );
    }

    if (activePage === 'agreement-management') {
      if (!hasPermission('receive_agreement') && !hasPermission('manage_agreement')) {
        return <ErrorState message="Your role does not have permission to access Agreement Receiving." />;
      }
      return (
        <AgreementManagementPage
          applications={applications}
          branches={branches}
          currentUserName={currentUser.name}
          canReceive={hasPermission('receive_agreement')}
          defaultPageSize={systemPrefs.defaultPageSize}
          onReceiveAgreement={handleReceiveAgreement}
          onViewDetails={openApplicationDetails}
        />
      );
    }

    if (activePage === 'agreement-checking') {
      if (!hasPermission('perform_checking')) {
        return <ErrorState message="Your role does not have permission to perform agreement checking." />;
      }
      return (
        <AgreementCheckingPage
          applications={applications}
          branches={branches}
          canCheck={hasPermission('perform_checking')}
          defaultPageSize={systemPrefs.defaultPageSize}
          onUpdateChecking={handleUpdateChecking}
          onSaveRemarksOnly={handleSaveCheckingRemarks}
        />
      );
    }

    if (activePage === 'sale-submission') {
      if (!hasPermission('sale_submission') && !hasPermission('dispatch_agreement')) {
        return <ErrorState message="Your role does not have permission to manage Sale Submission." />;
      }
      return (
        <SaleSubmissionPage
          applications={applications}
          branches={branches}
          submissionLists={saleSubmissions}
          canSubmit={hasPermission('sale_submission') || hasPermission('dispatch_agreement')}
          defaultPageSize={systemPrefs.defaultPageSize}
          onCreateSubmissionList={handleCreateSaleSubmission}
          onExportCsv={handleExportCsv}
          onDownloadSubmissionPdf={handleDownloadSaleSubmissionPdf}
          onViewDetails={openApplicationDetails}
        />
      );
    }

    if (activePage === 'postage-management') {
      if (!hasPermission('manage_postage') && !hasPermission('dispatch_agreement')) {
        return <ErrorState message="Your role does not have permission to manage Postage Tracking." />;
      }
      return (
        <PostageManagementPage
          trackings={postageTrackings}
          submissionLists={saleSubmissions}
          applications={applications}
          couriers={couriers}
          canManage={hasPermission('manage_postage') || hasPermission('dispatch_agreement')}
          defaultPageSize={systemPrefs.defaultPageSize}
          onCreateTracking={handleCreatePostageTracking}
          onUpdateTrackingStatus={handleUpdatePostageStatus}
          onExportCsv={handleExportCsv}
          onDownloadSubmissionPdf={handleDownloadSaleSubmissionPdf}
          onViewDetails={openApplicationDetails}
        />
      );
    }

    if (activePage === 'agreement-history') {
      if (!hasPermission('view_agreement_history') && !hasPermission('manage_agreement')) {
        return <ErrorState message="Your role does not have permission to view Agreement History." />;
      }
      return (
        <AgreementHistoryPage
          applications={applications}
          branches={branches}
          postageTrackings={postageTrackings}
          defaultPageSize={systemPrefs.defaultPageSize}
          onViewDetails={openApplicationDetails}
        />
      );
    }

    if (activePage === 'to-be-claimed') {
      if (!hasPermission('manage_to_be_claimed') && !hasPermission('manage_agreement')) {
        return <ErrorState message="Your role does not have permission to access Claim Management." />;
      }
      return (
        <ToBeClaimedPage
          applications={applications}
          branches={branches}
          postageTrackings={postageTrackings}
          currentUserName={currentUser.name}
          canClaim={hasPermission('manage_to_be_claimed') || hasPermission('manage_agreement')}
          defaultPageSize={systemPrefs.defaultPageSize}
          onClaimAgreement={handleClaimAgreement}
          onViewDetails={openApplicationDetails}
        />
      );
    }

    if (activePage === 'claimed-history') {
      if (!hasPermission('view_claimed_history') && !hasPermission('manage_agreement')) {
        return <ErrorState message="Your role does not have permission to view Claimed History & Data." />;
      }
      return (
        <ClaimedHistoryPage
          applications={applications}
          branches={branches}
          defaultPageSize={systemPrefs.defaultPageSize}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportClaimedHistoryPdf}
          onViewDetails={openApplicationDetails}
        />
      );
    }

    if (activePage === 'reports-analytics') {
      if (!hasPermission('view_reports')) {
        return <ErrorState message="Your role does not have permission to view Reports & Analytics." />;
      }
      return (
        <ReportsAnalyticsPage
          applications={applications}
          branches={branches}
          users={users}
          canExport={hasPermission('export_reports')}
          onExportCsv={handleExportCsv}
          onExportPdfSummary={handleExportPdfSummary}
        />
      );
    }

    if (activePage === 'user-permissions') {
      if (!hasPermission('manage_users')) {
        return <ErrorState message="Your role does not have permission to manage Users & Permissions." />;
      }
      return (
        <UserPermissionsPage
          users={users}
          roles={roles}
          branches={branches}
          onToggleUserStatus={handleToggleUserStatus}
          onSaveUser={handleSaveUser}
          onToggleRolePermission={handleToggleRolePermission}
        />
      );
    }

    if (!hasPermission('manage_settings')) {
      return <ErrorState message="Your role does not have permission to access System Settings." />;
    }
    return (
      <SystemSettingsPage
        branches={branches}
        couriers={couriers}
        roles={roles}
        notifications={notifications}
        systemPrefs={systemPrefs}
        onAddBranch={handleAddBranch}
        onUpdateBranch={handleUpdateBranch}
        onToggleBranch={handleToggleBranch}
        onAddCourier={handleAddCourier}
        onUpdateCourier={handleUpdateCourier}
        onToggleCourier={handleToggleCourier}
        onToggleRoleActive={handleToggleRoleActive}
        onToggleRolePermission={handleToggleRolePermission}
        onUpdateNotifications={(prefs) => {
          setNotifications(prefs);
          addToast('success', 'Notification Preferences Saved');
        }}
        onUpdateSystemPrefs={(prefs) => {
          setSystemPrefs(prefs);
          addToast('success', 'System Preferences Saved');
        }}
      />
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activePage={activePage}
        onNavigate={navigateTo}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        hasPermission={hasPermission}
        counts={{
          todayNewApplications: todayNewApplicationsCount,
          stockPending: stockPendingCount,
          toBeReceived: metrics.agreementToBeReceived,
          pendingChecking: metrics.agreementPendingChecking,
          toBeSubmitted: toBeSubmittedCount,
          pendingPostage: postageTrackings.filter((p) => p.status === 'PENDING').length,
          toBeClaimed: toBeClaimedCount,
        }}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activePage={activePage}
          selectedCaseId={activePage === 'approval-details' ? selectedApplication?.caseId : null}
          onNavigate={navigateTo}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          applications={applications}
          onSelectApplication={openApplicationDetails}
          recentActivities={recentActivities}
          currentUser={currentUser}
          currentRole={currentRole}
          allUsers={users}
          allRoles={roles}
          branches={branches}
          onSwitchUser={handleSwitchUser}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          {renderPage()}
        </main>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
