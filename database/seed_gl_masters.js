const oracledb = require('../backend/node_modules/oracledb');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

async function run() {
  const c = await oracledb.getConnection({
    user: 'KINS',
    password: 'KINS',
    connectString: 'localhost:1521/orcl'
  });

  // Seed GL Covers
  const covers = [
    { code: 'GL_DEATH', desc: 'Group Basic Life & Death Benefit', type: 'D', lob: 'GL' },
    { code: 'GL_PTD', desc: 'Group Permanent Total Disability (PTD)', type: 'A', lob: 'GL' },
    { code: 'GL_ADD', desc: 'Group Accidental Death & Dismemberment', type: 'A', lob: 'GL' },
    { code: 'GL_CI', desc: 'Group Accelerated Critical Illness (CI)', type: 'A', lob: 'GL' },
    { code: 'GL_MED', desc: 'Group Repatriation & Medical Evacuation', type: 'A', lob: 'GL' }
  ];

  for (const cov of covers) {
    try {
      await c.execute(`
        MERGE INTO MTBL_COVER dest
        USING (SELECT :covCode AS CODE FROM DUAL) src
        ON (dest.COVER_CODE = src.CODE)
        WHEN MATCHED THEN
          UPDATE SET COVER_DESC = :covDesc, COVER_LOB = :lob, COVER_ACTIVE_YN = 'Y'
        WHEN NOT MATCHED THEN
          INSERT (COVER_CODE, COVER_DESC, COVER_L1_DESC, COVER_TYPE, COVER_ACTIVE_YN, COVER_APP_ON_BASIC_RATE, COVER_MIN_SA, COVER_MAX_SA, COVER_LOB, COVER_CREATED_BY, COVER_CREATED_AT)
          VALUES (:covCode, :covDesc, :covDesc, :covType, 'Y', 'N', 10000, 10000000, :lob, 'ADMIN', SYSDATE)
      `, { covCode: cov.code, covDesc: cov.desc, covType: cov.type, lob: cov.lob });
      console.log('Merged GL Cover:', cov.code);
    } catch(e) { console.error('Error cover', cov.code, e.message); }
  }

  // Seed GL Products
  const products = [
    { code: 'GL_TERM01', name: 'Corporate Group Term Life Insurance', type: 'T', lob: 'GL' },
    { code: 'GL_CRED01', name: 'Group Credit & Loan Protection Plan', type: 'T', lob: 'GL' },
    { code: 'GL_GRAT01', name: 'Group Gratuity & End-of-Service Scheme', type: 'E', lob: 'GL' }
  ];

  for (const prod of products) {
    try {
      await c.execute(`
        MERGE INTO MTBL_PRODUCT dest
        USING (SELECT :code AS CODE FROM DUAL) src
        ON (dest.PROD_CODE = src.CODE)
        WHEN MATCHED THEN
          UPDATE SET PROD_NAME = :name, PROD_LOB = :lob
        WHEN NOT MATCHED THEN
          INSERT (PROD_CODE, PROD_NAME, PROD_TYPE, PROD_TERM_FM, PROD_TERM_TO, PROD_MIN_AGE, PROD_MAX_AGE, PROD_MIN_SA, PROD_MAX_SA, PROD_LOB, PROD_CREATED_BY, PROD_CREATED_ON)
          VALUES (:code, :name, :type, 1, 30, 18, 65, 50000, 20000000, :lob, 'ADMIN', SYSDATE)
      `, { code: prod.code, name: prod.name, type: prod.type, lob: prod.lob });
      console.log('Merged GL Product:', prod.code);
    } catch(e) { console.error('Error prod', prod.code, e.message); }
  }

  console.log('Seeding completed successfully.');
  await c.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
