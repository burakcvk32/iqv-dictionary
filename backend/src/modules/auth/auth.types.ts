export interface UserRecord {
  _id: string;
  username: string;
  password: string; // bcrypt hash — never sent in any API response
  full_name?: string;
  email?: string;
  role?: string;
  permissions?: string[];
  company_id?: string;
  organization_id?: string;
  company_name?: string;
  status?: string;
}

export type SafeUser = Omit<UserRecord, 'password'>;

export interface UsersRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
}

export interface LoginCredentials {
  username: string;
  password: string;
}
