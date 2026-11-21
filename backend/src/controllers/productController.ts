import { Request, Response } from 'express';
import { z } from 'zod';
import { productRepository } from '../repositories/productRepository';

const prodCoverSchema = z.object({
  MPC_COVER_CODE: z.string().min(1, 'Cover Code is required').max(20),
  MPC_DEFAULT_YN: z.enum(['Y', 'N']).optional().default('Y'),
  MPC_MANDATORY_YN: z.enum(['Y', 'N']).optional().default('Y'),
  MPC_MAX_AGE_ON_MAT: z.number().nullable().optional(),
  MPC_PERIOD: z.number().nullable().optional(),
  MPC_PREM_PAY_YRS: z.number().nullable().optional()
});

const createProductSchema = z.object({
  PROD_CODE: z.string().min(1, 'Product Code is required').max(20),
  PROD_NAME: z.string().min(1, 'Product Name is required').max(200),
  PROD_TYPE: z.string().max(3).optional().default('T'),
  PROD_TERM_FM: z.number().nullable().optional(),
  PROD_TERM_TO: z.number().nullable().optional(),
  PROD_MIN_AGE: z.number().nullable().optional(),
  PROD_MAX_AGE: z.number().nullable().optional(),
  PROD_AGE_CALC_MTHD: z.string().max(3).optional().default('ANB'),
  PROD_JOINT_LIFE_YN: z.enum(['Y', 'N']).optional().default('N'),
  PROD_PERIOD_MULTIPLE: z.number().nullable().optional().default(1),
  PROD_VALID_FM_DT: z.string().nullable().optional(),
  PROD_VALID_TO_DT: z.string().nullable().optional(),
  PROD_COOLOFF_DAYS: z.number().nullable().optional().default(15),
  PROD_MIN_SA: z.number().nullable().optional(),
  PROD_MAX_SA: z.number().nullable().optional(),
  PROD_COMM_CODE: z.string().max(20).nullable().optional(),
  PROD_SURR_YN: z.enum(['Y', 'N']).optional().default('N'),
  PROD_SURR_YEARS: z.number().nullable().optional(),
  PROD_LOAN_YN: z.enum(['Y', 'N']).optional().default('N'),
  PROD_MAT_YN: z.enum(['Y', 'N']).optional().default('N'),
  PROD_WITHDRAW_YN: z.enum(['Y', 'N']).optional().default('N'),
  PROD_LOB: z.enum(['IL', 'GL', 'BOTH']).optional().default('IL'),
  covers: z.array(prodCoverSchema).optional().default([])
});

const updateProductSchema = z.object({
  PROD_NAME: z.string().min(1, 'Product Name is required').max(200),
  PROD_TYPE: z.string().max(3).optional().default('T'),
  PROD_TERM_FM: z.number().nullable().optional(),
  PROD_TERM_TO: z.number().nullable().optional(),
  PROD_MIN_AGE: z.number().nullable().optional(),
  PROD_MAX_AGE: z.number().nullable().optional(),
  PROD_AGE_CALC_MTHD: z.string().max(3).optional().default('ANB'),
  PROD_JOINT_LIFE_YN: z.enum(['Y', 'N']).optional().default('N'),
  PROD_PERIOD_MULTIPLE: z.number().nullable().optional().default(1),
  PROD_VALID_FM_DT: z.string().nullable().optional(),
  PROD_VALID_TO_DT: z.string().nullable().optional(),
  PROD_COOLOFF_DAYS: z.number().nullable().optional().default(15),
  PROD_MIN_SA: z.number().nullable().optional(),
  PROD_MAX_SA: z.number().nullable().optional(),
  PROD_COMM_CODE: z.string().max(20).nullable().optional(),
  PROD_SURR_YN: z.enum(['Y', 'N']).optional().default('N'),
  PROD_SURR_YEARS: z.number().nullable().optional(),
  PROD_LOAN_YN: z.enum(['Y', 'N']).optional().default('N'),
  PROD_MAT_YN: z.enum(['Y', 'N']).optional().default('N'),
  PROD_WITHDRAW_YN: z.enum(['Y', 'N']).optional().default('N'),
  PROD_LOB: z.enum(['IL', 'GL', 'BOTH']).optional(),
  covers: z.array(prodCoverSchema).optional()
});

