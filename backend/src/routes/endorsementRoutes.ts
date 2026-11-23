import { Router } from 'express';
import { endorsementController } from '../controllers/endorsementController';

const router = Router();

// Endorsement Routes
router.get('/', endorsementController.getAll);
router.post('/calculate', endorsementController.calculateImpact);
router.get('/policy/:polNo', endorsementController.getByPolicy);
router.post('/policy/:polNo', endorsementController.createEndorsement);

export default router;
