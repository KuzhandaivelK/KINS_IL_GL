import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { menuService } from '../services/menuService';
import { MenuListItem, CreateMenuInput, UpdateMenuInput } from '../types/menu';
import {
  Menu as MenuIcon,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  FolderTree,
  Hash,
  Link as LinkIcon,
  Layers,
  LayoutDashboard,
  UserCheck,
  Users,
  Settings2,
  Briefcase,
  FileCheck,
  CreditCard,
  ShieldAlert,
  Percent,
  Coins,
  BarChart3,
  Sliders,
  UserCog,
  Folder
} from 'lucide-react';

const availableIcons: Array<{ name: string; icon: React.ComponentType<{ className?: string }> }> = [
  { name: 'LayoutDashboard', icon: LayoutDashboard },
  { name: 'UserCheck', icon: UserCheck },
  { name: 'Users', icon: Users },
  { name: 'Settings2', icon: Settings2 },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'FileCheck', icon: FileCheck },
  { name: 'CreditCard', icon: CreditCard },
  { name: 'ShieldAlert', icon: ShieldAlert },
  { name: 'Percent', icon: Percent },
  { name: 'Coins', icon: Coins },
  { name: 'BarChart3', icon: BarChart3 },
  { name: 'Sliders', icon: Sliders },
  { name: 'UserCog', icon: UserCog },
  { name: 'Menu', icon: MenuIcon },
  { name: 'Layers', icon: Layers },
  { name: 'Folder', icon: Folder }
];

