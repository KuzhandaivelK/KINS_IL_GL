const path = require('path');
const oracledb = require(path.join(__dirname, '../backend/node_modules/oracledb'));
require(path.join(__dirname, '../backend/node_modules/dotenv')).config({ path: path.join(__dirname, '../backend/.env') });

const dbConfig = {
  user: process.env.DB_USER || 'KINS',
  password: process.env.DB_PASSWORD || 'KINS',
  connectString: process.env.DB_CONNECT_STRING || 'localhost:1521/orcl'
};

async function run() {
  let conn;
  try {
    conn = await oracledb.getConnection(dbConfig);
    console.log('Connected to Oracle 19c database.');

    // 1. Create Sequence
    try {
      await conn.execute(`CREATE SEQUENCE SEQ_ENDORSEMENT_ID START WITH 10001 INCREMENT BY 1 NOCACHE NOCYCLE`);
      console.log('✓ Created SEQ_ENDORSEMENT_ID');
    } catch (e) {
      if (e.errorNum === 955) {
        console.log('- SEQ_ENDORSEMENT_ID already exists.');
      } else {
        throw e;
      }
    }

    // 2. Create T_POLICY_ENDORSEMENT
    const createTableSql = `
      CREATE TABLE T_POLICY_ENDORSEMENT (
        ENDORSEMENT_ID       NUMBER(10,0)      NOT NULL,
        ENDORSEMENT_NO       VARCHAR2(30)      NOT NULL,
        POL_NO               VARCHAR2(30)      NOT NULL,
        ENDORSEMENT_TYPE     VARCHAR2(30)      NOT NULL,
        ENDORSEMENT_CATEGORY VARCHAR2(20)      DEFAULT 'NON_FINANCIAL' NOT NULL,
        EFFECTIVE_DATE       DATE              DEFAULT SYSDATE NOT NULL,
        REASON               VARCHAR2(250)     NOT NULL,
        PREV_VALUE_JSON      VARCHAR2(4000),
        NEW_VALUE_JSON       VARCHAR2(4000),
        PREMIUM_IMPACT       NUMBER(17,3)      DEFAULT 0,
        STATUS               VARCHAR2(20)      DEFAULT 'APPROVED' NOT NULL,
        APPROVED_BY          VARCHAR2(50)      DEFAULT 'UWMGR',
        APPROVED_ON          DATE              DEFAULT SYSDATE,
        REMARKS              VARCHAR2(500),
        IS_ACTIVE            CHAR(1)           DEFAULT 'Y' NOT NULL,
        CREATED_BY           VARCHAR2(50)      DEFAULT 'ADMIN' NOT NULL,
        CREATED_ON           DATE              DEFAULT SYSDATE NOT NULL,
        CONSTRAINT PK_POL_ENDORSEMENT PRIMARY KEY (ENDORSEMENT_ID),
        CONSTRAINT UQ_ENDORSEMENT_NO UNIQUE (ENDORSEMENT_NO),
        CONSTRAINT CHK_END_CAT CHECK (ENDORSEMENT_CATEGORY IN ('FINANCIAL', 'NON_FINANCIAL')),
        CONSTRAINT CHK_END_STATUS CHECK (STATUS IN ('SUBMITTED', 'APPROVED', 'REJECTED'))
      )
    `;

    try {
      await conn.execute(createTableSql);
      console.log('✓ Created table T_POLICY_ENDORSEMENT');
    } catch (e) {
      if (e.errorNum === 955) {
        console.log('- T_POLICY_ENDORSEMENT already exists.');
      } else {
        throw e;
      }
    }

    // 3. Create Index
    try {
      await conn.execute(`CREATE INDEX IDX_END_POL_NO ON T_POLICY_ENDORSEMENT (POL_NO)`);
      console.log('✓ Created index IDX_END_POL_NO');
    } catch (e) {
      if (e.errorNum === 955 || e.errorNum === 1408) {
        console.log('- IDX_END_POL_NO already exists.');
      } else {
        throw e;
      }
    }

    console.log('\nEndorsement schema setup completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    if (conn) await conn.close();
  }
}

run();
