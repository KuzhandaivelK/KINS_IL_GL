import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  PREMIUM_TREND_DATA,
  PORTFOLIO_DISTRIBUTION_DATA,
  MONTHLY_BUSINESS_DATA
} from '../data/dashboardMockData';

export const DashboardCharts: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Top Charts Row: Trend Area Chart & Portfolio Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Premium Collection Trend (2 columns on large screens) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-navy">Premium Collection Trend</h3>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded border border-amber-300">
                  DEMO DATA
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Monthly gross premiums collected vs actuarial target ($ Millions)
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-teal-accent bg-teal-light px-2.5 py-1 rounded-full">
                H1 Portfolio
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={PREMIUM_TREND_DATA} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="premiumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1B998B" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#1B998B" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="projectedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16345C" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#16345C" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                <YAxis tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} tickFormatter={(val) => `$${val}M`} />
                <Tooltip
                  formatter={(value: any) => [`$${value}M`, '']}
                  contentStyle={{
                    backgroundColor: '#0F233E',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                    fontSize: '12px'
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area
                  type="monotone"
                  dataKey="premium"
                  name="Collected Premium ($M)"
                  stroke="#1B998B"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#premiumGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="projected"
                  name="Actuarial Target ($M)"
                  stroke="#16345C"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#projectedGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Policy Portfolio Distribution (Donut chart) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-navy">Portfolio Distribution</h3>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded border border-amber-300">
                DEMO DATA
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Policy volume breakdown by line of business
            </p>
          </div>

          <div className="h-60 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={PORTFOLIO_DISTRIBUTION_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {PORTFOLIO_DISTRIBUTION_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`${value}%`, 'Share']}
                  contentStyle={{
                    backgroundColor: '#0F233E',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Donut Center Summary */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold text-navy">24,850</span>
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Policies</span>
            </div>
          </div>

          {/* Custom Visual Legend */}
          <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-around text-xs">
            {PORTFOLIO_DISTRIBUTION_DATA.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="font-medium text-slate-600">{item.name}:</span>
                <span className="font-bold text-navy">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart 3: Monthly Business Overview (Bar Chart) */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-navy">Monthly Business Overview</h3>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded border border-amber-300">
                DEMO DATA
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparison between newly underwritten policies and recurring renewals
            </p>
          </div>
          <div className="text-xs text-slate-500">
            Last 6 calendar months
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MONTHLY_BUSINESS_DATA} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="month" tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
              <YAxis tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F233E',
                  borderColor: '#1E293B',
                  borderRadius: '8px',
                  color: '#F8FAFC',
                  fontSize: '12px'
                }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
              <Bar dataKey="newPolicies" name="New Policies Written" fill="#245A8D" radius={[4, 4, 0, 0]} />
              <Bar dataKey="renewals" name="Policy Renewals" fill="#1B998B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
