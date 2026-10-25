import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { menuRepository } from '../repositories/menuRepository';

const createMenuSchema = z.object({
  menuId: z.string().min(2, 'Menu ID must be at least 2 characters').max(50),
  menuName: z.string().min(2, 'Menu Name must be at least 2 characters').max(100),
  menuParentId: z.string().max(50).optional().nullable(),
  menuSeqNo: z.number().int().min(1).default(1),
  menuPath: z.string().max(200).optional().nullable(),
  menuIcon: z.string().max(50).default('Layers'),
  isActive: z.enum(['Y', 'N']).default('Y')
});

const updateMenuSchema = z.object({
  menuName: z.string().min(2).max(100).optional(),
  menuParentId: z.string().max(50).optional().nullable(),
  menuSeqNo: z.number().int().min(1).optional(),
  menuPath: z.string().max(200).optional().nullable(),
  menuIcon: z.string().max(50).optional(),
  isActive: z.enum(['Y', 'N']).optional()
});

export class MenuController {
  /**
   * GET /api/menus
   * Query params:
   *   tree=true -> returns nested tree structure
   *   activeOnly=true -> filters only IS_ACTIVE = 'Y'
   */
  async listMenus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isTree = req.query.tree === 'true';
      const activeOnly = req.query.activeOnly === 'true';

      if (isTree) {
        const tree = await menuRepository.getMenuTree(activeOnly);
        res.status(200).json({
          success: true,
          data: { menus: tree }
        });
        return;
      }

      const flatList = await menuRepository.findAll(activeOnly);
      res.status(200).json({
        success: true,
        data: { menus: flatList }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/menus/:menuId
   */
  async getMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const menuId = req.params.menuId;
      const menu = await menuRepository.findById(menuId);

      if (!menu) {
        res.status(404).json({
          success: false,
          message: `Menu '${menuId}' not found.`
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { menu }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/menus
   */
  async createMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createMenuSchema.parse(req.body);

      // Check if menu ID already exists
      const existing = await menuRepository.findById(parsed.menuId.trim().toUpperCase());
      if (existing) {
        res.status(409).json({
          success: false,
          message: `Menu with ID '${parsed.menuId}' already exists in MTBL_MENU.`
        });
        return;
      }

      const creator = req.user?.userId || 'admin';
      const createdMenu = await menuRepository.create({
        menuId: parsed.menuId,
        menuName: parsed.menuName,
        menuParentId: parsed.menuParentId || null,
        menuSeqNo: parsed.menuSeqNo,
        menuPath: parsed.menuPath || null,
        menuIcon: parsed.menuIcon,
        isActive: parsed.isActive,
        createdBy: creator
      });

      res.status(201).json({
        success: true,
        message: 'Menu entry created successfully in Oracle MTBL_MENU.',
        data: { menu: createdMenu }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/menus/:menuId
   */
  async updateMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const menuId = req.params.menuId;
      const parsed = updateMenuSchema.parse(req.body);

      // Prevent self as parent
      if (parsed.menuParentId && parsed.menuParentId.toUpperCase() === menuId.toUpperCase()) {
        res.status(400).json({
          success: false,
          message: 'A menu item cannot be set as its own parent.'
        });
        return;
      }

      const modifier = req.user?.userId || 'admin';
      const updatedMenu = await menuRepository.update(menuId, {
        menuName: parsed.menuName,
        menuParentId: parsed.menuParentId,
        menuSeqNo: parsed.menuSeqNo,
        menuPath: parsed.menuPath,
        menuIcon: parsed.menuIcon,
        isActive: parsed.isActive,
        modifiedBy: modifier
      });

      if (!updatedMenu) {
        res.status(404).json({
          success: false,
          message: `Menu '${menuId}' not found.`
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Menu updated successfully.',
        data: { menu: updatedMenu }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/menus/:menuId
   */
  async deleteMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const menuId = req.params.menuId;

      const deleted = await menuRepository.delete(menuId);
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: `Menu '${menuId}' not found or already deleted.`
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: `Menu '${menuId}' deleted successfully.`
      });
    } catch (err) {
      next(err);
    }
  }
}

export const menuController = new MenuController();
