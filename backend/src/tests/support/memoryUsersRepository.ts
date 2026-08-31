import { UserRecord, UsersRepository } from '../../modules/auth/auth.types';
import { turkishLower } from '../../utils/regex';

export class MemoryUsersRepository implements UsersRepository {
  constructor(private readonly users: UserRecord[] = []) {}

  async findByUsername(username: string): Promise<UserRecord | null> {
    const target = turkishLower(username.trim());
    return (
      this.users.find((u) => turkishLower(u.username.trim()) === target) ?? null
    );
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.find((u) => u._id === id) ?? null;
  }
}
