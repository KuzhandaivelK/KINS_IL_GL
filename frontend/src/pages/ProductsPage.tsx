import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
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
  Calendar,
  Layers,
  Coins,
  ChevronRight,
  Info,
  Sliders,
  DollarSign,
  HeartHandshake
} from 'lucide-react';
import { productService } from '../services/productService';
import { coverService } from '../services/coverService';
import {
  ProductItem,
  ProductDetail,
  ProductFormData,
  ProdCoverItem,
  PRODUCT_TYPE_OPTIONS,
  AGE_CALC_OPTIONS
} from '../types/product';
import { CoverListItem } from '../types/cover';

const emptyFormData: ProductFormData = {
  PROD_CODE: '',
  PROD_NAME: '',
  PROD_TYPE: 'T',
  PROD_TERM_FM: 5,
  PROD_TERM_TO: 30,
  PROD_MIN_AGE: 18,
  PROD_MAX_AGE: 65,
  PROD_AGE_CALC_MTHD: 'ANB',
  PROD_JOINT_LIFE_YN: 'N',
  PROD_PERIOD_MULTIPLE: 1,
  PROD_VALID_FM_DT: new Date().toISOString().split('T')[0],
  PROD_VALID_TO_DT: '',
  PROD_COOLOFF_DAYS: 15,
  PROD_MIN_SA: 100000,
  PROD_MAX_SA: 10000000,
  PROD_COMM_CODE: '',
  PROD_SURR_YN: 'N',
  PROD_SURR_YEARS: '',
  PROD_LOAN_YN: 'N',
  PROD_MAT_YN: 'N',
  PROD_WITHDRAW_YN: 'N',
  covers: []
};

