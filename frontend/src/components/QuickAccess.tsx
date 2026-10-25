import React from 'react';
import { useNavigate } from 'react-router-dom';
import { QUICK_ACCESS_MODULES } from '../data/dashboardMockData';
import {
  UserCheck,
  Users,
  Settings2,
  Briefcase,
  CreditCard,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  UserCheck,
  Users,
  Settings2,
  Briefcase,
  CreditCard,
  ShieldAlert
};

export const QuickAccess: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-navy">Quick Access Modules</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Direct navigation to core life insurance administration workflows.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {QUICK_ACCESS_MODULES.map((module) => {
          const Icon = iconMap[module.iconName] || Briefcase;
          return (
            <div
              key={module.id}
              className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-lg bg-navy/5 text-navy group-hover:bg-teal-light group-hover:text-teal-accent flex items-center justify-center transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  {module.isImplemented ? (
                    <span className="text-[10px] font-bold text-teal-accent bg-teal-light px-2 py-0.5 rounded-full border border-teal-accent/20">
                      Phase 1 Core
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      Planned
                    </span>
                  )}
                </div>

                <h4 className="mt-4 text-sm font-bold text-navy group-hover:text-teal-accent transition-colors">
                  {module.title}
                </h4>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  {module.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => navigate(module.route)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-navy group-hover:text-teal-accent transition-colors"
                >
                  <span>Open Module</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
