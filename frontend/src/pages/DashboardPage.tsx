import React from 'react';
import { useAuth } from '../hooks/AuthContext';
import { STAT_CARDS_DATA, RECENT_ACTIVITIES_DATA } from '../data/dashboardMockData';
import { StatCard } from '../components/StatCard';
import { DashboardCharts } from '../components/DashboardCharts';
import { RecentActivities } from '../components/RecentActivities';
import { QuickAccess } from '../components/QuickAccess';
import { Calendar, Shield, Database, Sparkles } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  // Readable current date
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date());

  const authenticatedUsername = user?.userName || user?.userId || 'Operations User';

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-navy via-navy-light to-blue-corporate rounded-2xl p-6 sm:p-8 text-white shadow-sm relative overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-40 bottom-0 w-60 h-60 bg-teal-accent/15 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-accent/20 border border-teal-accent/30 text-teal-accent text-xs font-semibold">
                <Database className="w-3.5 h-3.5" />
                <span>Oracle 19c (KINS Schema) Authenticated</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-slate-200 text-xs">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Phase 1 Executive Demo</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {authenticatedUsername}
            </h1>
            <p className="mt-1 text-sm text-slate-200 max-w-xl">
              Here is an overview of your life insurance operations. Monitor policy issuance, portfolio breakdown, premium inflows, and pending adjudications.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-200 bg-white/10 backdrop-blur-sm px-3.5 py-2 rounded-xl self-start md:self-center border border-white/10">
            <Calendar className="w-4 h-4 text-teal-accent" />
            <span className="font-medium">{todayFormatted}</span>
          </div>
        </div>
      </div>

      {/* 7.2 Summary Cards Grid (6 cards) */}
      <section aria-labelledby="summary-metrics-heading">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 id="summary-metrics-heading" className="text-lg font-bold text-navy">
              Key Performance Indicators
            </h2>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded border border-amber-300">
              Sample Dashboard Data
            </span>
          </div>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Demonstration metrics across Individual & Group portfolios
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {STAT_CARDS_DATA.map((card) => (
            <StatCard key={card.id} card={card} />
          ))}
        </div>
      </section>

      {/* 7.3 Dashboard Charts */}
      <section aria-labelledby="analytics-charts-heading">
        <h2 id="analytics-charts-heading" className="sr-only">
          Insurance Analytics & Portfolio Trends
        </h2>
        <DashboardCharts />
      </section>

      {/* 7.4 Recent Activities Table */}
      <section aria-labelledby="recent-activities-heading">
        <h2 id="recent-activities-heading" className="sr-only">
          Recent Insurance Operations Table
        </h2>
        <RecentActivities activities={RECENT_ACTIVITIES_DATA} />
      </section>

      {/* 7.5 Quick Access Modules */}
      <section aria-labelledby="quick-access-heading">
        <h2 id="quick-access-heading" className="sr-only">
          Quick Access Modules
        </h2>
        <QuickAccess />
      </section>
    </div>
  );
};
