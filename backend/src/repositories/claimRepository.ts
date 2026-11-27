import oracledb from 'oracledb';
import { getConnection, releaseConnection } from '../config/database';
import {
  ClaimMasterRecord,
  ClaimDocumentRecord,
  ClaimAssessmentRecord,
  ClaimSettlementRecord,
  ClaimJournalEntryRecord,
  ClaimAuditRecord,
  ClaimDetail,
  PolicyLookupForClaim
} from '../types/claim';

export const claimRepository = {
  /**
   * List all claims with optional status, lob, claimType, search filters
   */
  async findAll(filters?: {
    status?: string;
    lobType?: string;
    claimType?: string;
    search?: string;
  }): Promise<ClaimMasterRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      let sql = `
        SELECT
          c.CLAIM_ID, c.CLAIM_NO, c.LOB_TYPE, c.POL_NO, c.MEMBER_EMP_ID,
          c.INSURED_NAME, c.PROD_CODE, c.POLICY_SUM_ASSURED, c.CLAIM_TYPE,
          TO_CHAR(c.DATE_OF_LOSS, 'YYYY-MM-DD') AS DATE_OF_LOSS,
          TO_CHAR(c.DATE_OF_INTIMATION, 'YYYY-MM-DD') AS DATE_OF_INTIMATION,
          c.CAUSE_OF_LOSS, c.PLACE_OF_LOSS, c.LOSS_DESCRIPTION,
          c.INTIMANT_NAME, c.INTIMANT_RELATION, c.INTIMANT_CONTACT, c.INTIMANT_EMAIL,
          c.CLAIMED_AMOUNT, c.ESTIMATED_RESERVE, c.CLAIM_STATUS, c.REJECTION_REASON,
          c.IS_ACTIVE, c.CREATED_BY,
          TO_CHAR(c.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
          c.MODIFIED_BY,
          TO_CHAR(c.MODIFIED_ON, 'YYYY-MM-DD HH24:MI:SS') AS MODIFIED_ON,
          a.NET_PAYABLE_AMOUNT,
          s.SETTLED_AMOUNT,
          s.GL_VOUCHER_NO
        FROM T_CLAIM_MASTER c
        LEFT JOIN T_CLAIM_ASSESSMENT a ON a.CLAIM_NO = c.CLAIM_NO
        LEFT JOIN T_CLAIM_SETTLEMENT s ON s.CLAIM_NO = c.CLAIM_NO
        WHERE c.IS_ACTIVE = 'Y'
      `;
      const binds: Record<string, any> = {};
      if (filters?.status && filters.status !== 'ALL') {
        sql += ` AND c.CLAIM_STATUS = :status`;
        binds.status = filters.status;
      }
      if (filters?.lobType && filters.lobType !== 'ALL') {
        sql += ` AND c.LOB_TYPE = :lobType`;
        binds.lobType = filters.lobType;
      }
      if (filters?.claimType && filters.claimType !== 'ALL') {
        sql += ` AND c.CLAIM_TYPE = :claimType`;
        binds.claimType = filters.claimType;
      }
      if (filters?.search && filters.search.trim()) {
        sql += ` AND (
          UPPER(c.CLAIM_NO) LIKE :search OR
          UPPER(c.POL_NO) LIKE :search OR
          UPPER(c.INSURED_NAME) LIKE :search OR
          UPPER(c.INTIMANT_NAME) LIKE :search
        )`;
        binds.search = `%${filters.search.trim().toUpperCase()}%`;
      }
      sql += ` ORDER BY c.CLAIM_ID DESC`;

      const res = await connection.execute<ClaimMasterRecord>(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      });
      return res.rows || [];
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Lookup Individual Life or Group Life policy details for FNOL registration
   */
  async lookupPolicyForClaim(polNo: string): Promise<PolicyLookupForClaim | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const cleaned = polNo.trim().toUpperCase();

      // 1. Try Individual Life Policy (T_POLICY_INFO)
      const ilRes = await connection.execute<any>(
        `SELECT
           p.POL_NO, p.POL_PROD_CODE, NVL(pr.PROD_NAME, p.POL_PROD_CODE) AS PROD_NAME,
           p.POL_STATUS, TO_CHAR(p.POL_INCEPTION_DATE, 'YYYY-MM-DD') AS INCEPTION_DATE,
           p.POL_SUM_ASSURED, NVL(a.PAS_NAME, 'Policyholder') AS INSURED_NAME
         FROM T_POLICY_INFO p
         LEFT JOIN T_POLICY_ASSURED a ON a.POL_NO = p.POL_NO
         LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = p.POL_PROD_CODE
         WHERE UPPER(p.POL_NO) = :polNo`,
        { polNo: cleaned },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (ilRes.rows && ilRes.rows.length > 0) {
        const p = ilRes.rows[0];
        const benRes = await connection.execute<any>(
          `SELECT PBEN_NAME, PBEN_RELATION, PBEN_SHARE_PCT, PBEN_CONTACT
           FROM T_POLICY_BENEFICIARY WHERE POL_NO = :polNo ORDER BY PBEN_ID ASC`,
          { polNo: p.POL_NO },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        const loanRes = await connection.execute<{ BAL: number }>(
          `SELECT NVL(SUM(OUTSTANDING_PRINCIPAL + ACCRUED_INTEREST), 0) AS BAL
           FROM T_POLICY_LOAN WHERE POL_NO = :polNo AND STATUS = 'ACTIVE'`,
          { polNo: p.POL_NO },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return {
          lobType: 'IL',
          polNo: p.POL_NO,
          prodCode: p.POL_PROD_CODE,
          prodName: p.PROD_NAME,
          polStatus: p.POL_STATUS,
          inceptionDate: p.INCEPTION_DATE || '',
          sumAssured: Number(p.POL_SUM_ASSURED || 0),
          insuredName: p.INSURED_NAME,
          activeLoanBalance: Number(loanRes.rows?.[0]?.BAL || 0),
          beneficiaries: (benRes.rows || []).map((b: any) => ({
            name: b.PBEN_NAME,
            relation: b.PBEN_RELATION,
            sharePct: Number(b.PBEN_SHARE_PCT || 100),
            contact: b.PBEN_CONTACT || ''
          }))
        };
      }

      // 2. Try Group Life Master Policy (T_GL_POLICY_MASTER)
      const glRes = await connection.execute<any>(
        `SELECT
           p.MASTER_POLICY_NO, p.PROD_CODE, NVL(pr.PROD_NAME, p.PROD_CODE) AS PROD_NAME,
           p.POL_STATUS, TO_CHAR(p.POLICY_INCEPTION_DATE, 'YYYY-MM-DD') AS INCEPTION_DATE,
           p.TOTAL_INFORCE_SA, p.CORP_NAME
         FROM T_GL_POLICY_MASTER p
         LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = p.PROD_CODE
         WHERE UPPER(p.MASTER_POLICY_NO) = :polNo`,
        { polNo: cleaned },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (glRes.rows && glRes.rows.length > 0) {
        const g = glRes.rows[0];
        const memRes = await connection.execute<any>(
          `SELECT EMP_ID, MEMBER_NAME, SUM_ASSURED, NVL(EFFECTIVE_SA, SUM_ASSURED) AS EFFECTIVE_SA, CATEGORY
           FROM T_GL_POLICY_MEMBER
           WHERE MASTER_POLICY_NO = :polNo AND IS_ACTIVE = 'Y'
           ORDER BY MEMBER_ID ASC`,
          { polNo: g.MASTER_POLICY_NO },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return {
          lobType: 'GL',
          polNo: g.MASTER_POLICY_NO,
          prodCode: g.PROD_CODE,
          prodName: g.PROD_NAME,
          polStatus: g.POL_STATUS,
          inceptionDate: g.INCEPTION_DATE || '',
          sumAssured: Number(g.TOTAL_INFORCE_SA || 0),
          insuredName: g.CORP_NAME,
          activeLoanBalance: 0,
          beneficiaries: [],
          groupMembers: (memRes.rows || []).map((m: any) => ({
            empId: m.EMP_ID,
            memberName: m.MEMBER_NAME,
            sumAssured: Number(m.SUM_ASSURED || 0),
            effectiveSa: Number(m.EFFECTIVE_SA || m.SUM_ASSURED || 0),
            category: m.CATEGORY || 'Staff'
          }))
        };
      }

      return null;
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Stage 1: Register First Notification of Loss (FNOL) using PKG_CLAIMS.FN_GENERATE_CLAIM_NO
   */
  async registerFnol(
    payload: {
      lobType: 'IL' | 'GL';
      polNo: string;
      memberEmpId?: string;
      insuredName: string;
      prodCode?: string;
      policySumAssured: number;
      claimType: string;
      dateOfLoss: string;
      causeOfLoss: string;
      placeOfLoss?: string;
      lossDescription?: string;
      intimantName: string;
      intimantRelation?: string;
      intimantContact?: string;
      intimantEmail?: string;
      claimedAmount: number;
    },
    user: string
  ): Promise<ClaimDetail> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      // Call Oracle Function PKG_CLAIMS.FN_GENERATE_CLAIM_NO
      const noRes = await connection.execute<{ CLAIM_NO: string }>(
        `SELECT PKG_CLAIMS.FN_GENERATE_CLAIM_NO AS CLAIM_NO FROM DUAL`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const claimNo = noRes.rows![0].CLAIM_NO;

      await connection.execute(
        `INSERT INTO T_CLAIM_MASTER (
           CLAIM_ID, CLAIM_NO, LOB_TYPE, POL_NO, MEMBER_EMP_ID, INSURED_NAME, PROD_CODE,
           POLICY_SUM_ASSURED, CLAIM_TYPE, DATE_OF_LOSS, DATE_OF_INTIMATION,
           CAUSE_OF_LOSS, PLACE_OF_LOSS, LOSS_DESCRIPTION,
           INTIMANT_NAME, INTIMANT_RELATION, INTIMANT_CONTACT, INTIMANT_EMAIL,
           CLAIMED_AMOUNT, ESTIMATED_RESERVE, CLAIM_STATUS, IS_ACTIVE, CREATED_BY, CREATED_ON
         ) VALUES (
           SEQ_CLAIM_ID.NEXTVAL, :claimNo, :lobType, :polNo, :memberEmpId, :insuredName, :prodCode,
           :policySa, :claimType, TO_DATE(:dateOfLoss, 'YYYY-MM-DD'), SYSDATE,
           :causeOfLoss, :placeOfLoss, :lossDesc,
           :intimantName, :intimantRelation, :intimantContact, :intimantEmail,
           :claimedAmount, :claimedAmount, 'FNOL_REGISTERED', 'Y', :appUser, SYSDATE
         )`,
        {
          claimNo,
          lobType: payload.lobType || 'IL',
          polNo: payload.polNo,
          memberEmpId: payload.memberEmpId || null,
          insuredName: payload.insuredName,
          prodCode: payload.prodCode || null,
          policySa: Number(payload.policySumAssured || 0),
          claimType: payload.claimType,
          dateOfLoss: payload.dateOfLoss,
          causeOfLoss: payload.causeOfLoss,
          placeOfLoss: payload.placeOfLoss || null,
          lossDesc: payload.lossDescription || null,
          intimantName: payload.intimantName,
          intimantRelation: payload.intimantRelation || null,
          intimantContact: payload.intimantContact || null,
          intimantEmail: payload.intimantEmail || null,
          claimedAmount: Number(payload.claimedAmount || 0),
          appUser: user
        },
        { autoCommit: false }
      );

      await connection.execute(
        `INSERT INTO T_CLAIM_AUDIT_LOG (
           AUDIT_ID, CLAIM_NO, ACTION_TYPE, FROM_STATUS, TO_STATUS, ACTION_BY, ACTION_ON, REMARKS
         ) VALUES (
           SEQ_CLAIM_AUDIT_ID.NEXTVAL, :claimNo, 'FNOL_REGISTRATION', NULL, 'FNOL_REGISTERED',
           :appUser, SYSDATE, :remarks
         )`,
        {
          claimNo,
          appUser: user,
          remarks: `FNOL registered for ${payload.polNo} (${payload.claimType}) — Claimed: ${payload.claimedAmount}`
        },
        { autoCommit: false }
      );

      await connection.commit();
      return (await this.findByClaimNo(claimNo))!;
    } catch (err) {
      if (connection) await connection.rollback();
      throw err;
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Fetch full Claim Detail (Master, Documents, Assessment, Settlement, GL Journal Entries, Audit)
   */
  async findByClaimNo(claimNo: string): Promise<ClaimDetail | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const hdrRes = await connection.execute<ClaimMasterRecord>(
        `SELECT
           c.CLAIM_ID, c.CLAIM_NO, c.LOB_TYPE, c.POL_NO, c.MEMBER_EMP_ID,
           c.INSURED_NAME, c.PROD_CODE, c.POLICY_SUM_ASSURED, c.CLAIM_TYPE,
           TO_CHAR(c.DATE_OF_LOSS, 'YYYY-MM-DD') AS DATE_OF_LOSS,
           TO_CHAR(c.DATE_OF_INTIMATION, 'YYYY-MM-DD') AS DATE_OF_INTIMATION,
           c.CAUSE_OF_LOSS, c.PLACE_OF_LOSS, c.LOSS_DESCRIPTION,
           c.INTIMANT_NAME, c.INTIMANT_RELATION, c.INTIMANT_CONTACT, c.INTIMANT_EMAIL,
           c.CLAIMED_AMOUNT, c.ESTIMATED_RESERVE, c.CLAIM_STATUS, c.REJECTION_REASON,
           c.IS_ACTIVE, c.CREATED_BY,
           TO_CHAR(c.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
           c.MODIFIED_BY,
           TO_CHAR(c.MODIFIED_ON, 'YYYY-MM-DD HH24:MI:SS') AS MODIFIED_ON
         FROM T_CLAIM_MASTER c
         WHERE c.CLAIM_NO = :claimNo`,
        { claimNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (!hdrRes.rows || hdrRes.rows.length === 0) return null;

      const [docRes, assessRes, settleRes, glRes, auditRes] = await Promise.all([
        connection.execute<ClaimDocumentRecord>(
          `SELECT CLAIM_DOC_ID, CLAIM_NO, DOC_TYPE, FILE_NAME, STORED_FILE_NAME, FILE_PATH,
                  MIME_TYPE, FILE_SIZE, REMARKS, IS_ACTIVE, UPLOADED_BY,
                  TO_CHAR(UPLOADED_ON, 'YYYY-MM-DD HH24:MI:SS') AS UPLOADED_ON
           FROM T_CLAIM_DOCUMENT WHERE CLAIM_NO = :claimNo AND IS_ACTIVE = 'Y' ORDER BY CLAIM_DOC_ID DESC`,
          { claimNo },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        ),
        connection.execute<ClaimAssessmentRecord>(
          `SELECT ASSESSMENT_ID, CLAIM_NO, POLICY_INFORCE_YN, WAITING_PERIOD_OK_YN,
                  EXCLUSION_APPLICABLE_YN, EXCLUSION_REMARKS,
                  BASE_SUM_ASSURED, RIDER_BENEFIT_AMOUNT, BONUS_AMOUNT, GROSS_ADMISSIBLE_AMOUNT,
                  LOAN_DEDUCTION, UNPAID_PREM_DEDUCTION, OTHER_DEDUCTION, NET_PAYABLE_AMOUNT,
                  ASSESSMENT_DECISION, ASSESSOR_REMARKS, ASSESSED_BY,
                  TO_CHAR(ASSESSED_ON, 'YYYY-MM-DD HH24:MI:SS') AS ASSESSED_ON
           FROM T_CLAIM_ASSESSMENT WHERE CLAIM_NO = :claimNo ORDER BY ASSESSMENT_ID DESC`,
          { claimNo },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        ),
        connection.execute<ClaimSettlementRecord>(
          `SELECT SETTLEMENT_ID, SETTLEMENT_NO, CLAIM_NO,
                  PAYEE_NAME, PAYEE_RELATION, PAYEE_BANK_NAME, PAYEE_ACCOUNT_NO, PAYEE_IBAN,
                  PAYMENT_MODE, PAYMENT_REF_NO, GROSS_AMOUNT, TOTAL_DEDUCTIONS, SETTLED_AMOUNT,
                  TO_CHAR(SETTLEMENT_DATE, 'YYYY-MM-DD') AS SETTLEMENT_DATE,
                  GL_VOUCHER_NO, GL_POSTED_YN, SETTLEMENT_STATUS, APPROVED_BY,
                  TO_CHAR(APPROVED_ON, 'YYYY-MM-DD HH24:MI:SS') AS APPROVED_ON,
                  SETTLEMENT_REMARKS
           FROM T_CLAIM_SETTLEMENT WHERE CLAIM_NO = :claimNo ORDER BY SETTLEMENT_ID DESC`,
          { claimNo },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        ),
        connection.execute<ClaimJournalEntryRecord>(
          `SELECT ENTRY_ID, JOURNAL_VOUCHER_NO,
                  TO_CHAR(VOUCHER_DATE, 'YYYY-MM-DD') AS VOUCHER_DATE,
                  TXN_SOURCE, SOURCE_REF_NO, GL_ACCOUNT_CODE, GL_ACCOUNT_NAME,
                  DR_CR_FLAG, AMOUNT, NARRATION, CREATED_BY,
                  TO_CHAR(CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
           FROM T_GL_JOURNAL_ENTRY
           WHERE TXN_SOURCE = 'CLAIM_SETTLEMENT' AND SOURCE_REF_NO = :claimNo
           ORDER BY CASE WHEN DR_CR_FLAG = 'D' THEN 0 ELSE 1 END, ENTRY_ID ASC`,
          { claimNo },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        ),
        connection.execute<ClaimAuditRecord>(
          `SELECT AUDIT_ID, CLAIM_NO, ACTION_TYPE, FROM_STATUS, TO_STATUS, ACTION_BY,
                  TO_CHAR(ACTION_ON, 'YYYY-MM-DD HH24:MI:SS') AS ACTION_ON, REMARKS
           FROM T_CLAIM_AUDIT_LOG WHERE CLAIM_NO = :claimNo ORDER BY AUDIT_ID DESC`,
          { claimNo },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        )
      ]);

      return {
        master: hdrRes.rows[0],
        documents: docRes.rows || [],
        assessment: assessRes.rows?.[0] || null,
        settlement: settleRes.rows?.[0] || null,
        journalEntries: glRes.rows || [],
        auditLogs: auditRes.rows || []
      };
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Stage 2: Assess Claim via Oracle PL/SQL PKG_CLAIMS.SP_ASSESS_CLAIM
   */
  async assessClaim(
    claimNo: string,
    payload: {
      policyInforceYn: 'Y' | 'N';
      waitingPeriodOkYn: 'Y' | 'N';
      exclusionApplicableYn: 'Y' | 'N';
      exclusionRemarks?: string;
      baseSumAssured: number;
      riderBenefitAmount?: number;
      bonusAmount?: number;
      loanDeduction?: number;
      unpaidPremDeduction?: number;
      otherDeduction?: number;
      assessmentDecision: 'RECOMMEND_APPROVAL' | 'RECOMMEND_REJECTION' | 'INVESTIGATION_REQUIRED';
      assessorRemarks?: string;
    },
    user: string
  ): Promise<ClaimDetail> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      await connection.execute(
        `BEGIN
           PKG_CLAIMS.SP_ASSESS_CLAIM(
             p_claim_no             => :claimNo,
             p_policy_inforce_yn    => :policyInforceYn,
             p_waiting_period_ok_yn => :waitingPeriodOkYn,
             p_exclusion_app_yn     => :exclusionAppYn,
             p_exclusion_remarks    => :exclusionRemarks,
             p_base_sa              => :baseSa,
             p_rider_amt            => :riderAmt,
             p_bonus_amt            => :bonusAmt,
             p_loan_ded             => :loanDed,
             p_unpaid_prem_ded      => :unpaidPremDed,
             p_other_ded            => :otherDed,
             p_decision             => :decision,
             p_assessor_remarks     => :assessorRemarks,
             p_user                 => :appUser,
             p_out_gross            => :outGross,
             p_out_net_payable      => :outNet
           );
         END;`,
        {
          claimNo,
          policyInforceYn: payload.policyInforceYn || 'Y',
          waitingPeriodOkYn: payload.waitingPeriodOkYn || 'Y',
          exclusionAppYn: payload.exclusionApplicableYn || 'N',
          exclusionRemarks: payload.exclusionRemarks || null,
          baseSa: Number(payload.baseSumAssured || 0),
          riderAmt: Number(payload.riderBenefitAmount || 0),
          bonusAmt: Number(payload.bonusAmount || 0),
          loanDed: Number(payload.loanDeduction || 0),
          unpaidPremDed: Number(payload.unpaidPremDeduction || 0),
          otherDed: Number(payload.otherDeduction || 0),
          decision: payload.assessmentDecision,
          assessorRemarks: payload.assessorRemarks || null,
          appUser: user,
          outGross: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          outNet: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        },
        { autoCommit: true }
      );

      return (await this.findByClaimNo(claimNo))!;
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Approve or Reject an Assessed Claim
   */
  async updateClaimDecision(
    claimNo: string,
    decision: 'APPROVED' | 'REJECTED',
    remarks: string,
    user: string
  ): Promise<ClaimDetail> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const currRes = await connection.execute<{ CLAIM_STATUS: string }>(
        `SELECT CLAIM_STATUS FROM T_CLAIM_MASTER WHERE CLAIM_NO = :claimNo`,
        { claimNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (!currRes.rows || currRes.rows.length === 0) {
        throw new Error(`Claim ${claimNo} not found`);
      }
      const fromStatus = currRes.rows[0].CLAIM_STATUS;

      await connection.execute(
        `UPDATE T_CLAIM_MASTER
         SET CLAIM_STATUS = :newStatus,
             REJECTION_REASON = CASE WHEN :newStatus = 'REJECTED' THEN :remarks ELSE REJECTION_REASON END,
             MODIFIED_BY = :appUser,
             MODIFIED_ON = SYSDATE
         WHERE CLAIM_NO = :claimNo`,
        { newStatus: decision, remarks: remarks || null, appUser: user, claimNo },
        { autoCommit: false }
      );

      await connection.execute(
        `INSERT INTO T_CLAIM_AUDIT_LOG (
           AUDIT_ID, CLAIM_NO, ACTION_TYPE, FROM_STATUS, TO_STATUS, ACTION_BY, ACTION_ON, REMARKS
         ) VALUES (
           SEQ_CLAIM_AUDIT_ID.NEXTVAL, :claimNo, :actionType, :fromStatus, :toStatus, :appUser, SYSDATE, :remarks
         )`,
        {
          claimNo,
          actionType: decision === 'APPROVED' ? 'CLAIM_APPROVAL' : 'CLAIM_REJECTION',
          fromStatus,
          toStatus: decision,
          appUser: user,
          remarks: remarks || (decision === 'APPROVED' ? 'Claim approved for settlement' : 'Claim rejected')
        },
        { autoCommit: false }
      );

      await connection.commit();
      return (await this.findByClaimNo(claimNo))!;
    } catch (err) {
      if (connection) await connection.rollback();
      throw err;
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Stage 3 & 4: Settle Claim & Post Balanced GL Journal Entries via PKG_CLAIMS.SP_SETTLE_CLAIM
   */
  async settleClaim(
    claimNo: string,
    payload: {
      payeeName: string;
      payeeRelation?: string;
      payeeBankName?: string;
      payeeAccountNo?: string;
      payeeIban?: string;
      paymentMode: 'BANK_TRANSFER' | 'CHEQUE' | 'NEFT_RTGS' | 'DIRECT_CREDIT';
      paymentRefNo?: string;
      remarks?: string;
    },
    user: string
  ): Promise<{ detail: ClaimDetail; settlementNo: string; voucherNo: string; settledAmount: number }> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const execRes = await connection.execute<any>(
        `BEGIN
           PKG_CLAIMS.SP_SETTLE_CLAIM(
             p_claim_no           => :claimNo,
             p_payee_name         => :payeeName,
             p_payee_relation     => :payeeRelation,
             p_payee_bank_name    => :payeeBankName,
             p_payee_account_no   => :payeeAccountNo,
             p_payee_iban         => :payeeIban,
             p_payment_mode       => :paymentMode,
             p_payment_ref_no     => :paymentRefNo,
             p_remarks            => :remarks,
             p_user               => :appUser,
             p_out_settlement_no  => :outStlNo,
             p_out_voucher_no     => :outVoucherNo,
             p_out_settled_amount => :outAmount
           );
         END;`,
        {
          claimNo,
          payeeName: payload.payeeName,
          payeeRelation: payload.payeeRelation || null,
          payeeBankName: payload.payeeBankName || null,
          payeeAccountNo: payload.payeeAccountNo || null,
          payeeIban: payload.payeeIban || null,
          paymentMode: payload.paymentMode || 'BANK_TRANSFER',
          paymentRefNo: payload.paymentRefNo || null,
          remarks: payload.remarks || null,
          appUser: user,
          outStlNo: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 50 },
          outVoucherNo: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 50 },
          outAmount: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        },
        { autoCommit: true }
      );

      const binds = execRes.outBinds as any;
      const detail = (await this.findByClaimNo(claimNo))!;
      return {
        detail,
        settlementNo: binds.outStlNo,
        voucherNo: binds.outVoucherNo,
        settledAmount: Number(binds.outAmount || 0)
      };
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Read configured Claim Document storage directory path from STBL_SYS_PARAM (SYS_PARAM_DESC)
   */
  async getClaimDocStoragePath(): Promise<string | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const res = await connection.execute<{ SYS_PARAM_DESC: string | null }>(
        `SELECT SYS_PARAM_DESC
         FROM STBL_SYS_PARAM
         WHERE SYS_PARAM_CODE = 'CLAIM_DOC_PATH'
           AND SYS_SUB_PARAM = 'CLAIM_UPLOAD'`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const val = res.rows?.[0]?.SYS_PARAM_DESC;
      return val && val.trim() ? val.trim() : null;
    } finally {
      await releaseConnection(connection);
    }
  },

  async addClaimDocument(doc: {
    claimNo: string;
    docType: string;
    fileName: string;
    storedFileName: string;
    filePath: string;
    mimeType?: string;
    fileSize: number;
    remarks?: string;
    user: string;
  }): Promise<ClaimDocumentRecord> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const res = await connection.execute<{ outId: number[] }>(
        `INSERT INTO T_CLAIM_DOCUMENT (
           CLAIM_DOC_ID, CLAIM_NO, DOC_TYPE, FILE_NAME, STORED_FILE_NAME, FILE_PATH,
           MIME_TYPE, FILE_SIZE, REMARKS, IS_ACTIVE, UPLOADED_BY, UPLOADED_ON
         ) VALUES (
           SEQ_CLAIM_DOC_ID.NEXTVAL, :claimNo, :docType, :fileName, :storedFileName, :filePath,
           :mimeType, :fileSize, :remarks, 'Y', :appUser, SYSDATE
         ) RETURNING CLAIM_DOC_ID INTO :outId`,
        {
          claimNo: doc.claimNo,
          docType: doc.docType,
          fileName: doc.fileName,
          storedFileName: doc.storedFileName,
          filePath: doc.filePath,
          mimeType: doc.mimeType || 'application/octet-stream',
          fileSize: doc.fileSize,
          remarks: doc.remarks || null,
          appUser: doc.user,
          outId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        },
        { autoCommit: true }
      );
      const insertedId = (res.outBinds as any)?.outId?.[0];
      return (await this.getClaimDocumentById(insertedId))!;
    } finally {
      await releaseConnection(connection);
    }
  },

  async getClaimDocumentById(docId: number): Promise<ClaimDocumentRecord | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const res = await connection.execute<ClaimDocumentRecord>(
        `SELECT CLAIM_DOC_ID, CLAIM_NO, DOC_TYPE, FILE_NAME, STORED_FILE_NAME, FILE_PATH,
                MIME_TYPE, FILE_SIZE, REMARKS, IS_ACTIVE, UPLOADED_BY,
                TO_CHAR(UPLOADED_ON, 'YYYY-MM-DD HH24:MI:SS') AS UPLOADED_ON
         FROM T_CLAIM_DOCUMENT WHERE CLAIM_DOC_ID = :docId AND IS_ACTIVE = 'Y'`,
        { docId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return res.rows?.[0] || null;
    } finally {
      await releaseConnection(connection);
    }
  },

  async deleteClaimDocument(docId: number): Promise<void> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      await connection.execute(
        `UPDATE T_CLAIM_DOCUMENT SET IS_ACTIVE = 'N' WHERE CLAIM_DOC_ID = :docId`,
        { docId },
        { autoCommit: true }
      );
    } finally {
      await releaseConnection(connection);
    }
  }
};
