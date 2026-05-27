'use server';

/**
 * Server Actions for Order Operations with Automatic Cache Revalidation
 * 
 * This file contains all server-side actions for orders with built-in cache management.
 * Each write operation automatically invalidates related cache tags.
 * 
 * Usage:
 *   import { createOrder, updateOrder, deleteOrder } from '@/app/actions/orderActions';
 *   
 *   // In your component:
 *   const result = await createOrder(formData);
 */

import { revalidateTag, revalidatePath } from 'next/cache';
import dbConnect from '@/lib/dbConnect';
import Order, { IOrder } from '@/models/Order';
import { logOrderChange } from '@/lib/logger';
import { getSession } from '@/lib/session';
import { cookies } from 'next/headers';
import { CACHE_TAGS } from '@/lib/cacheConfig';

// ============================================================================
// TYPES
// ============================================================================

export type OrderActionResult = {
  success: boolean;
  data?: any;
  message?: string;
  errors?: string[];
};

// ============================================================================
// CREATE ORDER
// ============================================================================

export async function createOrder(orderData: any): Promise<OrderActionResult> {
  try {
    // Validate session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return {
        success: false,
        message: 'Unauthorized - Please login',
      };
    }

    await dbConnect();

    // Validation
    const errors: string[] = [];
    
    if (orderData.orderType && !['Dying', 'Printing'].includes(orderData.orderType)) {
      errors.push("Order type must be either 'Dying' or 'Printing'");
    }

    if (errors.length > 0) {
      return {
        success: false,
        message: 'Validation failed',
        errors,
      };
    }

    // Create order
    const order = await Order.createOrder(orderData);

    // ⚡ OPTIMIZED: Fetch related data separately (faster than populate)
    const fetchedOrder = await Order.findById(order._id)
      .select('_id orderId orderType arrivalDate party contactName contactPhone poNumber styleNo poDate deliveryDate items status createdAt updatedAt')
      .lean()
      .maxTimeMS(2000);

    if (!fetchedOrder) {
      return {
        success: false,
        message: 'Failed to retrieve created order',
      };
    }

    // ⚡ Fetch parties and qualities separately (MUCH faster than populate)
    const partyId = (fetchedOrder as any).party;
    const qualityIds = [...new Set(
      ((fetchedOrder as any).items || []).map((item: any) => item.quality).filter(Boolean)
    )];

    const [Party, Quality] = await Promise.all([
      import('@/models/Party'),
      import('@/models/Quality')
    ]);

    const [parties, qualities] = await Promise.all([
      partyId ? Party.default.find({ _id: partyId })
        .select('_id name contactName contactPhone')
        .lean()
        .maxTimeMS(1000) : Promise.resolve([]),
      qualityIds.length > 0 ? Quality.default.find({ _id: { $in: qualityIds } })
        .select('_id name')
        .lean()
        .maxTimeMS(1000) : Promise.resolve([])
    ]);

    const partyMap = new Map(parties.map((p: any) => [p._id.toString(), p]));
    const qualityMap = new Map(qualities.map((q: any) => [q._id.toString(), q]));

    // Attach parties and qualities to order
    const populatedOrder = {
      ...fetchedOrder,
      party: partyId ? partyMap.get(partyId.toString()) || null : null,
      items: ((fetchedOrder as any).items || []).map((item: any) => ({
        ...item,
        quality: item.quality ? qualityMap.get(item.quality.toString()) || null : null
      }))
    };

    // Log the order creation (async, non-blocking)
    const orderId = typeof order._id === 'string' ? order._id : order._id?.toString?.() ?? '';
    logOrderChange('create', orderId, {}, populatedOrder).catch(() => {});

    // ⚡ CACHE REVALIDATION - Revalidate all order-related caches
    revalidateTag(CACHE_TAGS.ORDERS); // Revalidate all order lists
    revalidateTag(CACHE_TAGS.DASHBOARD); // Revalidate dashboard stats
    revalidateTag(CACHE_TAGS.STATS); // Revalidate stats

    revalidateTag(CACHE_TAGS.ORDER(orderId)); // Revalidate specific order
    revalidatePath('/orders'); // Revalidate orders page
    revalidatePath('/dashboard'); // Revalidate dashboard page

    return {
      success: true,
      data: populatedOrder,
      message: 'Order created successfully',
    };
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Create order error:', error);
    }
    return {
      success: false,
      message: error.message || 'Failed to create order',
    };
  }
}

