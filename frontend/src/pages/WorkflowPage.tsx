import React, { useState, useEffect, useMemo } from 'react';
import {
  GitBranch,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit3,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Save,
  ShieldCheck,
  Clock,
  DollarSign,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Info,
  Layers,
  FileCheck2,
  Users,
  Send,
  Sliders,
  Check,
  X
} from 'lucide-react';
import { workflowService } from '../services/workflowService';
import {
  WorkflowHead,
  WorkflowLevel,
  WorkflowFormData,
  WorkflowCategory,
  LookupItem,
  UserGroupItem
} from '../types/workflow';

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  NEW_BUSINESS: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  UNDERWRITING: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  POLICY_ADMIN: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  CLAIMS: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  FINANCE: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' }
};

const emptyFormData: WorkflowFormData = {
  WF_CODE: '',
  WF_NAME: '',
  WF_CATEGORY: 'NEW_BUSINESS',
  WF_DESC: '',
  WF_TOTAL_LEVELS: 1,
  WF_ALLOW_AUTO_APPROVAL_YN: 'N',
  WF_AUTO_APPROVAL_LIMIT: 0,
  IS_ACTIVE: 'Y',
  levels: [
    {
      WFL_LEVEL_NO: 1,
      WFL_LEVEL_NAME: 'Initial Verification',
      WFL_ROLE_CODE: 'MAKER',
      WFL_USER_GROUP: 'DEUSER',
      WFL_MIN_AMOUNT: 0,
      WFL_MAX_AMOUNT: null,
      WFL_SLA_HOURS: 24,
      WFL_ALLOW_REJECT_YN: 'Y',
      WFL_ALLOW_REWORK_YN: 'Y',
      WFL_MANDATORY_DOC_YN: 'Y',
      WFL_AUTO_ESCALATE_HOURS: 48,
      IS_ACTIVE: 'Y'
    }
  ]
};

