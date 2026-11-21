import { Request, Response } from 'express';
import { z } from 'zod';
import { proposalRepository } from '../repositories/proposalRepository';

const assuredInputSchema = z.object({
  PAS_NAME: z.string().min(1, 'Life Assured name is required').max(150),
  PAS_DOB: z.string().min(1, 'Date of Birth is required'),
  PAS_AGE: z.number().int().min(0).max(120),
  PAS_GENDER: z.enum(['M', 'F', 'O']),
  PAS_OCCUPATION: z.string().max(100).optional(),
  PAS_ANN_INCOME: z.number().min(0).optional().default(0),
  PAS_ID_TYPE: z.string().max(30).optional().default('NATIONAL_ID'),
  PAS_ID_NO: z.string().max(50).optional(),
  PAS_MOBILE: z.string().max(25).optional(),
  PAS_EMAIL: z.string().email().optional().or(z.literal('')),
  PAS_ADDRESS: z.string().max(300).optional(),
  PAS_SMOKER_YN: z.enum(['Y', 'N']).optional().default('N'),
  PAS_HIV_YN: z.enum(['Y', 'N']).optional().default('N'),
  PAS_HEIGHT_CM: z.number().nullable().optional(),
  PAS_WEIGHT_KG: z.number().nullable().optional(),
  PAS_BMI: z.number().nullable().optional(),
  PAS_MEDICAL_HISTORY: z.string().max(1000).optional()
});

const riderInputSchema = z.object({
  PRD_RIDER_CODE: z.string().min(1).max(20),
  PRD_RIDER_NAME: z.string().min(1).max(150),
  PRD_SUM_ASSURED: z.number().min(0),
  PRD_RATE: z.number().optional().default(0.45),
  PRD_PREMIUM: z.number().min(0)
});

const discLoadInputSchema = z.object({
  PDL_TYPE: z.enum(['DISCOUNT', 'LOADING']),
  PDL_REASON: z.string().min(1).max(50),
  PDL_CALC_TYPE: z.enum(['PERCENTAGE', 'FLAT', 'PER_MILLE']).optional().default('PERCENTAGE'),
  PDL_RATE_VALUE: z.number().optional().default(0),
  PDL_AMOUNT: z.number().min(0),
  PDL_REMARKS: z.string().max(300).optional()
});

const beneficiaryInputSchema = z.object({
  PBEN_NAME: z.string().min(1, 'Beneficiary name is required').max(150),
  PBEN_RELATION: z.string().min(1).max(50),
  PBEN_DOB: z.string().optional(),
  PBEN_SHARE_PCT: z.number().min(0.01).max(100),
  PBEN_ID_TYPE: z.string().max(30).optional(),
  PBEN_ID_NO: z.string().max(50).optional(),
  PBEN_CONTACT: z.string().max(50).optional(),
  PBEN_GUARDIAN_NAME: z.string().max(150).optional(),
  PBEN_GUARDIAN_RELATION: z.string().max(50).optional()
});

const exclusionInputSchema = z.object({
  PEX_CODE: z.string().min(1).max(30),
  PEX_DESC: z.string().min(1).max(500),
  PEX_REASON: z.string().max(100).optional()
});

const createProposalSchema = z.object({
  info: z.object({
    PROP_PROD_CODE: z.string().min(1, 'Product code is required').max(20),
    PROP_PLAN_TYPE: z.string().max(30).optional().default('TERM'),
    PROP_TERM: z.number().int().min(1).max(100),
    PROP_PREM_PAY_TERM: z.number().int().min(1).max(100),
    PROP_SUM_ASSURED: z.number().min(1000),
    PROP_PAY_FREQ: z.enum(['ANNUAL', 'SEMI_ANNUAL', 'QUARTERLY', 'MONTHLY', 'SINGLE']).optional().default('ANNUAL'),
    PROP_MOP: z.string().max(30).optional().default('Y')
  }),
  assured: assuredInputSchema,
  riders: z.array(riderInputSchema).optional().default([]),
  discLoads: z.array(discLoadInputSchema).optional().default([]),
  beneficiaries: z.array(beneficiaryInputSchema).optional().default([]),
  exclusions: z.array(exclusionInputSchema).optional().default([]),
  premiumSummary: z.object({
    PPS_MTH_CODE: z.string().optional(),
    PPS_BASE_RATE: z.number().optional(),
    PPS_BASIC_SUM_ASSURED: z.number(),
    PPS_BASIC_PREMIUM: z.number(),
    PPS_TOTAL_RIDER_PREMIUM: z.number(),
    PPS_TOTAL_LOADING: z.number(),
    PPS_TOTAL_DISCOUNT: z.number(),
    PPS_NET_ANNUAL_PREM: z.number(),
    PPS_MODAL_FACTOR: z.number(),
    PPS_INSTALLMENT_PREM: z.number(),
    PPS_TAX_AMOUNT: z.number().optional().default(0),
    PPS_TOTAL_PAYABLE: z.number()
  }).optional()
});

const calculateTariffSchema = z.object({
  mthCode: z.string().optional().default('MORT_TERM_01'),
  age: z.number().int().min(0).max(120),
  term: z.number().int().min(1).max(100),
  gender: z.enum(['M', 'F', 'O']),
  sumAssured: z.number().min(1000),
  payFreq: z.enum(['ANNUAL', 'SEMI_ANNUAL', 'QUARTERLY', 'MONTHLY', 'SINGLE']).optional().default('ANNUAL'),
  riders: z.array(z.object({
    riderCode: z.string(),
    sumAssured: z.number()
  })).optional().default([]),
  discLoads: z.array(z.object({
    type: z.enum(['DISCOUNT', 'LOADING']),
    calcType: z.enum(['PERCENTAGE', 'FLAT', 'PER_MILLE']),
    rateValue: z.number(),
    reason: z.string()
  })).optional().default([])
});

