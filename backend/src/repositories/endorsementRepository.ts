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
   * Calculate endorsement impact via Oracle PL/SQL package PKG_POLICY_ENDORSEMENT
   */
  async calculateImpact(
    polNo: string,
    endorsementType: string,
    newSumAssured?: number | null,
    newPayFreq?: string | null
  ): Promise<{
    category: string;
    oldSumAssured: number;
    newSumAssured: number;
    oldBasicPrem: number;
    newBasicPrem: number;
    oldNetAnnual: number;
    newNetAnnual: number;
    oldModalFactor: number;
    newModalFactor: number;
    oldInstallment: number;
    newInstallment: number;
    premiumImpact: number;
    newTaxAmount: number;
    newTotalPayable: number;
  }> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();
      const res = await connection.execute(
        `BEGIN
           PKG_POLICY_ENDORSEMENT.CALCULATE_ENDORSEMENT(
             p_pol_no              => :polNo,
             p_endorsement_type    => :endorsementType,
             p_new_sum_assured     => :newSumAssured,
             p_new_pay_freq        => :newPayFreq,
             p_category            => :category,
             p_old_sum_assured     => :oldSumAssured,
             p_new_sum_assured_out => :newSumAssuredOut,
             p_old_basic_prem      => :oldBasicPrem,
             p_new_basic_prem      => :newBasicPrem,
             p_old_net_annual      => :oldNetAnnual,
             p_new_net_annual      => :newNetAnnual,
             p_old_modal_factor    => :oldModalFactor,
             p_new_modal_factor    => :newModalFactor,
             p_old_installment     => :oldInstallment,
             p_new_installment     => :newInstallment,
             p_premium_impact      => :premiumImpact,
             p_new_tax_amount      => :newTaxAmount,
             p_new_total_payable   => :newTotalPayable,
             p_status              => :status,
             p_err_msg             => :errMsg
           );
         END;`,
        {
          polNo: polNo.trim(),
          endorsementType,
          newSumAssured: newSumAssured ?? null,
          newPayFreq: newPayFreq ?? null,
          category: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 50 },
          oldSumAssured: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          newSumAssuredOut: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          oldBasicPrem: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          newBasicPrem: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          oldNetAnnual: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          newNetAnnual: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          oldModalFactor: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          newModalFactor: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          oldInstallment: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          newInstallment: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          premiumImpact: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          newTaxAmount: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          newTotalPayable: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          status: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 50 },
          errMsg: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 500 }
        }
      );

      const out: any = res.outBinds;
      if (out.status !== 'SUCCESS') {
        throw new Error(out.errMsg || 'PL/SQL endorsement calculation failed.');
      }

      return {
        category: out.category,
        oldSumAssured: Number(out.oldSumAssured || 0),
        newSumAssured: Number(out.newSumAssuredOut || 0),
        oldBasicPrem: Number(out.oldBasicPrem || 0),
        newBasicPrem: Number(out.newBasicPrem || 0),
        oldNetAnnual: Number(out.oldNetAnnual || 0),
        newNetAnnual: Number(out.newNetAnnual || 0),
        oldModalFactor: Number(out.oldModalFactor || 1),
        newModalFactor: Number(out.newModalFactor || 1),
        oldInstallment: Number(out.oldInstallment || 0),
        newInstallment: Number(out.newInstallment || 0),
        premiumImpact: Number(out.premiumImpact || 0),
        newTaxAmount: Number(out.newTaxAmount || 0),
        newTotalPayable: Number(out.newTotalPayable || 0)
      };
    } finally {
      await releaseConnection(connection);
    }
  },

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

          // Execute DB Stored Procedure: PKG_POLICY_ENDORSEMENT.APPLY_FINANCIAL_ENDORSEMENT
          const applyRes = await connection.execute(
            `BEGIN
               PKG_POLICY_ENDORSEMENT.APPLY_FINANCIAL_ENDORSEMENT(
                 p_pol_no           => :polNo,
                 p_endorsement_type => :endType,
                 p_new_sum_assured  => :newSa,
                 p_new_pay_freq     => NULL,
                 p_username         => :username,
                 p_premium_impact   => :premiumImpact,
                 p_new_installment  => :newInstallment,
                 p_new_total        => :newTotal,
                 p_status           => :status,
                 p_err_msg          => :errMsg
               );
             END;`,
            {
              polNo,
              endType: 'SUM_ASSURED_CHANGE',
              newSa,
              username: username.substring(0, 26),
              premiumImpact: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
              newInstallment: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
              newTotal: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
              status: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 50 },
              errMsg: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 500 }
            }
          );

          const out: any = applyRes.outBinds;
          if (out.status !== 'SUCCESS') {
            throw new Error(out.errMsg || 'DB procedure PKG_POLICY_ENDORSEMENT failed.');
          }

          premiumImpact = Number(out.premiumImpact || 0);

          prevJson = JSON.stringify({
            sumAssured: existingPolicy.info.POL_SUM_ASSURED,
            installmentPrem: existingPolicy.premiumSummary?.PPS_INSTALLMENT_PREM || existingPolicy.info.TOTAL_PAYABLE
          });
          newJson = JSON.stringify({
            sumAssured: newSa,
            installmentPrem: out.newInstallment,
            totalPayable: out.newTotal,
            premiumImpact: out.premiumImpact
          });
          break;
        }

        case 'FREQUENCY_CHANGE': {
          category = 'FINANCIAL';
          const newFreq = data.frequencyChange?.newPayFreq;
          if (!newFreq) {
            throw new Error('New payment frequency must be specified.');
          }

          // Execute DB Stored Procedure: PKG_POLICY_ENDORSEMENT.APPLY_FINANCIAL_ENDORSEMENT
          const applyRes = await connection.execute(
            `BEGIN
               PKG_POLICY_ENDORSEMENT.APPLY_FINANCIAL_ENDORSEMENT(
                 p_pol_no           => :polNo,
                 p_endorsement_type => :endType,
                 p_new_sum_assured  => NULL,
                 p_new_pay_freq     => :newFreq,
                 p_username         => :username,
                 p_premium_impact   => :premiumImpact,
                 p_new_installment  => :newInstallment,
                 p_new_total        => :newTotal,
                 p_status           => :status,
                 p_err_msg          => :errMsg
               );
             END;`,
            {
              polNo,
              endType: 'FREQUENCY_CHANGE',
              newFreq,
              username: username.substring(0, 26),
              premiumImpact: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
              newInstallment: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
              newTotal: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
              status: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 50 },
              errMsg: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 500 }
            }
          );

          const out: any = applyRes.outBinds;
          if (out.status !== 'SUCCESS') {
            throw new Error(out.errMsg || 'DB procedure PKG_POLICY_ENDORSEMENT failed.');
          }

          premiumImpact = Number(out.premiumImpact || 0);

          prevJson = JSON.stringify({
            payFreq: existingPolicy.info.POL_PAY_FREQ,
            installmentPrem: existingPolicy.premiumSummary?.PPS_INSTALLMENT_PREM || existingPolicy.info.TOTAL_PAYABLE
          });
          newJson = JSON.stringify({
            payFreq: newFreq,
            installmentPrem: out.newInstallment,
            totalPayable: out.newTotal,
            premiumImpact: out.premiumImpact
          });
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
