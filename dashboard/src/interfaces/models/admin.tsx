export interface AdminUser {
  _id: string;
  username: string;
  full_name?: string;
  email?: string;
  role?: string;
  permissions?: string[];
  company_id?: string;
  organization_id?: string;
  company_name?: string;
}

export interface Admin {
  token: string;
  user?: AdminUser;
}
