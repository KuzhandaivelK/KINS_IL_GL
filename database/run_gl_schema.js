const fs = require('fs');
const path = require('path');
const oracledb = require('../backend/node_modules/oracledb');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

async function run() {
  const conn = await oracledb.getConnection({
    user: 'KINS',
    password: 'KINS',
    connectString: 'localhost:1521/orcl'
  });
  console.log('Connected to Oracle 19c');

  const sqlFile = fs.readFileSync(path.join(__dirname, 'group_life_schema.sql'), 'utf-8');

  // Split SQL file by statements: PL/SQL blocks end with / on a line, standard statements end with ;
  // Let's execute the explicit statements in order
  const statements = [
    // 1. Drop sequences
    `BEGIN
      FOR s IN (SELECT sequence_name FROM user_sequences WHERE sequence_name IN (
        'SEQ_GL_QUOTE_ID', 'SEQ_GL_MEMBER_ID', 'SEQ_GL_Q_RIDER_ID',
        'SEQ_GL_POL_ID', 'SEQ_GL_POL_MEM_ID', 'SEQ_GL_POL_RIDER_ID'
      )) LOOP
        EXECUTE IMMEDIATE 'DROP SEQUENCE ' || s.sequence_name;
      END LOOP;
    END;`,

    // 2. Sequences
    `CREATE SEQUENCE SEQ_GL_QUOTE_ID START WITH 10001 INCREMENT BY 1 NOCACHE NOCYCLE`,
    `CREATE SEQUENCE SEQ_GL_MEMBER_ID START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE`,
    `CREATE SEQUENCE SEQ_GL_Q_RIDER_ID START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE`,
    `CREATE SEQUENCE SEQ_GL_POL_ID START WITH 20001 INCREMENT BY 1 NOCACHE NOCYCLE`,
    `CREATE SEQUENCE SEQ_GL_POL_MEM_ID START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE`,
    `CREATE SEQUENCE SEQ_GL_POL_RIDER_ID START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE`,

    // 3. Drop tables
    `BEGIN
      FOR t IN (SELECT table_name FROM user_tables WHERE table_name IN (
        'T_GL_POLICY_RIDER', 'T_GL_POLICY_MEMBER', 'T_GL_POLICY_MASTER',
        'T_GL_QUOTE_RIDER', 'T_GL_QUOTE_MEMBER', 'T_GL_QUOTE_HEADER'
      )) LOOP
        EXECUTE IMMEDIATE 'DROP TABLE ' || t.table_name || ' CASCADE CONSTRAINTS PURGE';
      END LOOP;
    END;`,

    // 4. Create T_GL_QUOTE_HEADER
    `CREATE TABLE T_GL_QUOTE_HEADER (
      GL_QUOTE_ID                 NUMBER(10,0)      NOT NULL,
      GL_QUOTE_NO                 VARCHAR2(30)      NOT NULL,
      GL_QUOTE_UID                VARCHAR2(50)      NOT NULL,
      GL_QUOTE_DATE               DATE              DEFAULT SYSDATE NOT NULL,
      CORP_NAME                   VARCHAR2(200)     NOT NULL,
      CORP_REG_NO                 VARCHAR2(50),
      CORP_TAX_NO                 VARCHAR2(50),
      CORP_CONTACT_PERSON         VARCHAR2(150),
      CORP_EMAIL                  VARCHAR2(150),
      CORP_PHONE                  VARCHAR2(50),
      CORP_ADDRESS                VARCHAR2(400),
      CORP_INDUSTRY               VARCHAR2(100),
      PROD_CODE                   VARCHAR2(20)      NOT NULL,
      BENEFIT_STRUCTURE           VARCHAR2(30)      DEFAULT 'MULTIPLE_OF_SALARY' NOT NULL,
      SALARY_MULTIPLE             NUMBER(5,2)       DEFAULT 3.0,
      FLAT_SA_AMOUNT              NUMBER(17,3)      DEFAULT 0,
      FREE_COVER_LIMIT            NUMBER(17,3)      DEFAULT 250000,
      TOTAL_MEMBERS               NUMBER(8,0)       DEFAULT 0 NOT NULL,
      TOTAL_SUM_ASSURED           NUMBER(17,3)      DEFAULT 0 NOT NULL,
      BASE_RATE_PER_MILLE         NUMBER(8,4)       DEFAULT 2.5000,
      EXPERIENCE_DISCOUNT_PCT     NUMBER(5,2)       DEFAULT 0,
      TOTAL_BASIC_PREMIUM         NUMBER(17,3)      DEFAULT 0,
      TOTAL_RIDER_PREMIUM         NUMBER(17,3)      DEFAULT 0,
      TOTAL_ANNUAL_PREMIUM        NUMBER(17,3)      DEFAULT 0 NOT NULL,
      MODAL_FACTOR                NUMBER(5,3)       DEFAULT 1.0,
      INSTALLMENT_PREMIUM         NUMBER(17,3)      DEFAULT 0 NOT NULL,
      PAY_FREQ                    VARCHAR2(20)      DEFAULT 'ANNUAL' NOT NULL,
      MOP                         VARCHAR2(30)      DEFAULT 'Y',
      STATUS                      VARCHAR2(20)      DEFAULT 'DRAFT' NOT NULL,
      REMARKS                     VARCHAR2(1000),
      IS_ACTIVE                   CHAR(1)           DEFAULT 'Y' NOT NULL,
      CREATED_BY                  VARCHAR2(50)      DEFAULT 'ADMIN' NOT NULL,
      CREATED_ON                  DATE              DEFAULT SYSDATE NOT NULL,
      MODIFIED_BY                 VARCHAR2(50),
      MODIFIED_ON                 DATE,
      CONSTRAINT PK_T_GL_QUOTE_HDR PRIMARY KEY (GL_QUOTE_ID),
      CONSTRAINT UQ_GL_QUOTE_NO UNIQUE (GL_QUOTE_NO),
      CONSTRAINT UQ_GL_QUOTE_UID UNIQUE (GL_QUOTE_UID),
      CONSTRAINT CHK_GL_Q_STATUS CHECK (STATUS IN ('DRAFT', 'SUBMITTED', 'QUOTED', 'ACCEPTED', 'CONVERTED', 'REJECTED')),
      CONSTRAINT CHK_GL_Q_FREQ CHECK (PAY_FREQ IN ('ANNUAL', 'SEMI_ANNUAL', 'QUARTERLY', 'MONTHLY', 'SINGLE')),
      CONSTRAINT CHK_GL_Q_BENEFIT CHECK (BENEFIT_STRUCTURE IN ('MULTIPLE_OF_SALARY', 'FLAT_SA', 'GRADED')),
      CONSTRAINT CHK_GL_Q_ACT CHECK (IS_ACTIVE IN ('Y', 'N'))
    )`,

    `CREATE INDEX IDX_GL_Q_CORP ON T_GL_QUOTE_HEADER (CORP_NAME)`,
    `CREATE INDEX IDX_GL_Q_STATUS ON T_GL_QUOTE_HEADER (STATUS)`,

    // 5. Create T_GL_QUOTE_MEMBER
    `CREATE TABLE T_GL_QUOTE_MEMBER (
      MEMBER_ID                   NUMBER(10,0)      NOT NULL,
      GL_QUOTE_NO                 VARCHAR2(30)      NOT NULL,
      EMP_ID                      VARCHAR2(50)      NOT NULL,
      MEMBER_NAME                 VARCHAR2(150)     NOT NULL,
      DOB                         DATE              NOT NULL,
      AGE                         NUMBER(3,0)       NOT NULL,
      GENDER                      CHAR(1)           DEFAULT 'M' NOT NULL,
      CATEGORY                    VARCHAR2(50)      DEFAULT 'STAFF',
      MONTHLY_SALARY              NUMBER(15,2)      DEFAULT 0,
      ANNUAL_SALARY               NUMBER(15,2)      DEFAULT 0,
      SUM_ASSURED                 NUMBER(17,3)      NOT NULL,
      PREMIUM_AMOUNT              NUMBER(15,2)      DEFAULT 0,
      UNDERWRITING_FLAG           VARCHAR2(30)      DEFAULT 'UNDER_FCL',
      IS_ACTIVE                   CHAR(1)           DEFAULT 'Y' NOT NULL,
      CREATED_BY                  VARCHAR2(50)      DEFAULT 'ADMIN' NOT NULL,
      CREATED_ON                  DATE              DEFAULT SYSDATE NOT NULL,
      CONSTRAINT PK_T_GL_Q_MEM PRIMARY KEY (MEMBER_ID),
      CONSTRAINT FK_GL_Q_MEM_NO FOREIGN KEY (GL_QUOTE_NO) REFERENCES T_GL_QUOTE_HEADER (GL_QUOTE_NO) ON DELETE CASCADE,
      CONSTRAINT CHK_GL_Q_MEM_GEN CHECK (GENDER IN ('M', 'F', 'O')),
      CONSTRAINT CHK_GL_Q_MEM_ACT CHECK (IS_ACTIVE IN ('Y', 'N'))
    )`,

    `CREATE INDEX IDX_GL_Q_MEM_NO ON T_GL_QUOTE_MEMBER (GL_QUOTE_NO)`,
    `CREATE INDEX IDX_GL_Q_MEM_EMP ON T_GL_QUOTE_MEMBER (GL_QUOTE_NO, EMP_ID)`,

    // 6. Create T_GL_QUOTE_RIDER
    `CREATE TABLE T_GL_QUOTE_RIDER (
      RIDER_ID                    NUMBER(10,0)      NOT NULL,
      GL_QUOTE_NO                 VARCHAR2(30)      NOT NULL,
      RIDER_CODE                  VARCHAR2(20)      NOT NULL,
      RIDER_NAME                  VARCHAR2(150)     NOT NULL,
      SA_BASIS                    VARCHAR2(30)      DEFAULT 'MATCH_BASIC',
      SA_PERCENT                  NUMBER(5,2)       DEFAULT 100,
      TOTAL_RIDER_SA              NUMBER(17,3)      NOT NULL,
      RIDER_RATE_PER_MILLE        NUMBER(8,4)       DEFAULT 0.4500,
      RIDER_PREMIUM               NUMBER(17,3)      NOT NULL,
      IS_ACTIVE                   CHAR(1)           DEFAULT 'Y' NOT NULL,
      CREATED_BY                  VARCHAR2(50)      DEFAULT 'ADMIN' NOT NULL,
      CREATED_ON                  DATE              DEFAULT SYSDATE NOT NULL,
      CONSTRAINT PK_T_GL_Q_RIDER PRIMARY KEY (RIDER_ID),
      CONSTRAINT FK_GL_Q_RIDER_NO FOREIGN KEY (GL_QUOTE_NO) REFERENCES T_GL_QUOTE_HEADER (GL_QUOTE_NO) ON DELETE CASCADE,
      CONSTRAINT CHK_GL_Q_RIDER_ACT CHECK (IS_ACTIVE IN ('Y', 'N'))
    )`,

    `CREATE INDEX IDX_GL_Q_RIDER_NO ON T_GL_QUOTE_RIDER (GL_QUOTE_NO)`,

    // 7. Create T_GL_POLICY_MASTER
    `CREATE TABLE T_GL_POLICY_MASTER (
      GL_POL_ID                   NUMBER(10,0)      NOT NULL,
      MASTER_POLICY_NO            VARCHAR2(30)      NOT NULL,
      GL_QUOTE_NO                 VARCHAR2(30)      NOT NULL,
      CORP_NAME                   VARCHAR2(200)     NOT NULL,
      CORP_REG_NO                 VARCHAR2(50),
      CORP_CONTACT_PERSON         VARCHAR2(150),
      CORP_EMAIL                  VARCHAR2(150),
      CORP_PHONE                  VARCHAR2(50),
      PROD_CODE                   VARCHAR2(20)      NOT NULL,
      POLICY_INCEPTION_DATE       DATE              DEFAULT SYSDATE NOT NULL,
      POLICY_EXPIRY_DATE          DATE              NOT NULL,
      POLICY_RENEWAL_DATE         DATE              NOT NULL,
      FREE_COVER_LIMIT            NUMBER(17,3)      DEFAULT 250000,
      TOTAL_ACTIVE_MEMBERS        NUMBER(8,0)       DEFAULT 0 NOT NULL,
      TOTAL_INFORCE_SA            NUMBER(17,3)      DEFAULT 0 NOT NULL,
      TOTAL_INFORCE_PREMIUM       NUMBER(17,3)      DEFAULT 0 NOT NULL,
      POL_PAY_FREQ                VARCHAR2(20)      DEFAULT 'ANNUAL' NOT NULL,
      POL_MOP                     VARCHAR2(30)      DEFAULT 'Y',
      POL_STATUS                  VARCHAR2(20)      DEFAULT 'PENDING_APPROVAL' NOT NULL,
      POL_APPROVAL_LEVEL          NUMBER(2,0)       DEFAULT 1 NOT NULL,
      POL_APPROVED_BY             VARCHAR2(50),
      POL_APPROVED_ON             DATE,
      POL_APPROVAL_REMARKS        VARCHAR2(1000),
      IS_ACTIVE                   CHAR(1)           DEFAULT 'Y' NOT NULL,
      CREATED_BY                  VARCHAR2(50)      DEFAULT 'ADMIN' NOT NULL,
      CREATED_ON                  DATE              DEFAULT SYSDATE NOT NULL,
      MODIFIED_BY                 VARCHAR2(50),
      MODIFIED_ON                 DATE,
      CONSTRAINT PK_T_GL_POL_MASTER PRIMARY KEY (GL_POL_ID),
      CONSTRAINT UQ_GL_MASTER_POL_NO UNIQUE (MASTER_POLICY_NO),
      CONSTRAINT CHK_GL_POL_STATUS CHECK (POL_STATUS IN ('PENDING_APPROVAL', 'APPROVED', 'IN_FORCE', 'EXPIRED', 'CANCELLED')),
      CONSTRAINT CHK_GL_POL_FREQ CHECK (POL_PAY_FREQ IN ('ANNUAL', 'SEMI_ANNUAL', 'QUARTERLY', 'MONTHLY', 'SINGLE')),
      CONSTRAINT CHK_GL_POL_ACT CHECK (IS_ACTIVE IN ('Y', 'N'))
    )`,

    `CREATE INDEX IDX_GL_POL_CORP ON T_GL_POLICY_MASTER (CORP_NAME)`,

    // 8. Create T_GL_POLICY_MEMBER
    `CREATE TABLE T_GL_POLICY_MEMBER (
      MEMBER_ID                   NUMBER(10,0)      NOT NULL,
      MASTER_POLICY_NO            VARCHAR2(30)      NOT NULL,
      EMP_ID                      VARCHAR2(50)      NOT NULL,
      MEMBER_NAME                 VARCHAR2(150)     NOT NULL,
      DOB                         DATE              NOT NULL,
      AGE                         NUMBER(3,0)       NOT NULL,
      GENDER                      CHAR(1)           DEFAULT 'M' NOT NULL,
      CATEGORY                    VARCHAR2(50)      DEFAULT 'STAFF',
      MONTHLY_SALARY              NUMBER(15,2)      DEFAULT 0,
      ANNUAL_SALARY               NUMBER(15,2)      DEFAULT 0,
      SUM_ASSURED                 NUMBER(17,3)      NOT NULL,
      MEMBER_PREMIUM              NUMBER(15,2)      DEFAULT 0,
      MEMBER_STATUS               VARCHAR2(20)      DEFAULT 'ACTIVE' NOT NULL,
      IS_ACTIVE                   CHAR(1)           DEFAULT 'Y' NOT NULL,
      CREATED_BY                  VARCHAR2(50)      DEFAULT 'ADMIN' NOT NULL,
      CREATED_ON                  DATE              DEFAULT SYSDATE NOT NULL,
      CONSTRAINT PK_T_GL_POL_MEM PRIMARY KEY (MEMBER_ID),
      CONSTRAINT FK_GL_POL_MEM_NO FOREIGN KEY (MASTER_POLICY_NO) REFERENCES T_GL_POLICY_MASTER (MASTER_POLICY_NO) ON DELETE CASCADE,
      CONSTRAINT CHK_GL_POL_MEM_GEN CHECK (GENDER IN ('M', 'F', 'O')),
      CONSTRAINT CHK_GL_POL_MEM_ACT CHECK (IS_ACTIVE IN ('Y', 'N'))
    )`,

    `CREATE INDEX IDX_GL_POL_MEM_NO ON T_GL_POLICY_MEMBER (MASTER_POLICY_NO)`,

    // 9. Create T_GL_POLICY_RIDER
    `CREATE TABLE T_GL_POLICY_RIDER (
      RIDER_ID                    NUMBER(10,0)      NOT NULL,
      MASTER_POLICY_NO            VARCHAR2(30)      NOT NULL,
      RIDER_CODE                  VARCHAR2(20)      NOT NULL,
      RIDER_NAME                  VARCHAR2(150)     NOT NULL,
      TOTAL_RIDER_SA              NUMBER(17,3)      NOT NULL,
      RIDER_PREMIUM               NUMBER(17,3)      NOT NULL,
      IS_ACTIVE                   CHAR(1)           DEFAULT 'Y' NOT NULL,
      CREATED_BY                  VARCHAR2(50)      DEFAULT 'ADMIN' NOT NULL,
      CREATED_ON                  DATE              DEFAULT SYSDATE NOT NULL,
      CONSTRAINT PK_T_GL_POL_RIDER PRIMARY KEY (RIDER_ID),
      CONSTRAINT FK_GL_POL_RIDER_NO FOREIGN KEY (MASTER_POLICY_NO) REFERENCES T_GL_POLICY_MASTER (MASTER_POLICY_NO) ON DELETE CASCADE,
      CONSTRAINT CHK_GL_POL_RIDER_ACT CHECK (IS_ACTIVE IN ('Y', 'N'))
    )`,

    `CREATE INDEX IDX_GL_POL_RIDER_NO ON T_GL_POLICY_RIDER (MASTER_POLICY_NO)`
  ];

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    try {
      await conn.execute(stmt);
      console.log(`Executed statement [${i + 1}/${statements.length}]`);
    } catch (e) {
      console.error(`Error on statement [${i + 1}]:`, e.message);
      throw e;
    }
  }

  console.log('Group Life schema deployed successfully!');
  await conn.close();
}

run().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
