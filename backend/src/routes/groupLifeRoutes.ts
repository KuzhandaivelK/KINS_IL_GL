import { Router } from 'express';
import multer from 'multer';
import { groupLifeController } from '../controllers/groupLifeController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Configure multer for in-memory handling of uploaded CSV and Excel files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

// Protect all Group Life endpoints
router.use(authMiddleware);

// Member Census Template & Upload endpoints
router.get('/members/template', groupLifeController.downloadMemberTemplate);
router.post('/members/parse-file', upload.single('file'), groupLifeController.parseMemberFile);
router.post('/policies/:policyNo/members/upload', upload.single('file'), groupLifeController.uploadPolicyMembers);

// Actuarial Calculation for census & quote
router.post('/quotes/calculate', groupLifeController.calculateQuote);

// Group Life Quotes CRUD & conversion
router.get('/quotes', groupLifeController.listQuotes);
router.post('/quotes', groupLifeController.createQuote);
router.get('/quotes/:quoteNo', groupLifeController.getQuote);
router.get('/quotes/:quoteNo/member-covers', groupLifeController.getQuoteMemberCovers);
router.post('/quotes/:quoteNo/convert', groupLifeController.convertToPolicy);

// Group Life Master Policies
router.get('/policies', groupLifeController.listPolicies);
router.get('/policies/:policyNo', groupLifeController.getPolicy);
router.get('/policies/:policyNo/member-covers', groupLifeController.getPolicyMemberCovers);
router.post('/policies/:policyNo/approve', groupLifeController.approvePolicy);

// EOI (Evidence of Insurability) flag & document endpoints
router.put('/policies/:policyNo/members/:memberId/eoi', groupLifeController.updatePolicyMemberEoi);
router.put('/quotes/:quoteNo/members/:memberId/eoi', groupLifeController.updateQuoteMemberEoi);
router.post('/eoi-documents/upload', upload.single('file'), groupLifeController.uploadEoiDocument);
router.get('/eoi-documents', groupLifeController.listEoiDocuments);
router.get('/eoi-documents/:docId/download', groupLifeController.downloadEoiDocument);
router.delete('/eoi-documents/:docId', groupLifeController.deleteEoiDocument);

export default router;
