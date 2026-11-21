import { Router } from 'express';
import { groupLifeController } from '../controllers/groupLifeController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Protect all Group Life endpoints
router.use(authMiddleware);

// Actuarial Calculation for census & quote
router.post('/quotes/calculate', groupLifeController.calculateQuote);

// Group Life Quotes CRUD & conversion
router.get('/quotes', groupLifeController.listQuotes);
router.post('/quotes', groupLifeController.createQuote);
router.get('/quotes/:quoteNo', groupLifeController.getQuote);
router.post('/quotes/:quoteNo/convert', groupLifeController.convertToPolicy);

// Group Life Master Policies
router.get('/policies', groupLifeController.listPolicies);
router.get('/policies/:policyNo', groupLifeController.getPolicy);
router.post('/policies/:policyNo/approve', groupLifeController.approvePolicy);

export default router;
