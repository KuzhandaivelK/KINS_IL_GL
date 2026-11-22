import { Request, Response } from 'express';
import { z } from 'zod';
import { workflowRepository } from '../repositories/workflowRepository';
import { workflowAuthService } from '../services/workflowAuthService';

const workflowLevelSchema = z.object({
  WFL_LEVEL_NO: z.number().int().min(1).max(99),
  WFL_LEVEL_NAME: z.string().min(1, 'Level name is required').max(100),
  WFL_ROLE_CODE: z.string().min(1, 'Role code is required').max(50),
  WFL_USER_GROUP: z.string().max(50).nullable().optional(),
  AUTHORIZED_USER_GROUPS: z.array(z.string()).optional(),
  WFL_MIN_AMOUNT: z.number().nullable().optional().default(0),
  WFL_MAX_AMOUNT: z.number().nullable().optional(),
  WFL_SLA_HOURS: z.number().int().min(1).max(9999).optional().default(24),
  WFL_ALLOW_REJECT_YN: z.enum(['Y', 'N']).optional().default('Y'),
  WFL_ALLOW_REWORK_YN: z.enum(['Y', 'N']).optional().default('Y'),
  WFL_MANDATORY_DOC_YN: z.enum(['Y', 'N']).optional().default('N'),
  WFL_AUTO_ESCALATE_HOURS: z.number().int().min(1).max(9999).optional().default(48),
  IS_ACTIVE: z.enum(['Y', 'N']).optional().default('Y')
});

const createWorkflowSchema = z.object({
  WF_CODE: z.string().min(1, 'Workflow Code is required').max(30),
  WF_NAME: z.string().min(1, 'Workflow Name is required').max(150),
  WF_CATEGORY: z.enum(['NEW_BUSINESS', 'UNDERWRITING', 'POLICY_ADMIN', 'CLAIMS', 'FINANCE']),
  WF_DESC: z.string().max(500).nullable().optional(),
  WF_TOTAL_LEVELS: z.number().int().min(1).max(20).optional().default(1),
  WF_ALLOW_AUTO_APPROVAL_YN: z.enum(['Y', 'N']).optional().default('N'),
  WF_AUTO_APPROVAL_LIMIT: z.number().min(0).optional().default(0),
  IS_ACTIVE: z.enum(['Y', 'N']).optional().default('Y'),
  levels: z.array(workflowLevelSchema).optional().default([])
});

const updateWorkflowSchema = z.object({
  WF_NAME: z.string().min(1, 'Workflow Name is required').max(150).optional(),
  WF_CATEGORY: z.enum(['NEW_BUSINESS', 'UNDERWRITING', 'POLICY_ADMIN', 'CLAIMS', 'FINANCE']).optional(),
  WF_DESC: z.string().max(500).nullable().optional(),
  WF_TOTAL_LEVELS: z.number().int().min(1).max(20).optional(),
  WF_ALLOW_AUTO_APPROVAL_YN: z.enum(['Y', 'N']).optional(),
  WF_AUTO_APPROVAL_LIMIT: z.number().min(0).nullable().optional(),
  IS_ACTIVE: z.enum(['Y', 'N']).optional(),
  levels: z.array(workflowLevelSchema).optional()
});

const WORKFLOW_CATEGORIES = [
  { code: 'NEW_BUSINESS', label: 'New Business / Proposal' },
  { code: 'UNDERWRITING', label: 'Underwriting & Risk Clearance' },
  { code: 'POLICY_ADMIN', label: 'Policy Administration & Servicing' },
  { code: 'CLAIMS', label: 'Claims Adjudication & Settlement' },
  { code: 'FINANCE', label: 'Finance & Payments' }
];

const WORKFLOW_ROLES = [
  { code: 'MAKER', label: 'Maker / Intake Clerk' },
  { code: 'CHECKER', label: 'Checker / Supervisor' },
  { code: 'UW_OFFICER', label: 'Junior Underwriting Officer' },
  { code: 'SR_UNDERWRITER', label: 'Senior Underwriter' },
  { code: 'UW_COMMITTEE', label: 'Chief Underwriting Committee' },
  { code: 'CLAIMS_OFFICER', label: 'Claims Adjudication Officer' },
  { code: 'CLAIMS_MGR', label: 'Claims Manager' },
  { code: 'FINANCE_MAKER', label: 'Finance / Accounts Clerk' },
  { code: 'FINANCE_MGR', label: 'Finance Manager' },
  { code: 'BRANCH_MGR', label: 'Branch / Servicing Manager' },
  { code: 'ADMIN', label: 'System Administrator' }
];

