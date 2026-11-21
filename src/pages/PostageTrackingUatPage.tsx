import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Courier, PostageTrackingStatus, StaffUser } from '../types/khallegacy';
import { supabase } from '../lib/supabase';

type TrackingRow = {
  id: string;
  tracking_date: string;
  description: string;
  sale_submission_id: string | null;
  tracking_number: string;
  courier: string;
  status: PostageTrackingStatus;
  remarks: string | null;
  updated_at: string;
  updated_by: string;
};

type SubmissionRow = {
  submission_list_id: string;
  submission_date: string;
  agreement_count: number;
};

interface PostageTrackingUatPageProps {
  currentUser: StaffUser;
  couriers: Courier[];
  onBack: () => void;
}

const STATUS_OPTIONS: PostageTrackingStatus[] = [
  'PENDING',
  'IN TRANSIT',
  'OUT FOR DELIVERY',
  'DELIVERED',
  'FAILED / RETURNED',
];

function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDate(value: string): string {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function PostageTrackingUatPage({ currentUser, couriers, onBack }: PostageTrackingUatPageProps) {
  const [rows, setRows] = useState<TrackingRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(todayLocal);
  const [description, setDescription] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courier, setCourier] = useState(couriers.find((item) => item.active)?.name ?? '');
  const [status, setStatus] = useState<PostageTrackingStatus>('PENDING');
  const [remarks, setRemarks] = useState('');
  const [editing, setEditing] = useState<TrackingRow | null>(null);
  const [editStatus, setEditStatus] = useState<PostageTrackingStatus>('PENDING');
  const [editRemarks, setEditRemarks] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [trackingResult, submissionResult] = await Promise.all([
      supabase.from('postage_trackings').select('id, tracking_date, description, sale_submission_id, tracking_number, courier, status, remarks, updated_at, updated_by').order('tracking_date', { ascending: false }).order('updated_at', { ascending: false }),
      supabase.from('sale_submissions').select('submission_list_id, submission_date, agreement_count').order('submission_date', { ascending: false }),
    ]);
    if (trackingResult.error) {
      setError(trackingResult.error.message);
      setRows([]);
    } else {
      setRows((trackingResult.data ?? []) as TrackingRow[]);
    }
    if (submissionResult.error) {
      setError((previous) => previous || submissionResult.error.message);
      setSubmissions([]);
    } else {
      setSubmissions((submissionResult.data ?? []) as SubmissionRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const availableSubmissions = useMemo(() => {
    const linked = new Set(rows.map((row) => row.sale_submission_id).filter((value): value is string => Boolean(value)));
    return submissions.filter((item) => !linked.has(item.submission_list_id));
  }, [rows, submissions]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => [
      row.description,
      row.sale_submission_id ?? '',
      row.tracking_number,
      row.courier,
      row.status,
    ].join(' ').toLowerCase().includes(term));
  }, [rows, search]);

  const counts = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((row) => row.status === 'PENDING').length,
    transit: rows.filter((row) => row.status === 'IN TRANSIT' || row.status === 'OUT FOR DELIVERY').length,
    delivered: rows.filter((row) => row.status === 'DELIVERED').length,
  }), [rows]);

  const createTracking = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const selectedSubmission = submissions.find((item) => item.submission_list_id === submissionId);
    const finalDescription = description.trim() || (selectedSubmission
      ? `Sale Submission ${selectedSubmission.submission_list_id} (${selectedSubmission.agreement_count} agreements)`
      : '');
    const { error: insertError } = await supabase.from('postage_trackings').insert({
      id: `POST-${crypto.randomUUID()}`,
      tracking_date: date,
      description: finalDescription,
      sale_submission_id: submissionId || null,
      tracking_number: trackingNumber.trim().toUpperCase(),
      courier,
      status,
      remarks: remarks.trim() || null,
      updated_by: currentUser.name,
      updated_by_staff_id: currentUser.id,
    });
    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }
    setNotice('Rekod postage berjaya disimpan.');
    setDate(todayLocal());
    setDescription('');
    setSubmissionId('');
    setTrackingNumber('');
    setRemarks('');
    setStatus('PENDING');
    await load();
    setSaving(false);
  };

  const saveStatus = async () => {
    if (!editing) return;
    setSaving(true);
    setError('');
    setNotice('');
    const { error: updateError } = await supabase.from('postage_trackings').update({
      status: editStatus,
      remarks: editRemarks.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: currentUser.name,
      updated_by_staff_id: currentUser.id,
    }).eq('id', editing.id);
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }
    setEditing(null);
    setNotice(`Status tracking ${editing.tracking_number} berjaya dikemas kini.`);
    await load();
    setSaving(false);
  };

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Supabase UAT</p>
          <h2 className="mt-1 text-xl font-bold">Postage &amp; Tracking</h2>
          <p className="mt-1 text-sm text-slate-500">Rekod penghantaran dan kemas kini status sehingga Delivered. Data disimpan di Supabase UAT.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">Refresh</button>
          <button type="button" onClick={onBack} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Kembali</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Total Tracking', counts.total],
          ['Pending', counts.pending],
          ['In Transit', counts.transit],
          ['Delivered', counts.delivered],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <form onSubmit={createTracking} className="space-y-3 rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold">Tambah Tracking</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium">Tarikh
            <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm font-medium">Sale Submission (optional)
            <select value={submissionId} onChange={(event) => setSubmissionId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
              <option value="">Tidak dipautkan</option>
              {availableSubmissions.map((item) => <option key={item.submission_list_id} value={item.submission_list_id}>{item.submission_list_id} · {item.agreement_count} agreement · {formatDate(item.submission_date)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Courier
            <select required value={courier} onChange={(event) => setCourier(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
              <option value="">Pilih courier</option>
              {couriers.filter((item) => item.active).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">No. Tracking
            <input required value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Masukkan tracking number" />
          </label>
          <label className="text-sm font-medium">Status awal
            <select value={status} onChange={(event) => setStatus(event.target.value as PostageTrackingStatus)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
              {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Description
            <input value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Auto jika Sale Submission dipilih" />
          </label>
        </div>
        <label className="block text-sm font-medium">Remarks (optional)
          <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <div className="flex justify-end">
          <button type="submit" disabled={saving || !date || !trackingNumber.trim() || !courier} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan Tracking'}</button>
        </div>
        <p className="text-xs text-slate-500">Untuk melayakkan agreement masuk ke To Be Claimed, tracking mesti dipautkan kepada Sale Submission yang mengandungi agreement berkaitan dan statusnya DELIVERED.</p>
      </form>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block flex-1 text-sm font-medium text-slate-700">Carian tracking
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari description, submission, tracking atau courier..." className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <span className="text-sm text-slate-500">{filteredRows.length} rekod</span>
      </div>

      {loading ? <p className="py-8 text-center text-sm text-slate-500">Memuatkan rekod postage...</p> : filteredRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">Belum ada rekod postage.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[900px] w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr>
              <th className="px-3 py-3">Tarikh / Description</th><th className="px-3 py-3">Sale Submission</th><th className="px-3 py-3">Courier / Tracking</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Updated By</th><th className="px-3 py-3 text-right">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-3 py-3"><p className="font-semibold">{formatDate(row.tracking_date)}</p><p className="mt-1 text-slate-500">{row.description}</p></td>
                  <td className="px-3 py-3">{row.sale_submission_id ?? '—'}</td>
                  <td className="px-3 py-3"><p className="font-medium">{row.courier}</p><p className="mt-1 font-mono">{row.tracking_number}</p></td>
                  <td className="px-3 py-3"><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold">{row.status}</span></td>
                  <td className="px-3 py-3"><p>{row.updated_by}</p><p className="mt-1 text-slate-400">{new Date(row.updated_at).toLocaleString('en-MY')}</p></td>
                  <td className="px-3 py-3 text-right"><button type="button" onClick={() => { setEditing(row); setEditStatus(row.status); setEditRemarks(row.remarks ?? ''); setError(''); }} className="rounded-lg border border-slate-300 px-3 py-2 font-semibold hover:bg-slate-50">Update Status</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="tracking-edit-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
          <h3 id="tracking-edit-title" className="text-lg font-bold">Update Tracking Status</h3>
          <p className="mt-1 text-sm text-slate-500">{editing.tracking_number} · {editing.courier}</p>
          <label className="mt-4 block text-sm font-medium">Status
            <select value={editStatus} onChange={(event) => setEditStatus(event.target.value as PostageTrackingStatus)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
              {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="mt-3 block text-sm font-medium">Remarks
            <textarea value={editRemarks} onChange={(event) => setEditRemarks(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" disabled={saving} onClick={() => setEditing(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Batal</button>
            <button type="button" disabled={saving} onClick={() => void saveStatus()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan Status'}</button>
          </div>
        </div>
      </div>}
    </section>
  );
}