// ============================================================================
// UPDATE ORDER
// ============================================================================

export async function updateOrder(
  orderId: string,
  updateData: Partial<IOrder>
): Promise<OrderActionResult> {
  try {
    // Validate session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return {
        success: false,
        message: 'Unauthorized - Please login',
      };
    }

    await dbConnect();

    // Get old order for logging
    const oldOrder = await Order.findById(orderId).lean();
    if (!oldOrder) {
      return {
        success: false,
        message: 'Order not found',
      };
    }

    // Update order
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      updateData,
      { new: true, runValidators: true }
    )
      .select('_id orderId orderType arrivalDate party contactName contactPhone poNumber styleNo poDate deliveryDate items status createdAt updatedAt')
      .lean()
      .maxTimeMS(2000);

    if (!updatedOrder) {
      return {
        success: false,
        message: 'Order not found',
      };
    }

    // ⚡ OPTIMIZED: Fetch related data separately (faster than populate)
    const partyId = (updatedOrder as any).party;
    const qualityIds = [...new Set(
      ((updatedOrder as any).items || []).map((item: any) => item.quality).filter(Boolean)
    )];

    const [Party, Quality] = await Promise.all([
      import('@/models/Party'),
      import('@/models/Quality')
    ]);

    const [parties, qualities] = await Promise.all([
      partyId ? Party.default.find({ _id: partyId })
        .select('_id name contactName contactPhone')
        .lean()
        .maxTimeMS(1000) : Promise.resolve([]),
      qualityIds.length > 0 ? Quality.default.find({ _id: { $in: qualityIds } })
        .select('_id name')
        .lean()
        .maxTimeMS(1000) : Promise.resolve([])
    ]);

    const partyMap = new Map(parties.map((p: any) => [p._id.toString(), p]));
    const qualityMap = new Map(qualities.map((q: any) => [q._id.toString(), q]));

    // Attach parties and qualities to order
    const populatedOrder = {
      ...updatedOrder,
      party: partyId ? partyMap.get(partyId.toString()) || null : null,
      items: ((updatedOrder as any).items || []).map((item: any) => ({
        ...item,
        quality: item.quality ? qualityMap.get(item.quality.toString()) || null : null
      }))
    };

    if (!updatedOrder) {
      return {
        success: false,
        message: 'Order not found',
      };
    }

    // Log the order update (async, non-blocking)
    logOrderChange('update', orderId, oldOrder, updateData).catch(() => {});

    // ⚡ CACHE REVALIDATION
    revalidateTag(CACHE_TAGS.ORDERS);
    revalidateTag(CACHE_TAGS.DASHBOARD);
    revalidateTag(CACHE_TAGS.STATS);
    revalidateTag(CACHE_TAGS.ORDER(orderId));
    revalidatePath('/orders');
    revalidatePath(`/orders/${orderId}`);
    revalidatePath('/dashboard');

    return {
      success: true,
      data: populatedOrder,
      message: 'Order updated successfully',
    };
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Update order error:', error);
    }
    return {
      success: false,
      message: error.message || 'Failed to update order',
    };
  }
}

// ============================================================================
// DELETE ORDER (Soft Delete)
// ============================================================================

export async function deleteOrder(orderId: string): Promise<OrderActionResult> {
  try {
    // Validate session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return {
        success: false,
        message: 'Unauthorized - Please login',
      };
    }

    await dbConnect();

    // Soft delete - mark as deleted
    const order = await Order.findByIdAndUpdate(
      orderId,
      { softDeleted: true },
      { new: true }
    ).lean();

    if (!order) {
      return {
        success: false,
        message: 'Order not found',
      };
    }

    // Log the deletion (async, non-blocking)
    logOrderChange('delete', orderId, order, { softDeleted: true }).catch(() => {});

    // ⚡ CACHE REVALIDATION
    revalidateTag(CACHE_TAGS.ORDERS);
    revalidateTag(CACHE_TAGS.DASHBOARD);
    revalidateTag(CACHE_TAGS.STATS);
    revalidateTag(CACHE_TAGS.ORDER(orderId));
    revalidatePath('/orders');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: 'Order deleted successfully',
    };
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Delete order error:', error);
    }
    return {
      success: false,
      message: error.message || 'Failed to delete order',
    };
  }
}

