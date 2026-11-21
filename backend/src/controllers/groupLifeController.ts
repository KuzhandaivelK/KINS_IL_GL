import { Request, Response } from 'express';
import { groupLifeRepository } from '../repositories/groupLifeRepository';

export const groupLifeController = {
  /**
   * Actuarial calculation for Census Schedule
   */
  async calculateQuote(req: Request, res: Response) {
    try {
      const result = groupLifeRepository.calculate(req.body);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err: any) {
      console.error('Group Life calculation error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to calculate Group Life quotation'
      });
    }
  },

  /**
   * List all GL Quotes
   */
  async listQuotes(req: Request, res: Response) {
    try {
      const { status, search } = req.query;
      const quotes = await groupLifeRepository.findAllQuotes(
        status ? String(status) : undefined,
        search ? String(search) : undefined
      );
      return res.status(200).json({
        success: true,
        data: quotes
      });
    } catch (err: any) {
      console.error('List GL Quotes error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch Group Life quotations'
      });
    }
  },

  /**
   * Get single GL Quote with members and riders
   */
  async getQuote(req: Request, res: Response) {
    try {
      const { quoteNo } = req.params;
      const detail = await groupLifeRepository.findQuoteByNo(quoteNo);
      if (!detail) {
        return res.status(404).json({
          success: false,
          message: `Group Life quote ${quoteNo} not found`
        });
      }
      return res.status(200).json({
        success: true,
        data: detail
      });
    } catch (err: any) {
      console.error('Get GL Quote error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch Group Life quote'
      });
    }
  },

  /**
   * Create GL Quote
   */
  async createQuote(req: Request, res: Response) {
    try {
      const user = (req as any).user?.username || 'ADMIN';
      const detail = await groupLifeRepository.createQuote(req.body, user);
      return res.status(201).json({
        success: true,
        message: `Group Life Quote ${detail.header.GL_QUOTE_NO} created successfully`,
        data: detail
      });
    } catch (err: any) {
      console.error('Create GL Quote error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to create Group Life quote'
      });
    }
  },

  /**
   * Convert GL Quote to GL Master Policy
   */
  async convertToPolicy(req: Request, res: Response) {
    try {
      const { quoteNo } = req.params;
      const user = (req as any).user?.username || 'ADMIN';
      const policyDetail = await groupLifeRepository.convertToMasterPolicy(quoteNo, user);
      return res.status(200).json({
        success: true,
        message: `Group Life Quote ${quoteNo} successfully converted to Master Policy ${policyDetail.master.MASTER_POLICY_NO}`,
        data: policyDetail
      });
    } catch (err: any) {
      console.error('Convert GL Quote to Policy error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to convert Group Life quote to Master Policy'
      });
    }
  },

  /**
   * List all GL Master Policies
   */
  async listPolicies(req: Request, res: Response) {
    try {
      const { status, search } = req.query;
      const policies = await groupLifeRepository.findAllPolicies(
        status ? String(status) : undefined,
        search ? String(search) : undefined
      );
      return res.status(200).json({
        success: true,
        data: policies
      });
    } catch (err: any) {
      console.error('List GL Master Policies error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch Group Life master policies'
      });
    }
  },

  /**
   * Get single GL Master Policy with members and riders
   */
  async getPolicy(req: Request, res: Response) {
    try {
      const { policyNo } = req.params;
      const detail = await groupLifeRepository.findPolicyByNo(policyNo);
      if (!detail) {
        return res.status(404).json({
          success: false,
          message: `Group Life Master Policy ${policyNo} not found`
        });
      }
      return res.status(200).json({
        success: true,
        data: detail
      });
    } catch (err: any) {
      console.error('Get GL Policy error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch Group Life master policy'
      });
    }
  },

  /**
   * Approve GL Master Policy
   */
  async approvePolicy(req: Request, res: Response) {
    try {
      const { policyNo } = req.params;
      const { remarks } = req.body;
      const user = (req as any).user?.username || 'POLICY_ADMIN';
      const policyDetail = await groupLifeRepository.approvePolicy(policyNo, remarks, user);
      return res.status(200).json({
        success: true,
        message: `Group Life Master Policy ${policyNo} approved successfully`,
        data: policyDetail
      });
    } catch (err: any) {
      console.error('Approve GL Policy error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to approve Group Life master policy'
      });
    }
  }
};
