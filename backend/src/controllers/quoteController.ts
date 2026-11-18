import { Request, Response } from 'express';
import { z } from 'zod';
import { quoteRepository } from '../repositories/quoteRepository';
import { PremiumCalculationRequest, PremiumCalculationResponse } from '../types/quote';

const riderInputSchema = z.object({
  PRIDER_CODE: z.string().min(1, 'Rider code is required').max(20),
  PRIDER_NAME: z.string().max(200).optional(),
  PRIDER_SUM_ASSURED: z.number().nullable().optional(),
  PRIDER_PREMIUM: z.number().nullable().optional()
});

const createQuoteSchema = z.object({
  PROS_FULL_NAME: z.string().min(1, 'Prospect full name is required').max(200),
  PROS_DOB: z.string().nullable().optional(),
  PROS_AGE: z.number().min(0).max(120).nullable().optional(),
  PROS_GENDER: z.enum(['M', 'F', 'O']).optional().default('M'),
  PROS_ANN_SALARY: z.number().nullable().optional(),
  PROS_PLAN: z.string().min(1, 'Plan code is required').max(20),
  PROS_TERM: z.number().min(1).max(100).nullable().optional(),
  PROS_SUM_ASSURED: z.number().positive('Sum Assured must be greater than 0'),
  PROS_PREMIUM: z.number().nullable().optional(),
  riders: z.array(riderInputSchema).optional().default([])
});

const updateQuoteSchema = z.object({
  PROS_FULL_NAME: z.string().min(1, 'Prospect full name is required').max(200),
  PROS_DOB: z.string().nullable().optional(),
  PROS_AGE: z.number().min(0).max(120).nullable().optional(),
  PROS_GENDER: z.enum(['M', 'F', 'O']).optional().default('M'),
  PROS_ANN_SALARY: z.number().nullable().optional(),
  PROS_PLAN: z.string().min(1, 'Plan code is required').max(20),
  PROS_TERM: z.number().min(1).max(100).nullable().optional(),
  PROS_SUM_ASSURED: z.number().positive('Sum Assured must be greater than 0'),
  PROS_PREMIUM: z.number().nullable().optional(),
  riders: z.array(riderInputSchema).optional()
});

const calculateSchema = z.object({
  PROS_PLAN: z.string().min(1),
  PROS_AGE: z.number().min(0).max(120),
  PROS_GENDER: z.string().optional().default('M'),
  PROS_TERM: z.number().min(1).max(100),
  PROS_SUM_ASSURED: z.number().positive(),
  riders: z.array(z.object({
    PRIDER_CODE: z.string().min(1),
    PRIDER_SUM_ASSURED: z.number().nonnegative()
  })).optional().default([])
});

