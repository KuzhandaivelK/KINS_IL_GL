import oracledb from 'oracledb';
import crypto from 'crypto';
import { getConnection, releaseConnection } from '../config/database';
import {
  PolicyInfoRecord,
  PolicyAssuredRecord,
  PolicyRiderRecord,
  PolicyDiscLoadRecord,
  PolicyBeneficiaryRecord,
  PolicyExclusionRecord,
  PolicyPremiumSummaryRecord,
  PolicyDetail,
  PolicyApprovalInput
} from '../types/policy';
import { proposalRepository } from './proposalRepository';

export const policyRepository = {
  /**
   * List all policies with status and search filters
   */
  async findAll(status?: string, search?: string): Promise<PolicyInfoRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      let sql = `
        SELECT 
          p.POL_ID,
          p.POL_NO,
          p.POL_UID,
          p.PROP_NO,
          TO_CHAR(p.POL_DATE, 'YYYY-MM-DD') AS POL_DATE,
          TO_CHAR(p.POL_ISSUE_DATE, 'YYYY-MM-DD') AS POL_ISSUE_DATE,
          TO_CHAR(p.POL_INCEPTION_DATE, 'YYYY-MM-DD') AS POL_INCEPTION_DATE,
          TO_CHAR(p.POL_MATURITY_DATE, 'YYYY-MM-DD') AS POL_MATURITY_DATE,
          p.POL_PROD_CODE,
          pr.PROD_NAME,
          p.POL_PLAN_TYPE,
          p.POL_TERM,
          p.POL_PREM_PAY_TERM,
          p.POL_SUM_ASSURED,
          p.POL_PAY_FREQ,
          p.POL_MOP,
          p.POL_STATUS,
          p.POL_APPROVAL_LEVEL,
          p.POL_APPROVED_BY,
          TO_CHAR(p.POL_APPROVED_ON, 'YYYY-MM-DD HH24:MI:SS') AS POL_APPROVED_ON,
          p.POL_APPROVAL_REMARKS,
          p.IS_ACTIVE,
          p.CREATED_BY,
          TO_CHAR(p.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
          p.MODIFIED_BY,
          TO_CHAR(p.MODIFIED_ON, 'YYYY-MM-DD HH24:MI:SS') AS MODIFIED_ON,
          a.PAS_NAME,
          a.PAS_AGE,
          a.PAS_GENDER,
          s.PPS_TOTAL_PAYABLE AS TOTAL_PAYABLE
        FROM T_POLICY_INFO p
        LEFT JOIN T_POLICY_ASSURED a ON a.POL_NO = p.POL_NO
        LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = p.POL_PROD_CODE
        LEFT JOIN T_POLICY_PREMIUM_SUMMARY s ON s.POL_NO = p.POL_NO
        WHERE 1=1
      `;

      const binds: Record<string, any> = {};

      if (status && status.trim() !== '' && status.trim().toUpperCase() !== 'ALL') {
        sql += ` AND p.POL_STATUS = :status`;
        binds.status = status.trim().toUpperCase();
      }

      if (search && search.trim() !== '') {
        sql += ` AND (UPPER(p.POL_NO) LIKE :search OR UPPER(p.PROP_NO) LIKE :search OR UPPER(a.PAS_NAME) LIKE :search OR UPPER(pr.PROD_NAME) LIKE :search)`;
        binds.search = `%${search.trim().toUpperCase()}%`;
      }

      sql += ` ORDER BY p.POL_ID DESC`;

      const result = await connection.execute<PolicyInfoRecord>(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      });

      return result.rows || [];
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Fetch complete aggregate policy details by Policy No or UID
   */
  async findByPolicyNo(polNoOrUid: string): Promise<PolicyDetail | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const identifier = polNoOrUid.trim();

      // 1. Policy Header
      const infoSql = `
        SELECT 
          p.POL_ID,
          p.POL_NO,
          p.POL_UID,
          p.PROP_NO,
          TO_CHAR(p.POL_DATE, 'YYYY-MM-DD') AS POL_DATE,
          TO_CHAR(p.POL_ISSUE_DATE, 'YYYY-MM-DD') AS POL_ISSUE_DATE,
          TO_CHAR(p.POL_INCEPTION_DATE, 'YYYY-MM-DD') AS POL_INCEPTION_DATE,
          TO_CHAR(p.POL_MATURITY_DATE, 'YYYY-MM-DD') AS POL_MATURITY_DATE,
          p.POL_PROD_CODE,
          pr.PROD_NAME,
          p.POL_PLAN_TYPE,
          p.POL_TERM,
          p.POL_PREM_PAY_TERM,
          p.POL_SUM_ASSURED,
          p.POL_PAY_FREQ,
          p.POL_MOP,
          p.POL_STATUS,
          p.POL_APPROVAL_LEVEL,
          p.POL_APPROVED_BY,
          TO_CHAR(p.POL_APPROVED_ON, 'YYYY-MM-DD HH24:MI:SS') AS POL_APPROVED_ON,
          p.POL_APPROVAL_REMARKS,
          p.IS_ACTIVE,
          p.CREATED_BY,
          TO_CHAR(p.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
          p.MODIFIED_BY,
          TO_CHAR(p.MODIFIED_ON, 'YYYY-MM-DD HH24:MI:SS') AS MODIFIED_ON
        FROM T_POLICY_INFO p
        LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = p.POL_PROD_CODE
        WHERE p.POL_NO = :identifier OR p.POL_UID = :identifier
      `;

      const infoRes = await connection.execute<PolicyInfoRecord>(
        infoSql,
        { identifier },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (!infoRes.rows || infoRes.rows.length === 0) {
        return null;
      }

      const info = infoRes.rows[0];
      const exactPolNo = info.POL_NO;
      const propNo = info.PROP_NO;

      // 2. Assured Details
      const assuredSql = `
        SELECT 
          a.PAS_ID,
          a.POL_NO,
          a.POL_UID,
          a.PAS_NAME,
          TO_CHAR(a.PAS_DOB, 'YYYY-MM-DD') AS PAS_DOB,
          a.PAS_AGE,
          a.PAS_GENDER,
          a.PAS_OCCUPATION,
          a.PAS_ANN_INCOME,
          a.PAS_ID_TYPE,
          a.PAS_ID_NO,
          a.PAS_MOBILE,
          a.PAS_EMAIL,
          a.PAS_ADDRESS,
          a.PAS_SMOKER_YN,
          a.PAS_HIV_YN,
          a.PAS_HEIGHT_CM,
          a.PAS_WEIGHT_KG,
          a.PAS_BMI,
          a.PAS_MEDICAL_HISTORY,
          a.IS_ACTIVE,
          a.CREATED_BY,
          TO_CHAR(a.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
        FROM T_POLICY_ASSURED a
        WHERE a.POL_NO = :exactPolNo
      `;
      const assuredRes = await connection.execute<PolicyAssuredRecord>(
        assuredSql,
        { exactPolNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      // 3. Riders
      const riderSql = `
        SELECT 
          r.PRD_ID,
          r.POL_NO,
          r.POL_UID,
          r.PRD_RIDER_CODE,
          r.PRD_RIDER_NAME,
          r.PRD_SUM_ASSURED,
          r.PRD_RATE,
          r.PRD_PREMIUM,
          r.IS_ACTIVE
        FROM T_POLICY_RIDER r
        WHERE r.POL_NO = :exactPolNo
        ORDER BY r.PRD_ID ASC
      `;
      const riderRes = await connection.execute<PolicyRiderRecord>(
        riderSql,
        { exactPolNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      // 4. Discounts & Loadings
      const discLoadSql = `
        SELECT 
          d.PDL_ID,
          d.POL_NO,
          d.POL_UID,
          d.PDL_TYPE,
          d.PDL_REASON,
          d.PDL_CALC_TYPE,
          d.PDL_RATE_VALUE,
          d.PDL_AMOUNT,
          d.PDL_REMARKS,
          d.IS_ACTIVE
        FROM T_POLICY_DISC_LOAD d
        WHERE d.POL_NO = :exactPolNo
        ORDER BY d.PDL_ID ASC
      `;
      const discLoadRes = await connection.execute<PolicyDiscLoadRecord>(
        discLoadSql,
        { exactPolNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      // 5. Beneficiaries
      const benSql = `
        SELECT 
          b.PBEN_ID,
          b.POL_NO,
          b.POL_UID,
          b.PBEN_NAME,
          b.PBEN_RELATION,
          TO_CHAR(b.PBEN_DOB, 'YYYY-MM-DD') AS PBEN_DOB,
          b.PBEN_SHARE_PCT,
          b.PBEN_ID_TYPE,
          b.PBEN_ID_NO,
          b.PBEN_CONTACT,
          b.PBEN_GUARDIAN_NAME,
          b.PBEN_GUARDIAN_RELATION,
          b.IS_ACTIVE
        FROM T_POLICY_BENEFICIARY b
        WHERE b.POL_NO = :exactPolNo
        ORDER BY b.PBEN_ID ASC
      `;
      const benRes = await connection.execute<PolicyBeneficiaryRecord>(
        benSql,
        { exactPolNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      // 6. Exclusions
      const exSql = `
        SELECT 
          e.PEX_ID,
          e.POL_NO,
          e.POL_UID,
          e.PEX_CODE,
          e.PEX_DESC,
          e.PEX_REASON,
          e.IS_ACTIVE
        FROM T_POLICY_EXCLUSION e
        WHERE e.POL_NO = :exactPolNo
        ORDER BY e.PEX_ID ASC
      `;
      const exRes = await connection.execute<PolicyExclusionRecord>(
        exSql,
        { exactPolNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      // 7. Premium Summary
      const sumSql = `
        SELECT 
          s.PPS_ID,
          s.POL_NO,
          s.POL_UID,
          s.PPS_MTH_CODE,
          s.PPS_BASE_RATE,
          s.PPS_BASIC_SUM_ASSURED,
          s.PPS_BASIC_PREMIUM,
          s.PPS_TOTAL_RIDER_PREMIUM,
          s.PPS_TOTAL_LOADING,
          s.PPS_TOTAL_DISCOUNT,
          s.PPS_NET_ANNUAL_PREM,
          s.PPS_MODAL_FACTOR,
          s.PPS_INSTALLMENT_PREM,
          s.PPS_TAX_AMOUNT,
          s.PPS_TOTAL_PAYABLE,
          s.IS_ACTIVE
        FROM T_POLICY_PREMIUM_SUMMARY s
        WHERE s.POL_NO = :exactPolNo
      `;
      const sumRes = await connection.execute<PolicyPremiumSummaryRecord>(
        sumSql,
        { exactPolNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      // 8. Workflow Logs
      const logSql = `
        SELECT 
          WFLOG_ID,
          WF_CODE,
          WFL_LEVEL_NO,
          REF_TRANS_NO,
          ACTION_TYPE,
          ACTION_BY,
          TO_CHAR(ACTION_DATE, 'YYYY-MM-DD HH24:MI:SS') AS ACTION_DATE,
          COMMENTS,
          AMOUNT
        FROM TTBL_WORKFLOW_LOG
        WHERE REF_TRANS_NO IN (:exactPolNo, :propNo)
        ORDER BY WFLOG_ID DESC
      `;
      const logRes = await connection.execute<any>(
        logSql,
        { exactPolNo, propNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      return {
        info,
        assured: assuredRes.rows && assuredRes.rows.length > 0 ? assuredRes.rows[0] : ({} as any),
        riders: riderRes.rows || [],
        discLoads: discLoadRes.rows || [],
        beneficiaries: benRes.rows || [],
        exclusions: exRes.rows || [],
        premiumSummary: sumRes.rows && sumRes.rows.length > 0 ? sumRes.rows[0] : ({} as any),
        workflowLogs: logRes.rows || []
      };
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Convert an approved proposal to an official policy contract
   */
  async convertFromProposal(propNo: string, username: string = 'admin'): Promise<PolicyDetail> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const code = propNo.trim();

      // 1. Fetch proposal aggregate
      const proposal = await proposalRepository.findByProposalNo(code);
      if (!proposal) {
        throw new Error(`Proposal '${code}' not found.`);
      }

      // Check if already converted
      const checkExist = `SELECT POL_NO FROM T_POLICY_INFO WHERE PROP_NO = :code`;
      const existRes = await connection.execute<{ POL_NO: string }>(checkExist, { code }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (existRes.rows && existRes.rows.length > 0) {
        const existingPol = await this.findByPolicyNo(existRes.rows[0].POL_NO);
        if (existingPol) return existingPol;
      }

      // 2. Generate Policy Number: POL-YYYYMMDD-XXXX
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const seqRes = await connection.execute<{ SEQ: number }>(
        `SELECT SEQ_POL_ID.NEXTVAL AS SEQ FROM DUAL`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const seqNum = seqRes.rows ? seqRes.rows[0].SEQ : Math.floor(20000 + Math.random() * 9000);
      const polNo = `POL-${today}-${String(seqNum).slice(-4)}`;
      const polUid = crypto.randomUUID();

      const termYears = proposal.info.PROP_TERM;

      // 3. Insert T_POLICY_INFO
      const insertPolSql = `
        INSERT INTO T_POLICY_INFO (
          POL_ID, POL_NO, POL_UID, PROP_NO, POL_DATE, POL_ISSUE_DATE,
          POL_INCEPTION_DATE, POL_MATURITY_DATE, POL_PROD_CODE, POL_PLAN_TYPE,
          POL_TERM, POL_PREM_PAY_TERM, POL_SUM_ASSURED, POL_PAY_FREQ, POL_MOP,
          POL_STATUS, POL_APPROVAL_LEVEL, IS_ACTIVE, CREATED_BY, CREATED_ON
        )
        VALUES (
          SEQ_POL_ID.NEXTVAL, :polNo, :polUid, :propNo, SYSDATE, SYSDATE,
          SYSDATE, ADD_MONTHS(SYSDATE, :termMonths), :prodCode, :planType,
          :term, :premPayTerm, :sumAssured, :payFreq, :mop,
          'PENDING_APPROVAL', 1, 'Y', :createdBy, SYSDATE
        )
      `;
      await connection.execute(insertPolSql, {
        polNo,
        polUid,
        propNo: code,
        termMonths: termYears * 12,
        prodCode: proposal.info.PROP_PROD_CODE,
        planType: proposal.info.PROP_PLAN_TYPE,
        term: termYears,
        premPayTerm: proposal.info.PROP_PREM_PAY_TERM,
        sumAssured: proposal.info.PROP_SUM_ASSURED,
        payFreq: proposal.info.PROP_PAY_FREQ,
        mop: proposal.info.PROP_MOP || 'Y',
        createdBy: username.substring(0, 26)
      });

      // 4. Insert T_POLICY_ASSURED
      const ass = proposal.assured;
      const insertAssuredSql = `
        INSERT INTO T_POLICY_ASSURED (
          PAS_ID, POL_NO, POL_UID, PAS_NAME, PAS_DOB, PAS_AGE,
          PAS_GENDER, PAS_OCCUPATION, PAS_ANN_INCOME, PAS_ID_TYPE, PAS_ID_NO,
          PAS_MOBILE, PAS_EMAIL, PAS_ADDRESS, PAS_SMOKER_YN, PAS_HIV_YN,
          PAS_HEIGHT_CM, PAS_WEIGHT_KG, PAS_BMI, PAS_MEDICAL_HISTORY,
          IS_ACTIVE, CREATED_BY, CREATED_ON
        )
        VALUES (
          SEQ_POL_PAS_ID.NEXTVAL, :polNo, :polUid, :pasName, TO_DATE(:dob, 'YYYY-MM-DD'), :age,
          :gender, :occupation, :income, :idType, :idNo,
          :mobile, :email, :address, :smokerYn, :hivYn,
          :heightCm, :weightKg, :bmi, :medHistory,
          'Y', :createdBy, SYSDATE
        )
      `;
      await connection.execute(insertAssuredSql, {
        polNo,
        polUid,
        pasName: ass.PAS_NAME,
        dob: ass.PAS_DOB ? String(ass.PAS_DOB).split('T')[0] : '1995-01-01',
        age: ass.PAS_AGE,
        gender: ass.PAS_GENDER,
        occupation: ass.PAS_OCCUPATION || null,
        income: ass.PAS_ANN_INCOME || 0,
        idType: ass.PAS_ID_TYPE || 'NATIONAL_ID',
        idNo: ass.PAS_ID_NO || null,
        mobile: ass.PAS_MOBILE || null,
        email: ass.PAS_EMAIL || null,
        address: ass.PAS_ADDRESS || null,
        smokerYn: ass.PAS_SMOKER_YN || 'N',
        hivYn: ass.PAS_HIV_YN || 'N',
        heightCm: ass.PAS_HEIGHT_CM || null,
        weightKg: ass.PAS_WEIGHT_KG || null,
        bmi: ass.PAS_BMI || null,
        medHistory: ass.PAS_MEDICAL_HISTORY || null,
        createdBy: username.substring(0, 26)
      });

      // 5. Insert T_POLICY_RIDER
      if (proposal.riders && proposal.riders.length > 0) {
        const insertRiderSql = `
          INSERT INTO T_POLICY_RIDER (
            PRD_ID, POL_NO, POL_UID, PRD_RIDER_CODE, PRD_RIDER_NAME,
            PRD_SUM_ASSURED, PRD_RATE, PRD_PREMIUM, IS_ACTIVE, CREATED_BY, CREATED_ON
          )
          VALUES (
            SEQ_POL_PRD_ID.NEXTVAL, :polNo, :polUid, :rCode, :rName,
            :sumAssured, :rRate, :prem, 'Y', :createdBy, SYSDATE
          )
        `;
        for (const r of proposal.riders) {
          await connection.execute(insertRiderSql, {
            polNo,
            polUid,
            rCode: r.PRD_RIDER_CODE,
            rName: r.PRD_RIDER_NAME,
            sumAssured: r.PRD_SUM_ASSURED,
            rRate: r.PRD_RATE || 0.45,
            prem: r.PRD_PREMIUM,
            createdBy: username.substring(0, 26)
          });
        }
      }

      // 6. Insert T_POLICY_DISC_LOAD
      if (proposal.discLoads && proposal.discLoads.length > 0) {
        const insertDiscLoadSql = `
          INSERT INTO T_POLICY_DISC_LOAD (
            PDL_ID, POL_NO, POL_UID, PDL_TYPE, PDL_REASON,
            PDL_CALC_TYPE, PDL_RATE_VALUE, PDL_AMOUNT, PDL_REMARKS,
            IS_ACTIVE, CREATED_BY, CREATED_ON
          )
          VALUES (
            SEQ_POL_PDL_ID.NEXTVAL, :polNo, :polUid, :pdlType, :pdlReason,
            :pdlCalc, :pdlRate, :pdlAmt, :remarks,
            'Y', :createdBy, SYSDATE
          )
        `;
        for (const d of proposal.discLoads) {
          await connection.execute(insertDiscLoadSql, {
            polNo,
            polUid,
            pdlType: d.PDL_TYPE,
            pdlReason: d.PDL_REASON,
            pdlCalc: d.PDL_CALC_TYPE || 'PERCENTAGE',
            pdlRate: d.PDL_RATE_VALUE || 0,
            pdlAmt: d.PDL_AMOUNT,
            remarks: d.PDL_REMARKS || null,
            createdBy: username.substring(0, 26)
          });
        }
      }

      // 7. Insert T_POLICY_BENEFICIARY
      if (proposal.beneficiaries && proposal.beneficiaries.length > 0) {
        const insertBenSql = `
          INSERT INTO T_POLICY_BENEFICIARY (
            PBEN_ID, POL_NO, POL_UID, PBEN_NAME, PBEN_RELATION,
            PBEN_DOB, PBEN_SHARE_PCT, PBEN_ID_TYPE, PBEN_ID_NO, PBEN_CONTACT,
            PBEN_GUARDIAN_NAME, PBEN_GUARDIAN_RELATION, IS_ACTIVE, CREATED_BY, CREATED_ON
          )
          VALUES (
            SEQ_POL_PBEN_ID.NEXTVAL, :polNo, :polUid, :bName, :bRel,
            TO_DATE(:bDob, 'YYYY-MM-DD'), :sharePct, :idType, :idNo, :contact,
            :gName, :gRel, 'Y', :createdBy, SYSDATE
          )
        `;
        for (const b of proposal.beneficiaries) {
          await connection.execute(insertBenSql, {
            polNo,
            polUid,
            bName: b.PBEN_NAME,
            bRel: b.PBEN_RELATION,
            bDob: b.PBEN_DOB ? String(b.PBEN_DOB).split('T')[0] : null,
            sharePct: b.PBEN_SHARE_PCT || 100,
            idType: b.PBEN_ID_TYPE || null,
            idNo: b.PBEN_ID_NO || null,
            contact: b.PBEN_CONTACT || null,
            gName: b.PBEN_GUARDIAN_NAME || null,
            gRel: b.PBEN_GUARDIAN_RELATION || null,
            createdBy: username.substring(0, 26)
          });
        }
      }

      // 8. Insert T_POLICY_EXCLUSION
      if (proposal.exclusions && proposal.exclusions.length > 0) {
        const insertExSql = `
          INSERT INTO T_POLICY_EXCLUSION (
            PEX_ID, POL_NO, POL_UID, PEX_CODE, PEX_DESC, PEX_REASON,
            IS_ACTIVE, CREATED_BY, CREATED_ON
          )
          VALUES (
            SEQ_POL_PEX_ID.NEXTVAL, :polNo, :polUid, :exCode, :exDesc, :exReason,
            'Y', :createdBy, SYSDATE
          )
        `;
        for (const ex of proposal.exclusions) {
          await connection.execute(insertExSql, {
            polNo,
            polUid,
            exCode: ex.PEX_CODE,
            exDesc: ex.PEX_DESC,
            exReason: ex.PEX_REASON || null,
            createdBy: username.substring(0, 26)
          });
        }
      }

      // 9. Insert T_POLICY_PREMIUM_SUMMARY
      const s = proposal.premiumSummary;
      const insertSumSql = `
        INSERT INTO T_POLICY_PREMIUM_SUMMARY (
          PPS_ID, POL_NO, POL_UID, PPS_MTH_CODE, PPS_BASE_RATE,
          PPS_BASIC_SUM_ASSURED, PPS_BASIC_PREMIUM, PPS_TOTAL_RIDER_PREMIUM,
          PPS_TOTAL_LOADING, PPS_TOTAL_DISCOUNT, PPS_NET_ANNUAL_PREM,
          PPS_MODAL_FACTOR, PPS_INSTALLMENT_PREM, PPS_TAX_AMOUNT, PPS_TOTAL_PAYABLE,
          IS_ACTIVE, CREATED_BY, CREATED_ON
        )
        VALUES (
          SEQ_POL_PPS_ID.NEXTVAL, :polNo, :polUid, :mthCode, :baseRate,
          :sa, :basicPrem, :riderPrem,
          :totLoading, :totDisc, :netAnnual,
          :modalFactor, :instPrem, :tax, :totPayable,
          'Y', :createdBy, SYSDATE
        )
      `;
      await connection.execute(insertSumSql, {
        polNo,
        polUid,
        mthCode: s?.PPS_MTH_CODE || 'MORT_TERM_01',
        baseRate: s?.PPS_BASE_RATE || 2.50,
        sa: proposal.info.PROP_SUM_ASSURED,
        basicPrem: s?.PPS_BASIC_PREMIUM || 0,
        riderPrem: s?.PPS_TOTAL_RIDER_PREMIUM || 0,
        totLoading: s?.PPS_TOTAL_LOADING || 0,
        totDisc: s?.PPS_TOTAL_DISCOUNT || 0,
        netAnnual: s?.PPS_NET_ANNUAL_PREM || 0,
        modalFactor: s?.PPS_MODAL_FACTOR || 1.0,
        instPrem: s?.PPS_INSTALLMENT_PREM || 0,
        tax: s?.PPS_TAX_AMOUNT || 0,
        totPayable: s?.PPS_TOTAL_PAYABLE || 0,
        createdBy: username.substring(0, 26)
      });

      // 10. Update Proposal to 'CONVERTED'
      const updatePropSql = `
        UPDATE T_PROPOSAL_INFO
        SET 
          PROP_STATUS = 'CONVERTED',
          PROP_UW_REMARKS = :remarks,
          MODIFIED_BY = :modifiedBy,
          MODIFIED_ON = SYSDATE
        WHERE PROP_NO = :propNo
      `;
      await connection.execute(updatePropSql, {
        propNo: code,
        remarks: `Converted to Policy Contract: ${polNo}`,
        modifiedBy: username.substring(0, 26)
      });

      // 11. Workflow log
      const logSql = `
        INSERT INTO TTBL_WORKFLOW_LOG (
          WFLOG_ID, WF_CODE, WFL_LEVEL_NO, REF_TRANS_NO,
          ACTION_TYPE, ACTION_BY, ACTION_DATE, COMMENTS, AMOUNT
        )
        VALUES (
          SEQ_WFLOG_ID.NEXTVAL, 'WF_POLICY_CONV', 1, :polNo,
          'CONVERTED', :actionBy, SYSDATE, :comments, :amt
        )
      `;
      await connection.execute(logSql, {
        polNo,
        actionBy: username.substring(0, 26),
        comments: `Proposal ${code} converted to incepted policy contract ${polNo}`,
        amt: s?.PPS_TOTAL_PAYABLE || 0
      });

      await connection.commit();

      const createdPolicy = await this.findByPolicyNo(polNo);
      if (!createdPolicy) {
        throw new Error('Failed to retrieve newly converted policy.');
      }
      return createdPolicy;
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
   * Approve an incepted policy by Policy Administration manager
   */
  async approvePolicy(
    polNo: string,
    input: PolicyApprovalInput,
    username: string = 'admin',
    userRole: string = 'POLICY_ADMIN'
  ): Promise<PolicyDetail> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const code = polNo.trim();

      const current = await this.findByPolicyNo(code);
      if (!current) {
        throw new Error(`Policy '${code}' not found.`);
      }

      let newStatus = current.info.POL_STATUS;
      if (input.decision === 'APPROVE') {
        newStatus = 'IN_FORCE';
      } else if (input.decision === 'REWORK') {
        newStatus = 'PENDING_APPROVAL';
      } else if (input.decision === 'REJECT') {
        newStatus = 'LAPSED';
      }

      const updateSql = `
        UPDATE T_POLICY_INFO
        SET 
          POL_STATUS = :status,
          POL_APPROVED_BY = :approvedBy,
          POL_APPROVED_ON = SYSDATE,
          POL_APPROVAL_REMARKS = :remarks,
          MODIFIED_BY = :modifiedBy,
          MODIFIED_ON = SYSDATE
        WHERE POL_NO = :polNo
      `;
      await connection.execute(updateSql, {
        polNo: code,
        status: newStatus,
        approvedBy: username.substring(0, 26),
        remarks: input.remarks || `Policy authorized and placed in force by ${username} (${userRole})`,
        modifiedBy: username.substring(0, 26)
      });

      // Log in TTBL_WORKFLOW_LOG
      const logSql = `
        INSERT INTO TTBL_WORKFLOW_LOG (
          WFLOG_ID, WF_CODE, WFL_LEVEL_NO, REF_TRANS_NO,
          ACTION_TYPE, ACTION_BY, ACTION_DATE, COMMENTS, AMOUNT
        )
        VALUES (
          SEQ_WFLOG_ID.NEXTVAL, 'WF_POLICY_APPR', 2, :polNo,
          :actionType, :actionBy, SYSDATE, :comments, :amt
        )
      `;
      await connection.execute(logSql, {
        polNo: code,
        actionType: input.decision,
        actionBy: username.substring(0, 26),
        comments: input.remarks || `Policy ${input.decision} decision by ${username} (${userRole})`,
        amt: current.premiumSummary?.PPS_TOTAL_PAYABLE || 0
      });

      await connection.commit();

      const updated = await this.findByPolicyNo(code);
      if (!updated) {
        throw new Error('Failed to retrieve approved policy.');
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
  }
};
