import type { StaffUser } from '../types/khallegacy';

export const DEFAULT_STAFF_PASSWORD = 'khallegacy123';
export const AUTH_STORAGE_KEY = 'khallegacy_auth_user_id';

export type AuthResult =
  | { ok: true; user: StaffUser }
  | { ok: false; error: string };

export function authenticateStaff(
  users: StaffUser[],
  identifier: string,
  password: string,
): AuthResult {
  const trimmedId = identifier.trim().toLowerCase();
  if (!trimmedId || !password) {
    return { ok: false, error: 'Please enter your username/email and password.' };
  }

  const matched = users.find(
    (u) =>
      u.username.toLowerCase() === trimmedId ||
      u.email.toLowerCase() === trimmedId,
  );

  if (!matched) {
    return { ok: false, error: 'Invalid username/email or password.' };
  }

  const expectedPassword = matched.password || DEFAULT_STAFF_PASSWORD;
  if (password !== expectedPassword) {
    return { ok: false, error: 'Invalid username/email or password.' };
  }

  if (matched.status !== 'Active') {
    return {
      ok: false,
      error: 'Your staff account is Inactive. Please contact a Manager to reactivate access.',
    };
  }

  return { ok: true, user: matched };
}

export function getSavedAuthUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return (
      window.sessionStorage.getItem(AUTH_STORAGE_KEY) ||
      window.localStorage.getItem(AUTH_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function saveAuthUserId(userId: string, remember: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, userId);
    if (remember) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, userId);
    } else {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota or private mode restrictions
  }
}

export function clearAuthUserId(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
