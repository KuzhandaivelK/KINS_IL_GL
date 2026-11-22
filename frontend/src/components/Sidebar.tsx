import React, { useEffect, useState, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { menuService } from '../services/menuService';
import { MenuListItem } from '../types/menu';
import {
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
  LogOut,
  Shield,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  UserCog,
  Menu as MenuIcon,
  Layers,
  Folder,
  CircleDot,
  Calculator,
  GitBranch,
  FileText,
  Inbox
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (val: boolean) => void;
  onLogout: () => void;
}

// Icon mapping dictionary
const iconDictionary: Record<string, React.ComponentType<{ className?: string }>> = {
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
  Menu: MenuIcon,
  Layers,
  Folder,
  CircleDot,
  Calculator,
  GitBranch,
  FileText,
  Inbox
};

// Default fallback items in case API is loading or network is offline
const defaultFallbackMenus: MenuListItem[] = [
  { MENU_ID: 'DASHBOARD', MENU_NAME: 'Dashboard', MENU_PARENT_ID: null, MENU_SEQ_NO: 1, MENU_PATH: '/dashboard', MENU_ICON: 'LayoutDashboard', IS_ACTIVE: 'Y' },
  { MENU_ID: 'WORKBASKET', MENU_NAME: 'My Workbasket', MENU_PARENT_ID: null, MENU_SEQ_NO: 2, MENU_PATH: '/workbasket', MENU_ICON: 'Inbox', IS_ACTIVE: 'Y' },
  {
    MENU_ID: 'INDIVIDUAL_LIFE',
    MENU_NAME: 'Individual Life',
    MENU_PARENT_ID: null,
    MENU_SEQ_NO: 2,
    MENU_PATH: '/individual-life',
    MENU_ICON: 'UserCheck',
    IS_ACTIVE: 'Y',
    children: [
      {
        MENU_ID: 'QUICK_QUOTE',
        MENU_NAME: 'Quick Quote',
        MENU_PARENT_ID: 'INDIVIDUAL_LIFE',
        MENU_SEQ_NO: 1,
        MENU_PATH: '/individual-life/quick-quote',
        MENU_ICON: 'Calculator',
        IS_ACTIVE: 'Y'
      },
      {
        MENU_ID: 'PROPOSAL_ENTRY',
        MENU_NAME: 'Proposal Entry',
        MENU_PARENT_ID: 'INDIVIDUAL_LIFE',
        MENU_SEQ_NO: 2,
        MENU_PATH: '/individual-life/proposal',
        MENU_ICON: 'FileText',
        IS_ACTIVE: 'Y'
      }
    ]
  },
  { MENU_ID: 'GROUP_LIFE', MENU_NAME: 'Group Life', MENU_PARENT_ID: null, MENU_SEQ_NO: 3, MENU_PATH: '/group-life', MENU_ICON: 'Users', IS_ACTIVE: 'Y' },
  {
    MENU_ID: 'PRODUCT_CONFIG',
    MENU_NAME: 'Product Configuration',
    MENU_PARENT_ID: null,
    MENU_SEQ_NO: 4,
    MENU_PATH: '/product-configuration',
    MENU_ICON: 'Settings2',
    IS_ACTIVE: 'Y',
    children: [
      {
        MENU_ID: 'COVER',
        MENU_NAME: 'Cover Config',
        MENU_PARENT_ID: 'PRODUCT_CONFIG',
        MENU_SEQ_NO: 1,
        MENU_PATH: '/product-configuration/cover',
        MENU_ICON: 'Settings2',
        IS_ACTIVE: 'Y'
      },
      {
        MENU_ID: 'PRODUCT',
        MENU_NAME: 'Products',
        MENU_PARENT_ID: 'PRODUCT_CONFIG',
        MENU_SEQ_NO: 2,
        MENU_PATH: '/product-configuration/products',
        MENU_ICON: 'Package',
        IS_ACTIVE: 'Y'
      }
    ]
  },
  { MENU_ID: 'POLICY_ADMIN', MENU_NAME: 'Policy Administration', MENU_PARENT_ID: null, MENU_SEQ_NO: 5, MENU_PATH: '/policy-administration', MENU_ICON: 'Briefcase', IS_ACTIVE: 'Y' },
  { MENU_ID: 'UNDERWRITING', MENU_NAME: 'Underwriting', MENU_PARENT_ID: null, MENU_SEQ_NO: 6, MENU_PATH: '/underwriting', MENU_ICON: 'FileCheck', IS_ACTIVE: 'Y' },
  { MENU_ID: 'PREMIUM_COLLECTION', MENU_NAME: 'Premium Collection', MENU_PARENT_ID: null, MENU_SEQ_NO: 7, MENU_PATH: '/premium-collection', MENU_ICON: 'CreditCard', IS_ACTIVE: 'Y' },
  { MENU_ID: 'CLAIMS_MGMT', MENU_NAME: 'Claims Management', MENU_PARENT_ID: null, MENU_SEQ_NO: 8, MENU_PATH: '/claims-management', MENU_ICON: 'ShieldAlert', IS_ACTIVE: 'Y' },
  { MENU_ID: 'COMMISSION_MGMT', MENU_NAME: 'Commission Management', MENU_PARENT_ID: null, MENU_SEQ_NO: 9, MENU_PATH: '/commission-management', MENU_ICON: 'Percent', IS_ACTIVE: 'Y' },
  { MENU_ID: 'REINSURANCE', MENU_NAME: 'Reinsurance', MENU_PARENT_ID: null, MENU_SEQ_NO: 10, MENU_PATH: '/reinsurance', MENU_ICON: 'Coins', IS_ACTIVE: 'Y' },
  { MENU_ID: 'REPORTS', MENU_NAME: 'Reports', MENU_PARENT_ID: null, MENU_SEQ_NO: 11, MENU_PATH: '/reports', MENU_ICON: 'BarChart3', IS_ACTIVE: 'Y' },
  {
    MENU_ID: 'ADMINISTRATION',
    MENU_NAME: 'Administration',
    MENU_PARENT_ID: null,
    MENU_SEQ_NO: 12,
    MENU_PATH: '/administration',
    MENU_ICON: 'Sliders',
    IS_ACTIVE: 'Y',
    children: [
      { MENU_ID: 'USER_MANAGEMENT', MENU_NAME: 'User Management', MENU_PARENT_ID: 'ADMINISTRATION', MENU_SEQ_NO: 1, MENU_PATH: '/administration/users', MENU_ICON: 'UserCog', IS_ACTIVE: 'Y' },
      { MENU_ID: 'MENU_MANAGEMENT', MENU_NAME: 'Menu Setup', MENU_PARENT_ID: 'ADMINISTRATION', MENU_SEQ_NO: 2, MENU_PATH: '/administration/menus', MENU_ICON: 'Menu', IS_ACTIVE: 'Y' },
      { MENU_ID: 'CUSTOMER_MANAGEMENT', MENU_NAME: 'Customers', MENU_PARENT_ID: 'ADMINISTRATION', MENU_SEQ_NO: 3, MENU_PATH: '/administration/customers', MENU_ICON: 'Folder', IS_ACTIVE: 'Y' },
      { MENU_ID: 'RATE_FACT', MENU_NAME: 'Rating Engine', MENU_PARENT_ID: 'ADMINISTRATION', MENU_SEQ_NO: 4, MENU_PATH: '/administration/rating', MENU_ICON: 'Layers', IS_ACTIVE: 'Y' },
      { MENU_ID: 'WORKFLOW_CONFIG', MENU_NAME: 'Workflow Setup', MENU_PARENT_ID: 'ADMINISTRATION', MENU_SEQ_NO: 5, MENU_PATH: '/administration/workflow', MENU_ICON: 'GitBranch', IS_ACTIVE: 'Y' }
    ]
  }
];

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
  onLogout
}) => {
  const [dbMenus, setDbMenus] = useState<MenuListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    ADMINISTRATION: true, // Keep Administration expanded by default
    PRODUCT_CONFIG: true, // Keep Product Config expanded by default
    INDIVIDUAL_LIFE: true // Keep Individual Life expanded by default
  });
  const location = useLocation();

  // Load database-driven menu hierarchy from Oracle MTBL_MENU
  const loadMenusFromDb = async () => {
    try {
      const res = await menuService.getMenus(true, true);
      if (res.success && res.menus && res.menus.length > 0) {
        setDbMenus(res.menus);
      } else {
        setDbMenus(defaultFallbackMenus);
      }
    } catch {
      setDbMenus(defaultFallbackMenus);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMenusFromDb();

    // Listen for custom event when menus are updated in Menu Setup screen
    const handleMenuUpdate = () => loadMenusFromDb();
    window.addEventListener('insurance_menus_updated', handleMenuUpdate);
    return () => window.removeEventListener('insurance_menus_updated', handleMenuUpdate);
  }, []);

  // Use loaded database menus or fallback
  const activeMenuItems = useMemo(() => {
    return dbMenus.length > 0 ? dbMenus : defaultFallbackMenus;
  }, [dbMenus]);

  const toggleSubmenu = (menuId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenSubmenus((prev) => ({
      ...prev,
      [menuId]: !prev[menuId]
    }));
  };

  const getIcon = (iconName: string | null) => {
    if (!iconName) return Layers;
    return iconDictionary[iconName] || Layers;
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-navy-dark text-slate-200 transition-all duration-300 ease-in-out border-r border-slate-800 ${
          collapsed ? 'w-20' : 'w-64'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80 bg-navy-dark/95">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-lg bg-teal-accent/20 border border-teal-accent/30 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-teal-accent" />
            </div>
            {!collapsed && (
              <div className="flex flex-col whitespace-nowrap">
                <span className="font-extrabold text-base tracking-wider text-white">
                  LIFE CORE
                </span>
                <span className="text-[10px] text-teal-accent font-semibold tracking-wide flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-accent animate-pulse" />
                  DB DRIVEN MENUS
                </span>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          <button
            type="button"
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
            onClick={() => setMobileOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Dynamic Database-Driven Navigation Menu */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {activeMenuItems.map((item) => {
            const Icon = getIcon(item.MENU_ICON);
            const hasChildren = item.children && item.children.length > 0;
            const isSubmenuOpen = openSubmenus[item.MENU_ID] ?? false;
            const isCurrentParentActive =
              hasChildren &&
              item.children?.some((child) => child.MENU_PATH && location.pathname.startsWith(child.MENU_PATH));

            return (
              <div key={item.MENU_ID} className="space-y-1">
                {/* Parent Menu Item */}
                <div className="relative">
                  <NavLink
                    to={item.MENU_PATH || '#'}
                    onClick={(e) => {
                      if (hasChildren && !collapsed) {
                        toggleSubmenu(item.MENU_ID, e);
                      } else {
                        setMobileOpen(false);
                      }
                    }}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group ${
                        isActive || isCurrentParentActive
                          ? 'bg-teal-accent text-white shadow-sm shadow-teal-accent/30 font-semibold'
                          : 'text-slate-300 hover:text-white hover:bg-white/10'
                      } ${collapsed ? 'justify-center' : ''}`
                    }
                    title={collapsed ? item.MENU_NAME : undefined}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && (
                      <span className="truncate flex-1 text-left">{item.MENU_NAME}</span>
                    )}

                    {/* Submenu chevron indicator */}
                    {!collapsed && hasChildren && (
                      <span
                        onClick={(e) => toggleSubmenu(item.MENU_ID, e)}
                        className="p-1 rounded hover:bg-white/10 text-slate-400 group-hover:text-white transition-transform"
                      >
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            isSubmenuOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </span>
                    )}
                  </NavLink>
                </div>

                {/* Nested Submenu Items */}
                {!collapsed && hasChildren && isSubmenuOpen && (
                  <div className="pl-6 pr-1 py-1 space-y-1 border-l-2 border-slate-800 ml-5">
                    {item.children?.map((child) => {
                      const ChildIcon = getIcon(child.MENU_ICON);
                      return (
                        <NavLink
                          key={child.MENU_ID}
                          to={child.MENU_PATH || '#'}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                              isActive
                                ? 'bg-teal-light text-navy font-bold shadow-xs'
                                : 'text-slate-400 hover:text-white hover:bg-white/10'
                            }`
                          }
                        >
                          <ChildIcon className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{child.MENU_NAME}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer with Sign Out */}
        <div className="p-3 border-t border-slate-800/80 bg-navy-dark/95">
          <button
            type="button"
            onClick={onLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-300 hover:text-red-100 hover:bg-red-500/20 transition-all duration-150 ${
              collapsed ? 'justify-center' : ''
            }`}
            title="Sign Out"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
