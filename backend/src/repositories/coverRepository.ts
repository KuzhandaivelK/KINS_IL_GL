import oracledb from 'oracledb';
import { getConnection, releaseConnection } from '../config/database';
import {
  OracleCoverRecord,
  CoverTypeOption,
  CoverListItem,
  CreateCoverInput,
  UpdateCoverInput
} from '../types/cover';

export class CoverRepository {
  /**
   * Retrieves all cover types from STBL_CODE where CODE = 'CVR_TYPE'
   */
  async getCoverTypes(): Promise<CoverTypeOption[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const sql = `
        SELECT CODE_SUB_CODE, CODE_SUB_CODE_DESC 
        FROM STBL_CODE 
        WHERE CODE = 'CVR_TYPE'
        ORDER BY CODE_SUB_CODE_DESC ASC
      `;
      const result = await connection.execute<any>(sql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (!result.rows) return [];

      return result.rows.map((row) => ({
        code: row.CODE_SUB_CODE,
        description: row.CODE_SUB_CODE_DESC || row.CODE_SUB_CODE
      }));
    } finally {
      await releaseConnection(connection);
    }
  }

  /**
   * Retrieves all covers with optional search, type filter, and active status
   */
  async findAll(search?: string, type?: string, activeOnly?: boolean): Promise<CoverListItem[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      let sql = `
        SELECT 
          c.COVER_CODE,
          c.COVER_DESC,
          c.COVER_L1_DESC,
          c.COVER_TYPE,
          s.CODE_SUB_CODE_DESC AS COVER_TYPE_DESC,
          NVL(c.COVER_ACTIVE_YN, 'Y') AS COVER_ACTIVE_YN,
          NVL(c.COVER_APP_ON_BASIC_RATE, 'N') AS COVER_APP_ON_BASIC_RATE,
          c.COVER_FM_DT,
          c.COVER_TO_DT,
          c.COVER_MIN_SA,
          c.COVER_MAX_SA,
          c.COVER_RATE_APPLIED_ON,
          c.COVER_SA_PERC,
          c.COVER_SA_CALC,
          c.COVER_CREATED_AT,
          c.COVER_CREATED_BY,
          c.COVER_MODIFIED_AT,
          c.COVER_MODIFIED_BY
        FROM MTBL_COVER c
        LEFT JOIN STBL_CODE s 
          ON s.CODE = 'CVR_TYPE' AND s.CODE_SUB_CODE = c.COVER_TYPE
        WHERE 1=1
      `;

      const binds: Record<string, any> = {};

      if (activeOnly) {
        sql += ` AND NVL(c.COVER_ACTIVE_YN, 'Y') = 'Y'`;
      }

      if (type && type.trim()) {
        sql += ` AND c.COVER_TYPE = :type`;
        binds.type = type.trim();
      }

      if (search && search.trim()) {
        sql += ` AND (LOWER(c.COVER_CODE) LIKE :search OR LOWER(c.COVER_DESC) LIKE :search OR LOWER(c.COVER_L1_DESC) LIKE :search)`;
        binds.search = `%${search.trim().toLowerCase()}%`;
      }

      sql += ` ORDER BY c.COVER_CODE ASC`;

      const result = await connection.execute<any>(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (!result.rows) return [];

      return result.rows.map((row) => ({
        coverCode: row.COVER_CODE,
        coverDesc: row.COVER_DESC || row.COVER_CODE,
        coverL1Desc: row.COVER_L1_DESC || null,
        coverType: row.COVER_TYPE || null,
        coverTypeDesc: row.COVER_TYPE_DESC || null,
        activeYn: (row.COVER_ACTIVE_YN === 'N' ? 'N' : 'Y') as 'Y' | 'N',
        appOnBasicRate: (row.COVER_APP_ON_BASIC_RATE === 'Y' ? 'Y' : 'N') as 'Y' | 'N',
        fromDate: row.COVER_FM_DT || null,
        toDate: row.COVER_TO_DT || null,
        minSa: row.COVER_MIN_SA !== null ? Number(row.COVER_MIN_SA) : null,
        maxSa: row.COVER_MAX_SA !== null ? Number(row.COVER_MAX_SA) : null,
        rateAppliedOn: row.COVER_RATE_APPLIED_ON || null,
        saPerc: row.COVER_SA_PERC !== null ? Number(row.COVER_SA_PERC) : null,
        saCalc: row.COVER_SA_CALC || null,
        createdAt: row.COVER_CREATED_AT || null,
        createdBy: row.COVER_CREATED_BY || null,
        modifiedAt: row.COVER_MODIFIED_AT || null,
        modifiedBy: row.COVER_MODIFIED_BY || null
      }));
    } finally {
      await releaseConnection(connection);
    }
  }

