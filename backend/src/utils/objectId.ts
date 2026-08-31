import { ObjectId } from 'mongodb';

export const isValidObjectId = (id: string): boolean => ObjectId.isValid(id);
