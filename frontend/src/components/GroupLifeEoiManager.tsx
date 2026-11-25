import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  UploadCloud,
  Download,
  Trash2,
  CheckCircle2,
  Clock,
  RefreshCw,
  Building2,
  FileSpreadsheet,
  X,
  Paperclip,
  Award,
  Search
} from 'lucide-react';
import { groupLifeService } from '../services/groupLifeService';
import {
  GLPolicyMasterRecord,
  GLQuoteHeaderRecord,
  GLPolicyDetail,
  GLQuoteDetail,
  GLEoiDocumentRecord
} from '../types/groupLife';

interface GroupLifeEoiManagerProps {
  policies: GLPolicyMasterRecord[];
  quotes: GLQuoteHeaderRecord[];
  initialSourceType?: 'policy' | 'quote';
  initialSourceNo?: string;
  onDataUpdated?: () => void;
}

const EOI_DOC_TYPES = [
  { code: 'MEDICAL_DECLARATION', label: 'Medical Declaration Form' },
  { code: 'HEALTH_QUESTIONNAIRE', label: 'Personal Health Questionnaire' },
  { code: 'MEDICAL_EXAM_REPORT', label: 'Medical Examination Report' },
  { code: 'LAB_REPORT', label: 'Blood / ECG / Lab Test Results' },
  { code: 'PHYSICIAN_STATEMENT', label: 'Attending Physician Statement' },
  { code: 'OTHER', label: 'Other Underwriting Evidence' }
];

