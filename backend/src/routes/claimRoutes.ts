import { Router } from 'express';
import multer from 'multer';
import { claimController } from '../controllers/claimController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.use(authMiddleware);

router.get('/', claimController.listClaims);
router.get('/lookup-policy/:polNo', claimController.lookupPolicy);
router.post('/fnol', claimController.registerFnol);
router.get('/documents/:docId/download', claimController.downloadDocument);
router.delete('/documents/:docId', claimController.deleteDocument);

router.get('/:claimNo', claimController.getClaimDetail);
router.post('/:claimNo/documents', upload.single('file'), claimController.uploadDocument);
router.post('/:claimNo/assess', claimController.assessClaim);
router.post('/:claimNo/approve', claimController.approveClaim);
router.post('/:claimNo/reject', claimController.rejectClaim);
router.post('/:claimNo/settle', claimController.settleClaim);

export default router;
