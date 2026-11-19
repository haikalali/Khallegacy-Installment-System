import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Calendar,
  ChevronDown,
  ChevronRight,
  Menu,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import type {
  ActivityEvent,
  Branch,
  InstallmentApplication,
  PageId,
  RoleConfig,
  StaffUser,
} from '../types/khallegacy';
import { formatDateTime } from '../utils/businessRules';
import { StatusBadge } from './StatusBadge';

interface TopBarProps {
  activePage: PageId;
  selectedCaseId?: string | null;
  onNavigate: (page: PageId) => void;
  onOpenMobileSidebar: () => void;
  applications: InstallmentApplication[];
  onSelectApplication: (appId: string) => void;
  recentActivities: ActivityEvent[];
  currentUser: StaffUser;
  currentRole: RoleConfig;
  allUsers: StaffUser[];
  allRoles: RoleConfig[];
  branches: Branch[];
  onSwitchUser: (userId: string) => void;
}

const PAGE_META: Record<PageId, { section: string; title: string }> = {
  dashboard: { section: 'Overview', title: 'Dashboard' },
  'new-application': { section: 'Approval Management', title: 'New Application' },
  'approval-list': { section: 'Approval Management', title: 'Approval List' },
  'approval-details': { section: 'Approval Management', title: 'Approval Details' },
  'stock-management': { section: 'Stock Management', title: 'Stock Management' },
  'agreement-management': { section: 'Agreement Management', title: 'Agreement Receive' },
  'agreement-checking': { section: 'Agreement Management', title: 'Agreement Checking' },
  'sale-submission': { section: 'Agreement Management', title: 'Sale Submission' },
  'postage-management': { section: 'Agreement Management', title: 'Postage Management' },
  'agreement-history': { section: 'Agreement Management', title: 'Agreement History' },
  'to-be-claimed': { section: 'Claim Management', title: 'To Be Claimed' },
  'claimed-history': { section: 'Claim Management', title: 'Claimed History & Data' },
  'reports-analytics': { section: 'Reports', title: 'Reports & Analytics' },
  'user-permissions': { section: 'System', title: 'User & Permissions' },
  'system-settings': { section: 'System', title: 'System Settings' },
};

export const TopBar: React.FC<TopBarProps> = ({
  activePage,
  selectedCaseId,
  onNavigate,
  onOpenMobileSidebar,
  applications,
  onSelectApplication,
  recentActivities,
  currentUser,
  currentRole,
  allUsers,
  allRoles,
  branches,
  onSwitchUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const meta = PAGE_META[activePage];
  const branchName =
    branches.find((b) => b.id === currentUser.branchId)?.name ?? 'Shah Alam HQ';

  const trimmed = searchQuery.trim().toLowerCase();
  const searchResults =
    trimmed.length > 0
      ? applications
          .filter(
            (a) =>
              a.caseId.toLowerCase().includes(trimmed) ||
              a.customerName.toLowerCase().includes(trimmed) ||
              a.icNumber.toLowerCase().includes(trimmed) ||
              a.phone.toLowerCase().includes(trimmed),
          )
          .slice(0, 6)
      : [];

  const initials = currentUser.name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-6 h-16 flex items-center justify-between gap-4 shrink-0">
      {/* Left: Mobile Menu + Breadcrumbs + Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500">
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="hover:text-slate-800 transition-colors"
            >
              Khallegacy
            </button>
            <ChevronRight className="w-3 h-3 text-slate-400" aria-hidden="true" />
            <span>{meta.section}</span>
            {activePage === 'approval-details' && selectedCaseId && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-400" aria-hidden="true" />
                <span className="font-mono-tabular text-slate-700">{selectedCaseId}</span>
              </>
            )}
          </nav>
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight truncate">
            {meta.title}
            {activePage === 'approval-details' && selectedCaseId ? ` · ${selectedCaseId}` : ''}
          </h1>
        </div>
      </div>

      {/* Right: Global Search + Date + Notifications + User Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
        {/* Global Search */}
        <div ref={searchRef} className="relative hidden md:block w-64 lg:w-80">
          <label htmlFor="global-case-search" className="sr-only">
            Global search by CASE ID, customer name, IC, or phone
          </label>
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="global-case-search"
            type="text"
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            placeholder="Search CASE ID, Name, IC, Phone..."
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {searchOpen && trimmed.length > 0 && (
            <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-40">
              {searchResults.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-500">
                  No applications matched &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {searchResults.map((app) => (
                    <li key={app.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectApplication(app.id);
                          setSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono-tabular text-xs font-semibold text-blue-600">
                              {app.caseId}
                            </span>
                            <span className="text-xs font-medium text-slate-900 truncate">
                              {app.customerName}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono-tabular mt-0.5">
                            {app.icNumber} · {app.phone}
                          </div>
                        </div>
                        <StatusBadge status={app.approvalStatus} compact />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Current Date */}
        <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-500 border-r border-slate-200 pr-3.5 whitespace-nowrap">
          <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span className="tabular-nums font-medium text-slate-700">17 Nov 2026</span>
        </div>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            aria-label="Notifications"
            aria-expanded={notifOpen}
            className="relative p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {recentActivities.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-600" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-40">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">Recent Operational Alerts</span>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {Math.min(recentActivities.length, 6)} latest
                </span>
              </div>
              <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {recentActivities.slice(0, 6).map((act) => (
                  <li key={act.id} className="px-4 py-2.5 hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-900">{act.actionType}</span>
                      <span className="font-mono-tabular text-[11px] text-blue-600">
                        {act.caseId}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{act.description}</p>
                    <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                      {act.staffName} · {formatDateTime(act.timestamp)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* User Profile Dropdown (with Role Persona Switcher) */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((prev) => !prev)}
            aria-expanded={profileOpen}
            aria-label="User profile menu"
            className="flex items-center gap-2.5 pl-1.5 pr-2 py-1 rounded-lg hover:bg-slate-100 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="hidden sm:block min-w-0">
              <div className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[130px]">
                {currentUser.name}
              </div>
              <div className="text-[11px] text-slate-500 leading-tight truncate max-w-[130px]">
                {currentRole.name} · {branchName}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-40">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <p className="text-xs font-semibold text-slate-900">{currentUser.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{currentUser.email}</p>
                <p className="text-[11px] text-slate-600 mt-1 font-medium">
                  Role: {currentRole.name} · Branch: {branchName}
                </p>
              </div>
              <div className="p-2">
                <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Switch Active Operator (RBAC Test)
                </div>
                {allUsers
                  .filter((u) => u.status === 'Active')
                  .map((u) => {
                    const role = allRoles.find((r) => r.id === u.roleId);
                    const isCurrent = u.id === currentUser.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          onSwitchUser(u.id);
                          setProfileOpen(false);
                        }}
                        className={`w-full px-2.5 py-2 rounded-lg text-left flex items-center justify-between gap-2 text-xs transition-colors ${
                          isCurrent
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate">{u.name}</div>
                          <div className="text-[11px] text-slate-500">{role?.name}</div>
                        </div>
                        {isCurrent && <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
