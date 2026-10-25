export interface StatCardData {
  id: string;
  title: string;
  value: string;
  subtitle: string;
  iconName: string;
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral';
  accentColor?: string;
}

export interface PremiumTrendPoint {
  month: string;
  premium: number; // In millions or thousands
  projected?: number;
}

export interface PortfolioDistributionPoint {
  name: string;
  value: number;
  color: string;
}

export interface MonthlyBusinessPoint {
  month: string;
  newPolicies: number;
  renewals: number;
}

export interface RecentActivityItem {
  referenceNumber: string;
  activity: string;
  businessType: 'Individual Life' | 'Group Life';
  date: string;
  status: 'Submitted' | 'In Progress' | 'Pending' | 'Completed' | 'Under Review';
}

export interface QuickAccessModule {
  id: string;
  title: string;
  description: string;
  route: string;
  iconName: string;
  isImplemented: boolean;
}
