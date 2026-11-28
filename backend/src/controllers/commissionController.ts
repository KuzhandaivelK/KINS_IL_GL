import { Request, Response, NextFunction } from 'express';
import { commissionRepository } from '../repositories/commissionRepository';

function extractOracleMessage(err: any): { status: number; message: string } {
  const msg = String(err?.message || 'Unexpected error');
  const oraMatch = msg.match(/ORA-205\d\d:\s*([^\n]+)/);
  if (oraMatch) {
    return { status: 400, message: oraMatch[1].trim() };
  }
  if (msg.includes('ORA-00001')) {
    return { status: 409, message: 'A record with this code already exists.' };
  }
  return { status: 500, message: msg };
}

export const commissionController = {
  async listChannels(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await commissionRepository.listChannels();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async saveChannel(req: Request, res: Response, next: NextFunction) {
    try {
      const { channelCode, channelName, supportsHierarchyYn, description } = req.body;
      if (!channelCode || !channelName) {
        res.status(400).json({ success: false, message: 'Channel Code and Channel Name are required.' });
        return;
      }
      const user = (req as any).user?.userId || 'ADMIN';
      const data = await commissionRepository.saveChannel(
        {
          channelCode,
          channelName,
          supportsHierarchyYn: supportsHierarchyYn === 'Y' ? 'Y' : 'N',
          description
        },
        user
      );
      res.json({ success: true, data });
    } catch (err: any) {
      const mapped = extractOracleMessage(err);
      if (mapped.status !== 500) {
        res.status(mapped.status).json({ success: false, message: mapped.message });
        return;
      }
      next(err);
    }
  },

  async listIntermediaries(req: Request, res: Response, next: NextFunction) {
    try {
      const channelCode = req.query.channelCode as string | undefined;
      const data = await commissionRepository.listIntermediaries(channelCode);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async saveIntermediary(req: Request, res: Response, next: NextFunction) {
    try {
      const { intermediaryCode, intermediaryName, channelCode, hierarchyLevel } = req.body;
      if (!intermediaryCode || !intermediaryName || !channelCode || !hierarchyLevel) {
        res.status(400).json({
          success: false,
          message: 'Intermediary Code, Name, Channel, and Hierarchy Level are required.'
        });
        return;
      }
      const user = (req as any).user?.userId || 'ADMIN';
      const data = await commissionRepository.saveIntermediary(req.body, user);
      res.json({ success: true, data });
    } catch (err: any) {
      const mapped = extractOracleMessage(err);
      if (mapped.status !== 500) {
        res.status(mapped.status).json({ success: false, message: mapped.message });
        return;
      }
      next(err);
    }
  },

  async listStructures(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await commissionRepository.listStructures();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async saveStructure(req: Request, res: Response, next: NextFunction) {
    try {
      const { structCode, structName, channelCode, prodCode, effectiveFrom, effectiveTo, tiers } = req.body;
      if (!structCode || !structName || !channelCode || !prodCode || !effectiveFrom || !effectiveTo) {
        res.status(400).json({
          success: false,
          message: 'Structure Code, Name, Channel, Product, and Effective Dates are required.'
        });
        return;
      }
      if (!Array.isArray(tiers) || tiers.length === 0) {
        res.status(400).json({ success: false, message: 'At least one commission percentage tier is required.' });
        return;
      }
      const user = (req as any).user?.userId || 'ADMIN';
      const data = await commissionRepository.saveStructure(req.body, user);
      res.json({ success: true, data });
    } catch (err: any) {
      const mapped = extractOracleMessage(err);
      if (mapped.status !== 500) {
        res.status(mapped.status).json({ success: false, message: mapped.message });
        return;
      }
      next(err);
    }
  },

  async deleteStructure(req: Request, res: Response, next: NextFunction) {
    try {
      const structId = Number(req.params.id);
      const user = (req as any).user?.userId || 'ADMIN';
      await commissionRepository.deleteStructure(structId, user);
      res.json({ success: true, message: 'Commission structure deactivated.' });
    } catch (err) {
      next(err);
    }
  },

  async listProductsAndCovers(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await commissionRepository.listProductsAndCovers();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async listEligiblePolicies(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await commissionRepository.listEligiblePolicies();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async calculatePolicyCommission(req: Request, res: Response, next: NextFunction) {
    try {
      const { polNo, lobType, intermediaryId, premType } = req.body;
      if (!polNo || !intermediaryId) {
        res.status(400).json({ success: false, message: 'Policy Number and Intermediary are required.' });
        return;
      }
      const user = (req as any).user?.userId || 'ADMIN';
      const result = await commissionRepository.calculatePolicyCommission(
        {
          polNo,
          lobType: lobType || 'IL',
          intermediaryId: Number(intermediaryId),
          premType: premType || 'FY'
        },
        user
      );
      const detail = await commissionRepository.getPolicyCommissionDetail(result.commNo);
      res.json({ success: true, data: detail, summary: result });
    } catch (err: any) {
      const mapped = extractOracleMessage(err);
      if (mapped.status !== 500) {
        res.status(mapped.status).json({ success: false, message: mapped.message });
        return;
      }
      next(err);
    }
  },

  async listPolicyCommissions(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await commissionRepository.listPolicyCommissions({
        channelCode: req.query.channelCode as string | undefined,
        lobType: req.query.lobType as string | undefined,
        status: req.query.status as string | undefined,
        polNo: req.query.polNo as string | undefined
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getPolicyCommissionDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await commissionRepository.getPolicyCommissionDetail(req.params.commNo);
      if (!data) {
        res.status(404).json({ success: false, message: 'Policy commission record not found.' });
        return;
      }
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async approveCommission(req: Request, res: Response, next: NextFunction) {
    try {
      const commNo = req.params.commNo;
      const remarks = req.body?.remarks || '';
      const user = (req as any).user?.userId || 'ADMIN';
      const result = await commissionRepository.approveCommission(commNo, remarks, user);
      const detail = await commissionRepository.getPolicyCommissionDetail(commNo);
      res.json({ success: true, voucherNo: result.voucherNo, data: detail });
    } catch (err: any) {
      const mapped = extractOracleMessage(err);
      if (mapped.status !== 500) {
        res.status(mapped.status).json({ success: false, message: mapped.message });
        return;
      }
      next(err);
    }
  }
};
