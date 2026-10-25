import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { userRepository } from '../repositories/userRepository';

const createUserSchema = z.object({
  userId: z.string().min(2, 'User ID must be at least 2 characters').max(20, 'User ID cannot exceed 20 characters'),
  password: z.string().min(4, 'Password must be at least 4 characters').max(50, 'Password cannot exceed 50 characters'),
  userName: z.string().min(2, 'User Name must be at least 2 characters').max(255),
  description: z.string().max(255).optional().nullable(),
  disableFlag: z.enum(['Y', 'N']).default('N')
});

const updateUserSchema = z.object({
  userName: z.string().min(2).max(255).optional(),
  password: z.string().min(4).max(50).optional().or(z.literal('')),
  description: z.string().max(255).optional().nullable(),
  disableFlag: z.enum(['Y', 'N']).optional()
});

export class UserController {
  /**
   * GET /api/users
   */
  async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const users = await userRepository.findAll(search);

      res.status(200).json({
        success: true,
        data: { users }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/users/:userId
   */
  async getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.userId;
      const user = await userRepository.findByUserId(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          message: `User '${userId}' not found.`
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            userId: user.USER_ID,
            userName: user.USER_NAME || user.USER_ID,
            description: user.USER_L1_DESC || null,
            disableFlag: user.USER_DISABLE_FLAG || 'N',
            loginCount: user.USER_LOGIN_COUNT || 0,
            createdAt: user.USER_CREATED_AT || null,
            createdBy: user.USER_CREATED_BY || null,
            modifiedAt: user.USER_MODIFIED_AT || null,
            modifiedBy: user.USER_MODIFIED_BY || null
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/users
   */
  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createUserSchema.parse(req.body);

      // Check if user already exists
      const existing = await userRepository.findByUserId(parsed.userId.trim());
      if (existing) {
        res.status(409).json({
          success: false,
          message: `User with ID '${parsed.userId}' already exists in MTBL_USER.`
        });
        return;
      }

      const creator = req.user?.userId || 'admin';
      const createdUser = await userRepository.create({
        userId: parsed.userId.trim(),
        password: parsed.password.trim(),
        userName: parsed.userName.trim(),
        description: parsed.description ? parsed.description.trim() : null,
        disableFlag: parsed.disableFlag,
        createdBy: creator
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully in Oracle MTBL_USER.',
        data: { user: createdUser }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/users/:userId
   */
  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.userId;
      const parsed = updateUserSchema.parse(req.body);

      const modifier = req.user?.userId || 'admin';
      const updatedUser = await userRepository.update(userId, {
        userName: parsed.userName?.trim(),
        password: parsed.password && parsed.password.trim() !== '' ? parsed.password.trim() : undefined,
        description: parsed.description !== undefined ? (parsed.description ? parsed.description.trim() : null) : undefined,
        disableFlag: parsed.disableFlag,
        modifiedBy: modifier
      });

      if (!updatedUser) {
        res.status(404).json({
          success: false,
          message: `User '${userId}' not found.`
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'User updated successfully.',
        data: { user: updatedUser }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/users/:userId
   */
  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.userId;

      // Prevent logged-in user from deleting own account
      if (req.user?.userId && req.user.userId.toLowerCase() === userId.toLowerCase()) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete the currently logged-in user account.'
        });
        return;
      }

      const deleted = await userRepository.delete(userId);
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: `User '${userId}' not found or already removed.`
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: `User '${userId}' successfully deleted from MTBL_USER.`
      });
    } catch (err) {
      next(err);
    }
  }
}

export const userController = new UserController();
