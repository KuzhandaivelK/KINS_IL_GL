// frontend/src/pages/TariffRatesPage.tsx

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tariffService } from '../services/tariffService';
import {
  TariffParamRecord,
  CreateTariffParamInput,
  TariffHeadRecord,
  CreateTariffHeadInput,
  TariffDetailRecord,
  CreateTariffDetailInput
} from '../types/tariff';
import {
  Layers,
  Calculator,
  Plus,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Calendar,
  Sparkles,
  HelpCircle,
  Tag
} from 'lucide-react';

export const TariffRatesPage: React.FC = () => {
  // Tabs
  const [activeTab, setActiveTab] = useState<'tariffs' | 'params'>('tariffs');

  // Data states
  const [params, setParams] = useState<TariffParamRecord[]>([]);
  const [headers, setHeaders] = useState<TariffHeadRecord[]>([]);
  const [selectedHeader, setSelectedHeader] = useState<TariffHeadRecord | null>(null);
  const [details, setDetails] = useState<TariffDetailRecord[]>([]);

  // Loading & alerts
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [isCreateHeadOpen, setIsCreateHeadOpen] = useState<boolean>(false);
  const [isEditHeadOpen, setIsEditHeadOpen] = useState<boolean>(false);
  const [isCreateDetailOpen, setIsCreateDetailOpen] = useState<boolean>(false);
  const [isCreateParamOpen, setIsCreateParamOpen] = useState<boolean>(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'head' | 'detail' | 'param'; id: string; subId?: string; name: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Rate simulator state
  const [simValues, setSimValues] = useState<{ [key: string]: string }>({});
  const [simResult, setSimResult] = useState<{ matchedRate?: string; matchedDetailId?: string; ratePer?: string; message: string } | null>(null);

  // Forms state
  const [headForm, setHeadForm] = useState<CreateTariffHeadInput>({
    mthCode: '',
    mthType: 'BASE',
    mthDesc: '',
    mthShortDesc: '',
    params: ['', '', ''],
    ratePer: '1000',
    effFromDate: '',
    effToDate: ''
  });

  const [editHeadForm, setEditHeadForm] = useState<{
    mthCode: string;
    mthType: string;
    mthDesc: string;
    mthShortDesc: string;
    params: string[];
    ratePer: string;
    effFromDate: string;
    effToDate: string;
  }>({
    mthCode: '',
    mthType: 'BASE',
    mthDesc: '',
    mthShortDesc: '',
    params: [],
    ratePer: '1000',
    effFromDate: '',
    effToDate: ''
  });

  const [detailForm, setDetailForm] = useState<{
    rate: string;
    effFromDate: string;
    effToDate: string;
    paramBands: { from: string; to: string }[];
  }>({
    rate: '',
    effFromDate: '',
    effToDate: '',
    paramBands: Array(10).fill({ from: '', to: '' })
  });

  const [paramForm, setParamForm] = useState<CreateTariffParamInput>({
    paramCode: '',
    paramDescription: '',
    dataType: 'N',
    tableName: 'T_POL_ASSURED',
    columnName: '',
    whereCond: '1=1'
  });

  // --- DATA FETCHING ---

  const fetchData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [paramsRes, headersRes] = await Promise.all([
        tariffService.getParams(),
        tariffService.getHeaders(searchTerm, typeFilter === 'ALL' ? undefined : typeFilter)
      ]);

      if (paramsRes.success) {
        setParams(paramsRes.params);
      }
      if (headersRes.success) {
        setHeaders(headersRes.headers);
        if (headersRes.headers.length > 0) {
          const current = selectedHeader
            ? headersRes.headers.find((h) => h.mthCode === selectedHeader.mthCode && h.mthType === selectedHeader.mthType)
            : headersRes.headers[0];
          setSelectedHeader(current || headersRes.headers[0]);
        } else {
          setSelectedHeader(null);
          setDetails([]);
        }
      }
    } catch {
      setErrorMsg('Network error while connecting to tariff engine API.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDetails = async (code: string, type: string) => {
    setIsLoadingDetails(true);
    setSimResult(null);
    try {
      const res = await tariffService.getDetails(code, type);
      if (res.success) {
        setDetails(res.details);
      } else {
        setDetails([]);
      }
    } catch {
      setDetails([]);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchTerm, typeFilter]);

  useEffect(() => {
    if (selectedHeader) {
      fetchDetails(selectedHeader.mthCode, selectedHeader.mthType);
      const initialSim: { [key: string]: string } = {};
      selectedHeader.params.filter(Boolean).forEach((p) => {
        if (p) initialSim[p] = '';
      });
      setSimValues(initialSim);
    }
  }, [selectedHeader?.mthCode, selectedHeader?.mthType]);

  // Active parameter definitions for the selected header
  const activeParamsForSelectedHeader = (selectedHeader?.params || [])
    .map((code, index) => {
      if (!code) return null;
      const def = params.find((p) => p.paramCode === code);
      return {
        slotIndex: index,
        paramCode: code,
        paramDescription: def?.paramDescription || code,
        dataType: def?.dataType || 'N'
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  // --- SUBMISSIONS ---

  const handleCreateHeader = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headForm.mthCode.trim() || !headForm.mthDesc.trim()) {
      setErrorMsg('Tariff Code and Description are required.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const activeP = headForm.params.filter((p) => Boolean(p && p.trim()));
      const res = await tariffService.createHeader({
        ...headForm,
        mthCode: headForm.mthCode.toUpperCase().trim(),
        mthType: headForm.mthType.toUpperCase().trim(),
        params: activeP
      });
      if (res.success && res.header) {
        setSuccessMsg(`Tariff Matrix '${res.header.mthCode}' created successfully.`);
        setIsCreateHeadOpen(false);
        setHeadForm({
          mthCode: '',
          mthType: 'BASE',
          mthDesc: '',
          mthShortDesc: '',
          params: ['', '', ''],
          ratePer: '1000',
          effFromDate: '',
          effToDate: ''
        });
        await fetchData();
        setSelectedHeader(res.header);
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.message || 'Failed to create tariff header.');
      }
    } catch {
      setErrorMsg('Unexpected error creating tariff header.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditHeader = (headerToEdit?: TariffHeadRecord | null) => {
    const target = headerToEdit || selectedHeader;
    if (!target) return;

    const existingParams = target.params.filter((p): p is string => Boolean(p && p.trim()));
    setEditHeadForm({
      mthCode: target.mthCode,
      mthType: target.mthType,
      mthDesc: target.mthDesc,
      mthShortDesc: target.mthShortDesc || '',
      params: existingParams.length > 0 ? existingParams : [''],
      ratePer: target.ratePer || '1000',
      effFromDate: target.effFromDate ? target.effFromDate.slice(0, 10) : '',
      effToDate: target.effToDate ? target.effToDate.slice(0, 10) : ''
    });
    setErrorMsg(null);
    setIsEditHeadOpen(true);
  };

  const handleEditHeader = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editHeadForm.mthDesc.trim()) {
      setErrorMsg('Description is required.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const activeP = editHeadForm.params.filter((p) => Boolean(p && p.trim()));
      const res = await tariffService.updateHeader(editHeadForm.mthCode, editHeadForm.mthType, {
        mthDesc: editHeadForm.mthDesc.trim(),
        mthShortDesc: editHeadForm.mthShortDesc ? editHeadForm.mthShortDesc.trim() : null,
        ratePer: editHeadForm.ratePer,
        effFromDate: editHeadForm.effFromDate || null,
        effToDate: editHeadForm.effToDate || null,
        params: activeP
      });

      if (res.success && res.header) {
        setSuccessMsg(`Tariff '${res.header.mthCode}' parameters updated successfully.`);
        setIsEditHeadOpen(false);
        await fetchData();
        setSelectedHeader(res.header);
        await fetchDetails(res.header.mthCode, res.header.mthType);
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.message || 'Failed to update tariff parameters.');
      }
    } catch {
      setErrorMsg('Unexpected error updating tariff parameters.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCreateDetail = () => {
    if (!selectedHeader) return;
    const initialBands = Array(10)
      .fill(null)
      .map(() => ({ from: '', to: '' }));
    setDetailForm({
      rate: '',
      effFromDate: selectedHeader.effFromDate ? selectedHeader.effFromDate.slice(0, 10) : '',
      effToDate: selectedHeader.effToDate ? selectedHeader.effToDate.slice(0, 10) : '',
      paramBands: initialBands
    });
    setErrorMsg(null);
    setIsCreateDetailOpen(true);
  };

  const handleCreateDetail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHeader) return;
    if (!detailForm.rate.trim()) {
      setErrorMsg('Rate value is required.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const payload: CreateTariffDetailInput = {
        mthCode: selectedHeader.mthCode,
        mthType: selectedHeader.mthType,
        params: detailForm.paramBands.map((b) => ({
          from: b.from ? b.from.trim() : null,
          to: b.to ? b.to.trim() : null
        })),
        rate: detailForm.rate.trim(),
        effFromDate: detailForm.effFromDate || null,
        effToDate: detailForm.effToDate || null
      };

      const res = await tariffService.createDetail(payload);
      if (res.success) {
        setSuccessMsg('Tariff Rate band added successfully.');
        setIsCreateDetailOpen(false);
        await fetchDetails(selectedHeader.mthCode, selectedHeader.mthType);
        fetchData();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.message || 'Failed to save rate band.');
      }
    } catch {
      setErrorMsg('Unexpected error creating rate band.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateParam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paramForm.paramCode.trim() || !paramForm.paramDescription.trim()) {
      setErrorMsg('Parameter Code and Description are required.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await tariffService.createParam({
        ...paramForm,
        paramCode: paramForm.paramCode.toUpperCase().trim()
      });
      if (res.success) {
        setSuccessMsg(`Rating Parameter '${paramForm.paramCode.toUpperCase()}' registered.`);
        setIsCreateParamOpen(false);
        setParamForm({
          paramCode: '',
          paramDescription: '',
          dataType: 'N',
          tableName: 'T_POL_ASSURED',
          columnName: '',
          whereCond: '1=1'
        });
        const paramsRes = await tariffService.getParams();
        if (paramsRes.success) setParams(paramsRes.params);
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.message || 'Failed to register parameter.');
      }
    } catch {
      setErrorMsg('Error creating parameter.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      if (deleteTarget.type === 'head') {
        const res = await tariffService.deleteHeader(deleteTarget.id, deleteTarget.subId || 'BASE');
        if (res.success) {
          setSuccessMsg(`Tariff '${deleteTarget.id}' deleted.`);
          setIsDeleteConfirmOpen(false);
          await fetchData();
        } else {
          setErrorMsg(res.message || 'Failed to delete tariff.');
        }
      } else if (deleteTarget.type === 'detail') {
        const res = await tariffService.deleteDetail(deleteTarget.id);
        if (res.success) {
          setSuccessMsg('Rate band deleted.');
          setIsDeleteConfirmOpen(false);
          if (selectedHeader) {
            await fetchDetails(selectedHeader.mthCode, selectedHeader.mthType);
            fetchData();
          }
        } else {
          setErrorMsg(res.message || 'Failed to delete rate band.');
        }
      } else if (deleteTarget.type === 'param') {
        const res = await tariffService.deleteParam(deleteTarget.id);
        if (res.success) {
          setSuccessMsg(`Parameter '${deleteTarget.id}' removed.`);
          setIsDeleteConfirmOpen(false);
          const paramsRes = await tariffService.getParams();
          if (paramsRes.success) setParams(paramsRes.params);
        } else {
          setErrorMsg(res.message || 'Failed to remove parameter.');
        }
      }
    } catch {
      setErrorMsg('Error performing delete.');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  // --- RATE SIMULATOR LOGIC ---
  const handleSimulateRate = () => {
    if (!selectedHeader || details.length === 0) {
      setSimResult({ message: 'No tariff rate bands exist in this matrix to match against.' });
      return;
    }

    for (const d of details) {
      let isMatch = true;

      for (let i = 0; i < activeParamsForSelectedHeader.length; i++) {
        const pInfo = activeParamsForSelectedHeader[i];
        const enteredVal = simValues[pInfo.paramCode];
        if (enteredVal === undefined || enteredVal === '') {
          isMatch = false;
          break;
        }

        const band = d.params[pInfo.slotIndex];
        const fromVal = band?.from;
        const toVal = band?.to;

        if (pInfo.dataType === 'N') {
          const numInput = parseFloat(enteredVal);
          const numFrom = fromVal ? parseFloat(fromVal) : -Infinity;
          const numTo = toVal ? parseFloat(toVal) : Infinity;

          if (isNaN(numInput) || numInput < numFrom || numInput > numTo) {
            isMatch = false;
            break;
          }
        } else {
          if (fromVal && enteredVal.toUpperCase() !== fromVal.toUpperCase()) {
            isMatch = false;
            break;
          }
        }
      }

      if (isMatch) {
        setSimResult({
          matchedRate: d.rate,
          matchedDetailId: d.detailId,
          ratePer: selectedHeader.ratePer,
          message: `Exact Match Found: Rate is ${d.rate} (Rate Basis: Per ${selectedHeader.ratePer})`
        });
        return;
      }
    }

    setSimResult({
      message: 'No matching rate band found for the entered parameter values.'
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs font-medium text-slate-500">
        <Link to="/dashboard" className="hover:text-navy transition-colors">
          Dashboard
        </Link>
        <span className="text-slate-300">/</span>
        <span className="hover:text-navy transition-colors">Administration</span>
        <span className="text-slate-300">/</span>
        <span className="text-navy font-semibold">Rating Engine & Tariffs</span>
      </nav>

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-navy/10 text-navy flex items-center justify-center">
              <Calculator className="w-4 h-4 text-navy" />
            </div>
            <h1 className="text-2xl font-bold text-navy tracking-tight">Insurance Product Tariff Rates</h1>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Enterprise Life & Group Life Rating Engine (M_LIFE_TARIFF_HEAD, M_LIFE_TARIFF_DETAIL, M_LIFE_TARIFF_PARAM)
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchData}
            className="p-2.5 rounded-lg border border-slate-200 text-slate-600 hover:text-navy hover:bg-slate-50 transition-colors"
            title="Refresh All"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsCreateParamOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-navy text-xs font-semibold shadow-xs transition-all"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>New Parameter</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCreateHeadOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-navy hover:bg-navy-light text-white text-xs font-semibold shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Tariff Matrix</span>
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Tariff Matrices</span>
          <p className="text-2xl font-extrabold text-navy mt-1">{headers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <span className="text-xs font-semibold text-blue-600 uppercase">Active Parameters</span>
          <p className="text-2xl font-extrabold text-blue-700 mt-1">{params.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 uppercase">Rate Bands (Selected)</span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">{details.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <span className="text-xs font-semibold text-purple-600 uppercase">Rate Basis Mode</span>
          <p className="text-sm font-bold text-purple-800 mt-2">Per {selectedHeader?.ratePer || '1,000'} SA</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('tariffs')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'tariffs'
              ? 'border-navy text-navy bg-slate-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Tariff Matrices & Rate Grid</span>
          <span className="px-2 py-0.5 text-[10px] rounded-full bg-navy/10 text-navy font-bold">{headers.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('params')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'params'
              ? 'border-navy text-navy bg-slate-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Rating Parameters Dictionary</span>
          <span className="px-2 py-0.5 text-[10px] rounded-full bg-slate-200 text-slate-700 font-bold">{params.length}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TARIFF MATRICES & RATE DETAILS                                      */}
      {/* ========================================================================= */}
      {activeTab === 'tariffs' && (
        <div className="space-y-6">
          {/* Header Master Controls & List */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-navy">1. Select Tariff Table (M_LIFE_TARIFF_HEAD)</h3>
                <p className="text-xs text-text-secondary">
                  Choose an existing product tariff table to inspect, edit parameter dimensions, or update rate bands.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter tariffs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white"
                  />
                </div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy/20"
                >
                  <option value="ALL">All Types</option>
                  <option value="BASE">BASE</option>
                  <option value="RIDER">RIDER</option>
                  <option value="PREMIUM">PREMIUM</option>
                  <option value="SURRENDER">SURRENDER</option>
                </select>
              </div>
            </div>

            {/* Header Cards Carousel / Grid */}
            {isLoading ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-navy mb-2" />
                <span>Loading tariff matrix definitions...</span>
              </div>
            ) : headers.length === 0 ? (
              <div className="py-10 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">No tariff tables defined yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">Click "New Tariff Matrix" above to create your first rating table.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {headers.map((h) => {
                  const isSelected = selectedHeader?.mthCode === h.mthCode && selectedHeader?.mthType === h.mthType;
                  const activeCount = h.params.filter(Boolean).length;
                  return (
                    <div
                      key={`${h.mthCode}_${h.mthType}`}
                      onClick={() => setSelectedHeader(h)}
                      className={`cursor-pointer rounded-xl border p-4 transition-all relative ${
                        isSelected
                          ? 'border-navy bg-navy/5 shadow-xs ring-2 ring-navy/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-navy px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                              {h.mthCode}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                              {h.mthType}
                            </span>
                          </div>
                          <h4 className="font-bold text-xs text-slate-800 mt-1.5 line-clamp-1">{h.mthDesc}</h4>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditHeader(h);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-navy hover:bg-slate-100 transition-colors"
                            title="Edit Tariff & Add Parameters"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({ type: 'head', id: h.mthCode, subId: h.mthType, name: `${h.mthCode} (${h.mthDesc})` });
                              setIsDeleteConfirmOpen(true);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete Tariff Table"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                        <span>
                          Basis: <strong>Per {h.ratePer}</strong>
                        </span>
                        <span>
                          Bands: <strong className="text-navy">{h.detailCount || 0}</strong>
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {h.params.filter(Boolean).map((p, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                          >
                            {p}
                          </span>
                        ))}
                        {activeCount === 0 && <span className="text-[10px] text-slate-400 italic">No parameters configured</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Tariff Detail Table & Simulator */}
          {selectedHeader && (
            <div className="space-y-6">
              {/* Table details bar */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-navy px-2.5 py-0.5 rounded bg-navy/10 border border-navy/20">
                        {selectedHeader.mthCode}
                      </span>
                      <h3 className="font-bold text-base text-slate-900">{selectedHeader.mthDesc}</h3>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                        Rate Basis: Per {selectedHeader.ratePer} SA
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary mt-1">
                      <span>Active Parameter Dimensions ({activeParamsForSelectedHeader.length}):</span>
                      {activeParamsForSelectedHeader.map((p) => (
                        <span
                          key={p.paramCode}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-semibold text-[11px] border border-slate-200"
                        >
                          <Tag className="w-3 h-3 text-navy" />
                          <span>{p.paramCode}</span>
                          <span className="text-slate-500 font-normal">({p.paramDescription})</span>
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleOpenEditHeader(selectedHeader)}
                        className="text-[11px] font-bold text-navy hover:text-navy-light inline-flex items-center gap-1 px-2 py-0.5 rounded border border-dashed border-navy/40 hover:bg-navy/5 transition-colors ml-1"
                        title="Add or Change Parameters for this Tariff Table"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Parameter</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditHeader(selectedHeader)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-navy text-xs font-semibold shadow-xs transition-all"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Edit Tariff & Parameters</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenCreateDetail}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-navy hover:bg-navy-light text-white text-xs font-semibold shadow-xs transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Rate Band</span>
                    </button>
                  </div>
                </div>

                {/* RATE DETAILS GRID (M_LIFE_TARIFF_DETAIL) */}
                <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
                          <th className="py-2.5 px-4 w-12 text-center">#</th>
                          {activeParamsForSelectedHeader.map((p) => (
                            <th key={p.paramCode} className="py-2.5 px-4">
                              <div className="flex items-center gap-1 font-bold text-navy">
                                <span>{p.paramDescription}</span>
                                <span className="font-mono text-[10px] text-slate-500 font-normal">({p.paramCode})</span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-normal">
                                From &bull; To ({p.dataType === 'N' ? 'Numeric' : p.dataType === 'D' ? 'Date' : 'Code'})
                              </div>
                            </th>
                          ))}
                          <th className="py-2.5 px-4 font-bold text-navy">Tariff Rate</th>
                          <th className="py-2.5 px-4">Effective Dates</th>
                          <th className="py-2.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-text-main">
                        {isLoadingDetails ? (
                          <tr>
                            <td colSpan={3 + activeParamsForSelectedHeader.length} className="py-10 text-center text-slate-400">
                              <Loader2 className="w-5 h-5 animate-spin mx-auto text-navy mb-2" />
                              <span>Loading rate matrix details...</span>
                            </td>
                          </tr>
                        ) : details.length === 0 ? (
                          <tr>
                            <td colSpan={3 + activeParamsForSelectedHeader.length} className="py-8 text-center text-slate-400">
                              No rate bands configured for this tariff. Click "Add Rate Band" to populate values.
                            </td>
                          </tr>
                        ) : (
                          details.map((d, index) => {
                            const isSimMatched = simResult?.matchedDetailId === d.detailId;
                            return (
                              <tr
                                key={d.detailId || index}
                                className={`transition-colors ${
                                  isSimMatched ? 'bg-amber-100/70 border-l-4 border-l-amber-500' : 'hover:bg-slate-50/70'
                                }`}
                              >
                                <td className="py-2.5 px-4 text-center font-mono text-slate-400 text-[11px]">{index + 1}</td>
                                {activeParamsForSelectedHeader.map((p) => {
                                  const band = d.params[p.slotIndex];
                                  const from = band?.from || '-';
                                  const to = band?.to || '-';
                                  return (
                                    <td key={p.paramCode} className="py-2.5 px-4 font-mono text-slate-700">
                                      {from === to ? (
                                        <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold">{from}</span>
                                      ) : (
                                        <span>
                                          <strong className="text-slate-900">{from}</strong> &rarr;{' '}
                                          <strong className="text-slate-900">{to}</strong>
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="py-2.5 px-4 font-mono font-bold text-sm text-navy">
                                  {d.rate}
                                  <span className="text-[10px] text-slate-500 font-normal ml-1">/ {selectedHeader.ratePer}</span>
                                </td>
                                <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                                  {d.effFromDate || d.effToDate ? (
                                    <span>
                                      {d.effFromDate ? new Date(d.effFromDate).toLocaleDateString() : 'Initial'} &bull;{' '}
                                      {d.effToDate ? new Date(d.effToDate).toLocaleDateString() : 'Open'}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">Open-ended</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteTarget({
                                        type: 'detail',
                                        id: d.detailId,
                                        name: `Rate Band ${index + 1} (Rate: ${d.rate})`
                                      });
                                      setIsDeleteConfirmOpen(true);
                                    }}
                                    className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    title="Delete Rate Band"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
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
              </div>

              {/* INTERACTIVE RATE SIMULATOR & TESTER */}
              <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-2xl border border-blue-200/60 p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-navy font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Interactive Tariff Rate Simulator</span>
                </div>
                <p className="text-xs text-text-secondary">
                  Test and verify rate calculation for any transaction input against this active tariff matrix:
                </p>

                <div className="flex flex-wrap items-end gap-3 pt-1">
                  {activeParamsForSelectedHeader.map((p) => (
                    <div key={p.paramCode} className="w-36">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        {p.paramDescription} ({p.paramCode})
                      </label>
                      <input
                        type={p.dataType === 'N' ? 'number' : 'text'}
                        placeholder={p.dataType === 'N' ? 'e.g. 35' : 'e.g. M'}
                        value={simValues[p.paramCode] || ''}
                        onChange={(e) => setSimValues({ ...simValues, [p.paramCode]: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleSimulateRate}
                    className="px-4 py-2 rounded-lg bg-navy hover:bg-navy-light text-white text-xs font-semibold shadow-xs flex items-center gap-1.5"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Calculate / Match Rate</span>
                  </button>
                </div>

                {simResult && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs mt-3 flex items-start gap-2.5 ${
                      simResult.matchedRate
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    {simResult.matchedRate ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">{simResult.message}</p>
                      {simResult.matchedRate && (
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          Annual Premium Rate: <strong className="font-mono text-sm">{simResult.matchedRate}</strong> (Per{' '}
                          {simResult.ratePer} Sum Assured). Row highlighted in the rate table above.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RATING PARAMETERS DICTIONARY (M_LIFE_TARIFF_PARAM)                 */}
      {/* ========================================================================= */}
      {activeTab === 'params' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-navy">Rating Parameter Definitions (M_LIFE_TARIFF_PARAM)</h3>
              <p className="text-xs text-text-secondary">
                Configure rating dimensions available to all life insurance tariff matrices.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateParamOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-navy hover:bg-navy-light text-white text-xs font-semibold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Parameter</span>
            </button>
          </div>

          <div className="border border-slate-200/80 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <th className="py-3 px-4">Sr#</th>
                    <th className="py-3 px-4">Param Code</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-center">Data Type</th>
                    <th className="py-3 px-4">Source Table & Column</th>
                    <th className="py-3 px-4">Where Condition</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-text-main">
                  {params.map((p) => (
                    <tr key={p.paramCode} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400">{p.paramSrNo || '-'}</td>
                      <td className="py-3 px-4 font-mono font-bold text-navy">{p.paramCode}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{p.paramDescription}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.dataType === 'N'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : p.dataType === 'D'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {p.dataType === 'N' ? 'Numeric (N)' : p.dataType === 'D' ? 'Date (D)' : 'Character (C)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                        {p.tableName && p.columnName ? `${p.tableName}.${p.columnName}` : '-'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">{p.whereCond || '1=1'}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget({ type: 'param', id: p.paramCode, name: `${p.paramCode} (${p.paramDescription})` });
                            setIsDeleteConfirmOpen(true);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete Parameter"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE TARIFF HEADER                                               */}
      {/* ========================================================================= */}
      {isCreateHeadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-navy text-white flex items-center justify-between">
              <h3 className="font-bold text-sm tracking-wide">Create New Tariff Matrix (M_LIFE_TARIFF_HEAD)</h3>
              <button
                type="button"
                onClick={() => setIsCreateHeadOpen(false)}
                className="text-slate-300 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateHeader} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Tariff Code (MTH_CODE)<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MORT_TERM_01"
                    value={headForm.mthCode}
                    onChange={(e) => setHeadForm({ ...headForm, mthCode: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Tariff Type (MTH_TYPE)<span className="text-red-500">*</span>
                  </label>
                  <select
                    value={headForm.mthType}
                    onChange={(e) => setHeadForm({ ...headForm, mthType: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy/20"
                  >
                    <option value="BASE">BASE (Base Plan Rate)</option>
                    <option value="RIDER">RIDER (Supplementary Rider)</option>
                    <option value="PREMIUM">PREMIUM (Gross Premium Factor)</option>
                    <option value="SURRENDER">SURRENDER (Surrender Value Factor)</option>
                    <option value="DISCOUNT">DISCOUNT (High Sum Assured Rebate)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Full Description<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Standard Individual Term Life Mortality Rates 2026"
                    value={headForm.mthDesc}
                    onChange={(e) => setHeadForm({ ...headForm, mthDesc: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Short Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Term Mortality"
                    value={headForm.mthShortDesc || ''}
                    onChange={(e) => setHeadForm({ ...headForm, mthShortDesc: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Rate Basis (MTH_RATE_PER)</label>
                  <select
                    value={headForm.ratePer}
                    onChange={(e) => setHeadForm({ ...headForm, ratePer: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
                  >
                    <option value="1000">1000 (Per 1,000 Sum Assured - Standard Life)</option>
                    <option value="100">100 (Percentage % of Sum Assured)</option>
                    <option value="1">1 (Per 1 Unit)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Effective From Date</label>
                  <input
                    type="date"
                    value={headForm.effFromDate || ''}
                    onChange={(e) => setHeadForm({ ...headForm, effFromDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Effective To Date</label>
                  <input
                    type="date"
                    value={headForm.effToDate || ''}
                    onChange={(e) => setHeadForm({ ...headForm, effToDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Parameter Slots with dynamic Add */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="block text-xs font-bold text-navy">Rating Parameter Dimensions (Slots 1 to 10)</span>
                    <p className="text-[11px] text-slate-500">
                      Assign parameter dimensions in sequence for this matrix (e.g. Parameter 1 = AGE, Parameter 2 = TERM).
                    </p>
                  </div>
                  {headForm.params.length < 10 && (
                    <button
                      type="button"
                      onClick={() => setHeadForm({ ...headForm, params: [...headForm.params, ''] })}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-navy/10 text-navy hover:bg-navy/20 text-xs font-bold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Parameter Slot</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  {headForm.params.map((val, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="w-14 text-[11px] font-bold text-navy">Slot {idx + 1}:</span>
                      <select
                        value={val || ''}
                        onChange={(e) => {
                          const updated = [...headForm.params];
                          updated[idx] = e.target.value;
                          setHeadForm({ ...headForm, params: updated });
                        }}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none"
                      >
                        <option value="">-- None --</option>
                        {params.map((p) => (
                          <option key={p.paramCode} value={p.paramCode}>
                            {p.paramCode} - {p.paramDescription}
                          </option>
                        ))}
                      </select>
                      {headForm.params.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = headForm.params.filter((_, i) => i !== idx);
                            setHeadForm({ ...headForm, params: updated });
                          }}
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateHeadOpen(false)}
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
                  <span>Save Tariff Matrix</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT TARIFF HEADER & PARAMETERS                                     */}
      {/* ========================================================================= */}
      {isEditHeadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-navy text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm tracking-wide">Edit Tariff & Parameters: {editHeadForm.mthCode}</h3>
                <span className="text-[11px] text-slate-300">Update table metadata and add or adjust rating dimensions</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditHeadOpen(false)}
                className="text-slate-300 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleEditHeader} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Tariff Code (Readonly)</label>
                  <input
                    type="text"
                    disabled
                    value={editHeadForm.mthCode}
                    className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-mono font-bold cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Tariff Type (Readonly)</label>
                  <input
                    type="text"
                    disabled
                    value={editHeadForm.mthType}
                    className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-bold cursor-not-allowed"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Full Description<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editHeadForm.mthDesc}
                    onChange={(e) => setEditHeadForm({ ...editHeadForm, mthDesc: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Short Description</label>
                  <input
                    type="text"
                    value={editHeadForm.mthShortDesc}
                    onChange={(e) => setEditHeadForm({ ...editHeadForm, mthShortDesc: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Rate Basis (MTH_RATE_PER)</label>
                  <select
                    value={editHeadForm.ratePer}
                    onChange={(e) => setEditHeadForm({ ...editHeadForm, ratePer: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
                  >
                    <option value="1000">1000 (Per 1,000 Sum Assured - Standard Life)</option>
                    <option value="100">100 (Percentage % of Sum Assured)</option>
                    <option value="1">1 (Per 1 Unit)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Effective From Date</label>
                  <input
                    type="date"
                    value={editHeadForm.effFromDate}
                    onChange={(e) => setEditHeadForm({ ...editHeadForm, effFromDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Effective To Date</label>
                  <input
                    type="date"
                    value={editHeadForm.effToDate}
                    onChange={(e) => setEditHeadForm({ ...editHeadForm, effToDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Parameter Dimensions Management (Slots 1 to 10) */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="block text-xs font-bold text-navy">Rating Parameter Dimensions (Slots 1 to 10)</span>
                    <p className="text-[11px] text-slate-500">
                      Configure dimensions for this tariff table. Adding a parameter immediately creates a new column in the Rate Grid.
                    </p>
                  </div>
                  {editHeadForm.params.length < 10 && (
                    <button
                      type="button"
                      onClick={() => setEditHeadForm({ ...editHeadForm, params: [...editHeadForm.params, ''] })}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-navy/10 text-navy hover:bg-navy/20 text-xs font-bold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Parameter Dimension</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2.5 mt-3">
                  {editHeadForm.params.map((val, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="w-16 text-xs font-bold text-navy flex-shrink-0">Slot {idx + 1}:</span>
                      <select
                        value={val || ''}
                        onChange={(e) => {
                          const copy = [...editHeadForm.params];
                          copy[idx] = e.target.value;
                          setEditHeadForm({ ...editHeadForm, params: copy });
                        }}
                        className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20"
                      >
                        <option value="">-- Select Parameter from Dictionary --</option>
                        {params.map((p) => (
                          <option key={p.paramCode} value={p.paramCode}>
                            {p.paramCode} - {p.paramDescription} ({p.dataType === 'N' ? 'Numeric' : p.dataType === 'D' ? 'Date' : 'Code'})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const copy = editHeadForm.params.filter((_, i) => i !== idx);
                          setEditHeadForm({ ...editHeadForm, params: copy });
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Remove Parameter Slot"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {editHeadForm.params.length === 0 && (
                    <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                      No parameters selected. Click "Add Parameter Dimension" to attach parameters from the dictionary.
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditHeadOpen(false)}
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
      {/* MODAL: ADD RATE BAND DETAIL                                               */}
      {/* ========================================================================= */}
      {isCreateDetailOpen && selectedHeader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-navy text-white flex items-center justify-between">
              <h3 className="font-bold text-sm tracking-wide">Add Rate Band: {selectedHeader.mthCode}</h3>
              <button
                type="button"
                onClick={() => setIsCreateDetailOpen(false)}
                className="text-slate-300 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateDetail} className="p-6 space-y-4">
              <div className="space-y-3">
                <span className="block text-xs font-bold text-navy">Parameter Range Values</span>
                {activeParamsForSelectedHeader.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    No active parameters configured on this header. Rate applies unconditionally.
                  </p>
                ) : (
                  activeParamsForSelectedHeader.map((p) => {
                    const band = detailForm.paramBands[p.slotIndex] || { from: '', to: '' };
                    return (
                      <div key={p.paramCode} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                        <span className="block text-xs font-bold text-slate-800">
                          {p.paramDescription} ({p.paramCode})
                        </span>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-0.5">From Value</label>
                            <input
                              type="text"
                              placeholder={p.dataType === 'N' ? 'e.g. 18' : 'e.g. M'}
                              value={band.from}
                              onChange={(e) => {
                                const copy = [...detailForm.paramBands];
                                copy[p.slotIndex] = { ...copy[p.slotIndex], from: e.target.value };
                                setDetailForm({ ...detailForm, paramBands: copy });
                              }}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-0.5">To Value</label>
                            <input
                              type="text"
                              placeholder={p.dataType === 'N' ? 'e.g. 25' : 'e.g. M'}
                              value={band.to}
                              onChange={(e) => {
                                const copy = [...detailForm.paramBands];
                                copy[p.slotIndex] = { ...copy[p.slotIndex], to: e.target.value };
                                setDetailForm({ ...detailForm, paramBands: copy });
                              }}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Tariff Rate (MTD_RATE)<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2.45"
                    value={detailForm.rate}
                    onChange={(e) => setDetailForm({ ...detailForm, rate: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold text-navy bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Basis: Per {selectedHeader.ratePer}</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Effective From</label>
                  <input
                    type="date"
                    value={detailForm.effFromDate}
                    onChange={(e) => setDetailForm({ ...detailForm, effFromDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Effective To</label>
                  <input
                    type="date"
                    value={detailForm.effToDate}
                    onChange={(e) => setDetailForm({ ...detailForm, effToDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateDetailOpen(false)}
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
                  <span>Save Rate Band</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE RATING PARAMETER                                            */}
      {/* ========================================================================= */}
      {isCreateParamOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-navy text-white flex items-center justify-between">
              <h3 className="font-bold text-sm tracking-wide">Register New Parameter (M_LIFE_TARIFF_PARAM)</h3>
              <button
                type="button"
                onClick={() => setIsCreateParamOpen(false)}
                className="text-slate-300 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateParam} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-main mb-1">
                  Parameter Code (MTP_PARAM)<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SMOKER, OCCUPATION, SUM_ASSURED"
                  value={paramForm.paramCode}
                  onChange={(e) => setParamForm({ ...paramForm, paramCode: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-main mb-1">
                  Parameter Description<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Smoking Status (Non-Smoker / Smoker)"
                  value={paramForm.paramDescription}
                  onChange={(e) => setParamForm({ ...paramForm, paramDescription: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-main mb-1">Data Type (MTP_DATA_TYPE)</label>
                <select
                  value={paramForm.dataType}
                  onChange={(e) => setParamForm({ ...paramForm, dataType: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
                >
                  <option value="N">Numeric (N) - For Age, Term, Sum Assured ranges</option>
                  <option value="C">Character (C) - For Gender, Smoker, Category codes</option>
                  <option value="D">Date (D) - For Date ranges</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Source Table</label>
                  <input
                    type="text"
                    placeholder="e.g. T_POL_ASSURED"
                    value={paramForm.tableName || ''}
                    onChange={(e) => setParamForm({ ...paramForm, tableName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Source Column</label>
                  <input
                    type="text"
                    placeholder="e.g. PAS_SMOKING_FLAG"
                    value={paramForm.columnName || ''}
                    onChange={(e) => setParamForm({ ...paramForm, columnName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-main mb-1">Where Condition</label>
                <input
                  type="text"
                  placeholder="1=1"
                  value={paramForm.whereCond || ''}
                  onChange={(e) => setParamForm({ ...paramForm, whereCond: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono text-[11px]"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateParamOpen(false)}
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
                  <span>Save Parameter</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE CONFIRMATION                                                */}
      {/* ========================================================================= */}
      {isDeleteConfirmOpen && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-center text-navy mb-2">Confirm Delete</h3>
            <p className="text-xs text-center text-slate-500 mb-4">
              Are you sure you want to delete <strong className="text-navy">{deleteTarget.name}</strong>?
              {deleteTarget.type === 'head' && (
                <span className="block mt-1 text-red-600 font-semibold">
                  Warning: All associated rate details in M_LIFE_TARIFF_DETAIL will also be removed.
                </span>
              )}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
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
