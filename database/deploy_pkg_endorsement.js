const oracledb = require('oracledb');
require('dotenv').config({ path: './backend/.env' });

async function deployPackage() {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER || 'KINS',
      password: process.env.DB_PASSWORD || 'KINS',
      connectString: process.env.DB_CONNECT_STRING || 'localhost:1521/orcl'
    });
    console.log('--- Connected to Oracle Database to deploy PKG_POLICY_ENDORSEMENT ---');

    // 1. Package Specification
    const pkgSpec = `
CREATE OR REPLACE PACKAGE PKG_POLICY_ENDORSEMENT AS
  -- Lookup modal factor for premium frequency
  FUNCTION GET_MODAL_FACTOR(p_freq IN VARCHAR2) RETURN NUMBER;

  -- Statutory insurance tax rate (e.g. 0.18 for 18% GST)
  FUNCTION GET_TAX_RATE RETURN NUMBER;

  -- Calculate endorsement impact on basic premium, net annual premium, installment and tax
  PROCEDURE CALCULATE_ENDORSEMENT(
    p_pol_no              IN  VARCHAR2,
    p_endorsement_type    IN  VARCHAR2,
    p_new_sum_assured     IN  NUMBER DEFAULT NULL,
    p_new_pay_freq        IN  VARCHAR2 DEFAULT NULL,
    p_category            OUT VARCHAR2,
    p_old_sum_assured     OUT NUMBER,
    p_new_sum_assured_out OUT NUMBER,
    p_old_basic_prem      OUT NUMBER,
    p_new_basic_prem      OUT NUMBER,
    p_old_net_annual      OUT NUMBER,
    p_new_net_annual      OUT NUMBER,
    p_old_modal_factor    OUT NUMBER,
    p_new_modal_factor    OUT NUMBER,
    p_old_installment     OUT NUMBER,
    p_new_installment     OUT NUMBER,
    p_premium_impact      OUT NUMBER,
    p_new_tax_amount      OUT NUMBER,
    p_new_total_payable   OUT NUMBER,
    p_status              OUT VARCHAR2,
    p_err_msg             OUT VARCHAR2
  );

  -- Apply financial calculation results directly to T_POLICY_INFO and T_POLICY_PREMIUM_SUMMARY
  PROCEDURE APPLY_FINANCIAL_ENDORSEMENT(
    p_pol_no           IN  VARCHAR2,
    p_endorsement_type IN  VARCHAR2,
    p_new_sum_assured  IN  NUMBER DEFAULT NULL,
    p_new_pay_freq     IN  VARCHAR2 DEFAULT NULL,
    p_username         IN  VARCHAR2 DEFAULT 'SYSTEM',
    p_premium_impact   OUT NUMBER,
    p_new_installment  OUT NUMBER,
    p_new_total        OUT NUMBER,
    p_status           OUT VARCHAR2,
    p_err_msg          OUT VARCHAR2
  );
END PKG_POLICY_ENDORSEMENT;
    `;

    console.log('Deploying PKG_POLICY_ENDORSEMENT Specification...');
    await conn.execute(pkgSpec);
    console.log('✅ PKG_POLICY_ENDORSEMENT specification compiled successfully.');

    // 2. Package Body
    const pkgBody = `
CREATE OR REPLACE PACKAGE BODY PKG_POLICY_ENDORSEMENT AS

  FUNCTION GET_MODAL_FACTOR(p_freq IN VARCHAR2) RETURN NUMBER IS
    v_freq VARCHAR2(30);
  BEGIN
    v_freq := UPPER(TRIM(NVL(p_freq, 'ANNUAL')));
    CASE v_freq
      WHEN 'ANNUAL'      THEN RETURN 1.000;
      WHEN 'SEMI_ANNUAL' THEN RETURN 0.520;
      WHEN 'HALF_YEARLY' THEN RETURN 0.520;
      WHEN 'QUARTERLY'   THEN RETURN 0.265;
      WHEN 'MONTHLY'     THEN RETURN 0.088;
      WHEN 'SINGLE'      THEN RETURN 1.000;
      ELSE RETURN 1.000;
    END CASE;
  END GET_MODAL_FACTOR;

  FUNCTION GET_TAX_RATE RETURN NUMBER IS
  BEGIN
    RETURN 0.18; -- 18% Statutory GST
  END GET_TAX_RATE;

  PROCEDURE CALCULATE_ENDORSEMENT(
    p_pol_no              IN  VARCHAR2,
    p_endorsement_type    IN  VARCHAR2,
    p_new_sum_assured     IN  NUMBER DEFAULT NULL,
    p_new_pay_freq        IN  VARCHAR2 DEFAULT NULL,
    p_category            OUT VARCHAR2,
    p_old_sum_assured     OUT NUMBER,
    p_new_sum_assured_out OUT NUMBER,
    p_old_basic_prem      OUT NUMBER,
    p_new_basic_prem      OUT NUMBER,
    p_old_net_annual      OUT NUMBER,
    p_new_net_annual      OUT NUMBER,
    p_old_modal_factor    OUT NUMBER,
    p_new_modal_factor    OUT NUMBER,
    p_old_installment     OUT NUMBER,
    p_new_installment     OUT NUMBER,
    p_premium_impact      OUT NUMBER,
    p_new_tax_amount      OUT NUMBER,
    p_new_total_payable   OUT NUMBER,
    p_status              OUT VARCHAR2,
    p_err_msg             OUT VARCHAR2
  ) IS
    v_pol_status    VARCHAR2(30);
    v_curr_sa       NUMBER;
    v_curr_freq     VARCHAR2(30);
    v_rider_prem    NUMBER := 0;
    v_loading       NUMBER := 0;
    v_discount      NUMBER := 0;
    v_ratio         NUMBER;
    v_tax_rate      NUMBER;
  BEGIN
    p_status := 'SUCCESS';
    p_err_msg := NULL;
    v_tax_rate := GET_TAX_RATE;

    -- Retrieve current policy particulars
    BEGIN
      SELECT POL_STATUS, POL_SUM_ASSURED, POL_PAY_FREQ
      INTO v_pol_status, v_curr_sa, v_curr_freq
      FROM T_POLICY_INFO
      WHERE POL_NO = TRIM(p_pol_no);
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        p_status := 'ERROR';
        p_err_msg := 'Policy contract ' || p_pol_no || ' not found.';
        RETURN;
    END;

    -- Validate policy status
    IF v_pol_status NOT IN ('IN_FORCE', 'APPROVED') THEN
      p_status := 'ERROR';
      p_err_msg := 'Policy contract ' || p_pol_no || ' is in status ' || v_pol_status || '. Endorsements are allowed only on approved/in-force contracts.';
      RETURN;
    END IF;

    -- Retrieve premium summary particulars
    BEGIN
      SELECT
        NVL(PPS_BASIC_SUM_ASSURED, v_curr_sa),
        NVL(PPS_BASIC_PREMIUM, 0),
        NVL(PPS_TOTAL_RIDER_PREMIUM, 0),
        NVL(PPS_TOTAL_LOADING, 0),
        NVL(PPS_TOTAL_DISCOUNT, 0),
        NVL(PPS_NET_ANNUAL_PREM, 0),
        NVL(PPS_MODAL_FACTOR, GET_MODAL_FACTOR(v_curr_freq)),
        NVL(PPS_INSTALLMENT_PREM, 0),
        NVL(PPS_TAX_AMOUNT, 0),
        NVL(PPS_TOTAL_PAYABLE, 0)
      INTO
        p_old_sum_assured,
        p_old_basic_prem,
        v_rider_prem,
        v_loading,
        v_discount,
        p_old_net_annual,
        p_old_modal_factor,
        p_old_installment,
        p_new_tax_amount,
        p_new_total_payable
      FROM T_POLICY_PREMIUM_SUMMARY
      WHERE POL_NO = TRIM(p_pol_no);
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        p_old_sum_assured  := v_curr_sa;
        p_old_basic_prem   := 0;
        p_old_net_annual   := 0;
        p_old_modal_factor := GET_MODAL_FACTOR(v_curr_freq);
        p_old_installment  := 0;
    END;

    -- Default new values to current values
    p_new_sum_assured_out := NVL(p_new_sum_assured, p_old_sum_assured);
    p_new_basic_prem      := p_old_basic_prem;
    p_new_net_annual      := p_old_net_annual;
    p_new_modal_factor    := p_old_modal_factor;
    p_new_installment     := p_old_installment;
    p_premium_impact      := 0;

    -- Perform calculation by alteration type
    IF p_endorsement_type = 'SUM_ASSURED_CHANGE' THEN
      p_category := 'FINANCIAL';

      IF p_new_sum_assured IS NULL OR p_new_sum_assured < 1000 THEN
        p_status := 'ERROR';
        p_err_msg := 'New Sum Assured must be at least $1,000.';
        RETURN;
      END IF;

      IF p_old_sum_assured <= 0 THEN
        p_old_sum_assured := 1;
      END IF;

      v_ratio := p_new_sum_assured / p_old_sum_assured;
      p_new_basic_prem := ROUND(p_old_basic_prem * v_ratio, 2);
      p_new_net_annual := GREATEST(0, ROUND(p_new_basic_prem + v_rider_prem + v_loading - v_discount, 2));
      p_new_installment := ROUND(p_new_net_annual * p_new_modal_factor, 2);
      p_premium_impact  := ROUND(p_new_installment - p_old_installment, 2);
      p_new_tax_amount  := ROUND(p_new_installment * v_tax_rate, 2);
      p_new_total_payable := p_new_installment + p_new_tax_amount;

    ELSIF p_endorsement_type = 'FREQUENCY_CHANGE' THEN
      p_category := 'FINANCIAL';

      IF p_new_pay_freq IS NULL THEN
        p_status := 'ERROR';
        p_err_msg := 'New payment frequency must be specified.';
        RETURN;
      END IF;

      p_new_modal_factor := GET_MODAL_FACTOR(p_new_pay_freq);
      p_new_installment  := ROUND(p_old_net_annual * p_new_modal_factor, 2);
      p_premium_impact   := ROUND(p_new_installment - p_old_installment, 2);
      p_new_tax_amount   := ROUND(p_new_installment * v_tax_rate, 2);
      p_new_total_payable := p_new_installment + p_new_tax_amount;

    ELSE
      -- Non-financial alterations (ADDRESS_CONTACT, BENEFICIARY_CHANGE, GENERAL)
      p_category := 'NON_FINANCIAL';
      p_premium_impact := 0;
      p_new_tax_amount := ROUND(p_new_installment * v_tax_rate, 2);
      p_new_total_payable := p_new_installment + p_new_tax_amount;
    END IF;

  EXCEPTION
    WHEN OTHERS THEN
      p_status := 'ERROR';
      p_err_msg := 'Calculation error: ' || SQLERRM;
  END CALCULATE_ENDORSEMENT;

  PROCEDURE APPLY_FINANCIAL_ENDORSEMENT(
    p_pol_no           IN  VARCHAR2,
    p_endorsement_type IN  VARCHAR2,
    p_new_sum_assured  IN  NUMBER DEFAULT NULL,
    p_new_pay_freq     IN  VARCHAR2 DEFAULT NULL,
    p_username         IN  VARCHAR2 DEFAULT 'SYSTEM',
    p_premium_impact   OUT NUMBER,
    p_new_installment  OUT NUMBER,
    p_new_total        OUT NUMBER,
    p_status           OUT VARCHAR2,
    p_err_msg          OUT VARCHAR2
  ) IS
    v_cat          VARCHAR2(30);
    v_old_sa       NUMBER;
    v_new_sa       NUMBER;
    v_old_bp       NUMBER;
    v_new_bp       NUMBER;
    v_old_net      NUMBER;
    v_new_net      NUMBER;
    v_old_mf       NUMBER;
    v_new_mf       NUMBER;
    v_old_inst     NUMBER;
    v_new_inst     NUMBER;
    v_impact       NUMBER;
    v_new_tax      NUMBER;
    v_new_tot      NUMBER;
    v_calc_stat    VARCHAR2(30);
    v_calc_err     VARCHAR2(500);
  BEGIN
    -- 1. Execute DB-side calculation
    CALCULATE_ENDORSEMENT(
      p_pol_no              => p_pol_no,
      p_endorsement_type    => p_endorsement_type,
      p_new_sum_assured     => p_new_sum_assured,
      p_new_pay_freq        => p_new_pay_freq,
      p_category            => v_cat,
      p_old_sum_assured     => v_old_sa,
      p_new_sum_assured_out => v_new_sa,
      p_old_basic_prem      => v_old_bp,
      p_new_basic_prem      => v_new_bp,
      p_old_net_annual      => v_old_net,
      p_new_net_annual      => v_new_net,
      p_old_modal_factor    => v_old_mf,
      p_new_modal_factor    => v_new_mf,
      p_old_installment     => v_old_inst,
      p_new_installment     => v_new_inst,
      p_premium_impact      => v_impact,
      p_new_tax_amount      => v_new_tax,
      p_new_total_payable   => v_new_tot,
      p_status              => v_calc_stat,
      p_err_msg             => v_calc_err
    );

    IF v_calc_stat <> 'SUCCESS' THEN
      p_status := 'ERROR';
      p_err_msg := v_calc_err;
      RETURN;
    END IF;

    -- 2. Update T_POLICY_INFO
    UPDATE T_POLICY_INFO
    SET
      POL_SUM_ASSURED      = NVL(p_new_sum_assured, POL_SUM_ASSURED),
      POL_PAY_FREQ         = NVL(p_new_pay_freq, POL_PAY_FREQ),
      POL_INSTALLMENT_PREM = v_new_inst,
      MODIFIED_BY          = SUBSTR(p_username, 1, 26),
      MODIFIED_ON          = SYSDATE
    WHERE POL_NO = TRIM(p_pol_no);

    -- 3. Update T_POLICY_PREMIUM_SUMMARY
    UPDATE T_POLICY_PREMIUM_SUMMARY
    SET
      PPS_BASIC_SUM_ASSURED = NVL(p_new_sum_assured, PPS_BASIC_SUM_ASSURED),
      PPS_BASIC_PREMIUM     = v_new_bp,
      PPS_NET_ANNUAL_PREM   = v_new_net,
      PPS_MODAL_FACTOR      = v_new_mf,
      PPS_INSTALLMENT_PREM  = v_new_inst,
      PPS_TAX_AMOUNT        = v_new_tax,
      PPS_TOTAL_PAYABLE     = v_new_tot,
      MODIFIED_BY           = SUBSTR(p_username, 1, 26),
      MODIFIED_ON           = SYSDATE
    WHERE POL_NO = TRIM(p_pol_no);

    p_premium_impact  := v_impact;
    p_new_installment := v_new_inst;
    p_new_total       := v_new_tot;
    p_status          := 'SUCCESS';
    p_err_msg         := NULL;

  EXCEPTION
    WHEN OTHERS THEN
      p_status := 'ERROR';
      p_err_msg := 'Failed to apply financial endorsement in DB: ' || SQLERRM;
  END APPLY_FINANCIAL_ENDORSEMENT;

END PKG_POLICY_ENDORSEMENT;
    `;

    console.log('Deploying PKG_POLICY_ENDORSEMENT Body...');
    await conn.execute(pkgBody);
    console.log('✅ PKG_POLICY_ENDORSEMENT body compiled successfully.');

  } catch (err) {
    console.error('❌ Error deploying PKG_POLICY_ENDORSEMENT:', err);
    process.exit(1);
  } finally {
    if (conn) await conn.close();
  }
}

deployPackage();
