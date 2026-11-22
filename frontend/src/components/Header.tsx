import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { Menu, Search, Bell, User as UserIcon, LogOut, ChevronDown, ShieldCheck, Inbox, ArrowRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { workflowService } from '../services/workflowService';
import { WorkbasketSummary } from '../types/workflow';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu, onLogout }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [workbasket, setWorkbasket] = useState<WorkbasketSummary | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch live workbasket pending items
  useEffect(() => {
    let isMounted = true;
    const fetchWorkbasket = async () => {
      try {
        const data = await workflowService.getWorkbasket();
        if (isMounted) setWorkbasket(data);
      } catch (err) {
        // Silently handle if unauthenticated
      }
    };
    if (user) {
      fetchWorkbasket();
      const interval = setInterval(fetchWorkbasket, 30000); // Poll every 30s
      return () => { isMounted = false; clearInterval(interval); };
    }
  }, [user]);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
        setNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format breadcrumbs dynamically
  const pathParts = location.pathname.split('/').filter(Boolean);
  const currentModuleName = pathParts.length > 0 
    ? pathParts[0].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : 'Dashboard';

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between shadow-xs">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus:outline-none"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center space-x-2 text-xs font-medium text-slate-500">
          <span className="hover:text-slate-800">Home</span>
          <span className="text-slate-300">/</span>
          <span className="text-navy font-semibold">{currentModuleName}</span>
        </nav>
      </div>

      {/* Middle: Enterprise Search Input */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search policy #, member, or claim reference..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 text-text-main placeholder-slate-400 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy focus:bg-white transition duration-150"
          />
        </div>
      </div>

      {/* Right: Actions, Notifications, and User Menu */}
      <div className="flex items-center gap-3" ref={menuRef}>
        {/* Workbasket Notifications with Live Pending Badge */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotificationOpen(!notificationOpen);
              setUserMenuOpen(false);
            }}
            className="p-2 text-slate-500 hover:text-navy hover:bg-slate-100 rounded-lg relative transition-colors focus:outline-none"
            title="Pending Workbasket Approvals"
          >
            <Bell className="w-5 h-5" />
            {workbasket && workbasket.totalPending > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs">
                {workbasket.totalPending > 99 ? '99+' : workbasket.totalPending}
              </span>
            ) : (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          {notificationOpen && (
            <div className="absolute right-0 mt-2 w-84 bg-white rounded-xl shadow-xl border border-slate-200 py-3 z-50 animate-in fade-in zoom-in-95">
              <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Inbox className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-navy uppercase tracking-wider">Pending Workbasket</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  (workbasket?.totalPending ?? 0) > 0 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {workbasket?.totalPending ?? 0} Pending
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
                {!workbasket?.items || workbasket.items.length === 0 ? (
                  <div className="p-4 text-center text-slate-400">
                    <p className="text-xs font-medium">All caught up!</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">No pending approvals for {user?.userGroup || 'your group'}.</p>
                  </div>
                ) : (
                  workbasket.items.slice(0, 5).map(item => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setNotificationOpen(false);
                        navigate(item.navigationUrl);
                      }}
                      className="p-3 hover:bg-blue-50/50 cursor-pointer transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-navy">{item.refNo}</span>
                        <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          {item.type}
                        </span>
                      </div>
                      <p className="font-medium text-slate-700 truncate">{item.customerName}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                        <span className="text-amber-700 font-medium truncate max-w-[180px]">{item.requiredAction}</span>
                        <span className="font-semibold text-slate-800">${item.amount.toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="px-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationOpen(false);
                    navigate('/workbasket');
                  }}
                  className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Go to Full Workbasket</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setUserMenuOpen(!userMenuOpen);
              setNotificationOpen(false);
            }}
            className="flex items-center gap-2.5 p-1.5 pl-2.5 pr-2 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none border border-transparent hover:border-slate-200"
          >
            <div className="w-8 h-8 rounded-lg bg-navy text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
              {user?.userName ? user.userName.charAt(0) : <UserIcon className="w-4 h-4" />}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-bold text-navy leading-tight">
                {user?.userName || 'Authenticated User'}
              </span>
              <span className="text-[10px] text-slate-500 leading-tight">
                ID: {user?.userId || 'N/A'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-bold text-navy">{user?.userName}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">User ID: <span className="font-mono">{user?.userId}</span></p>
                {user?.description && (
                  <p className="text-[11px] text-slate-500 mt-0.5">{user.description}</p>
                )}
                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Oracle Session Active</span>
                </div>
              </div>

              <div className="px-2 py-1">
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  <span>Sign Out of Life Core</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
