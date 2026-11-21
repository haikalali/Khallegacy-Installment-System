import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { SupabaseStaffSession } from '../lib/supabaseAuth';

interface ProductRow {
  id: string;
  product_name: string;
  category: string;
  model: string | null;
  description: string | null;
  active: boolean;
}

interface PricingRow {
  id: number;
  product_id: string;
  price_new: number;
  installment_12: number;
  installment_24: number;
  installment_36: number;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
}

interface ProductPricingPageProps {
  session: SupabaseStaffSession;
}

const today = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const money = (value: number) =>
  new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(Number(value));

const initialNumbers = {
  priceNew: '',
  installment12: '',
  installment24: '',
  installment36: '',
  effectiveFrom: today(),
};

export function ProductPricingPage({ session }: ProductPricingPageProps) {
  const canKeyIn = (session.roles.find((role) => role.id === session.user.roleId)?.permissions ?? [])
    .includes('key_in_product_pricing');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [prices, setPrices] = useState<PricingRow[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('Apple');
  const [model, setModel] = useState('');
  const [description, setDescription] = useState('');
  const [numbers, setNumbers] = useState(initialNumbers);
  const [newPriceNumbers, setNewPriceNumbers] = useState(initialNumbers);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [productsResult, pricesResult] = await Promise.all([
        supabase.from('products')
          .select('id, product_name, category, model, description, active')
          .order('product_name')
          .returns<ProductRow[]>(),
        supabase.from('product_pricing')
          .select('id, product_id, price_new, installment_12, installment_24, installment_36, effective_from, effective_to, created_at')
          .order('effective_from', { ascending: false })
          .returns<PricingRow[]>(),
      ]);
      if (productsResult.error) throw productsResult.error;
      if (pricesResult.error) throw pricesResult.error;
      const nextProducts = productsResult.data ?? [];
      setProducts(nextProducts);
      setPrices(pricesResult.data ?? []);
      setSelectedProductId((current) =>
        current && nextProducts.some((product) => product.id === current)
          ? current
          : nextProducts.find((product) => product.active)?.id ?? '',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuatkan katalog produk dan harga.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const submitNewProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { data, error: saveError } = await supabase.rpc('create_product_with_initial_pricing', {
        p_product_name: productName.trim(),
        p_category: category,
        p_model: model.trim(),
        p_description: description.trim(),
        p_price_new: Number(numbers.priceNew),
        p_installment_12: Number(numbers.installment12),
        p_installment_24: Number(numbers.installment24),
        p_installment_36: Number(numbers.installment36),
        p_effective_from: numbers.effectiveFrom,
      });
      if (saveError) throw saveError;
      setProductName('');
      setModel('');
      setDescription('');
      setNumbers({ ...initialNumbers, effectiveFrom: today() });
      setNotice('Produk dan harga permulaan berjaya disimpan.');
      await loadData();
      if (typeof data === 'string') setSelectedProductId(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Produk gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const submitNewPrice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProductId) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { error: saveError } = await supabase.rpc('add_product_price_version', {
        p_product_id: selectedProductId,
        p_price_new: Number(newPriceNumbers.priceNew),
        p_installment_12: Number(newPriceNumbers.installment12),
        p_installment_24: Number(newPriceNumbers.installment24),
        p_installment_36: Number(newPriceNumbers.installment36),
        p_effective_from: newPriceNumbers.effectiveFrom,
      });
      if (saveError) throw saveError;
      setNewPriceNumbers({ ...initialNumbers, effectiveFrom: today() });
      setNotice('Harga baharu berjaya disimpan. Rekod harga terdahulu dikekalkan dalam sejarah.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Harga baharu gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const productNameFor = (productId: string) =>
    products.find((product) => product.id === productId)?.product_name ?? productId;

  const numberFields = (
    values: typeof initialNumbers,
    setValues: (next: typeof initialNumbers) => void,
  ) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {([
        ['priceNew', 'Harga Baru (RM)'],
        ['installment12', 'Ansuran 12 Bulan (RM)'],
        ['installment24', 'Ansuran 24 Bulan (RM)'],
        ['installment36', 'Ansuran 36 Bulan (RM)'],
      ] as const).map(([key, label]) => (
        <label key={key} className="text-xs font-medium text-slate-600">
          {label}
          <input
            type="number" min="0" step="0.01" required
            value={values[key]}
            onChange={(event) => setValues({ ...values, [key]: event.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      ))}
      <label className="text-xs font-medium text-slate-600">
        Tarikh Mula Harga
        <input
          type="date" required
          value={values.effectiveFrom}
          onChange={(event) => setValues({ ...values, effectiveFrom: event.target.value })}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
    </div>
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">7. Product & Product Pricing · Supabase UAT</h2>
          <p className="mt-1 text-sm text-slate-500">Katalog produk, harga semasa dan sejarah harga.</p>
        </div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
          {canKeyIn ? 'KEY IN ENABLED' : 'READ ONLY'}
        </span>
      </div>

      {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}

      {canKeyIn && (
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <form onSubmit={submitNewProduct} className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800">Tambah Produk + Harga Permulaan</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-600 sm:col-span-2">Nama Produk
                <input required value={productName} onChange={(e) => setProductName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-slate-600">Kategori
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option>Apple</option><option>Android</option><option>Game&Console</option><option>Home Appliance</option>
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">Model / Varian
                <input value={model} onChange={(e) => setModel(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-slate-600 sm:col-span-2">Keterangan
                <input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="mt-4">{numberFields(numbers, setNumbers)}</div>
            <button disabled={saving} className="mt-4 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan Produk & Harga'}
            </button>
          </form>

          <form onSubmit={submitNewPrice} className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800">Tambah Harga Baharu</h3>
            <label className="mt-3 block text-xs font-medium text-slate-600">Pilih Produk
              <select required value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="">Pilih produk</option>
                {products.filter((product) => product.active).map((product) => <option key={product.id} value={product.id}>{product.product_name}{product.model ? ` · ${product.model}` : ''}</option>)}
              </select>
            </label>
            <div className="mt-4">{numberFields(newPriceNumbers, setNewPriceNumbers)}</div>
            <p className="mt-3 text-xs text-slate-500">Harga semasa akan ditamatkan sehari sebelum tarikh kuat kuasa harga baharu. Tarikh baharu mesti selepas tarikh mula harga semasa.</p>
            <button disabled={saving || !selectedProductId} className="mt-4 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan Harga Baharu'}
            </button>
          </form>
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-slate-800">Senarai Produk ({products.length})</h3>
          <button type="button" onClick={() => void loadData()} disabled={loading} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50">Refresh</button>
        </div>
        {loading ? <p className="py-6 text-sm text-slate-500">Memuatkan...</p> : products.length === 0 ? (
          <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Belum ada produk dalam katalog UAT.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Produk</th><th className="px-3 py-2">Kategori</th><th className="px-3 py-2">Model</th><th className="px-3 py-2">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{products.map((product) => <tr key={product.id}><td className="px-3 py-2 font-medium">{product.product_name}</td><td className="px-3 py-2">{product.category}</td><td className="px-3 py-2">{product.model || '—'}</td><td className="px-3 py-2">{product.active ? 'Active' : 'Inactive'}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6">
        <h3 className="font-semibold text-slate-800">Sejarah Harga ({prices.length})</h3>
        {prices.length === 0 ? (
          <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Belum ada rekod harga.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Produk</th><th className="px-3 py-2">Harga Baru</th><th className="px-3 py-2">12 Bulan</th><th className="px-3 py-2">24 Bulan</th><th className="px-3 py-2">36 Bulan</th><th className="px-3 py-2">Mula</th><th className="px-3 py-2">Tamat</th><th className="px-3 py-2">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{prices.map((price) => <tr key={price.id}><td className="px-3 py-2 font-medium">{productNameFor(price.product_id)}</td><td className="px-3 py-2 tabular-nums">{money(price.price_new)}</td><td className="px-3 py-2 tabular-nums">{money(price.installment_12)}</td><td className="px-3 py-2 tabular-nums">{money(price.installment_24)}</td><td className="px-3 py-2 tabular-nums">{money(price.installment_36)}</td><td className="px-3 py-2">{price.effective_from}</td><td className="px-3 py-2">{price.effective_to ?? '—'}</td><td className="px-3 py-2">{price.effective_to ? 'Historical' : 'Current'}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
