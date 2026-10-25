import { Router } from 'express';
import { menuController } from '../controllers/menuController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Menu listing can be public or authenticated for dynamic layout
router.get('/', (req, res, next) => menuController.listMenus(req, res, next));
router.get('/:menuId', (req, res, next) => menuController.getMenu(req, res, next));

// Modifications require authenticated session
router.post('/', authMiddleware, (req, res, next) => menuController.createMenu(req, res, next));
router.put('/:menuId', authMiddleware, (req, res, next) => menuController.updateMenu(req, res, next));
router.delete('/:menuId', authMiddleware, (req, res, next) => menuController.deleteMenu(req, res, next));

export default router;
