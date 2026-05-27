import { NextRequest } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { Lab } from '@/models';
import { Order, Quality } from '@/models';
import { seedFromOrderSchema } from '@/lib/validation/lab';
import { ok, badRequest, notFound, serverError } from '@/lib/http';
import { isValidObjectId } from '@/lib/ids';

// POST /api/labs/seed-from-order/[orderId] - Create labs for all items in an order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    await dbConnect();
    
    const { orderId } = await params;
    
    // Validate ObjectId
    if (!isValidObjectId(orderId)) {
      return badRequest('Invalid order ID');
    }
    
    const body = await request.json();
    
    // Validate request body
    const validationResult = seedFromOrderSchema.safeParse(body);
    if (!validationResult.success) {
      return badRequest(validationResult.error.issues[0].message);
    }
    
    const { labSendDate, prefix, startIndex, overrideExisting } = validationResult.data;
    
    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return notFound('Order not found');
    }
    
    if (!order.items || order.items.length === 0) {
      return badRequest('Order has no items');
    }
    
    let createdCount = 0;
    let skippedCount = 0;
    const createdLabs = [];
    
    // Process each order item
    for (let i = 0; i < order.items.length; i++) {
      const orderItem = order.items[i] as any;
      // Use the item's _id if available, otherwise generate one based on index
      const orderItemId = orderItem._id ? orderItem._id.toString() : `${orderId}-item-${i}`;
      
      // Check if lab already exists for this order item
      const existingLab = await Lab.findOne({
        order: orderId,
        orderItemId: orderItemId,
        softDeleted: false
      });
      
      if (existingLab && !overrideExisting) {
        skippedCount++;
        continue;
      }
      
      // Generate lab send number
      const counter = startIndex + i;
      const labSendNumber = `${prefix}${order.orderId}-${counter}`;
      
      // Create lab data
      const labData = {
        order: orderId,
        orderItemId: orderItemId,
        labSendDate,
        labSendNumber,
        status: 'sent' as const
      };
      
      if (existingLab && overrideExisting) {
        // Update existing lab
        Object.assign(existingLab, labData);
        await existingLab.save();
        createdLabs.push(existingLab);
      } else {
        // Create new lab
        const lab = new Lab(labData);
        await lab.save();
        createdLabs.push(lab);
      }
      
      createdCount++;
    }
    
    // Populate order details for response
    await Promise.all(createdLabs.map(async (lab) => {
      try {
        if (lab && typeof lab.populate === 'function') {
          await lab.populate({
            path: 'order',
            select: '_id orderId orderType items._id items.quality',
            populate: {
              path: 'items.quality',
              select: '_id name description'
            }
          });
        }
      } catch (populateError) {
        // Continue without populate - the lab was still created successfully
      }
    }));
    
    return ok({
      message: `Successfully processed ${order.items.length} order items`,
      createdCount,
      skippedCount,
      labs: createdLabs,
      order: {
        _id: order._id,
        orderId: order.orderId,
        orderType: order.orderType,
        itemsCount: order.items.length
      }
    });
    
  } catch (error) {
    return serverError(error);
  }
}
