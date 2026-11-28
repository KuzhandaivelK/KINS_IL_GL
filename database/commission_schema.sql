-- ============================================================================
-- KINS ENTERPRISE LIFE INSURANCE CORE SYSTEM
-- MODULE: COMMISSION MANAGEMENT (BROKER, AGENT HIERARCHY & OTHER CHANNELS)
-- Supports Product-wise (Default) and Optional Cover-wise Commission Structures
-- Target Database: Oracle Database 19c Enterprise Edition
-- ============================================================================

-- 1. Create Sequences safely
DECLARE
  v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM user_sequences WHERE sequence_name = 'SEQ_COMM_INTERMED_ID';
  IF v_cnt = 0 THEN
    EXECUTE IMMEDIATE 'CREATE SEQUENCE SEQ_COMM_INTERMED_ID START WITH 101 INCREMENT BY 1 NOCACHE NOCYCLE';
  END IF;

  SELECT COUNT(*) INTO v_cnt FROM user_sequences WHERE sequence_name = 'SEQ_COMM_STRUCT_ID';
  IF v_cnt = 0 THEN
    EXECUTE IMMEDIATE 'CREATE SEQUENCE SEQ_COMM_STRUCT_ID START WITH 101 INCREMENT BY 1 NOCACHE NOCYCLE';
  END IF;

  SELECT COUNT(*) INTO v_cnt FROM user_sequences WHERE sequence_name = 'SEQ_COMM_TIER_ID';
  IF v_cnt = 0 THEN
    EXECUTE IMMEDIATE 'CREATE SEQUENCE SEQ_COMM_TIER_ID START WITH 1001 INCREMENT BY 1 NOCACHE NOCYCLE';
  END IF;

  SELECT COUNT(*) INTO v_cnt FROM user_sequences WHERE sequence_name = 'SEQ_POL_COMM_ID';
  IF v_cnt = 0 THEN
    EXECUTE IMMEDIATE 'CREATE SEQUENCE SEQ_POL_COMM_ID START WITH 10001 INCREMENT BY 1 NOCACHE NOCYCLE';
  END IF;

  SELECT COUNT(*) INTO v_cnt FROM user_sequences WHERE sequence_name = 'SEQ_POL_COMM_DTL_ID';
  IF v_cnt = 0 THEN
    EXECUTE IMMEDIATE 'CREATE SEQUENCE SEQ_POL_COMM_DTL_ID START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE';
  END IF;
END;
/

-- 2. Table: T_COMM_CHANNEL (Distribution Channels: Broker, Agent, Bancassurance, Corporate Agency, Direct, etc.)
DECLARE
  v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM user_tables WHERE table_name = 'T_COMM_CHANNEL';
  IF v_cnt = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE T_COMM_CHANNEL (
        CHANNEL_CODE                VARCHAR2(30)      NOT NULL,
        CHANNEL_NAME                VARCHAR2(150)     NOT NULL,
        SUPPORTS_HIERARCHY_YN       CHAR(1)           DEFAULT ''N'' NOT NULL,
        DESCRIPTION                 VARCHAR2(500),
        IS_ACTIVE                   CHAR(1)           DEFAULT ''Y'' NOT NULL,
        CREATED_BY                  VARCHAR2(50)      DEFAULT ''ADMIN'' NOT NULL,
        CREATED_ON                  DATE              DEFAULT SYSDATE NOT NULL,
        MODIFIED_BY                 VARCHAR2(50),
        MODIFIED_ON                 DATE,
        CONSTRAINT PK_T_COMM_CHANNEL PRIMARY KEY (CHANNEL_CODE),
        CONSTRAINT CHK_COMM_CH_HIER CHECK (SUPPORTS_HIERARCHY_YN IN (''Y'', ''N'')),
        CONSTRAINT CHK_COMM_CH_ACT CHECK (IS_ACTIVE IN (''Y'', ''N''))
      )
    ';
  END IF;
END;
/

