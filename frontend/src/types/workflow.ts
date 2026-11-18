export type WorkflowCategory = 'NEW_BUSINESS' | 'UNDERWRITING' | 'POLICY_ADMIN' | 'CLAIMS' | 'FINANCE';

export interface WorkflowLevel {
  WFL_ID?: number;
  WF_CODE?: string;
  WFL_LEVEL_NO: number;
  WFL_LEVEL_NAME: string;
  WFL_ROLE_CODE: string;
  WFL_MIN_AMOUNT?: number | null;
  WFL_MAX_AMOUNT?: number | null;
  WFL_SLA_HOURS?: number | null;
  WFL_ALLOW_REJECT_YN: 'Y' | 'N';
  WFL_ALLOW_REWORK_YN: 'Y' | 'N';
  WFL_MANDATORY_DOC_YN: 'Y' | 'N';
  WFL_AUTO_ESCALATE_HOURS?: number | null;
  IS_ACTIVE: 'Y' | 'N';
  CREATED_BY?: string;
  CREATED_ON?: string;
  MODIFIED_BY?: string | null;
  MODIFIED_ON?: string | null;
}

export interface WorkflowHead {
  WF_CODE: string;
  WF_NAME: string;
  WF_CATEGORY: WorkflowCategory;
  WF_DESC?: string | null;
  WF_TOTAL_LEVELS: number;
  WF_ALLOW_AUTO_APPROVAL_YN: 'Y' | 'N';
  WF_AUTO_APPROVAL_LIMIT?: number | null;
  IS_ACTIVE: 'Y' | 'N';
  CREATED_BY?: string;
  CREATED_ON?: string;
  MODIFIED_BY?: string | null;
  MODIFIED_ON?: string | null;
  LEVELS_COUNT?: number;
}

export interface WorkflowDetail {
  head: WorkflowHead;
  levels: WorkflowLevel[];
}

export interface WorkflowFormData {
  WF_CODE: string;
  WF_NAME: string;
  WF_CATEGORY: WorkflowCategory;
  WF_DESC?: string;
  WF_TOTAL_LEVELS?: number;
  WF_ALLOW_AUTO_APPROVAL_YN?: 'Y' | 'N';
  WF_AUTO_APPROVAL_LIMIT?: number;
  IS_ACTIVE?: 'Y' | 'N';
  levels: WorkflowLevel[];
}

export interface LookupItem {
  code: string;
  label: string;
}
