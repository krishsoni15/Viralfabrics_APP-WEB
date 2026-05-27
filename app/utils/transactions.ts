import mongoose from 'mongoose';
import { DatabaseError } from '@/lib/errors';

/**
 * Execute a function within a MongoDB transaction
 * Automatically handles commit/rollback
 */
export async function withTransaction<T>(
  fn: (session: mongoose.ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw new DatabaseError(
      `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  } finally {
    session.endSession();
  }
}

/**
 * Execute multiple operations in a transaction
 */
export async function transaction<T>(
  operations: Array<(session: mongoose.ClientSession) => Promise<any>>
): Promise<T[]> {
  return withTransaction(async (session) => {
    return Promise.all(operations.map((op) => op(session)));
  });
}

