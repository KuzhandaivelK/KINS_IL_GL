export interface UserProfile {
  userId: string;
  userName: string;
  userGroup?: string;
  description?: string | null;
  disableFlag: string;
  loginCount?: number;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: UserProfile;
    token?: string;
  };
  errors?: Array<{ field: string; message: string }>;
}

export interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}
