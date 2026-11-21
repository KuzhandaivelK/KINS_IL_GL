import oracledb from 'oracledb';
import { getConnection, releaseConnection } from '../config/database';
import {
  ProductRecord,
  ProdCoverRecord,
  ProductWithCovers,
  CreateProductInput,
  UpdateProductInput
} from '../types/product';

export const productRepository = {
  /**
   * List all products with their attached cover count and optional search / type filter
   */
  async findAll(search?: string, prodType?: string, lob?: string): Promise<ProductRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      let sql = `
        SELECT 
          p.PROD_CODE,
          p.PROD_NAME,
          p.PROD_TYPE,
          p.PROD_TERM_FM,
          p.PROD_TERM_TO,
          p.PROD_MIN_AGE,
          p.PROD_MAX_AGE,
          p.PROD_AGE_CALC_MTHD,
          p.PROD_JOINT_LIFE_YN,
          p.PROD_PERIOD_MULTIPLE,
          TO_CHAR(p.PROD_VALID_FM_DT, 'YYYY-MM-DD') AS PROD_VALID_FM_DT,
          TO_CHAR(p.PROD_VALID_TO_DT, 'YYYY-MM-DD') AS PROD_VALID_TO_DT,
          p.PROD_COOLOFF_DAYS,
          p.PROD_MIN_SA,
          p.PROD_MAX_SA,
          p.PROD_COMM_CODE,
          p.PROD_SURR_YN,
          p.PROD_SURR_YEARS,
          p.PROD_LOAN_YN,
          p.PROD_MAT_YN,
          p.PROD_WITHDRAW_YN,
          NVL(p.PROD_LOB, 'IL') AS PROD_LOB,
          p.PROD_CREATED_BY,
          TO_CHAR(p.PROD_CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS PROD_CREATED_ON,
          p.PROD_MODIFIED_BY,
          TO_CHAR(p.PROD_MODIFIED_ON, 'YYYY-MM-DD HH24:MI:SS') AS PROD_MODIFIED_ON,
          (SELECT COUNT(1) FROM MTBL_PROD_COVER pc WHERE pc.MPC_PROD_CODE = p.PROD_CODE) AS ATTACHED_COVERS_COUNT
        FROM MTBL_PRODUCT p
        WHERE 1=1
      `;

      const binds: Record<string, any> = {};

      if (search && search.trim() !== '') {
        sql += ` AND (UPPER(p.PROD_CODE) LIKE :search OR UPPER(p.PROD_NAME) LIKE :search)`;
        binds.search = `%${search.trim().toUpperCase()}%`;
      }

      if (prodType && prodType.trim() !== '') {
        sql += ` AND p.PROD_TYPE = :prodType`;
        binds.prodType = prodType.trim();
      }

      if (lob && lob.trim() !== '') {
        sql += ` AND (p.PROD_LOB = :lob OR p.PROD_LOB = 'BOTH')`;
        binds.lob = lob.trim().toUpperCase();
      }

      sql += ` ORDER BY p.PROD_CODE ASC`;

      const result = await connection.execute<ProductRecord>(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      });

      return result.rows || [];
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Find product by code including all attached covers
   */
  async findByCode(prodCode: string): Promise<ProductWithCovers | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const prodSql = `
        SELECT 
          p.PROD_CODE,
          p.PROD_NAME,
          p.PROD_TYPE,
          p.PROD_TERM_FM,
          p.PROD_TERM_TO,
          p.PROD_MIN_AGE,
          p.PROD_MAX_AGE,
          p.PROD_AGE_CALC_MTHD,
          p.PROD_JOINT_LIFE_YN,
          p.PROD_PERIOD_MULTIPLE,
          TO_CHAR(p.PROD_VALID_FM_DT, 'YYYY-MM-DD') AS PROD_VALID_FM_DT,
          TO_CHAR(p.PROD_VALID_TO_DT, 'YYYY-MM-DD') AS PROD_VALID_TO_DT,
          p.PROD_COOLOFF_DAYS,
          p.PROD_MIN_SA,
          p.PROD_MAX_SA,
          p.PROD_COMM_CODE,
          p.PROD_SURR_YN,
          p.PROD_SURR_YEARS,
          p.PROD_LOAN_YN,
          p.PROD_MAT_YN,
          p.PROD_WITHDRAW_YN,
          NVL(p.PROD_LOB, 'IL') AS PROD_LOB,
          p.PROD_CREATED_BY,
          TO_CHAR(p.PROD_CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS PROD_CREATED_ON,
          p.PROD_MODIFIED_BY,
          TO_CHAR(p.PROD_MODIFIED_ON, 'YYYY-MM-DD HH24:MI:SS') AS PROD_MODIFIED_ON
        FROM MTBL_PRODUCT p
        WHERE p.PROD_CODE = :prodCode
      `;

      const prodResult = await connection.execute<ProductRecord>(
        prodSql,
        { prodCode },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (!prodResult.rows || prodResult.rows.length === 0) {
        return null;
      }

      const product = prodResult.rows[0];

      // Fetch covers with details from MTBL_COVER
      const coversSql = `
        SELECT 
          pc.MPC_PROD_CODE,
          pc.MPC_COVER_CODE,
          pc.MPC_DEFAULT_YN,
          pc.MPC_MANDATORY_YN,
          pc.MPC_MAX_AGE_ON_MAT,
          pc.MPC_PERIOD,
          pc.MPC_PREM_PAY_YRS,
          pc.MPC_CREATED_BY,
          TO_CHAR(pc.MPC_CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS MPC_CREATED_ON,
          pc.MPC_MODIFIED_BY,
          TO_CHAR(pc.MPC_MODIFIED_ON, 'YYYY-MM-DD HH24:MI:SS') AS MPC_MODIFIED_ON,
          c.COVER_DESC,
          c.COVER_TYPE
        FROM MTBL_PROD_COVER pc
        LEFT JOIN MTBL_COVER c ON pc.MPC_COVER_CODE = c.COVER_CODE
        WHERE pc.MPC_PROD_CODE = :prodCode
        ORDER BY pc.MPC_MANDATORY_YN DESC, pc.MPC_COVER_CODE ASC
      `;

      const coversResult = await connection.execute<ProdCoverRecord>(
        coversSql,
        { prodCode },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      return {
        ...product,
        covers: coversResult.rows || []
      };
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Check if a product code already exists
   */
  async checkExists(prodCode: string): Promise<boolean> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const sql = `SELECT 1 AS CNT FROM MTBL_PRODUCT WHERE PROD_CODE = :prodCode`;
      const res = await connection.execute<{ CNT: number }>(
        sql,
        { prodCode },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return !!(res.rows && res.rows.length > 0);
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Create a new product and its associated covers within a single transaction
   */
  async create(input: CreateProductInput, username: string): Promise<ProductWithCovers> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const prodSql = `
        INSERT INTO MTBL_PRODUCT (
          PROD_CODE,
          PROD_NAME,
          PROD_TYPE,
          PROD_TERM_FM,
          PROD_TERM_TO,
          PROD_MIN_AGE,
          PROD_MAX_AGE,
          PROD_AGE_CALC_MTHD,
          PROD_JOINT_LIFE_YN,
          PROD_PERIOD_MULTIPLE,
          PROD_VALID_FM_DT,
          PROD_VALID_TO_DT,
          PROD_COOLOFF_DAYS,
          PROD_MIN_SA,
          PROD_MAX_SA,
          PROD_COMM_CODE,
          PROD_SURR_YN,
          PROD_SURR_YEARS,
          PROD_LOAN_YN,
          PROD_MAT_YN,
          PROD_WITHDRAW_YN,
          PROD_LOB,
          PROD_CREATED_BY,
          PROD_CREATED_ON
        ) VALUES (
          :prodCode,
          :prodName,
          :prodType,
          :prodTermFm,
          :prodTermTo,
          :prodMinAge,
          :prodMaxAge,
          :prodAgeCalcMthd,
          :prodJointLifeYn,
          :prodPeriodMultiple,
          ${input.PROD_VALID_FM_DT ? `TO_DATE(:prodValidFmDt, 'YYYY-MM-DD')` : 'NULL'},
          ${input.PROD_VALID_TO_DT ? `TO_DATE(:prodValidToDt, 'YYYY-MM-DD')` : 'NULL'},
          :prodCooloffDays,
          :prodMinSa,
          :prodMaxSa,
          :prodCommCode,
          :prodSurrYn,
          :prodSurrYears,
          :prodLoanYn,
          :prodMatYn,
          :prodWithdrawYn,
          :prodLob,
          :prodCreatedBy,
          SYSDATE
        )
      `;

      const prodBinds: Record<string, any> = {
        prodCode: input.PROD_CODE.trim().toUpperCase(),
        prodName: input.PROD_NAME.trim(),
        prodType: input.PROD_TYPE || 'T',
        prodTermFm: input.PROD_TERM_FM ?? null,
        prodTermTo: input.PROD_TERM_TO ?? null,
        prodMinAge: input.PROD_MIN_AGE ?? null,
        prodMaxAge: input.PROD_MAX_AGE ?? null,
        prodAgeCalcMthd: input.PROD_AGE_CALC_MTHD || 'ANB',
        prodJointLifeYn: input.PROD_JOINT_LIFE_YN || 'N',
        prodPeriodMultiple: input.PROD_PERIOD_MULTIPLE ?? 1,
        prodCooloffDays: input.PROD_COOLOFF_DAYS ?? 15,
        prodMinSa: input.PROD_MIN_SA ?? null,
        prodMaxSa: input.PROD_MAX_SA ?? null,
        prodCommCode: input.PROD_COMM_CODE || null,
        prodSurrYn: input.PROD_SURR_YN || 'N',
        prodSurrYears: input.PROD_SURR_YEARS ?? null,
        prodLoanYn: input.PROD_LOAN_YN || 'N',
        prodMatYn: input.PROD_MAT_YN || 'N',
        prodWithdrawYn: input.PROD_WITHDRAW_YN || 'N',
        prodLob: input.PROD_LOB || 'IL',
        prodCreatedBy: username
      };

      if (input.PROD_VALID_FM_DT) prodBinds.prodValidFmDt = input.PROD_VALID_FM_DT;
      if (input.PROD_VALID_TO_DT) prodBinds.prodValidToDt = input.PROD_VALID_TO_DT;

      await connection.execute(prodSql, prodBinds, { autoCommit: false });

      // Insert attached covers
      if (input.covers && input.covers.length > 0) {
        const coverInsertSql = `
          INSERT INTO MTBL_PROD_COVER (
            MPC_PROD_CODE,
            MPC_COVER_CODE,
            MPC_DEFAULT_YN,
            MPC_MANDATORY_YN,
            MPC_MAX_AGE_ON_MAT,
            MPC_PERIOD,
            MPC_PREM_PAY_YRS,
            MPC_CREATED_BY,
            MPC_CREATED_ON
          ) VALUES (
            :mpcProdCode,
            :mpcCoverCode,
            :mpcDefaultYn,
            :mpcMandatoryYn,
            :mpcMaxAgeOnMat,
            :mpcPeriod,
            :mpcPremPayYrs,
            :mpcCreatedBy,
            SYSDATE
          )
        `;

        for (const cover of input.covers) {
          if (!cover.MPC_COVER_CODE) continue;
          await connection.execute(
            coverInsertSql,
            {
              mpcProdCode: input.PROD_CODE.trim().toUpperCase(),
              mpcCoverCode: cover.MPC_COVER_CODE.trim().toUpperCase(),
              mpcDefaultYn: cover.MPC_DEFAULT_YN || 'Y',
              mpcMandatoryYn: cover.MPC_MANDATORY_YN || 'Y',
              mpcMaxAgeOnMat: cover.MPC_MAX_AGE_ON_MAT ?? null,
              mpcPeriod: cover.MPC_PERIOD ?? null,
              mpcPremPayYrs: cover.MPC_PREM_PAY_YRS ?? null,
              mpcCreatedBy: username
            },
            { autoCommit: false }
          );
        }
      }

      await connection.commit();
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

    const created = await this.findByCode(input.PROD_CODE.trim().toUpperCase());
    if (!created) {
      throw new Error('Failed to retrieve newly created product');
    }
    return created;
  },

  /**
   * Update product and synchronize attached covers
   */
  async update(prodCode: string, input: UpdateProductInput, username: string): Promise<ProductWithCovers> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const prodSql = `
        UPDATE MTBL_PRODUCT SET
          PROD_NAME = :prodName,
          PROD_TYPE = :prodType,
          PROD_TERM_FM = :prodTermFm,
          PROD_TERM_TO = :prodTermTo,
          PROD_MIN_AGE = :prodMinAge,
          PROD_MAX_AGE = :prodMaxAge,
          PROD_AGE_CALC_MTHD = :prodAgeCalcMthd,
          PROD_JOINT_LIFE_YN = :prodJointLifeYn,
          PROD_PERIOD_MULTIPLE = :prodPeriodMultiple,
          PROD_VALID_FM_DT = ${input.PROD_VALID_FM_DT ? `TO_DATE(:prodValidFmDt, 'YYYY-MM-DD')` : 'NULL'},
          PROD_VALID_TO_DT = ${input.PROD_VALID_TO_DT ? `TO_DATE(:prodValidToDt, 'YYYY-MM-DD')` : 'NULL'},
          PROD_COOLOFF_DAYS = :prodCooloffDays,
          PROD_MIN_SA = :prodMinSa,
          PROD_MAX_SA = :prodMaxSa,
          PROD_COMM_CODE = :prodCommCode,
          PROD_SURR_YN = :prodSurrYn,
          PROD_SURR_YEARS = :prodSurrYears,
          PROD_LOAN_YN = :prodLoanYn,
          PROD_MAT_YN = :prodMatYn,
          PROD_WITHDRAW_YN = :prodWithdrawYn,
          PROD_MODIFIED_BY = :prodModifiedBy,
          PROD_MODIFIED_ON = SYSDATE
        WHERE PROD_CODE = :prodCode
      `;

      const prodBinds: Record<string, any> = {
        prodCode,
        prodName: input.PROD_NAME.trim(),
        prodType: input.PROD_TYPE || 'T',
        prodTermFm: input.PROD_TERM_FM ?? null,
        prodTermTo: input.PROD_TERM_TO ?? null,
        prodMinAge: input.PROD_MIN_AGE ?? null,
        prodMaxAge: input.PROD_MAX_AGE ?? null,
        prodAgeCalcMthd: input.PROD_AGE_CALC_MTHD || 'ANB',
        prodJointLifeYn: input.PROD_JOINT_LIFE_YN || 'N',
        prodPeriodMultiple: input.PROD_PERIOD_MULTIPLE ?? 1,
        prodCooloffDays: input.PROD_COOLOFF_DAYS ?? 15,
        prodMinSa: input.PROD_MIN_SA ?? null,
        prodMaxSa: input.PROD_MAX_SA ?? null,
        prodCommCode: input.PROD_COMM_CODE || null,
        prodSurrYn: input.PROD_SURR_YN || 'N',
        prodSurrYears: input.PROD_SURR_YEARS ?? null,
        prodLoanYn: input.PROD_LOAN_YN || 'N',
        prodMatYn: input.PROD_MAT_YN || 'N',
        prodWithdrawYn: input.PROD_WITHDRAW_YN || 'N',
        prodModifiedBy: username
      };

      if (input.PROD_VALID_FM_DT) prodBinds.prodValidFmDt = input.PROD_VALID_FM_DT;
      if (input.PROD_VALID_TO_DT) prodBinds.prodValidToDt = input.PROD_VALID_TO_DT;

      await connection.execute(prodSql, prodBinds, { autoCommit: false });

      // If covers array is provided, replace attached covers
      if (input.covers !== undefined) {
        // Delete current covers
        await connection.execute(
          `DELETE FROM MTBL_PROD_COVER WHERE MPC_PROD_CODE = :prodCode`,
          { prodCode },
          { autoCommit: false }
        );

        // Insert updated covers
        const coverInsertSql = `
          INSERT INTO MTBL_PROD_COVER (
            MPC_PROD_CODE,
            MPC_COVER_CODE,
            MPC_DEFAULT_YN,
            MPC_MANDATORY_YN,
            MPC_MAX_AGE_ON_MAT,
            MPC_PERIOD,
            MPC_PREM_PAY_YRS,
            MPC_CREATED_BY,
            MPC_CREATED_ON
          ) VALUES (
            :mpcProdCode,
            :mpcCoverCode,
            :mpcDefaultYn,
            :mpcMandatoryYn,
            :mpcMaxAgeOnMat,
            :mpcPeriod,
            :mpcPremPayYrs,
            :mpcCreatedBy,
            SYSDATE
          )
        `;

        for (const cover of input.covers) {
          if (!cover.MPC_COVER_CODE) continue;
          await connection.execute(
            coverInsertSql,
            {
              mpcProdCode: prodCode,
              mpcCoverCode: cover.MPC_COVER_CODE.trim().toUpperCase(),
              mpcDefaultYn: cover.MPC_DEFAULT_YN || 'Y',
              mpcMandatoryYn: cover.MPC_MANDATORY_YN || 'Y',
              mpcMaxAgeOnMat: cover.MPC_MAX_AGE_ON_MAT ?? null,
              mpcPeriod: cover.MPC_PERIOD ?? null,
              mpcPremPayYrs: cover.MPC_PREM_PAY_YRS ?? null,
              mpcCreatedBy: username
            },
            { autoCommit: false }
          );
        }
      }

      await connection.commit();
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

    const updated = await this.findByCode(prodCode);
    if (!updated) {
      throw new Error('Failed to retrieve updated product');
    }
    return updated;
  },

  /**
   * Delete product and its covers
   */
  async delete(prodCode: string): Promise<boolean> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      // Delete child covers first
      await connection.execute(
        `DELETE FROM MTBL_PROD_COVER WHERE MPC_PROD_CODE = :prodCode`,
        { prodCode },
        { autoCommit: false }
      );

      // Delete parent product
      const res = await connection.execute(
        `DELETE FROM MTBL_PRODUCT WHERE PROD_CODE = :prodCode`,
        { prodCode },
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
