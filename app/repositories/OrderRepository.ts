import mongoose, { ClientSession } from 'mongoose';
import Order, { IOrder, IOrderModel } from '@/models/Order';
import { NotFoundError, DatabaseError } from '@/lib/errors';

export interface OrderQuery {
  search?: string;
  orderType?: 'Dying' | 'Printing';
  status?: string;
  party?: string;
  startDate?: Date;
  endDate?: Date;
  millId?: string;
  softDeleted?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateOrderData {
  orderType?: 'Dying' | 'Printing';
  arrivalDate?: Date;
  party?: mongoose.Types.ObjectId;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  poNumber?: string;
  styleNo?: string;
  poDate?: Date;
  deliveryDate?: Date;
  items: Array<{
    quality?: mongoose.Types.ObjectId;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    imageUrls?: string[];
    description?: string;
    weaverSupplierName?: string;
    purchaseRate?: number;
    millRate?: number;
    salesRate?: number;
    specifications?: Record<string, any>;
    status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    priority?: number;
    notes?: string;
  }>;
  status?: string;
  priority?: number;
  totalAmount?: number;
  taxAmount?: number;
  discountAmount?: number;
  finalAmount?: number;
  paymentStatus?: 'pending' | 'partial' | 'paid';
  paymentMethod?: string;
  shippingAddress?: string;
  billingAddress?: string;
  notes?: string;
  metadata?: {
    createdBy?: string;
    tags?: string[];
    source?: string;
    urgency?: 'low' | 'medium' | 'high' | 'urgent';
    complexity?: 'simple' | 'moderate' | 'complex';
  };
}

export class OrderRepository {
  /**
   * Find order by ID
   */
  static async findById(
    id: string,
    options?: { session?: ClientSession; lean?: boolean }
  ): Promise<IOrder | null> {
    try {
      const query = Order.findById(id);
      
      if (options?.session) {
        query.session(options.session);
      }
      
      if (options?.lean !== false) {
        query.lean();
      }
      
      return query.maxTimeMS(5000);
    } catch (error) {
      throw new DatabaseError(`Failed to find order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find order by orderId (string)
   */
  static async findByOrderId(
    orderId: string,
    options?: { session?: ClientSession; lean?: boolean }
  ): Promise<IOrder | null> {
    try {
      const query = Order.findOne({ orderId });
      
      if (options?.session) {
        query.session(options.session);
      }
      
      if (options?.lean !== false) {
        query.lean();
      }
      
      return query.maxTimeMS(5000);
    } catch (error) {
      throw new DatabaseError(`Failed to find order by orderId: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find multiple orders with filters
   */
  static async findMany(
    query: OrderQuery,
    options?: { session?: ClientSession }
  ): Promise<{ orders: IOrder[]; total: number }> {
    try {
      const mongoQuery: any = {
        $and: [
          {
            $or: [
              { softDeleted: false },
              { softDeleted: { $exists: false } }
            ]
          }
        ]
      };

      // Add filters
      if (query.orderType) {
        mongoQuery.$and.push({ orderType: query.orderType });
      }

      if (query.status) {
        mongoQuery.$and.push({ status: query.status });
      }

      if (query.party) {
        mongoQuery.$and.push({ party: new mongoose.Types.ObjectId(query.party) });
      }

      if (query.startDate || query.endDate) {
        const dateQuery: any = {};
        if (query.startDate) dateQuery.$gte = query.startDate;
        if (query.endDate) dateQuery.$lte = query.endDate;
        mongoQuery.$and.push({ arrivalDate: dateQuery });
      }

      // Mill filter - handled in service layer for complex logic
      // This is a placeholder - actual mill filtering happens in service

      // Text search
      if (query.search) {
        const searchPattern = query.search.trim();
        const searchConditions: any[] = [
          { orderId: { $regex: searchPattern, $options: 'i' } },
          { poNumber: { $regex: searchPattern, $options: 'i' } },
          { styleNo: { $regex: searchPattern, $options: 'i' } },
          { contactName: { $regex: searchPattern, $options: 'i' } },
          { contactPhone: { $regex: searchPattern, $options: 'i' } }
        ];
        mongoQuery.$and.push({ $or: searchConditions });
      }

      // Build sort
      const sortBy = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
      const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder };

      // Count total
      const total = await Order.countDocuments(mongoQuery).maxTimeMS(5000);

      // Pagination
      const page = query.page || 1;
      const limit = Math.min(query.limit || 25, 100);
      const skip = (page - 1) * limit;

      // Find orders
      const findQuery = Order.find(mongoQuery)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean()
        .maxTimeMS(5000);

      if (options?.session) {
        findQuery.session(options.session);
      }

      const orders = (await findQuery) as unknown as IOrder[];

      return { orders, total };
    } catch (error) {
      throw new DatabaseError(`Failed to find orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create new order
   */
  static async create(
    data: CreateOrderData,
    options?: { session?: ClientSession }
  ): Promise<IOrder> {
    try {
      const order = await Order.createOrder(data);
      return order;
    } catch (error) {
      throw new DatabaseError(`Failed to create order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update order by ID
   */
  static async updateById(
    id: string,
    updateData: Partial<CreateOrderData>,
    options?: { session?: ClientSession }
  ): Promise<IOrder | null> {
    try {
      const query = Order.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).lean();

      if (options?.session) {
        query.session(options.session);
      }

      const result = await query.maxTimeMS(5000);
      return result as unknown as IOrder | null;
    } catch (error) {
      throw new DatabaseError(`Failed to update order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete order (soft delete)
   */
  static async deleteById(
    id: string,
    options?: { session?: ClientSession }
  ): Promise<IOrder | null> {
    try {
      const query = Order.findByIdAndUpdate(
        id,
        { softDeleted: true },
        { new: true }
      ).lean();

      if (options?.session) {
        query.session(options.session);
      }

      const result = await query.maxTimeMS(5000);
      return result as unknown as IOrder | null;
    } catch (error) {
      throw new DatabaseError(`Failed to delete order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find orders by party
   */
  static async findByParty(
    partyId: string,
    options?: { session?: ClientSession }
  ): Promise<IOrder[]> {
    try {
      const query = Order.find({ party: partyId })
        .sort({ createdAt: -1 })
        .lean();
      
      if (options?.session) {
        query.session(options.session);
      }
      
      const result = await query.maxTimeMS(5000);
      return result as unknown as IOrder[];
    } catch (error) {
      throw new DatabaseError(`Failed to find orders by party: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get order statistics
   */
  static async getStats(
    options?: { session?: ClientSession }
  ): Promise<any> {
    try {
      return Order.getOrderStats();
    } catch (error) {
      throw new DatabaseError(`Failed to get order stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch update orders
   */
  static async updateMany(
    filter: any,
    updateData: Partial<CreateOrderData>,
    options?: { session?: ClientSession }
  ): Promise<{ modifiedCount: number }> {
    try {
      const updateQuery = Order.updateMany(filter, updateData);
      
      if (options?.session) {
        updateQuery.session(options.session);
      }
      
      const result = await updateQuery.maxTimeMS(10000);
      return { modifiedCount: result.modifiedCount };
    } catch (error) {
      throw new DatabaseError(`Failed to update orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

