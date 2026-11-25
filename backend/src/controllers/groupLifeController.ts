import { Request, Response } from 'express';
import { groupLifeRepository } from '../repositories/groupLifeRepository';
import {
  parseMemberFileBuffer,
  generateSampleExcelBuffer,
  generateSampleCsvString
} from '../utils/memberUploadParser';

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
  }
};
