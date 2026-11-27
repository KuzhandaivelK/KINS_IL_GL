import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Save,
  X
} from 'lucide-react';
import { reinsuranceService } from '../services/reinsuranceService';
import { RiTreatyMasterRecord, RiLayerType } from '../types/reinsurance';

export const TreatySetupPage: React.FC = () => {
  const navigate = useNavigate();

  const [treaties, setTreaties] = useState<RiTreatyMasterRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [editingTreatyId, setEditingTreatyId] = useState<number | undefined>(undefined);
  const [treatyForm, setTreatyForm] = useState({
    treatyCode: `TRT-IL-${new Date().getFullYear()}-02`,
    treatyName: '',
    lobType: 'IL' as 'IL' | 'GL' | 'ALL',
    treatyYear: new Date().getFullYear(),
    effectiveFrom: `${new Date().getFullYear()}-01-01`,
    effectiveTo: `${new Date().getFullYear()}-12-31`,
    currencyCode: 'OMR',
    treatyStatus: 'ACTIVE' as 'DRAFT' | 'ACTIVE' | 'EXPIRED',
    remarks: '',
    layers: [
      { layerOrder: 1, layerType: 'RETENTION' as RiLayerType, layerName: 'Company Retention', reinsurerName: 'Self Retention', cessionPct: 0, limitAmount: 100000, riCommissionPct: 0 },
      { layerOrder: 2, layerType: 'QUOTA_SHARE' as RiLayerType, layerName: 'Quota Share (CQS)', reinsurerName: 'Swiss Re', cessionPct: 40, limitAmount: 200000, riCommissionPct: 25 },
      { layerOrder: 3, layerType: 'SURPLUS_1' as RiLayerType, layerName: '1st Surplus Layer', reinsurerName: 'Munich Re', cessionPct: 0, limitAmount: 500000, riCommissionPct: 20 }
    ]
  });

  const loadTreaties = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await reinsuranceService.listTreaties();
      setTreaties(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load treaties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTreaties();
  }, []);

  const resetForm = () => {
    setEditingTreatyId(undefined);
    setTreatyForm({
      treatyCode: `TRT-IL-${new Date().getFullYear()}-${String(treaties.length + 1).padStart(2, '0')}`,
      treatyName: '',
      lobType: 'IL',
      treatyYear: new Date().getFullYear(),
      effectiveFrom: `${new Date().getFullYear()}-01-01`,
      effectiveTo: `${new Date().getFullYear()}-12-31`,
      currencyCode: 'OMR',
      treatyStatus: 'ACTIVE',
      remarks: '',
      layers: [
        { layerOrder: 1, layerType: 'RETENTION', layerName: 'Company Retention', reinsurerName: 'Self Retention', cessionPct: 0, limitAmount: 100000, riCommissionPct: 0 },
        { layerOrder: 2, layerType: 'QUOTA_SHARE', layerName: 'Quota Share (CQS)', reinsurerName: 'Swiss Re', cessionPct: 40, limitAmount: 200000, riCommissionPct: 25 },
        { layerOrder: 3, layerType: 'SURPLUS_1', layerName: '1st Surplus Layer', reinsurerName: 'Munich Re', cessionPct: 0, limitAmount: 500000, riCommissionPct: 20 }
      ]
    });
  };

  const handleSaveTreaty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!treatyForm.treatyCode || !treatyForm.treatyName || treatyForm.layers.length === 0) {
      setError('Treaty Code, Treaty Name, and at least one Layer are required.');
      return;
    }
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const saved = await reinsuranceService.saveTreaty({
        treatyId: editingTreatyId,
        ...treatyForm
      });
      setSuccessMsg(`Treaty ${saved.TREATY_CODE} saved successfully!`);
      setEditingTreatyId(undefined);
      await loadTreaties();
    } catch (err: any) {
      setError(err.message || 'Failed to save treaty');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav className="flex items-center space-x-2 text-xs font-medium text-slate-500 mb-1">
            <button onClick={() => navigate('/dashboard')} className="hover:text-navy">Dashboard</button>
            <span>/</span>
            <span>Administration</span>
            <span>/</span>
            <span className="text-indigo-700 font-semibold">Treaty Setup</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy tracking-tight flex items-center gap-2.5">
            <Layers className="w-7 h-7 text-indigo-600" />
            <span>Reinsurance Treaty Setup</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Configure Reinsurance Treaty arrangements for Retention, Quota Share (CQS), and Surplus Layers across Individual &amp; Group Life.
          </p>
        </div>

        <button
          type="button"
          onClick={loadTreaties}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Feedback */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Existing Treaties List */}
        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-sm font-extrabold text-navy">Configured Reinsurance Treaties ({treaties.length})</h2>
          {loading && treaties.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              Loading treaties...
            </div>
          ) : (
            treaties.map((t) => (
              <div key={t.TREATY_ID} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono font-black text-indigo-700">{t.TREATY_CODE}</span>
                    <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {t.TREATY_STATUS}
                    </span>
                    <h3 className="font-bold text-navy mt-1">{t.TREATY_NAME}</h3>
                    <p className="text-[11px] text-slate-400">
                      LOB: {t.LOB_TYPE} &bull; {t.EFFECTIVE_FROM} to {t.EFFECTIVE_TO}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTreatyId(t.TREATY_ID);
                      setTreatyForm({
                        treatyCode: t.TREATY_CODE,
                        treatyName: t.TREATY_NAME,
                        lobType: t.LOB_TYPE,
                        treatyYear: t.TREATY_YEAR,
                        effectiveFrom: t.EFFECTIVE_FROM,
                        effectiveTo: t.EFFECTIVE_TO,
                        currencyCode: t.CURRENCY_CODE,
                        treatyStatus: t.TREATY_STATUS,
                        remarks: t.REMARKS || '',
                        layers: (t.layers || []).map((l) => ({
                          layerOrder: l.LAYER_ORDER,
                          layerType: l.LAYER_TYPE,
                          layerName: l.LAYER_NAME,
                          reinsurerName: l.REINSURER_NAME,
                          cessionPct: Number(l.CESSION_PCT || 0),
                          limitAmount: Number(l.LIMIT_AMOUNT || 0),
                          riCommissionPct: Number(l.RI_COMMISSION_PCT || 0)
                        }))
                      });
                    }}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-navy font-bold hover:bg-slate-50"
                  >
                    Edit
                  </button>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                  {(t.layers || []).map((l, idx) => (
                    <div key={idx} className="p-2 flex items-center justify-between bg-slate-50/50">
                      <div>
                        <span className="font-bold text-slate-800">{l.LAYER_ORDER}. {l.LAYER_NAME}</span>
                        <span className="ml-1.5 text-[10px] text-slate-500">({l.REINSURER_NAME})</span>
                      </div>
                      <div className="text-right font-mono text-[11px]">
                        {l.LAYER_TYPE === 'QUOTA_SHARE' && <span className="text-indigo-700 font-bold mr-2">{l.CESSION_PCT}% CQS</span>}
                        <span className="font-bold text-navy">Limit: {Number(l.LIMIT_AMOUNT).toLocaleString('en-US')}</span>
                        {l.RI_COMMISSION_PCT > 0 && <span className="ml-2 text-emerald-700">Comm: {l.RI_COMMISSION_PCT}%</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create / Edit Treaty Form */}
        <form onSubmit={handleSaveTreaty} className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-extrabold text-navy">
              {editingTreatyId ? `Edit Treaty: ${treatyForm.treatyCode}` : 'Create New Treaty Arrangement'}
            </h2>
            {editingTreatyId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-indigo-700 font-bold hover:underline"
              >
                + New Treaty
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Treaty Code *</label>
              <input
                type="text"
                required
                disabled={!!editingTreatyId}
                value={treatyForm.treatyCode}
                onChange={(e) => setTreatyForm({ ...treatyForm, treatyCode: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Treaty Name *</label>
              <input
                type="text"
                required
                value={treatyForm.treatyName}
                onChange={(e) => setTreatyForm({ ...treatyForm, treatyName: e.target.value })}
                placeholder="e.g. 2026 Individual Life Combined QS & Surplus"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Line of Business</label>
              <select
                value={treatyForm.lobType}
                onChange={(e) => setTreatyForm({ ...treatyForm, lobType: e.target.value as any })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
              >
                <option value="IL">Individual Life (IL)</option>
                <option value="GL">Group Life (GL)</option>
                <option value="ALL">All Life Lines</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Effective From</label>
              <input
                type="date"
                value={treatyForm.effectiveFrom}
                onChange={(e) => setTreatyForm({ ...treatyForm, effectiveFrom: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Effective To</label>
              <input
                type="date"
                value={treatyForm.effectiveTo}
                onChange={(e) => setTreatyForm({ ...treatyForm, effectiveTo: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
          </div>

          {/* Treaty Layers Editor */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-navy uppercase tracking-wider">Treaty Layers (Retention / CQS / Surplus)</h3>
              <button
                type="button"
                onClick={() =>
                  setTreatyForm({
                    ...treatyForm,
                    layers: [
                      ...treatyForm.layers,
                      {
                        layerOrder: treatyForm.layers.length + 1,
                        layerType: 'SURPLUS_2',
                        layerName: 'Additional Surplus Layer',
                        reinsurerName: 'Hannover Re',
                        cessionPct: 0,
                        limitAmount: 500000,
                        riCommissionPct: 15
                      }
                    ]
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Layer</span>
              </button>
            </div>

            <div className="space-y-2">
              {treatyForm.layers.map((l, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500">Type</label>
                    <select
                      value={l.layerType}
                      onChange={(e) => {
                        const copy = [...treatyForm.layers];
                        copy[idx].layerType = e.target.value as RiLayerType;
                        setTreatyForm({ ...treatyForm, layers: copy });
                      }}
                      className="w-full rounded border border-slate-300 px-2 py-1 bg-white"
                    >
                      <option value="RETENTION">RETENTION</option>
                      <option value="QUOTA_SHARE">QUOTA_SHARE (CQS)</option>
                      <option value="SURPLUS_1">SURPLUS_1</option>
                      <option value="SURPLUS_2">SURPLUS_2</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500">Layer Name</label>
                    <input
                      type="text"
                      value={l.layerName}
                      onChange={(e) => {
                        const copy = [...treatyForm.layers];
                        copy[idx].layerName = e.target.value;
                        setTreatyForm({ ...treatyForm, layers: copy });
                      }}
                      className="w-full rounded border border-slate-300 px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500">Reinsurer</label>
                    <input
                      type="text"
                      value={l.reinsurerName}
                      onChange={(e) => {
                        const copy = [...treatyForm.layers];
                        copy[idx].reinsurerName = e.target.value;
                        setTreatyForm({ ...treatyForm, layers: copy });
                      }}
                      className="w-full rounded border border-slate-300 px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500">CQS %</label>
                    <input
                      type="number"
                      step="1"
                      value={l.cessionPct}
                      onChange={(e) => {
                        const copy = [...treatyForm.layers];
                        copy[idx].cessionPct = Number(e.target.value);
                        setTreatyForm({ ...treatyForm, layers: copy });
                      }}
                      className="w-full rounded border border-slate-300 px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500">Limit (OMR)</label>
                    <input
                      type="number"
                      step="1000"
                      value={l.limitAmount}
                      onChange={(e) => {
                        const copy = [...treatyForm.layers];
                        copy[idx].limitAmount = Number(e.target.value);
                        setTreatyForm({ ...treatyForm, layers: copy });
                      }}
                      className="w-full rounded border border-slate-300 px-2 py-1 font-bold"
                    />
                  </div>
                  <div className="flex items-end gap-1">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-500">Comm %</label>
                      <input
                        type="number"
                        step="0.5"
                        value={l.riCommissionPct}
                        onChange={(e) => {
                          const copy = [...treatyForm.layers];
                          copy[idx].riCommissionPct = Number(e.target.value);
                          setTreatyForm({ ...treatyForm, layers: copy });
                        }}
                        className="w-full rounded border border-slate-300 px-2 py-1"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setTreatyForm({
                          ...treatyForm,
                          layers: treatyForm.layers.filter((_, i) => i !== idx).map((x, i) => ({ ...x, layerOrder: i + 1 }))
                        })
                      }
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>{actionLoading ? 'Saving...' : 'Save Treaty Setup'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
