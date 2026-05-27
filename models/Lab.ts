import mongoose, { Document, Schema, Model } from "mongoose";

// Enhanced TypeScript interfaces
export interface ILab extends Document {
  order: mongoose.Types.ObjectId;
  orderItemId: string; // Can be ObjectId string or temporary string like 'item_0'
  labSendDate: Date;
  labSendData?: string | Record<string, any>;
  labSendNumber: string;
  status: 'sent' | 'received' | 'cancelled' | 'in_progress';
  receivedDate?: Date;
  priority: number;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  attachments?: Array<{
    url: string;
    fileName: string;
    fileSize?: number;
    uploadedAt: Date;
  }>;
  remarks?: string;
  softDeleted: boolean;
  metadata: {
    createdBy?: string;
    assignedTo?: string;
    tags: string[];
    notes?: string;
    source: string;
    complexity: 'simple' | 'moderate' | 'complex';
  };
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  markAsReceived(): Promise<void>;
  updateStatus(newStatus: 'sent' | 'received' | 'cancelled' | 'in_progress'): Promise<void>;
  addAttachment(url: string, fileName: string, fileSize?: number): Promise<void>;
  removeAttachment(fileName: string): Promise<void>;
  isOverdue: boolean;
}

// Enhanced static methods interface
export interface ILabModel extends Model<ILab> {
  findByOrder(orderId: string): Promise<ILab[]>;
  findByOrderItem(orderId: string, orderItemId: string): Promise<ILab | null>;
  searchLabs(query: string): Promise<ILab[]>;
  findByStatus(status: 'sent' | 'received' | 'cancelled' | 'in_progress'): Promise<ILab[]>;
  findHighPriorityLabs(): Promise<ILab[]>;
  findUrgentLabs(): Promise<ILab[]>;
  findByAssignedTo(userId: string): Promise<ILab[]>;
  getLabStats(): Promise<any>;
  findOverdueLabs(): Promise<ILab[]>;
}

// Validation functions
const validateLabSendNumber = (number: string) => {
  return /^[A-Z0-9\-_]{1,50}$/.test(number);
};

const validateUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const LabSchema = new Schema<ILab>({
  order: {
    type: Schema.Types.ObjectId,
    ref: "Order",
    required: [true, "Order is required"],
    index: true
  },
  orderItemId: {
    type: String, // Allow both ObjectId and temporary string IDs
    required: [true, "Order item ID is required"],
    index: true
  },
  labSendDate: {
    type: Date,
    required: [true, "Lab send date is required"],
    default: Date.now,
    index: true
  },
  labSendData: {
    type: {
      color: {
        type: String,
        trim: true,
        maxlength: [100, "Color cannot exceed 100 characters"]
      },
      shade: {
        type: String,
        trim: true,
        maxlength: [100, "Shade cannot exceed 100 characters"]
      },
      notes: {
        type: String,
        trim: true,
        maxlength: [500, "Notes cannot exceed 500 characters"]
      },
      sampleNumber: {
        type: String,
        trim: true,
        maxlength: [50, "Sample number cannot exceed 50 characters"]
      },
      imageUrl: {
        type: String,
        trim: true,
        maxlength: [500, "Image URL cannot exceed 500 characters"]
      },
      approvalDate: {
        type: Date
      },
      specifications: {
        type: Schema.Types.Mixed,
        default: {}
      }
    },
    default: {}
  },
  labSendNumber: {
    type: String,
    required: false, // Make it optional
    trim: true,
    uppercase: true,
    maxlength: [50, "Lab send number cannot exceed 50 characters"],
    validate: {
      validator: function(value: string) {
        // Only validate if value is provided
        if (!value || value.trim() === '') {
          return true; // Empty is valid
        }
        return validateLabSendNumber(value);
      },
      message: "Lab send number can only contain uppercase letters, numbers, hyphens, and underscores"
    },
    index: true
  },
  status: {
    type: String,
    enum: {
      values: ["sent", "received", "cancelled", "in_progress"],
      message: "Status must be one of: sent, received, cancelled, in_progress"
    },
    default: "sent",
    index: true
  },
  priority: {
    type: Number,
    min: [1, "Priority must be at least 1"],
    max: [10, "Priority cannot exceed 10"],
    default: 5,
    index: true
  },
  urgency: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'urgent'],
      message: "Urgency must be one of: low, medium, high, urgent"
    },
    default: 'medium',
    index: true
  },
  receivedDate: {
    type: Date,
    index: true
  },
  attachments: [{
    url: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: validateUrl,
        message: "Please provide a valid URL"
      }
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, "File name cannot exceed 200 characters"]
    },
    fileSize: {
      type: Number,
      min: [0, "File size cannot be negative"]
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  remarks: {
    type: String,
    trim: true,
    maxlength: [1000, "Remarks cannot exceed 1000 characters"]
  },
  softDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  metadata: {
    createdBy: {
      type: String,
      maxlength: [50, "Creator name cannot exceed 50 characters"]
    },
    assignedTo: {
      type: String,
      maxlength: [50, "Assignee name cannot exceed 50 characters"],
      index: true
    },
    tags: [{
      type: String,
      trim: true,
      maxlength: [30, "Tag cannot exceed 30 characters"]
    }],
    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"]
    },
    source: {
      type: String,
      enum: {
        values: ['manual', 'api', 'import', 'system'],
        message: "Source must be one of: manual, api, import, system"
      },
      default: 'manual',
      index: true
    },
    complexity: {
      type: String,
      enum: {
        values: ['simple', 'moderate', 'complex'],
        message: "Complexity must be one of: simple, moderate, complex"
      },
      default: 'moderate',
      index: true
    }
  }
}, {
  timestamps: true,
  collection: 'labs',
  toJSON: {
    transform: function(doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
    virtuals: true
  },
  toObject: {
    transform: function(doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
    virtuals: true
  }
});

// **EXACT INDEXES TO ADD**
// Primary indexes (removed duplicates that are already defined in field definitions)
LabSchema.index({ createdAt: -1 }, { name: 'idx_lab_created_desc' });
LabSchema.index({ updatedAt: -1 }, { name: 'idx_lab_updated_desc' });

// Compound indexes for common query patterns
// Remove unique constraint since orderItemId can be temporary
LabSchema.index({ order: 1, orderItemId: 1 }, { name: 'idx_lab_order_item' });
LabSchema.index({ order: 1, status: 1 }, { name: 'idx_lab_order_status' });
LabSchema.index({ order: 1, softDeleted: 1 }, { name: 'idx_lab_order_soft_deleted' });
LabSchema.index({ status: 1, softDeleted: 1 }, { name: 'idx_lab_status_soft_deleted' });
LabSchema.index({ status: 1, priority: -1 }, { name: 'idx_lab_status_priority' });
LabSchema.index({ urgency: 1, priority: -1 }, { name: 'idx_lab_urgency_priority' });
LabSchema.index({ "metadata.assignedTo": 1, status: 1 }, { name: 'idx_lab_assigned_status' });
LabSchema.index({ "metadata.source": 1, status: 1 }, { name: 'idx_lab_source_status' });
LabSchema.index({ labSendDate: 1, status: 1 }, { name: 'idx_lab_send_date_status' });

// Text search index
LabSchema.index({ 
  labSendNumber: "text",
  remarks: "text",
  "metadata.tags": "text",
  "metadata.notes": "text"
}, {
  weights: {
    labSendNumber: 10,
    remarks: 5,
    "metadata.tags": 3,
    "metadata.notes": 2
  },
  name: "idx_lab_text_search"
});

// **VALIDATION RULES**
// ✅ Required: order, orderItemId, labSendDate, labSendNumber, status, priority, urgency
// ✅ Regex: labSendNumber format, URL validation
// ✅ Enums: status (sent, received, cancelled, in_progress), urgency (low, medium, high, urgent), source (manual, api, import, system), complexity (simple, moderate, complex)
// ✅ Min/Max: labSendNumber (3-50), priority (1-10), remarks (0-1000), tags (0-30)
// ✅ Custom validation: labSendNumber format, URL format

// **EMBED VS REFERENCE DECISIONS**
// ✅ **Embedded**: attachments (small, always with lab)
// ✅ **Embedded**: metadata (small, always with lab)
// ✅ **Reference**: order (large entity, complex queries)
// ✅ **Reference**: orderItemId (large entity, complex queries)

// **TTL/TIME-SERIES OPTIMIZATIONS**
// Consider TTL for:
// - Old lab records (2 years)
// - Soft deleted labs (30 days)

// **INSTANCE METHODS**
LabSchema.methods.markAsReceived = async function(): Promise<void> {
  this.status = 'received';
  this.receivedDate = new Date();
  await this.save();
};

LabSchema.methods.updateStatus = async function(newStatus: 'sent' | 'received' | 'cancelled' | 'in_progress'): Promise<void> {
  this.status = newStatus;
  if (newStatus === 'received' && !this.receivedDate) {
    this.receivedDate = new Date();
  }
  await this.save();
};

LabSchema.methods.addAttachment = async function(url: string, fileName: string, fileSize?: number): Promise<void> {
  if (!this.attachments) {
    this.attachments = [];
  }
  
  this.attachments.push({
    url,
    fileName,
    fileSize,
    uploadedAt: new Date()
  });
  
  await this.save();
};

LabSchema.methods.removeAttachment = async function(fileName: string): Promise<void> {
  if (this.attachments) {
    this.attachments = this.attachments.filter((att: any) => att.fileName !== fileName);
    await this.save();
  }
};

// **STATIC METHODS**
LabSchema.statics.findByOrder = function(orderId: string): Promise<ILab[]> {
  return this.find({ 
    order: orderId, 
    softDeleted: false 
  })
  .populate('order')
  .sort({ createdAt: -1 })
  .lean();
};

LabSchema.statics.findByOrderItem = function(orderId: string, orderItemId: string): Promise<ILab | null> {
  return this.findOne({ 
    order: orderId, 
    orderItemId: orderItemId,
    softDeleted: false 
  })
  .populate('order')
  .lean();
};

LabSchema.statics.searchLabs = function(query: string): Promise<ILab[]> {
  return this.find({
    $text: { $search: query },
    softDeleted: false
  })
  .populate('order')
  .sort({ score: { $meta: "textScore" }, priority: -1 })
  .limit(50)
  .lean();
};

LabSchema.statics.findByStatus = function(status: 'sent' | 'received' | 'cancelled' | 'in_progress'): Promise<ILab[]> {
  return this.find({ 
    status, 
    softDeleted: false 
  })
  .populate('order')
  .sort({ priority: -1, createdAt: -1 })
  .lean();
};

LabSchema.statics.findHighPriorityLabs = function(): Promise<ILab[]> {
  return this.find({ 
    priority: { $gte: 8 },
    softDeleted: false 
  })
  .populate('order')
  .sort({ priority: -1, createdAt: -1 })
  .lean();
};

LabSchema.statics.findUrgentLabs = function(): Promise<ILab[]> {
  return this.find({ 
    urgency: { $in: ['high', 'urgent'] },
    softDeleted: false 
  })
  .populate('order')
  .sort({ urgency: -1, priority: -1 })
  .lean();
};

LabSchema.statics.findByAssignedTo = function(userId: string): Promise<ILab[]> {
  return this.find({ 
    "metadata.assignedTo": userId,
    softDeleted: false 
  })
  .populate('order')
  .sort({ priority: -1, createdAt: -1 })
  .lean();
};

LabSchema.statics.getLabStats = async function(): Promise<any> {
  const stats = await this.aggregate([
    {
      $match: { softDeleted: false }
    },
    {
      $group: {
        _id: null,
        totalLabs: { $sum: 1 },
        sentLabs: { $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] } },
        receivedLabs: { $sum: { $cond: [{ $eq: ["$status", "received"] }, 1, 0] } },
        inProgressLabs: { $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] } },
        cancelledLabs: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
        urgentLabs: { $sum: { $cond: [{ $in: ["$urgency", ["high", "urgent"]] }, 1, 0] } },
        avgPriority: { $avg: "$priority" }
      }
    }
  ]);
  
  return stats[0] || {
    totalLabs: 0,
    sentLabs: 0,
    receivedLabs: 0,
    inProgressLabs: 0,
    cancelledLabs: 0,
    urgentLabs: 0,
    avgPriority: 0
  };
};

