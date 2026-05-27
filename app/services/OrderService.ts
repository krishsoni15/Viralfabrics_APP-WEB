import mongoose from 'mongoose';
import { OrderRepository, CreateOrderData, OrderQuery } from '../repositories/OrderRepository';
import { PartyRepository } from '../repositories/PartyRepository';
import { QualityRepository } from '../repositories/QualityRepository';
import { NotFoundError, ValidationError, DatabaseError } from '@/lib/errors';
import { withTransaction } from '@/app/utils/transactions';
import { IOrder } from '@/models/Order';
import { revalidateTag, revalidatePath } from 'next/cache';
import { CACHE_TAGS } from '@/lib/cacheConfig';
import { logOrderChange } from '@/lib/logger';

export class OrderService {
  /**
   * Get order by ID with populated relations
   */
  static async getById(id: string): Promise<IOrder | null> {
    const order = await OrderRepository.findById(id);
    
    if (!order) {
      return null;
    }
    
    // Populate relations manually (faster than populate)
    return this.populateOrderRelations(order);
  }

  /**
   * Get orders with filters and pagination
   */
  static async getMany(query: OrderQuery) {
    // Handle mill filter if provided (complex logic)
    if (query.millId) {
      const { MillInput } = await import('@/models/Mill');
      const millOrderIds = await MillInput.find({ mill: query.millId })
        .distinct('order')
        .maxTimeMS(2000)
        .lean();
      
      if (millOrderIds && millOrderIds.length > 0) {
        // Add mill filter to query - this will be handled by repository
        // For now, we'll filter after fetching
        const allResults = await OrderRepository.findMany(query);
        const filteredOrders = allResults.orders.filter(order => 
          millOrderIds.some(id => id.toString() === (order._id as any).toString())
        );
        return {
          orders: await Promise.all(
            filteredOrders.map(order => this.populateOrderRelations(order))
          ),
          total: filteredOrders.length,
          page: query.page || 1,
          limit: query.limit || 25,
        };
      } else {
        // No orders for this mill
        return {
          orders: [],
          total: 0,
          page: query.page || 1,
          limit: query.limit || 25,
        };
      }
    }
    
    // Normal query without mill filter
    const { orders, total } = await OrderRepository.findMany(query);
    
    // Populate relations for all orders
    const populatedOrders = await Promise.all(
      orders.map(order => this.populateOrderRelations(order))
    );
    
    return {
      orders: populatedOrders,
      total,
      page: query.page || 1,
      limit: query.limit || 25,
    };
  }

  /**
   * Create new order with validation
   */
  static async create(data: CreateOrderData): Promise<IOrder> {
    // Validate foreign key references
    await this.validateOrderReferences(data);
    
    // Create order in transaction
    const order = await withTransaction(async (session) => {
      return OrderRepository.create(data, { session });
    });
    
    // Log order creation (non-blocking)
    logOrderChange('create', (order._id as any).toString(), {}, order as unknown as Record<string, unknown>).catch(() => {});
    
    // Revalidate cache
    this.revalidateOrderCache((order._id as any).toString());
    
    return this.populateOrderRelations(order);
  }

  /**
   * Update order with validation
   */
  static async update(id: string, updateData: Partial<CreateOrderData>): Promise<IOrder | null> {
    // Check if order exists
    const existingOrder = await OrderRepository.findById(id);
    if (!existingOrder) {
      throw new NotFoundError('Order');
    }
    
    // Validate foreign key references if updated
    if (updateData.party || updateData.items) {
      await this.validateOrderReferences(updateData as CreateOrderData, existingOrder);
    }
    
    // Update order
    const updatedOrder = await OrderRepository.updateById(id, updateData);
    
    if (!updatedOrder) {
      throw new NotFoundError('Order');
    }
    
    // Log order update (non-blocking)
    logOrderChange('update', id, existingOrder as unknown as Record<string, unknown>, updateData).catch(() => {});
    
    // Revalidate cache
    this.revalidateOrderCache(id);
    
    return this.populateOrderRelations(updatedOrder);
  }

