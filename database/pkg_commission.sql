-- ============================================================================
-- KINS ENTERPRISE LIFE INSURANCE CORE SYSTEM
-- PL/SQL PACKAGE: PKG_COMMISSION
-- Handles Product-wise (default) and Optional Cover-wise Commission Calculation
-- for Broker, Agent with Hierarchy (Direct + Overriding Commissions), and Other Channels,
-- plus Approval and Balanced Double-Entry GL Accounting (T_GL_JOURNAL_ENTRY).
-- ============================================================================

CREATE OR REPLACE PACKAGE PKG_COMMISSION AS

  -- Generate unique Policy Commission Number (COM-YYYYMM-00001)
  FUNCTION FN_GENERATE_COMM_NO RETURN VARCHAR2;

  -- Resolve applicable active Commission Structure:
  -- 1) Checks Cover-wise override first (if p_cover_code IS NOT NULL)
  -- 2) Falls back to Product-wise default (COVER_CODE IS NULL)
  FUNCTION FN_GET_APPLICABLE_STRUCT(
    p_channel_code          IN VARCHAR2,
    p_prod_code             IN VARCHAR2,
    p_cover_code            IN VARCHAR2 DEFAULT NULL,
    p_as_of_date            IN DATE DEFAULT SYSDATE
  ) RETURN NUMBER;

  -- Calculate & store Policy-wise Commission (handles Agent Hierarchy + Broker + Any Channel;
  -- Product-wise by default, or Cover-wise automatically when Cover-wise rules exist)
  PROCEDURE SP_CALCULATE_POLICY_COMMISSION(
    p_pol_no                IN VARCHAR2,
    p_lob_type              IN VARCHAR2,
    p_intermediary_id       IN NUMBER,
    p_prem_type             IN VARCHAR2 DEFAULT 'FY',
    p_user                  IN VARCHAR2 DEFAULT 'ADMIN',
    p_out_comm_no           OUT VARCHAR2,
    p_out_total_comm        OUT NUMBER,
    p_out_total_pct         OUT NUMBER
  );

  -- Post Balanced Double-Entry GL Voucher for Approved Policy Commission
  -- Dr 530100 (Commission Expense) / Cr 230100 (Commission Payable)
  PROCEDURE SP_POST_COMMISSION_GL(
    p_comm_no               IN VARCHAR2,
    p_user                  IN VARCHAR2,
    p_out_voucher_no        OUT VARCHAR2
  );

  -- Approve Policy Commission and Post GL Accounting Entries
  PROCEDURE SP_APPROVE_COMMISSION(
    p_comm_no               IN VARCHAR2,
    p_remarks               IN VARCHAR2,
    p_user                  IN VARCHAR2,
    p_out_voucher_no        OUT VARCHAR2
  );

END PKG_COMMISSION;
/

