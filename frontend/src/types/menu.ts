export interface MenuListItem {
  MENU_ID: string;
  MENU_NAME: string;
  MENU_PARENT_ID: string | null;
  MENU_SEQ_NO: number;
  MENU_PATH: string | null;
  MENU_ICON: string | null;
  IS_ACTIVE: 'Y' | 'N';
  CREATED_BY?: string | null;
  CREATED_AT?: string | null;
  MODIFIED_BY?: string | null;
  MODIFIED_AT?: string | null;
  children?: MenuListItem[];
}

export interface CreateMenuInput {
  menuId: string;
  menuName: string;
  menuParentId?: string | null;
  menuSeqNo: number;
  menuPath?: string | null;
  menuIcon?: string | null;
  isActive: 'Y' | 'N';
}

export interface UpdateMenuInput {
  menuName?: string;
  menuParentId?: string | null;
  menuSeqNo?: number;
  menuPath?: string | null;
  menuIcon?: string | null;
  isActive?: 'Y' | 'N';
}