-- 3. Table: T_COMM_INTERMEDIARY (Agents with Hierarchy, Brokers, and Other Channel Partners)
DECLARE
  v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM user_tables WHERE table_name = 'T_COMM_INTERMEDIARY';
  IF v_cnt = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE T_COMM_INTERMEDIARY (
        INTERMEDIARY_ID             NUMBER(10,0)      NOT NULL,
        INTERMEDIARY_CODE           VARCHAR2(30)      NOT NULL,
        INTERMEDIARY_NAME           VARCHAR2(200)     NOT NULL,
        CHANNEL_CODE                VARCHAR2(30)      NOT NULL,
        HIERARCHY_LEVEL             VARCHAR2(40)      DEFAULT ''DIRECT'' NOT NULL,
        PARENT_INTERMEDIARY_ID      NUMBER(10,0),
        LICENSE_NO                  VARCHAR2(60),
        EMAIL                       VARCHAR2(150),
        PHONE                       VARCHAR2(40),
        BRANCH_NAME                 VARCHAR2(100),
        STATUS                      VARCHAR2(20)      DEFAULT ''ACTIVE'' NOT NULL,
        IS_ACTIVE                   CHAR(1)           DEFAULT ''Y'' NOT NULL,
        CREATED_BY                  VARCHAR2(50)      DEFAULT ''ADMIN'' NOT NULL,
        CREATED_ON                  DATE              DEFAULT SYSDATE NOT NULL,
        MODIFIED_BY                 VARCHAR2(50),
        MODIFIED_ON                 DATE,
        CONSTRAINT PK_T_COMM_INTERMED PRIMARY KEY (INTERMEDIARY_ID),
        CONSTRAINT UQ_COMM_INTERMED_CD UNIQUE (INTERMEDIARY_CODE),
        CONSTRAINT FK_COMM_INT_CH FOREIGN KEY (CHANNEL_CODE) REFERENCES T_COMM_CHANNEL (CHANNEL_CODE),
        CONSTRAINT FK_COMM_INT_PAR FOREIGN KEY (PARENT_INTERMEDIARY_ID) REFERENCES T_COMM_INTERMEDIARY (INTERMEDIARY_ID),
        CONSTRAINT CHK_COMM_INT_ST CHECK (STATUS IN (''ACTIVE'', ''INACTIVE'', ''SUSPENDED'')),
        CONSTRAINT CHK_COMM_INT_ACT CHECK (IS_ACTIVE IN (''Y'', ''N''))
      )
    ';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_COMM_INT_CH ON T_COMM_INTERMEDIARY (CHANNEL_CODE, HIERARCHY_LEVEL)';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_COMM_INT_PAR ON T_COMM_INTERMEDIARY (PARENT_INTERMEDIARY_ID)';
  END IF;
END;
/

-- 4. Table: T_COMM_STRUCTURE (Product-wise Default & Optional Cover-wise Commission Definition Header)
DECLARE
  v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM user_tables WHERE table_name = 'T_COMM_STRUCTURE';
  IF v_cnt = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE T_COMM_STRUCTURE (
        STRUCT_ID                   NUMBER(10,0)      NOT NULL,
        STRUCT_CODE                 VARCHAR2(40)      NOT NULL,
        STRUCT_NAME                 VARCHAR2(200)     NOT NULL,
        CHANNEL_CODE                VARCHAR2(30)      NOT NULL,
        LOB_TYPE                    VARCHAR2(10)      DEFAULT ''IL'' NOT NULL,
        PROD_CODE                   VARCHAR2(30)      NOT NULL,
        COVER_CODE                  VARCHAR2(30),
        CALC_BASIS                  VARCHAR2(20)      DEFAULT ''PRODUCT'' NOT NULL,
        EFFECTIVE_FROM              DATE              NOT NULL,
        EFFECTIVE_TO                DATE              NOT NULL,
        STATUS                      VARCHAR2(20)      DEFAULT ''ACTIVE'' NOT NULL,
        REMARKS                     VARCHAR2(500),
        IS_ACTIVE                   CHAR(1)           DEFAULT ''Y'' NOT NULL,
        CREATED_BY                  VARCHAR2(50)      DEFAULT ''ADMIN'' NOT NULL,
        CREATED_ON                  DATE              DEFAULT SYSDATE NOT NULL,
        MODIFIED_BY                 VARCHAR2(50),
        MODIFIED_ON                 DATE,
        CONSTRAINT PK_T_COMM_STRUCT PRIMARY KEY (STRUCT_ID),
        CONSTRAINT UQ_COMM_STRUCT_CD UNIQUE (STRUCT_CODE),
        CONSTRAINT FK_COMM_STR_CH FOREIGN KEY (CHANNEL_CODE) REFERENCES T_COMM_CHANNEL (CHANNEL_CODE),
        CONSTRAINT CHK_COMM_STR_LOB CHECK (LOB_TYPE IN (''IL'', ''GL'', ''ALL'')),
        CONSTRAINT CHK_COMM_STR_BASIS CHECK (CALC_BASIS IN (''PRODUCT'', ''COVER'')),
        CONSTRAINT CHK_COMM_STR_ST CHECK (STATUS IN (''DRAFT'', ''ACTIVE'', ''EXPIRED'')),
        CONSTRAINT CHK_COMM_STR_ACT CHECK (IS_ACTIVE IN (''Y'', ''N''))
      )
    ';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_COMM_STR_LOOKUP ON T_COMM_STRUCTURE (CHANNEL_CODE, PROD_CODE, COVER_CODE, STATUS)';
  END IF;
END;
/

