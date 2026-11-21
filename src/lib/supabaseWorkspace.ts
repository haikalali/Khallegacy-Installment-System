import type {
  Branch,
  Courier,
  NotificationPreferences,
  SystemPreferences,
} from '../types/khallegacy';
import { supabase } from './supabase';

interface BranchRow {
  id: string;
  code: string;
  name: string;
  state: string;
  branch_type: 'PHYSICAL' | 'POSTAGE' | 'WEB' | 'AGENT';
  active: boolean;
}

interface CourierRow {
  id: string;
  code: string;
  name: string;
  tracking_url: string | null;
  active: boolean;
}

interface SettingsRow {
  id: string;
  notifications: NotificationPreferences;
  system_prefs: SystemPreferences;
}

export interface SupabaseWorkspaceDirectory {
  branches: Branch[];
  couriers: Courier[];
  notifications: NotificationPreferences;
  systemPrefs: SystemPreferences;
}

/**
 * Loads the shared workspace directory and settings after a Supabase Auth
 * session has been established. This is read-only; writes remain in their
 * dedicated repositories until each workflow is migrated and verified.
 */
export async function loadSupabaseWorkspaceDirectory(): Promise<SupabaseWorkspaceDirectory> {
  const [branchesResult, couriersResult, settingsResult] = await Promise.all([
    supabase
      .from('branches')
      .select('id, code, name, state, branch_type, active')
      .eq('active', true)
      .order('name')
      .returns<BranchRow[]>(),
    supabase
      .from('couriers')
      .select('id, code, name, tracking_url, active')
      .order('name')
      .returns<CourierRow[]>(),
    supabase
      .from('system_settings')
      .select('id, notifications, system_prefs')
      .eq('id', 'default-settings')
      .maybeSingle<SettingsRow>(),
  ]);

  if (branchesResult.error) {
    throw new Error('Senarai cawangan Supabase gagal dimuatkan.');
  }
  if (couriersResult.error) {
    throw new Error('Senarai courier Supabase gagal dimuatkan.');
  }
  if (settingsResult.error || !settingsResult.data) {
    throw new Error('Tetapan sistem Supabase belum tersedia atau gagal dimuatkan.');
  }

  const branches: Branch[] = (branchesResult.data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    state: row.state,
    active: row.active,
    branchType: row.branch_type,
  }));

  const couriers: Courier[] = (couriersResult.data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    active: row.active,
    ...(row.tracking_url ? { trackingUrl: row.tracking_url } : {}),
  }));

  return {
    branches,
    couriers,
    notifications: settingsResult.data.notifications,
    systemPrefs: settingsResult.data.system_prefs,
  };
}
