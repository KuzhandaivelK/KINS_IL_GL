import oracledb from 'oracledb';
import { getConnection, releaseConnection } from '../config/database';
import {
  RiTreatyMasterRecord,
  RiTreatyLayerRecord,
  RiPolicyAllocationRecord,
  RiPolicyAllocLayerRecord,
  RiJournalEntryRecord,
  RiAllocationDetail
} from '../types/reinsurance';

export const reinsuranceRepository = {
  /**
   * List all Treaties with their Retention / Quota Share / Surplus layers
   */
  async listTreaties(): Promise<RiTreatyMasterRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const trtRes = await connection.execute<RiTreatyMasterRecord>(
        `SELECT
           TREATY_ID, TREATY_CODE, TREATY_NAME, LOB_TYPE, TREATY_YEAR,
           TO_CHAR(EFFECTIVE_FROM, 'YYYY-MM-DD') AS EFFECTIVE_FROM,
           TO_CHAR(EFFECTIVE_TO, 'YYYY-MM-DD') AS EFFECTIVE_TO,
           CURRENCY_CODE, TREATY_STATUS, REMARKS, IS_ACTIVE, CREATED_BY,
           TO_CHAR(CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
         FROM T_RI_TREATY_MASTER
         WHERE IS_ACTIVE = 'Y'
         ORDER BY TREATY_ID DESC`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const lyrRes = await connection.execute<RiTreatyLayerRecord>(
        `SELECT
           LAYER_ID, TREATY_ID, LAYER_ORDER, LAYER_TYPE, LAYER_NAME, REINSURER_NAME,
           CESSION_PCT, LIMIT_AMOUNT, RI_COMMISSION_PCT, IS_ACTIVE
         FROM T_RI_TREATY_LAYER
         WHERE IS_ACTIVE = 'Y'
         ORDER BY TREATY_ID, LAYER_ORDER ASC`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const layersByTreaty = new Map<number, RiTreatyLayerRecord[]>();
      for (const l of lyrRes.rows || []) {
        const tid = Number(l.TREATY_ID);
        if (!layersByTreaty.has(tid)) layersByTreaty.set(tid, []);
        layersByTreaty.get(tid)!.push(l);
      }

      return (trtRes.rows || []).map((t) => ({
        ...t,
        layers: layersByTreaty.get(t.TREATY_ID) || []
      }));
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Create or Update a Treaty with its ordered layers (Retention, Quota Share / CQS, Surplus 1 & 2)
   */
  async saveTreaty(
    payload: {
      treatyId?: number;
      treatyCode: string;
      treatyName: string;
      lobType: 'IL' | 'GL' | 'ALL';
      treatyYear: number;
      effectiveFrom: string;
      effectiveTo: string;
      currencyCode?: string;
      treatyStatus?: 'DRAFT' | 'ACTIVE' | 'EXPIRED';
      remarks?: string;
      layers: Array<{
        layerOrder: number;
        layerType: string;
        layerName: string;
        reinsurerName: string;
        cessionPct: number;
        limitAmount: number;
        riCommissionPct: number;
      }>;
    },
    user: string
  ): Promise<RiTreatyMasterRecord> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      let treatyId = payload.treatyId;

      if (treatyId) {
        await connection.execute(
          `UPDATE T_RI_TREATY_MASTER
           SET TREATY_NAME = :treatyName,
               LOB_TYPE = :lobType,
               TREATY_YEAR = :treatyYear,
               EFFECTIVE_FROM = TO_DATE(:effectiveFrom, 'YYYY-MM-DD'),
               EFFECTIVE_TO = TO_DATE(:effectiveTo, 'YYYY-MM-DD'),
               CURRENCY_CODE = :currencyCode,
               TREATY_STATUS = :treatyStatus,
               REMARKS = :remarks,
               MODIFIED_BY = :appUser,
               MODIFIED_ON = SYSDATE
           WHERE TREATY_ID = :treatyId`,
          {
            treatyId,
            treatyName: payload.treatyName,
            lobType: payload.lobType,
            treatyYear: Number(payload.treatyYear),
            effectiveFrom: payload.effectiveFrom,
            effectiveTo: payload.effectiveTo,
            currencyCode: payload.currencyCode || 'OMR',
            treatyStatus: payload.treatyStatus || 'ACTIVE',
            remarks: payload.remarks || null,
            appUser: user
          },
          { autoCommit: false }
        );

        await connection.execute(
          `DELETE FROM T_RI_TREATY_LAYER WHERE TREATY_ID = :treatyId`,
          { treatyId },
          { autoCommit: false }
        );
      } else {
        const res = await connection.execute<{ outId: number[] }>(
          `INSERT INTO T_RI_TREATY_MASTER (
             TREATY_ID, TREATY_CODE, TREATY_NAME, LOB_TYPE, TREATY_YEAR,
             EFFECTIVE_FROM, EFFECTIVE_TO, CURRENCY_CODE, TREATY_STATUS, REMARKS,
             IS_ACTIVE, CREATED_BY, CREATED_ON
           ) VALUES (
             SEQ_RI_TREATY_ID.NEXTVAL, :treatyCode, :treatyName, :lobType, :treatyYear,
             TO_DATE(:effectiveFrom, 'YYYY-MM-DD'), TO_DATE(:effectiveTo, 'YYYY-MM-DD'),
             :currencyCode, :treatyStatus, :remarks, 'Y', :appUser, SYSDATE
           ) RETURNING TREATY_ID INTO :outId`,
          {
            treatyCode: payload.treatyCode.trim().toUpperCase(),
            treatyName: payload.treatyName,
            lobType: payload.lobType,
            treatyYear: Number(payload.treatyYear),
            effectiveFrom: payload.effectiveFrom,
            effectiveTo: payload.effectiveTo,
            currencyCode: payload.currencyCode || 'OMR',
            treatyStatus: payload.treatyStatus || 'ACTIVE',
            remarks: payload.remarks || null,
            appUser: user,
            outId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
          },
          { autoCommit: false }
        );
        treatyId = (res.outBinds as any)?.outId?.[0];
      }

      for (const l of payload.layers || []) {
        await connection.execute(
          `INSERT INTO T_RI_TREATY_LAYER (
             LAYER_ID, TREATY_ID, LAYER_ORDER, LAYER_TYPE, LAYER_NAME, REINSURER_NAME,
             CESSION_PCT, LIMIT_AMOUNT, RI_COMMISSION_PCT, IS_ACTIVE, CREATED_BY, CREATED_ON
           ) VALUES (
             SEQ_RI_LAYER_ID.NEXTVAL, :treatyId, :layerOrder, :layerType, :layerName, :reinsurerName,
             :cessionPct, :limitAmount, :riCommPct, 'Y', :appUser, SYSDATE
           )`,
          {
            treatyId,
            layerOrder: Number(l.layerOrder),
            layerType: l.layerType,
            layerName: l.layerName,
            reinsurerName: l.reinsurerName,
            cessionPct: Number(l.cessionPct || 0),
            limitAmount: Number(l.limitAmount || 0),
            riCommPct: Number(l.riCommissionPct || 0),
            appUser: user
          },
          { autoCommit: false }
        );
      }

      await connection.commit();
      const all = await this.listTreaties();
      return all.find((t) => t.TREATY_ID === treatyId)!;
    } catch (err) {
      if (connection) await connection.rollback();
      throw err;
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * List all Policy RI Allocations (Individual Life & Group Life)
   */
  async listAllocations(filters?: { status?: string; lobType?: string; search?: string }): Promise<RiPolicyAllocationRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      let sql = `
        SELECT
          ALLOC_ID, ALLOC_NO, POL_NO, LOB_TYPE, TREATY_ID, TREATY_CODE,
          INSURED_NAME, PROD_CODE, POLICY_SUM_ASSURED, POLICY_PREMIUM,
          RETAINED_SA, CEDED_SA, RETAINED_PREMIUM, GROSS_CEDED_PREMIUM,
          TOTAL_RI_COMMISSION, NET_CEDED_PREMIUM, ALLOC_STATUS,
          GL_VOUCHER_NO, GL_POSTED_YN, APPROVED_BY,
          TO_CHAR(APPROVED_ON, 'YYYY-MM-DD HH24:MI:SS') AS APPROVED_ON,
          REMARKS, CREATED_BY,
          TO_CHAR(CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
        FROM T_RI_POLICY_ALLOCATION
        WHERE IS_ACTIVE = 'Y'
      `;
      const binds: Record<string, any> = {};
      if (filters?.status && filters.status !== 'ALL') {
        sql += ` AND ALLOC_STATUS = :status`;
        binds.status = filters.status;
      }
      if (filters?.lobType && filters.lobType !== 'ALL') {
        sql += ` AND LOB_TYPE = :lobType`;
        binds.lobType = filters.lobType;
      }
      if (filters?.search && filters.search.trim()) {
        sql += ` AND (UPPER(ALLOC_NO) LIKE :search OR UPPER(POL_NO) LIKE :search OR UPPER(INSURED_NAME) LIKE :search OR UPPER(TREATY_CODE) LIKE :search)`;
        binds.search = `%${filters.search.trim().toUpperCase()}%`;
      }
      sql += ` ORDER BY ALLOC_ID DESC`;

      const res = await connection.execute<RiPolicyAllocationRecord>(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      });
      return res.rows || [];
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * List eligible policies (both IL and GL) for RI Allocation dropdown
   */
  async listEligiblePolicies(): Promise<
    Array<{ polNo: string; lobType: 'IL' | 'GL'; insuredName: string; prodCode: string; sumAssured: number; annualPremium: number; status: string }>
  > {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const [ilRes, glRes] = await Promise.all([
        connection.execute<any>(
          `SELECT
             p.POL_NO, 'IL' AS LOB_TYPE, NVL(a.PAS_NAME, 'Policyholder') AS INSURED_NAME,
             p.POL_PROD_CODE AS PROD_CODE, NVL(p.POL_SUM_ASSURED, 0) AS SUM_ASSURED,
             NVL(s.PPS_NET_ANNUAL_PREM, NVL(s.PPS_TOTAL_PAYABLE, 0)) AS ANNUAL_PREMIUM,
             p.POL_STATUS AS STATUS
           FROM T_POLICY_INFO p
           LEFT JOIN T_POLICY_ASSURED a ON a.POL_NO = p.POL_NO
           LEFT JOIN T_POLICY_PREMIUM_SUMMARY s ON s.POL_NO = p.POL_NO
           ORDER BY p.POL_ID DESC`,
          {},
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        ),
        connection.execute<any>(
          `SELECT
             MASTER_POLICY_NO AS POL_NO, 'GL' AS LOB_TYPE, CORP_NAME AS INSURED_NAME,
             PROD_CODE, NVL(TOTAL_INFORCE_SA, 0) AS SUM_ASSURED,
             NVL(TOTAL_INFORCE_PREMIUM, 0) AS ANNUAL_PREMIUM,
             POL_STATUS AS STATUS
           FROM T_GL_POLICY_MASTER
           WHERE IS_ACTIVE = 'Y'
           ORDER BY GL_POL_ID DESC`,
          {},
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        )
      ]);

      return [...(ilRes.rows || []), ...(glRes.rows || [])].map((r: any) => ({
        polNo: r.POL_NO,
        lobType: r.LOB_TYPE,
        insuredName: r.INSURED_NAME,
        prodCode: r.PROD_CODE,
        sumAssured: Number(r.SUM_ASSURED || 0),
        annualPremium: Number(r.ANNUAL_PREMIUM || 0),
        status: r.STATUS
      }));
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Run Policy RI Allocation via Oracle PL/SQL PKG_REINSURANCE.SP_ALLOCATE_POLICY_RI
   */
  async allocatePolicyRi(
    payload: {
      polNo: string;
      lobType: 'IL' | 'GL';
      treatyId: number;
      insuredName: string;
      prodCode?: string;
      policySumAssured: number;
      policyPremium: number;
    },
    user: string
  ): Promise<RiAllocationDetail> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const execRes = await connection.execute<any>(
        `BEGIN
           PKG_REINSURANCE.SP_ALLOCATE_POLICY_RI(
             p_pol_no             => :polNo,
             p_lob_type           => :lobType,
             p_treaty_id          => :treatyId,
             p_insured_name       => :insuredName,
             p_prod_code          => :prodCode,
             p_policy_sa          => :policySa,
             p_policy_prem        => :policyPrem,
             p_user               => :appUser,
             p_out_alloc_no       => :outAllocNo,
             p_out_retained_sa    => :outRetSa,
             p_out_ceded_sa       => :outCededSa,
             p_out_net_ceded_prem => :outNetCeded
           );
         END;`,
        {
          polNo: payload.polNo,
          lobType: payload.lobType,
          treatyId: Number(payload.treatyId),
          insuredName: payload.insuredName,
          prodCode: payload.prodCode || null,
          policySa: Number(payload.policySumAssured),
          policyPrem: Number(payload.policyPremium),
          appUser: user,
          outAllocNo: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 50 },
          outRetSa: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          outCededSa: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          outNetCeded: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        },
        { autoCommit: true }
      );

      const allocNo = (execRes.outBinds as any).outAllocNo;
      return (await this.findAllocationByNo(allocNo))!;
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Fetch single Policy RI Allocation with Layer Breakdown & Posted GL Accounting Entries
   */
  async findAllocationByNo(allocNo: string): Promise<RiAllocationDetail | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const hdrRes = await connection.execute<RiPolicyAllocationRecord>(
        `SELECT
           ALLOC_ID, ALLOC_NO, POL_NO, LOB_TYPE, TREATY_ID, TREATY_CODE,
           INSURED_NAME, PROD_CODE, POLICY_SUM_ASSURED, POLICY_PREMIUM,
           RETAINED_SA, CEDED_SA, RETAINED_PREMIUM, GROSS_CEDED_PREMIUM,
           TOTAL_RI_COMMISSION, NET_CEDED_PREMIUM, ALLOC_STATUS,
           GL_VOUCHER_NO, GL_POSTED_YN, APPROVED_BY,
           TO_CHAR(APPROVED_ON, 'YYYY-MM-DD HH24:MI:SS') AS APPROVED_ON,
           REMARKS, CREATED_BY,
           TO_CHAR(CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
         FROM T_RI_POLICY_ALLOCATION
         WHERE ALLOC_NO = :allocNo`,
        { allocNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (!hdrRes.rows || hdrRes.rows.length === 0) return null;

      const [lyrRes, glRes] = await Promise.all([
        connection.execute<RiPolicyAllocLayerRecord>(
          `SELECT
             ALLOC_LAYER_ID, ALLOC_NO, POL_NO, LAYER_ORDER, LAYER_TYPE, LAYER_NAME, REINSURER_NAME,
             ALLOCATED_SA, SHARE_PCT, ALLOCATED_PREMIUM, RI_COMMISSION_PCT, RI_COMMISSION_AMT, NET_PAYABLE_RI
           FROM T_RI_POLICY_ALLOC_LAYER
           WHERE ALLOC_NO = :allocNo
           ORDER BY LAYER_ORDER ASC`,
          { allocNo },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        ),
        connection.execute<RiJournalEntryRecord>(
          `SELECT
             ENTRY_ID, JOURNAL_VOUCHER_NO, TO_CHAR(VOUCHER_DATE, 'YYYY-MM-DD') AS VOUCHER_DATE,
             TXN_SOURCE, SOURCE_REF_NO, GL_ACCOUNT_CODE, GL_ACCOUNT_NAME,
             DR_CR_FLAG, AMOUNT, NARRATION, CREATED_BY,
             TO_CHAR(CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
           FROM T_GL_JOURNAL_ENTRY
           WHERE TXN_SOURCE = 'RI_ALLOCATION' AND SOURCE_REF_NO = :allocNo
           ORDER BY CASE WHEN DR_CR_FLAG = 'D' THEN 0 ELSE 1 END, ENTRY_ID ASC`,
          { allocNo },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        )
      ]);

      return {
        allocation: hdrRes.rows[0],
        layers: lyrRes.rows || [],
        journalEntries: glRes.rows || []
      };
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Approve RI Allocation & Post Balanced GL Accounting Voucher via PKG_REINSURANCE.SP_APPROVE_RI_ALLOCATION
   */
  async approveAllocation(allocNo: string, remarks: string, user: string): Promise<{ detail: RiAllocationDetail; voucherNo: string }> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const res = await connection.execute<any>(
        `BEGIN
           PKG_REINSURANCE.SP_APPROVE_RI_ALLOCATION(
             p_alloc_no       => :allocNo,
             p_remarks        => :remarks,
             p_user           => :appUser,
             p_out_voucher_no => :outVoucherNo
           );
         END;`,
        {
          allocNo,
          remarks: remarks || 'Authorized by Reinsurance Officer',
          appUser: user,
          outVoucherNo: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 50 }
        },
        { autoCommit: true }
      );
      const voucherNo = (res.outBinds as any).outVoucherNo;
      const detail = (await this.findAllocationByNo(allocNo))!;
      return { detail, voucherNo };
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Reject RI Allocation
   */
  async rejectAllocation(allocNo: string, remarks: string, user: string): Promise<RiAllocationDetail> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      await connection.execute(
        `UPDATE T_RI_POLICY_ALLOCATION
         SET ALLOC_STATUS = 'REJECTED',
             APPROVED_BY = :appUser,
             APPROVED_ON = SYSDATE,
             REMARKS = :remarks
         WHERE ALLOC_NO = :allocNo`,
        { allocNo, remarks: remarks || 'Rejected by Reinsurance Officer', appUser: user },
        { autoCommit: true }
      );
      return (await this.findAllocationByNo(allocNo))!;
    } finally {
      await releaseConnection(connection);
    }
  }
};
