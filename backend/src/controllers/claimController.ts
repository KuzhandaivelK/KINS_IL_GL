import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { claimRepository } from '../repositories/claimRepository';

const DEFAULT_CLAIM_DOC_DIR = path.resolve(process.cwd(), 'uploads', 'claims');

async function resolveClaimUploadDir(): Promise<string> {
  const configuredPath = await claimRepository.getClaimDocStoragePath();
  const targetDir = configuredPath ? path.resolve(configuredPath) : DEFAULT_CLAIM_DOC_DIR;
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  return targetDir;
}

export const claimController = {
  async listClaims(req: Request, res: Response) {
    try {
      const { status, lobType, claimType, search } = req.query;
      const claims = await claimRepository.findAll({
        status: status ? String(status) : undefined,
        lobType: lobType ? String(lobType) : undefined,
        claimType: claimType ? String(claimType) : undefined,
        search: search ? String(search) : undefined
      });
      return res.status(200).json({ success: true, count: claims.length, data: claims });
    } catch (err: any) {
      console.error('List claims error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to fetch claims' });
    }
  },

  async lookupPolicy(req: Request, res: Response) {
    try {
      const { polNo } = req.params;
      const policy = await claimRepository.lookupPolicyForClaim(polNo);
      if (!policy) {
        return res.status(404).json({ success: false, message: `Policy ${polNo} not found in Individual or Group Life register` });
      }
      return res.status(200).json({ success: true, data: policy });
    } catch (err: any) {
      console.error('Lookup policy for claim error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to lookup policy' });
    }
  },

  async registerFnol(req: Request, res: Response) {
    try {
      const user = (req as any).user?.userId || (req as any).user?.username || 'ADMIN';
      const detail = await claimRepository.registerFnol(req.body, user);
      return res.status(201).json({
        success: true,
        message: `FNOL registered successfully. Claim Number: ${detail.master.CLAIM_NO}`,
        data: detail
      });
    } catch (err: any) {
      console.error('Register FNOL error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to register FNOL' });
    }
  },

  async getClaimDetail(req: Request, res: Response) {
    try {
      const { claimNo } = req.params;
      const detail = await claimRepository.findByClaimNo(claimNo);
      if (!detail) {
        return res.status(404).json({ success: false, message: `Claim ${claimNo} not found` });
      }
      return res.status(200).json({ success: true, data: detail });
    } catch (err: any) {
      console.error('Get claim detail error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to fetch claim details' });
    }
  },

  async assessClaim(req: Request, res: Response) {
    try {
      const { claimNo } = req.params;
      const user = (req as any).user?.userId || (req as any).user?.username || 'ASSESSOR';
      const detail = await claimRepository.assessClaim(claimNo, req.body, user);
      return res.status(200).json({
        success: true,
        message: `Claim ${claimNo} assessed via PKG_CLAIMS.SP_ASSESS_CLAIM. Net Payable: ${detail.assessment?.NET_PAYABLE_AMOUNT ?? 0}`,
        data: detail
      });
    } catch (err: any) {
      console.error('Assess claim error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to assess claim' });
    }
  },

  async approveClaim(req: Request, res: Response) {
    try {
      const { claimNo } = req.params;
      const user = (req as any).user?.userId || (req as any).user?.username || 'CLAIMS_MGR';
      const detail = await claimRepository.updateClaimDecision(claimNo, 'APPROVED', req.body?.remarks || '', user);
      return res.status(200).json({
        success: true,
        message: `Claim ${claimNo} approved and ready for settlement.`,
        data: detail
      });
    } catch (err: any) {
      console.error('Approve claim error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to approve claim' });
    }
  },

  async rejectClaim(req: Request, res: Response) {
    try {
      const { claimNo } = req.params;
      const user = (req as any).user?.userId || (req as any).user?.username || 'CLAIMS_MGR';
      const detail = await claimRepository.updateClaimDecision(claimNo, 'REJECTED', req.body?.remarks || 'Rejected by Claims Committee', user);
      return res.status(200).json({
        success: true,
        message: `Claim ${claimNo} rejected.`,
        data: detail
      });
    } catch (err: any) {
      console.error('Reject claim error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to reject claim' });
    }
  },

  async settleClaim(req: Request, res: Response) {
    try {
      const { claimNo } = req.params;
      const user = (req as any).user?.userId || (req as any).user?.username || 'CLAIMS_MGR';
      const result = await claimRepository.settleClaim(claimNo, req.body, user);
      return res.status(200).json({
        success: true,
        message: `Claim ${claimNo} settled (${result.settlementNo}) & GL Voucher ${result.voucherNo} posted successfully.`,
        data: result.detail,
        settlementNo: result.settlementNo,
        voucherNo: result.voucherNo,
        settledAmount: result.settledAmount
      });
    } catch (err: any) {
      console.error('Settle claim error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to settle claim' });
    }
  },

  async uploadDocument(req: Request, res: Response) {
    try {
      const { claimNo } = req.params;
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ success: false, message: 'Please attach a claim document file.' });
      }
      const docType = String(req.body.docType || 'CLAIM_FORM').trim();
      const remarks = req.body.remarks ? String(req.body.remarks).trim() : undefined;
      const user = (req as any).user?.userId || (req as any).user?.username || 'ADMIN';

      const targetDir = await resolveClaimUploadDir();
      const ext = path.extname(req.file.originalname) || '';
      const storedFileName = `CLM_${claimNo.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
      const fullPath = path.join(targetDir, storedFileName);
      fs.writeFileSync(fullPath, req.file.buffer);

      const saved = await claimRepository.addClaimDocument({
        claimNo,
        docType,
        fileName: req.file.originalname,
        storedFileName,
        filePath: fullPath,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        remarks,
        user
      });

      return res.status(201).json({
        success: true,
        message: `Document "${req.file.originalname}" uploaded for ${claimNo}.`,
        data: saved
      });
    } catch (err: any) {
      console.error('Upload claim document error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to upload claim document' });
    }
  },

  async downloadDocument(req: Request, res: Response) {
    try {
      const docId = Number(req.params.docId);
      const doc = await claimRepository.getClaimDocumentById(docId);
      if (!doc) {
        return res.status(404).json({ success: false, message: 'Claim document not found' });
      }
      if (!fs.existsSync(doc.FILE_PATH)) {
        return res.status(404).json({ success: false, message: 'Stored claim document file not found on server' });
      }
      res.setHeader('Content-Type', doc.MIME_TYPE || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.FILE_NAME)}"`);
      return res.sendFile(doc.FILE_PATH);
    } catch (err: any) {
      console.error('Download claim document error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to download claim document' });
    }
  },

  async deleteDocument(req: Request, res: Response) {
    try {
      const docId = Number(req.params.docId);
      await claimRepository.deleteClaimDocument(docId);
      return res.status(200).json({ success: true, message: 'Claim document deleted.' });
    } catch (err: any) {
      console.error('Delete claim document error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to delete claim document' });
    }
  }
};
