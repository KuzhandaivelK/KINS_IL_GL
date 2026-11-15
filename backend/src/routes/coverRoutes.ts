import { Router } from 'express';
import { coverController } from '../controllers/coverController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Protect all cover management endpoints with authMiddleware
router.use(authMiddleware);

router.get('/types', (req, res, next) => coverController.getCoverTypes(req, res, next));
router.get('/', (req, res, next) => coverController.listCovers(req, res, next));
router.get('/:coverCode', (req, res, next) => coverController.getCover(req, res, next));
router.post('/', (req, res, next) => coverController.createCover(req, res, next));
router.put('/:coverCode', (req, res, next) => coverController.updateCover(req, res, next));
router.delete('/:coverCode', (req, res, next) => coverController.deleteCover(req, res, next));

export default router;
