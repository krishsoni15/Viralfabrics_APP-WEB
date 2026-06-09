import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/Order';
import Counter from '@/models/Counter';
import { Lab, GreyInfo, MillInput, MillOutput, Dispatch } from '@/models';
import { getSession } from '@/lib/session';
import mongoose from 'mongoose';
import { clearOrdersCache } from '../route';

export async function POST(request: NextRequest) {
  try {
    // Validate session
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized'
      }, { status: 401 });
    }

    await dbConnect();

    // Get all orders sorted by creation date (oldest first)
    const orders = await Order.find({})
      .sort({ createdAt: 1 })
      .select('_id orderId')
      .lean() as any;

    if (orders.length === 0) {
      // No orders to renumber, just reset counter
      await Counter.findByIdAndUpdate('orderId', { sequence: 0 }, { upsert: true });
      return NextResponse.json({
        success: true,
        message: 'No orders to renumber. Counter reset to 0.',
        renumberedCount: 0
      }, { status: 200 });
    }

    // Create mapping of old orderId to new orderId and MongoDB _id
    const orderIdMapping: { [oldId: string]: { newId: string; mongoId: string } } = {};
    
    for (let i = 0; i < orders.length; i++) {
      const newOrderId = (i + 1).toString().padStart(3, '0');
      const oldOrderId = orders[i].orderId;
      const mongoId = orders[i]._id.toString();
      
      if (oldOrderId !== newOrderId) {
        orderIdMapping[oldOrderId] = { newId: newOrderId, mongoId };
      }
    }

    // Renumber orders sequentially
    let renumberedCount = 0;
    const orderUpdates: Promise<any>[] = [];

    for (let i = 0; i < orders.length; i++) {
      const newOrderId = (i + 1).toString().padStart(3, '0');
      const oldOrderId = orders[i].orderId;

      // Only update if the orderId has changed
      if (oldOrderId !== newOrderId) {
        // First, temporarily rename to avoid unique constraint conflicts
        const tempOrderId = `TEMP_${orders[i]._id}_${Date.now()}`;
        
        orderUpdates.push(
          Order.findByIdAndUpdate(
            orders[i]._id,
            { orderId: tempOrderId },
            { new: true }
          ).then(() => {
            // Then update to the final orderId
            return Order.findByIdAndUpdate(
              orders[i]._id,
              { orderId: newOrderId },
              { new: true }
            );
          })
        );
        renumberedCount++;
      }
    }

    // Execute all order updates sequentially to avoid conflicts
    await Promise.all(orderUpdates);

    // Update all related data with new orderIds
    const relatedUpdates: Promise<any>[] = [];
    const updateResults = {
      greyInfo: 0,
      millInputs: 0,
      millOutputs: 0,
      dispatches: 0,
      labs: 0
    };

    // Update all related data using MongoDB _id to ensure data follows the order
    // This ensures that when order 005 becomes 004, all data for order 005 moves to order 004
    
    // Update GreyInfo - use order ObjectId to find records (more reliable)
    for (const [oldOrderId, { newId: newOrderId, mongoId }] of Object.entries(orderIdMapping)) {
      const orderObjectId = new mongoose.Types.ObjectId(mongoId);
      relatedUpdates.push(
        GreyInfo.updateMany(
          { order: orderObjectId }, // Find by order ObjectId (the actual order, not just orderId string)
          { $set: { orderId: newOrderId } } // Update orderId string to match new ID
        ).then(result => {
          updateResults.greyInfo += result.modifiedCount || 0;
        })
      );
    }

    // Update MillInput - use order ObjectId to find records
    for (const [oldOrderId, { newId: newOrderId, mongoId }] of Object.entries(orderIdMapping)) {
      const orderObjectId = new mongoose.Types.ObjectId(mongoId);
      relatedUpdates.push(
        MillInput.updateMany(
          { order: orderObjectId }, // Find by order ObjectId
          { $set: { orderId: newOrderId } } // Update orderId string
        ).then(result => {
          updateResults.millInputs += result.modifiedCount || 0;
        })
      );
    }

    // Update MillOutput - use order ObjectId to find records
    for (const [oldOrderId, { newId: newOrderId, mongoId }] of Object.entries(orderIdMapping)) {
      const orderObjectId = new mongoose.Types.ObjectId(mongoId);
      relatedUpdates.push(
        MillOutput.updateMany(
          { order: orderObjectId }, // Find by order ObjectId
          { $set: { orderId: newOrderId } } // Update orderId string
        ).then(result => {
          updateResults.millOutputs += result.modifiedCount || 0;
        })
      );
    }

    // Update Dispatch - use order ObjectId to find records
    for (const [oldOrderId, { newId: newOrderId, mongoId }] of Object.entries(orderIdMapping)) {
      const orderObjectId = new mongoose.Types.ObjectId(mongoId);
      relatedUpdates.push(
        Dispatch.updateMany(
          { order: orderObjectId }, // Find by order ObjectId
          { $set: { orderId: newOrderId } } // Update orderId string
        ).then(result => {
          updateResults.dispatches += result.modifiedCount || 0;
        })
      );
    }

    // Update Lab - Lab uses order ObjectId reference, update labSendNumber if it contains orderId
    for (const [oldOrderId, { newId: newOrderId, mongoId }] of Object.entries(orderIdMapping)) {
      const orderObjectId = new mongoose.Types.ObjectId(mongoId);
      // Find labs by order ObjectId and update labSendNumber if it contains the old orderId
      relatedUpdates.push(
        Lab.find({ 
          order: orderObjectId, // Find by order ObjectId
          labSendNumber: { $regex: oldOrderId } // Only update if labSendNumber contains old orderId
        }).then(labs => {
          const labUpdates = labs.map(lab => {
            if (lab.labSendNumber && lab.labSendNumber.includes(oldOrderId)) {
              lab.labSendNumber = lab.labSendNumber.replace(new RegExp(oldOrderId, 'g'), newOrderId);
              return lab.save();
            }
            return Promise.resolve();
          });
          return Promise.all(labUpdates).then(() => {
            updateResults.labs += labs.length;
          });
        }).catch(error => {
          console.error('Error updating lab send numbers:', error);
          // Continue even if lab update fails
        })
      );
    }

    // Execute all related data updates
    await Promise.all(relatedUpdates);

    // Update counter to the last sequential number
    const lastSequence = orders.length;
    await Counter.findByIdAndUpdate('orderId', { sequence: lastSequence }, { upsert: true });

    // Clear orders cache to ensure fresh data is fetched immediately
    clearOrdersCache();

    return NextResponse.json({
      success: true,
      message: `Successfully renumbered ${renumberedCount} orders and updated all related data. Next new order will be ${(lastSequence + 1).toString().padStart(3, '0')}`,
      renumberedCount,
      totalOrders: orders.length,
      nextOrderId: (lastSequence + 1).toString().padStart(3, '0'),
      relatedDataUpdated: {
        greyInfo: updateResults.greyInfo,
        millInputs: updateResults.millInputs,
        millOutputs: updateResults.millOutputs,
        dispatches: updateResults.dispatches,
        labs: updateResults.labs
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error renumbering order IDs:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to renumber order IDs',
      details: error.message
    }, { status: 500 });
  }
}

