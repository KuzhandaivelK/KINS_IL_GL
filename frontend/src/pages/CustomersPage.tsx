// frontend/src/pages/CustomersPage.tsx

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { customerService } from '../services/customerService';
import { CustomerListItem, CreateCustomerInput, UpdateCustomerInput } from '../types/customer';
import {
  UserPlus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerListItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<{
    customerId: string;
    customerName: string;
    customerType?: string;
    address?: string;
    phone?: string;
    email?: string;
    status: 'Y' | 'N';
  }>({
    customerId: '',
    customerName: '',
    customerType: '',
    address: '',
    phone: '',
    email: '',
    status: 'Y'
  });

  const fetchCustomers = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await customerService.getCustomers(searchTerm);
      if (res.success) {
        setCustomers(res.customers);
      } else {
        setErrorMsg(res.message || 'Failed to retrieve customers');
      }
    } catch {
      setErrorMsg('Network error while fetching customers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [searchTerm]);

  const handleOpenCreateModal = () => {
    setFormData({
      customerId: '',
      customerName: '',
      customerType: '',
      address: '',
      phone: '',
      email: '',
      status: 'Y'
    });
    setErrorMsg(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (cust: CustomerListItem) => {
    setSelectedCustomer(cust);
    setFormData({
      customerId: cust.customerId,
      customerName: cust.customerName,
      customerType: cust.customerType ?? '',
      address: cust.address ?? '',
      phone: cust.phone ?? '',
      email: cust.email ?? '',
      status: cust.status
    });
    setErrorMsg(null);
    setIsEditModalOpen(true);
  };

  const handleOpenDeleteModal = (cust: CustomerListItem) => {
    setSelectedCustomer(cust);
    setErrorMsg(null);
    setIsDeleteModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId.trim() || !formData.customerName.trim()) {
      setErrorMsg('Customer ID and Name are required');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const payload: CreateCustomerInput = {
        customerId: formData.customerId.trim(),
        customerName: formData.customerName.trim(),
        customerType: formData.customerType?.trim() || undefined,
        address: formData.address?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        email: formData.email?.trim() || undefined,
        status: formData.status
      };
      const res = await customerService.createCustomer(payload);
      if (res.success) {
        setSuccessMsg(`Customer '${payload.customerId}' created`);
        setIsCreateModalOpen(false);
        fetchCustomers();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.message || 'Failed to create customer');
      }
    } catch {
      setErrorMsg('Error creating customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    if (!formData.customerName.trim()) {
      setErrorMsg('Customer Name is required');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const payload: UpdateCustomerInput = {
        customerName: formData.customerName.trim(),
        customerType: formData.customerType?.trim() || undefined,
        address: formData.address?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        email: formData.email?.trim() || undefined,
        status: formData.status
      };
      const res = await customerService.updateCustomer(selectedCustomer.customerId, payload);
      if (res.success) {
        setSuccessMsg(`Customer '${selectedCustomer.customerId}' updated`);
        setIsEditModalOpen(false);
        fetchCustomers();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.message || 'Failed to update customer');
      }
    } catch {
      setErrorMsg('Error updating customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedCustomer) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await customerService.deleteCustomer(selectedCustomer.customerId);
      if (res.success) {
        setSuccessMsg(`Customer '${selectedCustomer.customerId}' deleted`);
        setIsDeleteModalOpen(false);
        fetchCustomers();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.message || 'Failed to delete customer');
      }
    } catch {
      setErrorMsg('Error deleting customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCount = customers.filter(c => c.status === 'Y').length;
  const disabledCount = customers.filter(c => c.status === 'N').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs font-medium text-slate-500">
        <Link to="/dashboard" className="hover:text-navy transition-colors">Dashboard</Link>
        <span className="text-slate-300">/</span>
        <span className="hover:text-navy transition-colors">Administration</span>
        <span className="text-slate-300">/</span>
        <span className="text-navy font-semibold">Customers</span>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy tracking-tight">Customer Management</h1>
          <p className="text-xs text-text-secondary">Create, search, update and delete customer records (MTBL_CUSTOMER).</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={fetchCustomers} className="p-2.5 rounded-lg border border-slate-200 text-slate-600 hover:text-navy hover:bg-slate-50 transition-colors" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button type="button" onClick={handleOpenCreateModal} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-navy hover:bg-navy-light text-white text-xs font-semibold shadow-xs transition-all">
            <UserPlus className="w-4 h-4" />
            <span>Create New Customer</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && !isCreateModalOpen && !isEditModalOpen && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Customers</span>
          <p className="text-2xl font-extrabold text-navy mt-1">{customers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 uppercase">Active (Y)</span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <span className="text-xs font-semibold text-red-600 uppercase">Inactive (N)</span>
          <p className="text-2xl font-extrabold text-red-600 mt-1">{disabledCount}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Customer ID or Name..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white"
          />
        </div>
        {/* No status filter for simplicity */}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <th className="py-3 px-4">Customer ID</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-text-main">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-navy mb-2" />
                    <span>Loading customers...</span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">No customers found.</td>
                </tr>
              ) : (
                customers.map(c => (
                  <tr key={c.customerId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-navy">{c.customerId}</td>
                    <td className="py-3 px-4">{c.customerName}</td>
                    <td className="py-3 px-4 text-slate-600">{c.customerType || '-'}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {c.email && <span>{c.email}<br/></span>}
                      {c.phone && <span>{c.phone}</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {c.status === 'Y' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                          <XCircle className="w-3 h-3 text-red-600" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button type="button" onClick={() => handleOpenEditModal(c)} className="p-1.5 rounded text-blue-corporate hover:bg-blue-50 transition-colors" title="Edit Customer">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => handleOpenDeleteModal(c)} className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors" title="Delete Customer">
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

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-navy text-white flex items-center justify-between">
              <h3 className="font-bold text-sm tracking-wide">Create New Customer</h3>
              <button type="button" onClick={() => setIsCreateModalOpen(false)} className="text-slate-300 hover:text-white text-lg font-bold">&times;</button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Customer ID<span className="text-red-500">*</span></label>
                  <input type="text" required placeholder="e.g. CUST001" value={formData.customerId} onChange={e => setFormData({ ...formData, customerId: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Name<span className="text-red-500">*</span></label>
                  <input type="text" required placeholder="e.g. Acme Corp" value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Type</label>
                  <input type="text" placeholder="e.g. Corporate" value={formData.customerType} onChange={e => setFormData({ ...formData, customerType: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Email</label>
                  <input type="email" placeholder="e.g. contact@acme.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Phone</label>
                  <input type="text" placeholder="e.g. +1-555-1234" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-text-main mb-1">Address</label>
                  <input type="text" placeholder="Street, City, Country" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-text-main mb-1">Status</label>
                  <div className="flex items-center gap-4 pt-1">
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input type="radio" name="status" checked={formData.status === 'Y'} onChange={() => setFormData({ ...formData, status: 'Y' })} className="text-navy focus:ring-navy" />
                      <span className="font-semibold text-emerald-700">Active (Y)</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input type="radio" name="status" checked={formData.status === 'N'} onChange={() => setFormData({ ...formData, status: 'N' })} className="text-red-600 focus:ring-red-600" />
                      <span className="font-semibold text-red-600">Inactive (N)</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 rounded-lg bg-navy hover:bg-navy-light text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-60">
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Customer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-navy text-white flex items-center justify-between">
              <h3 className="font-bold text-sm tracking-wide">Edit Customer: {selectedCustomer.customerId}</h3>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="text-slate-300 hover:text-white text-lg font-bold">&times;</button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Customer ID (readonly)</label>
                  <input type="text" disabled value={selectedCustomer.customerId} className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Name<span className="text-red-500">*</span></label>
                  <input type="text" required value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Type</label>
                  <input type="text" value={formData.customerType} onChange={e => setFormData({ ...formData, customerType: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">Phone</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-text-main mb-1">Address</label>
                  <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-text-main mb-1">Status</label>
                  <div className="flex items-center gap-4 pt-1">
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input type="radio" name="statusEdit" checked={formData.status === 'Y'} onChange={() => setFormData({ ...formData, status: 'Y' })} className="text-navy focus:ring-navy" />
                      <span className="font-semibold text-emerald-700">Active (Y)</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input type="radio" name="statusEdit" checked={formData.status === 'N'} onChange={() => setFormData({ ...formData, status: 'N' })} className="text-red-600 focus:ring-red-600" />
                      <span className="font-semibold text-red-600">Inactive (N)</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 rounded-lg bg-navy hover:bg-navy-light text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-60">
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {isDeleteModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-center text-navy mb-4">Delete Customer</h3>
            <p className="text-xs text-center text-slate-500 mb-4">
              Are you sure you want to permanently delete customer <strong className="font-mono text-navy">{selectedCustomer.customerId}</strong> ({selectedCustomer.customerName})?
            </p>
            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}
            <div className="flex items-center justify-center gap-3">
              <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={handleDeleteSubmit} disabled={isSubmitting} className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-60">
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