export const WorkflowPage: React.FC = () => {
  // Page mode: 'list' | 'create' | 'edit'
  const [pageMode, setPageMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedWfCode, setSelectedWfCode] = useState<string | null>(null);

  // Data states
  const [workflows, setWorkflows] = useState<WorkflowHead[]>([]);
  const [categories, setCategories] = useState<LookupItem[]>([]);
  const [roles, setRoles] = useState<LookupItem[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroupItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Filter & Search states
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Form State
  const [formData, setFormData] = useState<WorkflowFormData>(emptyFormData);
  const [formAudit, setFormAudit] = useState<{
    createdBy?: string;
    createdOn?: string;
    modifiedBy?: string | null;
    modifiedOn?: string | null;
  }>({});

  // Status banners
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Load Workflows List
  const loadWorkflows = async () => {
    setIsLoading(true);
    try {
      const data = await workflowService.getWorkflows(
        categoryFilter === 'ALL' ? undefined : categoryFilter,
        searchTerm
      );
      if (data.success && data.workflows) {
        setWorkflows(data.workflows);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to load workflows'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load Metadata Lookups
  const loadLookups = async () => {
    try {
      const res = await workflowService.getLookups();
      if (res.success) {
        setCategories(res.categories);
        setRoles(res.roles);
        if (res.userGroups) {
          setUserGroups(res.userGroups);
        }
      }
    } catch (err: any) {
      console.error('Error fetching lookups:', err);
    }
  };

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    if (pageMode === 'list') {
      loadWorkflows();
    }
  }, [categoryFilter, searchTerm, pageMode]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = workflows.length;
    const active = workflows.filter(w => w.IS_ACTIVE === 'Y').length;
    const totalLevels = workflows.reduce((acc, curr) => acc + (curr.LEVELS_COUNT || curr.WF_TOTAL_LEVELS || 0), 0);
    const autoApprCount = workflows.filter(w => w.WF_ALLOW_AUTO_APPROVAL_YN === 'Y').length;
    return { total, active, totalLevels, autoApprCount };
  }, [workflows]);

  // Open Create Mode (In-Page)
  const handleOpenCreate = () => {
    setFormData({
      ...emptyFormData,
      levels: [
        {
          WFL_LEVEL_NO: 1,
          WFL_LEVEL_NAME: 'Initial Verification',
          WFL_ROLE_CODE: 'MAKER',
          WFL_USER_GROUP: 'DEUSER',
          WFL_MIN_AMOUNT: 0,
          WFL_MAX_AMOUNT: null,
          WFL_SLA_HOURS: 24,
          WFL_ALLOW_REJECT_YN: 'Y',
          WFL_ALLOW_REWORK_YN: 'Y',
          WFL_MANDATORY_DOC_YN: 'Y',
          WFL_AUTO_ESCALATE_HOURS: 48,
          IS_ACTIVE: 'Y'
        }
      ]
    });
    setFormAudit({});
    setSelectedWfCode(null);
    setFeedback(null);
    setPageMode('create');
  };

  // Open Edit Mode (In-Page)
  const handleOpenEdit = async (wfCode: string) => {
    setIsDetailLoading(true);
    setFeedback(null);
    try {
      const res = await workflowService.getWorkflowByCode(wfCode);
      if (res.success && res.workflow) {
        const { head, levels } = res.workflow;
        setFormData({
          WF_CODE: head.WF_CODE,
          WF_NAME: head.WF_NAME,
          WF_CATEGORY: head.WF_CATEGORY,
          WF_DESC: head.WF_DESC || '',
          WF_TOTAL_LEVELS: head.WF_TOTAL_LEVELS,
          WF_ALLOW_AUTO_APPROVAL_YN: head.WF_ALLOW_AUTO_APPROVAL_YN,
          WF_AUTO_APPROVAL_LIMIT: head.WF_AUTO_APPROVAL_LIMIT || 0,
          IS_ACTIVE: head.IS_ACTIVE,
          levels: levels.map((l, idx) => ({
            ...l,
            WFL_LEVEL_NO: idx + 1
          }))
        });
        setFormAudit({
          createdBy: head.CREATED_BY,
          createdOn: head.CREATED_ON,
          modifiedBy: head.MODIFIED_BY,
          modifiedOn: head.MODIFIED_ON
        });
        setSelectedWfCode(wfCode);
        setPageMode('edit');
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to load workflow details'
      });
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Add Level
  const handleAddLevel = () => {
    const nextNo = formData.levels.length + 1;
    const newLevel: WorkflowLevel = {
      WFL_LEVEL_NO: nextNo,
      WFL_LEVEL_NAME: `Approval Stage ${nextNo}`,
      WFL_ROLE_CODE: nextNo === 2 ? 'CHECKER' : nextNo === 3 ? 'SR_UNDERWRITER' : 'ADMIN',
      WFL_USER_GROUP: nextNo === 2 ? 'UWUSER' : nextNo === 3 ? 'UWMGR' : 'POLICY_ADMIN',
      WFL_MIN_AMOUNT: 0,
      WFL_MAX_AMOUNT: null,
      WFL_SLA_HOURS: 24,
      WFL_ALLOW_REJECT_YN: 'Y',
      WFL_ALLOW_REWORK_YN: 'Y',
      WFL_MANDATORY_DOC_YN: 'N',
      WFL_AUTO_ESCALATE_HOURS: 48,
      IS_ACTIVE: 'Y'
    };

    setFormData(prev => ({
      ...prev,
      WF_TOTAL_LEVELS: nextNo,
      levels: [...prev.levels, newLevel]
    }));
  };

  // Remove Level
  const handleRemoveLevel = (index: number) => {
    if (formData.levels.length <= 1) {
      setFeedback({
        type: 'info',
        message: 'A workflow must have at least one approval level.'
      });
      return;
    }
    const filtered = formData.levels.filter((_, i) => i !== index);
    const reindexed = filtered.map((l, i) => ({ ...l, WFL_LEVEL_NO: i + 1 }));
    setFormData(prev => ({
      ...prev,
      WF_TOTAL_LEVELS: reindexed.length,
      levels: reindexed
    }));
  };

  // Move Level Up
  const handleMoveLevelUp = (index: number) => {
    if (index === 0) return;
    const newLevels = [...formData.levels];
    const temp = newLevels[index - 1];
    newLevels[index - 1] = newLevels[index];
    newLevels[index] = temp;
    const reindexed = newLevels.map((l, i) => ({ ...l, WFL_LEVEL_NO: i + 1 }));
    setFormData(prev => ({ ...prev, levels: reindexed }));
  };

  // Move Level Down
  const handleMoveLevelDown = (index: number) => {
    if (index === formData.levels.length - 1) return;
    const newLevels = [...formData.levels];
    const temp = newLevels[index + 1];
    newLevels[index + 1] = newLevels[index];
    newLevels[index] = temp;
    const reindexed = newLevels.map((l, i) => ({ ...l, WFL_LEVEL_NO: i + 1 }));
    setFormData(prev => ({ ...prev, levels: reindexed }));
  };

  // Update specific level field
  const handleLevelChange = (index: number, field: keyof WorkflowLevel, value: any) => {
    const updated = [...formData.levels];
    updated[index] = { ...updated[index], [field]: value };
    setFormData(prev => ({ ...prev, levels: updated }));
  };

  // Save Workflow
  const handleSaveWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    // Validation
    if (!formData.WF_CODE || !formData.WF_CODE.trim()) {
      setFeedback({ type: 'error', message: 'Workflow Code is required.' });
      return;
    }
    if (!formData.WF_NAME || !formData.WF_NAME.trim()) {
      setFeedback({ type: 'error', message: 'Workflow Name is required.' });
      return;
    }
    if (!formData.levels || formData.levels.length === 0) {
      setFeedback({ type: 'error', message: 'At least one approval stage is required.' });
      return;
    }

    for (let i = 0; i < formData.levels.length; i++) {
      const l = formData.levels[i];
      if (!l.WFL_LEVEL_NAME || !l.WFL_LEVEL_NAME.trim()) {
        setFeedback({ type: 'error', message: `Stage ${i + 1} Name cannot be empty.` });
        return;
      }
      if (!l.WFL_ROLE_CODE) {
        setFeedback({ type: 'error', message: `Stage ${i + 1} must have a designated Role.` });
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload: WorkflowFormData = {
        ...formData,
        WF_CODE: formData.WF_CODE.trim().toUpperCase(),
        WF_NAME: formData.WF_NAME.trim(),
        WF_TOTAL_LEVELS: formData.levels.length,
        levels: formData.levels.map((l, idx) => ({
          ...l,
          WFL_LEVEL_NO: idx + 1,
          WFL_LEVEL_NAME: l.WFL_LEVEL_NAME.trim(),
          WFL_ROLE_CODE: l.WFL_ROLE_CODE.trim().toUpperCase(),
          WFL_MIN_AMOUNT: l.WFL_MIN_AMOUNT !== undefined && l.WFL_MIN_AMOUNT !== null ? Number(l.WFL_MIN_AMOUNT) : 0,
          WFL_MAX_AMOUNT: l.WFL_MAX_AMOUNT !== undefined && l.WFL_MAX_AMOUNT !== null && l.WFL_MAX_AMOUNT !== ('' as any) ? Number(l.WFL_MAX_AMOUNT) : null,
          WFL_SLA_HOURS: Number(l.WFL_SLA_HOURS) || 24,
          WFL_AUTO_ESCALATE_HOURS: Number(l.WFL_AUTO_ESCALATE_HOURS) || 48
        }))
      };

      if (pageMode === 'create') {
        const res = await workflowService.createWorkflow(payload);
        setFeedback({
          type: 'success',
          message: `Workflow '${res.workflow.head.WF_CODE}' created successfully!`
        });
        setPageMode('list');
      } else {
        const res = await workflowService.updateWorkflow(formData.WF_CODE, payload);
        setFeedback({
          type: 'success',
          message: `Workflow '${res.workflow.head.WF_CODE}' updated successfully!`
        });
        setPageMode('list');
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to save workflow.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Workflow
  const handleDeleteWorkflow = async (wfCode: string) => {
    if (!window.confirm(`Are you sure you want to delete workflow '${wfCode}' and all its approval stages? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await workflowService.deleteWorkflow(wfCode);
      setFeedback({
        type: 'success',
        message: res.message || `Workflow '${wfCode}' deleted successfully.`
      });
      if (pageMode !== 'list') {
        setPageMode('list');
      } else {
        loadWorkflows();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || `Failed to delete workflow '${wfCode}'.`
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div>
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
            <span>Administration</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-blue-600 font-medium">Workflow Configuration</span>
            {pageMode !== 'list' && (
              <>
                <ChevronRight className="w-4 h-4" />
                <span className="text-gray-700 font-semibold">
                  {pageMode === 'create' ? 'New Workflow' : `Edit: ${formData.WF_CODE}`}
                </span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <GitBranch className="w-7 h-7 text-blue-600" />
            Life Insurance Workflow Configurator
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure multi-tier approval processes, SLA thresholds, and authorization matrix for core insurance transactions.
          </p>
        </div>

        {pageMode === 'list' ? (
          <div className="flex items-center gap-3">
            <button
              onClick={loadWorkflows}
              className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 rounded-lg transition-colors"
              title="Refresh Workflows"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-all"
            >
              <Plus className="w-5 h-5" />
              <span>Create New Workflow</span>
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
              <span>Back to Workflows</span>
            </button>
            {pageMode === 'edit' && (
              <button
                type="button"
                onClick={() => handleDeleteWorkflow(formData.WF_CODE)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg font-medium transition-colors"
                title="Delete this workflow"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Delete</span>
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
      {/* VIEW 1: WORKFLOW LIST & OVERVIEW DASHBOARD */}
      {/* ========================================================================= */}
      {pageMode === 'list' && (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Workflows</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.total}</p>
                <span className="text-xs text-blue-600 font-medium">Core business processes</span>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <GitBranch className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Status</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{metrics.active} / {metrics.total}</p>
                <span className="text-xs text-gray-500 font-medium">In production routing</span>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Approval Stages</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">{metrics.totalLevels}</p>
                <span className="text-xs text-gray-500 font-medium">Total configurable gates</span>
              </div>
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <Layers className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Auto-Approvals</p>
                <p className="text-2xl font-bold text-indigo-600 mt-1">{metrics.autoApprCount}</p>
                <span className="text-xs text-indigo-600 font-medium">Threshold STP enabled</span>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <FileCheck2 className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    categoryFilter === 'ALL'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All Categories
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.code}
                    onClick={() => setCategoryFilter(cat.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      categoryFilter === cat.code
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat.label.split('/')[0]}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search code or process name..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

          {/* Workflow Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Workflow Process</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4 text-center">Approval Pipeline</th>
                    <th className="py-3.5 px-4 text-center">STP / Auto Appr.</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4">Audit Created</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-500">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                        <span>Loading workflow definitions...</span>
                      </td>
                    </tr>
                  ) : workflows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-500">
                        <GitBranch className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="font-medium text-gray-700">No workflows found matching your filter</p>
                        <p className="text-xs text-gray-400 mt-1">Try resetting the search or category filters</p>
                      </td>
                    </tr>
                  ) : (
                    workflows.map(wf => {
                      const catStyle = CATEGORY_COLORS[wf.WF_CATEGORY] || {
                        bg: 'bg-gray-50',
                        text: 'text-gray-700',
                        border: 'border-gray-200'
                      };
                      const levelCount = wf.LEVELS_COUNT !== undefined ? wf.LEVELS_COUNT : wf.WF_TOTAL_LEVELS;

                      return (
                        <tr
                          key={wf.WF_CODE}
                          className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                          onClick={() => handleOpenEdit(wf.WF_CODE)}
                        >
                          <td className="py-4 px-4">
                            <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                              {wf.WF_NAME}
                            </div>
                            <div className="text-xs font-mono text-gray-400 mt-0.5">
                              {wf.WF_CODE}
                            </div>
                            {wf.WF_DESC && (
                              <div className="text-xs text-gray-500 line-clamp-1 mt-1 max-w-md">
                                {wf.WF_DESC}
                              </div>
                            )}
                          </td>

                          <td className="py-4 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                            >
                              {wf.WF_CATEGORY.replace('_', ' ')}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold border border-purple-100">
                              <Layers className="w-3.5 h-3.5" />
                              <span>{levelCount} {levelCount === 1 ? 'Stage' : 'Stages'}</span>
                            </div>
                          </td>

                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            {wf.WF_ALLOW_AUTO_APPROVAL_YN === 'Y' ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <Check className="w-3.5 h-3.5" />
                                <span>&le; {Number(wf.WF_AUTO_APPROVAL_LIMIT || 0).toLocaleString()}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Manual Only</span>
                            )}
                          </td>

                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            {wf.IS_ACTIVE === 'Y' ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-500 font-medium bg-gray-100 px-2.5 py-1 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                Inactive
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-4 whitespace-nowrap text-xs text-gray-500">
                            <div>{wf.CREATED_BY || 'SYSTEM'}</div>
                            <div className="text-gray-400">{wf.CREATED_ON ? String(wf.CREATED_ON).split(' ')[0] : '-'}</div>
                          </td>

                          <td
                            className="py-4 px-4 text-right whitespace-nowrap"
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenEdit(wf.WF_CODE)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Configure Stages"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteWorkflow(wf.WF_CODE)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Workflow"
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
      {/* VIEW 2: IN-PAGE WORKFLOW & MULTI-LEVEL APPROVAL CONFIGURATOR */}
      {/* ========================================================================= */}
      {pageMode !== 'list' && (
        <form onSubmit={handleSaveWorkflow} noValidate className="space-y-6">
          {/* Section 1: Workflow General Settings */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">General Workflow Settings</h2>
                  <p className="text-xs text-gray-500">Define the core business event identifier and auto-approval rules</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.IS_ACTIVE === 'Y'}
                    onChange={e => setFormData(prev => ({ ...prev, IS_ACTIVE: e.target.checked ? 'Y' : 'N' }))}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span>Active in System</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Workflow Code */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Workflow Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={pageMode === 'edit'}
                  placeholder="e.g. WF_PROP_CREATE"
                  value={formData.WF_CODE}
                  onChange={e => setFormData(prev => ({ ...prev, WF_CODE: e.target.value.toUpperCase() }))}
                  className={`w-full px-3.5 py-2.5 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    pageMode === 'edit' ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' : 'border-gray-200'
                  }`}
                />
                <p className="text-xs text-gray-400 mt-1">Unique system identifier for the process</p>
              </div>

              {/* Workflow Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Workflow Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Proposal Creation & Validation"
                  value={formData.WF_NAME}
                  onChange={e => setFormData(prev => ({ ...prev, WF_NAME: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Descriptive business process title</p>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Category / Module <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.WF_CATEGORY}
                  onChange={e => setFormData(prev => ({ ...prev, WF_CATEGORY: e.target.value as WorkflowCategory }))}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Parent life insurance functional module</p>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Description & Purpose
              </label>
              <textarea
                rows={2}
                placeholder="Explain the business context, verification criteria, and transition gates for this workflow..."
                value={formData.WF_DESC || ''}
                onChange={e => setFormData(prev => ({ ...prev, WF_DESC: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Auto-Approval STP Settings */}
            <div className="p-4 bg-gray-50/80 rounded-xl border border-gray-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="auto_appr_check"
                  checked={formData.WF_ALLOW_AUTO_APPROVAL_YN === 'Y'}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    WF_ALLOW_AUTO_APPROVAL_YN: e.target.checked ? 'Y' : 'N'
                  }))}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <label htmlFor="auto_appr_check" className="text-sm font-semibold text-gray-800 cursor-pointer">
                    Enable Straight-Through-Processing (STP / Auto-Approval)
                  </label>
                  <p className="text-xs text-gray-500">
                    Bypasses manual underwriting/approval stages when transaction amount falls within threshold.
                  </p>
                </div>
              </div>

              {formData.WF_ALLOW_AUTO_APPROVAL_YN === 'Y' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    Max STP Limit ($):
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.WF_AUTO_APPROVAL_LIMIT || 0}
                    onChange={e => setFormData(prev => ({
                      ...prev,
                      WF_AUTO_APPROVAL_LIMIT: parseFloat(e.target.value) || 0
                    }))}
                    className="w-36 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Multi-Level Approval Pipeline (Visual Stepper & Table) */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Multi-Level Approval Pipeline</h2>
                  <p className="text-xs text-gray-500">Configure sequential review stages, role responsibilities, limits, and SLAs</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddLevel}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold border border-purple-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Approval Stage</span>
              </button>
            </div>

            {/* Visual Process Stepper */}
            <div className="p-4 bg-gradient-to-r from-blue-50/50 via-purple-50/30 to-indigo-50/50 rounded-xl border border-blue-100 overflow-x-auto">
              <div className="flex items-center gap-3 min-w-max py-2">
                {formData.levels.map((lvl, index) => {
                  const roleObj = roles.find(r => r.code === lvl.WFL_ROLE_CODE);
                  return (
                    <React.Fragment key={index}>
                      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                          {lvl.WFL_LEVEL_NO}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-900 line-clamp-1">
                            {lvl.WFL_LEVEL_NAME || `Stage ${lvl.WFL_LEVEL_NO}`}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {lvl.WFL_USER_GROUP || 'ADMIN'}
                            </span>
                            <span className="text-xs text-blue-600 font-medium truncate max-w-[120px]">
                              {roleObj ? roleObj.label : lvl.WFL_ROLE_CODE}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{lvl.WFL_SLA_HOURS || 24}h SLA</span>
                          </div>
                        </div>
                      </div>
                      {index < formData.levels.length - 1 && (
                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Configurable Stages Table */}
            <div className="space-y-4">
              {formData.levels.map((level, index) => (
                <div
                  key={index}
                  className="p-5 rounded-xl border border-gray-200 bg-white hover:border-blue-300 transition-all shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                        {level.WFL_LEVEL_NO}
                      </span>
                      <span className="text-sm font-bold text-gray-800">
                        Approval Stage #{level.WFL_LEVEL_NO}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveLevelUp(index)}
                        className={`p-1.5 rounded-lg border text-gray-600 transition-colors ${
                          index === 0 ? 'opacity-30 cursor-not-allowed border-gray-200' : 'hover:bg-gray-100 border-gray-200'
                        }`}
                        title="Move Stage Earlier"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={index === formData.levels.length - 1}
                        onClick={() => handleMoveLevelDown(index)}
                        className={`p-1.5 rounded-lg border text-gray-600 transition-colors ${
                          index === formData.levels.length - 1 ? 'opacity-30 cursor-not-allowed border-gray-200' : 'hover:bg-gray-100 border-gray-200'
                        }`}
                        title="Move Stage Later"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveLevel(index)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg border border-red-200 transition-colors ml-2"
                        title="Remove Stage"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Stage Name */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        Stage Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={level.WFL_LEVEL_NAME}
                        onChange={e => handleLevelChange(index, 'WFL_LEVEL_NAME', e.target.value)}
                        placeholder="e.g. Senior Underwriter Risk Approval"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Role Code */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        Functional Role Title <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={level.WFL_ROLE_CODE}
                        onChange={e => handleLevelChange(index, 'WFL_ROLE_CODE', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {roles.map(r => (
                          <option key={r.code} value={r.code}>
                            {r.label} ({r.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Authorized User Security Group (Database-Driven) */}
                    <div>
                      <label className="block text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          Authorized User Group <span className="text-red-500">*</span>
                        </span>
                        <span className="text-[10px] text-gray-500 lowercase font-normal">Controls action buttons</span>
                      </label>
                      <select
                        value={level.WFL_USER_GROUP || 'ADMIN'}
                        onChange={e => handleLevelChange(index, 'WFL_USER_GROUP', e.target.value)}
                        className="w-full px-3 py-2 border border-indigo-200 bg-indigo-50/20 text-indigo-900 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {userGroups.map(ug => (
                          <option key={ug.code} value={ug.code}>
                            {ug.code} - {ug.name} ({ug.userCount} users)
                          </option>
                        ))}
                        {userGroups.length === 0 && (
                          <>
                            <option value="ADMIN">ADMIN - System Administrator</option>
                            <option value="DEUSER">DEUSER - Data Entry / Intake Officer</option>
                            <option value="UWUSER">UWUSER - Underwriting Verification Officer</option>
                            <option value="UWMGR">UWMGR - Underwriting Manager</option>
                            <option value="POLICY_ADMIN">POLICY_ADMIN - Policy Administrator</option>
                            <option value="CLMMGR">CLMMGR - Claims Manager</option>
                            <option value="SERVICE">SERVICE - Policy Servicing Officer</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* Min Financial Threshold */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        Min Amount Threshold ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={level.WFL_MIN_AMOUNT !== null && level.WFL_MIN_AMOUNT !== undefined ? level.WFL_MIN_AMOUNT : 0}
                        onChange={e => handleLevelChange(index, 'WFL_MIN_AMOUNT', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Max Financial Threshold */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        Max Amount Limit ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="No limit"
                        value={level.WFL_MAX_AMOUNT !== null && level.WFL_MAX_AMOUNT !== undefined ? level.WFL_MAX_AMOUNT : ''}
                        onChange={e => handleLevelChange(index, 'WFL_MAX_AMOUNT', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* SLA Hours */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        SLA Target (Hours)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={level.WFL_SLA_HOURS || 24}
                        onChange={e => handleLevelChange(index, 'WFL_SLA_HOURS', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Auto Escalate Hours */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        Auto Escalation (Hours)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={level.WFL_AUTO_ESCALATE_HOURS || 48}
                        onChange={e => handleLevelChange(index, 'WFL_AUTO_ESCALATE_HOURS', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Stage Policy Toggles */}
                  <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-medium text-gray-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={level.WFL_ALLOW_REJECT_YN === 'Y'}
                        onChange={e => handleLevelChange(index, 'WFL_ALLOW_REJECT_YN', e.target.checked ? 'Y' : 'N')}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span>Allow Outright Rejection</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={level.WFL_ALLOW_REWORK_YN === 'Y'}
                        onChange={e => handleLevelChange(index, 'WFL_ALLOW_REWORK_YN', e.target.checked ? 'Y' : 'N')}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span>Allow Rework / Send-Back to Previous Stage</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={level.WFL_MANDATORY_DOC_YN === 'Y'}
                        onChange={e => handleLevelChange(index, 'WFL_MANDATORY_DOC_YN', e.target.checked ? 'Y' : 'N')}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span>Require Mandatory Checklist Documents</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Audit Information (Edit Mode Only) */}
          {pageMode === 'edit' && formAudit.createdBy && (
            <div className="bg-gray-50/80 rounded-xl border border-gray-200 p-4 text-xs text-gray-500 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">Record Audit:</span>
                <span>Created by <strong className="text-gray-900">{formAudit.createdBy}</strong> on {formAudit.createdOn || '-'}</span>
              </div>
              {formAudit.modifiedBy && (
                <div>
                  <span>Last modified by <strong className="text-gray-900">{formAudit.modifiedBy}</strong> on {formAudit.modifiedOn || '-'}</span>
                </div>
              )}
            </div>
          )}

          {/* Bottom Action Footer */}
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => {
                setPageMode('list');
                setFeedback(null);
              }}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving Workflow...' : pageMode === 'create' ? 'Create Workflow' : 'Save Workflow Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default WorkflowPage;
