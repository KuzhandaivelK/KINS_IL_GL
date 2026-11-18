import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Save,
  ShieldCheck,
  User,
  Users,
  ShieldAlert,
  Calculator,
  Percent,
  Layers,
  Clock,
  Send,
  FileCheck2,
  DollarSign,
  ChevronRight,
  Check,
  X,
  Info,
  Calendar,
  Activity,
  HeartPulse,
  HeartHandshake
} from 'lucide-react';
import { proposalService } from '../services/proposalService';
import { productService } from '../services/productService';
import { coverService } from '../services/coverService';
import {
  ProposalInfoItem,
  ProposalDetail,
  ProposalFormData,
  ProposalStatus,
  PaymentFrequency,
  TariffRateCalculationResult,
  ProposalRider,
  ProposalDiscLoad,
  ProposalBeneficiary,
  ProposalExclusion
} from '../types/proposal';
import { ProductItem } from '../types/product';
import { CoverListItem } from '../types/cover';

const STATUS_BADGES: Record<ProposalStatus, { bg: string; text: string; border: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
  SUBMITTED: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  UNDERWRITING: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  APPROVED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  REJECTED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  REWORK: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  CONVERTED: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' }
};

const STEPS = [
  { id: 1, title: 'Plan & Product', subtitle: 'Terms & SA', icon: Layers },
  { id: 2, title: 'Life Assured', subtitle: 'Personal & Health', icon: User },
  { id: 3, title: 'Rider Covers', subtitle: 'Optional Benefits', icon: ShieldCheck },
  { id: 4, title: 'Discounts & Loadings', subtitle: 'Underwriting Adjustments', icon: Percent },
  { id: 5, title: 'Beneficiaries', subtitle: 'Nominees & Shares', icon: Users },
  { id: 6, title: 'Exclusions', subtitle: 'Policy Clauses', icon: ShieldAlert },
  { id: 7, title: 'Premium Summary', subtitle: 'PKG_TARIFF Calculation', icon: Calculator },
  { id: 8, title: 'Workflow & UW', subtitle: 'Approvals & Audit', icon: FileCheck2 }
];

const emptyFormData: ProposalFormData = {
  info: {
    PROP_PROD_CODE: '',
    PROP_PLAN_TYPE: 'TERM',
    PROP_TERM: 20,
    PROP_PREM_PAY_TERM: 20,
    PROP_SUM_ASSURED: 1000000,
    PROP_PAY_FREQ: 'ANNUAL'
  },
  assured: {
    PAS_NAME: '',
    PAS_DOB: '1995-01-01',
    PAS_AGE: 30,
    PAS_GENDER: 'M',
    PAS_OCCUPATION: 'Software Engineer',
    PAS_ANN_INCOME: 750000,
    PAS_ID_TYPE: 'NATIONAL_ID',
    PAS_ID_NO: '',
    PAS_MOBILE: '',
    PAS_EMAIL: '',
    PAS_ADDRESS: '',
    PAS_SMOKER_YN: 'N',
    PAS_HIV_YN: 'N',
    PAS_HEIGHT_CM: 175,
    PAS_WEIGHT_KG: 70,
    PAS_BMI: 22.9,
    PAS_MEDICAL_HISTORY: 'No significant past medical conditions.'
  },
  riders: [],
  discLoads: [],
  beneficiaries: [
    {
      PBEN_NAME: '',
      PBEN_RELATION: 'SPOUSE',
      PBEN_DOB: '1997-05-15',
      PBEN_SHARE_PCT: 100,
      PBEN_ID_TYPE: 'NATIONAL_ID',
      PBEN_ID_NO: '',
      PBEN_CONTACT: ''
    }
  ],
  exclusions: [
    {
      PEX_CODE: 'EX_SUICIDE',
      PEX_DESC: 'Suicide Exclusion Clause: No benefit payable in case of suicide within first 12 months from policy inception.',
      PEX_REASON: 'Standard Statutory Clause'
    },
    {
      PEX_CODE: 'EX_HAZARD',
      PEX_DESC: 'Hazardous Activities: Death arising from extreme sports or private aviation excluded unless endorsed.',
      PEX_REASON: 'Underwriting Standard'
    }
  ],
  premiumSummary: {
    PPS_MTH_CODE: 'MORT_TERM_01',
    PPS_BASE_RATE: 2.10,
    PPS_BASIC_SUM_ASSURED: 1000000,
    PPS_BASIC_PREMIUM: 2100,
    PPS_TOTAL_RIDER_PREMIUM: 0,
    PPS_TOTAL_LOADING: 0,
    PPS_TOTAL_DISCOUNT: 0,
    PPS_NET_ANNUAL_PREM: 2100,
    PPS_MODAL_FACTOR: 1.0,
    PPS_INSTALLMENT_PREM: 2100,
    PPS_TAX_AMOUNT: 0,
    PPS_TOTAL_PAYABLE: 2100
  }
};