-- 5. Table: T_COMM_STRUCTURE_TIER (Commission Percentages by Hierarchy Level / Role)
DECLARE
  v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM user_tables WHERE table_name = 'T_COMM_STRUCTURE_TIER';
  IF v_cnt = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE T_COMM_STRUCTURE_TIER (
        TIER_ID                     NUMBER(10,0)      NOT NULL,
        STRUCT_ID                   NUMBER(10,0)      NOT NULL,
        TIER_ORDER                  NUMBER(3,0)       NOT NULL,
        HIERARCHY_LEVEL             VARCHAR2(40)      NOT NULL,
        TIER_LABEL                  VARCHAR2(120)     NOT NULL,
        COMM_PCT                    NUMBER(6,2)       DEFAULT 0 NOT NULL,
        RENEWAL_COMM_PCT            NUMBER(6,2)       DEFAULT 0 NOT NULL,
        OVERRIDING_YN               CHAR(1)           DEFAULT ''N'' NOT NULL,
        IS_ACTIVE                   CHAR(1)           DEFAULT ''Y'' NOT NULL,
        CREATED_BY                  VARCHAR2(50)      DEFAULT ''ADMIN'' NOT NULL,
        CREATED_ON                  DATE              DEFAULT SYSDATE NOT NULL,
        CONSTRAINT PK_T_COMM_TIER PRIMARY KEY (TIER_ID),
        CONSTRAINT FK_COMM_TIER_STR FOREIGN KEY (STRUCT_ID) REFERENCES T_COMM_STRUCTURE (STRUCT_ID) ON DELETE CASCADE,
        CONSTRAINT CHK_COMM_TIER_ORC CHECK (OVERRIDING_YN IN (''Y'', ''N'')),
        CONSTRAINT CHK_COMM_TIER_ACT CHECK (IS_ACTIVE IN (''Y'', ''N''))
      )
    ';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_COMM_TIER_STR ON T_COMM_STRUCTURE_TIER (STRUCT_ID, TIER_ORDER)';
  END IF;
END;
/

-- 6. Table: T_POLICY_COMMISSION (Policy-wise Commission Header)
DECLARE
  v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM user_tables WHERE table_name = 'T_POLICY_COMMISSION';
  IF v_cnt = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE T_POLICY_COMMISSION (
        COMM_ID                     NUMBER(10,0)      NOT NULL,
        COMM_NO                     VARCHAR2(30)      NOT NULL,
        POL_NO                      VARCHAR2(40)      NOT NULL,
        LOB_TYPE                    VARCHAR2(10)      DEFAULT ''IL'' NOT NULL,
        INSURED_NAME                VARCHAR2(200),
        PROD_CODE                   VARCHAR2(30)      NOT NULL,
        CHANNEL_CODE                VARCHAR2(30)      NOT NULL,
        INTERMEDIARY_ID             NUMBER(10,0)      NOT NULL,
        INTERMEDIARY_CODE           VARCHAR2(30)      NOT NULL,
        INTERMEDIARY_NAME           VARCHAR2(200)     NOT NULL,
        STRUCT_ID                   NUMBER(10,0),
        STRUCT_CODE                 VARCHAR2(40),
        CALC_BASIS                  VARCHAR2(20)      DEFAULT ''PRODUCT'' NOT NULL,
        PREM_TYPE                   VARCHAR2(10)      DEFAULT ''FY'' NOT NULL,
        POLICY_PREMIUM              NUMBER(17,3)      DEFAULT 0 NOT NULL,
        TOTAL_COMM_PCT              NUMBER(6,2)       DEFAULT 0 NOT NULL,
        TOTAL_COMM_AMOUNT           NUMBER(17,3)      DEFAULT 0 NOT NULL,
        DIRECT_COMM_AMOUNT          NUMBER(17,3)      DEFAULT 0 NOT NULL,
        OVERRIDE_COMM_AMOUNT        NUMBER(17,3)      DEFAULT 0 NOT NULL,
        COMM_STATUS                 VARCHAR2(25)      DEFAULT ''CALCULATED'' NOT NULL,
        GL_POSTED_YN                CHAR(1)           DEFAULT ''N'' NOT NULL,
        GL_VOUCHER_NO               VARCHAR2(40),
        APPROVED_BY                 VARCHAR2(50),
        APPROVED_ON                 DATE,
        APPROVAL_REMARKS            VARCHAR2(500),
        IS_ACTIVE                   CHAR(1)           DEFAULT ''Y'' NOT NULL,
        CREATED_BY                  VARCHAR2(50)      DEFAULT ''ADMIN'' NOT NULL,
        CREATED_ON                  DATE              DEFAULT SYSDATE NOT NULL,
        MODIFIED_BY                 VARCHAR2(50),
        MODIFIED_ON                 DATE,
        CONSTRAINT PK_T_POL_COMM PRIMARY KEY (COMM_ID),
        CONSTRAINT UQ_POL_COMM_NO UNIQUE (COMM_NO),
        CONSTRAINT FK_POL_COMM_INT FOREIGN KEY (INTERMEDIARY_ID) REFERENCES T_COMM_INTERMEDIARY (INTERMEDIARY_ID),
        CONSTRAINT CHK_POL_COMM_LOB CHECK (LOB_TYPE IN (''IL'', ''GL'')),
        CONSTRAINT CHK_POL_COMM_PT CHECK (PREM_TYPE IN (''FY'', ''RN'')),
        CONSTRAINT CHK_POL_COMM_ST CHECK (COMM_STATUS IN (''CALCULATED'', ''APPROVED'', ''PAID'', ''CANCELLED'')),
        CONSTRAINT CHK_POL_COMM_GL CHECK (GL_POSTED_YN IN (''Y'', ''N'')),
        CONSTRAINT CHK_POL_COMM_ACT CHECK (IS_ACTIVE IN (''Y'', ''N''))
      )
    ';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_POL_COMM_POL ON T_POLICY_COMMISSION (POL_NO, PREM_TYPE, IS_ACTIVE)';
  END IF;
