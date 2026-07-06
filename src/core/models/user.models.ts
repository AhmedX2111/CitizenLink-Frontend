

export interface UserResponse {
  id:          string;
  displayRef:  string;   // e.g. "USR-8492-X"
  username:    string;
  displayName: string;
  email:       string;
  role:        'ADMIN' | 'SUPERVISOR' | 'HANDLER' | 'AGENT';
  active:      boolean;
  createdAt:   string;
}

export interface CreateUserRequest {
  username:    string;
  displayName: string;
  email:       string;
  role:        'ADMIN' | 'SUPERVISOR' | 'HANDLER' | 'AGENT';
  password:    string;
}

export interface UpdateUserRequest {
  displayName: string;
  email:       string;
  role:        'ADMIN' | 'SUPERVISOR' | 'HANDLER' | 'AGENT';
}

export interface UserSearchRequest {
  role?:   'ADMIN' | 'SUPERVISOR' | 'HANDLER' | 'AGENT' | '';
  active?: boolean | '';
  page?:   number;
  size?:   number;
}