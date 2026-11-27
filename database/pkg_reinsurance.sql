-- ============================================================================
-- KINS ENTERPRISE LIFE INSURANCE CORE SYSTEM
-- PL/SQL PACKAGE: PKG_REINSURANCE
-- Handles Policy RI Allocation (Retention, Quota Share / CQS, Surplus, Facultative),
-- RI Approval Workflow, and Balanced Double-Entry GL Accounting (T_GL_JOURNAL_ENTRY)
-- ============================================================================

CREATE OR REPLACE PACKAGE PKG_REINSURANCE AS

  FUNCTION FN_GENERATE_ALLOC_NO RETURN VARCHAR2;

  -- Allocate a Policy's Sum Assured & Premium across active Treaty layers
  PROCEDURE SP_ALLOCATE_POLICY_RI(
    p_pol_no                IN VARCHAR2,
    p_lob_type              IN VARCHAR2,
    p_treaty_id             IN NUMBER,
    p_insured_name          IN VARCHAR2,
    p_prod_code             IN VARCHAR2,
    p_policy_sa             IN NUMBER,
    p_policy_prem           IN NUMBER,
    p_user                  IN VARCHAR2,
    p_out_alloc_no          OUT VARCHAR2,
    p_out_retained_sa       OUT NUMBER,
    p_out_ceded_sa          OUT NUMBER,
    p_out_net_ceded_prem    OUT NUMBER
  );

  -- Post Balanced Double-Entry GL Voucher for RI Ceded Premium & RI Commission
  PROCEDURE SP_POST_RI_GL(
    p_alloc_no              IN VARCHAR2,
    p_user                  IN VARCHAR2,
    p_out_voucher_no        OUT VARCHAR2
  );

  -- Approve RI Allocation & Post GL Accounting Entries
  PROCEDURE SP_APPROVE_RI_ALLOCATION(
    p_alloc_no              IN VARCHAR2,
    p_remarks               IN VARCHAR2,
    p_user                  IN VARCHAR2,
    p_out_voucher_no        OUT VARCHAR2
  );

END PKG_REINSURANCE;
/

