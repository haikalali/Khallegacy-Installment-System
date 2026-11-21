import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type ReceiveRecord = {
  application_id: number; case_id: string; customer_name: string; ic_number: string;
  phone: string; pickup_branch_id: string | null; customer_from_branch_id: string;
  stock_status: string; passed_stock: string; agreement_received: string; created_at: string;
};

interface Props { onBack: () => void; }

export function AgreementReceiveUatPage({ onBack }: Props) {
  const [rows, setRows] = useState<ReceiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: e } = await supabase.rpc('list_agreement_receive_queue');
    if (e) { setError(e.message); setRows([]); }
    else setRows((data ?? []) as ReceiveRecord[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter(x => [x.case_id,x.customer_name,x.ic_number,x.phone].join(' ').toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const receive = async (row: ReceiveRecord) => {
    if (!window.confirm(`Sahkan agreement untuk ${row.case_id} telah diterima?`)) return;
    setSaving(row.application_id); setError(''); setNotice('');
    const { error: e } = await supabase.rpc('receive_agreement', {
      p_application_id: row.application_id,
      p_received_at: new Date().toISOString(),
      p_remarks: remarks[row.application_id] ?? '',
    });
    if (e) setError(e.message);
    else { setNotice(`Agreement ${row.case_id} berjaya diterima dan dipindahkan ke Agreement Checking.`); await load(); }
    setSaving(null);
  };

  return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Supabase UAT</p><h2 className="mt-1 text-xl font-bold">Agreement Receive</h2><p className="mt-1 text-sm text-slate-500">Pelanggan hanya dipaparkan apabila Stock Status = READY dan Passed Stock = PASSED.</p></div>
      <div className="flex gap-2"><button onClick={() => void load()} disabled={loading} className="rounded-lg border px-3 py-2 text-sm font-semibold">Refresh</button><button onClick={onBack} className="rounded-lg border px-3 py-2 text-sm font-semibold">Kembali</button></div>
    </header>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Menunggu Agreement Received</p><p className="text-2xl font-bold">{filtered.length}</p></div>
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari CASE ID, nama, IC atau telefon..." className="w-full rounded-lg border px-3 py-2 text-sm"/>
    {loading ? <p className="py-8 text-center text-sm text-slate-500">Memuatkan senarai...</p> : filtered.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Tiada pelanggan yang layak menunggu Agreement Receive.</p> :
    <div className="overflow-x-auto rounded-xl border"><table className="min-w-[850px] w-full text-left text-xs"><thead className="bg-slate-50 uppercase text-slate-500"><tr><th className="p-3">CASE ID / Customer</th><th className="p-3">Contact</th><th className="p-3">Stock Status</th><th className="p-3">Passed Stock</th><th className="p-3">Remarks</th><th className="p-3 text-right">Action</th></tr></thead><tbody className="divide-y">{filtered.map(row=><tr key={row.application_id}><td className="p-3"><strong>{row.case_id}</strong><p className="mt-1">{row.customer_name}</p></td><td className="p-3">{row.phone}<p className="mt-1 text-slate-400">{row.ic_number}</p></td><td className="p-3 font-semibold text-emerald-700">{row.stock_status}</td><td className="p-3 font-semibold text-emerald-700">{row.passed_stock}</td><td className="p-3"><input value={remarks[row.application_id] ?? ''} onChange={e=>setRemarks(prev=>({...prev,[row.application_id]:e.target.value}))} placeholder="Optional" className="w-40 rounded border px-2 py-1"/></td><td className="p-3 text-right"><button disabled={saving!==null} onClick={()=>void receive(row)} className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-50">{saving===row.application_id?'Menyimpan...':'RECEIVE'}</button></td></tr>)}</tbody></table></div>}
  </section>;
}
