import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Users,
  ShieldCheck,
  Search,
  Download,
  RefreshCw,
  Layers,
  Table2,
  ListFilter,
  Award,
  DollarSign,
  FileSpreadsheet,
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { groupLifeService } from '../services/groupLifeService';
import {
  GLPolicyMasterRecord,
  GLQuoteHeaderRecord,
  GLPolicyDetail,
  GLQuoteDetail,
  GLMemberCoverRecord
} from '../types/groupLife';

interface GroupLifeMemberPremiumsProps {
  policies: GLPolicyMasterRecord[];
  quotes: GLQuoteHeaderRecord[];
  initialSourceType?: 'policy' | 'quote';
  initialSourceNo?: string;
}

export const GroupLifeMemberPremiums: React.FC<GroupLifeMemberPremiumsProps> = ({
  policies,
  quotes,
  initialSourceType = 'policy',
  initialSourceNo
}) => {
  const [sourceType, setSourceType] = useState<'policy' | 'quote'>(initialSourceType);
  const [selectedNo, setSelectedNo] = useState<string>(initialSourceNo || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [policyDetail, setPolicyDetail] = useState<GLPolicyDetail | null>(null);
  const [quoteDetail, setQuoteDetail] = useState<GLQuoteDetail | null>(null);

  // Filters & view state
  const [viewMode, setViewMode] = useState<'matrix' | 'ledger'>('matrix');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [coverFilter, setCoverFilter] = useState<string>('ALL');
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);

  // Sync if parent navigates here with a specific policy/quote
  useEffect(() => {
    if (initialSourceNo) {
      setSourceType(initialSourceType);
      setSelectedNo(initialSourceNo);
    } else if (!selectedNo) {
      if (sourceType === 'policy' && policies.length > 0) {
        setSelectedNo(policies[0].MASTER_POLICY_NO);
      } else if (sourceType === 'quote' && quotes.length > 0) {
        setSelectedNo(quotes[0].GL_QUOTE_NO);
      }
    }
  }, [initialSourceType, initialSourceNo, policies, quotes]);

  // When switching between policy and quote tabs, auto-pick first available
  const handleSourceTypeChange = (type: 'policy' | 'quote') => {
    setSourceType(type);
    setCoverFilter('ALL');
    setCategoryFilter('ALL');
    setExpandedEmpId(null);
    if (type === 'policy') {
      setSelectedNo(policies.length > 0 ? policies[0].MASTER_POLICY_NO : '');
    } else {
      setSelectedNo(quotes.length > 0 ? quotes[0].GL_QUOTE_NO : '');
    }
  };

  // Fetch member-coverwise breakdown from DB
  const fetchBreakdown = async (type: 'policy' | 'quote', refNo: string) => {
    if (!refNo) {
      setPolicyDetail(null);
      setQuoteDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (type === 'policy') {
        const d = await groupLifeService.getPolicyMemberCovers(refNo);
        setPolicyDetail(d);
        setQuoteDetail(null);
      } else {
        const d = await groupLifeService.getQuoteMemberCovers(refNo);
        setQuoteDetail(d);
        setPolicyDetail(null);
      }
    } catch (err: any) {
      console.error('Failed to load member cover-wise premiums:', err);
      setError(err.message || 'Failed to load member cover-wise premium breakdown');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedNo) {
      fetchBreakdown(sourceType, selectedNo);
    }
  }, [sourceType, selectedNo]);

  // Unified data extraction
  const memberCovers: GLMemberCoverRecord[] = useMemo(() => {
    if (sourceType === 'policy') return policyDetail?.memberCovers || [];
    return quoteDetail?.memberCovers || [];
  }, [sourceType, policyDetail, quoteDetail]);

  const membersList = useMemo(() => {
    if (sourceType === 'policy') return policyDetail?.members || [];
    return quoteDetail?.members || [];
  }, [sourceType, policyDetail, quoteDetail]);

  const corpName = useMemo(() => {
    if (sourceType === 'policy') return policyDetail?.master.CORP_NAME || '';
    return quoteDetail?.header.CORP_NAME || '';
  }, [sourceType, policyDetail, quoteDetail]);

  const statusBadge = useMemo(() => {
    if (sourceType === 'policy') return policyDetail?.master.POL_STATUS || '';
    return quoteDetail?.header.STATUS || '';
  }, [sourceType, policyDetail, quoteDetail]);

  // Distinct covers in order (BASIC first, then riders)
  const distinctCovers = useMemo(() => {
    const map = new Map<string, { code: string; name: string; type: 'BASIC' | 'RIDER'; totalSa: number; totalNet: number; totalGross: number; totalDisc: number }>();
    for (const c of memberCovers) {
      const existing = map.get(c.COVER_CODE);
      if (existing) {
        existing.totalSa += Number(c.COVER_SUM_ASSURED || 0);
        existing.totalNet += Number(c.NET_PREMIUM || 0);
        existing.totalGross += Number(c.GROSS_PREMIUM || 0);
        existing.totalDisc += Number(c.DISCOUNT_AMOUNT || 0);
      } else {
        map.set(c.COVER_CODE, {
          code: c.COVER_CODE,
          name: c.COVER_NAME,
          type: c.COVER_TYPE,
          totalSa: Number(c.COVER_SUM_ASSURED || 0),
          totalNet: Number(c.NET_PREMIUM || 0),
          totalGross: Number(c.GROSS_PREMIUM || 0),
          totalDisc: Number(c.DISCOUNT_AMOUNT || 0)
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.type === 'BASIC' ? -1 : b.type === 'BASIC' ? 1 : a.code.localeCompare(b.code)));
  }, [memberCovers]);

  // Distinct staff categories
  const distinctCategories = useMemo(() => {
    const set = new Set<string>();
    membersList.forEach((m) => {
      if (m.CATEGORY) set.add(m.CATEGORY);
    });
    return Array.from(set).sort();
  }, [membersList]);

  // Build pivot matrix rows (one per employee)
  const matrixRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return membersList
      .filter((m) => {
        const matchCat = categoryFilter === 'ALL' || (m.CATEGORY || '').toLowerCase() === categoryFilter.toLowerCase();
        const matchSearch =
          !q ||
          (m.EMP_ID || '').toLowerCase().includes(q) ||
          (m.MEMBER_NAME || '').toLowerCase().includes(q) ||
          (m.CATEGORY || '').toLowerCase().includes(q);
        return matchCat && matchSearch;
      })
      .map((m) => {
        const covs = memberCovers.filter(
          (c) => (c.MEMBER_ID && m.MEMBER_ID && c.MEMBER_ID === m.MEMBER_ID) || c.EMP_ID === m.EMP_ID
        );
        const byCover: Record<string, GLMemberCoverRecord> = {};
        let totalGross = 0;
        let totalDisc = 0;
        let totalNet = 0;

        for (const cov of covs) {
          byCover[cov.COVER_CODE] = cov;
          totalGross += Number(cov.GROSS_PREMIUM || 0);
          totalDisc += Number(cov.DISCOUNT_AMOUNT || 0);
          totalNet += Number(cov.NET_PREMIUM || 0);
        }

        return {
          member: m,
          covers: covs,
          byCover,
          totalGross: Math.round(totalGross * 100) / 100,
          totalDisc: Math.round(totalDisc * 100) / 100,
          totalNet: Math.round(totalNet * 100) / 100
        };
      });
  }, [membersList, memberCovers, searchQuery, categoryFilter]);

  // Filtered flat ledger rows
  const ledgerRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return memberCovers.filter((c) => {
      const matchCov = coverFilter === 'ALL' || c.COVER_CODE === coverFilter;
      const matchCat = categoryFilter === 'ALL' || (c.CATEGORY || '').toLowerCase() === categoryFilter.toLowerCase();
      const matchSearch =
        !q ||
        (c.EMP_ID || '').toLowerCase().includes(q) ||
        (c.MEMBER_NAME || '').toLowerCase().includes(q) ||
        (c.COVER_CODE || '').toLowerCase().includes(q) ||
        (c.COVER_NAME || '').toLowerCase().includes(q);
      return matchCov && matchCat && matchSearch;
    });
  }, [memberCovers, coverFilter, categoryFilter, searchQuery]);

  // Totals for filtered matrix
  const matrixTotals = useMemo(() => {
    const coverSums: Record<string, number> = {};
    distinctCovers.forEach((c) => (coverSums[c.code] = 0));
    let totalSa = 0;
    let totalGross = 0;
    let totalDisc = 0;
    let totalNet = 0;

    matrixRows.forEach((r) => {
      totalSa += Number(r.member.SUM_ASSURED || 0);
      totalGross += r.totalGross;
      totalDisc += r.totalDisc;
      totalNet += r.totalNet;
      distinctCovers.forEach((c) => {
        coverSums[c.code] += Number(r.byCover[c.code]?.NET_PREMIUM || 0);
      });
    });

    return {
      totalSa,
      totalGross: Math.round(totalGross * 100) / 100,
      totalDisc: Math.round(totalDisc * 100) / 100,
      totalNet: Math.round(totalNet * 100) / 100,
      coverSums
    };
  }, [matrixRows, distinctCovers]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const basicNet = distinctCovers.filter((c) => c.type === 'BASIC').reduce((acc, c) => acc + c.totalNet, 0);
    const riderNet = distinctCovers.filter((c) => c.type === 'RIDER').reduce((acc, c) => acc + c.totalNet, 0);
    const grandTotal = Math.round((basicNet + riderNet) * 100) / 100;
    const totalSa = membersList.reduce((acc, m) => acc + Number(m.SUM_ASSURED || 0), 0);
    return {
      totalMembers: membersList.length,
      totalSa,
      basicNet: Math.round(basicNet * 100) / 100,
      riderNet: Math.round(riderNet * 100) / 100,
      grandTotal
    };
  }, [distinctCovers, membersList]);

  // Export to Excel (2 sheets: Matrix + Detailed Ledger)
  const handleExportExcel = () => {
    if (!selectedNo || matrixRows.length === 0) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Member x Cover Matrix
    const matrixHeaders = [
      'EMP_ID',
      'MEMBER_NAME',
      'AGE',
      'GENDER',
      'CATEGORY',
      'BASIC_SUM_ASSURED',
      ...distinctCovers.map((c) => `${c.code} (${c.name})`),
      'TOTAL_GROSS_PREMIUM',
      'TOTAL_DISCOUNT',
      'TOTAL_NET_PREMIUM'
    ];

    const matrixData = matrixRows.map((r) => [
      r.member.EMP_ID,
      r.member.MEMBER_NAME,
      r.member.AGE,
      r.member.GENDER,
      r.member.CATEGORY || 'STAFF',
      Number(r.member.SUM_ASSURED || 0),
      ...distinctCovers.map((c) => Number(r.byCover[c.code]?.NET_PREMIUM || 0)),
      r.totalGross,
      r.totalDisc,
      r.totalNet
    ]);

    matrixData.push([
      'TOTAL',
      `${matrixRows.length} Members`,
      '',
      '',
      '',
      matrixTotals.totalSa,
      ...distinctCovers.map((c) => Math.round((matrixTotals.coverSums[c.code] || 0) * 100) / 100),
      matrixTotals.totalGross,
      matrixTotals.totalDisc,
      matrixTotals.totalNet
    ]);

    const wsMatrix = XLSX.utils.aoa_to_sheet([matrixHeaders, ...matrixData]);
    XLSX.utils.book_append_sheet(wb, wsMatrix, 'Member Cover Matrix');

    // Sheet 2: Detailed Cover-wise Ledger
    const ledgerHeaders = [
      'REF_NO',
      'EMP_ID',
      'MEMBER_NAME',
      'AGE',
      'GENDER',
      'CATEGORY',
      'COVER_CODE',
      'COVER_NAME',
      'COVER_TYPE',
      'SA_PERCENT',
      'COVER_SUM_ASSURED',
      'RATE_PER_MILLE',
      'GROSS_PREMIUM',
      'DISCOUNT_AMOUNT',
      'NET_PREMIUM'
    ];
    const ledgerData = ledgerRows.map((c) => [
      selectedNo,
      c.EMP_ID,
      c.MEMBER_NAME || '',
      c.AGE || '',
      c.GENDER || '',
      c.CATEGORY || '',
      c.COVER_CODE,
      c.COVER_NAME,
      c.COVER_TYPE,
      Number(c.SA_PERCENT || 100),
      Number(c.COVER_SUM_ASSURED || 0),
      Number(c.RATE_PER_MILLE || 0),
      Number(c.GROSS_PREMIUM || 0),
      Number(c.DISCOUNT_AMOUNT || 0),
      Number(c.NET_PREMIUM || 0)
    ]);

    const wsLedger = XLSX.utils.aoa_to_sheet([ledgerHeaders, ...ledgerData]);
    XLSX.utils.book_append_sheet(wb, wsLedger, 'Coverwise Detail Ledger');

    XLSX.writeFile(wb, `${selectedNo}_Member_Coverwise_Premiums.xlsx`);
  };

  return (
    <div className="space-y-5">
      {/* Top Selection Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-navy flex items-center gap-2">
              <Layers className="w-5 h-5 text-teal-600" />
              <span>Member-wise &amp; Cover-wise Premium Breakdown</span>
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Inspect stored database premiums for every insured employee broken down by Basic Life and each attached Group Rider cover.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Source Type Toggle */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => handleSourceTypeChange('policy')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  sourceType === 'policy'
                    ? 'bg-navy text-white shadow-xs'
                    : 'text-slate-600 hover:text-navy'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Master Policies ({policies.length})</span>
              </button>
              <button
                type="button"
                onClick={() => handleSourceTypeChange('quote')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  sourceType === 'quote'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-teal-700'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Quotations ({quotes.length})</span>
              </button>
            </div>

            {/* Policy / Quote Dropdown */}
            <select
              value={selectedNo}
              onChange={(e) => setSelectedNo(e.target.value)}
              className="text-xs font-bold text-navy rounded-lg border border-slate-300 px-3 py-2 bg-white min-w-[260px] focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              {sourceType === 'policy' ? (
                policies.length === 0 ? (
                  <option value="">No Master Policies available</option>
                ) : (
                  policies.map((p) => (
                    <option key={p.MASTER_POLICY_NO} value={p.MASTER_POLICY_NO}>
                      {p.MASTER_POLICY_NO} — {p.CORP_NAME} ({p.TOTAL_ACTIVE_MEMBERS} members)
                    </option>
                  ))
                )
              ) : quotes.length === 0 ? (
                <option value="">No Quotations available</option>
              ) : (
                quotes.map((q) => (
                  <option key={q.GL_QUOTE_NO} value={q.GL_QUOTE_NO}>
                    {q.GL_QUOTE_NO} — {q.CORP_NAME} ({q.TOTAL_MEMBERS} members)
                  </option>
                ))
              )}
            </select>

            <button
              type="button"
              onClick={() => selectedNo && fetchBreakdown(sourceType, selectedNo)}
              disabled={loading || !selectedNo}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Reload</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={!selectedNo || matrixRows.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Selected Policy/Quote Context Banner */}
        {selectedNo && corpName && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500">Corporate Sponsor:</span>
              <span className="font-extrabold text-navy">{corpName}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                {selectedNo}
              </span>
              {statusBadge && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {statusBadge}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400">
              Source Table:{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                {sourceType === 'policy' ? 'T_GL_POLICY_MEMBER_COVER' : 'T_GL_QUOTE_MEMBER_COVER'}
              </code>
            </div>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Summary Cards */}
      {selectedNo && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Covered Members</span>
              <Users className="w-4 h-4 text-purple-600" />
            </div>
            <p className="mt-1.5 text-2xl font-black text-navy">{kpis.totalMembers}</p>
            <span className="text-[10px] text-slate-400">{distinctCovers.length} active covers/member</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Total Basic SA</span>
              <Award className="w-4 h-4 text-amber-600" />
            </div>
            <p className="mt-1.5 text-lg font-black text-navy truncate">
              OMR {kpis.totalSa.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] text-slate-400">Aggregate group life exposure</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Basic Life Net</span>
              <ShieldCheck className="w-4 h-4 text-blue-600" />
            </div>
            <p className="mt-1.5 text-lg font-black text-blue-700 truncate">
              OMR {kpis.basicNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] text-slate-400">Net of experience discount</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Riders Total</span>
              <Layers className="w-4 h-4 text-purple-600" />
            </div>
            <p className="mt-1.5 text-lg font-black text-purple-700 truncate">
              OMR {kpis.riderNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] text-slate-400">
              {distinctCovers.filter((c) => c.type === 'RIDER').length} supplementary riders
            </span>
          </div>

          <div className="bg-teal-50/70 rounded-xl border border-teal-200 p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-teal-800">
              <span>Grand Total Premium</span>
              <DollarSign className="w-4 h-4 text-teal-700" />
            </div>
            <p className="mt-1.5 text-lg font-black text-teal-700 truncate">
              OMR {kpis.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] text-teal-600 font-semibold">Annualized Member + Cover Sum</span>
          </div>
        </div>
      )}

      {/* Cover-wise Breakdown Strip */}
      {distinctCovers.length > 0 && !loading && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <div className="text-[11px] font-extrabold text-navy uppercase tracking-wider mb-3">
            Cover-wise Aggregate Summary
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {distinctCovers.map((cov) => (
              <div
                key={cov.code}
                className={`p-3 rounded-xl border text-xs ${
                  cov.type === 'BASIC'
                    ? 'bg-blue-50/50 border-blue-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono font-bold text-navy text-[11px]">{cov.code}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                      cov.type === 'BASIC'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {cov.type}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-slate-700 truncate mt-1" title={cov.name}>
                  {cov.name}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200/70 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Net Prem:</span>
                  <span className="font-black text-teal-700">
                    OMR {cov.totalNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Data Card (Matrix View or Detailed Cover Ledger View) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Toolbar: View Mode + Search + Filters */}
        <div className="p-4 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 self-start">
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                viewMode === 'matrix'
                  ? 'bg-navy text-white shadow-xs'
                  : 'text-slate-600 hover:text-navy'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Member &times; Cover Matrix</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('ledger')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                viewMode === 'ledger'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-teal-700'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Cover-wise Detail Ledger ({ledgerRows.length})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Emp ID, Name..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 w-48"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="ALL">All Categories</option>
              {distinctCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {viewMode === 'ledger' && (
              <select
                value={coverFilter}
                onChange={(e) => setCoverFilter(e.target.value)}
                className="text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="ALL">All Covers</option>
                {distinctCovers.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 text-teal-600 animate-spin" />
            <span className="font-semibold">Loading member cover-wise premiums from database...</span>
          </div>
        ) : !selectedNo || memberCovers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-bold text-slate-600">No member cover-wise premium records found</p>
            <p className="mt-1">Select a Master Policy or Quotation above to view employee-level cover premiums.</p>
          </div>
        ) : viewMode === 'matrix' ? (
          /* VIEW 1: MEMBER x COVER PIVOT MATRIX */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 w-8"></th>
                  <th className="py-3 px-3">Emp ID</th>
                  <th className="py-3 px-3">Employee Name</th>
                  <th className="py-3 px-3 text-center">Age / Gen</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-right">Basic SA (OMR)</th>
                  {distinctCovers.map((cov) => (
                    <th key={cov.code} className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="text-navy">{cov.code}</div>
                      <div className="text-[9px] font-medium text-slate-400 normal-case truncate max-w-[110px]" title={cov.name}>
                        {cov.name}
                      </div>
                    </th>
                  ))}
                  <th className="py-3 px-3 text-right bg-teal-50/70 text-teal-800 whitespace-nowrap">
                    Total Premium
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrixRows.map((row) => {
                  const isExpanded = expandedEmpId === row.member.EMP_ID;
                  return (
                    <React.Fragment key={`${row.member.MEMBER_ID}-${row.member.EMP_ID}`}>
                      <tr
                        onClick={() => setExpandedEmpId(isExpanded ? null : row.member.EMP_ID)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded ? 'bg-teal-50/40' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-slate-400">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-teal-600" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-navy whitespace-nowrap">
                          {row.member.EMP_ID}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                          {row.member.MEMBER_NAME}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap text-slate-600">
                          {row.member.AGE} / {row.member.GENDER}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {row.member.CATEGORY || 'Staff'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800 whitespace-nowrap">
                          {Number(row.member.SUM_ASSURED || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        {distinctCovers.map((cov) => {
                          const cell = row.byCover[cov.code];
                          return (
                            <td key={cov.code} className="py-2.5 px-3 text-right whitespace-nowrap">
                              {cell ? (
                                <span className={`font-bold ${cov.type === 'BASIC' ? 'text-blue-700' : 'text-slate-700'}`}>
                                  {Number(cell.NET_PREMIUM).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-right font-black text-teal-700 bg-teal-50/40 whitespace-nowrap">
                          {row.totalNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>

                      {/* Expandable Cover-wise Rating Detail for this Employee */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90">
                          <td colSpan={7 + distinctCovers.length} className="p-4">
                            <div className="bg-white rounded-xl border border-teal-200/80 overflow-hidden shadow-xs">
                              <div className="px-3.5 py-2 bg-teal-50/70 border-b border-teal-100 flex items-center justify-between">
                                <span className="text-[11px] font-extrabold text-navy">
                                  Detailed Cover-wise Rating Breakdown — {row.member.MEMBER_NAME} ({row.member.EMP_ID})
                                </span>
                                <span className="text-[11px] font-bold text-teal-700">
                                  Total Net Premium: OMR {row.totalNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <table className="w-full text-left text-[11px]">
                                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="py-2 px-3">Cover Code</th>
                                    <th className="py-2 px-3">Cover Name</th>
                                    <th className="py-2 px-3 text-center">Type</th>
                                    <th className="py-2 px-3 text-right">SA %</th>
                                    <th className="py-2 px-3 text-right">Cover SA (OMR)</th>
                                    <th className="py-2 px-3 text-right">Rate (&permil;)</th>
                                    <th className="py-2 px-3 text-right">Gross Premium</th>
                                    <th className="py-2 px-3 text-right">Discount</th>
                                    <th className="py-2 px-3 text-right">Net Premium</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {row.covers.map((c, idx) => (
                                    <tr key={idx}>
                                      <td className="py-1.5 px-3 font-mono font-bold text-navy">{c.COVER_CODE}</td>
                                      <td className="py-1.5 px-3 font-semibold text-slate-700">{c.COVER_NAME}</td>
                                      <td className="py-1.5 px-3 text-center">
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                            c.COVER_TYPE === 'BASIC'
                                              ? 'bg-blue-100 text-blue-800'
                                              : 'bg-purple-100 text-purple-800'
                                          }`}
                                        >
                                          {c.COVER_TYPE}
                                        </span>
                                      </td>
                                      <td className="py-1.5 px-3 text-right">{c.SA_PERCENT}%</td>
                                      <td className="py-1.5 px-3 text-right font-semibold text-slate-800">
                                        {Number(c.COVER_SUM_ASSURED).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                      </td>
                                      <td className="py-1.5 px-3 text-right font-mono text-slate-600">
                                        {Number(c.RATE_PER_MILLE).toFixed(4)}
                                      </td>
                                      <td className="py-1.5 px-3 text-right">
                                        {Number(c.GROSS_PREMIUM).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                      </td>
                                      <td className="py-1.5 px-3 text-right text-emerald-700">
                                        {Number(c.DISCOUNT_AMOUNT) > 0
                                          ? `- ${Number(c.DISCOUNT_AMOUNT).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                          : '0.00'}
                                      </td>
                                      <td className="py-1.5 px-3 text-right font-black text-teal-700">
                                        {Number(c.NET_PREMIUM).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              {/* Grand Total Footer */}
              <tfoot className="bg-slate-100/90 border-t-2 border-slate-300 font-extrabold text-navy">
                <tr>
                  <td className="py-3 px-3"></td>
                  <td colSpan={4} className="py-3 px-3 uppercase tracking-wider text-[11px]">
                    Grand Total ({matrixRows.length} Members)
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    {matrixTotals.totalSa.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  {distinctCovers.map((cov) => (
                    <td key={cov.code} className="py-3 px-3 text-right whitespace-nowrap text-navy">
                      {(matrixTotals.coverSums[cov.code] || 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </td>
                  ))}
                  <td className="py-3 px-3 text-right bg-teal-100/80 text-teal-900 text-sm font-black whitespace-nowrap">
                    OMR {matrixTotals.totalNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          /* VIEW 2: FLAT COVER-WISE DETAIL LEDGER */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3">Emp ID</th>
                  <th className="py-3 px-3">Employee Name</th>
                  <th className="py-3 px-3 text-center">Age / Gen</th>
                  <th className="py-3 px-3">Cover Code</th>
                  <th className="py-3 px-3">Cover Name</th>
                  <th className="py-3 px-3 text-center">Type</th>
                  <th className="py-3 px-3 text-right">Cover SA (OMR)</th>
                  <th className="py-3 px-3 text-right">Rate (&permil;)</th>
                  <th className="py-3 px-3 text-right">Gross Prem</th>
                  <th className="py-3 px-3 text-right">Discount</th>
                  <th className="py-3 px-3 text-right">Net Premium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledgerRows.map((c, idx) => (
                  <tr key={c.POL_MEM_COVER_ID || c.MEM_COVER_ID || idx} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-mono font-bold text-navy whitespace-nowrap">{c.EMP_ID}</td>
                    <td className="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap">{c.MEMBER_NAME}</td>
                    <td className="py-2 px-3 text-center text-slate-600 whitespace-nowrap">
                      {c.AGE} / {c.GENDER}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-navy whitespace-nowrap">{c.COVER_CODE}</td>
                    <td className="py-2 px-3 text-slate-700">{c.COVER_NAME}</td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.COVER_TYPE === 'BASIC'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}
                      >
                        {c.COVER_TYPE}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                      {Number(c.COVER_SUM_ASSURED).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                      {Number(c.RATE_PER_MILLE).toFixed(4)}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      {Number(c.GROSS_PREMIUM).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-700 whitespace-nowrap">
                      {Number(c.DISCOUNT_AMOUNT) > 0
                        ? `- ${Number(c.DISCOUNT_AMOUNT).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : '0.00'}
                    </td>
                    <td className="py-2 px-3 text-right font-black text-teal-700 whitespace-nowrap">
                      {Number(c.NET_PREMIUM).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-navy">
                <tr>
                  <td colSpan={6} className="py-3 px-3 uppercase text-[11px]">
                    Filtered Total ({ledgerRows.length} cover entries)
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    {ledgerRows
                      .reduce((acc, c) => acc + Number(c.COVER_SUM_ASSURED || 0), 0)
                      .toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3"></td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    {ledgerRows
                      .reduce((acc, c) => acc + Number(c.GROSS_PREMIUM || 0), 0)
                      .toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-700 whitespace-nowrap">
                    {ledgerRows
                      .reduce((acc, c) => acc + Number(c.DISCOUNT_AMOUNT || 0), 0)
                      .toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right text-teal-800 text-sm font-black whitespace-nowrap">
                    OMR{' '}
                    {ledgerRows
                      .reduce((acc, c) => acc + Number(c.NET_PREMIUM || 0), 0)
                      .toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
