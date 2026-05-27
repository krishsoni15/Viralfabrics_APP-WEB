import mongoose, { ClientSession } from 'mongoose';
import Quality, { IQuality } from '@/models/Quality';
import { NotFoundError, DatabaseError } from '@/lib/errors';

export interface CreateQualityData {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface QualityQuery {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export class QualityRepository {
  /**
   * Find quality by ID
   */
  static async findById(
    id: string,
    options?: { session?: ClientSession; lean?: boolean }
  ): Promise<IQuality | null> {
    try {
      const query = Quality.findById(id);
      
      if (options?.session) {
        query.session(options.session);
      }
      
      if (options?.lean !== false) {
        query.lean();
      }
      
      return query.maxTimeMS(3000);
    } catch (error) {
      throw new DatabaseError(`Failed to find quality: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find quality by name
   */
  static async findByName(
    name: string,
    options?: { session?: ClientSession }
  ): Promise<IQuality | null> {
    try {
      const query = Quality.findOne({ 
        name: { $regex: name, $options: 'i' },
        isActive: true 
      }).lean();
      
      if (options?.session) {
        query.session(options.session);
      }
      
      const result = await query.maxTimeMS(3000);
      return result as unknown as IQuality | null;
    } catch (error) {
      throw new DatabaseError(`Failed to find quality by name: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find multiple qualities with filters
   */
  static async findMany(
    query: QualityQuery,
    options?: { session?: ClientSession }
  ): Promise<{ qualities: IQuality[]; total: number }> {
    try {
      const mongoQuery: any = {};

      if (query.isActive !== undefined) {
        mongoQuery.isActive = query.isActive;
      }

      // Text search
      if (query.search) {
        const searchPattern = query.search.trim();
        mongoQuery.$or = [
          { name: { $regex: searchPattern, $options: 'i' } },
          { description: { $regex: searchPattern, $options: 'i' } }
        ];
      }

      // Count total
      const total = await Quality.countDocuments(mongoQuery).maxTimeMS(3000);

      // Pagination
      const page = query.page || 1;
      const limit = Math.min(query.limit || 100, 100);
      const skip = (page - 1) * limit;

      // Find qualities
      const findQuery = Quality.find(mongoQuery)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .maxTimeMS(3000);

      if (options?.session) {
        findQuery.session(options.session);
      }

      const qualities = await findQuery;

      return { qualities: qualities as unknown as IQuality[], total };
    } catch (error) {
      throw new DatabaseError(`Failed to find qualities: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find active qualities
   */
  static async findActive(
    options?: { session?: ClientSession }
  ): Promise<IQuality[]> {
    try {
      const query = Quality.find({ isActive: true })
        .sort({ name: 1 })
        .lean()
        .maxTimeMS(3000);
      
      if (options?.session) {
        query.session(options.session);
      }
      
      const result = await query;
      return result as unknown as IQuality[];
    } catch (error) {
      throw new DatabaseError(`Failed to find active qualities: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create new quality
   */
  static async create(
    data: CreateQualityData,
    options?: { session?: ClientSession }
  ): Promise<IQuality> {
    try {
      const quality = new Quality(data);
      
      if (options?.session) {
        quality.$session(options.session);
      }
      
      return quality.save();
    } catch (error) {
      if ((error as any)?.code === 11000) {
        throw new DatabaseError('Quality name already exists');
      }
      throw new DatabaseError(`Failed to create quality: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update quality by ID
   */
  static async updateById(
    id: string,
    updateData: Partial<CreateQualityData>,
    options?: { session?: ClientSession }
  ): Promise<IQuality | null> {
    try {
      const query = Quality.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).lean();

      if (options?.session) {
        query.session(options.session);
      }

      const result = await query.maxTimeMS(3000);
      return result as unknown as IQuality | null;
    } catch (error) {
      throw new DatabaseError(`Failed to update quality: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete quality by ID
   */
  static async deleteById(
    id: string,
    options?: { session?: ClientSession }
  ): Promise<IQuality | null> {
    try {
      const query = Quality.findByIdAndDelete(id).lean();

      if (options?.session) {
        query.session(options.session);
      }

      const result = await query.maxTimeMS(3000);
      return result as unknown as IQuality | null;
    } catch (error) {
      throw new DatabaseError(`Failed to delete quality: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if quality exists
   */
  static async exists(
    id: string,
    options?: { session?: ClientSession }
  ): Promise<boolean> {
    try {
      const query = Quality.exists({ _id: id });
      
      if (options?.session) {
        query.session(options.session);
      }
      
      const result = await query.maxTimeMS(2000);
      return !!result;
    } catch (error) {
      throw new DatabaseError(`Failed to check quality existence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find qualities by IDs (batch)
   */
  static async findByIds(
    ids: string[],
    options?: { session?: ClientSession }
  ): Promise<IQuality[]> {
    try {
      const objectIds = ids
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));

      if (objectIds.length === 0) {
        return [];
      }

      const query = Quality.find({ _id: { $in: objectIds } })
        .lean()
        .maxTimeMS(3000);

      if (options?.session) {
        query.session(options.session);
      }

      const result = await query;
      return result as unknown as IQuality[];
    } catch (error) {
      throw new DatabaseError(`Failed to find qualities by IDs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

