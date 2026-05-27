import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Log, { ILogModel } from '@/models/Log';
import { ok, badRequest, serverError, unauthorized } from '@/lib/http';
import { getSession } from '@/lib/session';
import { logView } from '@/lib/logger';

// GET /api/logs - Get logs with filtering and pagination
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    await dbConnect();
    
    // Check authentication
    const session = await getSession(request);
    if (!session) {
      return unauthorized('Authentication required');
    }
    
    // Allow both users and superadmins to view logs
    if (session.role !== 'superadmin' && session.role !== 'user') {
      return unauthorized('Insufficient permissions');
    }
    
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const includeStats = queryParams.includeStats === 'true';
    
    const {
      page = '1',
      limit = '50',
      cursor,
      userId,
      username,
      action,
      resource,
      resourceId,
      success,
      severity,
      startDate,
      endDate,
      dateFilter,
      excludeAction,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = queryParams;
    
    // Build filter object
    let filter: any = {};
    
    if (userId) filter.userId = userId;
    if (username) filter.username = { $regex: username, $options: 'i' };
    if (action) filter.action = action;
    if (resource) filter.resource = resource;
    if (resourceId) filter.resourceId = resourceId;
    if (success !== undefined) filter.success = success === 'true';
    if (severity) filter.severity = severity;
    
    // Exclude specific actions
    if (excludeAction) {
      filter.action = { $ne: excludeAction };
    }
    
    // Exclude routine page view logs and only show important operations
    const importantActions = [
      'login', 'logout', 'login_failed', 'password_change', 'password_reset',
      'user_create', 'user_update', 'user_delete', 'user_activate', 'user_deactivate',
      'order_create', 'order_update', 'order_delete', 'order_status_change',
      'lab_create', 'lab_update', 'lab_delete', 'lab_status_change',
      'party_create', 'party_update', 'party_delete',
      'quality_create', 'quality_update', 'quality_delete',
      'file_upload', 'file_delete', 'file_download',
      'system_backup', 'system_restore', 'system_config_change',
      'export', 'import', 'search', 'filter'
    ];
    
    // Only show important actions
    filter.action = { $in: importantActions };
    
    // Date range filter
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    } else if (dateFilter) {
      // Handle dateFilter parameter
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (dateFilter) {
        case 'today':
          filter.timestamp = {
            $gte: startOfDay,
            $lte: now
          };
          break;
        case 'week':
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          filter.timestamp = {
            $gte: startOfWeek,
            $lte: now
          };
          break;
        case 'month':
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          filter.timestamp = {
            $gte: startOfMonth,
            $lte: now
          };
          break;
        // 'all' is handled by not adding any timestamp filter
      }
    }
    
    // Optimized limit handling - allow larger limits for logs page
    const limitNum = Math.min(Math.max(parseInt(limit), 1), 100); // Enforce max 100 for performance
    
    // Sorting - include _id as secondary sort for consistent ordering
    const sort: any = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    sort._id = sortOrder === 'desc' ? -1 : 1; // Secondary sort by _id for consistent ordering
    
    let logs, hasMore, results;
    
    // Build the final query with cursor-based pagination
    let finalFilter = { ...filter };
    
    // Add cursor-based pagination if cursor is provided
    if (cursor) {
      try {
        // Handle compound cursor (timestamp_id)
        if (cursor.includes('_')) {
          const cursorParts = cursor.split('_');
          const cursorDate = new Date(cursorParts[0]);
          const cursorId = cursorParts[1];
          
          // Create compound cursor condition for better pagination
          if (sortOrder === 'desc') {
            // For descending order: (timestamp < cursorDate) OR (timestamp = cursorDate AND _id < cursorId)
            finalFilter.$or = [
              { [sortBy]: { $lt: cursorDate } },
              { 
                $and: [
                  { [sortBy]: cursorDate },
                  { _id: { $lt: cursorId } }
                ]
              }
            ];
          } else {
            // For ascending order: (timestamp > cursorDate) OR (timestamp = cursorDate AND _id > cursorId)
            finalFilter.$or = [
              { [sortBy]: { $gt: cursorDate } },
              { 
                $and: [
                  { [sortBy]: cursorDate },
                  { _id: { $gt: cursorId } }
                ]
              }
            ];
          }
        } else {
          // Fallback for simple cursor format
          const cursorDate = new Date(cursor);
          if (sortOrder === 'desc') {
            finalFilter[sortBy] = { ...finalFilter[sortBy], $lt: cursorDate };
          } else {
            finalFilter[sortBy] = { ...finalFilter[sortBy], $gt: cursorDate };
          }
        }
      } catch (error) {
        // Continue without cursor if it's invalid
      }
    }
    
    // Execute query with timeout
    logs = await Log.find(finalFilter).sort(sort).limit(limitNum + 1).lean().maxTimeMS(3000); // 3 second timeout
    
    // Check if there are more results
    hasMore = logs.length > limitNum;
    results = hasMore ? logs.slice(0, limitNum) : logs;
    
    // Get total count for pagination info
    const total = await Log.countDocuments(filter).maxTimeMS(2000); // 2 second timeout
    
    // Get next cursor - use compound cursor for better pagination
    let nextCursor = null;
    if (hasMore && results.length > 0) {
      const lastLog = results[results.length - 1];
      // Use compound cursor: timestamp_id for better pagination
      nextCursor = `${lastLog[sortBy]}_${lastLog._id}`;
      }
    
    // Calculate statistics if requested
    let statistics = null;
    if (includeStats) {
      const statsResults = await Log.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            successful: { $sum: { $cond: [{ $eq: ["$success", true] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$success", false] }, 1, 0] } },
            uniqueUsers: { $addToSet: "$username" }
          }
        },
        {
          $addFields: {
            uniqueUsersCount: { $size: "$uniqueUsers" }
          }
        }
      ]);
      
      if (statsResults.length > 0) {
        const stats = statsResults[0];
        statistics = {
          total: stats.total,
          successful: stats.successful,
          failed: stats.failed,
          uniqueUsers: stats.uniqueUsersCount
        };
      } else {
        statistics = {
          total: 0,
          successful: 0,
          failed: 0,
          uniqueUsers: 0
        };
      }
    }
    
    // Add cache headers
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
      'X-Response-Time': `${Date.now() - startTime}ms`
    };
    
    const response: any = {
      success: true,
      logs: results,
      pagination: {
        hasMore,
        nextCursor,
        total,
        limit: limitNum
      }
    };
    
    if (statistics) {
      response.statistics = statistics;
    }
    
    return new Response(JSON.stringify(response), { headers });
    
  } catch (error) {
    // Handle MongoDB specific errors
    let message = 'Failed to fetch logs';
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        message = 'Request timeout - please try again';
      } else if (error.message.includes('index')) {
        message = 'Database error - please contact administrator';
      } else {
        message = error.message;
      }
    }
    
    return new Response(JSON.stringify({
      success: false,
      message
    }), { status: 500 });
  }
}

// DELETE /api/logs - Cleanup old logs (superadmin only)
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    
    // Check authentication
    const session = await getSession(request);
    if (!session) {
      return unauthorized('Authentication required');
    }
    
         // Allow both users and superadmins to delete logs
     if (session.role !== 'superadmin' && session.role !== 'user') {
       return unauthorized('Authentication required');
     }
    
    const { searchParams } = new URL(request.url);
    const daysToKeep = parseInt(searchParams.get('daysToKeep') || '90');
    
    if (daysToKeep < 1 || daysToKeep > 365) {
      return badRequest('daysToKeep must be between 1 and 365');
    }
    
    const result = await (Log as ILogModel).cleanupOldLogs(daysToKeep);
    
    return ok({
      message: `Cleaned up logs older than ${daysToKeep} days`,
      deletedCount: result.deletedCount
    });   
    
  } catch (error) {
    return serverError(error);
  }
}
