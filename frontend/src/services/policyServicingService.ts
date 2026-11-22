import {
  PremiumReceiptRecord,
  GLJournalEntryRecord,
  PolicySurrenderRecord,
  PolicyMaturityRecord,
  PolicyLoanRecord,
  PolicyLoanRepaymentRecord,
  AutoLapseScanResult,
  ReinstatementCalculationResult,
  SurrenderValuationResult,
  LoanEligibilityResult,
  PayMode
} from '../types/policyServicing';

const API_BASE_URL = '/api/policy-servicing';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  const token = localStorage.getItem('kins_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const policyServicingService = {
  // 1. Premium Collections
  async recordFirstPremium(payload: { propNo: string; payMode: PayMode; transactionRef?: string; remarks?: string }): Promise<{ success: boolean; message: string; data: { receipt: PremiumReceiptRecord; voucherNo: string } }> {
    const res = await fetch(`${API_BASE_URL}/collections/first-premium`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to record First Premium Receipt');
    return data;
  },

  async recordRenewalPremium(payload: { polNo: string; payMode: PayMode; transactionRef?: string; remarks?: string }): Promise<{ success: boolean; message: string; data: { receipt: PremiumReceiptRecord; voucherNo: string } }> {
    const res = await fetch(`${API_BASE_URL}/collections/renewal-premium`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to record Renewal Premium Receipt');
    return data;
  },

  async getReceipts(search?: string, polNo?: string, propNo?: string): Promise<PremiumReceiptRecord[]> {
    const params = new URLSearchParams();
    if (search && search.trim()) params.append('search', search.trim());
    if (polNo && polNo.trim()) params.append('polNo', polNo.trim());
    if (propNo && propNo.trim()) params.append('propNo', propNo.trim());
    const qStr = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${API_BASE_URL}/receipts${qStr}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch receipts');
    return data.data || [];
  },

  async getReceiptByNo(receiptNo: string): Promise<PremiumReceiptRecord> {
    const res = await fetch(`${API_BASE_URL}/receipts/${encodeURIComponent(receiptNo)}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch receipt');
    return data.data;
  },

  // 2. Auto-Lapse & Reinstatement
  async runAutoLapseScan(): Promise<AutoLapseScanResult> {
    const res = await fetch(`${API_BASE_URL}/lapse/scan`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to execute auto-lapse scan');
    return data.data;
  },

  async calculateReinstatement(polNo: string): Promise<ReinstatementCalculationResult> {
    const res = await fetch(`${API_BASE_URL}/reinstatement/calculate/${encodeURIComponent(polNo)}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to calculate reinstatement');
    return data.data;
  },

  async reinstatePolicy(polNo: string, payMode: PayMode, transactionRef?: string): Promise<{ receipt: PremiumReceiptRecord; voucherNo: string }> {
    const res = await fetch(`${API_BASE_URL}/reinstatement/process/${encodeURIComponent(polNo)}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ payMode, transactionRef })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to reinstate policy');
    return data.data;
  },

  // 3. Surrenders
  async checkSurrenderEligibility(polNo: string): Promise<SurrenderValuationResult> {
    const res = await fetch(`${API_BASE_URL}/surrender/eligibility/${encodeURIComponent(polNo)}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to calculate surrender valuation');
    return data.data;
  },

  async createSurrenderRequest(polNo: string): Promise<PolicySurrenderRecord> {
    const res = await fetch(`${API_BASE_URL}/surrender/request`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ polNo })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create surrender request');
    return data.data;
  },

  async approveSurrender(surrenderNo: string, remarks?: string): Promise<{ surrender: PolicySurrenderRecord; voucherNo: string }> {
    const res = await fetch(`${API_BASE_URL}/surrender/${encodeURIComponent(surrenderNo)}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ remarks })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to approve surrender');
    return data.data;
  },

  async getSurrenders(status?: string, search?: string): Promise<PolicySurrenderRecord[]> {
    const params = new URLSearchParams();
    if (status && status !== 'ALL') params.append('status', status);
    if (search && search.trim()) params.append('search', search.trim());
    const qStr = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${API_BASE_URL}/surrenders${qStr}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch surrenders');
    return data.data || [];
  },

  // 4. Maturities
  async checkMaturityDue(): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/maturity/due`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to check maturity due');
    return data.data || [];
  },

  async processMaturitySettlement(polNo: string, remarks?: string): Promise<{ maturity: PolicyMaturityRecord; voucherNo: string }> {
    const res = await fetch(`${API_BASE_URL}/maturity/settle`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ polNo, remarks })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to process maturity settlement');
    return data.data;
  },

  async getMaturities(status?: string, search?: string): Promise<PolicyMaturityRecord[]> {
    const params = new URLSearchParams();
    if (status && status !== 'ALL') params.append('status', status);
    if (search && search.trim()) params.append('search', search.trim());
    const qStr = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${API_BASE_URL}/maturities${qStr}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch maturities');
    return data.data || [];
  },

  // 5. Policy Loans
  async checkLoanEligibility(polNo: string): Promise<LoanEligibilityResult> {
    const res = await fetch(`${API_BASE_URL}/loans/eligibility/${encodeURIComponent(polNo)}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to check loan eligibility');
    return data.data;
  },

  async disburseLoan(polNo: string, loanAmount: number, remarks?: string): Promise<{ loan: PolicyLoanRecord; voucherNo: string }> {
    const res = await fetch(`${API_BASE_URL}/loans/disburse`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ polNo, loanAmount, remarks })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to disburse policy loan');
    return data.data;
  },

  async repayLoan(loanNo: string, payload: { principalPaid: number; interestPaid: number; payMode: PayMode; transactionRef?: string }): Promise<{ repayment: PolicyLoanRepaymentRecord; loan: PolicyLoanRecord; voucherNo: string }> {
    const res = await fetch(`${API_BASE_URL}/loans/${encodeURIComponent(loanNo)}/repay`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to process loan repayment');
    return data.data;
  },

  async getLoans(status?: string, search?: string): Promise<PolicyLoanRecord[]> {
    const params = new URLSearchParams();
    if (status && status !== 'ALL') params.append('status', status);
    if (search && search.trim()) params.append('search', search.trim());
    const qStr = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${API_BASE_URL}/loans${qStr}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch loans');
    return data.data || [];
  },

  // 6. Accounting Entries
  async getJournalEntries(voucherNo?: string, sourceRefNo?: string, txnSource?: string): Promise<GLJournalEntryRecord[]> {
    const params = new URLSearchParams();
    if (voucherNo && voucherNo.trim()) params.append('voucherNo', voucherNo.trim());
    if (sourceRefNo && sourceRefNo.trim()) params.append('sourceRefNo', sourceRefNo.trim());
    if (txnSource && txnSource !== 'ALL') params.append('txnSource', txnSource);
    const qStr = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${API_BASE_URL}/journal-entries${qStr}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch journal entries');
    return data.data || [];
  }
};
