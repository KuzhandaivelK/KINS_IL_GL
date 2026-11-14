import { Router } from 'express';
import { customerController } from '../controllers/customerController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Protect customer management endpoints with authMiddleware
router.use(authMiddleware);

router.get('/', (req, res, next) => customerController.listCustomers(req, res, next));
router.get('/:customerId', (req, res, next) => customerController.getCustomer(req, res, next));
router.post('/', (req, res, next) => customerController.createCustomer(req, res, next));
router.put('/:customerId', (req, res, next) => customerController.updateCustomer(req, res, next));
router.delete('/:customerId', (req, res, next) => customerController.deleteCustomer(req, res, next));

export default router;
