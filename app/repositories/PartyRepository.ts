import mongoose, { ClientSession } from 'mongoose';
import Party, { IParty } from '@/models/Party';
import { NotFoundError, DatabaseError } from '@/lib/errors';

export interface CreatePartyData {
  name: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  isActive?: boolean;
  category?: 'customer' | 'supplier' | 'partner' | 'other';
  priority?: number;
  creditLimit?: number;
  paymentTerms?: number;
  taxId?: string;
  website?: string;
  notes?: string;
  metadata?: {
    createdBy?: string;
    tags?: string[];
    source?: string;
    industry?: string;
    region?: string;
  };
}

export interface PartyQuery {
  search?: string;
  category?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export class PartyRepository {
  /**
   * Find party by ID
   */
  static async findById(
    id: string,
    options?: { session?: ClientSession; lean?: boolean }
  ): Promise<IParty | null> {
    try {
      const query = Party.findById(id);
      
      if (options?.session) {
        query.session(options.session);
      }
      
      if (options?.lean !== false) {
        query.lean();
      }
      
      return query.maxTimeMS(3000);
    } catch (error) {
      throw new DatabaseError(`Failed to find party: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find party by name
   */
  static async findByName(
    name: string,
    options?: { session?: ClientSession }
  ): Promise<IParty | null> {
    try {
      const query = Party.findOne({ 
        name: { $regex: name, $options: 'i' },
        isActive: true 
      }).lean();
      
      if (options?.session) {
        query.session(options.session);
      }
      
      const result = await query.maxTimeMS(3000);
      return result as unknown as IParty | null;
    } catch (error) {
      throw new DatabaseError(`Failed to find party by name: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find multiple parties with filters
   */
  static async findMany(
    query: PartyQuery,
    options?: { session?: ClientSession }
  ): Promise<{ parties: IParty[]; total: number }> {
    try {
      const mongoQuery: any = {};

      if (query.isActive !== undefined) {
        mongoQuery.isActive = query.isActive;
      }

      if (query.category) {
        mongoQuery.category = query.category;
      }

      // Text search
      if (query.search) {
        const searchPattern = query.search.trim();
        mongoQuery.$or = [
          { name: { $regex: searchPattern, $options: 'i' } },
          { contactName: { $regex: searchPattern, $options: 'i' } },
          { contactPhone: { $regex: searchPattern, $options: 'i' } }
        ];
      }

      // Count total
      const total = await Party.countDocuments(mongoQuery).maxTimeMS(3000);

      // Pagination
      const page = query.page || 1;
      const limit = Math.min(query.limit || 100, 100);
      const skip = (page - 1) * limit;

      // Find parties
      const findQuery = Party.find(mongoQuery)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .maxTimeMS(3000);

      if (options?.session) {
        findQuery.session(options.session);
      }

      const parties = await findQuery;

      return { parties: parties as unknown as IParty[], total };
    } catch (error) {
      throw new DatabaseError(`Failed to find parties: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find active parties
   */
  static async findActive(
    options?: { session?: ClientSession }
  ): Promise<IParty[]> {
    try {
      const query = Party.find({ isActive: true })
        .sort({ priority: -1, name: 1 })
        .lean()
        .maxTimeMS(3000);
      
      if (options?.session) {
        query.session(options.session);
      }
      
      const result = await query;
      return result as unknown as IParty[];
    } catch (error) {
      throw new DatabaseError(`Failed to find active parties: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create new party
   */
  static async create(
    data: CreatePartyData,
    options?: { session?: ClientSession }
  ): Promise<IParty> {
    try {
      const party = new Party(data);
      
      if (options?.session) {
        party.$session(options.session);
      }
      
      return party.save();
    } catch (error) {
      if ((error as any)?.code === 11000) {
        throw new DatabaseError('Party name already exists');
      }
      throw new DatabaseError(`Failed to create party: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update party by ID
   */
  static async updateById(
    id: string,
    updateData: Partial<CreatePartyData>,
    options?: { session?: ClientSession }
  ): Promise<IParty | null> {
    try {
      const query = Party.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).lean();

      if (options?.session) {
        query.session(options.session);
      }

      const result = await query.maxTimeMS(3000);
      return result as unknown as IParty | null;
    } catch (error) {
      throw new DatabaseError(`Failed to update party: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete party by ID
   */
  static async deleteById(
    id: string,
    options?: { session?: ClientSession }
  ): Promise<IParty | null> {
    try {
      const query = Party.findByIdAndDelete(id).lean();

      if (options?.session) {
        query.session(options.session);
      }

      const result = await query.maxTimeMS(3000);
      return result as unknown as IParty | null;
    } catch (error) {
      throw new DatabaseError(`Failed to delete party: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if party exists
   */
  static async exists(
    id: string,
    options?: { session?: ClientSession }
  ): Promise<boolean> {
    try {
      const query = Party.exists({ _id: id });
      
      if (options?.session) {
        query.session(options.session);
      }
      
      const result = await query.maxTimeMS(2000);
      return !!result;
    } catch (error) {
      throw new DatabaseError(`Failed to check party existence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find parties by IDs (batch)
   */
  static async findByIds(
    ids: string[],
    options?: { session?: ClientSession }
  ): Promise<IParty[]> {
    try {
      const objectIds = ids
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));

      if (objectIds.length === 0) {
        return [];
      }

      const query = Party.find({ _id: { $in: objectIds } })
        .lean()
        .maxTimeMS(3000);

      if (options?.session) {
        query.session(options.session);
      }

      return (await query) as unknown as IParty[];
    } catch (error) {
      throw new DatabaseError(`Failed to find parties by IDs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

