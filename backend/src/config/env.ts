import 'dotenv/config';

const required = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const env = {
  MONGODB_URI: required('MONGODB_URI', 'mongodb://127.0.0.1:27017'),
  MONGODB_DB: required('MONGODB_DB', 'iqvizyon'),
  MONGODB_USERS_COLLECTION: required(
    'MONGODB_USERS_COLLECTION',
    'iqvizyon-users',
  ),
  MONGODB_DICTIONARY_COLLECTION: required(
    'MONGODB_DICTIONARY_COLLECTION',
    'iqvizyon-dictionary',
  ),
  // Single shared secret: the login endpoint signs with this, the Dictionary
  // (and every other module's) auth middleware verifies with this same
  // value. Do not introduce per-module secrets.
  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '12h',
  PORT: Number(process.env.PORT ?? 3001),
  // Virgülle ayrılmış birden fazla origin destekler (ör. LAN geliştirme:
  // `http://localhost:5173,http://192.168.10.158:5173`) — tek bir origin
  // yazılırsa (mevcut davranış) tek elemanlı bir dizi olur, geriye dönük
  // uyumludur. `*` özel durumu (tüm origin'lere izin) korunur.
  CORS_ORIGIN: (process.env.CORS_ORIGIN ?? '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
};