CREATE OR REPLACE PACKAGE BODY PKG_REINSURANCE AS

  FUNCTION FN_GENERATE_ALLOC_NO RETURN VARCHAR2 IS
    v_seq NUMBER;
  BEGIN
    SELECT SEQ_RI_ALLOC_ID.NEXTVAL INTO v_seq FROM DUAL;
    RETURN 'RIA-' || TO_CHAR(SYSDATE, 'YYYYMM') || '-' || LPAD(v_seq, 5, '0');
  END FN_GENERATE_ALLOC_NO;

  PROCEDURE SP_ALLOCATE_POLICY_RI(
    p_pol_no                IN VARCHAR2,
    p_lob_type              IN VARCHAR2,
    p_treaty_id             IN NUMBER,
    p_insured_name          IN VARCHAR2,
    p_prod_code             IN VARCHAR2,
    p_policy_sa             IN NUMBER,
    p_policy_prem           IN NUMBER,
    p_user                  IN VARCHAR2,
    p_out_alloc_no          OUT VARCHAR2,
    p_out_retained_sa       OUT NUMBER,
    p_out_ceded_sa          OUT NUMBER,
    p_out_net_ceded_prem    OUT NUMBER
  ) IS
    v_treaty_code     VARCHAR2(30);
    v_remaining_sa    NUMBER := NVL(p_policy_sa, 0);
    v_alloc_sa        NUMBER := 0;
    v_share_pct       NUMBER := 0;
    v_alloc_prem      NUMBER := 0;
    v_comm_amt        NUMBER := 0;
    v_net_ri          NUMBER := 0;

    v_tot_ret_sa      NUMBER := 0;
    v_tot_ceded_sa    NUMBER := 0;
    v_tot_ret_prem    NUMBER := 0;
    v_tot_gross_ceded NUMBER := 0;
    v_tot_comm        NUMBER := 0;
    v_tot_net_ceded   NUMBER := 0;
    v_max_order       NUMBER := 0;
    v_alloc_id        NUMBER;
  BEGIN
    IF NVL(p_policy_sa, 0) <= 0 THEN
      RAISE_APPLICATION_ERROR(-20401, 'Policy Sum Assured must be greater than zero for RI allocation.');
    END IF;

    SELECT TREATY_CODE INTO v_treaty_code
    FROM T_RI_TREATY_MASTER
    WHERE TREATY_ID = p_treaty_id AND IS_ACTIVE = 'Y';

    -- Deactivate any previous pending/rejected allocation for the same policy
    UPDATE T_RI_POLICY_ALLOCATION
    SET IS_ACTIVE = 'N'
    WHERE POL_NO = p_pol_no AND ALLOC_STATUS IN ('PENDING_RI_APPROVAL', 'REJECTED');

    SELECT SEQ_RI_ALLOC_ID.NEXTVAL INTO v_alloc_id FROM DUAL;
    p_out_alloc_no := 'RIA-' || TO_CHAR(SYSDATE, 'YYYYMM') || '-' || LPAD(v_alloc_id, 5, '0');

    -- Insert placeholder header first (for FK integrity)
    INSERT INTO T_RI_POLICY_ALLOCATION (
      ALLOC_ID, ALLOC_NO, POL_NO, LOB_TYPE, TREATY_ID, TREATY_CODE,
      INSURED_NAME, PROD_CODE, POLICY_SUM_ASSURED, POLICY_PREMIUM,
      ALLOC_STATUS, GL_POSTED_YN, IS_ACTIVE, CREATED_BY, CREATED_ON
    ) VALUES (
      v_alloc_id, p_out_alloc_no, p_pol_no, NVL(p_lob_type, 'IL'), p_treaty_id, v_treaty_code,
      p_insured_name, p_prod_code, p_policy_sa, NVL(p_policy_prem, 0),
      'PENDING_RI_APPROVAL', 'N', 'Y', NVL(p_user, 'ADMIN'), SYSDATE
    );

    -- Iterate through Treaty Layers in order
    FOR lyr IN (
      SELECT LAYER_ORDER, LAYER_TYPE, LAYER_NAME, REINSURER_NAME,
             NVL(CESSION_PCT, 0) AS CESSION_PCT,
             NVL(LIMIT_AMOUNT, 0) AS LIMIT_AMOUNT,
             NVL(RI_COMMISSION_PCT, 0) AS RI_COMMISSION_PCT
      FROM T_RI_TREATY_LAYER
      WHERE TREATY_ID = p_treaty_id AND IS_ACTIVE = 'Y'
      ORDER BY LAYER_ORDER ASC
    ) LOOP
      v_max_order := lyr.LAYER_ORDER;
      EXIT WHEN v_remaining_sa <= 0;

      IF lyr.LAYER_TYPE = 'QUOTA_SHARE' AND lyr.CESSION_PCT > 0 THEN
        -- Quota Share / CQS: takes % of policy SA capped at layer limit and remaining SA
        v_alloc_sa := ROUND(p_policy_sa * (lyr.CESSION_PCT / 100), 2);
        IF lyr.LIMIT_AMOUNT > 0 AND v_alloc_sa > lyr.LIMIT_AMOUNT THEN
          v_alloc_sa := lyr.LIMIT_AMOUNT;
        END IF;
        IF v_alloc_sa > v_remaining_sa THEN
          v_alloc_sa := v_remaining_sa;
        END IF;
      ELSE
        -- Retention or Surplus layer: takes up to LIMIT_AMOUNT from remaining SA
        IF lyr.LIMIT_AMOUNT > 0 THEN
          v_alloc_sa := LEAST(v_remaining_sa, lyr.LIMIT_AMOUNT);
        ELSE
          v_alloc_sa := v_remaining_sa;
        END IF;
      END IF;

      IF v_alloc_sa > 0 THEN
        v_share_pct  := ROUND((v_alloc_sa / p_policy_sa) * 100, 4);
        v_alloc_prem := ROUND(NVL(p_policy_prem, 0) * (v_alloc_sa / p_policy_sa), 2);

        IF lyr.LAYER_TYPE = 'RETENTION' THEN
          v_comm_amt := 0;
          v_net_ri   := 0;
          v_tot_ret_sa   := v_tot_ret_sa + v_alloc_sa;
          v_tot_ret_prem := v_tot_ret_prem + v_alloc_prem;
        ELSE
          v_comm_amt := ROUND(v_alloc_prem * (lyr.RI_COMMISSION_PCT / 100), 2);
          v_net_ri   := ROUND(v_alloc_prem - v_comm_amt, 2);
          v_tot_ceded_sa    := v_tot_ceded_sa + v_alloc_sa;
          v_tot_gross_ceded := v_tot_gross_ceded + v_alloc_prem;
          v_tot_comm        := v_tot_comm + v_comm_amt;
          v_tot_net_ceded   := v_tot_net_ceded + v_net_ri;
        END IF;

        INSERT INTO T_RI_POLICY_ALLOC_LAYER (
          ALLOC_LAYER_ID, ALLOC_NO, POL_NO, LAYER_ORDER, LAYER_TYPE, LAYER_NAME, REINSURER_NAME,
          ALLOCATED_SA, SHARE_PCT, ALLOCATED_PREMIUM, RI_COMMISSION_PCT, RI_COMMISSION_AMT, NET_PAYABLE_RI
        ) VALUES (
          SEQ_RI_ALLOC_LYR_ID.NEXTVAL, p_out_alloc_no, p_pol_no, lyr.LAYER_ORDER, lyr.LAYER_TYPE,
          lyr.LAYER_NAME, lyr.REINSURER_NAME, v_alloc_sa, v_share_pct, v_alloc_prem,
          CASE WHEN lyr.LAYER_TYPE = 'RETENTION' THEN 0 ELSE lyr.RI_COMMISSION_PCT END,
          v_comm_amt, v_net_ri
        );

        v_remaining_sa := ROUND(v_remaining_sa - v_alloc_sa, 2);
      END IF;
    END LOOP;

    -- Facultative Overflow if SA exceeds total Treaty capacity
    IF v_remaining_sa > 0 THEN
      v_alloc_sa   := v_remaining_sa;
      v_share_pct  := ROUND((v_alloc_sa / p_policy_sa) * 100, 4);
      v_alloc_prem := ROUND(NVL(p_policy_prem, 0) * (v_alloc_sa / p_policy_sa), 2);
      v_comm_amt   := ROUND(v_alloc_prem * 0.10, 2);
      v_net_ri     := ROUND(v_alloc_prem - v_comm_amt, 2);

      v_tot_ceded_sa    := v_tot_ceded_sa + v_alloc_sa;
      v_tot_gross_ceded := v_tot_gross_ceded + v_alloc_prem;
      v_tot_comm        := v_tot_comm + v_comm_amt;
      v_tot_net_ceded   := v_tot_net_ceded + v_net_ri;

      INSERT INTO T_RI_POLICY_ALLOC_LAYER (
        ALLOC_LAYER_ID, ALLOC_NO, POL_NO, LAYER_ORDER, LAYER_TYPE, LAYER_NAME, REINSURER_NAME,
        ALLOCATED_SA, SHARE_PCT, ALLOCATED_PREMIUM, RI_COMMISSION_PCT, RI_COMMISSION_AMT, NET_PAYABLE_RI
      ) VALUES (
        SEQ_RI_ALLOC_LYR_ID.NEXTVAL, p_out_alloc_no, p_pol_no, v_max_order + 1, 'FACULTATIVE',
        'Facultative Overflow Placement', 'Facultative RI Market', v_alloc_sa, v_share_pct, v_alloc_prem,
        10, v_comm_amt, v_net_ri
      );
    END IF;

    -- Update Header Totals
    UPDATE T_RI_POLICY_ALLOCATION
    SET RETAINED_SA         = ROUND(v_tot_ret_sa, 2),
        CEDED_SA            = ROUND(v_tot_ceded_sa, 2),
        RETAINED_PREMIUM    = ROUND(v_tot_ret_prem, 2),
        GROSS_CEDED_PREMIUM = ROUND(v_tot_gross_ceded, 2),
        TOTAL_RI_COMMISSION = ROUND(v_tot_comm, 2),
        NET_CEDED_PREMIUM   = ROUND(v_tot_net_ceded, 2)
    WHERE ALLOC_NO = p_out_alloc_no;

    p_out_retained_sa    := ROUND(v_tot_ret_sa, 2);
    p_out_ceded_sa       := ROUND(v_tot_ceded_sa, 2);
    p_out_net_ceded_prem := ROUND(v_tot_net_ceded, 2);
  END SP_ALLOCATE_POLICY_RI;

  PROCEDURE SP_POST_RI_GL(
    p_alloc_no              IN VARCHAR2,
    p_user                  IN VARCHAR2,
    p_out_voucher_no        OUT VARCHAR2
  ) IS
    v_pol_no       VARCHAR2(30);
    v_treaty_code  VARCHAR2(30);
    v_gross_ceded  NUMBER;
    v_total_comm   NUMBER;
    v_net_ceded    NUMBER;
    v_vch_seq      NUMBER;
    v_dr           NUMBER := 0;
    v_cr           NUMBER := 0;
  BEGIN
    SELECT POL_NO, TREATY_CODE, GROSS_CEDED_PREMIUM, TOTAL_RI_COMMISSION, NET_CEDED_PREMIUM
    INTO v_pol_no, v_treaty_code, v_gross_ceded, v_total_comm, v_net_ceded
    FROM T_RI_POLICY_ALLOCATION
    WHERE ALLOC_NO = p_alloc_no;

    IF NVL(v_gross_ceded, 0) <= 0 THEN
      p_out_voucher_no := 'NO_CESSION';
      RETURN;
    END IF;

    SELECT SEQ_VOUCHER_ID.NEXTVAL INTO v_vch_seq FROM DUAL;
    p_out_voucher_no := 'JV-RI-' || LPAD(v_vch_seq, 6, '0');

    -- 1. DEBIT: Reinsurance Premium Ceded (Gross Ceded Premium)
    INSERT INTO T_GL_JOURNAL_ENTRY (
      ENTRY_ID, JOURNAL_VOUCHER_NO, VOUCHER_DATE, TXN_SOURCE, SOURCE_REF_NO,
      GL_ACCOUNT_CODE, GL_ACCOUNT_NAME, DR_CR_FLAG, AMOUNT, NARRATION, CREATED_BY, CREATED_ON
    ) VALUES (
      SEQ_VOUCHER_ID.NEXTVAL, p_out_voucher_no, SYSDATE, 'RI_ALLOCATION', p_alloc_no,
      '520100', 'Reinsurance Premium Ceded', 'D', ROUND(v_gross_ceded, 2),
      'Gross RI premium ceded for policy ' || v_pol_no || ' under treaty ' || v_treaty_code,
      NVL(p_user, 'SYSTEM'), SYSDATE
    );
    v_dr := v_dr + ROUND(v_gross_ceded, 2);

    -- 2. CREDIT: Reinsurance Commission Earned (if > 0)
    IF NVL(v_total_comm, 0) > 0 THEN
      INSERT INTO T_GL_JOURNAL_ENTRY (
        ENTRY_ID, JOURNAL_VOUCHER_NO, VOUCHER_DATE, TXN_SOURCE, SOURCE_REF_NO,
        GL_ACCOUNT_CODE, GL_ACCOUNT_NAME, DR_CR_FLAG, AMOUNT, NARRATION, CREATED_BY, CREATED_ON
      ) VALUES (
        SEQ_VOUCHER_ID.NEXTVAL, p_out_voucher_no, SYSDATE, 'RI_ALLOCATION', p_alloc_no,
        '420100', 'Reinsurance Commission Earned', 'C', ROUND(v_total_comm, 2),
        'RI ceding commission earned on policy ' || v_pol_no || ' (' || p_alloc_no || ')',
        NVL(p_user, 'SYSTEM'), SYSDATE
      );
      v_cr := v_cr + ROUND(v_total_comm, 2);
    END IF;

    -- 3. CREDIT: Due to Reinsurers / Treaty Payable (Net Ceded Premium)
    IF NVL(v_net_ceded, 0) > 0 THEN
      INSERT INTO T_GL_JOURNAL_ENTRY (
        ENTRY_ID, JOURNAL_VOUCHER_NO, VOUCHER_DATE, TXN_SOURCE, SOURCE_REF_NO,
        GL_ACCOUNT_CODE, GL_ACCOUNT_NAME, DR_CR_FLAG, AMOUNT, NARRATION, CREATED_BY, CREATED_ON
      ) VALUES (
        SEQ_VOUCHER_ID.NEXTVAL, p_out_voucher_no, SYSDATE, 'RI_ALLOCATION', p_alloc_no,
        '220100', 'Due to Reinsurers - Treaty Payable', 'C', ROUND(v_net_ceded, 2),
        'Net RI ceded premium payable for policy ' || v_pol_no || ' (' || v_treaty_code || ')',
        NVL(p_user, 'SYSTEM'), SYSDATE
      );
      v_cr := v_cr + ROUND(v_net_ceded, 2);
    END IF;

    IF ABS(v_dr - v_cr) > 0.05 THEN
      RAISE_APPLICATION_ERROR(-20405, 'Unbalanced RI GL Voucher: DR=' || v_dr || ', CR=' || v_cr);
    END IF;
  END SP_POST_RI_GL;

  PROCEDURE SP_APPROVE_RI_ALLOCATION(
    p_alloc_no              IN VARCHAR2,
    p_remarks               IN VARCHAR2,
    p_user                  IN VARCHAR2,
    p_out_voucher_no        OUT VARCHAR2
  ) IS
    v_status VARCHAR2(30);
  BEGIN
    SELECT ALLOC_STATUS INTO v_status
    FROM T_RI_POLICY_ALLOCATION
    WHERE ALLOC_NO = p_alloc_no;

    IF v_status = 'APPROVED' THEN
      RAISE_APPLICATION_ERROR(-20402, 'RI Allocation ' || p_alloc_no || ' is already approved.');
    END IF;

    SP_POST_RI_GL(p_alloc_no, p_user, p_out_voucher_no);

    UPDATE T_RI_POLICY_ALLOCATION
    SET ALLOC_STATUS = 'APPROVED',
        GL_VOUCHER_NO = CASE WHEN p_out_voucher_no = 'NO_CESSION' THEN NULL ELSE p_out_voucher_no END,
        GL_POSTED_YN  = CASE WHEN p_out_voucher_no = 'NO_CESSION' THEN 'N' ELSE 'Y' END,
        APPROVED_BY   = NVL(p_user, 'RIUSER'),
        APPROVED_ON   = SYSDATE,
        REMARKS       = NVL(p_remarks, 'Approved by Reinsurance User')
    WHERE ALLOC_NO = p_alloc_no;
  END SP_APPROVE_RI_ALLOCATION;

END PKG_REINSURANCE;
/
