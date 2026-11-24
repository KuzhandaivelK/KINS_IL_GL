import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import {
  Briefcase,
  Building2,
  Users,
  FileSpreadsheet,
  Plus,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  ShieldCheck,
  Calendar,
  Layers,
  FileCheck2,
  Clock,
  Sparkles,
  Download,
  UploadCloud,
  FileUp,
  Printer,
  Trash2,
  Check,
  X,
  FileText,
  BadgeAlert,
  Percent,
  Sliders,
  Award,
  AlertCircle
} from 'lucide-react';
import { groupLifeService } from '../services/groupLifeService';
import { productService } from '../services/productService';
import { coverService } from '../services/coverService';
import {
  GLQuoteHeaderRecord,
  GLQuoteMemberRecord,
  GLQuoteRiderRecord,
  GLQuoteDetail,
  GLPolicyMasterRecord,
  GLPolicyDetail,
  GLBenefitStructure,
  GLPaymentFrequency,
  ActuarialCalculationResult,
  MemberUploadResult,
  ParsedMemberRow
} from '../types/groupLife';
import { ProductItem } from '../types/product';
import { CoverListItem } from '../types/cover';

const SAMPLE_MEMBERS = [
  { empId: 'EMP-1001', memberName: 'Ahmed Al-Harthy', dob: '1979-04-15', gender: 'M' as const, category: 'Executive', monthlySalary: 4500 },
  { empId: 'EMP-1002', memberName: 'Fatima Al-Balushi', dob: '1986-09-22', gender: 'F' as const, category: 'Management', monthlySalary: 3200 },
  { empId: 'EMP-1003', memberName: 'Salim Al-Kiyumi', dob: '1992-02-10', gender: 'M' as const, category: 'Staff', monthlySalary: 1800 },
  { empId: 'EMP-1004', memberName: 'Maryam Al-Zadjali', dob: '1995-11-05', gender: 'F' as const, category: 'Staff', monthlySalary: 1600 },
  { empId: 'EMP-1005', memberName: 'Rashid Al-Habsi', dob: '1983-07-30', gender: 'M' as const, category: 'Technical', monthlySalary: 2400 }
];

