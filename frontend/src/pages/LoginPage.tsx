import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { LoginForm } from '../components/LoginForm';
import { Shield, Umbrella, HeartPulse, Building2, Lock, CheckCircle2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // If already authenticated, redirect to /dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen flex flex-col justify-between bg-surface-bg font-sans">
      {/* Main Two-Column Layout */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Branding Panel */}
        <div className="lg:w-1/2 bg-gradient-to-br from-navy-dark via-navy to-blue-corporate text-white p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle geometric background patterns */}
          <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-teal-accent/10 blur-2xl pointer-events-none" />

          {/* Top Brand Logo */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner">
              <Shield className="w-7 h-7 text-teal-accent" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-wider uppercase block">
                LIFE CORE
              </span>
              <span className="text-xs text-slate-300 font-medium tracking-wide">
                ENTERPRISE SYSTEM
              </span>
            </div>
          </div>

          {/* Middle Branding Visual and Copy */}
          <div className="relative z-10 my-12 lg:my-auto max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-teal-accent text-xs font-semibold backdrop-blur-sm mb-6 border border-white/15">
              <Lock className="w-3.5 h-3.5" />
              <span>Enterprise Oracle 19c Protected Portal</span>
            </div>

            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight">
              LIFE INSURANCE CORE SYSTEM
            </h1>
            <p className="mt-2 text-lg text-teal-accent font-medium">
              Individual Life & Group Life Administration
            </p>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              Secure, high-performance platform for underwriting, actuarial reserves, policyholder servicing, claims adjudication, and group schemes.
            </p>

            {/* Feature Highlights with enterprise styling */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-white/10">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-teal-accent">
                  <Umbrella className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Individual Life</h4>
                  <p className="text-xs text-slate-300 mt-0.5">Endowments, Whole Life & Term Plans</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-teal-accent">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Group Life</h4>
                  <p className="text-xs text-slate-300 mt-0.5">Employer Schemes & Member Rosters</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-teal-accent">
                  <HeartPulse className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Claims Engine</h4>
                  <p className="text-xs text-slate-300 mt-0.5">Adjudication & Fast-Track Settlements</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-teal-accent">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Audit & Compliance</h4>
                  <p className="text-xs text-slate-300 mt-0.5">Full Transaction Traceability</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Security Assurance */}
          <div className="relative z-10 text-xs text-slate-400 flex items-center gap-2 pt-4">
            <Lock className="w-3.5 h-3.5 text-teal-accent" />
            <span>End-to-end encrypted session with Oracle MTBL_USER credentials.</span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16 bg-white">
          <LoginForm />
        </div>
      </div>

      {/* Application Footer */}
      <footer className="w-full py-4 px-6 bg-slate-100 border-t border-slate-200 text-center text-xs text-text-secondary">
        <p>
          LIFE INSURANCE CORE SYSTEM &bull; Individual Life & Group Life Administration &bull; &copy; {currentYear} All Rights Reserved.
        </p>
      </footer>
    </div>
  );
};
