import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
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
  User,
  ShieldCheck,
  Calendar,
  DollarSign,
  ChevronRight,
  Info,
  Layers,
  Sparkles,
  TrendingUp,
  FileText
} from 'lucide-react';
import { quoteService } from '../services/quoteService';
import { productService } from '../services/productService';
import { coverService } from '../services/coverService';
import {
  ProspectItem,
  ProspectDetail,
  ProspectFormData,
  ProspectRiderItem,
  PremiumCalcResult
} from '../types/quote';
import { ProductItem } from '../types/product';
import { CoverListItem } from '../types/cover';

const emptyFormData: ProspectFormData = {
  PROS_FULL_NAME: '',
  PROS_DOB: '',
  PROS_AGE: 30,
  PROS_GENDER: 'M',
  PROS_ANN_SALARY: 600000,
  PROS_PLAN: '',
  PROS_TERM: 20,
  PROS_SUM_ASSURED: 1000000,
  PROS_PREMIUM: '',
  riders: []
};

export const QuickQuotePage: React.FC = () => {
  // Page mode: 'list' for quotes table, 'create' for new transaction, 'edit' for editing existing
  const [pageMode, setPageMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null);

  // Quotes list state
  const [quotes, setQuotes] = useState<ProspectItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPlanFilter, setSelectedPlanFilter] = useState<string>('ALL');

  // Master products and covers available for selection
  const [availableProducts, setAvailableProducts] = useState<ProductItem[]>([]);
  const [availableCovers, setAvailableCovers] = useState<CoverListItem[]>([]);

  // In-page form state
  const [formData, setFormData] = useState<ProspectFormData>(emptyFormData);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Calculation breakdown state
  const [calcResult, setCalcResult] = useState<PremiumCalcResult | null>(null);

  // In-page feedback banner
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // In-page delete confirmation state (no popup window)
  const [quoteToDelete, setQuoteToDelete] = useState<ProspectItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // New rider selector state within editor
  const [riderToAdd, setRiderToAdd] = useState<string>('');
  const [riderSaToAdd, setRiderSaToAdd] = useState<number | ''>(250000);

  // Load quotes list
  const loadQuotes = async () => {
    setIsLoading(true);
    setNotification(null);
    try {
      const planFilter = selectedPlanFilter === 'ALL' ? undefined : selectedPlanFilter;
      const res = await quoteService.getQuotes(searchTerm, planFilter);
      if (res.success && res.quotes) {
        setQuotes(res.quotes);
      } else {
        setQuotes([]);
      }
    } catch (err: any) {
      console.error('Failed to load quotes:', err);
      setNotification({
        type: 'error',
        message: err.message || 'Error fetching quotes from TBL_PROSPECTS'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load products and covers for dropdowns
  const loadMasterData = async () => {
    try {
      const [prodRes, coverRes] = await Promise.all([
        productService.getProducts(),
        coverService.getCovers(undefined, undefined, true)
      ]);

      if (prodRes.success && prodRes.products) {
        setAvailableProducts(prodRes.products);
      }
      if (coverRes.success && coverRes.covers) {
        setAvailableCovers(coverRes.covers);
      }
    } catch (err) {
      console.error('Error loading master data:', err);
    }
  };

  useEffect(() => {
    loadQuotes();
    loadMasterData();
  }, [selectedPlanFilter]);

  // Handle Search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadQuotes();
  };

  // Auto-calculate age from DOB
  const handleDobChange = (dobStr: string) => {
    let calculatedAge = formData.PROS_AGE;
    if (dobStr) {
      const birthDate = new Date(dobStr);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age >= 0 && age <= 120) {
        calculatedAge = age;
      }
    }
    setFormData({
      ...formData,
      PROS_DOB: dobStr,
      PROS_AGE: calculatedAge
    });
  };

  // When plan changes, sync default terms if available
  const handlePlanChange = (planCode: string) => {
    const selectedProd = availableProducts.find((p) => p.PROD_CODE === planCode);
    let term = formData.PROS_TERM;
    let minSa = formData.PROS_SUM_ASSURED;

    if (selectedProd) {
      if (selectedProd.PROD_TERM_FM) term = selectedProd.PROD_TERM_FM;
      if (selectedProd.PROD_MIN_SA) minSa = selectedProd.PROD_MIN_SA;
    }

    setFormData({
      ...formData,
      PROS_PLAN: planCode,
      PROS_TERM: term,
      PROS_SUM_ASSURED: minSa
    });
    setCalcResult(null);
  };

  // Start in-page create
  const handleStartCreate = () => {
    const defaultPlan = availableProducts.length > 0 ? availableProducts[0].PROD_CODE : '';
    setFormData({
      ...emptyFormData,
      PROS_PLAN: defaultPlan,
      PROS_SUM_ASSURED: 1000000,
      PROS_TERM: 20,
      riders: []
    });
    setFormErrors({});
    setSelectedQuoteId(null);
    setQuoteToDelete(null);
    setCalcResult(null);
    setNotification(null);
    setPageMode('create');
  };

  // Start in-page edit
  const handleStartEdit = async (item: ProspectItem) => {
    setIsLoading(true);
    setFormErrors({});
    setQuoteToDelete(null);
    setNotification(null);
    try {
      const res = await quoteService.getQuoteById(item.PROS_UID);
      if (res.success && res.quote) {
        const q: ProspectDetail = res.quote;
        setFormData({
          PROS_FULL_NAME: q.PROS_FULL_NAME || '',
          PROS_DOB: q.PROS_DOB || '',
          PROS_AGE: q.PROS_AGE ?? '',
          PROS_GENDER: q.PROS_GENDER || 'M',
          PROS_ANN_SALARY: q.PROS_ANN_SALARY ?? '',
          PROS_PLAN: q.PROS_PLAN || '',
          PROS_TERM: q.PROS_TERM ?? '',
          PROS_SUM_ASSURED: q.PROS_SUM_ASSURED ?? '',
          PROS_PREMIUM: q.PROS_PREMIUM ?? '',
          riders: (q.riders || []).map((r) => ({
            PRIDER_UID: r.PRIDER_UID,
            PROS_UID: r.PROS_UID,
            PRIDER_CODE: r.PRIDER_CODE,
            PRIDER_NAME: r.PRIDER_NAME,
            PRIDER_SUM_ASSURED: r.PRIDER_SUM_ASSURED ?? '',
            PRIDER_PREMIUM: r.PRIDER_PREMIUM ?? ''
          }))
        });
        setSelectedQuoteId(q.PROS_UID);
        setPageMode('edit');
      } else {
        setNotification({
          type: 'error',
          message: res.message || 'Could not load quote details'
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to fetch quote details'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel in-page editor
  const handleCancelEditor = () => {
    setPageMode('list');
    setSelectedQuoteId(null);
    setFormErrors({});
    setCalcResult(null);
  };

  // Add rider to quote in-page
  const handleAddRider = () => {
    if (!riderToAdd) return;
    const exists = formData.riders.some((r) => r.PRIDER_CODE === riderToAdd);
    if (exists) {
      alert('This rider is already attached to this quote.');
      return;
    }

    const coverInfo = availableCovers.find((c) => c.coverCode === riderToAdd);
    const riderSa = riderSaToAdd === '' ? 100000 : Number(riderSaToAdd);
    // Indicative rider premium ~ 0.45 per 1,000 SA
    const estimatedRiderPrem = Math.round((riderSa / 1000) * 0.45 * 100) / 100;

    const newRider: ProspectRiderItem = {
      PRIDER_CODE: riderToAdd,
      PRIDER_NAME: coverInfo ? coverInfo.coverDesc : riderToAdd,
      PRIDER_SUM_ASSURED: riderSa,
      PRIDER_PREMIUM: estimatedRiderPrem
    };

    setFormData({
      ...formData,
      riders: [...formData.riders, newRider]
    });
    setRiderToAdd('');
    setCalcResult(null);
  };

  // Remove rider row in-page
  const handleRemoveRider = (riderCode: string) => {
    setFormData({
      ...formData,
      riders: formData.riders.filter((r) => r.PRIDER_CODE !== riderCode)
    });
    setCalcResult(null);
  };

  // Update rider row values in-page
  const handleUpdateRiderRow = (
    index: number,
    field: keyof ProspectRiderItem,
    value: any
  ) => {
    const updated = [...formData.riders];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setFormData({ ...formData, riders: updated });
    setCalcResult(null);
  };

  // Calculate Premium Action
  const handleCalculatePremium = async () => {
    if (!formData.PROS_PLAN) {
      setFormErrors({ PROS_PLAN: 'Please select a product plan first' });
      return;
    }
    if (!formData.PROS_SUM_ASSURED || Number(formData.PROS_SUM_ASSURED) <= 0) {
      setFormErrors({ PROS_SUM_ASSURED: 'Sum Assured must be greater than 0' });
      return;
    }

    setIsCalculating(true);
    try {
      const ridersPayload = formData.riders.map((r) => ({
        PRIDER_CODE: r.PRIDER_CODE,
        PRIDER_SUM_ASSURED: r.PRIDER_SUM_ASSURED === '' ? 0 : Number(r.PRIDER_SUM_ASSURED)
      }));

      const res = await quoteService.calculatePremium({
        PROS_PLAN: formData.PROS_PLAN,
        PROS_AGE: formData.PROS_AGE === '' ? 30 : Number(formData.PROS_AGE),
        PROS_GENDER: formData.PROS_GENDER,
        PROS_TERM: formData.PROS_TERM === '' ? 20 : Number(formData.PROS_TERM),
        PROS_SUM_ASSURED: Number(formData.PROS_SUM_ASSURED),
        riders: ridersPayload
      });

      if (res.success && res.calculation) {
        setCalcResult(res.calculation);
        // Automatically populate basic premium and rider premiums in the form
        const updatedRiders = formData.riders.map((r) => {
          const calculatedRider = res.calculation?.riderPremiums.find(
            (cr) => cr.riderCode === r.PRIDER_CODE
          );
          return {
            ...r,
            PRIDER_PREMIUM: calculatedRider ? calculatedRider.premium : r.PRIDER_PREMIUM
          };
        });

        setFormData({
          ...formData,
          PROS_PREMIUM: res.calculation.basicPremium,
          riders: updatedRiders
        });
      }
    } catch (err: any) {
      console.error('Calculation error:', err);
      setNotification({
        type: 'error',
        message: err.message || 'Error occurred while calculating premium'
      });
    } finally {
      setIsCalculating(false);
    }
  };

  // Validate form before save
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.PROS_FULL_NAME.trim()) {
      errors.PROS_FULL_NAME = 'Prospect / Client Name is required';
    }

    if (!formData.PROS_PLAN) {
      errors.PROS_PLAN = 'Product Plan selection is required';
    }

    if (!formData.PROS_SUM_ASSURED || Number(formData.PROS_SUM_ASSURED) <= 0) {
      errors.PROS_SUM_ASSURED = 'Valid Sum Assured is required';
    }

    if (formData.PROS_AGE !== '') {
      const age = Number(formData.PROS_AGE);
      if (age < 0 || age > 100) {
        errors.PROS_AGE = 'Age must be between 0 and 100 years';
      }
    }

    if (formData.PROS_TERM !== '') {
      const term = Number(formData.PROS_TERM);
      if (term < 1 || term > 100) {
        errors.PROS_TERM = 'Term must be between 1 and 100 years';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save quote in-page (create or update)
  const handleSaveQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    setNotification(null);

    try {
      if (pageMode === 'create') {
        const res = await quoteService.createQuote(formData);
        if (res.success && res.quote) {
          setNotification({
            type: 'success',
            message: `Quick Quote #${res.quote.PROS_UID} created successfully for ${res.quote.PROS_FULL_NAME}!`
          });
          setPageMode('list');
          loadQuotes();
        } else {
          setNotification({
            type: 'error',
            message: res.message || 'Failed to save quick quote'
          });
        }
      } else if (pageMode === 'edit' && selectedQuoteId) {
        const res = await quoteService.updateQuote(selectedQuoteId, formData);
        if (res.success) {
          setNotification({
            type: 'success',
            message: `Quick Quote #${selectedQuoteId} successfully updated.`
          });
          setPageMode('list');
          loadQuotes();
        } else {
          setNotification({
            type: 'error',
            message: res.message || 'Failed to update quote'
          });
        }
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Error occurred while saving quote'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Prompt delete in-page
  const handlePromptDelete = (quote: ProspectItem) => {
    setQuoteToDelete(quote);
  };

  // Cancel delete prompt
  const handleCancelDelete = () => {
    setQuoteToDelete(null);
  };

  // Confirm delete in-page
  const handleConfirmDelete = async () => {
    if (!quoteToDelete) return;
    setIsDeleting(true);
    setNotification(null);
    try {
      const res = await quoteService.deleteQuote(quoteToDelete.PROS_UID);
      if (res.success) {
        setNotification({
          type: 'success',
          message: `Quote #${quoteToDelete.PROS_UID} for ${quoteToDelete.PROS_FULL_NAME} was deleted successfully.`
        });
        setQuoteToDelete(null);
        if (pageMode !== 'list') {
          setPageMode('list');
        }
        loadQuotes();
      } else {
        setNotification({
          type: 'error',
          message: res.message || 'Failed to delete quote'
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Error deleting quote'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Metrics summary
  const metrics = useMemo(() => {
    const total = quotes.length;
    const totalSA = quotes.reduce((sum, q) => sum + (Number(q.PROS_SUM_ASSURED) || 0), 0);
    const totalPrem = quotes.reduce((sum, q) => sum + (Number(q.TOTAL_PREMIUM) || 0), 0);
    const avgSA = total > 0 ? Math.round(totalSA / total) : 0;
    return { total, totalSA, totalPrem, avgSA };
  }, [quotes]);

  return (
    <div className="space-y-6">
      {/* Notifications Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between transition-all duration-300 shadow-sm ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300'
              : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center space-x-3">
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            )}
            <span className="font-medium text-sm">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-semibold hover:underline opacity-80 ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* In-Page Delete Confirmation Banner (No Popup) */}
      {quoteToDelete && (
        <div className="p-5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-200 shadow-md">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-base">
                  Confirm Deletion of Quick Quote #{quoteToDelete.PROS_UID}
                </h4>
                <p className="text-sm text-rose-700 dark:text-rose-300 mt-1">
                  Are you sure you want to delete the quote for{' '}
                  <strong>{quoteToDelete.PROS_FULL_NAME}</strong> (Plan: {quoteToDelete.PROS_PLAN})?
                  This will remove the prospect record and all attached rider entries from the database.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3 self-end md:self-center">
              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 flex items-center space-x-2 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Delete Quote</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 1: LIST / TRANSACTION LOG OVERVIEW */}
      {pageMode === 'list' && (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-teal-accent mb-1">
                <span>Individual Life</span>
                <ChevronRight className="w-3 h-3" />
                <span>Transactions</span>
                <ChevronRight className="w-3 h-3" />
                <span>Quick Quotations</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Calculator className="w-7 h-7 text-navy" />
                Quick Quote Transactions
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Generate and maintain life insurance quick quotes using transaction tables TBL_PROSPECTS & TBL_PROSPECT_RIDER.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy hover:bg-navy-light text-white text-sm font-bold shadow-md hover:shadow-lg transition-all space-x-2 cursor-pointer ring-1 ring-white/20"
            >
              <Plus className="w-5 h-5 text-teal-accent" />
              <span>Create New Quick Quote</span>
            </button>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Quotes
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {metrics.total}
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/40 text-navy rounded-xl">
                <FileText className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Sum Assured
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 font-mono">
                  ${metrics.totalSA.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Premium Quoted
                </p>
                <p className="text-xl font-bold text-teal-accent mt-1 font-mono">
                  ${metrics.totalPrem.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-teal-light text-teal-accent rounded-xl">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Average Sum Assured
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 font-mono">
                  ${metrics.avgSA.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/40 text-purple-600 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2 w-full">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search by Prospect Name, Plan, or Quote ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg cursor-pointer"
              >
                Search
              </button>
            </form>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={selectedPlanFilter}
                  onChange={(e) => setSelectedPlanFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy"
                >
                  <option value="ALL">All Products / Plans</option>
                  {availableProducts.map((p) => (
                    <option key={p.PROD_CODE} value={p.PROD_CODE}>
                      {p.PROD_CODE} - {p.PROD_NAME}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={loadQuotes}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                title="Refresh Quotes"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleStartCreate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-accent hover:opacity-90 text-white text-xs font-bold shadow-xs transition-all whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ New Quote</span>
              </button>
            </div>
          </div>

          {/* Quotes Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-5 py-3.5">Quote ID</th>
                    <th className="px-5 py-3.5">Prospect Name</th>
                    <th className="px-5 py-3.5">Age / Gender</th>
                    <th className="px-5 py-3.5">Plan / Product</th>
                    <th className="px-5 py-3.5">Term</th>
                    <th className="px-5 py-3.5">Sum Assured</th>
                    <th className="px-5 py-3.5">Basic Premium</th>
                    <th className="px-5 py-3.5">Riders</th>
                    <th className="px-5 py-3.5">Total Premium</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-12 text-center text-gray-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-accent mb-2" />
                        Loading transaction quotes from TBL_PROSPECTS...
                      </td>
                    </tr>
                  ) : quotes.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-12 text-center text-gray-500">
                        <Calculator className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                        <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                          No Quick Quotes Recorded
                        </p>
                        <p className="text-xs text-slate-500 mt-1 mb-4">
                          Generate your first quick quote calculation for a client or prospect.
                        </p>
                        <button
                          type="button"
                          onClick={handleStartCreate}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-navy hover:bg-navy-light text-white text-xs font-bold shadow-xs cursor-pointer"
                        >
                          <Plus className="w-4 h-4 text-teal-accent" />
                          <span>Create New Quick Quote</span>
                        </button>
                      </td>
                    </tr>
                  ) : (
                    quotes.map((q) => (
                      <tr
                        key={q.PROS_UID}
                        className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                      >
                        <td className="px-5 py-4 font-mono font-bold text-navy dark:text-teal-accent">
                          #{q.PROS_UID}
                        </td>
                        <td className="px-5 py-4 font-medium text-gray-900 dark:text-white">
                          <div>{q.PROS_FULL_NAME}</div>
                          <div className="text-[11px] text-gray-400">
                            Created: {q.PROS_CREATED_ON ? q.PROS_CREATED_ON.split(' ')[0] : 'Today'}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {q.PROS_AGE ?? '-'} yrs
                          </span>{' '}
                          <span className="text-gray-400">
                            ({q.PROS_GENDER === 'M' ? 'Male' : q.PROS_GENDER === 'F' ? 'Female' : 'Other'})
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-navy dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {q.PROS_PLAN}
                          </span>
                          <div className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[150px]">
                            {q.PLAN_NAME || ''}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs font-semibold">
                          {q.PROS_TERM ? `${q.PROS_TERM} yrs` : '-'}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs font-bold text-gray-900 dark:text-white">
                          ${Number(q.PROS_SUM_ASSURED || 0).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-gray-700 dark:text-gray-300">
                          {q.PROS_PREMIUM ? `$${Number(q.PROS_PREMIUM).toLocaleString()}` : '-'}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200">
                            {q.RIDER_COUNT || 0} Riders
                          </span>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs font-bold text-teal-accent">
                          ${Number(q.TOTAL_PREMIUM || q.PROS_PREMIUM || 0).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleStartEdit(q)}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-navy hover:text-navy-light cursor-pointer"
                              title="Edit Quote"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePromptDelete(q)}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-rose-500 hover:text-rose-700 cursor-pointer"
                              title="Delete Quote"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* VIEW MODE 2: IN-PAGE QUICK QUOTE TRANSACTION SCREEN (CREATE / EDIT) */}
      {(pageMode === 'create' || pageMode === 'edit') && (
        <form onSubmit={handleSaveQuote} noValidate className="space-y-6">
          {/* Editor Header Bar */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleCancelEditor}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-pointer"
                title="Return to Quotes List"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center space-x-2 text-xs font-semibold text-teal-accent uppercase tracking-wider">
                  <span>Quick Quote Transaction</span>
                  <ChevronRight className="w-3 h-3" />
                  <span>{pageMode === 'create' ? 'New Proposal Quotation' : `Quote #${selectedQuoteId}`}</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                  {pageMode === 'create'
                    ? 'Generate Life Insurance Quick Quote'
                    : `Edit Quote #${selectedQuoteId} - ${formData.PROS_FULL_NAME}`}
                </h2>
              </div>
            </div>

            <div className="flex items-center space-x-3 self-end md:self-center">
              <button
                type="button"
                onClick={handleCalculatePremium}
                disabled={isCalculating}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-teal-accent hover:opacity-90 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isCalculating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>Calculate Premium</span>
              </button>

              <button
                type="button"
                onClick={handleCancelEditor}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 cursor-pointer"
              >
                Cancel
              </button>

              {pageMode === 'edit' && (
                <button
                  type="button"
                  onClick={() => {
                    const q = quotes.find((item) => item.PROS_UID === selectedQuoteId);
                    if (q) handlePromptDelete(q);
                  }}
                  className="px-3 py-2 text-sm font-medium text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-200 rounded-xl cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 inline mr-1" />
                  Delete
                </button>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center px-5 py-2 text-sm font-bold text-white bg-navy hover:bg-navy-light rounded-xl shadow-sm hover:shadow cursor-pointer disabled:opacity-50 space-x-2"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Quick Quote</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Section 1: Prospect Personal & Demographic Information */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-navy" />
              1. Prospect / Insured Client Details (TBL_PROSPECTS)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.PROS_FULL_NAME}
                  onChange={(e) => setFormData({ ...formData, PROS_FULL_NAME: e.target.value })}
                  placeholder="e.g. John Doe / Kuzhandaivel"
                  className={`w-full px-3.5 py-2 border rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy ${
                    formErrors.PROS_FULL_NAME ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {formErrors.PROS_FULL_NAME && (
                  <p className="text-xs text-rose-500 mt-1">{formErrors.PROS_FULL_NAME}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={formData.PROS_DOB}
                  onChange={(e) => handleDobChange(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Age (Years) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.PROS_AGE}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      PROS_AGE: e.target.value === '' ? '' : Number(e.target.value)
                    })
                  }
                  placeholder="e.g. 35"
                  className={`w-full px-3.5 py-2 border rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy ${
                    formErrors.PROS_AGE ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {formErrors.PROS_AGE && (
                  <p className="text-xs text-rose-500 mt-1">{formErrors.PROS_AGE}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Gender
                </label>
                <select
                  value={formData.PROS_GENDER}
                  onChange={(e) =>
                    setFormData({ ...formData, PROS_GENDER: e.target.value as 'M' | 'F' | 'O' })
                  }
                  className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy"
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Annual Salary / Income ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.PROS_ANN_SALARY}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      PROS_ANN_SALARY: e.target.value === '' ? '' : Number(e.target.value)
                    })
                  }
                  placeholder="e.g. 600,000"
                  className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Plan & Policy Parameters */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-navy" />
              2. Core Plan & Policy Parameters
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Life Insurance Product Plan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.PROS_PLAN}
                  onChange={(e) => handlePlanChange(e.target.value)}
                  className={`w-full px-3.5 py-2 border rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy ${
                    formErrors.PROS_PLAN ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <option value="">-- Choose a Product --</option>
                  {availableProducts.map((p) => (
                    <option key={p.PROD_CODE} value={p.PROD_CODE}>
                      {p.PROD_CODE} - {p.PROD_NAME} ({p.PROD_TYPE === 'T' ? 'Term' : p.PROD_TYPE === 'E' ? 'Endowment' : 'Life'})
                    </option>
                  ))}
                </select>
                {formErrors.PROS_PLAN && (
                  <p className="text-xs text-rose-500 mt-1">{formErrors.PROS_PLAN}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Policy Term (Years) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.PROS_TERM}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      PROS_TERM: e.target.value === '' ? '' : Number(e.target.value)
                    })
                  }
                  placeholder="e.g. 20"
                  className={`w-full px-3.5 py-2 border rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy ${
                    formErrors.PROS_TERM ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {formErrors.PROS_TERM && (
                  <p className="text-xs text-rose-500 mt-1">{formErrors.PROS_TERM}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Basic Sum Assured ($) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.PROS_SUM_ASSURED}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      PROS_SUM_ASSURED: e.target.value === '' ? '' : Number(e.target.value)
                    })
                  }
                  placeholder="e.g. 1,000,000"
                  className={`w-full px-3.5 py-2 border rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy font-mono ${
                    formErrors.PROS_SUM_ASSURED ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {formErrors.PROS_SUM_ASSURED && (
                  <p className="text-xs text-rose-500 mt-1">{formErrors.PROS_SUM_ASSURED}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Attached Riders & Covers (TBL_PROSPECT_RIDER) */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-navy" />
                  3. Optional Riders & Supplemental Covers (TBL_PROSPECT_RIDER)
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Attach optional rider benefits (TPD, Accidental Death, Critical Illness, Waiver of Premium) with rider sum assured.
                </p>
              </div>

              <div className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-navy border border-blue-200">
                {formData.riders.length} Rider(s) Attached
              </div>
            </div>

            {/* In-page Rider Selector Tool */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Select Rider from Master (MTBL_COVER):
                </label>
                <select
                  value={riderToAdd}
                  onChange={(e) => setRiderToAdd(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy"
                >
                  <option value="">-- Choose a Rider Cover --</option>
                  {availableCovers.map((c) => (
                    <option key={c.coverCode} value={c.coverCode}>
                      {c.coverCode} - {c.coverDesc} ({c.coverType === 'D' ? 'Basic' : c.coverType === 'A' ? 'Ancillary' : 'WOP'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-48">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Rider Sum Assured ($):
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={riderSaToAdd}
                  onChange={(e) => setRiderSaToAdd(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 250,000"
                  className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy font-mono"
                />
              </div>

              <button
                type="button"
                onClick={handleAddRider}
                disabled={!riderToAdd}
                className="w-full sm:w-auto px-4 py-2 bg-navy hover:bg-navy-light text-white text-sm font-semibold rounded-xl disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-1 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Rider</span>
              </button>
            </div>

            {/* Attached Riders Grid */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                <thead className="bg-gray-100/70 dark:bg-gray-900/60 text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3">Rider Code</th>
                    <th className="px-4 py-3">Rider Name</th>
                    <th className="px-4 py-3">Rider Sum Assured ($)</th>
                    <th className="px-4 py-3">Calculated Rider Premium ($)</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {formData.riders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-xs">
                        <Info className="w-5 h-5 mx-auto mb-1 text-gray-300" />
                        No supplemental riders attached yet. Select riders from above to bundle them into this quote.
                      </td>
                    </tr>
                  ) : (
                    formData.riders.map((r, idx) => (
                      <tr key={r.PRIDER_CODE} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="px-4 py-3 font-mono font-bold text-navy dark:text-teal-accent">
                          {r.PRIDER_CODE}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {r.PRIDER_NAME || r.PRIDER_CODE}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={r.PRIDER_SUM_ASSURED}
                            onChange={(e) =>
                              handleUpdateRiderRow(
                                idx,
                                'PRIDER_SUM_ASSURED',
                                e.target.value === '' ? '' : Number(e.target.value)
                              )
                            }
                            className="w-36 px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-gray-900 dark:text-white">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Computed"
                            value={r.PRIDER_PREMIUM}
                            onChange={(e) =>
                              handleUpdateRiderRow(
                                idx,
                                'PRIDER_PREMIUM',
                                e.target.value === '' ? '' : Number(e.target.value)
                              )
                            }
                            className="w-28 px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-teal-accent font-bold font-mono"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveRider(r.PRIDER_CODE)}
                            className="p-1 hover:bg-rose-50 text-rose-500 rounded cursor-pointer"
                            title="Remove Rider"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Premium Calculation & Modal Breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-teal-accent" />
                  4. Quotation Premium Breakdown
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Click 'Calculate Premium' to compute indicative rates across annual, semi-annual, quarterly, and monthly frequencies.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCalculatePremium}
                disabled={isCalculating}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-accent hover:opacity-90 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isCalculating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>Run Calculation Engine</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                <div className="text-xs font-semibold text-gray-500 uppercase">
                  Basic Plan Premium
                </div>
                <div className="text-xl font-bold text-navy mt-1 font-mono">
                  ${formData.PROS_PREMIUM ? Number(formData.PROS_PREMIUM).toLocaleString() : '0'}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">Annual Basic Life Rate</div>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                <div className="text-xs font-semibold text-gray-500 uppercase">
                  Attached Riders Total
                </div>
                <div className="text-xl font-bold text-purple-600 mt-1 font-mono">
                  ${formData.riders.reduce((s, r) => s + (Number(r.PRIDER_PREMIUM) || 0), 0).toLocaleString()}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">{formData.riders.length} rider benefits</div>
              </div>

              <div className="p-4 rounded-xl border-2 border-teal-accent/30 bg-teal-light/40">
                <div className="text-xs font-bold text-teal-accent uppercase">
                  Total Annual Premium
                </div>
                <div className="text-2xl font-extrabold text-teal-accent mt-1 font-mono">
                  ${(
                    (Number(formData.PROS_PREMIUM) || 0) +
                    formData.riders.reduce((s, r) => s + (Number(r.PRIDER_PREMIUM) || 0), 0)
                  ).toLocaleString()}
                </div>
                <div className="text-[11px] text-teal-accent/80 mt-0.5 font-medium">Basic + Supplemental Covers</div>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                <div className="text-xs font-semibold text-gray-500 uppercase">
                  Monthly Estimate
                </div>
                <div className="text-xl font-bold text-gray-900 dark:text-white mt-1 font-mono">
                  ${Math.round(
                    ((Number(formData.PROS_PREMIUM) || 0) +
                      formData.riders.reduce((s, r) => s + (Number(r.PRIDER_PREMIUM) || 0), 0)) *
                      0.088
                  ).toLocaleString()}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">Approx. 8.8% modal factor</div>
              </div>
            </div>

            {calcResult && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-navy flex items-center gap-2">
                <Info className="w-4 h-4 text-teal-accent flex-shrink-0" />
                <span>
                  <strong>Calculation Hook Ready:</strong> {calcResult.note || 'Calculated using base rate parameters. Oracle DB package will be invoked seamlessly.'}
                </span>
              </div>
            )}
          </div>

          {/* Bottom Action Footer */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleCancelEditor}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 cursor-pointer"
            >
              Back to Quotes List
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center px-6 py-2.5 text-sm font-bold text-white bg-navy hover:bg-navy-light rounded-xl shadow-sm hover:shadow cursor-pointer disabled:opacity-50 space-x-2"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Quick Quote</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default QuickQuotePage;
