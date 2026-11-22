import { Router } from 'express';
import { policyServicingController } from '../controllers/policyServicingController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Protect all policy servicing endpoints
router.use(authMiddleware);

// 1. Premium Collections
router.post('/collections/first-premium', policyServicingController.recordFirstPremium);
router.post('/collections/renewal-premium', policyServicingController.recordRenewalPremium);
router.get('/receipts', policyServicingController.getReceipts);
router.get('/receipts/:receiptNo', policyServicingController.getReceiptByNo);

// 2. Auto-Lapse & Reinstatement
router.post('/lapse/scan', policyServicingController.runAutoLapseScan);
router.get('/reinstatement/calculate/:polNo', policyServicingController.calculateReinstatement);
router.post('/reinstatement/process/:polNo', policyServicingController.reinstatePolicy);

// 3. Surrenders
router.get('/surrender/eligibility/:polNo', policyServicingController.checkSurrenderEligibility);
router.post('/surrender/request', policyServicingController.createSurrenderRequest);
router.post('/surrender/:surrenderNo/approve', policyServicingController.approveSurrender);
router.get('/surrenders', policyServicingController.getSurrenders);

// 4. Maturities
router.get('/maturity/due', policyServicingController.checkMaturityDue);
router.post('/maturity/settle', policyServicingController.processMaturitySettlement);
router.get('/maturities', policyServicingController.getMaturities);

// 5. Policy Loans
router.get('/loans/eligibility/:polNo', policyServicingController.checkLoanEligibility);
router.post('/loans/disburse', policyServicingController.disburseLoan);
router.post('/loans/:loanNo/repay', policyServicingController.repayLoan);
router.get('/loans', policyServicingController.getLoans);

// 6. Accounting Entries
router.get('/journal-entries', policyServicingController.getJournalEntries);

export default router;