  /**
   * Retrieves single cover by COVER_CODE
   */
  async findByCode(coverCode: string): Promise<CoverListItem | null> {
    const list = await this.findAll(coverCode);
    const found = list.find((c) => c.coverCode.toUpperCase() === coverCode.toUpperCase().trim());
    return found || null;
  }

  /**
   * Creates a new cover in MTBL_COVER
   */
  async create(input: CreateCoverInput): Promise<CoverListItem> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const sql = `
        INSERT INTO MTBL_COVER (
          COVER_CODE,
          COVER_DESC,
          COVER_L1_DESC,
          COVER_TYPE,
          COVER_ACTIVE_YN,
          COVER_APP_ON_BASIC_RATE,
          COVER_FM_DT,
          COVER_TO_DT,
          COVER_MIN_SA,
          COVER_MAX_SA,
          COVER_RATE_APPLIED_ON,
          COVER_SA_PERC,
          COVER_SA_CALC,
          COVER_CREATED_AT,
          COVER_CREATED_BY
        ) VALUES (
          :coverCode,
          :coverDesc,
          :coverL1Desc,
          :coverType,
          :activeYn,
          :appOnBasicRate,
          ${input.fromDate ? "TO_DATE(:fromDate, 'YYYY-MM-DD')" : 'NULL'},
          ${input.toDate ? "TO_DATE(:toDate, 'YYYY-MM-DD')" : 'NULL'},
          :minSa,
          :maxSa,
          :rateAppliedOn,
          :saPerc,
          :saCalc,
          SYSDATE,
          :createdBy
        )
      `;

      const binds: Record<string, any> = {
        coverCode: input.coverCode.toUpperCase().trim(),
        coverDesc: input.coverDesc.trim(),
        coverL1Desc: input.coverL1Desc ? input.coverL1Desc.trim() : null,
        coverType: input.coverType ? input.coverType.trim() : null,
        activeYn: input.activeYn || 'Y',
        appOnBasicRate: input.appOnBasicRate || 'N',
        minSa: input.minSa !== undefined && input.minSa !== null ? input.minSa : null,
        maxSa: input.maxSa !== undefined && input.maxSa !== null ? input.maxSa : null,
        rateAppliedOn: input.rateAppliedOn ? input.rateAppliedOn.trim() : null,
        saPerc: input.saPerc !== undefined && input.saPerc !== null ? input.saPerc : null,
        saCalc: input.saCalc ? input.saCalc.trim() : null,
        createdBy: input.createdBy || 'ADMIN'
      };

      if (input.fromDate) binds.fromDate = input.fromDate.slice(0, 10);
      if (input.toDate) binds.toDate = input.toDate.slice(0, 10);

      await connection.execute(sql, binds, { autoCommit: true });

