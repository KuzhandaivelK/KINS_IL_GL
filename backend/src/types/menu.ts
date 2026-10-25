/**
 * Represents a menu record in Oracle 19c (KINS.MTBL_MENU).
 */
export interface OracleMenuRecord {
  MENU_ID: string;
  MENU_NAME: string;
  MENU_PARENT_ID: string | null;
  MENU_SEQ_NO: number;
  MENU_PATH: string | null;
  MENU_ICON: string | null;
  IS_ACTIVE: string; // 'Y' | 'N'
  CREATED_BY: string | null;
  CREATED_AT: Date | null;
  MODIFIED_BY?: string | null;
  MODIFIED_AT?: Date | null;
}

export interface MenuItemTree extends OracleMenuRecord {
  children?: MenuItemTree[];
}

export interface CreateMenuInput {
  menuId: string;
  menuName: string;
  menuParentId?: string | null;
  menuSeqNo: number;
  menuPath?: string | null;
  menuIcon?: string | null;
  isActive?: 'Y' | 'N';
  createdBy?: string;
}

export interface UpdateMenuInput {
  menuName?: string;
  menuParentId?: string | null;
  menuSeqNo?: number;
  menuPath?: string | null;
  menuIcon?: string | null;
  isActive?: 'Y' | 'N';
  modifiedBy?: string;
}
