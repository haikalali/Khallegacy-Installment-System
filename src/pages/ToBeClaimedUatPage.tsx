import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type ClaimProduct = {
  productName: string;
  model: string | null;
  quantity: number;
  unitPrice: number | string;
};

type ClaimRecord = {
  application_id: number;
  case_id: string;
  customer_name: string;
  ic_number: string;
  phone: string;
  pickup_branch_id: string | null;
  pickup_branch_name: string | null;
  total_product_price: number | string;
  total_financing_amount: number | string;
  processing_fee: number | string;
  sst_amount: number | string;
  stamp_duty: number | string;
  actual_cash_payment: number | string;
  sale_submission_id: string | null;
  tracking_number: string | null;
  courier: string | null;
  postage_status: string;
  products: ClaimProduct[] | null;
};

interface ToBeClaimedUatPageProps {
  onBack: () => void;
}

function localDateValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatRM(value: number | string): string {
  return `RM ${Number(value || 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ToBeClaimedUatPage({ onBack }: ToBeClaimedUatPageProps) {
  const [records, setRecords] = useState<ClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ClaimRecord | null>(null);
  const [claimDate, setClaimDate] = useState(localDateValue);
  const [remarks, setRemarks] = useState('');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase.rpc('list_to_be_claimed');
    if (loadError) {
      setError(loadError.message);
      setRecords([]);
    } else {
      setRecords((data ?? []) as ClaimRecord[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;
    return records.filter((record) =>
      [
        record.case_id,
        record.customer_name,
        record.ic_number,
        record.phone,
        record.sale_submission_id ?? '',
        ...(record.products ?? []).flatMap((product) => [product.productName, product.model ?? '']),
      ].join(' ').toLowerCase().includes(term),
    );
  }, [records, search]);

  const totalCashPayment = filtered.reduce(
    (sum, record) => sum + Number(record.actual_cash_payment || 0),
    0,
  );

  const openClaim = (record: ClaimRecord) => {
    setSelected(record);
    setClaimDate(localDateValue());
    setRemarks('');
    setError('');
    setSuccess('');
  };

  const confirmClaim = async () => {
    if (!selected || !claimDate) {
      setError('Sila pilih tarikh tuntutan.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    const { error: claimError } = await supabase.rpc('claim_agreement', {
      p_application_id: selected.application_id,
      p_claim_date: claimDate,
      p_remarks: remarks,
    });
    if (claimError) {
      setError(claimError.message);
      setSaving(false);
      return;
    }
    setSuccess(`Agreement ${selected.case_id} berjaya ditandakan sebagai Claimed.`);
    setSelected(null);
    setRemarks('');
    await loadRecords();
    setSaving(false);
  };

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Supabase UAT</p>
          <h2 className="mt-1 text-xl font-bold">To Be Claimed</h2>
          <p className="mt-1 text-sm text-slate-500">Hanya agreement Approved yang mempunyai status Delivered dan belum dituntut akan dipaparkan.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadRecords()} disabled={loading} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">Refresh</button>
          <button type="button" onClick={onBack} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Kembali</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">Agreement To Be Claimed</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{filtered.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">Total Actual Cash Payment</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{formatRM(totalCashPayment)}</p>
        </div>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Carian CASE ID, nama pelanggan, IC, telefon atau produk
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Taip untuk mencari..." className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600" />
      </label>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Sedang memuatkan rekod To Be Claimed...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center">
          <p className="font-semibold text-slate-700">Tiada agreement untuk dituntut</p>
          <p className="mt-1 text-sm text-slate-500">Rekod akan muncul selepas status postage menjadi Delivered dan agreement belum dituntut.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[1050px] w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">CASE ID / Customer</th>
                <th className="px-3 py-3">Product</th>
                <th className="px-3 py-3 text-right">Financing</th>
                <th className="px-3 py-3 text-right">Processing</th>
                <th className="px-3 py-3 text-right">SST</th>
                <th className="px-3 py-3 text-right">Stamp Duty</th>
                <th className="px-3 py-3 text-right">Actual Cash</th>
                <th className="px-3 py-3">Postage</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((record) => (
                <tr key={record.application_id} className="align-top hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-slate-900">{record.case_id}</p>
                    <p className="mt-1 text-slate-600">{record.customer_name}</p>
                    <p className="mt-1 text-slate-400">{record.pickup_branch_name ?? 'Branch belum ditetapkan'}</p>
                  </td>
                  <td className="px-3 py-3">
                    {(record.products ?? []).map((product, index) => (
                      <p key={index}>{product.productName}{product.model ? ` · ${product.model}` : ''}{Number(product.quantity) > 1 ? ` ×${product.quantity}` : ''}</p>
                    ))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatRM(record.total_financing_amount)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatRM(record.processing_fee)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatRM(record.sst_amount)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatRM(record.stamp_duty)}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-emerald-700">{formatRM(record.actual_cash_payment)}</td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{record.postage_status}</p>
                    <p className="mt-1 text-slate-500">{record.courier ?? '—'} · {record.tracking_number ?? '—'}</p>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button type="button" onClick={() => openClaim(record)} className="rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white hover:bg-emerald-700">Claimed</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="claim-dialog-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <h3 id="claim-dialog-title" className="text-lg font-bold">Confirm Agreement Claimed</h3>
            <p className="mt-1 text-sm text-slate-500">{selected.case_id} · {selected.customer_name}</p>
            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <div className="flex justify-between gap-3 text-sm"><span className="text-slate-500">Actual Cash Payment</span><strong>{formatRM(selected.actual_cash_payment)}</strong></div>
              <p className="mt-2 text-xs text-slate-500">Formula: Financing Amount − Processing Fee − SST − Stamp Duty.</p>
            </div>
            <label className="mt-4 block text-sm font-medium">
              Claim Date
              <input type="date" value={claimDate} onChange={(event) => setClaimDate(event.target.value)} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="mt-3 block text-sm font-medium">
              Remarks (optional)
              <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Catatan tuntutan..." />
            </label>
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={saving} onClick={() => setSelected(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Batal</button>
              <button type="button" disabled={saving || !claimDate} onClick={() => void confirmClaim()} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Menyimpan...' : 'Confirm Claimed'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
