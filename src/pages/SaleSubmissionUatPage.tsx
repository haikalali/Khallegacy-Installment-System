import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type ReadyCase = {
  application_id: number; case_id: string; customer_name: string; ic_number: string; phone: string;
  products: { productName: string; model: string | null; quantity: number; unitPrice: number | string }[];
  total_product_price: number | string; total_financing_amount: number | string;
  processing_fee: number | string; sst_amount: number | string; stamp_duty: number | string;
  actual_cash_payment: number | string; checking_status: string; dispatch_status: string;
};
type Submission = {
  id: string; submission_list_id: string; submission_date: string; created_by: string;
  agreement_count: number; total_product_amount: number | string; total_finance_amount: number | string;
  total_actual_cash_payment: number | string; remarks: string;
};

type Props = { onBack: () => void };
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const rm = (v: number | string) => `RM ${Number(v || 0).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const dateText = (v: string) => new Date(`${v}T00:00:00`).toLocaleDateString('en-MY',{day:'2-digit',month:'short',year:'numeric'});

export function SaleSubmissionUatPage({ onBack }: Props) {
  const [ready,setReady]=useState<ReadyCase[]>([]);
  const [history,setHistory]=useState<Submission[]>([]);
  const [selected,setSelected]=useState<number[]>([]);
  const [submissionDate,setSubmissionDate]=useState(today);
  const [remarks,setRemarks]=useState('');
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const load=useCallback(async()=>{
    setLoading(true); setError('');
    const [eligible, submissions]=await Promise.all([
      supabase.rpc('list_ready_sale_submission_cases'),
      supabase.from('sale_submissions').select('id,submission_list_id,submission_date,created_by,agreement_count,total_product_amount,total_finance_amount,total_actual_cash_payment,remarks').order('submission_date',{ascending:false}).order('created_at',{ascending:false})
    ]);
    if(eligible.error){setError(eligible.error.message);setReady([]);}else setReady((eligible.data??[]) as ReadyCase[]);
    if(submissions.error){setError(p=>p||submissions.error.message);setHistory([]);}else setHistory((submissions.data??[]) as Submission[]);
    setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return ready.filter(x=>!q||[x.case_id,x.customer_name,x.ic_number,x.phone,...x.products.flatMap(p=>[p.productName,p.model??''])].join(' ').toLowerCase().includes(q));
  },[ready,search]);
  const chosen=ready.filter(x=>selected.includes(x.application_id));
  const totalCash=chosen.reduce((s,x)=>s+Number(x.actual_cash_payment||0),0);
  const toggle=(id:number,checked:boolean)=>setSelected(old=>checked?[...old,id]:old.filter(x=>x!==id));

  const create=async()=>{
    if(!selected.length){setError('Pilih sekurang-kurangnya satu kes.');return;}
    setSaving(true);setError('');setNotice('');
    const {data,error:rpcError}=await supabase.rpc('create_sale_submission',{
      p_application_ids:selected,p_submission_date:submissionDate,p_remarks:remarks.trim()
    });
    if(rpcError){setError(rpcError.message);setSaving(false);return;}
    const result=Array.isArray(data)?data[0]:data;
    setNotice(`Sale Submission ${result?.submission_list_id??''} berjaya dicipta dengan ${result?.agreement_count??selected.length} agreement.`);
    setSelected([]);setRemarks('');await load();setSaving(false);
  };

  return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Supabase UAT</p>
      <h2 className="mt-1 text-xl font-bold">Sale Submission</h2>
      <p className="mt-1 text-sm text-slate-500">Pilih kes yang Agreement Checking lulus dan Ready to Dispatch untuk digabungkan dalam satu submission.</p>
    </div><div className="flex gap-2">
      <button type="button" onClick={()=>void load()} disabled={loading} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Refresh</button>
      <button type="button" onClick={onBack} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Kembali</button>
    </div></div>
    {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {notice&&<div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border bg-slate-50 p-4"><p className="text-xs text-slate-500">Kes READY TO POST</p><p className="mt-1 text-2xl font-bold">{ready.length}</p></div>
      <div className="rounded-xl border bg-slate-50 p-4"><p className="text-xs text-slate-500">Dipilih · Actual Cash Payment</p><p className="mt-1 text-2xl font-bold">{selected.length} · {rm(totalCash)}</p></div>
    </div>
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><label className="flex-1 text-sm font-medium">Cari kes<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="CASE ID, pelanggan, IC, telefon atau produk" className="mt-1 w-full rounded-lg border px-3 py-2"/></label><span className="text-sm text-slate-500">{filtered.length} kes layak</span></div>
      {loading?<p className="py-8 text-center text-sm text-slate-500">Memuatkan kes...</p>:filtered.length===0?<div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">Tiada kes yang memenuhi kedua-dua syarat READY TO POST.</div>:
      <div className="overflow-x-auto rounded-lg border"><table className="min-w-[950px] w-full text-left text-xs">
        <thead className="bg-slate-50 uppercase text-slate-500"><tr><th className="p-3"><input type="checkbox" aria-label="Pilih semua kes dipaparkan" checked={filtered.length>0&&filtered.every(x=>selected.includes(x.application_id))} onChange={e=>setSelected(old=>e.target.checked?[...new Set([...old,...filtered.map(x=>x.application_id)])]:old.filter(id=>!filtered.some(x=>x.application_id===id)))}/></th><th className="p-3">CASE ID / Customer</th><th className="p-3">Product</th><th className="p-3 text-right">Finance Price</th><th className="p-3 text-right">Processing</th><th className="p-3 text-right">SST</th><th className="p-3 text-right">Stamp Duty</th><th className="p-3 text-right">Actual Cash</th><th className="p-3">Eligibility</th></tr></thead>
        <tbody className="divide-y">{filtered.map(x=><tr key={x.application_id} className="align-top hover:bg-slate-50">
          <td className="p-3"><input type="checkbox" checked={selected.includes(x.application_id)} onChange={e=>toggle(x.application_id,e.target.checked)} aria-label={`Pilih ${x.case_id}`}/></td>
          <td className="p-3"><b>{x.case_id}</b><p className="mt-1">{x.customer_name}</p><p className="text-slate-400">{x.ic_number} · {x.phone}</p></td>
          <td className="p-3">{x.products.map((p,i)=><p key={i}>{p.productName} {p.model??''} ×{p.quantity}</p>)}</td>
          <td className="p-3 text-right">{rm(x.total_financing_amount)}</td><td className="p-3 text-right">{rm(x.processing_fee)}</td><td className="p-3 text-right">{rm(x.sst_amount)}</td><td className="p-3 text-right">{rm(x.stamp_duty)}</td><td className="p-3 text-right font-semibold">{rm(x.actual_cash_payment)}</td>
          <td className="p-3"><p className="text-emerald-700">{x.checking_status}</p><p className="mt-1 text-emerald-700">{x.dispatch_status}</p></td>
        </tr>)}</tbody>
      </table></div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">Tarikh Sale Submission<input type="date" required value={submissionDate} onChange={e=>setSubmissionDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
        <label className="text-sm font-medium">Remarks (optional)<input value={remarks} onChange={e=>setRemarks(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Catatan submission"/></label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Kes akan dikunci daripada submission lain selepas berjaya disimpan. Semakan kelayakan dibuat semula dalam transaksi database.</p><button type="button" onClick={()=>void create()} disabled={saving||loading||!selected.length||!submissionDate} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving?'Mencipta...':`Create Sale Submission (${selected.length})`}</button></div>
    </div>
    <div className="space-y-3"><h3 className="font-semibold">Submission History</h3>
      {history.length===0?<p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">Belum ada Sale Submission.</p>:
      <div className="overflow-x-auto rounded-lg border"><table className="min-w-[700px] w-full text-left text-xs"><thead className="bg-slate-50 uppercase text-slate-500"><tr><th className="p-3">Submission ID / Date</th><th className="p-3">Created By</th><th className="p-3 text-right">Agreements</th><th className="p-3 text-right">Product Amount</th><th className="p-3 text-right">Finance Amount</th><th className="p-3 text-right">Actual Cash</th></tr></thead><tbody className="divide-y">{history.map(x=><tr key={x.id}><td className="p-3 font-semibold">{x.submission_list_id}<p className="mt-1 font-normal text-slate-500">{dateText(x.submission_date)}</p></td><td className="p-3">{x.created_by}</td><td className="p-3 text-right">{x.agreement_count}</td><td className="p-3 text-right">{rm(x.total_product_amount)}</td><td className="p-3 text-right">{rm(x.total_finance_amount)}</td><td className="p-3 text-right font-semibold">{rm(x.total_actual_cash_payment)}</td></tr>)}</tbody></table></div>}
    </div>
  </section>;
}