const workflowActionSchema = z.object({
  action: z.enum(['SUBMIT', 'APPROVE', 'REJECT', 'REWORK']),
  comments: z.string().max(1000).optional().default(''),
  userRole: z.string().optional().default('MAKER')
});

export const proposalController = {
  /**
   * GET /api/proposals
   */
  async getProposals(req: Request, res: Response): Promise<void> {
    try {
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;

      const proposals = await proposalRepository.findAll(status, search);
      res.json({
        success: true,
        count: proposals.length,
        proposals
      });
    } catch (error: any) {
      console.error('Error in getProposals:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve proposals',
        error: error.message
      });
    }
  },

  /**
   * GET /api/proposals/:id
   */
  async getProposalById(req: Request, res: Response): Promise<void> {
    try {
      const identifier = req.params.id.trim();
      const proposal = await proposalRepository.findByProposalNo(identifier);

      if (!proposal) {
        res.status(404).json({
          success: false,
          message: `Proposal '${identifier}' not found.`
        });
        return;
      }

      res.json({
        success: true,
        proposal
      });
    } catch (error: any) {
      console.error('Error in getProposalById:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve proposal detail',
        error: error.message
      });
    }
  },

  /**
   * GET /api/proposals/mop-codes
   * Retrieve MOP dropdown options from STBL_CODE
   */
  async getMopCodes(_req: Request, res: Response): Promise<void> {
    try {
      const options = await proposalRepository.getMopCodes();
      res.json({
        success: true,
        count: options.length,
        options
      });
    } catch (error: any) {
      console.error('Error in getMopCodes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve Mode of Payment codes from database',
        error: error.message
      });
    }
  },

  /**
   * POST /api/proposals
   */
  async createProposal(req: Request, res: Response): Promise<void> {
    try {
      const validated = createProposalSchema.parse(req.body);
      const username = (req as any).user?.userId || (req as any).user?.USR_ID || 'admin';

      const proposal = await proposalRepository.create(validated, username);

      res.status(201).json({
        success: true,
        message: `Proposal '${proposal.info.PROP_NO}' created successfully.`,
        proposal
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

      console.error('Error in createProposal:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create proposal',
        error: error.message
      });
    }
  },

  /**
   * PUT /api/proposals/:id
   */
  async updateProposal(req: Request, res: Response): Promise<void> {
    try {
      const propNo = req.params.id.trim();
      const validated = createProposalSchema.parse(req.body);
      const username = (req as any).user?.userId || (req as any).user?.USR_ID || 'admin';

      const updated = await proposalRepository.update(propNo, validated, username);

      res.json({
        success: true,
        message: `Proposal '${propNo}' updated successfully.`,
        proposal: updated
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

      console.error('Error in updateProposal:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update proposal',
        error: error.message
      });
    }
  },

  /**
   * DELETE /api/proposals/:id
   */
  async deleteProposal(req: Request, res: Response): Promise<void> {
    try {
      const propNo = req.params.id.trim();
      const success = await proposalRepository.delete(propNo);

      if (!success) {
        res.status(404).json({
          success: false,
          message: `Proposal '${propNo}' not found.`
        });
        return;
      }

      res.json({
        success: true,
        message: `Proposal '${propNo}' deleted successfully.`
      });
    } catch (error: any) {
      console.error('Error in deleteProposal:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete proposal',
        error: error.message
      });
    }
  },

  /**
   * POST /api/proposals/calculate-tariff
   * Direct Oracle PKG_TARIFF calculation endpoint
   */
  async calculateTariff(req: Request, res: Response): Promise<void> {
    try {
      const validated = calculateTariffSchema.parse(req.body);
      const result = await proposalRepository.calculateTariff(validated);

      res.json({
        success: true,
        calculation: result
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

      console.error('Error in calculateTariff:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate tariff with Oracle database package',
        error: error.message
      });
    }
  },

  /**
   * POST /api/proposals/:id/workflow
   * Process Maker / Checker / Underwriter workflow decision
   */
  async processWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const propNo = req.params.id.trim();
      const validated = workflowActionSchema.parse(req.body);
      const username = (req as any).user?.userId || (req as any).user?.USR_ID || 'admin';
      const userGroup = ((req as any).user?.userGroup || 'ADMIN').toUpperCase();

      // Enforce role separation: UWUSER / DEUSER can only submit for verification
      if ((userGroup === 'UWUSER' || userGroup === 'DEUSER') && validated.action === 'APPROVE') {
        res.status(403).json({
          success: false,
          message: 'Access denied: Underwriting users can only submit proposals for verification. Approval & authorization requires POLICY_ADMIN category.'
        });
        return;
      }

      const updated = await proposalRepository.processWorkflowAction(
        propNo,
        validated.action,
        validated.comments,
        username,
        validated.userRole
      );

      res.json({
        success: true,
        message: `Workflow action '${validated.action}' executed successfully on ${propNo}.`,
        proposal: updated
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

      console.error('Error in processWorkflow:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to process workflow action',
        error: error.message
      });
    }
  }
};