END;
/

-- 7. Table: T_POLICY_COMMISSION_DETAIL (Hierarchy & Cover-wise Policy Commission Breakdown)
DECLARE
  v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM user_tables WHERE table_name = 'T_POLICY_COMMISSION_DETAIL';
  IF v_cnt = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE T_POLICY_COMMISSION_DETAIL (
        DETAIL_ID                   NUMBER(10,0)      NOT NULL,
        COMM_ID                     NUMBER(10,0)      NOT NULL,
        STRUCT_ID                   NUMBER(10,0),
        STRUCT_CODE                 VARCHAR2(40),
        COVER_CODE                  VARCHAR2(30),
        COVER_NAME                  VARCHAR2(150),
        BASE_PREMIUM                NUMBER(17,3)      DEFAULT 0 NOT NULL,
        INTERMEDIARY_ID             NUMBER(10,0)      NOT NULL,
        INTERMEDIARY_CODE           VARCHAR2(30)      NOT NULL,
        INTERMEDIARY_NAME           VARCHAR2(200)     NOT NULL,
        HIERARCHY_LEVEL             VARCHAR2(40)      NOT NULL,
        TIER_ORDER                  NUMBER(3,0)       DEFAULT 1 NOT NULL,
        IS_OVERRIDE_YN              CHAR(1)           DEFAULT ''N'' NOT NULL,
        COMM_PCT                    NUMBER(6,2)       DEFAULT 0 NOT NULL,
        COMM_AMOUNT                 NUMBER(17,3)      DEFAULT 0 NOT NULL,
        IS_ACTIVE                   CHAR(1)           DEFAULT ''Y'' NOT NULL,
        CREATED_ON                  DATE              DEFAULT SYSDATE NOT NULL,
        CONSTRAINT PK_T_POL_COMM_DTL PRIMARY KEY (DETAIL_ID),
        CONSTRAINT FK_POL_CDTL_HDR FOREIGN KEY (COMM_ID) REFERENCES T_POLICY_COMMISSION (COMM_ID) ON DELETE CASCADE,
        CONSTRAINT CHK_POL_CDTL_ORC CHECK (IS_OVERRIDE_YN IN (''Y'', ''N'')),
        CONSTRAINT CHK_POL_CDTL_ACT CHECK (IS_ACTIVE IN (''Y'', ''N''))
      )
    ';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_POL_CDTL_HDR ON T_POLICY_COMMISSION_DETAIL (COMM_ID, TIER_ORDER)';
  END IF;
END;
/

-- 8. Seed Distribution Channels (Broker, Agent with Hierarchy, Bancassurance, Corporate Agency, Direct Sales)
MERGE INTO T_COMM_CHANNEL tgt
USING (
  SELECT 'AGENT'            AS CHANNEL_CODE, 'Agency Force (With Hierarchy)' AS CHANNEL_NAME, 'Y' AS SUPPORTS_HIERARCHY_YN, 'Individual & Life Agents with multi-tier hierarchy (Agent -> Unit Mgr -> Branch Mgr -> Regional Dir)' AS DESCRIPTION FROM DUAL UNION ALL
  SELECT 'BROKER',           'Insurance Broker',                              'N', 'Licensed Insurance Brokers placing Individual & Group Life business' FROM DUAL UNION ALL
  SELECT 'BANCASSURANCE',    'Bancassurance Partner',                         'N', 'Bank & Financial Institution distribution partners' FROM DUAL UNION ALL
  SELECT 'CORPORATE_AGENCY', 'Corporate Agency',                              'N', 'Corporate Agencies and Affinity Partners' FROM DUAL UNION ALL
  SELECT 'DIRECT_SALES',     'Direct Sales Channel',                          'N', 'Direct sales executives and digital portal acquisitions' FROM DUAL
) src
ON (tgt.CHANNEL_CODE = src.CHANNEL_CODE)
WHEN NOT MATCHED THEN
  INSERT (CHANNEL_CODE, CHANNEL_NAME, SUPPORTS_HIERARCHY_YN, DESCRIPTION, IS_ACTIVE, CREATED_BY, CREATED_ON)
  VALUES (src.CHANNEL_CODE, src.CHANNEL_NAME, src.SUPPORTS_HIERARCHY_YN, src.DESCRIPTION, 'Y', 'ADMIN', SYSDATE);
