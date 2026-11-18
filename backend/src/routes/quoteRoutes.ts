import { Router } from 'express';
import { quoteController } from '../controllers/quoteController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Protect quote endpoints with authMiddleware
router.use(authMiddleware);

// Premium Calculation Engine hook
router.post('/calculate', quoteController.calculatePremium);

// Standard CRUD endpoints
router.get('/', quoteController.getQuotes);
router.get('/:id', quoteController.getQuoteById);
router.post('/', quoteController.createQuote);
router.put('/:id', quoteController.updateQuote);
router.delete('/:id', quoteController.deleteQuote);

export default router;
