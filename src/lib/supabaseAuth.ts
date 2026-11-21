import type { Branch, PermissionKey, RoleConfig, StaffUser } from '../types/khallegacy';
import { supabase } from './supabase';

interface UsernameLoginResponse {
  session?: {
    access_token: string;
    refresh_token: string;
  };
  user?: {
    id: string;
    email?: string;
  };
  error?: string;
}

interface SupabaseStaffRow {
  id: string;
  auth_user_id: string;
  name: string;
  username: string;
  email: string;
  branch_id: string;
  role_id: string;
  status: 'Active' | 'Inactive';
  last_active: string | null;
}

interface SupabaseRoleRow {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
}

interface SupabaseBranchRow {
  id: string;
  code: string;
  name: string;
  state: string;
  branch_type: 'PHYSICAL' | 'POSTAGE' | 'WEB' | 'AGENT';
  active: boolean;
}

export interface SupabaseStaffSession {
  user: StaffUser;
  roles: RoleConfig[];
  branches: Branch[];
}

/**
 * Authenticates username/email through the server-side username-login function,
 * establishes the returned Supabase Auth session, then loads the signed-in
 * staff member's role permissions and branch metadata under RLS.
 *
 * This module is deliberately separate from App.tsx until operational data
 * reads and writes have been migrated and tested. Do not use demo/mock users
 * as an authorization source.
 */
export async function loginWithSupabase(
  identifier: string,
  password: string,
): Promise<SupabaseStaffSession> {
  const { data: loginData, error: loginError } =
    await supabase.functions.invoke<UsernameLoginResponse>('username-login', {
      body: { identifier: identifier.trim(), password },
    });

  if (loginError) {
    throw new Error('Login tidak berjaya. Sila semak username/email dan kata laluan.');
  }

  const session = loginData?.session;
  const authUserId = loginData?.user?.id;
  if (!session?.access_token || !session.refresh_token || !authUserId) {
    throw new Error(loginData?.error || 'Respons login Supabase tidak lengkap.');
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  if (sessionError) {
    throw new Error('Sesi login tidak dapat diwujudkan. Sila cuba lagi.');
  }

  try {
    const { data: staff, error: staffError } = await supabase
      .from('staff_users')
      .select('id, auth_user_id, name, username, email, branch_id, role_id, status, last_active')
      .eq('auth_user_id', authUserId)
      .maybeSingle<SupabaseStaffRow>();

    if (staffError || !staff || staff.status !== 'Active') {
      throw new Error('Akaun staf tidak aktif atau profil staf tidak ditemui.');
    }

    const [rolesResult, permissionsResult, branchesResult, overridesResult] = await Promise.all([
      supabase
        .from('roles')
        .select('id, name, description, active')
        .eq('active', true)
        .returns<SupabaseRoleRow[]>(),
      supabase
        .from('role_permissions')
        .select('role_id, permission_key')
        .returns<Array<{ role_id: string; permission_key: string }>>(),
      supabase
        .from('branches')
        .select('id, code, name, state, branch_type, active')
        .eq('active', true)
        .returns<SupabaseBranchRow[]>(),
      supabase
        .from('staff_permission_overrides')
        .select('permission_key, effect')
        .eq('staff_id', staff.id)
        .returns<Array<{ permission_key: string; effect: 'ALLOW' | 'DENY' }>>(),
    ]);

    if (rolesResult.error || permissionsResult.error || branchesResult.error || overridesResult.error) {
      throw new Error('Maklumat role, permission atau cawangan gagal dimuatkan.');
    }

    const permissionsByRole = new Map<string, PermissionKey[]>();
    for (const row of permissionsResult.data ?? []) {
      const current = permissionsByRole.get(row.role_id) ?? [];
      current.push(row.permission_key as PermissionKey);
      permissionsByRole.set(row.role_id, current);
    }

    const roles: RoleConfig[] = (rolesResult.data ?? []).map((role) => {
      const effectivePermissions = new Set(permissionsByRole.get(role.id) ?? []);
      if (role.id === 'role-manager' && staff.role_id === 'role-manager') {
        for (const override of overridesResult.data ?? []) {
          if (override.effect === 'ALLOW') {
            effectivePermissions.add(override.permission_key as PermissionKey);
          } else if (override.effect === 'DENY') {
            effectivePermissions.delete(override.permission_key as PermissionKey);
          }
        }
      }
      return {
        id: role.id,
        name: role.name,
        description: role.description ?? '',
        active: role.active,
        permissions: [...effectivePermissions],
      };
    });

    const activeRole = roles.find((role) => role.id === staff.role_id);
    if (!activeRole) {
      throw new Error('Role akaun staf tidak aktif atau tidak ditemui.');
    }

    const branches: Branch[] = (branchesResult.data ?? []).map((branch) => ({
      id: branch.id,
      code: branch.code,
      name: branch.name,
      state: branch.state,
      active: branch.active,
      branchType: branch.branch_type,
    }));

    if (!branches.some((branch) => branch.id === staff.branch_id)) {
      throw new Error('Cawangan akaun staf tidak aktif atau tidak ditemui.');
    }

    const user: StaffUser = {
      id: staff.id,
      name: staff.name,
      username: staff.username,
      email: staff.email,
      branchId: staff.branch_id,
      roleId: staff.role_id,
      status: staff.status,
      lastActive: staff.last_active ?? new Date().toISOString(),
    };

    return { user, roles, branches };
  } catch (error) {
    await supabase.auth.signOut();
    throw error instanceof Error
      ? error
      : new Error('Maklumat akaun staf gagal dimuatkan.');
  }
}

/** Signs out the current Supabase Auth session. */
export async function logoutFromSupabase(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error('Tidak berjaya log keluar daripada Supabase.');
}