export const ProposalPage: React.FC = () => {
  // Page mode: 'list' | 'stepper'
  const [pageMode, setPageMode] = useState<'list' | 'stepper'>('list');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [editingPropNo, setEditingPropNo] = useState<string | null>(null);

  // Data states
  const [proposals, setProposals] = useState<ProposalInfoItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [covers, setCovers] = useState<CoverListItem[]>([]);
  const [proposalDetail, setProposalDetail] = useState<ProposalDetail | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Form State
  const [formData, setFormData] = useState<ProposalFormData>(emptyFormData);
  const [uwComments, setUwComments] = useState<string>('');

  // Status feedback
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Load master lookups: Products and Covers
  useEffect(() => {
    const loadMasters = async () => {
      try {
        const [prodRes, covRes] = await Promise.all([
          productService.getProducts(),
          coverService.getCovers()
        ]);
        if (prodRes.success && prodRes.products) {
          setProducts(prodRes.products);
          if (!formData.info.PROP_PROD_CODE && prodRes.products.length > 0) {
            setFormData(prev => ({
              ...prev,
              info: { ...prev.info, PROP_PROD_CODE: prodRes.products![0].PROD_CODE }
            }));
          }
        }
        if (covRes.success && covRes.covers) {
          setCovers(covRes.covers);
        }
      } catch (err) {
        console.error('Error loading product/cover masters:', err);
      }
    };
    loadMasters();
  }, []);

  // Load Proposals Register
  const loadProposals = async () => {
    setIsLoading(true);
    try {
      const data = await proposalService.getProposals(
        statusFilter === 'ALL' ? undefined : statusFilter,
        searchTerm
      );
      if (data.success && data.proposals) {
        setProposals(data.proposals);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load proposals' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (pageMode === 'list') {
      loadProposals();
    }
  }, [statusFilter, searchTerm, pageMode]);

  // Statistics
  const metrics = useMemo(() => {
    const total = proposals.length;
    const submitted = proposals.filter(p => p.PROP_STATUS === 'SUBMITTED').length;
    const underwriting = proposals.filter(p => p.PROP_STATUS === 'UNDERWRITING').length;
    const approved = proposals.filter(p => p.PROP_STATUS === 'APPROVED').length;
    return { total, submitted, underwriting, approved };
  }, [proposals]);

  // Handle open create
  const handleOpenCreate = () => {
    const defaultProd = products.length > 0 ? products[0].PROD_CODE : 'TRM01';
    setFormData({
      ...emptyFormData,
      info: { ...emptyFormData.info, PROP_PROD_CODE: defaultProd }
    });
    setEditingPropNo(null);
    setProposalDetail(null);
    setCurrentStep(1);
    setFeedback(null);
    setPageMode('stepper');
  };

  // Handle open edit
  const handleOpenEdit = async (propNo: string, startStep: number = 1) => {
    setIsDetailLoading(true);
    setFeedback(null);
    try {
      const res = await proposalService.getProposalById(propNo);
      if (res.success && res.proposal) {
        const p = res.proposal;
        setProposalDetail(p);
        setFormData({
          info: {
            PROP_PROD_CODE: p.info.PROP_PROD_CODE,
            PROP_PLAN_TYPE: p.info.PROP_PLAN_TYPE,
            PROP_TERM: p.info.PROP_TERM,
            PROP_PREM_PAY_TERM: p.info.PROP_PREM_PAY_TERM,
            PROP_SUM_ASSURED: p.info.PROP_SUM_ASSURED,
            PROP_PAY_FREQ: p.info.PROP_PAY_FREQ
          },
          assured: {
            ...p.assured,
            PAS_DOB: p.assured.PAS_DOB ? p.assured.PAS_DOB.split('T')[0] : '1995-01-01'
          },
          riders: p.riders || [],
          discLoads: p.discLoads || [],
          beneficiaries: p.beneficiaries || [],
          exclusions: p.exclusions || [],
          premiumSummary: p.premiumSummary || emptyFormData.premiumSummary
        });
        setEditingPropNo(propNo);
        setCurrentStep(startStep);
        setPageMode('stepper');
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load proposal details' });
    } finally {
      setIsDetailLoading(false);
    }
  };

  // BMI Auto Calculator
  const handleHeightWeightChange = (heightCm?: number, weightKg?: number) => {
    const h = heightCm !== undefined ? heightCm : formData.assured.PAS_HEIGHT_CM;
    const w = weightKg !== undefined ? weightKg : formData.assured.PAS_WEIGHT_KG;
    let computedBmi: number | null = null;
    if (h && w && h > 0) {
      const hM = h / 100;
      computedBmi = Math.round((w / (hM * hM)) * 10) / 10;
    }
    setFormData(prev => ({
      ...prev,
      assured: {
        ...prev.assured,
        PAS_HEIGHT_CM: h ?? null,
        PAS_WEIGHT_KG: w ?? null,
        PAS_BMI: computedBmi
      }
    }));
  };

  // Auto Age Calculator from DOB
  const handleDobChange = (dob: string) => {
    let age = formData.assured.PAS_AGE;
    if (dob) {
      const birthDate = new Date(dob);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
      age = Math.max(0, calculatedAge);
    }
    setFormData(prev => ({
      ...prev,
      assured: { ...prev.assured, PAS_DOB: dob, PAS_AGE: age }
    }));
  };

  // Add / Remove Rider
  const handleAddRider = (coverCode: string) => {
    const cover = covers.find(c => c.coverCode === coverCode);
    if (!cover) return;

    if (formData.riders.some(r => r.PRD_RIDER_CODE === coverCode)) {
      setFeedback({ type: 'info', message: `Rider ${cover.coverDesc} is already attached.` });
      return;
    }

    const defaultSa = Math.min(500000, formData.info.PROP_SUM_ASSURED);
    const rate = 0.50;
    const premium = Math.round(((defaultSa / 1000) * rate) * 100) / 100;

    const newRider: ProposalRider = {
      PRD_RIDER_CODE: cover.coverCode,
      PRD_RIDER_NAME: cover.coverDesc,
      PRD_SUM_ASSURED: defaultSa,
      PRD_RATE: rate,
      PRD_PREMIUM: premium
    };

    setFormData(prev => ({ ...prev, riders: [...prev.riders, newRider] }));
  };

  const handleRemoveRider = (index: number) => {
    setFormData(prev => ({
      ...prev,
      riders: prev.riders.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateRiderSa = (index: number, sa: number) => {
    const updated = [...formData.riders];
    const r = updated[index];
    const rate = r.PRD_RATE || 0.45;
    const prem = Math.round(((sa / 1000) * rate) * 100) / 100;
    updated[index] = { ...r, PRD_SUM_ASSURED: sa, PRD_PREMIUM: prem };
    setFormData(prev => ({ ...prev, riders: updated }));
  };

  // Add / Remove Discount or Loading
  const handleAddDiscLoad = (type: 'DISCOUNT' | 'LOADING') => {
    const newLine: ProposalDiscLoad = {
      PDL_TYPE: type,
      PDL_REASON: type === 'LOADING' ? 'OCCUPATIONAL' : 'HIGH_SA',
      PDL_CALC_TYPE: 'PERCENTAGE',
      PDL_RATE_VALUE: type === 'LOADING' ? 10 : 5,
      PDL_AMOUNT: 0,
      PDL_REMARKS: ''
    };
    setFormData(prev => ({ ...prev, discLoads: [...prev.discLoads, newLine] }));
  };

  const handleRemoveDiscLoad = (index: number) => {
    setFormData(prev => ({
      ...prev,
      discLoads: prev.discLoads.filter((_, i) => i !== index)
    }));
  };

  // Add / Remove Beneficiary
  const handleAddBeneficiary = () => {
    const newBen: ProposalBeneficiary = {
      PBEN_NAME: '',
      PBEN_RELATION: 'CHILD',
      PBEN_DOB: '',
      PBEN_SHARE_PCT: 0,
      PBEN_ID_TYPE: 'NATIONAL_ID',
      PBEN_ID_NO: '',
      PBEN_CONTACT: ''
    };
    setFormData(prev => ({ ...prev, beneficiaries: [...prev.beneficiaries, newBen] }));
  };

  const handleRemoveBeneficiary = (index: number) => {
    setFormData(prev => ({
      ...prev,
      beneficiaries: prev.beneficiaries.filter((_, i) => i !== index)
    }));
  };

  // Add / Remove Exclusion
  const handleAddExclusion = () => {
    const newEx: ProposalExclusion = {
      PEX_CODE: 'EX_CUSTOM',
      PEX_DESC: '',
      PEX_REASON: 'Underwriting Requirement'
    };
    setFormData(prev => ({ ...prev, exclusions: [...prev.exclusions, newEx] }));
  };

  const handleRemoveExclusion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      exclusions: prev.exclusions.filter((_, i) => i !== index)
    }));
  };

  // Calculate Premium using Oracle Database PKG_PROPOSAL_TARIFF -> PKG_TARIFF
  const handleCalculateWithTariff = async () => {
    setIsCalculating(true);
    setFeedback(null);
    try {
      const res = await proposalService.calculateTariff({
        mthCode: 'MORT_TERM_01',
        age: formData.assured.PAS_AGE,
        term: formData.info.PROP_TERM,
        gender: formData.assured.PAS_GENDER,
        sumAssured: formData.info.PROP_SUM_ASSURED,
        payFreq: formData.info.PROP_PAY_FREQ,
        riders: formData.riders.map(r => ({ riderCode: r.PRD_RIDER_CODE, sumAssured: r.PRD_SUM_ASSURED })),
        discLoads: formData.discLoads.map(d => ({
          type: d.PDL_TYPE,
          calcType: d.PDL_CALC_TYPE,
          rateValue: d.PDL_RATE_VALUE,
          reason: d.PDL_REASON
        }))
      });

      if (res.success && res.calculation) {
        const c = res.calculation;
        setFormData(prev => ({
          ...prev,
          premiumSummary: {
            PPS_MTH_CODE: c.mthCode,
            PPS_BASE_RATE: c.tariffRate,
            PPS_BASIC_SUM_ASSURED: prev.info.PROP_SUM_ASSURED,
            PPS_BASIC_PREMIUM: c.basicPremium,
            PPS_TOTAL_RIDER_PREMIUM: c.totalRiderPremium,
            PPS_TOTAL_LOADING: c.totalLoading,
            PPS_TOTAL_DISCOUNT: c.totalDiscount,
            PPS_NET_ANNUAL_PREM: c.netAnnualPremium,
            PPS_MODAL_FACTOR: c.modalFactor,
            PPS_INSTALLMENT_PREM: c.installmentPremium,
            PPS_TAX_AMOUNT: c.taxAmount,
            PPS_TOTAL_PAYABLE: c.totalPayable
          }
        }));
        setFeedback({
          type: 'success',
          message: `Oracle DB PKG_TARIFF calculated successfully! Base mortality rate: $${c.tariffRate} per $1,000 SA.`
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to calculate tariff' });
    } finally {
      setIsCalculating(false);
    }
  };

  // Save Proposal (Draft or Updates)
  const handleSaveProposal = async () => {
    setFeedback(null);
    // Basic validation
    if (!formData.info.PROP_PROD_CODE) {
      setFeedback({ type: 'error', message: 'Please select a Product Plan in Step 1.' });
      setCurrentStep(1);
      return;
    }
    if (!formData.assured.PAS_NAME.trim()) {
      setFeedback({ type: 'error', message: 'Life Assured name is required in Step 2.' });
      setCurrentStep(2);
      return;
    }

    setIsSaving(true);
    try {
      if (!editingPropNo) {
        const res = await proposalService.createProposal(formData);
        setFeedback({
          type: 'success',
          message: `Proposal '${res.proposal.info.PROP_NO}' created successfully!`
        });
        setEditingPropNo(res.proposal.info.PROP_NO);
        setProposalDetail(res.proposal);
        setCurrentStep(8);
      } else {
        const res = await proposalService.updateProposal(editingPropNo, formData);
        setFeedback({
          type: 'success',
          message: `Proposal '${editingPropNo}' updated successfully!`
        });
        setProposalDetail(res.proposal);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save proposal' });
    } finally {
      setIsSaving(false);
    }
  };

  // Process Workflow Action (Submit, Underwrite: Approve, Reject, Rework)
  const handleWorkflowAction = async (action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'REWORK') => {
    if (!editingPropNo) {
      setFeedback({ type: 'error', message: 'Please save the proposal before submitting to workflow.' });
      return;
    }

    try {
      const res = await proposalService.processWorkflow(
        editingPropNo,
        action,
        uwComments,
        proposalDetail?.info.PROP_ASSIGNED_ROLE || 'MAKER'
      );
      setProposalDetail(res.proposal);
      setUwComments('');
      setFeedback({
        type: 'success',
        message: `Workflow action '${action}' completed successfully! Current status: ${res.proposal.info.PROP_STATUS}`
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || `Failed to process ${action}` });
    }
  };

  // Delete Proposal
  const handleDeleteProposal = async (propNo: string) => {
    if (!window.confirm(`Are you sure you want to delete proposal '${propNo}' and all associated records?`)) {
      return;
    }
    try {
      const res = await proposalService.deleteProposal(propNo);
      setFeedback({ type: 'success', message: res.message || 'Proposal deleted successfully' });
      if (pageMode === 'stepper') {
        setPageMode('list');
      } else {
        loadProposals();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete proposal' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div>
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
            <span>Individual Life</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-blue-600 font-medium">Proposal Entry & Underwriting</span>
            {pageMode === 'stepper' && (
              <>
                <ChevronRight className="w-4 h-4" />
                <span className="text-gray-700 font-semibold">
                  {editingPropNo ? `Proposal: ${editingPropNo}` : 'New Proposal'}
                </span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" />
            Proposal Entry & Underwriting Engine
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            End-to-end proposal creation, assured medical scoring, PKG_TARIFF dynamic rating, and multi-tier approval.
          </p>
        </div>

        {pageMode === 'list' ? (
          <div className="flex items-center gap-3">
            <button
              onClick={loadProposals}
              className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 rounded-lg transition-colors"
              title="Refresh List"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-all"
            >
              <Plus className="w-5 h-5" />
              <span>Create New Proposal</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setPageMode('list');
                setFeedback(null);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Register</span>
            </button>
            {editingPropNo && (
              <button
                type="button"
                onClick={() => handleDeleteProposal(editingPropNo)}
                className="p-2.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                title="Delete Proposal"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Global Status Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-start justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : feedback.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : feedback.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: PROPOSALS REGISTER / LIST DASHBOARD */}
      {/* ========================================================================= */}
      {pageMode === 'list' && (
        <>
          {/* Metrics summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Proposals</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.total}</p>
                <span className="text-xs text-blue-600 font-medium">All registered applications</span>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <FileText className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{metrics.submitted}</p>
                <span className="text-xs text-gray-500 font-medium">Pending supervisor check</span>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Underwriting</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">{metrics.underwriting}</p>
                <span className="text-xs text-gray-500 font-medium">Medical & financial review</span>
              </div>
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <HeartPulse className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Approved</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{metrics.approved}</p>
                <span className="text-xs text-emerald-600 font-medium">Ready for policy conversion</span>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {['ALL', 'DRAFT', 'SUBMITTED', 'UNDERWRITING', 'APPROVED', 'REWORK', 'REJECTED'].map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      statusFilter === st
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {st === 'ALL' ? 'All Statuses' : st}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search proposal no, UID, assured..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Proposals Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Proposal Reference</th>
                    <th className="py-3.5 px-4">Life Assured</th>
                    <th className="py-3.5 px-4">Product Plan</th>
                    <th className="py-3.5 px-4 text-right">Sum Assured</th>
                    <th className="py-3.5 px-4 text-right">Payable Premium</th>
                    <th className="py-3.5 px-4 text-center">Status & Level</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-500">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                        <span>Loading proposals...</span>
                      </td>
                    </tr>
                  ) : proposals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-500">
                        <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="font-medium text-gray-700">No proposals found</p>
                        <p className="text-xs text-gray-400 mt-1">Click 'Create New Proposal' to begin entry</p>
                      </td>
                    </tr>
                  ) : (
                    proposals.map(p => {
                      const st = STATUS_BADGES[p.PROP_STATUS] || STATUS_BADGES.DRAFT;
                      return (
                        <tr
                          key={p.PROP_ID}
                          className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                          onClick={() => handleOpenEdit(p.PROP_NO)}
                        >
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className="font-semibold text-gray-900 font-mono group-hover:text-blue-600 transition-colors">
                              {p.PROP_NO}
                            </div>
                            <div className="text-[11px] font-mono text-gray-400">
                              UID: {p.PROP_UID ? `${p.PROP_UID.substring(0, 8)}...` : '-'}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">{p.PROP_DATE}</div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-medium text-gray-900">{p.PAS_NAME || 'Not specified'}</div>
                            <div className="text-xs text-gray-500">
                              Age: {p.PAS_AGE || '-'} | Gender: {p.PAS_GENDER || '-'}
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-medium text-gray-900">{p.PROD_NAME || p.PROP_PROD_CODE}</div>
                            <div className="text-xs text-gray-500">
                              Term: {p.PROP_TERM} yrs | PPT: {p.PROP_PREM_PAY_TERM} yrs
                            </div>
                          </td>

                          <td className="py-4 px-4 text-right font-medium text-gray-900 whitespace-nowrap">
                            ${Number(p.PROP_SUM_ASSURED || 0).toLocaleString()}
                          </td>

                          <td className="py-4 px-4 text-right font-semibold text-emerald-600 whitespace-nowrap">
                            ${Number(p.TOTAL_PAYABLE || 0).toLocaleString()}
                            <div className="text-[11px] font-normal text-gray-400">
                              {p.PROP_PAY_FREQ}
                            </div>
                          </td>

                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${st.bg} ${st.text} ${st.border}`}
                            >
                              {p.PROP_STATUS}
                            </span>
                            <div className="text-[11px] text-gray-500 mt-1">
                              Level {p.PROP_CURRENT_LEVEL} ({p.PROP_ASSIGNED_ROLE})
                            </div>
                          </td>

                          <td
                            className="py-4 px-4 text-right whitespace-nowrap"
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenEdit(p.PROP_NO, 1)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit / Review Proposal"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenEdit(p.PROP_NO, 8)}
                                className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Underwriting Assessment"
                              >
                                <ShieldCheck className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteProposal(p.PROP_NO)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Proposal"
                              >
                                <Trash2 className="w-4 h-4" />
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
      {/* VIEW 2: STEPPER WIZARD FOR WHOLE PROPOSAL ENTRY & UNDERWRITING */}
      {/* ========================================================================= */}
      {pageMode === 'stepper' && (
        <div className="space-y-6">
          {/* Stepper Navigation Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <div className="flex items-center justify-between min-w-[760px] gap-2">
              {STEPS.map(s => {
                const IconComponent = s.icon;
                const isActive = currentStep === s.id;
                const isPassed = currentStep > s.id;

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCurrentStep(s.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30'
                        : isPassed
                        ? 'bg-blue-50/80 text-blue-800 hover:bg-blue-100/60'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                        isActive
                          ? 'bg-white text-blue-600'
                          : isPassed
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {isPassed ? <Check className="w-4 h-4" /> : s.id}
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-tight">{s.title}</div>
                      <div
                        className={`text-[10px] ${
                          isActive ? 'text-blue-100' : 'text-gray-400'
                        }`}
                      >
                        {s.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stepper Content Panels */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
            {/* ------------------------------------------------------------- */}
            {/* STEP 1: Plan & Product Information */}
            {/* ------------------------------------------------------------- */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Step 1: Product Plan & Terms</h2>
                    <p className="text-xs text-gray-500">Select base core life insurance product and payment configuration</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Insurance Product <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.info.PROP_PROD_CODE}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        info: { ...prev.info, PROP_PROD_CODE: e.target.value }
                      }))}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {products.map(p => (
                        <option key={p.PROD_CODE} value={p.PROD_CODE}>
                          {p.PROD_NAME} ({p.PROD_CODE})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Plan Type
                    </label>
                    <select
                      value={formData.info.PROP_PLAN_TYPE}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        info: { ...prev.info, PROP_PLAN_TYPE: e.target.value }
                      }))}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="TERM">Term Life Insurance</option>
                      <option value="ENDOWMENT">Endowment Assurance</option>
                      <option value="WHOLE_LIFE">Whole Life Assurance</option>
                      <option value="UNIT_LINKED">Unit-Linked Life Plan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Payment Frequency
                    </label>
                    <select
                      value={formData.info.PROP_PAY_FREQ}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        info: { ...prev.info, PROP_PAY_FREQ: e.target.value as PaymentFrequency }
                      }))}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ANNUAL">Annual (1.00x)</option>
                      <option value="SEMI_ANNUAL">Semi-Annual (0.52x)</option>
                      <option value="QUARTERLY">Quarterly (0.265x)</option>
                      <option value="MONTHLY">Monthly (0.088x)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Policy Term (Years) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="60"
                      value={formData.info.PROP_TERM}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        info: { ...prev.info, PROP_TERM: parseInt(e.target.value) || 20 }
                      }))}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Premium Payment Term (PPT Years) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={formData.info.PROP_TERM}
                      value={formData.info.PROP_PREM_PAY_TERM}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        info: { ...prev.info, PROP_PREM_PAY_TERM: parseInt(e.target.value) || 20 }
                      }))}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Sum Assured ($) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="10000"
                      step="any"
                      value={formData.info.PROP_SUM_ASSURED}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        info: { ...prev.info, PROP_SUM_ASSURED: parseFloat(e.target.value) || 0 }
                      }))}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* STEP 2: Life Assured Details & Medical Questionnaire */}
            {/* ------------------------------------------------------------- */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Step 2: Life Assured Information & Health</h2>
                    <p className="text-xs text-gray-500">Demographic details, KYC identification, and medical disclosures</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Full Legal Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Johnathan Alexander Doe"
                      value={formData.assured.PAS_NAME}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        assured: { ...prev.assured, PAS_NAME: e.target.value }
                      }))}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Date of Birth <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.assured.PAS_DOB}
                      onChange={e => handleDobChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Age (Nearest Birthday)
                    </label>
                    <input
                      type="number"
                      readOnly
                      value={formData.assured.PAS_AGE}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Gender <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.assured.PAS_GENDER}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        assured: { ...prev.assured, PAS_GENDER: e.target.value as any }
                      }))}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="O">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Occupation
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Accountant, Doctor, Merchant"
                      value={formData.assured.PAS_OCCUPATION || ''}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        assured: { ...prev.assured, PAS_OCCUPATION: e.target.value }
                      }))}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Annual Income ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={formData.assured.PAS_ANN_INCOME || 0}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        assured: { ...prev.assured, PAS_ANN_INCOME: parseFloat(e.target.value) || 0 }
                      }))}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      ID Type & Number
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={formData.assured.PAS_ID_TYPE || 'NATIONAL_ID'}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          assured: { ...prev.assured, PAS_ID_TYPE: e.target.value }
                        }))}
                        className="w-1/2 px-2 py-2.5 border border-gray-200 rounded-lg text-xs"
                      >
                        <option value="NATIONAL_ID">National ID</option>
                        <option value="PASSPORT">Passport</option>
                        <option value="DRIVING_LIC">Driving License</option>
                      </select>
                      <input
                        type="text"
                        placeholder="ID No."
                        value={formData.assured.PAS_ID_NO || ''}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          assured: { ...prev.assured, PAS_ID_NO: e.target.value }
                        }))}
                        className="w-1/2 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Mobile & Email
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Mobile"
                        value={formData.assured.PAS_MOBILE || ''}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          assured: { ...prev.assured, PAS_MOBILE: e.target.value }
                        }))}
                        className="w-1/2 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={formData.assured.PAS_EMAIL || ''}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          assured: { ...prev.assured, PAS_EMAIL: e.target.value }
                        }))}
                        className="w-1/2 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Residential Address
                    </label>
                    <input
                      type="text"
                      placeholder="Street, City, Postal Code"
                      value={formData.assured.PAS_ADDRESS || ''}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        assured: { ...prev.assured, PAS_ADDRESS: e.target.value }
                      }))}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Health & Medical Section */}
                <div className="p-4 bg-gray-50/75 rounded-xl border border-gray-200 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-600" />
                    Medical Questionnaire & BMI Scoring
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Height (cm)</label>
                      <input
                        type="number"
                        min="50"
                        max="250"
                        value={formData.assured.PAS_HEIGHT_CM || ''}
                        onChange={e => handleHeightWeightChange(parseFloat(e.target.value) || undefined, undefined)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Weight (kg)</label>
                      <input
                        type="number"
                        min="20"
                        max="300"
                        value={formData.assured.PAS_WEIGHT_KG || ''}
                        onChange={e => handleHeightWeightChange(undefined, parseFloat(e.target.value) || undefined)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Computed BMI</label>
                      <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold">
                        <span>{formData.assured.PAS_BMI || '-'}</span>
                        {formData.assured.PAS_BMI && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-normal ${
                              formData.assured.PAS_BMI >= 18.5 && formData.assured.PAS_BMI <= 24.9
                                ? 'bg-emerald-100 text-emerald-800'
                                : formData.assured.PAS_BMI <= 29.9
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {formData.assured.PAS_BMI < 18.5
                              ? 'Underweight'
                              : formData.assured.PAS_BMI <= 24.9
                              ? 'Normal'
                              : formData.assured.PAS_BMI <= 29.9
                              ? 'Overweight'
                              : 'Obese'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 pt-4">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={formData.assured.PAS_SMOKER_YN === 'Y'}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            assured: { ...prev.assured, PAS_SMOKER_YN: e.target.checked ? 'Y' : 'N' }
                          }))}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span>Tobacco / Smoker</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={formData.assured.PAS_HIV_YN === 'Y'}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            assured: { ...prev.assured, PAS_HIV_YN: e.target.checked ? 'Y' : 'N' }
                          }))}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span>HIV Tested Positive</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Medical Disclosures & Surgical History
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Detail any history of hypertension, diabetes, cardiac issues, cancer, hospitalizations..."
                      value={formData.assured.PAS_MEDICAL_HISTORY || ''}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        assured: { ...prev.assured, PAS_MEDICAL_HISTORY: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* STEP 3: Rider Covers */}
            {/* ------------------------------------------------------------- */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Step 3: Optional Rider Covers</h2>
                      <p className="text-xs text-gray-500">Attach supplementary riders (Accidental, Critical Illness, Disability, Waiver)</p>
                    </div>
                  </div>

                  {/* Rider quick add dropdown */}
                  <div className="flex items-center gap-2">
                    <select
                      id="select_rider"
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
                      defaultValue=""
                      onChange={e => {
                        if (e.target.value) {
                          handleAddRider(e.target.value);
                          e.target.value = '';
                        }
                      }}
                    >
                      <option value="" disabled>+ Attach Rider Cover...</option>
                      {covers.map(c => (
                        <option key={c.coverCode} value={c.coverCode}>
                          {c.coverDesc} ({c.coverCode})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {formData.riders.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <ShieldCheck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-600">No supplemental riders attached</p>
                    <p className="text-xs text-gray-400 mt-1">Use the dropdown above to add Accidental Death, Critical Illness, etc.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.riders.map((r, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-white rounded-xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-semibold text-gray-900">{r.PRD_RIDER_NAME}</div>
                            <div className="text-xs font-mono text-gray-400">{r.PRD_RIDER_CODE}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div>
                            <span className="block text-[11px] font-semibold text-gray-500 uppercase">Rider SA ($)</span>
                            <input
                              type="number"
                              step="any"
                              value={r.PRD_SUM_ASSURED}
                              onChange={e => handleUpdateRiderSa(idx, parseFloat(e.target.value) || 0)}
                              className="w-32 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-right"
                            />
                          </div>

                          <div>
                            <span className="block text-[11px] font-semibold text-gray-500 uppercase">Rate/1k</span>
                            <span className="text-xs font-mono text-gray-700">${r.PRD_RATE || 0.45}</span>
                          </div>

                          <div>
                            <span className="block text-[11px] font-semibold text-gray-500 uppercase">Rider Premium</span>
                            <span className="text-sm font-bold text-emerald-600">${r.PRD_PREMIUM}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveRider(idx)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            title="Remove Rider"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* STEP 4: Discounts & Loadings */}
            {/* ------------------------------------------------------------- */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                      <Percent className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Step 4: Underwriting Discounts & Loadings</h2>
                      <p className="text-xs text-gray-500">Adjust standard rates for occupational hazards, medical impairments, or high sum assured</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddDiscLoad('LOADING')}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-semibold border border-red-200"
                    >
                      + Add Loading
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddDiscLoad('DISCOUNT')}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-200"
                    >
                      + Add Discount
                    </button>
                  </div>
                </div>

                {formData.discLoads.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <Percent className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-600">Standard rates apply (No loadings or discounts)</p>
                    <p className="text-xs text-gray-400 mt-1">Click '+ Add Loading' or '+ Add Discount' to customize underwriting adjustments.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.discLoads.map((d, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          d.PDL_TYPE === 'LOADING' ? 'bg-red-50/30 border-red-200' : 'bg-emerald-50/30 border-emerald-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold ${
                              d.PDL_TYPE === 'LOADING' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {d.PDL_TYPE}
                          </span>
                          <select
                            value={d.PDL_REASON}
                            onChange={e => {
                              const updated = [...formData.discLoads];
                              updated[idx].PDL_REASON = e.target.value;
                              setFormData(prev => ({ ...prev, discLoads: updated }));
                            }}
                            className="px-2.5 py-1.5 border border-gray-200 bg-white rounded-lg text-xs font-semibold"
                          >
                            <option value="OCCUPATIONAL">Occupational Hazard</option>
                            <option value="MEDICAL">Medical Impairment</option>
                            <option value="SMOKER">Smoker Loading</option>
                            <option value="HIGH_SA">High Sum Assured Discount</option>
                            <option value="PROMOTIONAL">Promotional Campaign</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-4">
                          <select
                            value={d.PDL_CALC_TYPE}
                            onChange={e => {
                              const updated = [...formData.discLoads];
                              updated[idx].PDL_CALC_TYPE = e.target.value as any;
                              setFormData(prev => ({ ...prev, discLoads: updated }));
                            }}
                            className="px-2.5 py-1.5 border border-gray-200 bg-white rounded-lg text-xs"
                          >
                            <option value="PERCENTAGE">Percentage (%)</option>
                            <option value="PER_MILLE">Per Mille ($ per 1,000 SA)</option>
                            <option value="FLAT">Flat Amount ($)</option>
                          </select>

                          <div>
                            <span className="block text-[11px] font-semibold text-gray-500 uppercase">Rate Value</span>
                            <input
                              type="number"
                              step="any"
                              value={d.PDL_RATE_VALUE}
                              onChange={e => {
                                const updated = [...formData.discLoads];
                                updated[idx].PDL_RATE_VALUE = parseFloat(e.target.value) || 0;
                                setFormData(prev => ({ ...prev, discLoads: updated }));
                              }}
                              className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-sm text-right"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveDiscLoad(idx)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* STEP 5: Beneficiaries & Nominees */}
            {/* ------------------------------------------------------------- */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Step 5: Beneficiaries & Nominees</h2>
                      <p className="text-xs text-gray-500">Nominate primary beneficiaries, allocation shares (must sum to 100%), and minor guardians</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddBeneficiary}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200"
                  >
                    + Add Beneficiary
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.beneficiaries.map((b, idx) => (
                    <div key={idx} className="p-4 bg-gray-50/75 rounded-xl border border-gray-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                          Beneficiary #{idx + 1}
                        </span>
                        {formData.beneficiaries.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveBeneficiary(idx)}
                            className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Nominee Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="Full name"
                            value={b.PBEN_NAME}
                            onChange={e => {
                              const updated = [...formData.beneficiaries];
                              updated[idx].PBEN_NAME = e.target.value;
                              setFormData(prev => ({ ...prev, beneficiaries: updated }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Relationship</label>
                          <select
                            value={b.PBEN_RELATION}
                            onChange={e => {
                              const updated = [...formData.beneficiaries];
                              updated[idx].PBEN_RELATION = e.target.value;
                              setFormData(prev => ({ ...prev, beneficiaries: updated }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                          >
                            <option value="SPOUSE">Spouse</option>
                            <option value="CHILD">Child</option>
                            <option value="PARENT">Parent</option>
                            <option value="SIBLING">Sibling</option>
                            <option value="TRUSTEE">Trustee</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Allocation Share (%) *</label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={b.PBEN_SHARE_PCT}
                            onChange={e => {
                              const updated = [...formData.beneficiaries];
                              updated[idx].PBEN_SHARE_PCT = parseFloat(e.target.value) || 0;
                              setFormData(prev => ({ ...prev, beneficiaries: updated }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-right font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Date of Birth</label>
                          <input
                            type="date"
                            value={b.PBEN_DOB ? b.PBEN_DOB.split('T')[0] : ''}
                            onChange={e => {
                              const updated = [...formData.beneficiaries];
                              updated[idx].PBEN_DOB = e.target.value;
                              setFormData(prev => ({ ...prev, beneficiaries: updated }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* STEP 6: Policy Exclusions */}
            {/* ------------------------------------------------------------- */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Step 6: Policy Exclusions & Specific Endorsements</h2>
                      <p className="text-xs text-gray-500">Statutory and underwriting risk exclusions applied to this policy</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddExclusion}
                    className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold border border-purple-200"
                  >
                    + Add Custom Exclusion
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.exclusions.map((ex, idx) => (
                    <div key={idx} className="p-4 bg-gray-50/75 rounded-xl border border-gray-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                            {ex.PEX_CODE}
                          </span>
                          <span className="text-xs text-gray-500">{ex.PEX_REASON}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveExclusion(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={ex.PEX_DESC}
                        onChange={e => {
                          const updated = [...formData.exclusions];
                          updated[idx].PEX_DESC = e.target.value;
                          setFormData(prev => ({ ...prev, exclusions: updated }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* STEP 7: Premium Calculation & PKG_TARIFF Integration */}
            {/* ------------------------------------------------------------- */}
            {currentStep === 7 && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                      <Calculator className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Step 7: Premium Summary & Database PKG_TARIFF Engine</h2>
                      <p className="text-xs text-gray-500">Calculate actuarial mortality rates dynamically via Oracle Package PKG_TARIFF</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isCalculating}
                    onClick={handleCalculateWithTariff}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isCalculating ? 'animate-spin' : ''}`} />
                    <span>Recalculate with Oracle PKG_TARIFF</span>
                  </button>
                </div>

                {/* Tariff Engine Badge */}
                <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 text-white rounded-lg">
                      <Calculator className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-indigo-900">
                        Oracle Database Actuarial Engine: PKG_TARIFF ({formData.premiumSummary.PPS_MTH_CODE || 'MORT_TERM_01'})
                      </div>
                      <div className="text-xs text-indigo-700 mt-0.5">
                        Fetched Mortality Rate: <strong>${formData.premiumSummary.PPS_BASE_RATE || 2.10}</strong> per $1,000 Sum Assured
                      </div>
                    </div>
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                    Active in Oracle 19c
                  </span>
                </div>

                {/* Financial Ledger Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: Component Breakdown */}
                  <div className="p-5 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 border-b border-gray-200 pb-2">
                      Annualized Component Breakdown
                    </h3>

                    <div className="flex justify-between items-center text-sm py-1 border-b border-gray-100">
                      <span className="text-gray-600">Basic Life Cover Premium</span>
                      <span className="font-semibold text-gray-900">${formData.premiumSummary.PPS_BASIC_PREMIUM.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm py-1 border-b border-gray-100">
                      <span className="text-gray-600">Supplemental Riders Premium (+)</span>
                      <span className="font-semibold text-gray-900">${formData.premiumSummary.PPS_TOTAL_RIDER_PREMIUM.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm py-1 border-b border-gray-100">
                      <span className="text-gray-600">Underwriting Loadings (+)</span>
                      <span className="font-semibold text-red-600">+${formData.premiumSummary.PPS_TOTAL_LOADING.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm py-1 border-b border-gray-100">
                      <span className="text-gray-600">Underwriting Discounts (-)</span>
                      <span className="font-semibold text-emerald-600">-${formData.premiumSummary.PPS_TOTAL_DISCOUNT.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm pt-2 font-bold text-gray-900">
                      <span>Net Annualized Premium</span>
                      <span>${formData.premiumSummary.PPS_NET_ANNUAL_PREM.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Right: Modal Frequency & Total Payable */}
                  <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-xl border border-blue-200 flex flex-col justify-between">
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-blue-200/50 pb-2">
                        Installment Payment Schedule
                      </h3>

                      <div className="flex justify-between items-center text-sm">
                        <span className="text-blue-800">Frequency Chosen:</span>
                        <span className="font-bold text-blue-900">{formData.info.PROP_PAY_FREQ}</span>
                      </div>

                      <div className="flex justify-between items-center text-sm">
                        <span className="text-blue-800">Modal Factor Applied:</span>
                        <span className="font-mono text-blue-900">{formData.premiumSummary.PPS_MODAL_FACTOR}x</span>
                      </div>

                      <div className="flex justify-between items-center text-sm">
                        <span className="text-blue-800">Installment Premium:</span>
                        <span className="font-bold text-blue-900">${formData.premiumSummary.PPS_INSTALLMENT_PREM.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-blue-200 mt-4">
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm font-bold text-blue-900">Total Payable per Period:</span>
                        <span className="text-3xl font-extrabold text-blue-700">
                          ${formData.premiumSummary.PPS_TOTAL_PAYABLE.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* STEP 8: Underwriting Assessment & Workflow Integration */}
            {/* ------------------------------------------------------------- */}
            {currentStep === 8 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Step 8: Underwriting & Multi-Tier Workflow</h2>
                    <p className="text-xs text-gray-500">
                      Sequential approval gates (Maker &rarr; Supervisor Review &rarr; Junior Underwriter &rarr; Board Committee)
                    </p>
                  </div>
                </div>

                {/* Workflow Status Banner */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Workflow State</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-lg font-bold text-gray-900 font-mono">
                        {editingPropNo || 'New Draft Proposal'}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                          proposalDetail ? STATUS_BADGES[proposalDetail.info.PROP_STATUS].bg : 'bg-gray-100'
                        } ${proposalDetail ? STATUS_BADGES[proposalDetail.info.PROP_STATUS].text : 'text-gray-700'}`}
                      >
                        {proposalDetail ? proposalDetail.info.PROP_STATUS : 'DRAFT'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned Approval Gate</div>
                    <div className="text-sm font-bold text-purple-700 mt-1">
                      Level {proposalDetail?.info.PROP_CURRENT_LEVEL || 1} — {proposalDetail?.info.PROP_ASSIGNED_ROLE || 'MAKER'}
                    </div>
                  </div>
                </div>

                {/* Underwriting Decisions Panel */}
                <div className="p-5 bg-white rounded-xl border border-purple-200 shadow-xs space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                    Underwriter Assessment & Decision Console
                  </h3>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Underwriting Remarks / Verification Notes:
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Enter verification remarks, medical scoring clearance, or rework instructions..."
                      value={uwComments}
                      onChange={e => setUwComments(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {/* Action 1: Submit */}
                    <button
                      type="button"
                      onClick={() => handleWorkflowAction('SUBMIT')}
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      <span>Submit for Verification</span>
                    </button>

                    {/* Action 2: Approve */}
                    <button
                      type="button"
                      onClick={() => handleWorkflowAction('APPROVE')}
                      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Approve & Authorize</span>
                    </button>

                    {/* Action 3: Send Back / Rework */}
                    <button
                      type="button"
                      onClick={() => handleWorkflowAction('REWORK')}
                      className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Send Back for Rework</span>
                    </button>

                    {/* Action 4: Reject */}
                    <button
                      type="button"
                      onClick={() => handleWorkflowAction('REJECT')}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-xs transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Decline / Reject Risk</span>
                    </button>
                  </div>
                </div>

                {/* Audit Trail Log */}
                {proposalDetail?.workflowLogs && proposalDetail.workflowLogs.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                      Workflow Transaction History & Audit Trail
                    </h3>
                    <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                      <table className="w-full text-left text-xs text-gray-600">
                        <thead className="bg-gray-100 text-gray-700 uppercase font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Timestamp</th>
                            <th className="py-2.5 px-3">Actor</th>
                            <th className="py-2.5 px-3">Stage / Level</th>
                            <th className="py-2.5 px-3">Action</th>
                            <th className="py-2.5 px-3">Comments</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {proposalDetail.workflowLogs.map((log, idx) => (
                            <tr key={idx}>
                              <td className="py-2.5 px-3 whitespace-nowrap text-gray-500">{log.ACTION_DATE}</td>
                              <td className="py-2.5 px-3 font-semibold text-gray-900">{log.ACTION_BY}</td>
                              <td className="py-2.5 px-3 font-mono">Level {log.WFL_LEVEL_NO}</td>
                              <td className="py-2.5 px-3">
                                <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                  {log.ACTION_TYPE}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-gray-600">{log.COMMENTS || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stepper Wizard Footer Controls */}
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <button
              type="button"
              disabled={currentStep === 1}
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg font-medium text-sm transition-colors ${
                currentStep === 1 ? 'opacity-30 cursor-not-allowed border-gray-200 text-gray-400' : 'hover:bg-gray-50 border-gray-300 text-gray-700'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous Step</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveProposal}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
              </button>

              {currentStep < 8 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(prev => Math.min(8, prev + 1))}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm shadow-sm transition-colors"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveProposal}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm shadow-sm transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Finalize Proposal</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProposalPage;
