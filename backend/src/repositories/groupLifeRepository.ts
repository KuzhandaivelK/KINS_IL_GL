import oracledb from 'oracledb';
import crypto from 'crypto';
import { getConnection, releaseConnection } from '../config/database';
import {
  GLQuoteHeaderRecord,
  GLQuoteMemberRecord,
  GLQuoteRiderRecord,
  GLMemberCoverRecord,
  GLEoiDocumentRecord,
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

      // FCL / EOI Rule:
      // If SA > FCL and EOI_FLAG !== 'Y', cap Effective Sum Assured at FCL for rating.
      // If EOI_FLAG === 'Y', consider Full Sum Assured for premium calculation.
      const isAboveFcl = sa > fcl;
      const eoiFlag: 'Y' | 'N' = m.eoiFlag === 'Y' ? 'Y' : 'N';
      const effectiveSa = isAboveFcl && eoiFlag !== 'Y' ? fcl : sa;
      const eoiStatus: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' = !isAboveFcl
        ? 'NOT_REQUIRED'
        : eoiFlag === 'Y'
        ? 'APPROVED'
        : 'PENDING';
      const uwFlag = !isAboveFcl
        ? 'UNDER_FCL'
        : eoiFlag === 'Y'
        ? 'EOI_APPROVED'
        : 'EVIDENCE_REQUIRED';

      const premium = Math.round((effectiveSa * memberRate / 1000) * 100) / 100;

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
        EFFECTIVE_SA: effectiveSa,
        PREMIUM_AMOUNT: premium,
        UNDERWRITING_FLAG: uwFlag,
        EOI_FLAG: eoiFlag,
        EOI_STATUS: eoiStatus,
        EOI_REMARKS: m.eoiRemarks || null,
        IS_ACTIVE: 'Y'
      };
    });

    const totalMembers = members.length;
    const totalSumAssured = members.reduce((acc, m) => acc + Number(m.EFFECTIVE_SA ?? m.SUM_ASSURED), 0);
    const totalBasicPremiumGross = members.reduce((acc, m) => acc + m.PREMIUM_AMOUNT, 0);
    const discountAmount = Math.round((totalBasicPremiumGross * (experienceDiscountPct / 100)) * 100) / 100;
    const totalBasicPremium = Math.round((totalBasicPremiumGross - discountAmount) * 100) / 100;

    // Riders calculation (based on Effective / Rated Sum Assured)
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

    // Build per-member cover-wise premium schedule (Basic Life + each selected Rider) using EFFECTIVE_SA
    const memberCovers: GLMemberCoverRecord[] = [];
    for (const m of members) {
      const ratedSa = Number(m.EFFECTIVE_SA ?? m.SUM_ASSURED);
      let memberRate = baseRatePerMille;
      if (m.AGE > 45) {
        memberRate = baseRatePerMille * (1 + ((m.AGE - 45) * 0.025));
      } else if (m.AGE < 25) {
        memberRate = baseRatePerMille * 0.90;
      }
      memberRate = Math.round(memberRate * 10000) / 10000;

      const grossBasic = m.PREMIUM_AMOUNT;
      const discAmt = Math.round((grossBasic * (experienceDiscountPct / 100)) * 100) / 100;
      const netBasic = Math.round((grossBasic - discAmt) * 100) / 100;

      memberCovers.push({
        MEMBER_ID: m.MEMBER_ID,
        EMP_ID: m.EMP_ID,
        MEMBER_NAME: m.MEMBER_NAME,
        AGE: m.AGE,
        GENDER: m.GENDER,
        CATEGORY: m.CATEGORY,
        COVER_CODE: 'BASIC_LIFE',
        COVER_NAME: 'Basic Group Term Life',
        COVER_TYPE: 'BASIC',
        SA_PERCENT: 100,
        COVER_SUM_ASSURED: ratedSa,
        RATE_PER_MILLE: memberRate,
        GROSS_PREMIUM: grossBasic,
        DISCOUNT_AMOUNT: discAmt,
        NET_PREMIUM: netBasic,
        IS_ACTIVE: 'Y'
      });

      for (const r of riders) {
        const coverSa = Math.round(ratedSa * (r.SA_PERCENT / 100));
        const rPrem = Math.round((coverSa * r.RIDER_RATE_PER_MILLE / 1000) * 100) / 100;

        memberCovers.push({
          MEMBER_ID: m.MEMBER_ID,
          EMP_ID: m.EMP_ID,
          MEMBER_NAME: m.MEMBER_NAME,
          AGE: m.AGE,
          GENDER: m.GENDER,
          CATEGORY: m.CATEGORY,
          COVER_CODE: r.RIDER_CODE,
          COVER_NAME: r.RIDER_NAME,
          COVER_TYPE: 'RIDER',
          SA_PERCENT: r.SA_PERCENT,
          COVER_SUM_ASSURED: coverSa,
          RATE_PER_MILLE: r.RIDER_RATE_PER_MILLE,
          GROSS_PREMIUM: rPrem,
          DISCOUNT_AMOUNT: 0,
          NET_PREMIUM: rPrem,
          IS_ACTIVE: 'Y'
        });
      }
    }

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
      riders,
      memberCovers
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
          NVL(EFFECTIVE_SA, SUM_ASSURED) AS EFFECTIVE_SA,
          PREMIUM_AMOUNT,
          UNDERWRITING_FLAG,
          NVL(EOI_FLAG, 'N') AS EOI_FLAG,
          NVL(EOI_STATUS, 'NOT_REQUIRED') AS EOI_STATUS,
          EOI_REMARKS,
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

      const memCovSql = `
        SELECT
          c.MEM_COVER_ID,
          c.GL_QUOTE_NO,
          c.MEMBER_ID,
          c.EMP_ID,
          m.MEMBER_NAME,
          m.AGE,
          m.GENDER,
          m.CATEGORY,
          c.COVER_CODE,
          c.COVER_NAME,
          c.COVER_TYPE,
          c.SA_PERCENT,
          c.COVER_SUM_ASSURED,
          c.RATE_PER_MILLE,
          c.GROSS_PREMIUM,
          c.DISCOUNT_AMOUNT,
          c.NET_PREMIUM,
          c.IS_ACTIVE
        FROM T_GL_QUOTE_MEMBER_COVER c
        JOIN T_GL_QUOTE_MEMBER m ON m.MEMBER_ID = c.MEMBER_ID
        WHERE c.GL_QUOTE_NO = :actualQuoteNo
          AND c.IS_ACTIVE = 'Y'
        ORDER BY c.MEMBER_ID ASC, CASE WHEN c.COVER_TYPE = 'BASIC' THEN 0 ELSE 1 END, c.MEM_COVER_ID ASC
      `;
      const memCovRes = await connection.execute<GLMemberCoverRecord>(memCovSql, { actualQuoteNo });

      const eoiDocSql = `
        SELECT
          EOI_DOC_ID, REF_TYPE, REF_NO, MEMBER_ID, EMP_ID, DOC_TYPE,
          FILE_NAME, STORED_FILE_NAME, FILE_PATH, MIME_TYPE, FILE_SIZE, REMARKS,
          IS_ACTIVE, UPLOADED_BY, TO_CHAR(UPLOADED_ON, 'YYYY-MM-DD HH24:MI:SS') AS UPLOADED_ON
        FROM T_GL_EOI_DOCUMENT
        WHERE REF_TYPE = 'QUOTE' AND REF_NO = :actualQuoteNo AND IS_ACTIVE = 'Y'
        ORDER BY EOI_DOC_ID DESC
      `;
      const eoiDocRes = await connection.execute<GLEoiDocumentRecord>(eoiDocSql, { actualQuoteNo });

      return {
        header,
        members: memRes.rows || [],
        riders: riderRes.rows || [],
        memberCovers: memCovRes.rows || [],
        eoiDocuments: eoiDocRes.rows || []
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
          EFFECTIVE_SA,
          PREMIUM_AMOUNT,
          UNDERWRITING_FLAG,
          EOI_FLAG,
          EOI_STATUS,
          EOI_REMARKS,
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
          :effectiveSa,
          :premiumAmount,
          :uwFlag,
          :eoiFlag,
          :eoiStatus,
          :eoiRemarks,
          'Y',
          :appUser,
          SYSDATE
        ) RETURNING MEMBER_ID INTO :outMemberId
      `;

      const memCovSql = `
        INSERT INTO T_GL_QUOTE_MEMBER_COVER (
          MEM_COVER_ID,
          GL_QUOTE_NO,
          MEMBER_ID,
          EMP_ID,
          COVER_CODE,
          COVER_NAME,
          COVER_TYPE,
          SA_PERCENT,
          COVER_SUM_ASSURED,
          RATE_PER_MILLE,
          GROSS_PREMIUM,
          DISCOUNT_AMOUNT,
          NET_PREMIUM,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_ON
        ) VALUES (
          SEQ_GL_Q_MEM_COV_ID.NEXTVAL,
          :quoteNo,
          :memberId,
          :empId,
          :coverCode,
          :coverName,
          :coverType,
          :saPercent,
          :coverSa,
          :ratePerMille,
          :grossPremium,
          :discountAmount,
          :netPremium,
          'Y',
          :appUser,
          SYSDATE
        )
      `;

      for (const m of calc.members) {
        const memExecRes = await connection.execute<{ outMemberId: number[] }>(
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
            effectiveSa: m.EFFECTIVE_SA ?? m.SUM_ASSURED,
            premiumAmount: m.PREMIUM_AMOUNT,
            uwFlag: m.UNDERWRITING_FLAG,
            eoiFlag: m.EOI_FLAG || 'N',
            eoiStatus: m.EOI_STATUS || 'NOT_REQUIRED',
            eoiRemarks: m.EOI_REMARKS || null,
            appUser: user,
            outMemberId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
          },
          { autoCommit: false }
        );

        const insertedMemberId = (memExecRes.outBinds as any)?.outMemberId?.[0];
        const coversForMember = calc.memberCovers.filter((c) => c.MEMBER_ID === m.MEMBER_ID);
        for (const cov of coversForMember) {
          await connection.execute(
            memCovSql,
            {
              quoteNo,
              memberId: insertedMemberId,
              empId: m.EMP_ID,
              coverCode: cov.COVER_CODE,
              coverName: cov.COVER_NAME,
              coverType: cov.COVER_TYPE,
              saPercent: cov.SA_PERCENT,
              coverSa: cov.COVER_SUM_ASSURED,
              ratePerMille: cov.RATE_PER_MILLE,
              grossPremium: cov.GROSS_PREMIUM,
              discountAmount: cov.DISCOUNT_AMOUNT,
              netPremium: cov.NET_PREMIUM,
              appUser: user
            },
            { autoCommit: false }
          );
        }
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
          EFFECTIVE_SA,
          MEMBER_PREMIUM,
          MEMBER_STATUS,
          EOI_FLAG,
          EOI_STATUS,
          EOI_REMARKS,
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
          :effectiveSa,
          :memberPremium,
          'ACTIVE',
          :eoiFlag,
          :eoiStatus,
          :eoiRemarks,
          'Y',
          :appUser,
          SYSDATE
        ) RETURNING MEMBER_ID INTO :outMemberId
      `;

      const polMemCovSql = `
        INSERT INTO T_GL_POLICY_MEMBER_COVER (
          POL_MEM_COVER_ID,
          MASTER_POLICY_NO,
          MEMBER_ID,
          EMP_ID,
          COVER_CODE,
          COVER_NAME,
          COVER_TYPE,
          SA_PERCENT,
          COVER_SUM_ASSURED,
          RATE_PER_MILLE,
          GROSS_PREMIUM,
          DISCOUNT_AMOUNT,
          NET_PREMIUM,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_ON
        ) VALUES (
          SEQ_GL_P_MEM_COV_ID.NEXTVAL,
          :policyNo,
          :memberId,
          :empId,
          :coverCode,
          :coverName,
          :coverType,
          :saPercent,
          :coverSa,
          :ratePerMille,
          :grossPremium,
          :discountAmount,
          :netPremium,
          'Y',
          :appUser,
          SYSDATE
        )
      `;

      const quoteMemberCovers = quoteDetail.memberCovers || [];

      for (const m of quoteDetail.members) {
        const memExecRes = await connection.execute<{ outMemberId: number[] }>(
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
            effectiveSa: m.EFFECTIVE_SA ?? m.SUM_ASSURED,
            memberPremium: m.PREMIUM_AMOUNT,
            eoiFlag: m.EOI_FLAG || 'N',
            eoiStatus: m.EOI_STATUS || 'NOT_REQUIRED',
            eoiRemarks: m.EOI_REMARKS || null,
            appUser: user,
            outMemberId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
          },
          { autoCommit: false }
        );

        const insertedPolMemId = (memExecRes.outBinds as any)?.outMemberId?.[0];
        const covsForMember = quoteMemberCovers.filter(
          (c) => (c.MEMBER_ID && m.MEMBER_ID && c.MEMBER_ID === m.MEMBER_ID) || c.EMP_ID === m.EMP_ID
        );

        if (covsForMember.length > 0) {
          for (const cov of covsForMember) {
            await connection.execute(
              polMemCovSql,
              {
                policyNo,
                memberId: insertedPolMemId,
                empId: m.EMP_ID,
                coverCode: cov.COVER_CODE,
                coverName: cov.COVER_NAME,
                coverType: cov.COVER_TYPE,
                saPercent: cov.SA_PERCENT,
                coverSa: cov.COVER_SUM_ASSURED,
                ratePerMille: cov.RATE_PER_MILLE,
                grossPremium: cov.GROSS_PREMIUM,
                discountAmount: cov.DISCOUNT_AMOUNT,
                netPremium: cov.NET_PREMIUM,
                appUser: user
              },
              { autoCommit: false }
            );
          }
        } else {
          // Fallback if quote had no member cover rows
          let memRate = Number(q.BASE_RATE_PER_MILLE || 2.5);
          if (m.AGE > 45) memRate = memRate * (1 + (m.AGE - 45) * 0.025);
          else if (m.AGE < 25) memRate = memRate * 0.9;
          memRate = Math.round(memRate * 10000) / 10000;
          const grossBasic = Math.round((m.SUM_ASSURED * memRate / 1000) * 100) / 100;
          const discAmt = Math.round((grossBasic * Number(q.EXPERIENCE_DISCOUNT_PCT || 0) / 100) * 100) / 100;
          const netBasic = Math.round((grossBasic - discAmt) * 100) / 100;

          await connection.execute(
            polMemCovSql,
            {
              policyNo,
              memberId: insertedPolMemId,
              empId: m.EMP_ID,
              coverCode: 'BASIC_LIFE',
              coverName: 'Basic Group Term Life',
              coverType: 'BASIC',
              saPercent: 100,
              coverSa: m.SUM_ASSURED,
              ratePerMille: memRate,
              grossPremium: grossBasic,
              discountAmount: discAmt,
              netPremium: netBasic,
              appUser: user
            },
            { autoCommit: false }
          );

          for (const r of quoteDetail.riders) {
            const saPct = Number(r.SA_PERCENT || 100);
            const rSa = Math.round(m.SUM_ASSURED * saPct / 100);
            const rRate = Number(r.RIDER_RATE_PER_MILLE || 0.45);
            const rPrem = Math.round((rSa * rRate / 1000) * 100) / 100;

            await connection.execute(
              polMemCovSql,
              {
                policyNo,
                memberId: insertedPolMemId,
                empId: m.EMP_ID,
                coverCode: r.RIDER_CODE,
                coverName: r.RIDER_NAME,
                coverType: 'RIDER',
                saPercent: saPct,
                coverSa: rSa,
                ratePerMille: rRate,
                grossPremium: rPrem,
                discountAmount: 0,
                netPremium: rPrem,
                appUser: user
              },
              { autoCommit: false }
            );
          }
        }
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

      // Copy EOI Documents from Quote to Master Policy (if any)
      await connection.execute(
        `INSERT INTO T_GL_EOI_DOCUMENT (
          EOI_DOC_ID, REF_TYPE, REF_NO, MEMBER_ID, EMP_ID, DOC_TYPE,
          FILE_NAME, STORED_FILE_NAME, FILE_PATH, MIME_TYPE, FILE_SIZE, REMARKS,
          IS_ACTIVE, UPLOADED_BY, UPLOADED_ON
        )
        SELECT
          SEQ_GL_EOI_DOC_ID.NEXTVAL, 'POLICY', :policyNo, pm.MEMBER_ID, d.EMP_ID, d.DOC_TYPE,
          d.FILE_NAME, d.STORED_FILE_NAME, d.FILE_PATH, d.MIME_TYPE, d.FILE_SIZE, d.REMARKS,
          'Y', d.UPLOADED_BY, d.UPLOADED_ON
        FROM T_GL_EOI_DOCUMENT d
        LEFT JOIN T_GL_POLICY_MEMBER pm ON pm.MASTER_POLICY_NO = :policyNo AND pm.EMP_ID = d.EMP_ID
        WHERE d.REF_TYPE = 'QUOTE' AND d.REF_NO = :quoteNo AND d.IS_ACTIVE = 'Y'`,
        { policyNo, quoteNo: q.GL_QUOTE_NO },
        { autoCommit: false }
      );

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
          NVL(EFFECTIVE_SA, SUM_ASSURED) AS EFFECTIVE_SA,
          MEMBER_PREMIUM,
          MEMBER_STATUS,
          NVL(EOI_FLAG, 'N') AS EOI_FLAG,
          NVL(EOI_STATUS, 'NOT_REQUIRED') AS EOI_STATUS,
          EOI_REMARKS,
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

      const memCovSql = `
        SELECT
          c.POL_MEM_COVER_ID,
          c.MASTER_POLICY_NO,
          c.MEMBER_ID,
          c.EMP_ID,
          m.MEMBER_NAME,
          m.AGE,
          m.GENDER,
          m.CATEGORY,
          c.COVER_CODE,
          c.COVER_NAME,
          c.COVER_TYPE,
          c.SA_PERCENT,
          c.COVER_SUM_ASSURED,
          c.RATE_PER_MILLE,
          c.GROSS_PREMIUM,
          c.DISCOUNT_AMOUNT,
          c.NET_PREMIUM,
          c.IS_ACTIVE
        FROM T_GL_POLICY_MEMBER_COVER c
        JOIN T_GL_POLICY_MEMBER m ON m.MEMBER_ID = c.MEMBER_ID
        WHERE c.MASTER_POLICY_NO = :policyNo
          AND c.IS_ACTIVE = 'Y'
        ORDER BY c.MEMBER_ID ASC, CASE WHEN c.COVER_TYPE = 'BASIC' THEN 0 ELSE 1 END, c.POL_MEM_COVER_ID ASC
      `;
      const memCovRes = await connection.execute<GLMemberCoverRecord>(memCovSql, { policyNo });

      const eoiDocSql = `
        SELECT
          EOI_DOC_ID, REF_TYPE, REF_NO, MEMBER_ID, EMP_ID, DOC_TYPE,
          FILE_NAME, STORED_FILE_NAME, FILE_PATH, MIME_TYPE, FILE_SIZE, REMARKS,
          IS_ACTIVE, UPLOADED_BY, TO_CHAR(UPLOADED_ON, 'YYYY-MM-DD HH24:MI:SS') AS UPLOADED_ON
        FROM T_GL_EOI_DOCUMENT
        WHERE REF_TYPE = 'POLICY' AND REF_NO = :policyNo AND IS_ACTIVE = 'Y'
        ORDER BY EOI_DOC_ID DESC
      `;
      const eoiDocRes = await connection.execute<GLEoiDocumentRecord>(eoiDocSql, { policyNo });

      return {
        master,
        members: memRes.rows || [],
        riders: riderRes.rows || [],
        memberCovers: memCovRes.rows || [],
        eoiDocuments: eoiDocRes.rows || []
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
  },

  /**
   * Add members to an existing GL Master Policy (e.g. from file upload or endorsement)
   */
  async addPolicyMembers(
    policyNo: string,
    members: Array<{
      EMP_ID?: string;
      MEMBER_NAME: string;
      DOB: string;
      AGE: number;
      GENDER: string;
      CATEGORY?: string;
      MONTHLY_SALARY?: number;
      ANNUAL_SALARY?: number;
      SUM_ASSURED: number;
      MEMBER_PREMIUM?: number;
    }>,
    user: string = 'ADMIN'
  ): Promise<GLPolicyDetail> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const polCheck = await connection.execute<{
        POL_STATUS: string;
        GL_QUOTE_NO: string;
        FREE_COVER_LIMIT: number;
        BASE_RATE_PER_MILLE: number;
        EXPERIENCE_DISCOUNT_PCT: number;
      }>(
        `SELECT p.POL_STATUS, p.GL_QUOTE_NO, NVL(p.FREE_COVER_LIMIT, 250000) AS FREE_COVER_LIMIT, NVL(q.BASE_RATE_PER_MILLE, 2.5) AS BASE_RATE_PER_MILLE, NVL(q.EXPERIENCE_DISCOUNT_PCT, 0) AS EXPERIENCE_DISCOUNT_PCT
         FROM T_GL_POLICY_MASTER p
         LEFT JOIN T_GL_QUOTE_HEADER q ON q.GL_QUOTE_NO = p.GL_QUOTE_NO
         WHERE p.MASTER_POLICY_NO = :policyNo`,
        { policyNo }
      );
      if (!polCheck.rows || polCheck.rows.length === 0) {
        throw new Error(`Master Policy ${policyNo} not found`);
      }

      const polMeta = polCheck.rows[0];
      const fcl = Number(polMeta.FREE_COVER_LIMIT || 250000);
      const baseRate = Number(polMeta.BASE_RATE_PER_MILLE || 2.5);
      const discPct = Number(polMeta.EXPERIENCE_DISCOUNT_PCT || 0);

      // Fetch attached policy riders and their rates
      const riderRes = await connection.execute<{
        RIDER_CODE: string;
        RIDER_NAME: string;
        SA_PERCENT: number;
        RIDER_RATE_PER_MILLE: number;
      }>(
        `SELECT pr.RIDER_CODE, pr.RIDER_NAME, NVL(qr.SA_PERCENT, 100) AS SA_PERCENT, NVL(qr.RIDER_RATE_PER_MILLE, 0.45) AS RIDER_RATE_PER_MILLE
         FROM T_GL_POLICY_RIDER pr
         LEFT JOIN T_GL_QUOTE_RIDER qr ON qr.GL_QUOTE_NO = :quoteNo AND qr.RIDER_CODE = pr.RIDER_CODE
         WHERE pr.MASTER_POLICY_NO = :policyNo AND pr.IS_ACTIVE = 'Y'
         ORDER BY pr.RIDER_ID ASC`,
        { policyNo, quoteNo: polMeta.GL_QUOTE_NO }
      );
      const policyRiders = riderRes.rows || [];

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
          EFFECTIVE_SA,
          MEMBER_PREMIUM,
          MEMBER_STATUS,
          EOI_FLAG,
          EOI_STATUS,
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
          :effectiveSa,
          :memberPremium,
          'ACTIVE',
          :eoiFlag,
          :eoiStatus,
          'Y',
          :appUser,
          SYSDATE
        ) RETURNING MEMBER_ID INTO :outMemberId
      `;

      const polMemCovSql = `
        INSERT INTO T_GL_POLICY_MEMBER_COVER (
          POL_MEM_COVER_ID,
          MASTER_POLICY_NO,
          MEMBER_ID,
          EMP_ID,
          COVER_CODE,
          COVER_NAME,
          COVER_TYPE,
          SA_PERCENT,
          COVER_SUM_ASSURED,
          RATE_PER_MILLE,
          GROSS_PREMIUM,
          DISCOUNT_AMOUNT,
          NET_PREMIUM,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_ON
        ) VALUES (
          SEQ_GL_P_MEM_COV_ID.NEXTVAL,
          :policyNo,
          :memberId,
          :empId,
          :coverCode,
          :coverName,
          :coverType,
          :saPercent,
          :coverSa,
          :ratePerMille,
          :grossPremium,
          :discountAmount,
          :netPremium,
          'Y',
          :appUser,
          SYSDATE
        )
      `;

      for (const m of members) {
        const empId = m.EMP_ID || `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
        const monthlySal = m.MONTHLY_SALARY || 0;
        const annualSal = m.ANNUAL_SALARY || (monthlySal > 0 ? monthlySal * 12 : 0);
        const sa = m.SUM_ASSURED || (annualSal > 0 ? annualSal * 3 : 50000);
        const age = m.AGE || 30;
        const isAboveFcl = sa > fcl;
        const eoiFlag = 'N';
        const effectiveSa = isAboveFcl ? fcl : sa;
        const eoiStatus = isAboveFcl ? 'PENDING' : 'NOT_REQUIRED';

        let memRate = baseRate;
        if (age > 45) memRate = baseRate * (1 + (age - 45) * 0.025);
        else if (age < 25) memRate = baseRate * 0.9;
        memRate = Math.round(memRate * 10000) / 10000;

        const grossBasic = Math.round((effectiveSa * memRate / 1000) * 100) / 100;
        const discAmt = Math.round((grossBasic * discPct / 100) * 100) / 100;
        const netBasic = Math.round((grossBasic - discAmt) * 100) / 100;

        const prem = m.MEMBER_PREMIUM !== undefined ? m.MEMBER_PREMIUM : grossBasic;

        const memExecRes = await connection.execute<{ outMemberId: number[] }>(
          memSql,
          {
            policyNo,
            empId,
            memberName: m.MEMBER_NAME,
            dob: m.DOB,
            age,
            gender: m.GENDER || 'M',
            category: m.CATEGORY || 'Staff',
            monthlySalary: monthlySal,
            annualSalary: annualSal,
            sumAssured: sa,
            effectiveSa,
            memberPremium: prem,
            eoiFlag,
            eoiStatus,
            appUser: user,
            outMemberId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
          },
          { autoCommit: false }
        );

        const insertedPolMemId = (memExecRes.outBinds as any)?.outMemberId?.[0];

        // Insert Basic Life cover row (rated on effectiveSa)
        await connection.execute(
          polMemCovSql,
          {
            policyNo,
            memberId: insertedPolMemId,
            empId,
            coverCode: 'BASIC_LIFE',
            coverName: 'Basic Group Term Life',
            coverType: 'BASIC',
            saPercent: 100,
            coverSa: effectiveSa,
            ratePerMille: memRate,
            grossPremium: grossBasic,
            discountAmount: discAmt,
            netPremium: netBasic,
            appUser: user
          },
          { autoCommit: false }
        );

        // Insert each attached Rider cover row (rated on effectiveSa)
        for (const r of policyRiders) {
          const saPct = Number(r.SA_PERCENT || 100);
          const rSa = Math.round(effectiveSa * saPct / 100);
          const rRate = Number(r.RIDER_RATE_PER_MILLE || 0.45);
          const rPrem = Math.round((rSa * rRate / 1000) * 100) / 100;

          await connection.execute(
            polMemCovSql,
            {
              policyNo,
              memberId: insertedPolMemId,
              empId,
              coverCode: r.RIDER_CODE,
              coverName: r.RIDER_NAME,
              coverType: 'RIDER',
              saPercent: saPct,
              coverSa: rSa,
              ratePerMille: rRate,
              grossPremium: rPrem,
              discountAmount: 0,
              netPremium: rPrem,
              appUser: user
            },
            { autoCommit: false }
          );
        }
      }

      // Sync T_GL_POLICY_RIDER totals from T_GL_POLICY_MEMBER_COVER
      await connection.execute(
        `UPDATE T_GL_POLICY_RIDER r
         SET TOTAL_RIDER_SA = NVL((SELECT SUM(c.COVER_SUM_ASSURED) FROM T_GL_POLICY_MEMBER_COVER c WHERE c.MASTER_POLICY_NO = r.MASTER_POLICY_NO AND c.COVER_CODE = r.RIDER_CODE AND c.IS_ACTIVE = 'Y'), r.TOTAL_RIDER_SA),
             RIDER_PREMIUM = NVL((SELECT SUM(c.NET_PREMIUM) FROM T_GL_POLICY_MEMBER_COVER c WHERE c.MASTER_POLICY_NO = r.MASTER_POLICY_NO AND c.COVER_CODE = r.RIDER_CODE AND c.IS_ACTIVE = 'Y'), r.RIDER_PREMIUM)
         WHERE r.MASTER_POLICY_NO = :policyNo`,
        { policyNo },
        { autoCommit: false }
      );

      // Update aggregate figures in T_GL_POLICY_MASTER
      const updateMasterSql = `
        UPDATE T_GL_POLICY_MASTER
        SET 
          TOTAL_ACTIVE_MEMBERS = (SELECT COUNT(*) FROM T_GL_POLICY_MEMBER WHERE MASTER_POLICY_NO = :policyNo AND IS_ACTIVE = 'Y'),
          TOTAL_INFORCE_SA = (SELECT NVL(SUM(SUM_ASSURED), 0) FROM T_GL_POLICY_MEMBER WHERE MASTER_POLICY_NO = :policyNo AND IS_ACTIVE = 'Y'),
          TOTAL_INFORCE_PREMIUM = (SELECT NVL(SUM(NET_PREMIUM), 0) FROM T_GL_POLICY_MEMBER_COVER WHERE MASTER_POLICY_NO = :policyNo AND IS_ACTIVE = 'Y'),
          MODIFIED_BY = :appUser,
          MODIFIED_ON = SYSDATE
        WHERE MASTER_POLICY_NO = :policyNo
      `;

      await connection.execute(
        updateMasterSql,
        { policyNo, appUser: user },
        { autoCommit: false }
      );

      await connection.commit();

      const detail = await this.findPolicyByNo(policyNo);
      return detail!;
    } catch (err) {
      if (connection) await connection.rollback();
      throw err;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Update EOI Flag (Y/N) for a Policy or Quote Member and recalculate cover-wise premiums
   * - If EOI_FLAG = 'Y': uses Full SUM_ASSURED for Basic Life and all Rider covers
   * - If EOI_FLAG = 'N' and SUM_ASSURED > FREE_COVER_LIMIT: caps EFFECTIVE_SA at FREE_COVER_LIMIT
   */
  async updateMemberEoi(
    refType: 'QUOTE' | 'POLICY',
    refNo: string,
    memberId: number,
    eoiFlag: 'Y' | 'N',
    eoiRemarks?: string,
    user: string = 'UNDERWRITER'
  ): Promise<GLPolicyDetail | GLQuoteDetail> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      if (refType === 'POLICY') {
        const metaRes = await connection.execute<{
          FREE_COVER_LIMIT: number;
          GL_QUOTE_NO: string;
          BASE_RATE_PER_MILLE: number;
          EXPERIENCE_DISCOUNT_PCT: number;
        }>(
          `SELECT p.FREE_COVER_LIMIT, p.GL_QUOTE_NO, NVL(q.BASE_RATE_PER_MILLE, 2.5) AS BASE_RATE_PER_MILLE, NVL(q.EXPERIENCE_DISCOUNT_PCT, 0) AS EXPERIENCE_DISCOUNT_PCT
           FROM T_GL_POLICY_MASTER p
           LEFT JOIN T_GL_QUOTE_HEADER q ON q.GL_QUOTE_NO = p.GL_QUOTE_NO
           WHERE p.MASTER_POLICY_NO = :refNo`,
          { refNo }
        );
        if (!metaRes.rows || metaRes.rows.length === 0) {
          throw new Error(`Master Policy ${refNo} not found`);
        }
        const meta = metaRes.rows[0];
        const fcl = Number(meta.FREE_COVER_LIMIT || 250000);
        const baseRate = Number(meta.BASE_RATE_PER_MILLE || 2.5);
        const discPct = Number(meta.EXPERIENCE_DISCOUNT_PCT || 0);

        const memRes = await connection.execute<{
          MEMBER_ID: number;
          EMP_ID: string;
          AGE: number;
          SUM_ASSURED: number;
        }>(
          `SELECT MEMBER_ID, EMP_ID, AGE, SUM_ASSURED FROM T_GL_POLICY_MEMBER WHERE MASTER_POLICY_NO = :refNo AND MEMBER_ID = :memberId`,
          { refNo, memberId }
        );
        if (!memRes.rows || memRes.rows.length === 0) {
          throw new Error(`Member ${memberId} not found on Policy ${refNo}`);
        }
        const mem = memRes.rows[0];
        const fullSa = Number(mem.SUM_ASSURED || 0);
        const isAboveFcl = fullSa > fcl;
        const effectiveSa = isAboveFcl && eoiFlag !== 'Y' ? fcl : fullSa;
        const eoiStatus = !isAboveFcl ? 'NOT_REQUIRED' : eoiFlag === 'Y' ? 'APPROVED' : 'PENDING';

        let memRate = baseRate;
        if (mem.AGE > 45) memRate = baseRate * (1 + (mem.AGE - 45) * 0.025);
        else if (mem.AGE < 25) memRate = baseRate * 0.9;
        memRate = Math.round(memRate * 10000) / 10000;

        const grossBasic = Math.round((effectiveSa * memRate / 1000) * 100) / 100;
        const discAmt = Math.round((grossBasic * discPct / 100) * 100) / 100;
        const netBasic = Math.round((grossBasic - discAmt) * 100) / 100;

        // 1. Update member EOI fields & effective SA
        await connection.execute(
          `UPDATE T_GL_POLICY_MEMBER
           SET EOI_FLAG = :eoiFlag,
               EOI_STATUS = :eoiStatus,
               EFFECTIVE_SA = :effectiveSa,
               MEMBER_PREMIUM = :grossBasic,
               EOI_REMARKS = :eoiRemarks
           WHERE MASTER_POLICY_NO = :refNo AND MEMBER_ID = :memberId`,
          { eoiFlag, eoiStatus, effectiveSa, grossBasic, eoiRemarks: eoiRemarks || null, refNo, memberId },
          { autoCommit: false }
        );

        // 2. Recalculate Basic Life cover in T_GL_POLICY_MEMBER_COVER
        await connection.execute(
          `UPDATE T_GL_POLICY_MEMBER_COVER
           SET COVER_SUM_ASSURED = :effectiveSa,
               RATE_PER_MILLE = :memRate,
               GROSS_PREMIUM = :grossBasic,
               DISCOUNT_AMOUNT = :discAmt,
               NET_PREMIUM = :netBasic
           WHERE MASTER_POLICY_NO = :refNo AND MEMBER_ID = :memberId AND COVER_TYPE = 'BASIC'`,
          { effectiveSa, memRate, grossBasic, discAmt, netBasic, refNo, memberId },
          { autoCommit: false }
        );

        // 3. Recalculate all Rider covers for this member in T_GL_POLICY_MEMBER_COVER
        const riderCovs = await connection.execute<{
          POL_MEM_COVER_ID: number;
          SA_PERCENT: number;
          RATE_PER_MILLE: number;
        }>(
          `SELECT POL_MEM_COVER_ID, SA_PERCENT, RATE_PER_MILLE FROM T_GL_POLICY_MEMBER_COVER
           WHERE MASTER_POLICY_NO = :refNo AND MEMBER_ID = :memberId AND COVER_TYPE = 'RIDER'`,
          { refNo, memberId }
        );
        for (const rc of riderCovs.rows || []) {
          const rSa = Math.round(effectiveSa * (Number(rc.SA_PERCENT || 100) / 100));
          const rPrem = Math.round((rSa * Number(rc.RATE_PER_MILLE || 0.45) / 1000) * 100) / 100;
          await connection.execute(
            `UPDATE T_GL_POLICY_MEMBER_COVER
             SET COVER_SUM_ASSURED = :rSa, GROSS_PREMIUM = :rPrem, NET_PREMIUM = :rPrem
             WHERE POL_MEM_COVER_ID = :covId`,
            { rSa, rPrem, covId: rc.POL_MEM_COVER_ID },
            { autoCommit: false }
          );
        }

        // 4. Sync Policy Riders and Policy Master totals
        await connection.execute(
          `UPDATE T_GL_POLICY_RIDER r
           SET TOTAL_RIDER_SA = NVL((SELECT SUM(c.COVER_SUM_ASSURED) FROM T_GL_POLICY_MEMBER_COVER c WHERE c.MASTER_POLICY_NO = r.MASTER_POLICY_NO AND c.COVER_CODE = r.RIDER_CODE AND c.IS_ACTIVE = 'Y'), 0),
               RIDER_PREMIUM = NVL((SELECT SUM(c.NET_PREMIUM) FROM T_GL_POLICY_MEMBER_COVER c WHERE c.MASTER_POLICY_NO = r.MASTER_POLICY_NO AND c.COVER_CODE = r.RIDER_CODE AND c.IS_ACTIVE = 'Y'), 0)
           WHERE r.MASTER_POLICY_NO = :refNo`,
          { refNo },
          { autoCommit: false }
        );

        await connection.execute(
          `UPDATE T_GL_POLICY_MASTER
           SET TOTAL_INFORCE_SA = (SELECT NVL(SUM(NVL(EFFECTIVE_SA, SUM_ASSURED)), 0) FROM T_GL_POLICY_MEMBER WHERE MASTER_POLICY_NO = :refNo AND IS_ACTIVE = 'Y'),
               TOTAL_INFORCE_PREMIUM = (SELECT NVL(SUM(NET_PREMIUM), 0) FROM T_GL_POLICY_MEMBER_COVER WHERE MASTER_POLICY_NO = :refNo AND IS_ACTIVE = 'Y'),
               MODIFIED_BY = :appUser,
               MODIFIED_ON = SYSDATE
           WHERE MASTER_POLICY_NO = :refNo`,
          { refNo, appUser: user },
          { autoCommit: false }
        );

        await connection.commit();
        return (await this.findPolicyByNo(refNo))!;
      } else {
        // QUOTE EOI UPDATE
        const metaRes = await connection.execute<{
          FREE_COVER_LIMIT: number;
          BASE_RATE_PER_MILLE: number;
          EXPERIENCE_DISCOUNT_PCT: number;
          MODAL_FACTOR: number;
        }>(
          `SELECT FREE_COVER_LIMIT, BASE_RATE_PER_MILLE, EXPERIENCE_DISCOUNT_PCT, MODAL_FACTOR
           FROM T_GL_QUOTE_HEADER WHERE GL_QUOTE_NO = :refNo`,
          { refNo }
        );
        if (!metaRes.rows || metaRes.rows.length === 0) {
          throw new Error(`Quote ${refNo} not found`);
        }
        const meta = metaRes.rows[0];
        const fcl = Number(meta.FREE_COVER_LIMIT || 250000);
        const baseRate = Number(meta.BASE_RATE_PER_MILLE || 2.5);
        const discPct = Number(meta.EXPERIENCE_DISCOUNT_PCT || 0);
        const modalFactor = Number(meta.MODAL_FACTOR || 1.0);

        const memRes = await connection.execute<{
          MEMBER_ID: number;
          EMP_ID: string;
          AGE: number;
          SUM_ASSURED: number;
        }>(
          `SELECT MEMBER_ID, EMP_ID, AGE, SUM_ASSURED FROM T_GL_QUOTE_MEMBER WHERE GL_QUOTE_NO = :refNo AND MEMBER_ID = :memberId`,
          { refNo, memberId }
        );
        if (!memRes.rows || memRes.rows.length === 0) {
          throw new Error(`Member ${memberId} not found on Quote ${refNo}`);
        }
        const mem = memRes.rows[0];
        const fullSa = Number(mem.SUM_ASSURED || 0);
        const isAboveFcl = fullSa > fcl;
        const effectiveSa = isAboveFcl && eoiFlag !== 'Y' ? fcl : fullSa;
        const eoiStatus = !isAboveFcl ? 'NOT_REQUIRED' : eoiFlag === 'Y' ? 'APPROVED' : 'PENDING';
        const uwFlag = !isAboveFcl ? 'UNDER_FCL' : eoiFlag === 'Y' ? 'EOI_APPROVED' : 'EVIDENCE_REQUIRED';

        let memRate = baseRate;
        if (mem.AGE > 45) memRate = baseRate * (1 + (mem.AGE - 45) * 0.025);
        else if (mem.AGE < 25) memRate = baseRate * 0.9;
        memRate = Math.round(memRate * 10000) / 10000;

        const grossBasic = Math.round((effectiveSa * memRate / 1000) * 100) / 100;
        const discAmt = Math.round((grossBasic * discPct / 100) * 100) / 100;
        const netBasic = Math.round((grossBasic - discAmt) * 100) / 100;

        await connection.execute(
          `UPDATE T_GL_QUOTE_MEMBER
           SET EOI_FLAG = :eoiFlag,
               EOI_STATUS = :eoiStatus,
               UNDERWRITING_FLAG = :uwFlag,
               EFFECTIVE_SA = :effectiveSa,
               PREMIUM_AMOUNT = :grossBasic,
               EOI_REMARKS = :eoiRemarks
           WHERE GL_QUOTE_NO = :refNo AND MEMBER_ID = :memberId`,
          { eoiFlag, eoiStatus, uwFlag, effectiveSa, grossBasic, eoiRemarks: eoiRemarks || null, refNo, memberId },
          { autoCommit: false }
        );

        await connection.execute(
          `UPDATE T_GL_QUOTE_MEMBER_COVER
           SET COVER_SUM_ASSURED = :effectiveSa,
               RATE_PER_MILLE = :memRate,
               GROSS_PREMIUM = :grossBasic,
               DISCOUNT_AMOUNT = :discAmt,
               NET_PREMIUM = :netBasic
           WHERE GL_QUOTE_NO = :refNo AND MEMBER_ID = :memberId AND COVER_TYPE = 'BASIC'`,
          { effectiveSa, memRate, grossBasic, discAmt, netBasic, refNo, memberId },
          { autoCommit: false }
        );

        const riderCovs = await connection.execute<{
          MEM_COVER_ID: number;
          SA_PERCENT: number;
          RATE_PER_MILLE: number;
        }>(
          `SELECT MEM_COVER_ID, SA_PERCENT, RATE_PER_MILLE FROM T_GL_QUOTE_MEMBER_COVER
           WHERE GL_QUOTE_NO = :refNo AND MEMBER_ID = :memberId AND COVER_TYPE = 'RIDER'`,
          { refNo, memberId }
        );
        for (const rc of riderCovs.rows || []) {
          const rSa = Math.round(effectiveSa * (Number(rc.SA_PERCENT || 100) / 100));
          const rPrem = Math.round((rSa * Number(rc.RATE_PER_MILLE || 0.45) / 1000) * 100) / 100;
          await connection.execute(
            `UPDATE T_GL_QUOTE_MEMBER_COVER
             SET COVER_SUM_ASSURED = :rSa, GROSS_PREMIUM = :rPrem, NET_PREMIUM = :rPrem
             WHERE MEM_COVER_ID = :covId`,
            { rSa, rPrem, covId: rc.MEM_COVER_ID },
            { autoCommit: false }
          );
        }

        // Sync Quote Riders and Header totals
        await connection.execute(
          `UPDATE T_GL_QUOTE_RIDER r
           SET TOTAL_RIDER_SA = NVL((SELECT SUM(c.COVER_SUM_ASSURED) FROM T_GL_QUOTE_MEMBER_COVER c WHERE c.GL_QUOTE_NO = r.GL_QUOTE_NO AND c.COVER_CODE = r.RIDER_CODE AND c.IS_ACTIVE = 'Y'), 0),
               RIDER_PREMIUM = NVL((SELECT SUM(c.NET_PREMIUM) FROM T_GL_QUOTE_MEMBER_COVER c WHERE c.GL_QUOTE_NO = r.GL_QUOTE_NO AND c.COVER_CODE = r.RIDER_CODE AND c.IS_ACTIVE = 'Y'), 0)
           WHERE r.GL_QUOTE_NO = :refNo`,
          { refNo },
          { autoCommit: false }
        );

        await connection.execute(
          `UPDATE T_GL_QUOTE_HEADER
           SET TOTAL_SUM_ASSURED = (SELECT NVL(SUM(NVL(EFFECTIVE_SA, SUM_ASSURED)), 0) FROM T_GL_QUOTE_MEMBER WHERE GL_QUOTE_NO = :refNo AND IS_ACTIVE = 'Y'),
               TOTAL_BASIC_PREMIUM = (SELECT NVL(SUM(NET_PREMIUM), 0) FROM T_GL_QUOTE_MEMBER_COVER WHERE GL_QUOTE_NO = :refNo AND COVER_TYPE = 'BASIC' AND IS_ACTIVE = 'Y'),
               TOTAL_RIDER_PREMIUM = (SELECT NVL(SUM(NET_PREMIUM), 0) FROM T_GL_QUOTE_MEMBER_COVER WHERE GL_QUOTE_NO = :refNo AND COVER_TYPE = 'RIDER' AND IS_ACTIVE = 'Y'),
               TOTAL_ANNUAL_PREMIUM = (SELECT NVL(SUM(NET_PREMIUM), 0) FROM T_GL_QUOTE_MEMBER_COVER WHERE GL_QUOTE_NO = :refNo AND IS_ACTIVE = 'Y'),
               INSTALLMENT_PREMIUM = ROUND((SELECT NVL(SUM(NET_PREMIUM), 0) FROM T_GL_QUOTE_MEMBER_COVER WHERE GL_QUOTE_NO = :refNo AND IS_ACTIVE = 'Y') * :modalFactor, 2),
               MODIFIED_BY = :appUser,
               MODIFIED_ON = SYSDATE
           WHERE GL_QUOTE_NO = :refNo`,
          { refNo, modalFactor, appUser: user },
          { autoCommit: false }
        );

        await connection.commit();
        return (await this.findQuoteByNo(refNo))!;
      }
    } catch (err) {
      if (connection) await connection.rollback();
      throw err;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Read configured EOI Document storage directory path from STBL_SYS_PARAM (SYS_PARAM_DESC)
   */
  async getEoiStoragePath(): Promise<string | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const res = await connection.execute<{ SYS_PARAM_DESC: string | null }>(
        `SELECT SYS_PARAM_DESC
         FROM STBL_SYS_PARAM
         WHERE SYS_PARAM_CODE = 'GL_EOI_DOC_PATH'
           AND SYS_SUB_PARAM = 'EOI_UPLOAD'`
      );
      const val = res.rows?.[0]?.SYS_PARAM_DESC;
      return val && val.trim() ? val.trim() : null;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Add EOI Document Metadata record (including actual FILE_PATH)
   */
  async addEoiDocument(doc: {
    refType: 'QUOTE' | 'POLICY';
    refNo: string;
    memberId?: number | null;
    empId: string;
    docType: string;
    fileName: string;
    storedFileName: string;
    filePath: string;
    mimeType?: string;
    fileSize: number;
    remarks?: string;
    user: string;
  }): Promise<GLEoiDocumentRecord> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const res = await connection.execute<{ outId: number[] }>(
        `INSERT INTO T_GL_EOI_DOCUMENT (
          EOI_DOC_ID, REF_TYPE, REF_NO, MEMBER_ID, EMP_ID, DOC_TYPE,
          FILE_NAME, STORED_FILE_NAME, FILE_PATH, MIME_TYPE, FILE_SIZE, REMARKS,
          IS_ACTIVE, UPLOADED_BY, UPLOADED_ON
        ) VALUES (
          SEQ_GL_EOI_DOC_ID.NEXTVAL, :refType, :refNo, :memberId, :empId, :docType,
          :fileName, :storedFileName, :filePath, :mimeType, :fileSize, :remarks,
          'Y', :appUser, SYSDATE
        ) RETURNING EOI_DOC_ID INTO :outId`,
        {
          refType: doc.refType,
          refNo: doc.refNo,
          memberId: doc.memberId || null,
          empId: doc.empId,
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
      const saved = await this.getEoiDocumentById(insertedId);
      return saved!;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * List EOI Documents for a Quote/Policy (optionally filtered by empId)
   */
  async getEoiDocuments(refType: 'QUOTE' | 'POLICY', refNo: string, empId?: string): Promise<GLEoiDocumentRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      let sql = `
        SELECT
          EOI_DOC_ID, REF_TYPE, REF_NO, MEMBER_ID, EMP_ID, DOC_TYPE,
          FILE_NAME, STORED_FILE_NAME, FILE_PATH, MIME_TYPE, FILE_SIZE, REMARKS,
          IS_ACTIVE, UPLOADED_BY, TO_CHAR(UPLOADED_ON, 'YYYY-MM-DD HH24:MI:SS') AS UPLOADED_ON
        FROM T_GL_EOI_DOCUMENT
        WHERE REF_TYPE = :refType AND REF_NO = :refNo AND IS_ACTIVE = 'Y'
      `;
      const binds: any = { refType, refNo };
      if (empId) {
        sql += ` AND EMP_ID = :empId`;
        binds.empId = empId;
      }
      sql += ` ORDER BY EOI_DOC_ID DESC`;
      const res = await connection.execute<GLEoiDocumentRecord>(sql, binds);
      return res.rows || [];
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Get single EOI Document by ID
   */
  async getEoiDocumentById(docId: number): Promise<GLEoiDocumentRecord | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const res = await connection.execute<GLEoiDocumentRecord>(
        `SELECT
          EOI_DOC_ID, REF_TYPE, REF_NO, MEMBER_ID, EMP_ID, DOC_TYPE,
          FILE_NAME, STORED_FILE_NAME, FILE_PATH, MIME_TYPE, FILE_SIZE, REMARKS,
          IS_ACTIVE, UPLOADED_BY, TO_CHAR(UPLOADED_ON, 'YYYY-MM-DD HH24:MI:SS') AS UPLOADED_ON
         FROM T_GL_EOI_DOCUMENT
         WHERE EOI_DOC_ID = :docId AND IS_ACTIVE = 'Y'`,
        { docId }
      );
      return res.rows?.[0] || null;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Soft delete an EOI Document
   */
  async deleteEoiDocument(docId: number): Promise<void> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      await connection.execute(
        `UPDATE T_GL_EOI_DOCUMENT SET IS_ACTIVE = 'N' WHERE EOI_DOC_ID = :docId`,
        { docId },
        { autoCommit: true }
      );
    } finally {
      if (connection) await releaseConnection(connection);
    }
  }
};
