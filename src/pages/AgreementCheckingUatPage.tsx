import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Checklist = { cafDetails: boolean; invoiceDetails: boolean; signAndChopPages: boolean; customerSignatureComplete: boolean };
type CheckingRecord = {
  application_id: number; case_id: string; customer_name: string; ic_number: string; phone: string;
  received_at: string | null; received_by: string | null; checking_status: string;
  checking_checklist: Checklist; checking_staff1: string | null; checking_staff2: string | null;
  invoice_number: string | null; checking_remarks: string;
};
interface Props { onBack: () => void; }
const emptyChecklist: Checklist = { cafDetails:false, invoiceDetails:false, signAndChopPages:false, customerSignatureComplete:false };
const checklistLabels: Array<{key:keyof Checklist;label:string}> = [
  {key:'cafDetails',label:'CAF Details'},
  {key:'invoiceDetails',label:'Invoice Details'},
  {key:'signAndChopPages',label:'Sign & Chop Pages'},
  {key:'customerSignatureComplete',label:'Customer Signature Complete'},
];

export function AgreementCheckingUatPage({ onBack }: Props) {
  const [rows,setRows]=useState<CheckingRecord[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState<number|null>(null);
  const [search,setSearch]=useState('');
  const [selected,setSelected]=useState<CheckingRecord|null>(null);
  const [checklist,setChecklist]=useState<Checklist>(emptyChecklist);
  const [staff1,setStaff1]=useState('');
  const [staff2,setStaff2]=useState('');
  const [invoice,setInvoice]=useState('');
  const [remarks,setRemarks]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const load=useCallback(async()=>{setLoading(true);setError('');const {data,error:e}=await supabase.rpc('list_agreement_checking_queue');if(e){setError(e.message);setRows([]);}else setRows((data??[]) as CheckingRecord[]);setLoading(false);},[]);
  useEffect(()=>{void load();},[load]);
  const filtered=useMemo(()=>{const q=search.trim().toLowerCase();return q?rows.filter(x=>[x.case_id,x.customer_name,x.ic_number,x.phone,x.invoice_number??''].join(' ').toLowerCase().includes(q)):rows;},[rows,search]);
  const open=(row:CheckingRecord)=>{setSelected(row);setChecklist(row.checking_checklist??emptyChecklist);setStaff1(row.checking_staff1??'');setStaff2(row.checking_staff2??'');setInvoice(row.invoice_number??'');setRemarks(row.checking_remarks??'');setError('');};
  const save=async(status:'Checking in Progress'|'Checking Passed'|'Checking Failed')=>{
    if(!selected)return;
    setSaving(selected.application_id);setError('');setNotice('');
    const {error:e}=await supabase.rpc('update_agreement_checking',{p_application_id:selected.application_id,p_checking_status:status,p_checking_checklist:checklist,p_checking_staff1:staff1,p_checking_staff2:staff2,p_invoice_number:invoice,p_remarks:remarks});
    if(e){setError(e.message);setSaving(null);return;}
    const caseId=selected.case_id;setSelected(null);setNotice(status==='Checking Passed'? `${caseId} lulus checking dan kini layak untuk Sale Submission.`: `Status checking ${caseId} dikemas kini: ${status}.`);
    await load();setSaving(null);
  };
  const allChecked=checklistLabels.every(x=>checklist[x.key]);
  return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Supabase UAT</p><h2 className="mt-1 text-xl font-bold">Agreement Checking</h2><p className="mt-1 text-sm text-slate-500">Senarai hanya mengandungi agreement yang telah diterima melalui Agreement Receive.</p></div><div className="flex gap-2"><button onClick={()=>void load()} disabled={loading} className="rounded-lg border px-3 py-2 text-sm font-semibold">Refresh</button><button onClick={onBack} className="rounded-lg border px-3 py-2 text-sm font-semibold">Kembali</button></div></header>
    {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Agreement dalam proses checking / incomplete</p><p className="text-2xl font-bold">{filtered.length}</p></div>
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari CASE ID, nama, IC, telefon atau invoice..." className="w-full rounded-lg border px-3 py-2 text-sm"/>
    {loading?<p className="py-8 text-center text-sm text-slate-500">Memuatkan senarai...</p>:filtered.length===0?<p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Tiada agreement menunggu checking.</p>:
    <div className="overflow-x-auto rounded-xl border"><table className="min-w-[850px] w-full text-left text-xs"><thead className="bg-slate-50 uppercase text-slate-500"><tr><th className="p-3">CASE ID / Customer</th><th className="p-3">Received</th><th className="p-3">Checking Status</th><th className="p-3">Invoice No.</th><th className="p-3 text-right">Action</th></tr></thead><tbody className="divide-y">{filtered.map(row=><tr key={row.application_id}><td className="p-3"><strong>{row.case_id}</strong><p className="mt-1">{row.customer_name}</p></td><td className="p-3">{row.received_by??'—'}<p className="mt-1 text-slate-400">{row.received_at?new Date(row.received_at).toLocaleDateString('en-MY'):'—'}</p></td><td className="p-3 font-semibold">{row.checking_status==='Checking Failed'?'INCOMPLETE':row.checking_status}</td><td className="p-3">{row.invoice_number??'—'}</td><td className="p-3 text-right"><button onClick={()=>open(row)} className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white">Open Checking</button></td></tr>)}</tbody></table></div>}
    {selected&&<div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"><div role="dialog" aria-modal="true" className="my-6 w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl"><h3 className="text-lg font-bold">Agreement Checking</h3><p className="mt-1 text-sm text-slate-500">{selected.case_id} · {selected.customer_name}</p>
      <div className="mt-4 space-y-3 rounded-xl border p-4"><p className="text-sm font-semibold">Checking Checklist</p>{checklistLabels.map(item=><label key={item.key} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={checklist[item.key]} onChange={e=>setChecklist(prev=>({...prev,[item.key]:e.target.checked}))}/>{item.label}</label>)}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Checking Staff 1<input value={staff1} onChange={e=>setStaff1(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label><label className="text-sm font-medium">Checking Staff 2<input value={staff2} onChange={e=>setStaff2(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label><label className="text-sm font-medium sm:col-span-2">Invoice Number<input value={invoice} onChange={e=>setInvoice(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label></div>
      <label className="mt-3 block text-sm font-medium">Remarks<textarea value={remarks} onChange={e=>setRemarks(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
      {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2"><button disabled={saving!==null} onClick={()=>setSelected(null)} className="rounded-lg border px-3 py-2 text-sm font-semibold">Tutup</button><button disabled={saving!==null} onClick={()=>void save('Checking in Progress')} className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700">Save Checking</button><button disabled={saving!==null} onClick={()=>void save('Checking Failed')} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-700">Mark Incomplete</button><button disabled={saving!==null||!allChecked} onClick={()=>void save('Checking Passed')} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving!==null?'Saving...':'CHECKING PASSED'}</button></div>
    </div></div>}
  </section>;
}