export const GroupLifeEoiManager: React.FC<GroupLifeEoiManagerProps> = ({
  policies,
  quotes,
  initialSourceType = 'policy',
  initialSourceNo,
  onDataUpdated
}) => {
  const [sourceType, setSourceType] = useState<'policy' | 'quote'>(initialSourceType);
  const [selectedNo, setSelectedNo] = useState<string>(initialSourceNo || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [policyDetail, setPolicyDetail] = useState<GLPolicyDetail | null>(null);
  const [quoteDetail, setQuoteDetail] = useState<GLQuoteDetail | null>(null);

  const [onlyAboveFcl, setOnlyAboveFcl] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Document Collection Modal State
  const [docModalMember, setDocModalMember] = useState<{
    memberId: number;
    empId: string;
    memberName: string;
    sumAssured: number;
    effectiveSa: number;
    eoiFlag: 'Y' | 'N';
  } | null>(null);
  const [docType, setDocType] = useState<string>('MEDICAL_DECLARATION');
  const [docRemarks, setDocRemarks] = useState<string>('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<boolean>(false);

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

  const handleSourceTypeChange = (type: 'policy' | 'quote') => {
    setSourceType(type);
    if (type === 'policy') {
      setSelectedNo(policies.length > 0 ? policies[0].MASTER_POLICY_NO : '');
    } else {
      setSelectedNo(quotes.length > 0 ? quotes[0].GL_QUOTE_NO : '');
    }
  };

  const fetchDetail = async (type: 'policy' | 'quote', refNo: string) => {
    if (!refNo) return;
    setLoading(true);
    setError(null);
    try {
      if (type === 'policy') {
        const d = await groupLifeService.getPolicyByNo(refNo);
        setPolicyDetail(d);
        setQuoteDetail(null);
      } else {
        const d = await groupLifeService.getQuoteByNo(refNo);
        setQuoteDetail(d);
        setPolicyDetail(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load EOI details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedNo) {
      fetchDetail(sourceType, selectedNo);
    }
  }, [sourceType, selectedNo]);

  const fcl = useMemo(() => {
    if (sourceType === 'policy') return Number(policyDetail?.master.FREE_COVER_LIMIT || 250000);
    return Number(quoteDetail?.header.FREE_COVER_LIMIT || 250000);
  }, [sourceType, policyDetail, quoteDetail]);

  const corpName = useMemo(() => {
    if (sourceType === 'policy') return policyDetail?.master.CORP_NAME || '';
    return quoteDetail?.header.CORP_NAME || '';
  }, [sourceType, policyDetail, quoteDetail]);

  const members = useMemo(() => {
    if (sourceType === 'policy') return policyDetail?.members || [];
    return quoteDetail?.members || [];
  }, [sourceType, policyDetail, quoteDetail]);

  const eoiDocuments: GLEoiDocumentRecord[] = useMemo(() => {
    if (sourceType === 'policy') return policyDetail?.eoiDocuments || [];
    return quoteDetail?.eoiDocuments || [];
  }, [sourceType, policyDetail, quoteDetail]);

  const memberCovers = useMemo(() => {
    if (sourceType === 'policy') return policyDetail?.memberCovers || [];
    return quoteDetail?.memberCovers || [];
  }, [sourceType, policyDetail, quoteDetail]);

  // Filtered members
  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      const above = Number(m.SUM_ASSURED || 0) > fcl;
      if (onlyAboveFcl && !above) return false;
      if (!q) return true;
      return (
        (m.EMP_ID || '').toLowerCase().includes(q) ||
        (m.MEMBER_NAME || '').toLowerCase().includes(q) ||
        (m.CATEGORY || '').toLowerCase().includes(q)
      );
    });
  }, [members, fcl, onlyAboveFcl, searchQuery]);

  // Summary metrics
  const stats = useMemo(() => {
    const aboveFcl = members.filter((m) => Number(m.SUM_ASSURED || 0) > fcl);
    const approved = aboveFcl.filter((m) => m.EOI_FLAG === 'Y');
    const pending = aboveFcl.filter((m) => m.EOI_FLAG !== 'Y');
    const totalEffectiveSa = members.reduce((acc, m) => acc + Number(m.EFFECTIVE_SA ?? m.SUM_ASSURED), 0);
    const totalFullSa = members.reduce((acc, m) => acc + Number(m.SUM_ASSURED || 0), 0);
    return {
      aboveFclCount: aboveFcl.length,
      approvedCount: approved.length,
      pendingCount: pending.length,
      docsCount: eoiDocuments.length,
      totalEffectiveSa,
      totalFullSa
    };
  }, [members, fcl, eoiDocuments]);

  // Toggle EOI Flag (Y / N) and recalculate premiums on server
  const handleToggleEoi = async (memberId: number, empId: string, newFlag: 'Y' | 'N') => {
    if (!selectedNo) return;
    setActionLoadingId(memberId);
    setError(null);
    setSuccessMsg(null);
    try {
      const remarks =
        newFlag === 'Y'
          ? 'EOI Approved — Full Sum Assured applied for rating'
          : 'EOI Pending — Sum Assured capped at Free Cover Limit (FCL)';
      if (sourceType === 'policy') {
        const updated = await groupLifeService.updatePolicyMemberEoi(selectedNo, memberId, newFlag, remarks);
        setPolicyDetail(updated);
      } else {
        const updated = await groupLifeService.updateQuoteMemberEoi(selectedNo, memberId, newFlag, remarks);
        setQuoteDetail(updated);
      }
      setSuccessMsg(
        newFlag === 'Y'
          ? `EOI set to YES for ${empId}: Full Sum Assured is now active and cover-wise premiums have been recalculated.`
          : `EOI set to NO for ${empId}: Sum Assured is capped at FCL (OMR ${fcl.toLocaleString('en-US')}) and premiums recalculated.`
      );
      if (onDataUpdated) onDataUpdated();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to update EOI status');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Upload EOI Document
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docModalMember || !docFile || !selectedNo) return;
    setUploadingDoc(true);
    setError(null);
    try {
      await groupLifeService.uploadEoiDocument({
        file: docFile,
        refType: sourceType === 'policy' ? 'POLICY' : 'QUOTE',
        refNo: selectedNo,
        memberId: docModalMember.memberId,
        empId: docModalMember.empId,
        docType,
        remarks: docRemarks
      });
      setDocFile(null);
      setDocRemarks('');
      await fetchDetail(sourceType, selectedNo);
      setSuccessMsg(`EOI document uploaded successfully for ${docModalMember.empId}.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to upload EOI document');
    } finally {
      setUploadingDoc(false);
    }
  };

  // Delete EOI Document
  const handleDeleteDocument = async (docId: number) => {
    setError(null);
    try {
      await groupLifeService.deleteEoiDocument(docId);
      await fetchDetail(sourceType, selectedNo);
      setSuccessMsg('EOI document removed.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete EOI document');
    }
  };

  const getMemberNetPremium = (memberId: number | undefined, empId: string) => {
    const covs = memberCovers.filter(
      (c) => (c.MEMBER_ID && memberId && c.MEMBER_ID === memberId) || c.EMP_ID === empId
    );
    return Math.round(covs.reduce((acc, c) => acc + Number(c.NET_PREMIUM || 0), 0) * 100) / 100;
  };

  const docsForModalMember = useMemo(() => {
    if (!docModalMember) return [];
    return eoiDocuments.filter((d) => d.EMP_ID === docModalMember.empId);
  }, [eoiDocuments, docModalMember]);

  return (
    <div className="space-y-5">
      {/* Top Selection Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-navy flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <span>EOI (Evidence of Insurability) &amp; FCL Medical Underwriting</span>
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Members with Sum Assured above the Free Cover Limit (FCL) are capped at FCL until EOI Flag is set to <strong>Yes</strong> and supporting medical documents are collected.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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

            <select
              value={selectedNo}
              onChange={(e) => setSelectedNo(e.target.value)}
              className="text-xs font-bold text-navy rounded-lg border border-slate-300 px-3 py-2 bg-white min-w-[260px] focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              {sourceType === 'policy'
                ? policies.map((p) => (
                    <option key={p.MASTER_POLICY_NO} value={p.MASTER_POLICY_NO}>
                      {p.MASTER_POLICY_NO} — {p.CORP_NAME} (FCL: {Number(p.FREE_COVER_LIMIT).toLocaleString('en-US')})
                    </option>
                  ))
                : quotes.map((q) => (
                    <option key={q.GL_QUOTE_NO} value={q.GL_QUOTE_NO}>
                      {q.GL_QUOTE_NO} — {q.CORP_NAME} (FCL: {Number(q.FREE_COVER_LIMIT).toLocaleString('en-US')})
                    </option>
                  ))}
            </select>

            <button
              type="button"
              onClick={() => selectedNo && fetchDetail(sourceType, selectedNo)}
              disabled={loading || !selectedNo}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Reload</span>
            </button>
          </div>
        </div>

        {selectedNo && corpName && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500">Sponsor:</span>
              <span className="font-extrabold text-navy">{corpName}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                Free Cover Limit (FCL): OMR {fcl.toLocaleString('en-US')}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              Effective In-Force SA:{' '}
              <strong className="text-navy">OMR {stats.totalEffectiveSa.toLocaleString('en-US')}</strong>{' '}
              <span className="text-slate-400">
                (Requested Full SA: OMR {stats.totalFullSa.toLocaleString('en-US')})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      {selectedNo && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Free Cover Limit</span>
              <Award className="w-4 h-4 text-navy" />
            </div>
            <p className="mt-1.5 text-lg font-black text-navy">OMR {fcl.toLocaleString('en-US')}</p>
            <span className="text-[10px] text-slate-400">Automatic cover without EOI</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Members Above FCL</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <p className="mt-1.5 text-2xl font-black text-amber-700">{stats.aboveFclCount}</p>
            <span className="text-[10px] text-slate-400">Out of {members.length} total members</span>
          </div>

          <div className="bg-emerald-50/60 rounded-xl border border-emerald-200 p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
              <span>EOI Approved (Full SA)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="mt-1.5 text-2xl font-black text-emerald-700">{stats.approvedCount}</p>
            <span className="text-[10px] text-emerald-600">Rated on full Sum Assured</span>
          </div>

          <div className="bg-amber-50/60 rounded-xl border border-amber-200 p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-amber-800">
              <span>EOI Pending (Capped)</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <p className="mt-1.5 text-2xl font-black text-amber-700">{stats.pendingCount}</p>
            <span className="text-[10px] text-amber-700">Limited to FCL until approved</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>EOI Documents</span>
              <Paperclip className="w-4 h-4 text-teal-600" />
            </div>
            <p className="mt-1.5 text-2xl font-black text-teal-700">{stats.docsCount}</p>
            <span className="text-[10px] text-slate-400">Stored in T_GL_EOI_DOCUMENT</span>
          </div>
        </div>
      )}

      {/* Members EOI Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Emp ID, Name..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 w-52"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyAboveFcl}
                onChange={(e) => setOnlyAboveFcl(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span>Show only members with SA &gt; FCL ({stats.aboveFclCount})</span>
            </label>
          </div>

          <span className="text-[11px] text-slate-400">
            Toggle <strong>EOI Flag = Yes</strong> to rate full Sum Assured &amp; recalculate cover-wise premiums
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 text-teal-600 animate-spin" />
            <span>Loading member EOI records...</span>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-bold text-slate-600">No members match this filter</p>
            <p className="mt-1">Uncheck &ldquo;Show only members with SA &gt; FCL&rdquo; or select another Policy/Quote.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3">Emp ID</th>
                  <th className="py-3 px-3">Employee Name</th>
                  <th className="py-3 px-3 text-right">Full SA (OMR)</th>
                  <th className="py-3 px-3 text-right">Excess &gt; FCL</th>
                  <th className="py-3 px-3 text-right">Effective Rated SA</th>
                  <th className="py-3 px-3 text-right">Total Net Prem</th>
                  <th className="py-3 px-3 text-center">EOI Status</th>
                  <th className="py-3 px-3 text-center">EOI Flag (Full SA)</th>
                  <th className="py-3 px-3 text-right">EOI Documents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers.map((m) => {
                  const fullSa = Number(m.SUM_ASSURED || 0);
                  const isAboveFcl = fullSa > fcl;
                  const excess = isAboveFcl ? fullSa - fcl : 0;
                  const eoiFlag: 'Y' | 'N' = m.EOI_FLAG === 'Y' ? 'Y' : 'N';
                  const effectiveSa = Number(m.EFFECTIVE_SA ?? (isAboveFcl && eoiFlag !== 'Y' ? fcl : fullSa));
                  const memberDocs = eoiDocuments.filter((d) => d.EMP_ID === m.EMP_ID);
                  const totalNetPrem = getMemberNetPremium(m.MEMBER_ID, m.EMP_ID);
                  const isUpdating = actionLoadingId === m.MEMBER_ID;

                  return (
                    <tr
                      key={m.MEMBER_ID || m.EMP_ID}
                      className={`hover:bg-slate-50/70 ${isAboveFcl && eoiFlag !== 'Y' ? 'bg-amber-50/20' : ''}`}
                    >
                      <td className="py-3 px-3 font-mono font-bold text-navy whitespace-nowrap">{m.EMP_ID}</td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{m.MEMBER_NAME}</div>
                        <div className="text-[10px] text-slate-400">
                          Age {m.AGE} &bull; {m.GENDER} &bull; {m.CATEGORY || 'Staff'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-800 whitespace-nowrap">
                        {fullSa.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {excess > 0 ? (
                          <span className="font-bold text-amber-700">
                            +{excess.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <span
                          className={`font-black ${
                            isAboveFcl && eoiFlag !== 'Y'
                              ? 'text-amber-700'
                              : isAboveFcl && eoiFlag === 'Y'
                              ? 'text-emerald-700'
                              : 'text-navy'
                          }`}
                        >
                          {effectiveSa.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        {isAboveFcl && (
                          <div className="text-[10px] font-semibold">
                            {eoiFlag === 'Y' ? (
                              <span className="text-emerald-600">Full SA Applied</span>
                            ) : (
                              <span className="text-amber-600">Capped at FCL</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-teal-700 whitespace-nowrap">
                        OMR {totalNetPrem.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {!isAboveFcl ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            UNDER FCL
                          </span>
                        ) : eoiFlag === 'Y' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            EOI APPROVED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                            EOI PENDING
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isAboveFcl ? (
                          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                            <button
                              type="button"
                              disabled={isUpdating || !m.MEMBER_ID}
                              onClick={() => m.MEMBER_ID && handleToggleEoi(m.MEMBER_ID, m.EMP_ID, 'Y')}
                              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                                eoiFlag === 'Y'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:bg-white'
                              }`}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              disabled={isUpdating || !m.MEMBER_ID}
                              onClick={() => m.MEMBER_ID && handleToggleEoi(m.MEMBER_ID, m.EMP_ID, 'N')}
                              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                                eoiFlag !== 'Y'
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:bg-white'
                              }`}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Not Required</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            setDocModalMember({
                              memberId: m.MEMBER_ID || 0,
                              empId: m.EMP_ID,
                              memberName: m.MEMBER_NAME,
                              sumAssured: fullSa,
                              effectiveSa,
                              eoiFlag
                            })
                          }
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors border ${
                            memberDocs.length > 0
                              ? 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
                              : isAboveFcl
                              ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>
                            {memberDocs.length > 0 ? `Docs (${memberDocs.length})` : 'Collect Docs'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EOI DOCUMENT COLLECTION MODAL */}
      {docModalMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-navy">
                    EOI Document Collection — {docModalMember.memberName} ({docModalMember.empId})
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Ref: <strong>{selectedNo}</strong> &bull; Full SA:{' '}
                    <strong>OMR {docModalMember.sumAssured.toLocaleString('en-US')}</strong> &bull; FCL:{' '}
                    <strong>OMR {fcl.toLocaleString('en-US')}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDocModalMember(null);
                  setDocFile(null);
                  setDocRemarks('');
                }}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Upload New EOI Document Form */}
              <form
                onSubmit={handleUploadDocument}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
              >
                <h4 className="text-xs font-extrabold text-navy uppercase tracking-wider flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4 text-teal-600" />
                  <span>Upload New EOI Supporting Document</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Document Type *
                    </label>
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                      {EOI_DOC_TYPES.map((dt) => (
                        <option key={dt.code} value={dt.code}>
                          {dt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Select File (PDF, Image, Word) *
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx"
                      onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Underwriting / Collection Remarks
                  </label>
                  <input
                    type="text"
                    value={docRemarks}
                    onChange={(e) => setDocRemarks(e.target.value)}
                    placeholder="e.g. Medical report reviewed and cleared by Chief Medical Officer"
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!docFile || uploadingDoc}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors shadow-xs disabled:opacity-50"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>{uploadingDoc ? 'Uploading...' : 'Upload EOI Document'}</span>
                  </button>
                </div>
              </form>

              {/* Collected Documents List */}
              <div>
                <h4 className="text-xs font-extrabold text-navy uppercase tracking-wider mb-2">
                  Collected EOI Documents ({docsForModalMember.length})
                </h4>
                {docsForModalMember.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    No EOI documents uploaded yet for {docModalMember.empId}.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {docsForModalMember.map((d) => (
                      <div
                        key={d.EOI_DOC_ID}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/70"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              {EOI_DOC_TYPES.find((t) => t.code === d.DOC_TYPE)?.label || d.DOC_TYPE}
                            </span>
                            <span className="text-xs font-bold text-slate-800 truncate">{d.FILE_NAME}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {(d.FILE_SIZE / 1024).toFixed(1)} KB &bull; Uploaded by {d.UPLOADED_BY} on {d.UPLOADED_ON}
                            {d.REMARKS ? ` • "${d.REMARKS}"` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => groupLifeService.downloadEoiDocument(d.EOI_DOC_ID, d.FILE_NAME)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-navy hover:bg-slate-100"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(d.EOI_DOC_ID)}
                            className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                            title="Delete document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                {docsForModalMember.length > 0 && docModalMember.eoiFlag !== 'Y'
                  ? 'Documents collected! You can now set EOI Flag = Yes to enable Full Sum Assured.'
                  : 'Documents are persisted in Oracle (T_GL_EOI_DOCUMENT).'}
              </span>
              <button
                type="button"
                onClick={() => setDocModalMember(null)}
                className="px-4 py-2 rounded-lg bg-navy text-white text-xs font-bold hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
