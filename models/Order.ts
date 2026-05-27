import mongoose, { Document, Schema, Model } from "mongoose";
import Counter from "./Counter";

// Enhanced Order Item interface
export interface IOrderItem {
  quality?: mongoose.Types.ObjectId;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  imageUrls?: string[];
  description?: string;
  weaverSupplierName?: string; // Weaver / Supplier Name moved to item level
  purchaseRate?: number; // Purchase Rate moved to item level
  millRate?: number; // Mill Rate field
  salesRate?: number; // Sales Rate field
  specifications?: Record<string, any>;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: number;
  notes?: string;
}

// Enhanced TypeScript interface
export interface IOrder extends Document {
  orderId: string;
  orderType?: "Dying" | "Printing";
  arrivalDate?: Date;
  party?: mongoose.Types.ObjectId;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  poNumber?: string;
  styleNo?: string;
  poDate?: Date;
  deliveryDate?: Date;
  // weaverSupplierName and purchaseRate moved to item level
  items: IOrderItem[];
  status: "Not set" | "Not selected" | "pending" | "in_progress" | "completed" | "delivered" | "cancelled";
  priority: number;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  finalAmount: number;
  paymentStatus: 'pending' | 'partial' | 'paid';
  paymentMethod?: string;
  shippingAddress?: string;
  billingAddress?: string;
  notes?: string;
  // Additional data for button states (populated by API)
  millInputs?: any[];
  millOutputs?: any[];
  dispatches?: any[];
  metadata: {
    createdBy?: string;
    tags: string[];
    source?: string;
    urgency?: 'low' | 'medium' | 'high' | 'urgent';
    complexity?: 'simple' | 'moderate' | 'complex';
  };
  labData?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Enhanced static methods interface
export interface IOrderModel extends Model<IOrder> {
  createOrder(orderData: any): Promise<IOrder>;
  findByOrderId(orderId: string): Promise<IOrder | null>;
  findByParty(partyId: string): Promise<IOrder[]>;
  findByPoNumber(poNumber: string): Promise<IOrder[]>;
  findByStyleNo(styleNo: string): Promise<IOrder[]>;
  findByOrderType(orderType: "Dying" | "Printing"): Promise<IOrder[]>;
  searchOrders(searchTerm: string): Promise<IOrder[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<IOrder[]>;
  findPendingOrders(): Promise<IOrder[]>;
  findDeliveredOrders(): Promise<IOrder[]>;
  findHighPriorityOrders(): Promise<IOrder[]>;
  findByStatus(status: string): Promise<IOrder[]>;
  findByPaymentStatus(paymentStatus: string): Promise<IOrder[]>;
  getOrderStats(): Promise<any>;
  getRevenueStats(startDate?: Date, endDate?: Date): Promise<any>;
}

// Validation functions
const validateImageUrls = (urls: string[]) => {
  return urls.every(url => url.length <= 500);
};

const validatePriority = (priority: number) => {
  return priority >= 1 && priority <= 10;
};

const validateAmount = (amount: number) => {
  return amount >= 0;
};

const OrderSchema = new Schema<IOrder>({
  orderId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  orderType: {
    type: String,
    enum: {
      values: ["Dying", "Printing"],
      message: "Order type must be either 'Dying' or 'Printing'"
    },
    index: true
  },
  arrivalDate: {
    type: Date,
    index: true
  },
  party: {
    type: Schema.Types.ObjectId,
    ref: "Party",
    index: true,
    validate: {
      validator: async function (value: mongoose.Types.ObjectId) {
        if (!value) return true; // Optional field
        const Party = mongoose.model('Party');
        const exists = await Party.exists({ _id: value });
        return !!exists;
      },
      message: 'Party does not exist'
    }
  },
  contactName: {
    type: String,
    trim: true,
    maxlength: [50, "Contact name cannot exceed 50 characters"]
  },
  contactPhone: {
    type: String,
    trim: true,
    maxlength: [20, "Contact phone cannot exceed 20 characters"]
  },
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [100, "Contact email cannot exceed 100 characters"]
  },
  poNumber: {
    type: String,
    trim: true,
    maxlength: [50, "PO number cannot exceed 50 characters"],
    index: true
  },
  styleNo: {
    type: String,
    trim: true,
    maxlength: [50, "Style number cannot exceed 50 characters"],
    index: true
  },
  poDate: {
    type: Date
  },
  deliveryDate: {
    type: Date,
    index: true
  },
  // weaverSupplierName and purchaseRate moved to item level
  items: {
    type: [{
      quality: {
        type: Schema.Types.ObjectId,
        ref: "Quality",
        validate: {
          validator: async function (value: mongoose.Types.ObjectId) {
            if (!value) return true; // Optional field
            const Quality = mongoose.model('Quality');
            const exists = await Quality.exists({ _id: value });
            return !!exists;
          },
          message: 'Quality does not exist'
        }
      },
      quantity: {
        type: Number,
        min: [1, "Quantity must be at least 1"],
        required: [true, "Quantity is required for each order item"],
        default: 1
      },
      unitPrice: {
        type: Number,
        min: [0, "Unit price cannot be negative"],
        default: 0
      },
      totalPrice: {
        type: Number,
        min: [0, "Total price cannot be negative"],
        default: 0
      },
      imageUrls: {
        type: [String],
        default: [],
        validate: {
          validator: validateImageUrls,
          message: "Each image URL cannot exceed 500 characters"
        }
      },
      description: {
        type: String,
        trim: true,
        maxlength: [200, "Description cannot exceed 200 characters"]
      },
      weaverSupplierName: {
        type: String,
        trim: true,
        maxlength: [100, "Weaver supplier name cannot exceed 100 characters"]
      },
      purchaseRate: {
        type: Number,
        min: [0, "Purchase rate cannot be negative"]
      },
      millRate: {
        type: Number,
        min: [0, "Mill rate cannot be negative"]
      },
      salesRate: {
        type: Number,
        min: [0, "Sales rate cannot be negative"]
      },
      specifications: {
        type: Schema.Types.Mixed,
        default: {}
      },
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'cancelled'],
        default: 'pending'
      },
      priority: {
        type: Number,
        min: [1, "Priority must be at least 1"],
        max: [10, "Priority cannot exceed 10"],
        default: 5
      },
      notes: {
        type: String,
        trim: true,
        maxlength: [500, "Notes cannot exceed 500 characters"]
      }
    }],
    default: []
  },
  status: {
    type: String,
    enum: {
      values: ["Not set", "Not selected", "pending", "in_progress", "completed", "delivered", "cancelled"],
      message: "Status must be one of: Not set, Not selected, pending, in_progress, completed, delivered, cancelled"
    },
    default: 'pending',
    index: true
  },
  priority: {
    type: Number,
    min: [1, "Priority must be at least 1"],
    max: [10, "Priority cannot exceed 10"],
    default: 5,
    index: true
  },
  totalAmount: {
    type: Number,
    default: 0,
    min: [0, "Total amount cannot be negative"],
    validate: {
      validator: validateAmount,
      message: "Total amount must be non-negative"
    }
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: [0, "Tax amount cannot be negative"],
    validate: {
      validator: validateAmount,
      message: "Tax amount must be non-negative"
    }
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, "Discount amount cannot be negative"],
    validate: {
      validator: validateAmount,
      message: "Discount amount must be non-negative"
    }
  },
  finalAmount: {
    type: Number,
    default: 0,
    min: [0, "Final amount cannot be negative"],
    validate: {
      validator: validateAmount,
      message: "Final amount must be non-negative"
    },
    index: true
  },
  paymentStatus: {
    type: String,
    enum: {
      values: ['pending', 'partial', 'paid'],
      message: "Payment status must be one of: pending, partial, paid"
    },
    default: 'pending',
    index: true
  },
  paymentMethod: {
    type: String,
    maxlength: [50, "Payment method cannot exceed 50 characters"]
  },
  shippingAddress: {
    type: String,
    trim: true,
    maxlength: [300, "Shipping address cannot exceed 300 characters"]
  },
  billingAddress: {
    type: String,
    trim: true,
    maxlength: [300, "Billing address cannot exceed 300 characters"]
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, "Notes cannot exceed 1000 characters"]
  },
  metadata: {
    createdBy: {
      type: String,
      maxlength: [50, "Creator name cannot exceed 50 characters"]
    },
    tags: [{
      type: String,
      trim: true,
      maxlength: [30, "Tag cannot exceed 30 characters"]
    }],
    source: {
      type: String,
      maxlength: [50, "Source cannot exceed 50 characters"]
    },
    urgency: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    complexity: {
      type: String,
      enum: ['simple', 'moderate', 'complex'],
      default: 'moderate'
    }
  },
  labData: {
    type: Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true,
  collection: 'orders',
  toJSON: {
    transform: function (doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
    virtuals: true
  },
  toObject: {
    transform: function (doc, ret: any) {
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
OrderSchema.index({ createdAt: -1 }, { name: 'idx_order_created_desc' });
OrderSchema.index({ updatedAt: -1 }, { name: 'idx_order_updated_desc' });

// Compound indexes for common query patterns
OrderSchema.index({ party: 1, status: 1 }, { name: 'idx_order_party_status' });
OrderSchema.index({ party: 1, createdAt: -1 }, { name: 'idx_order_party_created' });
OrderSchema.index({ orderType: 1, status: 1 }, { name: 'idx_order_type_status' });
OrderSchema.index({ status: 1, priority: -1 }, { name: 'idx_order_status_priority' });
OrderSchema.index({ paymentStatus: 1, finalAmount: -1 }, { name: 'idx_order_payment_amount' });
OrderSchema.index({ arrivalDate: 1, deliveryDate: 1 }, { name: 'idx_order_date_range' });
OrderSchema.index({ party: 1, orderType: 1 }, { name: 'idx_order_party_type' });
OrderSchema.index({ status: 1, createdAt: -1 }, { name: 'idx_order_status_created' });

// Text search index
OrderSchema.index({
  poNumber: "text",
  styleNo: "text",
  contactName: "text",
  notes: "text",
  "metadata.tags": "text"
}, {
  weights: {
    poNumber: 10,
    styleNo: 10,
    contactName: 5,
    notes: 3,
    "metadata.tags": 2
  },
  name: "idx_order_text_search"
});

// **VALIDATION RULES**
// ✅ Required: orderId, status, priority
// ✅ Regex: contactEmail, paymentMethod
// ✅ Enums: orderType (Dying, Printing), status (pending, in_progress, completed, delivered, cancelled)
// ✅ Enums: paymentStatus (pending, partial, paid), urgency (low, medium, high, urgent)
// ✅ Min/Max: priority (1-10), all amounts (0+), quantities (0+)
// ✅ Custom validation: image URLs, amounts, priority

// **EMBED VS REFERENCE DECISIONS**
// ✅ **Embedded**: items (always accessed with order, complex structure)
// ✅ **Embedded**: metadata (small, always with order)
// ✅ **Reference**: party (large entity, complex queries)
// ✅ **Reference**: quality (large entity, complex queries)
// ✅ **Embedded**: specifications (small, always with item)

// **TTL/TIME-SERIES OPTIMIZATIONS**
// No TTL needed for orders (they're permanent business data)
// Consider TTL for:
// - Order activity logs (1 year)
// - Order search history (30 days)
// - Order audit trails (3 years)

// **STATIC METHODS**
OrderSchema.statics.createOrder = async function (orderData: any): Promise<IOrder> {
  try {
    // Use FY-aware counter: auto-resets to 001 each April 1st
    const { sequence, fyCode } = await (Counter as any).getNextFYSequence('orderId');
    const orderId = `FY${fyCode}-${sequence.toString().padStart(3, '0')}`;

    // Creating order with FY-scoped ID: ${orderId}

    const order = new this({
      ...orderData,
      orderId
    });

    const savedOrder = await order.save();
    // Order created successfully with ID: ${savedOrder.orderId}
    return savedOrder;

  } catch (error: any) {
    // If it's a duplicate key error, try again with a new sequence
    if (error.code === 11000 && error.keyPattern?.orderId) {
      // Duplicate orderId detected, retrying with new sequence...
      try {
        const { sequence, fyCode } = await (Counter as any).getNextFYSequence('orderId');
        const orderId = `FY${fyCode}-${sequence.toString().padStart(3, '0')}`;

        const order = new this({
          ...orderData,
          orderId
        });

        const savedOrder = await order.save();
        // Order created successfully with ID: ${savedOrder.orderId} (retry)
        return savedOrder;
      } catch (retryError: any) {
        throw retryError;
      }
    }

    throw error;
  }
};

OrderSchema.statics.findByOrderId = function (orderId: string): Promise<IOrder | null> {
  return this.findOne({ orderId }).lean();
};

OrderSchema.statics.findByParty = function (partyId: string): Promise<IOrder[]> {
  return this.find({ party: partyId })
    .sort({ createdAt: -1 })
    .lean();
};

OrderSchema.statics.findByPoNumber = function (poNumber: string): Promise<IOrder[]> {
  return this.find({ poNumber })
    .sort({ createdAt: -1 })
    .lean();
};

OrderSchema.statics.findByStyleNo = function (styleNo: string): Promise<IOrder[]> {
  return this.find({ styleNo })
    .sort({ createdAt: -1 })
    .lean();
};

OrderSchema.statics.findByOrderType = function (orderType: "Dying" | "Printing"): Promise<IOrder[]> {
  return this.find({ orderType })
    .sort({ createdAt: -1 })
    .lean();
};

OrderSchema.statics.searchOrders = function (searchTerm: string): Promise<IOrder[]> {
  return this.find({
    $text: { $search: searchTerm }
  })
    .sort({ score: { $meta: "textScore" } })
    .limit(50)
    .lean();
};

OrderSchema.statics.findByDateRange = function (startDate: Date, endDate: Date): Promise<IOrder[]> {
  return this.find({
    arrivalDate: { $gte: startDate, $lte: endDate }
  })
    .sort({ arrivalDate: -1 })
    .lean();
};

OrderSchema.statics.findPendingOrders = function (): Promise<IOrder[]> {
  return this.find({ status: "pending" })
    .sort({ priority: -1, createdAt: -1 })
    .lean();
};

OrderSchema.statics.findDeliveredOrders = function (): Promise<IOrder[]> {
  return this.find({ status: "delivered" })
    .sort({ createdAt: -1 })
    .lean();
};

OrderSchema.statics.findHighPriorityOrders = function (): Promise<IOrder[]> {
  return this.find({
    priority: { $gte: 8 },
    status: { $in: ['pending', 'in_progress'] }
  })
    .sort({ priority: -1, createdAt: -1 })
    .lean();
};

OrderSchema.statics.findByStatus = function (status: string): Promise<IOrder[]> {
  return this.find({ status })
    .sort({ createdAt: -1 })
    .lean();
};

OrderSchema.statics.findByPaymentStatus = function (paymentStatus: string): Promise<IOrder[]> {
  return this.find({ paymentStatus })
    .sort({ finalAmount: -1 })
    .lean();
};

OrderSchema.statics.getOrderStats = async function (): Promise<any> {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        pendingOrders: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
        inProgressOrders: { $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] } },
        completedOrders: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        deliveredOrders: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
        cancelledOrders: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
        dyingOrders: { $sum: { $cond: [{ $eq: ["$orderType", "Dying"] }, 1, 0] } },
        printingOrders: { $sum: { $cond: [{ $eq: ["$orderType", "Printing"] }, 1, 0] } },
        totalRevenue: { $sum: "$finalAmount" },
        avgOrderValue: { $avg: "$finalAmount" }
      }
    }
  ]);

  return stats[0] || {
    totalOrders: 0,
    pendingOrders: 0,
    inProgressOrders: 0,
    completedOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    dyingOrders: 0,
    printingOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0
  };
};

