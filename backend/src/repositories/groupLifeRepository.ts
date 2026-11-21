import oracledb from 'oracledb';
import crypto from 'crypto';
import { getConnection, releaseConnection } from '../config/database';
import {
  GLQuoteHeaderRecord,
  GLQuoteMemberRecord,
  GLQuoteRiderRecord,
  GLQuoteDetail,
  GLPolicyMasterRecord,
  GLPolicyMemberRecord,
  GLPolicyRiderRecord,
  GLPolicyDetail,
  SaveGLQuotePayload,
  CalculateGLQuotePayload,
  GLBenefitStructure,
  GLPaymentFrequency
} from '../types/groupLife';

function calculateAge(dobStr: string): number {
  if (!dobStr) return 30;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return 30;
  const diffMs = Date.now() - dob.getTime();
  const ageDt = new Date(diffMs);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}

function getModalFactor(freq: GLPaymentFrequency): number {
  switch (freq) {
    case 'SEMI_ANNUAL':
      return 0.52;
    case 'QUARTERLY':
      return 0.265;
    case 'MONTHLY':
      return 0.09;
    case 'SINGLE':
    case 'ANNUAL':
    default:
      return 1.0;
  }
}

export const groupLifeRepository = {
  /**
   * Perform Group Life Census & Premium Calculation
   */
  calculate(payload: CalculateGLQuotePayload) {
    const salaryMultiple = Number(payload.salaryMultiple || 3);
    const flatSa = Number(payload.flatSaAmount || 0);
    const fcl = Number(payload.freeCoverLimit || 250000);
    const baseRatePerMille = Number(payload.baseRatePerMille || 2.5);
    const experienceDiscountPct = Number(payload.experienceDiscountPct || 0);
    const payFreq = payload.payFreq || 'ANNUAL';
    const modalFactor = getModalFactor(payFreq);

    // Compute members
    const members: GLQuoteMemberRecord[] = (payload.members || []).map((m, idx) => {
      const age = m.dob ? calculateAge(m.dob) : 30;
      const monthlySalary = Number(m.monthlySalary || 0);
      const annualSalary = Number(m.annualSalary || (monthlySalary * 12));

      let sa = 0;
      if (payload.benefitStructure === 'MULTIPLE_OF_SALARY') {
        sa = Math.round(annualSalary * salaryMultiple);
      } else if (payload.benefitStructure === 'FLAT_SA') {
        sa = flatSa;
      } else {
        sa = Number(m.sumAssured || 0);
      }

      // Age grading rate adjustment (+/- 5% per 5 years above age 35)
      let memberRate = baseRatePerMille;
      if (age > 45) {
        memberRate = baseRatePerMille * (1 + ((age - 45) * 0.025));
      } else if (age < 25) {
        memberRate = baseRatePerMille * 0.90;
      }

      const premium = Math.round((sa * memberRate / 1000) * 100) / 100;
      const uwFlag = sa > fcl ? 'EVIDENCE_REQUIRED' : 'UNDER_FCL';

      return {
        MEMBER_ID: idx + 1,
        EMP_ID: m.empId || `EMP${String(idx + 1).padStart(4, '0')}`,
        MEMBER_NAME: m.memberName || `Member ${idx + 1}`,
        DOB: m.dob || '1990-01-01',
        AGE: age,
        GENDER: m.gender || 'M',
        CATEGORY: m.category || 'STAFF',
        MONTHLY_SALARY: monthlySalary,
        ANNUAL_SALARY: annualSalary,
        SUM_ASSURED: sa,
        PREMIUM_AMOUNT: premium,
        UNDERWRITING_FLAG: uwFlag,
        IS_ACTIVE: 'Y'
      };
    });

    const totalMembers = members.length;
    const totalSumAssured = members.reduce((acc, m) => acc + m.SUM_ASSURED, 0);
    const totalBasicPremiumGross = members.reduce((acc, m) => acc + m.PREMIUM_AMOUNT, 0);
    const discountAmount = Math.round((totalBasicPremiumGross * (experienceDiscountPct / 100)) * 100) / 100;
    const totalBasicPremium = Math.round((totalBasicPremiumGross - discountAmount) * 100) / 100;

    // Riders calculation
    const riders: GLQuoteRiderRecord[] = (payload.riders || []).map((r, idx) => {
      const saPercent = Number(r.saPercent || 100);
      const totalRiderSa = Math.round(totalSumAssured * (saPercent / 100));
      const riderRate = Number(r.ratePerMille || 0.45);
      const riderPremium = Math.round((totalRiderSa * riderRate / 1000) * 100) / 100;

      return {
        RIDER_ID: idx + 1,
        RIDER_CODE: r.riderCode,
        RIDER_NAME: r.riderName,
        SA_BASIS: r.saBasis || 'MATCH_BASIC',
        SA_PERCENT: saPercent,
        TOTAL_RIDER_SA: totalRiderSa,
        RIDER_RATE_PER_MILLE: riderRate,
        RIDER_PREMIUM: riderPremium,
        IS_ACTIVE: 'Y'
      };
    });

    const totalRiderPremium = riders.reduce((acc, r) => acc + r.RIDER_PREMIUM, 0);
    const totalAnnualPremium = Math.round((totalBasicPremium + totalRiderPremium) * 100) / 100;
    const installmentPremium = Math.round((totalAnnualPremium * modalFactor) * 100) / 100;

    return {
      benefitStructure: payload.benefitStructure,
      salaryMultiple,
      flatSaAmount: flatSa,
      freeCoverLimit: fcl,
      baseRatePerMille,
      experienceDiscountPct,
      payFreq,
      modalFactor,
      totalMembers,
      totalSumAssured,
      totalBasicPremiumGross,
      discountAmount,
      totalBasicPremium,
      totalRiderPremium,
      totalAnnualPremium,
      installmentPremium,
      members,
      riders
    };
  },

  /**
   * Generate next Quote Number: GLQ-YYYYMM-XXXX
   */
  async generateQuoteNo(connection: oracledb.Connection): Promise<string> {
    const res = await connection.execute<{ NEXTVAL: number }>(
      `SELECT SEQ_GL_QUOTE_ID.NEXTVAL AS NEXTVAL FROM DUAL`
    );
    const nextVal = res.rows?.[0]?.NEXTVAL || 10001;
    const d = new Date();
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `GLQ-${ym}-${String(nextVal).padStart(5, '0')}`;
  },

  /**
   * Generate next Master Policy Number: GLP-YYYYMM-XXXX
   */
  async generateMasterPolicyNo(connection: oracledb.Connection): Promise<string> {
    const res = await connection.execute<{ NEXTVAL: number }>(
      `SELECT SEQ_GL_POL_ID.NEXTVAL AS NEXTVAL FROM DUAL`
    );
    const nextVal = res.rows?.[0]?.NEXTVAL || 20001;
    const d = new Date();
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `GLP-${ym}-${String(nextVal).padStart(5, '0')}`;
  },

  /**
   * List all GL Quotes
   */
  async findAllQuotes(status?: string, search?: string): Promise<GLQuoteHeaderRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      let sql = `
        SELECT 
          q.GL_QUOTE_ID,
          q.GL_QUOTE_NO,
          q.GL_QUOTE_UID,
          TO_CHAR(q.GL_QUOTE_DATE, 'YYYY-MM-DD') AS GL_QUOTE_DATE,
          q.CORP_NAME,
          q.CORP_REG_NO,
          q.CORP_TAX_NO,
          q.CORP_CONTACT_PERSON,
          q.CORP_EMAIL,
          q.CORP_PHONE,
          q.CORP_ADDRESS,
          q.CORP_INDUSTRY,
          q.PROD_CODE,
          pr.PROD_NAME,
          q.BENEFIT_STRUCTURE,
          q.SALARY_MULTIPLE,
          q.FLAT_SA_AMOUNT,
          q.FREE_COVER_LIMIT,
          q.TOTAL_MEMBERS,
          q.TOTAL_SUM_ASSURED,
          q.BASE_RATE_PER_MILLE,
          q.EXPERIENCE_DISCOUNT_PCT,
          q.TOTAL_BASIC_PREMIUM,
          q.TOTAL_RIDER_PREMIUM,
          q.TOTAL_ANNUAL_PREMIUM,
          q.MODAL_FACTOR,
          q.INSTALLMENT_PREMIUM,
          q.PAY_FREQ,
          q.MOP,
          q.STATUS,
          q.REMARKS,
          q.IS_ACTIVE,
          q.CREATED_BY,
          TO_CHAR(q.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
          q.MODIFIED_BY,
          TO_CHAR(q.MODIFIED_ON, 'YYYY-MM-DD HH24:MI:SS') AS MODIFIED_ON
        FROM T_GL_QUOTE_HEADER q
        LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = q.PROD_CODE
        WHERE q.IS_ACTIVE = 'Y'
      `;

      const binds: any = {};
      if (status && status !== 'ALL') {
        sql += ` AND q.STATUS = :status`;
        binds.status = status;
      }
      if (search && search.trim()) {
        sql += ` AND (
          UPPER(q.GL_QUOTE_NO) LIKE UPPER(:search) OR 
          UPPER(q.CORP_NAME) LIKE UPPER(:search) OR 
          UPPER(q.CORP_CONTACT_PERSON) LIKE UPPER(:search)
        )`;
        binds.search = `%${search.trim()}%`;
      }

      sql += ` ORDER BY q.GL_QUOTE_ID DESC`;

      const result = await connection.execute<GLQuoteHeaderRecord>(sql, binds);
      return result.rows || [];
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Find single GL Quote by quoteNo or quoteId
   */
  async findQuoteByNo(quoteNo: string): Promise<GLQuoteDetail | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const hdrSql = `
        SELECT 
          q.GL_QUOTE_ID,
          q.GL_QUOTE_NO,
          q.GL_QUOTE_UID,
          TO_CHAR(q.GL_QUOTE_DATE, 'YYYY-MM-DD') AS GL_QUOTE_DATE,
          q.CORP_NAME,
          q.CORP_REG_NO,
          q.CORP_TAX_NO,
          q.CORP_CONTACT_PERSON,
          q.CORP_EMAIL,
          q.CORP_PHONE,
          q.CORP_ADDRESS,
          q.CORP_INDUSTRY,
          q.PROD_CODE,
          pr.PROD_NAME,
          q.BENEFIT_STRUCTURE,
          q.SALARY_MULTIPLE,
          q.FLAT_SA_AMOUNT,
          q.FREE_COVER_LIMIT,
          q.TOTAL_MEMBERS,
          q.TOTAL_SUM_ASSURED,
          q.BASE_RATE_PER_MILLE,
          q.EXPERIENCE_DISCOUNT_PCT,
          q.TOTAL_BASIC_PREMIUM,
          q.TOTAL_RIDER_PREMIUM,
          q.TOTAL_ANNUAL_PREMIUM,
          q.MODAL_FACTOR,
          q.INSTALLMENT_PREMIUM,
          q.PAY_FREQ,
          q.MOP,
          q.STATUS,
          q.REMARKS,
          q.IS_ACTIVE,
          q.CREATED_BY,
          TO_CHAR(q.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
          q.MODIFIED_BY,
          TO_CHAR(q.MODIFIED_ON, 'YYYY-MM-DD HH24:MI:SS') AS MODIFIED_ON
        FROM T_GL_QUOTE_HEADER q
        LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = q.PROD_CODE
        WHERE (q.GL_QUOTE_NO = :quoteNo OR q.GL_QUOTE_UID = :quoteNo)
      `;

      const hdrRes = await connection.execute<GLQuoteHeaderRecord>(hdrSql, { quoteNo });
      if (!hdrRes.rows || hdrRes.rows.length === 0) return null;

      const header = hdrRes.rows[0];
      const actualQuoteNo = header.GL_QUOTE_NO;

      const memSql = `
        SELECT 
          MEMBER_ID,
          GL_QUOTE_NO,
          EMP_ID,
          MEMBER_NAME,
          TO_CHAR(DOB, 'YYYY-MM-DD') AS DOB,
          AGE,
          GENDER,
          CATEGORY,
          MONTHLY_SALARY,
          ANNUAL_SALARY,
          SUM_ASSURED,
          PREMIUM_AMOUNT,
          UNDERWRITING_FLAG,
          IS_ACTIVE
        FROM T_GL_QUOTE_MEMBER
        WHERE GL_QUOTE_NO = :actualQuoteNo
        ORDER BY MEMBER_ID ASC
      `;
      const memRes = await connection.execute<GLQuoteMemberRecord>(memSql, { actualQuoteNo });

      const riderSql = `
        SELECT 
          RIDER_ID,
          GL_QUOTE_NO,
          RIDER_CODE,
          RIDER_NAME,
          SA_BASIS,
          SA_PERCENT,
          TOTAL_RIDER_SA,
          RIDER_RATE_PER_MILLE,
          RIDER_PREMIUM,
          IS_ACTIVE
        FROM T_GL_QUOTE_RIDER
        WHERE GL_QUOTE_NO = :actualQuoteNo
        ORDER BY RIDER_ID ASC
      `;
      const riderRes = await connection.execute<GLQuoteRiderRecord>(riderSql, { actualQuoteNo });

      return {
        header,
        members: memRes.rows || [],
        riders: riderRes.rows || []
      };
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Create a new Group Life Quote
   */
  async createQuote(payload: SaveGLQuotePayload, user: string = 'ADMIN'): Promise<GLQuoteDetail> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      // Recalculate figures to ensure exact actuarial balance
      const calc = this.calculate({
        benefitStructure: payload.benefitStructure,
        salaryMultiple: payload.salaryMultiple,
        flatSaAmount: payload.flatSaAmount,
        freeCoverLimit: payload.freeCoverLimit,
        baseRatePerMille: payload.baseRatePerMille,
        experienceDiscountPct: payload.experienceDiscountPct,
        payFreq: payload.payFreq,
        members: payload.members || [],
        riders: payload.riders || []
      });

      const quoteNo = await this.generateQuoteNo(connection);
      const quoteUid = crypto.randomUUID();

      // 1. Insert Header
      const hdrSql = `
        INSERT INTO T_GL_QUOTE_HEADER (
          GL_QUOTE_ID,
          GL_QUOTE_NO,
          GL_QUOTE_UID,
          GL_QUOTE_DATE,
          CORP_NAME,
          CORP_REG_NO,
          CORP_TAX_NO,
          CORP_CONTACT_PERSON,
          CORP_EMAIL,
          CORP_PHONE,
          CORP_ADDRESS,
          CORP_INDUSTRY,
          PROD_CODE,
          BENEFIT_STRUCTURE,
          SALARY_MULTIPLE,
          FLAT_SA_AMOUNT,
          FREE_COVER_LIMIT,
          TOTAL_MEMBERS,
          TOTAL_SUM_ASSURED,
          BASE_RATE_PER_MILLE,
          EXPERIENCE_DISCOUNT_PCT,
          TOTAL_BASIC_PREMIUM,
          TOTAL_RIDER_PREMIUM,
          TOTAL_ANNUAL_PREMIUM,
          MODAL_FACTOR,
          INSTALLMENT_PREMIUM,
          PAY_FREQ,
          MOP,
          STATUS,
          REMARKS,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_ON
        ) VALUES (
          SEQ_GL_QUOTE_ID.NEXTVAL,
          :quoteNo,
          :quoteUid,
          SYSDATE,
          :corpName,
          :corpRegNo,
          :corpTaxNo,
          :corpContactPerson,
          :corpEmail,
          :corpPhone,
          :corpAddress,
          :corpIndustry,
          :prodCode,
          :benefitStructure,
          :salaryMultiple,
          :flatSaAmount,
          :freeCoverLimit,
          :totalMembers,
          :totalSumAssured,
          :baseRatePerMille,
          :experienceDiscountPct,
          :totalBasicPremium,
          :totalRiderPremium,
          :totalAnnualPremium,
          :modalFactor,
          :installmentPremium,
          :payFreq,
          :mop,
          'QUOTED',
          :remarks,
          'Y',
          :appUser,
          SYSDATE
        )
      `;

      await connection.execute(
        hdrSql,
        {
          quoteNo,
          quoteUid,
          corpName: payload.corpName,
          corpRegNo: payload.corpRegNo || null,
          corpTaxNo: payload.corpTaxNo || null,
          corpContactPerson: payload.corpContactPerson || null,
          corpEmail: payload.corpEmail || null,
          corpPhone: payload.corpPhone || null,
          corpAddress: payload.corpAddress || null,
          corpIndustry: payload.corpIndustry || null,
          prodCode: payload.prodCode,
          benefitStructure: calc.benefitStructure,
          salaryMultiple: calc.salaryMultiple,
          flatSaAmount: calc.flatSaAmount,
          freeCoverLimit: calc.freeCoverLimit,
          totalMembers: calc.totalMembers,
          totalSumAssured: calc.totalSumAssured,
          baseRatePerMille: calc.baseRatePerMille,
          experienceDiscountPct: calc.experienceDiscountPct,
          totalBasicPremium: calc.totalBasicPremium,
          totalRiderPremium: calc.totalRiderPremium,
          totalAnnualPremium: calc.totalAnnualPremium,
          modalFactor: calc.modalFactor,
          installmentPremium: calc.installmentPremium,
          payFreq: calc.payFreq,
          mop: payload.mop || 'Y',
          remarks: payload.remarks || null,
          appUser: user
        },
        { autoCommit: false }
      );

      // 2. Insert Members
      const memSql = `
        INSERT INTO T_GL_QUOTE_MEMBER (
          MEMBER_ID,
          GL_QUOTE_NO,
          EMP_ID,
          MEMBER_NAME,
          DOB,
          AGE,
          GENDER,
          CATEGORY,
          MONTHLY_SALARY,
          ANNUAL_SALARY,
          SUM_ASSURED,
          PREMIUM_AMOUNT,
          UNDERWRITING_FLAG,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_ON
        ) VALUES (
          SEQ_GL_MEMBER_ID.NEXTVAL,
          :quoteNo,
          :empId,
          :memberName,
          TO_DATE(:dob, 'YYYY-MM-DD'),
          :age,
          :gender,
          :category,
          :monthlySalary,
          :annualSalary,
          :sumAssured,
          :premiumAmount,
          :uwFlag,
          'Y',
          :appUser,
          SYSDATE
        )
      `;

      for (const m of calc.members) {
        await connection.execute(
          memSql,
          {
            quoteNo,
            empId: m.EMP_ID,
            memberName: m.MEMBER_NAME,
            dob: (m.DOB || '').split('T')[0],
            age: m.AGE,
            gender: m.GENDER,
            category: m.CATEGORY || 'STAFF',
            monthlySalary: m.MONTHLY_SALARY,
            annualSalary: m.ANNUAL_SALARY,
            sumAssured: m.SUM_ASSURED,
            premiumAmount: m.PREMIUM_AMOUNT,
            uwFlag: m.UNDERWRITING_FLAG,
            appUser: user
          },
          { autoCommit: false }
        );
      }

      // 3. Insert Riders
      const riderSql = `
        INSERT INTO T_GL_QUOTE_RIDER (
          RIDER_ID,
          GL_QUOTE_NO,
          RIDER_CODE,
          RIDER_NAME,
          SA_BASIS,
          SA_PERCENT,
          TOTAL_RIDER_SA,
          RIDER_RATE_PER_MILLE,
          RIDER_PREMIUM,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_ON
        ) VALUES (
          SEQ_GL_Q_RIDER_ID.NEXTVAL,
          :quoteNo,
          :riderCode,
          :riderName,
          :saBasis,
          :saPercent,
          :totalRiderSa,
          :ratePerMille,
          :riderPremium,
          'Y',
          :appUser,
          SYSDATE
        )
      `;

      for (const r of calc.riders) {
        await connection.execute(
          riderSql,
          {
            quoteNo,
            riderCode: r.RIDER_CODE,
            riderName: r.RIDER_NAME,
            saBasis: r.SA_BASIS,
            saPercent: r.SA_PERCENT,
            totalRiderSa: r.TOTAL_RIDER_SA,
            ratePerMille: r.RIDER_RATE_PER_MILLE,
            riderPremium: r.RIDER_PREMIUM,
            appUser: user
          },
          { autoCommit: false }
        );
      }

      await connection.commit();

      const detail = await this.findQuoteByNo(quoteNo);
      return detail!;
    } catch (err) {
      if (connection) await connection.rollback();
      throw err;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Convert GL Quote to GL Master Policy
   */
  async convertToMasterPolicy(quoteNo: string, user: string = 'ADMIN'): Promise<GLPolicyDetail> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      // Get Quote
      const quoteDetail = await this.findQuoteByNo(quoteNo);
      if (!quoteDetail) {
        throw new Error(`Group Life Quote ${quoteNo} not found`);
      }
      if (quoteDetail.header.STATUS === 'CONVERTED') {
        throw new Error(`Group Life Quote ${quoteNo} is already converted to a Master Policy`);
      }

      const q = quoteDetail.header;
      const policyNo = await this.generateMasterPolicyNo(connection);

      // Inception date today, Expiry 1 year later
      const masterSql = `
        INSERT INTO T_GL_POLICY_MASTER (
          GL_POL_ID,
          MASTER_POLICY_NO,
          GL_QUOTE_NO,
          CORP_NAME,
          CORP_REG_NO,
          CORP_CONTACT_PERSON,
          CORP_EMAIL,
          CORP_PHONE,
          PROD_CODE,
          POLICY_INCEPTION_DATE,
          POLICY_EXPIRY_DATE,
          POLICY_RENEWAL_DATE,
          FREE_COVER_LIMIT,
          TOTAL_ACTIVE_MEMBERS,
          TOTAL_INFORCE_SA,
          TOTAL_INFORCE_PREMIUM,
          POL_PAY_FREQ,
          POL_MOP,
          POL_STATUS,
          POL_APPROVAL_LEVEL,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_ON
        ) VALUES (
          SEQ_GL_POL_ID.NEXTVAL,
          :policyNo,
          :quoteNo,
          :corpName,
          :corpRegNo,
          :corpContactPerson,
          :corpEmail,
          :corpPhone,
          :prodCode,
          TRUNC(SYSDATE),
          ADD_MONTHS(TRUNC(SYSDATE), 12),
          ADD_MONTHS(TRUNC(SYSDATE), 12),
          :fcl,
          :totalMembers,
          :totalSa,
          :totalPrem,
          :payFreq,
          :mop,
          'PENDING_APPROVAL',
          1,
          'Y',
          :appUser,
          SYSDATE
        )
      `;

      await connection.execute(
        masterSql,
        {
          policyNo,
          quoteNo: q.GL_QUOTE_NO,
          corpName: q.CORP_NAME,
          corpRegNo: q.CORP_REG_NO || null,
          corpContactPerson: q.CORP_CONTACT_PERSON || null,
          corpEmail: q.CORP_EMAIL || null,
          corpPhone: q.CORP_PHONE || null,
          prodCode: q.PROD_CODE,
          fcl: q.FREE_COVER_LIMIT,
          totalMembers: q.TOTAL_MEMBERS,
          totalSa: q.TOTAL_SUM_ASSURED,
          totalPrem: q.TOTAL_ANNUAL_PREMIUM,
          payFreq: q.PAY_FREQ,
          mop: q.MOP || 'Y',
          appUser: user
        },
        { autoCommit: false }
      );

      // Copy Members into Master Policy Members
      const memSql = `
        INSERT INTO T_GL_POLICY_MEMBER (
          MEMBER_ID,
          MASTER_POLICY_NO,
          EMP_ID,
          MEMBER_NAME,
          DOB,
          AGE,
          GENDER,
          CATEGORY,
          MONTHLY_SALARY,
          ANNUAL_SALARY,
          SUM_ASSURED,
          MEMBER_PREMIUM,
          MEMBER_STATUS,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_ON
        ) VALUES (
          SEQ_GL_POL_MEM_ID.NEXTVAL,
          :policyNo,
          :empId,
          :memberName,
          TO_DATE(:dob, 'YYYY-MM-DD'),
          :age,
          :gender,
          :category,
          :monthlySalary,
          :annualSalary,
          :sumAssured,
          :memberPremium,
          'ACTIVE',
          'Y',
          :appUser,
          SYSDATE
        )
      `;

      for (const m of quoteDetail.members) {
        await connection.execute(
          memSql,
          {
            policyNo,
            empId: m.EMP_ID,
            memberName: m.MEMBER_NAME,
            dob: (m.DOB || '').split('T')[0],
            age: m.AGE,
            gender: m.GENDER,
            category: m.CATEGORY || 'STAFF',
            monthlySalary: m.MONTHLY_SALARY,
            annualSalary: m.ANNUAL_SALARY,
            sumAssured: m.SUM_ASSURED,
            memberPremium: m.PREMIUM_AMOUNT,
            appUser: user
          },
          { autoCommit: false }
        );
      }

      // Copy Riders
      const riderSql = `
        INSERT INTO T_GL_POLICY_RIDER (
          RIDER_ID,
          MASTER_POLICY_NO,
          RIDER_CODE,
          RIDER_NAME,
          TOTAL_RIDER_SA,
          RIDER_PREMIUM,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_ON
        ) VALUES (
          SEQ_GL_POL_RIDER_ID.NEXTVAL,
          :policyNo,
          :riderCode,
          :riderName,
          :totalRiderSa,
          :riderPremium,
          'Y',
          :appUser,
          SYSDATE
        )
      `;

      for (const r of quoteDetail.riders) {
        await connection.execute(
          riderSql,
          {
            policyNo,
            riderCode: r.RIDER_CODE,
            riderName: r.RIDER_NAME,
            totalRiderSa: r.TOTAL_RIDER_SA,
            riderPremium: r.RIDER_PREMIUM,
            appUser: user
          },
          { autoCommit: false }
        );
      }

      // Update Quote Status to CONVERTED
      await connection.execute(
        `UPDATE T_GL_QUOTE_HEADER SET STATUS = 'CONVERTED', MODIFIED_BY = :appUser, MODIFIED_ON = SYSDATE WHERE GL_QUOTE_NO = :quoteNo`,
        { quoteNo: q.GL_QUOTE_NO, appUser: user },
        { autoCommit: false }
      );

      await connection.commit();

      const polDetail = await this.findPolicyByNo(policyNo);
      return polDetail!;
    } catch (err) {
      if (connection) await connection.rollback();
      throw err;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * List all GL Master Policies
   */
  async findAllPolicies(status?: string, search?: string): Promise<GLPolicyMasterRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      let sql = `
        SELECT 
          p.GL_POL_ID,
          p.MASTER_POLICY_NO,
          p.GL_QUOTE_NO,
          p.CORP_NAME,
          p.CORP_REG_NO,
          p.CORP_CONTACT_PERSON,
          p.CORP_EMAIL,
          p.CORP_PHONE,
          p.PROD_CODE,
          pr.PROD_NAME,
          TO_CHAR(p.POLICY_INCEPTION_DATE, 'YYYY-MM-DD') AS POLICY_INCEPTION_DATE,
          TO_CHAR(p.POLICY_EXPIRY_DATE, 'YYYY-MM-DD') AS POLICY_EXPIRY_DATE,
          TO_CHAR(p.POLICY_RENEWAL_DATE, 'YYYY-MM-DD') AS POLICY_RENEWAL_DATE,
          p.FREE_COVER_LIMIT,
          p.TOTAL_ACTIVE_MEMBERS,
          p.TOTAL_INFORCE_SA,
          p.TOTAL_INFORCE_PREMIUM,
          p.POL_PAY_FREQ,
          p.POL_MOP,
          p.POL_STATUS,
          p.POL_APPROVAL_LEVEL,
          p.POL_APPROVED_BY,
          TO_CHAR(p.POL_APPROVED_ON, 'YYYY-MM-DD HH24:MI:SS') AS POL_APPROVED_ON,
          p.POL_APPROVAL_REMARKS,
          p.IS_ACTIVE,
          p.CREATED_BY,
          TO_CHAR(p.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
        FROM T_GL_POLICY_MASTER p
        LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = p.PROD_CODE
        WHERE p.IS_ACTIVE = 'Y'
      `;

      const binds: any = {};
      if (status && status !== 'ALL') {
        sql += ` AND p.POL_STATUS = :status`;
        binds.status = status;
      }
      if (search && search.trim()) {
        sql += ` AND (
          UPPER(p.MASTER_POLICY_NO) LIKE UPPER(:search) OR 
          UPPER(p.CORP_NAME) LIKE UPPER(:search) OR 
          UPPER(p.GL_QUOTE_NO) LIKE UPPER(:search)
        )`;
        binds.search = `%${search.trim()}%`;
      }

      sql += ` ORDER BY p.GL_POL_ID DESC`;

      const result = await connection.execute<GLPolicyMasterRecord>(sql, binds);
      return result.rows || [];
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Find single GL Master Policy with members and riders
   */
  async findPolicyByNo(policyNo: string): Promise<GLPolicyDetail | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const masterSql = `
        SELECT 
          p.GL_POL_ID,
          p.MASTER_POLICY_NO,
          p.GL_QUOTE_NO,
          p.CORP_NAME,
          p.CORP_REG_NO,
          p.CORP_CONTACT_PERSON,
          p.CORP_EMAIL,
          p.CORP_PHONE,
          p.PROD_CODE,
          pr.PROD_NAME,
          TO_CHAR(p.POLICY_INCEPTION_DATE, 'YYYY-MM-DD') AS POLICY_INCEPTION_DATE,
          TO_CHAR(p.POLICY_EXPIRY_DATE, 'YYYY-MM-DD') AS POLICY_EXPIRY_DATE,
          TO_CHAR(p.POLICY_RENEWAL_DATE, 'YYYY-MM-DD') AS POLICY_RENEWAL_DATE,
          p.FREE_COVER_LIMIT,
          p.TOTAL_ACTIVE_MEMBERS,
          p.TOTAL_INFORCE_SA,
          p.TOTAL_INFORCE_PREMIUM,
          p.POL_PAY_FREQ,
          p.POL_MOP,
          p.POL_STATUS,
          p.POL_APPROVAL_LEVEL,
          p.POL_APPROVED_BY,
          TO_CHAR(p.POL_APPROVED_ON, 'YYYY-MM-DD HH24:MI:SS') AS POL_APPROVED_ON,
          p.POL_APPROVAL_REMARKS,
          p.IS_ACTIVE,
          p.CREATED_BY,
          TO_CHAR(p.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
        FROM T_GL_POLICY_MASTER p
        LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = p.PROD_CODE
        WHERE p.MASTER_POLICY_NO = :policyNo
      `;

      const res = await connection.execute<GLPolicyMasterRecord>(masterSql, { policyNo });
      if (!res.rows || res.rows.length === 0) return null;

      const master = res.rows[0];

      const memSql = `
        SELECT 
          MEMBER_ID,
          MASTER_POLICY_NO,
          EMP_ID,
          MEMBER_NAME,
          TO_CHAR(DOB, 'YYYY-MM-DD') AS DOB,
          AGE,
          GENDER,
          CATEGORY,
          MONTHLY_SALARY,
          ANNUAL_SALARY,
          SUM_ASSURED,
          MEMBER_PREMIUM,
          MEMBER_STATUS,
          IS_ACTIVE
        FROM T_GL_POLICY_MEMBER
        WHERE MASTER_POLICY_NO = :policyNo
        ORDER BY MEMBER_ID ASC
      `;
      const memRes = await connection.execute<GLPolicyMemberRecord>(memSql, { policyNo });

      const riderSql = `
        SELECT 
          RIDER_ID,
          MASTER_POLICY_NO,
          RIDER_CODE,
          RIDER_NAME,
          TOTAL_RIDER_SA,
          RIDER_PREMIUM,
          IS_ACTIVE
        FROM T_GL_POLICY_RIDER
        WHERE MASTER_POLICY_NO = :policyNo
        ORDER BY RIDER_ID ASC
      `;
      const riderRes = await connection.execute<GLPolicyRiderRecord>(riderSql, { policyNo });

      return {
        master,
        members: memRes.rows || [],
        riders: riderRes.rows || []
      };
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Approve GL Master Policy
   */
  async approvePolicy(policyNo: string, remarks?: string, user: string = 'POLICY_ADMIN'): Promise<GLPolicyDetail> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const updateSql = `
        UPDATE T_GL_POLICY_MASTER
        SET 
          POL_STATUS = 'APPROVED',
          POL_APPROVAL_LEVEL = 2,
          POL_APPROVED_BY = :appUser,
          POL_APPROVED_ON = SYSDATE,
          POL_APPROVAL_REMARKS = :remarks,
          MODIFIED_BY = :appUser,
          MODIFIED_ON = SYSDATE
        WHERE MASTER_POLICY_NO = :policyNo
      `;

      await connection.execute(updateSql, {
        policyNo,
        remarks: remarks || 'Approved by Underwriting/Policy Admin',
        appUser: user
      });

      const detail = await this.findPolicyByNo(policyNo);
      return detail!;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  }
};