// ============================================================================
// UPDATE ORDER STATUS
// ============================================================================

export async function updateOrderStatus(
  orderId: string,
  status: string
): Promise<OrderActionResult> {
  try {
    // Validate session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return {
        success: false,
        message: 'Unauthorized - Please login',
      };
    }

    await dbConnect();

    const validStatuses = ['Not set', 'Not selected', 'pending', 'in_progress', 'completed', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return {
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      };
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true, runValidators: true }
    )
      .select('_id orderId orderType arrivalDate party contactName contactPhone poNumber styleNo poDate deliveryDate items status createdAt updatedAt')
      .lean()
      .maxTimeMS(2000);

    if (!order) {
      return {
        success: false,
        message: 'Order not found',
      };
    }

    // ⚡ OPTIMIZED: Fetch related data separately (faster than populate)
    const partyId = (order as any).party;
    const qualityIds = [...new Set(
      ((order as any).items || []).map((item: any) => item.quality).filter(Boolean)
    )];

    const [Party, Quality] = await Promise.all([
      import('@/models/Party'),
      import('@/models/Quality')
    ]);

    const [parties, qualities] = await Promise.all([
      partyId ? Party.default.find({ _id: partyId })
        .select('_id name contactName contactPhone')
        .lean()
        .maxTimeMS(1000) : Promise.resolve([]),
      qualityIds.length > 0 ? Quality.default.find({ _id: { $in: qualityIds } })
        .select('_id name')
        .lean()
        .maxTimeMS(1000) : Promise.resolve([])
    ]);

    const partyMap = new Map(parties.map((p: any) => [p._id.toString(), p]));
    const qualityMap = new Map(qualities.map((q: any) => [q._id.toString(), q]));

    // Attach parties and qualities to order
    const populatedOrder = {
      ...order,
      party: partyId ? partyMap.get(partyId.toString()) || null : null,
      items: ((order as any).items || []).map((item: any) => ({
        ...item,
        quality: item.quality ? qualityMap.get(item.quality.toString()) || null : null
      }))
    };

    if (!order) {
      return {
        success: false,
        message: 'Order not found',
      };
    }

    // Log the status change (async, non-blocking)
    logOrderChange('update', orderId, {}, { status }).catch(() => {});

    // ⚡ CACHE REVALIDATION
    revalidateTag(CACHE_TAGS.ORDERS);
    revalidateTag(CACHE_TAGS.DASHBOARD);
    revalidateTag(CACHE_TAGS.STATS);
    revalidateTag(CACHE_TAGS.ORDER(orderId));
    revalidatePath('/orders');
    revalidatePath('/dashboard');

    return {
      success: true,
      data: populatedOrder,
      message: 'Order status updated successfully',
    };
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Update order status error:', error);
    }
    return {
      success: false,
      message: error.message || 'Failed to update order status',
    };
  }
}

// ============================================================================
// BULK UPDATE ORDERS
// ============================================================================

export async function bulkUpdateOrders(
  orderIds: string[],
  updateData: Partial<IOrder>
): Promise<OrderActionResult> {
  try {
    // Validate session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return {
        success: false,
        message: 'Unauthorized - Please login',
      };
    }

    await dbConnect();

    const result = await Order.updateMany(
      { _id: { $in: orderIds } },
      updateData
    );

    // Log bulk update (async, non-blocking)
    Promise.all(
      orderIds.map(id => logOrderChange('update', id, {}, updateData))
    ).catch(() => {});

    // ⚡ CACHE REVALIDATION
    revalidateTag(CACHE_TAGS.ORDERS);
    revalidateTag(CACHE_TAGS.DASHBOARD);
    revalidateTag(CACHE_TAGS.STATS);
    orderIds.forEach(id => revalidateTag(CACHE_TAGS.ORDER(id)));
    revalidatePath('/orders');
    revalidatePath('/dashboard');

    return {
      success: true,
      data: result,
      message: `${result.modifiedCount} orders updated successfully`,
    };
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Bulk update orders error:', error);
    }
    return {
      success: false,
      message: error.message || 'Failed to update orders',
    };
  }
}

