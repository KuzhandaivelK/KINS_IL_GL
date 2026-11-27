import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileWarning,
  Plus,
  Search,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  FileText,
  UploadCloud,
  Download,
  Trash2,
  Calculator,
  Landmark,
  BookOpen,
  ShieldCheck,
  DollarSign,
  History,
  X,
  Eye
} from 'lucide-react';
import { claimService } from '../services/claimService';
import {
  ClaimMasterRecord,
  ClaimDetail,
  ClaimStatus,
  ClaimType,
  PolicyLookupForClaim
} from '../types/claim';

const STATUS_BADGE: Record<ClaimStatus, string> = {
  FNOL_REGISTERED: 'bg-blue-50 text-blue-700 border-blue-200',
  UNDER_ASSESSMENT: 'bg-amber-50 text-amber-800 border-amber-200',
  ASSESSED: 'bg-purple-50 text-purple-700 border-purple-200',
  APPROVED: 'bg-teal-50 text-teal-800 border-teal-200',
  SETTLED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  CLOSED: 'bg-slate-100 text-slate-700 border-slate-200'
};

const CLAIM_DOC_TYPES = [
  { code: 'DEATH_CERTIFICATE', label: 'Death Certificate' },
  { code: 'CLAIM_FORM', label: 'Claim Intimation / Discharge Form' },
  { code: 'MEDICAL_REPORT', label: 'Attending Physician / Hospital Report' },
  { code: 'POLICE_FIR', label: 'Police / Accident FIR Report' },
  { code: 'ID_PROOF', label: 'Claimant / Beneficiary ID Proof' },
  { code: 'BANK_DETAILS', label: 'Payee Bank Account / IBAN Proof' },
  { code: 'OTHER', label: 'Other Supporting Evidence' }
];

