import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { workflowService } from '../services/workflowService';
import { WorkbasketItem, WorkbasketSummary } from '../types/workflow';
import {
  Inbox,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  UserCheck,
  FileText,
  DollarSign,
  ChevronRight,
  TrendingUp,
  ExternalLink,
  Layers,
  Sparkles
} from 'lucide-react';

export const WorkbasketPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userGroup = (user?.userGroup || 'ADMIN').toUpperCase();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [data, setData] = useState<WorkbasketSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [activeTab, setActiveTab] = useState<'ALL' | 'PROPOSAL' | 'POLICY' | 'HIGH_VALUE'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadWorkbasket = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await workflowService.getWorkbasket();
      setData(res);
    } catch (err: any) {
      console.error('Failed to load workbasket:', err);
      setError(err.message || 'Failed to retrieve workbasket');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkbasket();
  }, [user]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];

    return data.items.filter(item => {
      // Tab filter
      if (activeTab === 'PROPOSAL' && item.type !== 'PROPOSAL') return false;
      if (activeTab === 'POLICY' && item.type !== 'POLICY') return false;
      if (activeTab === 'HIGH_VALUE' && item.priority !== 'HIGH') return false;

      // Search filter
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchRef = item.refNo.toLowerCase().includes(q);
        const matchCust = item.customerName.toLowerCase().includes(q);
        const matchProd = item.productName.toLowerCase().includes(q);
        const matchAction = item.requiredAction.toLowerCase().includes(q);
        return matchRef || matchCust || matchProd || matchAction;
      }

      return true;
    });
  }, [data, activeTab, searchQuery]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Operator Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-blue-800/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-500/20 text-blue-300 rounded-lg">
              <Inbox className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Workflow Workbasket</h1>
            <span className="px-2.5 py-0.5 bg-blue-500/30 text-blue-200 border border-blue-400/30 rounded-full text-xs font-semibold">
              Live Queue
            </span>
          </div>
          <p className="text-sm text-blue-200/80">
            Pending transactions dynamically routed for your security group review and decision clearance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-right">
            <div className="text-[11px] text-blue-200 uppercase tracking-wider font-semibold">Operator Group</div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5 justify-end">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{userGroup}</span>
            </div>
            <div className="text-xs text-blue-200/70 truncate max-w-[160px]">{user?.userName || user?.userId}</div>
          </div>

          <button
            onClick={loadWorkbasket}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
            title="Refresh Queue"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Pending</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{data?.totalPending ?? 0}</p>
            <span className="text-xs text-blue-600 font-medium">In your direct authority</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Proposals in Queue</p>
            <p className="text-3xl font-bold text-purple-600 mt-1">{data?.proposalsCount ?? 0}</p>
            <span className="text-xs text-purple-600 font-medium">Underwriting & Clearance</span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Policies in Queue</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">{data?.policiesCount ?? 0}</p>
            <span className="text-xs text-emerald-600 font-medium">Inception & Schedule Issue</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">High Sum Assured ($1M+)</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">{data?.highPriorityCount ?? 0}</p>
            <span className="text-xs text-amber-600 font-medium">High financial priority</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Items ({data?.totalPending ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('PROPOSAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'PROPOSAL'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Proposals ({data?.proposalsCount ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('POLICY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'POLICY'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Policies ({data?.policiesCount ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('HIGH_VALUE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'HIGH_VALUE'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              High Value ($1M+) ({data?.highPriorityCount ?? 0})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search reference, customer, or product..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Main Workbasket List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
            <p className="text-sm font-medium">Scanning database workflow queue for {userGroup}...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto text-red-500" />
            <p className="text-sm font-semibold">{error}</p>
            <button onClick={loadWorkbasket} className="text-xs text-blue-600 underline">Try again</button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-gray-800">Your Workbasket is Clean!</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              There are no pending approvals or tasks currently assigned to the <strong>{userGroup}</strong> category. New business and policy requests will appear here when submitted.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className="p-5 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 group"
              >
                {/* Left: Type, Reference, Customer */}
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl flex-shrink-0 ${
                    item.type === 'PROPOSAL' 
                      ? 'bg-purple-50 text-purple-600 border border-purple-200' 
                      : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  }`}>
                    {item.type === 'PROPOSAL' ? <UserCheck className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                        item.type === 'PROPOSAL' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {item.type}
                      </span>
                      <span className="font-mono font-bold text-sm text-gray-900 group-hover:text-blue-600 transition-colors">
                        {item.refNo}
                      </span>
                      {item.priority === 'HIGH' && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold rounded-full flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          High Value
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-semibold text-gray-800">
                      {item.customerName}
                    </div>

                    <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-700">{item.productName}</span>
                      <span>&bull;</span>
                      <span>Plan: {item.planType}</span>
                      <span>&bull;</span>
                      <span className="text-gray-400">Created: {item.createdOn}</span>
                    </div>
                  </div>
                </div>

                {/* Middle: Amount & Premium Details */}
                <div className="flex sm:items-center gap-6 lg:border-l lg:border-r border-gray-100 lg:px-6">
                  <div>
                    <div className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Sum Assured</div>
                    <div className="text-sm font-bold text-gray-900">
                      ${item.amount.toLocaleString()}
                    </div>
                    {item.totalPayable > 0 && (
                      <div className="text-[11px] text-emerald-600 font-medium">
                        Prem: ${item.totalPayable.toLocaleString()}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Workflow Stage</div>
                    <div className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      {item.stageName}
                    </div>
                  </div>
                </div>

                {/* Right: Required Action Badge & Action Button */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between lg:justify-end gap-3">
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-200">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{item.requiredAction}</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (item.type === 'PROPOSAL') {
                        const targetStep = item.status === 'REWORK' || item.status === 'DRAFT' ? 1 : 9;
                        navigate(`/individual-life/proposal?propNo=${encodeURIComponent(item.refNo)}&step=${targetStep}&from=workbasket`);
                      } else if (item.type === 'POLICY') {
                        navigate(`/policy-administration?policyNo=${encodeURIComponent(item.refNo)}&from=workbasket`);
                      } else {
                        navigate(item.navigationUrl);
                      }
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:scale-[1.02] active:scale-95 whitespace-nowrap"
                  >
                    <span>Open & Act</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
