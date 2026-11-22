import oracledb from 'oracledb';
import { getConnection, releaseConnection } from '../config/database';
import {
  PremiumReceiptRecord,
  GLJournalEntryRecord,
  PolicySurrenderRecord,
  PolicyMaturityRecord,
  PolicyLoanRecord,
  PolicyLoanRepaymentRecord,
  RecordFPRPayload,
  RecordRPRPayload,
  AutoLapseScanResult,
  ReinstatementCalculationResult,
  SurrenderValuationResult,
  LoanEligibilityResult,
  TxnSource
} from '../types/policyServicing';

export const policyServicingRepository = {
  /**
   * Helper: Generate next sequence-based Number
   */
  async generateNumber(
    connection: oracledb.Connection,
    seqName: string,
    prefix: string
  ): Promise<string> {
    const res = await connection.execute<{ NEXTVAL: number }>(
      `SELECT ${seqName}.NEXTVAL AS NEXTVAL FROM DUAL`
    );
    const nextVal = res.rows?.[0]?.NEXTVAL || 10001;
    const d = new Date();
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `${prefix}-${ym}-${String(nextVal).padStart(5, '0')}`;
  },

  /**
   * Helper: Post balanced General Ledger Journal Entries
   */
  async postGLJournalEntries(
    connection: oracledb.Connection,
    voucherNo: string,
    txnSource: TxnSource,
    sourceRefNo: string,
    entries: Array<{ code: string; name: string; drCr: 'D' | 'C'; amount: number; narration?: string }>,
    appUser: string = 'SYSTEM'
  ): Promise<void> {
    const totalDr = entries
      .filter((e) => e.drCr === 'D')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalCr = entries
      .filter((e) => e.drCr === 'C')
      .reduce((sum, e) => sum + e.amount, 0);

    // Verify debit/credit balance (within 2 decimal cents)
    if (Math.abs(totalDr - totalCr) > 0.05) {
      throw new Error(
        `Accounting Journal Imbalance for Voucher ${voucherNo}: Total Debits (${totalDr.toFixed(
          2
        )}) != Total Credits (${totalCr.toFixed(2)})`
      );
    }

    const insertSql = `
      INSERT INTO T_GL_JOURNAL_ENTRY (
        ENTRY_ID,
        JOURNAL_VOUCHER_NO,
        VOUCHER_DATE,
        TXN_SOURCE,
        SOURCE_REF_NO,
        GL_ACCOUNT_CODE,
        GL_ACCOUNT_NAME,
        DR_CR_FLAG,
        AMOUNT,
        NARRATION,
        CREATED_BY,
        CREATED_ON
      ) VALUES (
        SEQ_VOUCHER_ID.NEXTVAL,
        :voucherNo,
        SYSDATE,
        :txnSource,
        :sourceRefNo,
        :glCode,
        :glName,
        :drCr,
        :amount,
        :narration,
        :appUser,
        SYSDATE
      )
    `;

    for (const e of entries) {
      if (e.amount > 0) {
        await connection.execute(
          insertSql,
          {
            voucherNo,
            txnSource,
            sourceRefNo,
            glCode: e.code,
            glName: e.name,
            drCr: e.drCr,
            amount: Math.round(e.amount * 100) / 100,
            narration: e.narration || `${txnSource} on ${sourceRefNo}`,
            appUser
          },
          { autoCommit: false }
        );
      }
    }
  },

  // ===========================================================================
  // 1. FIRST PREMIUM RECEIPT (FPR) & RENEWAL PREMIUM RECEIPT (RPR)
  // ===========================================================================

  /**
   * Record First Premium Receipt (FPR) for a Proposal
   * Unlocks Proposal Approval and Policy Conversion!
   */
  async recordFirstPremium(
    payload: RecordFPRPayload,
    appUser: string = 'ADMIN'
  ): Promise<{ receipt: PremiumReceiptRecord; voucherNo: string }> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const propNo = payload.propNo.trim();

      // 1. Fetch Proposal
      const propSql = `
        SELECT 
          p.PROP_NO,
          p.PROP_STATUS,
          p.FPR_STATUS,
          s.PPS_INSTALLMENT_PREM,
          s.PPS_TOTAL_PAYABLE,
          a.PAS_NAME
        FROM T_PROPOSAL_INFO p
        LEFT JOIN T_PROPOSAL_PREMIUM_SUMMARY s ON s.PROP_NO = p.PROP_NO
        LEFT JOIN T_PROPOSAL_ASSURED a ON a.PROP_NO = p.PROP_NO
        WHERE p.PROP_NO = :propNo
      `;
      const propRes = await connection.execute<any>(propSql, { propNo });
      if (!propRes.rows || propRes.rows.length === 0) {
        throw new Error(`Proposal '${propNo}' not found.`);
      }

      const prop = propRes.rows[0];
      if (prop.FPR_STATUS === 'COLLECTED') {
        throw new Error(`First Premium Receipt (FPR) has already been collected for Proposal '${propNo}'.`);
      }

      const premAmount = Number(prop.PPS_INSTALLMENT_PREM || prop.PPS_TOTAL_PAYABLE || 500);
      const totalPaid = premAmount;

      const receiptNo = await this.generateNumber(connection, 'SEQ_RECEIPT_ID', 'RCP');
      const voucherNo = await this.generateNumber(connection, 'SEQ_VOUCHER_ID', 'JV');

      // 2. Insert Premium Receipt
      const recSql = `
        INSERT INTO T_POLICY_PREMIUM_RECEIPT (
          RECEIPT_ID,
          RECEIPT_NO,
          RECEIPT_TYPE,
          PROP_NO,
          RECEIPT_DATE,
          PREMIUM_AMOUNT,
          TOTAL_PAID,
          PAY_MODE,
          TRANSACTION_REF,
          COLLECTED_BY,
          GL_VOUCHER_NO,
          GL_POSTED_YN,
          STATUS,
          REMARKS,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_ON
        ) VALUES (
          SEQ_RECEIPT_ID.NEXTVAL,
          :receiptNo,
          'FPR',
          :propNo,
          SYSDATE,
          :premAmount,
          :totalPaid,
          :payMode,
          :txnRef,
          :appUser,
          :voucherNo,
          'Y',
          'ACTIVE',
          :remarks,
          'Y',
          :appUser,
          SYSDATE
        )
      `;

      await connection.execute(
        recSql,
        {
          receiptNo,
          propNo,
          premAmount,
          totalPaid,
          payMode: payload.payMode || 'CASH',
          txnRef: payload.transactionRef || null,
          voucherNo,
          remarks: payload.remarks || 'First Premium Collection on Proposal Submission',
          appUser
        },
        { autoCommit: false }
      );

      // 3. Post General Ledger Accounting Entries
      // DR: Bank / Cash Clearing
      // CR: Life Insurance Premium Income (FPR)
      await this.postGLJournalEntries(
        connection,
        voucherNo,
        'FPR',
        receiptNo,
        [
          {
            code: '1101-BANK-CLEARING',
            name: 'Cash / Bank Collections Clearing Account',
            drCr: 'D',
            amount: totalPaid,
            narration: `First Premium received for Proposal ${propNo} (${prop.PAS_NAME || 'Assured'})`
          },
          {
            code: '4101-PREM-INCOME-IL',
            name: 'Individual Life Premium Income - First Year',
            drCr: 'C',
            amount: totalPaid,
            narration: `FPR Recognition on Proposal ${propNo}`
          }
        ],
        appUser
      );

      // 4. Update Proposal with FPR details
      const updatePropSql = `
        UPDATE T_PROPOSAL_INFO
        SET 
          FPR_STATUS = 'COLLECTED',
          FPR_RECEIPT_NO = :receiptNo,
          FPR_AMOUNT = :premAmount,
          FPR_DATE = SYSDATE,
          MODIFIED_BY = :appUser,
          MODIFIED_ON = SYSDATE
        WHERE PROP_NO = :propNo
      `;
      await connection.execute(
        updatePropSql,
        {
          receiptNo,
          premAmount,
          appUser,
          propNo
        },
        { autoCommit: false }
      );

      await connection.commit();

      const receiptRes = await this.getReceiptByNo(receiptNo);
      return { receipt: receiptRes!, voucherNo };
    } catch (err) {
      if (connection) await connection.rollback();
      throw err;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Record Renewal Premium Receipt (RPR) for an In-Force Policy
   */
  async recordRenewalPremium(
    payload: RecordRPRPayload,
    appUser: string = 'ADMIN'
  ): Promise<{ receipt: PremiumReceiptRecord; voucherNo: string }> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const polNo = payload.polNo.trim();

      // 1. Fetch Policy
      const polSql = `
        SELECT 
          p.POL_NO,
          p.POL_STATUS,
          p.POL_PAY_FREQ,
          p.POL_INSTALLMENT_PREM,
          p.POL_TOTAL_PREM_PAID,
          TO_CHAR(p.POL_NEXT_DUE_DATE, 'YYYY-MM-DD') AS POL_NEXT_DUE_DATE,
          s.PPS_INSTALLMENT_PREM,
          a.PAS_NAME
        FROM T_POLICY_INFO p
        LEFT JOIN T_POLICY_PREMIUM_SUMMARY s ON s.POL_NO = p.POL_NO
        LEFT JOIN T_POLICY_ASSURED a ON a.POL_NO = p.POL_NO
        WHERE p.POL_NO = :polNo
      `;
      const polRes = await connection.execute<any>(polSql, { polNo });
      if (!polRes.rows || polRes.rows.length === 0) {
        throw new Error(`Policy '${polNo}' not found.`);
      }

      const pol = polRes.rows[0];
      const premAmount = Number(pol.POL_INSTALLMENT_PREM || pol.PPS_INSTALLMENT_PREM || 300);
      const totalPaid = premAmount;

      const receiptNo = await this.generateNumber(connection, 'SEQ_RECEIPT_ID', 'RCP');
      const voucherNo = await this.generateNumber(connection, 'SEQ_VOUCHER_ID', 'JV');

      // 2. Insert Premium Receipt
      const recSql = `
        INSERT INTO T_POLICY_PREMIUM_RECEIPT (
          RECEIPT_ID,
          RECEIPT_NO,
          RECEIPT_TYPE,
          POL_NO,
          RECEIPT_DATE,
          DUE_DATE,
          PREMIUM_AMOUNT,
          TOTAL_PAID,
          PAY_MODE,
          TRANSACTION_REF,
          COLLECTED_BY,
          GL_VOUCHER_NO,
          GL_POSTED_YN,
          STATUS,
          REMARKS,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_ON
        ) VALUES (
          SEQ_RECEIPT_ID.NEXTVAL,
          :receiptNo,
          'RPR',
          :polNo,
          SYSDATE,
          TO_DATE(:dueDate, 'YYYY-MM-DD'),
          :premAmount,
          :totalPaid,
          :payMode,
          :txnRef,
          :appUser,
          :voucherNo,
          'Y',
          'ACTIVE',
          :remarks,
          'Y',
          :appUser,
          SYSDATE
        )
      `;

      await connection.execute(
        recSql,
        {
          receiptNo,
          polNo,
          dueDate: pol.POL_NEXT_DUE_DATE || new Date().toISOString().slice(0, 10),
          premAmount,
          totalPaid,
          payMode: payload.payMode || 'CASH',
          txnRef: payload.transactionRef || null,
          voucherNo,
          remarks: payload.remarks || 'Renewal Premium Collection',
          appUser
        },
        { autoCommit: false }
      );

      // 3. Post General Ledger Accounting Entries
      // DR: Bank / Cash Clearing
      // CR: Renewal Premium Income
      await this.postGLJournalEntries(
        connection,
        voucherNo,
        'RPR',
        receiptNo,
        [
          {
            code: '1101-BANK-CLEARING',
            name: 'Cash / Bank Collections Clearing Account',
            drCr: 'D',
            amount: totalPaid,
            narration: `Renewal Premium received for Policy ${polNo} (${pol.PAS_NAME || 'Assured'})`
          },
          {
            code: '4102-PREM-RENEWAL-IL',
            name: 'Individual Life Premium Income - Renewal',
            drCr: 'C',
            amount: totalPaid,
            narration: `Renewal Premium recognition for Policy ${polNo}`
          }
        ],
        appUser
      );

      // 4. Advance Next Due Date and Total Premiums Paid on Policy
      const monthsToAdd =
        pol.POL_PAY_FREQ === 'MONTHLY'
          ? 1
          : pol.POL_PAY_FREQ === 'QUARTERLY'
          ? 3
          : pol.POL_PAY_FREQ === 'SEMI_ANNUAL'
          ? 6
          : 12;

      const updatePolSql = `
        UPDATE T_POLICY_INFO
        SET 
          POL_NEXT_DUE_DATE = ADD_MONTHS(NVL(POL_NEXT_DUE_DATE, SYSDATE), :monthsToAdd),
          POL_PAID_TO_DATE = ADD_MONTHS(NVL(POL_PAID_TO_DATE, SYSDATE), :monthsToAdd),
          POL_LAST_PREM_DATE = SYSDATE,
          POL_TOTAL_PREM_PAID = NVL(POL_TOTAL_PREM_PAID, 0) + :premAmount,
          POL_STATUS = CASE WHEN POL_STATUS = 'LAPSED' THEN 'IN_FORCE' ELSE POL_STATUS END,
          MODIFIED_BY = :appUser,
          MODIFIED_ON = SYSDATE
        WHERE POL_NO = :polNo
      `;

      await connection.execute(
        updatePolSql,
        {
          monthsToAdd,
          premAmount,
          appUser,
          polNo
        },
        { autoCommit: false }
      );

      await connection.commit();

      const receiptRes = await this.getReceiptByNo(receiptNo);
      return { receipt: receiptRes!, voucherNo };
    } catch (err) {
      if (connection) await connection.rollback();
      throw err;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Fetch single receipt
   */
  async getReceiptByNo(receiptNo: string): Promise<PremiumReceiptRecord | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const sql = `
        SELECT 
          r.RECEIPT_ID,
          r.RECEIPT_NO,
          r.RECEIPT_TYPE,
          r.PROP_NO,
          r.POL_NO,
          TO_CHAR(r.RECEIPT_DATE, 'YYYY-MM-DD HH24:MI:SS') AS RECEIPT_DATE,
          TO_CHAR(r.DUE_DATE, 'YYYY-MM-DD') AS DUE_DATE,
          r.PREMIUM_AMOUNT,
          r.TAX_AMOUNT,
          r.INTEREST_AMOUNT,
          r.TOTAL_PAID,
          r.PAY_MODE,
          r.TRANSACTION_REF,
          r.COLLECTED_BY,
          r.GL_VOUCHER_NO,
          r.GL_POSTED_YN,
          r.STATUS,
          r.REMARKS,
          r.IS_ACTIVE,
          r.CREATED_BY,
          TO_CHAR(r.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
          NVL(pa.PAS_NAME, prass.PAS_NAME) AS CUSTOMER_NAME,
          NVL(pr.PROD_NAME, pr2.PROD_NAME) AS PROD_NAME
        FROM T_POLICY_PREMIUM_RECEIPT r
        LEFT JOIN T_POLICY_INFO pol ON pol.POL_NO = r.POL_NO
        LEFT JOIN T_POLICY_ASSURED pa ON pa.POL_NO = pol.POL_NO
        LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = pol.POL_PROD_CODE
        LEFT JOIN T_PROPOSAL_INFO prop ON prop.PROP_NO = r.PROP_NO
        LEFT JOIN T_PROPOSAL_ASSURED prass ON prass.PROP_NO = prop.PROP_NO
        LEFT JOIN MTBL_PRODUCT pr2 ON pr2.PROD_CODE = prop.PROP_PROD_CODE
        WHERE r.RECEIPT_NO = :receiptNo
      `;
      const res = await connection.execute<PremiumReceiptRecord>(sql, { receiptNo });
      return res.rows?.[0] || null;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * List all receipts
   */
  async getAllReceipts(search?: string, polNo?: string, propNo?: string): Promise<PremiumReceiptRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      let sql = `
        SELECT 
          r.RECEIPT_ID,
          r.RECEIPT_NO,
          r.RECEIPT_TYPE,
          r.PROP_NO,
          r.POL_NO,
          TO_CHAR(r.RECEIPT_DATE, 'YYYY-MM-DD HH24:MI:SS') AS RECEIPT_DATE,
          TO_CHAR(r.DUE_DATE, 'YYYY-MM-DD') AS DUE_DATE,
          r.PREMIUM_AMOUNT,
          r.TAX_AMOUNT,
          r.INTEREST_AMOUNT,
          r.TOTAL_PAID,
          r.PAY_MODE,
          r.TRANSACTION_REF,
          r.COLLECTED_BY,
          r.GL_VOUCHER_NO,
          r.GL_POSTED_YN,
          r.STATUS,
          r.REMARKS,
          r.IS_ACTIVE,
          r.CREATED_BY,
          TO_CHAR(r.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
          NVL(pa.PAS_NAME, prass.PAS_NAME) AS CUSTOMER_NAME,
          NVL(pr.PROD_NAME, pr2.PROD_NAME) AS PROD_NAME
        FROM T_POLICY_PREMIUM_RECEIPT r
        LEFT JOIN T_POLICY_INFO pol ON pol.POL_NO = r.POL_NO
        LEFT JOIN T_POLICY_ASSURED pa ON pa.POL_NO = pol.POL_NO
        LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = pol.POL_PROD_CODE
        LEFT JOIN T_PROPOSAL_INFO prop ON prop.PROP_NO = r.PROP_NO
        LEFT JOIN T_PROPOSAL_ASSURED prass ON prass.PROP_NO = prop.PROP_NO
        LEFT JOIN MTBL_PRODUCT pr2 ON pr2.PROD_CODE = prop.PROP_PROD_CODE
        WHERE r.IS_ACTIVE = 'Y'
      `;
      const binds: any = {};
      if (polNo && polNo.trim()) {
        sql += ` AND r.POL_NO = :polNo`;
        binds.polNo = polNo.trim();
      }
      if (propNo && propNo.trim()) {
        sql += ` AND r.PROP_NO = :propNo`;
        binds.propNo = propNo.trim();
      }
      if (search && search.trim()) {
        sql += ` AND (
          UPPER(r.RECEIPT_NO) LIKE UPPER(:search) OR
          UPPER(r.POL_NO) LIKE UPPER(:search) OR
          UPPER(r.PROP_NO) LIKE UPPER(:search) OR
          UPPER(pa.PAS_NAME) LIKE UPPER(:search) OR
          UPPER(prass.PAS_NAME) LIKE UPPER(:search)
        )`;
        binds.search = `%${search.trim()}%`;
      }
      sql += ` ORDER BY r.RECEIPT_ID DESC`;

      const res = await connection.execute<PremiumReceiptRecord>(sql, binds);
      return res.rows || [];
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  // ===========================================================================
  // 2. AUTO-LAPSE PROCESS & REINSTATEMENT
  // ===========================================================================

  /**
   * Run Auto-Lapse Scan
   * Identifies in-force policies where grace period expired without premium payment
   */
  async runAutoLapseScan(appUser: string = 'SYSTEM'): Promise<AutoLapseScanResult> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      // Grace period: Monthly = 15 days, others = 30 days
      const scanSql = `
        SELECT 
          p.POL_NO,
          a.PAS_NAME,
          TO_CHAR(p.POL_NEXT_DUE_DATE, 'YYYY-MM-DD') AS DUE_DATE,
          TO_CHAR(
            p.POL_NEXT_DUE_DATE + CASE p.POL_PAY_FREQ WHEN 'MONTHLY' THEN 15 ELSE 30 END,
            'YYYY-MM-DD'
          ) AS GRACE_EXPIRY_DATE,
          NVL(p.POL_INSTALLMENT_PREM, s.PPS_INSTALLMENT_PREM) AS UNPAID_INSTALLMENT
        FROM T_POLICY_INFO p
        LEFT JOIN T_POLICY_ASSURED a ON a.POL_NO = p.POL_NO
        LEFT JOIN T_POLICY_PREMIUM_SUMMARY s ON s.POL_NO = p.POL_NO
        WHERE p.POL_STATUS = 'IN_FORCE'
          AND p.POL_NEXT_DUE_DATE IS NOT NULL
          AND SYSDATE > (p.POL_NEXT_DUE_DATE + CASE p.POL_PAY_FREQ WHEN 'MONTHLY' THEN 15 ELSE 30 END)
      `;

      const scanRes = await connection.execute<any>(scanSql);
      const eligible = scanRes.rows || [];

      // Update to LAPSED
      if (eligible.length > 0) {
        const polNos = eligible.map((e) => e.POL_NO);
        for (const pNo of polNos) {
          await connection.execute(
            `UPDATE T_POLICY_INFO 
             SET POL_STATUS = 'LAPSED', MODIFIED_BY = :appUser, MODIFIED_ON = SYSDATE 
             WHERE POL_NO = :pNo`,
            { appUser, pNo },
            { autoCommit: false }
          );
        }
        await connection.commit();
      }

      return {
        totalScanned: eligible.length,
        lapsedCount: eligible.length,
        lapsedPolicies: eligible.map((e) => ({
          polNo: e.POL_NO,
          customerName: e.PAS_NAME || 'Unknown',
          dueDate: e.DUE_DATE,
          graceExpiryDate: e.GRACE_EXPIRY_DATE,
          unpaidInstallment: Number(e.UNPAID_INSTALLMENT || 0)
        }))
      };
    } catch (err) {
      if (connection) await connection.rollback();
      throw err;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Calculate Reinstatement amount (Overdue installments + penalty interest)
   */
  async calculateReinstatement(polNo: string): Promise<ReinstatementCalculationResult> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const code = polNo.trim();

      const sql = `
        SELECT 
          p.POL_NO,
          p.POL_STATUS,
          p.POL_PAY_FREQ,
          p.POL_INSTALLMENT_PREM,
          TO_CHAR(p.POL_NEXT_DUE_DATE, 'YYYY-MM-DD') AS POL_NEXT_DUE_DATE,
          a.PAS_NAME,
          s.PPS_INSTALLMENT_PREM
        FROM T_POLICY_INFO p
        LEFT JOIN T_POLICY_ASSURED a ON a.POL_NO = p.POL_NO
        LEFT JOIN T_POLICY_PREMIUM_SUMMARY s ON s.POL_NO = p.POL_NO
        WHERE p.POL_NO = :code
      `;

      const res = await connection.execute<any>(sql, { code });
      if (!res.rows || res.rows.length === 0) {
        throw new Error(`Policy '${code}' not found.`);
      }

      const pol = res.rows[0];
      const installment = Number(pol.POL_INSTALLMENT_PREM || pol.PPS_INSTALLMENT_PREM || 300);

      const dueDate = pol.POL_NEXT_DUE_DATE ? new Date(pol.POL_NEXT_DUE_DATE) : new Date();
      const now = new Date();
      const diffMs = Math.max(0, now.getTime() - dueDate.getTime());
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const diffMonths = Math.max(1, Math.ceil(diffDays / 30));

      const freqMonths =
        pol.POL_PAY_FREQ === 'MONTHLY'
          ? 1
          : pol.POL_PAY_FREQ === 'QUARTERLY'
          ? 3
          : pol.POL_PAY_FREQ === 'SEMI_ANNUAL'
          ? 6
          : 12;

      const overdueCount = Math.max(1, Math.ceil(diffMonths / freqMonths));
      const overduePremiumTotal = Math.round(overdueCount * installment * 100) / 100;
      // 8% per annum penalty interest
      const penaltyInterest = Math.round((overduePremiumTotal * 0.08 * (diffDays / 365)) * 100) / 100;
      const totalPayableToReinstate = Math.round((overduePremiumTotal + penaltyInterest) * 100) / 100;

      return {
        polNo: pol.POL_NO,
        customerName: pol.PAS_NAME || 'Assured',
        overdueInstallmentsCount: overdueCount,
        overduePremiumTotal,
        penaltyInterest,
        totalPayableToReinstate
      };
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Reinstate a lapsed policy upon payment
   */
  async reinstatePolicy(
    polNo: string,
    payMode: any = 'CASH',
    txnRef?: string,
    appUser: string = 'ADMIN'
  ): Promise<{ receipt: PremiumReceiptRecord; voucherNo: string }> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const code = polNo.trim();

      const calc = await this.calculateReinstatement(code);
      const receiptNo = await this.generateNumber(connection, 'SEQ_RECEIPT_ID', 'RCP');
      const voucherNo = await this.generateNumber(connection, 'SEQ_VOUCHER_ID', 'JV');

      // 1. Insert Receipt
      const recSql = `
        INSERT INTO T_POLICY_PREMIUM_RECEIPT (
          RECEIPT_ID,
          RECEIPT_NO,
          RECEIPT_TYPE,
          POL_NO,
          RECEIPT_DATE,
          PREMIUM_AMOUNT,
          INTEREST_AMOUNT,
          TOTAL_PAID,
          PAY_MODE,
          TRANSACTION_REF,
          COLLECTED_BY,
          GL_VOUCHER_NO,
          GL_POSTED_YN,
          STATUS,
          REMARKS,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_ON
        ) VALUES (
          SEQ_RECEIPT_ID.NEXTVAL,
          :receiptNo,
          'REINSTATE',
          :code,
          SYSDATE,
          :premAmount,
          :interestAmount,
          :totalPaid,
          :payMode,
          :txnRef,
          :appUser,
          :voucherNo,
          'Y',
          'ACTIVE',
          'Policy Reinstatement & Revival Collection',
          'Y',
          :appUser,
          SYSDATE
        )
      `;

      await connection.execute(
        recSql,
        {
          receiptNo,
          code,
          premAmount: calc.overduePremiumTotal,
          interestAmount: calc.penaltyInterest,
          totalPaid: calc.totalPayableToReinstate,
          payMode: payMode || 'CASH',
          txnRef: txnRef || null,
          voucherNo,
          appUser
        },
        { autoCommit: false }
      );

      // 2. Post GL Entries
      // DR: Bank
      // CR: Renewal Premium Income
      // CR: Policy Revival Penalty Interest Income
      await this.postGLJournalEntries(
        connection,
        voucherNo,
        'REINSTATE',
        receiptNo,
        [
          {
            code: '1101-BANK-CLEARING',
            name: 'Cash / Bank Collections Clearing Account',
            drCr: 'D',
            amount: calc.totalPayableToReinstate,
            narration: `Reinstatement payment for Policy ${code}`
          },
          {
            code: '4102-PREM-RENEWAL-IL',
            name: 'Individual Life Premium Income - Renewal',
            drCr: 'C',
            amount: calc.overduePremiumTotal,
            narration: `Overdue premiums recovered on revival of Policy ${code}`
          },
          {
            code: '4202-REVIVAL-PENALTY-INC',
            name: 'Policy Revival Penalty Interest Income',
            drCr: 'C',
            amount: calc.penaltyInterest,
            narration: `Late interest fee for Policy ${code}`
          }
        ],
        appUser
      );

      // 3. Reset policy status to IN_FORCE and advance due date
      await connection.execute(
        `UPDATE T_POLICY_INFO
         SET 
           POL_STATUS = 'IN_FORCE',
           POL_NEXT_DUE_DATE = ADD_MONTHS(SYSDATE, 12),
           POL_PAID_TO_DATE = ADD_MONTHS(SYSDATE, 12),
           POL_LAST_PREM_DATE = SYSDATE,
           POL_TOTAL_PREM_PAID = NVL(POL_TOTAL_PREM_PAID, 0) + :premAmount,
           MODIFIED_BY = :appUser,
           MODIFIED_ON = SYSDATE
         WHERE POL_NO = :code`,
        { premAmount: calc.overduePremiumTotal, appUser, code },
        { autoCommit: false }
      );

      await connection.commit();

      const receipt = await this.getReceiptByNo(receiptNo);
      return { receipt: receipt!, voucherNo };
    } catch (err) {
      if (connection) await connection.rollback();
      throw err;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  // ===========================================================================
  // 3. SURRENDER SERVICING & VALUATION
  // ===========================================================================

  /**
   * Check Surrender Eligibility & calculate Cash Value
   */
  async checkSurrenderEligibility(polNo: string): Promise<SurrenderValuationResult> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const code = polNo.trim();

      const sql = `
        SELECT 
          p.POL_NO,
          p.POL_STATUS,
          p.POL_PLAN_TYPE,
          p.POL_TERM,
          p.POL_PREM_PAY_TERM,
          p.POL_SUM_ASSURED,
          p.POL_TOTAL_PREM_PAID,
          p.POL_INSTALLMENT_PREM,
          TO_CHAR(p.POL_INCEPTION_DATE, 'YYYY-MM-DD') AS INCEPTION_DATE,
          s.PPS_BASIC_PREMIUM,
          a.PAS_NAME
        FROM T_POLICY_INFO p
        LEFT JOIN T_POLICY_PREMIUM_SUMMARY s ON s.POL_NO = p.POL_NO
        LEFT JOIN T_POLICY_ASSURED a ON a.POL_NO = p.POL_NO
        WHERE p.POL_NO = :code
      `;

      const res = await connection.execute<any>(sql, { code });
      if (!res.rows || res.rows.length === 0) {
        throw new Error(`Policy '${code}' not found.`);
      }

      const pol = res.rows[0];
      const annualPrem = Number(pol.PPS_BASIC_PREMIUM || (pol.POL_INSTALLMENT_PREM ? pol.POL_INSTALLMENT_PREM * 1 : 1000));
      const totalPaid = Number(pol.POL_TOTAL_PREM_PAID || annualPrem * 2);

      const inceptionDate = pol.INCEPTION_DATE ? new Date(pol.INCEPTION_DATE) : new Date();
      const now = new Date();
      const diffYears = Math.max(0.5, (now.getTime() - inceptionDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
      const paidYears = Math.round(diffYears * 10) / 10;

      // Minimum 2 years required for surrender cash value
      const isEligible = paidYears >= 2 && ['IN_FORCE', 'LAPSED'].includes(pol.POL_STATUS);
      const ineligibilityReason =
        paidYears < 2
          ? `Policy has not acquired cash value (requires at least 2 full years of active premiums, currently ${paidYears} years).`
          : !['IN_FORCE', 'LAPSED'].includes(pol.POL_STATUS)
          ? `Policy status is '${pol.POL_STATUS}', which cannot be surrendered.`
          : undefined;

      // Guaranteed Surrender Value (GSV): 30% for 2-3 yrs, 50% for 4-7 yrs, 70% for 8+ yrs
      let gsvFactor = 0;
      if (paidYears >= 7) gsvFactor = 0.70;
      else if (paidYears >= 4) gsvFactor = 0.50;
      else if (paidYears >= 2) gsvFactor = 0.30;

      const guaranteedSV = Math.round(totalPaid * gsvFactor * 100) / 100;

      // Special Surrender Value (SSV): PaidUp SA * SSV Factor
      const paidUpRatio = Math.min(1, paidYears / (pol.POL_PREM_PAY_TERM || 10));
      const paidUpSA = Math.round(Number(pol.POL_SUM_ASSURED) * paidUpRatio);
      const ssvFactor = Math.min(0.65, 0.25 + (paidYears * 0.03));
      const specialSV = Math.round(paidUpSA * ssvFactor * 100) / 100;

      const grossSV = isEligible ? Math.max(guaranteedSV, specialSV) : 0;

      // Check active loans
      const loanSql = `
        SELECT 
          NVL(SUM(OUTSTANDING_PRINCIPAL), 0) AS LOAN_PRINCIPAL,
          NVL(SUM(ACCRUED_INTEREST), 0) AS LOAN_INTEREST
        FROM T_POLICY_LOAN
        WHERE POL_NO = :code AND STATUS = 'ACTIVE'
      `;
      const loanRes = await connection.execute<any>(loanSql, { code });
      const loanPrincipal = Number(loanRes.rows?.[0]?.LOAN_PRINCIPAL || 0);
      const loanInterest = Number(loanRes.rows?.[0]?.LOAN_INTEREST || 0);

      const netPayableSV = Math.max(0, Math.round((grossSV - loanPrincipal - loanInterest) * 100) / 100);

      return {
        polNo: pol.POL_NO,
        customerName: pol.PAS_NAME || 'Assured',
        paidYears,
        totalPremiumsPaid: totalPaid,
        isEligible,
        ineligibilityReason,
        guaranteedSV,
        specialSV,
        grossSV,
        outstandingLoanPrincipal: loanPrincipal,
        accruedLoanInterest: loanInterest,
        netPayableSV
      };
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Create Surrender Request
   */
  async createSurrenderRequest(
    polNo: string,
    appUser: string = 'ADMIN'
  ): Promise<PolicySurrenderRecord> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const code = polNo.trim();

      const valuation = await this.checkSurrenderEligibility(code);
      if (!valuation.isEligible) {
        throw new Error(valuation.ineligibilityReason || 'Policy is not eligible for cash surrender.');
      }

      const surrenderNo = await this.generateNumber(connection, 'SEQ_SURRENDER_ID', 'SUR');

      const sql = `
        INSERT INTO T_POLICY_SURRENDER (
          SURRENDER_ID,
          SURRENDER_NO,
          POL_NO,
          REQUEST_DATE,
          PAID_PREMIUM_YEARS,
          TOTAL_PREMIUM_PAID,
          GUARANTEED_SV,
          SPECIAL_SV,
          GROSS_SURRENDER_VALUE,
          LOAN_DEDUCTION,
          INTEREST_DEDUCTION,
          NET_PAYABLE_AMOUNT,
          STATUS,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_ON
        ) VALUES (
          SEQ_SURRENDER_ID.NEXTVAL,
          :surrenderNo,
          :code,
          SYSDATE,
          :paidYears,
          :totalPaid,
          :gsv,
          :ssv,
          :grossSv,
          :loanDed,
          :intDed,
          :netPay,
          'REQUESTED',
          'Y',
          :appUser,
          SYSDATE
        )
      `;

      await connection.execute(
        sql,
        {
          surrenderNo,
          code,
          paidYears: valuation.paidYears,
          totalPaid: valuation.totalPremiumsPaid,
          gsv: valuation.guaranteedSV,
          ssv: valuation.specialSV,
          grossSv: valuation.grossSV,
          loanDed: valuation.outstandingLoanPrincipal,
          intDed: valuation.accruedLoanInterest,
          netPay: valuation.netPayableSV,
          appUser
        },
        { autoCommit: false }
      );

      await connection.commit();

      const detail = await this.getSurrenderByNo(surrenderNo);
      return detail!;
    } catch (err) {
      if (connection) await connection.rollback();
      throw err;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Approve & Settle Surrender Request (Posts GL entries and terminates policy)
   */
  async approveSurrender(
    surrenderNo: string,
    remarks?: string,
    appUser: string = 'POLICY_ADMIN'
  ): Promise<{ surrender: PolicySurrenderRecord; voucherNo: string }> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const code = surrenderNo.trim();

      const surr = await this.getSurrenderByNo(code);
      if (!surr) {
        throw new Error(`Surrender Request '${code}' not found.`);
      }
      if (surr.STATUS === 'SETTLED') {
        throw new Error(`Surrender Request '${code}' has already been settled.`);
      }

      const voucherNo = await this.generateNumber(connection, 'SEQ_VOUCHER_ID', 'JV');

      // 1. Post GL Accounting Entries:
      // DR: Surrenders Incurred Expense (Gross SV)
      // CR: Policy Loan Asset Recovery (if any)
      // CR: Policy Loan Interest Recovery (if any)
      // CR: Bank Settlement (Net Payable)
      const glEntries: Array<{ code: string; name: string; drCr: 'D' | 'C'; amount: number; narration?: string }> = [
        {
          code: '5102-SURR-CLAIMS-EXP',
          name: 'Surrender & Cash Value Claims Incurred',
          drCr: 'D',
          amount: surr.GROSS_SURRENDER_VALUE,
          narration: `Surrender claim for Policy ${surr.POL_NO} (${code})`
        }
      ];

      if (surr.LOAN_DEDUCTION > 0) {
        glEntries.push({
          code: '1301-POL-LOAN-ASSET',
          name: 'Policy Loans Outstanding Asset',
          drCr: 'C',
          amount: surr.LOAN_DEDUCTION,
          narration: `Principal loan deduction on surrender of Policy ${surr.POL_NO}`
        });
      }

      if (surr.INTEREST_DEDUCTION > 0) {
        glEntries.push({
          code: '4201-LOAN-INT-INC',
          name: 'Policy Loan Interest Income',
          drCr: 'C',
          amount: surr.INTEREST_DEDUCTION,
          narration: `Interest deduction on surrender of Policy ${surr.POL_NO}`
        });
      }

      glEntries.push({
        code: '1101-BANK-CLEARING',
        name: 'Cash / Bank Settlement Account',
        drCr: 'C',
        amount: surr.NET_PAYABLE_AMOUNT,
        narration: `Net surrender settlement payout for Policy ${surr.POL_NO}`
      });

      await this.postGLJournalEntries(
        connection,
        voucherNo,
        'SURRENDER',
        code,
        glEntries,
        appUser
      );

      // 2. Update Surrender Table
      await connection.execute(
        `UPDATE T_POLICY_SURRENDER
         SET 
           STATUS = 'SETTLED',
           APPROVED_BY = :appUser,
           APPROVED_ON = SYSDATE,
           SETTLED_ON = SYSDATE,
           APPROVAL_REMARKS = :remarks,
           GL_VOUCHER_NO = :voucherNo
         WHERE SURRENDER_NO = :code`,
        { appUser, remarks: remarks || 'Surrender authorized and settled', voucherNo, code },
        { autoCommit: false }
      );

      // 3. Update Policy Status to SURRENDERED
      await connection.execute(
        `UPDATE T_POLICY_INFO
         SET POL_STATUS = 'SURRENDERED', MODIFIED_BY = :appUser, MODIFIED_ON = SYSDATE
         WHERE POL_NO = :polNo`,
        { appUser, polNo: surr.POL_NO },
        { autoCommit: false }
      );

      // 4. Close any active loans
      if (surr.LOAN_DEDUCTION > 0) {
        await connection.execute(
          `UPDATE T_POLICY_LOAN
           SET STATUS = 'REPAID', OUTSTANDING_PRINCIPAL = 0, ACCRUED_INTEREST = 0
           WHERE POL_NO = :polNo AND STATUS = 'ACTIVE'`,
          { polNo: surr.POL_NO },
          { autoCommit: false }
        );
      }

      await connection.commit();

      const updated = await this.getSurrenderByNo(code);
      return { surrender: updated!, voucherNo };
    } catch (err) {
      if (connection) await connection.rollback();
      throw err;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Fetch single surrender
   */
  async getSurrenderByNo(surrenderNo: string): Promise<PolicySurrenderRecord | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const sql = `
        SELECT 
          s.SURRENDER_ID,
          s.SURRENDER_NO,
          s.POL_NO,
          TO_CHAR(s.REQUEST_DATE, 'YYYY-MM-DD') AS REQUEST_DATE,
          s.PAID_PREMIUM_YEARS,
          s.TOTAL_PREMIUM_PAID,
          s.GUARANTEED_SV,
          s.SPECIAL_SV,
          s.GROSS_SURRENDER_VALUE,
          s.LOAN_DEDUCTION,
          s.INTEREST_DEDUCTION,
          s.NET_PAYABLE_AMOUNT,
          s.GL_VOUCHER_NO,
          s.STATUS,
          s.APPROVED_BY,
          TO_CHAR(s.APPROVED_ON, 'YYYY-MM-DD HH24:MI:SS') AS APPROVED_ON,
          s.APPROVAL_REMARKS,
          TO_CHAR(s.SETTLED_ON, 'YYYY-MM-DD') AS SETTLED_ON,
          s.IS_ACTIVE,
          s.CREATED_BY,
          TO_CHAR(s.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
          a.PAS_NAME AS CUSTOMER_NAME,
          pr.PROD_NAME,
          p.POL_SUM_ASSURED AS SUM_ASSURED
        FROM T_POLICY_SURRENDER s
        LEFT JOIN T_POLICY_INFO p ON p.POL_NO = s.POL_NO
        LEFT JOIN T_POLICY_ASSURED a ON a.POL_NO = s.POL_NO
        LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = p.POL_PROD_CODE
        WHERE s.SURRENDER_NO = :surrenderNo
      `;
      const res = await connection.execute<PolicySurrenderRecord>(sql, { surrenderNo });
      return res.rows?.[0] || null;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * List all surrenders
   */
  async getAllSurrenders(status?: string, search?: string): Promise<PolicySurrenderRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      let sql = `
        SELECT 
          s.SURRENDER_ID,
          s.SURRENDER_NO,
          s.POL_NO,
          TO_CHAR(s.REQUEST_DATE, 'YYYY-MM-DD') AS REQUEST_DATE,
          s.PAID_PREMIUM_YEARS,
          s.TOTAL_PREMIUM_PAID,
          s.GUARANTEED_SV,
          s.SPECIAL_SV,
          s.GROSS_SURRENDER_VALUE,
          s.LOAN_DEDUCTION,
          s.INTEREST_DEDUCTION,
          s.NET_PAYABLE_AMOUNT,
          s.GL_VOUCHER_NO,
          s.STATUS,
          s.APPROVED_BY,
          TO_CHAR(s.APPROVED_ON, 'YYYY-MM-DD HH24:MI:SS') AS APPROVED_ON,
          s.APPROVAL_REMARKS,
          TO_CHAR(s.SETTLED_ON, 'YYYY-MM-DD') AS SETTLED_ON,
          s.IS_ACTIVE,
          s.CREATED_BY,
          TO_CHAR(s.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
          a.PAS_NAME AS CUSTOMER_NAME,
          pr.PROD_NAME,
          p.POL_SUM_ASSURED AS SUM_ASSURED
        FROM T_POLICY_SURRENDER s
        LEFT JOIN T_POLICY_INFO p ON p.POL_NO = s.POL_NO
        LEFT JOIN T_POLICY_ASSURED a ON a.POL_NO = s.POL_NO
        LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = p.POL_PROD_CODE
        WHERE s.IS_ACTIVE = 'Y'
      `;
      const binds: any = {};
      if (status && status !== 'ALL') {
        sql += ` AND s.STATUS = :status`;
        binds.status = status;
      }
      if (search && search.trim()) {
        sql += ` AND (
          UPPER(s.SURRENDER_NO) LIKE UPPER(:search) OR
          UPPER(s.POL_NO) LIKE UPPER(:search) OR
          UPPER(a.PAS_NAME) LIKE UPPER(:search)
        )`;
        binds.search = `%${search.trim()}%`;
      }
      sql += ` ORDER BY s.SURRENDER_ID DESC`;

      const res = await connection.execute<PolicySurrenderRecord>(sql, binds);
      return res.rows || [];
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  // ===========================================================================
  // 4. MATURITY PROCESSING & CLAIMS SETTLEMENT
  // ===========================================================================

  /**
   * Find Policies Due for Maturity
   */
  async checkMaturityDue(): Promise<any[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const sql = `
        SELECT 
          p.POL_NO,
          p.POL_STATUS,
          p.POL_SUM_ASSURED,
          TO_CHAR(p.POL_MATURITY_DATE, 'YYYY-MM-DD') AS MATURITY_DATE,
          a.PAS_NAME,
          pr.PROD_NAME
        FROM T_POLICY_INFO p
        LEFT JOIN T_POLICY_ASSURED a ON a.POL_NO = p.POL_NO
        LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = p.POL_PROD_CODE
        WHERE p.POL_STATUS IN ('IN_FORCE', 'APPROVED')
          AND p.POL_MATURITY_DATE <= SYSDATE + 60
        ORDER BY p.POL_MATURITY_DATE ASC
      `;
      const res = await connection.execute<any>(sql);
      return res.rows || [];
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Process and Settle Maturity
   */
  async processMaturitySettlement(
    polNo: string,
    remarks?: string,
    appUser: string = 'POLICY_ADMIN'
  ): Promise<{ maturity: PolicyMaturityRecord; voucherNo: string }> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const code = polNo.trim();

      const polSql = `
        SELECT 
          p.POL_NO,
          p.POL_STATUS,
          p.POL_TERM,
          p.POL_SUM_ASSURED,
          TO_CHAR(p.POL_MATURITY_DATE, 'YYYY-MM-DD') AS MATURITY_DATE,
          a.PAS_NAME
        FROM T_POLICY_INFO p
        LEFT JOIN T_POLICY_ASSURED a ON a.POL_NO = p.POL_NO
        WHERE p.POL_NO = :code
      `;
      const polRes = await connection.execute<any>(polSql, { code });
      if (!polRes.rows || polRes.rows.length === 0) {
        throw new Error(`Policy '${code}' not found.`);
      }

      const pol = polRes.rows[0];
      const sa = Number(pol.POL_SUM_ASSURED);

      // Actuarial Vested Bonus: 3.5% per completed year of term
      const vestedBonus = Math.round(sa * 0.035 * (pol.POL_TERM || 10) * 100) / 100;
      // Terminal bonus: 2% of SA
      const terminalBonus = Math.round(sa * 0.02 * 100) / 100;
      const grossMaturity = Math.round((sa + vestedBonus + terminalBonus) * 100) / 100;

      // Check active loan
      const loanSql = `
        SELECT 
          NVL(SUM(OUTSTANDING_PRINCIPAL), 0) AS LOAN_PRINCIPAL,
          NVL(SUM(ACCRUED_INTEREST), 0) AS LOAN_INTEREST
        FROM T_POLICY_LOAN
        WHERE POL_NO = :code AND STATUS = 'ACTIVE'
      `;
      const loanRes = await connection.execute<any>(loanSql, { code });
      const loanDed = Number(loanRes.rows?.[0]?.LOAN_PRINCIPAL || 0);
      const intDed = Number(loanRes.rows?.[0]?.LOAN_INTEREST || 0);

      const netPayable = Math.max(0, Math.round((grossMaturity - loanDed - intDed) * 100) / 100);

      const maturityNo = await this.generateNumber(connection, 'SEQ_MATURITY_ID', 'MAT');
      const voucherNo = await this.generateNumber(connection, 'SEQ_VOUCHER_ID', 'JV');

      // 1. Insert Maturity Record
      const matSql = `
        INSERT INTO T_POLICY_MATURITY (
          MATURITY_ID,
          MATURITY_NO,
          POL_NO,
          MATURITY_DATE,
          BASIC_SUM_ASSURED,
          VESTED_BONUS_AMOUNT,
          TERMINAL_BONUS_AMOUNT,
          GROSS_MATURITY_AMOUNT,
          LOAN_DEDUCTION,
          INTEREST_DEDUCTION,
          NET_MATURITY_PAYABLE,
          GL_VOUCHER_NO,
          STATUS,
          APPROVED_BY,
          APPROVED_ON,
          APPROVAL_REMARKS,
          SETTLED_ON,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_ON
        ) VALUES (
          SEQ_MATURITY_ID.NEXTVAL,
          :maturityNo,
          :code,
          TO_DATE(:matDate, 'YYYY-MM-DD'),
          :sa,
          :vestedBonus,
          :terminalBonus,
          :grossMaturity,
          :loanDed,
          :intDed,
          :netPayable,
          :voucherNo,
          'SETTLED',
          :appUser,
          SYSDATE,
          :remarks,
          SYSDATE,
          'Y',
          :appUser,
          SYSDATE
        )
      `;

      await connection.execute(
        matSql,
        {
          maturityNo,
          code,
          matDate: pol.MATURITY_DATE || new Date().toISOString().slice(0, 10),
          sa,
          vestedBonus,
          terminalBonus,
          grossMaturity,
          loanDed,
          intDed,
          netPayable,
          voucherNo,
          remarks: remarks || 'Full Maturity Benefit Settled',
          appUser
        },
        { autoCommit: false }
      );

      // 2. Post GL Entries
      // DR: Maturity Claims Incurred (Gross Maturity)
      // CR: Policy Loan Recovery (if any)
      // CR: Bank Settlement (Net Payable)
      const glEntries: Array<{ code: string; name: string; drCr: 'D' | 'C'; amount: number; narration?: string }> = [
        {
          code: '5101-MAT-CLAIMS-EXP',
          name: 'Policy Maturity Claims Incurred',
          drCr: 'D',
          amount: grossMaturity,
          narration: `Maturity claim for Policy ${code} (${pol.PAS_NAME || 'Assured'})`
        }
      ];

      if (loanDed > 0) {
        glEntries.push({
          code: '1301-POL-LOAN-ASSET',
          name: 'Policy Loans Outstanding Asset',
          drCr: 'C',
          amount: loanDed,
          narration: `Principal loan deduction on maturity of Policy ${code}`
        });
      }

      if (intDed > 0) {
        glEntries.push({
          code: '4201-LOAN-INT-INC',
          name: 'Policy Loan Interest Income',
          drCr: 'C',
          amount: intDed,
          narration: `Interest deduction on maturity of Policy ${code}`
        });
      }

      glEntries.push({
        code: '1101-BANK-CLEARING',
        name: 'Cash / Bank Settlement Account',
        drCr: 'C',
        amount: netPayable,
        narration: `Net maturity settlement for Policy ${code}`
      });

      await this.postGLJournalEntries(connection, voucherNo, 'MATURITY', maturityNo, glEntries, appUser);

      // 3. Update Policy Status to MATURED
      await connection.execute(
        `UPDATE T_POLICY_INFO 
         SET POL_STATUS = 'MATURED', MODIFIED_BY = :appUser, MODIFIED_ON = SYSDATE 
         WHERE POL_NO = :code`,
        { appUser, code },
        { autoCommit: false }
      );

      // 4. Close loans
      if (loanDed > 0) {
        await connection.execute(
          `UPDATE T_POLICY_LOAN
           SET STATUS = 'REPAID', OUTSTANDING_PRINCIPAL = 0, ACCRUED_INTEREST = 0
           WHERE POL_NO = :code AND STATUS = 'ACTIVE'`,
          { code },
          { autoCommit: false }
        );
      }

      await connection.commit();

      const matRecord = await this.getMaturityByNo(maturityNo);
      return { maturity: matRecord!, voucherNo };
    } catch (err) {
      if (connection) await connection.rollback();
      throw err;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Fetch single maturity record
   */
  async getMaturityByNo(maturityNo: string): Promise<PolicyMaturityRecord | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const sql = `
        SELECT 
          m.MATURITY_ID,
          m.MATURITY_NO,
          m.POL_NO,
          TO_CHAR(m.MATURITY_DATE, 'YYYY-MM-DD') AS MATURITY_DATE,
          m.BASIC_SUM_ASSURED,
          m.VESTED_BONUS_AMOUNT,
          m.TERMINAL_BONUS_AMOUNT,
          m.GROSS_MATURITY_AMOUNT,
          m.LOAN_DEDUCTION,
          m.INTEREST_DEDUCTION,
          m.NET_MATURITY_PAYABLE,
          m.GL_VOUCHER_NO,
          m.STATUS,
          m.APPROVED_BY,
          TO_CHAR(m.APPROVED_ON, 'YYYY-MM-DD HH24:MI:SS') AS APPROVED_ON,
          m.APPROVAL_REMARKS,
          TO_CHAR(m.SETTLED_ON, 'YYYY-MM-DD') AS SETTLED_ON,
          m.IS_ACTIVE,
          m.CREATED_BY,
          TO_CHAR(m.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
          a.PAS_NAME AS CUSTOMER_NAME,
          pr.PROD_NAME
        FROM T_POLICY_MATURITY m
        LEFT JOIN T_POLICY_INFO p ON p.POL_NO = m.POL_NO
        LEFT JOIN T_POLICY_ASSURED a ON a.POL_NO = m.POL_NO
        LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = p.POL_PROD_CODE
        WHERE m.MATURITY_NO = :maturityNo
      `;
      const res = await connection.execute<PolicyMaturityRecord>(sql, { maturityNo });
      return res.rows?.[0] || null;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * List all maturities
   */
  async getAllMaturities(status?: string, search?: string): Promise<PolicyMaturityRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      let sql = `
        SELECT 
          m.MATURITY_ID,
          m.MATURITY_NO,
          m.POL_NO,
          TO_CHAR(m.MATURITY_DATE, 'YYYY-MM-DD') AS MATURITY_DATE,
          m.BASIC_SUM_ASSURED,
          m.VESTED_BONUS_AMOUNT,
          m.TERMINAL_BONUS_AMOUNT,
          m.GROSS_MATURITY_AMOUNT,
          m.LOAN_DEDUCTION,
          m.INTEREST_DEDUCTION,
          m.NET_MATURITY_PAYABLE,
          m.GL_VOUCHER_NO,
          m.STATUS,
          m.APPROVED_BY,
          TO_CHAR(m.APPROVED_ON, 'YYYY-MM-DD HH24:MI:SS') AS APPROVED_ON,
          m.APPROVAL_REMARKS,
          TO_CHAR(m.SETTLED_ON, 'YYYY-MM-DD') AS SETTLED_ON,
          m.IS_ACTIVE,
          m.CREATED_BY,
          TO_CHAR(m.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
          a.PAS_NAME AS CUSTOMER_NAME,
          pr.PROD_NAME
        FROM T_POLICY_MATURITY m
        LEFT JOIN T_POLICY_INFO p ON p.POL_NO = m.POL_NO
        LEFT JOIN T_POLICY_ASSURED a ON a.POL_NO = m.POL_NO
        LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = p.POL_PROD_CODE
        WHERE m.IS_ACTIVE = 'Y'
      `;
      const binds: any = {};
      if (status && status !== 'ALL') {
        sql += ` AND m.STATUS = :status`;
        binds.status = status;
      }
      if (search && search.trim()) {
        sql += ` AND (
          UPPER(m.MATURITY_NO) LIKE UPPER(:search) OR
          UPPER(m.POL_NO) LIKE UPPER(:search) OR
          UPPER(a.PAS_NAME) LIKE UPPER(:search)
        )`;
        binds.search = `%${search.trim()}%`;
      }
      sql += ` ORDER BY m.MATURITY_ID DESC`;

      const res = await connection.execute<PolicyMaturityRecord>(sql, binds);
      return res.rows || [];
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  // ===========================================================================
  // 5. POLICY LOANS & REPAYMENTS
  // ===========================================================================

  /**
   * Check Policy Loan Eligibility
   */
  async checkLoanEligibility(polNo: string): Promise<LoanEligibilityResult> {
    const valuation = await this.checkSurrenderEligibility(polNo);
    const maxPct = 80;
    const maxLoan = Math.round(valuation.grossSV * 0.80 * 100) / 100;
    const available = Math.max(0, Math.round((maxLoan - valuation.outstandingLoanPrincipal) * 100) / 100);

    const isEligible = valuation.isEligible && available >= 500;
    const ineligibilityReason = !valuation.isEligible
      ? valuation.ineligibilityReason
      : available < 500
      ? `Maximum loan capacity reached or below minimum borrowing threshold of OMR 500.`
      : undefined;

    return {
      polNo,
      customerName: valuation.customerName,
      planType: 'ENDOWMENT',
      isEligible,
      ineligibilityReason,
      currentSurrenderValue: valuation.grossSV,
      maxLoanPercentage: maxPct,
      maxEligibleLoanAmount: maxLoan,
      existingLoanPrincipal: valuation.outstandingLoanPrincipal,
      existingLoanInterest: valuation.accruedLoanInterest,
      netAvailableLoanAmount: available
    };
  },

  /**
   * Disburse Policy Loan
   */
  async disburseLoan(
    polNo: string,
    loanAmount: number,
    remarks?: string,
    appUser: string = 'POLICY_ADMIN'
  ): Promise<{ loan: PolicyLoanRecord; voucherNo: string }> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const code = polNo.trim();

      const elig = await this.checkLoanEligibility(code);
      if (!elig.isEligible) {
        throw new Error(elig.ineligibilityReason || 'Policy is not eligible for a loan.');
      }
      if (loanAmount > elig.netAvailableLoanAmount) {
        throw new Error(
          `Requested loan amount (OMR ${loanAmount}) exceeds net available borrowing limit of OMR ${elig.netAvailableLoanAmount}.`
        );
      }

      const loanNo = await this.generateNumber(connection, 'SEQ_LOAN_ID', 'LON');
      const voucherNo = await this.generateNumber(connection, 'SEQ_VOUCHER_ID', 'JV');

      // 1. Insert Policy Loan
      const loanSql = `
        INSERT INTO T_POLICY_LOAN (
          LOAN_ID,
          LOAN_NO,
          POL_NO,
          LOAN_DATE,
          SURRENDER_VALUE_AT_LOAN,
          MAX_ELIGIBLE_LOAN,
          DISBURSED_AMOUNT,
          INTEREST_RATE_PCT,
          OUTSTANDING_PRINCIPAL,
          ACCRUED_INTEREST,
          TOTAL_INTEREST_PAID,
          TOTAL_PRINCIPAL_REPAID,
          GL_VOUCHER_NO,
          STATUS,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_ON
        ) VALUES (
          SEQ_LOAN_ID.NEXTVAL,
          :loanNo,
          :code,
          SYSDATE,
          :svAtLoan,
          :maxLoan,
          :disbursed,
          8.00,
          :disbursed,
          0,
          0,
          0,
          :voucherNo,
          'ACTIVE',
          'Y',
          :appUser,
          SYSDATE
        )
      `;

      await connection.execute(
        loanSql,
        {
          loanNo,
          code,
          svAtLoan: elig.currentSurrenderValue,
          maxLoan: elig.maxEligibleLoanAmount,
          disbursed: loanAmount,
          voucherNo,
          appUser
        },
        { autoCommit: false }
      );

      // 2. Post GL Entries
      // DR: Policy Loans Asset
      // CR: Bank Settlement Account
      await this.postGLJournalEntries(
        connection,
        voucherNo,
        'LOAN_DISBURSE',
        loanNo,
        [
          {
            code: '1301-POL-LOAN-ASSET',
            name: 'Policy Loans Outstanding Asset',
            drCr: 'D',
            amount: loanAmount,
            narration: `Policy Loan disbursement on Policy ${code} (${loanNo})`
          },
          {
            code: '1101-BANK-CLEARING',
            name: 'Cash / Bank Settlement Account',
            drCr: 'C',
            amount: loanAmount,
            narration: `Loan payout transfer for Policy ${code}`
          }
        ],
        appUser
      );

      await connection.commit();

      const loan = await this.getLoanByNo(loanNo);
      return { loan: loan!, voucherNo };
    } catch (err) {
      if (connection) await connection.rollback();
      throw err;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Record Policy Loan Repayment
   */
  async repayLoan(
    loanNo: string,
    principalPaid: number,
    interestPaid: number,
    payMode: any = 'CASH',
    transactionRef?: string,
    appUser: string = 'ADMIN'
  ): Promise<{ repayment: PolicyLoanRepaymentRecord; loan: PolicyLoanRecord; voucherNo: string }> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const code = loanNo.trim();

      const loan = await this.getLoanByNo(code);
      if (!loan) {
        throw new Error(`Loan '${code}' not found.`);
      }
      if (loan.STATUS !== 'ACTIVE') {
        throw new Error(`Loan '${code}' is already fully repaid or closed.`);
      }

      const totalPaid = Math.round((principalPaid + interestPaid) * 100) / 100;
      if (totalPaid <= 0) {
        throw new Error(`Total repayment amount must be greater than zero.`);
      }

      const repaymentNo = await this.generateNumber(connection, 'SEQ_REPAYMENT_ID', 'LRP');
      const voucherNo = await this.generateNumber(connection, 'SEQ_VOUCHER_ID', 'JV');

      // 1. Insert Repayment Record
      const repSql = `
        INSERT INTO T_POLICY_LOAN_REPAYMENT (
          REPAYMENT_ID,
          REPAYMENT_NO,
          LOAN_NO,
          POL_NO,
          REPAYMENT_DATE,
          PRINCIPAL_PAID,
          INTEREST_PAID,
          TOTAL_PAID,
          PAY_MODE,
          TRANSACTION_REF,
          GL_VOUCHER_NO,
          RECEIVED_BY,
          CREATED_ON
        ) VALUES (
          SEQ_REPAYMENT_ID.NEXTVAL,
          :repaymentNo,
          :code,
          :polNo,
          SYSDATE,
          :principalPaid,
          :interestPaid,
          :totalPaid,
          :payMode,
          :transactionRef,
          :voucherNo,
          :appUser,
          SYSDATE
        )
      `;

      await connection.execute(
        repSql,
        {
          repaymentNo,
          code,
          polNo: loan.POL_NO,
          principalPaid,
          interestPaid,
          totalPaid,
          payMode: payMode || 'CASH',
          transactionRef: transactionRef || null,
          voucherNo,
          appUser
        },
        { autoCommit: false }
      );

      // 2. Post GL Entries
      // DR: Bank Clearing
      // CR: Policy Loans Asset (Principal)
      // CR: Policy Loan Interest Income (Interest)
      const glEntries: Array<{ code: string; name: string; drCr: 'D' | 'C'; amount: number; narration?: string }> = [
        {
          code: '1101-BANK-CLEARING',
          name: 'Cash / Bank Collections Clearing Account',
          drCr: 'D',
          amount: totalPaid,
          narration: `Loan repayment received for Loan ${code} (Policy ${loan.POL_NO})`
        }
      ];

      if (principalPaid > 0) {
        glEntries.push({
          code: '1301-POL-LOAN-ASSET',
          name: 'Policy Loans Outstanding Asset',
          drCr: 'C',
          amount: principalPaid,
          narration: `Principal recovery on Loan ${code}`
        });
      }

      if (interestPaid > 0) {
        glEntries.push({
          code: '4201-LOAN-INT-INC',
          name: 'Policy Loan Interest Income',
          drCr: 'C',
          amount: interestPaid,
          narration: `Interest payment on Loan ${code}`
        });
      }

      await this.postGLJournalEntries(connection, voucherNo, 'LOAN_REPAY', repaymentNo, glEntries, appUser);

      // 3. Update Loan Balance
      const newPrincipal = Math.max(0, loan.OUTSTANDING_PRINCIPAL - principalPaid);
      const isFullyRepaid = newPrincipal <= 0.05;

      await connection.execute(
        `UPDATE T_POLICY_LOAN
         SET 
           OUTSTANDING_PRINCIPAL = :newPrincipal,
           TOTAL_PRINCIPAL_REPAID = TOTAL_PRINCIPAL_REPAID + :principalPaid,
           TOTAL_INTEREST_PAID = TOTAL_INTEREST_PAID + :interestPaid,
           STATUS = CASE WHEN :isFullyRepaid = 'Y' THEN 'REPAID' ELSE STATUS END
         WHERE LOAN_NO = :code`,
        {
          newPrincipal,
          principalPaid,
          interestPaid,
          isFullyRepaid: isFullyRepaid ? 'Y' : 'N',
          code
        },
        { autoCommit: false }
      );

      await connection.commit();

      const updatedLoan = await this.getLoanByNo(code);
      const repRecord: PolicyLoanRepaymentRecord = {
        REPAYMENT_ID: 1,
        REPAYMENT_NO: repaymentNo,
        LOAN_NO: code,
        POL_NO: loan.POL_NO,
        REPAYMENT_DATE: new Date().toISOString().slice(0, 10),
        PRINCIPAL_PAID: principalPaid,
        INTEREST_PAID: interestPaid,
        TOTAL_PAID: totalPaid,
        PAY_MODE: payMode,
        TRANSACTION_REF: transactionRef || null,
        GL_VOUCHER_NO: voucherNo,
        RECEIVED_BY: appUser,
        CREATED_ON: new Date().toISOString()
      };

      return { repayment: repRecord, loan: updatedLoan!, voucherNo };
    } catch (err) {
      if (connection) await connection.rollback();
      throw err;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * Fetch single loan
   */
  async getLoanByNo(loanNo: string): Promise<PolicyLoanRecord | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const sql = `
        SELECT 
          l.LOAN_ID,
          l.LOAN_NO,
          l.POL_NO,
          TO_CHAR(l.LOAN_DATE, 'YYYY-MM-DD') AS LOAN_DATE,
          l.SURRENDER_VALUE_AT_LOAN,
          l.MAX_ELIGIBLE_LOAN,
          l.DISBURSED_AMOUNT,
          l.INTEREST_RATE_PCT,
          l.OUTSTANDING_PRINCIPAL,
          l.ACCRUED_INTEREST,
          l.TOTAL_INTEREST_PAID,
          l.TOTAL_PRINCIPAL_REPAID,
          l.GL_VOUCHER_NO,
          l.STATUS,
          l.IS_ACTIVE,
          l.CREATED_BY,
          TO_CHAR(l.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
          a.PAS_NAME AS CUSTOMER_NAME,
          pr.PROD_NAME
        FROM T_POLICY_LOAN l
        LEFT JOIN T_POLICY_INFO p ON p.POL_NO = l.POL_NO
        LEFT JOIN T_POLICY_ASSURED a ON a.POL_NO = l.POL_NO
        LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = p.POL_PROD_CODE
        WHERE l.LOAN_NO = :loanNo
      `;
      const res = await connection.execute<PolicyLoanRecord>(sql, { loanNo });
      return res.rows?.[0] || null;
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  /**
   * List all policy loans
   */
  async getAllLoans(status?: string, search?: string): Promise<PolicyLoanRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      let sql = `
        SELECT 
          l.LOAN_ID,
          l.LOAN_NO,
          l.POL_NO,
          TO_CHAR(l.LOAN_DATE, 'YYYY-MM-DD') AS LOAN_DATE,
          l.SURRENDER_VALUE_AT_LOAN,
          l.MAX_ELIGIBLE_LOAN,
          l.DISBURSED_AMOUNT,
          l.INTEREST_RATE_PCT,
          l.OUTSTANDING_PRINCIPAL,
          l.ACCRUED_INTEREST,
          l.TOTAL_INTEREST_PAID,
          l.TOTAL_PRINCIPAL_REPAID,
          l.GL_VOUCHER_NO,
          l.STATUS,
          l.IS_ACTIVE,
          l.CREATED_BY,
          TO_CHAR(l.CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON,
          a.PAS_NAME AS CUSTOMER_NAME,
          pr.PROD_NAME
        FROM T_POLICY_LOAN l
        LEFT JOIN T_POLICY_INFO p ON p.POL_NO = l.POL_NO
        LEFT JOIN T_POLICY_ASSURED a ON a.POL_NO = l.POL_NO
        LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = p.POL_PROD_CODE
        WHERE l.IS_ACTIVE = 'Y'
      `;
      const binds: any = {};
      if (status && status !== 'ALL') {
        sql += ` AND l.STATUS = :status`;
        binds.status = status;
      }
      if (search && search.trim()) {
        sql += ` AND (
          UPPER(l.LOAN_NO) LIKE UPPER(:search) OR
          UPPER(l.POL_NO) LIKE UPPER(:search) OR
          UPPER(a.PAS_NAME) LIKE UPPER(:search)
        )`;
        binds.search = `%${search.trim()}%`;
      }
      sql += ` ORDER BY l.LOAN_ID DESC`;

      const res = await connection.execute<PolicyLoanRecord>(sql, binds);
      return res.rows || [];
    } finally {
      if (connection) await releaseConnection(connection);
    }
  },

  // ===========================================================================
  // 6. GENERAL LEDGER (GL) ACCOUNTING ENTRIES QUERY
  // ===========================================================================

  /**
   * List all GL Journal entries
   */
  async getJournalEntries(
    voucherNo?: string,
    sourceRefNo?: string,
    txnSource?: string
  ): Promise<GLJournalEntryRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      let sql = `
        SELECT 
          ENTRY_ID,
          JOURNAL_VOUCHER_NO,
          TO_CHAR(VOUCHER_DATE, 'YYYY-MM-DD HH24:MI:SS') AS VOUCHER_DATE,
          TXN_SOURCE,
          SOURCE_REF_NO,
          GL_ACCOUNT_CODE,
          GL_ACCOUNT_NAME,
          DR_CR_FLAG,
          AMOUNT,
          NARRATION,
          CREATED_BY,
          TO_CHAR(CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
        FROM T_GL_JOURNAL_ENTRY
        WHERE 1=1
      `;
      const binds: any = {};
      if (voucherNo && voucherNo.trim()) {
        sql += ` AND UPPER(JOURNAL_VOUCHER_NO) LIKE UPPER(:voucherNo)`;
        binds.voucherNo = `%${voucherNo.trim()}%`;
      }
      if (sourceRefNo && sourceRefNo.trim()) {
        sql += ` AND UPPER(SOURCE_REF_NO) LIKE UPPER(:sourceRefNo)`;
        binds.sourceRefNo = `%${sourceRefNo.trim()}%`;
      }
      if (txnSource && txnSource !== 'ALL') {
        sql += ` AND TXN_SOURCE = :txnSource`;
        binds.txnSource = txnSource;
      }
      sql += ` ORDER BY ENTRY_ID DESC`;

      const res = await connection.execute<GLJournalEntryRecord>(sql, binds);
      return res.rows || [];
    } finally {
      if (connection) await releaseConnection(connection);
    }
  }
};