/

-- 9. Seed Sample Intermediaries (4-Level Agent Hierarchy + Brokers + Bancassurance)
DECLARE
  v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM T_COMM_INTERMEDIARY;
  IF v_cnt = 0 THEN
    -- Level 4 (Top): Regional Director
    INSERT INTO T_COMM_INTERMEDIARY (
      INTERMEDIARY_ID, INTERMEDIARY_CODE, INTERMEDIARY_NAME, CHANNEL_CODE, HIERARCHY_LEVEL,
      PARENT_INTERMEDIARY_ID, LICENSE_NO, EMAIL, PHONE, BRANCH_NAME, STATUS, IS_ACTIVE, CREATED_BY
    ) VALUES (
      1, 'RD-001', 'Khalid Al-Harthi (Regional Director)', 'AGENT', 'REGIONAL_DIRECTOR',
      NULL, 'LIC-RD-2026-01', 'khalid.rd@kins.om', '+968-91001001', 'Muscat HQ', 'ACTIVE', 'Y', 'ADMIN'
    );

    -- Level 3: Branch Manager (reports to RD-001)
    INSERT INTO T_COMM_INTERMEDIARY (
      INTERMEDIARY_ID, INTERMEDIARY_CODE, INTERMEDIARY_NAME, CHANNEL_CODE, HIERARCHY_LEVEL,
      PARENT_INTERMEDIARY_ID, LICENSE_NO, EMAIL, PHONE, BRANCH_NAME, STATUS, IS_ACTIVE, CREATED_BY
    ) VALUES (
      2, 'BM-001', 'Fatima Al-Balushi (Branch Manager)', 'AGENT', 'BRANCH_MANAGER',
      1, 'LIC-BM-2026-01', 'fatima.bm@kins.om', '+968-91001002', 'Muscat Main Branch', 'ACTIVE', 'Y', 'ADMIN'
    );

    -- Level 2: Unit Manager (reports to BM-001)
    INSERT INTO T_COMM_INTERMEDIARY (
      INTERMEDIARY_ID, INTERMEDIARY_CODE, INTERMEDIARY_NAME, CHANNEL_CODE, HIERARCHY_LEVEL,
      PARENT_INTERMEDIARY_ID, LICENSE_NO, EMAIL, PHONE, BRANCH_NAME, STATUS, IS_ACTIVE, CREATED_BY
    ) VALUES (
      3, 'UM-001', 'Salim Al-Lawati (Unit Manager)', 'AGENT', 'UNIT_MANAGER',
      2, 'LIC-UM-2026-01', 'salim.um@kins.om', '+968-91001003', 'Muscat Main Branch', 'ACTIVE', 'Y', 'ADMIN'
    );

    -- Level 1: Writing Agent (reports to UM-001)
    INSERT INTO T_COMM_INTERMEDIARY (
      INTERMEDIARY_ID, INTERMEDIARY_CODE, INTERMEDIARY_NAME, CHANNEL_CODE, HIERARCHY_LEVEL,
      PARENT_INTERMEDIARY_ID, LICENSE_NO, EMAIL, PHONE, BRANCH_NAME, STATUS, IS_ACTIVE, CREATED_BY
    ) VALUES (
      4, 'AGT-001', 'Ahmed Al-Siyabi (Writing Agent)', 'AGENT', 'WRITING_AGENT',
      3, 'LIC-AGT-2026-01', 'ahmed.agt@kins.om', '+968-91001004', 'Muscat Main Branch', 'ACTIVE', 'Y', 'ADMIN'
    );

    -- Second Writing Agent under same UM-001
    INSERT INTO T_COMM_INTERMEDIARY (
      INTERMEDIARY_ID, INTERMEDIARY_CODE, INTERMEDIARY_NAME, CHANNEL_CODE, HIERARCHY_LEVEL,
      PARENT_INTERMEDIARY_ID, LICENSE_NO, EMAIL, PHONE, BRANCH_NAME, STATUS, IS_ACTIVE, CREATED_BY
    ) VALUES (
      5, 'AGT-002', 'Nadia Al-Hinai (Writing Agent)', 'AGENT', 'WRITING_AGENT',
      3, 'LIC-AGT-2026-02', 'nadia.agt@kins.om', '+968-91001005', 'Muscat Main Branch', 'ACTIVE', 'Y', 'ADMIN'
    );

    -- Insurance Brokers
    INSERT INTO T_COMM_INTERMEDIARY (
      INTERMEDIARY_ID, INTERMEDIARY_CODE, INTERMEDIARY_NAME, CHANNEL_CODE, HIERARCHY_LEVEL,
      PARENT_INTERMEDIARY_ID, LICENSE_NO, EMAIL, PHONE, BRANCH_NAME, STATUS, IS_ACTIVE, CREATED_BY
    ) VALUES (
      6, 'BRK-001', 'Gulf Star Insurance Brokers LLC', 'BROKER', 'BROKER',
      NULL, 'CMA-BRK-1042', 'placements@gulfstarbrokers.om', '+968-24501100', 'Muscat Corporate', 'ACTIVE', 'Y', 'ADMIN'
    );

    INSERT INTO T_COMM_INTERMEDIARY (
      INTERMEDIARY_ID, INTERMEDIARY_CODE, INTERMEDIARY_NAME, CHANNEL_CODE, HIERARCHY_LEVEL,
      PARENT_INTERMEDIARY_ID, LICENSE_NO, EMAIL, PHONE, BRANCH_NAME, STATUS, IS_ACTIVE, CREATED_BY
    ) VALUES (
      7, 'BRK-002', 'Al-Maha Corporate Risk Brokers', 'BROKER', 'BROKER',
      NULL, 'CMA-BRK-1088', 'life@almahabrokers.om', '+968-24502200', 'Sohar Corporate', 'ACTIVE', 'Y', 'ADMIN'
    );

    -- Bancassurance Partner
    INSERT INTO T_COMM_INTERMEDIARY (
      INTERMEDIARY_ID, INTERMEDIARY_CODE, INTERMEDIARY_NAME, CHANNEL_CODE, HIERARCHY_LEVEL,
      PARENT_INTERMEDIARY_ID, LICENSE_NO, EMAIL, PHONE, BRANCH_NAME, STATUS, IS_ACTIVE, CREATED_BY
    ) VALUES (
      8, 'BANCA-001', 'National Bank of Oman — Bancassurance', 'BANCASSURANCE', 'CHANNEL_PARTNER',
      NULL, 'CMA-BNK-0012', 'banca@nbo.om', '+968-24778000', 'HQ Bancassurance', 'ACTIVE', 'Y', 'ADMIN'
    );

    COMMIT;
  END IF;
