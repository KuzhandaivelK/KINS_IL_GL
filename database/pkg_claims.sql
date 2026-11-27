-- ============================================================================
-- KINS ENTERPRISE LIFE INSURANCE CORE SYSTEM
-- PL/SQL PACKAGE: PKG_CLAIMS
-- Handles FNOL Numbering, Net Payable Valuation, Claim Assessment,
-- Claim Settlement, and Balanced Double-Entry GL Accounting (T_GL_JOURNAL_ENTRY)
-- ============================================================================

CREATE OR REPLACE PACKAGE PKG_CLAIMS AS

  -- Generate next Claim No: CLM-YYYYMM-XXXXX
  FUNCTION FN_GENERATE_CLAIM_NO RETURN VARCHAR2;

  -- Calculate Net Claim Payable after additions and deductions
  FUNCTION FN_CALCULATE_NET_PAYABLE(
    p_base_sa          IN NUMBER,
    p_rider_amt        IN NUMBER DEFAULT 0,
    p_bonus_amt        IN NUMBER DEFAULT 0,
    p_loan_ded         IN NUMBER DEFAULT 0,
    p_unpaid_prem_ded  IN NUMBER DEFAULT 0,
    p_other_ded        IN NUMBER DEFAULT 0
  ) RETURN NUMBER;

  -- Stage 2: Assess Claim & calculate admissible/net payable amounts
  PROCEDURE SP_ASSESS_CLAIM(
    p_claim_no              IN VARCHAR2,
    p_policy_inforce_yn     IN CHAR,
    p_waiting_period_ok_yn  IN CHAR,
    p_exclusion_app_yn      IN CHAR,
    p_exclusion_remarks     IN VARCHAR2,
    p_base_sa               IN NUMBER,
    p_rider_amt             IN NUMBER,
    p_bonus_amt             IN NUMBER,
    p_loan_ded              IN NUMBER,
    p_unpaid_prem_ded       IN NUMBER,
    p_other_ded             IN NUMBER,
    p_decision              IN VARCHAR2,
    p_assessor_remarks      IN VARCHAR2,
    p_user                  IN VARCHAR2,
    p_out_gross             OUT NUMBER,
    p_out_net_payable       OUT NUMBER
  );

  -- Stage 4: Post balanced double-entry Accounting Voucher into T_GL_JOURNAL_ENTRY
  PROCEDURE SP_POST_CLAIM_GL(
    p_claim_no              IN VARCHAR2,
    p_settlement_no         IN VARCHAR2,
    p_lob_type              IN VARCHAR2,
    p_gross_amount          IN NUMBER,
    p_loan_ded              IN NUMBER,
    p_unpaid_prem_ded       IN NUMBER,
    p_other_ded             IN NUMBER,
    p_net_payable           IN NUMBER,
    p_payee_name            IN VARCHAR2,
    p_user                  IN VARCHAR2,
    p_out_voucher_no        OUT VARCHAR2
  );

  -- Stage 3: Settle Approved Claim, post GL accounting entries, update policy status
  PROCEDURE SP_SETTLE_CLAIM(
    p_claim_no              IN VARCHAR2,
    p_payee_name            IN VARCHAR2,
    p_payee_relation        IN VARCHAR2,
    p_payee_bank_name       IN VARCHAR2,
    p_payee_account_no      IN VARCHAR2,
    p_payee_iban            IN VARCHAR2,
    p_payment_mode          IN VARCHAR2,
    p_payment_ref_no        IN VARCHAR2,
    p_remarks               IN VARCHAR2,
    p_user                  IN VARCHAR2,
    p_out_settlement_no     OUT VARCHAR2,
    p_out_voucher_no        OUT VARCHAR2,
    p_out_settled_amount    OUT NUMBER
  );

END PKG_CLAIMS;
/

