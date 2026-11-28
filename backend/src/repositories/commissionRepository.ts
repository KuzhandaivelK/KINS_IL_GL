import oracledb from 'oracledb';
import { getConnection, releaseConnection } from '../config/database';
import {
  CommChannelRecord,
  CommIntermediaryRecord,
  CommStructureRecord,
  CommStructureTierRecord,
  PolicyCommissionRecord,
  PolicyCommissionDetailRecord,
  CommJournalEntryRecord,
  PolicyCommissionFullDetail,
  EligibleCommPolicy
} from '../types/commission';

export const commissionRepository = {
  // =========================================================================
  // 1. DISTRIBUTION CHANNELS
  // =========================================================================
  async listChannels(): Promise<CommChannelRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const res = await connection.execute<CommChannelRecord>(
        `SELECT
           CHANNEL_CODE, CHANNEL_NAME, SUPPORTS_HIERARCHY_YN, DESCRIPTION,
           IS_ACTIVE, CREATED_BY, TO_CHAR(CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
         FROM T_COMM_CHANNEL
         WHERE IS_ACTIVE = 'Y'
         ORDER BY CHANNEL_CODE ASC`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return res.rows || [];
    } finally {
      await releaseConnection(connection);
    }
  },

  async saveChannel(
    payload: {
      channelCode: string;
      channelName: string;
      supportsHierarchyYn: 'Y' | 'N';
      description?: string;
    },
    user: string
  ): Promise<CommChannelRecord> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const code = payload.channelCode.trim().toUpperCase().replace(/\s+/g, '_');
      await connection.execute(
        `MERGE INTO T_COMM_CHANNEL tgt
         USING (SELECT :code AS CHANNEL_CODE FROM DUAL) src
         ON (tgt.CHANNEL_CODE = src.CHANNEL_CODE)
         WHEN MATCHED THEN
           UPDATE SET
             CHANNEL_NAME = :name,
             SUPPORTS_HIERARCHY_YN = :hier,
             DESCRIPTION = :descr,
             IS_ACTIVE = 'Y',
             MODIFIED_BY = :usr,
             MODIFIED_ON = SYSDATE
         WHEN NOT MATCHED THEN
           INSERT (CHANNEL_CODE, CHANNEL_NAME, SUPPORTS_HIERARCHY_YN, DESCRIPTION, IS_ACTIVE, CREATED_BY, CREATED_ON)
           VALUES (:code, :name, :hier, :descr, 'Y', :usr, SYSDATE)`,
        {
          code,
          name: payload.channelName.trim(),
          hier: payload.supportsHierarchyYn === 'Y' ? 'Y' : 'N',
          descr: payload.description || null,
          usr: user
        },
        { autoCommit: true }
      );

      const channels = await this.listChannels();
      return channels.find((c) => c.CHANNEL_CODE === code) as CommChannelRecord;
    } finally {
      await releaseConnection(connection);
    }
  },

  // =========================================================================
  // 2. INTERMEDIARIES (AGENTS WITH HIERARCHY, BROKERS, OTHER CHANNELS)
  // =========================================================================
  async listIntermediaries(channelCode?: string): Promise<CommIntermediaryRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const binds: Record<string, any> = {};
      let where = `WHERE i.IS_ACTIVE = 'Y'`;
      if (channelCode && channelCode !== 'ALL') {
        where += ` AND i.CHANNEL_CODE = :ch`;
        binds.ch = channelCode;
      }

      const res = await connection.execute<CommIntermediaryRecord>(
        `SELECT
           i.INTERMEDIARY_ID, i.INTERMEDIARY_CODE, i.INTERMEDIARY_NAME,
           i.CHANNEL_CODE, ch.CHANNEL_NAME,
           i.HIERARCHY_LEVEL, i.PARENT_INTERMEDIARY_ID,
           p.INTERMEDIARY_CODE AS PARENT_INTERMEDIARY_CODE,
           p.INTERMEDIARY_NAME AS PARENT_INTERMEDIARY_NAME,
           i.LICENSE_NO, i.EMAIL, i.PHONE, i.BRANCH_NAME,
           i.STATUS, i.IS_ACTIVE, i.CREATED_BY,
           TO_CHAR(i.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
         FROM T_COMM_INTERMEDIARY i
         LEFT JOIN T_COMM_CHANNEL ch ON ch.CHANNEL_CODE = i.CHANNEL_CODE
         LEFT JOIN T_COMM_INTERMEDIARY p ON p.INTERMEDIARY_ID = i.PARENT_INTERMEDIARY_ID
         ${where}
         ORDER BY i.CHANNEL_CODE, i.PARENT_INTERMEDIARY_ID NULLS FIRST, i.INTERMEDIARY_ID ASC`,
        binds,
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return res.rows || [];
    } finally {
      await releaseConnection(connection);
    }
  },

  async saveIntermediary(
    payload: {
      intermediaryId?: number;
      intermediaryCode: string;
      intermediaryName: string;
      channelCode: string;
      hierarchyLevel: string;
      parentIntermediaryId?: number | null;
      licenseNo?: string;
      email?: string;
      phone?: string;
      branchName?: string;
      status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    },
    user: string
  ): Promise<CommIntermediaryRecord> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      let id = payload.intermediaryId;

      if (id && payload.parentIntermediaryId && Number(id) === Number(payload.parentIntermediaryId)) {
        throw new Error('An intermediary cannot be its own parent in the hierarchy.');
      }

      if (id) {
        await connection.execute(
          `UPDATE T_COMM_INTERMEDIARY
           SET INTERMEDIARY_CODE = :code,
               INTERMEDIARY_NAME = :name,
               CHANNEL_CODE = :ch,
               HIERARCHY_LEVEL = :lvl,
               PARENT_INTERMEDIARY_ID = :par,
               LICENSE_NO = :lic,
               EMAIL = :email,
               PHONE = :phone,
               BRANCH_NAME = :branch,
               STATUS = :st,
               MODIFIED_BY = :usr,
               MODIFIED_ON = SYSDATE
           WHERE INTERMEDIARY_ID = :id`,
          {
            id,
            code: payload.intermediaryCode.trim().toUpperCase(),
            name: payload.intermediaryName.trim(),
            ch: payload.channelCode,
            lvl: payload.hierarchyLevel,
            par: payload.parentIntermediaryId || null,
            lic: payload.licenseNo || null,
            email: payload.email || null,
            phone: payload.phone || null,
            branch: payload.branchName || null,
            st: payload.status || 'ACTIVE',
            usr: user
          },
          { autoCommit: true }
        );
      } else {
        const seqRes = await connection.execute<{ NEXTVAL: number }>(
          `SELECT SEQ_COMM_INTERMED_ID.NEXTVAL AS NEXTVAL FROM DUAL`,
          {},
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        id = seqRes.rows![0].NEXTVAL;

        await connection.execute(
          `INSERT INTO T_COMM_INTERMEDIARY (
             INTERMEDIARY_ID, INTERMEDIARY_CODE, INTERMEDIARY_NAME, CHANNEL_CODE,
             HIERARCHY_LEVEL, PARENT_INTERMEDIARY_ID, LICENSE_NO, EMAIL, PHONE,
             BRANCH_NAME, STATUS, IS_ACTIVE, CREATED_BY, CREATED_ON
           ) VALUES (
             :id, :code, :name, :ch,
             :lvl, :par, :lic, :email, :phone,
             :branch, :st, 'Y', :usr, SYSDATE
           )`,
          {
            id,
            code: payload.intermediaryCode.trim().toUpperCase(),
            name: payload.intermediaryName.trim(),
            ch: payload.channelCode,
            lvl: payload.hierarchyLevel,
            par: payload.parentIntermediaryId || null,
            lic: payload.licenseNo || null,
            email: payload.email || null,
            phone: payload.phone || null,
            branch: payload.branchName || null,
            st: payload.status || 'ACTIVE',
            usr: user
          },
          { autoCommit: true }
        );
      }

      const list = await this.listIntermediaries();
      return list.find((x) => x.INTERMEDIARY_ID === id) as CommIntermediaryRecord;
    } finally {
      await releaseConnection(connection);
    }
  },

  // =========================================================================
  // 3. COMMISSION STRUCTURES (PRODUCT-WISE DEFAULT & OPTIONAL COVER-WISE)
  // =========================================================================
  async listStructures(): Promise<CommStructureRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const hdrRes = await connection.execute<CommStructureRecord>(
        `SELECT
           s.STRUCT_ID, s.STRUCT_CODE, s.STRUCT_NAME,
           s.CHANNEL_CODE, ch.CHANNEL_NAME,
           s.LOB_TYPE, s.PROD_CODE, p.PROD_NAME,
           s.COVER_CODE, c.COVER_DESC AS COVER_NAME,
           s.CALC_BASIS,
           TO_CHAR(s.EFFECTIVE_FROM, 'YYYY-MM-DD') AS EFFECTIVE_FROM,
           TO_CHAR(s.EFFECTIVE_TO, 'YYYY-MM-DD') AS EFFECTIVE_TO,
           s.STATUS, s.REMARKS, s.IS_ACTIVE, s.CREATED_BY,
           TO_CHAR(s.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
         FROM T_COMM_STRUCTURE s
         LEFT JOIN T_COMM_CHANNEL ch ON ch.CHANNEL_CODE = s.CHANNEL_CODE
         LEFT JOIN MTBL_PRODUCT p ON p.PROD_CODE = s.PROD_CODE
         LEFT JOIN MTBL_COVER c ON c.COVER_CODE = s.COVER_CODE
         WHERE s.IS_ACTIVE = 'Y'
         ORDER BY s.STRUCT_ID DESC`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const tierRes = await connection.execute<CommStructureTierRecord>(
        `SELECT
           TIER_ID, STRUCT_ID, TIER_ORDER, HIERARCHY_LEVEL, TIER_LABEL,
           COMM_PCT, RENEWAL_COMM_PCT, OVERRIDING_YN, IS_ACTIVE
         FROM T_COMM_STRUCTURE_TIER
         WHERE IS_ACTIVE = 'Y'
         ORDER BY STRUCT_ID, TIER_ORDER ASC`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const tierMap = new Map<number, CommStructureTierRecord[]>();
      for (const t of tierRes.rows || []) {
        const sid = Number(t.STRUCT_ID);
        if (!tierMap.has(sid)) tierMap.set(sid, []);
        tierMap.get(sid)!.push(t);
      }

      return (hdrRes.rows || []).map((s) => ({
        ...s,
        tiers: tierMap.get(s.STRUCT_ID) || []
      }));
    } finally {
      await releaseConnection(connection);
    }
  },

  async saveStructure(
    payload: {
      structId?: number;
      structCode: string;
      structName: string;
      channelCode: string;
      lobType: 'IL' | 'GL' | 'ALL';
      prodCode: string;
      coverCode?: string | null;
      calcBasis?: 'PRODUCT' | 'COVER';
      effectiveFrom: string;
      effectiveTo: string;
      status?: 'DRAFT' | 'ACTIVE' | 'EXPIRED';
      remarks?: string;
      tiers: Array<{
        tierOrder: number;
        hierarchyLevel: string;
        tierLabel: string;
        commPct: number;
        renewalCommPct: number;
        overridingYn: 'Y' | 'N';
      }>;
    },
    user: string
  ): Promise<CommStructureRecord> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const coverCode = payload.coverCode && payload.coverCode.trim() !== '' ? payload.coverCode.trim() : null;
      const calcBasis: 'PRODUCT' | 'COVER' = coverCode ? 'COVER' : 'PRODUCT';

      let structId = payload.structId;

      if (structId) {
        await connection.execute(
          `UPDATE T_COMM_STRUCTURE
           SET STRUCT_CODE = :code,
               STRUCT_NAME = :name,
               CHANNEL_CODE = :ch,
               LOB_TYPE = :lob,
               PROD_CODE = :prod,
               COVER_CODE = :cov,
               CALC_BASIS = :basis,
               EFFECTIVE_FROM = TO_DATE(:ef, 'YYYY-MM-DD'),
               EFFECTIVE_TO = TO_DATE(:et, 'YYYY-MM-DD'),
               STATUS = :st,
               REMARKS = :rem,
               MODIFIED_BY = :usr,
               MODIFIED_ON = SYSDATE
           WHERE STRUCT_ID = :sid`,
          {
            sid: structId,
            code: payload.structCode.trim().toUpperCase(),
            name: payload.structName.trim(),
            ch: payload.channelCode,
            lob: payload.lobType,
            prod: payload.prodCode,
            cov: coverCode,
            basis: calcBasis,
            ef: payload.effectiveFrom,
            et: payload.effectiveTo,
            st: payload.status || 'ACTIVE',
            rem: payload.remarks || null,
            usr: user
          }
        );

        await connection.execute(`DELETE FROM T_COMM_STRUCTURE_TIER WHERE STRUCT_ID = :sid`, { sid: structId });
      } else {
        const seqRes = await connection.execute<{ NEXTVAL: number }>(
          `SELECT SEQ_COMM_STRUCT_ID.NEXTVAL AS NEXTVAL FROM DUAL`,
          {},
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        structId = seqRes.rows![0].NEXTVAL;

        await connection.execute(
          `INSERT INTO T_COMM_STRUCTURE (
             STRUCT_ID, STRUCT_CODE, STRUCT_NAME, CHANNEL_CODE, LOB_TYPE,
             PROD_CODE, COVER_CODE, CALC_BASIS, EFFECTIVE_FROM, EFFECTIVE_TO,
             STATUS, REMARKS, IS_ACTIVE, CREATED_BY, CREATED_ON
           ) VALUES (
             :sid, :code, :name, :ch, :lob,
             :prod, :cov, :basis, TO_DATE(:ef, 'YYYY-MM-DD'), TO_DATE(:et, 'YYYY-MM-DD'),
             :st, :rem, 'Y', :usr, SYSDATE
           )`,
          {
            sid: structId,
            code: payload.structCode.trim().toUpperCase(),
            name: payload.structName.trim(),
            ch: payload.channelCode,
            lob: payload.lobType,
            prod: payload.prodCode,
            cov: coverCode,
            basis: calcBasis,
            ef: payload.effectiveFrom,
            et: payload.effectiveTo,
            st: payload.status || 'ACTIVE',
            rem: payload.remarks || null,
            usr: user
          }
        );
      }

      for (const tier of payload.tiers || []) {
        await connection.execute(
          `INSERT INTO T_COMM_STRUCTURE_TIER (
             TIER_ID, STRUCT_ID, TIER_ORDER, HIERARCHY_LEVEL, TIER_LABEL,
             COMM_PCT, RENEWAL_COMM_PCT, OVERRIDING_YN, IS_ACTIVE, CREATED_BY, CREATED_ON
           ) VALUES (
             SEQ_COMM_TIER_ID.NEXTVAL, :sid, :ord, :lvl, :lbl,
             :pct, :rpct, :orc, 'Y', :usr, SYSDATE
           )`,
          {
            sid: structId,
            ord: Number(tier.tierOrder),
            lvl: tier.hierarchyLevel,
            lbl: tier.tierLabel,
            pct: Number(tier.commPct) || 0,
            rpct: Number(tier.renewalCommPct) || 0,
            orc: tier.overridingYn === 'Y' ? 'Y' : 'N',
            usr: user
          }
        );
      }

      await connection.commit();
      const all = await this.listStructures();
      return all.find((s) => s.STRUCT_ID === structId) as CommStructureRecord;
    } catch (err) {
      if (connection) {
        try { await connection.rollback(); } catch {}
      }
      throw err;
    } finally {
      await releaseConnection(connection);
    }
  },

  async deleteStructure(structId: number, user: string): Promise<void> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      await connection.execute(
        `UPDATE T_COMM_STRUCTURE SET IS_ACTIVE = 'N', MODIFIED_BY = :usr, MODIFIED_ON = SYSDATE WHERE STRUCT_ID = :sid`,
        { sid: structId, usr: user },
        { autoCommit: true }
      );
    } finally {
      await releaseConnection(connection);
    }
  },

  // =========================================================================
  // 4. LOOKUP PRODUCTS & COVERS FOR COMMISSION DEFINITION DROPDOWNS
  // =========================================================================
  async listProductsAndCovers(): Promise<{
    products: Array<{ prodCode: string; prodName: string; lob: string }>;
    covers: Array<{ coverCode: string; coverName: string; lob: string; prodCodes: string[] }>;
  }> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const prodRes = await connection.execute<{ PROD_CODE: string; PROD_NAME: string; PROD_LOB: string }>(
        `SELECT PROD_CODE, PROD_NAME, NVL(PROD_LOB, 'IL') AS PROD_LOB FROM MTBL_PRODUCT ORDER BY PROD_CODE`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const covRes = await connection.execute<{ COVER_CODE: string; COVER_DESC: string; COVER_LOB: string }>(
        `SELECT COVER_CODE, COVER_DESC, NVL(COVER_LOB, 'IL') AS COVER_LOB FROM MTBL_COVER WHERE NVL(COVER_ACTIVE_YN, 'Y') = 'Y' ORDER BY COVER_CODE`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const mapRes = await connection.execute<{ MPC_PROD_CODE: string; MPC_COVER_CODE: string }>(
        `SELECT MPC_PROD_CODE, MPC_COVER_CODE FROM MTBL_PROD_COVER`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const prodsByCover = new Map<string, string[]>();
      for (const m of mapRes.rows || []) {
        if (!prodsByCover.has(m.MPC_COVER_CODE)) prodsByCover.set(m.MPC_COVER_CODE, []);
        prodsByCover.get(m.MPC_COVER_CODE)!.push(m.MPC_PROD_CODE);
      }

      return {
        products: (prodRes.rows || []).map((p) => ({
          prodCode: p.PROD_CODE,
          prodName: p.PROD_NAME,
          lob: p.PROD_LOB || (p.PROD_CODE.startsWith('GL_') ? 'GL' : 'IL')
        })),
        covers: (covRes.rows || []).map((c) => ({
          coverCode: c.COVER_CODE,
          coverName: c.COVER_DESC,
          lob: c.COVER_LOB || (c.COVER_CODE.startsWith('GL_') ? 'GL' : 'IL'),
          prodCodes: prodsByCover.get(c.COVER_CODE) || []
        }))
      };
    } finally {
      await releaseConnection(connection);
    }
  },

  // =========================================================================
  // 5. ELIGIBLE POLICIES (IL + GL) FOR COMMISSION CALCULATION
  // =========================================================================
  async listEligiblePolicies(): Promise<EligibleCommPolicy[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const res = await connection.execute<any>(
        `SELECT * FROM (
           SELECT
             p.POL_NO AS POL_NO,
             'IL' AS LOB_TYPE,
             NVL((SELECT MAX(a.PAS_NAME) FROM T_POLICY_ASSURED a WHERE a.POL_NO = p.POL_NO AND a.IS_ACTIVE = 'Y'), p.POL_NO) AS INSURED_NAME,
             p.POL_PROD_CODE AS PROD_CODE,
             NVL(pr.PROD_NAME, p.POL_PROD_CODE) AS PROD_NAME,
             NVL(p.POL_SUM_ASSURED, 0) AS SUM_ASSURED,
             NVL((SELECT MAX(ps.PPS_NET_ANNUAL_PREM) FROM T_POLICY_PREMIUM_SUMMARY ps WHERE ps.POL_NO = p.POL_NO AND ps.IS_ACTIVE = 'Y'), NVL(p.POL_INSTALLMENT_PREM, 0)) AS PREMIUM,
             p.POL_STATUS AS STATUS,
             (SELECT COUNT(1) FROM T_POLICY_COMMISSION pc WHERE pc.POL_NO = p.POL_NO AND pc.PREM_TYPE = 'FY' AND pc.COMM_STATUS IN ('APPROVED', 'PAID') AND pc.IS_ACTIVE = 'Y') AS FY_APP_CNT,
             (SELECT COUNT(1) FROM T_POLICY_COMMISSION pc WHERE pc.POL_NO = p.POL_NO AND pc.PREM_TYPE = 'RN' AND pc.COMM_STATUS IN ('APPROVED', 'PAID') AND pc.IS_ACTIVE = 'Y') AS RN_APP_CNT
           FROM T_POLICY_INFO p
           LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = p.POL_PROD_CODE
           WHERE p.IS_ACTIVE = 'Y'
           UNION ALL
           SELECT
             g.MASTER_POLICY_NO AS POL_NO,
             'GL' AS LOB_TYPE,
             g.CORP_NAME AS INSURED_NAME,
             g.PROD_CODE AS PROD_CODE,
             NVL(pr.PROD_NAME, g.PROD_CODE) AS PROD_NAME,
             NVL(g.TOTAL_INFORCE_SA, 0) AS SUM_ASSURED,
             NVL(g.TOTAL_INFORCE_PREMIUM, 0) AS PREMIUM,
             g.POL_STATUS AS STATUS,
             (SELECT COUNT(1) FROM T_POLICY_COMMISSION pc WHERE pc.POL_NO = g.MASTER_POLICY_NO AND pc.PREM_TYPE = 'FY' AND pc.COMM_STATUS IN ('APPROVED', 'PAID') AND pc.IS_ACTIVE = 'Y') AS FY_APP_CNT,
             (SELECT COUNT(1) FROM T_POLICY_COMMISSION pc WHERE pc.POL_NO = g.MASTER_POLICY_NO AND pc.PREM_TYPE = 'RN' AND pc.COMM_STATUS IN ('APPROVED', 'PAID') AND pc.IS_ACTIVE = 'Y') AS RN_APP_CNT
           FROM T_GL_POLICY_MASTER g
           LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = g.PROD_CODE
           WHERE g.IS_ACTIVE = 'Y'
         ) ORDER BY LOB_TYPE, POL_NO DESC`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      return (res.rows || []).map((r) => ({
        polNo: r.POL_NO,
        lobType: r.LOB_TYPE,
        insuredName: r.INSURED_NAME || r.POL_NO,
        prodCode: r.PROD_CODE,
        prodName: r.PROD_NAME || r.PROD_CODE,
        sumAssured: Number(r.SUM_ASSURED) || 0,
        premium: Number(r.PREMIUM) || 0,
        status: r.STATUS,
        hasApprovedFyComm: Number(r.FY_APP_CNT) > 0,
        hasApprovedRnComm: Number(r.RN_APP_CNT) > 0
      }));
    } finally {
      await releaseConnection(connection);
    }
  },

  // =========================================================================
  // 6. POLICY-WISE COMMISSION CALCULATION & APPROVAL (VIA PKG_COMMISSION)
  // =========================================================================
  async calculatePolicyCommission(
    payload: {
      polNo: string;
      lobType: 'IL' | 'GL';
      intermediaryId: number;
      premType?: 'FY' | 'RN';
    },
    user: string
  ): Promise<{ commNo: string; totalComm: number; totalPct: number }> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const result = await connection.execute<any>(
        `BEGIN
           PKG_COMMISSION.SP_CALCULATE_POLICY_COMMISSION(
             p_pol_no          => :polNo,
             p_lob_type        => :lobType,
             p_intermediary_id => :intermId,
             p_prem_type       => :premType,
             p_user            => :usr,
             p_out_comm_no     => :outCommNo,
             p_out_total_comm  => :outTotalComm,
             p_out_total_pct   => :outTotalPct
           );
         END;`,
        {
          polNo: payload.polNo,
          lobType: payload.lobType,
          intermId: Number(payload.intermediaryId),
          premType: payload.premType || 'FY',
          usr: user,
          outCommNo: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 60 },
          outTotalComm: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          outTotalPct: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        }
      );

      return {
        commNo: result.outBinds.outCommNo,
        totalComm: Number(result.outBinds.outTotalComm) || 0,
        totalPct: Number(result.outBinds.outTotalPct) || 0
      };
    } finally {
      await releaseConnection(connection);
    }
  },

  async listPolicyCommissions(filters?: {
    channelCode?: string;
    lobType?: string;
    status?: string;
    polNo?: string;
  }): Promise<PolicyCommissionRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const binds: Record<string, any> = {};
      let where = `WHERE pc.IS_ACTIVE = 'Y'`;
      if (filters?.channelCode && filters.channelCode !== 'ALL') {
        where += ` AND pc.CHANNEL_CODE = :ch`;
        binds.ch = filters.channelCode;
      }
      if (filters?.lobType && filters.lobType !== 'ALL') {
        where += ` AND pc.LOB_TYPE = :lob`;
        binds.lob = filters.lobType;
      }
      if (filters?.status && filters.status !== 'ALL') {
        where += ` AND pc.COMM_STATUS = :st`;
        binds.st = filters.status;
      }
      if (filters?.polNo && filters.polNo.trim() !== '') {
        where += ` AND UPPER(pc.POL_NO) LIKE :pol`;
        binds.pol = `%${filters.polNo.trim().toUpperCase()}%`;
      }

      const res = await connection.execute<PolicyCommissionRecord>(
        `SELECT
           pc.COMM_ID, pc.COMM_NO, pc.POL_NO, pc.LOB_TYPE, pc.INSURED_NAME,
           pc.PROD_CODE, NVL(pr.PROD_NAME, pc.PROD_CODE) AS PROD_NAME,
           pc.CHANNEL_CODE, pc.INTERMEDIARY_ID, pc.INTERMEDIARY_CODE, pc.INTERMEDIARY_NAME,
           pc.STRUCT_ID, pc.STRUCT_CODE, pc.CALC_BASIS, pc.PREM_TYPE,
           pc.POLICY_PREMIUM, pc.TOTAL_COMM_PCT, pc.TOTAL_COMM_AMOUNT,
           pc.DIRECT_COMM_AMOUNT, pc.OVERRIDE_COMM_AMOUNT,
           pc.COMM_STATUS, pc.GL_POSTED_YN, pc.GL_VOUCHER_NO,
           pc.APPROVED_BY, TO_CHAR(pc.APPROVED_ON, 'YYYY-MM-DD HH24:MI:SS') AS APPROVED_ON,
           pc.APPROVAL_REMARKS, pc.CREATED_BY,
           TO_CHAR(pc.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
         FROM T_POLICY_COMMISSION pc
         LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = pc.PROD_CODE
         ${where}
         ORDER BY pc.COMM_ID DESC`,
        binds,
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return res.rows || [];
    } finally {
      await releaseConnection(connection);
    }
  },

  async getPolicyCommissionDetail(commNo: string): Promise<PolicyCommissionFullDetail | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const hdrRes = await connection.execute<PolicyCommissionRecord>(
        `SELECT
           pc.COMM_ID, pc.COMM_NO, pc.POL_NO, pc.LOB_TYPE, pc.INSURED_NAME,
           pc.PROD_CODE, NVL(pr.PROD_NAME, pc.PROD_CODE) AS PROD_NAME,
           pc.CHANNEL_CODE, pc.INTERMEDIARY_ID, pc.INTERMEDIARY_CODE, pc.INTERMEDIARY_NAME,
           pc.STRUCT_ID, pc.STRUCT_CODE, pc.CALC_BASIS, pc.PREM_TYPE,
           pc.POLICY_PREMIUM, pc.TOTAL_COMM_PCT, pc.TOTAL_COMM_AMOUNT,
           pc.DIRECT_COMM_AMOUNT, pc.OVERRIDE_COMM_AMOUNT,
           pc.COMM_STATUS, pc.GL_POSTED_YN, pc.GL_VOUCHER_NO,
           pc.APPROVED_BY, TO_CHAR(pc.APPROVED_ON, 'YYYY-MM-DD HH24:MI:SS') AS APPROVED_ON,
           pc.APPROVAL_REMARKS, pc.CREATED_BY,
           TO_CHAR(pc.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
         FROM T_POLICY_COMMISSION pc
         LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = pc.PROD_CODE
         WHERE pc.COMM_NO = :commNo AND pc.IS_ACTIVE = 'Y'`,
        { commNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (!hdrRes.rows || hdrRes.rows.length === 0) return null;
      const commission = hdrRes.rows[0];

      const dtlRes = await connection.execute<PolicyCommissionDetailRecord>(
        `SELECT
           DETAIL_ID, COMM_ID, STRUCT_ID, STRUCT_CODE,
           COVER_CODE, COVER_NAME, BASE_PREMIUM,
           INTERMEDIARY_ID, INTERMEDIARY_CODE, INTERMEDIARY_NAME,
           HIERARCHY_LEVEL, TIER_ORDER, IS_OVERRIDE_YN,
           COMM_PCT, COMM_AMOUNT
         FROM T_POLICY_COMMISSION_DETAIL
         WHERE COMM_ID = :cid AND IS_ACTIVE = 'Y'
         ORDER BY COVER_CODE NULLS FIRST, TIER_ORDER ASC, DETAIL_ID ASC`,
        { cid: commission.COMM_ID },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const glRes = await connection.execute<CommJournalEntryRecord>(
        `SELECT
           ENTRY_ID, JOURNAL_VOUCHER_NO,
           TO_CHAR(VOUCHER_DATE, 'YYYY-MM-DD HH24:MI:SS') AS VOUCHER_DATE,
           TXN_SOURCE, SOURCE_REF_NO, GL_ACCOUNT_CODE, GL_ACCOUNT_NAME,
           DR_CR_FLAG, AMOUNT, NARRATION, CREATED_BY
         FROM T_GL_JOURNAL_ENTRY
         WHERE TXN_SOURCE = 'COMMISSION' AND SOURCE_REF_NO = :commNo
         ORDER BY ENTRY_ID ASC`,
        { commNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      return {
        commission,
        details: dtlRes.rows || [],
        glEntries: glRes.rows || []
      };
    } finally {
      await releaseConnection(connection);
    }
  },

  async approveCommission(commNo: string, remarks: string, user: string): Promise<{ voucherNo: string }> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const res = await connection.execute<any>(
        `BEGIN
           PKG_COMMISSION.SP_APPROVE_COMMISSION(
             p_comm_no        => :commNo,
             p_remarks        => :remarks,
             p_user           => :usr,
             p_out_voucher_no => :outVch
           );
         END;`,
        {
          commNo,
          remarks: remarks || 'Approved by user',
          usr: user,
          outVch: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 60 }
        }
      );
      return { voucherNo: res.outBinds.outVch };
    } finally {
      await releaseConnection(connection);
    }
  }
};
