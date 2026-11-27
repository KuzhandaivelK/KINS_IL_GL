import { Router } from 'express';
import { reinsuranceController } from '../controllers/reinsuranceController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
router.use(authMiddleware);

router.get('/treaties', reinsuranceController.listTreaties);
router.post('/treaties', reinsuranceController.saveTreaty);
router.get('/eligible-policies', reinsuranceController.listEligiblePolicies);
router.get('/allocations', reinsuranceController.listAllocations);
router.post('/allocations', reinsuranceController.allocatePolicy);
router.get('/allocations/:allocNo', reinsuranceController.getAllocationDetail);
router.post('/allocations/:allocNo/approve', reinsuranceController.approveAllocation);
router.post('/allocations/:allocNo/reject', reinsuranceController.rejectAllocation);

export default router;
