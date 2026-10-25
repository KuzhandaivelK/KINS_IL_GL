import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  FileSpreadsheet,
  UserPlus,
  Receipt,
  UsersRound,
  ShieldAlert,
  BarChart4,
  Clock,
  Sparkles
} from 'lucide-react';

const groupCards = [
  {
    title: 'Group Products',
    desc: 'Group Term Life, Credit Life, Gratuity Schemes, and Keyman Insurance plan templates.',
    icon: Briefcase
  },
  {
    title: 'Employer Management',
    desc: 'Corporate sponsor profiles, master agreements, billing entities, and HR portal contacts.',
    icon: Building2
  },
  {
    title: 'Group Policy Administration',
    desc: 'Master policy issuance, endorsement amendments, free cover limits, and policy renewals.',
    icon: FileSpreadsheet
  },
  {
    title: 'Member Enrollment',
    desc: 'Batch employee roster imports, eligible salary updates, and automatic cover tiering.',
    icon: UserPlus
  },
  {
    title: 'Premium Billing',
    desc: 'Consolidated monthly/annual employer invoices, payroll deductions, and adjustment bills.',
    icon: Receipt
  },
  {
    title: 'Member Changes',
    desc: 'Joiners, leavers, salary band upgrades, marital status modifications, and terminations.',
    icon: UsersRound
  },
  {
    title: 'Group Claims',
    desc: 'Consolidated death in service benefits, occupational disability, and employer settlements.',
    icon: ShieldAlert
  },
  {
    title: 'Group Life Reports',
    desc: 'Experience rating studies, loss-ratio analysis, member turnover, and renewal accounting.',
    icon: BarChart4
  }
];

export const GroupLifePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Back Link */}
      <div className="flex items-center justify-between">
        <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs font-medium text-slate-500">
          <Link to="/dashboard" className="hover:text-navy transition-colors">Dashboard</Link>
          <span className="text-slate-300">/</span>
          <span className="text-navy font-semibold">Group Life Insurance</span>
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
              Group Life Insurance
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary max-w-2xl">
              Manage employer-sponsored life insurance schemes, group policies, member enrollment, and group servicing.
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
        {groupCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-teal-light text-teal-accent flex items-center justify-center mb-3">
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
                <span className="text-teal-accent bg-teal-light px-2 py-0.5 rounded">
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
