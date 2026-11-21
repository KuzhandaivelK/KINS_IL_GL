import { Router } from 'express';
import { policyController } from '../controllers/policyController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Protect all policy endpoints
router.use(authMiddleware);

// Query endpoints
router.get('/', policyController.getPolicies);
router.get('/:id', policyController.getPolicyById);

// Conversion and Approval
router.post('/convert-proposal/:propNo', policyController.convertProposal);
router.post('/:id/approve', policyController.approvePolicy);

export default router;