OrderSchema.statics.getRevenueStats = async function (startDate?: Date, endDate?: Date): Promise<any> {
  const matchStage: any = {};
  if (startDate && endDate) {
    matchStage.createdAt = { $gte: startDate, $lte: endDate };
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
        revenue: { $sum: "$finalAmount" },
        orders: { $sum: 1 },
        avgOrderValue: { $avg: "$finalAmount" }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);

  return stats;
};

// **VIRTUAL FIELDS**
OrderSchema.virtual('totalItems').get(function () {
  return this.items.length;
});

OrderSchema.virtual('totalQuantity').get(function () {
  return this.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
});

OrderSchema.virtual('orderSummary').get(function () {
  return {
    id: this._id,
    orderId: this.orderId,
    orderType: this.orderType,
    status: this.status,
    party: this.party,
    arrivalDate: this.arrivalDate,
    deliveryDate: this.deliveryDate,
    totalItems: this.items.length,
    totalQuantity: this.items.reduce((sum, item) => sum + (item.quantity || 0), 0),
    finalAmount: this.finalAmount,
    paymentStatus: this.paymentStatus,
    priority: this.priority,
    createdAt: this.createdAt
  };
});

// **MIDDLEWARE**
OrderSchema.pre('save', function (next) {
  // Calculate totals
  this.totalAmount = this.items.reduce((sum, item) => {
    const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
    item.totalPrice = itemTotal;
    return sum + itemTotal;
  }, 0);

  this.finalAmount = this.totalAmount + this.taxAmount - this.discountAmount;

  // Normalize tags
  if (this.metadata?.tags) {
    this.metadata.tags = [...new Set(this.metadata.tags.map(tag => tag.toLowerCase().trim()))];
  }

  next();
});

OrderSchema.post('save', function (error: any, doc: any, next: any) {
  if (error.name === 'MongoError' && error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    next(new Error(`${field} already exists`));
  } else {
    next(error);
  }
});

// **QUERY OPTIMIZATION**
// Note: We don't force lean() here anymore - let each query decide
// This allows for proper document methods when needed (e.g., save, validate)
// Use .lean() explicitly in read-only queries for performance

// Clear existing model to force schema recompilation
if (mongoose.models.Order) {
  delete mongoose.models.Order;
}

const Order = mongoose.model<IOrder, IOrderModel>("Order", OrderSchema);

export default Order;
