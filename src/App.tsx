import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User as FirebaseUser } from 'firebase/auth';
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
  CustomerStockDecision,
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
  countApplicationsCreatedOnDate,
  createNewApplicationTransition,
  createSaleSubmissionTransition,
  deleteApplicationTransition,
  deriveStockFollowUp,
  deriveTaskStatus,
  formatRM,
  getLocalDateKey,
  getLocalDateTimeIso,
  isEligibleForClaim,
  isEligibleForSaleSubmission,
  mapPostageStatusToTaskSubmission,
  passStockToBranchTransition,
  receiveAgreementTransition,
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
import { BackupDataPage } from './pages/BackupDataPage';
import { UserPermissionsPage } from './pages/UserPermissionsPage';
import { SystemSettingsPage } from './pages/SystemSettingsPage';
import {
  authenticateStaff,
  clearAuthUserId,
  getSavedAuthUserId,
  saveAuthUserId,
  type AuthResult,
} from './utils/auth';
import { auth, googleProvider } from './lib/firebase';
import {
  clearAllOperationalDataFromCloud,
  deleteApplicationFromCloud,
  deleteBranchFromCloud,
  deleteStaffUserFromCloud,
  ensureUserProfile,
  isBootstrappedAdminEmail,
  saveApplicationToCloud,
  saveBranchToCloud,
  saveCourierToCloud,
  savePostageTrackingToCloud,
  saveRoleToCloud,
  saveSaleSubmissionToCloud,
  saveSettingsToCloud,
  saveStaffUserToCloud,
  seedInitialWorkspaceIfEmpty,
  subscribeWorkspaceCollections,
} from './lib/firestoreSync';
import { LoginPage } from './pages/LoginPage';
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

  const initialSavedUser = useMemo(() => {
    const savedId = getSavedAuthUserId();
    if (!savedId) return null;
    const found = INITIAL_USERS.find((u) => u.id === savedId && u.status === 'Active');
    return found ?? null;
  }, []);

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(initialSavedUser));
  const [currentUserId, setCurrentUserId] = useState<string>(
    () => initialSavedUser?.id ?? INITIAL_USERS[0].id,
  );
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [stockDecisionPreset, setStockDecisionPreset] = useState<CustomerStockDecision | ''>('');
  const [stockShowAllMonths, setStockShowAllMonths] = useState(false);
  const [lastPageBeforeDetails, setLastPageBeforeDetails] = useState<PageId>('approval-list');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [todayDateKey, setTodayDateKey] = useState<string>(() => getLocalDateKey());
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

  const syncToCloud = useCallback(
    (task: Promise<void>) => {
      void task.catch((err) => {
        console.error('Cloud sync error:', err);
        addToast('error', 'Database Sync Error', 'Unable to save changes to cloud database.');
      });
    },
    [addToast],
  );

  useEffect(() => {
    let unsubFirestore: (() => void) | undefined;
    let active = true;

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = undefined;
      }

      if (!fbUser || !fbUser.emailVerified) {
        if (active) setFirebaseUser(null);
        return;
      }

      if (!active) return;
      setFirebaseUser(fbUser);

      const emailLower = (fbUser.email ?? '').toLowerCase();
      const matchedStaff =
        INITIAL_USERS.find((u) => u.email.toLowerCase() === emailLower && u.status === 'Active') ??
        (isBootstrappedAdminEmail(fbUser.email)
          ? INITIAL_USERS[0]
          : INITIAL_USERS.find((u) => u.roleId === 'role-sales-admin') ?? INITIAL_USERS[0]);

      setCurrentUserId(matchedStaff.id);
      saveAuthUserId(matchedStaff.id, true);
      setIsAuthenticated(true);

      try {
        await ensureUserProfile(fbUser, matchedStaff);
        await seedInitialWorkspaceIfEmpty(fbUser);
      } catch (err) {
        console.error('Workspace initialization error:', err);
      }

      if (!active) return;
      unsubFirestore = subscribeWorkspaceCollections(
        fbUser,
        {
          onBranches: setBranches,
          onCouriers: setCouriers,
          onRoles: setRoles,
          onStaffUsers: setUsers,
          onApplications: setApplications,
          onSaleSubmissions: setSaleSubmissions,
          onPostageTrackings: setPostageTrackings,
          onSettings: (nextNotif, nextSys) => {
            setNotifications(nextNotif);
            setSystemPrefs(nextSys);
          },
        },
        (err) => {
          console.error('Firestore listener error:', err);
        },
      );
    });

    return () => {
      active = false;
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextKey = getLocalDateKey();
      setTodayDateKey((prev) => (prev === nextKey ? prev : nextKey));
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const hasPermission = useCallback(
    (perm: PermissionKey) => userHasPermission(currentUser, roles, perm),
    [currentUser, roles],
  );

  const navigateTo = useCallback(
    (page: PageId) => {
      setStockDecisionPreset('');
      setStockShowAllMonths(false);
      setActivePage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [],
  );

  const handleOpenCancelledStock = useCallback((showAllMonths: boolean) => {
    setStockDecisionPreset('CANCELLED');
    setStockShowAllMonths(showAllMonths);
    setActivePage('stock-management');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openApplicationDetails = useCallback(
    (appId: string) => {
      if (activePage !== 'approval-details') {
        setLastPageBeforeDetails(activePage);
      }
      setSelectedAppId(appId);
      setActivePage('approval-details');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [activePage],
  );

  const recentActivities = useMemo<ActivityEvent[]>(() => {
    return applications
      .flatMap((a) => a.timeline)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [applications]);

  const metrics = useMemo(() => computeDashboardMetrics(applications), [applications]);

  const todayNewApplicationsCount = useMemo(
    () => countApplicationsCreatedOnDate(applications, todayDateKey),
    [applications, todayDateKey],
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
        return followUp.collectionConfirmation === 'PENDING';
      }).length,
    [applications],
  );

  const selectedApplication = useMemo(
    () => applications.find((a) => a.id === selectedAppId) ?? applications[0],
    [applications, selectedAppId],
  );

  // Handlers
  const triggerCoverPagePdfDownload = async (
    app: InstallmentApplication,
    showDownloadToast: boolean,
  ) => {
    try {
      const blob = await buildCoverPagePdfBlob(app, branches, users);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${app.caseId}-COVER-PAGE.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (showDownloadToast) {
        addToast('info', 'COVER PAGE.pdf Downloaded', `${app.caseId}-COVER-PAGE.pdf`);
      }
    } catch (err) {
      addToast(
        'error',
        'Cover Page PDF Failed',
        err instanceof Error ? err.message : 'Unable to generate Cover Page PDF.',
      );
    }
  };

  const handleCreateApplication = (
    payload: NewApplicationPayload,
    downloadCoverPage: boolean,
  ): boolean => {
    const now = new Date();
    const nowIso = getLocalDateTimeIso(now);
    const currentDateKey = getLocalDateKey(now);
    setTodayDateKey((prev) => (prev === currentDateKey ? prev : currentDateKey));
    try {
      const created = createNewApplicationTransition(applications, payload, currentUser, nowIso);
      setApplications((prev) => [created, ...prev]);
      if (firebaseUser) {
        syncToCloud(saveApplicationToCloud(created, firebaseUser.uid));
      }
      if (downloadCoverPage) {
        void triggerCoverPagePdfDownload(created, false);
      }
      addToast(
        'success',
        `Application ${created.caseId} Saved`,
        'Added to Approval List (Approved) & Cover Page PDF downloaded.',
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
    const target = applications.find((a) => a.id === appId);
    if (!target) return;
    try {
      const updatedApp = updateStockFollowUpTransition(
        target,
        payload,
        branches,
        currentUser.name,
        nowIso,
      );
      setApplications((prev) => prev.map((app) => (app.id === appId ? updatedApp : app)));
      if (firebaseUser) {
        syncToCloud(saveApplicationToCloud(updatedApp, firebaseUser.uid));
      }
      addToast('success', 'Customer Follow-up Saved', 'Change history and stock status updated.');
    } catch (err) {
      addToast('error', 'Stock Update Failed', err instanceof Error ? err.message : 'Error');
    }
  };

  const handlePassStockToBranch = (appId: string, passDate: string) => {
    const nowIso = new Date().toISOString().slice(0, 19);
    const target = applications.find((a) => a.id === appId);
    if (!target) return;
    try {
      const updatedApp = passStockToBranchTransition(target, passDate, currentUser.name, nowIso);
      setApplications((prev) => prev.map((app) => (app.id === appId ? updatedApp : app)));
      if (firebaseUser) {
        syncToCloud(saveApplicationToCloud(updatedApp, firebaseUser.uid));
      }
      addToast(
        'success',
        'Stock Passed to Branch',
        `${updatedApp.caseId} (${passDate}) is now eligible for Agreement Receive (TERIMA).`,
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
      const updatedApp = updateApplicationDetailsTransition(
        applications,
        appId,
        payload,
        branches,
        users,
        currentUser.name,
        nowIso,
      );
      setApplications((prev) => prev.map((app) => (app.id === appId ? updatedApp : app)));
      if (firebaseUser) {
        syncToCloud(saveApplicationToCloud(updatedApp, firebaseUser.uid));
      }
      addToast(
        'success',
        'Application Details Updated',
        `${updatedApp.caseId || payload.caseId} changes saved and logged to Activity Timeline.`,
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
    if (firebaseUser) {
      syncToCloud(deleteApplicationFromCloud(appId));
    }
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
    const target = applications.find((a) => a.id === appId);
    if (!target) return;
    try {
      const updatedApp = receiveAgreementTransition(target, currentUser.name, nowIso);
      setApplications((prev) => prev.map((app) => (app.id === appId ? updatedApp : app)));
      if (firebaseUser) {
        syncToCloud(saveApplicationToCloud(updatedApp, firebaseUser.uid));
      }
      addToast(
        'success',
        'Agreement Received (TERIMA)',
        `${updatedApp.caseId} moved to Agreement Checking queue.`,
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
    const target = applications.find((a) => a.id === appId);
    if (!target) return;
    try {
      const updatedApp = updateCheckingTransition(
        target,
        status,
        checklist,
        remarks,
        currentUser.name,
        nowIso,
        {
          staff1,
          staff2,
          invoiceNumber,
        },
      );
      setApplications((prev) => prev.map((app) => (app.id === appId ? updatedApp : app)));
      if (firebaseUser) {
        syncToCloud(saveApplicationToCloud(updatedApp, firebaseUser.uid));
      }
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
    const target = applications.find((a) => a.id === appId);
    if (!target) return;
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
    const evt: ActivityEvent = {
      id: `evt-${Date.now()}`,
      caseId: target.caseId,
      customerName: target.customerName,
      actionType: 'Information Updated',
      description: `Checking details saved: ${remarks || 'Checklist updated.'}${staffMeta ? ` (${staffMeta})` : ''}`,
      staffName: currentUser.name,
      timestamp: nowIso,
    };
    const updatedApp: InstallmentApplication = {
      ...target,
      agreement: {
        ...target.agreement,
        checkingChecklist: checklist,
        checkingStaff1: trimmedStaff1,
        checkingStaff2: trimmedStaff2,
        invoiceNumber: trimmedInvoice,
        checkingRemarks: remarks,
      },
      timeline: [evt, ...target.timeline],
    };
    setApplications((prev) => prev.map((app) => (app.id === appId ? updatedApp : app)));
    if (firebaseUser) {
      syncToCloud(saveApplicationToCloud(updatedApp, firebaseUser.uid));
    }
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
      if (firebaseUser) {
        const uid = firebaseUser.uid;
        syncToCloud(saveSaleSubmissionToCloud(result.submission, uid));
        const affectedApps = result.applications.filter((a) =>
          payload.agreementIds.includes(a.id),
        );
        affectedApps.forEach((a) => syncToCloud(saveApplicationToCloud(a, uid)));
      }
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
    if (firebaseUser) {
      syncToCloud(savePostageTrackingToCloud(newRecord, firebaseUser.uid));
    }
    if (payload.saleSubmissionId) {
      const nextSubmissionTaskStatus = mapPostageStatusToTaskSubmission(payload.status);
      const changedApps = applications
        .filter((app) => app.agreement.saleSubmissionId === payload.saleSubmissionId)
        .map((app) => ({
          ...app,
          taskStatus: {
            ...deriveTaskStatus(app),
            agreementSubmission: nextSubmissionTaskStatus,
          },
        }));
      if (changedApps.length > 0) {
        const changedMap = new Map(changedApps.map((a) => [a.id, a]));
        setApplications((prev) => prev.map((app) => changedMap.get(app.id) ?? app));
        if (firebaseUser) {
          const uid = firebaseUser.uid;
          changedApps.forEach((a) => syncToCloud(saveApplicationToCloud(a, uid)));
        }
      }
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
    if (!targetTracking) return;
    const updatedTrk = targetTracking.trackingNumber;
    const updatedRecord: PostageTrackingRecord = {
      ...targetTracking,
      status: payload.status,
      remarks: payload.remarks,
      updatedAt: nowIso,
      updatedBy: currentUser.name,
    };
    setPostageTrackings((prev) =>
      prev.map((item) => (item.id === trackingId ? updatedRecord : item)),
    );
    if (firebaseUser) {
      syncToCloud(savePostageTrackingToCloud(updatedRecord, firebaseUser.uid));
    }
    if (targetTracking.saleSubmissionId) {
      const nextSubmissionTaskStatus = mapPostageStatusToTaskSubmission(payload.status);
      const changedApps = applications
        .filter((app) => app.agreement.saleSubmissionId === targetTracking.saleSubmissionId)
        .map((app) => ({
          ...app,
          taskStatus: {
            ...deriveTaskStatus(app),
            agreementSubmission: nextSubmissionTaskStatus,
          },
        }));
      if (changedApps.length > 0) {
        const changedMap = new Map(changedApps.map((a) => [a.id, a]));
        setApplications((prev) => prev.map((app) => changedMap.get(app.id) ?? app));
        if (firebaseUser) {
          const uid = firebaseUser.uid;
          changedApps.forEach((a) => syncToCloud(saveApplicationToCloud(a, uid)));
        }
      }
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
    const target = applications.find((a) => a.id === appId);
    if (!target) return false;
    try {
      const updatedApp = claimAgreementTransition(
        target,
        {
          claimDate: payload.claimDate,
          claimedBy: currentUser.name,
          remarks: payload.remarks,
        },
        nowIso,
        postageTrackings,
      );
      setApplications((prev) => prev.map((app) => (app.id === appId ? updatedApp : app)));
      if (firebaseUser) {
        syncToCloud(saveApplicationToCloud(updatedApp, firebaseUser.uid));
      }
      addToast(
        'success',
        'Agreement Claimed',
        `${updatedApp.caseId} marked as Claimed and logged to Activity Timeline.`,
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
    void triggerCoverPagePdfDownload(app, true);
  };

  const handleDownloadSaleSubmissionPdf = async (submission: SaleSubmissionList) => {
    const appMap = new Map(applications.map((a) => [a.id, a]));
    const apps = submission.agreementIds
      .map((id) => appMap.get(id))
      .filter((a): a is InstallmentApplication => Boolean(a));
    try {
      const blob = await buildSaleSubmissionPdfBlob(submission, apps);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${submission.submissionListId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      addToast('success', 'Submission List Downloaded', `${submission.submissionListId}.pdf`);
    } catch (err) {
      addToast(
        'error',
        'Submission List PDF Failed',
        err instanceof Error ? err.message : 'Unable to generate Sale Submission PDF.',
      );
    }
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
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    const updated: StaffUser = {
      ...target,
      status: target.status === 'Active' ? 'Inactive' : 'Active',
    };
    setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    if (firebaseUser) {
      syncToCloud(saveStaffUserToCloud(updated, firebaseUser.uid));
    }
    addToast('info', 'User Account Status Updated');
  };

  const handleSaveUser = (
    payload: Omit<StaffUser, 'id' | 'lastActive'>,
    existingId?: string,
  ) => {
    const nowIso = new Date().toISOString().slice(0, 19);
    if (existingId) {
      const target = users.find((u) => u.id === existingId);
      if (!target) return;
      const updated: StaffUser = { ...target, ...payload };
      setUsers((prev) => prev.map((u) => (u.id === existingId ? updated : u)));
      if (firebaseUser) {
        syncToCloud(saveStaffUserToCloud(updated, firebaseUser.uid));
      }
      addToast('success', 'Staff Account Updated', payload.name);
    } else {
      const created: StaffUser = { ...payload, id: `usr-${Date.now()}`, lastActive: nowIso };
      setUsers((prev) => [...prev, created]);
      if (firebaseUser) {
        syncToCloud(saveStaffUserToCloud(created, firebaseUser.uid));
      }
      addToast('success', 'Staff Account Created', payload.name);
    }
  };

  const handleDeleteUser = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target || target.id === currentUser.id) return;
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    if (firebaseUser) {
      syncToCloud(deleteStaffUserFromCloud(userId));
    }
    addToast('warning', 'Staff Account Deleted', target.name);
  };

  const handleToggleRolePermission = (roleId: string, permission: PermissionKey) => {
    const target = roles.find((r) => r.id === roleId);
    if (!target) return;
    const exists = target.permissions.includes(permission);
    const updated: RoleConfig = {
      ...target,
      permissions: exists
        ? target.permissions.filter((p) => p !== permission)
        : [...target.permissions, permission],
    };
    setRoles((prev) => prev.map((r) => (r.id === roleId ? updated : r)));
    if (firebaseUser) {
      syncToCloud(saveRoleToCloud(updated, firebaseUser.uid));
    }
    addToast('info', 'Role Permission Updated');
  };

  const handleAddBranch = (branch: Omit<Branch, 'id'>) => {
    const created: Branch = { ...branch, id: `br-${Date.now()}` };
    setBranches((prev) => [...prev, created]);
    if (firebaseUser) {
      syncToCloud(saveBranchToCloud(created, firebaseUser.uid));
    }
    addToast('success', 'Branch Added', branch.name);
  };

  const handleUpdateBranch = (
    id: string,
    payload: { code: string; name: string; state: string },
  ) => {
    const target = branches.find((b) => b.id === id);
    if (!target) return;
    const updated: Branch = { ...target, ...payload };
    setBranches((prev) => prev.map((b) => (b.id === id ? updated : b)));
    if (firebaseUser) {
      syncToCloud(saveBranchToCloud(updated, firebaseUser.uid));
    }
    addToast('success', 'Branch Updated', `${payload.code} · ${payload.name}`);
  };

  const handleToggleBranch = (id: string) => {
    const target = branches.find((b) => b.id === id);
    if (!target) return;
    const updated: Branch = { ...target, active: !target.active };
    setBranches((prev) => prev.map((b) => (b.id === id ? updated : b)));
    if (firebaseUser) {
      syncToCloud(saveBranchToCloud(updated, firebaseUser.uid));
    }
    addToast('info', 'Branch Status Updated');
  };

  const handleDeleteBranch = (id: string) => {
    const target = branches.find((b) => b.id === id);
    if (!target) return;
    setBranches((prev) => prev.filter((b) => b.id !== id));
    if (firebaseUser) {
      syncToCloud(deleteBranchFromCloud(id));
    }
    addToast('warning', 'Branch Deleted', `${target.code} · ${target.name}`);
  };

  const handleAddCourier = (courier: Omit<Courier, 'id'>) => {
    const created: Courier = { ...courier, id: `cur-${Date.now()}` };
    setCouriers((prev) => [...prev, created]);
    if (firebaseUser) {
      syncToCloud(saveCourierToCloud(created, firebaseUser.uid));
    }
    addToast('success', 'Courier Added', courier.name);
  };

  const handleUpdateCourier = (
    id: string,
    payload: { code: string; name: string; trackingUrl: string },
  ) => {
    const target = couriers.find((c) => c.id === id);
    if (!target) return;
    const updated: Courier = { ...target, ...payload };
    setCouriers((prev) => prev.map((c) => (c.id === id ? updated : c)));
    if (firebaseUser) {
      syncToCloud(saveCourierToCloud(updated, firebaseUser.uid));
    }
    addToast('success', 'Courier Updated', `${payload.code} · ${payload.name}`);
  };

  const handleToggleCourier = (id: string) => {
    const target = couriers.find((c) => c.id === id);
    if (!target) return;
    const updated: Courier = { ...target, active: !target.active };
    setCouriers((prev) => prev.map((c) => (c.id === id ? updated : c)));
    if (firebaseUser) {
      syncToCloud(saveCourierToCloud(updated, firebaseUser.uid));
    }
    addToast('info', 'Courier Status Updated');
  };

  const handleToggleRoleActive = (id: string) => {
    const target = roles.find((r) => r.id === id);
    if (!target) return;
    const updated: RoleConfig = { ...target, active: !target.active };
    setRoles((prev) => prev.map((r) => (r.id === id ? updated : r)));
    if (firebaseUser) {
      syncToCloud(saveRoleToCloud(updated, firebaseUser.uid));
    }
    addToast('info', 'Role Status Updated');
  };

  const handleClearAllData = async () => {
    try {
      if (firebaseUser) {
        await clearAllOperationalDataFromCloud(firebaseUser);
      }
      setApplications([]);
      setSaleSubmissions([]);
      setPostageTrackings([]);
      setSelectedAppId(null);
      addToast(
        'warning',
        'All Data Cleared',
        'All applications, sale submissions, and postage tracking records have been permanently deleted.',
      );
    } catch (err) {
      console.error('Clear all data error:', err);
      addToast(
        'error',
        'Database Sync Error',
        'Unable to clear all cloud database records.',
      );
    }
  };

  const handleSwitchUser = (userId: string) => {
    setCurrentUserId(userId);
    saveAuthUserId(userId, false);
    const nextUser = users.find((u) => u.id === userId);
    const nextRole = roles.find((r) => r.id === nextUser?.roleId);
    addToast(
      'info',
      `Switched Operator: ${nextUser?.name}`,
      `Active Role: ${nextRole?.name}. Permissions updated.`,
    );
    setActivePage('dashboard');
  };

  const handleLogin = (
    identifier: string,
    password: string,
    remember: boolean,
  ): AuthResult => {
    const result = authenticateStaff(users, identifier, password);
    if (!result.ok) {
      return result;
    }
    const nowIso = new Date().toISOString().slice(0, 19);
    const updatedUser: StaffUser = { ...result.user, lastActive: nowIso };
    setUsers((prev) => prev.map((u) => (u.id === result.user.id ? updatedUser : u)));
    if (firebaseUser) {
      syncToCloud(saveStaffUserToCloud(updatedUser, firebaseUser.uid));
    }
    setCurrentUserId(result.user.id);
    saveAuthUserId(result.user.id, remember);
    setIsAuthenticated(true);
    setSelectedAppId(null);
    setActivePage('dashboard');
    const role = roles.find((r) => r.id === result.user.roleId);
    addToast(
      'success',
      `Welcome, ${result.user.name}`,
      `Signed in as ${role?.name ?? 'Staff'}.`,
    );
    return result;
  };

  const handleGoogleLogin = async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (!cred.user.emailVerified) {
        await signOut(auth);
        return {
          ok: false,
          error: 'Google account email must be verified to sign in.',
        };
      }
      setSelectedAppId(null);
      setActivePage('dashboard');
      addToast(
        'success',
        `Welcome, ${cred.user.displayName || cred.user.email}`,
        'Cloud sync enabled.',
      );
      return { ok: true };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to complete Google sign-in.';
      return { ok: false, error: message };
    }
  };

  const handleLogout = () => {
    clearAuthUserId();
    if (auth.currentUser) {
      void signOut(auth).catch((err) => {
        console.error('Sign out error:', err);
      });
    }
    setFirebaseUser(null);
    setIsAuthenticated(false);
    setMobileSidebarOpen(false);
    setSelectedAppId(null);
    setActivePage('dashboard');
    addToast('info', 'Logged Out', 'You have been signed out of Khallegacy System.');
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
          saleSubmissions={saleSubmissions}
          recentActivities={recentActivities}
          onNavigate={navigateTo}
          onOpenCancelledStock={handleOpenCancelledStock}
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
          initialDecisionFilter={stockDecisionPreset}
          initialShowAllMonths={stockShowAllMonths}
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
          onBack={() => navigateTo(lastPageBeforeDetails)}
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

    if (activePage === 'backup-data') {
      if (!hasPermission('view_reports')) {
        return <ErrorState message="Your role does not have permission to view Backup Data." />;
      }
      return (
        <BackupDataPage
          applications={applications}
          branches={branches}
          defaultPageSize={systemPrefs.defaultPageSize}
          onExportCsv={handleExportCsv}
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
          currentUserId={currentUser.id}
          onToggleUserStatus={handleToggleUserStatus}
          onSaveUser={handleSaveUser}
          onDeleteUser={handleDeleteUser}
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
        onDeleteBranch={handleDeleteBranch}
        onAddCourier={handleAddCourier}
        onUpdateCourier={handleUpdateCourier}
        onToggleCourier={handleToggleCourier}
        onToggleRoleActive={handleToggleRoleActive}
        onToggleRolePermission={handleToggleRolePermission}
        onUpdateNotifications={(prefs) => {
          setNotifications(prefs);
          if (firebaseUser) {
            syncToCloud(saveSettingsToCloud(prefs, systemPrefs, firebaseUser.uid));
          }
          addToast('success', 'Notification Preferences Saved');
        }}
        onUpdateSystemPrefs={(prefs) => {
          setSystemPrefs(prefs);
          if (firebaseUser) {
            syncToCloud(saveSettingsToCloud(notifications, prefs, firebaseUser.uid));
          }
          addToast('success', 'System Preferences Saved');
        }}
        onClearAllData={handleClearAllData}
      />
    );
  };

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage
          users={users}
          roles={roles}
          branches={branches}
          onLogin={handleLogin}
          onGoogleLogin={handleGoogleLogin}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

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
        onLogout={handleLogout}
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
          onLogout={handleLogout}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          {renderPage()}
        </main>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
