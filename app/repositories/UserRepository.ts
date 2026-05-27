import mongoose, { ClientSession } from 'mongoose';
import User, { IUser } from '@/models/User';
import { NotFoundError, DatabaseError } from '@/lib/errors';

export interface CreateUserData {
  name: string;
  username: string;
  password: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  role?: 'superadmin' | 'user';
  isActive?: boolean;
  preferences?: {
    theme?: 'light' | 'dark';
    language?: 'en' | 'es' | 'fr';
    notifications?: boolean;
    timezone?: string;
  };
  metadata?: {
    createdBy?: string;
    department?: string;
    employeeId?: string;
    notes?: string;
  };
}

export interface UserQuery {
  search?: string;
  role?: string;
  isActive?: boolean;
  department?: string;
  page?: number;
  limit?: number;
}

export class UserRepository {
  /**
   * Find user by ID
   */
  static async findById(
    id: string,
    options?: { session?: ClientSession; lean?: boolean; includePassword?: boolean }
  ): Promise<IUser | null> {
    try {
      const query = User.findById(id);
      
      if (options?.session) {
        query.session(options.session);
      }
      
      if (!options?.includePassword) {
        query.select('-password');
      }
      
      if (options?.lean !== false) {
        query.lean();
        const result = await query.maxTimeMS(3000);
        return result as unknown as IUser | null;
      }
      
      return query.maxTimeMS(3000);
    } catch (error) {
      throw new DatabaseError(`Failed to find user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find user by username or email
   */
  static async findByUsernameOrEmail(
    identifier: string,
    options?: { session?: ClientSession; includePassword?: boolean }
  ): Promise<IUser | null> {
    try {
      const query = User.findOne({
        $or: [
          { username: identifier },
          { email: identifier }
        ]
      }).lean();
      
      if (options?.session) {
        query.session(options.session);
      }
      
      if (!options?.includePassword) {
        query.select('-password');
      }
      
      const result = await query.maxTimeMS(3000);
      return result as unknown as IUser | null;
    } catch (error) {
      throw new DatabaseError(`Failed to find user by identifier: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find multiple users with filters
   */
  static async findMany(
    query: UserQuery,
    options?: { session?: ClientSession }
  ): Promise<{ users: IUser[]; total: number }> {
    try {
      const mongoQuery: any = {};

      if (query.isActive !== undefined) {
        mongoQuery.isActive = query.isActive;
      }

      if (query.role) {
        mongoQuery.role = query.role;
      }

      if (query.department) {
        mongoQuery['metadata.department'] = query.department;
      }

      // Text search
      if (query.search) {
        const searchPattern = query.search.trim();
        mongoQuery.$or = [
          { name: { $regex: searchPattern, $options: 'i' } },
          { username: { $regex: searchPattern, $options: 'i' } },
          { email: { $regex: searchPattern, $options: 'i' } }
        ];
      }

      // Count total
      const total = await User.countDocuments(mongoQuery).maxTimeMS(3000);

      // Pagination
      const page = query.page || 1;
      const limit = Math.min(query.limit || 25, 100);
      const skip = (page - 1) * limit;

      // Find users
      const findQuery = User.find(mongoQuery)
        .select('-password')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .maxTimeMS(3000);

      if (options?.session) {
        findQuery.session(options.session);
      }

      const users = await findQuery;

      return { users: users as unknown as IUser[], total };
    } catch (error) {
      throw new DatabaseError(`Failed to find users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find active users
   */
  static async findActive(
    options?: { session?: ClientSession }
  ): Promise<IUser[]> {
    try {
      const query = User.find({ isActive: true })
        .select('-password')
        .sort({ name: 1 })
        .lean()
        .maxTimeMS(3000);
      
      if (options?.session) {
        query.session(options.session);
      }
      
      const result = await query;
      return result as unknown as IUser[];
    } catch (error) {
      throw new DatabaseError(`Failed to find active users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create new user
   */
  static async create(
    data: CreateUserData,
    options?: { session?: ClientSession }
  ): Promise<IUser> {
    try {
      const user = new User(data);
      
      if (options?.session) {
        user.$session(options.session);
      }
      
      return user.save();
    } catch (error) {
      if ((error as any)?.code === 11000) {
        throw new DatabaseError('Username already exists');
      }
      throw new DatabaseError(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update user by ID
   */
  static async updateById(
    id: string,
    updateData: Partial<CreateUserData>,
    options?: { session?: ClientSession }
  ): Promise<IUser | null> {
    try {
      const query = User.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      )
      .select('-password')
      .lean();

      if (options?.session) {
        query.session(options.session);
      }

      const result = await query.maxTimeMS(3000);
      return result as unknown as IUser | null;
    } catch (error) {
      throw new DatabaseError(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete user by ID
   */
  static async deleteById(
    id: string,
    options?: { session?: ClientSession }
  ): Promise<IUser | null> {
    try {
      const query = User.findByIdAndDelete(id)
        .select('-password')
        .lean();

      if (options?.session) {
        query.session(options.session);
      }

      const result = await query.maxTimeMS(3000);
      return result as unknown as IUser | null;
    } catch (error) {
      throw new DatabaseError(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if user exists
   */
  static async exists(
    id: string,
    options?: { session?: ClientSession }
  ): Promise<boolean> {
    try {
      const query = User.exists({ _id: id });
      
      if (options?.session) {
        query.session(options.session);
      }
      
      const result = await query.maxTimeMS(2000);
      return !!result;
    } catch (error) {
      throw new DatabaseError(`Failed to check user existence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

