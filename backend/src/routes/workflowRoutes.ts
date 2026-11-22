import { Router } from 'express';
import { workflowController } from '../controllers/workflowController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Protect all workflow endpoints
router.use(authMiddleware);

// Meta routes
router.get('/meta/lookups', workflowController.getLookups);
router.get('/meta/user-groups', workflowController.getUserGroups);
router.post('/check-permission', workflowController.checkPermission);

// Workbasket route (Pending approvals for user group)
router.get('/workbasket', workflowController.getWorkbasket);

// CRUD routes
router.get('/', workflowController.getWorkflows);
router.get('/:code', workflowController.getWorkflowByCode);
router.post('/', workflowController.createWorkflow);
router.put('/:code', workflowController.updateWorkflow);
router.delete('/:code', workflowController.deleteWorkflow);

export default router;
