import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { groupLifeRepository } from '../repositories/groupLifeRepository';
import {
  parseMemberFileBuffer,
  generateSampleExcelBuffer,
  generateSampleCsvString
} from '../utils/memberUploadParser';

const EOI_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'eoi');
if (!fs.existsSync(EOI_UPLOAD_DIR)) {
  fs.mkdirSync(EOI_UPLOAD_DIR, { recursive: true });
}

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
  },

  /**
   * Download sample member census upload template (.xlsx or .csv)
   */
  async downloadMemberTemplate(req: Request, res: Response) {
    try {
      const format = String(req.query.format || 'xlsx').toLowerCase();
      if (format === 'csv') {
        const csvContent = generateSampleCsvString();
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="gl_member_census_template.csv"');
        return res.status(200).send(csvContent);
      } else {
        const buffer = generateSampleExcelBuffer();
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', 'attachment; filename="gl_member_census_template.xlsx"');
        return res.status(200).send(buffer);
      }
    } catch (err: any) {
      console.error('Download template error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to generate member template'
      });
    }
  },

  /**
   * Parse uploaded member census file (CSV or Excel) for quotation / census wizard
   */
  async parseMemberFile(req: Request, res: Response) {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded. Please upload a .csv, .xlsx, or .xls file.'
        });
      }

      const result = parseMemberFileBuffer(req.file.buffer, req.file.originalname);
      return res.status(200).json({
        success: true,
        message: `Successfully parsed ${result.totalRows} member rows (${result.validRowsCount} valid, ${result.errorRowsCount} invalid)`,
        data: result
      });
    } catch (err: any) {
      console.error('Parse member file error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to parse member upload file'
      });
    }
  },

  /**
   * Upload members directly to an active / pending GL Master Policy
   */
  async uploadPolicyMembers(req: Request, res: Response) {
    try {
      const { policyNo } = req.params;
      const user = (req as any).user?.username || 'POLICY_ADMIN';

      let membersToEnroll: Array<{
        EMP_ID?: string;
        MEMBER_NAME: string;
        DOB: string;
        AGE: number;
        GENDER: string;
        CATEGORY?: string;
        MONTHLY_SALARY?: number;
        ANNUAL_SALARY?: number;
        SUM_ASSURED: number;
        MEMBER_PREMIUM?: number;
      }> = [];

      // 1. If file uploaded
      if (req.file && req.file.buffer) {
        const parseResult = parseMemberFileBuffer(req.file.buffer, req.file.originalname);
        const validRows = parseResult.members.filter(m => m.status !== 'ERROR');
        if (validRows.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Uploaded file contains no valid member rows to enroll',
            data: parseResult
          });
        }
        membersToEnroll = validRows.map(m => ({
          EMP_ID: m.empId,
          MEMBER_NAME: m.memberName,
          DOB: m.dob,
          AGE: m.age,
          GENDER: m.gender,
          CATEGORY: m.category,
          MONTHLY_SALARY: m.monthlySalary,
          ANNUAL_SALARY: m.annualSalary,
          SUM_ASSURED: m.sumAssured || (m.annualSalary > 0 ? m.annualSalary * 3 : 50000)
        }));
      } else if (req.body.members && Array.isArray(req.body.members)) {
        // 2. If direct JSON array provided
        membersToEnroll = req.body.members;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Please provide either an uploaded file or a members array'
        });
      }

      if (membersToEnroll.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No member records found to enroll'
        });
      }

      const updatedPolicy = await groupLifeRepository.addPolicyMembers(
        policyNo,
        membersToEnroll,
        user
      );

      return res.status(200).json({
        success: true,
        message: `Successfully enrolled ${membersToEnroll.length} member(s) into Master Policy ${policyNo}`,
        data: updatedPolicy
      });
    } catch (err: any) {
      console.error('Upload Policy Members error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to upload members to policy'
      });
    }
  },

  /**
   * Get Member & Cover-wise Premium Breakdown for a GL Master Policy
   */
  async getPolicyMemberCovers(req: Request, res: Response) {
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
      console.error('Get GL Policy Member Covers error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch policy member cover-wise premiums'
      });
    }
  },

  /**
   * Get Member & Cover-wise Premium Breakdown for a GL Quote
   */
  async getQuoteMemberCovers(req: Request, res: Response) {
    try {
      const { quoteNo } = req.params;
      const detail = await groupLifeRepository.findQuoteByNo(quoteNo);
      if (!detail) {
        return res.status(404).json({
          success: false,
          message: `Group Life Quote ${quoteNo} not found`
        });
      }
      return res.status(200).json({
        success: true,
        data: detail
      });
    } catch (err: any) {
      console.error('Get GL Quote Member Covers error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch quote member cover-wise premiums'
      });
    }
  },

  /**
   * Update EOI Flag (Y/N) for a Policy Member and recalculate cover-wise premiums
   */
  async updatePolicyMemberEoi(req: Request, res: Response) {
    try {
      const { policyNo, memberId } = req.params;
      const { eoiFlag, eoiRemarks } = req.body;
      const user = (req as any).user?.username || 'UNDERWRITER';

      if (eoiFlag !== 'Y' && eoiFlag !== 'N') {
        return res.status(400).json({
          success: false,
          message: 'eoiFlag must be "Y" or "N"'
        });
      }

      const updated = await groupLifeRepository.updateMemberEoi(
        'POLICY',
        policyNo,
        Number(memberId),
        eoiFlag,
        eoiRemarks,
        user
      );

      return res.status(200).json({
        success: true,
        message:
          eoiFlag === 'Y'
            ? `EOI Approved: Full Sum Assured applied and cover-wise premiums recalculated for Member #${memberId}`
            : `EOI set to No: Sum Assured capped to Free Cover Limit (FCL) and premiums recalculated`,
        data: updated
      });
    } catch (err: any) {
      console.error('Update Policy Member EOI error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to update member EOI status'
      });
    }
  },

  /**
   * Update EOI Flag (Y/N) for a Quote Member and recalculate cover-wise premiums
   */
  async updateQuoteMemberEoi(req: Request, res: Response) {
    try {
      const { quoteNo, memberId } = req.params;
      const { eoiFlag, eoiRemarks } = req.body;
      const user = (req as any).user?.username || 'UNDERWRITER';

      if (eoiFlag !== 'Y' && eoiFlag !== 'N') {
        return res.status(400).json({
          success: false,
          message: 'eoiFlag must be "Y" or "N"'
        });
      }

      const updated = await groupLifeRepository.updateMemberEoi(
        'QUOTE',
        quoteNo,
        Number(memberId),
        eoiFlag,
        eoiRemarks,
        user
      );

      return res.status(200).json({
        success: true,
        message:
          eoiFlag === 'Y'
            ? `EOI Approved: Full Sum Assured applied and cover-wise premiums recalculated`
            : `EOI set to No: Sum Assured capped to Free Cover Limit (FCL) and premiums recalculated`,
        data: updated
      });
    } catch (err: any) {
      console.error('Update Quote Member EOI error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to update quote member EOI status'
      });
    }
  },

  /**
   * Upload EOI Supporting Document (Medical Declaration, Health Questionnaire, Lab Report, etc.)
   */
  async uploadEoiDocument(req: Request, res: Response) {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          message: 'Please attach a document file to upload.'
        });
      }

      const refType = String(req.body.refType || 'POLICY').toUpperCase() as 'QUOTE' | 'POLICY';
      const refNo = String(req.body.refNo || '').trim();
      const empId = String(req.body.empId || '').trim();
      const memberId = req.body.memberId ? Number(req.body.memberId) : null;
      const docType = String(req.body.docType || 'MEDICAL_DECLARATION').trim();
      const remarks = req.body.remarks ? String(req.body.remarks).trim() : undefined;
      const user = (req as any).user?.username || 'UNDERWRITER';

      if (!refNo || !empId) {
        return res.status(400).json({
          success: false,
          message: 'refNo (Policy/Quote No) and empId are required'
        });
      }

      if (!fs.existsSync(EOI_UPLOAD_DIR)) {
        fs.mkdirSync(EOI_UPLOAD_DIR, { recursive: true });
      }

      const ext = path.extname(req.file.originalname) || '';
      const storedFileName = `EOI_${refNo.replace(/[^a-zA-Z0-9_-]/g, '_')}_${empId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
      const fullPath = path.join(EOI_UPLOAD_DIR, storedFileName);
      fs.writeFileSync(fullPath, req.file.buffer);

      const savedDoc = await groupLifeRepository.addEoiDocument({
        refType,
        refNo,
        memberId,
        empId,
        docType,
        fileName: req.file.originalname,
        storedFileName,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        remarks,
        user
      });

      return res.status(201).json({
        success: true,
        message: `EOI document "${req.file.originalname}" uploaded successfully for ${empId}`,
        data: savedDoc
      });
    } catch (err: any) {
      console.error('Upload EOI Document error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to upload EOI document'
      });
    }
  },

  /**
   * List EOI Documents for a Policy or Quote
   */
  async listEoiDocuments(req: Request, res: Response) {
    try {
      const refType = String(req.query.refType || 'POLICY').toUpperCase() as 'QUOTE' | 'POLICY';
      const refNo = String(req.query.refNo || '').trim();
      const empId = req.query.empId ? String(req.query.empId).trim() : undefined;

      if (!refNo) {
        return res.status(400).json({ success: false, message: 'refNo query parameter is required' });
      }

      const docs = await groupLifeRepository.getEoiDocuments(refType, refNo, empId);
      return res.status(200).json({
        success: true,
        data: docs
      });
    } catch (err: any) {
      console.error('List EOI Documents error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to list EOI documents'
      });
    }
  },

  /**
   * Download an EOI Document
   */
  async downloadEoiDocument(req: Request, res: Response) {
    try {
      const docId = Number(req.params.docId);
      const doc = await groupLifeRepository.getEoiDocumentById(docId);
      if (!doc) {
        return res.status(404).json({ success: false, message: 'EOI document not found' });
      }

      const fullPath = path.join(EOI_UPLOAD_DIR, doc.STORED_FILE_NAME);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ success: false, message: 'Stored EOI document file not found on server' });
      }

      res.setHeader('Content-Type', doc.MIME_TYPE || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.FILE_NAME)}"`);
      return res.sendFile(fullPath);
    } catch (err: any) {
      console.error('Download EOI Document error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to download EOI document'
      });
    }
  },

  /**
   * Delete (soft-delete) an EOI Document
   */
  async deleteEoiDocument(req: Request, res: Response) {
    try {
      const docId = Number(req.params.docId);
      await groupLifeRepository.deleteEoiDocument(docId);
      return res.status(200).json({
        success: true,
        message: 'EOI document removed successfully'
      });
    } catch (err: any) {
      console.error('Delete EOI Document error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to delete EOI document'
      });
    }
  }
};
