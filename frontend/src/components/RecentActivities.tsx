import React from 'react';
import { RecentActivityItem } from '../types/dashboard';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

interface RecentActivitiesProps {
  activities: RecentActivityItem[];
}

export const RecentActivities: React.FC<RecentActivitiesProps> = ({ activities }) => {
  const navigate = useNavigate();

  const getStatusBadge = (status: RecentActivityItem['status']) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'In Progress':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Submitted':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Under Review':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getBusinessTypeBadge = (type: RecentActivityItem['businessType']) => {
    if (type === 'Individual Life') {
      return 'bg-navy/5 text-navy border-navy/20';
    }
    return 'bg-teal-light text-teal-accent border-teal-accent/30';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Table Header with View All action */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-navy">Recent Insurance Operations</h3>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded border border-amber-300">
              DEMO DATA
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time feed of recent submissions, underwriting checkpoints, and member updates.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/reports')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-corporate hover:text-navy transition-colors self-start sm:self-center"
        >
          <span>View All Operations</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Responsive Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
              <th scope="col" className="py-3 px-5">Reference Number</th>
              <th scope="col" className="py-3 px-5">Activity</th>
              <th scope="col" className="py-3 px-5">Business Type</th>
              <th scope="col" className="py-3 px-5">Date</th>
              <th scope="col" className="py-3 px-5 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-text-main">
            {activities.map((item) => (
              <tr key={item.referenceNumber} className="hover:bg-slate-50/60 transition-colors">
                <td className="py-3.5 px-5 font-mono font-semibold text-navy">
                  {item.referenceNumber}
                </td>
                <td className="py-3.5 px-5 text-text-main font-medium">
                  {item.activity}
                </td>
                <td className="py-3.5 px-5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${getBusinessTypeBadge(item.businessType)}`}>
                    {item.businessType}
                  </span>
                </td>
                <td className="py-3.5 px-5 text-slate-500 whitespace-nowrap">
                  {item.date}
                </td>
                <td className="py-3.5 px-5 text-right whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${getStatusBadge(item.status)}`}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
