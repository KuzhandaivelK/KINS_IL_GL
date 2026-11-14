import { Router } from 'express';
import { tariffController } from '../controllers/tariffController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Protect all tariff endpoints with authentication
router.use(authMiddleware);

// Parameters (M_LIFE_TARIFF_PARAM)
router.get('/params', (req, res, next) => tariffController.listParams(req, res, next));
router.post('/params', (req, res, next) => tariffController.createParam(req, res, next));
router.put('/params/:paramCode', (req, res, next) => tariffController.updateParam(req, res, next));
router.delete('/params/:paramCode', (req, res, next) => tariffController.deleteParam(req, res, next));

// Headers (M_LIFE_TARIFF_HEAD)
router.get('/headers', (req, res, next) => tariffController.listHeaders(req, res, next));
router.get('/headers/:code/:type', (req, res, next) => tariffController.getHeader(req, res, next));
router.post('/headers', (req, res, next) => tariffController.createHeader(req, res, next));
router.put('/headers/:code/:type', (req, res, next) => tariffController.updateHeader(req, res, next));
router.delete('/headers/:code/:type', (req, res, next) => tariffController.deleteHeader(req, res, next));

// Details (M_LIFE_TARIFF_DETAIL)
router.get('/details', (req, res, next) => tariffController.listDetails(req, res, next));
router.post('/details', (req, res, next) => tariffController.createDetail(req, res, next));
router.put('/details/:detailId', (req, res, next) => tariffController.updateDetail(req, res, next));
router.delete('/details/:detailId', (req, res, next) => tariffController.deleteDetail(req, res, next));

export default router;
