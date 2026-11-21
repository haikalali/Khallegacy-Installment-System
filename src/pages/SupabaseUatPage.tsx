import { useState, type FormEvent } from 'react';
import { loginWithSupabase, logoutFromSupabase, type SupabaseStaffSession } from '../lib/supabaseAuth';
import { loadSupabaseWorkspaceDirectory, type SupabaseWorkspaceDirectory } from '../lib/supabaseWorkspace';
import { supabase } from '../lib/supabase';

export function SupabaseUatPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<SupabaseStaffSession | null>(null);
  const [workspace, setWorkspace] = useState<SupabaseWorkspaceDirectory | null>(null);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSession(null);
    setWorkspace(null);
    try {
      const signedIn = await loginWithSupabase(identifier, password);
      setSession(signedIn);
      const directory = await loadSupabaseWorkspaceDirectory();
      setWorkspace(directory);
      setPassword('');
    } catch (err) {
      await supabase.auth.signOut().catch(() => undefined);
      setSession(null);
      setWorkspace(null);
      setError(err instanceof Error ? err.message : 'Ujian Supabase gagal.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logoutFromSupabase();
      setSession(null);
      setWorkspace(null);
      setIdentifier('');
      setPassword('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Log keluar gagal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-2xl bg-slate-900 p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Khallegacy Installment System</p>
          <h1 className="mt-2 text-2xl font-bold">Supabase UAT Test</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">Mod ujian sambungan Supabase. Firebase kekal sebagai sistem operasi asal dan tidak disentuh oleh halaman ujian ini.</p>
          <span className="mt-4 inline-flex rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">UAT · READ ONLY</span>
        </header>

        {!session ? (
          <form onSubmit={handleLogin} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">1. Uji login Supabase</h2>
            <p className="mt-1 text-sm text-slate-500">Gunakan akaun staf yang sudah mempunyai akaun Supabase Auth. Tiada akaun demo atau kata laluan lalai digunakan.</p>
            {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">Username atau email
                <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600" placeholder="Username / email" />
              </label>
              <label className="text-sm font-medium">Password
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600" placeholder="Password Supabase" />
              </label>
            </div>
            <button disabled={loading} className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{loading ? 'Sedang menguji...' : 'Login & Uji Sambungan'}</button>
          </form>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-lg font-semibold">2. Identiti dan permission</h2><p className="mt-1 text-sm text-slate-500">Sesi Supabase berjaya diwujudkan.</p></div>
              <button onClick={handleLogout} disabled={loading} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">Log keluar</button>
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Nama staf</dt><dd className="mt-1 font-semibold">{session.user.name}</dd></div>
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Username</dt><dd className="mt-1 font-semibold">{session.user.username}</dd></div>
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Role</dt><dd className="mt-1 font-semibold">{session.roles.find((r) => r.id === session.user.roleId)?.name ?? session.user.roleId}</dd></div>
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Status</dt><dd className="mt-1 font-semibold">{session.user.status}</dd></div>
            </dl>
            <h3 className="mt-5 text-sm font-semibold">Effective permissions ({session.roles.find((r) => r.id === session.user.roleId)?.permissions.length ?? 0})</h3>
            <div className="mt-2 flex flex-wrap gap-2">{(session.roles.find((r) => r.id === session.user.roleId)?.permissions ?? []).map((permission) => <span key={permission} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">{permission}</span>)}</div>
          </section>
        )}

        {workspace && (
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-semibold">3. Direktori cawangan ({workspace.branches.length})</h2>
              <ul className="mt-3 divide-y divide-slate-100">{workspace.branches.map((branch) => <li key={branch.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{branch.name} <span className="text-slate-400">({branch.code})</span></span><span className="text-xs text-slate-500">{branch.branchType ?? branch.state}</span></li>)}</ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-semibold">4. Courier ({workspace.couriers.length})</h2>
              <ul className="mt-3 divide-y divide-slate-100">{workspace.couriers.map((courier) => <li key={courier.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{courier.name} <span className="text-slate-400">({courier.code})</span></span><span className="text-xs text-slate-500">{courier.active ? 'Active' : 'Inactive'}</span></li>)}</ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2">
              <h2 className="font-semibold">5. Tetapan sistem</h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                <div><dt className="text-xs text-slate-500">Nama sistem</dt><dd className="text-sm font-medium">{workspace.systemPrefs.systemName}</dd></div>
                <div><dt className="text-xs text-slate-500">Syarikat</dt><dd className="text-sm font-medium">{workspace.systemPrefs.companyName}</dd></div>
                <div><dt className="text-xs text-slate-500">Destinasi agreement</dt><dd className="text-sm font-medium">{workspace.systemPrefs.fixedDispatchDestination}</dd></div>
              </dl>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 md:col-span-2">LULUS: Login Supabase, pemetaan staf/role/permission dan bacaan direktori serta tetapan berjaya.</div>
          </section>
        )}

        <footer className="text-xs leading-5 text-slate-500">Had ujian versi ini: bacaan direktori dan tetapan sahaja. Permohonan, stok, agreement, dokumen, postage dan claim belum disambungkan kepada operasi tulis Supabase. Jangan gunakan halaman ini untuk operasi pelanggan sebenar.</footer>
      </div>
    </main>
  );
}
