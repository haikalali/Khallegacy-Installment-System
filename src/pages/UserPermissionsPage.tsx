import React, { useState } from 'react';
import { Edit2, Plus, Shield, UserCheck, UserX } from 'lucide-react';
import type { Branch, PermissionKey, RoleConfig, StaffUser } from '../types/khallegacy';
import { ALL_PERMISSIONS } from '../data/mockData';
import { formatDateTime } from '../utils/businessRules';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';

interface UserPermissionsPageProps {
  users: StaffUser[];
  roles: RoleConfig[];
  branches: Branch[];
  onToggleUserStatus: (userId: string) => void;
  onSaveUser: (user: Omit<StaffUser, 'id' | 'lastActive'>, existingId?: string) => void;
  onToggleRolePermission: (roleId: string, permission: PermissionKey) => void;
}

export const UserPermissionsPage: React.FC<UserPermissionsPageProps> = ({
  users,
  roles,
  branches,
  onToggleUserStatus,
  onSaveUser,
  onToggleRolePermission,
}) => {
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [roleId, setRoleId] = useState(roles[0]?.id || '');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [formError, setFormError] = useState('');

  const openAddModal = () => {
    setEditingUser(null);
    setName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setBranchId(branches[0]?.id || '');
    setRoleId(roles[0]?.id || '');
    setStatus('Active');
    setFormError('');
    setUserModalOpen(true);
  };

  const openEditModal = (u: StaffUser) => {
    setEditingUser(u);
    setName(u.name);
    setUsername(u.username);
    setEmail(u.email);
    setPassword('');
    setBranchId(u.branchId);
    setRoleId(u.roleId);
    setStatus(u.status);
    setFormError('');
    setUserModalOpen(true);
  };

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? id;
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      {/* Staff Users Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Staff Accounts</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage staff access, branch assignments, and operational roles
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Staff User
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Staff Name</th>
                <th className="py-3 px-3">Username</th>
                <th className="py-3 px-3">Email</th>
                <th className="py-3 px-3">Branch</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Account Status</th>
                <th className="py-3 px-3">Last Active</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                    {u.name}
                  </td>
                  <td className="py-3 px-3 font-mono-tabular text-slate-600 whitespace-nowrap">
                    {u.username}
                  </td>
                  <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{u.email}</td>
                  <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                    {branchName(u.branchId)}
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">
                    {roleName(u.roleId)}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <StatusBadge status={u.status} compact />
                  </td>
                  <td className="py-3 px-3 tabular-nums text-slate-500 whitespace-nowrap">
                    {formatDateTime(u.lastActive)}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleUserStatus(u.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border ${
                          u.status === 'Active'
                            ? 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100'
                            : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {u.status === 'Active' ? (
                          <>
                            <UserX className="w-3 h-3" /> Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3 h-3" /> Activate
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Role-Based Access Control Matrix */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start gap-3">
          <Shield className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Role-Based Access Control (RBAC) Permission Matrix
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Changes take effect immediately across sidebar navigation and operational actions. Switch your active operator in the top-right profile menu to test any role.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
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
              {ALL_PERMISSIONS.map((perm) => (
                <tr key={perm.key} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-medium text-slate-900">{perm.label}</td>
                  <td className="py-3 px-3 text-slate-500">{perm.category}</td>
                  {roles.map((role) => {
                    const checked = role.permissions.includes(perm.key);
                    return (
                      <td key={role.id} className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${role.name} - ${perm.label}`}
                          checked={checked}
                          onChange={() => onToggleRolePermission(role.id, perm.key)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add/Edit User Modal */}
      <Modal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title={editingUser ? 'Edit Staff Account' : 'Add Staff Account'}
        footer={
          <>
            <button
              type="button"
              onClick={() => setUserModalOpen(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!name.trim() || !username.trim() || !email.trim()) {
                  setFormError('Staff name, username, and email are required.');
                  return;
                }
                const trimmedPassword = password.trim();
                onSaveUser(
                  {
                    name: name.trim(),
                    username: username.trim(),
                    email: email.trim(),
                    ...(trimmedPassword
                      ? { password: trimmedPassword }
                      : editingUser?.password
                        ? { password: editingUser.password }
                        : {}),
                    branchId,
                    roleId,
                    status,
                  },
                  editingUser?.id,
                );
                setUserModalOpen(false);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              Save User
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          {formError && (
            <div role="alert" className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="usr-name" className="block font-medium text-slate-700 mb-1">
                Staff Name
              </label>
              <input
                id="usr-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="usr-username" className="block font-medium text-slate-700 mb-1">
                Username
              </label>
              <input
                id="usr-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-tabular"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="usr-email" className="block font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                id="usr-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="usr-password" className="block font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                id="usr-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  editingUser ? 'Leave blank to keep current' : 'Default: khallegacy123'
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="usr-branch" className="block font-medium text-slate-700 mb-1">
                Branch
              </label>
              <select
                id="usr-branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="usr-role" className="block font-medium text-slate-700 mb-1">
                Role
              </label>
              <select
                id="usr-role"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="usr-status" className="block font-medium text-slate-700 mb-1">
                Status
              </label>
              <select
                id="usr-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                className="w-full px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
