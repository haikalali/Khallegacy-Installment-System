import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  User,
} from 'lucide-react';
import type { Branch, RoleConfig, StaffUser } from '../types/khallegacy';
import { DEFAULT_STAFF_PASSWORD, type AuthResult } from '../utils/auth';

interface LoginPageProps {
  users: StaffUser[];
  roles: RoleConfig[];
  branches: Branch[];
  onLogin: (identifier: string, password: string, remember: boolean) => AuthResult;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  users,
  roles,
  branches,
  onLogin,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [showAccounts, setShowAccounts] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onLogin(identifier, password, rememberMe);
    if (!res.ok) {
      setError(res.error);
    } else {
      setError('');
    }
  };

  const handleFillAccount = (user: StaffUser) => {
    setIdentifier(user.username);
    setPassword(user.password || DEFAULT_STAFF_PASSWORD);
    setError('');
  };

  const getRoleName = (roleId: string) =>
    roles.find((r) => r.id === roleId)?.name ?? 'Staff';

  const getBranchName = (branchId: string) =>
    branches.find((b) => b.id === branchId)?.name ?? 'HQ';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 shadow-sm">
        {/* Left Brand Panel */}
        <div className="lg:col-span-5 bg-[#0F172A] text-white p-7 sm:p-9 flex flex-col justify-between gap-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3.5">
              <img
                src="/khallegacy-logo.png"
                alt="Khallegacy Logo"
                className="w-12 h-12 rounded-full object-cover shrink-0 border border-slate-700"
              />
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Khallegacy
                </h1>
                <p className="text-xs text-slate-400">
                  Installment Management System
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Operational Lifecycle Portal
              </h2>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    Application entry, branch approval tracking &amp; automated JCL cover page PDFs.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    Stock confirmation, agreement receive, quality checking &amp; sale submission lists.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    Courier postage tracking &amp; JCL Credit claim settlement monitoring.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Role-Based Access Control · Authorized Staff Only</span>
          </div>
        </div>

        {/* Right Sign-In Form */}
        <div className="lg:col-span-7 p-7 sm:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Staff Log In
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Enter your staff username or email address to continue.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-identifier"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Username or Email
              </label>
              <div className="relative">
                <User
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="login-identifier"
                  type="text"
                  autoFocus
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="e.g. haikal.ops or haikal@khallegacy.com.my"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-all"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-10 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Keep me logged in</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono-tabular">
                Default pass: {DEFAULT_STAFF_PASSWORD}
              </span>
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-lg transition-colors"
            >
              <span>Log In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Staff Accounts Quick-Fill Directory */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowAccounts((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs font-medium text-slate-600 hover:text-slate-900 py-1"
            >
              <span>Staff Accounts Quick Fill ({users.filter((u) => u.status === 'Active').length} active)</span>
              {showAccounts ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showAccounts && (
              <div className="mt-2.5 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-52 overflow-y-auto">
                {users.map((u) => {
                  const isActive = u.status === 'Active';
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleFillAccount(u)}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-900 truncate">
                          {u.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono-tabular truncate">
                          {u.username} · {getRoleName(u.roleId)} · {getBranchName(u.branchId)}
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-semibold shrink-0 ${
                          isActive ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {u.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
