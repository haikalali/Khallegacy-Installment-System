import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Shield, Trash2 } from 'lucide-react';
import type { SupabaseStaffSession } from '../lib/supabaseAuth';
import { supabase } from '../lib/supabase';

interface ManagerTarget {
  id: string;
  name: string;
  username: string;
  status: string;
  role_id: string;
}

interface PermissionOption {
  permission_key: string;
  description: string;
}

interface OverrideRow {
  id: number;
  staff_id: string;
  permission_key: string;
  effect: 'ALLOW' | 'DENY';
  granted_by_staff_id: string | null;
  created_at: string;
}

interface ManagerPermissionOverridesProps {
  session: SupabaseStaffSession;
}

export function ManagerPermissionOverrides({ session }: ManagerPermissionOverridesProps) {
  const canManage = session.user.roleId === 'role-management' ||
    (session.roles.find((role) => role.id === session.user.roleId)?.permissions ?? [])
      .includes('manage_staff_permissions');

  const [targets, setTargets] = useState<ManagerTarget[]>([]);
  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedPermission, setSelectedPermission] = useState('');
  const [selectedEffect, setSelectedEffect] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadOverrides = useCallback(async (staffId: string) => {
    if (!staffId) {
      setOverrides([]);
      return;
    }
    const { data, error: queryError } = await supabase
      .from('staff_permission_overrides')
      .select('id, staff_id, permission_key, effect, granted_by_staff_id, created_at')
      .eq('staff_id', staffId)
      .order('permission_key')
      .returns<OverrideRow[]>();
    if (queryError) throw queryError;
    setOverrides(data ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [targetsResult, permissionsResult] = await Promise.all([
          supabase.rpc('list_permission_override_targets').returns<ManagerTarget[]>(),
          supabase.from('permissions').select('permission_key, description').order('permission_key').returns<PermissionOption[]>(),
        ]);
        if (targetsResult.error) throw targetsResult.error;
        if (permissionsResult.error) throw permissionsResult.error;
        if (!active) return;
        const rawTargets: ManagerTarget[] = Array.isArray(targetsResult.data)
          ? targetsResult.data as unknown as ManagerTarget[]
          : [];
        const nextTargets = rawTargets.filter((target: ManagerTarget) =>
          session.user.roleId === 'role-management'
            ? target.role_id === 'role-manager'
            : target.id !== session.user.id,
        );
        setTargets(nextTargets);
        setPermissions(permissionsResult.data ?? []);
        const initialTarget = nextTargets[0]?.id ?? '';
        setSelectedStaffId(initialTarget);
        if (initialTarget) await loadOverrides(initialTarget);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Gagal memuatkan pengurusan permission.');
      } finally {
        if (active) setLoading(false);
      }
    };
    if (canManage) void load();
    else setLoading(false);
    return () => { active = false; };
  }, [canManage, loadOverrides]);

  const selectedTarget = targets.find((target) => target.id === selectedStaffId);
  const visiblePermissions = selectedTarget?.role_id === 'role-sales-admin'
    ? permissions.filter((permission) => permission.permission_key === 'key_in_product_pricing')
    : permissions;

  const changeTarget = async (staffId: string) => {
    setSelectedStaffId(staffId);
    const target = targets.find((item) => item.id === staffId);
    if (target?.role_id === 'role-sales-admin') {
      setSelectedPermission('key_in_product_pricing');
    } else {
      setSelectedPermission('');
    }
    setError('');
    setNotice('');
    try {
      await loadOverrides(staffId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuatkan override staf.');
    }
  };

  const saveOverride = async () => {
    if (!selectedStaffId || !selectedPermission) {
      setError('Pilih staf dan permission terlebih dahulu.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { error: saveError } = await supabase
        .from('staff_permission_overrides')
        .upsert({
          staff_id: selectedStaffId,
          permission_key: selectedPermission,
          effect: selectedEffect,
          granted_by_staff_id: session.user.id,
        }, { onConflict: 'staff_id,permission_key' });
      if (saveError) throw saveError;
      await loadOverrides(selectedStaffId);
      setNotice('Override permission berjaya disimpan.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tidak berjaya menyimpan permission. Semak akses database.');
    } finally {
      setSaving(false);
    }
  };

  const removeOverride = async (row: OverrideRow) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { error: deleteError } = await supabase
        .from('staff_permission_overrides')
        .delete()
        .eq('id', row.id)
        .eq('staff_id', selectedStaffId);
      if (deleteError) throw deleteError;
      await loadOverrides(selectedStaffId);
      setNotice('Override telah ditarik balik.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tidak berjaya menarik balik override.');
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-blue-50 p-2 text-blue-700"><Shield className="h-5 w-5" /></div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Pengurusan Permission Manager</h2>
          <p className="mt-1 text-sm text-slate-500">Tetapkan ALLOW atau DENY untuk Manager lain. DENY mengatasi permission asas dan ALLOW.</p>
        </div>
      </div>

      {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Memuatkan data permission...</div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">Pilih Manager
              <select value={selectedStaffId} onChange={(event) => void changeTarget(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                {targets.length === 0 && <option value="">Tiada Manager untuk diuruskan</option>}
                {targets.map((target) => <option key={target.id} value={target.id}>{target.name} (@{target.username})</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">Permission
              <select value={selectedPermission} onChange={(event) => setSelectedPermission(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="">Pilih permission</option>
                {visiblePermissions.map((permission) => <option key={permission.permission_key} value={permission.permission_key}>{permission.description || permission.permission_key}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">Tindakan
              <select value={selectedEffect} onChange={(event) => setSelectedEffect(event.target.value as 'ALLOW' | 'DENY')} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="ALLOW">ALLOW — Benarkan</option>
                <option value="DENY">DENY — Sekat</option>
              </select>
            </label>
          </div>
          <button type="button" onClick={() => void saveOverride()} disabled={saving || loading || !selectedStaffId || !selectedPermission} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Simpan Override
          </button>

          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">Override aktif ({overrides.length})</h3>
            </div>
            {overrides.length === 0 ? (
              <p className="px-4 py-5 text-sm text-slate-500">Tiada override untuk Manager ini. Permission asas role masih digunakan.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {overrides.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{permissions.find((permission) => permission.permission_key === row.permission_key)?.description || row.permission_key}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">{row.permission_key}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={row.effect === 'ALLOW' ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700' : 'rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700'}>{row.effect}</span>
                      <button type="button" onClick={() => void removeOverride(row)} disabled={saving} aria-label={`Tarik balik ${row.permission_key}`} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
