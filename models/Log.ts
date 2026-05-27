import mongoose, { Document, Schema, Model } from "mongoose";

// Enhanced TypeScript interfaces
export interface ILog extends Document {
  userId: string;
  username: string;
  userRole: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: {
    method?: string;
    endpoint?: string;
    ipAddress?: string;
    userAgent?: string;
    requestBody?: any;
    responseStatus?: number;
    errorMessage?: string;
    oldValues?: any;
    newValues?: any;
    metadata?: any;
    changedFields?: any;
    changeSummary?: any;
  };
  timestamp: Date;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  duration?: number; // in milliseconds
  success: boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

// Enhanced static methods interface
export interface ILogModel extends Model<ILog> {
  logUserAction(data: {
    userId: string;
    username: string;
    userRole: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: any;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    duration?: number;
    success?: boolean;
    severity?: 'info' | 'warning' | 'error' | 'critical';
  }): Promise<ILog>;
  
  getUserActivity(userId: string, limit?: number): Promise<ILog[]>;
  getSystemActivity(limit?: number): Promise<ILog[]>;
  getActivityByResource(resource: string, resourceId?: string): Promise<ILog[]>;
  getActivityByAction(action: string): Promise<ILog[]>;
  getActivityByDateRange(startDate: Date, endDate: Date): Promise<ILog[]>;
  getErrorLogs(limit?: number): Promise<ILog[]>;
  getLoginLogs(limit?: number): Promise<ILog[]>;
  getFailedLoginAttempts(limit?: number): Promise<ILog[]>;
  cleanupOldLogs(daysToKeep: number): Promise<{ deletedCount: number }>;
  getActivityStats(): Promise<any>;
}

const LogSchema = new Schema<ILog>({
  userId: {
    type: String,
    required: [true, "User ID is required"],
    index: true
  },
  username: {
    type: String,
    required: [true, "Username is required"],
    index: true
  },
  userRole: {
    type: String,
    required: [true, "User role is required"],
    enum: ['superadmin', 'user', 'system'],
    index: true
  },
  action: {
    type: String,
    required: [true, "Action is required"],
    enum: [
      // Authentication actions
      'login', 'logout', 'login_failed', 'password_change', 'password_reset',
      // User management
      'user_create', 'user_update', 'user_delete', 'user_activate', 'user_deactivate',
      // Order actions
      'order_create', 'order_update', 'order_delete', 'order_status_change',
      // Lab actions
      'lab_create', 'lab_update', 'lab_delete', 'lab_status_change',
      // Grey Info actions
      'grey_info_create', 'grey_info_update', 'grey_info_delete',
      // Mill Input actions
      'mill_input_create', 'mill_input_update', 'mill_input_delete',
      // Mill Output actions
      'mill_output_create', 'mill_output_update', 'mill_output_delete',
      // Dispatch actions
      'dispatch_create', 'dispatch_update', 'dispatch_delete',
      // Party actions
      'party_create', 'party_update', 'party_delete',
      // Quality actions
      'quality_create', 'quality_update', 'quality_delete',
      // File actions
      'file_upload', 'file_delete', 'file_download',
      // System actions
      'system_backup', 'system_restore', 'system_config_change', 'test_error',
      // Generic actions
      'view', 'export', 'import', 'search', 'filter'
    ],
    index: true
  },
  resource: {
    type: String,
    required: [true, "Resource is required"],
    enum: [
      'auth', 'user', 'order', 'lab', 'grey_info', 'mill_input', 'mill_output', 'dispatch', 'party', 'quality', 'file', 'system', 'dashboard', 'log'
    ],
    index: true
  },
  resourceId: {
    type: String,
    index: true
  },
  details: {
    method: String,
    endpoint: String,
    ipAddress: String,
    userAgent: String,
    requestBody: Schema.Types.Mixed,
    responseStatus: Number,
    errorMessage: String,
    oldValues: Schema.Types.Mixed,
    newValues: Schema.Types.Mixed,
    metadata: Schema.Types.Mixed,
    changedFields: Schema.Types.Mixed,
    changeSummary: Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  sessionId: {
    type: String,
    index: true
  },
  ipAddress: {
    type: String,
    index: true
  },
  userAgent: String,
  duration: Number,
  success: {
    type: Boolean,
    default: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info',
    index: true
  }
}, {
  timestamps: true
});

// Optimized indexes for better query performance (removed duplicates that are already defined in field definitions)

// Compound indexes for specific queries
LogSchema.index({ resource: 1, action: 1, timestamp: -1 }, { background: true }); // For resource-specific actions
LogSchema.index({ userId: 1, resource: 1, timestamp: -1 }, { background: true }); // For user activity by resource

// Specific optimized index for order logs
LogSchema.index({ resource: 1, resourceId: 1, timestamp: -1 }, { background: true, partialFilterExpression: { resource: 'order' } });

// Static method to log user actions
LogSchema.statics.logUserAction = async function(data: {
  userId: string;
  username: string;
  userRole: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  duration?: number;
  success?: boolean;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}) {
  const log = new this({
    ...data,
    success: data.success ?? true,
    severity: data.severity ?? 'info'
  });
  
  return await log.save();
};

// Get user activity
LogSchema.statics.getUserActivity = async function(userId: string, limit: number = 50) {
  return await this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Get system activity
LogSchema.statics.getSystemActivity = async function(limit: number = 100) {
  return await this.find()
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Get activity by resource
LogSchema.statics.getActivityByResource = async function(resource: string, resourceId?: string) {
  const filter: any = { resource };
  if (resourceId) {
    filter.resourceId = resourceId;
  }
  
  return await this.find(filter)
    .sort({ timestamp: -1 })
    .lean();
};

// Get activity by action
LogSchema.statics.getActivityByAction = async function(action: string) {
  return await this.find({ action })
    .sort({ timestamp: -1 })
    .lean();
};

// Get activity by date range
LogSchema.statics.getActivityByDateRange = async function(startDate: Date, endDate: Date) {
  return await this.find({
    timestamp: {
      $gte: startDate,
      $lte: endDate
    }
  })
    .sort({ timestamp: -1 })
    .lean();
};

// Get error logs
LogSchema.statics.getErrorLogs = async function(limit: number = 50) {
  return await this.find({
    $or: [
      { success: false },
      { severity: { $in: ['error', 'critical'] } }
    ]
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Get login logs
LogSchema.statics.getLoginLogs = async function(limit: number = 50) {
  return await this.find({
    action: { $in: ['login', 'logout'] }
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Get failed login attempts
LogSchema.statics.getFailedLoginAttempts = async function(limit: number = 50) {
  return await this.find({
    action: 'login_failed'
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Cleanup old logs
LogSchema.statics.cleanupOldLogs = async function(daysToKeep: number = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const result = await this.deleteMany({
    timestamp: { $lt: cutoffDate }
  });
  
  return result;
};

// Get activity statistics
LogSchema.statics.getActivityStats = async function() {
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const stats = await this.aggregate([
    {
      $facet: {
        totalLogs: [{ $count: "count" }],
        last24Hours: [
          { $match: { timestamp: { $gte: last24Hours } } },
          { $count: "count" }
        ],
        last7Days: [
          { $match: { timestamp: { $gte: last7Days } } },
          { $count: "count" }
        ],
        last30Days: [
          { $match: { timestamp: { $gte: last30Days } } },
          { $count: "count" }
        ],
        byAction: [
          { $group: { _id: "$action", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ],
        byResource: [
          { $group: { _id: "$resource", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ],
        byUser: [
          { $group: { _id: "$username", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ],
        errors: [
          { $match: { $or: [{ success: false }, { severity: { $in: ["error", "critical"] } }] } },
          { $count: "count" }
        ],
        recentErrors: [
          { $match: { 
            $and: [
              { $or: [{ success: false }, { severity: { $in: ["error", "critical"] } }] },
              { timestamp: { $gte: last24Hours } }
            ]
          }},
          { $count: "count" }
        ]
      }
    }
  ]);
  
  return stats[0];
};

export default mongoose.models.Log || mongoose.model<ILog, ILogModel>('Log', LogSchema);