export const ClaimsPage: React.FC = () => {
  const navigate = useNavigate();

  // Page modes
  const [viewMode, setViewMode] = useState<'list' | 'fnol' | 'detail'>('list');
  const [detailTab, setDetailTab] = useState<'fnol' | 'assessment' | 'settlement' | 'accounting'>('fnol');

  // Data
  const [claims, setClaims] = useState<ClaimMasterRecord[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ClaimDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [lobFilter, setLobFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Stage 1: FNOL Form State
  const [lookupPolNo, setLookupPolNo] = useState<string>('');
  const [policyLookup, setPolicyLookup] = useState<PolicyLookupForClaim | null>(null);
  const [lookupLoading, setLookupLoading] = useState<boolean>(false);
  const [fnolForm, setFnolForm] = useState({
    lobType: 'IL' as 'IL' | 'GL',
    polNo: '',
    memberEmpId: '',
    insuredName: '',
    prodCode: '',
    policySumAssured: 0,
    claimType: 'DEATH' as ClaimType,
    dateOfLoss: new Date().toISOString().split('T')[0],
    causeOfLoss: '',
    placeOfLoss: '',
    lossDescription: '',
    intimantName: '',
    intimantRelation: 'SPOUSE',
    intimantContact: '',
    intimantEmail: '',
    claimedAmount: 0
  });

  // Document Upload State
  const [docType, setDocType] = useState<string>('DEATH_CERTIFICATE');
  const [docRemarks, setDocRemarks] = useState<string>('');
  const [docFile, setDocFile] = useState<File | null>(null);

  // Stage 2: Assessment Form State
  const [assessForm, setAssessForm] = useState({
    policyInforceYn: 'Y' as 'Y' | 'N',
    waitingPeriodOkYn: 'Y' as 'Y' | 'N',
    exclusionApplicableYn: 'N' as 'Y' | 'N',
    exclusionRemarks: '',
    baseSumAssured: 0,
    riderBenefitAmount: 0,
    bonusAmount: 0,
    loanDeduction: 0,
    unpaidPremDeduction: 0,
    otherDeduction: 0,
    assessmentDecision: 'RECOMMEND_APPROVAL' as 'RECOMMEND_APPROVAL' | 'RECOMMEND_REJECTION' | 'INVESTIGATION_REQUIRED',
    assessorRemarks: ''
  });
  const [decisionRemarks, setDecisionRemarks] = useState<string>('');

  // Stage 3: Settlement Form State
  const [settleForm, setSettleForm] = useState({
    payeeName: '',
    payeeRelation: 'BENEFICIARY',
    payeeBankName: '',
    payeeAccountNo: '',
    payeeIban: '',
    paymentMode: 'BANK_TRANSFER' as 'BANK_TRANSFER' | 'CHEQUE' | 'NEFT_RTGS' | 'DIRECT_CREDIT',
    paymentRefNo: '',
    remarks: ''
  });

  const loadClaims = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await claimService.listClaims({
        status: statusFilter,
        lobType: lobFilter,
        search: searchQuery
      });
      setClaims(rows);
    } catch (err: any) {
      setError(err.message || 'Failed to load claims');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'list') loadClaims();
  }, [statusFilter, lobFilter, searchQuery, viewMode]);

  const syncFormsFromDetail = (detail: ClaimDetail) => {
    const m = detail.master;
    const a = detail.assessment;
    setAssessForm({
      policyInforceYn: a?.POLICY_INFORCE_YN || 'Y',
      waitingPeriodOkYn: a?.WAITING_PERIOD_OK_YN || 'Y',
      exclusionApplicableYn: a?.EXCLUSION_APPLICABLE_YN || 'N',
      exclusionRemarks: a?.EXCLUSION_REMARKS || '',
      baseSumAssured: Number(a?.BASE_SUM_ASSURED ?? m.CLAIMED_AMOUNT ?? m.POLICY_SUM_ASSURED ?? 0),
      riderBenefitAmount: Number(a?.RIDER_BENEFIT_AMOUNT ?? 0),
      bonusAmount: Number(a?.BONUS_AMOUNT ?? 0),
      loanDeduction: Number(a?.LOAN_DEDUCTION ?? 0),
      unpaidPremDeduction: Number(a?.UNPAID_PREM_DEDUCTION ?? 0),
      otherDeduction: Number(a?.OTHER_DEDUCTION ?? 0),
      assessmentDecision: a?.ASSESSMENT_DECISION || 'RECOMMEND_APPROVAL',
      assessorRemarks: a?.ASSESSOR_REMARKS || ''
    });

    const s = detail.settlement;
    setSettleForm({
      payeeName: s?.PAYEE_NAME || m.INTIMANT_NAME || '',
      payeeRelation: s?.PAYEE_RELATION || m.INTIMANT_RELATION || 'BENEFICIARY',
      payeeBankName: s?.PAYEE_BANK_NAME || '',
      payeeAccountNo: s?.PAYEE_ACCOUNT_NO || '',
      payeeIban: s?.PAYEE_IBAN || '',
      paymentMode: s?.PAYMENT_MODE || 'BANK_TRANSFER',
      paymentRefNo: s?.PAYMENT_REF_NO || `PAY-${Date.now().toString().slice(-6)}`,
      remarks: s?.SETTLEMENT_REMARKS || ''
    });
  };

  const handleOpenClaim = async (claimNo: string, tab?: 'fnol' | 'assessment' | 'settlement' | 'accounting') => {
    setActionLoading(true);
    setError(null);
    try {
      const detail = await claimService.getClaimDetail(claimNo);
      setSelectedClaim(detail);
      syncFormsFromDetail(detail);
      setViewMode('detail');
      if (tab) {
        setDetailTab(tab);
      } else if (detail.master.CLAIM_STATUS === 'SETTLED') {
        setDetailTab('accounting');
      } else if (detail.master.CLAIM_STATUS === 'APPROVED') {
        setDetailTab('settlement');
      } else if (detail.master.CLAIM_STATUS === 'FNOL_REGISTERED' || detail.master.CLAIM_STATUS === 'UNDER_ASSESSMENT') {
        setDetailTab('assessment');
      } else {
        setDetailTab('fnol');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to open claim');
    } finally {
      setActionLoading(false);
    }
  };

  // Policy Lookup for FNOL
  const handleLookupPolicy = async () => {
    if (!lookupPolNo.trim()) return;
    setLookupLoading(true);
    setError(null);
    try {
      const p = await claimService.lookupPolicy(lookupPolNo);
      setPolicyLookup(p);
      const firstBen = p.beneficiaries?.[0];
      const firstGlMem = p.groupMembers?.[0];
      const defaultSa = p.lobType === 'GL' && firstGlMem ? firstGlMem.effectiveSa : p.sumAssured;
      setFnolForm((prev) => ({
        ...prev,
        lobType: p.lobType,
        polNo: p.polNo,
        memberEmpId: p.lobType === 'GL' && firstGlMem ? firstGlMem.empId : '',
        insuredName: p.lobType === 'GL' && firstGlMem ? firstGlMem.memberName : p.insuredName,
        prodCode: p.prodCode,
        policySumAssured: defaultSa,
        claimedAmount: defaultSa,
        intimantName: firstBen?.name || prev.intimantName,
        intimantRelation: firstBen?.relation || prev.intimantRelation,
        intimantContact: firstBen?.contact || prev.intimantContact
      }));
    } catch (err: any) {
      setPolicyLookup(null);
      setError(err.message || 'Policy not found');
    } finally {
      setLookupLoading(false);
    }
  };

  // Stage 1: Submit FNOL
  const handleSubmitFnol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fnolForm.polNo || !fnolForm.insuredName || !fnolForm.causeOfLoss || !fnolForm.intimantName) {
      setError('Policy No, Insured Name, Cause of Loss, and Intimant Name are required.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const detail = await claimService.registerFnol(fnolForm);
      setSelectedClaim(detail);
      syncFormsFromDetail(detail);
      setSuccessMsg(`FNOL Registered Successfully! Claim Number: ${detail.master.CLAIM_NO}`);
      setViewMode('detail');
      setDetailTab('fnol');
    } catch (err: any) {
      setError(err.message || 'Failed to register FNOL');
    } finally {
      setActionLoading(false);
    }
  };

  // Document Upload
  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim || !docFile) return;
    setActionLoading(true);
    setError(null);
    try {
      await claimService.uploadDocument(selectedClaim.master.CLAIM_NO, docFile, docType, docRemarks);
      setDocFile(null);
      setDocRemarks('');
      const refreshed = await claimService.getClaimDetail(selectedClaim.master.CLAIM_NO);
      setSelectedClaim(refreshed);
      setSuccessMsg('Claim document uploaded successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setActionLoading(false);
    }
  };

  // Stage 2: Submit Assessment (PKG_CLAIMS.SP_ASSESS_CLAIM)
  const handleSubmitAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim) return;
    setActionLoading(true);
    setError(null);
    try {
      const detail = await claimService.assessClaim(selectedClaim.master.CLAIM_NO, assessForm);
      setSelectedClaim(detail);
      syncFormsFromDetail(detail);
      setSuccessMsg(
        `Claim Assessed via Oracle PKG_CLAIMS.SP_ASSESS_CLAIM! Net Payable: OMR ${Number(
          detail.assessment?.NET_PAYABLE_AMOUNT || 0
        ).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      );
    } catch (err: any) {
      setError(err.message || 'Assessment failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Approve or Reject Claim
  const handleDecision = async (action: 'APPROVE' | 'REJECT') => {
    if (!selectedClaim) return;
    setActionLoading(true);
    setError(null);
    try {
      const detail =
        action === 'APPROVE'
          ? await claimService.approveClaim(selectedClaim.master.CLAIM_NO, decisionRemarks)
          : await claimService.rejectClaim(selectedClaim.master.CLAIM_NO, decisionRemarks || 'Rejected after assessment');
      setSelectedClaim(detail);
      syncFormsFromDetail(detail);
      setDecisionRemarks('');
      setSuccessMsg(
        action === 'APPROVE'
          ? `Claim ${detail.master.CLAIM_NO} APPROVED! Proceed to Settlement tab.`
          : `Claim ${detail.master.CLAIM_NO} REJECTED.`
      );
      if (action === 'APPROVE') setDetailTab('settlement');
    } catch (err: any) {
      setError(err.message || 'Failed to update claim decision');
    } finally {
      setActionLoading(false);
    }
  };

  // Stage 3 & 4: Settle Claim & Post GL Accounting Entries (PKG_CLAIMS.SP_SETTLE_CLAIM)
  const handleSettleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim) return;
    if (!settleForm.payeeName.trim()) {
      setError('Payee Name is required for settlement.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const res = await claimService.settleClaim(selectedClaim.master.CLAIM_NO, settleForm);
      setSelectedClaim(res.data);
      syncFormsFromDetail(res.data);
      setSuccessMsg(
        `Claim Settled (${res.settlementNo}) & Balanced GL Accounting Voucher ${res.voucherNo} Posted!`
      );
      setDetailTab('accounting');
    } catch (err: any) {
      setError(err.message || 'Settlement failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Computed live preview for assessment form
  const liveGross = useMemo(
    () =>
      Number(assessForm.baseSumAssured || 0) +
      Number(assessForm.riderBenefitAmount || 0) +
      Number(assessForm.bonusAmount || 0),
    [assessForm.baseSumAssured, assessForm.riderBenefitAmount, assessForm.bonusAmount]
  );
  const liveDed = useMemo(
    () =>
      Number(assessForm.loanDeduction || 0) +
      Number(assessForm.unpaidPremDeduction || 0) +
      Number(assessForm.otherDeduction || 0),
    [assessForm.loanDeduction, assessForm.unpaidPremDeduction, assessForm.otherDeduction]
  );
  const liveNet = Math.max(0, Math.round((liveGross - liveDed) * 100) / 100);

  // Dashboard metrics
  const metrics = useMemo(() => {
    const total = claims.length;
    const fnol = claims.filter((c) => c.CLAIM_STATUS === 'FNOL_REGISTERED').length;
    const inProgress = claims.filter((c) => ['UNDER_ASSESSMENT', 'ASSESSED', 'APPROVED'].includes(c.CLAIM_STATUS)).length;
    const settled = claims.filter((c) => c.CLAIM_STATUS === 'SETTLED').length;
    const totalSettledAmt = claims.reduce((acc, c) => acc + Number(c.SETTLED_AMOUNT || 0), 0);
    return { total, fnol, inProgress, settled, totalSettledAmt };
  }, [claims]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav className="flex items-center space-x-2 text-xs font-medium text-slate-500 mb-1">
            <button onClick={() => navigate('/dashboard')} className="hover:text-navy">Dashboard</button>
            <span>/</span>
            <span className="text-teal-700 font-semibold">Claims Management</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy tracking-tight flex items-center gap-2.5">
            <FileWarning className="w-7 h-7 text-rose-600" />
            <span>Claims Management Engine</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            End-to-end FNOL Registration, Admissibility Assessment (PKG_CLAIMS), Settlement Disbursement &amp; Automated GL Accounting.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {viewMode !== 'list' ? (
            <button
              type="button"
              onClick={() => {
                setViewMode('list');
                setSelectedClaim(null);
                setError(null);
                setSuccessMsg(null);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Claims Register</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={loadClaims}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPolicyLookup(null);
                  setLookupPolNo('');
                  setError(null);
                  setSuccessMsg(null);
                  setViewMode('fnol');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Register New FNOL</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Feedback Banners */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700"><X className="w-4 h-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: CLAIMS REGISTER */}
      {/* ========================================================================= */}
      {viewMode === 'list' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Total Claims</span>
              <p className="text-2xl font-black text-navy mt-1">{metrics.total}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <span className="text-xs font-semibold text-blue-600">FNOL Registered</span>
              <p className="text-2xl font-black text-blue-700 mt-1">{metrics.fnol}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <span className="text-xs font-semibold text-purple-600">Assessment / Approval</span>
              <p className="text-2xl font-black text-purple-700 mt-1">{metrics.inProgress}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <span className="text-xs font-semibold text-emerald-600">Settled Claims</span>
              <p className="text-2xl font-black text-emerald-700 mt-1">{metrics.settled}</p>
            </div>
            <div className="bg-emerald-50/70 rounded-xl border border-emerald-200 p-4 shadow-xs">
              <span className="text-xs font-bold text-emerald-800">Total Settled Payout</span>
              <p className="text-lg font-black text-emerald-700 mt-1 truncate">
                OMR {metrics.totalSettledAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Claim No, Policy No, Insured, Intimant..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={lobFilter}
                  onChange={(e) => setLobFilter(e.target.value)}
                  className="text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white"
                >
                  <option value="ALL">All LOBs</option>
                  <option value="IL">Individual Life (IL)</option>
                  <option value="GL">Group Life (GL)</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="FNOL_REGISTERED">FNOL Registered</option>
                  <option value="UNDER_ASSESSMENT">Under Assessment</option>
                  <option value="ASSESSED">Assessed</option>
                  <option value="APPROVED">Approved</option>
                  <option value="SETTLED">Settled</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                  <tr>
                    <th className="py-3 px-4">Claim No</th>
                    <th className="py-3 px-4">Policy / LOB</th>
                    <th className="py-3 px-4">Insured / Claimant</th>
                    <th className="py-3 px-4">Claim Type &amp; Loss Date</th>
                    <th className="py-3 px-4 text-right">Claimed / Net Payable</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-rose-500" />
                        Loading claims...
                      </td>
                    </tr>
                  ) : claims.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <FileWarning className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-bold text-slate-600">No claims registered yet</p>
                        <p className="text-[11px] mt-0.5">Click &ldquo;Register New FNOL&rdquo; to intimate a claim.</p>
                      </td>
                    </tr>
                  ) : (
                    claims.map((c) => (
                      <tr key={c.CLAIM_ID} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono font-bold text-navy whitespace-nowrap">
                          {c.CLAIM_NO}
                          <div className="text-[10px] font-sans text-slate-400 font-normal">Intimated: {c.DATE_OF_INTIMATION}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono font-semibold text-slate-800">{c.POL_NO}</span>
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-slate-100 text-slate-700">
                            {c.LOB_TYPE}
                          </span>
                          {c.MEMBER_EMP_ID && <div className="text-[10px] text-slate-400">Emp: {c.MEMBER_EMP_ID}</div>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800">{c.INSURED_NAME}</div>
                          <div className="text-[10px] text-slate-400">Intimant: {c.INTIMANT_NAME}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-700">{c.CLAIM_TYPE.replace(/_/g, ' ')}</div>
                          <div className="text-[10px] text-slate-400">DOL: {c.DATE_OF_LOSS}</div>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="font-black text-navy">
                            OMR {Number(c.SETTLED_AMOUNT ?? c.NET_PAYABLE_AMOUNT ?? c.CLAIMED_AMOUNT).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                          {c.GL_VOUCHER_NO && (
                            <div className="text-[10px] font-mono text-emerald-700 font-semibold">{c.GL_VOUCHER_NO}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${STATUS_BADGE[c.CLAIM_STATUS]}`}>
                            {c.CLAIM_STATUS.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenClaim(c.CLAIM_NO)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-navy text-white text-[11px] font-bold hover:bg-slate-800"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Open Claim</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: STAGE 1 - REGISTER FNOL (FIRST NOTIFICATION OF LOSS) */}
      {/* ========================================================================= */}
      {viewMode === 'fnol' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-extrabold text-navy">Stage 1: First Notification of Loss (FNOL) Registration</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Lookup an active Individual Life (POL-...) or Group Life Master Policy (GLP-...) to auto-populate policy details and register the claim.
            </p>
          </div>

          {/* Policy Lookup Bar */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <label className="block text-xs font-bold text-navy uppercase tracking-wider">
              1. Lookup Policy Number (Individual Life or Group Life)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={lookupPolNo}
                onChange={(e) => setLookupPolNo(e.target.value)}
                placeholder="Enter Policy No (e.g. POL-202611-00001 or GLP-202611-20001)"
                className="flex-1 text-xs font-mono font-bold rounded-lg border border-slate-300 px-3 py-2 bg-white"
              />
              <button
                type="button"
                onClick={handleLookupPolicy}
                disabled={lookupLoading || !lookupPolNo.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-navy text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{lookupLoading ? 'Searching...' : 'Fetch Policy'}</span>
              </button>
            </div>

            {policyLookup && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-extrabold text-emerald-900">{policyLookup.polNo}</span>
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-200/80 text-emerald-900 font-bold text-[10px]">
                    {policyLookup.lobType === 'IL' ? 'Individual Life' : 'Group Life'} &bull; {policyLookup.polStatus}
                  </span>
                  <div className="text-emerald-800 mt-0.5">
                    Product: <strong>{policyLookup.prodName}</strong> &bull; Sum Assured:{' '}
                    <strong>OMR {policyLookup.sumAssured.toLocaleString('en-US')}</strong>
                    {policyLookup.activeLoanBalance > 0 && (
                      <span className="ml-2 text-amber-800 font-bold">
                        (Active Loan Balance: OMR {policyLookup.activeLoanBalance.toLocaleString('en-US')})
                      </span>
                    )}
                  </div>
                </div>

                {policyLookup.lobType === 'GL' && policyLookup.groupMembers && policyLookup.groupMembers.length > 0 && (
                  <div className="w-full sm:w-auto">
                    <label className="block text-[10px] font-bold text-emerald-900 mb-1">Select Insured Group Employee:</label>
                    <select
                      value={fnolForm.memberEmpId}
                      onChange={(e) => {
                        const emp = policyLookup.groupMembers?.find((m) => m.empId === e.target.value);
                        if (emp) {
                          setFnolForm((prev) => ({
                            ...prev,
                            memberEmpId: emp.empId,
                            insuredName: emp.memberName,
                            policySumAssured: emp.effectiveSa,
                            claimedAmount: emp.effectiveSa
                          }));
                        }
                      }}
                      className="text-xs rounded-lg border border-emerald-300 px-2.5 py-1.5 bg-white font-semibold"
                    >
                      {policyLookup.groupMembers.map((m) => (
                        <option key={m.empId} value={m.empId}>
                          {m.empId} — {m.memberName} (SA: {m.effectiveSa.toLocaleString('en-US')})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmitFnol} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Policy Number *</label>
                <input
                  type="text"
                  required
                  value={fnolForm.polNo}
                  onChange={(e) => setFnolForm({ ...fnolForm, polNo: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Insured Life Name *</label>
                <input
                  type="text"
                  required
                  value={fnolForm.insuredName}
                  onChange={(e) => setFnolForm({ ...fnolForm, insuredName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-semibold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Claim Type *</label>
                <select
                  value={fnolForm.claimType}
                  onChange={(e) => setFnolForm({ ...fnolForm, claimType: e.target.value as ClaimType })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white font-semibold"
                >
                  <option value="DEATH">Death Claim (Natural)</option>
                  <option value="ACCIDENTAL_DEATH">Accidental Death Benefit</option>
                  <option value="CRITICAL_ILLNESS">Critical Illness Benefit</option>
                  <option value="PTD">Permanent Total Disability (PTD)</option>
                  <option value="HOSPITALIZATION">Hospitalization / Medical Cash</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Date of Loss / Event *</label>
                <input
                  type="date"
                  required
                  value={fnolForm.dateOfLoss}
                  onChange={(e) => setFnolForm({ ...fnolForm, dateOfLoss: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Cause of Loss *</label>
                <input
                  type="text"
                  required
                  value={fnolForm.causeOfLoss}
                  onChange={(e) => setFnolForm({ ...fnolForm, causeOfLoss: e.target.value })}
                  placeholder="e.g. Cardiac Arrest / Road Traffic Accident"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Claimed Amount (OMR) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={fnolForm.claimedAmount}
                  onChange={(e) => setFnolForm({ ...fnolForm, claimedAmount: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-black text-navy"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Place of Loss</label>
                <input
                  type="text"
                  value={fnolForm.placeOfLoss}
                  onChange={(e) => setFnolForm({ ...fnolForm, placeOfLoss: e.target.value })}
                  placeholder="Hospital / City"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Loss Description</label>
                <input
                  type="text"
                  value={fnolForm.lossDescription}
                  onChange={(e) => setFnolForm({ ...fnolForm, lossDescription: e.target.value })}
                  placeholder="Brief details of incident / hospitalization / circumstances"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-extrabold text-navy uppercase tracking-wider mb-3">Intimant / Claimant Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Intimant Name *</label>
                  <input
                    type="text"
                    required
                    value={fnolForm.intimantName}
                    onChange={(e) => setFnolForm({ ...fnolForm, intimantName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Relationship</label>
                  <input
                    type="text"
                    value={fnolForm.intimantRelation}
                    onChange={(e) => setFnolForm({ ...fnolForm, intimantRelation: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Number</label>
                  <input
                    type="text"
                    value={fnolForm.intimantContact}
                    onChange={(e) => setFnolForm({ ...fnolForm, intimantContact: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={fnolForm.intimantEmail}
                    onChange={(e) => setFnolForm({ ...fnolForm, intimantEmail: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-xs disabled:opacity-50"
              >
                <FileWarning className="w-4 h-4" />
                <span>{actionLoading ? 'Registering FNOL...' : 'Register FNOL & Generate Claim No'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: CLAIM LIFECYCLE WORKSPACE (FNOL -> ASSESSMENT -> SETTLEMENT -> GL) */}
      {/* ========================================================================= */}
      {viewMode === 'detail' && selectedClaim && (
        <div className="space-y-5">
          {/* Claim Summary Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-lg font-black text-navy">{selectedClaim.master.CLAIM_NO}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${STATUS_BADGE[selectedClaim.master.CLAIM_STATUS]}`}>
                  {selectedClaim.master.CLAIM_STATUS.replace(/_/g, ' ')}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                  {selectedClaim.master.LOB_TYPE} &bull; {selectedClaim.master.POL_NO}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Insured: <strong>{selectedClaim.master.INSURED_NAME}</strong> &bull; Claim Type:{' '}
                <strong>{selectedClaim.master.CLAIM_TYPE.replace(/_/g, ' ')}</strong> &bull; Date of Loss:{' '}
                <strong>{selectedClaim.master.DATE_OF_LOSS}</strong> &bull; Cause:{' '}
                <strong>{selectedClaim.master.CAUSE_OF_LOSS}</strong>
              </p>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Claimed Amount</span>
                <span className="text-base font-black text-navy">
                  OMR {Number(selectedClaim.master.CLAIMED_AMOUNT).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {selectedClaim.assessment && (
                <div className="pl-4 border-l border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-teal-600 block">Assessed Net Payable</span>
                  <span className="text-base font-black text-teal-700">
                    OMR {Number(selectedClaim.assessment.NET_PAYABLE_AMOUNT).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 4-Stage Navigation Tabs */}
          <div className="bg-white rounded-xl border border-slate-200 p-1.5 flex flex-wrap gap-2 shadow-xs">
            {[
              { id: 'fnol', label: '1. FNOL & Documents', icon: FileText },
              { id: 'assessment', label: '2. Claim Assessment', icon: Calculator },
              { id: 'settlement', label: '3. Claim Settlement', icon: Landmark },
              { id: 'accounting', label: '4. Accounting Entries (GL)', icon: BookOpen }
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDetailTab(t.id as any)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    detailTab === t.id
                      ? 'bg-navy text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-navy'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                  {t.id === 'accounting' && selectedClaim.journalEntries.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500 text-white">
                      {selectedClaim.journalEntries.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB 1: FNOL DETAILS & DOCUMENTS */}
          {detailTab === 'fnol' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 text-xs">
                <h3 className="text-sm font-extrabold text-navy border-b border-slate-100 pb-2">FNOL Intimation Summary</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-slate-400 block">Policy No</span><strong className="font-mono">{selectedClaim.master.POL_NO}</strong></div>
                  <div><span className="text-slate-400 block">Policy Sum Assured</span><strong>OMR {Number(selectedClaim.master.POLICY_SUM_ASSURED).toLocaleString('en-US')}</strong></div>
                  <div><span className="text-slate-400 block">Date of Loss</span><strong>{selectedClaim.master.DATE_OF_LOSS}</strong></div>
                  <div><span className="text-slate-400 block">Date of Intimation</span><strong>{selectedClaim.master.DATE_OF_INTIMATION}</strong></div>
                  <div><span className="text-slate-400 block">Intimant Name</span><strong>{selectedClaim.master.INTIMANT_NAME}</strong></div>
                  <div><span className="text-slate-400 block">Relation / Contact</span><strong>{selectedClaim.master.INTIMANT_RELATION || '—'} / {selectedClaim.master.INTIMANT_CONTACT || '—'}</strong></div>
                  <div className="col-span-2"><span className="text-slate-400 block">Loss Description</span><p className="text-slate-700 mt-0.5">{selectedClaim.master.LOSS_DESCRIPTION || 'N/A'}</p></div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 text-xs">
                <h3 className="text-sm font-extrabold text-navy border-b border-slate-100 pb-2">
                  Claim Supporting Documents ({selectedClaim.documents.length})
                </h3>
                {selectedClaim.master.CLAIM_STATUS !== 'SETTLED' && (
                  <form onSubmit={handleUploadDoc} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white"
                      >
                        {CLAIM_DOC_TYPES.map((d) => (
                          <option key={d.code} value={d.code}>{d.label}</option>
                        ))}
                      </select>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                        className="text-xs text-slate-600"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={docRemarks}
                        onChange={(e) => setDocRemarks(e.target.value)}
                        placeholder="Optional document remarks..."
                        className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white"
                      />
                      <button
                        type="submit"
                        disabled={!docFile || actionLoading}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 text-white font-bold hover:bg-teal-700 disabled:opacity-50"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Upload</span>
                      </button>
                    </div>
                  </form>
                )}

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {selectedClaim.documents.length === 0 ? (
                    <div className="p-5 text-center text-slate-400">No claim documents uploaded yet.</div>
                  ) : (
                    selectedClaim.documents.map((doc) => (
                      <div key={doc.CLAIM_DOC_ID} className="p-2.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-800">{doc.FILE_NAME}</div>
                          <div className="text-[10px] text-slate-400">{doc.DOC_TYPE} &bull; {doc.UPLOADED_BY} &bull; {doc.UPLOADED_ON}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => claimService.downloadDocument(doc.CLAIM_DOC_ID, doc.FILE_NAME)}
                            className="p-1.5 rounded border border-slate-200 text-navy hover:bg-slate-100"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {selectedClaim.master.CLAIM_STATUS !== 'SETTLED' && (
                            <button
                              type="button"
                              onClick={async () => {
                                await claimService.deleteDocument(doc.CLAIM_DOC_ID);
                                const r = await claimService.getClaimDetail(selectedClaim.master.CLAIM_NO);
                                setSelectedClaim(r);
                              }}
                              className="p-1.5 rounded border border-rose-200 text-rose-600 hover:bg-rose-50"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STAGE 2 - CLAIM ASSESSMENT (PKG_CLAIMS.SP_ASSESS_CLAIM) */}
          {detailTab === 'assessment' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-navy">Stage 2: Claim Assessment &amp; Benefit Valuation</h3>
                  <p className="text-slate-500">Evaluates admissibility and computes Net Payable via Oracle PL/SQL <code className="font-mono">PKG_CLAIMS.SP_ASSESS_CLAIM</code>.</p>
                </div>
              </div>

              <form onSubmit={handleSubmitAssessment} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Policy In-Force on Date of Loss?</label>
                    <select
                      disabled={selectedClaim.master.CLAIM_STATUS === 'SETTLED'}
                      value={assessForm.policyInforceYn}
                      onChange={(e) => setAssessForm({ ...assessForm, policyInforceYn: e.target.value as 'Y' | 'N' })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white font-semibold"
                    >
                      <option value="Y">Yes — Policy Active / In-Force</option>
                      <option value="N">No — Policy Lapsed / Not In-Force</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Waiting / Contestability Period Cleared?</label>
                    <select
                      disabled={selectedClaim.master.CLAIM_STATUS === 'SETTLED'}
                      value={assessForm.waitingPeriodOkYn}
                      onChange={(e) => setAssessForm({ ...assessForm, waitingPeriodOkYn: e.target.value as 'Y' | 'N' })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white font-semibold"
                    >
                      <option value="Y">Yes — Satisfied</option>
                      <option value="N">No — Within Waiting Period</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Any Policy Exclusion Applicable?</label>
                    <select
                      disabled={selectedClaim.master.CLAIM_STATUS === 'SETTLED'}
                      value={assessForm.exclusionApplicableYn}
                      onChange={(e) => setAssessForm({ ...assessForm, exclusionApplicableYn: e.target.value as 'Y' | 'N' })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white font-semibold"
                    >
                      <option value="N">No Exclusions Applicable</option>
                      <option value="Y">Yes — Exclusion Triggered</option>
                    </select>
                  </div>
                </div>

                {/* Valuation Inputs */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Base Sum Assured (OMR)</label>
                    <input
                      type="number"
                      step="0.01"
                      disabled={selectedClaim.master.CLAIM_STATUS === 'SETTLED'}
                      value={assessForm.baseSumAssured}
                      onChange={(e) => setAssessForm({ ...assessForm, baseSumAssured: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-bold text-navy"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">+ Rider Benefit Amount (OMR)</label>
                    <input
                      type="number"
                      step="0.01"
                      disabled={selectedClaim.master.CLAIM_STATUS === 'SETTLED'}
                      value={assessForm.riderBenefitAmount}
                      onChange={(e) => setAssessForm({ ...assessForm, riderBenefitAmount: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">+ Vested / Terminal Bonus (OMR)</label>
                    <input
                      type="number"
                      step="0.01"
                      disabled={selectedClaim.master.CLAIM_STATUS === 'SETTLED'}
                      value={assessForm.bonusAmount}
                      onChange={(e) => setAssessForm({ ...assessForm, bonusAmount: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-rose-700 mb-1">− Policy Loan Deduction (OMR)</label>
                    <input
                      type="number"
                      step="0.01"
                      disabled={selectedClaim.master.CLAIM_STATUS === 'SETTLED'}
                      value={assessForm.loanDeduction}
                      onChange={(e) => setAssessForm({ ...assessForm, loanDeduction: Number(e.target.value) })}
                      className="w-full rounded-lg border border-rose-200 px-3 py-2 font-semibold text-rose-700"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-rose-700 mb-1">− Unpaid Premium Deduction (OMR)</label>
                    <input
                      type="number"
                      step="0.01"
                      disabled={selectedClaim.master.CLAIM_STATUS === 'SETTLED'}
                      value={assessForm.unpaidPremDeduction}
                      onChange={(e) => setAssessForm({ ...assessForm, unpaidPremDeduction: Number(e.target.value) })}
                      className="w-full rounded-lg border border-rose-200 px-3 py-2 font-semibold text-rose-700"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-rose-700 mb-1">− Other Deductions (OMR)</label>
                    <input
                      type="number"
                      step="0.01"
                      disabled={selectedClaim.master.CLAIM_STATUS === 'SETTLED'}
                      value={assessForm.otherDeduction}
                      onChange={(e) => setAssessForm({ ...assessForm, otherDeduction: Number(e.target.value) })}
                      className="w-full rounded-lg border border-rose-200 px-3 py-2 font-semibold text-rose-700"
                    />
                  </div>
                </div>

                {/* Live Calculation Summary Bar */}
                <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-teal-50/70 border border-teal-200 text-center">
                  <div>
                    <span className="text-[11px] font-bold text-slate-600 uppercase">Gross Admissible</span>
                    <p className="text-lg font-black text-navy mt-0.5">OMR {liveGross.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-rose-700 uppercase">Total Deductions</span>
                    <p className="text-lg font-black text-rose-700 mt-0.5">− OMR {liveDed.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-teal-800 uppercase">Net Payable Amount</span>
                    <p className="text-xl font-black text-teal-700 mt-0.5">OMR {liveNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Assessor Recommendation *</label>
                    <select
                      disabled={selectedClaim.master.CLAIM_STATUS === 'SETTLED'}
                      value={assessForm.assessmentDecision}
                      onChange={(e) => setAssessForm({ ...assessForm, assessmentDecision: e.target.value as any })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white font-bold"
                    >
                      <option value="RECOMMEND_APPROVAL">Recommend Approval</option>
                      <option value="INVESTIGATION_REQUIRED">Investigation Required</option>
                      <option value="RECOMMEND_REJECTION">Recommend Rejection</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Assessor Remarks</label>
                    <input
                      type="text"
                      disabled={selectedClaim.master.CLAIM_STATUS === 'SETTLED'}
                      value={assessForm.assessorRemarks}
                      onChange={(e) => setAssessForm({ ...assessForm, assessorRemarks: e.target.value })}
                      placeholder="Assessment notes, medical verification summary..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                </div>

                {selectedClaim.master.CLAIM_STATUS !== 'SETTLED' && selectedClaim.master.CLAIM_STATUS !== 'REJECTED' && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-purple-600 text-white font-bold hover:bg-purple-700 shadow-xs disabled:opacity-50"
                    >
                      <Calculator className="w-4 h-4" />
                      <span>{actionLoading ? 'Saving...' : 'Save Claim Assessment'}</span>
                    </button>

                    {selectedClaim.assessment && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={decisionRemarks}
                          onChange={(e) => setDecisionRemarks(e.target.value)}
                          placeholder="Approval / rejection remarks..."
                          className="rounded-lg border border-slate-300 px-3 py-2 w-56"
                        />
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleDecision('APPROVE')}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-xs"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Approve Claim</span>
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleDecision('REJECT')}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 shadow-xs"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>
          )}

          {/* TAB 3: STAGE 3 - CLAIM SETTLEMENT (PKG_CLAIMS.SP_SETTLE_CLAIM) */}
          {detailTab === 'settlement' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 text-xs">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-navy">Stage 3: Claim Settlement &amp; Payee Disbursement</h3>
                <p className="text-slate-500">
                  Executing settlement invokes <code className="font-mono">PKG_CLAIMS.SP_SETTLE_CLAIM</code> which records disbursement and automatically posts balanced GL entries into <code className="font-mono">T_GL_JOURNAL_ENTRY</code>.
                </p>
              </div>

              {selectedClaim.settlement ? (
                <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Claim Settled &amp; GL Accounting Posted</span>
                    </div>
                    <span className="font-mono font-black text-emerald-900 bg-white px-3 py-1 rounded-lg border border-emerald-200">
                      {selectedClaim.settlement.SETTLEMENT_NO}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div><span className="text-emerald-700 block">Payee Name</span><strong className="text-navy">{selectedClaim.settlement.PAYEE_NAME}</strong></div>
                    <div><span className="text-emerald-700 block">Payment Mode &amp; Ref</span><strong>{selectedClaim.settlement.PAYMENT_MODE} / {selectedClaim.settlement.PAYMENT_REF_NO || '—'}</strong></div>
                    <div><span className="text-emerald-700 block">Net Settled Amount</span><strong className="text-base text-emerald-800">OMR {Number(selectedClaim.settlement.SETTLED_AMOUNT).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></div>
                    <div><span className="text-emerald-700 block">GL Journal Voucher</span><strong className="font-mono text-blue-700">{selectedClaim.settlement.GL_VOUCHER_NO}</strong></div>
                  </div>
                </div>
              ) : !selectedClaim.assessment ? (
                <div className="p-8 text-center text-amber-800 bg-amber-50 rounded-xl border border-amber-200">
                  <AlertTriangle className="w-7 h-7 mx-auto mb-2 text-amber-600" />
                  <p className="font-bold">Claim Assessment Required First</p>
                  <p className="mt-1">Complete Stage 2 (Claim Assessment) and approve the claim before disbursement.</p>
                </div>
              ) : (
                <form onSubmit={handleSettleClaim} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Payee / Beneficiary Name *</label>
                      <input
                        type="text"
                        required
                        value={settleForm.payeeName}
                        onChange={(e) => setSettleForm({ ...settleForm, payeeName: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Relationship</label>
                      <input
                        type="text"
                        value={settleForm.payeeRelation}
                        onChange={(e) => setSettleForm({ ...settleForm, payeeRelation: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Payment Mode *</label>
                      <select
                        value={settleForm.paymentMode}
                        onChange={(e) => setSettleForm({ ...settleForm, paymentMode: e.target.value as any })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white font-semibold"
                      >
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="NEFT_RTGS">NEFT / RTGS Wire</option>
                        <option value="DIRECT_CREDIT">Direct Account Credit</option>
                        <option value="CHEQUE">Account Payee Cheque</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={settleForm.payeeBankName}
                        onChange={(e) => setSettleForm({ ...settleForm, payeeBankName: e.target.value })}
                        placeholder="e.g. Bank Muscat"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Bank Account No</label>
                      <input
                        type="text"
                        value={settleForm.payeeAccountNo}
                        onChange={(e) => setSettleForm({ ...settleForm, payeeAccountNo: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">IBAN / Swift Code</label>
                      <input
                        type="text"
                        value={settleForm.payeeIban}
                        onChange={(e) => setSettleForm({ ...settleForm, payeeIban: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Payment Reference No</label>
                      <input
                        type="text"
                        value={settleForm.paymentRefNo}
                        onChange={(e) => setSettleForm({ ...settleForm, paymentRefNo: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">Settlement Remarks</label>
                      <input
                        type="text"
                        value={settleForm.remarks}
                        onChange={(e) => setSettleForm({ ...settleForm, remarks: e.target.value })}
                        placeholder="Final settlement authorization notes..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div className="text-sm font-black text-teal-700">
                      Net Settlement Payout: OMR{' '}
                      {Number(selectedClaim.assessment.NET_PAYABLE_AMOUNT).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-xs disabled:opacity-50"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>{actionLoading ? 'Settling & Posting GL...' : 'Authorize Settlement & Post GL Entries'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 4: STAGE 4 - ACCOUNTING ENTRIES (T_GL_JOURNAL_ENTRY) & AUDIT TRAIL */}
          {detailTab === 'accounting' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                  <div>
                    <h3 className="text-sm font-extrabold text-navy">
                      Stage 4: Double-Entry Accounting Journal (T_GL_JOURNAL_ENTRY)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Automatically generated by <code className="font-mono">PKG_CLAIMS.SP_POST_CLAIM_GL</code> upon claim settlement.
                    </p>
                  </div>
                  {selectedClaim.settlement?.GL_VOUCHER_NO && (
                    <span className="px-3 py-1 rounded-lg bg-blue-50 border border-blue-200 font-mono text-xs font-black text-blue-800">
                      Voucher: {selectedClaim.settlement.GL_VOUCHER_NO}
                    </span>
                  )}
                </div>

                {selectedClaim.journalEntries.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-400">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-600">No accounting entries posted yet</p>
                    <p className="mt-1">GL Debit/Credit entries are posted automatically when Stage 3 (Claim Settlement) is executed.</p>
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
                        {selectedClaim.journalEntries.map((j) => (
                          <tr key={j.ENTRY_ID} className="hover:bg-slate-50/60">
                            <td className="py-2.5 px-4 font-mono font-bold text-navy whitespace-nowrap">
                              {j.JOURNAL_VOUCHER_NO}
                              <div className="text-[10px] font-sans text-slate-400 font-normal">{j.VOUCHER_DATE}</div>
                            </td>
                            <td className="py-2.5 px-4 font-mono font-bold text-blue-700">{j.GL_ACCOUNT_CODE}</td>
                            <td className="py-2.5 px-4 font-semibold text-slate-800">{j.GL_ACCOUNT_NAME}</td>
                            <td className="py-2.5 px-4 text-slate-600">{j.NARRATION}</td>
                            <td className="py-2.5 px-4 text-right font-black text-rose-700 whitespace-nowrap">
                              {j.DR_CR_FLAG === 'D' ? Number(j.AMOUNT).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-black text-emerald-700 whitespace-nowrap">
                              {j.DR_CR_FLAG === 'C' ? Number(j.AMOUNT).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-navy">
                        <tr>
                          <td colSpan={4} className="py-3 px-4 uppercase text-[11px]">
                            Balanced Double-Entry Voucher Totals (DR = CR)
                          </td>
                          <td className="py-3 px-4 text-right text-rose-800">
                            OMR{' '}
                            {selectedClaim.journalEntries
                              .filter((j) => j.DR_CR_FLAG === 'D')
                              .reduce((acc, j) => acc + Number(j.AMOUNT), 0)
                              .toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right text-emerald-800">
                            OMR{' '}
                            {selectedClaim.journalEntries
                              .filter((j) => j.DR_CR_FLAG === 'C')
                              .reduce((acc, j) => acc + Number(j.AMOUNT), 0)
                              .toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Claim Lifecycle Audit Trail */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 text-xs">
                <h3 className="text-sm font-extrabold text-navy flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" />
                  <span>Claim Audit Trail ({selectedClaim.auditLogs.length})</span>
                </h3>
                <div className="divide-y divide-slate-100">
                  {selectedClaim.auditLogs.map((log) => (
                    <div key={log.AUDIT_ID} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <span className="font-bold text-navy">{log.ACTION_TYPE}</span>
                        <span className="mx-2 text-slate-400">&rarr;</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {log.TO_STATUS}
                        </span>
                        {log.REMARKS && <p className="text-slate-600 mt-0.5">{log.REMARKS}</p>}
                      </div>
                      <div className="text-[10px] text-slate-400 whitespace-nowrap">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {log.ACTION_BY} &bull; {log.ACTION_ON}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
