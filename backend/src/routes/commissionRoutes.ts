import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { commissionController } from '../controllers/commissionController';

const router = Router();

router.use(authMiddleware);

// Channels
router.get('/channels', commissionController.listChannels);
router.post('/channels', commissionController.saveChannel);

// Intermediaries (Agents with Hierarchy, Brokers, Other Channels)
router.get('/intermediaries', commissionController.listIntermediaries);
router.post('/intermediaries', commissionController.saveIntermediary);

// Commission Structures (Product-wise default & Optional Cover-wise)
router.get('/structures', commissionController.listStructures);
router.post('/structures', commissionController.saveStructure);
router.delete('/structures/:id', commissionController.deleteStructure);

// Lookups
router.get('/products-covers', commissionController.listProductsAndCovers);
router.get('/eligible-policies', commissionController.listEligiblePolicies);

// Policy-wise Commission Calculation, Listing, Detail & Approval
router.get('/policies', commissionController.listPolicyCommissions);
router.get('/policies/:commNo', commissionController.getPolicyCommissionDetail);
router.post('/calculate', commissionController.calculatePolicyCommission);
router.post('/policies/:commNo/approve', commissionController.approveCommission);

export default router;
