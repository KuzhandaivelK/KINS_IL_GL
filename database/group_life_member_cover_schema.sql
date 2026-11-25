-- ============================================================================
-- KINS ENTERPRISE LIFE INSURANCE CORE SYSTEM
-- MODULE: GROUP LIFE (GL) MEMBER COVER-WISE PREMIUM SCHEMA
-- Target Database: Oracle Database 19c Enterprise Edition
-- Tables: T_GL_QUOTE_MEMBER_COVER, T_GL_POLICY_MEMBER_COVER
-- ============================================================================

-- Create Sequences safely
DECLARE
  v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM user_sequences WHERE sequence_name = 'SEQ_GL_Q_MEM_COV_ID';
  IF v_cnt = 0 THEN
    EXECUTE IMMEDIATE 'CREATE SEQUENCE SEQ_GL_Q_MEM_COV_ID START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE';
  END IF;

  SELECT COUNT(*) INTO v_cnt FROM user_sequences WHERE sequence_name = 'SEQ_GL_P_MEM_COV_ID';
  IF v_cnt = 0 THEN
    EXECUTE IMMEDIATE 'CREATE SEQUENCE SEQ_GL_P_MEM_COV_ID START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE';
  END IF;
END;
/

-- ============================================================================
-- 1. GROUP LIFE QUOTE MEMBER COVER-WISE PREMIUM (T_GL_QUOTE_MEMBER_COVER)
-- Linked to T_GL_QUOTE_HEADER (GL_QUOTE_NO) and T_GL_QUOTE_MEMBER (MEMBER_ID, EMP_ID)
-- ============================================================================
DECLARE
  v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM user_tables WHERE table_name = 'T_GL_QUOTE_MEMBER_COVER';
  IF v_cnt = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE T_GL_QUOTE_MEMBER_COVER (
        MEM_COVER_ID                NUMBER(10,0)      NOT NULL,
        GL_QUOTE_NO                 VARCHAR2(30)      NOT NULL,
        MEMBER_ID                   NUMBER(10,0)      NOT NULL,
        EMP_ID                      VARCHAR2(50)      NOT NULL,
        COVER_CODE                  VARCHAR2(20)      NOT NULL,
        COVER_NAME                  VARCHAR2(150)     NOT NULL,
        COVER_TYPE                  VARCHAR2(20)      DEFAULT ''RIDER'' NOT NULL,
        SA_PERCENT                  NUMBER(5,2)       DEFAULT 100 NOT NULL,
        COVER_SUM_ASSURED           NUMBER(17,3)      NOT NULL,
        RATE_PER_MILLE              NUMBER(8,4)       NOT NULL,
        GROSS_PREMIUM               NUMBER(15,2)      NOT NULL,
        DISCOUNT_AMOUNT             NUMBER(15,2)      DEFAULT 0 NOT NULL,
        NET_PREMIUM                 NUMBER(15,2)      NOT NULL,
        IS_ACTIVE                   CHAR(1)           DEFAULT ''Y'' NOT NULL,
        CREATED_BY                  VARCHAR2(50)      DEFAULT ''ADMIN'' NOT NULL,
        CREATED_ON                  DATE              DEFAULT SYSDATE NOT NULL,
        CONSTRAINT PK_T_GL_Q_MEM_COV PRIMARY KEY (MEM_COVER_ID),
        CONSTRAINT FK_GL_Q_MCOV_NO FOREIGN KEY (GL_QUOTE_NO) REFERENCES T_GL_QUOTE_HEADER (GL_QUOTE_NO) ON DELETE CASCADE,
        CONSTRAINT FK_GL_Q_MCOV_MEM FOREIGN KEY (MEMBER_ID) REFERENCES T_GL_QUOTE_MEMBER (MEMBER_ID) ON DELETE CASCADE,
        CONSTRAINT CHK_GL_Q_MCOV_TYPE CHECK (COVER_TYPE IN (''BASIC'', ''RIDER'')),
        CONSTRAINT CHK_GL_Q_MCOV_ACT CHECK (IS_ACTIVE IN (''Y'', ''N''))
      )
    ';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_GL_Q_MCOV_NO ON T_GL_QUOTE_MEMBER_COVER (GL_QUOTE_NO)';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_GL_Q_MCOV_MEM ON T_GL_QUOTE_MEMBER_COVER (MEMBER_ID)';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_GL_Q_MCOV_EMP ON T_GL_QUOTE_MEMBER_COVER (GL_QUOTE_NO, EMP_ID)';
  END IF;
