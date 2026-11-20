import React, { useState } from 'react';
import {
  Bell,
  BellOff,
  Building2,
  Check,
  CheckCheck,
  ClipboardCheck,
  Clock,
  Edit2,
  FileCheck2,
  HandCoins,
  Package,
  Plus,
  Settings2,
  Shield,
  Truck,
} from 'lucide-react';
import type {
  Branch,
  Courier,
  NotificationPreferences,
  PermissionKey,
  RoleConfig,
  SystemPreferences,
} from '../types/khallegacy';
import { ALL_PERMISSIONS } from '../data/mockData';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';

interface SystemSettingsPageProps {
  branches: Branch[];
  couriers: Courier[];
  roles: RoleConfig[];
  notifications: NotificationPreferences;
  systemPrefs: SystemPreferences;
  onAddBranch: (branch: Omit<Branch, 'id'>) => void;
  onUpdateBranch: (id: string, branch: { code: string; name: string; state: string }) => void;
  onToggleBranch: (id: string) => void;
  onAddCourier: (courier: Omit<Courier, 'id'>) => void;
  onUpdateCourier: (
    id: string,
    courier: { code: string; name: string; trackingUrl: string },
  ) => void;
  onToggleCourier: (id: string) => void;
  onToggleRoleActive: (id: string) => void;
  onToggleRolePermission: (roleId: string, perm: PermissionKey) => void;
  onUpdateNotifications: (prefs: NotificationPreferences) => void;
  onUpdateSystemPrefs: (prefs: SystemPreferences) => void;
}

type SettingsTab =
  | 'branches'
  | 'roles'
  | 'permissions'
  | 'couriers'
  | 'notifications'
  | 'general';

