import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { tariffRepository } from '../repositories/tariffRepository';

// --- ZOD SCHEMAS ---

const createParamSchema = z.object({
  paramSrNo: z.number().int().optional(),
  paramCode: z.string().min(1, 'Parameter Code is required').max(40),
  paramDescription: z.string().min(1, 'Parameter Description is required').max(200),
  dataType: z.enum(['N', 'C', 'D']).default('N'),
  tableName: z.string().max(100).optional().nullable(),
  columnName: z.string().max(100).optional().nullable(),
  whereCond: z.string().max(1000).optional().nullable()
});

const updateParamSchema = z.object({
  paramDescription: z.string().min(1).max(200).optional(),
  dataType: z.enum(['N', 'C', 'D']).optional(),
  tableName: z.string().max(100).optional().nullable(),
  columnName: z.string().max(100).optional().nullable(),
  whereCond: z.string().max(1000).optional().nullable()
});

const createHeadSchema = z.object({
  mthCode: z.string().min(1, 'Tariff Code is required').max(20),
  mthType: z.string().min(1, 'Tariff Type is required').max(20),
  mthDesc: z.string().min(1, 'Description is required').max(200),
  mthShortDesc: z.string().max(200).optional().nullable(),
  params: z.array(z.string().nullable()).max(10).default([]),
  ratePer: z.string().max(40).default('1000'),
  effFromDate: z.string().optional().nullable(),
  effToDate: z.string().optional().nullable()
});

const updateHeadSchema = z.object({
  mthDesc: z.string().min(1).max(200).optional(),
  mthShortDesc: z.string().max(200).optional().nullable(),
  params: z.array(z.string().nullable()).max(10).optional(),
  ratePer: z.string().max(40).optional(),
  effFromDate: z.string().optional().nullable(),
  effToDate: z.string().optional().nullable()
});

const detailParamBandSchema = z.object({
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional()
});

const createDetailSchema = z.object({
  mthCode: z.string().min(1).max(20),
  mthType: z.string().min(1).max(20),
  params: z.array(detailParamBandSchema).max(10),
  rate: z.string().min(1, 'Tariff Rate is required').max(200),
  effFromDate: z.string().optional().nullable(),
  effToDate: z.string().optional().nullable()
});

const updateDetailSchema = z.object({
  params: z.array(detailParamBandSchema).max(10).optional(),
  rate: z.string().min(1).max(200).optional(),
  effFromDate: z.string().optional().nullable(),
  effToDate: z.string().optional().nullable()
});

export class TariffController {
  // =========================================================================
  // PARAMETERS
  // =========================================================================

  async listParams(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = await tariffRepository.getParams();
      res.status(200).json({ success: true, data: { params } });
    } catch (err) {
      next(err);
    }
  }

  async createParam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createParamSchema.parse(req.body);
      const user = (req as any).user?.userId || 'ADMIN';
      const created = await tariffRepository.createParam({
        ...parsed,
        createdBy: user
      });
      res.status(201).json({
        success: true,
        message: `Parameter '${created.paramCode}' registered successfully.`,
        data: { param: created }
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, message: err.errors.map((e) => e.message).join(', ') });
        return;
      }
      next(err);
    }
  }

  async updateParam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramCode = req.params.paramCode;
      const parsed = updateParamSchema.parse(req.body);
      const user = (req as any).user?.userId || 'ADMIN';
      const updated = await tariffRepository.updateParam(paramCode, {
        ...parsed,
        modifiedBy: user
      });
      res.status(200).json({
        success: true,
        message: `Parameter '${paramCode}' updated.`,
        data: { param: updated }
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, message: err.errors.map((e) => e.message).join(', ') });
        return;
      }
      next(err);
    }
  }

  async deleteParam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramCode = req.params.paramCode;
      await tariffRepository.deleteParam(paramCode);
      res.status(200).json({
        success: true,
        message: `Parameter '${paramCode}' deleted.`
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // HEADERS
  // =========================================================================

  async listHeaders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const type = req.query.type as string | undefined;
      const headers = await tariffRepository.getHeaders(search, type);
      res.status(200).json({ success: true, data: { headers } });
    } catch (err) {
      next(err);
    }
  }

  async getHeader(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, type } = req.params;
      const header = await tariffRepository.getHeader(code, type);
      if (!header) {
        res.status(404).json({ success: false, message: `Tariff '${code}' not found.` });
        return;
      }
      res.status(200).json({ success: true, data: { header } });
    } catch (err) {
      next(err);
    }
  }

  async createHeader(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createHeadSchema.parse(req.body);

      // Check if header already exists
      const existing = await tariffRepository.getHeader(parsed.mthCode.trim(), parsed.mthType.trim());
      if (existing) {
        res.status(409).json({
          success: false,
          message: `Tariff Header with Code '${parsed.mthCode}' and Type '${parsed.mthType}' already exists.`
        });
        return;
      }

      const user = (req as any).user?.userId || 'ADMIN';
      const created = await tariffRepository.createHeader({
        ...parsed,
        createdBy: user
      });

      res.status(201).json({
        success: true,
        message: `Tariff Matrix '${created.mthCode}' created successfully.`,
        data: { header: created }
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, message: err.errors.map((e) => e.message).join(', ') });
        return;
      }
      next(err);
    }
  }

  async updateHeader(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, type } = req.params;
      const parsed = updateHeadSchema.parse(req.body);
      const user = (req as any).user?.userId || 'ADMIN';
      const updated = await tariffRepository.updateHeader(code, type, {
        ...parsed,
        modifiedBy: user
      });
      res.status(200).json({
        success: true,
        message: `Tariff '${code}' updated successfully.`,
        data: { header: updated }
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, message: err.errors.map((e) => e.message).join(', ') });
        return;
      }
      next(err);
    }
  }

  async deleteHeader(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, type } = req.params;
      await tariffRepository.deleteHeader(code, type);
      res.status(200).json({
        success: true,
        message: `Tariff '${code}' and its rate details deleted successfully.`
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // DETAILS
  // =========================================================================

  async listDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const mthCode = req.query.mthCode as string;
      const mthType = req.query.mthType as string;

      if (!mthCode || !mthType) {
        res.status(400).json({ success: false, message: 'mthCode and mthType query parameters are required.' });
        return;
      }

      const details = await tariffRepository.getDetails(mthCode, mthType);
      res.status(200).json({ success: true, data: { details } });
    } catch (err) {
      next(err);
    }
  }

  async createDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createDetailSchema.parse(req.body);
      const user = (req as any).user?.userId || 'ADMIN';
      const created = await tariffRepository.createDetail({
        ...parsed,
        createdBy: user
      });

      res.status(201).json({
        success: true,
        message: 'Rate band added successfully.',
        data: { detail: created }
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, message: err.errors.map((e) => e.message).join(', ') });
        return;
      }
      next(err);
    }
  }

  async updateDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const detailId = req.params.detailId;
      const parsed = updateDetailSchema.parse(req.body);
      const user = (req as any).user?.userId || 'ADMIN';

      await tariffRepository.updateDetail(detailId, {
        ...parsed,
        modifiedBy: user
      });

      res.status(200).json({
        success: true,
        message: 'Rate band updated successfully.'
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, message: err.errors.map((e) => e.message).join(', ') });
        return;
      }
      next(err);
    }
  }

  async deleteDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const detailId = req.params.detailId;
      await tariffRepository.deleteDetail(detailId);
      res.status(200).json({
        success: true,
        message: 'Rate band deleted successfully.'
      });
    } catch (err) {
      next(err);
    }
  }
}

export const tariffController = new TariffController();