LabSchema.statics.findOverdueLabs = function(): Promise<ILab[]> {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  
  return this.find({ 
    labSendDate: { $lt: threeDaysAgo },
    status: { $in: ['sent', 'in_progress'] },
    softDeleted: false 
  })
  .populate('order')
  .sort({ labSendDate: 1, priority: -1 })
  .lean();
};

// **VIRTUAL FIELDS**
LabSchema.virtual('isOverdue').get(function() {
  if (this.status === 'received' || this.status === 'cancelled') {
    return false;
  }
  
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  
  return this.labSendDate < threeDaysAgo;
});

LabSchema.virtual('fullInfo').get(function() {
  return {
    id: this._id,
    order: this.order,
    orderItemId: this.orderItemId,
    labSendDate: this.labSendDate,
    labSendData: this.labSendData,
    labSendNumber: this.labSendNumber,
    status: this.status,
    priority: this.priority,
    urgency: this.urgency,
    receivedDate: this.receivedDate,
    attachments: this.attachments,
    remarks: this.remarks,
    softDeleted: this.softDeleted,
    metadata: this.metadata,
    isOverdue: this.isOverdue,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
});

// **MIDDLEWARE**
LabSchema.pre('save', function(next) {
  // Normalize tags
  if (this.metadata?.tags) {
    this.metadata.tags = [...new Set(this.metadata.tags.map(tag => tag.toLowerCase().trim()))];
  }
  
  // Auto-set received date when status changes to received
  if (this.isModified('status') && this.status === 'received' && !this.receivedDate) {
    this.receivedDate = new Date();
  }
  
  next();
});

LabSchema.post('save', function(error: any, doc: any, next: any) {
  if (error.name === 'MongoError' && error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    if (field === 'order_1_orderItemId_1') {
      next(new Error('A lab already exists for this order item'));
    } else if (field === 'labSendNumber') {
      next(new Error('Lab send number already exists'));
    } else {
      next(new Error(`${field} already exists`));
    }
  } else {
    next(error);
  }
});

// **QUERY OPTIMIZATION**
// Note: Removed automatic lean() middleware to allow proper document operations
// Use .lean() explicitly in queries where you only need read operations

const Lab = mongoose.models.Lab || mongoose.model<ILab, ILabModel>("Lab", LabSchema);

export default Lab;
