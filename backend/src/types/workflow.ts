export interface WorkflowHeadRecord {
  WF_CODE: string;
  WF_NAME: string;
  WF_CATEGORY: string;
  WF_DESC?: string | null;
  WF_TOTAL_LEVELS: number;
  WF_ALLOW_AUTO_APPROVAL_YN: string;
  WF_AUTO_APPROVAL_LIMIT?: number | null;
  IS_ACTIVE: string;
  CREATED_BY?: string;
  CREATED_ON?: Date | string;
  MODIFIED_BY?: string | null;
  MODIFIED_ON?: Date | string | null;
  LEVELS_COUNT?: number;
}

export interface WorkflowLevelRecord {
  WFL_ID: number;
  WF_CODE: string;
  WFL_LEVEL_NO: number;
  WFL_LEVEL_NAME: string;
  WFL_ROLE_CODE: string;
  WFL_MIN_AMOUNT?: number | null;
  WFL_MAX_AMOUNT?: number | null;
  WFL_SLA_HOURS?: number | null;
  WFL_ALLOW_REJECT_YN: string;
  WFL_ALLOW_REWORK_YN: string;
  WFL_MANDATORY_DOC_YN: string;
  WFL_AUTO_ESCALATE_HOURS?: number | null;
  IS_ACTIVE: string;
  CREATED_BY?: string;
  CREATED_ON?: Date | string;
  MODIFIED_BY?: string | null;
  MODIFIED_ON?: Date | string | null;
}

export interface WorkflowDetail {
  head: WorkflowHeadRecord;
  levels: WorkflowLevelRecord[];
}

export interface WorkflowLevelInput {
  WFL_LEVEL_NO: number;
  WFL_LEVEL_NAME: string;
  WFL_ROLE_CODE: string;
  WFL_MIN_AMOUNT?: number | null;
  WFL_MAX_AMOUNT?: number | null;
  WFL_SLA_HOURS?: number | null;
  WFL_ALLOW_REJECT_YN?: string;
  WFL_ALLOW_REWORK_YN?: string;
  WFL_MANDATORY_DOC_YN?: string;
  WFL_AUTO_ESCALATE_HOURS?: number | null;
  IS_ACTIVE?: string;
}

export interface WorkflowInput {
  WF_CODE: string;
  WF_NAME: string;
  WF_CATEGORY: string;
  WF_DESC?: string | null;
  WF_TOTAL_LEVELS?: number;
  WF_ALLOW_AUTO_APPROVAL_YN?: string;
  WF_AUTO_APPROVAL_LIMIT?: number | null;
  IS_ACTIVE?: string;
  levels?: WorkflowLevelInput[];
}
