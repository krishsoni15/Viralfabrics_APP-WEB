import { PartyRepository, CreatePartyData, PartyQuery } from '../repositories/PartyRepository';
import { NotFoundError, ValidationError, DatabaseError } from '@/lib/errors';
import { IParty } from '@/models/Party';
import { revalidateTag, revalidatePath } from 'next/cache';
import { CACHE_TAGS } from '@/lib/cacheConfig';
import { logCreate } from '@/lib/logger';

export class PartyService {
  /**
   * Get party by ID
   */
  static async getById(id: string): Promise<IParty | null> {
    return PartyRepository.findById(id);
  }

  /**
   * Get parties with filters and pagination
   */
  static async getMany(query: PartyQuery) {
    const { parties, total } = await PartyRepository.findMany(query);
    
    return {
      parties,
      total,
      page: query.page || 1,
      limit: query.limit || 100,
    };
  }

  /**
   * Get active parties
   */
  static async getActive(): Promise<IParty[]> {
    return PartyRepository.findActive();
  }

  /**
   * Create new party
   */
  static async create(data: CreatePartyData): Promise<IParty> {
    // Check if party name already exists
    const existing = await PartyRepository.findByName(data.name);
    if (existing) {
      throw new ValidationError('Party name already exists');
    }
    
    // Create party
    const party = await PartyRepository.create(data);
    
    // Log creation (non-blocking)
    logCreate('party', (party._id as any).toString(), party as unknown as Record<string, unknown>).catch(() => {});
    
    // Revalidate cache
    this.revalidatePartyCache();
    
    return party;
  }

  /**
   * Update party
   */
  static async update(id: string, updateData: Partial<CreatePartyData>): Promise<IParty | null> {
    // Check if party exists
    const existing = await PartyRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Party');
    }
    
    // If name is being updated, check for duplicates
    if (updateData.name && updateData.name !== existing.name) {
      const duplicate = await PartyRepository.findByName(updateData.name);
      if (duplicate) {
        throw new ValidationError('Party name already exists');
      }
    }
    
    // Update party
    const updated = await PartyRepository.updateById(id, updateData);
    
    if (!updated) {
      throw new NotFoundError('Party');
    }
    
    // Revalidate cache
    this.revalidatePartyCache();
    
    return updated;
  }

  /**
   * Delete party
   */
  static async delete(id: string): Promise<void> {
    const party = await PartyRepository.findById(id);
    if (!party) {
      throw new NotFoundError('Party');
    }
    
    // Check if party has orders (optional - can be done in repository)
    // For now, just delete
    
    await PartyRepository.deleteById(id);
    
    // Revalidate cache
    this.revalidatePartyCache();
  }

  /**
   * Revalidate Next.js cache
   */
  private static revalidatePartyCache(): void {
    try {
      revalidateTag(CACHE_TAGS.PARTIES);
      revalidatePath('/orders'); // Orders page uses parties
    } catch (error) {
      // Cache revalidation is non-critical
    }
  }
}

