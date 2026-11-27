import { Request, Response } from 'express';
import { reinsuranceRepository } from '../repositories/reinsuranceRepository';

export const reinsuranceController = {
  async listTreaties(_req: Request, res: Response) {
    try {
      const treaties = await reinsuranceRepository.listTreaties();
      return res.status(200).json({ success: true, data: treaties });
    } catch (err: any) {
      console.error('List RI treaties error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to fetch treaties' });
    }
  },

  async saveTreaty(req: Request, res: Response) {
    try {
      const user = (req as any).user?.userId || (req as any).user?.username || 'RIUSER';
      const saved = await reinsuranceRepository.saveTreaty(req.body, user);
      return res.status(201).json({
        success: true,
        message: `Treaty ${saved.TREATY_CODE} saved successfully with ${saved.layers?.length || 0} layers.`,
        data: saved
      });
    } catch (err: any) {
      console.error('Save RI treaty error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to save treaty' });
    }
  },

  async listEligiblePolicies(_req: Request, res: Response) {
    try {
      const policies = await reinsuranceRepository.listEligiblePolicies();
      return res.status(200).json({ success: true, data: policies });
    } catch (err: any) {
      console.error('List eligible RI policies error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to load policies' });
    }
  },

  async listAllocations(req: Request, res: Response) {
    try {
      const { status, lobType, search } = req.query;
      const allocations = await reinsuranceRepository.listAllocations({
        status: status ? String(status) : undefined,
        lobType: lobType ? String(lobType) : undefined,
        search: search ? String(search) : undefined
      });
      return res.status(200).json({ success: true, data: allocations });
    } catch (err: any) {
      console.error('List RI allocations error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to fetch RI allocations' });
    }
  },

  async allocatePolicy(req: Request, res: Response) {
    try {
      const user = (req as any).user?.userId || (req as any).user?.username || 'RIUSER';
      const detail = await reinsuranceRepository.allocatePolicyRi(req.body, user);
      return res.status(201).json({
        success: true,
        message: `RI Allocation ${detail.allocation.ALLOC_NO} generated via PKG_REINSURANCE.SP_ALLOCATE_POLICY_RI (Pending RI Approval).`,
        data: detail
      });
    } catch (err: any) {
      console.error('Allocate Policy RI error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to allocate policy RI' });
    }
  },

  async getAllocationDetail(req: Request, res: Response) {
    try {
      const { allocNo } = req.params;
      const detail = await reinsuranceRepository.findAllocationByNo(allocNo);
      if (!detail) {
        return res.status(404).json({ success: false, message: `RI Allocation ${allocNo} not found` });
      }
      return res.status(200).json({ success: true, data: detail });
    } catch (err: any) {
      console.error('Get RI allocation detail error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to fetch RI allocation' });
    }
  },

  async approveAllocation(req: Request, res: Response) {
    try {
      const { allocNo } = req.params;
      const user = (req as any).user?.userId || (req as any).user?.username || 'RIUSER';
      const userGroup = ((req as any).user?.userGroup || 'ADMIN').toUpperCase();
      if (userGroup !== 'RIUSER' && userGroup !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: `Only RIUSER or ADMIN can authorize Reinsurance allocations (your group: ${userGroup}).`
        });
      }
      const { detail, voucherNo } = await reinsuranceRepository.approveAllocation(
        allocNo,
        req.body?.remarks || '',
        user
      );
      return res.status(200).json({
        success: true,
        message:
          voucherNo === 'NO_CESSION'
            ? `RI Allocation ${allocNo} approved (100% retained, no cession GL required).`
            : `RI Allocation ${allocNo} approved & GL Voucher ${voucherNo} posted.`,
        data: detail,
        voucherNo
      });
    } catch (err: any) {
      console.error('Approve RI allocation error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to approve RI allocation' });
    }
  },

  async rejectAllocation(req: Request, res: Response) {
    try {
      const { allocNo } = req.params;
      const user = (req as any).user?.userId || (req as any).user?.username || 'RIUSER';
      const detail = await reinsuranceRepository.rejectAllocation(allocNo, req.body?.remarks || '', user);
      return res.status(200).json({
        success: true,
        message: `RI Allocation ${allocNo} rejected.`,
        data: detail
      });
    } catch (err: any) {
      console.error('Reject RI allocation error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to reject RI allocation' });
    }
  }
};