CREATE OR REPLACE PACKAGE BODY PKG_CLAIMS AS

  FUNCTION FN_GENERATE_CLAIM_NO RETURN VARCHAR2 IS
    v_seq NUMBER;
  BEGIN
    SELECT SEQ_CLAIM_ID.NEXTVAL INTO v_seq FROM DUAL;
    RETURN 'CLM-' || TO_CHAR(SYSDATE, 'YYYYMM') || '-' || LPAD(v_seq, 5, '0');
  END FN_GENERATE_CLAIM_NO;

  FUNCTION FN_CALCULATE_NET_PAYABLE(
    p_base_sa          IN NUMBER,
    p_rider_amt        IN NUMBER DEFAULT 0,
    p_bonus_amt        IN NUMBER DEFAULT 0,
    p_loan_ded         IN NUMBER DEFAULT 0,
    p_unpaid_prem_ded  IN NUMBER DEFAULT 0,
    p_other_ded        IN NUMBER DEFAULT 0
  ) RETURN NUMBER IS
    v_gross NUMBER;
    v_ded   NUMBER;
    v_net   NUMBER;
  BEGIN
    v_gross := NVL(p_base_sa, 0) + NVL(p_rider_amt, 0) + NVL(p_bonus_amt, 0);
    v_ded   := NVL(p_loan_ded, 0) + NVL(p_unpaid_prem_ded, 0) + NVL(p_other_ded, 0);
    v_net   := GREATEST(0, ROUND(v_gross - v_ded, 2));
    RETURN v_net;
  END FN_CALCULATE_NET_PAYABLE;

  PROCEDURE SP_ASSESS_CLAIM(
    p_claim_no              IN VARCHAR2,
    p_policy_inforce_yn     IN CHAR,
    p_waiting_period_ok_yn  IN CHAR,
    p_exclusion_app_yn      IN CHAR,
    p_exclusion_remarks     IN VARCHAR2,
    p_base_sa               IN NUMBER,
    p_rider_amt             IN NUMBER,
    p_bonus_amt             IN NUMBER,
    p_loan_ded              IN NUMBER,
    p_unpaid_prem_ded       IN NUMBER,
    p_other_ded             IN NUMBER,
    p_decision              IN VARCHAR2,
    p_assessor_remarks      IN VARCHAR2,
    p_user                  IN VARCHAR2,
    p_out_gross             OUT NUMBER,
    p_out_net_payable       OUT NUMBER
  ) IS
    v_curr_status VARCHAR2(30);
    v_next_status VARCHAR2(30);
  BEGIN
    SELECT CLAIM_STATUS INTO v_curr_status
    FROM T_CLAIM_MASTER
    WHERE CLAIM_NO = p_claim_no;

    IF v_curr_status IN ('SETTLED', 'REJECTED', 'CLOSED') THEN
      RAISE_APPLICATION_ERROR(-20301, 'Claim ' || p_claim_no || ' is already ' || v_curr_status || ' and cannot be reassessed.');
    END IF;

    p_out_gross := ROUND(NVL(p_base_sa, 0) + NVL(p_rider_amt, 0) + NVL(p_bonus_amt, 0), 2);
    p_out_net_payable := FN_CALCULATE_NET_PAYABLE(
      p_base_sa, p_rider_amt, p_bonus_amt,
      p_loan_ded, p_unpaid_prem_ded, p_other_ded
    );

    -- Remove previous assessment draft if re-assessing before approval
    DELETE FROM T_CLAIM_ASSESSMENT WHERE CLAIM_NO = p_claim_no;

    INSERT INTO T_CLAIM_ASSESSMENT (
      ASSESSMENT_ID, CLAIM_NO, POLICY_INFORCE_YN, WAITING_PERIOD_OK_YN,
      EXCLUSION_APPLICABLE_YN, EXCLUSION_REMARKS,
      BASE_SUM_ASSURED, RIDER_BENEFIT_AMOUNT, BONUS_AMOUNT, GROSS_ADMISSIBLE_AMOUNT,
      LOAN_DEDUCTION, UNPAID_PREM_DEDUCTION, OTHER_DEDUCTION, NET_PAYABLE_AMOUNT,
      ASSESSMENT_DECISION, ASSESSOR_REMARKS, ASSESSED_BY, ASSESSED_ON
    ) VALUES (
      SEQ_CLAIM_ASSESS_ID.NEXTVAL, p_claim_no, NVL(p_policy_inforce_yn, 'Y'), NVL(p_waiting_period_ok_yn, 'Y'),
      NVL(p_exclusion_app_yn, 'N'), p_exclusion_remarks,
      NVL(p_base_sa, 0), NVL(p_rider_amt, 0), NVL(p_bonus_amt, 0), p_out_gross,
      NVL(p_loan_ded, 0), NVL(p_unpaid_prem_ded, 0), NVL(p_other_ded, 0), p_out_net_payable,
      p_decision, p_assessor_remarks, NVL(p_user, 'ADMIN'), SYSDATE
    );

    IF p_decision = 'INVESTIGATION_REQUIRED' THEN
      v_next_status := 'UNDER_ASSESSMENT';
    ELSE
      v_next_status := 'ASSESSED';
    END IF;

    UPDATE T_CLAIM_MASTER
    SET CLAIM_STATUS = v_next_status,
        ESTIMATED_RESERVE = p_out_net_payable,
        MODIFIED_BY = NVL(p_user, 'ADMIN'),
        MODIFIED_ON = SYSDATE
    WHERE CLAIM_NO = p_claim_no;

    INSERT INTO T_CLAIM_AUDIT_LOG (
      AUDIT_ID, CLAIM_NO, ACTION_TYPE, FROM_STATUS, TO_STATUS, ACTION_BY, ACTION_ON, REMARKS
    ) VALUES (
      SEQ_CLAIM_AUDIT_ID.NEXTVAL, p_claim_no, 'ASSESSMENT', v_curr_status, v_next_status,
      NVL(p_user, 'ADMIN'), SYSDATE,
      'Decision: ' || p_decision || ' | Gross: ' || TO_CHAR(p_out_gross) || ' | Net Payable: ' || TO_CHAR(p_out_net_payable) ||
      CASE WHEN p_assessor_remarks IS NOT NULL THEN ' | ' || p_assessor_remarks ELSE '' END
    );
  END SP_ASSESS_CLAIM;

  PROCEDURE SP_POST_CLAIM_GL(
    p_claim_no              IN VARCHAR2,
    p_settlement_no         IN VARCHAR2,
    p_lob_type              IN VARCHAR2,
    p_gross_amount          IN NUMBER,
    p_loan_ded              IN NUMBER,
    p_unpaid_prem_ded       IN NUMBER,
    p_other_ded             IN NUMBER,
    p_net_payable           IN NUMBER,
    p_payee_name            IN VARCHAR2,
    p_user                  IN VARCHAR2,
    p_out_voucher_no        OUT VARCHAR2
  ) IS
    v_vch_seq     NUMBER;
    v_exp_code    VARCHAR2(30);
    v_exp_name    VARCHAR2(150);
    v_total_dr    NUMBER := 0;
    v_total_cr    NUMBER := 0;
  BEGIN
    SELECT SEQ_VOUCHER_ID.NEXTVAL INTO v_vch_seq FROM DUAL;
    p_out_voucher_no := 'JV-CLM-' || LPAD(v_vch_seq, 6, '0');

    IF p_lob_type = 'GL' THEN
      v_exp_code := '510200';
      v_exp_name := 'Claims Incurred - Group Life';
    ELSE
      v_exp_code := '510100';
      v_exp_name := 'Claims Incurred - Individual Life';
    END IF;

    -- 1. DEBIT: Claims Incurred Expense (Gross Admissible Claim Amount)
    INSERT INTO T_GL_JOURNAL_ENTRY (
      ENTRY_ID, JOURNAL_VOUCHER_NO, VOUCHER_DATE, TXN_SOURCE, SOURCE_REF_NO,
      GL_ACCOUNT_CODE, GL_ACCOUNT_NAME, DR_CR_FLAG, AMOUNT, NARRATION, CREATED_BY, CREATED_ON
    ) VALUES (
      SEQ_VOUCHER_ID.NEXTVAL, p_out_voucher_no, SYSDATE, 'CLAIM_SETTLEMENT', p_claim_no,
      v_exp_code, v_exp_name, 'D', ROUND(p_gross_amount, 2),
      'Claim settlement incurred for ' || p_claim_no || ' (' || p_settlement_no || ') - Payee: ' || p_payee_name,
      NVL(p_user, 'SYSTEM'), SYSDATE
    );
    v_total_dr := v_total_dr + ROUND(p_gross_amount, 2);

    -- 2. CREDIT: Policy Loan Recovery (if deducted)
    IF NVL(p_loan_ded, 0) > 0 THEN
      INSERT INTO T_GL_JOURNAL_ENTRY (
        ENTRY_ID, JOURNAL_VOUCHER_NO, VOUCHER_DATE, TXN_SOURCE, SOURCE_REF_NO,
        GL_ACCOUNT_CODE, GL_ACCOUNT_NAME, DR_CR_FLAG, AMOUNT, NARRATION, CREATED_BY, CREATED_ON
      ) VALUES (
        SEQ_VOUCHER_ID.NEXTVAL, p_out_voucher_no, SYSDATE, 'CLAIM_SETTLEMENT', p_claim_no,
        '120200', 'Policy Loan Receivable Recovery', 'C', ROUND(p_loan_ded, 2),
        'Outstanding policy loan adjusted from claim ' || p_claim_no,
        NVL(p_user, 'SYSTEM'), SYSDATE
      );
      v_total_cr := v_total_cr + ROUND(p_loan_ded, 2);
    END IF;

    -- 3. CREDIT: Unpaid Premium Recovery (if deducted)
    IF NVL(p_unpaid_prem_ded, 0) > 0 THEN
      INSERT INTO T_GL_JOURNAL_ENTRY (
        ENTRY_ID, JOURNAL_VOUCHER_NO, VOUCHER_DATE, TXN_SOURCE, SOURCE_REF_NO,
        GL_ACCOUNT_CODE, GL_ACCOUNT_NAME, DR_CR_FLAG, AMOUNT, NARRATION, CREATED_BY, CREATED_ON
      ) VALUES (
        SEQ_VOUCHER_ID.NEXTVAL, p_out_voucher_no, SYSDATE, 'CLAIM_SETTLEMENT', p_claim_no,
        '410100', 'Unpaid Modal Premium Recovery', 'C', ROUND(p_unpaid_prem_ded, 2),
        'Unpaid modal premium recovered from claim ' || p_claim_no,
        NVL(p_user, 'SYSTEM'), SYSDATE
      );
      v_total_cr := v_total_cr + ROUND(p_unpaid_prem_ded, 2);
    END IF;

    -- 4. CREDIT: Other Deductions / Recoveries (if any)
    IF NVL(p_other_ded, 0) > 0 THEN
      INSERT INTO T_GL_JOURNAL_ENTRY (
        ENTRY_ID, JOURNAL_VOUCHER_NO, VOUCHER_DATE, TXN_SOURCE, SOURCE_REF_NO,
        GL_ACCOUNT_CODE, GL_ACCOUNT_NAME, DR_CR_FLAG, AMOUNT, NARRATION, CREATED_BY, CREATED_ON
      ) VALUES (
        SEQ_VOUCHER_ID.NEXTVAL, p_out_voucher_no, SYSDATE, 'CLAIM_SETTLEMENT', p_claim_no,
        '410900', 'Claim Miscellaneous Recoveries / Deductions', 'C', ROUND(p_other_ded, 2),
        'Other deductions adjusted on claim ' || p_claim_no,
        NVL(p_user, 'SYSTEM'), SYSDATE
      );
      v_total_cr := v_total_cr + ROUND(p_other_ded, 2);
    END IF;

    -- 5. CREDIT: Claims Payable / Bank Disbursement Clearing (Net Settled Amount)
    IF NVL(p_net_payable, 0) > 0 THEN
      INSERT INTO T_GL_JOURNAL_ENTRY (
        ENTRY_ID, JOURNAL_VOUCHER_NO, VOUCHER_DATE, TXN_SOURCE, SOURCE_REF_NO,
        GL_ACCOUNT_CODE, GL_ACCOUNT_NAME, DR_CR_FLAG, AMOUNT, NARRATION, CREATED_BY, CREATED_ON
      ) VALUES (
        SEQ_VOUCHER_ID.NEXTVAL, p_out_voucher_no, SYSDATE, 'CLAIM_SETTLEMENT', p_claim_no,
        '210400', 'Claims Payable - Bank Disbursement Clearing', 'C', ROUND(p_net_payable, 2),
        'Net claim payout to ' || p_payee_name || ' for ' || p_claim_no || ' (' || p_settlement_no || ')',
        NVL(p_user, 'SYSTEM'), SYSDATE
      );
      v_total_cr := v_total_cr + ROUND(p_net_payable, 2);
    END IF;

    -- Enforce balanced double-entry accounting
    IF ABS(v_total_dr - v_total_cr) > 0.01 THEN
      RAISE_APPLICATION_ERROR(-20305, 'Unbalanced GL Voucher for ' || p_claim_no || ': DR=' || v_total_dr || ', CR=' || v_total_cr);
    END IF;
  END SP_POST_CLAIM_GL;

  PROCEDURE SP_SETTLE_CLAIM(
    p_claim_no              IN VARCHAR2,
    p_payee_name            IN VARCHAR2,
    p_payee_relation        IN VARCHAR2,
    p_payee_bank_name       IN VARCHAR2,
    p_payee_account_no      IN VARCHAR2,
    p_payee_iban            IN VARCHAR2,
    p_payment_mode          IN VARCHAR2,
    p_payment_ref_no        IN VARCHAR2,
    p_remarks               IN VARCHAR2,
    p_user                  IN VARCHAR2,
    p_out_settlement_no     OUT VARCHAR2,
    p_out_voucher_no        OUT VARCHAR2,
    p_out_settled_amount    OUT NUMBER
  ) IS
    v_curr_status     VARCHAR2(30);
    v_lob_type        VARCHAR2(10);
    v_pol_no          VARCHAR2(30);
    v_claim_type      VARCHAR2(30);
    v_gross_amt       NUMBER := 0;
    v_loan_ded        NUMBER := 0;
    v_prem_ded        NUMBER := 0;
    v_other_ded       NUMBER := 0;
    v_net_payable     NUMBER := 0;
    v_stl_seq         NUMBER;
  BEGIN
    SELECT CLAIM_STATUS, LOB_TYPE, POL_NO, CLAIM_TYPE
    INTO v_curr_status, v_lob_type, v_pol_no, v_claim_type
    FROM T_CLAIM_MASTER
    WHERE CLAIM_NO = p_claim_no;

    IF v_curr_status NOT IN ('APPROVED', 'ASSESSED') THEN
      RAISE_APPLICATION_ERROR(-20302, 'Claim ' || p_claim_no || ' must be ASSESSED or APPROVED before settlement. Current status: ' || v_curr_status);
    END IF;

    SELECT GROSS_ADMISSIBLE_AMOUNT, LOAN_DEDUCTION, UNPAID_PREM_DEDUCTION, OTHER_DEDUCTION, NET_PAYABLE_AMOUNT
    INTO v_gross_amt, v_loan_ded, v_prem_ded, v_other_ded, v_net_payable
    FROM T_CLAIM_ASSESSMENT
    WHERE CLAIM_NO = p_claim_no;

    SELECT SEQ_CLAIM_SETTLE_ID.NEXTVAL INTO v_stl_seq FROM DUAL;
    p_out_settlement_no := 'STL-' || TO_CHAR(SYSDATE, 'YYYYMM') || '-' || LPAD(v_stl_seq, 5, '0');
    p_out_settled_amount := v_net_payable;

    -- Post balanced double-entry GL accounting entries
    SP_POST_CLAIM_GL(
      p_claim_no        => p_claim_no,
      p_settlement_no   => p_out_settlement_no,
      p_lob_type        => v_lob_type,
      p_gross_amount    => v_gross_amt,
      p_loan_ded        => v_loan_ded,
      p_unpaid_prem_ded => v_prem_ded,
      p_other_ded       => v_other_ded,
      p_net_payable     => v_net_payable,
      p_payee_name      => p_payee_name,
      p_user            => p_user,
      p_out_voucher_no  => p_out_voucher_no
    );

    -- Record Settlement
    INSERT INTO T_CLAIM_SETTLEMENT (
      SETTLEMENT_ID, SETTLEMENT_NO, CLAIM_NO,
      PAYEE_NAME, PAYEE_RELATION, PAYEE_BANK_NAME, PAYEE_ACCOUNT_NO, PAYEE_IBAN,
      PAYMENT_MODE, PAYMENT_REF_NO,
      GROSS_AMOUNT, TOTAL_DEDUCTIONS, SETTLED_AMOUNT, SETTLEMENT_DATE,
      GL_VOUCHER_NO, GL_POSTED_YN, SETTLEMENT_STATUS,
      APPROVED_BY, APPROVED_ON, SETTLEMENT_REMARKS
    ) VALUES (
      v_stl_seq, p_out_settlement_no, p_claim_no,
      p_payee_name, p_payee_relation, p_payee_bank_name, p_payee_account_no, p_payee_iban,
      NVL(p_payment_mode, 'BANK_TRANSFER'), p_payment_ref_no,
      v_gross_amt, (v_loan_ded + v_prem_ded + v_other_ded), v_net_payable, SYSDATE,
      p_out_voucher_no, 'Y', 'PAID',
      NVL(p_user, 'ADMIN'), SYSDATE, p_remarks
    );

    -- Update Claim Status to SETTLED
    UPDATE T_CLAIM_MASTER
    SET CLAIM_STATUS = 'SETTLED',
        MODIFIED_BY = NVL(p_user, 'ADMIN'),
        MODIFIED_ON = SYSDATE
    WHERE CLAIM_NO = p_claim_no;

    -- For Individual Life Death / Accidental Death / PTD claims, mark policy as CLAIMED
    IF v_lob_type = 'IL' AND v_claim_type IN ('DEATH', 'ACCIDENTAL_DEATH', 'PTD') THEN
      UPDATE T_POLICY_INFO
      SET POL_STATUS = 'CLAIMED',
          MODIFIED_BY = NVL(p_user, 'ADMIN'),
          MODIFIED_ON = SYSDATE
      WHERE POL_NO = v_pol_no;
    END IF;

    -- If Policy Loan was deducted, mark active policy loans as SETTLED
    IF v_lob_type = 'IL' AND v_loan_ded > 0 THEN
      UPDATE T_POLICY_LOAN
      SET STATUS = 'SETTLED',
          OUTSTANDING_PRINCIPAL = 0
      WHERE POL_NO = v_pol_no AND STATUS = 'ACTIVE';
    END IF;

    -- Log audit entry
    INSERT INTO T_CLAIM_AUDIT_LOG (
      AUDIT_ID, CLAIM_NO, ACTION_TYPE, FROM_STATUS, TO_STATUS, ACTION_BY, ACTION_ON, REMARKS
    ) VALUES (
      SEQ_CLAIM_AUDIT_ID.NEXTVAL, p_claim_no, 'SETTLEMENT_AND_GL_POSTING', v_curr_status, 'SETTLED',
      NVL(p_user, 'ADMIN'), SYSDATE,
      'Settled ' || TO_CHAR(v_net_payable) || ' via ' || NVL(p_payment_mode, 'BANK_TRANSFER') ||
      ' to ' || p_payee_name || ' | Settlement: ' || p_out_settlement_no || ' | GL Voucher: ' || p_out_voucher_no
    );
  END SP_SETTLE_CLAIM;

END PKG_CLAIMS;
/
