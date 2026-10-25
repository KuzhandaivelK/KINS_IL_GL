import React from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Construction,
  Layers,
  ArrowRight
} from 'lucide-react';

interface ModuleMeta {
  title: string;
  description: string;
  plannedPhase: string;
  highlights: string[];
}

const moduleDescriptions: Record<string, ModuleMeta> = {
  'product-configuration': {
    title: 'Product Configuration',
    description: 'Dynamic product builder for life policies, actuarial rates, premium calculation rules, and rider bundling.',
    plannedPhase: 'Phase 2',
    highlights: ['Mortality table uploads', 'Sum assured formulas', 'Commission schedule bindings', 'Rider eligibility rules']
  },
  'policy-administration': {
    title: 'Policy Administration',
    description: 'Lifecycle management of individual and corporate policies, endorsements, address amendments, and servicing.',
    plannedPhase: 'Phase 2',
    highlights: ['Policyholder 360 view', 'Endorsement transactions', 'Beneficiary updates', 'Policy loans and liens']
  },
  'underwriting': {
    title: 'Underwriting Engine',
    description: 'Automated medical and financial underwriting rules, attending physician statement intake, and risk rating.',
    plannedPhase: 'Phase 2',
    highlights: ['STP (Straight-Through Processing)', 'Medical test triggers', 'Loading and exclusions', 'Underwriter delegation limits']
  },
  'premium-collection': {
    title: 'Premium Collection & Billing',
    description: 'Automated recurring billing, electronic fund transfer (EFT), direct debits, reconciliation, and payment receipts.',
    plannedPhase: 'Phase 3',
    highlights: ['Direct debit batching', 'Payment gateway webhooks', 'Dishonour processing', 'Suspense account allocation']
  },
  'claims-management': {
    title: 'Claims Management',
    description: 'Death, disability, and critical illness claim notifications, investigation tracking, and payment settlement.',
    plannedPhase: 'Phase 3',
    highlights: ['First Notice of Loss (FNOL)', 'Adjudication checklists', 'Reinsurance recovery tags', 'Disbursement vouchers']
  },
  'commission-management': {
    title: 'Commission Management',
    description: 'Tiered agent commissions, overrides, clawbacks on early surrenders, and broker statement generation.',
    plannedPhase: 'Phase 4',
    highlights: ['Hierarchical agent tree', 'First-year vs renewal commission', 'Clawback rules', 'Tax withholding']
  },
  'reinsurance': {
    title: 'Reinsurance Management',
    description: 'Treaty and facultative reinsurance arrangements, retention limit checks, and cession accounting.',
    plannedPhase: 'Phase 4',
    highlights: ['Quota share & surplus treaties', 'Facultative placements', 'Ceded premium accounts', 'Claim recoveries']
  },
  'reports': {
    title: 'Management Reports & BI',
    description: 'Regulatory returns, actuarial valuation reports, lapse analyses, premium registers, and management dashboards.',
    plannedPhase: 'Phase 3',
    highlights: ['Statutory returns', 'Actuarial reserving tables', 'Sales production analytics', 'Claims turnaround reports']
  },
  'administration': {
    title: 'System Administration',
    description: 'User access control, role-based permissions, MTBL_USER maintenance, system audit logs, and security controls.',
    plannedPhase: 'Phase 2',
    highlights: ['Role-based access control (RBAC)', 'Audit trail lookup', 'Oracle connection pooling params', 'Password policy setup']
  }
};

export const PlaceholderModulePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract key from pathname e.g. /underwriting -> underwriting
  const key = location.pathname.replace('/', '');
  const moduleInfo = moduleDescriptions[key] || {
    title: key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    description: 'Enterprise Life Insurance administrative sub-system.',
    plannedPhase: 'Future Phase',
    highlights: ['Standard operating workflows', 'Transactional audit trails', 'Data synchronization with Oracle']
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs font-medium text-slate-500">
          <Link to="/dashboard" className="hover:text-navy transition-colors">Dashboard</Link>
          <span className="text-slate-300">/</span>
          <span className="text-navy font-semibold">{moduleInfo.title}</span>
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

      {/* Main Notice Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-12 shadow-xs text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-6 shadow-xs">
          <Construction className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold mb-3">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>Scheduled for {moduleInfo.plannedPhase}</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy tracking-tight">
          {moduleInfo.title}
        </h1>

        <p className="mt-3 text-sm text-text-secondary max-w-lg leading-relaxed">
          {moduleInfo.description}
        </p>

        <div className="mt-4 p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs font-medium max-w-md">
          This module is planned for a future development phase. In Phase 1, core authentication, database inspection, and executive dashboard demonstration are operational.
        </div>

        {/* Feature Capabilities Preview */}
        <div className="mt-8 w-full max-w-lg text-left">
          <h3 className="text-xs font-bold text-navy uppercase tracking-wider mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-accent" />
            <span>Planned Capabilities in {moduleInfo.plannedPhase}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {moduleInfo.highlights.map((item, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 text-xs text-slate-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-accent flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-100 flex flex-wrap justify-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-5 py-2.5 rounded-lg bg-navy hover:bg-navy-light text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/individual-life')}
            className="px-5 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <span>View Individual Life</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