export const quoteController = {
  /**
   * GET /api/quotes
   */
  async getQuotes(req: Request, res: Response): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const plan = req.query.plan as string | undefined;

      const quotes = await quoteRepository.findAll(search, plan);
      res.json({
        success: true,
        count: quotes.length,
        quotes
      });
    } catch (error: any) {
      console.error('Error in getQuotes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve quotes from TBL_PROSPECTS',
        error: error.message
      });
    }
  },

  /**
   * GET /api/quotes/:id
   */
  async getQuoteById(req: Request, res: Response): Promise<void> {
    try {
      const prosUid = parseInt(req.params.id, 10);
      if (isNaN(prosUid)) {
        res.status(400).json({
          success: false,
          message: 'Invalid Quote ID parameter'
        });
        return;
      }

      const quote = await quoteRepository.findByUid(prosUid);
      if (!quote) {
        res.status(404).json({
          success: false,
          message: `Quote with ID #${prosUid} not found`
        });
        return;
      }

      res.json({
        success: true,
        quote
      });
    } catch (error: any) {
      console.error('Error in getQuoteById:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve quote details',
        error: error.message
      });
    }
  },

  /**
   * POST /api/quotes
   */
  async createQuote(req: Request, res: Response): Promise<void> {
    try {
      const parseResult = createQuoteSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          message: 'Validation failed for quote data',
          errors: parseResult.error.format()
        });
        return;
      }

      const username = (req as any).user?.username || 'admin';
      const created = await quoteRepository.create(parseResult.data, username);

      res.status(201).json({
        success: true,
        message: `Quick Quote #${created.PROS_UID} created successfully for ${created.PROS_FULL_NAME}`,
        quote: created
      });
    } catch (error: any) {
      console.error('Error in createQuote:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create quick quote in database',
        error: error.message
      });
    }
  },

  /**
   * PUT /api/quotes/:id
   */
  async updateQuote(req: Request, res: Response): Promise<void> {
    try {
      const prosUid = parseInt(req.params.id, 10);
      if (isNaN(prosUid)) {
        res.status(400).json({
          success: false,
          message: 'Invalid Quote ID parameter'
        });
        return;
      }

      const parseResult = updateQuoteSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          message: 'Validation failed for quote data',
          errors: parseResult.error.format()
        });
        return;
      }

      const existing = await quoteRepository.findByUid(prosUid);
      if (!existing) {
        res.status(404).json({
          success: false,
          message: `Quote with ID #${prosUid} not found`
        });
        return;
      }

      const username = (req as any).user?.username || 'admin';
      const updated = await quoteRepository.update(prosUid, parseResult.data, username);

      res.json({
        success: true,
        message: `Quick Quote #${prosUid} successfully updated`,
        quote: updated
      });
    } catch (error: any) {
      console.error('Error in updateQuote:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update quote in database',
        error: error.message
      });
    }
  },

  /**
   * DELETE /api/quotes/:id
   */
  async deleteQuote(req: Request, res: Response): Promise<void> {
    try {
      const prosUid = parseInt(req.params.id, 10);
      if (isNaN(prosUid)) {
        res.status(400).json({
          success: false,
          message: 'Invalid Quote ID parameter'
        });
        return;
      }

      const existing = await quoteRepository.findByUid(prosUid);
      if (!existing) {
        res.status(404).json({
          success: false,
          message: `Quote with ID #${prosUid} not found`
        });
        return;
      }

      const deleted = await quoteRepository.delete(prosUid);
      if (deleted) {
        res.json({
          success: true,
          message: `Quote #${prosUid} and its attached riders were deleted successfully`
        });
      } else {
        res.status(500).json({
          success: false,
          message: `Failed to delete quote #${prosUid}`
        });
      }
    } catch (error: any) {
      console.error('Error in deleteQuote:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete quote',
        error: error.message
      });
    }
  },

  /**
   * POST /api/quotes/calculate
   * Premium Calculation Engine hook.
   * Currently calculates indicative actuarial life premium based on Sum Assured, Age, Term, and Riders.
   * Ready to delegate to Oracle DB package procedures once supplied.
   */
  async calculatePremium(req: Request, res: Response): Promise<void> {
    try {
      const parseResult = calculateSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          message: 'Invalid premium calculation parameters',
          errors: parseResult.error.format()
        });
        return;
      }

      const { PROS_AGE, PROS_TERM, PROS_SUM_ASSURED, riders } = parseResult.data;

      // Base actuarial rate calculation (e.g., per 1,000 Sum Assured)
      // Rate factor increases with age and term
      const baseRatePerThousand = Math.max(1.5, (PROS_AGE * 0.12) + (PROS_TERM * 0.05));
      const basicPremium = Math.round(((PROS_SUM_ASSURED / 1000) * baseRatePerThousand) * 100) / 100;

      // Rider premiums
      const riderPremiums = (riders || []).map((r) => {
        // Indicative rider rate ~ 0.45 per 1,000 SA
        const riderRate = 0.45;
        const premium = Math.round(((r.PRIDER_SUM_ASSURED / 1000) * riderRate) * 100) / 100;
        return {
          riderCode: r.PRIDER_CODE,
          premium
        };
      });

      const totalRiderPremium = riderPremiums.reduce((sum, r) => sum + r.premium, 0);
      const totalAnnual = Math.round((basicPremium + totalRiderPremium) * 100) / 100;

      // Standard life modal frequency factors:
      // Semi-Annual: 52% of Annual
      // Quarterly: 26.5% of Annual
      // Monthly: 8.8% of Annual
      const calculationResult: PremiumCalculationResponse = {
        basicPremium,
        riderPremiums,
        totalPremium: totalAnnual,
        modalPremiums: {
          annual: totalAnnual,
          semiAnnual: Math.round(totalAnnual * 0.52 * 100) / 100,
          quarterly: Math.round(totalAnnual * 0.265 * 100) / 100,
          monthly: Math.round(totalAnnual * 0.088 * 100) / 100
        },
        note: 'Indicative actuarial calculation. Oracle DB package procedure hook ready for integration.'
      };

      res.json({
        success: true,
        calculation: calculationResult
      });
    } catch (error: any) {
      console.error('Error in calculatePremium:', error);
      res.status(500).json({
        success: false,
        message: 'Error calculating premium',
        error: error.message
      });
    }
  }
};
