import oracledb from 'oracledb';
import { getConnection, releaseConnection } from '../config/database';

export interface WorkflowPermissionResult {
  allowed: boolean;
  userGroup: string;
  authorizedGroups: string[];
  levelName: string;
  currentLevel: number;
  reason?: string;
}

export interface NextLevelResult {
  nextLevelNo: number;
  nextUserGroup: string;
  nextRole: string;
  nextLevelName: string;
  isFinalApproval: boolean;
}

export interface UserGroupInfo {
  code: string;
  name: string;
  userCount: number;
}

export interface WorkbasketItem {
  id: string;
  type: 'PROPOSAL' | 'POLICY' | 'CLAIM' | 'SERVICING';
  refNo: string;
  customerName: string;
  productName: string;
  planType: string;
  amount: number;
  totalPayable: number;
  status: string;
  stageName: string;
  requiredAction: string;
  targetGroup: string;
  priority: 'HIGH' | 'MEDIUM' | 'NORMAL';
  createdOn: string;
  fprStatus?: string;
  navigationUrl: string;
}

export interface WorkbasketSummary {
  userGroup: string;
  totalPending: number;
  proposalsCount: number;
  policiesCount: number;
  highPriorityCount: number;
  items: WorkbasketItem[];
}

export const workflowAuthService = {
  /**
   * Retrieve the effective user group for a given user from MTBL_USER
   */
  async getUserGroup(userId: string): Promise<string> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const result = await connection.execute<{ USER_GROUP: string }>(
        `SELECT NVL(USER_GROUP, 'ADMIN') AS USER_GROUP FROM MTBL_USER WHERE LOWER(USER_ID) = LOWER(:userId)`,
        { userId: userId.trim() },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (result.rows && result.rows.length > 0) {
        return (result.rows[0].USER_GROUP || 'ADMIN').toUpperCase();
      }
      return 'ADMIN';
    } catch (err) {
      console.error('Error in getUserGroup:', err);
      return 'ADMIN';
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Get all user groups from STBL_CODE along with active user counts
   */
  async getUserGroupsWithCounts(): Promise<UserGroupInfo[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const sql = `
        SELECT 
          c.CODE_SUB_CODE AS code,
          c.CODE_SUB_CODE_DESC AS name,
          (SELECT COUNT(1) FROM MTBL_USER u WHERE u.USER_GROUP = c.CODE_SUB_CODE AND NVL(u.USER_DISABLE_FLAG, 'N') = 'N') AS userCount
        FROM STBL_CODE c
        WHERE c.CODE = 'USR_GRP'
        ORDER BY c.CODE_SUB_CODE ASC
      `;
      const result = await connection.execute<any>(sql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return (result.rows || []).map((r: any) => ({
        code: r.CODE || r.code,
        name: r.NAME || r.name,
        userCount: Number(r.USERCOUNT ?? r.userCount ?? 0)
      }));
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Fetch level configuration and authorized groups from database
   */
  async getLevelConfig(wfCode: string, levelNo: number): Promise<{
    levelNo: number;
    levelName: string;
    roleCode: string;
    userGroup: string;
    minAmount: number;
    maxAmount: number | null;
    allowReject: boolean;
    allowRework: boolean;
    authorizedGroups: string[];
  } | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const code = wfCode.trim().toUpperCase();

      const lvlSql = `
        SELECT 
          WFL_LEVEL_NO,
          WFL_LEVEL_NAME,
          WFL_ROLE_CODE,
          WFL_USER_GROUP,
          NVL(WFL_MIN_AMOUNT, 0) AS WFL_MIN_AMOUNT,
          WFL_MAX_AMOUNT,
          WFL_ALLOW_REJECT_YN,
          WFL_ALLOW_REWORK_YN
        FROM MTBL_WORKFLOW_LEVEL
        WHERE WF_CODE = :code AND WFL_LEVEL_NO = :levelNo AND IS_ACTIVE = 'Y'
      `;

      const lvlRes = await connection.execute<any>(lvlSql, { code, levelNo }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (!lvlRes.rows || lvlRes.rows.length === 0) {
        return null;
      }

      const row = lvlRes.rows[0];

      // Get authorized groups from MTBL_WORKFLOW_LEVEL_UG_MAP
      const ugSql = `
        SELECT USER_GROUP FROM MTBL_WORKFLOW_LEVEL_UG_MAP
        WHERE WF_CODE = :code AND WFL_LEVEL_NO = :levelNo
      `;
      const ugRes = await connection.execute<{ USER_GROUP: string }>(ugSql, { code, levelNo }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const mappedGroups = (ugRes.rows || []).map(r => r.USER_GROUP.toUpperCase());

      // Include primary WFL_USER_GROUP if not in map
      const primaryGroup = (row.WFL_USER_GROUP || 'ADMIN').toUpperCase();
      const authGroupsSet = new Set<string>(['ADMIN', primaryGroup, ...mappedGroups]);

      return {
        levelNo: row.WFL_LEVEL_NO,
        levelName: row.WFL_LEVEL_NAME,
        roleCode: row.WFL_ROLE_CODE,
        userGroup: primaryGroup,
        minAmount: Number(row.WFL_MIN_AMOUNT || 0),
        maxAmount: row.WFL_MAX_AMOUNT != null ? Number(row.WFL_MAX_AMOUNT) : null,
        allowReject: row.WFL_ALLOW_REJECT_YN === 'Y',
        allowRework: row.WFL_ALLOW_REWORK_YN === 'Y',
        authorizedGroups: Array.from(authGroupsSet)
      };
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Check if a specific user/group is permitted to execute an action on a workflow level
   */
  async checkPermission(params: {
    userId: string;
    userGroup?: string;
    wfCode: string;
    levelNo: number;
    action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'REWORK';
    amount?: number;
  }): Promise<WorkflowPermissionResult> {
    const { userId, wfCode, levelNo, action, amount } = params;
    let group = params.userGroup?.toUpperCase();
    if (!group) {
      group = await this.getUserGroup(userId);
    }

    // System Administrator has super-user override
    if (group === 'ADMIN') {
      return {
        allowed: true,
        userGroup: 'ADMIN',
        authorizedGroups: ['ADMIN'],
        levelName: 'System Administrator Super-Override',
        currentLevel: levelNo
      };
    }

    const config = await this.getLevelConfig(wfCode, levelNo);
    if (!config) {
      return {
        allowed: false,
        userGroup: group,
        authorizedGroups: [],
        levelName: `Level ${levelNo}`,
        currentLevel: levelNo,
        reason: `Workflow '${wfCode}' level ${levelNo} is not configured or inactive.`
      };
    }

    // Group check
    const isGroupAuthorized = config.authorizedGroups.includes(group);
    if (!isGroupAuthorized) {
      return {
        allowed: false,
        userGroup: group,
        authorizedGroups: config.authorizedGroups,
        levelName: config.levelName,
        currentLevel: levelNo,
        reason: `Access Denied: Action requires User Group '${config.userGroup}' (${config.authorizedGroups.join(', ')}). Your current group is '${group}'.`
      };
    }

    // Financial Limit check for Approvals
    if (action === 'APPROVE' && amount !== undefined && amount !== null) {
      if (config.maxAmount !== null && amount > config.maxAmount) {
        return {
          allowed: false,
          userGroup: group,
          authorizedGroups: config.authorizedGroups,
          levelName: config.levelName,
          currentLevel: levelNo,
          reason: `Limit Exceeded: Sum Assured / Amount (${amount.toLocaleString()}) exceeds your configured approval limit of ${config.maxAmount.toLocaleString()} for ${config.levelName}. Requires escalation to higher authority.`
        };
      }
    }

    return {
      allowed: true,
      userGroup: group,
      authorizedGroups: config.authorizedGroups,
      levelName: config.levelName,
      currentLevel: levelNo
    };
  },

  /**
   * Dynamically determine the next underwriting level based on database level configuration and amount
   */
  async determineNextUnderwritingLevel(currentLevel: number, sumAssured: number): Promise<NextLevelResult> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      // Query all levels for WF_UNDERWRITING ordered by level number
      const sql = `
        SELECT 
          WFL_LEVEL_NO,
          WFL_LEVEL_NAME,
          WFL_ROLE_CODE,
          WFL_USER_GROUP,
          NVL(WFL_MIN_AMOUNT, 0) AS WFL_MIN_AMOUNT,
          WFL_MAX_AMOUNT
        FROM MTBL_WORKFLOW_LEVEL
        WHERE WF_CODE = 'WF_UNDERWRITING' AND IS_ACTIVE = 'Y'
        ORDER BY WFL_LEVEL_NO ASC
      `;

      const res = await connection.execute<any>(sql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const levels = res.rows || [];

      if (levels.length === 0) {
        return {
          nextLevelNo: 1,
          nextUserGroup: 'UWMGR',
          nextRole: 'SR_UNDERWRITER',
          nextLevelName: 'Underwriting Approved',
          isFinalApproval: true
        };
      }

      // Find the required authority level for this sum assured
      let requiredLevelRow = levels[0];
      for (const lvl of levels) {
        const minAmt = Number(lvl.WFL_MIN_AMOUNT || 0);
        const maxAmt = lvl.WFL_MAX_AMOUNT != null ? Number(lvl.WFL_MAX_AMOUNT) : Infinity;
        if (sumAssured >= minAmt && (sumAssured <= maxAmt || maxAmt === Infinity)) {
          requiredLevelRow = lvl;
          break;
        }
      }

      // If current level is already >= the required level, underwriting is fully complete!
      if (currentLevel >= requiredLevelRow.WFL_LEVEL_NO) {
        return {
          nextLevelNo: requiredLevelRow.WFL_LEVEL_NO,
          nextUserGroup: requiredLevelRow.WFL_USER_GROUP || 'POLICY_ADMIN',
          nextRole: 'CHECKER',
          nextLevelName: 'Underwriting Fully Approved',
          isFinalApproval: true
        };
      }

      // Otherwise escalate to the next higher level
      const nextLvlNum = currentLevel + 1;
      const targetLvl = levels.find((l: any) => l.WFL_LEVEL_NO === nextLvlNum) || requiredLevelRow;

      return {
        nextLevelNo: targetLvl.WFL_LEVEL_NO,
        nextUserGroup: targetLvl.WFL_USER_GROUP || 'UWMGR',
        nextRole: targetLvl.WFL_ROLE_CODE || 'SR_UNDERWRITER',
        nextLevelName: targetLvl.WFL_LEVEL_NAME,
        isFinalApproval: false
      };
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Retrieve dynamic workbasket items filtered by the user's role and security group
   */
  async getWorkbasket(userId: string, userGroup?: string): Promise<WorkbasketSummary> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      let group = userGroup?.toUpperCase();
      if (!group) {
        group = await this.getUserGroup(userId);
      }

      const items: WorkbasketItem[] = [];

      // 1. Fetch Proposals relevant to user's group
      let propStatuses: string[] = [];
      if (group === 'ADMIN') {
        propStatuses = ['DRAFT', 'REWORK', 'SUBMITTED', 'UNDERWRITING', 'APPROVED'];
      } else if (group === 'DEUSER') {
        propStatuses = ['DRAFT', 'REWORK'];
      } else if (group === 'UWUSER') {
        propStatuses = ['SUBMITTED', 'UNDERWRITING'];
      } else if (group === 'UWMGR' || group === 'POLICY_ADMIN') {
        propStatuses = ['APPROVED'];
      }

      if (propStatuses.length > 0) {
        const inClause = propStatuses.map((_, i) => `:st${i}`).join(', ');
        const binds: Record<string, any> = {};
        propStatuses.forEach((st, i) => { binds[`st${i}`] = st; });

        const propSql = `
          SELECT 
            p.PROP_NO,
            p.PROP_PROD_CODE,
            pr.PROD_NAME,
            p.PROP_PLAN_TYPE,
            p.PROP_SUM_ASSURED,
            p.PROP_STATUS,
            p.PROP_CURRENT_LEVEL,
            p.PROP_ASSIGNED_ROLE,
            p.FPR_STATUS,
            p.FPR_RECEIPT_NO,
            TO_CHAR(p.CREATED_ON, 'YYYY-MM-DD HH24:MI') AS CREATED_ON,
            a.PAS_NAME,
            NVL(s.PPS_TOTAL_PAYABLE, 0) AS TOTAL_PAYABLE
          FROM T_PROPOSAL_INFO p
          LEFT JOIN T_PROPOSAL_ASSURED a ON a.PROP_NO = p.PROP_NO
          LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = p.PROP_PROD_CODE
          LEFT JOIN T_PROPOSAL_PREMIUM_SUMMARY s ON s.PROP_NO = p.PROP_NO
          WHERE p.PROP_STATUS IN (${inClause})
          ORDER BY p.CREATED_ON DESC
        `;

        const propRes = await connection.execute<any>(propSql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        for (const row of propRes.rows || []) {
          const sa = Number(row.PROP_SUM_ASSURED || 0);
          const st = row.PROP_STATUS;

          let targetGroup = 'DEUSER';
          let stageName = 'Proposal Entry & KYC';
          let requiredAction = 'Submit for Verification';

          if (st === 'SUBMITTED') {
            targetGroup = 'UWUSER';
            stageName = 'Underwriting Verification';
            requiredAction = 'Review Risk & Approve Proposal';
          } else if (st === 'UNDERWRITING') {
            targetGroup = 'UWUSER';
            stageName = `Underwriting Assessment (Level ${row.PROP_CURRENT_LEVEL || 1})`;
            requiredAction = 'Review Assessment & Approve Proposal';
          } else if (st === 'APPROVED') {
            targetGroup = 'UWMGR';
            stageName = 'Underwriting Approved';
            requiredAction = row.FPR_STATUS === 'COLLECTED' 
              ? 'Convert to Policy Contract' 
              : 'Collect First Premium (FPR) & Convert';
          } else if (st === 'REWORK') {
            targetGroup = 'DEUSER';
            stageName = 'Rework Required';
            requiredAction = 'Update KYC & Resubmit';
          }

          items.push({
            id: `PROP_${row.PROP_NO}`,
            type: 'PROPOSAL',
            refNo: row.PROP_NO,
            customerName: row.PAS_NAME || 'Unknown Applicant',
            productName: row.PROD_NAME || row.PROP_PROD_CODE || 'Life Policy',
            planType: row.PROP_PLAN_TYPE || 'INDIVIDUAL',
            amount: sa,
            totalPayable: Number(row.TOTAL_PAYABLE || 0),
            status: st,
            stageName,
            requiredAction,
            targetGroup,
            priority: sa >= 1000000 ? 'HIGH' : sa >= 500000 ? 'MEDIUM' : 'NORMAL',
            createdOn: row.CREATED_ON || '',
            fprStatus: row.FPR_STATUS || 'PENDING',
            navigationUrl: `/individual-life/proposal?propNo=${encodeURIComponent(row.PROP_NO)}&step=${st === 'REWORK' || st === 'DRAFT' ? 1 : 9}&from=workbasket`
          });
        }
      }

      // 2. Fetch Policies awaiting approval (UWMGR, POLICY_ADMIN or ADMIN)
      if (group === 'UWMGR' || group === 'POLICY_ADMIN' || group === 'ADMIN') {
        const polSql = `
          SELECT 
            p.POL_NO,
            p.PROP_NO,
            p.POL_PROD_CODE,
            pr.PROD_NAME,
            p.POL_PLAN_TYPE,
            p.POL_SUM_ASSURED,
            p.POL_STATUS,
            TO_CHAR(p.CREATED_ON, 'YYYY-MM-DD HH24:MI') AS CREATED_ON,
            a.PAS_NAME,
            NVL(s.PPS_TOTAL_PAYABLE, 0) AS TOTAL_PAYABLE
          FROM T_POLICY_INFO p
          LEFT JOIN T_POLICY_ASSURED a ON a.POL_NO = p.POL_NO
          LEFT JOIN MTBL_PRODUCT pr ON pr.PROD_CODE = p.POL_PROD_CODE
          LEFT JOIN T_POLICY_PREMIUM_SUMMARY s ON s.POL_NO = p.POL_NO
          WHERE p.POL_STATUS = 'PENDING_APPROVAL'
          ORDER BY p.CREATED_ON DESC
        `;

        const polRes = await connection.execute<any>(polSql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        for (const row of polRes.rows || []) {
          const sa = Number(row.POL_SUM_ASSURED || 0);
          items.push({
            id: `POL_${row.POL_NO}`,
            type: 'POLICY',
            refNo: row.POL_NO,
            customerName: row.PAS_NAME || 'Life Assured',
            productName: row.PROD_NAME || row.POL_PROD_CODE || 'Life Policy',
            planType: row.POL_PLAN_TYPE || 'INDIVIDUAL',
            amount: sa,
            totalPayable: Number(row.TOTAL_PAYABLE || 0),
            status: row.POL_STATUS,
            stageName: 'Policy Inception Sign-off',
            requiredAction: 'Authorize Policy & Issue Schedule',
            targetGroup: 'POLICY_ADMIN',
            priority: sa >= 1000000 ? 'HIGH' : 'NORMAL',
            createdOn: row.CREATED_ON || '',
            navigationUrl: `/policy-administration?policyNo=${encodeURIComponent(row.POL_NO)}&from=workbasket`
          });
        }
      }

      const proposalsCount = items.filter(i => i.type === 'PROPOSAL').length;
      const policiesCount = items.filter(i => i.type === 'POLICY').length;
      const highPriorityCount = items.filter(i => i.priority === 'HIGH').length;

      return {
        userGroup: group,
        totalPending: items.length,
        proposalsCount,
        policiesCount,
        highPriorityCount,
        items
      };
    } finally {
      await releaseConnection(connection);
    }
  }
};