END;
/

-- 10. Seed Default Commission Structures (Product-wise Default + Optional Cover-wise Override)
DECLARE
  v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM T_COMM_STRUCTURE;
  IF v_cnt = 0 THEN
    -- 1. Agent Hierarchy — Term Life (Product-wise Default)
    INSERT INTO T_COMM_STRUCTURE (
      STRUCT_ID, STRUCT_CODE, STRUCT_NAME, CHANNEL_CODE, LOB_TYPE, PROD_CODE, COVER_CODE, CALC_BASIS,
      EFFECTIVE_FROM, EFFECTIVE_TO, STATUS, REMARKS, IS_ACTIVE, CREATED_BY
    ) VALUES (
      1, 'COM-AGT-TERM1-PROD', 'Agency Hierarchy — Term Life (Product Default)', 'AGENT', 'IL', 'TERM1', NULL, 'PRODUCT',
      TO_DATE('2026-01-01', 'YYYY-MM-DD'), TO_DATE('2026-12-31', 'YYYY-MM-DD'), 'ACTIVE',
      'Standard 4-tier agency commission structure for Term Life (Product-wise default)', 'Y', 'ADMIN'
    );
    INSERT INTO T_COMM_STRUCTURE_TIER (TIER_ID, STRUCT_ID, TIER_ORDER, HIERARCHY_LEVEL, TIER_LABEL, COMM_PCT, RENEWAL_COMM_PCT, OVERRIDING_YN)
    VALUES (1, 1, 1, 'WRITING_AGENT',     'Writing Agent (Direct)',     20.00, 5.00, 'N');
    INSERT INTO T_COMM_STRUCTURE_TIER (TIER_ID, STRUCT_ID, TIER_ORDER, HIERARCHY_LEVEL, TIER_LABEL, COMM_PCT, RENEWAL_COMM_PCT, OVERRIDING_YN)
    VALUES (2, 1, 2, 'UNIT_MANAGER',      'Unit Manager (ORC)',          5.00, 1.50, 'Y');
    INSERT INTO T_COMM_STRUCTURE_TIER (TIER_ID, STRUCT_ID, TIER_ORDER, HIERARCHY_LEVEL, TIER_LABEL, COMM_PCT, RENEWAL_COMM_PCT, OVERRIDING_YN)
    VALUES (3, 1, 3, 'BRANCH_MANAGER',    'Branch Manager (ORC)',        3.00, 1.00, 'Y');
    INSERT INTO T_COMM_STRUCTURE_TIER (TIER_ID, STRUCT_ID, TIER_ORDER, HIERARCHY_LEVEL, TIER_LABEL, COMM_PCT, RENEWAL_COMM_PCT, OVERRIDING_YN)
    VALUES (4, 1, 4, 'REGIONAL_DIRECTOR', 'Regional Director (ORC)',     2.00, 0.50, 'Y');

    -- 2. Agent Hierarchy — Cash Builder 2001 (Product-wise Default)
    INSERT INTO T_COMM_STRUCTURE (
      STRUCT_ID, STRUCT_CODE, STRUCT_NAME, CHANNEL_CODE, LOB_TYPE, PROD_CODE, COVER_CODE, CALC_BASIS,
      EFFECTIVE_FROM, EFFECTIVE_TO, STATUS, REMARKS, IS_ACTIVE, CREATED_BY
    ) VALUES (
      2, 'COM-AGT-2001-PROD', 'Agency Hierarchy — Cash Builder (Product Default)', 'AGENT', 'IL', '2001', NULL, 'PRODUCT',
      TO_DATE('2026-01-01', 'YYYY-MM-DD'), TO_DATE('2026-12-31', 'YYYY-MM-DD'), 'ACTIVE',
      'Standard 4-tier agency commission structure for Cash Builder', 'Y', 'ADMIN'
    );
    INSERT INTO T_COMM_STRUCTURE_TIER (TIER_ID, STRUCT_ID, TIER_ORDER, HIERARCHY_LEVEL, TIER_LABEL, COMM_PCT, RENEWAL_COMM_PCT, OVERRIDING_YN)
    VALUES (5, 2, 1, 'WRITING_AGENT',     'Writing Agent (Direct)',     18.00, 4.00, 'N');
    INSERT INTO T_COMM_STRUCTURE_TIER (TIER_ID, STRUCT_ID, TIER_ORDER, HIERARCHY_LEVEL, TIER_LABEL, COMM_PCT, RENEWAL_COMM_PCT, OVERRIDING_YN)
    VALUES (6, 2, 2, 'UNIT_MANAGER',      'Unit Manager (ORC)',          4.00, 1.00, 'Y');
    INSERT INTO T_COMM_STRUCTURE_TIER (TIER_ID, STRUCT_ID, TIER_ORDER, HIERARCHY_LEVEL, TIER_LABEL, COMM_PCT, RENEWAL_COMM_PCT, OVERRIDING_YN)
    VALUES (7, 2, 3, 'BRANCH_MANAGER',    'Branch Manager (ORC)',        2.50, 0.75, 'Y');
    INSERT INTO T_COMM_STRUCTURE_TIER (TIER_ID, STRUCT_ID, TIER_ORDER, HIERARCHY_LEVEL, TIER_LABEL, COMM_PCT, RENEWAL_COMM_PCT, OVERRIDING_YN)
    VALUES (8, 2, 4, 'REGIONAL_DIRECTOR', 'Regional Director (ORC)',     1.50, 0.50, 'Y');

    -- 3. Broker — Corporate Group Term Life (Product-wise Default)
    INSERT INTO T_COMM_STRUCTURE (
      STRUCT_ID, STRUCT_CODE, STRUCT_NAME, CHANNEL_CODE, LOB_TYPE, PROD_CODE, COVER_CODE, CALC_BASIS,
      EFFECTIVE_FROM, EFFECTIVE_TO, STATUS, REMARKS, IS_ACTIVE, CREATED_BY
    ) VALUES (
      3, 'COM-BRK-GLTERM-PROD', 'Broker — Group Term Life (Product Default)', 'BROKER', 'GL', 'GL_TERM01', NULL, 'PRODUCT',
      TO_DATE('2026-01-01', 'YYYY-MM-DD'), TO_DATE('2026-12-31', 'YYYY-MM-DD'), 'ACTIVE',
      'Default product-level brokerage for Corporate Group Term Life', 'Y', 'ADMIN'
    );
    INSERT INTO T_COMM_STRUCTURE_TIER (TIER_ID, STRUCT_ID, TIER_ORDER, HIERARCHY_LEVEL, TIER_LABEL, COMM_PCT, RENEWAL_COMM_PCT, OVERRIDING_YN)
    VALUES (9, 3, 1, 'BROKER', 'Brokerage Commission', 12.50, 10.00, 'N');

    -- 4. Broker — Group Term Life Optional Cover-wise Override for Critical Illness (GL_CI)
    INSERT INTO T_COMM_STRUCTURE (
      STRUCT_ID, STRUCT_CODE, STRUCT_NAME, CHANNEL_CODE, LOB_TYPE, PROD_CODE, COVER_CODE, CALC_BASIS,
      EFFECTIVE_FROM, EFFECTIVE_TO, STATUS, REMARKS, IS_ACTIVE, CREATED_BY
    ) VALUES (
      4, 'COM-BRK-GLTERM-CI', 'Broker — Group Term Life (GL_CI Cover Override)', 'BROKER', 'GL', 'GL_TERM01', 'GL_CI', 'COVER',
      TO_DATE('2026-01-01', 'YYYY-MM-DD'), TO_DATE('2026-12-31', 'YYYY-MM-DD'), 'ACTIVE',
      'Optional cover-wise brokerage override for Accelerated Critical Illness cover', 'Y', 'ADMIN'
    );
    INSERT INTO T_COMM_STRUCTURE_TIER (TIER_ID, STRUCT_ID, TIER_ORDER, HIERARCHY_LEVEL, TIER_LABEL, COMM_PCT, RENEWAL_COMM_PCT, OVERRIDING_YN)
    VALUES (10, 4, 1, 'BROKER', 'Brokerage Commission (CI Cover)', 15.00, 12.00, 'N');

    -- 5. Broker — Individual Term Life (Product-wise Default)
    INSERT INTO T_COMM_STRUCTURE (
      STRUCT_ID, STRUCT_CODE, STRUCT_NAME, CHANNEL_CODE, LOB_TYPE, PROD_CODE, COVER_CODE, CALC_BASIS,
      EFFECTIVE_FROM, EFFECTIVE_TO, STATUS, REMARKS, IS_ACTIVE, CREATED_BY
    ) VALUES (
      5, 'COM-BRK-TERM1-PROD', 'Broker — Individual Term Life (Product Default)', 'BROKER', 'IL', 'TERM1', NULL, 'PRODUCT',
      TO_DATE('2026-01-01', 'YYYY-MM-DD'), TO_DATE('2026-12-31', 'YYYY-MM-DD'), 'ACTIVE',
      'Default product-level brokerage for Individual Term Life', 'Y', 'ADMIN'
    );
    INSERT INTO T_COMM_STRUCTURE_TIER (TIER_ID, STRUCT_ID, TIER_ORDER, HIERARCHY_LEVEL, TIER_LABEL, COMM_PCT, RENEWAL_COMM_PCT, OVERRIDING_YN)
    VALUES (11, 5, 1, 'BROKER', 'Brokerage Commission', 15.00, 5.00, 'N');

    -- 6. Bancassurance — Term Life (Product-wise Default)
    INSERT INTO T_COMM_STRUCTURE (
      STRUCT_ID, STRUCT_CODE, STRUCT_NAME, CHANNEL_CODE, LOB_TYPE, PROD_CODE, COVER_CODE, CALC_BASIS,
      EFFECTIVE_FROM, EFFECTIVE_TO, STATUS, REMARKS, IS_ACTIVE, CREATED_BY
    ) VALUES (
      6, 'COM-BNK-TERM1-PROD', 'Bancassurance — Term Life (Product Default)', 'BANCASSURANCE', 'IL', 'TERM1', NULL, 'PRODUCT',
      TO_DATE('2026-01-01', 'YYYY-MM-DD'), TO_DATE('2026-12-31', 'YYYY-MM-DD'), 'ACTIVE',
      'Bancassurance partner commission for Term Life', 'Y', 'ADMIN'
    );
    INSERT INTO T_COMM_STRUCTURE_TIER (TIER_ID, STRUCT_ID, TIER_ORDER, HIERARCHY_LEVEL, TIER_LABEL, COMM_PCT, RENEWAL_COMM_PCT, OVERRIDING_YN)
    VALUES (12, 6, 1, 'CHANNEL_PARTNER', 'Bancassurance Partner Commission', 17.50, 5.00, 'N');

    COMMIT;
  END IF;