export const GroupLifePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'quotes' | 'wizard' | 'policies' | 'schedule'>('quotes');

  // Loading & error states
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Quotes Register State
  const [quotes, setQuotes] = useState<GLQuoteHeaderRecord[]>([]);
  const [quoteSearch, setQuoteSearch] = useState<string>('');
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<string>('ALL');

  // Master Policies Register State
  const [policies, setPolicies] = useState<GLPolicyMasterRecord[]>([]);
  const [policySearch, setPolicySearch] = useState<string>('');
  const [policyStatusFilter, setPolicyStatusFilter] = useState<string>('ALL');

  // Active View Details
  const [selectedQuote, setSelectedQuote] = useState<GLQuoteDetail | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<GLPolicyDetail | null>(null);

  // Products and Covers masters
  const [glProducts, setGlProducts] = useState<ProductItem[]>([]);
  const [glCovers, setGlCovers] = useState<CoverListItem[]>([]);

  // ==========================================
  // WIZARD STATE (4-Step Group Life Quotation)
  // ==========================================
  const [wizardStep, setWizardStep] = useState<number>(1);

  // Step 1: Corporate & Plan Details
  const [corpName, setCorpName] = useState<string>('Al-Madina Energy & Industrial Services LLC');
  const [corpRegNo, setCorpRegNo] = useState<string>('CR-1049283');
  const [corpTaxNo, setCorpTaxNo] = useState<string>('TAX-99482');
  const [corpContactPerson, setCorpContactPerson] = useState<string>('Khalid Al-Hosni (HR Director)');
  const [corpEmail, setCorpEmail] = useState<string>('khalid.hosni@almadina-energy.com');
  const [corpPhone, setCorpPhone] = useState<string>('+968 2459 8800');
  const [corpAddress, setCorpAddress] = useState<string>('Way 3401, Building 45, Al Khuwair, Muscat');
  const [corpIndustry, setCorpIndustry] = useState<string>('Energy & Petrochemicals');
  const [prodCode, setProdCode] = useState<string>('GL_TERM01');
  const [benefitStructure, setBenefitStructure] = useState<GLBenefitStructure>('MULTIPLE_OF_SALARY');
  const [salaryMultiple, setSalaryMultiple] = useState<number>(3.0);
  const [flatSaAmount, setFlatSaAmount] = useState<number>(50000);
  const [freeCoverLimit, setFreeCoverLimit] = useState<number>(250000);
  const [payFreq, setPayFreq] = useState<GLPaymentFrequency>('ANNUAL');
  const [mop, setMop] = useState<string>('Y');
  const [remarks, setRemarks] = useState<string>('Annual Group Term Life Policy Quotation');

  // Step 2: Member Census Schedule
  const [memberRoster, setMemberRoster] = useState<Array<{
    empId: string;
    memberName: string;
    dob: string;
    gender: 'M' | 'F' | 'O';
    category: string;
    monthlySalary: number;
    annualSalary: number;
    sumAssured?: number;
  }>>([
    { empId: 'EMP-1001', memberName: 'Ahmed Al-Harthy', dob: '1979-04-15', gender: 'M', category: 'Executive', monthlySalary: 4500, annualSalary: 54000 },
    { empId: 'EMP-1002', memberName: 'Fatima Al-Balushi', dob: '1986-09-22', gender: 'F', category: 'Management', monthlySalary: 3200, annualSalary: 38400 },
    { empId: 'EMP-1003', memberName: 'Salim Al-Kiyumi', dob: '1992-02-10', gender: 'M', category: 'Staff', monthlySalary: 1800, annualSalary: 21600 }
  ]);

  // Step 3: Riders & Rating
  const [selectedRiders, setSelectedRiders] = useState<Record<string, { selected: boolean; percent: number; rate: number }>>({
    'GL_PTD': { selected: true, percent: 100, rate: 0.45 },
    'GL_ADD': { selected: true, percent: 100, rate: 0.35 },
    'GL_CI': { selected: false, percent: 50, rate: 0.85 },
    'GL_MED': { selected: true, percent: 100, rate: 0.20 }
  });
  const [baseRatePerMille, setBaseRatePerMille] = useState<number>(2.50);
  const [experienceDiscountPct, setExperienceDiscountPct] = useState<number>(10);

  // Step 4: Actuarial Calculation Result
  const [calcResult, setCalcResult] = useState<ActuarialCalculationResult | null>(null);

  // Member Upload Modal & Parser State
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadTargetPolicyNo, setUploadTargetPolicyNo] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<MemberUploadResult | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [downloadingTemplate, setDownloadingTemplate] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);

  // ==========================================
  // INITIAL DATA LOADING
  // ==========================================
  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch GL Quotes
      const quoteList = await groupLifeService.getQuotes();
      setQuotes(quoteList);

      // 2. Fetch GL Master Policies
      const policyList = await groupLifeService.getPolicies();
      setPolicies(policyList);

      // 3. Fetch Products (GL filtered)
      const pData = await productService.getProducts(undefined, undefined, 'GL');
      const products = pData.products || [];
      setGlProducts(products);
      if (products.length > 0 && !prodCode) {
        setProdCode(products[0].PROD_CODE);
      }

      // 4. Fetch Covers (GL filtered)
      const cData = await coverService.getCovers(undefined, undefined, true, 'GL');
      setGlCovers(cData.covers || []);
    } catch (err: any) {
      console.error('Group Life initial data load error:', err);
      setError(err.message || 'Failed to load Group Life data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Recalculate on census change or step transition
  const runActuarialCalculation = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const riderPayload: Array<{ riderCode: string; riderName: string; saBasis: string; saPercent: number; ratePerMille: number }> = [];
      Object.keys(selectedRiders).forEach((code) => {
        const r = selectedRiders[code];
        if (r.selected) {
          const matchCover = glCovers.find((c) => c.coverCode === code);
          riderPayload.push({
            riderCode: code,
            riderName: matchCover?.coverDesc || code,
            saBasis: 'MATCH_BASIC',
            saPercent: r.percent,
            ratePerMille: r.rate
          });
        }
      });

      const res = await groupLifeService.calculateCensus({
        benefitStructure,
        salaryMultiple,
        flatSaAmount,
        freeCoverLimit,
        baseRatePerMille,
        experienceDiscountPct,
        payFreq,
        members: memberRoster,
        riders: riderPayload
      });

      setCalcResult(res);
      return res;
    } catch (err: any) {
      console.error('Calculation error:', err);
      setError(err.message || 'Actuarial calculation failed');
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to add member
  const handleAddMember = () => {
    const nextIdx = memberRoster.length + 1;
    const newEmp = {
      empId: `EMP-${1000 + nextIdx}`,
      memberName: `Employee ${nextIdx}`,
      dob: '1990-01-01',
      gender: 'M' as const,
      category: 'Staff',
      monthlySalary: 1500,
      annualSalary: 18000
    };
    setMemberRoster([...memberRoster, newEmp]);
  };

  // Helper to remove member
  const handleRemoveMember = (index: number) => {
    if (memberRoster.length <= 1) {
      setError('At least one member is required in the group census');
      return;
    }
    const updated = memberRoster.filter((_, idx) => idx !== index);
    setMemberRoster(updated);
  };

  // Helper to populate sample census
  const handlePopulateSampleCensus = () => {
    const sample = SAMPLE_MEMBERS.map((m) => ({
      ...m,
      annualSalary: m.monthlySalary * 12
    }));
    setMemberRoster(sample);
    setSuccessMsg('Populated 5 realistic corporate census members.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Helper to open member upload modal for census
  const handleOpenUploadForCensus = () => {
    setUploadTargetPolicyNo(null);
    setUploadFile(null);
    setUploadResult(null);
    setShowUploadModal(true);
  };

  // Helper to open member upload modal for policy
  const handleOpenUploadForPolicy = (policyNo: string) => {
    setUploadTargetPolicyNo(policyNo);
    setUploadFile(null);
    setUploadResult(null);
    setShowUploadModal(true);
  };

  // Helper to process uploaded file (CSV or Excel)
  const processUploadedFile = async (file: File) => {
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const lowerName = file.name.toLowerCase();
    const isSupported = validExtensions.some((ext) => lowerName.endsWith(ext));
    if (!isSupported) {
      setError('Please upload a valid spreadsheet file (.csv, .xlsx, or .xls)');
      return;
    }

    setUploadFile(file);
    setIsParsing(true);
    setError(null);
    try {
      const res = await groupLifeService.uploadAndParseMemberFile(file);
      setUploadResult(res);
    } catch (err: any) {
      console.error('File parsing error:', err);
      setError(err.message || 'Failed to parse member upload file');
    } finally {
      setIsParsing(false);
    }
  };

  // Helper to download templates
  const handleDownloadTemplate = async (format: 'xlsx' | 'csv') => {
    setDownloadingTemplate(true);
    try {
      await groupLifeService.downloadTemplate(format);
      setSuccessMsg(`Sample template (${format.toUpperCase()}) downloaded successfully.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error('Download template error:', err);
      setError(err.message || 'Failed to download member census template');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // Helper to commit parsed members
  const handleConfirmImport = async () => {
    if (!uploadResult || !uploadResult.members) return;

    // Filter valid & warning rows (excluding error rows)
    const validRows = uploadResult.members.filter((m) => m.status !== 'ERROR');
    if (validRows.length === 0) {
      setError('No valid member records found in the uploaded file to import.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      if (uploadTargetPolicyNo) {
        // Enrolling directly into an existing Master Policy
        const updatedPolicy = await groupLifeService.uploadPolicyMembers(uploadTargetPolicyNo, uploadFile!);
        setSelectedPolicy(updatedPolicy);
        const policyList = await groupLifeService.getPolicies();
        setPolicies(policyList);
        setShowUploadModal(false);
        setSuccessMsg(`Successfully enrolled ${validRows.length} member(s) into Master Policy ${uploadTargetPolicyNo}.`);
      } else {
        // Populating census roster in the Quotation Wizard
        const newMembers = validRows.map((m) => {
          const mSal = m.monthlySalary || 0;
          const aSal = m.annualSalary || mSal * 12;
          return {
            empId: m.empId || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
            memberName: m.memberName,
            dob: m.dob,
            gender: m.gender,
            category: m.category || 'Staff',
            monthlySalary: mSal,
            annualSalary: aSal,
            sumAssured: m.sumAssured
          };
        });

        if (importMode === 'replace') {
          setMemberRoster(newMembers);
        } else {
          setMemberRoster([...memberRoster, ...newMembers]);
        }

        setShowUploadModal(false);
        setSuccessMsg(`Successfully imported ${newMembers.length} member(s) into Census Schedule (${importMode === 'replace' ? 'replaced existing' : 'appended'}).`);
        // Recalculate figures
        setTimeout(() => {
          runActuarialCalculation();
        }, 150);
      }
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Upload confirm error:', err);
      setError(err.message || 'Failed to complete member import');
    } finally {
      setIsUploading(false);
    }
  };

  // Helper to save quotation
  const handleSaveQuotation = async () => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const riderPayload: Array<{ riderCode: string; riderName: string; saBasis: string; saPercent: number; ratePerMille: number }> = [];
      Object.keys(selectedRiders).forEach((code) => {
        const r = selectedRiders[code];
        if (r.selected) {
          const matchCover = glCovers.find((c) => c.coverCode === code);
          riderPayload.push({
            riderCode: code,
            riderName: matchCover?.coverDesc || code,
            saBasis: 'MATCH_BASIC',
            saPercent: r.percent,
            ratePerMille: r.rate
          });
        }
      });

      const payload = {
        corpName,
        corpRegNo,
        corpTaxNo,
        corpContactPerson,
        corpEmail,
        corpPhone,
        corpAddress,
        corpIndustry,
        prodCode,
        benefitStructure,
        salaryMultiple,
        flatSaAmount,
        freeCoverLimit,
        baseRatePerMille,
        experienceDiscountPct,
        payFreq,
        mop,
        remarks,
        members: memberRoster,
        riders: riderPayload
      };

      const quoteDetail = await groupLifeService.createQuote(payload);
      setSelectedQuote(quoteDetail);
      setSuccessMsg(`Quotation ${quoteDetail.header.GL_QUOTE_NO} created and actuarially certified!`);
      await loadInitialData();
      setActiveTab('quotes');
    } catch (err: any) {
      console.error('Save quote error:', err);
      setError(err.message || 'Failed to save Group Life Quotation');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to convert quote to master policy
  const handleConvertToMasterPolicy = async (quoteNo: string) => {
    if (!window.confirm(`Convert Group Life Quote ${quoteNo} into an official Master Policy?`)) {
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const polDetail = await groupLifeService.convertToMasterPolicy(quoteNo);
      setSelectedPolicy(polDetail);
      setSuccessMsg(`Quote ${quoteNo} successfully converted to Master Policy ${polDetail.master.MASTER_POLICY_NO}!`);
      await loadInitialData();
      setActiveTab('schedule');
    } catch (err: any) {
      console.error('Conversion error:', err);
      setError(err.message || 'Failed to convert quote to Master Policy');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to approve master policy
  const handleApprovePolicy = async (policyNo: string) => {
    const remarksInput = window.prompt(`Enter Underwriting Approval remarks for Master Policy ${policyNo}:`, 'Underwriting authorized. Meets corporate group criteria and census thresholds.');
    if (remarksInput === null) return;

    setActionLoading(true);
    setError(null);
    try {
      const updatedPol = await groupLifeService.approvePolicy(policyNo, remarksInput);
      setSelectedPolicy(updatedPol);
      setSuccessMsg(`Master Policy ${policyNo} has been officially approved & issued!`);
      await loadInitialData();
    } catch (err: any) {
      console.error('Approve policy error:', err);
      setError(err.message || 'Failed to approve Master Policy');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered lists
  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const matchStatus = quoteStatusFilter === 'ALL' || q.STATUS === quoteStatusFilter;
      const matchSearch =
        !quoteSearch.trim() ||
        q.GL_QUOTE_NO.toLowerCase().includes(quoteSearch.toLowerCase()) ||
        q.CORP_NAME.toLowerCase().includes(quoteSearch.toLowerCase()) ||
        (q.CORP_CONTACT_PERSON && q.CORP_CONTACT_PERSON.toLowerCase().includes(quoteSearch.toLowerCase()));
      return matchStatus && matchSearch;
    });
  }, [quotes, quoteStatusFilter, quoteSearch]);

  const filteredPolicies = useMemo(() => {
    return policies.filter((p) => {
      const matchStatus = policyStatusFilter === 'ALL' || p.POL_STATUS === policyStatusFilter;
      const matchSearch =
        !policySearch.trim() ||
        p.MASTER_POLICY_NO.toLowerCase().includes(policySearch.toLowerCase()) ||
        p.CORP_NAME.toLowerCase().includes(policySearch.toLowerCase()) ||
        p.GL_QUOTE_NO.toLowerCase().includes(policySearch.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [policies, policyStatusFilter, policySearch]);

  // Aggregate metrics
  const metrics = useMemo(() => {
    const totalQuotesCount = quotes.length;
    const totalPoliciesCount = policies.length;
    const totalInforceMembers = policies.reduce((acc, p) => acc + (p.TOTAL_ACTIVE_MEMBERS || 0), 0);
    const totalInforceSa = policies.reduce((acc, p) => acc + (p.TOTAL_INFORCE_SA || 0), 0);
    const totalInforcePrem = policies.reduce((acc, p) => acc + (p.TOTAL_INFORCE_PREMIUM || 0), 0);
    return {
      totalQuotesCount,
      totalPoliciesCount,
      totalInforceMembers,
      totalInforceSa,
      totalInforcePrem
    };
  }, [quotes, policies]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs font-medium text-slate-500 mb-1.5">
            <button onClick={() => navigate('/dashboard')} className="hover:text-navy transition-colors">Dashboard</button>
            <span className="text-slate-300">/</span>
            <span className="text-teal-accent font-semibold">Group Life Insurance</span>
          </nav>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy tracking-tight">
              Group Life Insurance Workspace
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
              LOB: Group Life (GL)
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-text-secondary">
            Enterprise employer scheme quotations, member census actuarial rating, group riders, and master policy issuance.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => loadInitialData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setWizardStep(1);
              setActiveTab('wizard');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Group Quotation</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
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

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Group Quotations</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-navy">{metrics.totalQuotesCount}</p>
          <span className="text-[11px] text-slate-400">Total quotes in database</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Master Policies</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-navy">{metrics.totalPoliciesCount}</p>
          <span className="text-[11px] text-emerald-600 font-medium">In-force & Approved</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Members Covered</span>
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-navy">{metrics.totalInforceMembers}</p>
          <span className="text-[11px] text-slate-400">Active corporate census</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">In-Force Sum Assured</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-xl font-black text-navy truncate">
            {metrics.totalInforceSa.toLocaleString('en-US', { minimumFractionDigits: 0 })}
          </p>
          <span className="text-[11px] text-slate-400">Total Group Exposure (OMR)</span>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-1.5 shadow-xs flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('quotes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'quotes'
              ? 'bg-navy text-white shadow-xs'
              : 'text-slate-600 hover:text-navy hover:bg-slate-50'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Group Quotations Register</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-semibold">
            {quotes.length}
          </span>
        </button>

        <button
          onClick={() => {
            setWizardStep(1);
            setActiveTab('wizard');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'wizard'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-teal-700 hover:bg-slate-50'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Quotation & Census Wizard</span>
        </button>

        <button
          onClick={() => setActiveTab('policies')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'policies'
              ? 'bg-navy text-white shadow-xs'
              : 'text-slate-600 hover:text-navy hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Group Master Policies</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-semibold">
            {policies.length}
          </span>
        </button>

        {(selectedPolicy || selectedQuote) && (
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'schedule'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-700 hover:bg-slate-50'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Policy Schedule & Certificate</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: GROUP QUOTATIONS REGISTER */}
      {/* ========================================================================= */}
      {activeTab === 'quotes' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Filters & Actions */}
          <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Quote No, Corporate Sponsor, Contact..."
                  value={quoteSearch}
                  onChange={(e) => setQuoteSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Status:</span>
              <select
                value={quoteStatusFilter}
                onChange={(e) => setQuoteStatusFilter(e.target.value)}
                className="text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">DRAFT</option>
                <option value="QUOTED">QUOTED</option>
                <option value="CONVERTED">CONVERTED</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Quote No</th>
                  <th className="py-3 px-4">Corporate Sponsor</th>
                  <th className="py-3 px-4">Product Plan</th>
                  <th className="py-3 px-4 text-center">Census</th>
                  <th className="py-3 px-4 text-right">Sum Assured (OMR)</th>
                  <th className="py-3 px-4 text-right">Annual Premium</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold">No Group Life quotations found</p>
                      <p className="text-[11px] mt-0.5">Click "New Group Quotation" to calculate and create a corporate quote.</p>
                    </td>
                  </tr>
                ) : (
                  filteredQuotes.map((q) => (
                    <tr key={q.GL_QUOTE_ID} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-navy whitespace-nowrap">
                        {q.GL_QUOTE_NO}
                        <div className="text-[10px] text-slate-400 font-normal">{q.GL_QUOTE_DATE}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{q.CORP_NAME}</div>
                        <div className="text-[11px] text-slate-400">{q.CORP_CONTACT_PERSON || q.CORP_INDUSTRY || 'N/A'}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-700">{q.PROD_CODE}</span>
                        <div className="text-[10px] text-slate-400">{q.BENEFIT_STRUCTURE.replace(/_/g, ' ')}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
                          <Users className="w-3 h-3" />
                          {q.TOTAL_MEMBERS}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-navy whitespace-nowrap">
                        {Number(q.TOTAL_SUM_ASSURED).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-teal-700 whitespace-nowrap">
                        {Number(q.TOTAL_ANNUAL_PREMIUM).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        <div className="text-[10px] text-slate-400 font-normal">{q.PAY_FREQ}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {q.STATUS === 'CONVERTED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                            CONVERTED
                          </span>
                        ) : q.STATUS === 'QUOTED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            QUOTED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                            {q.STATUS}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              const d = await groupLifeService.getQuoteByNo(q.GL_QUOTE_NO);
                              setSelectedQuote(d);
                              setActiveTab('schedule');
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-navy hover:bg-slate-100 transition-colors"
                            title="View Quote Schedule"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {q.STATUS !== 'CONVERTED' && (
                            <button
                              type="button"
                              onClick={() => handleConvertToMasterPolicy(q.GL_QUOTE_NO)}
                              disabled={actionLoading}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-600 text-white font-bold text-[11px] hover:bg-teal-700 transition-colors shadow-xs"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Convert to Policy</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: QUOTATION & CENSUS WIZARD (STEPPER) */}
      {/* ========================================================================= */}
      {activeTab === 'wizard' && (
        <div className="space-y-6">
          {/* Stepper Navigation */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {[
                { step: 1, label: '1. Corporate Profile & Plan', desc: 'Sponsor & Scheme Basics' },
                { step: 2, label: '2. Census Schedule', desc: 'Member Roster & Salaries' },
                { step: 3, label: '3. Group Riders & Rating', desc: 'Add-ons & Experience Rate' },
                { step: 4, label: '4. Actuarial Review', desc: 'Certified Premium Summary' }
              ].map((item) => (
                <button
                  key={item.step}
                  onClick={async () => {
                    if (item.step === 4) {
                      await runActuarialCalculation();
                    }
                    setWizardStep(item.step);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    wizardStep === item.step
                      ? 'border-teal-500 bg-teal-50/50 shadow-xs'
                      : wizardStep > item.step
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-black text-xs ${
                        wizardStep === item.step
                          ? 'text-teal-700'
                          : wizardStep > item.step
                          ? 'text-emerald-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {item.label}
                    </span>
                    {wizardStep > item.step && <Check className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* STEP 1: Corporate Profile & Plan Basics */}
          {wizardStep === 1 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-extrabold text-navy">Step 1: Corporate Sponsor & Scheme Benefit Structure</h2>
                <p className="text-xs text-text-secondary mt-0.5">Specify employer business details, target GL product, and formula for Sum Assured computation.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Corporate Employer Name *</label>
                  <input
                    type="text"
                    value={corpName}
                    onChange={(e) => setCorpName(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="e.g. Al-Madina Energy LLC"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Commercial Reg No (CR)</label>
                  <input
                    type="text"
                    value={corpRegNo}
                    onChange={(e) => setCorpRegNo(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="e.g. CR-109482"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Corporate Industry</label>
                  <input
                    type="text"
                    value={corpIndustry}
                    onChange={(e) => setCorpIndustry(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="e.g. Energy & Petrochemicals"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">HR / Sponsor Contact Person</label>
                  <input
                    type="text"
                    value={corpContactPerson}
                    onChange={(e) => setCorpContactPerson(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="e.g. Khalid Al-Hosni"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={corpEmail}
                    onChange={(e) => setCorpEmail(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="hr@employer.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={corpPhone}
                    onChange={(e) => setCorpPhone(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="+968 2459 0000"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Corporate Address</label>
                  <input
                    type="text"
                    value={corpAddress}
                    onChange={(e) => setCorpAddress(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="Building, Street, City"
                  />
                </div>
              </div>

              {/* Product & Benefit Structure */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-xs font-extrabold text-navy uppercase tracking-wider mb-3">Group Insurance Plan Structure</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Target GL Product *</label>
                    <select
                      value={prodCode}
                      onChange={(e) => setProdCode(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 font-bold text-navy focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                      {glProducts.map((p) => (
                        <option key={p.PROD_CODE} value={p.PROD_CODE}>
                          {p.PROD_CODE} - {p.PROD_NAME}
                        </option>
                      ))}
                      {glProducts.length === 0 && (
                        <option value="GL_TERM01">GL_TERM01 - Corporate Group Term Life</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Benefit SA Formula *</label>
                    <select
                      value={benefitStructure}
                      onChange={(e) => setBenefitStructure(e.target.value as GLBenefitStructure)}
                      className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                      <option value="MULTIPLE_OF_SALARY">Multiple of Annual Salary (e.g. 3x, 4x)</option>
                      <option value="FLAT_SA">Flat Sum Assured (Equal for all employees)</option>
                      <option value="GRADED">Graded by Staff Category</option>
                    </select>
                  </div>

                  {benefitStructure === 'MULTIPLE_OF_SALARY' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Salary Multiple Factor</label>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max="10"
                        value={salaryMultiple}
                        onChange={(e) => setSalaryMultiple(Number(e.target.value))}
                        className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 font-bold text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      />
                    </div>
                  )}

                  {benefitStructure === 'FLAT_SA' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Flat Sum Assured (OMR)</label>
                      <input
                        type="number"
                        step="1000"
                        value={flatSaAmount}
                        onChange={(e) => setFlatSaAmount(Number(e.target.value))}
                        className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 font-bold text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Free Cover Limit (FCL) *</label>
                    <input
                      type="number"
                      step="5000"
                      value={freeCoverLimit}
                      onChange={(e) => setFreeCoverLimit(Number(e.target.value))}
                      className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                    <span className="text-[10px] text-slate-400">SA above this threshold requires Evidence of Insurability (EOI)</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Premium Payment Frequency *</label>
                    <select
                      value={payFreq}
                      onChange={(e) => {
                        const f = e.target.value as GLPaymentFrequency;
                        setPayFreq(f);
                        if (f === 'ANNUAL') setMop('Y');
                        else if (f === 'SEMI_ANNUAL') setMop('H');
                        else if (f === 'QUARTERLY') setMop('Q');
                        else if (f === 'MONTHLY') setMop('M');
                        else if (f === 'SINGLE') setMop('S');
                      }}
                      className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                      <option value="ANNUAL">Annual (Modal: 1.0)</option>
                      <option value="SEMI_ANNUAL">Semi-Annual (Modal: 0.52)</option>
                      <option value="QUARTERLY">Quarterly (Modal: 0.265)</option>
                      <option value="MONTHLY">Monthly (Modal: 0.09)</option>
                      <option value="SINGLE">Single Premium (1.0)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">MOP Code (Mode of Payment)</label>
                    <select
                      value={mop}
                      onChange={(e) => setMop(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 font-bold text-navy focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                      <option value="Y">Y - Yearly</option>
                      <option value="H">H - Half yearly</option>
                      <option value="Q">Q - Quarterly</option>
                      <option value="M">M - Monthly</option>
                      <option value="S">S - Single</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Next Step Action */}
              <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors shadow-xs"
                >
                  <span>Next: Member Census Schedule</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Member Census Schedule */}
          {wizardStep === 2 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-extrabold text-navy">Step 2: Employee Member Census Schedule</h2>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Maintain corporate employee roster. Annual salary and Sum Assured are computed dynamically based on the plan formula.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Upload Member File Button */}
                  <button
                    type="button"
                    onClick={handleOpenUploadForCensus}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors shadow-xs"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload Member File (CSV / Excel)</span>
                  </button>

                  {/* Template Downloads */}
                  <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    <span className="text-[10px] font-bold text-slate-500 px-2 flex items-center gap-1">
                      <Download className="w-3 h-3 text-slate-400" />
                      Template:
                    </span>
                    <button
                      type="button"
                      disabled={downloadingTemplate}
                      onClick={() => handleDownloadTemplate('xlsx')}
                      className="px-2 py-1 text-[11px] font-bold text-teal-700 hover:bg-white rounded transition-colors"
                      title="Download Excel (.xlsx) Template with instructions"
                    >
                      .XLSX
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      disabled={downloadingTemplate}
                      onClick={() => handleDownloadTemplate('csv')}
                      className="px-2 py-1 text-[11px] font-bold text-teal-700 hover:bg-white rounded transition-colors"
                      title="Download CSV (.csv) Template"
                    >
                      .CSV
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handlePopulateSampleCensus}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 text-xs font-bold hover:bg-teal-100 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    <span>Sample Census</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddMember}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy text-white text-xs font-bold hover:bg-slate-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Member</span>
                  </button>
                </div>
              </div>

              {/* Census Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Emp ID</th>
                      <th className="py-2.5 px-3">Employee Name</th>
                      <th className="py-2.5 px-3">DOB</th>
                      <th className="py-2.5 px-3 text-center">Gender</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Monthly Sal (OMR)</th>
                      <th className="py-2.5 px-3 text-right">Computed SA (OMR)</th>
                      <th className="py-2.5 px-3 text-center">FCL Underwriting</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {memberRoster.map((m, idx) => {
                      const annualSalary = (m.monthlySalary || 0) * 12;
                      let computedSa = 0;
                      if (benefitStructure === 'MULTIPLE_OF_SALARY') {
                        computedSa = Math.round(annualSalary * salaryMultiple);
                      } else if (benefitStructure === 'FLAT_SA') {
                        computedSa = flatSaAmount;
                      } else {
                        computedSa = m.sumAssured || 50000;
                      }
                      const isAboveFcl = computedSa > freeCoverLimit;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={m.empId}
                              onChange={(e) => {
                                const copy = [...memberRoster];
                                copy[idx].empId = e.target.value;
                                setMemberRoster(copy);
                              }}
                              className="w-24 text-xs font-bold text-navy border border-slate-200 rounded px-2 py-1"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={m.memberName}
                              onChange={(e) => {
                                const copy = [...memberRoster];
                                copy[idx].memberName = e.target.value;
                                setMemberRoster(copy);
                              }}
                              className="w-44 text-xs font-semibold text-slate-800 border border-slate-200 rounded px-2 py-1"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="date"
                              value={m.dob}
                              onChange={(e) => {
                                const copy = [...memberRoster];
                                copy[idx].dob = e.target.value;
                                setMemberRoster(copy);
                              }}
                              className="text-xs border border-slate-200 rounded px-2 py-1"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <select
                              value={m.gender}
                              onChange={(e) => {
                                const copy = [...memberRoster];
                                copy[idx].gender = e.target.value as any;
                                setMemberRoster(copy);
                              }}
                              className="text-xs border border-slate-200 rounded px-1.5 py-1"
                            >
                              <option value="M">M</option>
                              <option value="F">F</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={m.category}
                              onChange={(e) => {
                                const copy = [...memberRoster];
                                copy[idx].category = e.target.value;
                                setMemberRoster(copy);
                              }}
                              className="text-xs border border-slate-200 rounded px-2 py-1"
                            >
                              <option value="Executive">Executive</option>
                              <option value="Management">Management</option>
                              <option value="Staff">Staff</option>
                              <option value="Technical">Technical</option>
                            </select>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              value={m.monthlySalary}
                              onChange={(e) => {
                                const copy = [...memberRoster];
                                const mSal = Number(e.target.value);
                                copy[idx].monthlySalary = mSal;
                                copy[idx].annualSalary = mSal * 12;
                                setMemberRoster(copy);
                              }}
                              className="w-24 text-right text-xs font-semibold border border-slate-200 rounded px-2 py-1"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-black text-navy whitespace-nowrap">
                            {computedSa.toLocaleString('en-US')}
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            {isAboveFcl ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                EOI Required (&gt; FCL)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Under FCL
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(idx)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Step Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors shadow-xs"
                >
                  <span>Next: Group Riders & Rating</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Group Riders & Actuarial Rating */}
          {wizardStep === 3 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-extrabold text-navy">Step 3: Group Riders & Actuarial Rating Factors</h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Select group riders, specify rider sum assured basis, base per-mille rate, and corporate experience discount.
                </p>
              </div>

              {/* Riders Selection */}
              <div>
                <h3 className="text-xs font-extrabold text-navy uppercase tracking-wider mb-3">Group Riders Coverage Selection</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { code: 'GL_PTD', name: 'Group Permanent Total Disability (PTD)', defaultRate: 0.45 },
                    { code: 'GL_ADD', name: 'Group Accidental Death & Dismemberment (ADD)', defaultRate: 0.35 },
                    { code: 'GL_CI', name: 'Group Accelerated Critical Illness (CI)', defaultRate: 0.85 },
                    { code: 'GL_MED', name: 'Group Repatriation & Evacuation Benefit', defaultRate: 0.20 }
                  ].map((r) => {
                    const isChecked = selectedRiders[r.code]?.selected || false;
                    const pct = selectedRiders[r.code]?.percent || 100;
                    const rate = selectedRiders[r.code]?.rate || r.defaultRate;

                    return (
                      <div
                        key={r.code}
                        className={`p-4 rounded-xl border transition-all ${
                          isChecked ? 'border-teal-500 bg-teal-50/20' : 'border-slate-200 bg-slate-50/40'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setSelectedRiders({
                                  ...selectedRiders,
                                  [r.code]: { selected: e.target.checked, percent: pct, rate }
                                });
                              }}
                              className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                            />
                            <div>
                              <div className="text-xs font-bold text-navy">{r.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">Code: {r.code}</div>
                            </div>
                          </label>
                        </div>

                        {isChecked && (
                          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">SA % of Basic</label>
                              <input
                                type="number"
                                min="10"
                                max="100"
                                step="10"
                                value={pct}
                                onChange={(e) => {
                                  setSelectedRiders({
                                    ...selectedRiders,
                                    [r.code]: { ...selectedRiders[r.code], percent: Number(e.target.value) }
                                  });
                                }}
                                className="w-full border border-slate-200 rounded px-2 py-1 font-bold text-slate-700"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Rate per 1,000 SA</label>
                              <input
                                type="number"
                                min="0.05"
                                max="10"
                                step="0.05"
                                value={rate}
                                onChange={(e) => {
                                  setSelectedRiders({
                                    ...selectedRiders,
                                    [r.code]: { ...selectedRiders[r.code], rate: Number(e.target.value) }
                                  });
                                }}
                                className="w-full border border-slate-200 rounded px-2 py-1 font-bold text-teal-700"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rating Parameters */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-xs font-extrabold text-navy uppercase tracking-wider mb-3">Group Actuarial Parameters</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <label className="block text-xs font-bold text-navy mb-1">Base Mortality Rate per Mille (‰) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="20"
                      value={baseRatePerMille}
                      onChange={(e) => setBaseRatePerMille(Number(e.target.value))}
                      className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 font-bold text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                    <span className="text-[10px] text-slate-400">Standard corporate term life mortality tariff per 1,000 Sum Assured.</span>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <label className="block text-xs font-bold text-navy mb-1">Corporate Experience Discount %</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="35"
                      value={experienceDiscountPct}
                      onChange={(e) => setExperienceDiscountPct(Number(e.target.value))}
                      className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 font-bold text-purple-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                    <span className="text-[10px] text-slate-400">Discount granted based on favorable employer claims loss-ratio history.</span>
                  </div>
                </div>
              </div>

              {/* Step Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await runActuarialCalculation();
                    setWizardStep(4);
                  }}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors shadow-xs"
                >
                  <span>Review & Calculate Summary</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Actuarial Review & Quote Finalization */}
          {wizardStep === 4 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-extrabold text-navy">Step 4: Actuarially Certified Group Life Quotation Summary</h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Review corporate census metrics, riders premium breakdown, installment modal factors, and official acceptance terms.
                </p>
              </div>

              {calcResult && (
                <div className="space-y-6">
                  {/* Top Actuarial Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Members Covered</span>
                      <p className="text-2xl font-black text-navy mt-1">{calcResult.totalMembers}</p>
                      <span className="text-[10px] text-slate-400">Total Enrolled Census</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Total Sum Assured</span>
                      <p className="text-xl font-black text-navy mt-1 truncate">
                        {calcResult.totalSumAssured.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <span className="text-[10px] text-slate-400">Basic Life Exposure (OMR)</span>
                    </div>

                    <div className="p-4 rounded-xl bg-teal-50 border border-teal-200">
                      <span className="text-[11px] font-bold text-teal-800 uppercase">Total Annual Premium</span>
                      <p className="text-xl font-black text-teal-700 mt-1 truncate">
                        {calcResult.totalAnnualPremium.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <span className="text-[10px] text-teal-600 font-semibold">Net of Experience Discount</span>
                    </div>

                    <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                      <span className="text-[11px] font-bold text-purple-800 uppercase">
                        Installment ({calcResult.payFreq})
                      </span>
                      <p className="text-xl font-black text-purple-700 mt-1 truncate">
                        {calcResult.installmentPremium.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <span className="text-[10px] text-purple-600 font-semibold">Modal Factor: {calcResult.modalFactor}</span>
                    </div>
                  </div>

                  {/* Detailed Premium Breakdown */}
                  <div className="bg-slate-50/70 rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200/60 font-semibold text-slate-600">
                      <span>Basic Term Life Gross Premium:</span>
                      <span className="font-bold text-slate-800">
                        OMR {calcResult.totalBasicPremiumGross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {calcResult.experienceDiscountPct > 0 && (
                      <div className="flex justify-between py-1 border-b border-slate-200/60 font-semibold text-emerald-700">
                        <span>Corporate Experience Discount ({calcResult.experienceDiscountPct}%):</span>
                        <span className="font-bold">
                          - OMR {calcResult.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between py-1 border-b border-slate-200/60 font-semibold text-slate-700">
                      <span>Basic Term Life Net Premium:</span>
                      <span className="font-bold text-navy">
                        OMR {calcResult.totalBasicPremium.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {calcResult.riders.map((r) => (
                      <div key={r.RIDER_CODE} className="flex justify-between py-1 border-b border-slate-200/60 text-slate-600">
                        <span>{r.RIDER_NAME} ({r.SA_PERCENT}% SA, {r.RIDER_RATE_PER_MILLE}‰):</span>
                        <span className="font-bold text-slate-800">
                          OMR {r.RIDER_PREMIUM.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}

                    <div className="flex justify-between py-2 text-sm font-extrabold text-navy border-t border-slate-300">
                      <span>Certified Total Annual Payable:</span>
                      <span className="text-teal-700 font-black">
                        OMR {calcResult.totalAnnualPremium.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveQuotation}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors shadow-xs"
                  >
                    <FileCheck2 className="w-4 h-4" />
                    <span>{actionLoading ? 'Saving...' : 'Save & Issue Official Quotation'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: GROUP MASTER POLICIES REGISTER */}
      {/* ========================================================================= */}
      {activeTab === 'policies' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Filters & Actions */}
          <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Master Policy No, Sponsor, Quote No..."
                  value={policySearch}
                  onChange={(e) => setPolicySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Status:</span>
              <select
                value={policyStatusFilter}
                onChange={(e) => setPolicyStatusFilter(e.target.value)}
                className="text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
                <option value="APPROVED">APPROVED</option>
                <option value="IN_FORCE">IN_FORCE</option>
              </select>
            </div>
          </div>

          {/* Policies Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Master Policy No</th>
                  <th className="py-3 px-4">Corporate Sponsor</th>
                  <th className="py-3 px-4">Inception & Expiry</th>
                  <th className="py-3 px-4 text-center">Census</th>
                  <th className="py-3 px-4 text-right">Inforce SA (OMR)</th>
                  <th className="py-3 px-4 text-right">Total Premium</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPolicies.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold">No Group Life Master Policies found</p>
                      <p className="text-[11px] mt-0.5">Convert a finalized Group Quote to generate a Master Policy.</p>
                    </td>
                  </tr>
                ) : (
                  filteredPolicies.map((p) => (
                    <tr key={p.GL_POL_ID} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-navy whitespace-nowrap">
                        {p.MASTER_POLICY_NO}
                        <div className="text-[10px] text-slate-400 font-normal">From Quote: {p.GL_QUOTE_NO}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{p.CORP_NAME}</div>
                        <div className="text-[11px] text-slate-400">{p.CORP_CONTACT_PERSON || 'N/A'}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-700">{p.POLICY_INCEPTION_DATE}</span>
                        <div className="text-[10px] text-slate-400">Renewal: {p.POLICY_RENEWAL_DATE}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
                          <Users className="w-3 h-3" />
                          {p.TOTAL_ACTIVE_MEMBERS}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-navy whitespace-nowrap">
                        {Number(p.TOTAL_INFORCE_SA).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-teal-700 whitespace-nowrap">
                        {Number(p.TOTAL_INFORCE_PREMIUM).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        <div className="text-[10px] text-slate-400 font-normal">{p.POL_PAY_FREQ}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {p.POL_STATUS === 'APPROVED' || p.POL_STATUS === 'IN_FORCE' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {p.POL_STATUS}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                            PENDING APPROVAL
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              const detail = await groupLifeService.getPolicyByNo(p.MASTER_POLICY_NO);
                              setSelectedPolicy(detail);
                              setActiveTab('schedule');
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-navy hover:bg-slate-100 transition-colors"
                            title="View Policy Schedule"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {p.POL_STATUS === 'PENDING_APPROVAL' && (
                            <button
                              type="button"
                              onClick={() => handleApprovePolicy(p.MASTER_POLICY_NO)}
                              disabled={actionLoading}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition-colors shadow-xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: POLICY SCHEDULE & OFFICIAL CERTIFICATE VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveTab(selectedPolicy ? 'policies' : 'quotes')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-navy hover:text-teal-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Register</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print Schedule Certificate</span>
            </button>
          </div>

          {/* Master Policy Schedule Card */}
          {selectedPolicy && (
            <div className="bg-white rounded-2xl border-2 border-slate-300 p-8 shadow-md space-y-6 print:border-none print:shadow-none">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-navy pb-4 gap-4">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-widest text-teal-600">
                    KINS Enterprise Life Insurance Core System
                  </span>
                  <h2 className="text-2xl font-black text-navy uppercase tracking-tight">
                    Group Life Master Policy Schedule
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Corporate Employer Sponsor Life & Disability Assurance Contract
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-slate-500 uppercase">Policy Number</div>
                  <div className="text-lg font-black text-navy">{selectedPolicy.master.MASTER_POLICY_NO}</div>
                  <div className="text-[11px] font-semibold text-teal-700">Status: {selectedPolicy.master.POL_STATUS}</div>
                </div>
              </div>

              {/* Master Policy Parameters Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400 font-bold block">Corporate Sponsor:</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedPolicy.master.CORP_NAME}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Inception Date:</span>
                  <span className="font-bold text-slate-800">{selectedPolicy.master.POLICY_INCEPTION_DATE}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Renewal Date:</span>
                  <span className="font-bold text-slate-800">{selectedPolicy.master.POLICY_RENEWAL_DATE}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Free Cover Limit:</span>
                  <span className="font-bold text-navy">
                    OMR {Number(selectedPolicy.master.FREE_COVER_LIMIT).toLocaleString('en-US')}
                  </span>
                </div>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-3 gap-4 border border-slate-200 rounded-xl p-4 text-center">
                <div>
                  <div className="text-xs text-slate-500 font-semibold">Active Members Covered</div>
                  <div className="text-xl font-black text-navy mt-0.5">{selectedPolicy.master.TOTAL_ACTIVE_MEMBERS}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-semibold">Total In-Force Sum Assured</div>
                  <div className="text-xl font-black text-teal-700 mt-0.5">
                    OMR {Number(selectedPolicy.master.TOTAL_INFORCE_SA).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-semibold">Annualized In-Force Premium</div>
                  <div className="text-xl font-black text-purple-700 mt-0.5">
                    OMR {Number(selectedPolicy.master.TOTAL_INFORCE_PREMIUM).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Attached Riders Schedule */}
              {selectedPolicy.riders.length > 0 && (
                <div>
                  <h3 className="text-xs font-black text-navy uppercase tracking-wider mb-2">Attached Supplementary Benefits & Riders</h3>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500">
                        <tr>
                          <th className="py-2 px-3">Rider Code</th>
                          <th className="py-2 px-3">Benefit Name</th>
                          <th className="py-2 px-3 text-right">Rider Sum Assured (OMR)</th>
                          <th className="py-2 px-3 text-right">Annual Premium (OMR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedPolicy.riders.map((r) => (
                          <tr key={r.RIDER_ID}>
                            <td className="py-2 px-3 font-mono font-bold text-navy">{r.RIDER_CODE}</td>
                            <td className="py-2 px-3 font-semibold text-slate-700">{r.RIDER_NAME}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-800">
                              {Number(r.TOTAL_RIDER_SA).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-teal-700">
                              {Number(r.RIDER_PREMIUM).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Enrolled Employee Census Schedule */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <h3 className="text-xs font-black text-navy uppercase tracking-wider">
                    Enrolled Insured Employee Census Roster ({selectedPolicy.members.length} Members)
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleOpenUploadForPolicy(selectedPolicy.master.MASTER_POLICY_NO)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold hover:bg-teal-100 transition-colors shadow-xs"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload & Enroll Members</span>
                  </button>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Emp ID</th>
                        <th className="py-2 px-3">Employee Name</th>
                        <th className="py-2 px-3">DOB</th>
                        <th className="py-2 px-3 text-center">Age / Gen</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3 text-right">Monthly Sal (OMR)</th>
                        <th className="py-2 px-3 text-right">Sum Assured (OMR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedPolicy.members.map((m) => (
                        <tr key={m.MEMBER_ID} className="hover:bg-slate-50/50">
                          <td className="py-1.5 px-3 font-mono font-bold text-navy">{m.EMP_ID}</td>
                          <td className="py-1.5 px-3 font-semibold text-slate-800">{m.MEMBER_NAME}</td>
                          <td className="py-1.5 px-3 text-slate-600">{m.DOB}</td>
                          <td className="py-1.5 px-3 text-center">{m.AGE} / {m.GENDER}</td>
                          <td className="py-1.5 px-3">{m.CATEGORY}</td>
                          <td className="py-1.5 px-3 text-right font-semibold text-slate-700">
                            {Number(m.MONTHLY_SALARY).toLocaleString('en-US')}
                          </td>
                          <td className="py-1.5 px-3 text-right font-black text-navy">
                            {Number(m.SUM_ASSURED).toLocaleString('en-US')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Underwriting Approval & Signatures */}
              <div className="pt-6 border-t-2 border-slate-200 grid grid-cols-2 gap-8 text-xs">
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase">Underwriting & Policy Authorization</div>
                  <div className="mt-2 text-slate-800">
                    <p className="font-bold">Authorized Signatory: {selectedPolicy.master.POL_APPROVED_BY || 'Pending Underwriter Approval'}</p>
                    <p className="text-[11px] text-slate-500">Date: {selectedPolicy.master.POL_APPROVED_ON || 'Pending'}</p>
                    {selectedPolicy.master.POL_APPROVAL_REMARKS && (
                      <p className="text-[11px] text-emerald-700 mt-1 italic">Remarks: {selectedPolicy.master.POL_APPROVAL_REMARKS}</p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">Employer Sponsor Acceptance</div>
                  <div className="mt-2 text-slate-800">
                    <p className="font-bold">{selectedPolicy.master.CORP_CONTACT_PERSON || selectedPolicy.master.CORP_NAME}</p>
                    <p className="text-[11px] text-slate-500">Official Seal & Corporate Signature</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quote Certificate Schedule Card if Quote selected */}
          {!selectedPolicy && selectedQuote && (
            <div className="bg-white rounded-2xl border-2 border-slate-300 p-8 shadow-md space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-teal-600 pb-4 gap-4">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-widest text-teal-600">
                    KINS Enterprise Life Insurance Core System
                  </span>
                  <h2 className="text-2xl font-black text-navy uppercase tracking-tight">
                    Group Life Quotation Certificate
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Corporate Group Life & Disability Insurance Actuarial Quotation
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-slate-500 uppercase">Quotation Number</div>
                  <div className="text-lg font-black text-teal-700">{selectedQuote.header.GL_QUOTE_NO}</div>
                  <div className="text-[11px] font-semibold text-slate-600">Status: {selectedQuote.header.STATUS}</div>
                </div>
              </div>

              {/* Quote Parameters Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-teal-50/50 p-4 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400 font-bold block">Corporate Sponsor:</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedQuote.header.CORP_NAME}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Quotation Date:</span>
                  <span className="font-bold text-slate-800">{selectedQuote.header.GL_QUOTE_DATE}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Benefit Structure:</span>
                  <span className="font-bold text-slate-800">{selectedQuote.header.BENEFIT_STRUCTURE.replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Free Cover Limit:</span>
                  <span className="font-bold text-navy">
                    OMR {Number(selectedQuote.header.FREE_COVER_LIMIT).toLocaleString('en-US')}
                  </span>
                </div>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-3 gap-4 border border-slate-200 rounded-xl p-4 text-center">
                <div>
                  <div className="text-xs text-slate-500 font-semibold">Total Employees</div>
                  <div className="text-xl font-black text-navy mt-0.5">{selectedQuote.header.TOTAL_MEMBERS}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-semibold">Total Sum Assured</div>
                  <div className="text-xl font-black text-teal-700 mt-0.5">
                    OMR {Number(selectedQuote.header.TOTAL_SUM_ASSURED).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-semibold">Annual Payable Premium</div>
                  <div className="text-xl font-black text-purple-700 mt-0.5">
                    OMR {Number(selectedQuote.header.TOTAL_ANNUAL_PREMIUM).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Convert button if not converted */}
              {selectedQuote.header.STATUS !== 'CONVERTED' && (
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleConvertToMasterPolicy(selectedQuote.header.GL_QUOTE_NO)}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 transition-colors shadow-xs"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Accept & Convert to Group Master Policy</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MEMBER CENSUS UPLOAD MODAL (CSV & EXCEL) */}
      {/* ========================================================================= */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200/80 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100/70 border border-teal-200 flex items-center justify-center text-teal-700">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-navy">
                    {uploadTargetPolicyNo
                      ? `Enroll Members into Master Policy: ${uploadTargetPolicyNo}`
                      : 'Upload Group Life Member Census Schedule'}
                  </h2>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Import member roster from Excel (<span className="font-semibold text-slate-700">.xlsx / .xls</span>) or <span className="font-semibold text-slate-700">.csv</span> with automatic column parsing.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  setUploadResult(null);
                }}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Template Download Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-teal-50/60 border border-teal-200/70 text-xs">
                <div className="flex items-center gap-2 text-teal-900">
                  <FileSpreadsheet className="w-4 h-4 text-teal-700 shrink-0" />
                  <span>
                    Need the pre-formatted template with sample columns? Download below:
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={downloadingTemplate}
                    onClick={() => handleDownloadTemplate('xlsx')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white font-bold text-[11px] hover:bg-teal-700 transition-colors shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Excel (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    disabled={downloadingTemplate}
                    onClick={() => handleDownloadTemplate('csv')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-teal-300 text-teal-800 font-bold text-[11px] hover:bg-teal-50 transition-colors shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV (.csv)</span>
                  </button>
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) processUploadedFile(file);
                }}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                  dragOver
                    ? 'border-teal-500 bg-teal-50/40 ring-4 ring-teal-500/10'
                    : 'border-slate-300 hover:border-teal-400 bg-slate-50/40'
                }`}
              >
                <input
                  type="file"
                  id="censusFileInput"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) processUploadedFile(f);
                  }}
                />

                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-teal-100/70 border border-teal-200 flex items-center justify-center text-teal-700 shadow-xs">
                    <FileUp className="w-6 h-6" />
                  </div>
                  <div>
                    <label
                      htmlFor="censusFileInput"
                      className="text-xs font-bold text-teal-700 hover:text-teal-800 hover:underline cursor-pointer"
                    >
                      Click to choose a file
                    </label>
                    <span className="text-xs text-slate-500"> or drag and drop your spreadsheet here</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv) up to 10MB
                  </p>
                </div>
              </div>

              {/* Processing Loader */}
              {isParsing && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center gap-3 text-xs font-bold text-slate-700">
                  <RefreshCw className="w-4 h-4 text-teal-600 animate-spin" />
                  <span>Reading file, validating columns, and calculating age ratings...</span>
                </div>
              )}

              {/* Uploaded File Details & Analysis Badges */}
              {uploadFile && uploadResult && !isParsing && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-teal-600" />
                      <span className="text-xs font-bold text-slate-800">{uploadFile.name}</span>
                      <span className="text-[11px] text-slate-400">
                        ({(uploadFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>

                    <label
                      htmlFor="censusFileInput"
                      className="text-[11px] font-bold text-teal-700 hover:underline cursor-pointer self-start sm:self-auto"
                    >
                      Change File
                    </label>
                  </div>

                  {/* Summary Counters */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Total Rows</span>
                      <p className="text-xl font-black text-navy mt-0.5">{uploadResult.totalRows}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[10px] uppercase font-bold text-emerald-800">Valid Members</span>
                      <p className="text-xl font-black text-emerald-700 mt-0.5">{uploadResult.validRowsCount}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                      <span className="text-[10px] uppercase font-bold text-amber-800">Warnings</span>
                      <p className="text-xl font-black text-amber-700 mt-0.5">{uploadResult.warningRowsCount}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                      <span className="text-[10px] uppercase font-bold text-rose-800">Errors</span>
                      <p className="text-xl font-black text-rose-700 mt-0.5">{uploadResult.errorRowsCount}</p>
                    </div>
                  </div>

                  {/* Errors Alert if any */}
                  {uploadResult.errors.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-rose-800">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Identified {uploadResult.errors.length} row validation issue(s):</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-700 max-h-24 overflow-y-auto pl-1">
                        {uploadResult.errors.map((e, idx) => (
                          <li key={idx}>
                            Row {e.row} {e.empId ? `(${e.empId})` : ''}: {e.message}
                          </li>
                        ))}
                      </ul>
                      <p className="text-[10px] text-rose-600 font-semibold pt-1">
                        * Note: Rows with critical errors will be omitted; only valid members will be imported.
                      </p>
                    </div>
                  )}

                  {/* Preview Table */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-black text-navy uppercase tracking-wider">
                        Parsed Members Preview (Showing {uploadResult.members.length} rows)
                      </h3>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Green: Valid | Amber: Warning | Red: Error
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 sticky top-0">
                          <tr>
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-3">Emp ID</th>
                            <th className="py-2 px-3">Name</th>
                            <th className="py-2 px-3">DOB</th>
                            <th className="py-2 px-3 text-center">Age / Gen</th>
                            <th className="py-2 px-3">Category</th>
                            <th className="py-2 px-3 text-right">Monthly Sal (OMR)</th>
                            <th className="py-2 px-3 text-right">Sum Assured (OMR)</th>
                            <th className="py-2 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {uploadResult.members.map((m, idx) => (
                            <tr
                              key={idx}
                              className={`hover:bg-slate-50/50 ${
                                m.status === 'ERROR'
                                  ? 'bg-rose-50/30'
                                  : m.status === 'WARNING'
                                  ? 'bg-amber-50/20'
                                  : ''
                              }`}
                            >
                              <td className="py-1.5 px-3 font-mono text-[11px] text-slate-400">{m.rowNumber}</td>
                              <td className="py-1.5 px-3 font-mono font-bold text-navy">{m.empId || 'N/A'}</td>
                              <td className="py-1.5 px-3 font-semibold text-slate-800">{m.memberName}</td>
                              <td className="py-1.5 px-3 text-slate-600">{m.dob || 'N/A'}</td>
                              <td className="py-1.5 px-3 text-center">
                                {m.age} / {m.gender}
                              </td>
                              <td className="py-1.5 px-3">{m.category}</td>
                              <td className="py-1.5 px-3 text-right font-semibold text-slate-700">
                                {Number(m.monthlySalary || 0).toLocaleString('en-US')}
                              </td>
                              <td className="py-1.5 px-3 text-right font-black text-navy">
                                {m.sumAssured ? Number(m.sumAssured).toLocaleString('en-US') : 'Auto (Formula)'}
                              </td>
                              <td className="py-1.5 px-3 text-center">
                                {m.status === 'VALID' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    VALID
                                  </span>
                                )}
                                {m.status === 'WARNING' && (
                                  <span
                                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200"
                                    title={m.validationMessage}
                                  >
                                    WARNING
                                  </span>
                                )}
                                {m.status === 'ERROR' && (
                                  <span
                                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200"
                                    title={m.validationMessage}
                                  >
                                    ERROR
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Import Mode Options (only when in wizard census) */}
                  {!uploadTargetPolicyNo && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <span className="text-xs font-bold text-navy uppercase tracking-wider block">
                        Census Import Strategy:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <label
                          className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                            importMode === 'replace'
                              ? 'border-teal-500 bg-teal-50/60 ring-2 ring-teal-500/10'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === 'replace'}
                            onChange={() => setImportMode('replace')}
                            className="mt-0.5 text-teal-600 focus:ring-teal-500"
                          />
                          <div>
                            <span className="font-bold text-slate-800 block">Replace Existing Census</span>
                            <span className="text-[11px] text-slate-500">
                              Clears current roster ({memberRoster.length} members) and sets newly uploaded records.
                            </span>
                          </div>
                        </label>

                        <label
                          className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                            importMode === 'append'
                              ? 'border-teal-500 bg-teal-50/60 ring-2 ring-teal-500/10'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === 'append'}
                            onChange={() => setImportMode('append')}
                            className="mt-0.5 text-teal-600 focus:ring-teal-500"
                          />
                          <div>
                            <span className="font-bold text-slate-800 block">Append to Existing Census</span>
                            <span className="text-[11px] text-slate-500">
                              Preserves current {memberRoster.length} members and appends the uploaded valid rows.
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-slate-200/80 bg-slate-50/70">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  setUploadResult(null);
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={
                  isParsing ||
                  isUploading ||
                  !uploadResult ||
                  uploadResult.members.filter((m) => m.status !== 'ERROR').length === 0
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>
                      {uploadTargetPolicyNo
                        ? `Enroll ${
                            uploadResult
                              ? uploadResult.members.filter((m) => m.status !== 'ERROR').length
                              : 0
                          } Members into Policy`
                        : `Confirm & Import ${
                            uploadResult
                              ? uploadResult.members.filter((m) => m.status !== 'ERROR').length
                              : 0
                          } Members`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