export const SystemSettingsPage: React.FC<SystemSettingsPageProps> = ({
  branches,
  couriers,
  roles,
  notifications,
  systemPrefs,
  onAddBranch,
  onUpdateBranch,
  onToggleBranch,
  onAddCourier,
  onUpdateCourier,
  onToggleCourier,
  onToggleRoleActive,
  onToggleRolePermission,
  onUpdateNotifications,
  onUpdateSystemPrefs,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('branches');

  // Branch quick-add
  const [branchCode, setBranchCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [branchState, setBranchState] = useState('');

  // Branch edit modal card state
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editBranchCode, setEditBranchCode] = useState('');
  const [editBranchName, setEditBranchName] = useState('');
  const [editBranchState, setEditBranchState] = useState('');
  const [editBranchError, setEditBranchError] = useState('');

  // Courier quick-add
  const [courierCode, setCourierCode] = useState('');
  const [courierName, setCourierName] = useState('');
  const [courierUrl, setCourierUrl] = useState('');

  // Courier edit modal card state
  const [editingCourier, setEditingCourier] = useState<Courier | null>(null);
  const [editCourierCode, setEditCourierCode] = useState('');
  const [editCourierName, setEditCourierName] = useState('');
  const [editCourierUrl, setEditCourierUrl] = useState('');
  const [editCourierError, setEditCourierError] = useState('');

  const openEditBranch = (b: Branch) => {
    setEditingBranch(b);
    setEditBranchCode(b.code);
    setEditBranchName(b.name);
    setEditBranchState(b.state);
    setEditBranchError('');
  };

  const handleSaveBranchEdit = () => {
    if (!editBranchCode.trim() || !editBranchName.trim() || !editBranchState.trim()) {
      setEditBranchError('Sila lengkapkan semua medan: Branch CODE, Branch Name, dan State.');
      return;
    }
    if (!editingBranch) return;
    onUpdateBranch(editingBranch.id, {
      code: editBranchCode.trim().toUpperCase(),
      name: editBranchName.trim(),
      state: editBranchState.trim(),
    });
    setEditingBranch(null);
  };

  const openEditCourier = (c: Courier) => {
    setEditingCourier(c);
    setEditCourierCode(c.code);
    setEditCourierName(c.name);
    setEditCourierUrl(c.trackingUrl ?? '');
    setEditCourierError('');
  };

  const handleSaveCourierEdit = () => {
    if (!editCourierCode.trim() || !editCourierName.trim()) {
      setEditCourierError('Sila lengkapkan medan wajib: Courier Code dan Courier Name.');
      return;
    }
    if (!editingCourier) return;
    onUpdateCourier(editingCourier.id, {
      code: editCourierCode.trim().toUpperCase(),
      name: editCourierName.trim(),
      trackingUrl: editCourierUrl.trim(),
    });
    setEditingCourier(null);
  };

  // General prefs draft
  const [sysDraft, setSysDraft] = useState<SystemPreferences>(systemPrefs);

  const tabs: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'branches', label: 'Branch Management', icon: Building2 },
    { id: 'roles', label: 'User Role Configuration', icon: Shield },
    { id: 'permissions', label: 'Permission Configuration', icon: Check },
    { id: 'couriers', label: 'Courier Configuration', icon: Truck },
    { id: 'notifications', label: 'Notification Preferences', icon: Bell },
    { id: 'general', label: 'General System Preferences', icon: Settings2 },
  ];

  return (
    <div className="space-y-5">
      {/* Sub-navigation Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                active
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 1. Branch Management */}
      {activeTab === 'branches' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Branch Management</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure operational branches for customer origin and device pickup attribution
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!branchCode.trim() || !branchName.trim() || !branchState.trim()) return;
              onAddBranch({
                code: branchCode.trim().toUpperCase(),
                name: branchName.trim(),
                state: branchState.trim(),
                active: true,
              });
              setBranchCode('');
              setBranchName('');
              setBranchState('');
            }}
            className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg items-end text-xs"
          >
            <div>
              <label htmlFor="new-br-code" className="block font-medium text-slate-700 mb-1">
                Branch Code
              </label>
              <input
                id="new-br-code"
                type="text"
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                placeholder="e.g. MLK-07"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md font-mono-tabular"
              />
            </div>
            <div>
              <label htmlFor="new-br-name" className="block font-medium text-slate-700 mb-1">
                Branch Name
              </label>
              <input
                id="new-br-name"
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="e.g. Melaka Raya"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="new-br-state" className="block font-medium text-slate-700 mb-1">
                State
              </label>
              <input
                id="new-br-state"
                type="text"
                value={branchState}
                onChange={(e) => setBranchState(e.target.value)}
                placeholder="e.g. Melaka"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Branch
            </button>
          </form>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                  <th className="py-2.5 px-4">Code</th>
                  <th className="py-2.5 px-4">Branch Name</th>
                  <th className="py-2.5 px-4">State</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono-tabular font-semibold text-slate-800">
                      {b.code}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{b.name}</td>
                    <td className="py-2.5 px-4 text-slate-600">{b.state}</td>
                    <td className="py-2.5 px-4">
                      <StatusBadge status={b.active ? 'Active' : 'Inactive'} compact />
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => openEditBranch(b)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
                        >
                          <Edit2 className="w-3 h-3 text-slate-500" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleBranch(b.id)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                            b.active
                              ? 'text-slate-700 bg-white border-slate-200 hover:bg-slate-100'
                              : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {b.active ? 'Set Inactive' : 'Set Active'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. User Role Configuration */}
      {activeTab === 'roles' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">User Role Configuration</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Activate or deactivate operational roles across Khallegacy Installment System
            </p>
          </div>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {roles.map((r) => (
              <div
                key={r.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-slate-900">{r.name}</span>
                    <StatusBadge status={r.active ? 'Active' : 'Inactive'} compact />
                  </div>
                  <p className="text-slate-600 mt-1">{r.description}</p>
                  <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                    {r.permissions.length} permissions enabled
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleRoleActive(r.id)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shrink-0"
                >
                  {r.active ? 'Disable Role' : 'Enable Role'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Permission Configuration */}
      {activeTab === 'permissions' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Permission Configuration</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Fine-tune permission flags assigned to each active role
            </p>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Permission</th>
                  <th className="py-3 px-3">Module</th>
                  {roles.map((r) => (
                    <th key={r.id} className="py-3 px-4 text-center whitespace-nowrap">
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ALL_PERMISSIONS.map((p) => (
                  <tr key={p.key} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-medium text-slate-900">{p.label}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-medium">{p.category}</td>
                    {roles.map((r) => (
                      <td key={r.id} className="py-2.5 px-4 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${r.name} ${p.label}`}
                          checked={r.permissions.includes(p.key)}
                          onChange={() => onToggleRolePermission(r.id, p.key)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Courier Configuration */}
      {activeTab === 'couriers' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Courier Configuration</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Active couriers appear in the Postage Management tracking form when creating shipments
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!courierCode.trim() || !courierName.trim()) return;
              onAddCourier({
                code: courierCode.trim().toUpperCase(),
                name: courierName.trim(),
                trackingUrl: courierUrl.trim(),
                active: true,
              });
              setCourierCode('');
              setCourierName('');
              setCourierUrl('');
            }}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg items-end text-xs"
          >
            <div className="sm:col-span-2">
              <label htmlFor="new-cur-code" className="block font-medium text-slate-700 mb-1">
                Courier Code
              </label>
              <input
                id="new-cur-code"
                type="text"
                value={courierCode}
                onChange={(e) => setCourierCode(e.target.value)}
                placeholder="e.g. CTL"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md font-mono-tabular"
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="new-cur-name" className="block font-medium text-slate-700 mb-1">
                Courier Name
              </label>
              <input
                id="new-cur-name"
                type="text"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                placeholder="e.g. Citylink"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md"
              />
            </div>
            <div className="sm:col-span-5">
              <label htmlFor="new-cur-url" className="block font-medium text-slate-700 mb-1">
                Tracking URL
              </label>
              <input
                id="new-cur-url"
                type="text"
                value={courierUrl}
                onChange={(e) => setCourierUrl(e.target.value)}
                placeholder="e.g. https://www.citylinkexpress.com/tracking-result/?track0="
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md font-mono-tabular"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Courier
              </button>
            </div>
          </form>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                  <th className="py-2.5 px-4">Code</th>
                  <th className="py-2.5 px-4">Courier Name</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">URL</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {couriers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono-tabular font-semibold text-slate-800 whitespace-nowrap">
                      {c.code}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {c.name}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <StatusBadge status={c.active ? 'Active' : 'Inactive'} compact />
                    </td>
                    <td className="py-2.5 px-4 max-w-[300px]">
                      {c.trackingUrl ? (
                        <span
                          title={c.trackingUrl}
                          className="block truncate font-mono-tabular text-[11px] text-blue-700"
                        >
                          {c.trackingUrl}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => openEditCourier(c)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
                        >
                          <Edit2 className="w-3 h-3 text-slate-500" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleCourier(c.id)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                            c.active
                              ? 'text-slate-700 bg-white border-slate-200 hover:bg-slate-100'
                              : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {c.active ? 'Set Inactive' : 'Set Active'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Notification Preferences (Organized by Current System Pages) */}
      {activeTab === 'notifications' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-6 text-xs">
          {/* Header & Quick Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-semibold text-slate-900">Notification Preferences</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Kawalan penghantaran amaran emel &amp; notifikasi sistem automatik mengikut halaman dan aliran kerja terkini
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdateNotifications({
                    ...notifications,
                    notifyOnNewApplication: true,
                    notifyOnApprovalDecision: true,
                    notifyOnStockStatusChange: true,
                    notifyOnActionPassedStock: true,
                    notifyOnAgreementReceived: true,
                    notifyOnCheckingPassed: true,
                    notifyOnCheckingFailed: true,
                    notifyOnSaleSubmissionCreated: true,
                    notifyOnPostageTrackingUpdate: true,
                    notifyOnReadyToBeClaimed: true,
                    notifyOnAgreementClaimed: true,
                    dailyDigestEnabled: true,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                Enable All
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateNotifications({
                    ...notifications,
                    notifyOnNewApplication: false,
                    notifyOnApprovalDecision: false,
                    notifyOnStockStatusChange: false,
                    notifyOnActionPassedStock: false,
                    notifyOnAgreementReceived: false,
                    notifyOnCheckingPassed: false,
                    notifyOnCheckingFailed: false,
                    notifyOnSaleSubmissionCreated: false,
                    notifyOnPostageTrackingUpdate: false,
                    notifyOnReadyToBeClaimed: false,
                    notifyOnAgreementClaimed: false,
                    dailyDigestEnabled: false,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <BellOff className="w-3.5 h-3.5 text-rose-500" />
                Disable All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 1. Approval Management */}
            <div className="p-4 border border-slate-200/90 rounded-xl bg-slate-50/50 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200/70">
                <div className="w-6 h-6 rounded bg-amber-50 text-amber-600 flex items-center justify-center">
                  <ClipboardCheck className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-xs">Approval Management</h3>
                  <p className="text-[11px] text-slate-500">New Application &amp; Approval List</p>
                </div>
              </div>

              <div className="space-y-2">
                {[
                  {
                    key: 'notifyOnNewApplication' as const,
                    title: 'Permohonan Baharu Dihantar (New Application)',
                    desc: 'Maklumkan staf bertugas & cawangan apabila permohonan baharu didaftarkan.',
                  },
                  {
                    key: 'notifyOnApprovalDecision' as const,
                    title: 'Keputusan Kelulusan Permohonan (Approved / Rejected)',
                    desc: 'Maklumkan staf PIC cawangan apabila permohonan disahkan Approved atau Rejected.',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200/80 rounded-lg hover:border-slate-300 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-slate-900 text-xs">{item.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifications[item.key]}
                      onClick={() =>
                        onUpdateNotifications({
                          ...notifications,
                          [item.key]: !notifications[item.key],
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        notifications[item.key] ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          notifications[item.key] ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Stock Management */}
            <div className="p-4 border border-slate-200/90 rounded-xl bg-slate-50/50 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200/70">
                <div className="w-6 h-6 rounded bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Package className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-xs">Stock Management</h3>
                  <p className="text-[11px] text-slate-500">Semakan Stok &amp; Action Passed</p>
                </div>
              </div>

              <div className="space-y-2">
                {[
                  {
                    key: 'notifyOnStockStatusChange' as const,
                    title: 'Status Stok (Ready / Stok OTW / No Stock)',
                    desc: 'Makluman inventori semasa bagi tindakan susulan staf jualan dan cawangan.',
                  },
                  {
                    key: 'notifyOnActionPassedStock' as const,
                    title: 'Action Passed (Telefon Diserah ke Cawangan)',
                    desc: 'Pemberitahuan kepada Pickup Branch / Pos apabila telefon fizikal disahkan lulus.',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200/80 rounded-lg hover:border-slate-300 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-slate-900 text-xs">{item.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifications[item.key]}
                      onClick={() =>
                        onUpdateNotifications({
                          ...notifications,
                          [item.key]: !notifications[item.key],
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        notifications[item.key] ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          notifications[item.key] ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Agreement Management */}
            <div className="p-4 border border-slate-200/90 rounded-xl bg-slate-50/50 space-y-3 lg:col-span-2">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200/70">
                <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FileCheck2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-xs">Agreement Management</h3>
                  <p className="text-[11px] text-slate-500">
                    Agreement Receive (TERIMA), QC Checking, Sale Submission &amp; Postage Tracking
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {[
                  {
                    key: 'notifyOnAgreementReceived' as const,
                    title: 'Perjanjian Diterima di HQ (TERIMA)',
                    desc: 'Maklumkan pasukan QC di HQ apabila dokumen perjanjian fizikal selamat sampai.',
                  },
                  {
                    key: 'notifyOnCheckingPassed' as const,
                    title: 'Semakan QC Lulus (Checking Passed)',
                    desc: 'Perjanjian disahkan lengkap tandatangan, cop, invois & CAF untuk serahan jualan.',
                  },
                  {
                    key: 'notifyOnCheckingFailed' as const,
                    title: 'Semakan QC Gagal (Checking Failed)',
                    desc: 'Eskalasi serta-merta kepada cawangan asal jika terdapat isu atau dokumen hilang.',
                  },
                  {
                    key: 'notifyOnSaleSubmissionCreated' as const,
                    title: 'Senarai Serahan Jualan Dijana (Sale Submission)',
                    desc: 'Maklumkan kewangan & operasi apabila batch senarai serahan jualan rasmi dijana.',
                  },
                  {
                    key: 'notifyOnPostageTrackingUpdate' as const,
                    title: 'Penghantaran Pos Kurier & Status Tracking',
                    desc: 'Makluman nombor tracking kurier & kemas kini status penghantaran ke JCL Credit.',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200/80 rounded-lg hover:border-slate-300 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-slate-900 text-xs">{item.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifications[item.key]}
                      onClick={() =>
                        onUpdateNotifications({
                          ...notifications,
                          [item.key]: !notifications[item.key],
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        notifications[item.key] ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          notifications[item.key] ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Claim Management */}
            <div className="p-4 border border-slate-200/90 rounded-xl bg-slate-50/50 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200/70">
                <div className="w-6 h-6 rounded bg-teal-50 text-teal-600 flex items-center justify-center">
                  <HandCoins className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-xs">Claim Management</h3>
                  <p className="text-[11px] text-slate-500">To Be Claimed &amp; Claimed History</p>
                </div>
              </div>

              <div className="space-y-2">
                {[
                  {
                    key: 'notifyOnReadyToBeClaimed' as const,
                    title: 'Perjanjian Sedia Dituntut (To Be Claimed)',
                    desc: 'Peringatan apabila bungkusan disahkan sampai di JCL Credit dan sedia dituntut.',
                  },
                  {
                    key: 'notifyOnAgreementClaimed' as const,
                    title: 'Tuntutan Perjanjian Selesai (Claimed)',
                    desc: 'Maklumkan pengurusan dan akaun apabila bayaran tuntutan perjanjian berjaya dimuktamadkan.',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200/80 rounded-lg hover:border-slate-300 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-slate-900 text-xs">{item.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifications[item.key]}
                      onClick={() =>
                        onUpdateNotifications({
                          ...notifications,
                          [item.key]: !notifications[item.key],
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        notifications[item.key] ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          notifications[item.key] ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Overview & Daily KPI Digest */}
            <div className="p-4 border border-slate-200/90 rounded-xl bg-slate-50/50 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200/70">
                <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-xs">Overview &amp; Reports Digest</h3>
                  <p className="text-[11px] text-slate-500">Ringkasan Prestasi Harian &amp; Metrik</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200/80 rounded-lg">
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-slate-900 text-xs">
                      Emel Ringkasan Harian (Daily KPI Digest)
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Hantar emel ringkasan harian merangkumi permohonan baru, kelulusan, dan status stok.
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifications.dailyDigestEnabled}
                    onClick={() =>
                      onUpdateNotifications({
                        ...notifications,
                        dailyDigestEnabled: !notifications.dailyDigestEnabled,
                      })
                    }
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      notifications.dailyDigestEnabled ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        notifications.dailyDigestEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200/80 rounded-lg">
                  <div>
                    <label htmlFor="digest-time" className="font-semibold text-slate-900 text-xs block">
                      Waktu Penghantaran Ringkasan (Digest Time)
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Masa emel ringkasan dihantar setiap hari bekerja
                    </span>
                  </div>
                  <input
                    id="digest-time"
                    type="time"
                    value={notifications.dailyDigestTime}
                    disabled={!notifications.dailyDigestEnabled}
                    onChange={(e) =>
                      onUpdateNotifications({
                        ...notifications,
                        dailyDigestTime: e.target.value,
                      })
                    }
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 font-mono-tabular text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-50"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. General System Preferences */}
      {activeTab === 'general' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onUpdateSystemPrefs(sysDraft);
          }}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-xs"
        >
          <div>
            <h2 className="text-sm font-semibold text-slate-900">General System Preferences</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Core operational defaults for Khallegacy Installment System
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <label htmlFor="pref-company" className="block font-medium text-slate-700 mb-1">
                Company Legal Name
              </label>
              <input
                id="pref-company"
                type="text"
                value={sysDraft.companyName}
                onChange={(e) => setSysDraft({ ...sysDraft, companyName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="pref-sysname" className="block font-medium text-slate-700 mb-1">
                System Title
              </label>
              <input
                id="pref-sysname"
                type="text"
                value={sysDraft.systemName}
                onChange={(e) => setSysDraft({ ...sysDraft, systemName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="pref-dest" className="block font-medium text-slate-700 mb-1">
                Fixed Dispatch Destination
              </label>
              <input
                id="pref-dest"
                type="text"
                readOnly
                value={sysDraft.fixedDispatchDestination}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-600 font-semibold"
              />
            </div>
            <div>
              <label htmlFor="pref-pagesize" className="block font-medium text-slate-700 mb-1">
                Default Table Page Size
              </label>
              <select
                id="pref-pagesize"
                value={sysDraft.defaultPageSize}
                onChange={(e) =>
                  setSysDraft({ ...sysDraft, defaultPageSize: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value={5}>5 rows</option>
                <option value={10}>10 rows</option>
                <option value={25}>25 rows</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              Save System Preferences
            </button>
          </div>
        </form>
      )}

      {/* Edit Branch Card Modal */}
      <Modal
        open={Boolean(editingBranch)}
        onClose={() => setEditingBranch(null)}
        title="Edit Branch Card"
        subtitle={
          editingBranch
            ? `Kemaskini CODE, Branch Name, dan State bagi cawangan ${editingBranch.name}`
            : undefined
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingBranch(null)}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveBranchEdit}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors"
            >
              Save Changes
            </button>
          </>
        }
      >
        <div className="space-y-3.5 text-xs">
          {editBranchError && (
            <div role="alert" className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {editBranchError}
            </div>
          )}
          <div>
            <label htmlFor="modal-edit-br-code" className="block font-medium text-slate-700 mb-1">
              Branch CODE
            </label>
            <input
              id="modal-edit-br-code"
              type="text"
              value={editBranchCode}
              onChange={(e) => setEditBranchCode(e.target.value)}
              placeholder="e.g. SA-01"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-tabular uppercase bg-white text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="modal-edit-br-name" className="block font-medium text-slate-700 mb-1">
              Branch Name
            </label>
            <input
              id="modal-edit-br-name"
              type="text"
              value={editBranchName}
              onChange={(e) => setEditBranchName(e.target.value)}
              placeholder="e.g. Shah Alam HQ"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="modal-edit-br-state" className="block font-medium text-slate-700 mb-1">
              State (Negeri)
            </label>
            <input
              id="modal-edit-br-state"
              type="text"
              value={editBranchState}
              onChange={(e) => setEditBranchState(e.target.value)}
              placeholder="e.g. Selangor"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </Modal>

      {/* Edit Courier Card Modal */}
      <Modal
        open={Boolean(editingCourier)}
        onClose={() => setEditingCourier(null)}
        title="Edit Courier Card"
        subtitle={
          editingCourier
            ? `Kemaskini Courier Code, Courier Name dan Tracking URL bagi kurier ${editingCourier.name}`
            : undefined
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingCourier(null)}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCourierEdit}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors"
            >
              Save Changes
            </button>
          </>
        }
      >
        <div className="space-y-3.5 text-xs">
          {editCourierError && (
            <div role="alert" className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {editCourierError}
            </div>
          )}
          <div>
            <label htmlFor="modal-edit-cur-code" className="block font-medium text-slate-700 mb-1">
              Courier Code
            </label>
            <input
              id="modal-edit-cur-code"
              type="text"
              value={editCourierCode}
              onChange={(e) => setEditCourierCode(e.target.value)}
              placeholder="e.g. JTE"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-tabular uppercase bg-white text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="modal-edit-cur-name" className="block font-medium text-slate-700 mb-1">
              Courier Name
            </label>
            <input
              id="modal-edit-cur-name"
              type="text"
              value={editCourierName}
              onChange={(e) => setEditCourierName(e.target.value)}
              placeholder="e.g. J&T Express"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="modal-edit-cur-url" className="block font-medium text-slate-700 mb-1">
              Tracking URL
            </label>
            <input
              id="modal-edit-cur-url"
              type="text"
              value={editCourierUrl}
              onChange={(e) => setEditCourierUrl(e.target.value)}
              placeholder="e.g. https://www.jtexpress.my/tracking/"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-tabular bg-white text-slate-900 focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              No. tracking akan ditambah secara automatik selepas URL (jika berakhir dengan &quot;=&quot;, &quot;/&quot; atau &quot;?&quot;).
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
