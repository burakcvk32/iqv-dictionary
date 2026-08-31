import jwt from 'jsonwebtoken';
import { createApp } from '../../app';
import { MemoryDictionaryRepository } from './memoryRepository';
import { MemoryUsersRepository } from './memoryUsersRepository';
import { UserRecord } from '../../modules/auth/auth.types';
import { MemoryPeopleRepository } from './memoryPeopleRepository';
import { PersonRecord } from '../../modules/people/people.types';

export const TEST_JWT_SECRET = 'test-secret';

export const buildTestApp = (
  users: UserRecord[] = [],
  people: PersonRecord[] = [],
) => {
  const dictionaryRepository = new MemoryDictionaryRepository();
  const usersRepository = new MemoryUsersRepository(users);
  const peopleRepository = new MemoryPeopleRepository(people);
  const app = createApp({
    dictionaryRepository,
    usersRepository,
    peopleRepository,
    jwtSecret: TEST_JWT_SECRET,
    jwtExpiresIn: '1h',
    corsOrigin: '*',
  });

  return {
    app,
    dictionaryRepository,
    usersRepository,
    peopleRepository,
  };
};

export const signTestToken = (
  payload: Record<string, unknown> = {
    _id: 'u1',
    username: 'tester',
    role: 'admin',
  },
  options: jwt.SignOptions = { expiresIn: '1h' },
) => jwt.sign(payload, TEST_JWT_SECRET, options);
