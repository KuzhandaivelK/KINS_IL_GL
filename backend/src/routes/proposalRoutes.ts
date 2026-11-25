import { Router } from 'express';
import multer from 'multer';
import { proposalController } from '../controllers/proposalController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// Protect all proposal endpoints
router.use(authMiddleware);

// Tariff calculation endpoint (invokes PKG_PROPOSAL_TARIFF -> PKG_TARIFF)
router.post('/calculate-tariff', proposalController.calculateTariff);

// MOP lookup codes endpoint
router.get('/mop-codes', proposalController.getMopCodes);

// Individual Life Medical Grid & Medical Document endpoints
router.get('/medical-grid', proposalController.getMedicalGrid);
router.get('/medical-docs/:docId/download', proposalController.downloadMedicalDocument);
router.delete('/medical-docs/:docId', proposalController.deleteMedicalDocument);

// CRUD Endpoints
router.get('/', proposalController.getProposals);
router.get('/:id', proposalController.getProposalById);
router.get('/:id/medical-docs', proposalController.getMedicalDocuments);
router.post('/:id/medical-docs/upload', upload.single('file'), proposalController.uploadMedicalDocument);
router.post('/', proposalController.createProposal);
router.put('/:id', proposalController.updateProposal);
router.delete('/:id', proposalController.deleteProposal);

// Workflow Action Endpoint (Submit, Underwriting: Approve, Reject, Rework)
router.post('/:id/workflow', proposalController.processWorkflow);

export default router;
