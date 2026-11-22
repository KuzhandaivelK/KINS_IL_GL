const oracledb = require('../backend/node_modules/oracledb');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

async function run() {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: 'KINS',
      password: 'KINS',
      connectString: 'localhost:1521/orcl'
    });
    console.log('Connected to Oracle 19c');

    // 1. Alter MTBL_WORKFLOW_LEVEL to add WFL_USER_GROUP if not exists
    try {
      await conn.execute(`ALTER TABLE MTBL_WORKFLOW_LEVEL ADD (WFL_USER_GROUP VARCHAR2(50))`);
      console.log('Added column WFL_USER_GROUP to MTBL_WORKFLOW_LEVEL');
    } catch (e) {
      if (e.errorNum === 1430) {
        console.log('Column WFL_USER_GROUP already exists in MTBL_WORKFLOW_LEVEL');
      } else {
        console.error('Error adding WFL_USER_GROUP:', e.message);
      }
    }

    // 2. Create MTBL_WORKFLOW_LEVEL_UG_MAP if not exists
    try {
      await conn.execute(`
        CREATE TABLE MTBL_WORKFLOW_LEVEL_UG_MAP (
          WF_CODE VARCHAR2(30) NOT NULL,
          WFL_LEVEL_NO NUMBER(3) NOT NULL,
          USER_GROUP VARCHAR2(50) NOT NULL,
          CAN_APPROVE_YN VARCHAR2(1) DEFAULT 'Y',
          CAN_REJECT_YN VARCHAR2(1) DEFAULT 'Y',
          CAN_REWORK_YN VARCHAR2(1) DEFAULT 'Y',
          CREATED_BY VARCHAR2(50) DEFAULT 'ADMIN',
          CREATED_ON DATE DEFAULT SYSDATE,
          CONSTRAINT PK_WF_LVL_UG PRIMARY KEY (WF_CODE, WFL_LEVEL_NO, USER_GROUP)
        )
      `);
      console.log('Created table MTBL_WORKFLOW_LEVEL_UG_MAP');
    } catch (e) {
      if (e.errorNum === 955) {
        console.log('Table MTBL_WORKFLOW_LEVEL_UG_MAP already exists');
      } else {
        console.error('Error creating MTBL_WORKFLOW_LEVEL_UG_MAP:', e.message);
      }
    }

    // 3. Ensure User Groups exist in STBL_CODE
    const requiredGroups = [
      { code: 'ADMIN', desc: 'System Administrator' },
      { code: 'DEUSER', desc: 'Data Entry / Intake Officer' },
      { code: 'UWUSER', desc: 'Underwriting Verification Officer' },
      { code: 'UWMGR', desc: 'Underwriting Manager' },
      { code: 'POLICY_ADMIN', desc: 'Policy Administration & Inception' },
      { code: 'CLMMGR', desc: 'Claims Adjudication Manager' },
      { code: 'SERVICE', desc: 'Policy Servicing Officer' }
    ];

    for (const g of requiredGroups) {
      const checkRes = await conn.execute(
        `SELECT COUNT(1) AS CNT FROM STBL_CODE WHERE CODE = 'USR_GRP' AND CODE_SUB_CODE = :subCode`,
        { subCode: g.code }
      );
      if (checkRes.rows[0].CNT === 0) {
        await conn.execute(
          `INSERT INTO STBL_CODE (CODE, CODE_DESC, CODE_SUB_CODE, CODE_SUB_CODE_DESC, CODE_CREATED_BY, CODE_CREATED_AT)
           VALUES ('USR_GRP', 'User Security Groups', :subCode, :descVal, 'SYSTEM', SYSDATE)`,
          { subCode: g.code, descVal: g.desc }
        );
        console.log(`Inserted group ${g.code} into STBL_CODE`);
      } else {
        console.log(`Group ${g.code} already present in STBL_CODE`);
      }
    }

    // 4. Ensure Users exist in MTBL_USER for each group
    const seedUsers = [
      { id: 'admin', name: 'System Administrator', group: 'ADMIN' },
      { id: 'uwuser1', name: 'John Doe - Underwriter', group: 'UWUSER' },
      { id: 'uwmgr1', name: 'Jane Smith - UW Manager', group: 'UWMGR' },
      { id: 'policy_admin', name: 'Robert King - Policy Admin', group: 'POLICY_ADMIN' },
      { id: 'service1', name: 'Alice Wong - Servicing Officer', group: 'SERVICE' }
    ];

    for (const u of seedUsers) {
      const uCheck = await conn.execute(
        `SELECT COUNT(1) AS CNT FROM MTBL_USER WHERE LOWER(USER_ID) = LOWER(:userId)`,
        { userId: u.id }
      );
      if (uCheck.rows[0].CNT === 0) {
        await conn.execute(
          `INSERT INTO MTBL_USER (
            USER_ID, USER_NAME, USER_GROUP, USER_PASSWORD, USER_DISABLE_FLAG, USER_CREATED_BY, USER_CREATED_AT
           ) VALUES (
            :userId, :userName, :userGroup, 'password123', 'N', 'SYSTEM', SYSDATE
           )`,
          { userId: u.id, userName: u.name, userGroup: u.group }
        );
        console.log(`Created user ${u.id} (${u.group}) in MTBL_USER`);
      } else {
        await conn.execute(
          `UPDATE MTBL_USER SET USER_GROUP = :userGroup, USER_DISABLE_FLAG = 'N' WHERE LOWER(USER_ID) = LOWER(:userId)`,
          { userId: u.id, userGroup: u.group }
        );
        console.log(`Updated user ${u.id} group to ${u.group}`);
      }
    }

    // 5. Ensure Head and Levels for Proposal Underwriting & Policy Issue exist
    // Check WF_PROP_UW
    const wfCheck = await conn.execute(
      `SELECT COUNT(1) AS CNT FROM MTBL_WORKFLOW_HEAD WHERE WF_CODE = 'WF_PROP_UW'`
    );
    if (wfCheck.rows[0].CNT === 0) {
      await conn.execute(`
        INSERT INTO MTBL_WORKFLOW_HEAD (
          WF_CODE, WF_NAME, WF_CATEGORY, WF_DESC, WF_TOTAL_LEVELS,
          WF_ALLOW_AUTO_APPROVAL_YN, WF_AUTO_APPROVAL_LIMIT, IS_ACTIVE, CREATED_BY, CREATED_ON
        ) VALUES (
          'WF_PROP_UW', 'Proposal Entry & Underwriting Clearance', 'UNDERWRITING',
          'Proposal verification, multi-tier risk clearance by sum assured, and policy conversion',
          3, 'N', 0, 'Y', 'SYSTEM', SYSDATE
        )
      `);
      console.log('Created MTBL_WORKFLOW_HEAD WF_PROP_UW');
    }

    // Check or insert levels for WF_PROP_UW
    const levels = [
      {
        levelNo: 1,
        name: 'Proposal Verification',
        roleCode: 'UW_OFFICER',
        userGroup: 'UWUSER',
        minAmt: 0,
        maxAmt: 500000,
        sla: 24,
        rejectYn: 'Y',
        reworkYn: 'Y'
      },
      {
        levelNo: 2,
        name: 'Underwriting Manager Approval',
        roleCode: 'SR_UNDERWRITER',
        userGroup: 'UWMGR',
        minAmt: 500001,
        maxAmt: 2500000,
        sla: 48,
        rejectYn: 'Y',
        reworkYn: 'Y'
      },
      {
        levelNo: 3,
        name: 'Policy Admin Inception & Authorization',
        roleCode: 'UW_COMMITTEE',
        userGroup: 'POLICY_ADMIN',
        minAmt: 0,
        maxAmt: 99999999,
        sla: 24,
        rejectYn: 'Y',
        reworkYn: 'Y'
      }
    ];

    for (const lvl of levels) {
      const lCheck = await conn.execute(
        `SELECT COUNT(1) AS CNT FROM MTBL_WORKFLOW_LEVEL WHERE WF_CODE = 'WF_PROP_UW' AND WFL_LEVEL_NO = :lvl`,
        { lvl: lvl.levelNo }
      );
      if (lCheck.rows[0].CNT === 0) {
        await conn.execute(
          `INSERT INTO MTBL_WORKFLOW_LEVEL (
            WFL_ID, WF_CODE, WFL_LEVEL_NO, WFL_LEVEL_NAME, WFL_ROLE_CODE, WFL_USER_GROUP,
            WFL_MIN_AMOUNT, WFL_MAX_AMOUNT, WFL_SLA_HOURS, WFL_ALLOW_REJECT_YN, WFL_ALLOW_REWORK_YN,
            IS_ACTIVE, CREATED_BY, CREATED_ON
           ) VALUES (
            SEQ_WFL_ID.NEXTVAL, 'WF_PROP_UW', :levelNo, :name, :roleCode, :userGroup,
            :minAmt, :maxAmt, :sla, :rejectYn, :reworkYn,
            'Y', 'SYSTEM', SYSDATE
           )`,
          {
            levelNo: lvl.levelNo,
            name: lvl.name,
            roleCode: lvl.roleCode,
            userGroup: lvl.userGroup,
            minAmt: lvl.minAmt,
            maxAmt: lvl.maxAmt,
            sla: lvl.sla,
            rejectYn: lvl.rejectYn,
            reworkYn: lvl.reworkYn
          }
        );
        console.log(`Inserted WF_PROP_UW Level ${lvl.levelNo} (${lvl.userGroup})`);
      } else {
        await conn.execute(
          `UPDATE MTBL_WORKFLOW_LEVEL 
           SET WFL_USER_GROUP = :userGroup,
               WFL_LEVEL_NAME = :name,
               WFL_MIN_AMOUNT = :minAmt,
               WFL_MAX_AMOUNT = :maxAmt
           WHERE WF_CODE = 'WF_PROP_UW' AND WFL_LEVEL_NO = :levelNo`,
          {
            userGroup: lvl.userGroup,
            name: lvl.name,
            minAmt: lvl.minAmt,
            maxAmt: lvl.maxAmt,
            levelNo: lvl.levelNo
          }
        );
        console.log(`Updated WF_PROP_UW Level ${lvl.levelNo} with WFL_USER_GROUP = ${lvl.userGroup}`);
      }

      // Populate MTBL_WORKFLOW_LEVEL_UG_MAP
      await conn.execute(
        `MERGE INTO MTBL_WORKFLOW_LEVEL_UG_MAP target
         USING (SELECT 'WF_PROP_UW' AS WF_CODE, :levelNo AS WFL_LEVEL_NO, :userGroup AS USER_GROUP FROM dual) src
         ON (target.WF_CODE = src.WF_CODE AND target.WFL_LEVEL_NO = src.WFL_LEVEL_NO AND target.USER_GROUP = src.USER_GROUP)
         WHEN NOT MATCHED THEN
           INSERT (WF_CODE, WFL_LEVEL_NO, USER_GROUP, CAN_APPROVE_YN, CAN_REJECT_YN, CAN_REWORK_YN, CREATED_BY, CREATED_ON)
           VALUES (src.WF_CODE, src.WFL_LEVEL_NO, src.USER_GROUP, 'Y', 'Y', 'Y', 'SYSTEM', SYSDATE)`,
        { levelNo: lvl.levelNo, userGroup: lvl.userGroup }
      );
    }

    // Also update any other existing workflow levels to default their WFL_USER_GROUP from WFL_ROLE_CODE if null
    await conn.execute(`
      UPDATE MTBL_WORKFLOW_LEVEL
      SET WFL_USER_GROUP = CASE 
        WHEN UPPER(WFL_ROLE_CODE) IN ('MAKER', 'UW_OFFICER') THEN 'UWUSER'
        WHEN UPPER(WFL_ROLE_CODE) IN ('CHECKER', 'SR_UNDERWRITER', 'UW_COMMITTEE') THEN 'UWMGR'
        WHEN UPPER(WFL_ROLE_CODE) LIKE '%CLAIM%' THEN 'CLMMGR'
        WHEN UPPER(WFL_ROLE_CODE) LIKE '%ADMIN%' THEN 'POLICY_ADMIN'
        ELSE 'ADMIN'
      END
      WHERE WFL_USER_GROUP IS NULL
    `);

    // Verify all workflow levels
    const finalLevels = await conn.execute(`
      SELECT l.WF_CODE, l.WFL_LEVEL_NO, l.WFL_LEVEL_NAME, l.WFL_ROLE_CODE, l.WFL_USER_GROUP, l.WFL_MIN_AMOUNT, l.WFL_MAX_AMOUNT
      FROM MTBL_WORKFLOW_LEVEL l
      ORDER BY l.WF_CODE, l.WFL_LEVEL_NO
    `);
    console.log('Final workflow levels:', JSON.stringify(finalLevels.rows, null, 2));

    console.log('Workflow User Group Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

run();
