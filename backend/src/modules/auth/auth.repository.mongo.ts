import { Collection, Db, ObjectId } from 'mongodb';
import { env } from '../../config/env';
import { UserRecord, UsersRepository } from './auth.types';
import { buildExactInsensitiveRegex } from '../../utils/regex';

// Mongo document shape on disk; `_id` is an ObjectId there, mapped to a
// string at the repository boundary like the Dictionary module does.
interface UserDocument {
  _id: { toHexString(): string };
  username: string;
  password: string;
  full_name?: string;
  email?: string;
  role?: string;
  permissions?: string[];
  company_id?: string;
  organization_id?: string;
  company_name?: string;
  status?: string;
}

const toRecord = (doc: UserDocument): UserRecord => ({
  _id: doc._id.toHexString(),
  username: doc.username,
  password: doc.password,
  full_name: doc.full_name,
  email: doc.email,
  role: doc.role,
  permissions: doc.permissions,
  company_id: doc.company_id,
  organization_id: doc.organization_id,
  company_name: doc.company_name,
  status: doc.status,
});

export class MongoUsersRepository implements UsersRepository {
  private readonly collection: Collection<UserDocument>;

  constructor(db: Db) {
    this.collection = db.collection<UserDocument>(env.MONGODB_USERS_COLLECTION);
  }

  async findByUsername(username: string): Promise<UserRecord | null> {
    // Case-insensitive lookup (usernames are typically typed inconsistently
    // by users), exact match only — not a substring search.
    const doc = await this.collection.findOne({
      username: buildExactInsensitiveRegex(username),
    });

    return doc ? toRecord(doc) : null;
  }

  // `GET /api/v1/auth/me` icin eklendi -- people.repository.mongo.ts'teki
  // GERCEK `findById` deseniyle (ObjectId.isValid guard, ayni kutuphane)
  // BIREBIR ayni; gecersiz/bozuk bir id formatinda (ObjectId.isValid
  // false donerse) sorgu hic calistirilmadan null donulur.
  async findById(id: string): Promise<UserRecord | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }

    const doc = await this.collection.findOne({ _id: new ObjectId(id) });

    return doc ? toRecord(doc) : null;
  }
}
