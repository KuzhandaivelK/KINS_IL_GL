import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calculator,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  Settings,
  X,
  FileSpreadsheet,
  ShieldCheck,
  Search,
  Lock
} from 'lucide-react';
import { commissionService } from '../services/commissionService';
import {
  CommChannelRecord,
  CommIntermediaryRecord,
  EligibleCommPolicy,
  PolicyCommissionRecord,
  PolicyCommissionFullDetail
} from '../types/commission';

const fmtMoney = (val: number | undefined | null) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export const PolicyCommissionPage: React.FC = () => {
  const navigate = useNavigate();

  const [channels, setChannels] = useState<CommChannelRecord[]>([]);
  const [intermediaries, setIntermediaries] = useState<CommIntermediaryRecord[]>([]);
  const [eligiblePolicies, setEligiblePolicies] = useState<EligibleCommPolicy[]>([]);
  const [commissions, setCommissions] = useState<PolicyCommissionRecord[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<PolicyCommissionFullDetail | null>(null);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Calculation form
  const [selectedPolKey, setSelectedPolKey] = useState('');
  const [selectedIntermId, setSelectedIntermId] = useState('');
  const [premType, setPremType] = useState<'FY' | 'RN'>('FY');

  // Filters
  const [filterChannel, setFilterChannel] = useState('ALL');
  const [filterLob, setFilterLob] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterSearch, setFilterSearch] = useState('');

  // Approval remarks
  const [approvalRemarks, setApprovalRemarks] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ch, intr, pols, comms] = await Promise.all([
        commissionService.listChannels(),
        commissionService.listIntermediaries(),
        commissionService.listEligiblePolicies(),
        commissionService.listPolicyCommissions({
          channelCode: filterChannel,
          lobType: filterLob,
          status: filterStatus,
          polNo: filterSearch
        })
      ]);
      setChannels(ch);
      setIntermediaries(intr);
      setEligiblePolicies(pols);
      setCommissions(comms);
    } catch (err: any) {
      setError(err.message || 'Failed to load policy commission data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [filterChannel, filterLob, filterStatus]);

  const selectedPolicy = eligiblePolicies.find((p) => `${p.lobType}|${p.polNo}` === selectedPolKey);
  const isLockedForPremType =
    selectedPolicy &&
    ((premType === 'FY' && selectedPolicy.hasApprovedFyComm) ||
      (premType === 'RN' && selectedPolicy.hasApprovedRnComm));

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicy || !selectedIntermId) {
      setError('Please select both a Policy and an Intermediary (Agent / Broker / Channel).');
      return;
    }
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await commissionService.calculatePolicyCommission({
        polNo: selectedPolicy.polNo,
        lobType: selectedPolicy.lobType,
        intermediaryId: Number(selectedIntermId),
        premType
      });
      setSuccessMsg(
        `Commission ${res.summary.commNo} calculated for Policy ${selectedPolicy.polNo}: OMR ${fmtMoney(res.summary.totalComm)} (${res.summary.totalPct.toFixed(2)}%).`
      );
      setSelectedDetail(res.data);
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Failed to calculate policy commission');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewDetail = async (commNo: string) => {
    setError(null);
    try {
      const detail = await commissionService.getPolicyCommissionDetail(commNo);
      setSelectedDetail(detail);
      setApprovalRemarks('');
    } catch (err: any) {
      setError(err.message || 'Failed to load commission breakdown');
    }
  };

  const handleApprove = async (commNo: string) => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await commissionService.approveCommission(commNo, approvalRemarks || 'Approved and posted to GL');
      setSuccessMsg(`Commission ${commNo} approved! GL Voucher ${res.voucherNo} posted.`);
      setSelectedDetail(res.data);
      setApprovalRemarks('');
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Failed to approve commission');
    } finally {
      setActionLoading(false);
    }
  };

  // Summary metrics
  const totalPolicies = commissions.length;
  const totalPremium = commissions.reduce((s, c) => s + Number(c.POLICY_PREMIUM || 0), 0);
  const totalCommAmount = commissions.reduce((s, c) => s + Number(c.TOTAL_COMM_AMOUNT || 0), 0);
  const totalDirect = commissions.reduce((s, c) => s + Number(c.DIRECT_COMM_AMOUNT || 0), 0);
  const totalOverride = commissions.reduce((s, c) => s + Number(c.OVERRIDE_COMM_AMOUNT || 0), 0);
  const approvedCount = commissions.filter((c) => c.COMM_STATUS === 'APPROVED' || c.COMM_STATUS === 'PAID').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
            Policy-wise Commission Register & Calculation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Calculate, review, and approve policy-wise commissions across Individual & Group Life — including Agent Hierarchy Overriding Commissions (ORC) and Cover-wise splits.
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
            onClick={() => navigate('/commission-management/definition')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition"
          >
            <Settings className="w-4 h-4" />
            Commission Definition
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Commissioned Policies</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{totalPolicies}</div>
          <div className="text-xs text-emerald-600 mt-1 font-medium">{approvedCount} Approved / GL Posted</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Total Policy Premium</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">OMR {fmtMoney(totalPremium)}</div>
          <div className="text-xs text-slate-500 mt-1">Across filtered IL & GL policies</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Total Commission Amount</div>
          <div className="text-2xl font-bold text-indigo-700 mt-1">OMR {fmtMoney(totalCommAmount)}</div>
          <div className="text-xs text-slate-500 mt-1">
            Effective Avg: {totalPremium > 0 ? ((totalCommAmount / totalPremium) * 100).toFixed(2) : '0.00'}%
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Direct vs Hierarchy ORC</div>
          <div className="text-sm font-bold text-slate-800 mt-1.5">
            Direct: <span className="text-indigo-700">OMR {fmtMoney(totalDirect)}</span>
          </div>
          <div className="text-sm font-bold text-slate-800 mt-0.5">
            Upline ORC: <span className="text-amber-700">OMR {fmtMoney(totalOverride)}</span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Calculate Policy Commission Card */}
      <form onSubmit={handleCalculate} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-600" />
              Calculate Policy Commission (PL/SQL Engine)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Uses Product-wise commission by default, or automatically applies Cover-wise overrides if defined for the Channel & Product. Agent hierarchy ORC is computed automatically.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Select Policy (IL / GL) *</label>
            <select
              required
              value={selectedPolKey}
              onChange={(e) => setSelectedPolKey(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Select Policy --</option>
              {eligiblePolicies.map((p) => (
                <option key={`${p.lobType}|${p.polNo}`} value={`${p.lobType}|${p.polNo}`}>
                  [{p.lobType}] {p.polNo} — {p.insuredName} ({p.prodCode} | Prem: {fmtMoney(p.premium)})
                  {p.hasApprovedFyComm ? ' [FY Approved]' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Intermediary (Agent / Broker / Channel) *
            </label>
            <select
              required
              value={selectedIntermId}
              onChange={(e) => setSelectedIntermId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Select Intermediary --</option>
              {intermediaries.map((i) => (
                <option key={i.INTERMEDIARY_ID} value={i.INTERMEDIARY_ID}>
                  [{i.CHANNEL_CODE}] {i.INTERMEDIARY_CODE} — {i.INTERMEDIARY_NAME} ({i.HIERARCHY_LEVEL})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Year Type</label>
            <select
              value={premType}
              onChange={(e) => setPremType(e.target.value as 'FY' | 'RN')}
              className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="FY">FY (1st Yr)</option>
              <option value="RN">RN (Renewal)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={actionLoading || Boolean(isLockedForPremType)}
              className={`w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition ${
                isLockedForPremType
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isLockedForPremType ? (
                <>
                  <Lock className="w-4 h-4" /> Approved
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" /> {actionLoading ? 'Calculating...' : 'Calculate'}
                </>
              )}
            </button>
          </div>
        </div>

        {isLockedForPremType && (
          <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-lg">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              Policy <strong>{selectedPolicy?.polNo}</strong> already has an <strong>APPROVED {premType}</strong> commission. Recalculation is locked.
            </span>
          </div>
        )}
      </form>

      {/* Filters & Policy-wise Commission Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-3 justify-between">
          <h3 className="text-sm font-bold text-slate-800">Policy-wise Commission Amounts</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search Policy No..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') loadAll(); }}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Channels</option>
              {channels.map((ch) => (
                <option key={ch.CHANNEL_CODE} value={ch.CHANNEL_CODE}>{ch.CHANNEL_CODE}</option>
              ))}
            </select>
            <select
              value={filterLob}
              onChange={(e) => setFilterLob(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All LOB</option>
              <option value="IL">Individual Life (IL)</option>
              <option value="GL">Group Life (GL)</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Status</option>
              <option value="CALCULATED">Calculated</option>
              <option value="APPROVED">Approved</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600 uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">Comm No / Policy</th>
                <th className="px-4 py-3 text-left">Insured & Product</th>
                <th className="px-4 py-3 text-left">Channel & Intermediary</th>
                <th className="px-4 py-3 text-center">Basis / Type</th>
                <th className="px-4 py-3 text-right">Policy Premium</th>
                <th className="px-4 py-3 text-right">Total %</th>
                <th className="px-4 py-3 text-right">Direct / ORC</th>
                <th className="px-4 py-3 text-right">Commission Amt</th>
                <th className="px-4 py-3 text-center">Status / GL</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {commissions.map((c) => (
                <tr key={c.COMM_ID} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <div className="font-bold text-indigo-700">{c.COMM_NO}</div>
                    <div className="text-xs text-slate-700 font-semibold">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 mr-1">{c.LOB_TYPE}</span>
                      {c.POL_NO}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{c.INSURED_NAME}</div>
                    <div className="text-xs text-slate-500">{c.PROD_CODE} — {c.PROD_NAME}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700">
                      {c.CHANNEL_CODE}
                    </span>
                    <div className="text-xs text-slate-700 mt-0.5 font-medium">
                      {c.INTERMEDIARY_CODE} — {c.INTERMEDIARY_NAME}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        c.CALC_BASIS === 'COVER'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {c.CALC_BASIS}
                    </span>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-semibold">{c.PREM_TYPE}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-800">{fmtMoney(c.POLICY_PREMIUM)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{Number(c.TOTAL_COMM_PCT).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right text-xs">
                    <div className="text-slate-700">Dir: {fmtMoney(c.DIRECT_COMM_AMOUNT)}</div>
                    {Number(c.OVERRIDE_COMM_AMOUNT) > 0 && (
                      <div className="text-amber-700 font-semibold">ORC: {fmtMoney(c.OVERRIDE_COMM_AMOUNT)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-indigo-700">
                    OMR {fmtMoney(c.TOTAL_COMM_AMOUNT)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        c.COMM_STATUS === 'APPROVED' || c.COMM_STATUS === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {c.COMM_STATUS}
                    </span>
                    {c.GL_VOUCHER_NO && (
                      <div className="text-[11px] text-emerald-700 font-mono mt-0.5">{c.GL_VOUCHER_NO}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleViewDetail(c.COMM_NO)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
                    >
                      <Eye className="w-3.5 h-3.5" /> Breakdown
                    </button>
                  </td>
                </tr>
              ))}
              {commissions.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-400 text-sm">
                    No policy commissions calculated yet. Select a policy and intermediary above to calculate.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Commission Breakdown & GL Modal */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 sticky top-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Commission Breakdown — {selectedDetail.commission.COMM_NO}
                </h3>
                <p className="text-xs text-slate-500">
                  Policy <strong>{selectedDetail.commission.POL_NO}</strong> ({selectedDetail.commission.LOB_TYPE}) ·{' '}
                  {selectedDetail.commission.INSURED_NAME} · Basis: <strong>{selectedDetail.commission.CALC_BASIS}</strong> ({selectedDetail.commission.PREM_TYPE})
                </p>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Summary Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] uppercase font-semibold text-slate-500">Policy Premium</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    OMR {fmtMoney(selectedDetail.commission.POLICY_PREMIUM)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                  <div className="text-[11px] uppercase font-semibold text-indigo-700">Direct Commission</div>
                  <div className="text-base font-bold text-indigo-900 mt-0.5">
                    OMR {fmtMoney(selectedDetail.commission.DIRECT_COMM_AMOUNT)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="text-[11px] uppercase font-semibold text-amber-700">Hierarchy ORC</div>
                  <div className="text-base font-bold text-amber-900 mt-0.5">
                    OMR {fmtMoney(selectedDetail.commission.OVERRIDE_COMM_AMOUNT)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="text-[11px] uppercase font-semibold text-emerald-700">Total Commission</div>
                  <div className="text-base font-bold text-emerald-900 mt-0.5">
                    OMR {fmtMoney(selectedDetail.commission.TOTAL_COMM_AMOUNT)} ({Number(selectedDetail.commission.TOTAL_COMM_PCT).toFixed(2)}%)
                  </div>
                </div>
              </div>

              {/* Detail Table: Hierarchy & Cover Breakdown */}
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">
                  Hierarchy & Cover-wise Distribution ({selectedDetail.details.length} lines)
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left">Cover / Scope</th>
                        <th className="px-3 py-2 text-left">Structure</th>
                        <th className="px-3 py-2 text-left">Recipient Intermediary</th>
                        <th className="px-3 py-2 text-left">Level / Type</th>
                        <th className="px-3 py-2 text-right">Base Premium</th>
                        <th className="px-3 py-2 text-right">Rate %</th>
                        <th className="px-3 py-2 text-right">Commission Amt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedDetail.details.map((d) => (
                        <tr key={d.DETAIL_ID}>
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {d.COVER_CODE ? `${d.COVER_CODE} — ${d.COVER_NAME}` : d.COVER_NAME || 'Product Default'}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-500">{d.STRUCT_CODE}</td>
                          <td className="px-3 py-2">
                            <span className="font-bold text-slate-900">{d.INTERMEDIARY_CODE}</span>{' '}
                            <span className="text-slate-600">{d.INTERMEDIARY_NAME}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold ${
                                d.IS_OVERRIDE_YN === 'Y'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {d.HIERARCHY_LEVEL} {d.IS_OVERRIDE_YN === 'Y' ? '(ORC)' : '(Direct)'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{fmtMoney(d.BASE_PREMIUM)}</td>
                          <td className="px-3 py-2 text-right font-bold">{Number(d.COMM_PCT).toFixed(2)}%</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-indigo-700">
                            {fmtMoney(d.COMM_AMOUNT)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Approval Action (if CALCULATED) */}
              {selectedDetail.commission.COMM_STATUS === 'CALCULATED' && (
                <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-3">
                  <div className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Approve Commission & Post GL Accounting Entries
                  </div>
                  <div className="flex flex-col md:flex-row gap-3">
                    <input
                      type="text"
                      placeholder="Approval remarks (optional)..."
                      value={approvalRemarks}
                      onChange={(e) => setApprovalRemarks(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-indigo-200 rounded-lg bg-white"
                    />
                    <button
                      onClick={() => handleApprove(selectedDetail.commission.COMM_NO)}
                      disabled={actionLoading}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {actionLoading ? 'Approving...' : 'Approve & Post GL'}
                    </button>
                  </div>
                </div>
              )}

              {/* GL Accounting Entries */}
              {selectedDetail.glEntries.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-2">
                    Posted GL Accounting Entries — Voucher {selectedDetail.commission.GL_VOUCHER_NO}
                  </h4>
                  <div className="border border-emerald-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-emerald-50 text-emerald-800 uppercase border-b border-emerald-200">
                        <tr>
                          <th className="px-3 py-2 text-left">Account Code</th>
                          <th className="px-3 py-2 text-left">Account Name</th>
                          <th className="px-3 py-2 text-center">Dr / Cr</th>
                          <th className="px-3 py-2 text-right">Amount (OMR)</th>
                          <th className="px-3 py-2 text-left">Narration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-100">
                        {selectedDetail.glEntries.map((gl) => (
                          <tr key={gl.ENTRY_ID}>
                            <td className="px-3 py-2 font-mono font-bold text-slate-800">{gl.GL_ACCOUNT_CODE}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">{gl.GL_ACCOUNT_NAME}</td>
                            <td className="px-3 py-2 text-center">
                              <span
                                className={`px-2 py-0.5 rounded font-bold ${
                                  gl.DR_CR_FLAG === 'D' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {gl.DR_CR_FLAG === 'D' ? 'DEBIT' : 'CREDIT'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold">{fmtMoney(gl.AMOUNT)}</td>
                            <td className="px-3 py-2 text-slate-600">{gl.NARRATION}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
