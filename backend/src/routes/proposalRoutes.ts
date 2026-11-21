import { Router } from 'express';
import { proposalController } from '../controllers/proposalController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Protect all proposal endpoints
router.use(authMiddleware);

// Tariff calculation endpoint (invokes PKG_PROPOSAL_TARIFF -> PKG_TARIFF)
router.post('/calculate-tariff', proposalController.calculateTariff);

// MOP lookup codes endpoint
router.get('/mop-codes', proposalController.getMopCodes);

// CRUD Endpoints
router.get('/', proposalController.getProposals);
router.get('/:id', proposalController.getProposalById);
router.post('/', proposalController.createProposal);
router.put('/:id', proposalController.updateProposal);
router.delete('/:id', proposalController.deleteProposal);

// Workflow Action Endpoint (Submit, Underwriting: Approve, Reject, Rework)
router.post('/:id/workflow', proposalController.processWorkflow);

export default router;
