import React from 'react';
import {
  LayoutDashboard,
  FilePlus2,
  ClipboardCheck,
  Package,
  FileCheck2,
  ShieldCheck,
  ListChecks,
  Truck,
  History,
  HandCoins,
  FileSpreadsheet,
  BarChart3,
  Users,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  X,
} from 'lucide-react';
import type { PageId, PermissionKey } from '../types/khallegacy';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermission: PermissionKey;
  badgeCount?: number;
  badgeText?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  hasPermission: (perm: PermissionKey) => boolean;
  onLogout: () => void;
  counts: {
    todayNewApplications: number;
    stockPending: number;
    toBeReceived: number;
    pendingChecking: number;
    toBeSubmitted: number;
    pendingPostage: number;
    toBeClaimed: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  hasPermission,
  onLogout,
  counts,
}) => {
  const sections: NavSection[] = [
    {
      title: 'OVERVIEW',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          requiredPermission: 'view_dashboard',
        },
      ],
    },
    {
      title: 'APPROVAL MANAGEMENT',
      items: [
        {
          id: 'new-application',
          label: 'New Application',
          icon: FilePlus2,
          requiredPermission: 'create_application',
        },
        {
          id: 'approval-list',
          label: 'Approval List',
          icon: ClipboardCheck,
          requiredPermission: 'view_approval_list',
          badgeText: counts.todayNewApplications > 0 ? `+${counts.todayNewApplications}` : undefined,
        },
      ],
    },
    {
      title: 'STOCK MANAGEMENT',
      items: [
        {
          id: 'stock-management',
          label: 'Stock Management',
          icon: Package,
          requiredPermission: 'manage_stock',
          badgeCount: counts.stockPending,
        },
      ],
    },
    {
      title: 'AGREEMENT MANAGEMENT',
      items: [
        {
          id: 'agreement-management',
          label: 'Agreement Receive',
          icon: FileCheck2,
          requiredPermission: 'receive_agreement',
          badgeCount: counts.toBeReceived,
        },
        {
          id: 'agreement-checking',
          label: 'Agreement Checking',
          icon: ShieldCheck,
          requiredPermission: 'perform_checking',
          badgeCount: counts.pendingChecking,
        },
        {
          id: 'sale-submission',
          label: 'Sale Submission',
          icon: ListChecks,
          requiredPermission: 'sale_submission',
          badgeCount: counts.toBeSubmitted,
        },
        {
          id: 'postage-management',
          label: 'Postage Management',
          icon: Truck,
          requiredPermission: 'manage_postage',
          badgeCount: counts.pendingPostage,
        },
        {
          id: 'agreement-history',
          label: 'Agreement History',
          icon: History,
          requiredPermission: 'view_agreement_history',
        },
      ],
    },
    {
      title: 'CLAIM MANAGEMENT',
      items: [
        {
          id: 'to-be-claimed',
          label: 'To Be Claimed',
          icon: HandCoins,
          requiredPermission: 'manage_to_be_claimed',
          badgeCount: counts.toBeClaimed,
        },
        {
          id: 'claimed-history',
          label: 'Claimed History & Data',
          icon: FileSpreadsheet,
          requiredPermission: 'view_claimed_history',
        },
      ],
    },
    {
      title: 'REPORTS',
      items: [
        {
          id: 'reports-analytics',
          label: 'Reports & Analytics',
          icon: BarChart3,
          requiredPermission: 'view_reports',
        },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        {
          id: 'user-permissions',
          label: 'User & Permissions',
          icon: Users,
          requiredPermission: 'manage_users',
        },
        {
          id: 'system-settings',
          label: 'System Settings',
          icon: Settings,
          requiredPermission: 'manage_settings',
        },
      ],
    },
  ];

  const isNavItemActive = (itemId: PageId) => {
    if (activePage === 'approval-details' && itemId === 'approval-list') return true;
    return activePage === itemId;
  };

  const renderContent = (isMobile: boolean) => {
    const isCompact = !isMobile && collapsed;

    return (
      <div className="flex flex-col h-full bg-[#0F172A] text-slate-300 select-none">
        {/* Brand Header */}
        <div
          className={`flex items-center h-16 px-4 border-b border-slate-800/80 shrink-0 ${
            isCompact ? 'justify-center' : 'justify-between'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              onNavigate('dashboard');
              if (isMobile) onCloseMobile();
            }}
            className="flex items-center gap-3 text-left min-w-0 focus:outline-none"
            title="Khallegacy Installment System"
          >
            <img
              src="/khallegacy-logo.png"
              alt="Khallegacy"
              className="w-9 h-9 rounded-full object-cover shrink-0 shadow-sm"
            />
            {!isCompact && (
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white tracking-tight truncate">
                  Khallegacy
                </div>
                <div className="text-[11px] text-slate-400 truncate">Installment System</div>
              </div>
            )}
          </button>

          {isMobile ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            !isCompact && (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )
          )}
        </div>

        {/* Navigation Links */}
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-4 px-2.5 space-y-5">
          {sections.map((section) => {
            const visibleItems = section.items.filter((item) =>
              hasPermission(item.requiredPermission),
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title}>
                {!isCompact ? (
                  <div className="px-2.5 mb-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                    {section.title}
                  </div>
                ) : (
                  <div className="border-t border-slate-800/80 my-2 mx-2" />
                )}

                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = isNavItemActive(item.id);

                    return (
                      <li key={item.id} className="relative group">
                        <button
                          type="button"
                          onClick={() => {
                            onNavigate(item.id);
                            if (isMobile) onCloseMobile();
                          }}
                          aria-current={active ? 'page' : undefined}
                          title={isCompact ? item.label : undefined}
                          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap ${
                            isCompact ? 'justify-center' : 'justify-between'
                          } ${
                            active
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={`w-4 h-4 shrink-0 ${
                                active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                              }`}
                            />
                            {!isCompact && <span className="truncate">{item.label}</span>}
                          </span>

                          {!isCompact &&
                            (item.badgeText ||
                              (typeof item.badgeCount === 'number' && item.badgeCount > 0)) && (
                              <span
                                className={`tabular-nums text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                                  active
                                    ? 'bg-blue-500 text-white'
                                    : item.badgeText
                                      ? 'bg-emerald-500/15 text-emerald-400'
                                      : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {item.badgeText ?? item.badgeCount}
                              </span>
                            )}
                        </button>

                        {/* Tooltip when collapsed */}
                        {isCompact && (
                          <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity fixed left-[74px] z-50 -translate-y-8 px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-xs font-medium text-white shadow-lg whitespace-nowrap">
                            {item.label}
                            {item.badgeText
                              ? ` (${item.badgeText})`
                              : typeof item.badgeCount === 'number' && item.badgeCount > 0
                                ? ` (${item.badgeCount})`
                                : ''}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Bottom Footer: Log Out & Collapse Expand Control */}
        <div className="p-2.5 border-t border-slate-800/80 space-y-1.5 shrink-0">
          {isCompact && !isMobile ? (
            <>
              <div className="relative group flex justify-center">
                <button
                  type="button"
                  onClick={onLogout}
                  aria-label="Log Out"
                  title="Log Out"
                  className="p-2 rounded-lg text-slate-300 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
                <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity fixed left-[74px] z-50 px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-xs font-medium text-white shadow-lg whitespace-nowrap">
                  Log Out
                </div>
              </div>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  aria-label="Expand sidebar"
                  title="Expand sidebar"
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (isMobile) onCloseMobile();
                onLogout();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-slate-300 hover:text-red-300 hover:bg-red-500/10 transition-colors whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Log Out</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r border-slate-800 transition-all duration-200 ${
          collapsed ? 'w-[68px]' : 'w-[268px]'
        }`}
      >
        {renderContent(false)}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px]"
            onClick={onCloseMobile}
          />
          <aside className="relative w-[264px] max-w-[85vw] h-full z-10 shadow-2xl">
            {renderContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
