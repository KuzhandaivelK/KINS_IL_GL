import oracledb from 'oracledb';
import { getConnection, releaseConnection } from '../config/database';
import {
  WorkflowHeadRecord,
  WorkflowLevelRecord,
  WorkflowDetail,
  WorkflowInput,
  WorkflowLevelInput
} from '../types/workflow';

export const workflowRepository = {
  /**
   * List all workflows with their level counts and optional search / category filter
   */
  async findAll(category?: string, search?: string): Promise<WorkflowHeadRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      let sql = `
        SELECT 
          h.WF_CODE,
          h.WF_NAME,
          h.WF_CATEGORY,
          h.WF_DESC,
          h.WF_TOTAL_LEVELS,
          h.WF_ALLOW_AUTO_APPROVAL_YN,
          h.WF_AUTO_APPROVAL_LIMIT,
          h.IS_ACTIVE,
          h.CREATED_BY,
          TO_CHAR(h.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
          h.MODIFIED_BY,
          TO_CHAR(h.MODIFIED_ON, 'YYYY-MM-DD HH24:MI:SS') AS MODIFIED_ON,
          (SELECT COUNT(1) FROM MTBL_WORKFLOW_LEVEL l WHERE l.WF_CODE = h.WF_CODE) AS LEVELS_COUNT
        FROM MTBL_WORKFLOW_HEAD h
        WHERE 1=1
      `;

      const binds: Record<string, any> = {};

      if (category && category.trim() !== '' && category.trim().toUpperCase() !== 'ALL') {
        sql += ` AND h.WF_CATEGORY = :category`;
        binds.category = category.trim().toUpperCase();
      }

      if (search && search.trim() !== '') {
        sql += ` AND (UPPER(h.WF_CODE) LIKE :search OR UPPER(h.WF_NAME) LIKE :search OR UPPER(h.WF_DESC) LIKE :search)`;
        binds.search = `%${search.trim().toUpperCase()}%`;
      }

      sql += ` ORDER BY h.WF_CATEGORY ASC, h.WF_CODE ASC`;

      const result = await connection.execute<WorkflowHeadRecord>(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      });

      return result.rows || [];
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Get single workflow detail with all approval levels
   */
  async findByCode(wfCode: string): Promise<WorkflowDetail | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const headSql = `
        SELECT 
          h.WF_CODE,
          h.WF_NAME,
          h.WF_CATEGORY,
          h.WF_DESC,
          h.WF_TOTAL_LEVELS,
          h.WF_ALLOW_AUTO_APPROVAL_YN,
          h.WF_AUTO_APPROVAL_LIMIT,
          h.IS_ACTIVE,
          h.CREATED_BY,
          TO_CHAR(h.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
          h.MODIFIED_BY,
          TO_CHAR(h.MODIFIED_ON, 'YYYY-MM-DD HH24:MI:SS') AS MODIFIED_ON,
          (SELECT COUNT(1) FROM MTBL_WORKFLOW_LEVEL l WHERE l.WF_CODE = h.WF_CODE) AS LEVELS_COUNT
        FROM MTBL_WORKFLOW_HEAD h
        WHERE h.WF_CODE = :wfCode
      `;

      const headResult = await connection.execute<WorkflowHeadRecord>(
        headSql,
        { wfCode: wfCode.trim().toUpperCase() },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (!headResult.rows || headResult.rows.length === 0) {
        return null;
      }

      const head = headResult.rows[0];

      const levelsSql = `
        SELECT 
          l.WFL_ID,
          l.WF_CODE,
          l.WFL_LEVEL_NO,
          l.WFL_LEVEL_NAME,
          l.WFL_ROLE_CODE,
          l.WFL_USER_GROUP,
          l.WFL_MIN_AMOUNT,
          l.WFL_MAX_AMOUNT,
          l.WFL_SLA_HOURS,
          l.WFL_ALLOW_REJECT_YN,
          l.WFL_ALLOW_REWORK_YN,
          l.WFL_MANDATORY_DOC_YN,
          l.WFL_AUTO_ESCALATE_HOURS,
          l.IS_ACTIVE,
          l.CREATED_BY,
          TO_CHAR(l.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
          l.MODIFIED_BY,
          TO_CHAR(l.MODIFIED_ON, 'YYYY-MM-DD HH24:MI:SS') AS MODIFIED_ON
        FROM MTBL_WORKFLOW_LEVEL l
        WHERE l.WF_CODE = :wfCode
        ORDER BY l.WFL_LEVEL_NO ASC
      `;

      const levelsResult = await connection.execute<WorkflowLevelRecord>(
        levelsSql,
        { wfCode: wfCode.trim().toUpperCase() },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const levels = levelsResult.rows || [];

      // Fetch mapped user groups for each level
      const ugMapSql = `
        SELECT WFL_LEVEL_NO, USER_GROUP
        FROM MTBL_WORKFLOW_LEVEL_UG_MAP
        WHERE WF_CODE = :wfCode
      `;
      const ugResult = await connection.execute<{ WFL_LEVEL_NO: number; USER_GROUP: string }>(
        ugMapSql,
        { wfCode: wfCode.trim().toUpperCase() },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const ugRows = ugResult.rows || [];

      for (const lvl of levels) {
        const groups = ugRows
          .filter(u => u.WFL_LEVEL_NO === lvl.WFL_LEVEL_NO)
          .map(u => u.USER_GROUP.toUpperCase());
        if (lvl.WFL_USER_GROUP && !groups.includes(lvl.WFL_USER_GROUP.toUpperCase())) {
          groups.push(lvl.WFL_USER_GROUP.toUpperCase());
        }
        lvl.AUTHORIZED_USER_GROUPS = groups;
      }

      return {
        head,
        levels
      };
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Create a new workflow head with levels
   */
  async create(data: WorkflowInput, username: string = 'ADMIN'): Promise<WorkflowDetail> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const wfCode = data.WF_CODE.trim().toUpperCase();
      const levels = data.levels || [];
      const totalLevels = levels.length > 0 ? levels.length : (data.WF_TOTAL_LEVELS || 1);

      // Check if workflow exists
      const checkSql = `SELECT COUNT(1) AS CNT FROM MTBL_WORKFLOW_HEAD WHERE WF_CODE = :wfCode`;
      const checkResult = await connection.execute<{ CNT: number }>(
        checkSql,
        { wfCode },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (checkResult.rows && checkResult.rows[0].CNT > 0) {
        throw new Error(`Workflow code '${wfCode}' already exists.`);
      }

      // Insert Header
      const insertHeadSql = `
        INSERT INTO MTBL_WORKFLOW_HEAD (
          WF_CODE, WF_NAME, WF_CATEGORY, WF_DESC,
          WF_TOTAL_LEVELS, WF_ALLOW_AUTO_APPROVAL_YN, WF_AUTO_APPROVAL_LIMIT,
          IS_ACTIVE, CREATED_BY, CREATED_ON
        )
        VALUES (
          :wfCode, :wfName, :wfCat, :wfDesc,
          :totLevels, :autoAppr, :autoLimit,
          :isActive, :createdBy, SYSDATE
        )
      `;

      await connection.execute(insertHeadSql, {
        wfCode,
        wfName: data.WF_NAME.trim(),
        wfCat: data.WF_CATEGORY.trim().toUpperCase(),
        wfDesc: data.WF_DESC ? data.WF_DESC.trim() : null,
        totLevels: totalLevels,
        autoAppr: data.WF_ALLOW_AUTO_APPROVAL_YN === 'Y' ? 'Y' : 'N',
        autoLimit: data.WF_AUTO_APPROVAL_LIMIT || 0,
        isActive: data.IS_ACTIVE === 'N' ? 'N' : 'Y',
        createdBy: username.substring(0, 26)
      });

      // Insert Levels
      if (levels.length > 0) {
        const insertLevelSql = `
          INSERT INTO MTBL_WORKFLOW_LEVEL (
            WFL_ID, WF_CODE, WFL_LEVEL_NO, WFL_LEVEL_NAME, WFL_ROLE_CODE, WFL_USER_GROUP,
            WFL_MIN_AMOUNT, WFL_MAX_AMOUNT, WFL_SLA_HOURS,
            WFL_ALLOW_REJECT_YN, WFL_ALLOW_REWORK_YN, WFL_MANDATORY_DOC_YN,
            WFL_AUTO_ESCALATE_HOURS, IS_ACTIVE, CREATED_BY, CREATED_ON
          )
          VALUES (
            SEQ_WFL_ID.NEXTVAL, :wfCode, :lvlNo, :lvlName, :roleCode, :userGroup,
            :minAmt, :maxAmt, :sla,
            :rejYn, :rewYn, :docYn,
            :escHours, :isActive, :createdBy, SYSDATE
          )
        `;

        for (let i = 0; i < levels.length; i++) {
          const lvl = levels[i];
          const lvlNo = lvl.WFL_LEVEL_NO || (i + 1);
          const uGroup = (lvl.WFL_USER_GROUP || 'ADMIN').toUpperCase();

          await connection.execute(insertLevelSql, {
            wfCode,
            lvlNo,
            lvlName: lvl.WFL_LEVEL_NAME.trim(),
            roleCode: lvl.WFL_ROLE_CODE.trim().toUpperCase(),
            userGroup: uGroup,
            minAmt: lvl.WFL_MIN_AMOUNT !== undefined && lvl.WFL_MIN_AMOUNT !== null ? lvl.WFL_MIN_AMOUNT : 0,
            maxAmt: lvl.WFL_MAX_AMOUNT !== undefined && lvl.WFL_MAX_AMOUNT !== null ? lvl.WFL_MAX_AMOUNT : null,
            sla: lvl.WFL_SLA_HOURS !== undefined && lvl.WFL_SLA_HOURS !== null ? lvl.WFL_SLA_HOURS : 24,
            rejYn: lvl.WFL_ALLOW_REJECT_YN === 'N' ? 'N' : 'Y',
            rewYn: lvl.WFL_ALLOW_REWORK_YN === 'N' ? 'N' : 'Y',
            docYn: lvl.WFL_MANDATORY_DOC_YN === 'Y' ? 'Y' : 'N',
            escHours: lvl.WFL_AUTO_ESCALATE_HOURS !== undefined ? lvl.WFL_AUTO_ESCALATE_HOURS : 48,
            isActive: lvl.IS_ACTIVE === 'N' ? 'N' : 'Y',
            createdBy: username.substring(0, 26)
          });

          // Insert into MTBL_WORKFLOW_LEVEL_UG_MAP
          const userGroupsToMap = new Set<string>([uGroup, 'ADMIN']);
          if (lvl.AUTHORIZED_USER_GROUPS && Array.isArray(lvl.AUTHORIZED_USER_GROUPS)) {
            lvl.AUTHORIZED_USER_GROUPS.forEach(g => userGroupsToMap.add(g.toUpperCase()));
          }

          for (const ug of userGroupsToMap) {
            await connection.execute(
              `INSERT INTO MTBL_WORKFLOW_LEVEL_UG_MAP (
                WF_CODE, WFL_LEVEL_NO, USER_GROUP, CAN_APPROVE_YN, CAN_REJECT_YN, CAN_REWORK_YN, CREATED_BY, CREATED_ON
               ) VALUES (
                :wfCode, :lvlNo, :userGroup, 'Y', 'Y', 'Y', :createdBy, SYSDATE
               )`,
              { wfCode, lvlNo, userGroup: ug, createdBy: username.substring(0, 26) }
            );
          }
        }
      }

      await connection.commit();

      const created = await this.findByCode(wfCode);
      if (!created) {
        throw new Error('Failed to retrieve created workflow.');
      }
      return created;
    } catch (err) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (_) {}
      }
      throw err;
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Update workflow header and its levels
   */
  async update(wfCode: string, data: Partial<WorkflowInput>, username: string = 'ADMIN'): Promise<WorkflowDetail> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const code = wfCode.trim().toUpperCase();

      // Check existence
      const current = await this.findByCode(code);
      if (!current) {
        throw new Error(`Workflow '${code}' not found.`);
      }

      const levels = data.levels;
      const totalLevels = levels ? levels.length : (data.WF_TOTAL_LEVELS !== undefined ? data.WF_TOTAL_LEVELS : current.head.WF_TOTAL_LEVELS);

      const updateHeadSql = `
        UPDATE MTBL_WORKFLOW_HEAD
        SET 
          WF_NAME = :wfName,
          WF_CATEGORY = :wfCat,
          WF_DESC = :wfDesc,
          WF_TOTAL_LEVELS = :totLevels,
          WF_ALLOW_AUTO_APPROVAL_YN = :autoAppr,
          WF_AUTO_APPROVAL_LIMIT = :autoLimit,
          IS_ACTIVE = :isActive,
          MODIFIED_BY = :modifiedBy,
          MODIFIED_ON = SYSDATE
        WHERE WF_CODE = :wfCode
      `;

      await connection.execute(updateHeadSql, {
        wfCode: code,
        wfName: data.WF_NAME !== undefined ? data.WF_NAME.trim() : current.head.WF_NAME,
        wfCat: data.WF_CATEGORY !== undefined ? data.WF_CATEGORY.trim().toUpperCase() : current.head.WF_CATEGORY,
        wfDesc: data.WF_DESC !== undefined ? (data.WF_DESC ? data.WF_DESC.trim() : null) : current.head.WF_DESC,
        totLevels: totalLevels,
        autoAppr: data.WF_ALLOW_AUTO_APPROVAL_YN !== undefined ? (data.WF_ALLOW_AUTO_APPROVAL_YN === 'Y' ? 'Y' : 'N') : current.head.WF_ALLOW_AUTO_APPROVAL_YN,
        autoLimit: data.WF_AUTO_APPROVAL_LIMIT !== undefined ? data.WF_AUTO_APPROVAL_LIMIT : current.head.WF_AUTO_APPROVAL_LIMIT,
        isActive: data.IS_ACTIVE !== undefined ? (data.IS_ACTIVE === 'N' ? 'N' : 'Y') : current.head.IS_ACTIVE,
        modifiedBy: username.substring(0, 26)
      });

      // If levels array is provided, replace levels
      if (levels !== undefined) {
        await connection.execute(`DELETE FROM MTBL_WORKFLOW_LEVEL_UG_MAP WHERE WF_CODE = :wfCode`, { wfCode: code });
        await connection.execute(`DELETE FROM MTBL_WORKFLOW_LEVEL WHERE WF_CODE = :wfCode`, { wfCode: code });

        if (levels.length > 0) {
          const insertLevelSql = `
            INSERT INTO MTBL_WORKFLOW_LEVEL (
              WFL_ID, WF_CODE, WFL_LEVEL_NO, WFL_LEVEL_NAME, WFL_ROLE_CODE, WFL_USER_GROUP,
              WFL_MIN_AMOUNT, WFL_MAX_AMOUNT, WFL_SLA_HOURS,
              WFL_ALLOW_REJECT_YN, WFL_ALLOW_REWORK_YN, WFL_MANDATORY_DOC_YN,
              WFL_AUTO_ESCALATE_HOURS, IS_ACTIVE, CREATED_BY, CREATED_ON, MODIFIED_BY, MODIFIED_ON
            )
            VALUES (
              SEQ_WFL_ID.NEXTVAL, :wfCode, :lvlNo, :lvlName, :roleCode, :userGroup,
              :minAmt, :maxAmt, :sla,
              :rejYn, :rewYn, :docYn,
              :escHours, :isActive, :createdBy, SYSDATE, :modifiedBy, SYSDATE
            )
          `;

          for (let i = 0; i < levels.length; i++) {
            const lvl = levels[i];
            const lvlNo = lvl.WFL_LEVEL_NO || (i + 1);
            const uGroup = (lvl.WFL_USER_GROUP || 'ADMIN').toUpperCase();

            await connection.execute(insertLevelSql, {
              wfCode: code,
              lvlNo,
              lvlName: lvl.WFL_LEVEL_NAME.trim(),
              roleCode: lvl.WFL_ROLE_CODE.trim().toUpperCase(),
              userGroup: uGroup,
              minAmt: lvl.WFL_MIN_AMOUNT !== undefined && lvl.WFL_MIN_AMOUNT !== null ? lvl.WFL_MIN_AMOUNT : 0,
              maxAmt: lvl.WFL_MAX_AMOUNT !== undefined && lvl.WFL_MAX_AMOUNT !== null ? lvl.WFL_MAX_AMOUNT : null,
              sla: lvl.WFL_SLA_HOURS !== undefined && lvl.WFL_SLA_HOURS !== null ? lvl.WFL_SLA_HOURS : 24,
              rejYn: lvl.WFL_ALLOW_REJECT_YN === 'N' ? 'N' : 'Y',
              rewYn: lvl.WFL_ALLOW_REWORK_YN === 'N' ? 'N' : 'Y',
              docYn: lvl.WFL_MANDATORY_DOC_YN === 'Y' ? 'Y' : 'N',
              escHours: lvl.WFL_AUTO_ESCALATE_HOURS !== undefined ? lvl.WFL_AUTO_ESCALATE_HOURS : 48,
              isActive: lvl.IS_ACTIVE === 'N' ? 'N' : 'Y',
              createdBy: username.substring(0, 26),
              modifiedBy: username.substring(0, 26)
            });

            // Insert into MTBL_WORKFLOW_LEVEL_UG_MAP
            const userGroupsToMap = new Set<string>([uGroup, 'ADMIN']);
            if (lvl.AUTHORIZED_USER_GROUPS && Array.isArray(lvl.AUTHORIZED_USER_GROUPS)) {
              lvl.AUTHORIZED_USER_GROUPS.forEach(g => userGroupsToMap.add(g.toUpperCase()));
            }

            for (const ug of userGroupsToMap) {
              await connection.execute(
                `INSERT INTO MTBL_WORKFLOW_LEVEL_UG_MAP (
                  WF_CODE, WFL_LEVEL_NO, USER_GROUP, CAN_APPROVE_YN, CAN_REJECT_YN, CAN_REWORK_YN, CREATED_BY, CREATED_ON
                 ) VALUES (
                  :wfCode, :lvlNo, :userGroup, 'Y', 'Y', 'Y', :createdBy, SYSDATE
                 )`,
                { wfCode: code, lvlNo, userGroup: ug, createdBy: username.substring(0, 26) }
              );
            }
          }
        }
      }

      await connection.commit();

      const updated = await this.findByCode(code);
      if (!updated) {
        throw new Error('Failed to retrieve updated workflow.');
      }
      return updated;
    } catch (err) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (_) {}
      }
      throw err;
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Delete workflow and its levels
   */
  async delete(wfCode: string): Promise<boolean> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const code = wfCode.trim().toUpperCase();

      await connection.execute(`DELETE FROM MTBL_WORKFLOW_LEVEL_UG_MAP WHERE WF_CODE = :wfCode`, { wfCode: code });
      await connection.execute(`DELETE FROM MTBL_WORKFLOW_LEVEL WHERE WF_CODE = :wfCode`, { wfCode: code });
      const res = await connection.execute(`DELETE FROM MTBL_WORKFLOW_HEAD WHERE WF_CODE = :wfCode`, { wfCode: code });

      await connection.commit();
      return (res.rowsAffected || 0) > 0;
    } catch (err) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (_) {}
      }
      throw err;
    } finally {
      await releaseConnection(connection);
    }
  }
};
