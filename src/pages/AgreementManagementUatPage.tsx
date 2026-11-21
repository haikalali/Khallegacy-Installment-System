import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type JclQueueRecord = {
  application_id: number;
  case_id: string;
  customer_name: string;
  ic_number: string;
  phone: string;
  sale_submission_id: string;
  checking_status: string;
  dispatch_status: string;
  courier_id: string | null;
  courier_name: string | null;
  tracking_number: string | null;
  dispatch_date: string | null;
  dispatched_by: string | null;
  dispatch_remarks: string | null;
  jcl_receipt_status: string;
  jcl_received_date: string | null;
  jcl_confirmed_by: string | null;
  jcl_remarks: string | null;
};

type CourierOption = { id: string; name: string; active: boolean };

interface AgreementManagementUatPageProps {
  couriers: CourierOption[];
  onBack: () => void;
}

function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-MY', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function AgreementManagementUatPage({ couriers, onBack }: AgreementManagementUatPageProps) {
  const [records, setRecords] = useState<JclQueueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<JclQueueRecord | null>(null);
  const [action, setAction] = useState<'dispatch' | 'receipt'>('dispatch');
  const [courierId, setCourierId] = useState(couriers.find((item) => item.active)?.id ?? '');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [actionDate, setActionDate] = useState(todayLocal);
  const [remarks, setRemarks] = useState('');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase.rpc('list_jcl_agreement_dispatch_queue');
    if (loadError) {
      setError(loadError.message);
      setRecords([]);
    } else {
      setRecords((data ?? []) as JclQueueRecord[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;
    return records.filter((record) =>
      [record.case_id, record.customer_name, record.ic_number, record.phone,
        record.sale_submission_id, record.tracking_number ?? '', record.courier_name ?? '']
        .join(' ').toLowerCase().includes(term),
    );
  }, [records, search]);

  const ready = filtered.filter((record) => record.dispatch_status === 'Ready to Dispatch');
  const awaitingReceipt = filtered.filter((record) => record.dispatch_status === 'Dispatched');

  const openAction = (record: JclQueueRecord, nextAction: 'dispatch' | 'receipt') => {
    setSelected(record);
    setAction(nextAction);
    setCourierId(couriers.find((item) => item.active)?.id ?? '');
    setTrackingNumber('');
    setActionDate(todayLocal());
    setRemarks('');
    setError('');
    setNotice('');
  };

  const submitAction = async () => {
    if (!selected || !actionDate) return;
    setSaving(true);
    setError('');
    setNotice('');
    const result = action === 'dispatch'
      ? await supabase.rpc('dispatch_agreement_to_jcl', {
          p_application_id: selected.application_id,
          p_courier_id: courierId,
          p_tracking_number: trackingNumber.trim(),
          p_dispatch_date: actionDate,
          p_remarks: remarks.trim(),
        })
      : await supabase.rpc('confirm_jcl_agreement_receipt', {
          p_application_id: selected.application_id,
          p_received_date: actionDate,
          p_remarks: remarks.trim(),
        });

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    const completedCase = selected.case_id;
    setSelected(null);
    setNotice(action === 'dispatch'
      ? `Agreement ${completedCase} berjaya direkodkan sebagai Dispatched kepada JCL Credit.`
      : `Penerimaan JCL untuk agreement ${completedCase} berjaya disahkan.`);
    await loadRecords();
    setSaving(false);
  };

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Supabase UAT</p>
          <h2 className="mt-1 text-xl font-bold">Agreement Management · JCL Credit</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Urus penghantaran agreement yang telah Checking Passed dan dimasukkan ke Sale Submission.
            Rekod dispatch dan pengesahan penerimaan JCL diasingkan.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadRecords()} disabled={loading} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">Refresh</button>
          <button type="button" onClick={onBack} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Kembali</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">Ready to Dispatch</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{ready.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">Pending JCL Confirmation</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">{awaitingReceipt.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">Total dalam queue</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{filtered.length}</p>
        </div>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Carian CASE ID, nama, IC, telefon, Sale Submission atau tracking
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Taip untuk mencari..." className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600" />
      </label>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Memuatkan senarai agreement JCL Credit...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center">
          <p className="font-semibold text-slate-700">Tiada agreement dalam queue JCL Credit</p>
          <p className="mt-1 text-sm text-slate-500">Agreement akan muncul selepas Checking Passed dan Sale Submission diwujudkan.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[1100px] w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">CASE ID / Customer</th>
                <th className="px-3 py-3">Sale Submission</th>
                <th className="px-3 py-3">Dispatch</th>
                <th className="px-3 py-3">Courier / Tracking</th>
                <th className="px-3 py-3">JCL Receipt</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((record) => (
                <tr key={record.application_id} className="align-top hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-slate-900">{record.case_id}</p>
                    <p className="mt-1 text-slate-600">{record.customer_name}</p>
                    <p className="mt-1 text-slate-400">{record.phone} · {record.ic_number}</p>
                  </td>
                  <td className="px-3 py-3 font-medium">{record.sale_submission_id}</td>
                  <td className="px-3 py-3">
                    <p className={record.dispatch_status === 'Dispatched' ? 'font-semibold text-blue-700' : 'font-semibold text-amber-700'}>{record.dispatch_status}</p>
                    <p className="mt-1 text-slate-500">{formatDate(record.dispatch_date)} · {record.dispatched_by ?? '—'}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p>{record.courier_name ?? '—'}</p>
                    <p className="mt-1 font-mono text-slate-500">{record.tracking_number ?? '—'}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className={record.jcl_receipt_status === 'Received by JCL' ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>{record.jcl_receipt_status}</p>
                    <p className="mt-1 text-slate-500">{formatDate(record.jcl_received_date)} · {record.jcl_confirmed_by ?? '—'}</p>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {record.dispatch_status === 'Ready to Dispatch' ? (
                      <button type="button" onClick={() => openAction(record, 'dispatch')} className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700">Rekod Dispatch</button>
                    ) : (
                      <button type="button" onClick={() => openAction(record, 'receipt')} className="rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white hover:bg-emerald-700">Sahkan JCL Terima</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="agreement-action-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <h3 id="agreement-action-title" className="text-lg font-bold">{action === 'dispatch' ? 'Rekod Penghantaran ke JCL Credit' : 'Pengesahan Penerimaan JCL Credit'}</h3>
            <p className="mt-1 text-sm text-slate-500">{selected.case_id} · {selected.customer_name}</p>
            {action === 'dispatch' ? (
              <>
                <label className="mt-4 block text-sm font-medium">Courier
                  <select value={courierId} onChange={(event) => setCourierId(event.target.value)} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                    <option value="">Pilih courier</option>
                    {couriers.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className="mt-3 block text-sm font-medium">Tracking Number
                  <input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                </label>
              </>
            ) : (
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
                <p><span className="text-slate-500">Courier:</span> {selected.courier_name ?? '—'}</p>
                <p className="mt-1"><span className="text-slate-500">Tracking:</span> {selected.tracking_number ?? '—'}</p>
                <p className="mt-1"><span className="text-slate-500">Tarikh dispatch:</span> {formatDate(selected.dispatch_date)}</p>
              </div>
            )}
            <label className="mt-3 block text-sm font-medium">{action === 'dispatch' ? 'Tarikh Dispatch' : 'Tarikh JCL Terima'}
              <input type="date" value={actionDate} onChange={(event) => setActionDate(event.target.value)} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="mt-3 block text-sm font-medium">Remarks (optional)
              <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <p className="mt-3 text-xs text-slate-500">
              {action === 'dispatch'
                ? 'Selepas disimpan, status menjadi Dispatched dan menunggu pengesahan penerimaan JCL.'
                : 'Pengesahan ini menetapkan agreement_submission = DELIVERED. agreement_claimed kekal PENDING sehingga tuntutan sebenar dibuat.'}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={saving} onClick={() => setSelected(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Batal</button>
              <button type="button" disabled={saving || !actionDate || (action === 'dispatch' && (!courierId || !trackingNumber.trim()))} onClick={() => void submitAction()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Menyimpan...' : action === 'dispatch' ? 'Simpan Dispatch' : 'Sahkan Penerimaan'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
