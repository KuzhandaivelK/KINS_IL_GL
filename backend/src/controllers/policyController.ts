import { Request, Response } from 'express';
import { z } from 'zod';
import { policyRepository } from '../repositories/policyRepository';

const approvePolicySchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'REWORK']),
  remarks: z.string().max(1000).optional().default('')
});

export const policyController = {
  /**
   * GET /api/policies
   */
  async getPolicies(req: Request, res: Response): Promise<void> {
    try {
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;

      const policies = await policyRepository.findAll(status, search);
      res.json({
        success: true,
        count: policies.length,
        policies
      });
    } catch (error: any) {
      console.error('Error in getPolicies:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve policies',
        error: error.message
      });
    }
  },

  /**
   * GET /api/policies/:id
   */
  async getPolicyById(req: Request, res: Response): Promise<void> {
    try {
      const identifier = req.params.id.trim();
      const policy = await policyRepository.findByPolicyNo(identifier);

      if (!policy) {
        res.status(404).json({
          success: false,
          message: `Policy '${identifier}' not found.`
        });
        return;
      }

      res.json({
        success: true,
        policy
      });
    } catch (error: any) {
      console.error('Error in getPolicyById:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve policy details',
        error: error.message
      });
    }
  },

  /**
   * POST /api/policies/convert-proposal/:propNo
   * Convert an approved proposal to policy
   */
  async convertProposal(req: Request, res: Response): Promise<void> {
    try {
      const propNo = req.params.propNo.trim();
      const username = req.user?.userId || 'admin';
      const userGroup = req.user?.userGroup || 'ADMIN';

      // Check user role: policy_admin or admin
      if (userGroup !== 'POLICY_ADMIN' && userGroup !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Access denied: Only Policy Administration officers can convert proposals to policy contracts.'
        });
        return;
      }

      const policy = await policyRepository.convertFromProposal(propNo, username);

      res.status(201).json({
        success: true,
        message: `Proposal '${propNo}' successfully converted to Policy Contract '${policy.info.POL_NO}'.`,
        policy
      });
    } catch (error: any) {
      console.error('Error in convertProposal:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to convert proposal to policy',
        error: error.message
      });
    }
  },

  /**
   * POST /api/policies/:id/approve
   * Policy approval & authorization by policy_admin
   */
  async approvePolicy(req: Request, res: Response): Promise<void> {
    try {
      const polNo = req.params.id.trim();
      const validated = approvePolicySchema.parse(req.body);
      const username = req.user?.userId || 'admin';
      const userGroup = req.user?.userGroup || 'ADMIN';

      // Check role
      if (userGroup !== 'POLICY_ADMIN' && userGroup !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Access denied: Only Policy Administration officers can authorize incepted policies.'
        });
        return;
      }

      const updated = await policyRepository.approvePolicy(polNo, validated, username, userGroup);

      res.json({
        success: true,
        message: `Policy '${polNo}' successfully approved and placed IN FORCE.`,
        policy: updated
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

      console.error('Error in approvePolicy:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to authorize policy',
        error: error.message
      });
    }
  }
};
