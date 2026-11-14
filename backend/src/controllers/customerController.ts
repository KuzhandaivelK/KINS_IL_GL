import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { customerRepository } from '../repositories/customerRepository';

const createCustomerSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required').max(20, 'Customer ID cannot exceed 20 characters'),
  customerName: z.string().min(1, 'Customer Name is required').max(200),
  customerType: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  status: z.enum(['Y', 'N']).default('Y')
});

const updateCustomerSchema = z.object({
  customerName: z.string().min(1).max(200).optional(),
  customerType: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  status: z.enum(['Y', 'N']).optional()
});

export class CustomerController {
  /**
   * GET /api/customers
   */
  async listCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const customers = await customerRepository.findAll(search);

      res.status(200).json({
        success: true,
        data: { customers }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/customers/:customerId
   */
  async getCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.params.customerId;
      const cust = await customerRepository.findByCustomerId(customerId);

      if (!cust) {
        res.status(404).json({
          success: false,
          message: `Customer '${customerId}' not found.`
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          customer: {
            customerId: cust.CUST_CODE,
            customerName: cust.CUST_NAME || cust.CUST_CODE,
            customerType: cust.CUST_CATEGORY || null,
            address: cust.CUST_ADDRESS || null,
            phone: cust.CUST_MOBILE ? String(cust.CUST_MOBILE) : null,
            email: cust.CUST_EMAIL || null,
            status: cust.CUST_STATUS === 'N' ? 'N' : 'Y',
            createdAt: cust.CUST_CREATED_AT || null,
            createdBy: cust.CUST_CREATED_BY || null,
            modifiedAt: cust.CUST_MODIFIED_AT || null,
            modifiedBy: cust.CUST_MODIFIED_BY || null
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/customers
   */
  async createCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createCustomerSchema.parse(req.body);

      const existing = await customerRepository.findByCustomerId(parsed.customerId.trim());
      if (existing) {
        res.status(409).json({
          success: false,
          message: `Customer with ID '${parsed.customerId}' already exists in MTBL_CUSTOMER.`
        });
        return;
      }

      const creator = (req as any).user?.userId || 'admin';
      const created = await customerRepository.create({
        customerId: parsed.customerId.trim(),
        customerName: parsed.customerName.trim(),
        customerType: parsed.customerType ? parsed.customerType.trim() : null,
        address: parsed.address ? parsed.address.trim() : null,
        phone: parsed.phone ? parsed.phone.trim() : null,
        email: parsed.email ? parsed.email.trim() : null,
        status: parsed.status,
        createdBy: creator
      });

      res.status(201).json({
        success: true,
        message: `Customer '${created.customerId}' created successfully.`,
        data: { customer: created }
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: err.errors.map(e => e.message).join(', ')
        });
        return;
      }
      next(err);
    }
  }

  /**
   * PUT /api/customers/:customerId
   */
  async updateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.params.customerId;
      const parsed = updateCustomerSchema.parse(req.body);

      const existing = await customerRepository.findByCustomerId(customerId);
      if (!existing) {
        res.status(404).json({
          success: false,
          message: `Customer '${customerId}' not found.`
        });
        return;
      }

      const modifier = (req as any).user?.userId || 'admin';
      const updated = await customerRepository.update(customerId, {
        ...parsed,
        modifiedBy: modifier
      });

      res.status(200).json({
        success: true,
        message: `Customer '${customerId}' updated successfully.`,
        data: { customer: updated }
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: err.errors.map(e => e.message).join(', ')
        });
        return;
      }
      next(err);
    }
  }

  /**
   * DELETE /api/customers/:customerId
   */
  async deleteCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.params.customerId;

      const existing = await customerRepository.findByCustomerId(customerId);
      if (!existing) {
        res.status(404).json({
          success: false,
          message: `Customer '${customerId}' not found.`
        });
        return;
      }

      await customerRepository.delete(customerId);

      res.status(200).json({
        success: true,
        message: `Customer '${customerId}' deleted successfully.`
      });
    } catch (err) {
      next(err);
    }
  }
}

export const customerController = new CustomerController();
