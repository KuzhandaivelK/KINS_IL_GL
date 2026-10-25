import { Router } from 'express';
import { userController } from '../controllers/userController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Protect all user management endpoints with authMiddleware
router.use(authMiddleware);

router.get('/', (req, res, next) => userController.listUsers(req, res, next));
router.get('/:userId', (req, res, next) => userController.getUser(req, res, next));
router.post('/', (req, res, next) => userController.createUser(req, res, next));
router.put('/:userId', (req, res, next) => userController.updateUser(req, res, next));
router.delete('/:userId', (req, res, next) => userController.deleteUser(req, res, next));

export default router;
