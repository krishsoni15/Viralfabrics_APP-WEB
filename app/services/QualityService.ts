import { QualityRepository, CreateQualityData, QualityQuery } from '../repositories/QualityRepository';
import { NotFoundError, ValidationError, DatabaseError } from '@/lib/errors';
import { IQuality } from '@/models/Quality';
import { revalidateTag, revalidatePath } from 'next/cache';
import { CACHE_TAGS } from '@/lib/cacheConfig';
import { logCreate } from '@/lib/logger';

export class QualityService {
  /**
   * Get quality by ID
   */
  static async getById(id: string): Promise<IQuality | null> {
    return QualityRepository.findById(id);
  }

  /**
   * Get qualities with filters and pagination
   */
  static async getMany(query: QualityQuery) {
    const { qualities, total } = await QualityRepository.findMany(query);
    
    return {
      qualities,
      total,
      page: query.page || 1,
      limit: query.limit || 100,
    };
  }

  /**
   * Get active qualities
   */
  static async getActive(): Promise<IQuality[]> {
    return QualityRepository.findActive();
  }

  /**
   * Create new quality
   */
  static async create(data: CreateQualityData): Promise<IQuality> {
    // Check if quality name already exists
    const existing = await QualityRepository.findByName(data.name);
    if (existing) {
      throw new ValidationError('Quality name already exists');
    }
    
    // Create quality
    const quality = await QualityRepository.create(data);
    
    // Log creation (non-blocking)
    logCreate('quality', String(quality._id), quality as unknown as Record<string, unknown>).catch(() => {});
    
    // Revalidate cache
    this.revalidateQualityCache();
    
    return quality;
  }

  /**
   * Update quality
   */
  static async update(id: string, updateData: Partial<CreateQualityData>): Promise<IQuality | null> {
    // Check if quality exists
    const existing = await QualityRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Quality');
    }
    
    // If name is being updated, check for duplicates
    if (updateData.name && updateData.name !== existing.name) {
      const duplicate = await QualityRepository.findByName(updateData.name);
      if (duplicate) {
        throw new ValidationError('Quality name already exists');
      }
    }
    
    // Update quality
    const updated = await QualityRepository.updateById(id, updateData);
    
    if (!updated) {
      throw new NotFoundError('Quality');
    }
    
    // Revalidate cache
    this.revalidateQualityCache();
    
    return updated;
  }

  /**
   * Delete quality
   */
  static async delete(id: string): Promise<void> {
    const quality = await QualityRepository.findById(id);
    if (!quality) {
      throw new NotFoundError('Quality');
    }
    
    // Check if quality is used in orders (optional - can be done in repository)
    // For now, just delete
    
    await QualityRepository.deleteById(id);
    
    // Revalidate cache
    this.revalidateQualityCache();
  }

  /**
   * Revalidate Next.js cache
   */
  private static revalidateQualityCache(): void {
    try {
      revalidateTag(CACHE_TAGS.QUALITIES);
      revalidatePath('/orders'); // Orders page uses qualities
    } catch (error) {
      // Cache revalidation is non-critical
    }
  }
}

