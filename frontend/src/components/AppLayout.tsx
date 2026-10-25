import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-surface-bg flex">
      {/* Sidebar Navigation */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onLogout={handleLogout}
      />

      {/* Main Wrapper */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          collapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        {/* Top Header */}
        <Header
          onToggleMobileMenu={() => setMobileOpen(!mobileOpen)}
          onLogout={handleLogout}
        />

        {/* Page Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>

        {/* Enterprise Dashboard Footer */}
        <footer className="py-4 px-6 bg-white border-t border-slate-200/80 text-center text-xs text-slate-500">
          <p className="font-medium text-slate-700">
            Life Insurance Core System &bull; Individual Life & Group Life Administration
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Phase 1 Demonstration Dashboard &bull; &copy; {currentYear} KINSUREPLUS / KINS Schema
          </p>
        </footer>
      </div>
    </div>
  );
};