      const created = await this.findByCode(input.coverCode.toUpperCase().trim());
      if (!created) {
        throw new Error(`Failed to retrieve cover after insert: ${input.coverCode}`);
      }
      return created;
    } finally {
      await releaseConnection(connection);
    }
  }

  /**
   * Updates an existing cover in MTBL_COVER
   */
  async update(coverCode: string, input: UpdateCoverInput): Promise<CoverListItem> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const setClauses: string[] = ['COVER_MODIFIED_AT = SYSDATE', 'COVER_MODIFIED_BY = :modifiedBy'];
      const binds: Record<string, any> = {
        coverCode: coverCode.toUpperCase().trim(),
        modifiedBy: input.modifiedBy || 'ADMIN'
      };

      if (input.coverDesc !== undefined) {
        setClauses.push('COVER_DESC = :coverDesc');
        binds.coverDesc = input.coverDesc.trim();
      }
      if (input.coverL1Desc !== undefined) {
        setClauses.push('COVER_L1_DESC = :coverL1Desc');
        binds.coverL1Desc = input.coverL1Desc ? input.coverL1Desc.trim() : null;
      }
      if (input.coverType !== undefined) {
        setClauses.push('COVER_TYPE = :coverType');
        binds.coverType = input.coverType ? input.coverType.trim() : null;
      }
      if (input.activeYn !== undefined) {
        setClauses.push('COVER_ACTIVE_YN = :activeYn');
        binds.activeYn = input.activeYn;
      }
      if (input.appOnBasicRate !== undefined) {
        setClauses.push('COVER_APP_ON_BASIC_RATE = :appOnBasicRate');
        binds.appOnBasicRate = input.appOnBasicRate;
      }
      if (input.minSa !== undefined) {
        setClauses.push('COVER_MIN_SA = :minSa');
        binds.minSa = input.minSa !== null ? input.minSa : null;
      }
      if (input.maxSa !== undefined) {
        setClauses.push('COVER_MAX_SA = :maxSa');
        binds.maxSa = input.maxSa !== null ? input.maxSa : null;
      }
      if (input.rateAppliedOn !== undefined) {
        setClauses.push('COVER_RATE_APPLIED_ON = :rateAppliedOn');
        binds.rateAppliedOn = input.rateAppliedOn ? input.rateAppliedOn.trim() : null;
      }
      if (input.saPerc !== undefined) {
        setClauses.push('COVER_SA_PERC = :saPerc');
        binds.saPerc = input.saPerc !== null ? input.saPerc : null;
      }
      if (input.saCalc !== undefined) {
        setClauses.push('COVER_SA_CALC = :saCalc');
        binds.saCalc = input.saCalc ? input.saCalc.trim() : null;
      }

      if (input.fromDate !== undefined) {
        if (input.fromDate) {
          setClauses.push("COVER_FM_DT = TO_DATE(:fromDate, 'YYYY-MM-DD')");
          binds.fromDate = input.fromDate.slice(0, 10);
        } else {
          setClauses.push('COVER_FM_DT = NULL');
        }
      }

      if (input.toDate !== undefined) {
        if (input.toDate) {
          setClauses.push("COVER_TO_DT = TO_DATE(:toDate, 'YYYY-MM-DD')");
          binds.toDate = input.toDate.slice(0, 10);
        } else {
          setClauses.push('COVER_TO_DT = NULL');
        }
      }

      const sql = `
        UPDATE MTBL_COVER
        SET ${setClauses.join(', ')}
        WHERE COVER_CODE = :coverCode
      `;

      await connection.execute(sql, binds, { autoCommit: true });

      const updated = await this.findByCode(coverCode);
      if (!updated) {
        throw new Error(`Cover '${coverCode}' not found after update`);
      }
      return updated;
    } finally {
      await releaseConnection(connection);
    }
  }

  /**
   * Deletes a cover from MTBL_COVER
   */
  async delete(coverCode: string): Promise<boolean> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const sql = `DELETE FROM MTBL_COVER WHERE COVER_CODE = :coverCode`;
      const result = await connection.execute(
        sql,
        { coverCode: coverCode.toUpperCase().trim() },
        { autoCommit: true }
      );
      return (result.rowsAffected || 0) > 0;
    } finally {
      await releaseConnection(connection);
    }
  }
}

export const coverRepository = new CoverRepository();