  /**
   * Delete order (soft delete)
   */
  static async delete(id: string): Promise<void> {
    const order = await OrderRepository.findById(id);
    if (!order) {
      throw new NotFoundError('Order');
    }
    
    // Soft delete
    await OrderRepository.deleteById(id);
    
    // Log deletion (non-blocking)
    logOrderChange('delete', id, order as unknown as Record<string, unknown>, { softDeleted: true }).catch(() => {});
    
    // Revalidate cache
    this.revalidateOrderCache(id);
  }

  /**
   * Validate foreign key references
   */
  private static async validateOrderReferences(
    data: Partial<CreateOrderData>,
    existingOrder?: IOrder
  ): Promise<void> {
    // Validate party exists
    if (data.party) {
      const partyId = typeof data.party === 'string' 
        ? data.party 
        : data.party.toString();
      
      const partyExists = await PartyRepository.exists(partyId);
      if (!partyExists) {
        throw new ValidationError(`Party with ID ${partyId} does not exist`);
      }
    }
    
    // Validate quality references in items
    if (data.items && data.items.length > 0) {
      const qualityIds = data.items
        .map(item => item.quality)
        .filter(Boolean)
        .map(q => typeof q === 'string' ? q : q?.toString() || '')
        .filter(id => mongoose.Types.ObjectId.isValid(id));
      
      if (qualityIds.length > 0) {
        const qualities = await QualityRepository.findByIds(qualityIds as string[]);
        const foundIds = new Set(qualities.map(q => (q._id as any).toString()));
        const missingIds = qualityIds.filter(id => !foundIds.has(id));
        
        if (missingIds.length > 0) {
          throw new ValidationError(
            `Qualities with IDs ${missingIds.join(', ')} do not exist`
          );
        }
      }
    }
  }

  /**
   * Populate order relations manually (faster than populate)
   */
  private static async populateOrderRelations(order: any): Promise<IOrder> {
    const partyId = order.party;
    const qualityIds: string[] = [
      ...new Set(
        (order.items || [])
          .map((item: any) => item.quality)
          .filter(Boolean)
          .map((q: any) => typeof q === 'string' ? q : q?.toString())
      )
    ] as string[];
    
    // Fetch related data in parallel
    const [parties, qualities] = await Promise.all([
      partyId ? PartyRepository.findByIds([partyId]) : Promise.resolve([]),
      qualityIds.length > 0 ? QualityRepository.findByIds(qualityIds as string[]) : Promise.resolve([])
    ]);
    
    // Create maps for O(1) lookup
    const partyMap = new Map(parties.map(p => [(p._id as any).toString(), p]));
    const qualityMap = new Map(qualities.map(q => [(q._id as any).toString(), q]));
    
    // Attach relations
    return {
      ...order,
      party: partyId ? partyMap.get(partyId.toString()) || null : null,
      items: (order.items || []).map((item: any) => ({
        ...item,
        quality: item.quality 
          ? qualityMap.get(typeof item.quality === 'string' ? item.quality : item.quality.toString()) || null
          : null
      }))
    } as IOrder;
  }

  /**
   * Revalidate Next.js cache
   */
  private static revalidateOrderCache(orderId: string): void {
    try {
      revalidateTag(CACHE_TAGS.ORDERS);
      revalidateTag(CACHE_TAGS.DASHBOARD);
      revalidateTag(CACHE_TAGS.STATS);
      revalidateTag(CACHE_TAGS.ORDER(orderId));
      revalidatePath('/orders');
      revalidatePath('/dashboard');
    } catch (error) {
      // Cache revalidation is non-critical
    }
  }

  /**
   * Get order statistics
   */
  static async getStats() {
    return OrderRepository.getStats();
  }

  /**
   * Batch update orders
   */
  static async updateMany(
    filter: any,
    updateData: Partial<CreateOrderData>
  ): Promise<{ modifiedCount: number }> {
    return OrderRepository.updateMany(filter, updateData);
  }
}

