import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  FilePlus,
  FileEdit,
  RotateCw,
  FileX,
  Award,
  HeartHandshake,
  BarChart2,
  Clock,
  Sparkles
} from 'lucide-react';

const individualCards = [
  {
    title: 'Individual Products',
    desc: 'Catalog of Term, Whole Life, Endowment, and Unit-Linked plan specifications.',
    icon: Package
  },
  {
    title: 'New Business',
    desc: 'Individual application intake, KYC verification, and initial premium receipting.',
    icon: FilePlus
  },
  {
    title: 'Policy Servicing',
    desc: 'Address changes, nominee updates, sum assured alterations, and rider additions.',
    icon: FileEdit
  },
  {
    title: 'Renewals',
    desc: 'Automated notice generation, grace period monitoring, and lapse tracking.',
    icon: RotateCw
  },
  {
    title: 'Surrenders',
    desc: 'Actuarial surrender value calculations, tax deduction, and payout approvals.',
    icon: FileX
  },
  {
    title: 'Maturity Processing',
    desc: 'Survival benefit disbursements, maturity notifications, and settlement vouchers.',
    icon: Award
  },
  {
    title: 'Individual Claims',
    desc: 'Death benefit and critical illness claims adjudication and document validation.',
    icon: HeartHandshake
  },
  {
    title: 'Individual Life Reports',
    desc: 'Persistency ratios, loss ratios, agent production metrics, and solvency sheets.',
    icon: BarChart2
  }
];

export const IndividualLifePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Back Link */}
      <div className="flex items-center justify-between">
        <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs font-medium text-slate-500">
          <Link to="/dashboard" className="hover:text-navy transition-colors">Dashboard</Link>
          <span className="text-slate-300">/</span>
          <span className="text-navy font-semibold">Individual Life Insurance</span>
        </nav>

        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-corporate hover:text-navy transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* Page Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-light text-teal-accent text-xs font-semibold border border-teal-accent/20 mb-2">
              <Clock className="w-3.5 h-3.5" />
              <span>Phase 2 Implementation Track</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy tracking-tight">
              Individual Life Insurance
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary max-w-2xl">
              Manage individual life insurance products, applications, policies, premiums, and servicing.
            </p>
          </div>

          <div className="flex-shrink-0 self-start sm:self-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Planned Module &bull; Demonstration Preview</span>
            </span>
          </div>
        </div>
      </div>

      {/* 8 Feature Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {individualCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-navy/5 text-navy flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-navy">
                  {card.title}
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  {card.desc}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                <span>Status</span>
                <span className="text-blue-corporate bg-blue-50 px-2 py-0.5 rounded">
                  Coming Soon
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
