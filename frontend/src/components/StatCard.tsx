import React from 'react';
import { StatCardData } from '../types/dashboard';
import {
  ShieldCheck,
  UserCheck,
  Users,
  DollarSign,
  FileText,
  AlertCircle
} from 'lucide-react';

interface StatCardProps {
  card: StatCardData;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldCheck,
  UserCheck,
  Users,
  DollarSign,
  FileText,
  AlertCircle
};

export const StatCard: React.FC<StatCardProps> = ({ card }) => {
  const IconComponent = iconMap[card.iconName] || ShieldCheck;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between relative overflow-hidden group">
      {/* Top Accent Indicator */}
      <div
        className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r"
        style={{
          background: `linear-gradient(90deg, ${card.accentColor || '#16345C'}, #1B998B)`
        }}
      />

      <div>
        {/* Header: Title and Icon */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {card.title}
          </span>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
            style={{
              backgroundColor: `${card.accentColor || '#16345C'}15`,
              color: card.accentColor || '#16345C'
            }}
          >
            <IconComponent className="w-5 h-5" />
          </div>
        </div>

        {/* Big Metric Value */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold text-navy tracking-tight">
            {card.value}
          </span>
          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 uppercase tracking-wide">
            DEMO DATA
          </span>
        </div>

        {/* Subtitle description */}
        <p className="mt-1 text-xs text-slate-500 font-medium">
          {card.subtitle}
        </p>
      </div>

      {/* Footer Trend info */}
      {card.trend && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs text-slate-600 font-medium">
          <span
            className={`mr-1.5 font-semibold ${
              card.trendType === 'up'
                ? 'text-emerald-600'
                : card.trendType === 'down'
                ? 'text-red-600'
                : 'text-blue-corporate'
            }`}
          >
            {card.trend}
          </span>
        </div>
      )}
    </div>
  );
};
