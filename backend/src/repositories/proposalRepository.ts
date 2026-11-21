import oracledb from 'oracledb';
import crypto from 'crypto';
import { getConnection, releaseConnection } from '../config/database';
import {
  ProposalInfoRecord,
  ProposalAssuredRecord,
  ProposalRiderRecord,
  ProposalDiscLoadRecord,
  ProposalBeneficiaryRecord,
  ProposalExclusionRecord,
  ProposalPremiumSummaryRecord,
  ProposalDetail,
  CreateProposalInput,
  TariffRateCalculationInput,
  TariffRateCalculationResponse,
  WorkflowActionLogRecord
} from '../types/proposal';

export const proposalRepository = {
  /**
   * List all proposals with search and status filters
   */
  async findAll(status?: string, search?: string): Promise<ProposalInfoRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      let sql = `
        SELECT 
          p.PROP_ID,
          p.PROP_NO,
          p.PROP_UID,
          TO_CHAR(p.PROP_DATE, 'YYYY-MM-DD') AS PROP_DATE,
          p.PROP_PROD_CODE,
          pr.PROD_NAME,
          p.PROP_PLAN_TYPE,
          p.PROP_TERM,
          p.PROP_PREM_PAY_TERM,
          p.PROP_SUM_ASSURED,
          p.PROP_PAY_FREQ,
          p.PROP_MOP,
          p.PROP_STATUS,
          p.PROP_CURRENT_LEVEL,
          p.PROP_ASSIGNED_ROLE,
          p.PROP_UW_DECISION,
          p.PROP_UW_REMARKS,
          p.IS_ACTIVE,
          p.CREATED_BY,
          TO_CHAR(p.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
          p.MODIFIED_BY,
          TO_CHAR(p.MODIFIED_ON, 'YYYY-MM-DD HH24:MI:SS') AS MODIFIED_ON,
          a.PAS_NAME,
          a.PAS_AGE,
          a.PAS_GENDER,
          s.PPS_TOTAL_PAYABLE AS TOTAL_PAYABLE
        FROM T_PROPOSAL_INFO p
        LEFT JOIN T_PROPOSAL_ASSURED a ON a.PROP_NO = p.PROP_NO
        LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = p.PROP_PROD_CODE
        LEFT JOIN T_PROPOSAL_PREMIUM_SUMMARY s ON s.PROP_NO = p.PROP_NO
        WHERE 1=1
      `;

      const binds: Record<string, any> = {};

      if (status && status.trim() !== '' && status.trim().toUpperCase() !== 'ALL') {
        sql += ` AND p.PROP_STATUS = :status`;
        binds.status = status.trim().toUpperCase();
      }

      if (search && search.trim() !== '') {
        sql += ` AND (UPPER(p.PROP_NO) LIKE :search OR UPPER(p.PROP_UID) LIKE :search OR UPPER(a.PAS_NAME) LIKE :search OR UPPER(pr.PROD_NAME) LIKE :search)`;
        binds.search = `%${search.trim().toUpperCase()}%`;
      }

      sql += ` ORDER BY p.PROP_ID DESC`;

      const result = await connection.execute<ProposalInfoRecord>(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      });

      return result.rows || [];
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Fetch complete aggregate proposal details by Proposal No or UID
   */
  async findByProposalNo(propNoOrUid: string): Promise<ProposalDetail | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const identifier = propNoOrUid.trim();

      // 1. Header Info
      const infoSql = `
        SELECT 
          p.PROP_ID,
          p.PROP_NO,
          p.PROP_UID,
          TO_CHAR(p.PROP_DATE, 'YYYY-MM-DD') AS PROP_DATE,
          p.PROP_PROD_CODE,
          pr.PROD_NAME,
          p.PROP_PLAN_TYPE,
          p.PROP_TERM,
          p.PROP_PREM_PAY_TERM,
          p.PROP_SUM_ASSURED,
          p.PROP_PAY_FREQ,
          p.PROP_MOP,
          p.PROP_STATUS,
          p.PROP_CURRENT_LEVEL,
          p.PROP_ASSIGNED_ROLE,
          p.PROP_UW_DECISION,
          p.PROP_UW_REMARKS,
          p.IS_ACTIVE,
          p.CREATED_BY,
          TO_CHAR(p.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
          p.MODIFIED_BY,
          TO_CHAR(p.MODIFIED_ON, 'YYYY-MM-DD HH24:MI:SS') AS MODIFIED_ON
        FROM T_PROPOSAL_INFO p
        LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = p.PROP_PROD_CODE
        WHERE p.PROP_NO = :identifier OR p.PROP_UID = :identifier
      `;

      const infoRes = await connection.execute<ProposalInfoRecord>(
        infoSql,
        { identifier },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (!infoRes.rows || infoRes.rows.length === 0) {
        return null;
      }

      const info = infoRes.rows[0];
      const exactPropNo = info.PROP_NO;

      // 2. Assured Details
      const assuredSql = `
        SELECT 
          a.PAS_ID,
          a.PROP_NO,
          a.PROP_UID,
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
          TO_CHAR(a.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
          a.MODIFIED_BY,
          TO_CHAR(a.MODIFIED_ON, 'YYYY-MM-DD HH24:MI:SS') AS MODIFIED_ON
        FROM T_PROPOSAL_ASSURED a
        WHERE a.PROP_NO = :exactPropNo
      `;
      const assuredRes = await connection.execute<ProposalAssuredRecord>(
        assuredSql,
        { exactPropNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      // 3. Riders
      const riderSql = `
        SELECT 
          r.PRD_ID,
          r.PROP_NO,
          r.PROP_UID,
          r.PRD_RIDER_CODE,
          r.PRD_RIDER_NAME,
          r.PRD_SUM_ASSURED,
          r.PRD_RATE,
          r.PRD_PREMIUM,
          r.IS_ACTIVE,
          r.CREATED_BY,
          TO_CHAR(r.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
        FROM T_PROPOSAL_RIDER r
        WHERE r.PROP_NO = :exactPropNo
        ORDER BY r.PRD_ID ASC
      `;
      const riderRes = await connection.execute<ProposalRiderRecord>(
        riderSql,
        { exactPropNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      // 4. Discounts & Loadings
      const discLoadSql = `
        SELECT 
          d.PDL_ID,
          d.PROP_NO,
          d.PROP_UID,
          d.PDL_TYPE,
          d.PDL_REASON,
          d.PDL_CALC_TYPE,
          d.PDL_RATE_VALUE,
          d.PDL_AMOUNT,
          d.PDL_REMARKS,
          d.IS_ACTIVE,
          d.CREATED_BY,
          TO_CHAR(d.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
        FROM T_PROPOSAL_DISC_LOAD d
        WHERE d.PROP_NO = :exactPropNo
        ORDER BY d.PDL_ID ASC
      `;
      const discLoadRes = await connection.execute<ProposalDiscLoadRecord>(
        discLoadSql,
        { exactPropNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      // 5. Beneficiaries
      const benSql = `
        SELECT 
          b.PBEN_ID,
          b.PROP_NO,
          b.PROP_UID,
          b.PBEN_NAME,
          b.PBEN_RELATION,
          TO_CHAR(b.PBEN_DOB, 'YYYY-MM-DD') AS PBEN_DOB,
          b.PBEN_SHARE_PCT,
          b.PBEN_ID_TYPE,
          b.PBEN_ID_NO,
          b.PBEN_CONTACT,
          b.PBEN_GUARDIAN_NAME,
          b.PBEN_GUARDIAN_RELATION,
          b.IS_ACTIVE,
          b.CREATED_BY,
          TO_CHAR(b.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
        FROM T_PROPOSAL_BENEFICIARY b
        WHERE b.PROP_NO = :exactPropNo
        ORDER BY b.PBEN_ID ASC
      `;
      const benRes = await connection.execute<ProposalBeneficiaryRecord>(
        benSql,
        { exactPropNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      // 6. Exclusions
      const exSql = `
        SELECT 
          e.PEX_ID,
          e.PROP_NO,
          e.PROP_UID,
          e.PEX_CODE,
          e.PEX_DESC,
          e.PEX_REASON,
          e.IS_ACTIVE,
          e.CREATED_BY,
          TO_CHAR(e.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
        FROM T_PROPOSAL_EXCLUSION e
        WHERE e.PROP_NO = :exactPropNo
        ORDER BY e.PEX_ID ASC
      `;
      const exRes = await connection.execute<ProposalExclusionRecord>(
        exSql,
        { exactPropNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      // 7. Premium Summary
      const sumSql = `
        SELECT 
          s.PPS_ID,
          s.PROP_NO,
          s.PROP_UID,
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
          s.IS_ACTIVE,
          s.CREATED_BY,
          TO_CHAR(s.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
        FROM T_PROPOSAL_PREMIUM_SUMMARY s
        WHERE s.PROP_NO = :exactPropNo
      `;
      const sumRes = await connection.execute<ProposalPremiumSummaryRecord>(
        sumSql,
        { exactPropNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      // 8. Workflow Action Logs
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
        WHERE REF_TRANS_NO = :exactPropNo
        ORDER BY WFLOG_ID DESC
      `;
      const logRes = await connection.execute<WorkflowActionLogRecord>(
        logSql,
        { exactPropNo },
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
   * Calculate premium using Oracle Database package PKG_PROPOSAL_TARIFF -> PKG_TARIFF
   */
  async calculateTariff(params: TariffRateCalculationInput): Promise<TariffRateCalculationResponse> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const mthCode = params.mthCode || 'MORT_TERM_01';
      const age = params.age;
      const term = params.term;
      const gender = params.gender;
      const sumAssured = params.sumAssured;
      const payFreq = params.payFreq || 'ANNUAL';

      // Call PL/SQL Package PKG_PROPOSAL_TARIFF
      const plsql = `
        BEGIN
          PKG_PROPOSAL_TARIFF.GET_PROPOSAL_RATE(
            P_MTH_CODE => :mthCode,
            P_MTH_TYPE => 'BASE',
            P_AGE => :age,
            P_TERM => :term,
            P_GENDER => :gender,
            P_EFF_DT => SYSDATE,
            P_RATE => :rate,
            P_RATE_PER => :ratePer
          );
        END;
      `;

      const binds = {
        mthCode,
        age,
        term,
        gender,
        rate: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        ratePer: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      };

      const result = await connection.execute<{ rate: number; ratePer: number }>(plsql, binds);

      const tariffRate = result.outBinds?.rate || 2.50;
      const ratePer = result.outBinds?.ratePer || 1000;

      // Basic life premium
      const basicPremium = Math.round(((sumAssured / ratePer) * tariffRate) * 100) / 100;

      // Rider premiums (indicative rates based on standard rider schedules)
      const riderRates: Record<string, number> = {
        ADB: 0.50,
        CI: 1.20,
        WP: 0.15,
        TPD: 0.35,
        HOSP: 0.80
      };

      const calculatedRiders = (params.riders || []).map(r => {
        const rate = riderRates[r.riderCode.toUpperCase()] || 0.45;
        const premium = Math.round(((r.sumAssured / 1000) * rate) * 100) / 100;
        return {
          riderCode: r.riderCode,
          rate,
          premium
        };
      });

      const totalRiderPremium = calculatedRiders.reduce((acc, curr) => acc + curr.premium, 0);

      // Discounts & Loadings calculation
      let totalLoading = 0;
      let totalDiscount = 0;

      (params.discLoads || []).forEach(dl => {
        let amount = 0;
        if (dl.calcType === 'PERCENTAGE') {
          amount = Math.round((basicPremium * (dl.rateValue / 100)) * 100) / 100;
        } else if (dl.calcType === 'PER_MILLE') {
          amount = Math.round(((sumAssured / 1000) * dl.rateValue) * 100) / 100;
        } else {
          amount = dl.rateValue;
        }

        if (dl.type === 'LOADING') {
          totalLoading += amount;
        } else {
          totalDiscount += amount;
        }
      });

      // Net annual premium
      const netAnnualPremium = Math.max(0, Math.round((basicPremium + totalRiderPremium + totalLoading - totalDiscount) * 100) / 100);

      // Modal factors
      const modalFactors: Record<string, number> = {
        ANNUAL: 1.0,
        SEMI_ANNUAL: 0.52,
        QUARTERLY: 0.265,
        MONTHLY: 0.088,
        SINGLE: 1.0
      };
      const modalFactor = modalFactors[payFreq] || 1.0;
      const installmentPremium = Math.round((netAnnualPremium * modalFactor) * 100) / 100;

      // Standard tax / stamp duty (e.g., 0% for life insurance core)
      const taxAmount = 0;
      const totalPayable = installmentPremium + taxAmount;

      return {
        mthCode,
        tariffRate,
        ratePer,
        basicPremium,
        riders: calculatedRiders,
        totalRiderPremium,
        totalLoading,
        totalDiscount,
        netAnnualPremium,
        modalFactor,
        installmentPremium,
        taxAmount,
        totalPayable
      };
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Create a new proposal with all related child tables & audit log
   */
  async create(data: CreateProposalInput, username: string = 'ADMIN'): Promise<ProposalDetail> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      // 1. Generate Proposal Number: PRP-YYYYMMDD-SEQ
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const seqRes = await connection.execute<{ SEQ: number }>(
        `SELECT SEQ_PROP_ID.NEXTVAL AS SEQ FROM DUAL`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const seqNum = seqRes.rows ? seqRes.rows[0].SEQ : Math.floor(1000 + Math.random() * 9000);
      const propNo = `PRP-${today}-${String(seqNum).slice(-4)}`;
      const propUid = crypto.randomUUID();

      // Calculate tariff rate and premium summary automatically if not passed
      const calcResult = await this.calculateTariff({
        age: data.assured.PAS_AGE,
        term: data.info.PROP_TERM,
        gender: data.assured.PAS_GENDER,
        sumAssured: data.info.PROP_SUM_ASSURED,
        payFreq: data.info.PROP_PAY_FREQ || 'ANNUAL',
        riders: data.riders?.map(r => ({ riderCode: r.PRD_RIDER_CODE, sumAssured: r.PRD_SUM_ASSURED })),
        discLoads: data.discLoads?.map(d => ({
          type: d.PDL_TYPE,
          calcType: d.PDL_CALC_TYPE || 'PERCENTAGE',
          rateValue: d.PDL_RATE_VALUE || 0,
          reason: d.PDL_REASON
        }))
      });

      // 2. Insert Header (T_PROPOSAL_INFO)
      const infoSql = `
        INSERT INTO T_PROPOSAL_INFO (
          PROP_ID, PROP_NO, PROP_UID, PROP_DATE,
          PROP_PROD_CODE, PROP_PLAN_TYPE, PROP_TERM, PROP_PREM_PAY_TERM,
          PROP_SUM_ASSURED, PROP_PAY_FREQ, PROP_MOP, PROP_STATUS, PROP_CURRENT_LEVEL,
          PROP_ASSIGNED_ROLE, IS_ACTIVE, CREATED_BY, CREATED_ON
        )
        VALUES (
          SEQ_PROP_ID.NEXTVAL, :propNo, :propUid, SYSDATE,
          :prodCode, :planType, :term, :premPayTerm,
          :sumAssured, :payFreq, :mop, 'DRAFT', 1,
          'MAKER', 'Y', :createdBy, SYSDATE
        )
      `;
      await connection.execute(infoSql, {
        propNo,
        propUid,
        prodCode: data.info.PROP_PROD_CODE,
        planType: data.info.PROP_PLAN_TYPE || 'TERM',
        term: data.info.PROP_TERM,
        premPayTerm: data.info.PROP_PREM_PAY_TERM || data.info.PROP_TERM,
        sumAssured: data.info.PROP_SUM_ASSURED,
        payFreq: data.info.PROP_PAY_FREQ || 'ANNUAL',
        mop: data.info.PROP_MOP || 'Y',
        createdBy: username.substring(0, 26)
      });

      // 3. Insert Assured (T_PROPOSAL_ASSURED)
      const ass = data.assured;
      const height = ass.PAS_HEIGHT_CM ? Number(ass.PAS_HEIGHT_CM) : null;
      const weight = ass.PAS_WEIGHT_KG ? Number(ass.PAS_WEIGHT_KG) : null;
      let bmi: number | null = null;
      if (height && weight && height > 0) {
        const heightM = height / 100;
        bmi = Math.round((weight / (heightM * heightM)) * 10) / 10;
      }

      const assuredSql = `
        INSERT INTO T_PROPOSAL_ASSURED (
          PAS_ID, PROP_NO, PROP_UID, PAS_NAME, PAS_DOB, PAS_AGE,
          PAS_GENDER, PAS_OCCUPATION, PAS_ANN_INCOME, PAS_ID_TYPE, PAS_ID_NO,
          PAS_MOBILE, PAS_EMAIL, PAS_ADDRESS, PAS_SMOKER_YN, PAS_HIV_YN,
          PAS_HEIGHT_CM, PAS_WEIGHT_KG, PAS_BMI, PAS_MEDICAL_HISTORY,
          IS_ACTIVE, CREATED_BY, CREATED_ON
        )
        VALUES (
          SEQ_PAS_ID.NEXTVAL, :propNo, :propUid, :pasName, TO_DATE(:dob, 'YYYY-MM-DD'), :age,
          :gender, :occupation, :income, :idType, :idNo,
          :mobile, :email, :address, :smokerYn, :hivYn,
          :heightCm, :weightKg, :bmi, :medHistory,
          'Y', :createdBy, SYSDATE
        )
      `;
      await connection.execute(assuredSql, {
        propNo,
        propUid,
        pasName: ass.PAS_NAME.trim(),
        dob: ass.PAS_DOB ? ass.PAS_DOB.split('T')[0] : '1995-01-01',
        age: ass.PAS_AGE,
        gender: ass.PAS_GENDER,
        occupation: ass.PAS_OCCUPATION || null,
        income: ass.PAS_ANN_INCOME || 0,
        idType: ass.PAS_ID_TYPE || 'NATIONAL_ID',
        idNo: ass.PAS_ID_NO || null,
        mobile: ass.PAS_MOBILE || null,
        email: ass.PAS_EMAIL || null,
        address: ass.PAS_ADDRESS || null,
        smokerYn: ass.PAS_SMOKER_YN === 'Y' ? 'Y' : 'N',
        hivYn: ass.PAS_HIV_YN === 'Y' ? 'Y' : 'N',
        heightCm: height,
        weightKg: weight,
        bmi,
        medHistory: ass.PAS_MEDICAL_HISTORY || null,
        createdBy: username.substring(0, 26)
      });

      // 4. Insert Riders (T_PROPOSAL_RIDER)
      if (data.riders && data.riders.length > 0) {
        const riderInsertSql = `
          INSERT INTO T_PROPOSAL_RIDER (
            PRD_ID, PROP_NO, PROP_UID, PRD_RIDER_CODE, PRD_RIDER_NAME,
            PRD_SUM_ASSURED, PRD_RATE, PRD_PREMIUM, IS_ACTIVE, CREATED_BY, CREATED_ON
          )
          VALUES (
            SEQ_PRD_ID.NEXTVAL, :propNo, :propUid, :rCode, :rName,
            :sumAssured, :rRate, :prem, 'Y', :createdBy, SYSDATE
          )
        `;
        for (const r of data.riders) {
          await connection.execute(riderInsertSql, {
            propNo,
            propUid,
            rCode: r.PRD_RIDER_CODE,
            rName: r.PRD_RIDER_NAME,
            sumAssured: r.PRD_SUM_ASSURED,
            rRate: r.PRD_RATE || 0.45,
            prem: r.PRD_PREMIUM,
            createdBy: username.substring(0, 26)
          });
        }
      }

      // 5. Insert Discounts and Loadings (T_PROPOSAL_DISC_LOAD)
      if (data.discLoads && data.discLoads.length > 0) {
        const discLoadInsertSql = `
          INSERT INTO T_PROPOSAL_DISC_LOAD (
            PDL_ID, PROP_NO, PROP_UID, PDL_TYPE, PDL_REASON,
            PDL_CALC_TYPE, PDL_RATE_VALUE, PDL_AMOUNT, PDL_REMARKS,
            IS_ACTIVE, CREATED_BY, CREATED_ON
          )
          VALUES (
            SEQ_PDL_ID.NEXTVAL, :propNo, :propUid, :pdlType, :pdlReason,
            :pdlCalc, :pdlRate, :pdlAmt, :remarks,
            'Y', :createdBy, SYSDATE
          )
        `;
        for (const d of data.discLoads) {
          await connection.execute(discLoadInsertSql, {
            propNo,
            propUid,
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

      // 6. Insert Beneficiaries (T_PROPOSAL_BENEFICIARY)
      if (data.beneficiaries && data.beneficiaries.length > 0) {
        const benInsertSql = `
          INSERT INTO T_PROPOSAL_BENEFICIARY (
            PBEN_ID, PROP_NO, PROP_UID, PBEN_NAME, PBEN_RELATION,
            PBEN_DOB, PBEN_SHARE_PCT, PBEN_ID_TYPE, PBEN_ID_NO, PBEN_CONTACT,
            PBEN_GUARDIAN_NAME, PBEN_GUARDIAN_RELATION, IS_ACTIVE, CREATED_BY, CREATED_ON
          )
          VALUES (
            SEQ_PBEN_ID.NEXTVAL, :propNo, :propUid, :bName, :bRel,
            TO_DATE(:bDob, 'YYYY-MM-DD'), :sharePct, :idType, :idNo, :contact,
            :gName, :gRel, 'Y', :createdBy, SYSDATE
          )
        `;
        for (const b of data.beneficiaries) {
          await connection.execute(benInsertSql, {
            propNo,
            propUid,
            bName: b.PBEN_NAME.trim(),
            bRel: b.PBEN_RELATION,
            bDob: b.PBEN_DOB ? b.PBEN_DOB.split('T')[0] : null,
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

      // 7. Insert Exclusions (T_PROPOSAL_EXCLUSION)
      if (data.exclusions && data.exclusions.length > 0) {
        const exInsertSql = `
          INSERT INTO T_PROPOSAL_EXCLUSION (
            PEX_ID, PROP_NO, PROP_UID, PEX_CODE, PEX_DESC, PEX_REASON,
            IS_ACTIVE, CREATED_BY, CREATED_ON
          )
          VALUES (
            SEQ_PEX_ID.NEXTVAL, :propNo, :propUid, :exCode, :exDesc, :exReason,
            'Y', :createdBy, SYSDATE
          )
        `;
        for (const ex of data.exclusions) {
          await connection.execute(exInsertSql, {
            propNo,
            propUid,
            exCode: ex.PEX_CODE,
            exDesc: ex.PEX_DESC,
            exReason: ex.PEX_REASON || null,
            createdBy: username.substring(0, 26)
          });
        }
      }

      // 8. Insert Premium Summary (T_PROPOSAL_PREMIUM_SUMMARY)
      const summary = data.premiumSummary || {
        PPS_MTH_CODE: calcResult.mthCode,
        PPS_BASE_RATE: calcResult.tariffRate,
        PPS_BASIC_SUM_ASSURED: data.info.PROP_SUM_ASSURED,
        PPS_BASIC_PREMIUM: calcResult.basicPremium,
        PPS_TOTAL_RIDER_PREMIUM: calcResult.totalRiderPremium,
        PPS_TOTAL_LOADING: calcResult.totalLoading,
        PPS_TOTAL_DISCOUNT: calcResult.totalDiscount,
        PPS_NET_ANNUAL_PREM: calcResult.netAnnualPremium,
        PPS_MODAL_FACTOR: calcResult.modalFactor,
        PPS_INSTALLMENT_PREM: calcResult.installmentPremium,
        PPS_TAX_AMOUNT: calcResult.taxAmount,
        PPS_TOTAL_PAYABLE: calcResult.totalPayable
      };

      const sumInsertSql = `
        INSERT INTO T_PROPOSAL_PREMIUM_SUMMARY (
          PPS_ID, PROP_NO, PROP_UID, PPS_MTH_CODE, PPS_BASE_RATE,
          PPS_BASIC_SUM_ASSURED, PPS_BASIC_PREMIUM, PPS_TOTAL_RIDER_PREMIUM,
          PPS_TOTAL_LOADING, PPS_TOTAL_DISCOUNT, PPS_NET_ANNUAL_PREM,
          PPS_MODAL_FACTOR, PPS_INSTALLMENT_PREM, PPS_TAX_AMOUNT, PPS_TOTAL_PAYABLE,
          IS_ACTIVE, CREATED_BY, CREATED_ON
        )
        VALUES (
          SEQ_PPS_ID.NEXTVAL, :propNo, :propUid, :mthCode, :baseRate,
          :sa, :basicPrem, :riderPrem,
          :totLoading, :totDisc, :netAnnual,
          :modalFactor, :instPrem, :tax, :totPayable,
          'Y', :createdBy, SYSDATE
        )
      `;
      await connection.execute(sumInsertSql, {
        propNo,
        propUid,
        mthCode: summary.PPS_MTH_CODE || 'MORT_TERM_01',
        baseRate: summary.PPS_BASE_RATE || calcResult.tariffRate,
        sa: summary.PPS_BASIC_SUM_ASSURED,
        basicPrem: summary.PPS_BASIC_PREMIUM,
        riderPrem: summary.PPS_TOTAL_RIDER_PREMIUM,
        totLoading: summary.PPS_TOTAL_LOADING,
        totDisc: summary.PPS_TOTAL_DISCOUNT,
        netAnnual: summary.PPS_NET_ANNUAL_PREM,
        modalFactor: summary.PPS_MODAL_FACTOR,
        instPrem: summary.PPS_INSTALLMENT_PREM,
        tax: summary.PPS_TAX_AMOUNT || 0,
        totPayable: summary.PPS_TOTAL_PAYABLE,
        createdBy: username.substring(0, 26)
      });

      // 9. Workflow Action Log
      const logSql = `
        INSERT INTO TTBL_WORKFLOW_LOG (
          WFLOG_ID, WF_CODE, WFL_LEVEL_NO, REF_TRANS_NO,
          ACTION_TYPE, ACTION_BY, ACTION_DATE, COMMENTS, AMOUNT
        )
        VALUES (
          SEQ_WFLOG_ID.NEXTVAL, 'WF_PROP_CREATE', 1, :propNo,
          'DRAFT_CREATED', :actionBy, SYSDATE, 'Proposal draft created with PKG_TARIFF calculation', :amount
        )
      `;
      await connection.execute(logSql, {
        propNo,
        actionBy: username.substring(0, 26),
        amount: summary.PPS_TOTAL_PAYABLE
      });

      await connection.commit();

      const created = await this.findByProposalNo(propNo);
      if (!created) {
        throw new Error('Failed to retrieve newly created proposal.');
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
   * Update entire proposal
   */
  async update(propNo: string, data: CreateProposalInput, username: string = 'ADMIN'): Promise<ProposalDetail> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const code = propNo.trim();

      const existing = await this.findByProposalNo(code);
      if (!existing) {
        throw new Error(`Proposal '${code}' not found.`);
      }

      const propUid = existing.info.PROP_UID;

      // 1. Recalculate Tariff
      const calcResult = await this.calculateTariff({
        age: data.assured.PAS_AGE,
        term: data.info.PROP_TERM,
        gender: data.assured.PAS_GENDER,
        sumAssured: data.info.PROP_SUM_ASSURED,
        payFreq: data.info.PROP_PAY_FREQ || 'ANNUAL',
        riders: data.riders?.map(r => ({ riderCode: r.PRD_RIDER_CODE, sumAssured: r.PRD_SUM_ASSURED })),
        discLoads: data.discLoads?.map(d => ({
          type: d.PDL_TYPE,
          calcType: d.PDL_CALC_TYPE || 'PERCENTAGE',
          rateValue: d.PDL_RATE_VALUE || 0,
          reason: d.PDL_REASON
        }))
      });

      // 2. Update Header
      const updateInfoSql = `
        UPDATE T_PROPOSAL_INFO
        SET 
          PROP_PROD_CODE = :prodCode,
          PROP_PLAN_TYPE = :planType,
          PROP_TERM = :term,
          PROP_PREM_PAY_TERM = :premPayTerm,
          PROP_SUM_ASSURED = :sumAssured,
          PROP_PAY_FREQ = :payFreq,
          PROP_MOP = :mop,
          MODIFIED_BY = :modifiedBy,
          MODIFIED_ON = SYSDATE
        WHERE PROP_NO = :propNo
      `;
      await connection.execute(updateInfoSql, {
        propNo: code,
        prodCode: data.info.PROP_PROD_CODE,
        planType: data.info.PROP_PLAN_TYPE || 'TERM',
        term: data.info.PROP_TERM,
        premPayTerm: data.info.PROP_PREM_PAY_TERM || data.info.PROP_TERM,
        sumAssured: data.info.PROP_SUM_ASSURED,
        payFreq: data.info.PROP_PAY_FREQ || 'ANNUAL',
        mop: data.info.PROP_MOP || 'Y',
        modifiedBy: username.substring(0, 26)
      });

      // 3. Update Assured
      const ass = data.assured;
      const height = ass.PAS_HEIGHT_CM ? Number(ass.PAS_HEIGHT_CM) : null;
      const weight = ass.PAS_WEIGHT_KG ? Number(ass.PAS_WEIGHT_KG) : null;
      let bmi: number | null = null;
      if (height && weight && height > 0) {
        const heightM = height / 100;
        bmi = Math.round((weight / (heightM * heightM)) * 10) / 10;
      }

      const updateAssuredSql = `
        UPDATE T_PROPOSAL_ASSURED
        SET 
          PAS_NAME = :pasName,
          PAS_DOB = TO_DATE(:dob, 'YYYY-MM-DD'),
          PAS_AGE = :age,
          PAS_GENDER = :gender,
          PAS_OCCUPATION = :occupation,
          PAS_ANN_INCOME = :income,
          PAS_ID_TYPE = :idType,
          PAS_ID_NO = :idNo,
          PAS_MOBILE = :mobile,
          PAS_EMAIL = :email,
          PAS_ADDRESS = :address,
          PAS_SMOKER_YN = :smokerYn,
          PAS_HIV_YN = :hivYn,
          PAS_HEIGHT_CM = :heightCm,
          PAS_WEIGHT_KG = :weightKg,
          PAS_BMI = :bmi,
          PAS_MEDICAL_HISTORY = :medHistory,
          MODIFIED_BY = :modifiedBy,
          MODIFIED_ON = SYSDATE
        WHERE PROP_NO = :propNo
      `;
      await connection.execute(updateAssuredSql, {
        propNo: code,
        pasName: ass.PAS_NAME.trim(),
        dob: ass.PAS_DOB ? ass.PAS_DOB.split('T')[0] : '1995-01-01',
        age: ass.PAS_AGE,
        gender: ass.PAS_GENDER,
        occupation: ass.PAS_OCCUPATION || null,
        income: ass.PAS_ANN_INCOME || 0,
        idType: ass.PAS_ID_TYPE || 'NATIONAL_ID',
        idNo: ass.PAS_ID_NO || null,
        mobile: ass.PAS_MOBILE || null,
        email: ass.PAS_EMAIL || null,
        address: ass.PAS_ADDRESS || null,
        smokerYn: ass.PAS_SMOKER_YN === 'Y' ? 'Y' : 'N',
        hivYn: ass.PAS_HIV_YN === 'Y' ? 'Y' : 'N',
        heightCm: height,
        weightKg: weight,
        bmi,
        medHistory: ass.PAS_MEDICAL_HISTORY || null,
        modifiedBy: username.substring(0, 26)
      });

      // 4. Replace Riders
      await connection.execute(`DELETE FROM T_PROPOSAL_RIDER WHERE PROP_NO = :propNo`, { propNo: code });
      if (data.riders && data.riders.length > 0) {
        const riderInsertSql = `
          INSERT INTO T_PROPOSAL_RIDER (
            PRD_ID, PROP_NO, PROP_UID, PRD_RIDER_CODE, PRD_RIDER_NAME,
            PRD_SUM_ASSURED, PRD_RATE, PRD_PREMIUM, IS_ACTIVE, CREATED_BY, CREATED_ON
          )
          VALUES (
            SEQ_PRD_ID.NEXTVAL, :propNo, :propUid, :rCode, :rName,
            :sumAssured, :rRate, :prem, 'Y', :createdBy, SYSDATE
          )
        `;
        for (const r of data.riders) {
          await connection.execute(riderInsertSql, {
            propNo: code,
            propUid,
            rCode: r.PRD_RIDER_CODE,
            rName: r.PRD_RIDER_NAME,
            sumAssured: r.PRD_SUM_ASSURED,
            rRate: r.PRD_RATE || 0.45,
            prem: r.PRD_PREMIUM,
            createdBy: username.substring(0, 26)
          });
        }
      }

      // 5. Replace Discounts & Loadings
      await connection.execute(`DELETE FROM T_PROPOSAL_DISC_LOAD WHERE PROP_NO = :propNo`, { propNo: code });
      if (data.discLoads && data.discLoads.length > 0) {
        const discLoadInsertSql = `
          INSERT INTO T_PROPOSAL_DISC_LOAD (
            PDL_ID, PROP_NO, PROP_UID, PDL_TYPE, PDL_REASON,
            PDL_CALC_TYPE, PDL_RATE_VALUE, PDL_AMOUNT, PDL_REMARKS,
            IS_ACTIVE, CREATED_BY, CREATED_ON
          )
          VALUES (
            SEQ_PDL_ID.NEXTVAL, :propNo, :propUid, :pdlType, :pdlReason,
            :pdlCalc, :pdlRate, :pdlAmt, :remarks,
            'Y', :createdBy, SYSDATE
          )
        `;
        for (const d of data.discLoads) {
          await connection.execute(discLoadInsertSql, {
            propNo: code,
            propUid,
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

      // 6. Replace Beneficiaries
      await connection.execute(`DELETE FROM T_PROPOSAL_BENEFICIARY WHERE PROP_NO = :propNo`, { propNo: code });
      if (data.beneficiaries && data.beneficiaries.length > 0) {
        const benInsertSql = `
          INSERT INTO T_PROPOSAL_BENEFICIARY (
            PBEN_ID, PROP_NO, PROP_UID, PBEN_NAME, PBEN_RELATION,
            PBEN_DOB, PBEN_SHARE_PCT, PBEN_ID_TYPE, PBEN_ID_NO, PBEN_CONTACT,
            PBEN_GUARDIAN_NAME, PBEN_GUARDIAN_RELATION, IS_ACTIVE, CREATED_BY, CREATED_ON
          )
          VALUES (
            SEQ_PBEN_ID.NEXTVAL, :propNo, :propUid, :bName, :bRel,
            TO_DATE(:bDob, 'YYYY-MM-DD'), :sharePct, :idType, :idNo, :contact,
            :gName, :gRel, 'Y', :createdBy, SYSDATE
          )
        `;
        for (const b of data.beneficiaries) {
          await connection.execute(benInsertSql, {
            propNo: code,
            propUid,
            bName: b.PBEN_NAME.trim(),
            bRel: b.PBEN_RELATION,
            bDob: b.PBEN_DOB ? b.PBEN_DOB.split('T')[0] : null,
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

      // 7. Replace Exclusions
      await connection.execute(`DELETE FROM T_PROPOSAL_EXCLUSION WHERE PROP_NO = :propNo`, { propNo: code });
      if (data.exclusions && data.exclusions.length > 0) {
        const exInsertSql = `
          INSERT INTO T_PROPOSAL_EXCLUSION (
            PEX_ID, PROP_NO, PROP_UID, PEX_CODE, PEX_DESC, PEX_REASON,
            IS_ACTIVE, CREATED_BY, CREATED_ON
          )
          VALUES (
            SEQ_PEX_ID.NEXTVAL, :propNo, :propUid, :exCode, :exDesc, :exReason,
            'Y', :createdBy, SYSDATE
          )
        `;
        for (const ex of data.exclusions) {
          await connection.execute(exInsertSql, {
            propNo: code,
            propUid,
            exCode: ex.PEX_CODE,
            exDesc: ex.PEX_DESC,
            exReason: ex.PEX_REASON || null,
            createdBy: username.substring(0, 26)
          });
        }
      }

      // 8. Update Premium Summary
      const summary = data.premiumSummary || {
        PPS_MTH_CODE: calcResult.mthCode,
        PPS_BASE_RATE: calcResult.tariffRate,
        PPS_BASIC_SUM_ASSURED: data.info.PROP_SUM_ASSURED,
        PPS_BASIC_PREMIUM: calcResult.basicPremium,
        PPS_TOTAL_RIDER_PREMIUM: calcResult.totalRiderPremium,
        PPS_TOTAL_LOADING: calcResult.totalLoading,
        PPS_TOTAL_DISCOUNT: calcResult.totalDiscount,
        PPS_NET_ANNUAL_PREM: calcResult.netAnnualPremium,
        PPS_MODAL_FACTOR: calcResult.modalFactor,
        PPS_INSTALLMENT_PREM: calcResult.installmentPremium,
        PPS_TAX_AMOUNT: calcResult.taxAmount,
        PPS_TOTAL_PAYABLE: calcResult.totalPayable
      };

      const updateSumSql = `
        UPDATE T_PROPOSAL_PREMIUM_SUMMARY
        SET 
          PPS_MTH_CODE = :mthCode,
          PPS_BASE_RATE = :baseRate,
          PPS_BASIC_SUM_ASSURED = :sa,
          PPS_BASIC_PREMIUM = :basicPrem,
          PPS_TOTAL_RIDER_PREMIUM = :riderPrem,
          PPS_TOTAL_LOADING = :totLoading,
          PPS_TOTAL_DISCOUNT = :totDisc,
          PPS_NET_ANNUAL_PREM = :netAnnual,
          PPS_MODAL_FACTOR = :modalFactor,
          PPS_INSTALLMENT_PREM = :instPrem,
          PPS_TAX_AMOUNT = :tax,
          PPS_TOTAL_PAYABLE = :totPayable,
          MODIFIED_BY = :modifiedBy,
          MODIFIED_ON = SYSDATE
        WHERE PROP_NO = :propNo
      `;
      await connection.execute(updateSumSql, {
        propNo: code,
        mthCode: summary.PPS_MTH_CODE || 'MORT_TERM_01',
        baseRate: summary.PPS_BASE_RATE || calcResult.tariffRate,
        sa: summary.PPS_BASIC_SUM_ASSURED,
        basicPrem: summary.PPS_BASIC_PREMIUM,
        riderPrem: summary.PPS_TOTAL_RIDER_PREMIUM,
        totLoading: summary.PPS_TOTAL_LOADING,
        totDisc: summary.PPS_TOTAL_DISCOUNT,
        netAnnual: summary.PPS_NET_ANNUAL_PREM,
        modalFactor: summary.PPS_MODAL_FACTOR,
        instPrem: summary.PPS_INSTALLMENT_PREM,
        tax: summary.PPS_TAX_AMOUNT || 0,
        totPayable: summary.PPS_TOTAL_PAYABLE,
        modifiedBy: username.substring(0, 26)
      });

      // 9. Workflow Log
      await connection.execute(
        `INSERT INTO TTBL_WORKFLOW_LOG (
          WFLOG_ID, WF_CODE, WFL_LEVEL_NO, REF_TRANS_NO,
          ACTION_TYPE, ACTION_BY, ACTION_DATE, COMMENTS, AMOUNT
        ) VALUES (
          SEQ_WFLOG_ID.NEXTVAL, 'WF_PROP_CREATE', :lvlNo, :propNo,
          'PROPOSAL_UPDATED', :actionBy, SYSDATE, 'Proposal details updated and recalculated', :amt
        )`,
        {
          lvlNo: existing.info.PROP_CURRENT_LEVEL,
          propNo: code,
          actionBy: username.substring(0, 26),
          amt: summary.PPS_TOTAL_PAYABLE
        }
      );

      await connection.commit();

      const updated = await this.findByProposalNo(code);
      if (!updated) {
        throw new Error('Failed to retrieve updated proposal.');
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
   * Delete proposal and all children
   */
  async delete(propNo: string): Promise<boolean> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const code = propNo.trim();

      await connection.execute(`DELETE FROM T_PROPOSAL_PREMIUM_SUMMARY WHERE PROP_NO = :code`, { code });
      await connection.execute(`DELETE FROM T_PROPOSAL_EXCLUSION WHERE PROP_NO = :code`, { code });
      await connection.execute(`DELETE FROM T_PROPOSAL_BENEFICIARY WHERE PROP_NO = :code`, { code });
      await connection.execute(`DELETE FROM T_PROPOSAL_DISC_LOAD WHERE PROP_NO = :code`, { code });
      await connection.execute(`DELETE FROM T_PROPOSAL_RIDER WHERE PROP_NO = :code`, { code });
      await connection.execute(`DELETE FROM T_PROPOSAL_ASSURED WHERE PROP_NO = :code`, { code });
      const res = await connection.execute(`DELETE FROM T_PROPOSAL_INFO WHERE PROP_NO = :code`, { code });

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
  },

  /**
   * Process a workflow action (Submit, Underwrite Decision: Approve, Reject, Rework)
   */
  async processWorkflowAction(
    propNo: string,
    action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'REWORK',
    comments: string,
    username: string = 'ADMIN',
    userRole: string = 'MAKER'
  ): Promise<ProposalDetail> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const code = propNo.trim();

      const detail = await this.findByProposalNo(code);
      if (!detail) {
        throw new Error(`Proposal '${code}' not found.`);
      }

      let newStatus = detail.info.PROP_STATUS;
      let newLevel = detail.info.PROP_CURRENT_LEVEL;
      let newRole = detail.info.PROP_ASSIGNED_ROLE;
      let wfCode = 'WF_PROP_CREATE';

      if (action === 'SUBMIT') {
        if (detail.info.PROP_STATUS === 'DRAFT' || detail.info.PROP_STATUS === 'REWORK') {
          newStatus = 'SUBMITTED';
          newLevel = 2;
          newRole = 'CHECKER';
        } else if (detail.info.PROP_STATUS === 'SUBMITTED') {
          // Transition from Proposal Creation workflow to Underwriting Workflow!
          newStatus = 'UNDERWRITING';
          newLevel = 1;
          newRole = 'UW_OFFICER';
          wfCode = 'WF_UNDERWRITING';
        }
      } else if (action === 'APPROVE') {
        if (detail.info.PROP_STATUS === 'SUBMITTED') {
          newStatus = 'UNDERWRITING';
          newLevel = 1;
          newRole = 'UW_OFFICER';
          wfCode = 'WF_UNDERWRITING';
        } else if (detail.info.PROP_STATUS === 'UNDERWRITING') {
          // Check if higher authority level required based on Sum Assured
          const sa = detail.info.PROP_SUM_ASSURED;
          if (sa > 2500000 && newLevel < 3) {
            newLevel = 3;
            newRole = 'UW_COMMITTEE';
          } else if (sa > 500000 && newLevel < 2) {
            newLevel = 2;
            newRole = 'SR_UNDERWRITER';
          } else {
            // Underwriting fully approved!
            newStatus = 'APPROVED';
            newRole = 'CHECKER';
          }
          wfCode = 'WF_UNDERWRITING';
        }
      } else if (action === 'REWORK') {
        newStatus = 'REWORK';
        newLevel = 1;
        newRole = 'MAKER';
      } else if (action === 'REJECT') {
        newStatus = 'REJECTED';
      }

      // Update proposal state
      const updateSql = `
        UPDATE T_PROPOSAL_INFO
        SET 
          PROP_STATUS = :status,
          PROP_CURRENT_LEVEL = :lvlNo,
          PROP_ASSIGNED_ROLE = :roleCode,
          PROP_UW_DECISION = :decision,
          PROP_UW_REMARKS = :remarks,
          MODIFIED_BY = :modifiedBy,
          MODIFIED_ON = SYSDATE
        WHERE PROP_NO = :propNo
      `;
      await connection.execute(updateSql, {
        propNo: code,
        status: newStatus,
        lvlNo: newLevel,
        roleCode: newRole,
        decision: action,
        remarks: comments || null,
        modifiedBy: username.substring(0, 26)
      });

      // Insert workflow action audit log
      const logSql = `
        INSERT INTO TTBL_WORKFLOW_LOG (
          WFLOG_ID, WF_CODE, WFL_LEVEL_NO, REF_TRANS_NO,
          ACTION_TYPE, ACTION_BY, ACTION_DATE, COMMENTS, AMOUNT
        )
        VALUES (
          SEQ_WFLOG_ID.NEXTVAL, :wfCode, :lvlNo, :propNo,
          :actionType, :actionBy, SYSDATE, :comments, :amt
        )
      `;
      await connection.execute(logSql, {
        wfCode,
        lvlNo: newLevel,
        propNo: code,
        actionType: action,
        actionBy: username.substring(0, 26),
        comments: comments || `${action} action performed by ${username} (${userRole})`,
        amt: detail.premiumSummary?.PPS_TOTAL_PAYABLE || 0
      });

      await connection.commit();

      const updated = await this.findByProposalNo(code);
      if (!updated) {
        throw new Error('Failed to retrieve updated proposal.');
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
   * Fetch Mode of Payment (MOP) code list from STBL_CODE
   */
  async getMopCodes(): Promise<Array<{ codeSubCode: string; codeSubCodeDesc: string }>> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const sql = `
        SELECT CODE_SUB_CODE, CODE_SUB_CODE_DESC 
        FROM STBL_CODE 
        WHERE CODE = 'MOP'
        ORDER BY CODE_SUB_CODE
      `;
      const res = await connection.execute<{ CODE_SUB_CODE: string; CODE_SUB_CODE_DESC: string }>(
        sql,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (!res.rows) return [];
      return res.rows.map(r => ({
        codeSubCode: r.CODE_SUB_CODE,
        codeSubCodeDesc: r.CODE_SUB_CODE_DESC
      }));
    } finally {
      await releaseConnection(connection);
    }
  }
};
