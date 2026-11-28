import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Percent,
  Users,
  Network,
  Plus,
  Save,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  ArrowRight,
  Layers,
  X
} from 'lucide-react';
import { commissionService } from '../services/commissionService';
import {
  CommChannelRecord,
  CommIntermediaryRecord,
  CommStructureRecord,
  ProductLookupItem,
  CoverLookupItem
} from '../types/commission';

const HIERARCHY_LEVEL_OPTIONS = [
  { value: 'WRITING_AGENT', label: 'Writing Agent (Direct)' },
  { value: 'UNIT_MANAGER', label: 'Unit Manager (ORC)' },
  { value: 'BRANCH_MANAGER', label: 'Branch Manager (ORC)' },
  { value: 'REGIONAL_DIRECTOR', label: 'Regional Director (ORC)' },
  { value: 'BROKER', label: 'Broker' },
  { value: 'CHANNEL_PARTNER', label: 'Channel Partner' },
  { value: 'DIRECT_EXEC', label: 'Direct Sales Executive' }
];

type TabKey = 'structures' | 'intermediaries' | 'channels';

export const CommissionDefinitionPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('structures');

  const [channels, setChannels] = useState<CommChannelRecord[]>([]);
  const [intermediaries, setIntermediaries] = useState<CommIntermediaryRecord[]>([]);
  const [structures, setStructures] = useState<CommStructureRecord[]>([]);
  const [products, setProducts] = useState<ProductLookupItem[]>([]);
  const [covers, setCovers] = useState<CoverLookupItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // --- Structure Form State ---
  const [editingStructId, setEditingStructId] = useState<number | undefined>(undefined);
  const [structForm, setStructForm] = useState({
    structCode: '',
    structName: '',
    channelCode: 'AGENT',
    lobType: 'IL' as 'IL' | 'GL' | 'ALL',
    prodCode: '',
    coverCode: '', // Empty = Product-wise Default; Selected = Optional Cover-wise Override
    effectiveFrom: `${new Date().getFullYear()}-01-01`,
    effectiveTo: `${new Date().getFullYear()}-12-31`,
    status: 'ACTIVE' as 'DRAFT' | 'ACTIVE' | 'EXPIRED',
    remarks: '',
    tiers: [
      { tierOrder: 1, hierarchyLevel: 'WRITING_AGENT', tierLabel: 'Writing Agent (Direct)', commPct: 20, renewalCommPct: 5, overridingYn: 'N' as 'Y' | 'N' },
      { tierOrder: 2, hierarchyLevel: 'UNIT_MANAGER', tierLabel: 'Unit Manager (ORC)', commPct: 5, renewalCommPct: 1.5, overridingYn: 'Y' as 'Y' | 'N' },
      { tierOrder: 3, hierarchyLevel: 'BRANCH_MANAGER', tierLabel: 'Branch Manager (ORC)', commPct: 3, renewalCommPct: 1, overridingYn: 'Y' as 'Y' | 'N' },
      { tierOrder: 4, hierarchyLevel: 'REGIONAL_DIRECTOR', tierLabel: 'Regional Director (ORC)', commPct: 2, renewalCommPct: 0.5, overridingYn: 'Y' as 'Y' | 'N' }
    ]
  });

  // --- Intermediary Form State ---
  const [editingIntermId, setEditingIntermId] = useState<number | undefined>(undefined);
  const [intermForm, setIntermForm] = useState({
    intermediaryCode: '',
    intermediaryName: '',
    channelCode: 'AGENT',
    hierarchyLevel: 'WRITING_AGENT',
    parentIntermediaryId: '' as string,
    licenseNo: '',
    email: '',
    phone: '',
    branchName: 'Muscat Main Branch',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  });

  // --- Channel Form State ---
  const [channelForm, setChannelForm] = useState({
    channelCode: '',
    channelName: '',
    supportsHierarchyYn: 'N' as 'Y' | 'N',
    description: ''
  });

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ch, intr, strs, lookups] = await Promise.all([
        commissionService.listChannels(),
        commissionService.listIntermediaries(),
        commissionService.listStructures(),
        commissionService.listProductsAndCovers()
      ]);
      setChannels(ch);
      setIntermediaries(intr);
      setStructures(strs);
      setProducts(lookups.products);
      setCovers(lookups.covers);
      if (!structForm.prodCode && lookups.products.length > 0) {
        setStructForm((prev) => ({ ...prev, prodCode: lookups.products[0].prodCode }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load commission definitions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Auto-adjust default tiers when channel changes on new structure
  const handleChannelChangeInStruct = (newChannel: string) => {
    const chObj = channels.find((c) => c.CHANNEL_CODE === newChannel);
    const supportsHier = chObj?.SUPPORTS_HIERARCHY_YN === 'Y';
    setStructForm((prev) => ({
      ...prev,
      channelCode: newChannel,
      tiers: editingStructId
        ? prev.tiers
        : supportsHier
          ? [
              { tierOrder: 1, hierarchyLevel: 'WRITING_AGENT', tierLabel: 'Writing Agent (Direct)', commPct: 20, renewalCommPct: 5, overridingYn: 'N' },
              { tierOrder: 2, hierarchyLevel: 'UNIT_MANAGER', tierLabel: 'Unit Manager (ORC)', commPct: 5, renewalCommPct: 1.5, overridingYn: 'Y' },
              { tierOrder: 3, hierarchyLevel: 'BRANCH_MANAGER', tierLabel: 'Branch Manager (ORC)', commPct: 3, renewalCommPct: 1, overridingYn: 'Y' },
              { tierOrder: 4, hierarchyLevel: 'REGIONAL_DIRECTOR', tierLabel: 'Regional Director (ORC)', commPct: 2, renewalCommPct: 0.5, overridingYn: 'Y' }
            ]
          : [
              {
                tierOrder: 1,
                hierarchyLevel: newChannel === 'BROKER' ? 'BROKER' : 'CHANNEL_PARTNER',
                tierLabel: newChannel === 'BROKER' ? 'Brokerage Commission' : `${chObj?.CHANNEL_NAME || newChannel} Commission`,
                commPct: 15,
                renewalCommPct: 5,
                overridingYn: 'N'
              }
            ]
    }));
  };

  const resetStructForm = () => {
    setEditingStructId(undefined);
    setStructForm({
      structCode: '',
      structName: '',
      channelCode: 'AGENT',
      lobType: 'IL',
      prodCode: products[0]?.prodCode || '',
      coverCode: '',
      effectiveFrom: `${new Date().getFullYear()}-01-01`,
      effectiveTo: `${new Date().getFullYear()}-12-31`,
      status: 'ACTIVE',
      remarks: '',
      tiers: [
        { tierOrder: 1, hierarchyLevel: 'WRITING_AGENT', tierLabel: 'Writing Agent (Direct)', commPct: 20, renewalCommPct: 5, overridingYn: 'N' },
        { tierOrder: 2, hierarchyLevel: 'UNIT_MANAGER', tierLabel: 'Unit Manager (ORC)', commPct: 5, renewalCommPct: 1.5, overridingYn: 'Y' },
        { tierOrder: 3, hierarchyLevel: 'BRANCH_MANAGER', tierLabel: 'Branch Manager (ORC)', commPct: 3, renewalCommPct: 1, overridingYn: 'Y' },
        { tierOrder: 4, hierarchyLevel: 'REGIONAL_DIRECTOR', tierLabel: 'Regional Director (ORC)', commPct: 2, renewalCommPct: 0.5, overridingYn: 'Y' }
      ]
    });
  };

  const handleEditStructure = (s: CommStructureRecord) => {
    setEditingStructId(s.STRUCT_ID);
    setStructForm({
      structCode: s.STRUCT_CODE,
      structName: s.STRUCT_NAME,
      channelCode: s.CHANNEL_CODE,
      lobType: s.LOB_TYPE,
      prodCode: s.PROD_CODE,
      coverCode: s.COVER_CODE || '',
      effectiveFrom: s.EFFECTIVE_FROM,
      effectiveTo: s.EFFECTIVE_TO,
      status: s.STATUS,
      remarks: s.REMARKS || '',
      tiers: (s.tiers || []).map((t) => ({
        tierOrder: t.TIER_ORDER,
        hierarchyLevel: t.HIERARCHY_LEVEL,
        tierLabel: t.TIER_LABEL,
        commPct: Number(t.COMM_PCT),
        renewalCommPct: Number(t.RENEWAL_COMM_PCT),
        overridingYn: t.OVERRIDING_YN
      }))
    });
    setActiveTab('structures');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const saved = await commissionService.saveStructure({
        structId: editingStructId,
        structCode: structForm.structCode,
        structName: structForm.structName,
        channelCode: structForm.channelCode,
        lobType: structForm.lobType,
        prodCode: structForm.prodCode,
        coverCode: structForm.coverCode || null,
        effectiveFrom: structForm.effectiveFrom,
        effectiveTo: structForm.effectiveTo,
        status: structForm.status,
        remarks: structForm.remarks,
        tiers: structForm.tiers
      });
      setSuccessMsg(`Commission Structure "${saved.STRUCT_CODE}" (${saved.CALC_BASIS}-wise) saved successfully.`);
      resetStructForm();
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Failed to save commission structure');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStructure = async (s: CommStructureRecord) => {
    if (!window.confirm(`Deactivate commission structure "${s.STRUCT_CODE}"?`)) return;
    setError(null);
    setSuccessMsg(null);
    try {
      await commissionService.deleteStructure(s.STRUCT_ID);
      setSuccessMsg(`Structure "${s.STRUCT_CODE}" deactivated.`);
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Failed to delete structure');
    }
  };

  const handleSaveIntermediary = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const saved = await commissionService.saveIntermediary({
        intermediaryId: editingIntermId,
        intermediaryCode: intermForm.intermediaryCode,
        intermediaryName: intermForm.intermediaryName,
        channelCode: intermForm.channelCode,
        hierarchyLevel: intermForm.hierarchyLevel,
        parentIntermediaryId: intermForm.parentIntermediaryId ? Number(intermForm.parentIntermediaryId) : null,
        licenseNo: intermForm.licenseNo,
        email: intermForm.email,
        phone: intermForm.phone,
        branchName: intermForm.branchName,
        status: intermForm.status
      });
      setSuccessMsg(`Intermediary "${saved.INTERMEDIARY_CODE} — ${saved.INTERMEDIARY_NAME}" saved.`);
      setEditingIntermId(undefined);
      setIntermForm({
        intermediaryCode: '',
        intermediaryName: '',
        channelCode: 'AGENT',
        hierarchyLevel: 'WRITING_AGENT',
        parentIntermediaryId: '',
        licenseNo: '',
        email: '',
        phone: '',
        branchName: 'Muscat Main Branch',
        status: 'ACTIVE'
      });
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Failed to save intermediary');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const saved = await commissionService.saveChannel(channelForm);
      setSuccessMsg(`Distribution Channel "${saved.CHANNEL_CODE}" saved.`);
      setChannelForm({ channelCode: '', channelName: '', supportsHierarchyYn: 'N', description: '' });
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Failed to save channel');
    } finally {
      setSaving(false);
    }
  };

  // Covers filtered by selected product or LOB
  const availableCovers = covers.filter((c) => {
    if (!structForm.prodCode) return true;
    const prod = products.find((p) => p.prodCode === structForm.prodCode);
    if (c.prodCodes.length > 0 && c.prodCodes.includes(structForm.prodCode)) return true;
    if (prod && c.lob === prod.lob) return true;
    return false;
  });

  const totalFyPct = structForm.tiers.reduce((acc, t) => acc + (Number(t.commPct) || 0), 0);
  const totalRnPct = structForm.tiers.reduce((acc, t) => acc + (Number(t.renewalCommPct) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Percent className="w-6 h-6 text-indigo-600" />
            Commission Definition & Channel Setup
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure Product-wise (default) & optional Cover-wise commission percentages for Brokers, Agent Hierarchy (Direct + ORC), and other Distribution Channels.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadAll}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => navigate('/commission-management/policy-commission')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
          >
            Policy-wise Commission
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-rose-500 hover:text-rose-700"><X className="w-4 h-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-emerald-500 hover:text-emerald-700"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 pt-2 rounded-t-xl">
        <button
          onClick={() => setActiveTab('structures')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'structures'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Commission Structures ({structures.length})
        </button>
        <button
          onClick={() => setActiveTab('intermediaries')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'intermediaries'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Intermediaries & Agent Hierarchy ({intermediaries.length})
        </button>
        <button
          onClick={() => setActiveTab('channels')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'channels'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Network className="w-4 h-4" />
          Distribution Channels ({channels.length})
        </button>
      </div>

      {/* TAB 1: COMMISSION STRUCTURES */}
      {activeTab === 'structures' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveStructure} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {editingStructId ? `Edit Commission Structure (#${editingStructId})` : 'Define New Commission Structure'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Leave <strong>Cover (Optional)</strong> blank for a <strong>Product-wise Default</strong> structure, or choose a Cover to create a Cover-wise override.
                </p>
              </div>
              {editingStructId && (
                <button
                  type="button"
                  onClick={resetStructForm}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg bg-slate-100"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Structure Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. COM-AGT-TERM1-01"
                  value={structForm.structCode}
                  onChange={(e) => setStructForm({ ...structForm, structCode: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Structure Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Agency Hierarchy — Term Life Product Default"
                  value={structForm.structName}
                  onChange={(e) => setStructForm({ ...structForm, structName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Distribution Channel *</label>
                <select
                  value={structForm.channelCode}
                  onChange={(e) => handleChannelChangeInStruct(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  {channels.map((ch) => (
                    <option key={ch.CHANNEL_CODE} value={ch.CHANNEL_CODE}>
                      {ch.CHANNEL_NAME} ({ch.CHANNEL_CODE})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Product (Default Basis) *</label>
                <select
                  required
                  value={structForm.prodCode}
                  onChange={(e) => {
                    const p = products.find((x) => x.prodCode === e.target.value);
                    setStructForm({
                      ...structForm,
                      prodCode: e.target.value,
                      lobType: (p?.lob as 'IL' | 'GL') || 'IL',
                      coverCode: ''
                    });
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select Product --</option>
                  {products.map((p) => (
                    <option key={p.prodCode} value={p.prodCode}>
                      {p.prodCode} — {p.prodName} ({p.lob})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Cover (Optional Override)
                </label>
                <select
                  value={structForm.coverCode}
                  onChange={(e) => setStructForm({ ...structForm, coverCode: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Covers (Product-wise Default)</option>
                  {availableCovers.map((c) => (
                    <option key={c.coverCode} value={c.coverCode}>
                      {c.coverCode} — {c.coverName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Effective From *</label>
                <input
                  type="date"
                  required
                  value={structForm.effectiveFrom}
                  onChange={(e) => setStructForm({ ...structForm, effectiveFrom: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Effective To *</label>
                <input
                  type="date"
                  required
                  value={structForm.effectiveTo}
                  onChange={(e) => setStructForm({ ...structForm, effectiveTo: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {/* Calculation Basis Badge */}
            <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200">
              <div className="flex items-center gap-3 text-sm">
                <span className="font-semibold text-slate-700">Calculation Basis:</span>
                {structForm.coverCode ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    COVER-WISE OVERRIDE ({structForm.coverCode})
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                    PRODUCT-WISE DEFAULT
                  </span>
                )}
              </div>
              <div className="text-xs font-semibold text-slate-600">
                Total First Year: <span className="text-indigo-700">{totalFyPct.toFixed(2)}%</span>
                {' · '}
                Total Renewal: <span className="text-emerald-700">{totalRnPct.toFixed(2)}%</span>
              </div>
            </div>

            {/* Commission Tiers / Hierarchy Percentages */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Commission Percentage Tiers (Hierarchy / Channel Split)</h3>
                <button
                  type="button"
                  onClick={() =>
                    setStructForm((prev) => ({
                      ...prev,
                      tiers: [
                        ...prev.tiers,
                        {
                          tierOrder: prev.tiers.length + 1,
                          hierarchyLevel: 'UNIT_MANAGER',
                          tierLabel: 'Additional Tier',
                          commPct: 2,
                          renewalCommPct: 0.5,
                          overridingYn: 'Y'
                        }
                      ]
                    }))
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Tier
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-600 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Order</th>
                      <th className="px-3 py-2 text-left">Hierarchy Level</th>
                      <th className="px-3 py-2 text-left">Tier Label</th>
                      <th className="px-3 py-2 text-right">First Year (%)</th>
                      <th className="px-3 py-2 text-right">Renewal (%)</th>
                      <th className="px-3 py-2 text-center">Overriding (ORC)</th>
                      <th className="px-3 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {structForm.tiers.map((tier, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 w-16">
                          <input
                            type="number"
                            min={1}
                            value={tier.tierOrder}
                            onChange={(e) => {
                              const next = [...structForm.tiers];
                              next[idx].tierOrder = Number(e.target.value);
                              setStructForm({ ...structForm, tiers: next });
                            }}
                            className="w-14 px-2 py-1 text-xs border border-slate-300 rounded"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={tier.hierarchyLevel}
                            onChange={(e) => {
                              const next = [...structForm.tiers];
                              next[idx].hierarchyLevel = e.target.value;
                              const opt = HIERARCHY_LEVEL_OPTIONS.find((o) => o.value === e.target.value);
                              if (opt) next[idx].tierLabel = opt.label;
                              setStructForm({ ...structForm, tiers: next });
                            }}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                          >
                            {HIERARCHY_LEVEL_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={tier.tierLabel}
                            onChange={(e) => {
                              const next = [...structForm.tiers];
                              next[idx].tierLabel = e.target.value;
                              setStructForm({ ...structForm, tiers: next });
                            }}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                          />
                        </td>
                        <td className="px-3 py-2 w-28">
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            max={100}
                            value={tier.commPct}
                            onChange={(e) => {
                              const next = [...structForm.tiers];
                              next[idx].commPct = Number(e.target.value);
                              setStructForm({ ...structForm, tiers: next });
                            }}
                            className="w-24 px-2 py-1 text-xs text-right border border-slate-300 rounded font-semibold"
                          />
                        </td>
                        <td className="px-3 py-2 w-28">
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            max={100}
                            value={tier.renewalCommPct}
                            onChange={(e) => {
                              const next = [...structForm.tiers];
                              next[idx].renewalCommPct = Number(e.target.value);
                              setStructForm({ ...structForm, tiers: next });
                            }}
                            className="w-24 px-2 py-1 text-xs text-right border border-slate-300 rounded"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <select
                            value={tier.overridingYn}
                            onChange={(e) => {
                              const next = [...structForm.tiers];
                              next[idx].overridingYn = e.target.value as 'Y' | 'N';
                              setStructForm({ ...structForm, tiers: next });
                            }}
                            className="px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                          >
                            <option value="N">Direct (N)</option>
                            <option value="Y">Override (Y)</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {structForm.tiers.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setStructForm({
                                  ...structForm,
                                  tiers: structForm.tiers.filter((_, i) => i !== idx)
                                })
                              }
                              className="text-rose-500 hover:text-rose-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : editingStructId ? 'Update Structure' : 'Save Commission Structure'}
              </button>
            </div>
          </form>

          {/* Existing Commission Structures List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Configured Commission Structures</h3>
              <span className="text-xs text-slate-500">{structures.length} active structures</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left">Code & Name</th>
                    <th className="px-4 py-3 text-left">Channel</th>
                    <th className="px-4 py-3 text-left">Product / Cover</th>
                    <th className="px-4 py-3 text-left">Basis</th>
                    <th className="px-4 py-3 text-left">Commission Tiers (FY / RN %)</th>
                    <th className="px-4 py-3 text-left">Validity</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {structures.map((s) => (
                    <tr key={s.STRUCT_ID} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{s.STRUCT_CODE}</div>
                        <div className="text-xs text-slate-500">{s.STRUCT_NAME}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                          {s.CHANNEL_CODE}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{s.PROD_CODE} — {s.PROD_NAME}</div>
                        {s.COVER_CODE ? (
                          <div className="text-xs text-amber-700 font-medium">Cover: {s.COVER_CODE} ({s.COVER_NAME})</div>
                        ) : (
                          <div className="text-xs text-slate-400">All Covers (Default)</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            s.CALC_BASIS === 'COVER'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {s.CALC_BASIS}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {(s.tiers || []).map((t) => (
                            <div key={t.TIER_ID || t.TIER_ORDER} className="text-xs flex items-center gap-1.5">
                              <span className="font-medium text-slate-700">{t.TIER_LABEL}:</span>
                              <span className="font-bold text-indigo-700">{Number(t.COMM_PCT).toFixed(2)}%</span>
                              <span className="text-slate-400">/ RN {Number(t.RENEWAL_COMM_PCT).toFixed(2)}%</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {s.EFFECTIVE_FROM} to {s.EFFECTIVE_TO}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleEditStructure(s)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            title="Edit Structure"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStructure(s)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                            title="Deactivate Structure"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {structures.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">
                        No commission structures defined yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INTERMEDIARIES & AGENT HIERARCHY */}
      {activeTab === 'intermediaries' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveIntermediary} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-800">
                {editingIntermId ? 'Edit Intermediary' : 'Add Agent (with Hierarchy), Broker, or Channel Partner'}
              </h2>
              {editingIntermId && (
                <button
                  type="button"
                  onClick={() => setEditingIntermId(undefined)}
                  className="text-xs px-3 py-1 bg-slate-100 rounded-lg text-slate-600"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Intermediary Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AGT-003 / BRK-003"
                  value={intermForm.intermediaryCode}
                  onChange={(e) => setIntermForm({ ...intermForm, intermediaryCode: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name / Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rashid Al-Zadjali"
                  value={intermForm.intermediaryName}
                  onChange={(e) => setIntermForm({ ...intermForm, intermediaryName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Channel *</label>
                <select
                  value={intermForm.channelCode}
                  onChange={(e) => {
                    const ch = e.target.value;
                    setIntermForm({
                      ...intermForm,
                      channelCode: ch,
                      hierarchyLevel: ch === 'BROKER' ? 'BROKER' : ch === 'AGENT' ? 'WRITING_AGENT' : 'CHANNEL_PARTNER',
                      parentIntermediaryId: ''
                    });
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {channels.map((ch) => (
                    <option key={ch.CHANNEL_CODE} value={ch.CHANNEL_CODE}>{ch.CHANNEL_NAME}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Hierarchy Level *</label>
                <select
                  value={intermForm.hierarchyLevel}
                  onChange={(e) => setIntermForm({ ...intermForm, hierarchyLevel: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {HIERARCHY_LEVEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reports To (Upline Manager)</label>
                <select
                  value={intermForm.parentIntermediaryId}
                  onChange={(e) => setIntermForm({ ...intermForm, parentIntermediaryId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">None (Top Level / Independent)</option>
                  {intermediaries
                    .filter((x) => x.CHANNEL_CODE === intermForm.channelCode && x.INTERMEDIARY_ID !== editingIntermId)
                    .map((x) => (
                      <option key={x.INTERMEDIARY_ID} value={x.INTERMEDIARY_ID}>
                        {x.INTERMEDIARY_CODE} — {x.INTERMEDIARY_NAME} ({x.HIERARCHY_LEVEL})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">License No</label>
                <input
                  type="text"
                  value={intermForm.licenseNo}
                  onChange={(e) => setIntermForm({ ...intermForm, licenseNo: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Branch</label>
                <input
                  type="text"
                  value={intermForm.branchName}
                  onChange={(e) => setIntermForm({ ...intermForm, branchName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : editingIntermId ? 'Update Intermediary' : 'Save Intermediary'}
              </button>
            </div>
          </form>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800">Intermediary Directory & Reporting Hierarchy</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left">Code</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Channel</th>
                    <th className="px-4 py-3 text-left">Hierarchy Level</th>
                    <th className="px-4 py-3 text-left">Reports To (Upline)</th>
                    <th className="px-4 py-3 text-left">License / Branch</th>
                    <th className="px-4 py-3 text-center">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {intermediaries.map((i) => (
                    <tr key={i.INTERMEDIARY_ID} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-bold text-slate-900">{i.INTERMEDIARY_CODE}</td>
                      <td className="px-4 py-3 text-slate-800 font-medium">{i.INTERMEDIARY_NAME}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700">
                          {i.CHANNEL_CODE}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">{i.HIERARCHY_LEVEL}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {i.PARENT_INTERMEDIARY_CODE ? (
                          <span className="text-emerald-700 font-medium">
                            ↑ {i.PARENT_INTERMEDIARY_CODE} ({i.PARENT_INTERMEDIARY_NAME})
                          </span>
                        ) : (
                          <span className="text-slate-400">Top Level</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <div>{i.LICENSE_NO || '—'}</div>
                        <div>{i.BRANCH_NAME || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            setEditingIntermId(i.INTERMEDIARY_ID);
                            setIntermForm({
                              intermediaryCode: i.INTERMEDIARY_CODE,
                              intermediaryName: i.INTERMEDIARY_NAME,
                              channelCode: i.CHANNEL_CODE,
                              hierarchyLevel: i.HIERARCHY_LEVEL,
                              parentIntermediaryId: i.PARENT_INTERMEDIARY_ID ? String(i.PARENT_INTERMEDIARY_ID) : '',
                              licenseNo: i.LICENSE_NO || '',
                              email: i.EMAIL || '',
                              phone: i.PHONE || '',
                              branchName: i.BRANCH_NAME || '',
                              status: i.STATUS
                            });
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DISTRIBUTION CHANNELS */}
      {activeTab === 'channels' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveChannel} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">
              Add / Update Distribution Channel
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Channel Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DIGITAL_AGGREGATOR"
                  value={channelForm.channelCode}
                  onChange={(e) => setChannelForm({ ...channelForm, channelCode: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Channel Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Digital Aggregator"
                  value={channelForm.channelName}
                  onChange={(e) => setChannelForm({ ...channelForm, channelName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Supports Hierarchy?</label>
                <select
                  value={channelForm.supportsHierarchyYn}
                  onChange={(e) => setChannelForm({ ...channelForm, supportsHierarchyYn: e.target.value as 'Y' | 'N' })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="N">No (Flat / Single Level)</option>
                  <option value="Y">Yes (Multi-tier Hierarchy + ORC)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <input
                  type="text"
                  value={channelForm.description}
                  onChange={(e) => setChannelForm({ ...channelForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                <Save className="w-4 h-4" /> Save Channel
              </button>
            </div>
          </form>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left">Channel Code</th>
                  <th className="px-4 py-3 text-left">Channel Name</th>
                  <th className="px-4 py-3 text-center">Hierarchy Enabled</th>
                  <th className="px-4 py-3 text-left">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {channels.map((ch) => (
                  <tr key={ch.CHANNEL_CODE} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-bold text-slate-900">{ch.CHANNEL_CODE}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{ch.CHANNEL_NAME}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          ch.SUPPORTS_HIERARCHY_YN === 'Y'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {ch.SUPPORTS_HIERARCHY_YN === 'Y' ? 'YES (Multi-Tier)' : 'NO (Single-Tier)'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{ch.DESCRIPTION || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
