export interface ITokenPayload {
  id: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface SignupDTO {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: UserRole;
  };
}