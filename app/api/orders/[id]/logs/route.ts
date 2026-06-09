import { NextRequest } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Log from '@/models/Log';
import Order from '@/models/Order';
import mongoose from 'mongoose';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  try {
    await dbConnect();
    
    const { id } = await params;
    
    // Quick validation of order ID format
    if (!id || typeof id !== 'string' || id.length < 10) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: [] 
        }), 
        { 
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'X-Response-Time': `${Date.now() - startTime}ms`
          }
        }
      );
    }
    
    // First, find the order to get both orderId (string) and _id (ObjectId)
    // Try to find by _id first, then by orderId if _id doesn't work
    let order = await Order.findById(id).lean() as any;
    if (!order) {
      // Try finding by orderId string if _id lookup failed
      order = await Order.findOne({ orderId: id }).lean() as any;
    }
    const orderIdString = order?.orderId || null;
    const orderObjectId = order?._id?.toString() || id;
    
    // Show ALL order-related operations including mill input, mill output, dispatch, lab, and grey info
    const importantOrderActions = [
      'order_create', 'order_update', 'order_delete', 'order_status_change',
      'lab_create', 'lab_update', 'lab_delete', 'lab_status_change',
      'mill_input_create', 'mill_input_update', 'mill_input_delete',
      'mill_output_create', 'mill_output_update', 'mill_output_delete',
      'dispatch_create', 'dispatch_update', 'dispatch_delete',
      'grey_info_create', 'grey_info_update', 'grey_info_delete'
    ];
    
    // Build comprehensive query to find all logs related to this order
    // Check by both order _id (ObjectId) and orderId (string) in multiple places
    const queryConditions: any[] = [
      // Direct order logs by ObjectId
      { resource: 'order', resourceId: orderObjectId, action: { $in: importantOrderActions } },
      // Direct order logs by orderId string
      ...(orderIdString ? [{ resource: 'order', resourceId: orderIdString, action: { $in: importantOrderActions } }] : []),
      // Also check by original id parameter (in case it's different format)
      { resource: 'order', resourceId: id, action: { $in: importantOrderActions } }
    ];
    
    // Check all other resources by orderId in details (both string and ObjectId formats)
    const resourcesToCheck = ['mill_input', 'mill_output', 'dispatch', 'lab', 'grey_info'];
    resourcesToCheck.forEach(resource => {
      // Build array of orderId values to check (string, ObjectId, and original id)
      const orderIdValues: any[] = [];
      if (orderIdString) orderIdValues.push(orderIdString);
      if (orderObjectId) orderIdValues.push(orderObjectId);
      if (id && id !== orderIdString && id !== orderObjectId) orderIdValues.push(id);
      
      // Also try to convert orderObjectId to ObjectId if it's a valid ObjectId string
      try {
        if (orderObjectId && mongoose.Types.ObjectId.isValid(orderObjectId)) {
          const objectId = new mongoose.Types.ObjectId(orderObjectId);
          orderIdValues.push(objectId);
          // Also add as string representation
          orderIdValues.push(objectId.toString());
        }
      } catch (e) {
        // Ignore conversion errors
      }
      
      // Remove duplicates
      const uniqueOrderIdValues = [...new Set(orderIdValues.map(v => String(v)))];
      
      // Check by orderId in details.orderId (for create operations) - check each value individually
      uniqueOrderIdValues.forEach(orderIdVal => {
        queryConditions.push({
          resource,
          'details.orderId': orderIdVal,
          action: { $in: importantOrderActions }
        });
      });
      
      // Also check by orderObjectId in details.orderObjectId (for create operations with ObjectId)
      uniqueOrderIdValues.forEach(orderIdVal => {
        queryConditions.push({
          resource,
          'details.orderObjectId': orderIdVal,
          action: { $in: importantOrderActions }
        });
      });
      
      // Also check in oldValues and newValues for orderId (for update operations)
      uniqueOrderIdValues.forEach(orderIdVal => {
        queryConditions.push({
          resource,
          $or: [
            { 'details.oldValues.orderId': orderIdVal },
            { 'details.newValues.orderId': orderIdVal },
            { 'details.oldValues.orderObjectId': orderIdVal },
            { 'details.newValues.orderObjectId': orderIdVal }
          ],
          action: { $in: importantOrderActions }
        });
      });
    });
    
    // Execute the main query
    let logs = await Log.find({
      $or: queryConditions
    })
    .select('_id action username userRole timestamp success severity details resource resourceId')
    .sort({ timestamp: -1 })
    .lean()
    .maxTimeMS(5000); // Increased timeout for more data
    
    // If no logs found and we have orderIdString, try a more flexible search
    // This catches logs where orderId might be stored in a different format
    if (logs.length === 0 && orderIdString) {
      const fallbackLogs = await Log.find({
        resource: { $in: resourcesToCheck },
        action: { $in: importantOrderActions },
        $or: [
          { 'details': { $regex: orderIdString, $options: 'i' } },
          { 'details.orderId': { $regex: orderIdString, $options: 'i' } }
        ]
      })
      .select('_id action username userRole timestamp success severity details resource resourceId')
      .sort({ timestamp: -1 })
      .lean()
      .maxTimeMS(3000);
      
      if (fallbackLogs.length > 0) {
        logs = fallbackLogs;
      }
    }

    // Enhanced log formatting with detailed change information
    const formattedLogs = logs.map((log: any) => ({
      id: log._id.toString(),
      action: log.action,
      username: log.username,
      userRole: log.userRole,
      timestamp: log.timestamp,
      success: log.success,
      severity: log.severity,
      resource: log.resource,
      resourceId: log.resourceId,
      details: {
        ipAddress: log.details?.ipAddress,
        userAgent: log.details?.userAgent,
        oldValues: log.details?.oldValues,
        newValues: log.details?.newValues,
        changeSummary: log.details?.changeSummary,
        method: log.details?.method,
        endpoint: log.details?.endpoint,
        requestBody: log.details?.requestBody,
        responseStatus: log.details?.responseStatus,
        errorMessage: log.details?.errorMessage,
        metadata: log.details?.metadata
      }
    }));

    // Disable caching for real-time logs
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Response-Time': `${Date.now() - startTime}ms`
    };

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: formattedLogs 
      }), 
      { status: 200, headers }
    );
  } catch (error: unknown) {
    // Handle MongoDB specific errors
    let message = 'Unknown error occurred';
    if (error instanceof Error) {
      if (error.message.includes('hint provided does not correspond to an existing index')) {
        message = 'Database index error - please contact administrator';
      } else if (error.message.includes('timeout')) {
        message = 'Request timeout - please try again';
      } else {
        message = error.message;
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message,
        data: [] // Return empty array instead of error details for security
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
