import { Request, Response } from 'express';
import { z } from 'zod';
import { endorsementRepository } from '../repositories/endorsementRepository';

const createEndorsementSchema = z.object({
  endorsementType: z.enum([
    'ADDRESS_CONTACT',
    'BENEFICIARY_CHANGE',
    'SUM_ASSURED_CHANGE',
    'RIDER_ADD_REMOVE',
    'FREQUENCY_CHANGE',
    'GENERAL'
  ]),
  effectiveDate: z.string().optional(),
  reason: z.string().min(3, 'Endorsement reason is required').max(250),
  remarks: z.string().max(500).optional(),
  addressContact: z.object({
    address: z.string().max(300).optional().nullable(),
    mobile: z.string().max(25).optional().nullable(),
    email: z.string().email().optional().nullable().or(z.literal('')),
    occupation: z.string().max(100).optional().nullable()
  }).optional(),
  beneficiaries: z.array(z.object({
    name: z.string().min(1, 'Beneficiary nominee name is required'),
    relation: z.string().min(1),
    dob: z.string().optional().nullable(),
    sharePct: z.number().min(0.01).max(100),
    idType: z.string().optional().nullable(),
    idNo: z.string().optional().nullable(),
    contact: z.string().optional().nullable()
  })).optional(),
  sumAssuredChange: z.object({
    newSumAssured: z.number().min(1000, 'Sum Assured must be at least $1,000')
  }).optional(),
  frequencyChange: z.object({
    newPayFreq: z.enum(['ANNUAL', 'SEMI_ANNUAL', 'QUARTERLY', 'MONTHLY'])
  }).optional(),
  riderChange: z.object({
    action: z.enum(['ADD', 'REMOVE']),
    riderCode: z.string().min(1),
    riderName: z.string().optional(),
    sumAssured: z.number().optional(),
    rate: z.number().optional(),
    premium: z.number().optional()
  }).optional()
});

const calculateEndorsementSchema = z.object({
  polNo: z.string().min(1, 'Policy Number is required'),
  endorsementType: z.enum([
    'ADDRESS_CONTACT',
    'BENEFICIARY_CHANGE',
    'SUM_ASSURED_CHANGE',
    'RIDER_ADD_REMOVE',
    'FREQUENCY_CHANGE',
    'GENERAL'
  ]),
  newSumAssured: z.number().optional().nullable(),
  newPayFreq: z.enum(['ANNUAL', 'SEMI_ANNUAL', 'QUARTERLY', 'MONTHLY']).optional().nullable()
});

export const endorsementController = {
  /**
   * POST /api/endorsements/calculate
   * Preview calculation via Oracle DB Package PKG_POLICY_ENDORSEMENT
   */
  async calculateImpact(req: Request, res: Response): Promise<void> {
    try {
      const validated = calculateEndorsementSchema.parse(req.body);
      const result = await endorsementRepository.calculateImpact(
        validated.polNo,
        validated.endorsementType,
        validated.newSumAssured,
        validated.newPayFreq
      );
      res.json({
        success: true,
        calculation: result
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const detailMsg = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
        res.status(400).json({
          success: false,
          message: `Validation error: ${detailMsg}`
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to calculate endorsement impact'
      });
    }
  },
  /**
   * GET /api/policies/:polNo/endorsements
   */
  async getByPolicy(req: Request, res: Response): Promise<void> {
    try {
      const polNo = req.params.polNo.trim();
      const endorsements = await endorsementRepository.getByPolicyNo(polNo);
      res.json({
        success: true,
        count: endorsements.length,
        endorsements
      });
    } catch (error: any) {
      console.error('Error fetching policy endorsements:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve endorsements'
      });
    }
  },

  /**
   * GET /api/endorsements
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const endorsements = await endorsementRepository.getAll();
      res.json({
        success: true,
        count: endorsements.length,
        endorsements
      });
    } catch (error: any) {
      console.error('Error fetching all endorsements:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve endorsements'
      });
    }
  },

  /**
   * POST /api/policies/:polNo/endorsements
   */
  async createEndorsement(req: Request, res: Response): Promise<void> {
    try {
      const polNo = req.params.polNo.trim();
      const validated = createEndorsementSchema.parse(req.body);
      const username = (req as any).user?.userId || (req as any).user?.USR_ID || 'uwmgr';
      const userGroup = (req as any).user?.userGroup || 'UWMGR';

      const result = await endorsementRepository.createEndorsement(
        {
          polNo,
          ...validated
        },
        username,
        userGroup
      );

      res.status(201).json({
        success: true,
        message: `Policy Endorsement '${result.endorsement.ENDORSEMENT_NO}' applied successfully to Policy '${polNo}'.`,
        endorsement: result.endorsement,
        policy: result.policy
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const detailMsg = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
        res.status(400).json({
          success: false,
          message: `Validation error: ${detailMsg}`,
          errors: error.issues
        });
        return;
      }

      console.error('Error creating endorsement:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create policy endorsement',
        error: error.message
      });
    }
  }
};
