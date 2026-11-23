import oracledb from 'oracledb';
import { getConnection, releaseConnection } from '../config/database';
import { policyRepository } from './policyRepository';
import {
  PolicyEndorsementRecord,
  CreateEndorsementInput,
  EndorsementCategory
} from '../types/endorsement';
import { PolicyDetail } from '../types/policy';

export const endorsementRepository = {
  /**
   * Retrieve all endorsements for a specific policy
   */
  async getByPolicyNo(polNo: string): Promise<PolicyEndorsementRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const sql = `
        SELECT 
          ENDORSEMENT_ID,
          ENDORSEMENT_NO,
          POL_NO,
          ENDORSEMENT_TYPE,
          ENDORSEMENT_CATEGORY,
          TO_CHAR(EFFECTIVE_DATE, 'YYYY-MM-DD') AS EFFECTIVE_DATE,
          REASON,
          PREV_VALUE_JSON,
          NEW_VALUE_JSON,
          PREMIUM_IMPACT,
          STATUS,
          APPROVED_BY,
          TO_CHAR(APPROVED_ON, 'YYYY-MM-DD HH24:MI:SS') AS APPROVED_ON,
          REMARKS,
          IS_ACTIVE,
          CREATED_BY,
          TO_CHAR(CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
        FROM T_POLICY_ENDORSEMENT
        WHERE POL_NO = :polNo
        ORDER BY ENDORSEMENT_ID DESC
      `;
      const res = await connection.execute<PolicyEndorsementRecord>(
        sql,
        { polNo: polNo.trim() },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return res.rows || [];
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Retrieve all endorsements across all policies (with optional limit)
   */
  async getAll(): Promise<PolicyEndorsementRecord[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const sql = `
        SELECT 
          ENDORSEMENT_ID,
          ENDORSEMENT_NO,
          POL_NO,
          ENDORSEMENT_TYPE,
          ENDORSEMENT_CATEGORY,
          TO_CHAR(EFFECTIVE_DATE, 'YYYY-MM-DD') AS EFFECTIVE_DATE,
          REASON,
          PREV_VALUE_JSON,
          NEW_VALUE_JSON,
          PREMIUM_IMPACT,
          STATUS,
          APPROVED_BY,
          TO_CHAR(APPROVED_ON, 'YYYY-MM-DD HH24:MI:SS') AS APPROVED_ON,
          REMARKS,
          IS_ACTIVE,
          CREATED_BY,
          TO_CHAR(CREATED_ON, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_ON
        FROM T_POLICY_ENDORSEMENT
        ORDER BY ENDORSEMENT_ID DESC
        FETCH FIRST 200 ROWS ONLY
      `;
      const res = await connection.execute<PolicyEndorsementRecord>(
        sql,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return res.rows || [];
    } finally {
      await releaseConnection(connection);
    }
  },

  /**
   * Create, execute, and approve an official policy endorsement
   */
  async createEndorsement(
    data: CreateEndorsementInput,
    username: string = 'uwmgr',
    userGroup: string = 'UWMGR'
  ): Promise<{ endorsement: PolicyEndorsementRecord; policy: PolicyDetail }> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const polNo = data.polNo.trim();

      const existingPolicy = await policyRepository.findByPolicyNo(polNo);
      if (!existingPolicy) {
        throw new Error(`Policy contract '${polNo}' not found.`);
      }

      // Check policy status: Endorsements are permitted ONLY on incepted policies (IN_FORCE or APPROVED)
      if (existingPolicy.info.POL_STATUS !== 'IN_FORCE' && existingPolicy.info.POL_STATUS !== 'APPROVED') {
        throw new Error(
          `Policy '${polNo}' is in '${existingPolicy.info.POL_STATUS}' status. Endorsements can only be executed on approved/in-force policy contracts.`
        );
      }

      // Check authority: Underwriting Managers, Policy Admins, or Admins
      const allowedGroups = ['UWMGR', 'POLICY_ADMIN', 'ADMIN'];
      if (!allowedGroups.includes(userGroup.toUpperCase())) {
        throw new Error(`Access Denied: Only ${allowedGroups.join(', ')} users can execute policy endorsements.`);
      }

      // Generate Endorsement Number: END-YYYYMMDD-XXXX
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const seqRes = await connection.execute<{ SEQ: number }>(
        `SELECT SEQ_ENDORSEMENT_ID.NEXTVAL AS SEQ FROM DUAL`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const seqNum = seqRes.rows ? seqRes.rows[0].SEQ : Math.floor(1000 + Math.random() * 9000);
      const endorsementNo = `END-${today}-${String(seqNum).padStart(4, '0')}`;

      let category: EndorsementCategory = 'NON_FINANCIAL';
      let prevJson = '';
      let newJson = '';
      let premiumImpact = 0;

      // Handle specific endorsement operations
      switch (data.endorsementType) {
        case 'ADDRESS_CONTACT': {
          category = 'NON_FINANCIAL';
          const prev = {
            address: existingPolicy.assured?.PAS_ADDRESS,
            mobile: existingPolicy.assured?.PAS_MOBILE,
            email: existingPolicy.assured?.PAS_EMAIL,
            occupation: existingPolicy.assured?.PAS_OCCUPATION
          };
          prevJson = JSON.stringify(prev);
          newJson = JSON.stringify(data.addressContact || {});

          const ac = data.addressContact || {};
          await connection.execute(
            `UPDATE T_POLICY_ASSURED
             SET PAS_ADDRESS = NVL(:address, PAS_ADDRESS),
                 PAS_MOBILE = NVL(:mobile, PAS_MOBILE),
                 PAS_EMAIL = NVL(:email, PAS_EMAIL),
                 PAS_OCCUPATION = NVL(:occupation, PAS_OCCUPATION),
                 MODIFIED_BY = :username,
                 MODIFIED_ON = SYSDATE
             WHERE POL_NO = :polNo`,
            {
              address: ac.address ?? null,
              mobile: ac.mobile ?? null,
              email: ac.email ?? null,
              occupation: ac.occupation ?? null,
              username: username.substring(0, 26),
              polNo
            }
          );
          break;
        }

        case 'BENEFICIARY_CHANGE': {
          category = 'NON_FINANCIAL';
          prevJson = JSON.stringify(existingPolicy.beneficiaries || []);
          newJson = JSON.stringify(data.beneficiaries || []);

          if (!data.beneficiaries || data.beneficiaries.length === 0) {
            throw new Error('At least one beneficiary nominee must be specified for endorsement.');
          }

          const totalShare = data.beneficiaries.reduce((sum, b) => sum + (Number(b.sharePct) || 0), 0);
          if (Math.abs(totalShare - 100) > 0.01) {
            throw new Error(`Total beneficiary share percentages must equal 100%. Currently: ${totalShare}%.`);
          }

          // Replace existing policy beneficiaries
          await connection.execute(`DELETE FROM T_POLICY_BENEFICIARY WHERE POL_NO = :polNo`, { polNo });

          const benSql = `
            INSERT INTO T_POLICY_BENEFICIARY (
              PBEN_ID, POL_NO, POL_UID, PBEN_NAME, PBEN_RELATION,
              PBEN_DOB, PBEN_SHARE_PCT, PBEN_ID_TYPE, PBEN_ID_NO, PBEN_CONTACT,
              IS_ACTIVE, CREATED_BY, CREATED_ON
            )
            VALUES (
              SEQ_POL_PBEN_ID.NEXTVAL, :polNo, :polUid, :name, :relation,
              TO_DATE(:dob, 'YYYY-MM-DD'), :sharePct, :idType, :idNo, :contact,
              'Y', :createdBy, SYSDATE
            )
          `;
          for (const b of data.beneficiaries) {
            await connection.execute(benSql, {
              polNo,
              polUid: existingPolicy.info.POL_UID,
              name: b.name.trim(),
              relation: b.relation || 'SPOUSE',
              dob: b.dob ? b.dob.split('T')[0] : null,
              sharePct: b.sharePct || 100,
              idType: b.idType || 'NATIONAL_ID',
              idNo: b.idNo || null,
              contact: b.contact || null,
              createdBy: username.substring(0, 26)
            });
          }
          break;
        }

        case 'SUM_ASSURED_CHANGE': {
          category = 'FINANCIAL';
          const newSa = Number(data.sumAssuredChange?.newSumAssured);
          if (!newSa || newSa < 1000) {
            throw new Error('New Sum Assured must be at least $1,000.');
          }

          const oldSa = Number(existingPolicy.info.POL_SUM_ASSURED || 1);
          const currentInstPrem = Number(existingPolicy.premiumSummary?.PPS_INSTALLMENT_PREM || existingPolicy.info.TOTAL_PAYABLE || 0);
          const ratio = newSa / oldSa;

          const oldBasicPrem = Number(existingPolicy.premiumSummary?.PPS_BASIC_PREMIUM || 0);
          const newBasicPrem = Math.round((oldBasicPrem * ratio) * 100) / 100;
          const riderPrem = Number(existingPolicy.premiumSummary?.PPS_TOTAL_RIDER_PREMIUM || 0);
          const loading = Number(existingPolicy.premiumSummary?.PPS_TOTAL_LOADING || 0);
          const discount = Number(existingPolicy.premiumSummary?.PPS_TOTAL_DISCOUNT || 0);
          const newNetAnnual = Math.max(0, Math.round((newBasicPrem + riderPrem + loading - discount) * 100) / 100);
          const modalFactor = Number(existingPolicy.premiumSummary?.PPS_MODAL_FACTOR || 1.0);
          const newInstallmentPrem = Math.round((newNetAnnual * modalFactor) * 100) / 100;

          premiumImpact = Math.round((newInstallmentPrem - currentInstPrem) * 100) / 100;

          prevJson = JSON.stringify({
            sumAssured: oldSa,
            installmentPrem: currentInstPrem,
            basicPrem: oldBasicPrem
          });
          newJson = JSON.stringify({
            sumAssured: newSa,
            installmentPrem: newInstallmentPrem,
            basicPrem: newBasicPrem,
            premiumImpact
          });

          // Update T_POLICY_INFO
          await connection.execute(
            `UPDATE T_POLICY_INFO
             SET POL_SUM_ASSURED = :newSa,
                 POL_INSTALLMENT_PREM = :newInstPrem,
                 MODIFIED_BY = :username,
                 MODIFIED_ON = SYSDATE
             WHERE POL_NO = :polNo`,
            {
              newSa,
              newInstPrem: newInstallmentPrem,
              username: username.substring(0, 26),
              polNo
            }
          );

          // Update T_POLICY_PREMIUM_SUMMARY
          await connection.execute(
            `UPDATE T_POLICY_PREMIUM_SUMMARY
             SET PPS_BASIC_SUM_ASSURED = :newSa,
                 PPS_BASIC_PREMIUM = :newBasicPrem,
                 PPS_NET_ANNUAL_PREM = :newNetAnnual,
                 PPS_INSTALLMENT_PREM = :newInstPrem,
                 PPS_TOTAL_PAYABLE = :newInstPrem,
                 MODIFIED_BY = :username,
                 MODIFIED_ON = SYSDATE
             WHERE POL_NO = :polNo`,
            {
              newSa,
              newBasicPrem,
              newNetAnnual,
              newInstPrem: newInstallmentPrem,
              username: username.substring(0, 26),
              polNo
            }
          );
          break;
        }

        case 'FREQUENCY_CHANGE': {
          category = 'FINANCIAL';
          const newFreq = data.frequencyChange?.newPayFreq;
          if (!newFreq) {
            throw new Error('New payment frequency must be specified.');
          }

          const modalFactors: Record<string, number> = {
            ANNUAL: 1.0,
            SEMI_ANNUAL: 0.52,
            QUARTERLY: 0.265,
            MONTHLY: 0.088,
            SINGLE: 1.0
          };
          const newFactor = modalFactors[newFreq] || 1.0;
          const netAnnual = Number(existingPolicy.premiumSummary?.PPS_NET_ANNUAL_PREM || 0);
          const newInstallment = Math.round((netAnnual * newFactor) * 100) / 100;
          const currentInstPrem = Number(existingPolicy.premiumSummary?.PPS_INSTALLMENT_PREM || existingPolicy.info.TOTAL_PAYABLE || 0);

          premiumImpact = Math.round((newInstallment - currentInstPrem) * 100) / 100;

          prevJson = JSON.stringify({
            payFreq: existingPolicy.info.POL_PAY_FREQ,
            installmentPrem: currentInstPrem
          });
          newJson = JSON.stringify({
            payFreq: newFreq,
            modalFactor: newFactor,
            installmentPrem: newInstallment,
            premiumImpact
          });

          await connection.execute(
            `UPDATE T_POLICY_INFO
             SET POL_PAY_FREQ = :newFreq,
                 POL_INSTALLMENT_PREM = :newInst,
                 MODIFIED_BY = :username,
                 MODIFIED_ON = SYSDATE
             WHERE POL_NO = :polNo`,
            {
              newFreq,
              newInst: newInstallment,
              username: username.substring(0, 26),
              polNo
            }
          );

          await connection.execute(
            `UPDATE T_POLICY_PREMIUM_SUMMARY
             SET PPS_MODAL_FACTOR = :newFactor,
                 PPS_INSTALLMENT_PREM = :newInst,
                 PPS_TOTAL_PAYABLE = :newInst,
                 MODIFIED_BY = :username,
                 MODIFIED_ON = SYSDATE
             WHERE POL_NO = :polNo`,
            {
              newFactor,
              newInst: newInstallment,
              username: username.substring(0, 26),
              polNo
            }
          );
          break;
        }

        case 'RIDER_ADD_REMOVE': {
          category = 'FINANCIAL';
          const rc = data.riderChange;
          if (!rc || !rc.riderCode) {
            throw new Error('Rider code and action (ADD/REMOVE) are required.');
          }

          prevJson = JSON.stringify(existingPolicy.riders || []);

          if (rc.action === 'ADD') {
            const riderSa = rc.sumAssured || Math.min(50000, Number(existingPolicy.info.POL_SUM_ASSURED));
            const riderRate = rc.rate || 0.50;
            const riderPrem = rc.premium || Math.round(((riderSa / 1000) * riderRate) * 100) / 100;

            await connection.execute(
              `INSERT INTO T_POLICY_RIDER (
                PRD_ID, POL_NO, POL_UID, PRD_RIDER_CODE, PRD_RIDER_NAME,
                PRD_SUM_ASSURED, PRD_RATE, PRD_PREMIUM, IS_ACTIVE, CREATED_BY, CREATED_ON
              )
              VALUES (
                SEQ_POL_PRD_ID.NEXTVAL, :polNo, :polUid, :rCode, :rName,
                :rSa, :rRate, :rPrem, 'Y', :username, SYSDATE
              )`,
              {
                polNo,
                polUid: existingPolicy.info.POL_UID,
                rCode: rc.riderCode.toUpperCase(),
                rName: rc.riderName || rc.riderCode,
                rSa: riderSa,
                rRate: riderRate,
                rPrem: riderPrem,
                username: username.substring(0, 26)
              }
            );

            premiumImpact = Math.round(riderPrem * Number(existingPolicy.premiumSummary?.PPS_MODAL_FACTOR || 1.0) * 100) / 100;
          } else {
            // REMOVE
            await connection.execute(
              `DELETE FROM T_POLICY_RIDER WHERE POL_NO = :polNo AND UPPER(PRD_RIDER_CODE) = :rCode`,
              { polNo, rCode: rc.riderCode.toUpperCase() }
            );
          }

          // Recalculate total rider premium
          const riderSumRes = await connection.execute<{ TOTAL: number }>(
            `SELECT NVL(SUM(PRD_PREMIUM), 0) AS TOTAL FROM T_POLICY_RIDER WHERE POL_NO = :polNo AND IS_ACTIVE = 'Y'`,
            { polNo },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          );
          const newTotalRiderPrem = Number(riderSumRes.rows?.[0]?.TOTAL || 0);
          const basicPrem = Number(existingPolicy.premiumSummary?.PPS_BASIC_PREMIUM || 0);
          const loading = Number(existingPolicy.premiumSummary?.PPS_TOTAL_LOADING || 0);
          const discount = Number(existingPolicy.premiumSummary?.PPS_TOTAL_DISCOUNT || 0);
          const newNetAnnual = Math.max(0, Math.round((basicPrem + newTotalRiderPrem + loading - discount) * 100) / 100);
          const modalFactor = Number(existingPolicy.premiumSummary?.PPS_MODAL_FACTOR || 1.0);
          const newInstallment = Math.round((newNetAnnual * modalFactor) * 100) / 100;

          await connection.execute(
            `UPDATE T_POLICY_PREMIUM_SUMMARY
             SET PPS_TOTAL_RIDER_PREMIUM = :rPrem,
                 PPS_NET_ANNUAL_PREM = :netAnn,
                 PPS_INSTALLMENT_PREM = :inst,
                 PPS_TOTAL_PAYABLE = :inst,
                 MODIFIED_BY = :username,
                 MODIFIED_ON = SYSDATE
             WHERE POL_NO = :polNo`,
            {
              rPrem: newTotalRiderPrem,
              netAnn: newNetAnnual,
              inst: newInstallment,
              username: username.substring(0, 26),
              polNo
            }
          );

          await connection.execute(
            `UPDATE T_POLICY_INFO
             SET POL_INSTALLMENT_PREM = :inst,
                 MODIFIED_BY = :username,
                 MODIFIED_ON = SYSDATE
             WHERE POL_NO = :polNo`,
            { inst: newInstallment, username: username.substring(0, 26), polNo }
          );

          newJson = JSON.stringify(rc);
          break;
        }

        case 'GENERAL':
        default: {
          category = 'NON_FINANCIAL';
          prevJson = JSON.stringify({ remarks: existingPolicy.info.POL_APPROVAL_REMARKS });
          newJson = JSON.stringify({ reason: data.reason, remarks: data.remarks });
          break;
        }
      }

      // Insert Endorsement Record into T_POLICY_ENDORSEMENT
      const insertEndSql = `
        INSERT INTO T_POLICY_ENDORSEMENT (
          ENDORSEMENT_ID,
          ENDORSEMENT_NO,
          POL_NO,
          ENDORSEMENT_TYPE,
          ENDORSEMENT_CATEGORY,
          EFFECTIVE_DATE,
          REASON,
          PREV_VALUE_JSON,
          NEW_VALUE_JSON,
          PREMIUM_IMPACT,
          STATUS,
          APPROVED_BY,
          APPROVED_ON,
          REMARKS,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_ON
        )
        VALUES (
          SEQ_ENDORSEMENT_ID.NEXTVAL,
          :endorsementNo,
          :polNo,
          :endType,
          :endCategory,
          TO_DATE(:effDate, 'YYYY-MM-DD'),
          :reason,
          :prevJson,
          :newJson,
          :premImpact,
          'APPROVED',
          :approvedBy,
          SYSDATE,
          :remarks,
          'Y',
          :createdBy,
          SYSDATE
        )
      `;

      const effDateStr = data.effectiveDate ? data.effectiveDate.split('T')[0] : new Date().toISOString().slice(0, 10);
      await connection.execute(insertEndSql, {
        endorsementNo,
        polNo,
        endType: data.endorsementType,
        endCategory: category,
        effDate: effDateStr,
        reason: data.reason,
        prevJson: prevJson.slice(0, 4000),
        newJson: newJson.slice(0, 4000),
        premImpact: premiumImpact,
        approvedBy: username.substring(0, 50),
        remarks: data.remarks ? data.remarks.slice(0, 500) : null,
        createdBy: username.substring(0, 50)
      });

      // Audit Log in TTBL_WORKFLOW_LOG
      await connection.execute(
        `INSERT INTO TTBL_WORKFLOW_LOG (
          WFLOG_ID, WF_CODE, WFL_LEVEL_NO, REF_TRANS_NO,
          ACTION_TYPE, ACTION_BY, ACTION_DATE, COMMENTS, AMOUNT
        )
        VALUES (
          SEQ_WFLOG_ID.NEXTVAL, 'WF_POLICY_ENDORSE', 1, :polNo,
          'ENDORSEMENT', :username, SYSDATE, :comments, :impact
        )`,
        {
          polNo,
          username: username.substring(0, 26),
          comments: `[${endorsementNo}] Type: ${data.endorsementType} - ${data.reason}`.slice(0, 250),
          impact: premiumImpact
        }
      );

      await connection.commit();

      // Retrieve refreshed policy and created endorsement
      const updatedPolicy = await policyRepository.findByPolicyNo(polNo);
      if (!updatedPolicy) {
        throw new Error(`Failed to retrieve updated policy '${polNo}'.`);
      }

      const endList = await this.getByPolicyNo(polNo);
      const createdEnd = endList.find(e => e.ENDORSEMENT_NO === endorsementNo) || endList[0];

      return {
        endorsement: createdEnd,
        policy: updatedPolicy
      };
    } catch (err) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (_) {}
      }
      throw err;
    } finally {
      await releaseConnection(connection);
    }
  }
};
