import oracledb from 'oracledb';
import { getConnection, releaseConnection } from '../config/database';
import {
  ProspectRecord,
  ProspectRiderRecord,
  ProspectDetail,
  CreateProspectInput,
  UpdateProspectInput
} from '../types/quote';

export const quoteRepository = {
  /**
   * List all prospects/quotes with attached rider count and total premium
   */
  async findAll(search?: string, plan?: string): Promise<ProspectRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      let sql = `
        SELECT 
          p.PROS_UID,
          p.PROS_FULL_NAME,
          TO_CHAR(p.PROS_DOB, 'YYYY-MM-DD') AS PROS_DOB,
          p.PROS_AGE,
          p.PROS_GENDER,
          p.PROS_ANN_SALARY,
          p.PROS_PLAN,
          p.PROS_TERM,
          p.PROS_SUM_ASSURED,
          p.PROS_PREMIUM,
          p.PROS_CREATED_BY,
          TO_CHAR(p.PROS_CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS PROS_CREATED_ON,
          prod.PROD_NAME AS PLAN_NAME,
          NVL((SELECT COUNT(1) FROM TBL_PROSPECT_RIDER r WHERE r.PROS_UID = p.PROS_UID), 0) AS RIDER_COUNT,
          (NVL(p.PROS_PREMIUM, 0) + NVL((SELECT SUM(r.PRIDER_PREMIUM) FROM TBL_PROSPECT_RIDER r WHERE r.PROS_UID = p.PROS_UID), 0)) AS TOTAL_PREMIUM
        FROM TBL_PROSPECTS p
        LEFT JOIN MTBL_PRODUCT prod ON p.PROS_PLAN = prod.PROD_CODE
        WHERE 1=1
      `;

      const binds: Record<string, any> = {};

      if (search && search.trim() !== '') {
        sql += ` AND (UPPER(p.PROS_FULL_NAME) LIKE :search OR UPPER(p.PROS_PLAN) LIKE :search OR TO_CHAR(p.PROS_UID) LIKE :search)`;
        binds.search = `%${search.trim().toUpperCase()}%`;
      }

      if (plan && plan.trim() !== '') {
        sql += ` AND p.PROS_PLAN = :plan`;
        binds.plan = plan.trim();
      }

      sql += ` ORDER BY p.PROS_UID DESC`;

      const result = await connection.execute<ProspectRecord>(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      });

      return result.rows || [];
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Find single prospect quote by PROS_UID including all attached riders
   */
  async findByUid(prosUid: number): Promise<ProspectDetail | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const prosSql = `
        SELECT 
          p.PROS_UID,
          p.PROS_FULL_NAME,
          TO_CHAR(p.PROS_DOB, 'YYYY-MM-DD') AS PROS_DOB,
          p.PROS_AGE,
          p.PROS_GENDER,
          p.PROS_ANN_SALARY,
          p.PROS_PLAN,
          p.PROS_TERM,
          p.PROS_SUM_ASSURED,
          p.PROS_PREMIUM,
          p.PROS_CREATED_BY,
          TO_CHAR(p.PROS_CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS PROS_CREATED_ON,
          prod.PROD_NAME AS PLAN_NAME,
          (NVL(p.PROS_PREMIUM, 0) + NVL((SELECT SUM(r.PRIDER_PREMIUM) FROM TBL_PROSPECT_RIDER r WHERE r.PROS_UID = p.PROS_UID), 0)) AS TOTAL_PREMIUM
        FROM TBL_PROSPECTS p
        LEFT JOIN MTBL_PRODUCT prod ON p.PROS_PLAN = prod.PROD_CODE
        WHERE p.PROS_UID = :prosUid
      `;

      const prosResult = await connection.execute<ProspectRecord>(
        prosSql,
        { prosUid },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (!prosResult.rows || prosResult.rows.length === 0) {
        return null;
      }

      const prospect = prosResult.rows[0];

      // Fetch riders
      const riderSql = `
        SELECT 
          r.PRIDER_UID,
          r.PROS_UID,
          r.PRIDER_CODE,
          r.PRIDER_NAME,
          r.PRIDER_SUM_ASSURED,
          r.PRIDER_PREMIUM,
          r.PRIDER_CREATED_BY,
          TO_CHAR(r.PRIDER_CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS PRIDER_CREATED_ON
        FROM TBL_PROSPECT_RIDER r
        WHERE r.PROS_UID = :prosUid
        ORDER BY r.PRIDER_UID ASC
      `;

      const riderResult = await connection.execute<ProspectRiderRecord>(
        riderSql,
        { prosUid },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      return {
        ...prospect,
        RIDER_COUNT: riderResult.rows?.length || 0,
        riders: riderResult.rows || []
      };
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Create a new quote/prospect and associated riders in a single transaction
   */
  async create(input: CreateProspectInput, username: string): Promise<ProspectDetail> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      // 1. Get next UID from sequence
      const seqRes = await connection.execute<{ NEW_UID: number }>(
        `SELECT SEQ_PROS_UID.NEXTVAL AS NEW_UID FROM DUAL`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const prosUid = seqRes.rows![0].NEW_UID;

      // 2. Insert into TBL_PROSPECTS
      const insertSql = `
        INSERT INTO TBL_PROSPECTS (
          PROS_UID,
          PROS_FULL_NAME,
          PROS_DOB,
          PROS_AGE,
          PROS_GENDER,
          PROS_ANN_SALARY,
          PROS_PLAN,
          PROS_TERM,
          PROS_SUM_ASSURED,
          PROS_PREMIUM,
          PROS_CREATED_BY,
          PROS_CREATED_ON
        ) VALUES (
          :prosUid,
          :prosFullName,
          ${input.PROS_DOB ? `TO_DATE(:prosDob, 'YYYY-MM-DD')` : 'NULL'},
          :prosAge,
          :prosGender,
          :prosAnnSalary,
          :prosPlan,
          :prosTerm,
          :prosSumAssured,
          :prosPremium,
          :prosCreatedBy,
          SYSDATE
        )
      `;

      const binds: Record<string, any> = {
        prosUid,
        prosFullName: input.PROS_FULL_NAME.trim(),
        prosAge: input.PROS_AGE ?? null,
        prosGender: input.PROS_GENDER || 'M',
        prosAnnSalary: input.PROS_ANN_SALARY ?? null,
        prosPlan: input.PROS_PLAN.trim().toUpperCase(),
        prosTerm: input.PROS_TERM ?? null,
        prosSumAssured: input.PROS_SUM_ASSURED,
        prosPremium: input.PROS_PREMIUM ?? null,
        prosCreatedBy: username
      };

      if (input.PROS_DOB) binds.prosDob = input.PROS_DOB;

      await connection.execute(insertSql, binds, { autoCommit: false });

      // 3. Insert riders if any
      if (input.riders && input.riders.length > 0) {
        const riderInsertSql = `
          INSERT INTO TBL_PROSPECT_RIDER (
            PRIDER_UID,
            PROS_UID,
            PRIDER_CODE,
            PRIDER_NAME,
            PRIDER_SUM_ASSURED,
            PRIDER_PREMIUM,
            PRIDER_CREATED_BY,
            PRIDER_CREATED_ON
          ) VALUES (
            SEQ_PRIDER_UID.NEXTVAL,
            :prosUid,
            :priderCode,
            :priderName,
            :priderSumAssured,
            :priderPremium,
            :priderCreatedBy,
            SYSDATE
          )
        `;

        for (const rider of input.riders) {
          if (!rider.PRIDER_CODE) continue;
          await connection.execute(
            riderInsertSql,
            {
              prosUid,
              priderCode: rider.PRIDER_CODE.trim().toUpperCase(),
              priderName: rider.PRIDER_NAME || rider.PRIDER_CODE,
              priderSumAssured: rider.PRIDER_SUM_ASSURED ?? null,
              priderPremium: rider.PRIDER_PREMIUM ?? null,
              priderCreatedBy: username
            },
            { autoCommit: false }
          );
        }
      }

      await connection.commit();

      const created = await this.findByUid(prosUid);
      if (!created) {
        throw new Error('Failed to retrieve newly created quote');
      }
      return created;
    } catch (err) {
      if (connection) {
        try {
          await connection.rollback();
        } catch {}
      }
      throw err;
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Update an existing prospect quote and its attached riders
   */
  async update(prosUid: number, input: UpdateProspectInput, username: string): Promise<ProspectDetail> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const updateSql = `
        UPDATE TBL_PROSPECTS SET
          PROS_FULL_NAME = :prosFullName,
          PROS_DOB = ${input.PROS_DOB ? `TO_DATE(:prosDob, 'YYYY-MM-DD')` : 'NULL'},
          PROS_AGE = :prosAge,
          PROS_GENDER = :prosGender,
          PROS_ANN_SALARY = :prosAnnSalary,
          PROS_PLAN = :prosPlan,
          PROS_TERM = :prosTerm,
          PROS_SUM_ASSURED = :prosSumAssured,
          PROS_PREMIUM = :prosPremium
        WHERE PROS_UID = :prosUid
      `;

      const binds: Record<string, any> = {
        prosUid,
        prosFullName: input.PROS_FULL_NAME.trim(),
        prosAge: input.PROS_AGE ?? null,
        prosGender: input.PROS_GENDER || 'M',
        prosAnnSalary: input.PROS_ANN_SALARY ?? null,
        prosPlan: input.PROS_PLAN.trim().toUpperCase(),
        prosTerm: input.PROS_TERM ?? null,
        prosSumAssured: input.PROS_SUM_ASSURED,
        prosPremium: input.PROS_PREMIUM ?? null
      };

      if (input.PROS_DOB) binds.prosDob = input.PROS_DOB;

      await connection.execute(updateSql, binds, { autoCommit: false });

      // Synchronize riders if array provided
      if (input.riders !== undefined) {
        // Delete existing riders
        await connection.execute(
          `DELETE FROM TBL_PROSPECT_RIDER WHERE PROS_UID = :prosUid`,
          { prosUid },
          { autoCommit: false }
        );

        // Re-insert updated riders
        const riderInsertSql = `
          INSERT INTO TBL_PROSPECT_RIDER (
            PRIDER_UID,
            PROS_UID,
            PRIDER_CODE,
            PRIDER_NAME,
            PRIDER_SUM_ASSURED,
            PRIDER_PREMIUM,
            PRIDER_CREATED_BY,
            PRIDER_CREATED_ON
          ) VALUES (
            SEQ_PRIDER_UID.NEXTVAL,
            :prosUid,
            :priderCode,
            :priderName,
            :priderSumAssured,
            :priderPremium,
            :priderCreatedBy,
            SYSDATE
          )
        `;

        for (const rider of input.riders) {
          if (!rider.PRIDER_CODE) continue;
          await connection.execute(
            riderInsertSql,
            {
              prosUid,
              priderCode: rider.PRIDER_CODE.trim().toUpperCase(),
              priderName: rider.PRIDER_NAME || rider.PRIDER_CODE,
              priderSumAssured: rider.PRIDER_SUM_ASSURED ?? null,
              priderPremium: rider.PRIDER_PREMIUM ?? null,
              priderCreatedBy: username
            },
            { autoCommit: false }
          );
        }
      }

      await connection.commit();

      const updated = await this.findByUid(prosUid);
      if (!updated) {
        throw new Error('Failed to retrieve updated quote');
      }
      return updated;
    } catch (err) {
      if (connection) {
        try {
          await connection.rollback();
        } catch {}
      }
      throw err;
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Delete a quote and its attached riders
   */
  async delete(prosUid: number): Promise<boolean> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      // Delete child riders first
      await connection.execute(
        `DELETE FROM TBL_PROSPECT_RIDER WHERE PROS_UID = :prosUid`,
        { prosUid },
        { autoCommit: false }
      );

      // Delete parent quote
      const res = await connection.execute(
        `DELETE FROM TBL_PROSPECTS WHERE PROS_UID = :prosUid`,
        { prosUid },
        { autoCommit: false }
      );

      await connection.commit();
      return (res.rowsAffected || 0) > 0;
    } catch (err) {
      if (connection) {
        try {
          await connection.rollback();
        } catch {}
      }
      throw err;
    } finally {
      await releaseConnection(connection);
    }
  }
};
