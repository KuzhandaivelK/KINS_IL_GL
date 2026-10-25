import oracledb from 'oracledb';
import { getConnection, releaseConnection } from '../config/database';
import { OracleMenuRecord, CreateMenuInput, UpdateMenuInput, MenuItemTree } from '../types/menu';

export class MenuRepository {
  /**
   * Retrieves all menus, ordered by parent and sequence number.
   */
  async findAll(activeOnly: boolean = false): Promise<OracleMenuRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      let sql = `
        SELECT 
          MENU_ID,
          MENU_NAME,
          MENU_PARENT_ID,
          MENU_SEQ_NO,
          MENU_PATH,
          MENU_ICON,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_AT,
          MODIFIED_BY,
          MODIFIED_AT
        FROM MTBL_MENU
      `;

      const binds: Record<string, any> = {};
      if (activeOnly) {
        sql += ` WHERE IS_ACTIVE = 'Y'`;
      }

      sql += ` ORDER BY MENU_PARENT_ID NULLS FIRST, MENU_SEQ_NO ASC, MENU_NAME ASC`;

      const result = await connection.execute<OracleMenuRecord>(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      });

      return result.rows || [];
    } finally {
      await releaseConnection(connection);
    }
  }

  /**
   * Finds a single menu record by MENU_ID.
   */
  async findById(menuId: string): Promise<OracleMenuRecord | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const sql = `
        SELECT 
          MENU_ID,
          MENU_NAME,
          MENU_PARENT_ID,
          MENU_SEQ_NO,
          MENU_PATH,
          MENU_ICON,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_AT,
          MODIFIED_BY,
          MODIFIED_AT
        FROM MTBL_MENU
        WHERE MENU_ID = :menuId
      `;

      const result = await connection.execute<OracleMenuRecord>(
        sql,
        { menuId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (result.rows && result.rows.length > 0) {
        return result.rows[0];
      }
      return null;
    } finally {
      await releaseConnection(connection);
    }
  }

  /**
   * Inserts a new menu record into MTBL_MENU.
   */
  async create(input: CreateMenuInput): Promise<OracleMenuRecord> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const sql = `
        INSERT INTO MTBL_MENU (
          MENU_ID,
          MENU_NAME,
          MENU_PARENT_ID,
          MENU_SEQ_NO,
          MENU_PATH,
          MENU_ICON,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_AT
        ) VALUES (
          :menuId,
          :menuName,
          :menuParentId,
          :menuSeqNo,
          :menuPath,
          :menuIcon,
          :isActive,
          :createdBy,
          SYSDATE
        )
      `;

      await connection.execute(
        sql,
        {
          menuId: input.menuId.trim().toUpperCase(),
          menuName: input.menuName.trim(),
          menuParentId: input.menuParentId ? input.menuParentId.trim().toUpperCase() : null,
          menuSeqNo: input.menuSeqNo || 1,
          menuPath: input.menuPath ? input.menuPath.trim() : null,
          menuIcon: input.menuIcon ? input.menuIcon.trim() : 'Layers',
          isActive: input.isActive || 'Y',
          createdBy: input.createdBy || 'admin'
        },
        { autoCommit: true }
      );

      const created = await this.findById(input.menuId.trim().toUpperCase());
      if (!created) {
        throw new Error('Failed to retrieve newly created menu record.');
      }
      return created;
    } finally {
      await releaseConnection(connection);
    }
  }

  /**
   * Updates an existing menu record in MTBL_MENU.
   */
  async update(menuId: string, input: UpdateMenuInput): Promise<OracleMenuRecord | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const existing = await this.findById(menuId);
      if (!existing) {
        return null;
      }

      const updates: string[] = [];
      const binds: Record<string, any> = { menuId };

      if (input.menuName !== undefined) {
        updates.push(`MENU_NAME = :menuName`);
        binds.menuName = input.menuName.trim();
      }
      if (input.menuParentId !== undefined) {
        updates.push(`MENU_PARENT_ID = :menuParentId`);
        binds.menuParentId = input.menuParentId ? input.menuParentId.trim().toUpperCase() : null;
      }
      if (input.menuSeqNo !== undefined) {
        updates.push(`MENU_SEQ_NO = :menuSeqNo`);
        binds.menuSeqNo = input.menuSeqNo;
      }
      if (input.menuPath !== undefined) {
        updates.push(`MENU_PATH = :menuPath`);
        binds.menuPath = input.menuPath ? input.menuPath.trim() : null;
      }
      if (input.menuIcon !== undefined) {
        updates.push(`MENU_ICON = :menuIcon`);
        binds.menuIcon = input.menuIcon ? input.menuIcon.trim() : 'Layers';
      }
      if (input.isActive !== undefined) {
        updates.push(`IS_ACTIVE = :isActive`);
        binds.isActive = input.isActive;
      }

      updates.push(`MODIFIED_AT = SYSDATE`);
      updates.push(`MODIFIED_BY = :modifiedBy`);
      binds.modifiedBy = input.modifiedBy || 'admin';

      const sql = `
        UPDATE MTBL_MENU
        SET ${updates.join(', ')}
        WHERE MENU_ID = :menuId
      `;

      await connection.execute(sql, binds, { autoCommit: true });
      return await this.findById(menuId);
    } finally {
      await releaseConnection(connection);
    }
  }

  /**
   * Deletes a menu record by MENU_ID.
   */
  async delete(menuId: string): Promise<boolean> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const sql = `DELETE FROM MTBL_MENU WHERE MENU_ID = :menuId`;
      const result = await connection.execute(sql, { menuId }, { autoCommit: true });

      return (result.rowsAffected || 0) > 0;
    } finally {
      await releaseConnection(connection);
    }
  }

  /**
   * Builds a nested menu tree for frontend navigation.
   */
  async getMenuTree(activeOnly: boolean = true): Promise<MenuItemTree[]> {
    const allMenus = await this.findAll(activeOnly);

    const menuMap = new Map<string, MenuItemTree>();
    const roots: MenuItemTree[] = [];

    // First pass: instantiate tree nodes
    for (const m of allMenus) {
      menuMap.set(m.MENU_ID, { ...m, children: [] });
    }

    // Second pass: link children to parent
    for (const m of allMenus) {
      const node = menuMap.get(m.MENU_ID)!;
      if (m.MENU_PARENT_ID && menuMap.has(m.MENU_PARENT_ID)) {
        const parent = menuMap.get(m.MENU_PARENT_ID)!;
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}

export const menuRepository = new MenuRepository();
