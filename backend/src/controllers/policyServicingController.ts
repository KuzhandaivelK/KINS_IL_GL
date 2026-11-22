import { Request, Response } from 'express';
import { policyServicingRepository } from '../repositories/policyServicingRepository';

export const policyServicingController = {
  // 1. Premium Collections
  async recordFirstPremium(req: Request, res: Response) {
    try {
      const user = (req as any).user?.username || 'ADMIN';
      const result = await policyServicingRepository.recordFirstPremium(req.body, user);
      return res.status(201).json({
        success: true,
        message: `First Premium Receipt ${result.receipt.RECEIPT_NO} recorded successfully. Proposal is now unlocked for Policy Conversion!`,
        data: result
      });
    } catch (err: any) {
      console.error('Record FPR error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to record First Premium Receipt'
      });
    }
  },

  async recordRenewalPremium(req: Request, res: Response) {
    try {
      const user = (req as any).user?.username || 'ADMIN';
      const result = await policyServicingRepository.recordRenewalPremium(req.body, user);
      return res.status(201).json({
        success: true,
        message: `Renewal Premium Receipt ${result.receipt.RECEIPT_NO} recorded successfully. Policy due date advanced.`,
        data: result
      });
    } catch (err: any) {
      console.error('Record RPR error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to record Renewal Premium Receipt'
      });
    }
  },

  async getReceipts(req: Request, res: Response) {
    try {
      const { search, polNo, propNo } = req.query;
      const receipts = await policyServicingRepository.getAllReceipts(
        search ? String(search) : undefined,
        polNo ? String(polNo) : undefined,
        propNo ? String(propNo) : undefined
      );
      return res.status(200).json({
        success: true,
        count: receipts.length,
        data: receipts
      });
    } catch (err: any) {
      console.error('Get receipts error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch receipts'
      });
    }
  },

  async getReceiptByNo(req: Request, res: Response) {
    try {
      const { receiptNo } = req.params;
      const receipt = await policyServicingRepository.getReceiptByNo(receiptNo);
      if (!receipt) {
        return res.status(404).json({
          success: false,
          message: `Receipt ${receiptNo} not found`
        });
      }
      return res.status(200).json({
        success: true,
        data: receipt
      });
    } catch (err: any) {
      console.error('Get receipt by no error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch receipt'
      });
    }
  },

  // 2. Auto-Lapse & Reinstatement
  async runAutoLapseScan(req: Request, res: Response) {
    try {
      const user = (req as any).user?.username || 'SYSTEM';
      const result = await policyServicingRepository.runAutoLapseScan(user);
      return res.status(200).json({
        success: true,
        message: `Auto-Lapse scan completed. ${result.lapsedCount} overdue policies updated to LAPSED.`,
        data: result
      });
    } catch (err: any) {
      console.error('Run auto lapse scan error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to execute auto-lapse scan'
      });
    }
  },

  async calculateReinstatement(req: Request, res: Response) {
    try {
      const { polNo } = req.params;
      const result = await policyServicingRepository.calculateReinstatement(polNo);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err: any) {
      console.error('Calculate reinstatement error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to calculate reinstatement'
      });
    }
  },

  async reinstatePolicy(req: Request, res: Response) {
    try {
      const { polNo } = req.params;
      const { payMode, transactionRef } = req.body;
      const user = (req as any).user?.username || 'ADMIN';
      const result = await policyServicingRepository.reinstatePolicy(polNo, payMode, transactionRef, user);
      return res.status(200).json({
        success: true,
        message: `Policy ${polNo} successfully reinstated to IN_FORCE. Receipt: ${result.receipt.RECEIPT_NO}`,
        data: result
      });
    } catch (err: any) {
      console.error('Reinstate policy error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to reinstate policy'
      });
    }
  },

  // 3. Surrenders
  async checkSurrenderEligibility(req: Request, res: Response) {
    try {
      const { polNo } = req.params;
      const result = await policyServicingRepository.checkSurrenderEligibility(polNo);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err: any) {
      console.error('Check surrender eligibility error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to calculate surrender valuation'
      });
    }
  },

  async createSurrenderRequest(req: Request, res: Response) {
    try {
      const { polNo } = req.body;
      const user = (req as any).user?.username || 'ADMIN';
      const record = await policyServicingRepository.createSurrenderRequest(polNo, user);
      return res.status(201).json({
        success: true,
        message: `Surrender Request ${record.SURRENDER_NO} generated successfully`,
        data: record
      });
    } catch (err: any) {
      console.error('Create surrender request error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to create surrender request'
      });
    }
  },

  async approveSurrender(req: Request, res: Response) {
    try {
      const { surrenderNo } = req.params;
      const { remarks } = req.body;
      const user = (req as any).user?.username || 'POLICY_ADMIN';
      const result = await policyServicingRepository.approveSurrender(surrenderNo, remarks, user);
      return res.status(200).json({
        success: true,
        message: `Surrender ${surrenderNo} approved and settled. Accounting entries generated.`,
        data: result
      });
    } catch (err: any) {
      console.error('Approve surrender error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to approve surrender'
      });
    }
  },

  async getSurrenders(req: Request, res: Response) {
    try {
      const { status, search } = req.query;
      const surrenders = await policyServicingRepository.getAllSurrenders(
        status ? String(status) : undefined,
        search ? String(search) : undefined
      );
      return res.status(200).json({
        success: true,
        count: surrenders.length,
        data: surrenders
      });
    } catch (err: any) {
      console.error('Get surrenders error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch surrenders'
      });
    }
  },

  // 4. Maturities
  async checkMaturityDue(req: Request, res: Response) {
    try {
      const list = await policyServicingRepository.checkMaturityDue();
      return res.status(200).json({
        success: true,
        count: list.length,
        data: list
      });
    } catch (err: any) {
      console.error('Check maturity due error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to check maturity due'
      });
    }
  },

  async processMaturitySettlement(req: Request, res: Response) {
    try {
      const { polNo } = req.body;
      const { remarks } = req.body;
      const user = (req as any).user?.username || 'POLICY_ADMIN';
      const result = await policyServicingRepository.processMaturitySettlement(polNo, remarks, user);
      return res.status(200).json({
        success: true,
        message: `Maturity settlement ${result.maturity.MATURITY_NO} processed successfully. Policy status updated to MATURED.`,
        data: result
      });
    } catch (err: any) {
      console.error('Process maturity error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to process maturity settlement'
      });
    }
  },

  async getMaturities(req: Request, res: Response) {
    try {
      const { status, search } = req.query;
      const list = await policyServicingRepository.getAllMaturities(
        status ? String(status) : undefined,
        search ? String(search) : undefined
      );
      return res.status(200).json({
        success: true,
        count: list.length,
        data: list
      });
    } catch (err: any) {
      console.error('Get maturities error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch maturities'
      });
    }
  },

  // 5. Policy Loans
  async checkLoanEligibility(req: Request, res: Response) {
    try {
      const { polNo } = req.params;
      const result = await policyServicingRepository.checkLoanEligibility(polNo);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err: any) {
      console.error('Check loan eligibility error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to check loan eligibility'
      });
    }
  },

  async disburseLoan(req: Request, res: Response) {
    try {
      const { polNo, loanAmount, remarks } = req.body;
      const user = (req as any).user?.username || 'POLICY_ADMIN';
      const result = await policyServicingRepository.disburseLoan(polNo, Number(loanAmount), remarks, user);
      return res.status(201).json({
        success: true,
        message: `Policy Loan ${result.loan.LOAN_NO} disbursed successfully for OMR ${loanAmount}`,
        data: result
      });
    } catch (err: any) {
      console.error('Disburse loan error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to disburse policy loan'
      });
    }
  },

  async repayLoan(req: Request, res: Response) {
    try {
      const { loanNo } = req.params;
      const { principalPaid, interestPaid, payMode, transactionRef } = req.body;
      const user = (req as any).user?.username || 'ADMIN';
      const result = await policyServicingRepository.repayLoan(
        loanNo,
        Number(principalPaid || 0),
        Number(interestPaid || 0),
        payMode,
        transactionRef,
        user
      );
      return res.status(200).json({
        success: true,
        message: `Loan Repayment ${result.repayment.REPAYMENT_NO} processed successfully`,
        data: result
      });
    } catch (err: any) {
      console.error('Repay loan error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to process loan repayment'
      });
    }
  },

  async getLoans(req: Request, res: Response) {
    try {
      const { status, search } = req.query;
      const loans = await policyServicingRepository.getAllLoans(
        status ? String(status) : undefined,
        search ? String(search) : undefined
      );
      return res.status(200).json({
        success: true,
        count: loans.length,
        data: loans
      });
    } catch (err: any) {
      console.error('Get loans error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch loans'
      });
    }
  },

  // 6. Accounting Entries
  async getJournalEntries(req: Request, res: Response) {
    try {
      const { voucherNo, sourceRefNo, txnSource } = req.query;
      const entries = await policyServicingRepository.getJournalEntries(
        voucherNo ? String(voucherNo) : undefined,
        sourceRefNo ? String(sourceRefNo) : undefined,
        txnSource ? String(txnSource) : undefined
      );
      return res.status(200).json({
        success: true,
        count: entries.length,
        data: entries
      });
    } catch (err: any) {
      console.error('Get journal entries error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch journal entries'
      });
    }
  }
};
