export interface UserListItem {
  userId: string;
  userName: string;
  description?: string | null;
  disableFlag: 'Y' | 'N';
  loginCount: number;
  createdAt?: string | null;
  createdBy?: string | null;
  modifiedAt?: string | null;
  modifiedBy?: string | null;
}

export interface CreateUserInput {
  userId: string;
  password: string;
  userName: string;
  description?: string;
  disableFlag: 'Y' | 'N';
}

export interface UpdateUserInput {
  userName?: string;
  password?: string;
  description?: string;
  disableFlag?: 'Y' | 'N';
}
