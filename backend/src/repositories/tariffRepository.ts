import oracledb from 'oracledb';
import { getConnection, releaseConnection } from '../config/database';
import {
  TariffParamRecord,
  CreateTariffParamInput,
  UpdateTariffParamInput,
  TariffHeadRecord,
  CreateTariffHeadInput,
  UpdateTariffHeadInput,
  TariffDetailRecord,
  CreateTariffDetailInput,
  UpdateTariffDetailInput
} from '../types/tariff';

export class TariffRepository {
  // =========================================================================
  // 1. TARIFF PARAMETERS (M_LIFE_TARIFF_PARAM)
  // =========================================================================

  async getParams(): Promise<TariffParamRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const sql = `
        SELECT 
          MTP_SRNO,
          MTP_PARAM,
          MTP_PARAM_DESCRIPTION,
          MTP_DATA_TYPE,
          MTP_TABLE_NAME,
          MTP_COLUMN_NAME,
          MTP_WHERE_COND,
          SYS_CREATED_BY,
          SYS_CREATED_AT,
          SYS_MODIFIED_BY,
          SYS_MODIFIED_AT
        FROM M_LIFE_TARIFF_PARAM
        ORDER BY NVL(MTP_SRNO, 999) ASC, MTP_PARAM ASC
      `;