END;
/

-- 11. Register Commission Submenus under COMMISSION_MGMT in MTBL_MENU
MERGE INTO MTBL_MENU tgt
USING (
  SELECT 'COMM_DEFINITION'   AS MENU_ID, 'Commission Definition'  AS MENU_NAME, 'COMMISSION_MGMT' AS MENU_PARENT_ID, '/commission-management/definition'        AS MENU_PATH, 1 AS MENU_SEQ_NO FROM DUAL UNION ALL
  SELECT 'POLICY_COMMISSION',           'Policy-wise Commission',               'COMMISSION_MGMT',                   '/commission-management/policy-commission',              2 FROM DUAL
) src
ON (tgt.MENU_ID = src.MENU_ID)
WHEN MATCHED THEN
  UPDATE SET
    tgt.MENU_NAME = src.MENU_NAME,
    tgt.MENU_PARENT_ID = src.MENU_PARENT_ID,
    tgt.MENU_PATH = src.MENU_PATH,
    tgt.MENU_SEQ_NO = src.MENU_SEQ_NO
WHEN NOT MATCHED THEN
  INSERT (MENU_ID, MENU_NAME, MENU_PARENT_ID, MENU_PATH, MENU_SEQ_NO)
  VALUES (src.MENU_ID, src.MENU_NAME, src.MENU_PARENT_ID, src.MENU_PATH, src.MENU_SEQ_NO);
/
COMMIT;
