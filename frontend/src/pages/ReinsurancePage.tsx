import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import {
  Shield,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Eye,
  BookOpen,
  Calculator,
  X,
  Search
} from 'lucide-react';
import { reinsuranceService } from '../services/reinsuranceService';
import {
  RiTreatyMasterRecord,
  RiPolicyAllocationRecord,
  RiAllocationDetail,
  EligiblePolicyForRi
} from '../types/reinsurance';

export const ReinsurancePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromWorkbasket = searchParams.get('from') === 'workbasket';
  const { user } = useAuth();
  const userGroup = (user?.userGroup || 'ADMIN').toUpperCase();
  const canApproveRi = userGroup === 'RIUSER' || userGroup === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'allocations' | 'detail'>('allocations');
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [treaties, setTreaties] = useState<RiTreatyMasterRecord[]>([]);
  const [allocations, setAllocations] = useState<RiPolicyAllocationRecord[]>([]);
  const [eligiblePolicies, setEligiblePolicies] = useState<EligiblePolicyForRi[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<RiAllocationDetail | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Quick Allocate Form
  const [selectedPolNo, setSelectedPolNo] = useState<string>('');
  const [selectedTreatyId, setSelectedTreatyId] = useState<number>(0);

  // Approval Remarks
  const [approvalRemarks, setApprovalRemarks] = useState<string>('');

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [trtList, allocList, polList] = await Promise.all([
        reinsuranceService.listTreaties(),
        reinsuranceService.listAllocations({ status: statusFilter, search: searchQuery }),
        reinsuranceService.listEligiblePolicies()
      ]);
      setTreaties(trtList);
      setAllocations(allocList);
      setEligiblePolicies(polList);

      if (polList.length > 0 && !selectedPolNo) {
        setSelectedPolNo(polList[0].polNo);
      }
      if (trtList.length > 0 && !selectedTreatyId) {
        const active = trtList.find((t) => t.TREATY_STATUS === 'ACTIVE') || trtList[0];
        setSelectedTreatyId(active.TREATY_ID);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load Reinsurance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [statusFilter, searchQuery]);

  // Auto-open specific allocation when redirected from Workbasket (?allocNo=...&from=workbasket)
  useEffect(() => {
    const allocNoParam = searchParams.get('allocNo');
    if (allocNoParam && allocNoParam !== selectedDetail?.allocation.ALLOC_NO) {
      handleOpenAllocation(allocNoParam);
    }
  }, [searchParams]);

  const handleOpenAllocation = async (allocNo: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const d = await reinsuranceService.getAllocationDetail(allocNo);
      setSelectedDetail(d);
      setActiveTab('detail');
    } catch (err: any) {
      setError(err.message || 'Failed to load RI allocation');
    } finally {
      setActionLoading(false);
    }
  };

  const selectedPolicyObj = useMemo(
    () => eligiblePolicies.find((p) => p.polNo === selectedPolNo) || null,
    [eligiblePolicies, selectedPolNo]
  );

  const handleRunAllocation = async () => {
    const pol = selectedPolicyObj;
    if (!pol || !selectedTreatyId) {
      setError('Please select a Policy and an Active Treaty.');
      return;
    }
    if (pol.hasApprovedRi) {
      setError(`Policy ${pol.polNo} already has an APPROVED RI Allocation. Re-allocation is not permitted.`);
      return;
    }
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const detail = await reinsuranceService.allocatePolicy({
        polNo: pol.polNo,
        lobType: pol.lobType,
        treatyId: selectedTreatyId,
        insuredName: pol.insuredName,
        prodCode: pol.prodCode,
        policySumAssured: pol.sumAssured,
        policyPremium: pol.annualPremium
      });
      setSelectedDetail(detail);
      setActiveTab('detail');
      setSuccessMsg(
        `RI Allocation ${detail.allocation.ALLOC_NO} created via PKG_REINSURANCE.SP_ALLOCATE_POLICY_RI and routed to RIUSER Workbasket.`
      );
      loadAll();
    } catch (err: any) {
      setError(err.message || 'Failed to allocate policy RI');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveAllocation = async () => {
    if (!selectedDetail) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await reinsuranceService.approveAllocation(selectedDetail.allocation.ALLOC_NO, approvalRemarks);
      setSelectedDetail(res.data);
      setApprovalRemarks('');
      setSuccessMsg(
        res.voucherNo === 'NO_CESSION'
          ? `RI Allocation ${res.data.allocation.ALLOC_NO} Approved (100% Retained).`
          : `RI Allocation ${res.data.allocation.ALLOC_NO} Approved & Balanced GL Voucher ${res.voucherNo} Posted!`
      );
      loadAll();
    } catch (err: any) {
      setError(err.message || 'Failed to approve RI allocation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectAllocation = async () => {
    if (!selectedDetail) return;
    setActionLoading(true);
    setError(null);
    try {
      const updated = await reinsuranceService.rejectAllocation(
        selectedDetail.allocation.ALLOC_NO,
        approvalRemarks || 'Rejected by RIUSER'
      );
      setSelectedDetail(updated);
      setApprovalRemarks('');
      setSuccessMsg(`RI Allocation ${updated.allocation.ALLOC_NO} Rejected.`);
      loadAll();
    } catch (err: any) {
      setError(err.message || 'Failed to reject RI allocation');
    } finally {
      setActionLoading(false);
    }
  };

  // KPIs
  const metrics = useMemo(() => {
    const totalRetainedSa = allocations.reduce((a, b) => a + Number(b.RETAINED_SA || 0), 0);
    const totalCededSa = allocations.reduce((a, b) => a + Number(b.CEDED_SA || 0), 0);
    const totalNetCededPrem = allocations.reduce((a, b) => a + Number(b.NET_CEDED_PREMIUM || 0), 0);
    const pendingCount = allocations.filter((a) => a.ALLOC_STATUS === 'PENDING_RI_APPROVAL').length;
    return { totalRetainedSa, totalCededSa, totalNetCededPrem, pendingCount };
  }, [allocations]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav className="flex items-center space-x-2 text-xs font-medium text-slate-500 mb-1">
            <button onClick={() => navigate('/dashboard')} className="hover:text-navy">Dashboard</button>
            <span>/</span>
            <span className="text-indigo-700 font-semibold">Reinsurance Management</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy tracking-tight flex items-center gap-2.5">
            <Shield className="w-7 h-7 text-indigo-600" />
            <span>Reinsurance Treaty &amp; Cession Engine</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Policy RI Allocation (PKG_REINSURANCE), RIUSER Authorization &amp; Automated GL Accounting.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {fromWorkbasket && (
            <button
              type="button"
              onClick={() => navigate('/workbasket')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Workbasket</span>
            </button>
          )}
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Feedback Banners */}
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

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Active Treaties</span>
          <p className="text-2xl font-black text-navy mt-1">{treaties.filter((t) => t.TREATY_STATUS === 'ACTIVE').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-amber-700">Pending RI Approval</span>
          <p className="text-2xl font-black text-amber-700 mt-1">{metrics.pendingCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-indigo-700">Total Ceded Sum Assured</span>
          <p className="text-lg font-black text-indigo-800 mt-1 truncate">
            OMR {metrics.totalCededSa.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-indigo-50/70 rounded-xl border border-indigo-200 p-4 shadow-xs">
          <span className="text-xs font-bold text-indigo-800">Net Ceded Premium</span>
          <p className="text-lg font-black text-indigo-900 mt-1 truncate">
            OMR {metrics.totalNetCededPrem.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Main Module Navigation Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-1.5 flex flex-wrap gap-2 shadow-xs">
        <button
          type="button"
          onClick={() => {
            setSearchParams({});
            setActiveTab('allocations');
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'allocations' ? 'bg-navy text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>Policy RI Allocations ({allocations.length})</span>
        </button>

        {selectedDetail && (
          <button
            type="button"
            onClick={() => setActiveTab('detail')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'detail' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Allocation &amp; GL View: {selectedDetail.allocation.POL_NO}</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: POLICY RI ALLOCATION ENGINE & REGISTER */}
      {/* ========================================================================= */}
      {activeTab === 'allocations' && (
        <div className="space-y-5">
          {/* Quick Allocate Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-extrabold text-navy">Run Policy Reinsurance Allocation (PKG_REINSURANCE)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Policy (IL or GL)</label>
                <select
                  value={selectedPolNo}
                  onChange={(e) => {
                    const pNo = e.target.value;
                    setSelectedPolNo(pNo);
                    const p = eligiblePolicies.find((x) => x.polNo === pNo);
                    if (p) {
                      const matchingTreaty = treaties.find(
                        (t) => t.TREATY_STATUS === 'ACTIVE' && (t.LOB_TYPE === p.lobType || t.LOB_TYPE === 'ALL')
                      );
                      if (matchingTreaty) setSelectedTreatyId(matchingTreaty.TREATY_ID);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white font-semibold"
                >
                  {eligiblePolicies.map((p) => (
                    <option key={p.polNo} value={p.polNo}>
                      [{p.lobType}] {p.polNo} — {p.insuredName} (SA: {p.sumAssured.toLocaleString('en-US')})
                      {p.hasApprovedRi ? ' [RI APPROVED — Locked]' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Active Treaty Arrangement</label>
                <select
                  value={selectedTreatyId}
                  onChange={(e) => setSelectedTreatyId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white font-semibold"
                >
                  {treaties.map((t) => (
                    <option key={t.TREATY_ID} value={t.TREATY_ID}>
                      {t.TREATY_CODE} — {t.TREATY_NAME} ({t.LOB_TYPE})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleRunAllocation}
                  disabled={actionLoading || !selectedPolNo || !selectedTreatyId || !!selectedPolicyObj?.hasApprovedRi}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Calculator className="w-4 h-4" />
                  <span>
                    {selectedPolicyObj?.hasApprovedRi
                      ? 'Already RI Approved (Locked)'
                      : actionLoading
                      ? 'Allocating...'
                      : 'Calculate & Store Policy RI Allocation'}
                  </span>
                </button>
              </div>
            </div>
            {selectedPolicyObj?.hasApprovedRi && (
              <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Policy {selectedPolicyObj.polNo} already has an approved RI allocation and cannot be re-allocated.</span>
              </p>
            )}
          </div>

          {/* Allocations Register Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Alloc No, Policy No, Insured, Treaty..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING_RI_APPROVAL">Pending RI Approval</option>
                <option value="APPROVED">Approved &amp; Posted</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                  <tr>
                    <th className="py-3 px-4">Alloc No</th>
                    <th className="py-3 px-4">Policy No &amp; Insured</th>
                    <th className="py-3 px-4">Treaty</th>
                    <th className="py-3 px-4 text-right">Retained SA</th>
                    <th className="py-3 px-4 text-right">Ceded SA</th>
                    <th className="py-3 px-4 text-right">Net Ceded Prem</th>
                    <th className="py-3 px-4 text-center">Status / GL</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allocations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        No Policy RI Allocations stored yet. Select a policy above and click &ldquo;Calculate &amp; Store Policy RI Allocation&rdquo;.
                      </td>
                    </tr>
                  ) : (
                    allocations.map((a) => (
                      <tr key={a.ALLOC_ID} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono font-bold text-navy whitespace-nowrap">{a.ALLOC_NO}</td>
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-800">
                            {a.POL_NO} <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-slate-100">{a.LOB_TYPE}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">{a.INSURED_NAME}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-indigo-700 font-semibold whitespace-nowrap">{a.TREATY_CODE}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-700 whitespace-nowrap">
                          {Number(a.RETAINED_SA).toLocaleString('en-US')}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-indigo-700 whitespace-nowrap">
                          {Number(a.CEDED_SA).toLocaleString('en-US')}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-teal-700 whitespace-nowrap">
                          OMR {Number(a.NET_CEDED_PREMIUM).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              a.ALLOC_STATUS === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : a.ALLOC_STATUS === 'REJECTED'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {a.ALLOC_STATUS.replace(/_/g, ' ')}
                          </span>
                          {a.GL_VOUCHER_NO && (
                            <div className="text-[10px] font-mono text-blue-700 font-semibold mt-0.5">{a.GL_VOUCHER_NO}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenAllocation(a.ALLOC_NO)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-navy text-white text-[11px] font-bold hover:bg-slate-800"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View / Approve</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: POLICY RI ALLOCATION DETAIL, RIUSER APPROVAL & GL ACCOUNTING */}
      {/* ========================================================================= */}
      {activeTab === 'detail' && selectedDetail && (
        <div className="space-y-5">
          {/* Header & Approval Action Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-lg font-black text-navy">{selectedDetail.allocation.ALLOC_NO}</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-mono text-xs font-bold border border-indigo-200">
                    Policy: {selectedDetail.allocation.POL_NO}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                      selectedDetail.allocation.ALLOC_STATUS === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : selectedDetail.allocation.ALLOC_STATUS === 'REJECTED'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {selectedDetail.allocation.ALLOC_STATUS.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Insured: <strong>{selectedDetail.allocation.INSURED_NAME}</strong> &bull; Treaty:{' '}
                  <strong>{selectedDetail.allocation.TREATY_CODE}</strong> &bull; Policy SA:{' '}
                  <strong>OMR {Number(selectedDetail.allocation.POLICY_SUM_ASSURED).toLocaleString('en-US')}</strong> &bull; Policy Premium:{' '}
                  <strong>OMR {Number(selectedDetail.allocation.POLICY_PREMIUM).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                </p>
              </div>

              {selectedDetail.allocation.ALLOC_STATUS === 'PENDING_RI_APPROVAL' && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={approvalRemarks}
                    onChange={(e) => setApprovalRemarks(e.target.value)}
                    placeholder="RI approval remarks..."
                    className="text-xs rounded-lg border border-slate-300 px-3 py-2 w-48"
                  />
                  <button
                    type="button"
                    disabled={actionLoading || !canApproveRi}
                    onClick={handleApproveAllocation}
                    title={!canApproveRi ? 'Only RIUSER or ADMIN can authorize RI allocations' : 'Approve & Post GL'}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-xs disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve &amp; Post RI GL</span>
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading || !canApproveRi}
                    onClick={handleRejectAllocation}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </div>
              )}
            </div>

            {/* Allocation Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs pt-2 border-t border-slate-100">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 font-semibold">Retained SA</span>
                <p className="text-base font-black text-navy mt-0.5">{Number(selectedDetail.allocation.RETAINED_SA).toLocaleString('en-US')}</p>
              </div>
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
                <span className="text-indigo-700 font-semibold">Ceded SA</span>
                <p className="text-base font-black text-indigo-800 mt-0.5">{Number(selectedDetail.allocation.CEDED_SA).toLocaleString('en-US')}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 font-semibold">Gross Ceded Prem</span>
                <p className="text-base font-black text-navy mt-0.5">OMR {Number(selectedDetail.allocation.GROSS_CEDED_PREMIUM).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <span className="text-emerald-800 font-semibold">RI Commission</span>
                <p className="text-base font-black text-emerald-700 mt-0.5">OMR {Number(selectedDetail.allocation.TOTAL_RI_COMMISSION).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200">
                <span className="text-teal-800 font-bold">Net Payable to RI</span>
                <p className="text-base font-black text-teal-800 mt-0.5">OMR {Number(selectedDetail.allocation.NET_CEDED_PREMIUM).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          {/* Layer-wise Breakdown Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-navy">
                Policy RI Layer Allocation Breakdown (T_RI_POLICY_ALLOC_LAYER)
              </h3>
              <span className="text-xs text-slate-500">Policy Ref: <strong className="font-mono">{selectedDetail.allocation.POL_NO}</strong></span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                  <tr>
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Layer Type &amp; Name</th>
                    <th className="py-3 px-4">Reinsurer</th>
                    <th className="py-3 px-4 text-right">Allocated SA (OMR)</th>
                    <th className="py-3 px-4 text-right">Share %</th>
                    <th className="py-3 px-4 text-right">Allocated Prem</th>
                    <th className="py-3 px-4 text-right">RI Comm % / Amt</th>
                    <th className="py-3 px-4 text-right">Net Payable to RI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedDetail.layers.map((l) => (
                    <tr key={l.ALLOC_LAYER_ID} className={l.LAYER_TYPE === 'RETENTION' ? 'bg-blue-50/30' : 'hover:bg-slate-50/70'}>
                      <td className="py-2.5 px-4 font-mono text-slate-400">{l.LAYER_ORDER}</td>
                      <td className="py-2.5 px-4">
                        <span className="font-bold text-navy">{l.LAYER_NAME}</span>
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-slate-100 text-slate-700">{l.LAYER_TYPE}</span>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-700">{l.REINSURER_NAME}</td>
                      <td className="py-2.5 px-4 text-right font-black text-navy">{Number(l.ALLOCATED_SA).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-indigo-700">{Number(l.SHARE_PCT).toFixed(2)}%</td>
                      <td className="py-2.5 px-4 text-right font-semibold">{Number(l.ALLOCATED_PREMIUM).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-4 text-right text-emerald-700 font-semibold">
                        {l.RI_COMMISSION_PCT > 0 ? `${l.RI_COMMISSION_PCT}% (${Number(l.RI_COMMISSION_AMT).toLocaleString('en-US', { minimumFractionDigits: 2 })})` : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-teal-700">
                        {l.LAYER_TYPE === 'RETENTION' ? 'Retained' : Number(l.NET_PAYABLE_RI).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RI Accounting Entries Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-navy">Reinsurance Accounting Entries (T_GL_JOURNAL_ENTRY)</h3>
                <p className="text-xs text-slate-500">Posted by <code className="font-mono">PKG_REINSURANCE.SP_POST_RI_GL</code> upon RIUSER authorization.</p>
              </div>
              {selectedDetail.allocation.GL_VOUCHER_NO && (
                <span className="px-3 py-1 rounded-lg bg-blue-50 border border-blue-200 font-mono text-xs font-black text-blue-800">
                  Voucher: {selectedDetail.allocation.GL_VOUCHER_NO}
                </span>
              )}
            </div>
            {selectedDetail.journalEntries.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No RI GL entries posted yet. Click &ldquo;Approve &amp; Post RI GL&rdquo; above to generate the balanced accounting voucher.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                    <tr>
                      <th className="py-3 px-4">Voucher No / Date</th>
                      <th className="py-3 px-4">GL Account Code</th>
                      <th className="py-3 px-4">GL Account Name</th>
                      <th className="py-3 px-4">Narration</th>
                      <th className="py-3 px-4 text-right">Debit (OMR)</th>
                      <th className="py-3 px-4 text-right">Credit (OMR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedDetail.journalEntries.map((j) => (
                      <tr key={j.ENTRY_ID}>
                        <td className="py-2.5 px-4 font-mono font-bold text-navy">{j.JOURNAL_VOUCHER_NO}<div className="text-[10px] font-sans text-slate-400">{j.VOUCHER_DATE}</div></td>
                        <td className="py-2.5 px-4 font-mono font-bold text-blue-700">{j.GL_ACCOUNT_CODE}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">{j.GL_ACCOUNT_NAME}</td>
                        <td className="py-2.5 px-4 text-slate-600">{j.NARRATION}</td>
                        <td className="py-2.5 px-4 text-right font-black text-rose-700">{j.DR_CR_FLAG === 'D' ? Number(j.AMOUNT).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}</td>
                        <td className="py-2.5 px-4 text-right font-black text-emerald-700">{j.DR_CR_FLAG === 'C' ? Number(j.AMOUNT).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-navy">
                    <tr>
                      <td colSpan={4} className="py-3 px-4 uppercase text-[11px]">Balanced Double-Entry RI Voucher Totals (DR = CR)</td>
                      <td className="py-3 px-4 text-right text-rose-800">
                        OMR {selectedDetail.journalEntries.filter((j) => j.DR_CR_FLAG === 'D').reduce((a, b) => a + Number(b.AMOUNT), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-800">
                        OMR {selectedDetail.journalEntries.filter((j) => j.DR_CR_FLAG === 'C').reduce((a, b) => a + Number(b.AMOUNT), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
