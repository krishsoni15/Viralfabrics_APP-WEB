import { UserRepository, CreateUserData, UserQuery } from '../repositories/UserRepository';
import { NotFoundError, ValidationError, DatabaseError } from '@/lib/errors';
import { IUser } from '@/models/User';
import { logCreate } from '@/lib/logger';

export class UserService {
  /**
   * Get user by ID
   */
  static async getById(id: string, includePassword = false): Promise<IUser | null> {
    return UserRepository.findById(id, { includePassword });
  }

  /**
   * Get users with filters and pagination
   */
  static async getMany(query: UserQuery) {
    const { users, total } = await UserRepository.findMany(query);
    
    return {
      users,
      total,
      page: query.page || 1,
      limit: query.limit || 25,
    };
  }

  /**
   * Get active users
   */
  static async getActive(): Promise<IUser[]> {
    return UserRepository.findActive();
  }

  /**
   * Get user by username or email (for login)
   */
  static async getByUsernameOrEmail(identifier: string, includePassword = true): Promise<IUser | null> {
    return UserRepository.findByUsernameOrEmail(identifier, { includePassword });
  }

  /**
   * Create new user
   */
  static async create(data: CreateUserData): Promise<IUser> {
    // Check if username already exists
    const existing = await UserRepository.findByUsernameOrEmail(data.username);
    if (existing) {
      throw new ValidationError('Username already exists');
    }
    
    // Check if email already exists (if provided)
    if (data.email) {
      const existingByEmail = await UserRepository.findByUsernameOrEmail(data.email);
      if (existingByEmail) {
        throw new ValidationError('Email already exists');
      }
    }
    
    // Create user
    const user = await UserRepository.create(data);
    
    // Log creation (non-blocking)
    logCreate('user', (user._id as any).toString(), { ...(user as unknown as Record<string, unknown>), password: undefined }).catch(() => {});
    
    return user;
  }

  /**
   * Update user
   */
  static async update(id: string, updateData: Partial<CreateUserData>): Promise<IUser | null> {
    // Check if user exists
    const existing = await UserRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('User');
    }
    
    // If username is being updated, check for duplicates
    if (updateData.username && updateData.username !== existing.username) {
      const duplicate = await UserRepository.findByUsernameOrEmail(updateData.username);
      if (duplicate) {
        throw new ValidationError('Username already exists');
      }
    }
    
    // If email is being updated, check for duplicates
    if (updateData.email && updateData.email !== existing.email) {
      const duplicate = await UserRepository.findByUsernameOrEmail(updateData.email);
      if (duplicate) {
        throw new ValidationError('Email already exists');
      }
    }
    
    // Update user
    const updated = await UserRepository.updateById(id, updateData);
    
    if (!updated) {
      throw new NotFoundError('User');
    }
    
    return updated;
  }

  /**
   * Delete user
   */
  static async delete(id: string): Promise<void> {
    const user = await UserRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User');
    }
    
    await UserRepository.deleteById(id);
  }
}

