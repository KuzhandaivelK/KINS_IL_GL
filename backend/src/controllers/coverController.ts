import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { coverRepository } from '../repositories/coverRepository';

const createCoverSchema = z.object({
  coverCode: z.string().min(1, 'Cover Code is required').max(20, 'Cover Code cannot exceed 20 characters'),
  coverDesc: z.string().min(1, 'Cover Description is required').max(200),
  coverL1Desc: z.string().max(200).optional().nullable(),
  coverType: z.string().max(1).optional().nullable(),
  activeYn: z.enum(['Y', 'N']).default('Y'),
  appOnBasicRate: z.enum(['Y', 'N']).default('N'),
  fromDate: z.string().optional().nullable(),
  toDate: z.string().optional().nullable(),
  minSa: z.number().min(0).optional().nullable(),
  maxSa: z.number().min(0).optional().nullable(),
  rateAppliedOn: z.string().max(3).optional().nullable(),
  saPerc: z.number().min(0).max(100).optional().nullable(),
  saCalc: z.string().max(1).optional().nullable(),
  coverLob: z.enum(['IL', 'GL', 'BOTH']).optional().default('IL')
});

const updateCoverSchema = z.object({
  coverDesc: z.string().min(1).max(200).optional(),
  coverL1Desc: z.string().max(200).optional().nullable(),
  coverType: z.string().max(1).optional().nullable(),
  activeYn: z.enum(['Y', 'N']).optional(),
  appOnBasicRate: z.enum(['Y', 'N']).optional(),
  fromDate: z.string().optional().nullable(),
  toDate: z.string().optional().nullable(),
  minSa: z.number().min(0).optional().nullable(),
  maxSa: z.number().min(0).optional().nullable(),
  rateAppliedOn: z.string().max(3).optional().nullable(),
  saPerc: z.number().min(0).max(100).optional().nullable(),
  saCalc: z.string().max(1).optional().nullable(),
  coverLob: z.enum(['IL', 'GL', 'BOTH']).optional()
});

export class CoverController {
  /**
   * GET /api/covers/types
   * Returns list of cover types from STBL_CODE where CODE = 'CVR_TYPE'
   */
  async getCoverTypes(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const types = await coverRepository.getCoverTypes();
      res.status(200).json({
        success: true,
        data: { types }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/covers
   * Returns all covers with optional search and type filter
   */
  async listCovers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const type = req.query.type as string | undefined;
      const activeOnly = req.query.activeOnly === 'true';
      const lob = req.query.lob as string | undefined;

      const covers = await coverRepository.findAll(search, type, activeOnly, lob);
      res.status(200).json({
        success: true,
        data: { covers }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/covers/:coverCode
   */
  async getCover(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const coverCode = req.params.coverCode;
      const cover = await coverRepository.findByCode(coverCode);

      if (!cover) {
        res.status(404).json({
          success: false,
          message: `Cover '${coverCode}' not found.`
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { cover }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/covers
   */
  async createCover(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createCoverSchema.parse(req.body);

      // Check if cover code already exists
      const existing = await coverRepository.findByCode(parsed.coverCode.trim());
      if (existing) {
        res.status(409).json({
          success: false,
          message: `Cover with Code '${parsed.coverCode}' already exists in MTBL_COVER.`
        });
        return;
      }

      const creator = (req as any).user?.userId || 'ADMIN';
      const created = await coverRepository.create({
        ...parsed,
        createdBy: creator
      });

      res.status(201).json({
        success: true,
        message: `Cover '${created.coverCode}' created successfully.`,
        data: { cover: created }
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: err.errors.map((e) => e.message).join(', ')
        });
        return;
      }
      next(err);
    }
  }

  /**
   * PUT /api/covers/:coverCode
   */
  async updateCover(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const coverCode = req.params.coverCode;
      const parsed = updateCoverSchema.parse(req.body);

      const existing = await coverRepository.findByCode(coverCode);
      if (!existing) {
        res.status(404).json({
          success: false,
          message: `Cover '${coverCode}' not found.`
        });
        return;
      }

      const modifier = (req as any).user?.userId || 'ADMIN';
      const updated = await coverRepository.update(coverCode, {
        ...parsed,
        modifiedBy: modifier
      });

      res.status(200).json({
        success: true,
        message: `Cover '${coverCode}' updated successfully.`,
        data: { cover: updated }
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: err.errors.map((e) => e.message).join(', ')
        });
        return;
      }
      next(err);
    }
  }

  /**
   * DELETE /api/covers/:coverCode
   */
  async deleteCover(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const coverCode = req.params.coverCode;

      const existing = await coverRepository.findByCode(coverCode);
      if (!existing) {
        res.status(404).json({
          success: false,
          message: `Cover '${coverCode}' not found.`
        });
        return;
      }

      await coverRepository.delete(coverCode);

      res.status(200).json({
        success: true,
        message: `Cover '${coverCode}' deleted successfully.`
      });
    } catch (err) {
      next(err);
    }
  }
}

export const coverController = new CoverController();
