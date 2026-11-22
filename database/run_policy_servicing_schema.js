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

  // 1. Alter T_PROPOSAL_INFO to add FPR tracking columns if not already present
  const propCols = [
    { name: 'FPR_STATUS', sql: `ALTER TABLE T_PROPOSAL_INFO ADD (FPR_STATUS VARCHAR2(20) DEFAULT 'PENDING')` },
    { name: 'FPR_RECEIPT_NO', sql: `ALTER TABLE T_PROPOSAL_INFO ADD (FPR_RECEIPT_NO VARCHAR2(30))` },
    { name: 'FPR_AMOUNT', sql: `ALTER TABLE T_PROPOSAL_INFO ADD (FPR_AMOUNT NUMBER(17,3))` },
    { name: 'FPR_DATE', sql: `ALTER TABLE T_PROPOSAL_INFO ADD (FPR_DATE DATE)` }
  ];

  for (const c of propCols) {
    try {
      await conn.execute(c.sql);
      console.log(`Added column ${c.name} to T_PROPOSAL_INFO`);
    } catch (e) {
      if (e.errorNum === 1430) {
        console.log(`Column ${c.name} already exists in T_PROPOSAL_INFO`);
      } else {
        console.error(`Error adding ${c.name}:`, e.message);
      }
    }
  }

  // 2. Alter T_POLICY_INFO to add servicing columns if not already present
  const polCols = [
    { name: 'POL_NEXT_DUE_DATE', sql: `ALTER TABLE T_POLICY_INFO ADD (POL_NEXT_DUE_DATE DATE)` },
    { name: 'POL_PAID_TO_DATE', sql: `ALTER TABLE T_POLICY_INFO ADD (POL_PAID_TO_DATE DATE)` },
    { name: 'POL_LAST_PREM_DATE', sql: `ALTER TABLE T_POLICY_INFO ADD (POL_LAST_PREM_DATE DATE)` },
    { name: 'POL_TOTAL_PREM_PAID', sql: `ALTER TABLE T_POLICY_INFO ADD (POL_TOTAL_PREM_PAID NUMBER(17,3) DEFAULT 0)` },
    { name: 'POL_INSTALLMENT_PREM', sql: `ALTER TABLE T_POLICY_INFO ADD (POL_INSTALLMENT_PREM NUMBER(17,3) DEFAULT 0)` }
  ];

  for (const c of polCols) {
    try {
      await conn.execute(c.sql);
      console.log(`Added column ${c.name} to T_POLICY_INFO`);
    } catch (e) {
      if (e.errorNum === 1430) {
        console.log(`Column ${c.name} already exists in T_POLICY_INFO`);
      } else {
        console.error(`Error adding ${c.name}:`, e.message);
      }
    }
  }

  // 3. Sequences
  const seqs = [
    'SEQ_RECEIPT_ID',
    'SEQ_VOUCHER_ID',
    'SEQ_SURRENDER_ID',
    'SEQ_MATURITY_ID',
    'SEQ_LOAN_ID',
    'SEQ_REPAYMENT_ID'
  ];

  for (const s of seqs) {
    try {
      await conn.execute(`CREATE SEQUENCE ${s} START WITH 10001 INCREMENT BY 1 NOCACHE NOCYCLE`);
      console.log(`Created sequence ${s}`);
    } catch (e) {
      if (e.errorNum === 955) {
        console.log(`Sequence ${s} already exists`);
      } else {
        console.error(`Error creating sequence ${s}:`, e.message);
      }
    }
  }

  // 4. Create Tables
  const tables = [
    {
      name: 'T_POLICY_PREMIUM_RECEIPT',
      sql: `CREATE TABLE T_POLICY_PREMIUM_RECEIPT (
        RECEIPT_ID             NUMBER(10,0)      NOT NULL,
        RECEIPT_NO             VARCHAR2(30)      NOT NULL,
        RECEIPT_TYPE           VARCHAR2(10)      NOT NULL,
        PROP_NO                VARCHAR2(30),
        POL_NO                 VARCHAR2(30),
        RECEIPT_DATE           DATE              DEFAULT SYSDATE NOT NULL,
        DUE_DATE               DATE,
        PREMIUM_AMOUNT         NUMBER(17,3)      NOT NULL,
        TAX_AMOUNT             NUMBER(17,3)      DEFAULT 0,
        INTEREST_AMOUNT        NUMBER(17,3)      DEFAULT 0,
        TOTAL_PAID             NUMBER(17,3)      NOT NULL,
        PAY_MODE               VARCHAR2(20)      DEFAULT 'CASH' NOT NULL,
        TRANSACTION_REF        VARCHAR2(100),
        COLLECTED_BY           VARCHAR2(50)      DEFAULT 'ADMIN' NOT NULL,
        GL_VOUCHER_NO          VARCHAR2(30),
        GL_POSTED_YN           CHAR(1)           DEFAULT 'Y' NOT NULL,
        STATUS                 VARCHAR2(20)      DEFAULT 'ACTIVE' NOT NULL,
        REMARKS                VARCHAR2(500),
        IS_ACTIVE              CHAR(1)           DEFAULT 'Y' NOT NULL,
        CREATED_BY             VARCHAR2(50)      DEFAULT 'ADMIN' NOT NULL,
        CREATED_ON             DATE              DEFAULT SYSDATE NOT NULL,
        CONSTRAINT PK_PREM_RECEIPT PRIMARY KEY (RECEIPT_ID),
        CONSTRAINT UQ_RECEIPT_NO UNIQUE (RECEIPT_NO),
        CONSTRAINT CHK_REC_TYPE CHECK (RECEIPT_TYPE IN ('FPR', 'RPR', 'REINSTATE')),
        CONSTRAINT CHK_REC_PAY_MODE CHECK (PAY_MODE IN ('CASH', 'CHEQUE', 'BANK_TRANSFER', 'CARD')),
        CONSTRAINT CHK_REC_POSTED CHECK (GL_POSTED_YN IN ('Y', 'N')),
        CONSTRAINT CHK_REC_ACT CHECK (IS_ACTIVE IN ('Y', 'N'))
      )`
    },
    {
      name: 'T_GL_JOURNAL_ENTRY',
      sql: `CREATE TABLE T_GL_JOURNAL_ENTRY (
        ENTRY_ID               NUMBER(10,0)      NOT NULL,
        JOURNAL_VOUCHER_NO     VARCHAR2(30)      NOT NULL,
        VOUCHER_DATE           DATE              DEFAULT SYSDATE NOT NULL,
        TXN_SOURCE             VARCHAR2(30)      NOT NULL,
        SOURCE_REF_NO          VARCHAR2(30)      NOT NULL,
        GL_ACCOUNT_CODE        VARCHAR2(30)      NOT NULL,
        GL_ACCOUNT_NAME        VARCHAR2(150)     NOT NULL,
        DR_CR_FLAG             CHAR(1)           NOT NULL,
        AMOUNT                 NUMBER(17,3)      NOT NULL,
        NARRATION              VARCHAR2(500),
        CREATED_BY             VARCHAR2(50)      DEFAULT 'SYSTEM' NOT NULL,
        CREATED_ON             DATE              DEFAULT SYSDATE NOT NULL,
        CONSTRAINT PK_GL_JOURNAL PRIMARY KEY (ENTRY_ID),
        CONSTRAINT CHK_GL_DRCR CHECK (DR_CR_FLAG IN ('D', 'C'))
      )`
    },
    {
      name: 'T_POLICY_SURRENDER',
      sql: `CREATE TABLE T_POLICY_SURRENDER (
        SURRENDER_ID           NUMBER(10,0)      NOT NULL,
        SURRENDER_NO           VARCHAR2(30)      NOT NULL,
        POL_NO                 VARCHAR2(30)      NOT NULL,
        REQUEST_DATE           DATE              DEFAULT SYSDATE NOT NULL,
        PAID_PREMIUM_YEARS     NUMBER(5,2)       NOT NULL,
        TOTAL_PREMIUM_PAID     NUMBER(17,3)      NOT NULL,
        GUARANTEED_SV          NUMBER(17,3)      DEFAULT 0,
        SPECIAL_SV             NUMBER(17,3)      DEFAULT 0,
        GROSS_SURRENDER_VALUE  NUMBER(17,3)      NOT NULL,
        LOAN_DEDUCTION         NUMBER(17,3)      DEFAULT 0,
        INTEREST_DEDUCTION     NUMBER(17,3)      DEFAULT 0,
        NET_PAYABLE_AMOUNT     NUMBER(17,3)      NOT NULL,
        GL_VOUCHER_NO          VARCHAR2(30),
        STATUS                 VARCHAR2(20)      DEFAULT 'REQUESTED' NOT NULL,
        APPROVED_BY            VARCHAR2(50),
        APPROVED_ON            DATE,
        APPROVAL_REMARKS       VARCHAR2(500),
        SETTLED_ON             DATE,
        IS_ACTIVE              CHAR(1)           DEFAULT 'Y' NOT NULL,
        CREATED_BY             VARCHAR2(50)      DEFAULT 'ADMIN' NOT NULL,
        CREATED_ON             DATE              DEFAULT SYSDATE NOT NULL,
        CONSTRAINT PK_POL_SURRENDER PRIMARY KEY (SURRENDER_ID),
        CONSTRAINT UQ_SURRENDER_NO UNIQUE (SURRENDER_NO),
        CONSTRAINT CHK_SURR_STATUS CHECK (STATUS IN ('REQUESTED', 'APPROVED', 'SETTLED', 'REJECTED')),
        CONSTRAINT CHK_SURR_ACT CHECK (IS_ACTIVE IN ('Y', 'N'))
      )`
    },
    {
      name: 'T_POLICY_MATURITY',
      sql: `CREATE TABLE T_POLICY_MATURITY (
        MATURITY_ID            NUMBER(10,0)      NOT NULL,
        MATURITY_NO            VARCHAR2(30)      NOT NULL,
        POL_NO                 VARCHAR2(30)      NOT NULL,
        MATURITY_DATE          DATE              NOT NULL,
        BASIC_SUM_ASSURED      NUMBER(17,3)      NOT NULL,
        VESTED_BONUS_AMOUNT    NUMBER(17,3)      DEFAULT 0,
        TERMINAL_BONUS_AMOUNT  NUMBER(17,3)      DEFAULT 0,
        GROSS_MATURITY_AMOUNT  NUMBER(17,3)      NOT NULL,
        LOAN_DEDUCTION         NUMBER(17,3)      DEFAULT 0,
        INTEREST_DEDUCTION     NUMBER(17,3)      DEFAULT 0,
        NET_MATURITY_PAYABLE   NUMBER(17,3)      NOT NULL,
        GL_VOUCHER_NO          VARCHAR2(30),
        STATUS                 VARCHAR2(20)      DEFAULT 'DUE' NOT NULL,
        APPROVED_BY            VARCHAR2(50),
        APPROVED_ON            DATE,
        APPROVAL_REMARKS       VARCHAR2(500),
        SETTLED_ON             DATE,
        IS_ACTIVE              CHAR(1)           DEFAULT 'Y' NOT NULL,
        CREATED_BY             VARCHAR2(50)      DEFAULT 'ADMIN' NOT NULL,
        CREATED_ON             DATE              DEFAULT SYSDATE NOT NULL,
        CONSTRAINT PK_POL_MATURITY PRIMARY KEY (MATURITY_ID),
        CONSTRAINT UQ_MATURITY_NO UNIQUE (MATURITY_NO),
        CONSTRAINT CHK_MAT_STATUS CHECK (STATUS IN ('DUE', 'INTIMATED', 'APPROVED', 'SETTLED')),
        CONSTRAINT CHK_MAT_ACT CHECK (IS_ACTIVE IN ('Y', 'N'))
      )`
    },
    {
      name: 'T_POLICY_LOAN',
      sql: `CREATE TABLE T_POLICY_LOAN (
        LOAN_ID                NUMBER(10,0)      NOT NULL,
        LOAN_NO                VARCHAR2(30)      NOT NULL,
        POL_NO                 VARCHAR2(30)      NOT NULL,
        LOAN_DATE              DATE              DEFAULT SYSDATE NOT NULL,
        SURRENDER_VALUE_AT_LOAN NUMBER(17,3)     NOT NULL,
        MAX_ELIGIBLE_LOAN      NUMBER(17,3)      NOT NULL,
        DISBURSED_AMOUNT       NUMBER(17,3)      NOT NULL,
        INTEREST_RATE_PCT      NUMBER(5,2)       DEFAULT 8.00 NOT NULL,
        OUTSTANDING_PRINCIPAL  NUMBER(17,3)      NOT NULL,
        ACCRUED_INTEREST       NUMBER(17,3)      DEFAULT 0 NOT NULL,
        TOTAL_INTEREST_PAID    NUMBER(17,3)      DEFAULT 0 NOT NULL,
        TOTAL_PRINCIPAL_REPAID NUMBER(17,3)      DEFAULT 0 NOT NULL,
        GL_VOUCHER_NO          VARCHAR2(30),
        STATUS                 VARCHAR2(20)      DEFAULT 'ACTIVE' NOT NULL,
        IS_ACTIVE              CHAR(1)           DEFAULT 'Y' NOT NULL,
        CREATED_BY             VARCHAR2(50)      DEFAULT 'ADMIN' NOT NULL,
        CREATED_ON             DATE              DEFAULT SYSDATE NOT NULL,
        CONSTRAINT PK_POL_LOAN PRIMARY KEY (LOAN_ID),
        CONSTRAINT UQ_LOAN_NO UNIQUE (LOAN_NO),
        CONSTRAINT CHK_LOAN_STATUS CHECK (STATUS IN ('ACTIVE', 'REPAID', 'FORECLOSED')),
        CONSTRAINT CHK_LOAN_ACT CHECK (IS_ACTIVE IN ('Y', 'N'))
      )`
    },
    {
      name: 'T_POLICY_LOAN_REPAYMENT',
      sql: `CREATE TABLE T_POLICY_LOAN_REPAYMENT (
        REPAYMENT_ID           NUMBER(10,0)      NOT NULL,
        REPAYMENT_NO           VARCHAR2(30)      NOT NULL,
        LOAN_NO                VARCHAR2(30)      NOT NULL,
        POL_NO                 VARCHAR2(30)      NOT NULL,
        REPAYMENT_DATE         DATE              DEFAULT SYSDATE NOT NULL,
        PRINCIPAL_PAID         NUMBER(17,3)      DEFAULT 0 NOT NULL,
        INTEREST_PAID          NUMBER(17,3)      DEFAULT 0 NOT NULL,
        TOTAL_PAID             NUMBER(17,3)      NOT NULL,
        PAY_MODE               VARCHAR2(20)      DEFAULT 'CASH' NOT NULL,
        TRANSACTION_REF        VARCHAR2(100),
        GL_VOUCHER_NO          VARCHAR2(30),
        RECEIVED_BY            VARCHAR2(50)      DEFAULT 'ADMIN' NOT NULL,
        CREATED_ON             DATE              DEFAULT SYSDATE NOT NULL,
        CONSTRAINT PK_LOAN_REPAY PRIMARY KEY (REPAYMENT_ID),
        CONSTRAINT UQ_REPAY_NO UNIQUE (REPAYMENT_NO),
        CONSTRAINT CHK_LRP_PAY_MODE CHECK (PAY_MODE IN ('CASH', 'CHEQUE', 'BANK_TRANSFER', 'CARD'))
      )`
    }
  ];

  for (const t of tables) {
    try {
      await conn.execute(t.sql);
      console.log(`Created table ${t.name}`);
    } catch (e) {
      if (e.errorNum === 955) {
        console.log(`Table ${t.name} already exists`);
      } else {
        console.error(`Error creating table ${t.name}:`, e.message);
      }
    }
  }

  // Indices
  const indices = [
    { name: 'IDX_REC_POL_NO', sql: `CREATE INDEX IDX_REC_POL_NO ON T_POLICY_PREMIUM_RECEIPT (POL_NO)` },
    { name: 'IDX_REC_PROP_NO', sql: `CREATE INDEX IDX_REC_PROP_NO ON T_POLICY_PREMIUM_RECEIPT (PROP_NO)` },
    { name: 'IDX_GL_VOUCHER', sql: `CREATE INDEX IDX_GL_VOUCHER ON T_GL_JOURNAL_ENTRY (JOURNAL_VOUCHER_NO)` },
    { name: 'IDX_SURR_POL_NO', sql: `CREATE INDEX IDX_SURR_POL_NO ON T_POLICY_SURRENDER (POL_NO)` },
    { name: 'IDX_MAT_POL_NO', sql: `CREATE INDEX IDX_MAT_POL_NO ON T_POLICY_MATURITY (POL_NO)` },
    { name: 'IDX_LOAN_POL_NO', sql: `CREATE INDEX IDX_LOAN_POL_NO ON T_POLICY_LOAN (POL_NO)` },
    { name: 'IDX_LRP_LOAN_NO', sql: `CREATE INDEX IDX_LRP_LOAN_NO ON T_POLICY_LOAN_REPAYMENT (LOAN_NO)` }
  ];

  for (const idx of indices) {
    try {
      await conn.execute(idx.sql);
      console.log(`Created index ${idx.name}`);
    } catch (e) {
      if (e.errorNum === 955 || e.errorNum === 1408) {
        console.log(`Index ${idx.name} already exists`);
      } else {
        console.error(`Error creating index ${idx.name}:`, e.message);
      }
    }
  }

  // Populate initial POL_NEXT_DUE_DATE and POL_INSTALLMENT_PREM for existing policies if null
  try {
    await conn.execute(`
      UPDATE T_POLICY_INFO p
      SET 
        p.POL_NEXT_DUE_DATE = NVL(p.POL_NEXT_DUE_DATE, ADD_MONTHS(p.POL_INCEPTION_DATE, 
          CASE p.POL_PAY_FREQ
            WHEN 'MONTHLY' THEN 1
            WHEN 'QUARTERLY' THEN 3
            WHEN 'SEMI_ANNUAL' THEN 6
            ELSE 12
          END
        )),
        p.POL_PAID_TO_DATE = NVL(p.POL_PAID_TO_DATE, p.POL_INCEPTION_DATE),
        p.POL_LAST_PREM_DATE = NVL(p.POL_LAST_PREM_DATE, p.POL_INCEPTION_DATE),
        p.POL_INSTALLMENT_PREM = NVL(p.POL_INSTALLMENT_PREM, (
          SELECT s.PPS_INSTALLMENT_PREM FROM T_POLICY_PREMIUM_SUMMARY s WHERE s.POL_NO = p.POL_NO
        )),
        p.POL_TOTAL_PREM_PAID = NVL(p.POL_TOTAL_PREM_PAID, (
          SELECT s.PPS_INSTALLMENT_PREM FROM T_POLICY_PREMIUM_SUMMARY s WHERE s.POL_NO = p.POL_NO
        ))
      WHERE p.IS_ACTIVE = 'Y'
    `);
    console.log('Updated existing policies with due dates & installment amounts');
  } catch (e) {
    console.error('Error updating existing policies:', e.message);
  }

  // Also update existing proposals: set FPR_STATUS = 'COLLECTED' for CONVERTED proposals, 'PENDING' for others
  try {
    await conn.execute(`
      UPDATE T_PROPOSAL_INFO
      SET FPR_STATUS = CASE WHEN PROP_STATUS = 'CONVERTED' THEN 'COLLECTED' ELSE 'PENDING' END
      WHERE FPR_STATUS IS NULL
    `);
    console.log('Updated proposal FPR_STATUS defaults');
  } catch (e) {
    console.error('Error updating proposal FPR status:', e.message);
  }

  console.log('Policy Servicing Schema deployment complete!');
  await conn.close();
}

run().catch(err => {
  console.error('Fatal deployment error:', err);
  process.exit(1);
});
