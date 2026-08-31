import { Db, MongoClient } from 'mongodb';
import { env } from './env';

// Single shared MongoClient / connection pool for the whole process.
// Every request reuses this connection instead of opening a new one.
let client: MongoClient | null = null;
let db: Db | null = null;

export const connectMongo = async (): Promise<Db> => {
  if (db) {
    return db;
  }

  client = new MongoClient(env.MONGODB_URI, {
    maxPoolSize: 20,
  });

  await client.connect();
  db = client.db(env.MONGODB_DB);

  return db;
};

export const closeMongo = async (): Promise<void> => {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
};
