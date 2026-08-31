import { env } from './config/env';
import { closeMongo, connectMongo } from './config/db';
import { createApp } from './app';
import {
  ensureDictionaryIndexes,
  MongoDictionaryRepository,
} from './modules/dictionary/dictionary.repository.mongo';
import { MongoUsersRepository } from './modules/auth/auth.repository.mongo';
import { MongoPeopleRepository } from './modules/people/people.repository.mongo';

const start = async () => {
  const db = await connectMongo();
  await ensureDictionaryIndexes(db);

  // TEMP DEBUG (Turn 6 root-cause diagnosis) - remove once Kisi/People bug is confirmed fixed.
  const __debugUsersCount = await db
    .collection(env.MONGODB_USERS_COLLECTION)
    .countDocuments({});
  console.log(
    '[DEBUG][startup] database=%s usersCollection=%s usersCountAtStartup=%d',
    db.databaseName,
    env.MONGODB_USERS_COLLECTION,
    __debugUsersCount,
  );

  const dictionaryRepository = new MongoDictionaryRepository(db);
  const usersRepository = new MongoUsersRepository(db);
  const peopleRepository = new MongoPeopleRepository(db);

  const app = createApp({
    dictionaryRepository,
    usersRepository,
    peopleRepository,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    corsOrigin: env.CORS_ORIGIN,
  });

  const server = app.listen(env.PORT, () => {
    console.log(`IQV Dashboard backend listening on port ${env.PORT}`);
    console.log(`MongoDB: ${env.MONGODB_URI} / db=${env.MONGODB_DB}`);
    console.log(
      `Collections: users=${env.MONGODB_USERS_COLLECTION}, dictionary=${env.MONGODB_DICTIONARY_COLLECTION}`,
    );
  });

  const shutdown = async () => {
    server.close();
    await closeMongo();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
