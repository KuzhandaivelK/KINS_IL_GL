import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import {
  Receipt,
  DollarSign,
  AlertOctagon,
  Clock,
  RotateCcw,
  ShieldAlert,
  FileCheck2,
  Award,
  Wallet,
  BookOpen,
  Search,
  RefreshCw,
  Plus,
  Eye,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
  Printer,
  Calendar,
  Building2,
  User,
  Sliders,
  TrendingDown,
  Percent
} from 'lucide-react';
import { policyServicingService } from '../services/policyServicingService';
import { proposalService } from '../services/proposalService';
import { policyService } from '../services/policyService';
import {
  PremiumReceiptRecord,
  GLJournalEntryRecord,
  PolicySurrenderRecord,
  PolicyMaturityRecord,
  PolicyLoanRecord,
  AutoLapseScanResult,
  ReinstatementCalculationResult,
  SurrenderValuationResult,
  LoanEligibilityResult,
  PayMode
} from '../types/policyServicing';
import { ProposalInfoItem } from '../types/proposal';
import { PolicyInfoRecord } from '../types/policy';

export const PolicyServicingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'collections' | 'lapse' | 'surrender' | 'maturity' | 'loans' | 'journal'>('collections');

  // Loading & Alerts
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data registers
  const [receipts, setReceipts] = useState<PremiumReceiptRecord[]>([]);
  const [proposals, setProposals] = useState<ProposalInfoItem[]>([]);
  const [policies, setPolicies] = useState<PolicyInfoRecord[]>([]);
  const [surrenders, setSurrenders] = useState<PolicySurrenderRecord[]>([]);
  const [maturities, setMaturities] = useState<PolicyMaturityRecord[]>([]);
  const [loans, setLoans] = useState<PolicyLoanRecord[]>([]);
  const [journalEntries, setJournalEntries] = useState<GLJournalEntryRecord[]>([]);

  // Search & Filters
  const [receiptSearch, setReceiptSearch] = useState<string>('');
  const [selectedReceipt, setSelectedReceipt] = useState<PremiumReceiptRecord | null>(null);

  // Collections Sub-View
  const [collectionsSubTab, setCollectionsSubTab] = useState<'fpr' | 'rpr' | 'register'>('fpr');
  const [fprModalProp, setFprModalProp] = useState<ProposalInfoItem | null>(null);
  const [rprModalPol, setRprModalPol] = useState<PolicyInfoRecord | null>(null);
  const [payMode, setPayMode] = useState<PayMode>('CASH');
  const [txnRef, setTxnRef] = useState<string>('');
  const [paymentRemarks, setPaymentRemarks] = useState<string>('');

  // Lapse & Reinstatement
  const [lapseScanResult, setLapseScanResult] = useState<AutoLapseScanResult | null>(null);
  const [reinstatementCalc, setReinstatementCalc] = useState<ReinstatementCalculationResult | null>(null);

  // Surrender
  const [surrenderPolNo, setSurrenderPolNo] = useState<string>('');
  const [surrenderValuation, setSurrenderValuation] = useState<SurrenderValuationResult | null>(null);

  // Maturity
  const [dueMaturities, setDueMaturities] = useState<any[]>([]);

  // Loans
  const [loanPolNo, setLoanPolNo] = useState<string>('');
  const [loanEligibility, setLoanEligibility] = useState<LoanEligibilityResult | null>(null);
  const [loanRequestAmount, setLoanRequestAmount] = useState<number>(1000);
  const [repayModalLoan, setRepayModalLoan] = useState<PolicyLoanRecord | null>(null);
  const [repayPrincipal, setRepayPrincipal] = useState<number>(0);
  const [repayInterest, setRepayInterest] = useState<number>(0);

  // Journal Search
  const [journalSearch, setJournalSearch] = useState<string>('');
  const [journalTxnFilter, setJournalTxnFilter] = useState<string>('ALL');

  // Load all initial data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Receipts
      const recs = await policyServicingService.getReceipts();
      setReceipts(recs);

      // 2. Proposals for FPR
      const propData = await proposalService.getProposals();
      setProposals(propData.proposals || []);

      // 3. Policies
      const polData = await policyService.getPolicies();
      setPolicies(polData.policies || []);

      // 4. Surrenders
      const surrs = await policyServicingService.getSurrenders();
      setSurrenders(surrs);

      // 5. Maturities
      const mats = await policyServicingService.getMaturities();
      setMaturities(mats);
      const dueMats = await policyServicingService.checkMaturityDue();
      setDueMaturities(dueMats);

      // 6. Loans
      const lns = await policyServicingService.getLoans();
      setLoans(lns);

      // 7. GL Journal
      const jvs = await policyServicingService.getJournalEntries();
      setJournalEntries(jvs);
    } catch (err: any) {
      console.error('Error loading servicing data:', err);
      setError(err.message || 'Failed to load policy servicing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Proposals awaiting FPR
  const pendingFprProposals = useMemo(() => {
    return proposals.filter((p) => p.FPR_STATUS !== 'COLLECTED' && ['SUBMITTED', 'UNDERWRITING', 'APPROVED'].includes(p.PROP_STATUS));
  }, [proposals]);

  // Filtered Lapsed Policies
  const lapsedPolicies = useMemo(() => {
    return policies.filter((p) => p.POL_STATUS === 'LAPSED');
  }, [policies]);

  // Filtered In-force Policies
  const inForcePolicies = useMemo(() => {
    return policies.filter((p) => ['IN_FORCE', 'APPROVED'].includes(p.POL_STATUS));
  }, [policies]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalCollected = receipts.reduce((sum, r) => sum + Number(r.TOTAL_PAID || 0), 0);
    const lapsedCount = lapsedPolicies.length;
    const activeLoans = loans.filter((l) => l.STATUS === 'ACTIVE');
    const totalLoanOutstanding = activeLoans.reduce((sum, l) => sum + Number(l.OUTSTANDING_PRINCIPAL || 0), 0);
    const totalGLCount = journalEntries.length;
    return {
      totalCollected,
      lapsedCount,
      totalLoanOutstanding,
      totalGLCount
    };
  }, [receipts, lapsedPolicies, loans, journalEntries]);

  // Handle FPR Collection
  const handleCollectFPR = async () => {
    if (!fprModalProp) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await policyServicingService.recordFirstPremium({
        propNo: fprModalProp.PROP_NO,
        payMode,
        transactionRef: txnRef,
        remarks: paymentRemarks
      });
      setSelectedReceipt(res.data.receipt);
      setSuccessMsg(res.message);
      setFprModalProp(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'FPR Collection failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle RPR Collection
  const handleCollectRPR = async () => {
    if (!rprModalPol) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await policyServicingService.recordRenewalPremium({
        polNo: rprModalPol.POL_NO,
        payMode,
        transactionRef: txnRef,
        remarks: paymentRemarks
      });
      setSelectedReceipt(res.data.receipt);
      setSuccessMsg(res.message);
      setRprModalPol(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Renewal collection failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Run Auto-Lapse Scan
  const handleRunAutoLapseScan = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const result = await policyServicingService.runAutoLapseScan();
      setLapseScanResult(result);
      setSuccessMsg(`Auto-Lapse Scan Complete: ${result.lapsedCount} overdue policies updated to LAPSED.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Auto-lapse scan failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Calculate Reinstatement
  const handleCalculateReinstatement = async (polNo: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const calc = await policyServicingService.calculateReinstatement(polNo);
      setReinstatementCalc(calc);
    } catch (err: any) {
      setError(err.message || 'Reinstatement calculation failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Process Reinstatement
  const handleProcessReinstatement = async (polNo: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await policyServicingService.reinstatePolicy(polNo, payMode, txnRef);
      setSelectedReceipt(res.receipt);
      setSuccessMsg(`Policy ${polNo} successfully reinstated to IN_FORCE!`);
      setReinstatementCalc(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Reinstatement failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Check Surrender Valuation
  const handleCheckSurrender = async () => {
    if (!surrenderPolNo.trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      const val = await policyServicingService.checkSurrenderEligibility(surrenderPolNo.trim());
      setSurrenderValuation(val);
    } catch (err: any) {
      setError(err.message || 'Surrender valuation failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Surrender Request
  const handleSubmitSurrender = async () => {
    if (!surrenderValuation) return;
    setActionLoading(true);
    setError(null);
    try {
      const surr = await policyServicingService.createSurrenderRequest(surrenderValuation.polNo);
      setSuccessMsg(`Surrender Request ${surr.SURRENDER_NO} generated successfully!`);
      setSurrenderValuation(null);
      setSurrenderPolNo('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Surrender request submission failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Approve Surrender
  const handleApproveSurrender = async (surrenderNo: string) => {
    const remarks = window.prompt(`Enter Underwriting Approval remarks for Surrender ${surrenderNo}:`, 'Cash value verified and approved for settlement.');
    if (remarks === null) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await policyServicingService.approveSurrender(surrenderNo, remarks);
      setSuccessMsg(`Surrender ${surrenderNo} settled! Journal Voucher: ${res.voucherNo}`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Surrender approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Process Maturity Settlement
  const handleSettleMaturity = async (polNo: string) => {
    if (!window.confirm(`Settle and pay final Maturity Benefit for Policy ${polNo}?`)) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await policyServicingService.processMaturitySettlement(polNo, 'Full Maturity settlement approved.');
      setSuccessMsg(`Maturity settled! Record: ${res.maturity.MATURITY_NO}, Voucher: ${res.voucherNo}`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Maturity settlement failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Check Loan Eligibility
  const handleCheckLoan = async () => {
    if (!loanPolNo.trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      const elig = await policyServicingService.checkLoanEligibility(loanPolNo.trim());
      setLoanEligibility(elig);
      setLoanRequestAmount(Math.min(elig.netAvailableLoanAmount, 2000));
    } catch (err: any) {
      setError(err.message || 'Loan eligibility check failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Disburse Loan
  const handleDisburseLoan = async () => {
    if (!loanEligibility) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await policyServicingService.disburseLoan(loanEligibility.polNo, loanRequestAmount, 'Policy Loan Approved');
      setSuccessMsg(`Loan ${res.loan.LOAN_NO} disbursed for OMR ${loanRequestAmount}! Voucher: ${res.voucherNo}`);
      setLoanEligibility(null);
      setLoanPolNo('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Loan disbursement failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Repay Loan
  const handleRepayLoan = async () => {
    if (!repayModalLoan) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await policyServicingService.repayLoan(repayModalLoan.LOAN_NO, {
        principalPaid: repayPrincipal,
        interestPaid: repayInterest,
        payMode,
        transactionRef: txnRef
      });
      setSuccessMsg(`Repayment ${res.repayment.REPAYMENT_NO} processed! Voucher: ${res.voucherNo}`);
      setRepayModalLoan(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Loan repayment failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs font-medium text-slate-500 mb-1.5">
            <button onClick={() => navigate('/dashboard')} className="hover:text-navy transition-colors">Dashboard</button>
            <span className="text-slate-300">/</span>
            <span className="text-blue-corporate font-semibold">Individual Life Policy Servicing</span>
          </nav>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy tracking-tight">
              Policy Servicing & Financial Transactions Suite
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              LOB: Individual Life (IL)
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-text-secondary">
            First & Renewal Premium Collections, Automated Grace Period & Lapse Engine, Cash Surrenders, Maturities, Policy Loans, and Double-Entry General Ledger.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Error & Success Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Financial Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Premium Collected</span>
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-navy truncate">
            OMR {metrics.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-teal-600 font-semibold">{receipts.length} Total Receipts Issued</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Lapsed Policies</span>
            <span className="p-1.5 rounded-lg bg-red-50 text-red-600">
              <AlertOctagon className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-red-600">{metrics.lapsedCount}</p>
          <span className="text-[11px] text-slate-400">Grace period expired</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Policy Loans</span>
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-purple-700 truncate">
            OMR {metrics.totalLoanOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-400">Principal borrowing asset</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">General Ledger Entries</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <BookOpen className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-navy">{metrics.totalGLCount}</p>
          <span className="text-[11px] text-blue-600 font-semibold">Balanced Double-Entry</span>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-1.5 shadow-xs flex flex-wrap gap-2">
        {[
          { id: 'collections', label: '1. Premium Collections (FPR/RPR)', icon: Receipt, count: pendingFprProposals.length },
          { id: 'lapse', label: '2. Auto-Lapse & Reinstatement', icon: AlertOctagon, count: lapsedPolicies.length },
          { id: 'surrender', label: '3. Policy Surrenders', icon: TrendingDown, count: surrenders.length },
          { id: 'maturity', label: '4. Policy Maturities', icon: Award, count: dueMaturities.length },
          { id: 'loans', label: '5. Policy Loans & Repayment', icon: Wallet, count: loans.length },
          { id: 'journal', label: '6. General Ledger (GL)', icon: BookOpen, count: journalEntries.length }
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? 'bg-navy text-white shadow-xs'
                  : 'text-slate-600 hover:text-navy hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
              {t.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PREMIUM COLLECTIONS & RECEIPTS */}
      {/* ========================================================================= */}
      {activeTab === 'collections' && (
        <div className="space-y-4">
          {/* Sub-tab Switcher */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setCollectionsSubTab('fpr')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                collectionsSubTab === 'fpr' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              First Premium Collections (FPR) Gate ({pendingFprProposals.length})
            </button>
            <button
              onClick={() => setCollectionsSubTab('rpr')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                collectionsSubTab === 'rpr' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Renewal Premium Collections (RPR)
            </button>
            <button
              onClick={() => setCollectionsSubTab('register')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                collectionsSubTab === 'register' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Issued Receipts Register ({receipts.length})
            </button>
          </div>

          {/* SubTab A: First Premium Collections */}
          {collectionsSubTab === 'fpr' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-navy uppercase tracking-wider">
                    Proposals Awaiting First Premium Receipt (FPR)
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Underwriting rules mandate that First Premium Receipt (FPR) must be collected and reconciled before proposal approval and policy conversion can take place.
                  </p>
                </div>
              </div>

              {pendingFprProposals.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                  <p className="font-bold">All active proposals have paid First Premium Receipts (FPR)!</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Proposal No</th>
                        <th className="py-2.5 px-3">Assured Life</th>
                        <th className="py-2.5 px-3">Product Plan</th>
                        <th className="py-2.5 px-3 text-right">Sum Assured (OMR)</th>
                        <th className="py-2.5 px-3 text-right">Installment Payable</th>
                        <th className="py-2.5 px-3 text-center">FPR Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingFprProposals.map((p) => (
                        <tr key={p.PROP_ID} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-bold text-navy">{p.PROP_NO}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{p.PAS_NAME || 'Assured'}</td>
                          <td className="py-2.5 px-3 text-slate-600">{p.PROP_PROD_CODE} ({p.PROP_PLAN_TYPE})</td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-800">
                            {Number(p.PROP_SUM_ASSURED).toLocaleString('en-US')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-teal-700">
                            OMR {Number(p.TOTAL_PAYABLE || 500).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                              AWAITING FPR
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setFprModalProp(p);
                                setPayMode('CASH');
                                setTxnRef('');
                                setPaymentRemarks('First Premium collection');
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 text-white font-bold text-[11px] hover:bg-teal-700 transition-colors shadow-xs"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span>Collect FPR</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SubTab B: Renewal Premium Collections */}
          {collectionsSubTab === 'rpr' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-navy uppercase tracking-wider">
                  Active In-Force Policies for Renewal Collection
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Collect subsequent modal premiums, advance next due dates, and update total premiums paid ledger.
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Policy No</th>
                      <th className="py-2.5 px-3">Life Assured</th>
                      <th className="py-2.5 px-3">Frequency</th>
                      <th className="py-2.5 px-3">Next Due Date</th>
                      <th className="py-2.5 px-3 text-right">Installment (OMR)</th>
                      <th className="py-2.5 px-3 text-right">Total Paid (OMR)</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inForcePolicies.map((p) => (
                      <tr key={p.POL_ID} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-bold text-navy">{p.POL_NO}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{p.PAS_NAME || 'Assured'}</td>
                        <td className="py-2.5 px-3 text-slate-600">{p.POL_PAY_FREQ}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-teal-700">{p.POL_INCEPTION_DATE}</td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-800">
                          {Number(p.TOTAL_PAYABLE || 300).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-600">
                          {Number(p.POL_SUM_ASSURED ? p.POL_SUM_ASSURED * 0.05 : 500).toLocaleString('en-US')}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setRprModalPol(p);
                              setPayMode('CASH');
                              setTxnRef('');
                              setPaymentRemarks('Renewal premium receipt');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-700 transition-colors shadow-xs"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Collect Renewal</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SubTab C: Receipts Register */}
          {collectionsSubTab === 'register' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-navy uppercase tracking-wider">
                  Official Premium Receipts Register
                </h3>
                <div className="relative w-72">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search receipt, policy, proposal..."
                    value={receiptSearch}
                    onChange={(e) => setReceiptSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Receipt No</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Reference</th>
                      <th className="py-2.5 px-3">Receipt Date</th>
                      <th className="py-2.5 px-3">Pay Mode</th>
                      <th className="py-2.5 px-3 text-right">Total Paid (OMR)</th>
                      <th className="py-2.5 px-3 text-center">GL Voucher</th>
                      <th className="py-2.5 px-3 text-right">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receipts
                      .filter((r) => !receiptSearch || r.RECEIPT_NO.toLowerCase().includes(receiptSearch.toLowerCase()) || (r.POL_NO && r.POL_NO.toLowerCase().includes(receiptSearch.toLowerCase())))
                      .map((r) => (
                        <tr key={r.RECEIPT_ID} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-mono font-bold text-navy">{r.RECEIPT_NO}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.RECEIPT_TYPE === 'FPR'
                                ? 'bg-teal-100 text-teal-800'
                                : r.RECEIPT_TYPE === 'REINSTATE'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {r.RECEIPT_TYPE}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700">{r.POL_NO || r.PROP_NO}</td>
                          <td className="py-2.5 px-3 text-slate-500">{r.RECEIPT_DATE}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-600">{r.PAY_MODE}</td>
                          <td className="py-2.5 px-3 text-right font-black text-teal-700">
                            {Number(r.TOTAL_PAID).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500">
                            {r.GL_VOUCHER_NO}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt(r)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-navy hover:bg-slate-100"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: AUTO-LAPSE ENGINE & REINSTATEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'lapse' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-navy">Automated Grace Period & Policy Lapse Engine</h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Policies with unpaid installments exceeding the statutory grace period (30 days for Annual/Semi/Quarterly, 15 days for Monthly) are automatically transitioned to LAPSED.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunAutoLapseScan}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors shadow-xs"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>{actionLoading ? 'Scanning...' : 'Execute Daily Auto-Lapse Scan'}</span>
              </button>
            </div>

            {lapseScanResult && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                <p className="font-bold">Scan Completed: {lapseScanResult.lapsedCount} policy(ies) transitioned to LAPSED status.</p>
                {lapseScanResult.lapsedPolicies.map((lp) => (
                  <div key={lp.polNo} className="text-[11px] font-mono">
                    &bull; Policy {lp.polNo} ({lp.customerName}): Due {lp.dueDate}, Grace Expired {lp.graceExpiryDate}
                  </div>
                ))}
              </div>
            )}

            {/* Lapsed Policies Table */}
            <div>
              <h3 className="text-xs font-black text-navy uppercase tracking-wider mb-2">
                Currently Lapsed Policies ({lapsedPolicies.length})
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Policy No</th>
                      <th className="py-2.5 px-3">Life Assured</th>
                      <th className="py-2.5 px-3">Product Plan</th>
                      <th className="py-2.5 px-3 text-right">Sum Assured</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Reinstatement / Revival</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lapsedPolicies.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-500" />
                          No policies are currently in lapsed status.
                        </td>
                      </tr>
                    ) : (
                      lapsedPolicies.map((p) => (
                        <tr key={p.POL_ID} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-bold text-navy">{p.POL_NO}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{p.PAS_NAME || 'Assured'}</td>
                          <td className="py-2.5 px-3 text-slate-600">{p.POL_PROD_CODE}</td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-800">
                            {Number(p.POL_SUM_ASSURED).toLocaleString('en-US')}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-800 border border-red-200">
                              LAPSED
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleCalculateReinstatement(p.POL_NO)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 text-white font-bold text-[11px] hover:bg-purple-700 transition-colors shadow-xs"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Calculate Revival</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reinstatement Calculator Modal Card */}
            {reinstatementCalc && (
              <div className="p-5 rounded-2xl bg-purple-50/50 border-2 border-purple-300 space-y-4">
                <div className="flex items-center justify-between border-b border-purple-200 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-navy uppercase">
                      Reinstatement & Revival Valuation for {reinstatementCalc.polNo}
                    </h4>
                    <span className="text-xs text-slate-600 font-semibold">{reinstatementCalc.customerName}</span>
                  </div>
                  <button onClick={() => setReinstatementCalc(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-purple-200">
                    <span className="text-slate-500 font-semibold block">Missed Installments:</span>
                    <span className="text-lg font-black text-navy">{reinstatementCalc.overdueInstallmentsCount}</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-purple-200">
                    <span className="text-slate-500 font-semibold block">Overdue Premium:</span>
                    <span className="text-lg font-black text-navy">OMR {reinstatementCalc.overduePremiumTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-purple-200">
                    <span className="text-slate-500 font-semibold block">Penalty Interest (8% p.a.):</span>
                    <span className="text-lg font-black text-amber-700">OMR {reinstatementCalc.penaltyInterest.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-xl border border-purple-300">
                    <span className="text-purple-800 font-bold block">Total Revival Amount:</span>
                    <span className="text-lg font-black text-purple-900">OMR {reinstatementCalc.totalPayableToReinstate.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-700">Payment Mode:</span>
                    <select
                      value={payMode}
                      onChange={(e) => setPayMode(e.target.value as PayMode)}
                      className="border border-slate-300 rounded-lg px-2 py-1 font-semibold"
                    >
                      <option value="CASH">Cash</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="CARD">Card</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleProcessReinstatement(reinstatementCalc.polNo)}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Payment & Reinstate Policy</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: POLICY SURRENDER & CASH VALUE */}
      {/* ========================================================================= */}
      {activeTab === 'surrender' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-navy">Policy Cash Surrender Valuation & Settlement</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Calculate Guaranteed & Special Surrender Values based on contractual premium paying years, deduct outstanding loans and accrued interest, and generate General Ledger accounting vouchers.
              </p>
            </div>

            {/* Policy Selector & Valuation Form */}
            <div className="flex flex-col sm:flex-row items-end gap-3 p-4 bg-slate-50 rounded-xl">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Policy for Surrender Valuation</label>
                <select
                  value={surrenderPolNo}
                  onChange={(e) => setSurrenderPolNo(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white font-bold text-navy"
                >
                  <option value="">-- Choose Policy --</option>
                  {policies.map((p) => (
                    <option key={p.POL_NO} value={p.POL_NO}>
                      {p.POL_NO} - {p.PAS_NAME || 'Assured'} ({p.POL_STATUS}, SA: OMR {Number(p.POL_SUM_ASSURED).toLocaleString('en-US')})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleCheckSurrender}
                disabled={actionLoading || !surrenderPolNo}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors shadow-xs"
              >
                <Sliders className="w-4 h-4" />
                <span>Calculate Surrender Value</span>
              </button>
            </div>

            {/* Surrender Valuation Result Card */}
            {surrenderValuation && (
              <div className={`p-5 rounded-2xl border-2 space-y-4 ${
                surrenderValuation.isEligible ? 'bg-teal-50/40 border-teal-300' : 'bg-red-50/40 border-red-300'
              }`}>
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="text-sm font-black text-navy uppercase">
                      Actuarial Surrender Value Report: {surrenderValuation.polNo}
                    </h3>
                    <span className="text-xs text-slate-600 font-semibold">{surrenderValuation.customerName}</span>
                  </div>
                  {surrenderValuation.isEligible ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ELIGIBLE FOR SURRENDER
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-800 border border-red-200">
                      INELIGIBLE
                    </span>
                  )}
                </div>

                {!surrenderValuation.isEligible ? (
                  <p className="text-xs text-red-700 font-semibold">{surrenderValuation.ineligibilityReason}</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-slate-400 font-semibold block">Paid Years:</span>
                        <span className="text-lg font-black text-navy">{surrenderValuation.paidYears} Years</span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-slate-400 font-semibold block">Total Premiums Paid:</span>
                        <span className="text-lg font-black text-navy">OMR {surrenderValuation.totalPremiumsPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-slate-400 font-semibold block">Guaranteed SV (GSV):</span>
                        <span className="text-lg font-black text-slate-700">OMR {surrenderValuation.guaranteedSV.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-slate-400 font-semibold block">Special SV (SSV):</span>
                        <span className="text-lg font-black text-slate-700">OMR {surrenderValuation.specialSV.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs space-y-1.5">
                      <div className="flex justify-between font-bold text-slate-700">
                        <span>Gross Surrender Cash Value (max of GSV, SSV):</span>
                        <span>OMR {surrenderValuation.grossSV.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {surrenderValuation.outstandingLoanPrincipal > 0 && (
                        <div className="flex justify-between font-semibold text-red-600">
                          <span>Less: Outstanding Policy Loan Principal:</span>
                          <span>- OMR {surrenderValuation.outstandingLoanPrincipal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {surrenderValuation.accruedLoanInterest > 0 && (
                        <div className="flex justify-between font-semibold text-red-600">
                          <span>Less: Accrued Policy Loan Interest:</span>
                          <span>- OMR {surrenderValuation.accruedLoanInterest.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-black text-navy pt-2 border-t border-slate-200">
                        <span>Net Payable Surrender Value:</span>
                        <span className="text-teal-700 font-black">
                          OMR {surrenderValuation.netPayableSV.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={handleSubmitSurrender}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors shadow-xs"
                      >
                        <FileCheck2 className="w-4 h-4" />
                        <span>Submit Surrender Request for Authorization</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Surrenders List */}
            <div>
              <h3 className="text-xs font-black text-navy uppercase tracking-wider mb-2">
                Surrender Requests & Settlements Register ({surrenders.length})
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Surrender No</th>
                      <th className="py-2.5 px-3">Policy No</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3 text-right">Gross SV (OMR)</th>
                      <th className="py-2.5 px-3 text-right">Net Payable (OMR)</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {surrenders.map((s) => (
                      <tr key={s.SURRENDER_ID} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono font-bold text-navy">{s.SURRENDER_NO}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-700">{s.POL_NO}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{s.CUSTOMER_NAME || 'Assured'}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                          {Number(s.GROSS_SURRENDER_VALUE).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-teal-700">
                          {Number(s.NET_PAYABLE_AMOUNT).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.STATUS === 'SETTLED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {s.STATUS}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {s.STATUS === 'REQUESTED' && (
                            <button
                              type="button"
                              onClick={() => handleApproveSurrender(s.SURRENDER_NO)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Authorize & Settle</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: POLICY MATURITY PROCESSING */}
      {/* ========================================================================= */}
      {activeTab === 'maturity' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-navy">Policy Maturity Processing & Benefit Settlement</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Manage contracts that have completed their term. Calculates basic Sum Assured, reversionary vested bonus, and terminal bonus, and generates claims discharge vouchers.
              </p>
            </div>

            {/* Policies Due for Maturity */}
            <div>
              <h3 className="text-xs font-black text-navy uppercase tracking-wider mb-2">
                Policies Due for Maturity ({dueMaturities.length})
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Policy No</th>
                      <th className="py-2.5 px-3">Life Assured</th>
                      <th className="py-2.5 px-3">Maturity Date</th>
                      <th className="py-2.5 px-3 text-right">Basic Sum Assured</th>
                      <th className="py-2.5 px-3 text-right">Est. Maturity Payout</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dueMaturities.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No policies due for maturity within the next 60 days.
                        </td>
                      </tr>
                    ) : (
                      dueMaturities.map((m) => {
                        const estBonus = Number(m.POL_SUM_ASSURED) * 0.35;
                        const estTotal = Number(m.POL_SUM_ASSURED) + estBonus;
                        return (
                          <tr key={m.POL_NO} className="hover:bg-slate-50/60">
                            <td className="py-2.5 px-3 font-bold text-navy">{m.POL_NO}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">{m.PAS_NAME || 'Assured'}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-teal-700">{m.MATURITY_DATE}</td>
                            <td className="py-2.5 px-3 text-right font-black text-slate-800">
                              OMR {Number(m.POL_SUM_ASSURED).toLocaleString('en-US')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                              OMR {estTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleSettleMaturity(m.POL_NO)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 shadow-xs"
                              >
                                <Award className="w-3.5 h-3.5" />
                                <span>Settle Maturity</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Settled Maturities Register */}
            <div>
              <h3 className="text-xs font-black text-navy uppercase tracking-wider mb-2">
                Settled Maturities Register ({maturities.length})
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Maturity No</th>
                      <th className="py-2.5 px-3">Policy No</th>
                      <th className="py-2.5 px-3 text-right">Basic SA</th>
                      <th className="py-2.5 px-3 text-right">Vested Bonus</th>
                      <th className="py-2.5 px-3 text-right">Net Paid (OMR)</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-center">Voucher</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {maturities.map((m) => (
                      <tr key={m.MATURITY_ID} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono font-bold text-navy">{m.MATURITY_NO}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-700">{m.POL_NO}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                          {Number(m.BASIC_SUM_ASSURED).toLocaleString('en-US')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-purple-700">
                          {Number(m.VESTED_BONUS_AMOUNT).toLocaleString('en-US')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                          {Number(m.NET_MATURITY_PAYABLE).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {m.STATUS}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500">
                          {m.GL_VOUCHER_NO}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: POLICY LOANS & REPAYMENTS */}
      {/* ========================================================================= */}
      {activeTab === 'loans' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-navy">Policy Loans & Principal Repayment Ledger</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Grant commercial loans up to 80% of acquired Surrender Value. Tracks interest accrual, periodic repayments, and automatic balance liquidation upon claims.
              </p>
            </div>

            {/* Check Loan Eligibility Form */}
            <div className="flex flex-col sm:flex-row items-end gap-3 p-4 bg-purple-50/50 rounded-xl border border-purple-200">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Policy for Loan Application</label>
                <select
                  value={loanPolNo}
                  onChange={(e) => setLoanPolNo(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white font-bold text-navy"
                >
                  <option value="">-- Choose Policy --</option>
                  {policies.map((p) => (
                    <option key={p.POL_NO} value={p.POL_NO}>
                      {p.POL_NO} - {p.PAS_NAME || 'Assured'} ({p.POL_STATUS})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleCheckLoan}
                disabled={actionLoading || !loanPolNo}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-colors shadow-xs"
              >
                <Wallet className="w-4 h-4" />
                <span>Check Loan Capacity</span>
              </button>
            </div>

            {/* Loan Eligibility Card */}
            {loanEligibility && (
              <div className={`p-5 rounded-2xl border-2 space-y-4 ${
                loanEligibility.isEligible ? 'bg-purple-50/40 border-purple-300' : 'bg-red-50/40 border-red-300'
              }`}>
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="text-sm font-black text-navy uppercase">
                      Loan Capacity Assessment: {loanEligibility.polNo}
                    </h3>
                    <span className="text-xs text-slate-600 font-semibold">{loanEligibility.customerName}</span>
                  </div>
                  {loanEligibility.isEligible ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ELIGIBLE (MAX 80% SV)
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-800 border border-red-200">
                      INELIGIBLE
                    </span>
                  )}
                </div>

                {!loanEligibility.isEligible ? (
                  <p className="text-xs text-red-700 font-semibold">{loanEligibility.ineligibilityReason}</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-slate-400 font-semibold block">Surrender Cash Value:</span>
                        <span className="text-lg font-black text-navy">OMR {loanEligibility.currentSurrenderValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-slate-400 font-semibold block">Max Limit (80%):</span>
                        <span className="text-lg font-black text-purple-700">OMR {loanEligibility.maxEligibleLoanAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-slate-400 font-semibold block">Existing Loan:</span>
                        <span className="text-lg font-black text-slate-700">OMR {loanEligibility.existingLoanPrincipal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                        <span className="text-emerald-800 font-bold block">Available to Borrow:</span>
                        <span className="text-lg font-black text-emerald-900">OMR {loanEligibility.netAvailableLoanAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-purple-200">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-700">Loan Amount to Disburse (OMR):</span>
                        <input
                          type="number"
                          step="100"
                          min="500"
                          max={loanEligibility.netAvailableLoanAmount}
                          value={loanRequestAmount}
                          onChange={(e) => setLoanRequestAmount(Number(e.target.value))}
                          className="w-36 text-xs font-black text-navy border border-slate-300 rounded-lg px-3 py-1.5"
                        />
                        <span className="text-[11px] text-slate-400">Fixed Rate: 8.00% p.a.</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleDisburseLoan}
                        disabled={actionLoading || loanRequestAmount <= 0 || loanRequestAmount > loanEligibility.netAvailableLoanAmount}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-colors shadow-xs"
                      >
                        <DollarSign className="w-4 h-4" />
                        <span>Disburse Policy Loan</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Active Policy Loans Register */}
            <div>
              <h3 className="text-xs font-black text-navy uppercase tracking-wider mb-2">
                Policy Loans Ledger ({loans.length})
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Loan No</th>
                      <th className="py-2.5 px-3">Policy No</th>
                      <th className="py-2.5 px-3">Borrower</th>
                      <th className="py-2.5 px-3 text-right">Disbursed (OMR)</th>
                      <th className="py-2.5 px-3 text-right">Outstanding (OMR)</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loans.map((l) => (
                      <tr key={l.LOAN_ID} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono font-bold text-navy">{l.LOAN_NO}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-700">{l.POL_NO}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{l.CUSTOMER_NAME || 'Assured'}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                          {Number(l.DISBURSED_AMOUNT).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-purple-700">
                          {Number(l.OUTSTANDING_PRINCIPAL).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            l.STATUS === 'ACTIVE' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {l.STATUS}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {l.STATUS === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => {
                                setRepayModalLoan(l);
                                setRepayPrincipal(Number(l.OUTSTANDING_PRINCIPAL));
                                setRepayInterest(50);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Record Repayment</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: GENERAL LEDGER (GL) ACCOUNTING ENTRIES */}
      {/* ========================================================================= */}
      {activeTab === 'journal' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-navy">General Ledger (GL) Double-Entry Journal</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Audit trail of balanced Debit & Credit vouchers generated across policy collections, surrenders, maturities, and loan transactions.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={journalTxnFilter}
                onChange={(e) => setJournalTxnFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 font-semibold bg-white"
              >
                <option value="ALL">All Sources</option>
                <option value="FPR">First Premium (FPR)</option>
                <option value="RPR">Renewal Premium (RPR)</option>
                <option value="REINSTATE">Reinstatement</option>
                <option value="SURRENDER">Surrender Settlement</option>
                <option value="MATURITY">Maturity Settlement</option>
                <option value="LOAN_DISBURSE">Loan Disbursement</option>
                <option value="LOAN_REPAY">Loan Repayment</option>
              </select>

              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search voucher, ref..."
                  value={journalSearch}
                  onChange={(e) => setJournalSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Voucher No</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">Source Ref</th>
                  <th className="py-2.5 px-3">GL Account</th>
                  <th className="py-2.5 px-3 text-center">DR / CR</th>
                  <th className="py-2.5 px-3 text-right">Amount (OMR)</th>
                  <th className="py-2.5 px-3">Narration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {journalEntries
                  .filter((j) => {
                    const matchSource = journalTxnFilter === 'ALL' || j.TXN_SOURCE === journalTxnFilter;
                    const matchSearch =
                      !journalSearch ||
                      j.JOURNAL_VOUCHER_NO.toLowerCase().includes(journalSearch.toLowerCase()) ||
                      j.SOURCE_REF_NO.toLowerCase().includes(journalSearch.toLowerCase()) ||
                      j.GL_ACCOUNT_NAME.toLowerCase().includes(journalSearch.toLowerCase());
                    return matchSource && matchSearch;
                  })
                  .map((j) => (
                    <tr key={j.ENTRY_ID} className="hover:bg-slate-50/60 font-mono text-[11px]">
                      <td className="py-2 px-3 font-bold text-navy">{j.JOURNAL_VOUCHER_NO}</td>
                      <td className="py-2 px-3 text-slate-500">{j.VOUCHER_DATE}</td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {j.TXN_SOURCE}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{j.SOURCE_REF_NO}</td>
                      <td className="py-2 px-3">
                        <span className="font-bold text-slate-700">{j.GL_ACCOUNT_CODE}</span>
                        <div className="text-[10px] text-slate-400 font-sans">{j.GL_ACCOUNT_NAME}</div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                          j.DR_CR_FLAG === 'D' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {j.DR_CR_FLAG === 'D' ? 'DEBIT (DR)' : 'CREDIT (CR)'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-black text-slate-900 font-mono">
                        {Number(j.AMOUNT).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-slate-500 font-sans text-[11px] truncate max-w-xs">
                        {j.NARRATION}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: COLLECT FPR */}
      {/* ========================================================================= */}
      {fprModalProp && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-navy uppercase">Collect First Premium (FPR)</h3>
                <span className="text-xs text-slate-500 font-semibold">Proposal: {fprModalProp.PROP_NO}</span>
              </div>
              <button onClick={() => setFprModalProp(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-teal-50 rounded-xl border border-teal-200">
                <span className="text-slate-500 font-bold block">First Premium Installment Amount:</span>
                <span className="text-xl font-black text-teal-800">
                  OMR {Number(fprModalProp.TOTAL_PAYABLE || 500).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-teal-700 block mt-0.5">Assured Life: {fprModalProp.PAS_NAME || 'Assured'}</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Instrument Mode *</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value as PayMode)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-semibold"
                >
                  <option value="CASH">Cash Deposit</option>
                  <option value="BANK_TRANSFER">Bank Wire / Electronic Transfer</option>
                  <option value="CHEQUE">Cheque / Demand Draft</option>
                  <option value="CARD">Credit / Debit Card</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Transaction Reference / Cheque No</label>
                <input
                  type="text"
                  placeholder="e.g. TR-904128 / CHQ-10492"
                  value={txnRef}
                  onChange={(e) => setTxnRef(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Collection Remarks</label>
                <input
                  type="text"
                  value={paymentRemarks}
                  onChange={(e) => setPaymentRemarks(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setFprModalProp(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCollectFPR}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 shadow-xs"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Confirm & Generate FPR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: COLLECT RPR */}
      {/* ========================================================================= */}
      {rprModalPol && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-navy uppercase">Collect Renewal Premium (RPR)</h3>
                <span className="text-xs text-slate-500 font-semibold">Policy: {rprModalPol.POL_NO}</span>
              </div>
              <button onClick={() => setRprModalPol(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                <span className="text-slate-500 font-bold block">Renewal Installment Amount:</span>
                <span className="text-xl font-black text-blue-800">
                  OMR {Number(rprModalPol.TOTAL_PAYABLE || 300).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-blue-700 block mt-0.5">Policyholder: {rprModalPol.PAS_NAME || 'Assured'}</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Instrument Mode *</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value as PayMode)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-semibold"
                >
                  <option value="CASH">Cash Deposit</option>
                  <option value="BANK_TRANSFER">Bank Wire / Electronic Transfer</option>
                  <option value="CHEQUE">Cheque / Demand Draft</option>
                  <option value="CARD">Credit / Debit Card</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Transaction Reference</label>
                <input
                  type="text"
                  value={txnRef}
                  onChange={(e) => setTxnRef(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRprModalPol(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCollectRPR}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-xs"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Confirm & Advance Due Date</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW OFFICIAL RECEIPT CERTIFICATE */}
      {/* ========================================================================= */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border-2 border-slate-300 max-w-xl w-full p-8 shadow-2xl space-y-6 print:border-none print:shadow-none">
            <div className="flex items-center justify-between border-b-2 border-navy pb-3">
              <div>
                <span className="text-[10px] font-black tracking-widest text-teal-600 uppercase">KINS Core Life System</span>
                <h3 className="text-xl font-black text-navy uppercase">Official Premium Receipt</h3>
                <span className="text-xs text-slate-500 font-semibold">{selectedReceipt.RECEIPT_TYPE === 'FPR' ? 'First Premium Receipt' : 'Renewal Premium Receipt'}</span>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono font-black text-navy">{selectedReceipt.RECEIPT_NO}</div>
                <div className="text-[10px] text-slate-400">{selectedReceipt.RECEIPT_DATE}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl">
              <div>
                <span className="text-slate-400 font-bold block">Policy / Proposal:</span>
                <span className="font-bold text-navy text-sm">{selectedReceipt.POL_NO || selectedReceipt.PROP_NO}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block">Life Assured:</span>
                <span className="font-bold text-slate-800 text-sm">{selectedReceipt.CUSTOMER_NAME || 'Assured'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block">Payment Mode:</span>
                <span className="font-bold text-slate-800">{selectedReceipt.PAY_MODE}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block">GL Voucher:</span>
                <span className="font-bold text-purple-700 font-mono">{selectedReceipt.GL_VOUCHER_NO}</span>
              </div>
            </div>

            <div className="p-4 bg-teal-50 rounded-xl border border-teal-200 flex justify-between items-center text-sm">
              <span className="font-bold text-teal-900">Total Premium Received:</span>
              <span className="text-2xl font-black text-teal-800 font-mono">
                OMR {Number(selectedReceipt.TOTAL_PAID).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs">
              <span className="text-slate-400 font-semibold">Cashier: {selectedReceipt.COLLECTED_BY}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-navy text-white font-bold hover:bg-slate-800"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LOAN REPAYMENT */}
      {/* ========================================================================= */}
      {repayModalLoan && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-navy uppercase">Record Policy Loan Repayment</h3>
                <span className="text-xs text-slate-500 font-semibold">Loan: {repayModalLoan.LOAN_NO} (Policy: {repayModalLoan.POL_NO})</span>
              </div>
              <button onClick={() => setRepayModalLoan(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                <span className="text-slate-500 font-bold block">Current Outstanding Principal:</span>
                <span className="text-xl font-black text-purple-900">
                  OMR {Number(repayModalLoan.OUTSTANDING_PRINCIPAL).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Principal Repayment (OMR) *</label>
                <input
                  type="number"
                  step="50"
                  max={repayModalLoan.OUTSTANDING_PRINCIPAL}
                  value={repayPrincipal}
                  onChange={(e) => setRepayPrincipal(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold text-navy"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Interest Payment (OMR)</label>
                <input
                  type="number"
                  step="10"
                  value={repayInterest}
                  onChange={(e) => setRepayInterest(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold text-purple-700"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value as PayMode)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-semibold"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Wire</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CARD">Card</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRepayModalLoan(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRepayLoan}
                disabled={actionLoading || (repayPrincipal + repayInterest <= 0)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Repayment</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