export const ProductsPage: React.FC = () => {
  // Page mode: 'list' for product table, 'create' for new product, 'edit' for editing existing
  const [pageMode, setPageMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(null);

  // Products list state
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');

  // Master covers available for attachment
  const [availableCovers, setAvailableCovers] = useState<CoverListItem[]>([]);

  // In-page form state
  const [formData, setFormData] = useState<ProductFormData>(emptyFormData);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // In-page feedback banners
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // In-page delete confirmation state (no popup window)
  const [productToDelete, setProductToDelete] = useState<ProductItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // New cover selection state within editor
  const [coverToAdd, setCoverToAdd] = useState<string>('');

  // Load products list
  const loadProducts = async () => {
    setIsLoading(true);
    setNotification(null);
    try {
      const typeFilter = selectedTypeFilter === 'ALL' ? undefined : selectedTypeFilter;
      const res = await productService.getProducts(searchTerm, typeFilter);
      if (res.success && res.products) {
        setProducts(res.products);
      } else {
        setProducts([]);
      }
    } catch (err: any) {
      console.error('Failed to load products:', err);
      setNotification({
        type: 'error',
        message: err.message || 'Error fetching products from server'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load available covers from MTBL_COVER for linking
  const loadAvailableCovers = async () => {
    try {
      const res = await coverService.getCovers(undefined, undefined, true);
      if (res.success && res.covers) {
        setAvailableCovers(res.covers);
      }
    } catch (err) {
      console.error('Failed to load covers:', err);
    }
  };

  useEffect(() => {
    loadProducts();
    loadAvailableCovers();
  }, [selectedTypeFilter]);

  // Handle Search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadProducts();
  };

  // Start in-page creation
  const handleStartCreate = () => {
    setFormData({
      ...emptyFormData,
      PROD_VALID_FM_DT: new Date().toISOString().split('T')[0],
      covers: []
    });
    setFormErrors({});
    setSelectedProductCode(null);
    setProductToDelete(null);
    setNotification(null);
    setPageMode('create');
  };

  // Start in-page edit
  const handleStartEdit = async (prod: ProductItem) => {
    setIsLoading(true);
    setFormErrors({});
    setProductToDelete(null);
    setNotification(null);
    try {
      const res = await productService.getProductByCode(prod.PROD_CODE);
      if (res.success && res.product) {
        const p: ProductDetail = res.product;
        setFormData({
          PROD_CODE: p.PROD_CODE,
          PROD_NAME: p.PROD_NAME || '',
          PROD_TYPE: p.PROD_TYPE || 'T',
          PROD_TERM_FM: p.PROD_TERM_FM ?? '',
          PROD_TERM_TO: p.PROD_TERM_TO ?? '',
          PROD_MIN_AGE: p.PROD_MIN_AGE ?? '',
          PROD_MAX_AGE: p.PROD_MAX_AGE ?? '',
          PROD_AGE_CALC_MTHD: p.PROD_AGE_CALC_MTHD || 'ANB',
          PROD_JOINT_LIFE_YN: p.PROD_JOINT_LIFE_YN || 'N',
          PROD_PERIOD_MULTIPLE: p.PROD_PERIOD_MULTIPLE ?? 1,
          PROD_VALID_FM_DT: p.PROD_VALID_FM_DT || '',
          PROD_VALID_TO_DT: p.PROD_VALID_TO_DT || '',
          PROD_COOLOFF_DAYS: p.PROD_COOLOFF_DAYS ?? 15,
          PROD_MIN_SA: p.PROD_MIN_SA ?? '',
          PROD_MAX_SA: p.PROD_MAX_SA ?? '',
          PROD_COMM_CODE: p.PROD_COMM_CODE || '',
          PROD_SURR_YN: p.PROD_SURR_YN || 'N',
          PROD_SURR_YEARS: p.PROD_SURR_YEARS ?? '',
          PROD_LOAN_YN: p.PROD_LOAN_YN || 'N',
          PROD_MAT_YN: p.PROD_MAT_YN || 'N',
          PROD_WITHDRAW_YN: p.PROD_WITHDRAW_YN || 'N',
          covers: p.covers || []
        });
        setSelectedProductCode(p.PROD_CODE);
        setPageMode('edit');
      } else {
        setNotification({
          type: 'error',
          message: res.message || 'Could not load product details'
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to fetch product details'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel in-page edit/create
  const handleCancelEditor = () => {
    setPageMode('list');
    setSelectedProductCode(null);
    setFormErrors({});
  };

  // Add cover to product in-page
  const handleAddCover = () => {
    if (!coverToAdd) return;
    const exists = formData.covers.some((c) => c.MPC_COVER_CODE === coverToAdd);
    if (exists) {
      alert('This cover is already added to the product.');
      return;
    }

    const coverInfo = availableCovers.find((c) => c.coverCode === coverToAdd);
    const newCoverItem: ProdCoverItem = {
      MPC_COVER_CODE: coverToAdd,
      MPC_DEFAULT_YN: 'Y',
      MPC_MANDATORY_YN: 'Y',
      MPC_MAX_AGE_ON_MAT: formData.PROD_MAX_AGE ? Number(formData.PROD_MAX_AGE) : null,
      MPC_PERIOD: null,
      MPC_PREM_PAY_YRS: null,
      COVER_DESC: coverInfo ? coverInfo.coverDesc : coverToAdd,
      COVER_TYPE: coverInfo ? coverInfo.coverType : undefined
    };

    setFormData({
      ...formData,
      covers: [...formData.covers, newCoverItem]
    });
    setCoverToAdd('');
  };

  // Remove cover from product in-page
  const handleRemoveCover = (coverCode: string) => {
    setFormData({
      ...formData,
      covers: formData.covers.filter((c) => c.MPC_COVER_CODE !== coverCode)
    });
  };

  // Update cover row in-page
  const handleUpdateCoverRow = (
    index: number,
    field: keyof ProdCoverItem,
    value: any
  ) => {
    const updated = [...formData.covers];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setFormData({ ...formData, covers: updated });
  };

  // Validate form before save
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.PROD_CODE.trim()) {
      errors.PROD_CODE = 'Product Code is required';
    } else if (!/^[A-Z0-9_-]+$/i.test(formData.PROD_CODE.trim())) {
      errors.PROD_CODE = 'Code must contain only letters, numbers, hyphens, and underscores';
    }

    if (!formData.PROD_NAME.trim()) {
      errors.PROD_NAME = 'Product Name is required';
    }

    if (formData.PROD_TERM_FM !== '' && formData.PROD_TERM_TO !== '') {
      if (Number(formData.PROD_TERM_FM) > Number(formData.PROD_TERM_TO)) {
        errors.PROD_TERM_FM = 'Minimum term cannot exceed maximum term';
      }
    }

    if (formData.PROD_MIN_AGE !== '' && formData.PROD_MAX_AGE !== '') {
      if (Number(formData.PROD_MIN_AGE) > Number(formData.PROD_MAX_AGE)) {
        errors.PROD_MIN_AGE = 'Minimum entry age cannot exceed maximum entry age';
      }
    }

    if (formData.PROD_MIN_SA !== '' && formData.PROD_MAX_SA !== '') {
      if (Number(formData.PROD_MIN_SA) > Number(formData.PROD_MAX_SA)) {
        errors.PROD_MIN_SA = 'Minimum Sum Assured cannot exceed Maximum Sum Assured';
      }
    }

    if (formData.PROD_SURR_YN === 'Y' && formData.PROD_SURR_YEARS === '') {
      errors.PROD_SURR_YEARS = 'Please specify surrender lock-in years';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save product in-page (create or update)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    setNotification(null);

    try {
      if (pageMode === 'create') {
        const res = await productService.createProduct(formData);
        if (res.success) {
          setNotification({
            type: 'success',
            message: `Product '${formData.PROD_CODE.toUpperCase()}' successfully created with ${formData.covers.length} attached cover(s).`
          });
          setPageMode('list');
          loadProducts();
        } else {
          setNotification({
            type: 'error',
            message: res.message || 'Failed to create product'
          });
        }
      } else if (pageMode === 'edit' && selectedProductCode) {
        const res = await productService.updateProduct(selectedProductCode, formData);
        if (res.success) {
          setNotification({
            type: 'success',
            message: `Product '${selectedProductCode}' successfully updated.`
          });
          setPageMode('list');
          loadProducts();
        } else {
          setNotification({
            type: 'error',
            message: res.message || 'Failed to update product'
          });
        }
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Error occurred while saving product'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Prompt delete in-page
  const handlePromptDelete = (prod: ProductItem) => {
    setProductToDelete(prod);
  };

  // Cancel delete prompt
  const handleCancelDelete = () => {
    setProductToDelete(null);
  };

  // Confirm delete in-page
  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    setNotification(null);
    try {
      const res = await productService.deleteProduct(productToDelete.PROD_CODE);
      if (res.success) {
        setNotification({
          type: 'success',
          message: `Product '${productToDelete.PROD_CODE}' and all linked covers were deleted successfully.`
        });
        setProductToDelete(null);
        if (pageMode !== 'list') {
          setPageMode('list');
        }
        loadProducts();
      } else {
        setNotification({
          type: 'error',
          message: res.message || 'Failed to delete product'
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Error deleting product'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper map for product types
  const productTypeMap = useMemo(() => {
    const map: Record<string, string> = {};
    PRODUCT_TYPE_OPTIONS.forEach((opt) => {
      map[opt.value] = opt.label;
    });
    return map;
  }, []);

  // Metrics summary
  const metrics = useMemo(() => {
    const total = products.length;
    const term = products.filter((p) => p.PROD_TYPE === 'T').length;
    const endowment = products.filter((p) => p.PROD_TYPE === 'E').length;
    const wholeLife = products.filter((p) => p.PROD_TYPE === 'W').length;
    const totalCoversAttached = products.reduce(
      (sum, p) => sum + (p.ATTACHED_COVERS_COUNT || 0),
      0
    );
    return { total, term, endowment, wholeLife, totalCoversAttached };
  }, [products]);

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
      {productToDelete && (
        <div className="p-5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-200 shadow-md">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-base">
                  Confirm Deletion of Product: {productToDelete.PROD_CODE}
                </h4>
                <p className="text-sm text-rose-700 dark:text-rose-300 mt-1">
                  Are you sure you want to delete <strong>{productToDelete.PROD_NAME}</strong>?
                  This will permanently remove the product and all associated cover attachments
                  from the system.
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
                    <span>Yes, Delete Product</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 1: LIST / OVERVIEW TABLE */}
      {pageMode === 'list' && (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-1">
                <span>Product Configuration</span>
                <ChevronRight className="w-3 h-3" />
                <span>Life Insurance Products</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Package className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                Product Configurator
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Design and maintain life insurance core plans, policy terms, SA limits, and linked covers.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy hover:bg-navy-light text-white text-sm font-bold shadow-md hover:shadow-lg transition-all space-x-2 cursor-pointer ring-1 ring-white/20"
            >
              <Plus className="w-5 h-5 text-teal-accent" />
              <span>Create New Product</span>
            </button>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Products
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {metrics.total}
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
                <Package className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Term Life Plans
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {metrics.term}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Endowment & Others
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {metrics.endowment + metrics.wholeLife}
                </p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-xl">
                <Layers className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Attached Covers
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {metrics.totalCoversAttached}
                </p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-xl">
                <Coins className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2 w-full">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search by Product Code or Plan Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="ALL">All Product Types</option>
                  {PRODUCT_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={loadProducts}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                title="Refresh products"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleStartCreate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-accent hover:opacity-90 text-white text-xs font-bold shadow-xs transition-all whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create Product</span>
              </button>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-5 py-3.5">Product Code</th>
                    <th className="px-5 py-3.5">Product Name</th>
                    <th className="px-5 py-3.5">Plan Type</th>
                    <th className="px-5 py-3.5">Policy Terms</th>
                    <th className="px-5 py-3.5">Entry Ages</th>
                    <th className="px-5 py-3.5">Sum Assured Range</th>
                    <th className="px-5 py-3.5">Covers</th>
                    <th className="px-5 py-3.5">Benefits</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-12 text-center text-gray-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary-500 mb-2" />
                        Loading products from database...
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-12 text-center text-gray-500">
                        <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                        <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                          No products found
                        </p>
                        <p className="text-xs text-slate-500 mt-1 mb-4">
                          Get started by creating your first life insurance plan with policy terms and attached covers.
                        </p>
                        <button
                          type="button"
                          onClick={handleStartCreate}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-navy hover:bg-navy-light text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                        >
                          <Plus className="w-4 h-4 text-teal-accent" />
                          <span>Create New Product</span>
                        </button>
                      </td>
                    </tr>
                  ) : (
                    products.map((prod) => (
                      <tr
                        key={prod.PROD_CODE}
                        className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                      >
                        <td className="px-5 py-4 font-mono font-bold text-gray-900 dark:text-white">
                          {prod.PROD_CODE}
                        </td>
                        <td className="px-5 py-4 font-medium text-gray-900 dark:text-white">
                          <div>{prod.PROD_NAME}</div>
                          <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            From: {prod.PROD_VALID_FM_DT || 'Immediate'}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {productTypeMap[prod.PROD_TYPE] || prod.PROD_TYPE}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs">
                          {prod.PROD_TERM_FM ?? '-'} to {prod.PROD_TERM_TO ?? '-'} yrs
                          <div className="text-gray-400">Step: {prod.PROD_PERIOD_MULTIPLE || 1} yr</div>
                        </td>
                        <td className="px-5 py-4 text-xs">
                          {prod.PROD_MIN_AGE ?? '-'} to {prod.PROD_MAX_AGE ?? '-'} yrs
                          <div className="text-gray-400">{prod.PROD_AGE_CALC_MTHD || 'ANB'}</div>
                        </td>
                        <td className="px-5 py-4 text-xs font-mono">
                          {prod.PROD_MIN_SA ? Number(prod.PROD_MIN_SA).toLocaleString() : '-'} -{' '}
                          {prod.PROD_MAX_SA ? Number(prod.PROD_MAX_SA).toLocaleString() : '-'}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                            {prod.ATTACHED_COVERS_COUNT || 0} Attached
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1">
                            {prod.PROD_SURR_YN === 'Y' && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 rounded">
                                Surrender
                              </span>
                            )}
                            {prod.PROD_LOAN_YN === 'Y' && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 rounded">
                                Loan
                              </span>
                            )}
                            {prod.PROD_MAT_YN === 'Y' && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 rounded">
                                Maturity
                              </span>
                            )}
                            {prod.PROD_JOINT_LIFE_YN === 'Y' && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300 rounded">
                                Joint
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleStartEdit(prod)}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-primary-600 dark:text-primary-400 hover:text-primary-800 cursor-pointer"
                              title="Configure / Edit in page"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePromptDelete(prod)}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-rose-500 hover:text-rose-700 cursor-pointer"
                              title="Delete Product"
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

      {/* VIEW MODE 2: IN-PAGE PRODUCT CONFIGURATOR (CREATE / EDIT) */}
      {(pageMode === 'create' || pageMode === 'edit') && (
        <form onSubmit={handleSaveProduct} className="space-y-6">
          {/* Editor Header Bar */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleCancelEditor}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-pointer"
                title="Return to Product List"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center space-x-2 text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider">
                  <span>Product Configurator</span>
                  <ChevronRight className="w-3 h-3" />
                  <span>{pageMode === 'create' ? 'New Plan Definition' : 'Edit Plan Configuration'}</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                  {pageMode === 'create'
                    ? 'Create Life Insurance Product'
                    : `Configure Product: ${formData.PROD_CODE} - ${formData.PROD_NAME}`}
                </h2>
              </div>
            </div>

            <div className="flex items-center space-x-3 self-end md:self-center">
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
                    const prod = products.find((p) => p.PROD_CODE === selectedProductCode);
                    if (prod) handlePromptDelete(prod);
                  }}
                  className="px-3 py-2 text-sm font-medium text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 inline mr-1" />
                  Delete
                </button>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center px-5 py-2 text-sm font-semibold text-white bg-navy hover:bg-navy-light rounded-xl shadow-sm hover:shadow cursor-pointer disabled:opacity-50 space-x-2"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Product...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Product Configuration</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Form Section 1: Basic Plan Identification */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <Sliders className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              1. Product Identification & Type
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Product Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={pageMode === 'edit'}
                  value={formData.PROD_CODE}
                  onChange={(e) =>
                    setFormData({ ...formData, PROD_CODE: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g. TERM_PLUS_01"
                  className={`w-full px-3.5 py-2 border rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono ${
                    formErrors.PROD_CODE ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'
                  } ${pageMode === 'edit' ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''}`}
                />
                {formErrors.PROD_CODE && (
                  <p className="text-xs text-rose-500 mt-1">{formErrors.PROD_CODE}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Product / Plan Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.PROD_NAME}
                  onChange={(e) => setFormData({ ...formData, PROD_NAME: e.target.value })}
                  placeholder="e.g. Smart Shield Term Life"
                  className={`w-full px-3.5 py-2 border rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    formErrors.PROD_NAME ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {formErrors.PROD_NAME && (
                  <p className="text-xs text-rose-500 mt-1">{formErrors.PROD_NAME}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Product Classification <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.PROD_TYPE}
                  onChange={(e) => setFormData({ ...formData, PROD_TYPE: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {PRODUCT_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Validity Effective Date
                </label>
                <input
                  type="date"
                  value={formData.PROD_VALID_FM_DT}
                  onChange={(e) => setFormData({ ...formData, PROD_VALID_FM_DT: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Validity Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.PROD_VALID_TO_DT}
                  onChange={(e) => setFormData({ ...formData, PROD_VALID_TO_DT: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Free-Look / Cool-Off Days
                </label>
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={formData.PROD_COOLOFF_DAYS}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      PROD_COOLOFF_DAYS: e.target.value === '' ? '' : Number(e.target.value)
                    })
                  }
                  placeholder="15 or 30 days"
                  className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Form Section 2: Policy Terms & Age Eligibility */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              2. Policy Terms & Entry Age Rules
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Min Policy Term (Years)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.PROD_TERM_FM}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      PROD_TERM_FM: e.target.value === '' ? '' : Number(e.target.value)
                    })
                  }
                  placeholder="e.g. 5"
                  className={`w-full px-3.5 py-2 border rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    formErrors.PROD_TERM_FM ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {formErrors.PROD_TERM_FM && (
                  <p className="text-xs text-rose-500 mt-1">{formErrors.PROD_TERM_FM}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Max Policy Term (Years)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.PROD_TERM_TO}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      PROD_TERM_TO: e.target.value === '' ? '' : Number(e.target.value)
                    })
                  }
                  placeholder="e.g. 30"
                  className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Term Multiple / Step (Years)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.PROD_PERIOD_MULTIPLE}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      PROD_PERIOD_MULTIPLE: e.target.value === '' ? '' : Number(e.target.value)
                    })
                  }
                  placeholder="e.g. 1 (any year) or 5"
                  className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Min Entry Age (Years)
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={formData.PROD_MIN_AGE}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      PROD_MIN_AGE: e.target.value === '' ? '' : Number(e.target.value)
                    })
                  }
                  placeholder="e.g. 18"
                  className={`w-full px-3.5 py-2 border rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    formErrors.PROD_MIN_AGE ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {formErrors.PROD_MIN_AGE && (
                  <p className="text-xs text-rose-500 mt-1">{formErrors.PROD_MIN_AGE}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Max Entry Age (Years)
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={formData.PROD_MAX_AGE}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      PROD_MAX_AGE: e.target.value === '' ? '' : Number(e.target.value)
                    })
                  }
                  placeholder="e.g. 65"
                  className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Age Calculation Method
                </label>
                <select
                  value={formData.PROD_AGE_CALC_MTHD}
                  onChange={(e) => setFormData({ ...formData, PROD_AGE_CALC_MTHD: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {AGE_CALC_OPTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Form Section 3: Financials & Sum Assured Limits */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              3. Financial Parameters & Sum Assured Limits
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Minimum Sum Assured
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.PROD_MIN_SA}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      PROD_MIN_SA: e.target.value === '' ? '' : Number(e.target.value)
                    })
                  }
                  placeholder="e.g. 100,000"
                  className={`w-full px-3.5 py-2 border rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono ${
                    formErrors.PROD_MIN_SA ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {formErrors.PROD_MIN_SA && (
                  <p className="text-xs text-rose-500 mt-1">{formErrors.PROD_MIN_SA}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Maximum Sum Assured
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.PROD_MAX_SA}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      PROD_MAX_SA: e.target.value === '' ? '' : Number(e.target.value)
                    })
                  }
                  placeholder="e.g. 10,000,000"
                  className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Commission Plan Code (Optional)
                </label>
                <input
                  type="text"
                  value={formData.PROD_COMM_CODE}
                  onChange={(e) => setFormData({ ...formData, PROD_COMM_CODE: e.target.value })}
                  placeholder="e.g. COMM_TERM_STD"
                  className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Form Section 4: Policy Options & Features */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <HeartHandshake className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              4. Policy Options & Benefits
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Joint Life */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    Joint Life Coverage
                  </div>
                  <div className="text-xs text-gray-500">Allow dual life policy</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      PROD_JOINT_LIFE_YN: formData.PROD_JOINT_LIFE_YN === 'Y' ? 'N' : 'Y'
                    })
                  }
                  className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                    formData.PROD_JOINT_LIFE_YN === 'Y'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {formData.PROD_JOINT_LIFE_YN === 'Y' ? 'YES' : 'NO'}
                </button>
              </div>

              {/* Surrender Allowed */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    Surrender Benefit
                  </div>
                  <div className="text-xs text-gray-500">Cash surrender value</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      PROD_SURR_YN: formData.PROD_SURR_YN === 'Y' ? 'N' : 'Y'
                    })
                  }
                  className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                    formData.PROD_SURR_YN === 'Y'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {formData.PROD_SURR_YN === 'Y' ? 'YES' : 'NO'}
                </button>
              </div>

              {/* Policy Loan */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    Policy Loan Facility
                  </div>
                  <div className="text-xs text-gray-500">Loan against surrender</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      PROD_LOAN_YN: formData.PROD_LOAN_YN === 'Y' ? 'N' : 'Y'
                    })
                  }
                  className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                    formData.PROD_LOAN_YN === 'Y'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {formData.PROD_LOAN_YN === 'Y' ? 'YES' : 'NO'}
                </button>
              </div>

              {/* Maturity Benefit */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    Maturity Benefit
                  </div>
                  <div className="text-xs text-gray-500">Payout at term end</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      PROD_MAT_YN: formData.PROD_MAT_YN === 'Y' ? 'N' : 'Y'
                    })
                  }
                  className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                    formData.PROD_MAT_YN === 'Y'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {formData.PROD_MAT_YN === 'Y' ? 'YES' : 'NO'}
                </button>
              </div>
            </div>

            {/* Surrender lock-in if Surrender is YES */}
            {formData.PROD_SURR_YN === 'Y' && (
              <div className="mt-4 p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800 max-w-sm">
                <label className="block text-xs font-semibold text-emerald-900 dark:text-emerald-300 uppercase mb-1">
                  Surrender Lock-in Period (Years) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={formData.PROD_SURR_YEARS}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      PROD_SURR_YEARS: e.target.value === '' ? '' : Number(e.target.value)
                    })
                  }
                  placeholder="e.g. 3 years"
                  className="w-full px-3 py-2 border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {formErrors.PROD_SURR_YEARS && (
                  <p className="text-xs text-rose-500 mt-1">{formErrors.PROD_SURR_YEARS}</p>
                )}
              </div>
            )}
          </div>

          {/* Form Section 5: Attached Covers Configuration (MTBL_PROD_COVER) */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  5. Attached Covers & Rider Configuration (MTBL_PROD_COVER)
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Associate core life covers (Basic Life, TPD, WOP, Ancillary) that can or must be
                  selected under this product.
                </p>
              </div>

              <div className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {formData.covers.length} Cover(s) Attached
              </div>
            </div>

            {/* In-page Cover Selector Tool */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3 items-center">
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Select Cover from Master (MTBL_COVER):
                </label>
                <select
                  value={coverToAdd}
                  onChange={(e) => setCoverToAdd(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">-- Choose a Cover to Attach --</option>
                  {availableCovers.map((c) => (
                    <option key={c.coverCode} value={c.coverCode}>
                      {c.coverCode} - {c.coverDesc} ({c.coverType === 'D' ? 'Basic Life' : c.coverType === 'A' ? 'Ancillary' : 'WOP'})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddCover}
                disabled={!coverToAdd}
                className="w-full sm:w-auto px-4 py-2 mt-5 bg-navy hover:bg-navy-light text-white text-sm font-semibold rounded-xl disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-1 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Cover</span>
              </button>
            </div>

            {/* Attached Covers In-Page Data Grid */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                <thead className="bg-gray-100/70 dark:bg-gray-900/60 text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3">Cover Code</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-center">Mandatory</th>
                    <th className="px-4 py-3 text-center">Default Selected</th>
                    <th className="px-4 py-3">Cover Period (Yrs)</th>
                    <th className="px-4 py-3">Max Mat Age</th>
                    <th className="px-4 py-3">Premium Pay Yrs</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {formData.covers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                        <Info className="w-6 h-6 mx-auto mb-1 text-gray-300 dark:text-gray-600" />
                        No covers attached yet. Choose a cover from the dropdown above to link it
                        to this product.
                      </td>
                    </tr>
                  ) : (
                    formData.covers.map((c, idx) => (
                      <tr key={c.MPC_COVER_CODE} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="px-4 py-3 font-mono font-bold text-gray-900 dark:text-white">
                          {c.MPC_COVER_CODE}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {c.COVER_DESC || c.MPC_COVER_CODE}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateCoverRow(
                                idx,
                                'MPC_MANDATORY_YN',
                                c.MPC_MANDATORY_YN === 'Y' ? 'N' : 'Y'
                              )
                            }
                            className={`px-2 py-0.5 text-xs font-bold rounded cursor-pointer ${
                              c.MPC_MANDATORY_YN === 'Y'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {c.MPC_MANDATORY_YN === 'Y' ? 'YES' : 'NO'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateCoverRow(
                                idx,
                                'MPC_DEFAULT_YN',
                                c.MPC_DEFAULT_YN === 'Y' ? 'N' : 'Y'
                              )
                            }
                            className={`px-2 py-0.5 text-xs font-bold rounded cursor-pointer ${
                              c.MPC_DEFAULT_YN === 'Y'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {c.MPC_DEFAULT_YN === 'Y' ? 'YES' : 'NO'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            placeholder="Full Term"
                            value={c.MPC_PERIOD ?? ''}
                            onChange={(e) =>
                              handleUpdateCoverRow(
                                idx,
                                'MPC_PERIOD',
                                e.target.value === '' ? null : Number(e.target.value)
                              )
                            }
                            className="w-24 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="18"
                            max="99"
                            placeholder="e.g. 70"
                            value={c.MPC_MAX_AGE_ON_MAT ?? ''}
                            onChange={(e) =>
                              handleUpdateCoverRow(
                                idx,
                                'MPC_MAX_AGE_ON_MAT',
                                e.target.value === '' ? null : Number(e.target.value)
                              )
                            }
                            className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            placeholder="Regular"
                            value={c.MPC_PREM_PAY_YRS ?? ''}
                            onChange={(e) =>
                              handleUpdateCoverRow(
                                idx,
                                'MPC_PREM_PAY_YRS',
                                e.target.value === '' ? null : Number(e.target.value)
                              )
                            }
                            className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveCover(c.MPC_COVER_CODE)}
                            className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded cursor-pointer"
                            title="Remove cover"
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

          {/* Bottom Action Footer */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleCancelEditor}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 cursor-pointer"
            >
              Back to Products List
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center px-6 py-2.5 text-sm font-semibold text-white bg-navy hover:bg-navy-light rounded-xl shadow-sm hover:shadow cursor-pointer disabled:opacity-50 space-x-2"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Product Configuration</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
export default ProductsPage;
