import React, { useState, useEffect, useMemo } from 'react';
import {
  HeartPulse,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  Download,
  Trash2,
  FileText,
  RefreshCw,
  ShieldCheck,
  Calendar,
  Building2,
  Save,
  Table2
} from 'lucide-react';
import { proposalService } from '../services/proposalService';
import { MedicalGridRule, ProposalMedicalDocument } from '../types/proposal';

interface ProposalMedicalGridStepProps {
  propNo: string | null;
  age: number;
  sumAssured: number;
  smokerYn: 'Y' | 'N';
  isReadOnly: boolean;
  onSaveDraftFirst?: () => Promise<void>;
}

const STANDARD_MEDICAL_TESTS = [
  'MER (Medical Examiner Report)',
  'CBC (Complete Blood Count)',
  'Fasting Blood Sugar (FBS) / HbA1c',
  'Lipid Profile',
  'Liver / Renal Function Test (LFT / RFT)',
  'Resting ECG',
  'TMT (Treadmill Stress Test)',
  '2D Echocardiogram',
  'Chest X-Ray',
  'Routine Urine Analysis (RUA)',
  'HIV / HBsAg Screening',
  'Complete Medical Examination Package'
];

export const ProposalMedicalGridStep: React.FC<ProposalMedicalGridStepProps> = ({
  propNo,
  age,
  sumAssured,
  smokerYn,
  isReadOnly,
  onSaveDraftFirst
}) => {
  const [grid, setGrid] = useState<MedicalGridRule[]>([]);
  const [matchedRule, setMatchedRule] = useState<MedicalGridRule | null>(null);
  const [documents, setDocuments] = useState<ProposalMedicalDocument[]>([]);
  const [loadingGrid, setLoadingGrid] = useState<boolean>(false);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showFullGrid, setShowFullGrid] = useState<boolean>(true);

  // Upload form state
  const [testName, setTestName] = useState<string>('MER (Medical Examiner Report)');
  const [examDate, setExamDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [clinicName, setClinicName] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Fetch Medical Grid & evaluate rule whenever Age or Sum Assured changes
  useEffect(() => {
    let active = true;
    const loadGrid = async () => {
      setLoadingGrid(true);
      setError(null);
      try {
        const res = await proposalService.getMedicalGrid(age, sumAssured);
        if (!active) return;
        setGrid(res.grid || []);
        setMatchedRule(res.matchedRule || null);
      } catch (err: any) {
        if (!active) return;
        setError(err.message || 'Failed to evaluate medical grid');
      } finally {
        if (active) setLoadingGrid(false);
      }
    };
    loadGrid();
    return () => {
      active = false;
    };
  }, [age, sumAssured]);

  // Fetch uploaded medical documents if proposal is already persisted
  const fetchDocs = async (pNo: string) => {
    setLoadingDocs(true);
    try {
      const res = await proposalService.getMedicalDocuments(pNo);
      setDocuments(res.documents || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load medical documents');
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (propNo) {
      fetchDocs(propNo);
    } else {
      setDocuments([]);
    }
  }, [propNo]);

  // Parse required tests into pills
  const requiredTestsList = useMemo(() => {
    if (!matchedRule || matchedRule.IS_MEDICAL_REQUIRED !== 'Y') return [];
    return matchedRule.REQUIRED_TESTS.split(',').map((t) => t.trim()).filter(Boolean);
  }, [matchedRule]);

  // Group grid rows by Age Band for clean matrix display
  const ageBands = useMemo(() => {
    const map = new Map<string, { ageFrom: number; ageTo: number; rules: MedicalGridRule[] }>();
    for (const r of grid) {
      const key = `${r.AGE_FROM}-${r.AGE_TO}`;
      if (!map.has(key)) {
        map.set(key, { ageFrom: r.AGE_FROM, ageTo: r.AGE_TO, rules: [] });
      }
      map.get(key)!.rules.push(r);
    }
    return Array.from(map.values());
  }, [grid]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propNo || !selectedFile) return;
    setUploading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await proposalService.uploadMedicalDocument(propNo, {
        file: selectedFile,
        testName,
        examDate,
        clinicName,
        remarks
      });
      setSelectedFile(null);
      setClinicName('');
      setRemarks('');
      await fetchDocs(propNo);
      setSuccessMsg(res.message || 'Medical examination document uploaded successfully.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to upload medical document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: number) => {
    if (!propNo) return;
    setError(null);
    try {
      await proposalService.deleteMedicalDocument(docId);
      await fetchDocs(propNo);
      setSuccessMsg('Medical document removed.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete medical document');
    }
  };

  const isMedicalRequired = matchedRule?.IS_MEDICAL_REQUIRED === 'Y';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Step 5: Medical Grid &amp; Examination Document Upload
            </h2>
            <p className="text-xs text-gray-500">
              Automatic Age Band &times; Sum Assured Band medical underwriting assessment and lab/MER document collection.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowFullGrid((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 self-start sm:self-auto"
        >
          <Table2 className="w-3.5 h-3.5 text-blue-600" />
          <span>{showFullGrid ? 'Hide Medical Grid Matrix' : 'View Full Medical Grid'}</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Evaluated Proposal Medical Assessment Card */}
      {loadingGrid ? (
        <div className="p-6 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center gap-2 text-xs text-gray-600">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
          <span>Evaluating Medical Grid for Age {age} &amp; Sum Assured {Number(sumAssured).toLocaleString('en-US')}...</span>
        </div>
      ) : (
        <div
          className={`p-5 rounded-2xl border-2 space-y-4 ${
            isMedicalRequired
              ? 'bg-amber-50/50 border-amber-200'
              : 'bg-emerald-50/50 border-emerald-200'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  isMedicalRequired
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {isMedicalRequired ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <ShieldCheck className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase ${
                      isMedicalRequired
                        ? 'bg-amber-200/80 text-amber-900'
                        : 'bg-emerald-200/80 text-emerald-900'
                    }`}
                  >
                    {isMedicalRequired ? 'Medical Examination Required' : 'No Medical Exam Required (Non-Medical)'}
                  </span>
                  {matchedRule && (
                    <span className="px-2 py-0.5 rounded bg-white/80 border border-gray-200 font-mono text-[11px] font-bold text-gray-700">
                      Code: {matchedRule.MEDICAL_CODE}
                    </span>
                  )}
                  {smokerYn === 'Y' && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold border border-rose-200">
                      Smoker Disclosure Noted
                    </span>
                  )}
                </div>
                <h3 className="text-base font-extrabold text-gray-900 mt-1">
                  {matchedRule ? matchedRule.MEDICAL_CATEGORY : 'Standard Underwriting Assessment'}
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Life Assured Age: <strong>{age} yrs</strong> &bull; Proposed Sum Assured:{' '}
                  <strong>{Number(sumAssured).toLocaleString('en-US')}</strong>
                  {matchedRule && (
                    <>
                      {' '}
                      &bull; Matched Band:{' '}
                      <strong>
                        Age {matchedRule.AGE_FROM}–{matchedRule.AGE_TO}
                      </strong>{' '}
                      /{' '}
                      <strong>
                        SA {Number(matchedRule.SA_FROM).toLocaleString('en-US')} –{' '}
                        {Number(matchedRule.SA_TO) >= 999999999
                          ? 'Above'
                          : Number(matchedRule.SA_TO).toLocaleString('en-US')}
                      </strong>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="text-left md:text-right shrink-0">
              <div className="text-[11px] font-bold text-gray-500 uppercase">Uploaded Medical Docs</div>
              <div className="text-2xl font-black text-gray-900">{documents.length}</div>
            </div>
          </div>

          {/* Required Tests Checklist Pills */}
          {isMedicalRequired && requiredTestsList.length > 0 && (
            <div className="pt-3 border-t border-amber-200/70">
              <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-2">
                Mandatory Medical Examinations / Lab Reports Required:
              </div>
              <div className="flex flex-wrap gap-2">
                {requiredTestsList.map((test, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-xs font-semibold text-gray-800 shadow-2xs"
                  >
                    <HeartPulse className="w-3 h-3 text-rose-500" />
                    <span>{test}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full Age Band x Sum Assured Band Medical Grid Matrix */}
      {showFullGrid && ageBands.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-2xs">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">
              Individual Life Medical Grid (Age Band &times; Sum Assured Band)
            </h3>
            <span className="text-[11px] text-gray-500">
              Source: <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">MTBL_IL_MEDICAL_GRID</code>
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/70 border-b border-gray-200 text-gray-500 font-bold uppercase">
                <tr>
                  <th className="py-2.5 px-3">Age Band</th>
                  <th className="py-2.5 px-3">Sum Assured Band</th>
                  <th className="py-2.5 px-3 text-center">Code</th>
                  <th className="py-2.5 px-3">Medical Category</th>
                  <th className="py-2.5 px-3">Required Tests / Examinations</th>
                  <th className="py-2.5 px-3 text-center">Medical Required?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {grid.map((r) => {
                  const isMatch = matchedRule?.GRID_ID === r.GRID_ID;
                  return (
                    <tr
                      key={r.GRID_ID}
                      className={
                        isMatch
                          ? r.IS_MEDICAL_REQUIRED === 'N'
                            ? 'bg-emerald-50 font-semibold ring-1 ring-inset ring-emerald-300'
                            : 'bg-amber-50 font-semibold ring-1 ring-inset ring-amber-300'
                          : 'hover:bg-gray-50/70'
                      }
                    >
                      <td className="py-2 px-3 whitespace-nowrap font-bold text-gray-900">
                        {r.AGE_FROM} – {r.AGE_TO} yrs
                        {isMatch && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-600 text-white uppercase">
                            Matched
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-gray-700">
                        {Number(r.SA_FROM).toLocaleString('en-US')} –{' '}
                        {Number(r.SA_TO) >= 999999999
                          ? 'Above'
                          : Number(r.SA_TO).toLocaleString('en-US')}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-blue-700">
                        {r.MEDICAL_CODE}
                      </td>
                      <td className="py-2 px-3 text-gray-800">{r.MEDICAL_CATEGORY}</td>
                      <td className="py-2 px-3 text-gray-600">{r.REQUIRED_TESTS}</td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {r.IS_MEDICAL_REQUIRED === 'N' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            No Medical Exam
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Required
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Medical Examination Document Upload Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-blue-600" />
              <span>Medical Examination &amp; Lab Report Upload</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Upload MER forms, ECG strips, blood test panels, or doctor certificates. Files are stored in the path configured in{' '}
              <code className="font-mono bg-gray-100 px-1 rounded">STBL_SYS_PARAM (IL_MED_DOC_PATH)</code>.
            </p>
          </div>
          {propNo && (
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-mono text-xs font-bold border border-blue-100">
              Proposal: {propNo}
            </span>
          )}
        </div>

        {!propNo ? (
          <div className="p-6 rounded-xl bg-blue-50/60 border border-blue-200 text-center space-y-3">
            <FileText className="w-8 h-8 text-blue-500 mx-auto" />
            <div>
              <p className="text-sm font-bold text-gray-900">Save Proposal Draft to Upload Medical Documents</p>
              <p className="text-xs text-gray-600 mt-1">
                A Proposal Reference Number is required to link medical examination reports in{' '}
                <code className="font-mono">T_PROPOSAL_MEDICAL_DOC</code>.
              </p>
            </div>
            {onSaveDraftFirst && !isReadOnly && (
              <button
                type="button"
                onClick={onSaveDraftFirst}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Draft Now &amp; Enable Document Upload</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {!isReadOnly && (
              <form
                onSubmit={handleUpload}
                className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Medical Exam / Test Type *
                    </label>
                    <select
                      value={testName}
                      onChange={(e) => setTestName(e.target.value)}
                      className="w-full text-xs rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {requiredTestsList.map((t) => (
                        <option key={`req-${t}`} value={t}>
                          [Required] {t}
                        </option>
                      ))}
                      {STANDARD_MEDICAL_TESTS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      <span>Examination Date</span>
                    </label>
                    <input
                      type="date"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="w-full text-xs rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-gray-400" />
                      <span>Diagnostic Center / Clinic</span>
                    </label>
                    <input
                      type="text"
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      placeholder="e.g. Apollo Diagnostics / Panel Clinic"
                      className="w-full text-xs rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Select Medical Report File (PDF, JPG, PNG, DOC) *
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Optional underwriting / doctor remarks..."
                      className="flex-1 text-xs rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!selectedFile || uploading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs disabled:opacity-50 shrink-0"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>{uploading ? 'Uploading...' : 'Upload Report'}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Uploaded Medical Documents Table */}
            <div>
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Uploaded Medical Examination Documents ({documents.length})
              </h4>
              {loadingDocs ? (
                <div className="p-6 text-center text-xs text-gray-500">
                  <RefreshCw className="w-4 h-4 animate-spin inline mr-1.5 text-blue-600" />
                  Loading documents...
                </div>
              ) : documents.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
                  No medical examination documents uploaded yet for {propNo}.
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Test / Exam Name</th>
                        <th className="py-2.5 px-3">File Name</th>
                        <th className="py-2.5 px-3">Clinic / Exam Date</th>
                        <th className="py-2.5 px-3">Uploaded By</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {documents.map((doc) => (
                        <tr key={doc.MED_DOC_ID} className="hover:bg-gray-50/60">
                          <td className="py-2.5 px-3 font-bold text-gray-900">{doc.TEST_NAME}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-blue-700">{doc.FILE_NAME}</div>
                            <div className="text-[10px] text-gray-400">
                              {(doc.FILE_SIZE / 1024).toFixed(1)} KB
                              {doc.REMARKS ? ` • ${doc.REMARKS}` : ''}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-gray-600">
                            <div>{doc.CLINIC_NAME || '—'}</div>
                            <div className="text-[10px] text-gray-400">{doc.EXAM_DATE || '—'}</div>
                          </td>
                          <td className="py-2.5 px-3 text-gray-600">
                            <div>{doc.UPLOADED_BY}</div>
                            <div className="text-[10px] text-gray-400">{doc.UPLOADED_ON}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => proposalService.downloadMedicalDocument(doc.MED_DOC_ID, doc.FILE_NAME)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 font-semibold text-[11px]"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download</span>
                              </button>
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(doc.MED_DOC_ID)}
                                  className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                                  title="Remove document"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