      const result = await connection.execute<any>(sql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (!result.rows) return [];

      return result.rows.map((row) => ({
        paramSrNo: row.MTP_SRNO || null,
        paramCode: row.MTP_PARAM,
        paramDescription: row.MTP_PARAM_DESCRIPTION || row.MTP_PARAM,
        dataType: row.MTP_DATA_TYPE || 'N',
        tableName: row.MTP_TABLE_NAME || null,
        columnName: row.MTP_COLUMN_NAME || null,
        whereCond: row.MTP_WHERE_COND || null,
        createdBy: row.SYS_CREATED_BY || null,
        createdAt: row.SYS_CREATED_AT || null,
        modifiedBy: row.SYS_MODIFIED_BY || null,
        modifiedAt: row.SYS_MODIFIED_AT || null
      }));
    } finally {
      await releaseConnection(connection);
    }
  }

  async createParam(input: CreateTariffParamInput): Promise<TariffParamRecord> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      // Determine next srno if not provided
      let srNo = input.paramSrNo;
      if (!srNo) {
        const srRes = await connection.execute<any>(`SELECT NVL(MAX(MTP_SRNO), 0) + 1 AS NEXT_SR FROM M_LIFE_TARIFF_PARAM`);
        srNo = srRes.rows && srRes.rows[0] ? srRes.rows[0].NEXT_SR : 1;
      }

      const sql = `
        INSERT INTO M_LIFE_TARIFF_PARAM (
          MTP_SRNO,
          MTP_PARAM,
          MTP_PARAM_DESCRIPTION,
          MTP_DATA_TYPE,
          MTP_TABLE_NAME,
          MTP_COLUMN_NAME,
          MTP_WHERE_COND,
          SYS_CREATED_BY,
          SYS_CREATED_AT
        ) VALUES (
          :srNo,
          :paramCode,
          :paramDesc,
          :dataType,
          :tableName,
          :columnName,
          :whereCond,
          :createdBy,
          SYSDATE
        )
      `;

      await connection.execute(
        sql,
        {
          srNo,
          paramCode: input.paramCode.toUpperCase().trim(),
          paramDesc: input.paramDescription.trim(),
          dataType: input.dataType || 'N',
          tableName: input.tableName ? input.tableName.trim() : null,
          columnName: input.columnName ? input.columnName.trim() : null,
          whereCond: input.whereCond ? input.whereCond.trim() : '1=1',
          createdBy: input.createdBy || 'ADMIN'
        },
        { autoCommit: true }
      );

      return {
        paramSrNo: srNo,
        paramCode: input.paramCode.toUpperCase().trim(),
        paramDescription: input.paramDescription.trim(),
        dataType: input.dataType || 'N',
        tableName: input.tableName || null,
        columnName: input.columnName || null,
        whereCond: input.whereCond || '1=1',
        createdBy: input.createdBy || 'ADMIN',
        createdAt: new Date()
      };
    } finally {
      await releaseConnection(connection);
    }
  }

  async updateParam(paramCode: string, input: UpdateTariffParamInput): Promise<TariffParamRecord> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const setClauses: string[] = ['SYS_MODIFIED_AT = SYSDATE', 'SYS_MODIFIED_BY = :modifiedBy'];
      const binds: Record<string, any> = {
        paramCode: paramCode.toUpperCase().trim(),
        modifiedBy: input.modifiedBy || 'ADMIN'
      };

      if (input.paramDescription !== undefined) {
        setClauses.push('MTP_PARAM_DESCRIPTION = :paramDesc');
        binds.paramDesc = input.paramDescription.trim();
      }
      if (input.dataType !== undefined) {
        setClauses.push('MTP_DATA_TYPE = :dataType');
        binds.dataType = input.dataType;
      }
      if (input.tableName !== undefined) {
        setClauses.push('MTP_TABLE_NAME = :tableName');
        binds.tableName = input.tableName ? input.tableName.trim() : null;
      }
      if (input.columnName !== undefined) {
        setClauses.push('MTP_COLUMN_NAME = :columnName');
        binds.columnName = input.columnName ? input.columnName.trim() : null;
      }
      if (input.whereCond !== undefined) {
        setClauses.push('MTP_WHERE_COND = :whereCond');
        binds.whereCond = input.whereCond ? input.whereCond.trim() : null;
      }

      const sql = `
        UPDATE M_LIFE_TARIFF_PARAM
        SET ${setClauses.join(', ')}
        WHERE MTP_PARAM = :paramCode
      `;

      await connection.execute(sql, binds, { autoCommit: true });

      const all = await this.getParams();
      const updated = all.find((p) => p.paramCode === paramCode.toUpperCase().trim());
      if (!updated) {
        throw new Error(`Param '${paramCode}' not found`);
      }
      return updated;
    } finally {
      await releaseConnection(connection);
    }
  }

  async deleteParam(paramCode: string): Promise<boolean> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const sql = `DELETE FROM M_LIFE_TARIFF_PARAM WHERE MTP_PARAM = :paramCode`;
      const res = await connection.execute(sql, { paramCode: paramCode.toUpperCase().trim() }, { autoCommit: true });
      return (res.rowsAffected || 0) > 0;
    } finally {
      await releaseConnection(connection);
    }
  }

  // =========================================================================
  // 2. TARIFF HEADERS (M_LIFE_TARIFF_HEAD)
  // =========================================================================

  async getHeaders(search?: string, type?: string): Promise<TariffHeadRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      let sql = `
        SELECT 
          h.MTH_CODE,
          h.MTH_TYPE,
          h.MTH_DESC,
          h.MTH_SHORT_DESC,
          h.MTH_PARAM_01,
          h.MTH_PARAM_02,
          h.MTH_PARAM_03,
          h.MTH_PARAM_04,
          h.MTH_PARAM_05,
          h.MTH_PARAM_06,
          h.MTH_PARAM_07,
          h.MTH_PARAM_08,
          h.MTH_PARAM_09,
          h.MTH_PARAM_10,
          NVL(h.MTH_RATE_PER, '1000') AS MTH_RATE_PER,
          h.MTH_FM_DT,
          h.MTH_TO_DT,
          h.MTH_CREATED_BY,
          h.MTH_CREATED_AT,
          h.MTH_MODIFIED_BY,
          h.MTH_MODIFIED_AT,
          (
            SELECT COUNT(*) 
            FROM M_LIFE_TARIFF_DETAIL d 
            WHERE d.MTD_MTH_CODE = h.MTH_CODE 
              AND d.MTD_MTH_TYPE = h.MTH_TYPE
          ) AS DETAIL_COUNT
        FROM M_LIFE_TARIFF_HEAD h
        WHERE 1=1
      `;

      const binds: Record<string, any> = {};

      if (type && type.trim()) {
        sql += ` AND h.MTH_TYPE = :type`;
        binds.type = type.trim();
      }

      if (search && search.trim()) {
        sql += ` AND (LOWER(h.MTH_CODE) LIKE :search OR LOWER(h.MTH_DESC) LIKE :search OR LOWER(h.MTH_SHORT_DESC) LIKE :search)`;
        binds.search = `%${search.trim().toLowerCase()}%`;
      }

      sql += ` ORDER BY h.MTH_CODE ASC, h.MTH_TYPE ASC`;

      const result = await connection.execute<any>(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (!result.rows) return [];

      return result.rows.map((row) => ({
        mthCode: row.MTH_CODE,
        mthType: row.MTH_TYPE,
        mthDesc: row.MTH_DESC || row.MTH_CODE,
        mthShortDesc: row.MTH_SHORT_DESC || null,
        params: [
          row.MTH_PARAM_01 || null,
          row.MTH_PARAM_02 || null,
          row.MTH_PARAM_03 || null,
          row.MTH_PARAM_04 || null,
          row.MTH_PARAM_05 || null,
          row.MTH_PARAM_06 || null,
          row.MTH_PARAM_07 || null,
          row.MTH_PARAM_08 || null,
          row.MTH_PARAM_09 || null,
          row.MTH_PARAM_10 || null
        ],
        ratePer: String(row.MTH_RATE_PER || '1000'),
        effFromDate: row.MTH_FM_DT || null,
        effToDate: row.MTH_TO_DT || null,
        createdBy: row.MTH_CREATED_BY || null,
        createdAt: row.MTH_CREATED_AT || null,
        modifiedBy: row.MTH_MODIFIED_BY || null,
        modifiedAt: row.MTH_MODIFIED_AT || null,
        detailCount: row.DETAIL_COUNT || 0
      }));
    } finally {
      await releaseConnection(connection);
    }
  }

  async getHeader(code: string, type: string): Promise<TariffHeadRecord | null> {
    const list = await this.getHeaders();
    const found = list.find((h) => h.mthCode === code && h.mthType === type);
    return found || null;
  }

  async createHeader(input: CreateTariffHeadInput): Promise<TariffHeadRecord> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const paramsPadded = [...(input.params || [])];
      while (paramsPadded.length < 10) {
        paramsPadded.push(null);
      }

      const sql = `
        INSERT INTO M_LIFE_TARIFF_HEAD (
          MTH_CODE,
          MTH_TYPE,
          MTH_DESC,
          MTH_SHORT_DESC,
          MTH_PARAM_01,
          MTH_PARAM_02,
          MTH_PARAM_03,
          MTH_PARAM_04,
          MTH_PARAM_05,
          MTH_PARAM_06,
          MTH_PARAM_07,
          MTH_PARAM_08,
          MTH_PARAM_09,
          MTH_PARAM_10,
          MTH_RATE_PER,
          MTH_FM_DT,
          MTH_TO_DT,
          MTH_CREATED_BY,
          MTH_CREATED_AT
        ) VALUES (
          :mthCode,
          :mthType,
          :mthDesc,
          :mthShortDesc,
          :p01, :p02, :p03, :p04, :p05, :p06, :p07, :p08, :p09, :p10,
          :ratePer,
          ${input.effFromDate ? "TO_DATE(:effFromDate, 'YYYY-MM-DD')" : 'NULL'},
          ${input.effToDate ? "TO_DATE(:effToDate, 'YYYY-MM-DD')" : 'NULL'},
          :createdBy,
          SYSDATE
        )
      `;

      const binds: Record<string, any> = {
        mthCode: input.mthCode.toUpperCase().trim(),
        mthType: input.mthType.toUpperCase().trim(),
        mthDesc: input.mthDesc.trim(),
        mthShortDesc: input.mthShortDesc ? input.mthShortDesc.trim() : null,
        p01: paramsPadded[0] || null,
        p02: paramsPadded[1] || null,
        p03: paramsPadded[2] || null,
        p04: paramsPadded[3] || null,
        p05: paramsPadded[4] || null,
        p06: paramsPadded[5] || null,
        p07: paramsPadded[6] || null,
        p08: paramsPadded[7] || null,
        p09: paramsPadded[8] || null,
        p10: paramsPadded[9] || null,
        ratePer: input.ratePer || '1000',
        createdBy: input.createdBy || 'ADMIN'
      };

      if (input.effFromDate) binds.effFromDate = input.effFromDate.slice(0, 10);
      if (input.effToDate) binds.effToDate = input.effToDate.slice(0, 10);

      await connection.execute(sql, binds, { autoCommit: true });

      return {
        mthCode: input.mthCode.toUpperCase().trim(),
        mthType: input.mthType.toUpperCase().trim(),
        mthDesc: input.mthDesc.trim(),
        mthShortDesc: input.mthShortDesc || null,
        params: paramsPadded.slice(0, 10),
        ratePer: input.ratePer || '1000',
        effFromDate: input.effFromDate || null,
        effToDate: input.effToDate || null,
        createdBy: input.createdBy || 'ADMIN',
        createdAt: new Date(),
        detailCount: 0
      };
    } finally {
      await releaseConnection(connection);
    }
  }

  async updateHeader(code: string, type: string, input: UpdateTariffHeadInput): Promise<TariffHeadRecord> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const setClauses: string[] = ['MTH_MODIFIED_AT = SYSDATE', 'MTH_MODIFIED_BY = :modifiedBy'];
      const binds: Record<string, any> = {
        code: code.toUpperCase().trim(),
        type: type.toUpperCase().trim(),
        modifiedBy: input.modifiedBy || 'ADMIN'
      };

      if (input.mthDesc !== undefined) {
        setClauses.push('MTH_DESC = :mthDesc');
        binds.mthDesc = input.mthDesc.trim();
      }
      if (input.mthShortDesc !== undefined) {
        setClauses.push('MTH_SHORT_DESC = :mthShortDesc');
        binds.mthShortDesc = input.mthShortDesc ? input.mthShortDesc.trim() : null;
      }
      if (input.ratePer !== undefined) {
        setClauses.push('MTH_RATE_PER = :ratePer');
        binds.ratePer = input.ratePer;
      }
      if (input.effFromDate !== undefined) {
        if (input.effFromDate) {
          setClauses.push("MTH_FM_DT = TO_DATE(:effFromDate, 'YYYY-MM-DD')");
          binds.effFromDate = input.effFromDate.slice(0, 10);
        } else {
          setClauses.push('MTH_FM_DT = NULL');
        }
      }
      if (input.effToDate !== undefined) {
        if (input.effToDate) {
          setClauses.push("MTH_TO_DT = TO_DATE(:effToDate, 'YYYY-MM-DD')");
          binds.effToDate = input.effToDate.slice(0, 10);
        } else {
          setClauses.push('MTH_TO_DT = NULL');
        }
      }

      if (input.params !== undefined) {
        const padded = [...input.params];
        while (padded.length < 10) padded.push(null);
        for (let i = 0; i < 10; i++) {
          const colName = `MTH_PARAM_${String(i + 1).padStart(2, '0')}`;
          const bindKey = `p_${i + 1}`;
          setClauses.push(`${colName} = :${bindKey}`);
          binds[bindKey] = padded[i] || null;
        }
      }

      const sql = `
        UPDATE M_LIFE_TARIFF_HEAD
        SET ${setClauses.join(', ')}
        WHERE MTH_CODE = :code AND MTH_TYPE = :type
      `;

      await connection.execute(sql, binds, { autoCommit: true });

      const updated = await this.getHeader(code, type);
      if (!updated) {
        throw new Error(`Tariff header '${code}' / '${type}' not found`);
      }
      return updated;
    } finally {
      await releaseConnection(connection);
    }
  }

  async deleteHeader(code: string, type: string): Promise<boolean> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      // Delete associated details first
      await connection.execute(
        `DELETE FROM M_LIFE_TARIFF_DETAIL WHERE MTD_MTH_CODE = :code AND MTD_MTH_TYPE = :type`,
        { code, type },
        { autoCommit: true }
      );

      // Delete header
      const res = await connection.execute(
        `DELETE FROM M_LIFE_TARIFF_HEAD WHERE MTH_CODE = :code AND MTH_TYPE = :type`,
        { code, type },
        { autoCommit: true }
      );

      return (res.rowsAffected || 0) > 0;
    } finally {
      await releaseConnection(connection);
    }
  }

  // =========================================================================
  // 3. TARIFF DETAILS (M_LIFE_TARIFF_DETAIL)
  // =========================================================================

  async getDetails(mthCode: string, mthType: string): Promise<TariffDetailRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const sql = `
        SELECT 
          ROWIDTOCHAR(ROWID) AS DETAIL_ID,
          MTD_MTH_CODE,
          MTD_MTH_TYPE,
          MTD_PARAM_01_FM, MTD_PARAM_01_TO,
          MTD_PARAM_02_FM, MTD_PARAM_02_TO,
          MTD_PARAM_03_FM, MTD_PARAM_03_TO,
          MTD_PARAM_04_FM, MTD_PARAM_04_TO,
          MTD_PARAM_05_FM, MTD_PARAM_05_TO,
          MTD_PARAM_06_FM, MTD_PARAM_06_TO,
          MTD_PARAM_07_FM, MTD_PARAM_07_TO,
          MTD_PARAM_08_FM, MTD_PARAM_08_TO,
          MTD_PARAM_09_FM, MTD_PARAM_09_TO,
          MTD_PARAM_10_FM, MTD_PARAM_10_TO,
          MTD_RATE,
          MTD_EFF_FM_DT,
          MTD_EFF_TO_DT,
          MTD_CREATED_BY,
          MTD_CREATED_AT,
          MTD_MODIFIED_BY,
          MTD_MODIFIED_AT
        FROM M_LIFE_TARIFF_DETAIL
        WHERE MTD_MTH_CODE = :mthCode AND MTD_MTH_TYPE = :mthType
        ORDER BY 
          MTD_PARAM_01_FM NULLS FIRST, 
          MTD_PARAM_02_FM NULLS FIRST, 
          MTD_PARAM_03_FM NULLS FIRST
      `;

      const result = await connection.execute<any>(
        sql,
        {
          mthCode: mthCode.toUpperCase().trim(),
          mthType: mthType.toUpperCase().trim()
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (!result.rows) return [];

      return result.rows.map((row) => ({
        detailId: row.DETAIL_ID,
        mthCode: row.MTD_MTH_CODE,
        mthType: row.MTD_MTH_TYPE,
        params: [
          { from: row.MTD_PARAM_01_FM || null, to: row.MTD_PARAM_01_TO || null },
          { from: row.MTD_PARAM_02_FM || null, to: row.MTD_PARAM_02_TO || null },
          { from: row.MTD_PARAM_03_FM || null, to: row.MTD_PARAM_03_TO || null },
          { from: row.MTD_PARAM_04_FM || null, to: row.MTD_PARAM_04_TO || null },
          { from: row.MTD_PARAM_05_FM || null, to: row.MTD_PARAM_05_TO || null },
          { from: row.MTD_PARAM_06_FM || null, to: row.MTD_PARAM_06_TO || null },
          { from: row.MTD_PARAM_07_FM || null, to: row.MTD_PARAM_07_TO || null },
          { from: row.MTD_PARAM_08_FM || null, to: row.MTD_PARAM_08_TO || null },
          { from: row.MTD_PARAM_09_FM || null, to: row.MTD_PARAM_09_TO || null },
          { from: row.MTD_PARAM_10_FM || null, to: row.MTD_PARAM_10_TO || null }
        ],
        rate: String(row.MTD_RATE || '0'),
        effFromDate: row.MTD_EFF_FM_DT || null,
        effToDate: row.MTD_EFF_TO_DT || null,
        createdBy: row.MTD_CREATED_BY || null,
        createdAt: row.MTD_CREATED_AT || null,
        modifiedBy: row.MTD_MODIFIED_BY || null,
        modifiedAt: row.MTD_MODIFIED_AT || null
      }));
    } finally {
      await releaseConnection(connection);
    }
  }

  async createDetail(input: CreateTariffDetailInput): Promise<TariffDetailRecord> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const pairs = [...(input.params || [])];
      while (pairs.length < 10) {
        pairs.push({ from: null, to: null });
      }

      const sql = `
        INSERT INTO M_LIFE_TARIFF_DETAIL (
          MTD_MTH_CODE,
          MTD_MTH_TYPE,
          MTD_PARAM_01_FM, MTD_PARAM_01_TO,
          MTD_PARAM_02_FM, MTD_PARAM_02_TO,
          MTD_PARAM_03_FM, MTD_PARAM_03_TO,
          MTD_PARAM_04_FM, MTD_PARAM_04_TO,
          MTD_PARAM_05_FM, MTD_PARAM_05_TO,
          MTD_PARAM_06_FM, MTD_PARAM_06_TO,
          MTD_PARAM_07_FM, MTD_PARAM_07_TO,
          MTD_PARAM_08_FM, MTD_PARAM_08_TO,
          MTD_PARAM_09_FM, MTD_PARAM_09_TO,
          MTD_PARAM_10_FM, MTD_PARAM_10_TO,
          MTD_RATE,
          MTD_EFF_FM_DT,
          MTD_EFF_TO_DT,
          MTD_CREATED_BY,
          MTD_CREATED_AT
        ) VALUES (
          :mthCode,
          :mthType,
          :p01_fm, :p01_to,
          :p02_fm, :p02_to,
          :p03_fm, :p03_to,
          :p04_fm, :p04_to,
          :p05_fm, :p05_to,
          :p06_fm, :p06_to,
          :p07_fm, :p07_to,
          :p08_fm, :p08_to,
          :p09_fm, :p09_to,
          :p10_fm, :p10_to,
          :rate,
          ${input.effFromDate ? "TO_DATE(:effFromDate, 'YYYY-MM-DD')" : 'NULL'},
          ${input.effToDate ? "TO_DATE(:effToDate, 'YYYY-MM-DD')" : 'NULL'},
          :createdBy,
          SYSDATE
        )
      `;

      const binds: Record<string, any> = {
        mthCode: input.mthCode.toUpperCase().trim(),
        mthType: input.mthType.toUpperCase().trim(),
        p01_fm: pairs[0].from || null,
        p01_to: pairs[0].to || null,
        p02_fm: pairs[1].from || null,
        p02_to: pairs[1].to || null,
        p03_fm: pairs[2].from || null,
        p03_to: pairs[2].to || null,
        p04_fm: pairs[3].from || null,
        p04_to: pairs[3].to || null,
        p05_fm: pairs[4].from || null,
        p05_to: pairs[4].to || null,
        p06_fm: pairs[5].from || null,
        p06_to: pairs[5].to || null,
        p07_fm: pairs[6].from || null,
        p07_to: pairs[6].to || null,
        p08_fm: pairs[7].from || null,
        p08_to: pairs[7].to || null,
        p09_fm: pairs[8].from || null,
        p09_to: pairs[8].to || null,
        p10_fm: pairs[9].from || null,
        p10_to: pairs[9].to || null,
        rate: input.rate.trim(),
        createdBy: input.createdBy || 'ADMIN'
      };

      if (input.effFromDate) binds.effFromDate = input.effFromDate.slice(0, 10);
      if (input.effToDate) binds.effToDate = input.effToDate.slice(0, 10);

      await connection.execute(sql, binds, { autoCommit: true });

      // Fetch the newly inserted record
      const details = await this.getDetails(input.mthCode, input.mthType);
      return details[details.length - 1] || {
        detailId: '',
        mthCode: input.mthCode,
        mthType: input.mthType,
        params: pairs,
        rate: input.rate,
        createdBy: input.createdBy || 'ADMIN',
        createdAt: new Date()
      };
    } finally {
      await releaseConnection(connection);
    }
  }

  async updateDetail(detailId: string, input: UpdateTariffDetailInput): Promise<boolean> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const setClauses: string[] = ['MTD_MODIFIED_AT = SYSDATE', 'MTD_MODIFIED_BY = :modifiedBy'];
      const binds: Record<string, any> = {
        detailId,
        modifiedBy: input.modifiedBy || 'ADMIN'
      };

      if (input.rate !== undefined) {
        setClauses.push('MTD_RATE = :rate');
        binds.rate = input.rate.trim();
      }
      if (input.effFromDate !== undefined) {
        if (input.effFromDate) {
          setClauses.push("MTD_EFF_FM_DT = TO_DATE(:effFromDate, 'YYYY-MM-DD')");
          binds.effFromDate = input.effFromDate.slice(0, 10);
        } else {
          setClauses.push('MTD_EFF_FM_DT = NULL');
        }
      }
      if (input.effToDate !== undefined) {
        if (input.effToDate) {
          setClauses.push("MTD_EFF_TO_DT = TO_DATE(:effToDate, 'YYYY-MM-DD')");
          binds.effToDate = input.effToDate.slice(0, 10);
        } else {
          setClauses.push('MTD_EFF_TO_DT = NULL');
        }
      }

      if (input.params !== undefined) {
        const pairs = [...input.params];
        while (pairs.length < 10) pairs.push({ from: null, to: null });
        for (let i = 0; i < 10; i++) {
          const num = String(i + 1).padStart(2, '0');
          setClauses.push(`MTD_PARAM_${num}_FM = :p${num}_fm`);
          setClauses.push(`MTD_PARAM_${num}_TO = :p${num}_to`);
          binds[`p${num}_fm`] = pairs[i].from || null;
          binds[`p${num}_to`] = pairs[i].to || null;
        }
      }

      const sql = `
        UPDATE M_LIFE_TARIFF_DETAIL
        SET ${setClauses.join(', ')}
        WHERE ROWID = CHARTOROWID(:detailId)
      `;

      const res = await connection.execute(sql, binds, { autoCommit: true });
      return (res.rowsAffected || 0) > 0;
    } finally {
      await releaseConnection(connection);
    }
  }

  async deleteDetail(detailId: string): Promise<boolean> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const sql = `DELETE FROM M_LIFE_TARIFF_DETAIL WHERE ROWID = CHARTOROWID(:detailId)`;
      const res = await connection.execute(sql, { detailId }, { autoCommit: true });
      return (res.rowsAffected || 0) > 0;
    } finally {
      await releaseConnection(connection);
    }
  }
}

export const tariffRepository = new TariffRepository();
