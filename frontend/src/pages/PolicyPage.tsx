import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import {
  Briefcase,
  Search,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Printer,
  FileText,
  ShieldCheck,
  User,
  Users,
  ShieldAlert,
  Percent,
  Calendar,
  DollarSign,
  Clock,
  Layers,
  ChevronRight,
  Send,
  Building,
  Award,
  FileCheck2,
  Check,
  FileEdit,
  Plus,
  Trash2,
  History,
  ShieldAlert as ShieldAlertIcon
} from 'lucide-react';
import { policyService } from '../services/policyService';
import { endorsementService } from '../services/endorsementService';
import { PolicyInfoRecord, PolicyDetail, PolicyStatus } from '../types/policy';
import {
  PolicyEndorsementRecord,
  EndorsementType,
  CreateEndorsementPayload,
  EndorsementCalculationResult
} from '../types/endorsement';

const STATUS_BADGES: Record<PolicyStatus, { bg: string; text: string; border: string }> = {
  PENDING_APPROVAL: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  APPROVED: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  IN_FORCE: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  LAPSED: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
  SURRENDERED: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
  MATURED: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  CLAIMED: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' }
};

export const PolicyPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userGroup = (user?.userGroup || 'ADMIN').toUpperCase();
  const isPolicyAdmin = userGroup === 'UWMGR' || userGroup === 'POLICY_ADMIN' || userGroup === 'ADMIN';

  // Modes: 'list' | 'detail' | 'schedule'
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'schedule'>('list');
  const [selectedPolNo, setSelectedPolNo] = useState<string | null>(null);

  // Data
  const [policies, setPolicies] = useState<PolicyInfoRecord[]>([]);
  const [policyDetail, setPolicyDetail] = useState<PolicyDetail | null>(null);

  // Loading states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [isProcessingApproval, setIsProcessingApproval] = useState<boolean>(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Approval form
  const [approvalRemarks, setApprovalRemarks] = useState<string>('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Endorsement States
  const [endorsements, setEndorsements] = useState<PolicyEndorsementRecord[]>([]);
  const [isEndorsementsLoading, setIsEndorsementsLoading] = useState<boolean>(false);
  const [isEndorsementModalOpen, setIsEndorsementModalOpen] = useState<boolean>(false);
  const [isSubmittingEndorsement, setIsSubmittingEndorsement] = useState<boolean>(false);
  const [expandedEndorsementId, setExpandedEndorsementId] = useState<number | null>(null);

  // Endorsement Form Fields
  const [endorsementType, setEndorsementType] = useState<EndorsementType>('ADDRESS_CONTACT');
  const [endorsementEffectiveDate, setEndorsementEffectiveDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [endorsementReason, setEndorsementReason] = useState<string>('');
  const [endorsementRemarks, setEndorsementRemarks] = useState<string>('');
  const [addressFields, setAddressFields] = useState({
    address: '',
    mobile: '',
    email: '',
    occupation: ''
  });
  const [beneficiaryFields, setBeneficiaryFields] = useState<
    Array<{ name: string; relation: string; dob?: string; sharePct: number; idType?: string; idNo?: string; contact?: string }>
  >([]);
  const [sumAssuredField, setSumAssuredField] = useState<number>(100000);
  const [payFreqField, setPayFreqField] = useState<'ANNUAL' | 'SEMI_ANNUAL' | 'QUARTERLY' | 'MONTHLY'>('ANNUAL');
  const [dbCalculation, setDbCalculation] = useState<EndorsementCalculationResult | null>(null);
  const [isCalculatingDb, setIsCalculatingDb] = useState<boolean>(false);

  // Live DB-side calculation effect for financial alterations
  useEffect(() => {
    if (!isEndorsementModalOpen || !selectedPolNo) return;
    if (endorsementType !== 'SUM_ASSURED_CHANGE' && endorsementType !== 'FREQUENCY_CHANGE') {
      setDbCalculation(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCalculatingDb(true);
      try {
        const res = await endorsementService.calculateImpact(
          selectedPolNo,
          endorsementType,
          endorsementType === 'SUM_ASSURED_CHANGE' ? sumAssuredField : null,
          endorsementType === 'FREQUENCY_CHANGE' ? payFreqField : null
        );
        if (res.success && res.calculation) {
          setDbCalculation(res.calculation);
        }
      } catch (err) {
        console.error('DB endorsement calculation error', err);
      } finally {
        setIsCalculatingDb(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [isEndorsementModalOpen, selectedPolNo, endorsementType, sumAssuredField, payFreqField]);

  // Load Policies Register
  const loadPolicies = async () => {
    setIsLoading(true);
    try {
      const res = await policyService.getPolicies(
        statusFilter === 'ALL' ? undefined : statusFilter,
        searchTerm
      );
      if (res.success && res.policies) {
        setPolicies(res.policies);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load policies' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'list') {
      loadPolicies();
    }
  }, [statusFilter, searchTerm, viewMode]);

  // Handle URL param for auto-opening a policy if requested
  useEffect(() => {
    const policyNoParam = searchParams.get('policyNo');
    if (policyNoParam) {
      handleOpenDetail(policyNoParam);
    }
  }, [searchParams]);

  // Statistics
  const metrics = useMemo(() => {
    const total = policies.length;
    const pending = policies.filter(p => p.POL_STATUS === 'PENDING_APPROVAL').length;
    const inForce = policies.filter(p => p.POL_STATUS === 'IN_FORCE').length;
    const totalSumAssured = policies.reduce((acc, p) => acc + (Number(p.POL_SUM_ASSURED) || 0), 0);
    return { total, pending, inForce, totalSumAssured };
  }, [policies]);

  // Fetch Endorsement History
  const loadEndorsements = async (polNo: string) => {
    setIsEndorsementsLoading(true);
    try {
      const res = await endorsementService.getByPolicy(polNo);
      if (res.success && res.endorsements) {
        setEndorsements(res.endorsements);
      } else {
        setEndorsements([]);
      }
    } catch (err: any) {
      console.error('Failed to load policy endorsements', err);
      setEndorsements([]);
    } finally {
      setIsEndorsementsLoading(false);
    }
  };

  // Open Policy Detail
  const handleOpenDetail = async (polNo: string) => {
    setSelectedPolNo(polNo);
    setIsDetailLoading(true);
    setFeedback(null);
    try {
      const res = await policyService.getPolicyById(polNo);
      if (res.success && res.policy) {
        setPolicyDetail(res.policy);
        setViewMode('detail');
        loadEndorsements(polNo);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load policy details' });
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Open Policy Schedule View
  const handleOpenSchedule = async (polNo?: string) => {
    const target = polNo || selectedPolNo;
    if (!target) return;
    if (!policyDetail || policyDetail.info.POL_NO !== target) {
      setIsDetailLoading(true);
      try {
        const res = await policyService.getPolicyById(target);
        if (res.success && res.policy) {
          setPolicyDetail(res.policy);
          setSelectedPolNo(target);
          setViewMode('schedule');
          loadEndorsements(target);
        }
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'Failed to load policy schedule' });
      } finally {
        setIsDetailLoading(false);
      }
    } else {
      setViewMode('schedule');
      if (target) loadEndorsements(target);
    }
  };

  // Open Endorsement Modal with prefilled values
  const handleOpenEndorsementModal = () => {
    if (!policyDetail) return;
    setEndorsementType('ADDRESS_CONTACT');
    setEndorsementEffectiveDate(new Date().toISOString().split('T')[0]);
    setEndorsementReason('');
    setEndorsementRemarks('');
    setAddressFields({
      address: policyDetail.assured?.PAS_ADDRESS || '',
      mobile: policyDetail.assured?.PAS_MOBILE || '',
      email: policyDetail.assured?.PAS_EMAIL || '',
      occupation: policyDetail.assured?.PAS_OCCUPATION || ''
    });
    setBeneficiaryFields(
      policyDetail.beneficiaries && policyDetail.beneficiaries.length > 0
        ? policyDetail.beneficiaries.map(b => ({
            name: b.PBEN_NAME || '',
            relation: b.PBEN_RELATION || 'SPOUSE',
            dob: b.PBEN_DOB ? String(b.PBEN_DOB).split('T')[0] : '',
            sharePct: Number(b.PBEN_SHARE_PCT) || 100,
            idType: b.PBEN_ID_TYPE || 'NATIONAL_ID',
            idNo: b.PBEN_ID_NO || '',
            contact: b.PBEN_CONTACT || ''
          }))
        : [{ name: '', relation: 'SPOUSE', sharePct: 100, idType: 'NATIONAL_ID', idNo: '', contact: '' }]
    );
    setSumAssuredField(Number(policyDetail.info.POL_SUM_ASSURED) || 100000);
    setPayFreqField((policyDetail.info.POL_PAY_FREQ as any) || 'ANNUAL');
    setIsEndorsementModalOpen(true);
  };

  // Submit Endorsement
  const handleApplyEndorsement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolNo || !policyDetail) return;
    if (!endorsementReason.trim()) {
      setFeedback({ type: 'error', message: 'Endorsement Reason is mandatory.' });
      return;
    }

    const payload: CreateEndorsementPayload = {
      endorsementType,
      effectiveDate: endorsementEffectiveDate,
      reason: endorsementReason.trim(),
      remarks: endorsementRemarks.trim() || undefined
    };

    if (endorsementType === 'ADDRESS_CONTACT') {
      payload.addressContact = {
        address: addressFields.address.trim(),
        mobile: addressFields.mobile.trim(),
        email: addressFields.email.trim(),
        occupation: addressFields.occupation.trim()
      };
    } else if (endorsementType === 'BENEFICIARY_CHANGE') {
      if (beneficiaryFields.length === 0) {
        setFeedback({ type: 'error', message: 'At least one beneficiary nominee must be added.' });
        return;
      }
      for (const b of beneficiaryFields) {
        if (!b.name.trim()) {
          setFeedback({ type: 'error', message: 'All beneficiary nominees must have a name specified.' });
          return;
        }
      }
      const totalShare = beneficiaryFields.reduce((acc, b) => acc + (Number(b.sharePct) || 0), 0);
      if (Math.abs(totalShare - 100) > 0.01) {
        setFeedback({
          type: 'error',
          message: `Nominee share percentage must equal exactly 100% (currently ${totalShare}%).`
        });
        return;
      }
      payload.beneficiaries = beneficiaryFields;
    } else if (endorsementType === 'SUM_ASSURED_CHANGE') {
      if (sumAssuredField < 1000) {
        setFeedback({ type: 'error', message: 'New Sum Assured must be at least $1,000.' });
        return;
      }
      payload.sumAssuredChange = { newSumAssured: sumAssuredField };
    } else if (endorsementType === 'FREQUENCY_CHANGE') {
      payload.frequencyChange = { newPayFreq: payFreqField };
    }

    setIsSubmittingEndorsement(true);
    setFeedback(null);
    try {
      const res = await endorsementService.createEndorsement(selectedPolNo, payload);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Endorsement '${res.endorsement.ENDORSEMENT_NO}' applied successfully! (${res.endorsement.ENDORSEMENT_CATEGORY} alteration)`
        });
        setIsEndorsementModalOpen(false);
        const updatedPol = await policyService.getPolicyById(selectedPolNo);
        if (updatedPol.success && updatedPol.policy) {
          setPolicyDetail(updatedPol.policy);
        }
        loadEndorsements(selectedPolNo);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to execute endorsement' });
    } finally {
      setIsSubmittingEndorsement(false);
    }
  };

  // Policy Approval Action (Policy Admin only)
  const handleApprovePolicy = async (decision: 'APPROVE' | 'REJECT' | 'REWORK') => {
    if (!selectedPolNo) return;
    setIsProcessingApproval(true);
    setFeedback(null);
    try {
      const res = await policyService.approvePolicy(selectedPolNo, {
        decision,
        remarks: approvalRemarks || 'Approved and placed In-Force by Policy Administration'
      });
      setPolicyDetail(res.policy);
      setApprovalRemarks('');
      setFeedback({
        type: 'success',
        message: res.message || `Policy '${selectedPolNo}' action ${decision} executed successfully.`
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to authorize policy' });
    } finally {
      setIsProcessingApproval(false);
    }
  };

  // Print Policy Schedule
  const handlePrintSchedule = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb (hidden during printing) */}
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <span>Insurance Operations</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-blue-600 font-medium">Policy Administration & Schedule</span>
            {viewMode !== 'list' && selectedPolNo && (
              <>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="font-mono font-semibold text-gray-800">{selectedPolNo}</span>
              </>
            )}
            {viewMode === 'schedule' && (
              <>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-emerald-700 font-semibold">Policy Schedule Document</span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Briefcase className="w-7 h-7 text-blue-600" />
            Policy Administration Console
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Policy Lifecycle Management &bull; Policy Authorization &bull; Official Policy Schedule Generation
          </p>
        </div>

        {/* Global Navigation actions */}
        <div className="flex items-center gap-3">
          {viewMode !== 'list' && (
            <button
              type="button"
              onClick={() => {
                setViewMode('list');
                loadPolicies();
              }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Policies Register</span>
            </button>
          )}

          {viewMode === 'detail' && (
            <button
              type="button"
              onClick={() => handleOpenSchedule()}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Generate Policy Schedule</span>
            </button>
          )}

          {viewMode === 'schedule' && (
            <button
              type="button"
              onClick={handlePrintSchedule}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-all shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>Print Schedule Document</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`print:hidden p-4 rounded-xl flex items-start justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : feedback.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : feedback.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            ) : (
              <Briefcase className="w-5 h-5 text-blue-600 shrink-0" />
            )}
            <span className="text-sm font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-gray-400 hover:text-gray-600 p-1 text-sm font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: POLICIES REGISTER LIST */}
      {/* ========================================================================= */}
      {viewMode === 'list' && (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Incepted Policies</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.total}</p>
                <span className="text-xs text-blue-600 font-medium">All contracts in system</span>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Briefcase className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Approval</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{metrics.pending}</p>
                <span className="text-xs text-amber-700 font-medium">Requires Policy Admin action</span>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">In Force (Active)</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{metrics.inForce}</p>
                <span className="text-xs text-emerald-700 font-medium">Authorized contracts</span>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Portfolio Sum Assured</p>
                <p className="text-xl font-bold text-gray-900 mt-1">${metrics.totalSumAssured.toLocaleString()}</p>
                <span className="text-xs text-gray-500 font-medium">Total life underwriting risk</span>
              </div>
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              {/* Search input */}
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search by Policy No, Proposal No, or Life Assured..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                {['ALL', 'PENDING_APPROVAL', 'APPROVED', 'IN_FORCE'].map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      statusFilter === st
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}

                <button
                  onClick={loadPolicies}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors ml-1"
                  title="Refresh Policy List"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Policies Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50/80 text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="py-3.5 px-4">Policy No & Inception</th>
                    <th className="py-3.5 px-4">Life Assured</th>
                    <th className="py-3.5 px-4">Product & Plan</th>
                    <th className="py-3.5 px-4 text-right">Sum Assured</th>
                    <th className="py-3.5 px-4 text-right">Installment Premium</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-500">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                        <span>Loading policy contracts from database...</span>
                      </td>
                    </tr>
                  ) : policies.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-500">
                        <Briefcase className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="font-medium text-gray-700">No policy contracts found</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Approved proposals converted by Policy Admin will appear here.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    policies.map(p => {
                      const st = STATUS_BADGES[p.POL_STATUS] || STATUS_BADGES.PENDING_APPROVAL;
                      return (
                        <tr
                          key={p.POL_ID}
                          className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                          onClick={() => handleOpenDetail(p.POL_NO)}
                        >
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className="font-bold text-gray-900 font-mono group-hover:text-blue-600 transition-colors">
                              {p.POL_NO}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 font-mono">
                              Prop: {p.PROP_NO}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              Incept: {p.POL_INCEPTION_DATE ? String(p.POL_INCEPTION_DATE).split('T')[0] : '-'}
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-medium text-gray-900">{p.PAS_NAME || 'Not specified'}</div>
                            <div className="text-xs text-gray-500">
                              Age: {p.PAS_AGE || '-'} | Gender: {p.PAS_GENDER || '-'}
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-medium text-gray-900">{p.PROD_NAME || p.POL_PROD_CODE}</div>
                            <div className="text-xs text-gray-500">
                              Term: {p.POL_TERM} yrs | PPT: {p.POL_PREM_PAY_TERM} yrs
                            </div>
                          </td>

                          <td className="py-4 px-4 text-right font-medium text-gray-900 whitespace-nowrap">
                            ${Number(p.POL_SUM_ASSURED || 0).toLocaleString()}
                          </td>

                          <td className="py-4 px-4 text-right font-semibold text-emerald-600 whitespace-nowrap">
                            ${Number(p.TOTAL_PAYABLE || 0).toLocaleString()}
                            <div className="text-[11px] font-normal text-gray-400">
                              {p.POL_PAY_FREQ} {p.POL_MOP ? `• MOP: ${p.POL_MOP}` : ''}
                            </div>
                          </td>

                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${st.bg} ${st.text} ${st.border}`}
                            >
                              {p.POL_STATUS.replace('_', ' ')}
                            </span>
                            <div className="text-[11px] text-gray-500 mt-1">
                              Level {p.POL_APPROVAL_LEVEL}
                            </div>
                          </td>

                          <td
                            className="py-4 px-4 text-right whitespace-nowrap"
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenDetail(p.POL_NO)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="View & Authorize Policy"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenSchedule(p.POL_NO)}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Generate Policy Schedule"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: IN-PAGE POLICY DETAIL & APPROVAL CONSOLE */}
      {/* ========================================================================= */}
      {viewMode === 'detail' && policyDetail && (
        <div className="space-y-6">
          {/* Status & Contract Hero Card */}
          <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold font-mono text-gray-900 tracking-tight">
                    {policyDetail.info.POL_NO}
                  </h2>
                  <span
                    className={`px-3 py-1 text-xs font-bold rounded-full border ${
                      STATUS_BADGES[policyDetail.info.POL_STATUS].bg
                    } ${STATUS_BADGES[policyDetail.info.POL_STATUS].text} ${
                      STATUS_BADGES[policyDetail.info.POL_STATUS].border
                    }`}
                  >
                    {policyDetail.info.POL_STATUS.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-4">
                  <span>Proposal Lineage: <strong className="font-mono text-gray-800">{policyDetail.info.PROP_NO}</strong></span>
                  <span>UID: <span className="font-mono">{policyDetail.info.POL_UID}</span></span>
                  <span>Created By: <strong>{policyDetail.info.CREATED_BY}</strong></span>
                </div>
              </div>

              {/* Action Buttons Header */}
              <div className="flex items-center gap-3">
                {(policyDetail.info.POL_STATUS === 'IN_FORCE' || policyDetail.info.POL_STATUS === 'APPROVED') ? (
                  <button
                    type="button"
                    onClick={handleOpenEndorsementModal}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                  >
                    <FileEdit className="w-4 h-4" />
                    <span>Create Policy Endorsement</span>
                  </button>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-medium cursor-not-allowed"
                    title="Policy endorsements can be executed once the contract is approved and In-Force"
                  >
                    <ShieldAlertIcon className="w-3.5 h-3.5 text-gray-400" />
                    <span>Endorsements Locked (Requires In-Force Status)</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenSchedule()}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Generate Policy Schedule</span>
                </button>
              </div>
            </div>

            {/* Contract Dates Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
              <div>
                <p className="text-xs text-gray-500 font-medium">Issue Date</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                  {policyDetail.info.POL_ISSUE_DATE ? String(policyDetail.info.POL_ISSUE_DATE).split('T')[0] : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Inception Date</p>
                <p className="text-sm font-semibold text-blue-600 mt-0.5">
                  {policyDetail.info.POL_INCEPTION_DATE ? String(policyDetail.info.POL_INCEPTION_DATE).split('T')[0] : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Maturity Date</p>
                <p className="text-sm font-semibold text-purple-600 mt-0.5">
                  {policyDetail.info.POL_MATURITY_DATE ? String(policyDetail.info.POL_MATURITY_DATE).split('T')[0] : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Authorized Approver</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                  {policyDetail.info.POL_APPROVED_BY || 'Pending Authorization'}
                </p>
              </div>
            </div>
          </div>

          {/* Section 1: Life Assured Demographics & Health Profile */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-900 flex items-center gap-2 pb-2 border-b border-blue-100">
              <User className="w-4 h-4 text-blue-600" />
              Life Assured & Risk Particulars
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-gray-500">Full Legal Name</p>
                <p className="text-sm font-bold text-gray-900">{policyDetail.assured?.PAS_NAME || '-'}</p>
                <p className="text-xs text-gray-500 mt-2">Date of Birth / Age</p>
                <p className="text-sm font-medium text-gray-800">
                  {policyDetail.assured?.PAS_DOB ? String(policyDetail.assured.PAS_DOB).split('T')[0] : '-'} ({policyDetail.assured?.PAS_AGE} yrs)
                </p>
                <p className="text-xs text-gray-500 mt-2">Gender / Identity</p>
                <p className="text-sm font-medium text-gray-800">
                  {policyDetail.assured?.PAS_GENDER === 'M' ? 'Male' : policyDetail.assured?.PAS_GENDER === 'F' ? 'Female' : 'Other'} &bull; {policyDetail.assured?.PAS_ID_TYPE}: {policyDetail.assured?.PAS_ID_NO || '-'}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Occupation & Annual Income</p>
                <p className="text-sm font-semibold text-gray-900">
                  {policyDetail.assured?.PAS_OCCUPATION || 'Standard Risk'} &bull; ${Number(policyDetail.assured?.PAS_ANN_INCOME || 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-2">Contact Details</p>
                <p className="text-sm font-medium text-gray-800">{policyDetail.assured?.PAS_MOBILE || '-'}</p>
                <p className="text-xs text-gray-500">{policyDetail.assured?.PAS_EMAIL || '-'}</p>
                <p className="text-xs text-gray-500 mt-2">Residential Address</p>
                <p className="text-xs text-gray-700">{policyDetail.assured?.PAS_ADDRESS || 'Not provided'}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-600">Health Scoring & Underwriting</p>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Smoker Habit:</span>
                  <span className={`font-bold ${policyDetail.assured?.PAS_SMOKER_YN === 'Y' ? 'text-red-600' : 'text-emerald-600'}`}>
                    {policyDetail.assured?.PAS_SMOKER_YN === 'Y' ? 'Smoker (Rating Applied)' : 'Non-Smoker'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Height / Weight / BMI:</span>
                  <span className="font-medium text-gray-800">
                    {policyDetail.assured?.PAS_HEIGHT_CM || '-'} cm / {policyDetail.assured?.PAS_WEIGHT_KG || '-'} kg (BMI: {policyDetail.assured?.PAS_BMI || '-'})
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">HIV Screen:</span>
                  <span className="font-semibold text-emerald-600">
                    {policyDetail.assured?.PAS_HIV_YN === 'Y' ? 'Positive' : 'Non-Reactive (Clear)'}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-500">Medical Notes:</p>
                  <p className="text-xs italic text-gray-700 mt-0.5">
                    {policyDetail.assured?.PAS_MEDICAL_HISTORY || 'Standard medical clearance granted.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Coverage, Riders & Financial Summary Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Attached Supplementary Riders */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-purple-900 flex items-center gap-2 pb-2 border-b border-purple-100">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                Attached Supplementary Riders ({policyDetail.riders.length})
              </h3>
              {policyDetail.riders.length === 0 ? (
                <p className="text-xs italic text-gray-400 py-4 text-center">No optional riders attached to this contract.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-600 uppercase font-semibold">
                      <tr>
                        <th className="py-2 px-3">Rider Name</th>
                        <th className="py-2 px-3 text-right">Sum Assured</th>
                        <th className="py-2 px-3 text-right">Premium</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {policyDetail.riders.map((r, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-medium text-gray-800">
                            {r.PRD_RIDER_NAME}
                            <span className="text-[10px] text-gray-400 block font-mono">{r.PRD_RIDER_CODE}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-gray-900">
                            ${Number(r.PRD_SUM_ASSURED).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-purple-700">
                            ${Number(r.PRD_PREMIUM).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Beneficiaries Table */}
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 pt-4 border-t border-gray-100 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                Nominees & Beneficiary Apportionment
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 text-gray-600 uppercase font-semibold">
                    <tr>
                      <th className="py-1.5 px-3">Nominee Name</th>
                      <th className="py-1.5 px-3">Relationship</th>
                      <th className="py-1.5 px-3 text-right">Share %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {policyDetail.beneficiaries.map((b, i) => (
                      <tr key={i}>
                        <td className="py-1.5 px-3 font-medium text-gray-900">{b.PBEN_NAME}</td>
                        <td className="py-1.5 px-3 text-gray-600">{b.PBEN_RELATION}</td>
                        <td className="py-1.5 px-3 text-right font-bold text-blue-600">{b.PBEN_SHARE_PCT}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Premium Breakdown & Modal Installment */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-2 pb-2 border-b border-emerald-100">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Actuarial Premium Schedule Breakdown
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Basic Sum Assured:</span>
                  <span className="font-bold text-gray-900">
                    ${Number(policyDetail.premiumSummary?.PPS_BASIC_SUM_ASSURED || policyDetail.info.POL_SUM_ASSURED).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Basic Annual Premium (PKG_TARIFF):</span>
                  <span className="font-semibold text-gray-900">
                    ${Number(policyDetail.premiumSummary?.PPS_BASIC_PREMIUM || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Total Rider Premium (+):</span>
                  <span className="font-semibold text-purple-700">
                    +${Number(policyDetail.premiumSummary?.PPS_TOTAL_RIDER_PREMIUM || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Underwriting Loadings (+):</span>
                  <span className="font-semibold text-red-600">
                    +${Number(policyDetail.premiumSummary?.PPS_TOTAL_LOADING || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Underwriting Discounts (-):</span>
                  <span className="font-semibold text-emerald-600">
                    -${Number(policyDetail.premiumSummary?.PPS_TOTAL_DISCOUNT || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100 bg-gray-50 px-2 rounded">
                  <span className="font-semibold text-gray-700">Net Annual Premium:</span>
                  <span className="font-bold text-gray-900">
                    ${Number(policyDetail.premiumSummary?.PPS_NET_ANNUAL_PREM || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Mode of Payment (MOP) & Frequency:</span>
                  <span className="font-semibold text-gray-900">
                    {policyDetail.info.POL_MOP ? `MOP: ${policyDetail.info.POL_MOP} • ` : ''}{policyDetail.info.POL_PAY_FREQ} (Factor: {policyDetail.premiumSummary?.PPS_MODAL_FACTOR || 1.0})
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Modal Installment Premium:</span>
                  <span className="font-semibold text-gray-900">
                    ${Number(policyDetail.premiumSummary?.PPS_INSTALLMENT_PREM || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Applicable Policy Tax (18%):</span>
                  <span className="font-semibold text-gray-700">
                    ${Number(policyDetail.premiumSummary?.PPS_TAX_AMOUNT || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-3 px-3 bg-emerald-50 rounded-xl text-emerald-950 font-bold text-sm">
                  <span>Total Installment Payable:</span>
                  <span className="text-base text-emerald-700 font-mono">
                    ${Number(policyDetail.premiumSummary?.PPS_TOTAL_PAYABLE || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Policy Approval & Decision Console */}
          <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-blue-600" />
                Policy Administration & Authorization Gateway
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Operator:</span>
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                  isPolicyAdmin ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                  {user?.userName || user?.userId} [{userGroup}]
                </span>
              </div>
            </div>

            {policyDetail.info.POL_STATUS === 'PENDING_APPROVAL' ? (
              <>
                {/* Authorization Instructions */}
                {isPolicyAdmin ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Policy Administration / Underwriting Manager Clearance Required
                    </p>
                    <p>
                      As Underwriting Manager or Policy Administrator, you have authority to approve this converted policy contract. Confirm that life assured records, sum assured, attached riders, and installment premium calculations meet statutory criteria. Authorizing will place the contract <strong>IN FORCE</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    <p className="font-bold">Pending Underwriting Manager / Policy Admin Approval</p>
                    <p className="mt-1">
                      You are logged in with role <strong>{userGroup}</strong>. Only users with the <strong>UWMGR</strong> or <strong>POLICY_ADMIN</strong> role can authorize incepted policies and place them IN FORCE.
                    </p>
                  </div>
                )}

                {isPolicyAdmin && (
                  <div className="space-y-3 pt-2">
                    <label className="block text-xs font-semibold text-gray-700">
                      Policy Authorization Remarks & Audit Notes:
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Enter policy endorsement authorization remarks, regulatory compliance check..."
                      value={approvalRemarks}
                      onChange={e => setApprovalRemarks(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        type="button"
                        disabled={isProcessingApproval}
                        onClick={() => handleApprovePolicy('APPROVE')}
                        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs shadow-md transition-all hover:scale-[1.02]"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>{isProcessingApproval ? 'Authorizing Policy...' : 'Authorize & Place Policy IN FORCE'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isProcessingApproval}
                        onClick={() => handleApprovePolicy('REWORK')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg font-semibold text-xs transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Return for Rework</span>
                      </button>

                      <button
                        type="button"
                        disabled={isProcessingApproval}
                        onClick={() => handleApprovePolicy('REJECT')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-semibold text-xs transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Decline Policy</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <span className="font-bold text-emerald-900 text-sm">Policy Contract Active & IN FORCE</span>
                  </div>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Authorized by <strong>{policyDetail.info.POL_APPROVED_BY || 'policy_admin'}</strong> on {String(policyDetail.info.POL_APPROVED_ON || 'Today').split('T')[0]}. Remarks: {policyDetail.info.POL_APPROVAL_REMARKS || 'Authorized in full.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenSchedule()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-md"
                >
                  <Printer className="w-4 h-4" />
                  <span>View & Print Schedule</span>
                </button>
              </div>
            )}
          </div>

          {/* Section 4: Policy Endorsement Ledger & Audit Trail */}
          <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                  Policy Endorsement Ledger & Historical Alterations
                </h3>
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {endorsements.length} Record{endorsements.length === 1 ? '' : 's'}
                </span>
              </div>

              {(policyDetail.info.POL_STATUS === 'IN_FORCE' || policyDetail.info.POL_STATUS === 'APPROVED') && (
                <button
                  type="button"
                  onClick={handleOpenEndorsementModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Execute Alteration</span>
                </button>
              )}
            </div>

            {isEndorsementsLoading ? (
              <div className="py-8 text-center text-gray-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                <span className="text-xs">Loading endorsement records from database...</span>
              </div>
            ) : endorsements.length === 0 ? (
              <div className="p-6 bg-gray-50 rounded-xl border border-gray-100 text-center">
                <FileCheck2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-gray-700">No Endorsements Recorded</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  This policy contract remains in its pristine inception state. Any financial or non-financial modifications will be immutably recorded here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-3">Endorsement #</th>
                        <th className="py-2.5 px-3">Type & Category</th>
                        <th className="py-2.5 px-3">Effective Date</th>
                        <th className="py-2.5 px-3 text-right">Premium Impact</th>
                        <th className="py-2.5 px-3">Reason</th>
                        <th className="py-2.5 px-3">Authorized By</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {endorsements.map((end) => {
                        const isExpanded = expandedEndorsementId === end.ENDORSEMENT_ID;
                        const isFinancial = end.ENDORSEMENT_CATEGORY === 'FINANCIAL';
                        return (
                          <React.Fragment key={end.ENDORSEMENT_ID}>
                            <tr className="hover:bg-indigo-50/20 transition-colors">
                              <td className="py-3 px-3 font-mono font-bold text-gray-900">
                                {end.ENDORSEMENT_NO}
                              </td>
                              <td className="py-3 px-3">
                                <span className="font-semibold text-gray-800">
                                  {end.ENDORSEMENT_TYPE.replace(/_/g, ' ')}
                                </span>
                                <span
                                  className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    isFinancial
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                                  }`}
                                >
                                  {end.ENDORSEMENT_CATEGORY}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-gray-700 font-mono">
                                {end.EFFECTIVE_DATE}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold">
                                {end.PREMIUM_IMPACT > 0 ? (
                                  <span className="text-red-600">+${end.PREMIUM_IMPACT.toLocaleString()}</span>
                                ) : end.PREMIUM_IMPACT < 0 ? (
                                  <span className="text-emerald-600">-${Math.abs(end.PREMIUM_IMPACT).toLocaleString()}</span>
                                ) : (
                                  <span className="text-gray-400">$0.00</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-gray-700 max-w-xs truncate" title={end.REASON}>
                                {end.REASON}
                              </td>
                              <td className="py-3 px-3 text-gray-600">
                                <div>{end.APPROVED_BY || end.CREATED_BY}</div>
                                <div className="text-[10px] text-gray-400 font-mono">{end.CREATED_ON?.split(' ')[0]}</div>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedEndorsementId(isExpanded ? null : end.ENDORSEMENT_ID)
                                  }
                                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
                                >
                                  {isExpanded ? 'Hide Snapshot' : 'View Changes'}
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-gray-50/80">
                                <td colSpan={7} className="p-4 border-t border-b border-indigo-100">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                                    <div className="p-3 bg-red-50/60 border border-red-100 rounded-lg">
                                      <p className="font-bold text-red-900 mb-1">State Prior to Endorsement:</p>
                                      <pre className="text-[11px] font-mono text-gray-800 whitespace-pre-wrap break-all overflow-x-auto max-h-48 p-2 bg-white rounded border border-red-100">
                                        {end.PREV_VALUE_JSON
                                          ? JSON.stringify(JSON.parse(end.PREV_VALUE_JSON), null, 2)
                                          : 'N/A'}
                                      </pre>
                                    </div>
                                    <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg">
                                      <p className="font-bold text-emerald-900 mb-1">Endorsed New State:</p>
                                      <pre className="text-[11px] font-mono text-gray-800 whitespace-pre-wrap break-all overflow-x-auto max-h-48 p-2 bg-white rounded border border-emerald-100">
                                        {end.NEW_VALUE_JSON
                                          ? JSON.stringify(JSON.parse(end.NEW_VALUE_JSON), null, 2)
                                          : 'N/A'}
                                      </pre>
                                    </div>
                                  </div>
                                  {end.REMARKS && (
                                    <p className="text-[11px] italic text-gray-600 mt-2">
                                      Remarks: {end.REMARKS}
                                    </p>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: OFFICIAL LIFE INSURANCE POLICY SCHEDULE CERTIFICATE */}
      {/* ========================================================================= */}
      {viewMode === 'schedule' && policyDetail && (
        <div className="space-y-6">
          {/* Action Ribbon (Hidden when printing) */}
          <div className="print:hidden p-4 bg-linear-to-r from-blue-900 to-indigo-900 text-white rounded-xl shadow-md flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                Official Life Insurance Policy Schedule Certificate
              </h2>
              <p className="text-xs text-blue-200 mt-0.5">
                Statutory policy schedule formatted for legal binding, client issuance, and official printing.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewMode('detail')}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Back to Policy Details
              </button>
              <button
                type="button"
                onClick={handlePrintSchedule}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-gray-900 rounded-lg text-xs font-bold transition-transform shadow-md active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Print Policy Schedule</span>
              </button>
            </div>
          </div>

          {/* Printable Document Container (Styled like an official Certificate / Policy Schedule) */}
          <div className="bg-white p-8 md:p-12 rounded-xl border border-gray-300 shadow-lg text-gray-800 font-serif print:shadow-none print:border-none print:p-0 print:m-0">
            {/* Header / Insurer Particulars */}
            <div className="border-b-2 border-gray-900 pb-6 mb-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <Building className="w-8 h-8 text-blue-900 print:text-black" />
                <h1 className="text-2xl md:text-3xl font-extrabold uppercase tracking-wider text-blue-950 font-sans print:text-black">
                  KINSURE PLUS LIFE INSURANCE CORPORATION
                </h1>
              </div>
              <p className="text-xs text-gray-600 font-sans tracking-wide">
                Registered under the Insurance Regulatory and Development Authority &bull; Corporate Identification No: U66010TN2026PLC001
              </p>
              <p className="text-xs text-gray-500 font-sans mt-0.5">
                Head Office: KINS Tower, Financial District, Chennai - 600001, India &bull; Support: 1800-KINS-LIFE
              </p>
              <div className="mt-4 pt-3 border-t border-gray-200 inline-block px-8 py-1.5 bg-gray-50 border rounded print:bg-transparent">
                <span className="text-base font-bold uppercase tracking-widest text-gray-900 font-sans">
                  INDIVIDUAL LIFE POLICY SCHEDULE & BENEFIT SPECIFICATION
                </span>
              </div>
            </div>

            {/* Document Reference Ribbon */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 mb-6 border-b border-gray-200 text-xs font-sans">
              <div>
                <span className="text-gray-500 block">POLICY NUMBER:</span>
                <span className="text-base font-bold font-mono text-gray-950">{policyDetail.info.POL_NO}</span>
              </div>
              <div>
                <span className="text-gray-500 block">PROPOSAL REFERENCE:</span>
                <span className="text-base font-bold font-mono text-gray-800">{policyDetail.info.PROP_NO}</span>
              </div>
              <div>
                <span className="text-gray-500 block">DATE OF INCEPTION:</span>
                <span className="text-base font-semibold text-gray-900">
                  {policyDetail.info.POL_INCEPTION_DATE ? String(policyDetail.info.POL_INCEPTION_DATE).split('T')[0] : '-'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">POLICY STATUS:</span>
                <span className="text-base font-bold text-emerald-800 font-sans">
                  {policyDetail.info.POL_STATUS.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Section 1: Life Assured & Policyholder Particulars */}
            <div className="mb-6 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider bg-gray-100 px-3 py-1 text-gray-900 font-sans border-l-4 border-blue-900 print:bg-gray-200">
                1. PARTICULARS OF THE LIFE ASSURED & PROPOSER
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 text-xs font-sans px-2">
                <div>
                  <span className="text-gray-500">Name of Life Assured:</span>
                  <p className="font-bold text-sm text-gray-900">{policyDetail.assured?.PAS_NAME || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Date of Birth & Age:</span>
                  <p className="font-semibold text-gray-800">
                    {policyDetail.assured?.PAS_DOB ? String(policyDetail.assured.PAS_DOB).split('T')[0] : '-'} ({policyDetail.assured?.PAS_AGE} Years)
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Gender / ID Document:</span>
                  <p className="font-semibold text-gray-800">
                    {policyDetail.assured?.PAS_GENDER === 'M' ? 'Male' : policyDetail.assured?.PAS_GENDER === 'F' ? 'Female' : 'Other'} &bull; {policyDetail.assured?.PAS_ID_TYPE}: {policyDetail.assured?.PAS_ID_NO || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Residential Address:</span>
                  <p className="font-medium text-gray-700">{policyDetail.assured?.PAS_ADDRESS || 'Registered on file'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Contact Number / Email:</span>
                  <p className="font-medium text-gray-700">{policyDetail.assured?.PAS_MOBILE || '-'} / {policyDetail.assured?.PAS_EMAIL || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Occupation / Smoking Status:</span>
                  <p className="font-medium text-gray-700">
                    {policyDetail.assured?.PAS_OCCUPATION || 'Standard'} &bull; {policyDetail.assured?.PAS_SMOKER_YN === 'Y' ? 'Smoker' : 'Non-Smoker'}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Plan & Benefit Particulars */}
            <div className="mb-6 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider bg-gray-100 px-3 py-1 text-gray-900 font-sans border-l-4 border-blue-900 print:bg-gray-200">
                2. CONTRACT PARTICULARS & CORE BENEFITS
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-y-2 gap-x-4 text-xs font-sans px-2">
                <div>
                  <span className="text-gray-500">Plan & Product Name:</span>
                  <p className="font-bold text-gray-900">{policyDetail.info.PROD_NAME || policyDetail.info.POL_PROD_CODE}</p>
                </div>
                <div>
                  <span className="text-gray-500">Plan Category / Type:</span>
                  <p className="font-semibold text-gray-800">{policyDetail.info.POL_PLAN_TYPE}</p>
                </div>
                <div>
                  <span className="text-gray-500">Policy Term:</span>
                  <p className="font-semibold text-gray-800">{policyDetail.info.POL_TERM} Years</p>
                </div>
                <div>
                  <span className="text-gray-500">Premium Paying Term (PPT):</span>
                  <p className="font-semibold text-gray-800">{policyDetail.info.POL_PREM_PAY_TERM} Years</p>
                </div>
                <div>
                  <span className="text-gray-500">Basic Sum Assured:</span>
                  <p className="font-bold text-sm text-blue-950 font-sans">
                    ${Number(policyDetail.info.POL_SUM_ASSURED).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Date of Maturity:</span>
                  <p className="font-semibold text-gray-800">
                    {policyDetail.info.POL_MATURITY_DATE ? String(policyDetail.info.POL_MATURITY_DATE).split('T')[0] : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Premium Frequency & MOP:</span>
                  <p className="font-semibold text-gray-800">{policyDetail.info.POL_PAY_FREQ} {policyDetail.info.POL_MOP ? `(MOP: ${policyDetail.info.POL_MOP})` : ''}</p>
                </div>
                <div>
                  <span className="text-gray-500">Maturity / Survival Benefit:</span>
                  <p className="font-semibold text-gray-800">100% of Sum Assured + Vested Bonuses</p>
                </div>
              </div>
            </div>

            {/* Section 3: Attached Supplementary Riders */}
            {policyDetail.riders.length > 0 && (
              <div className="mb-6 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider bg-gray-100 px-3 py-1 text-gray-900 font-sans border-l-4 border-blue-900 print:bg-gray-200">
                  3. SCHEDULE OF SUPPLEMENTARY RIDERS & ACCELERATED BENEFITS
                </h3>
                <table className="w-full text-xs font-sans border border-gray-200">
                  <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200">
                    <tr>
                      <th className="py-1.5 px-3 text-left">Rider Cover Description</th>
                      <th className="py-1.5 px-3 text-right">Rider Sum Assured</th>
                      <th className="py-1.5 px-3 text-right">Periodic Premium</th>
                      <th className="py-1.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {policyDetail.riders.map((r, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3 font-semibold text-gray-900">{r.PRD_RIDER_NAME}</td>
                        <td className="py-2 px-3 text-right font-medium">${Number(r.PRD_SUM_ASSURED).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-semibold text-gray-900">${Number(r.PRD_PREMIUM).toLocaleString()}</td>
                        <td className="py-2 px-3 text-center text-emerald-700 font-bold">IN FORCE</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Section 4: Premium Summary Schedule */}
            <div className="mb-6 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider bg-gray-100 px-3 py-1 text-gray-900 font-sans border-l-4 border-blue-900 print:bg-gray-200">
                4. SCHEDULE OF PREMIUMS & PERIODIC CHARGES
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 border border-gray-200 bg-gray-50/50 rounded text-xs font-sans">
                <div>
                  <span className="text-gray-500">Basic Annual Premium:</span>
                  <p className="font-semibold text-gray-900">
                    ${Number(policyDetail.premiumSummary?.PPS_BASIC_PREMIUM || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Riders Premium:</span>
                  <p className="font-semibold text-gray-900">
                    +${Number(policyDetail.premiumSummary?.PPS_TOTAL_RIDER_PREMIUM || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Underwriting Adjustment:</span>
                  <p className="font-semibold text-gray-900">
                    +${Number(policyDetail.premiumSummary?.PPS_TOTAL_LOADING || 0).toLocaleString()} / -${Number(policyDetail.premiumSummary?.PPS_TOTAL_DISCOUNT || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Applicable Tax (18%):</span>
                  <p className="font-semibold text-gray-900">
                    ${Number(policyDetail.premiumSummary?.PPS_TAX_AMOUNT || 0).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded flex justify-between items-center text-sm font-sans font-bold text-blue-950">
                <span>TOTAL PERIODIC INSTALLMENT PAYABLE ({policyDetail.info.POL_PAY_FREQ}{policyDetail.info.POL_MOP ? ` / MOP: ${policyDetail.info.POL_MOP}` : ''}):</span>
                <span className="text-lg font-mono text-blue-900">
                  ${Number(policyDetail.premiumSummary?.PPS_TOTAL_PAYABLE || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Section 5: Nominees & Beneficiary Schedule */}
            <div className="mb-6 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider bg-gray-100 px-3 py-1 text-gray-900 font-sans border-l-4 border-blue-900 print:bg-gray-200">
                5. SCHEDULE OF NOMINEES (UNDER SECTION 39 OF INSURANCE ACT)
              </h3>
              <table className="w-full text-xs font-sans border border-gray-200">
                <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-1.5 px-3 text-left">Nominee Full Name</th>
                    <th className="py-1.5 px-3 text-left">Relationship to Life Assured</th>
                    <th className="py-1.5 px-3 text-right">Apportioned Share (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {policyDetail.beneficiaries.map((b, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3 font-semibold text-gray-900">{b.PBEN_NAME}</td>
                      <td className="py-2 px-3 text-gray-700">{b.PBEN_RELATION}</td>
                      <td className="py-2 px-3 text-right font-bold text-gray-900">{b.PBEN_SHARE_PCT}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Section 6: Specific Exclusions & Executed Endorsements */}
            {(policyDetail.exclusions.length > 0 || endorsements.length > 0) && (
              <div className="mb-6 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider bg-gray-100 px-3 py-1 text-gray-900 font-sans border-l-4 border-blue-900 print:bg-gray-200">
                  6. SPECIFIC ENDORSEMENTS & EXCLUSIONS
                </h3>

                {policyDetail.exclusions.length > 0 && (
                  <ul className="list-disc pl-5 text-xs text-gray-700 font-sans space-y-1">
                    {policyDetail.exclusions.map((ex, i) => (
                      <li key={i}>
                        <strong>{ex.PEX_CODE}:</strong> {ex.PEX_DESC}
                      </li>
                    ))}
                  </ul>
                )}

                {endorsements.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                      Executed Policy Endorsements & Contract Amendments:
                    </p>
                    <table className="w-full text-xs font-sans border border-gray-200">
                      <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                        <tr>
                          <th className="py-1 px-2 text-left">Endorsement No</th>
                          <th className="py-1 px-2 text-left">Category / Type</th>
                          <th className="py-1 px-2 text-left">Effective Date</th>
                          <th className="py-1 px-2 text-right">Prem. Impact</th>
                          <th className="py-1 px-2 text-left">Description / Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {endorsements.map((end) => (
                          <tr key={end.ENDORSEMENT_ID}>
                            <td className="py-1 px-2 font-mono font-bold">{end.ENDORSEMENT_NO}</td>
                            <td className="py-1 px-2">{end.ENDORSEMENT_TYPE.replace(/_/g, ' ')} ({end.ENDORSEMENT_CATEGORY})</td>
                            <td className="py-1 px-2">{end.EFFECTIVE_DATE}</td>
                            <td className="py-1 px-2 text-right font-semibold">
                              {end.PREMIUM_IMPACT > 0
                                ? `+$${end.PREMIUM_IMPACT.toLocaleString()}`
                                : end.PREMIUM_IMPACT < 0
                                ? `-$${Math.abs(end.PREMIUM_IMPACT).toLocaleString()}`
                                : '$0.00'}
                            </td>
                            <td className="py-1 px-2 text-gray-700">{end.REASON}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Section 7: Attestation, Authorized Signatory & Corporate Seal */}
            <div className="pt-8 border-t-2 border-gray-800 grid grid-cols-2 md:grid-cols-3 gap-6 items-end font-sans text-xs">
              <div>
                <p className="text-gray-500">Place of Issuance: Chennai, India</p>
                <p className="text-gray-500">
                  Date of Endorsement: {policyDetail.info.POL_APPROVED_ON ? String(policyDetail.info.POL_APPROVED_ON).split('T')[0] : String(policyDetail.info.POL_ISSUE_DATE).split('T')[0]}
                </p>
                <p className="text-gray-400 text-[10px] mt-2 font-mono">
                  Document Checksum: KINS-SCHED-{policyDetail.info.POL_NO}-VERIFIED
                </p>
              </div>

              <div className="text-center">
                <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-full mx-auto flex items-center justify-center text-[10px] text-gray-400 uppercase tracking-widest font-sans">
                  Official Corporate Seal
                </div>
              </div>

              <div className="text-right">
                <div className="mb-8">
                  <span className="font-serif italic text-base text-gray-800 block">
                    {policyDetail.info.POL_APPROVED_BY || 'Chief Underwriter'}
                  </span>
                </div>
                <div className="border-t border-gray-400 pt-1">
                  <p className="font-bold text-gray-900">For KINSURE PLUS LIFE INSURANCE CORP.</p>
                  <p className="text-gray-500 text-[11px]">Authorized Signatory & Chief Underwriting Officer</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POLICY ENDORSEMENT EXECUTION MODAL */}
      {/* ========================================================================= */}
      {isEndorsementModalOpen && policyDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <FileEdit className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">Execute Policy Endorsement</h3>
                  <p className="text-xs text-blue-200">
                    Policy: <span className="font-mono font-bold text-white">{policyDetail.info.POL_NO}</span> &bull; Life Assured: {policyDetail.assured?.PAS_NAME}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEndorsementModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyEndorsement} className="p-6 space-y-5">
              {/* Context Notice */}
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Contractual Immutability Notice:</span> Direct modifications to an in-force policy are restricted. Alterations are executed as formal endorsements with an audit trail, historical state snapshot, and automated premium recalculation.
                </div>
              </div>

              {/* Endorsement Type Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Endorsement Alteration Type *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'ADDRESS_CONTACT', label: 'Address & Contact', cat: 'Non-Financial' },
                    { id: 'BENEFICIARY_CHANGE', label: 'Nominee / Beneficiary', cat: 'Non-Financial' },
                    { id: 'SUM_ASSURED_CHANGE', label: 'Sum Assured Alteration', cat: 'Financial' },
                    { id: 'FREQUENCY_CHANGE', label: 'Payment Frequency', cat: 'Financial' },
                    { id: 'GENERAL', label: 'General Clause / Memo', cat: 'Non-Financial' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEndorsementType(t.id as EndorsementType)}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                        endorsementType === t.id
                          ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 font-bold shadow-xs'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div>{t.label}</div>
                      <span className={`text-[10px] font-semibold ${t.cat === 'Financial' ? 'text-amber-700' : 'text-blue-700'}`}>
                        {t.cat}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Reason Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Effective Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={endorsementEffectiveDate}
                    onChange={e => setEndorsementEffectiveDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Endorsement Reason / Justification *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Policyholder relocated / Added newborn child"
                    value={endorsementReason}
                    onChange={e => setEndorsementReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Dynamic Sub-forms based on Endorsement Type */}

              {/* 1. Address & Contact */}
              {endorsementType === 'ADDRESS_CONTACT' && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    Updated Life Assured Particulars
                  </h4>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Residential Address</label>
                    <textarea
                      rows={2}
                      value={addressFields.address}
                      onChange={e => setAddressFields({ ...addressFields, address: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter updated postal address..."
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">Mobile Number</label>
                      <input
                        type="tel"
                        value={addressFields.mobile}
                        onChange={e => setAddressFields({ ...addressFields, mobile: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">Email Address</label>
                      <input
                        type="email"
                        value={addressFields.email}
                        onChange={e => setAddressFields({ ...addressFields, email: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">Occupation</label>
                      <input
                        type="text"
                        value={addressFields.occupation}
                        onChange={e => setAddressFields({ ...addressFields, occupation: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Beneficiary / Nominee Apportionment */}
              {endorsementType === 'BENEFICIARY_CHANGE' && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      Apportioned Nominees & Shares (Must equal 100%)
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setBeneficiaryFields([
                          ...beneficiaryFields,
                          { name: '', relation: 'SPOUSE', sharePct: 0, idType: 'NATIONAL_ID', idNo: '', contact: '' }
                        ])
                      }
                      className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Nominee
                    </button>
                  </div>

                  <div className="space-y-2">
                    {beneficiaryFields.map((b, idx) => (
                      <div key={idx} className="p-2.5 bg-white rounded-lg border border-gray-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <div className="sm:col-span-4">
                          <input
                            type="text"
                            placeholder="Nominee Full Name *"
                            value={b.name}
                            onChange={e => {
                              const updated = [...beneficiaryFields];
                              updated[idx].name = e.target.value;
                              setBeneficiaryFields(updated);
                            }}
                            className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <select
                            value={b.relation}
                            onChange={e => {
                              const updated = [...beneficiaryFields];
                              updated[idx].relation = e.target.value;
                              setBeneficiaryFields(updated);
                            }}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                          >
                            <option value="SPOUSE">Spouse</option>
                            <option value="CHILD">Child</option>
                            <option value="PARENT">Parent</option>
                            <option value="SIBLING">Sibling</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                        <div className="sm:col-span-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={100}
                              placeholder="Share %"
                              value={b.sharePct}
                              onChange={e => {
                                const updated = [...beneficiaryFields];
                                updated[idx].sharePct = Number(e.target.value) || 0;
                                setBeneficiaryFields(updated);
                              }}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs text-right font-bold"
                            />
                            <span className="text-xs text-gray-500 font-bold">%</span>
                          </div>
                        </div>
                        <div className="sm:col-span-2 text-right">
                          {beneficiaryFields.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setBeneficiaryFields(beneficiaryFields.filter((_, i) => i !== idx));
                              }}
                              className="text-red-500 hover:text-red-700 p-1 rounded"
                              title="Remove nominee"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Share % Counter */}
                  {(() => {
                    const total = beneficiaryFields.reduce((sum, b) => sum + (Number(b.sharePct) || 0), 0);
                    const isValid = Math.abs(total - 100) < 0.01;
                    return (
                      <div className={`p-2 rounded text-xs font-bold flex items-center justify-between ${
                        isValid ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                      }`}>
                        <span>Total Apportioned Share:</span>
                        <span>{total}% {isValid ? '✓ Valid' : '✗ Must equal 100%'}</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 3. Sum Assured Change */}
              {endorsementType === 'SUM_ASSURED_CHANGE' && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                    Financial Alteration: Basic Sum Assured
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <span className="text-gray-500 block">Current Sum Assured:</span>
                      <span className="text-base font-bold text-gray-900 font-mono">
                        ${Number(policyDetail.info.POL_SUM_ASSURED).toLocaleString()}
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <span className="text-gray-500 block">Current Installment Premium:</span>
                      <span className="text-base font-bold text-emerald-600 font-mono">
                        ${Number(policyDetail.premiumSummary?.PPS_INSTALLMENT_PREM || policyDetail.info.TOTAL_PAYABLE || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      New Basic Sum Assured ($) *
                    </label>
                    <input
                      type="number"
                      min={1000}
                      step={5000}
                      value={sumAssuredField}
                      onChange={e => setSumAssuredField(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Impact preview from Oracle DB Package */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1.5">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-amber-900 flex items-center gap-1.5">
                        {isCalculatingDb ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-700" /> : null}
                        <span>Estimated New Installment Premium:</span>
                      </span>
                      <span className="font-mono text-gray-900 font-bold">
                        ${dbCalculation ? dbCalculation.newInstallment.toLocaleString() : '...'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-800">Net Periodic Premium Impact:</span>
                      <span className={`font-mono font-bold ${
                        (dbCalculation?.premiumImpact || 0) > 0
                          ? 'text-red-600'
                          : (dbCalculation?.premiumImpact || 0) < 0
                          ? 'text-emerald-600'
                          : 'text-gray-600'
                      }`}>
                        {dbCalculation
                          ? (dbCalculation.premiumImpact > 0
                              ? `+${dbCalculation.premiumImpact.toLocaleString()}`
                              : `$${dbCalculation.premiumImpact.toLocaleString()}`)
                          : '...'}
                      </span>
                    </div>
                    {dbCalculation && (
                      <div className="flex justify-between text-[11px] text-gray-600 pt-1 border-t border-amber-200/60">
                        <span>Total Payable per Installment (incl. 18% Tax):</span>
                        <span className="font-mono font-bold text-gray-900">${dbCalculation.newTotalPayable.toLocaleString()}</span>
                      </div>
                    )}
                    <p className="text-[10px] text-amber-700 italic pt-0.5">
                      ⚡ Calculated dynamically by Oracle DB (PKG_POLICY_ENDORSEMENT)
                    </p>
                  </div>
                </div>
              )}

              {/* 4. Payment Frequency Change */}
              {endorsementType === 'FREQUENCY_CHANGE' && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    Payment Frequency Alteration
                  </h4>
                  <p className="text-xs text-gray-600">
                    Current Mode: <strong>{policyDetail.info.POL_PAY_FREQ}</strong> &bull; Current Installment: <strong>${Number(policyDetail.premiumSummary?.PPS_INSTALLMENT_PREM || policyDetail.info.TOTAL_PAYABLE || 0).toLocaleString()}</strong>
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      New Payment Frequency *
                    </label>
                    <select
                      value={payFreqField}
                      onChange={e => setPayFreqField(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                    >
                      <option value="ANNUAL">Annual (Factor 1.00)</option>
                      <option value="SEMI_ANNUAL">Semi-Annual (Factor 0.52)</option>
                      <option value="QUARTERLY">Quarterly (Factor 0.265)</option>
                      <option value="MONTHLY">Monthly (Factor 0.088)</option>
                    </select>
                    
                    {/* Live impact preview for Frequency change from Oracle DB */}
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1.5">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-blue-900 flex items-center gap-1.5">
                          {isCalculatingDb ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-700" /> : null}
                          <span>New Modal Installment:</span>
                        </span>
                        <span className="font-mono text-gray-900 font-bold">
                          ${dbCalculation ? dbCalculation.newInstallment.toLocaleString() : '...'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-800">Installment Premium Impact:</span>
                        <span className={`font-mono font-bold ${
                          (dbCalculation?.premiumImpact || 0) > 0
                            ? 'text-red-600'
                            : (dbCalculation?.premiumImpact || 0) < 0
                            ? 'text-emerald-600'
                            : 'text-gray-600'
                        }`}>
                          {dbCalculation
                            ? (dbCalculation.premiumImpact > 0
                                ? `+${dbCalculation.premiumImpact.toLocaleString()}`
                                : `$${dbCalculation.premiumImpact.toLocaleString()}`)
                            : '...'}
                        </span>
                      </div>
                      {dbCalculation && (
                        <div className="flex justify-between text-[11px] text-gray-600 pt-1 border-t border-blue-200/60">
                          <span>Total Payable (incl. Tax):</span>
                          <span className="font-mono font-bold text-gray-900">${dbCalculation.newTotalPayable.toLocaleString()}</span>
                        </div>
                      )}
                      <p className="text-[10px] text-blue-700 italic pt-0.5">
                        ⚡ Modal factor ({dbCalculation?.newModalFactor || '...'}) and tax computed dynamically by Oracle DB (PKG_POLICY_ENDORSEMENT).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. General Clause */}
              {endorsementType === 'GENERAL' && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                    General Contractual Clause / Policy Memo
                  </h4>
                  <p className="text-xs text-gray-500">
                    Specify official endorsement text, special provisions, or administrative annotations.
                  </p>
                </div>
              )}

              {/* General Remarks */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Additional Underwriting Audit Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional notes for regulatory compliance..."
                  value={endorsementRemarks}
                  onChange={e => setEndorsementRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  disabled={isSubmittingEndorsement}
                  onClick={() => setIsEndorsementModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEndorsement}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-md transition-all"
                >
                  {isSubmittingEndorsement ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Executing Endorsement...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Apply & Authorize Endorsement</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PolicyPage;