export const MenusPage: React.FC = () => {
  const [menus, setMenus] = useState<MenuListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<MenuListItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<{
    menuId: string;
    menuName: string;
    menuParentId: string;
    menuSeqNo: number;
    menuPath: string;
    menuIcon: string;
    isActive: 'Y' | 'N';
  }>({
    menuId: '',
    menuName: '',
    menuParentId: '',
    menuSeqNo: 1,
    menuPath: '',
    menuIcon: 'Layers',
    isActive: 'Y'
  });

  const fetchMenus = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await menuService.getMenus(false, false);
      if (res.success) {
        setMenus(res.menus);
      } else {
        setErrorMsg(res.message || 'Failed to retrieve menus from Oracle MTBL_MENU.');
      }
    } catch {
      setErrorMsg('Failed to connect to backend server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMenus();
  }, []);

  const notifySidebarUpdate = () => {
    window.dispatchEvent(new CustomEvent('insurance_menus_updated'));
  };

  const topLevelMenus = menus.filter((m) => !m.MENU_PARENT_ID);

  const filteredMenus = menus.filter((m) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      m.MENU_ID.toLowerCase().includes(term) ||
      m.MENU_NAME.toLowerCase().includes(term) ||
      (m.MENU_PATH && m.MENU_PATH.toLowerCase().includes(term))
    );
  });

  const handleOpenCreateModal = (parentId?: string) => {
    // Determine next sequence number
    const siblings = menus.filter((m) => (parentId ? m.MENU_PARENT_ID === parentId : !m.MENU_PARENT_ID));
    const nextSeq = siblings.length > 0 ? Math.max(...siblings.map((s) => s.MENU_SEQ_NO)) + 1 : 1;

    setFormData({
      menuId: '',
      menuName: '',
      menuParentId: parentId || '',
      menuSeqNo: nextSeq,
      menuPath: '',
      menuIcon: 'Layers',
      isActive: 'Y'
    });
    setErrorMsg(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (menu: MenuListItem) => {
    setSelectedMenu(menu);
    setFormData({
      menuId: menu.MENU_ID,
      menuName: menu.MENU_NAME,
      menuParentId: menu.MENU_PARENT_ID || '',
      menuSeqNo: menu.MENU_SEQ_NO,
      menuPath: menu.MENU_PATH || '',
      menuIcon: menu.MENU_ICON || 'Layers',
      isActive: menu.IS_ACTIVE
    });
    setErrorMsg(null);
    setIsEditModalOpen(true);
  };

  const handleOpenDeleteModal = (menu: MenuListItem) => {
    setSelectedMenu(menu);
    setErrorMsg(null);
    setIsDeleteModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.menuId.trim() || !formData.menuName.trim()) {
      setErrorMsg('Please enter Menu ID and Menu Name.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const payload: CreateMenuInput = {
        menuId: formData.menuId.trim().toUpperCase(),
        menuName: formData.menuName.trim(),
        menuParentId: formData.menuParentId ? formData.menuParentId.trim().toUpperCase() : null,
        menuSeqNo: Number(formData.menuSeqNo) || 1,
        menuPath: formData.menuPath.trim() || null,
        menuIcon: formData.menuIcon || 'Layers',
        isActive: formData.isActive
      };

      const res = await menuService.createMenu(payload);
      if (res.success) {
        setSuccessMsg(`Menu '${payload.menuId}' created successfully in Oracle MTBL_MENU.`);
        setIsCreateModalOpen(false);
        fetchMenus();
        notifySidebarUpdate();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.message || 'Failed to create menu.');
      }
    } catch {
      setErrorMsg('Error creating menu entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenu) return;
    if (!formData.menuName.trim()) {
      setErrorMsg('Menu Name cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const payload: UpdateMenuInput = {
        menuName: formData.menuName.trim(),
        menuParentId: formData.menuParentId ? formData.menuParentId.trim().toUpperCase() : null,
        menuSeqNo: Number(formData.menuSeqNo) || 1,
        menuPath: formData.menuPath.trim() || null,
        menuIcon: formData.menuIcon || 'Layers',
        isActive: formData.isActive
      };

      const res = await menuService.updateMenu(selectedMenu.MENU_ID, payload);
      if (res.success) {
        setSuccessMsg(`Menu '${selectedMenu.MENU_ID}' updated successfully.`);
        setIsEditModalOpen(false);
        fetchMenus();
        notifySidebarUpdate();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.message || 'Failed to update menu.');
      }
    } catch {
      setErrorMsg('Error updating menu entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedMenu) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await menuService.deleteMenu(selectedMenu.MENU_ID);
      if (res.success) {
        setSuccessMsg(`Menu '${selectedMenu.MENU_ID}' deleted from Oracle MTBL_MENU.`);
        setIsDeleteModalOpen(false);
        fetchMenus();
        notifySidebarUpdate();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.message || 'Failed to delete menu.');
      }
    } catch {
      setErrorMsg('Error deleting menu entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getIconComponent = (iconName: string | null) => {
    const item = availableIcons.find((i) => i.name === iconName);
    return item ? item.icon : Layers;
  };

  const totalMenus = menus.length;
  const activeMenus = menus.filter((m) => m.IS_ACTIVE === 'Y').length;
  const submenusCount = menus.filter((m) => m.MENU_PARENT_ID).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs font-medium text-slate-500">
        <Link to="/dashboard" className="hover:text-navy transition-colors">Dashboard</Link>
        <span className="text-slate-300">/</span>
        <span className="hover:text-navy transition-colors">Administration</span>
        <span className="text-slate-300">/</span>
        <span className="text-navy font-semibold">Menu Setup</span>
      </nav>

      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h1 className="text-2xl font-bold text-navy tracking-tight">
              Menu Setup & Hierarchy
            </h1>
            <span className="text-[10px] font-bold text-teal-accent bg-teal-light px-2 py-0.5 rounded-full border border-teal-accent/20">
              Oracle MTBL_MENU
            </span>
          </div>
          <p className="text-xs text-text-secondary">
            Manage database-driven navigation routes, parent-child menus, sorting sequences, and Lucide icons.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchMenus}
            className="p-2.5 rounded-lg border border-slate-200 text-slate-600 hover:text-navy hover:bg-slate-50 transition-colors"
            title="Refresh Menus"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => handleOpenCreateModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-navy hover:bg-navy-light text-white text-xs font-semibold shadow-xs hover:shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Menu Entry</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
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

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Menus Configured</span>
          <p className="text-2xl font-extrabold text-navy mt-1">{totalMenus}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 uppercase">Active Dynamic Menus</span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">{activeMenus}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <span className="text-xs font-semibold text-blue-corporate uppercase">Nested Submenus</span>
          <p className="text-2xl font-extrabold text-blue-corporate mt-1">{submenusCount}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Menu ID, Name, or Route..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing {filteredMenus.length} of {totalMenus} menu items from MTBL_MENU
        </div>
      </div>

      {/* Menu Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <th className="py-3 px-4 text-center">Seq #</th>
                <th className="py-3 px-4">Menu ID</th>
                <th className="py-3 px-4">Menu Name</th>
                <th className="py-3 px-4">Parent Menu</th>
                <th className="py-3 px-4">Route Path</th>
                <th className="py-3 px-4 text-center">Icon</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-text-main">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-navy mb-2" />
                    <span>Loading menus from Oracle MTBL_MENU...</span>
                  </td>
                </tr>
              ) : filteredMenus.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    No menu records found. Click &quot;Add Menu Entry&quot; to configure one.
                  </td>
                </tr>
              ) : (
                filteredMenus.map((m) => {
                  const Icon = getIconComponent(m.MENU_ICON);
                  return (
                    <tr key={m.MENU_ID} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-600">
                        {m.MENU_SEQ_NO}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-navy">
                        {m.MENU_ID}
                      </td>
                      <td className="py-3 px-4 font-semibold text-text-main">
                        <div className="flex items-center gap-2">
                          {m.MENU_PARENT_ID && <span className="text-slate-300 ml-2">&bull;</span>}
                          <span>{m.MENU_NAME}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {m.MENU_PARENT_ID ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-blue-corporate bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            <FolderTree className="w-3 h-3" />
                            <span>{m.MENU_PARENT_ID}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">None (Root)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {m.MENU_PATH || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center justify-center p-1.5 rounded-md bg-navy/5 text-navy" title={m.MENU_ICON || 'Layers'}>
                          <Icon className="w-4 h-4" />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {m.IS_ACTIVE === 'Y' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            <span>Inactive</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(m)}
                            className="p-1.5 rounded text-blue-corporate hover:bg-blue-50 transition-colors"
                            title="Edit Menu Entry"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(m)}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete Menu Entry"
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

      {/* CREATE MENU MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-navy text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MenuIcon className="w-5 h-5 text-teal-accent" />
                <h3 className="font-bold text-sm tracking-wide">Add Menu Entry (MTBL_MENU)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-300 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
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
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Menu ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. POLICY_SEARCH"
                    value={formData.menuId}
                    onChange={(e) => setFormData({ ...formData, menuId: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold uppercase bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white"
                  />
                  <span className="text-[10px] text-slate-400">Uppercase unique key</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Menu Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Policy Search"
                    value={formData.menuName}
                    onChange={(e) => setFormData({ ...formData, menuName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Parent Menu (Hierarchy)
                  </label>
                  <select
                    value={formData.menuParentId}
                    onChange={(e) => setFormData({ ...formData, menuParentId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white"
                  >
                    <option value="">None (Top-Level Menu)</option>
                    {topLevelMenus.map((parent) => (
                      <option key={parent.MENU_ID} value={parent.MENU_ID}>
                        {parent.MENU_NAME} ({parent.MENU_ID})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Sequence Number (MENU_SEQ_NO) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Hash className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="number"
                      min={1}
                      required
                      value={formData.menuSeqNo}
                      onChange={(e) => setFormData({ ...formData, menuSeqNo: parseInt(e.target.value, 10) || 1 })}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Route Path (MENU_PATH)
                  </label>
                  <div className="relative">
                    <LinkIcon className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. /policy/search"
                      value={formData.menuPath}
                      onChange={(e) => setFormData({ ...formData, menuPath: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Icon (MENU_ICON)
                  </label>
                  <select
                    value={formData.menuIcon}
                    onChange={(e) => setFormData({ ...formData, menuIcon: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white"
                  >
                    {availableIcons.map((i) => (
                      <option key={i.name} value={i.name}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-main mb-1">
                  Active Status
                </label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={formData.isActive === 'Y'}
                      onChange={() => setFormData({ ...formData, isActive: 'Y' })}
                      className="text-navy focus:ring-navy"
                    />
                    <span className="font-semibold text-emerald-700">Active (Y)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={formData.isActive === 'N'}
                      onChange={() => setFormData({ ...formData, isActive: 'N' })}
                      className="text-slate-500 focus:ring-slate-500"
                    />
                    <span className="font-semibold text-slate-500">Inactive (N)</span>
                  </label>
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
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Menu to Oracle</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MENU MODAL */}
      {isEditModalOpen && selectedMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-navy text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-teal-accent" />
                <h3 className="font-bold text-sm tracking-wide">Edit Menu: {selectedMenu.MENU_ID}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-300 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
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
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Menu ID (Primary Key)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={selectedMenu.MENU_ID}
                    className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-mono font-bold cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Menu Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.menuName}
                    onChange={(e) => setFormData({ ...formData, menuName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Parent Menu
                  </label>
                  <select
                    value={formData.menuParentId}
                    onChange={(e) => setFormData({ ...formData, menuParentId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white"
                  >
                    <option value="">None (Top-Level Menu)</option>
                    {topLevelMenus
                      .filter((p) => p.MENU_ID !== selectedMenu.MENU_ID)
                      .map((parent) => (
                        <option key={parent.MENU_ID} value={parent.MENU_ID}>
                          {parent.MENU_NAME} ({parent.MENU_ID})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Sequence Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formData.menuSeqNo}
                    onChange={(e) => setFormData({ ...formData, menuSeqNo: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Route Path
                  </label>
                  <input
                    type="text"
                    value={formData.menuPath}
                    onChange={(e) => setFormData({ ...formData, menuPath: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Icon
                  </label>
                  <select
                    value={formData.menuIcon}
                    onChange={(e) => setFormData({ ...formData, menuIcon: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white"
                  >
                    {availableIcons.map((i) => (
                      <option key={i.name} value={i.name}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-main mb-1">
                  Active Status
                </label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="editIsActive"
                      checked={formData.isActive === 'Y'}
                      onChange={() => setFormData({ ...formData, isActive: 'Y' })}
                      className="text-navy focus:ring-navy"
                    />
                    <span className="font-semibold text-emerald-700">Active (Y)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="editIsActive"
                      checked={formData.isActive === 'N'}
                      onChange={() => setFormData({ ...formData, isActive: 'N' })}
                      className="text-slate-500 focus:ring-slate-500"
                    />
                    <span className="font-semibold text-slate-500">Inactive (N)</span>
                  </label>
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
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && selectedMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 p-6">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-center text-navy">
              Delete Menu Entry
            </h3>

            <p className="mt-2 text-xs text-center text-slate-500 leading-relaxed">
              Are you sure you want to permanently delete menu entry <strong className="font-mono text-navy">{selectedMenu.MENU_ID}</strong> ({selectedMenu.MENU_NAME}) from Oracle MTBL_MENU?
            </p>

            {errorMsg && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-3">
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
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
