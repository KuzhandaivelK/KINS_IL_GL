// frontend/src/pages/CoversPage.tsx

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { coverService } from '../services/coverService';
import { CoverListItem, CoverTypeOption, CreateCoverInput, UpdateCoverInput } from '../types/cover';
import {
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Eye,
  Sliders,
  Calendar,
  Layers,
  Percent,
  Coins
} from 'lucide-react';

export const CoversPage: React.FC = () => {
  // Data states
  const [covers, setCovers] = useState<CoverListItem[]>([]);
  const [coverTypes, setCoverTypes] = useState<CoverTypeOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters & search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [lobFilter, setLobFilter] = useState<string>('ALL');

  // Messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedCover, setSelectedCover] = useState<CoverListItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Create Form state
  const [createForm, setCreateForm] = useState<CreateCoverInput>({
    coverCode: '',
    coverDesc: '',
    coverL1Desc: '',
    coverType: '',
    activeYn: 'Y',
    appOnBasicRate: 'N',
    fromDate: '',
    toDate: '',
    minSa: null,
    maxSa: null,
    rateAppliedOn: '1',
    saPerc: 100,
    saCalc: 'P'
  });

  // Edit Form state
  const [editForm, setEditForm] = useState<UpdateCoverInput>({
    coverDesc: '',
    coverL1Desc: '',
    coverType: '',
    activeYn: 'Y',
    appOnBasicRate: 'N',
    fromDate: '',
    toDate: '',
    minSa: null,
    maxSa: null,
    rateAppliedOn: '1',
    saPerc: 100,
    saCalc: 'P'
  });

  // --- DATA FETCHING ---

  const fetchCoverTypes = async () => {
    try {
      const res = await coverService.getCoverTypes();
      if (res.success) {
        setCoverTypes(res.types);
        // Default create form cover type to first available if empty
        if (res.types.length > 0 && !createForm.coverType) {
          setCreateForm((prev) => ({ ...prev, coverType: res.types[0].code }));
        }
      }
    } catch {
      console.error('Failed to load cover types from STBL_CODE');
    }
  };

  const fetchCovers = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const activeOnly = statusFilter === 'ACTIVE' ? true : undefined;
      const res = await coverService.getCovers(
        searchTerm,
        typeFilter === 'ALL' ? undefined : typeFilter,
        activeOnly,
        lobFilter === 'ALL' ? undefined : lobFilter
      );

      if (res.success) {
        let list = res.covers;
        if (statusFilter === 'INACTIVE') {
          list = list.filter((c) => c.activeYn === 'N');
        }
        setCovers(list);
      } else {
        setErrorMsg(res.message || 'Failed to load covers from MTBL_COVER');
      }
    } catch {
      setErrorMsg('Network error connecting to covers API.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCoverTypes();
  }, []);

  useEffect(() => {
    fetchCovers();
  }, [searchTerm, typeFilter, statusFilter, lobFilter]);

  // --- MODAL HANDLERS ---

  const handleOpenCreate = () => {
    setCreateForm({
      coverCode: '',
      coverDesc: '',
      coverL1Desc: '',
      coverType: coverTypes.length > 0 ? coverTypes[0].code : 'D',
      activeYn: 'Y',
      appOnBasicRate: 'N',
      fromDate: '',
      toDate: '',
      minSa: 1000,
      maxSa: 1000000,
      rateAppliedOn: '1',
      saPerc: 100,
      saCalc: 'P'
    });
    setErrorMsg(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.coverCode.trim() || !createForm.coverDesc.trim()) {
      setErrorMsg('Cover Code and Description are required.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const payload: CreateCoverInput = {
        ...createForm,
        coverCode: createForm.coverCode.toUpperCase().trim(),
        coverDesc: createForm.coverDesc.trim(),
        coverL1Desc: createForm.coverL1Desc?.trim() || null,
        coverType: createForm.coverType || null,
        fromDate: createForm.fromDate || null,
        toDate: createForm.toDate || null,
        minSa: createForm.minSa ? Number(createForm.minSa) : null,
        maxSa: createForm.maxSa ? Number(createForm.maxSa) : null,
        saPerc: createForm.saPerc !== null && createForm.saPerc !== undefined ? Number(createForm.saPerc) : null
      };

      const res = await coverService.createCover(payload);
      if (res.success && res.cover) {
        setSuccessMsg(`Cover '${res.cover.coverCode}' created successfully.`);
        setIsCreateModalOpen(false);
        fetchCovers();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.message || 'Failed to create cover.');
      }
    } catch {
      setErrorMsg('Unexpected error creating cover.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (cover: CoverListItem) => {
    setSelectedCover(cover);
    setEditForm({
      coverDesc: cover.coverDesc,
      coverL1Desc: cover.coverL1Desc || '',
      coverType: cover.coverType || '',
      activeYn: cover.activeYn,
      appOnBasicRate: cover.appOnBasicRate || 'N',
      fromDate: cover.fromDate ? cover.fromDate.slice(0, 10) : '',
      toDate: cover.toDate ? cover.toDate.slice(0, 10) : '',
      minSa: cover.minSa,
      maxSa: cover.maxSa,
      rateAppliedOn: cover.rateAppliedOn || '1',
      saPerc: cover.saPerc !== null && cover.saPerc !== undefined ? cover.saPerc : 100,
      saCalc: cover.saCalc || 'P'
    });
    setErrorMsg(null);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCover) return;
    if (!editForm.coverDesc?.trim()) {
      setErrorMsg('Cover Description is required.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const payload: UpdateCoverInput = {
        ...editForm,
        coverDesc: editForm.coverDesc.trim(),
        coverL1Desc: editForm.coverL1Desc?.trim() || null,
        coverType: editForm.coverType || null,
        fromDate: editForm.fromDate || null,
        toDate: editForm.toDate || null,
        minSa: editForm.minSa ? Number(editForm.minSa) : null,
        maxSa: editForm.maxSa ? Number(editForm.maxSa) : null,
        saPerc: editForm.saPerc !== null && editForm.saPerc !== undefined ? Number(editForm.saPerc) : null
      };

      const res = await coverService.updateCover(selectedCover.coverCode, payload);
      if (res.success) {
        setSuccessMsg(`Cover '${selectedCover.coverCode}' updated successfully.`);
        setIsEditModalOpen(false);
        fetchCovers();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.message || 'Failed to update cover.');
      }
    } catch {
      setErrorMsg('Unexpected error updating cover.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDelete = (cover: CoverListItem) => {
    setSelectedCover(cover);
    setErrorMsg(null);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedCover) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await coverService.deleteCover(selectedCover.coverCode);
      if (res.success) {
        setSuccessMsg(`Cover '${selectedCover.coverCode}' deleted.`);
        setIsDeleteModalOpen(false);
        fetchCovers();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.message || 'Failed to delete cover.');
      }
    } catch {
      setErrorMsg('Error deleting cover.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to format currency/SA
  const formatSa = (val?: number | null) => {
    if (val === null || val === undefined) return '-';
    return Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  // Metric computations
  const totalCount = covers.length;
  const activeCount = covers.filter((c) => c.activeYn === 'Y').length;
  const basicCount = covers.filter((c) => c.coverType === 'D').length;
  const ancillaryCount = covers.filter((c) => c.coverType === 'A' || c.coverType === 'W').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs font-medium text-slate-500">
        <Link to="/dashboard" className="hover:text-navy transition-colors">
          Dashboard
        </Link>
        <span className="text-slate-300">/</span>
        <span className="hover:text-navy transition-colors">Product Configuration</span>
        <span className="text-slate-300">/</span>
        <span className="text-navy font-semibold">Cover Master (MTBL_COVER)</span>
      </nav>

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-navy/10 text-navy flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-navy" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-navy tracking-tight">Cover Master Configuration</h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Manage basic life covers and supplementary ancillary riders (MTBL_COVER &bull; STBL_CODE CVR_TYPE)
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchCovers}
            className="p-2.5 rounded-lg border border-slate-200 text-slate-600 hover:text-navy hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-navy hover:bg-navy-light text-white text-xs font-semibold shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Cover</span>
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && !isCreateModalOpen && !isEditModalOpen && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Defined Covers</span>
          <p className="text-2xl font-extrabold text-navy mt-1">{totalCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 uppercase">Active Covers</span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <span className="text-xs font-semibold text-blue-600 uppercase">Basic Life Covers</span>
          <p className="text-2xl font-extrabold text-blue-700 mt-1">{basicCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <span className="text-xs font-semibold text-purple-600 uppercase">Ancillary & Riders</span>
          <p className="text-2xl font-extrabold text-purple-700 mt-1">{ancillaryCount}</p>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Cover Code, Name or Description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Cover Type Filter (STBL_CODE CVR_TYPE) */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy/20"
            >
              <option value="ALL">All Types</option>
              {coverTypes.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.description} ({t.code})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy/20"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active (Y)</option>
              <option value="INACTIVE">Inactive (N)</option>
            </select>
          </div>

          {/* LOB Business Line Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Line of Business:</span>
            <select
              value={lobFilter}
              onChange={(e) => setLobFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy/20 font-semibold"
            >
              <option value="ALL">All LOB (IL & GL)</option>
              <option value="IL">Individual Life (IL)</option>
              <option value="GL">Group Life (GL)</option>
              <option value="BOTH">Universal (BOTH)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <th className="py-3 px-4">Cover Code</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Cover Type (STBL_CODE)</th>
                <th className="py-3 px-4">Sum Assured Limits</th>
                <th className="py-3 px-4 text-center">LOB</th>
                <th className="py-3 px-4 text-center">SA %</th>
                <th className="py-3 px-4 text-center">App Basic Rate</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-text-main">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-navy mb-2" />
                    <span>Loading cover master records from MTBL_COVER...</span>
                  </td>
                </tr>
              ) : covers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <ShieldCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No cover master records found.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Click "Create New Cover" above to register your first insurance cover.
                    </p>
                  </td>
                </tr>
              ) : (
                covers.map((c) => {
                  const typeDesc = c.coverTypeDesc || (c.coverType === 'D' ? 'Basic Life Cover' : c.coverType === 'A' ? 'Ancillary' : c.coverType === 'W' ? 'WOP cover' : c.coverType || '-');
                  return (
                    <tr key={c.coverCode} className="hover:bg-slate-50/70 transition-colors">
                      {/* Code */}
                      <td className="py-3 px-4 font-mono font-bold text-navy whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {c.coverCode}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{c.coverDesc}</div>
                        {c.coverL1Desc && (
                          <div className="text-[11px] text-slate-500 font-normal">{c.coverL1Desc}</div>
                        )}
                      </td>

                      {/* Cover Type with CODE_SUB_CODE_DESC */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            c.coverType === 'D'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : c.coverType === 'W'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}
                        >
                          <span className="font-mono text-[10px] font-bold px-1 rounded bg-white/70">
                            {c.coverType || '-'}
                          </span>
                          <span>{typeDesc}</span>
                        </span>
                      </td>

                      {/* SA Limits */}
                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {c.minSa !== null || c.maxSa !== null ? (
                          <span>
                            {formatSa(c.minSa)} &rarr; {formatSa(c.maxSa)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-sans italic">Not restricted</span>
                        )}
                      </td>

                      {/* LOB */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.coverLob === 'GL'
                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                            : c.coverLob === 'BOTH'
                            ? 'bg-teal-100 text-teal-700 border border-teal-200'
                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}>
                          {c.coverLob || 'IL'}
                        </span>
                      </td>

                      {/* SA % */}
                      <td className="py-3 px-4 text-center font-mono">
                        {c.saPerc !== null && c.saPerc !== undefined ? `${c.saPerc}%` : '-'}
                      </td>

                      {/* App on Basic Rate */}
                      <td className="py-3 px-4 text-center">
                        {c.appOnBasicRate === 'Y' ? (
                          <span className="text-emerald-700 font-semibold text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Yes (Y)
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {c.activeYn === 'Y' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                            <XCircle className="w-3 h-3 text-red-600" /> Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCover(c);
                              setIsDetailModalOpen(true);
                            }}
                            className="p-1.5 rounded text-slate-500 hover:text-navy hover:bg-slate-100 transition-colors"
                            title="View Cover Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(c)}
                            className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit Cover Master"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(c)}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete Cover"
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

      {/* ========================================================================= */}
      {/* MODAL: CREATE NEW COVER                                                   */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-navy text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm tracking-wide">Create New Cover Master (MTBL_COVER)</h3>
                <span className="text-[11px] text-slate-300">Register new product benefit or supplementary rider</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-300 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Cover Code (COVER_CODE)<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TERM_BASIC_01"
                    value={createForm.coverCode}
                    onChange={(e) => setCreateForm({ ...createForm, coverCode: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 uppercase font-mono"
                  />
                </div>

                {/* COVER_TYPE Dropdown: Uses STBL_CODE CVR_TYPE */}
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Cover Type (COVER_TYPE)<span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={createForm.coverType || ''}
                    onChange={(e) => setCreateForm({ ...createForm, coverType: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy/20 font-medium"
                  >
                    <option value="">-- Select Cover Type --</option>
                    {coverTypes.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.description} ({t.code})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Displays CODE_SUB_CODE_DESC &bull; stores CODE_SUB_CODE
                  </span>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Cover Description (COVER_DESC)<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Standard Ordinary Term Assurance Basic Cover"
                    value={createForm.coverDesc}
                    onChange={(e) => setCreateForm({ ...createForm, coverDesc: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Localized / Secondary Description (COVER_L1_DESC)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Term Life Basic Cover"
                    value={createForm.coverL1Desc || ''}
                    onChange={(e) => setCreateForm({ ...createForm, coverL1Desc: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Minimum Sum Assured (COVER_MIN_SA)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 10000"
                    value={createForm.minSa ?? ''}
                    onChange={(e) => setCreateForm({ ...createForm, minSa: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Maximum Sum Assured (COVER_MAX_SA)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 10000000"
                    value={createForm.maxSa ?? ''}
                    onChange={(e) => setCreateForm({ ...createForm, maxSa: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Sum Assured % (COVER_SA_PERC)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="100"
                    value={createForm.saPerc ?? 100}
                    onChange={(e) => setCreateForm({ ...createForm, saPerc: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Applies on Basic Rate (COVER_APP_ON_BASIC_RATE)
                  </label>
                  <select
                    value={createForm.appOnBasicRate || 'N'}
                    onChange={(e) => setCreateForm({ ...createForm, appOnBasicRate: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="N">No (N)</option>
                    <option value="Y">Yes (Y)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Effective From Date</label>
                  <input
                    type="date"
                    value={createForm.fromDate || ''}
                    onChange={(e) => setCreateForm({ ...createForm, fromDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Effective To Date</label>
                  <input
                    type="date"
                    value={createForm.toDate || ''}
                    onChange={(e) => setCreateForm({ ...createForm, toDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-text-main mb-1">Active Status (COVER_ACTIVE_YN)</label>
                  <div className="flex items-center gap-4 pt-1">
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="activeYn"
                        checked={createForm.activeYn === 'Y'}
                        onChange={() => setCreateForm({ ...createForm, activeYn: 'Y' })}
                        className="text-navy focus:ring-navy"
                      />
                      <span className="font-semibold text-emerald-700">Active (Y)</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="activeYn"
                        checked={createForm.activeYn === 'N'}
                        onChange={() => setCreateForm({ ...createForm, activeYn: 'N' })}
                        className="text-red-600 focus:ring-red-600"
                      />
                      <span className="font-semibold text-red-600">Inactive (N)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-navy hover:bg-navy-light text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Cover</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT COVER                                                         */}
      {/* ========================================================================= */}
      {isEditModalOpen && selectedCover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-navy text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm tracking-wide">Edit Cover: {selectedCover.coverCode}</h3>
                <span className="text-[11px] text-slate-300">Update cover properties and type mapping</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-300 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Cover Code (Readonly)</label>
                  <input
                    type="text"
                    disabled
                    value={selectedCover.coverCode}
                    className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-mono font-bold cursor-not-allowed"
                  />
                </div>

                {/* COVER_TYPE Dropdown: Uses STBL_CODE CVR_TYPE */}
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Cover Type (COVER_TYPE)<span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={editForm.coverType || ''}
                    onChange={(e) => setEditForm({ ...editForm, coverType: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy/20 font-medium"
                  >
                    <option value="">-- Select Cover Type --</option>
                    {coverTypes.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.description} ({t.code})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Displays CODE_SUB_CODE_DESC &bull; stores CODE_SUB_CODE
                  </span>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Cover Description (COVER_DESC)<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.coverDesc || ''}
                    onChange={(e) => setEditForm({ ...editForm, coverDesc: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Localized / Secondary Description (COVER_L1_DESC)
                  </label>
                  <input
                    type="text"
                    value={editForm.coverL1Desc || ''}
                    onChange={(e) => setEditForm({ ...editForm, coverL1Desc: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Minimum Sum Assured (COVER_MIN_SA)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.minSa ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, minSa: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Maximum Sum Assured (COVER_MAX_SA)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.maxSa ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, maxSa: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Sum Assured % (COVER_SA_PERC)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editForm.saPerc ?? 100}
                    onChange={(e) => setEditForm({ ...editForm, saPerc: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Applies on Basic Rate (COVER_APP_ON_BASIC_RATE)
                  </label>
                  <select
                    value={editForm.appOnBasicRate || 'N'}
                    onChange={(e) => setEditForm({ ...editForm, appOnBasicRate: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="N">No (N)</option>
                    <option value="Y">Yes (Y)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Effective From Date</label>
                  <input
                    type="date"
                    value={editForm.fromDate || ''}
                    onChange={(e) => setEditForm({ ...editForm, fromDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Effective To Date</label>
                  <input
                    type="date"
                    value={editForm.toDate || ''}
                    onChange={(e) => setEditForm({ ...editForm, toDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-text-main mb-1">Active Status (COVER_ACTIVE_YN)</label>
                  <div className="flex items-center gap-4 pt-1">
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="activeYnEdit"
                        checked={editForm.activeYn === 'Y'}
                        onChange={() => setEditForm({ ...editForm, activeYn: 'Y' })}
                        className="text-navy focus:ring-navy"
                      />
                      <span className="font-semibold text-emerald-700">Active (Y)</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="activeYnEdit"
                        checked={editForm.activeYn === 'N'}
                        onChange={() => setEditForm({ ...editForm, activeYn: 'N' })}
                        className="text-red-600 focus:ring-red-600"
                      />
                      <span className="font-semibold text-red-600">Inactive (N)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-navy hover:bg-navy-light text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW DETAILS                                                       */}
      {/* ========================================================================= */}
      {isDetailModalOpen && selectedCover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-navy text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm tracking-wide">Cover Details: {selectedCover.coverCode}</h3>
                <span className="text-[11px] text-slate-300">Detailed overview from Oracle MTBL_COVER</span>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-300 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">Cover Code</span>
                  <span className="font-mono font-bold text-sm text-navy">{selectedCover.coverCode}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">Cover Type</span>
                  <span className="font-bold text-sm text-slate-800">
                    {selectedCover.coverTypeDesc || selectedCover.coverType} ({selectedCover.coverType})
                  </span>
                </div>
                <div className="col-span-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">Description</span>
                  <span className="font-bold text-slate-900">{selectedCover.coverDesc}</span>
                  {selectedCover.coverL1Desc && (
                    <span className="block text-[11px] text-slate-500 mt-0.5">{selectedCover.coverL1Desc}</span>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">Sum Assured Range</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {formatSa(selectedCover.minSa)} &rarr; {formatSa(selectedCover.maxSa)}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">Sum Assured %</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {selectedCover.saPerc !== null && selectedCover.saPerc !== undefined ? `${selectedCover.saPerc}%` : '-'}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">App on Basic Rate</span>
                  <span className="font-semibold text-slate-800">
                    {selectedCover.appOnBasicRate === 'Y' ? 'Yes (Y)' : 'No (N)'}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">Status</span>
                  <span className="font-bold text-emerald-700">
                    {selectedCover.activeYn === 'Y' ? 'Active (Y)' : 'Inactive (N)'}
                  </span>
                </div>
                <div className="col-span-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">Effective Dates</span>
                  <span className="font-semibold text-slate-800">
                    {selectedCover.fromDate ? new Date(selectedCover.fromDate).toLocaleDateString() : 'Initial'} &bull;{' '}
                    {selectedCover.toDate ? new Date(selectedCover.toDate).toLocaleDateString() : 'Open'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenEdit(selectedCover);
                  }}
                  className="px-4 py-2 rounded-lg bg-navy hover:bg-navy-light text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Cover</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE CONFIRMATION                                                */}
      {/* ========================================================================= */}
      {isDeleteModalOpen && selectedCover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-center text-navy mb-2">Delete Cover</h3>
            <p className="text-xs text-center text-slate-500 mb-4">
              Are you sure you want to permanently delete cover{' '}
              <strong className="font-mono text-navy">{selectedCover.coverCode}</strong> ({selectedCover.coverDesc})?
            </p>
            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