END;
/

-- ============================================================================
-- 2. GROUP LIFE MASTER POLICY MEMBER COVER-WISE PREMIUM (T_GL_POLICY_MEMBER_COVER)
-- Linked to T_GL_POLICY_MASTER (MASTER_POLICY_NO) and T_GL_POLICY_MEMBER (MEMBER_ID, EMP_ID)
-- ============================================================================
DECLARE
  v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM user_tables WHERE table_name = 'T_GL_POLICY_MEMBER_COVER';
  IF v_cnt = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE T_GL_POLICY_MEMBER_COVER (
        POL_MEM_COVER_ID            NUMBER(10,0)      NOT NULL,
        MASTER_POLICY_NO            VARCHAR2(30)      NOT NULL,
        MEMBER_ID                   NUMBER(10,0)      NOT NULL,
        EMP_ID                      VARCHAR2(50)      NOT NULL,
        COVER_CODE                  VARCHAR2(20)      NOT NULL,
        COVER_NAME                  VARCHAR2(150)     NOT NULL,
        COVER_TYPE                  VARCHAR2(20)      DEFAULT ''RIDER'' NOT NULL,
        SA_PERCENT                  NUMBER(5,2)       DEFAULT 100 NOT NULL,
        COVER_SUM_ASSURED           NUMBER(17,3)      NOT NULL,
        RATE_PER_MILLE              NUMBER(8,4)       NOT NULL,
        GROSS_PREMIUM               NUMBER(15,2)      NOT NULL,
        DISCOUNT_AMOUNT             NUMBER(15,2)      DEFAULT 0 NOT NULL,
        NET_PREMIUM                 NUMBER(15,2)      NOT NULL,
        IS_ACTIVE                   CHAR(1)           DEFAULT ''Y'' NOT NULL,
        CREATED_BY                  VARCHAR2(50)      DEFAULT ''ADMIN'' NOT NULL,
        CREATED_ON                  DATE              DEFAULT SYSDATE NOT NULL,
        CONSTRAINT PK_T_GL_P_MEM_COV PRIMARY KEY (POL_MEM_COVER_ID),
        CONSTRAINT FK_GL_P_MCOV_NO FOREIGN KEY (MASTER_POLICY_NO) REFERENCES T_GL_POLICY_MASTER (MASTER_POLICY_NO) ON DELETE CASCADE,
        CONSTRAINT FK_GL_P_MCOV_MEM FOREIGN KEY (MEMBER_ID) REFERENCES T_GL_POLICY_MEMBER (MEMBER_ID) ON DELETE CASCADE,
        CONSTRAINT CHK_GL_P_MCOV_TYPE CHECK (COVER_TYPE IN (''BASIC'', ''RIDER'')),
        CONSTRAINT CHK_GL_P_MCOV_ACT CHECK (IS_ACTIVE IN (''Y'', ''N''))
      )
    ';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_GL_P_MCOV_NO ON T_GL_POLICY_MEMBER_COVER (MASTER_POLICY_NO)';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_GL_P_MCOV_MEM ON T_GL_POLICY_MEMBER_COVER (MEMBER_ID)';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_GL_P_MCOV_EMP ON T_GL_POLICY_MEMBER_COVER (MASTER_POLICY_NO, EMP_ID)';
  END IF;
END;
/

COMMIT;