export const workflowController = {
  /**
   * GET /api/workflows
   */
  async getWorkflows(req: Request, res: Response): Promise<void> {
    try {
      const category = req.query.category as string | undefined;
      const search = req.query.search as string | undefined;

      const workflows = await workflowRepository.findAll(category, search);
      res.json({
        success: true,
        count: workflows.length,
        workflows
      });
    } catch (error: any) {
      console.error('Error in getWorkflows:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve workflows',
        error: error.message
      });
    }
  },

  /**
   * GET /api/workflows/meta/lookups
   */
  async getLookups(req: Request, res: Response): Promise<void> {
    try {
      const userGroups = await workflowAuthService.getUserGroupsWithCounts();
      res.json({
        success: true,
        categories: WORKFLOW_CATEGORIES,
        roles: WORKFLOW_ROLES,
        userGroups
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to load lookups',
        error: error.message
      });
    }
  },

  /**
   * GET /api/workflows/meta/user-groups
   */
  async getUserGroups(_req: Request, res: Response): Promise<void> {
    try {
      const userGroups = await workflowAuthService.getUserGroupsWithCounts();
      res.json({
        success: true,
        count: userGroups.length,
        userGroups
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to load user groups',
        error: error.message
      });
    }
  },

  /**
   * POST /api/workflows/check-permission
   * Verify if current user is authorized to perform action at given workflow level
   */
  async checkPermission(req: Request, res: Response): Promise<void> {
    try {
      const { wfCode, levelNo, action, amount } = req.body;
      const userId = (req as any).user?.userId || (req as any).user?.USR_ID || 'admin';
      const userGroup = (req as any).user?.userGroup;

      const result = await workflowAuthService.checkPermission({
        userId,
        userGroup,
        wfCode: String(wfCode || 'WF_UNDERWRITING'),
        levelNo: Number(levelNo || 1),
        action: action || 'APPROVE',
        amount: amount !== undefined && amount !== null ? Number(amount) : undefined
      });

      res.json({
        success: true,
        permission: result
      });
    } catch (error: any) {
      console.error('Error in checkPermission:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to evaluate workflow permission',
        error: error.message
      });
    }
  },

  /**
   * GET /api/workflows/workbasket
   * Retrieve pending approvals and tasks for the authenticated user and group
   */
  async getWorkbasket(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId || (req as any).user?.USR_ID || 'admin';
      const userGroup = (req as any).user?.userGroup;

      const summary = await workflowAuthService.getWorkbasket(userId, userGroup);
      res.json({
        success: true,
        ...summary
      });
    } catch (error: any) {
      console.error('Error in getWorkbasket:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve workbasket',
        error: error.message
      });
    }
  },

  /**
   * GET /api/workflows/:code
   */
  async getWorkflowByCode(req: Request, res: Response): Promise<void> {
    try {
      const code = req.params.code.trim().toUpperCase();
      const workflow = await workflowRepository.findByCode(code);

      if (!workflow) {
        res.status(404).json({
          success: false,
          message: `Workflow '${code}' not found.`
        });
        return;
      }

      res.json({
        success: true,
        workflow
      });
    } catch (error: any) {
      console.error('Error in getWorkflowByCode:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve workflow detail',
        error: error.message
      });
    }
  },

  /**
   * POST /api/workflows
   */
  async createWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const validated = createWorkflowSchema.parse(req.body);
      const username = (req as any).user?.USR_ID || 'admin';

      const created = await workflowRepository.create(validated, username);

      res.status(201).json({
        success: true,
        message: `Workflow '${created.head.WF_CODE}' created successfully.`,
        workflow: created
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.issues
        });
        return;
      }

      console.error('Error in createWorkflow:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create workflow',
        error: error.message
      });
    }
  },

  /**
   * PUT /api/workflows/:code
   */
  async updateWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const code = req.params.code.trim().toUpperCase();
      const validated = updateWorkflowSchema.parse(req.body);
      const username = (req as any).user?.USR_ID || 'admin';

      const updated = await workflowRepository.update(code, validated, username);

      res.json({
        success: true,
        message: `Workflow '${code}' updated successfully.`,
        workflow: updated
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.issues
        });
        return;
      }

      console.error('Error in updateWorkflow:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update workflow',
        error: error.message
      });
    }
  },

  /**
   * DELETE /api/workflows/:code
   */
  async deleteWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const code = req.params.code.trim().toUpperCase();
      const success = await workflowRepository.delete(code);

      if (!success) {
        res.status(404).json({
          success: false,
          message: `Workflow '${code}' not found or already deleted.`
        });
        return;
      }

      res.json({
        success: true,
        message: `Workflow '${code}' deleted successfully.`
      });
    } catch (error: any) {
      console.error('Error in deleteWorkflow:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete workflow',
        error: error.message
      });
    }
  }
};
