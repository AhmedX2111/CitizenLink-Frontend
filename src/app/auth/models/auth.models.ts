export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResponse {
  token: string | null;
  refreshToken?: string;
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'HANDLER' | 'AGENT';
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthResponse | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}