CREATE OR REPLACE PACKAGE BODY PKG_COMMISSION AS

  FUNCTION FN_GENERATE_COMM_NO RETURN VARCHAR2 IS
    v_seq NUMBER;
  BEGIN
    SELECT SEQ_POL_COMM_ID.NEXTVAL INTO v_seq FROM DUAL;
    RETURN 'COM-' || TO_CHAR(SYSDATE, 'YYYYMM') || '-' || LPAD(v_seq, 5, '0');
  END FN_GENERATE_COMM_NO;

  FUNCTION FN_GET_APPLICABLE_STRUCT(
    p_channel_code          IN VARCHAR2,
    p_prod_code             IN VARCHAR2,
    p_cover_code            IN VARCHAR2 DEFAULT NULL,
    p_as_of_date            IN DATE DEFAULT SYSDATE
  ) RETURN NUMBER IS
    v_struct_id NUMBER := NULL;
  BEGIN
    -- 1. Try Cover-wise structure first if cover_code is supplied
    IF p_cover_code IS NOT NULL THEN
      BEGIN
        SELECT STRUCT_ID INTO v_struct_id
        FROM (
          SELECT STRUCT_ID
          FROM T_COMM_STRUCTURE
          WHERE CHANNEL_CODE = p_channel_code
            AND PROD_CODE = p_prod_code
            AND COVER_CODE = p_cover_code
            AND CALC_BASIS = 'COVER'
            AND STATUS = 'ACTIVE'
            AND IS_ACTIVE = 'Y'
            AND TRUNC(p_as_of_date) BETWEEN TRUNC(EFFECTIVE_FROM) AND TRUNC(EFFECTIVE_TO)
          ORDER BY STRUCT_ID DESC
        )
        WHERE ROWNUM = 1;
        RETURN v_struct_id;
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          v_struct_id := NULL;
      END;
    END IF;

    -- 2. Fallback to Product-wise default structure (COVER_CODE IS NULL)
    BEGIN
      SELECT STRUCT_ID INTO v_struct_id
      FROM (
        SELECT STRUCT_ID
        FROM T_COMM_STRUCTURE
        WHERE CHANNEL_CODE = p_channel_code
          AND PROD_CODE = p_prod_code
          AND COVER_CODE IS NULL
          AND CALC_BASIS = 'PRODUCT'
          AND STATUS = 'ACTIVE'
          AND IS_ACTIVE = 'Y'
          AND TRUNC(p_as_of_date) BETWEEN TRUNC(EFFECTIVE_FROM) AND TRUNC(EFFECTIVE_TO)
        ORDER BY STRUCT_ID DESC
      )
      WHERE ROWNUM = 1;
      RETURN v_struct_id;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        RETURN NULL;
    END;
  END FN_GET_APPLICABLE_STRUCT;

  -- Internal helper to insert commission detail rows by walking up the Intermediary Hierarchy
  PROCEDURE SP_INSERT_HIERARCHY_LINES(
    p_comm_id               IN NUMBER,
    p_struct_id             IN NUMBER,
    p_struct_code           IN VARCHAR2,
    p_cover_code            IN VARCHAR2,
    p_cover_name            IN VARCHAR2,
    p_base_premium          IN NUMBER,
    p_start_interm_id       IN NUMBER,
    p_prem_type             IN VARCHAR2,
    p_io_direct_comm        IN OUT NUMBER,
    p_io_override_comm      IN OUT NUMBER
  ) IS
    v_curr_id         NUMBER := p_start_interm_id;
    v_int_code        VARCHAR2(30);
    v_int_name        VARCHAR2(200);
    v_hier_level      VARCHAR2(40);
    v_parent_id       NUMBER;
    v_comm_pct        NUMBER;
    v_tier_order      NUMBER;
    v_is_override     CHAR(1);
    v_comm_amt        NUMBER;
    v_depth           NUMBER := 0;
  BEGIN
    IF NVL(p_base_premium, 0) <= 0 OR p_struct_id IS NULL THEN
      RETURN;
    END IF;

    -- Walk up the hierarchy chain (max 10 levels guard against accidental cycles)
    WHILE v_curr_id IS NOT NULL AND v_depth < 10 LOOP
      v_depth := v_depth + 1;

      SELECT INTERMEDIARY_CODE, INTERMEDIARY_NAME, HIERARCHY_LEVEL, PARENT_INTERMEDIARY_ID
      INTO v_int_code, v_int_name, v_hier_level, v_parent_id
      FROM T_COMM_INTERMEDIARY
      WHERE INTERMEDIARY_ID = v_curr_id AND IS_ACTIVE = 'Y';

      -- Look up tier rate matching this intermediary's HIERARCHY_LEVEL
      BEGIN
        SELECT
          CASE WHEN UPPER(NVL(p_prem_type, 'FY')) = 'RN' THEN NVL(RENEWAL_COMM_PCT, 0) ELSE NVL(COMM_PCT, 0) END,
          TIER_ORDER,
          OVERRIDING_YN
        INTO v_comm_pct, v_tier_order, v_is_override
        FROM (
          SELECT COMM_PCT, RENEWAL_COMM_PCT, TIER_ORDER, OVERRIDING_YN
          FROM T_COMM_STRUCTURE_TIER
          WHERE STRUCT_ID = p_struct_id
            AND HIERARCHY_LEVEL = v_hier_level
            AND IS_ACTIVE = 'Y'
          ORDER BY TIER_ORDER ASC
        )
        WHERE ROWNUM = 1;
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          -- If this is the direct/writing intermediary (depth=1) and structure has a single default tier, use it
          IF v_depth = 1 THEN
            BEGIN
              SELECT
                CASE WHEN UPPER(NVL(p_prem_type, 'FY')) = 'RN' THEN NVL(RENEWAL_COMM_PCT, 0) ELSE NVL(COMM_PCT, 0) END,
                TIER_ORDER,
                OVERRIDING_YN
              INTO v_comm_pct, v_tier_order, v_is_override
              FROM (
                SELECT COMM_PCT, RENEWAL_COMM_PCT, TIER_ORDER, OVERRIDING_YN
                FROM T_COMM_STRUCTURE_TIER
                WHERE STRUCT_ID = p_struct_id
                  AND IS_ACTIVE = 'Y'
                ORDER BY TIER_ORDER ASC
              )
              WHERE ROWNUM = 1;
            EXCEPTION
              WHEN NO_DATA_FOUND THEN
                v_comm_pct := 0;
                v_tier_order := v_depth;
                v_is_override := CASE WHEN v_depth = 1 THEN 'N' ELSE 'Y' END;
            END;
          ELSE
            v_comm_pct := 0;
            v_tier_order := v_depth;
            v_is_override := 'Y';
          END IF;
      END;

      IF NVL(v_comm_pct, 0) > 0 THEN
        v_comm_amt := ROUND(p_base_premium * (v_comm_pct / 100), 3);

        INSERT INTO T_POLICY_COMMISSION_DETAIL (
          DETAIL_ID, COMM_ID, STRUCT_ID, STRUCT_CODE,
          COVER_CODE, COVER_NAME, BASE_PREMIUM,
          INTERMEDIARY_ID, INTERMEDIARY_CODE, INTERMEDIARY_NAME,
          HIERARCHY_LEVEL, TIER_ORDER, IS_OVERRIDE_YN,
          COMM_PCT, COMM_AMOUNT, IS_ACTIVE, CREATED_ON
        ) VALUES (
          SEQ_POL_COMM_DTL_ID.NEXTVAL, p_comm_id, p_struct_id, p_struct_code,
          p_cover_code, p_cover_name, p_base_premium,
          v_curr_id, v_int_code, v_int_name,
          v_hier_level, v_tier_order, CASE WHEN v_depth = 1 THEN 'N' ELSE 'Y' END,
          v_comm_pct, v_comm_amt, 'Y', SYSDATE
        );

        IF v_depth = 1 THEN
          p_io_direct_comm := p_io_direct_comm + v_comm_amt;
        ELSE
          p_io_override_comm := p_io_override_comm + v_comm_amt;
        END IF;
      END IF;

      v_curr_id := v_parent_id;
    END LOOP;
  END SP_INSERT_HIERARCHY_LINES;

  PROCEDURE SP_CALCULATE_POLICY_COMMISSION(
    p_pol_no                IN VARCHAR2,
    p_lob_type              IN VARCHAR2,
    p_intermediary_id       IN NUMBER,
    p_prem_type             IN VARCHAR2 DEFAULT 'FY',
    p_user                  IN VARCHAR2 DEFAULT 'ADMIN',
    p_out_comm_no           OUT VARCHAR2,
    p_out_total_comm        OUT NUMBER,
    p_out_total_pct         OUT NUMBER
  ) IS
    v_lob             VARCHAR2(10) := UPPER(NVL(p_lob_type, 'IL'));
    v_prem_type       VARCHAR2(10) := UPPER(NVL(p_prem_type, 'FY'));
    v_prod_code       VARCHAR2(30);
    v_insured_name    VARCHAR2(200);
    v_policy_prem     NUMBER := 0;
    v_basic_prem      NUMBER := 0;

    v_channel_code    VARCHAR2(30);
    v_interm_code     VARCHAR2(30);
    v_interm_name     VARCHAR2(200);

    v_prod_struct_id  NUMBER;
    v_prod_struct_cd  VARCHAR2(40);
    v_cover_struct_cnt NUMBER := 0;
    v_calc_basis      VARCHAR2(20) := 'PRODUCT';

    v_approved_cnt    NUMBER := 0;
    v_comm_id         NUMBER;
    v_direct_comm     NUMBER := 0;
    v_override_comm   NUMBER := 0;
    v_total_comm      NUMBER := 0;
    v_total_pct       NUMBER := 0;

    v_cov_struct_id   NUMBER;
    v_cov_struct_cd   VARCHAR2(40);
    v_cover_rows_done NUMBER := 0;
    v_basic_cov_cd    VARCHAR2(30);
    v_basic_cov_nm    VARCHAR2(150);
  BEGIN
    -- 1. Guard against recalculating an already APPROVED / PAID commission for same Policy + Prem Type
    SELECT COUNT(1) INTO v_approved_cnt
    FROM T_POLICY_COMMISSION
    WHERE POL_NO = p_pol_no
      AND PREM_TYPE = v_prem_type
      AND COMM_STATUS IN ('APPROVED', 'PAID')
      AND IS_ACTIVE = 'Y';

    IF v_approved_cnt > 0 THEN
      RAISE_APPLICATION_ERROR(-20503, 'Policy ' || p_pol_no || ' (' || v_prem_type || ') already has an APPROVED commission. Recalculation is not permitted.');
    END IF;

    -- 2. Fetch Intermediary details
    BEGIN
      SELECT CHANNEL_CODE, INTERMEDIARY_CODE, INTERMEDIARY_NAME
      INTO v_channel_code, v_interm_code, v_interm_name
      FROM T_COMM_INTERMEDIARY
      WHERE INTERMEDIARY_ID = p_intermediary_id
        AND IS_ACTIVE = 'Y'
        AND STATUS = 'ACTIVE';
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20501, 'Selected Intermediary is not found or not ACTIVE.');
    END;

    -- 3. Fetch Policy details & Premium (IL vs GL)
    IF v_lob = 'GL' THEN
      BEGIN
        SELECT PROD_CODE, CORP_NAME, NVL(TOTAL_INFORCE_PREMIUM, 0)
        INTO v_prod_code, v_insured_name, v_policy_prem
        FROM T_GL_POLICY_MASTER
        WHERE MASTER_POLICY_NO = p_pol_no AND IS_ACTIVE = 'Y';
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          RAISE_APPLICATION_ERROR(-20502, 'Group Life Policy ' || p_pol_no || ' not found.');
      END;
    ELSE
      BEGIN
        SELECT
          p.POL_PROD_CODE,
          NVL((SELECT MAX(a.PAS_NAME) FROM T_POLICY_ASSURED a WHERE a.POL_NO = p.POL_NO AND a.IS_ACTIVE = 'Y'), p.POL_NO),
          NVL(ps.PPS_NET_ANNUAL_PREM, NVL(p.POL_INSTALLMENT_PREM, 0)),
          NVL(ps.PPS_BASIC_PREMIUM, NVL(ps.PPS_NET_ANNUAL_PREM, 0))
        INTO v_prod_code, v_insured_name, v_policy_prem, v_basic_prem
        FROM T_POLICY_INFO p
        LEFT JOIN T_POLICY_PREMIUM_SUMMARY ps ON ps.POL_NO = p.POL_NO AND ps.IS_ACTIVE = 'Y'
        WHERE p.POL_NO = p_pol_no AND p.IS_ACTIVE = 'Y'
          AND ROWNUM = 1;
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          RAISE_APPLICATION_ERROR(-20502, 'Individual Life Policy ' || p_pol_no || ' not found.');
      END;
    END IF;

    IF NVL(v_policy_prem, 0) <= 0 THEN
      RAISE_APPLICATION_ERROR(-20504, 'Policy ' || p_pol_no || ' has zero premium; cannot calculate commission.');
    END IF;

    -- 4. Resolve Default Product-wise Commission Structure & Check if Cover-wise Overrides exist
    v_prod_struct_id := FN_GET_APPLICABLE_STRUCT(v_channel_code, v_prod_code, NULL, SYSDATE);

    SELECT COUNT(1) INTO v_cover_struct_cnt
    FROM T_COMM_STRUCTURE
    WHERE CHANNEL_CODE = v_channel_code
      AND PROD_CODE = v_prod_code
      AND CALC_BASIS = 'COVER'
      AND COVER_CODE IS NOT NULL
      AND STATUS = 'ACTIVE'
      AND IS_ACTIVE = 'Y'
      AND TRUNC(SYSDATE) BETWEEN TRUNC(EFFECTIVE_FROM) AND TRUNC(EFFECTIVE_TO);

    IF v_prod_struct_id IS NULL AND v_cover_struct_cnt = 0 THEN
      RAISE_APPLICATION_ERROR(-20505, 'No active Commission Structure defined for Channel [' || v_channel_code || '] and Product [' || v_prod_code || '].');
    END IF;

    IF v_prod_struct_id IS NOT NULL THEN
      SELECT STRUCT_CODE INTO v_prod_struct_cd FROM T_COMM_STRUCTURE WHERE STRUCT_ID = v_prod_struct_id;
    END IF;

    IF v_cover_struct_cnt > 0 THEN
      v_calc_basis := 'COVER';
    ELSE
      v_calc_basis := 'PRODUCT';
    END IF;

    -- 5. Deactivate any previous draft CALCULATED commission for same Policy + Prem Type
    UPDATE T_POLICY_COMMISSION
    SET IS_ACTIVE = 'N', MODIFIED_BY = p_user, MODIFIED_ON = SYSDATE
    WHERE POL_NO = p_pol_no
      AND PREM_TYPE = v_prem_type
      AND COMM_STATUS = 'CALCULATED'
      AND IS_ACTIVE = 'Y';

    -- 6. Insert Header Record
    SELECT SEQ_POL_COMM_ID.NEXTVAL INTO v_comm_id FROM DUAL;
    p_out_comm_no := 'COM-' || TO_CHAR(SYSDATE, 'YYYYMM') || '-' || LPAD(v_comm_id, 5, '0');

    INSERT INTO T_POLICY_COMMISSION (
      COMM_ID, COMM_NO, POL_NO, LOB_TYPE, INSURED_NAME, PROD_CODE,
      CHANNEL_CODE, INTERMEDIARY_ID, INTERMEDIARY_CODE, INTERMEDIARY_NAME,
      STRUCT_ID, STRUCT_CODE, CALC_BASIS, PREM_TYPE,
      POLICY_PREMIUM, TOTAL_COMM_PCT, TOTAL_COMM_AMOUNT,
      DIRECT_COMM_AMOUNT, OVERRIDE_COMM_AMOUNT,
      COMM_STATUS, GL_POSTED_YN, IS_ACTIVE, CREATED_BY, CREATED_ON
    ) VALUES (
      v_comm_id, p_out_comm_no, p_pol_no, v_lob, v_insured_name, v_prod_code,
      v_channel_code, p_intermediary_id, v_interm_code, v_interm_name,
      v_prod_struct_id, v_prod_struct_cd, v_calc_basis, v_prem_type,
      v_policy_prem, 0, 0, 0, 0,
      'CALCULATED', 'N', 'Y', NVL(p_user, 'ADMIN'), SYSDATE
    );

    -- 7. Calculate Commission Details
    IF v_calc_basis = 'COVER' THEN
      IF v_lob = 'GL' THEN
        -- Group Life cover-wise premiums from T_GL_POLICY_MEMBER_COVER
        FOR cov IN (
          SELECT COVER_CODE, MAX(COVER_NAME) AS COVER_NAME, SUM(NVL(NET_PREMIUM, 0)) AS COV_PREM
          FROM T_GL_POLICY_MEMBER_COVER
          WHERE MASTER_POLICY_NO = p_pol_no AND IS_ACTIVE = 'Y'
          GROUP BY COVER_CODE
          HAVING SUM(NVL(NET_PREMIUM, 0)) > 0
        ) LOOP
          v_cover_rows_done := v_cover_rows_done + 1;
          v_cov_struct_id := FN_GET_APPLICABLE_STRUCT(v_channel_code, v_prod_code, cov.COVER_CODE, SYSDATE);
          IF v_cov_struct_id IS NOT NULL THEN
            SELECT STRUCT_CODE INTO v_cov_struct_cd FROM T_COMM_STRUCTURE WHERE STRUCT_ID = v_cov_struct_id;
            SP_INSERT_HIERARCHY_LINES(
              v_comm_id, v_cov_struct_id, v_cov_struct_cd,
              cov.COVER_CODE, cov.COVER_NAME, cov.COV_PREM,
              p_intermediary_id, v_prem_type, v_direct_comm, v_override_comm
            );
          END IF;
        END LOOP;
      ELSE
        -- Individual Life: Basic cover + Riders from T_POLICY_RIDER
        IF NVL(v_basic_prem, 0) > 0 THEN
          BEGIN
            SELECT c.COVER_CODE, c.COVER_DESC
            INTO v_basic_cov_cd, v_basic_cov_nm
            FROM MTBL_PROD_COVER pc
            JOIN MTBL_COVER c ON c.COVER_CODE = pc.MPC_COVER_CODE
            WHERE pc.MPC_PROD_CODE = v_prod_code AND pc.MPC_DEFAULT_YN = 'Y' AND ROWNUM = 1;
          EXCEPTION
            WHEN NO_DATA_FOUND THEN
              v_basic_cov_cd := 'BASIC';
              v_basic_cov_nm := 'Basic Life Cover';
          END;

          v_cover_rows_done := v_cover_rows_done + 1;
          v_cov_struct_id := FN_GET_APPLICABLE_STRUCT(v_channel_code, v_prod_code, v_basic_cov_cd, SYSDATE);
          IF v_cov_struct_id IS NOT NULL THEN
            SELECT STRUCT_CODE INTO v_cov_struct_cd FROM T_COMM_STRUCTURE WHERE STRUCT_ID = v_cov_struct_id;
            SP_INSERT_HIERARCHY_LINES(
              v_comm_id, v_cov_struct_id, v_cov_struct_cd,
              v_basic_cov_cd, v_basic_cov_nm, v_basic_prem,
              p_intermediary_id, v_prem_type, v_direct_comm, v_override_comm
            );
          END IF;
        END IF;

        FOR rdr IN (
          SELECT PRD_RIDER_CODE AS COVER_CODE, PRD_RIDER_NAME AS COVER_NAME, NVL(PRD_PREMIUM, 0) AS COV_PREM
          FROM T_POLICY_RIDER
          WHERE POL_NO = p_pol_no AND IS_ACTIVE = 'Y' AND NVL(PRD_PREMIUM, 0) > 0
        ) LOOP
          v_cover_rows_done := v_cover_rows_done + 1;
          v_cov_struct_id := FN_GET_APPLICABLE_STRUCT(v_channel_code, v_prod_code, rdr.COVER_CODE, SYSDATE);
          IF v_cov_struct_id IS NOT NULL THEN
            SELECT STRUCT_CODE INTO v_cov_struct_cd FROM T_COMM_STRUCTURE WHERE STRUCT_ID = v_cov_struct_id;
            SP_INSERT_HIERARCHY_LINES(
              v_comm_id, v_cov_struct_id, v_cov_struct_cd,
              rdr.COVER_CODE, rdr.COVER_NAME, rdr.COV_PREM,
              p_intermediary_id, v_prem_type, v_direct_comm, v_override_comm
            );
          END IF;
        END LOOP;
      END IF;

      -- If no cover rows were present on the policy, fall back to Product-wise calculation
      IF v_cover_rows_done = 0 AND v_prod_struct_id IS NOT NULL THEN
        v_calc_basis := 'PRODUCT';
        SP_INSERT_HIERARCHY_LINES(
          v_comm_id, v_prod_struct_id, v_prod_struct_cd,
          NULL, 'Product-level Default (' || v_prod_code || ')', v_policy_prem,
          p_intermediary_id, v_prem_type, v_direct_comm, v_override_comm
        );
      END IF;
    ELSE
      -- Product-wise Default Calculation
      SP_INSERT_HIERARCHY_LINES(
        v_comm_id, v_prod_struct_id, v_prod_struct_cd,
        NULL, 'Product-level Default (' || v_prod_code || ')', v_policy_prem,
        p_intermediary_id, v_prem_type, v_direct_comm, v_override_comm
      );
    END IF;

    -- 8. Update Header Totals
    v_total_comm := ROUND(v_direct_comm + v_override_comm, 3);
    v_total_pct  := CASE WHEN v_policy_prem > 0 THEN ROUND((v_total_comm / v_policy_prem) * 100, 2) ELSE 0 END;

    UPDATE T_POLICY_COMMISSION
    SET CALC_BASIS           = v_calc_basis,
        TOTAL_COMM_PCT       = v_total_pct,
        TOTAL_COMM_AMOUNT    = v_total_comm,
        DIRECT_COMM_AMOUNT   = ROUND(v_direct_comm, 3),
        OVERRIDE_COMM_AMOUNT = ROUND(v_override_comm, 3),
        MODIFIED_BY          = NVL(p_user, 'ADMIN'),
        MODIFIED_ON          = SYSDATE
    WHERE COMM_ID = v_comm_id;

    p_out_total_comm := v_total_comm;
    p_out_total_pct  := v_total_pct;

    COMMIT;
  END SP_CALCULATE_POLICY_COMMISSION;

  PROCEDURE SP_POST_COMMISSION_GL(
    p_comm_no               IN VARCHAR2,
    p_user                  IN VARCHAR2,
    p_out_voucher_no        OUT VARCHAR2
  ) IS
    v_pol_no          VARCHAR2(40);
    v_total_comm      NUMBER;
    v_gl_posted       CHAR(1);
    v_interm_name     VARCHAR2(200);
    v_channel_code    VARCHAR2(30);
    v_vch_seq         NUMBER;
  BEGIN
    SELECT POL_NO, TOTAL_COMM_AMOUNT, GL_POSTED_YN, INTERMEDIARY_NAME, CHANNEL_CODE
    INTO v_pol_no, v_total_comm, v_gl_posted, v_interm_name, v_channel_code
    FROM T_POLICY_COMMISSION
    WHERE COMM_NO = p_comm_no AND IS_ACTIVE = 'Y';

    IF v_gl_posted = 'Y' THEN
      SELECT GL_VOUCHER_NO INTO p_out_voucher_no FROM T_POLICY_COMMISSION WHERE COMM_NO = p_comm_no;
      RETURN;
    END IF;

    IF NVL(v_total_comm, 0) <= 0 THEN
      RAISE_APPLICATION_ERROR(-20506, 'Commission amount must be greater than zero to post GL entries.');
    END IF;

    SELECT SEQ_VOUCHER_ID.NEXTVAL INTO v_vch_seq FROM DUAL;
    p_out_voucher_no := 'JV-COM-' || LPAD(v_vch_seq, 6, '0');

    -- Debit: Commission Expense (530100)
    INSERT INTO T_GL_JOURNAL_ENTRY (
      ENTRY_ID, JOURNAL_VOUCHER_NO, VOUCHER_DATE, TXN_SOURCE, SOURCE_REF_NO,
      GL_ACCOUNT_CODE, GL_ACCOUNT_NAME, DR_CR_FLAG, AMOUNT, NARRATION, CREATED_BY, CREATED_ON
    ) VALUES (
      SEQ_VOUCHER_ID.NEXTVAL, p_out_voucher_no, SYSDATE, 'COMMISSION', p_comm_no,
      '530100', 'Commission Expense (' || v_channel_code || ')', 'D', ROUND(v_total_comm, 2),
      'Policy Commission Expense for ' || v_pol_no || ' - ' || v_interm_name,
      NVL(p_user, 'ADMIN'), SYSDATE
    );

    -- Credit: Commission Payable to Intermediaries (230100)
    INSERT INTO T_GL_JOURNAL_ENTRY (
      ENTRY_ID, JOURNAL_VOUCHER_NO, VOUCHER_DATE, TXN_SOURCE, SOURCE_REF_NO,
      GL_ACCOUNT_CODE, GL_ACCOUNT_NAME, DR_CR_FLAG, AMOUNT, NARRATION, CREATED_BY, CREATED_ON
    ) VALUES (
      SEQ_VOUCHER_ID.NEXTVAL, p_out_voucher_no, SYSDATE, 'COMMISSION', p_comm_no,
      '230100', 'Commission Payable to Intermediaries', 'C', ROUND(v_total_comm, 2),
      'Commission Payable for ' || v_pol_no || ' (' || p_comm_no || ')',
      NVL(p_user, 'ADMIN'), SYSDATE
    );

    UPDATE T_POLICY_COMMISSION
    SET GL_POSTED_YN  = 'Y',
        GL_VOUCHER_NO = p_out_voucher_no,
        MODIFIED_BY   = NVL(p_user, 'ADMIN'),
        MODIFIED_ON   = SYSDATE
    WHERE COMM_NO = p_comm_no;
  END SP_POST_COMMISSION_GL;

  PROCEDURE SP_APPROVE_COMMISSION(
    p_comm_no               IN VARCHAR2,
    p_remarks               IN VARCHAR2,
    p_user                  IN VARCHAR2,
    p_out_voucher_no        OUT VARCHAR2
  ) IS
    v_status VARCHAR2(25);
  BEGIN
    SELECT COMM_STATUS INTO v_status
    FROM T_POLICY_COMMISSION
    WHERE COMM_NO = p_comm_no AND IS_ACTIVE = 'Y';

    IF v_status IN ('APPROVED', 'PAID') THEN
      RAISE_APPLICATION_ERROR(-20507, 'Commission ' || p_comm_no || ' is already ' || v_status || '.');
    END IF;

    UPDATE T_POLICY_COMMISSION
    SET COMM_STATUS      = 'APPROVED',
        APPROVED_BY      = NVL(p_user, 'ADMIN'),
        APPROVED_ON      = SYSDATE,
        APPROVAL_REMARKS = p_remarks,
        MODIFIED_BY      = NVL(p_user, 'ADMIN'),
        MODIFIED_ON      = SYSDATE
    WHERE COMM_NO = p_comm_no;

    SP_POST_COMMISSION_GL(p_comm_no, p_user, p_out_voucher_no);
    COMMIT;
  END SP_APPROVE_COMMISSION;

END PKG_COMMISSION;
/
