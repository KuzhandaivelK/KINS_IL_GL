import {
  StatCardData,
  PremiumTrendPoint,
  PortfolioDistributionPoint,
  MonthlyBusinessPoint,
  RecentActivityItem,
  QuickAccessModule
} from '../types/dashboard';

/**
 * Summary KPI cards (Phase 1 demonstration data)
 */
export const STAT_CARDS_DATA: StatCardData[] = [
  {
    id: 'total-policies',
    title: 'Total Policies',
    value: '24,850',
    subtitle: 'Individual and group policies',
    iconName: 'ShieldCheck',
    trend: '+4.2% vs last month',
    trendType: 'up',
    accentColor: '#16345C'
  },
  {
    id: 'individual-policies',
    title: 'Individual Life Policies',
    value: '18,420',
    subtitle: 'Individual life portfolio',
    iconName: 'UserCheck',
    trend: '+3.8% vs last month',
    trendType: 'up',
    accentColor: '#245A8D'
  },
  {
    id: 'group-policies',
    title: 'Group Life Policies',
    value: '6,430',
    subtitle: 'Group life portfolio',
    iconName: 'Users',
    trend: '+5.1% vs last month',
    trendType: 'up',
    accentColor: '#1B998B'
  },
  {
    id: 'premium-collected',
    title: 'Premium Collected',
    value: '$2.45M',
    subtitle: 'Sample monthly premium',
    iconName: 'DollarSign',
    trend: '+7.4% vs target',
    trendType: 'up',
    accentColor: '#059669'
  },
  {
    id: 'pending-underwriting',
    title: 'Pending Underwriting',
    value: '128',
    subtitle: 'Applications awaiting review',
    iconName: 'FileText',
    trend: '-12 cases from yesterday',
    trendType: 'neutral',
    accentColor: '#D97706'
  },
  {
    id: 'pending-claims',
    title: 'Pending Claims',
    value: '36',
    subtitle: 'Claims awaiting processing',
    iconName: 'AlertCircle',
    trend: '94% within SLA target',
    trendType: 'neutral',
    accentColor: '#DC2626'
  }
];

/**
 * Chart 1: Premium Collection Trend (6-month area chart)
 */
export const PREMIUM_TREND_DATA: PremiumTrendPoint[] = [
  { month: 'Jan', premium: 1.85, projected: 1.80 },
  { month: 'Feb', premium: 1.95, projected: 1.90 },
  { month: 'Mar', premium: 2.10, projected: 2.05 },
  { month: 'Apr', premium: 2.25, projected: 2.20 },
  { month: 'May', premium: 2.38, projected: 2.30 },
  { month: 'Jun', premium: 2.45, projected: 2.40 }
];

/**
 * Chart 2: Policy Portfolio Distribution (Donut chart)
 * Individual Life: 74%, Group Life: 26%
 */
export const PORTFOLIO_DISTRIBUTION_DATA: PortfolioDistributionPoint[] = [
  { name: 'Individual Life', value: 74, color: '#16345C' },
  { name: 'Group Life', value: 26, color: '#1B998B' }
];

/**
 * Chart 3: Monthly Business Overview (Bar chart)
 */
export const MONTHLY_BUSINESS_DATA: MonthlyBusinessPoint[] = [
  { month: 'Jan', newPolicies: 420, renewals: 1350 },
  { month: 'Feb', newPolicies: 480, renewals: 1410 },
  { month: 'Mar', newPolicies: 550, renewals: 1520 },
  { month: 'Apr', newPolicies: 610, renewals: 1580 },
  { month: 'May', newPolicies: 590, renewals: 1640 },
  { month: 'Jun', newPolicies: 670, renewals: 1720 }
];

/**
 * Recent Activities (Phase 1 sample records)
 */
export const RECENT_ACTIVITIES_DATA: RecentActivityItem[] = [
  {
    referenceNumber: 'DEMO-1001',
    activity: 'New Policy Application',
    businessType: 'Individual Life',
    date: 'Yesterday, 14:32',
    status: 'Submitted'
  },
  {
    referenceNumber: 'DEMO-1002',
    activity: 'Group Enrollment',
    businessType: 'Group Life',
    date: 'Yesterday, 11:15',
    status: 'In Progress'
  },
  {
    referenceNumber: 'DEMO-1003',
    activity: 'Underwriting Review',
    businessType: 'Individual Life',
    date: '2 days ago',
    status: 'Pending'
  },
  {
    referenceNumber: 'DEMO-1004',
    activity: 'Premium Reconciliation',
    businessType: 'Group Life',
    date: '3 days ago',
    status: 'Completed'
  },
  {
    referenceNumber: 'DEMO-1005',
    activity: 'Claims Assessment',
    businessType: 'Individual Life',
    date: '3 days ago',
    status: 'Under Review'
  }
];

/**
 * Quick Access Section modules
 */
export const QUICK_ACCESS_MODULES: QuickAccessModule[] = [
  {
    id: 'individual-life',
    title: 'Individual Life',
    description: 'Underwrite, service, and manage single-life policies and riders.',
    route: '/individual-life',
    iconName: 'UserCheck',
    isImplemented: true
  },
  {
    id: 'group-life',
    title: 'Group Life',
    description: 'Corporate scheme setup, employee rosters, and group renewals.',
    route: '/group-life',
    iconName: 'Users',
    isImplemented: true
  },
  {
    id: 'product-configuration',
    title: 'Product Configuration',
    description: 'Define life plans, mortality tables, rider rules, and pricing formulas.',
    route: '/product-configuration',
    iconName: 'Settings2',
    isImplemented: false
  },
  {
    id: 'policy-administration',
    title: 'Policy Administration',
    description: 'Endorsements, beneficiary adjustments, and customer portfolio lookup.',
    route: '/policy-administration',
    iconName: 'Briefcase',
    isImplemented: false
  },
  {
    id: 'premium-collection',
    title: 'Premium Collection',
    description: 'Direct debit reconciliation, payment gateways, and billing schedules.',
    route: '/premium-collection',
    iconName: 'CreditCard',
    isImplemented: false
  },
  {
    id: 'claims-management',
    title: 'Claims Management',
    description: 'Death benefit intake, claim adjudication, and settlement workflows.',
    route: '/claims-management',
    iconName: 'ShieldAlert',
    isImplemented: false
  }
];