export const productController = {
  /**
   * GET /api/products
   */
  async getProducts(req: Request, res: Response): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const prodType = req.query.prodType as string | undefined;
      const lob = req.query.lob as string | undefined;

      const products = await productRepository.findAll(search, prodType, lob);
      res.json({
        success: true,
        count: products.length,
        products
      });
    } catch (error: any) {
      console.error('Error in getProducts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve products',
        error: error.message
      });
    }
  },

  /**
   * GET /api/products/:code
   */
  async getProductByCode(req: Request, res: Response): Promise<void> {
    try {
      const code = req.params.code.trim().toUpperCase();
      const product = await productRepository.findByCode(code);

      if (!product) {
        res.status(404).json({
          success: false,
          message: `Product with code '${code}' not found`
        });
        return;
      }

      res.json({
        success: true,
        product
      });
    } catch (error: any) {
      console.error('Error in getProductByCode:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve product details',
        error: error.message
      });
    }
  },

  /**
   * POST /api/products
   */
  async createProduct(req: Request, res: Response): Promise<void> {
    try {
      const parseResult = createProductSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          message: 'Invalid product input data',
          errors: parseResult.error.format()
        });
        return;
      }

      const input = parseResult.data;
      const codeUpper = input.PROD_CODE.trim().toUpperCase();

      // Check if product code already exists
      const exists = await productRepository.checkExists(codeUpper);
      if (exists) {
        res.status(409).json({
          success: false,
          message: `Product code '${codeUpper}' already exists. Please choose a unique code.`
        });
        return;
      }

      const username = (req as any).user?.username || 'admin';
      const created = await productRepository.create(input, username);

      res.status(201).json({
        success: true,
        message: `Product '${created.PROD_CODE}' successfully configured`,
        product: created
      });
    } catch (error: any) {
      console.error('Error in createProduct:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create product',
        error: error.message
      });
    }
  },

  /**
   * PUT /api/products/:code
   */
  async updateProduct(req: Request, res: Response): Promise<void> {
    try {
      const code = req.params.code.trim().toUpperCase();
      const parseResult = updateProductSchema.safeParse(req.body);

      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          message: 'Invalid product input data',
          errors: parseResult.error.format()
        });
        return;
      }

      const exists = await productRepository.checkExists(code);
      if (!exists) {
        res.status(404).json({
          success: false,
          message: `Product with code '${code}' not found`
        });
        return;
      }

      const username = (req as any).user?.username || 'admin';
      const updated = await productRepository.update(code, parseResult.data, username);

      res.json({
        success: true,
        message: `Product '${code}' successfully updated`,
        product: updated
      });
    } catch (error: any) {
      console.error('Error in updateProduct:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update product',
        error: error.message
      });
    }
  },

  /**
   * DELETE /api/products/:code
   */
  async deleteProduct(req: Request, res: Response): Promise<void> {
    try {
      const code = req.params.code.trim().toUpperCase();
      const exists = await productRepository.checkExists(code);

      if (!exists) {
        res.status(404).json({
          success: false,
          message: `Product with code '${code}' not found`
        });
        return;
      }

      const deleted = await productRepository.delete(code);
      if (deleted) {
        res.json({
          success: true,
          message: `Product '${code}' and its attached covers were successfully deleted`
        });
      } else {
        res.status(500).json({
          success: false,
          message: `Failed to delete product '${code}'`
        });
      }
    } catch (error: any) {
      console.error('Error in deleteProduct:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete product',
        error: error.message
      });
    }
  }
};
