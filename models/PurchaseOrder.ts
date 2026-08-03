import mongoose, { Document, Schema, Model } from "mongoose";
import "./User";

export interface IPurchaseOrderSpecs {
  finishGsm?: string;
  greyWidth?: string;
  finishWidth?: string;
  weight?: string;
}

export interface IPurchaseOrder extends Document {
  companyHeader: 'Viral Fabrics' | 'Viral Enterprise';
  poNumber: string;
  poDate: Date;
  brokerName?: string;
  brokerPhone?: string;
  supplierName?: string;
  supplierAddress?: string;
  supplierGstin?: string;
  supplierPhone?: string;
  quality?: string;
  pcsMtr?: string;
  delivery?: string;
  rate?: string;
  greighMtr?: string;
  greighLeadTime?: string;
  images?: string[];
  paymentTerms?: string;
  specs: IPurchaseOrderSpecs;
  notes?: string;
  financialYear: string;
  createdBy: mongoose.Types.ObjectId;
  softDeleted: boolean;
  status: 'Pending' | 'Completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface IPurchaseOrderModel extends Model<IPurchaseOrder> {
  findActive(filter?: Record<string, unknown>): Promise<IPurchaseOrder[]>;
}

const PurchaseOrderSchema = new Schema<IPurchaseOrder>({
  companyHeader: {
    type: String,
    required: [true, "Company header is required"],
    enum: {
      values: ['Viral Fabrics', 'Viral Enterprise'],
      message: "Company header must be 'Viral Fabrics' or 'Viral Enterprise'"
    },
    index: true
  },
  poNumber: {
    type: String,
    required: [true, "PO number is required"],
    trim: true,
    index: true
  },
  poDate: {
    type: Date,
    required: [true, "PO date is required"],
    index: true
  },
  brokerName: {
    type: String,
    trim: true,
    maxlength: [200, "Broker name cannot exceed 200 characters"]
  },
  brokerPhone: {
    type: String,
    trim: true,
    maxlength: [20, "Broker phone cannot exceed 20 characters"]
  },
  supplierName: {
    type: String,
    trim: true,
    maxlength: [300, "Supplier name cannot exceed 300 characters"]
  },
  supplierAddress: {
    type: String,
    trim: true,
    maxlength: [500, "Supplier address cannot exceed 500 characters"]
  },
  supplierGstin: {
    type: String,
    trim: true,
    uppercase: true,
    maxlength: [20, "Supplier GSTIN cannot exceed 20 characters"]
  },
  supplierPhone: {
    type: String,
    trim: true,
    maxlength: [20, "Supplier phone cannot exceed 20 characters"]
  },
  quality: {
    type: String,
    trim: true,
    maxlength: [300, "Quality cannot exceed 300 characters"]
  },
  pcsMtr: {
    type: String,
    trim: true,
    maxlength: [50, "Pcs/Mtr cannot exceed 50 characters"]
  },
  delivery: {
    type: String,
    trim: true,
    maxlength: [200, "Delivery cannot exceed 200 characters"]
  },
  rate: {
    type: String,
    trim: true,
    maxlength: [100, "Rate cannot exceed 100 characters"]
  },
  greighMtr: {
    type: String,
    trim: true,
    maxlength: [50, "Greigh meters cannot exceed 50 characters"]
  },
  greighLeadTime: {
    type: String,
    trim: true,
    maxlength: [100, "Greigh lead time cannot exceed 100 characters"]
  },
  images: {
    type: [String],
    default: []
  },
  paymentTerms: {
    type: String,
    trim: true,
    maxlength: [2000, "Payment terms cannot exceed 2000 characters"]
  },
  specs: {
    finishGsm: { type: String, trim: true, maxlength: 50 },
    greyWidth: { type: String, trim: true, maxlength: 50 },
    finishWidth: { type: String, trim: true, maxlength: 50 },
    weight: { type: String, trim: true, maxlength: 50 }
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, "Notes cannot exceed 1000 characters"]
  },
  financialYear: {
    type: String,
    required: [true, "Financial year is required"],
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  softDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed'],
    default: 'Pending',
    index: true
  }
}, {
  timestamps: true,
  collection: 'purchaseorders',
  toJSON: {
    transform: function (doc, ret: any) {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    transform: function (doc, ret: any) {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Compound indexes
PurchaseOrderSchema.index({ companyHeader: 1, financialYear: 1, poNumber: 1 }, { name: 'idx_po_company_fy_number' });
PurchaseOrderSchema.index({ softDeleted: 1, createdAt: -1 }, { name: 'idx_po_active_created' });
PurchaseOrderSchema.index({ companyHeader: 1, softDeleted: 1, createdAt: -1 }, { name: 'idx_po_company_active_created' });

// Text search index
PurchaseOrderSchema.index({
  poNumber: "text",
  brokerName: "text",
  supplierName: "text",
  quality: "text",
  notes: "text"
}, {
  weights: {
    poNumber: 10,
    supplierName: 8,
    brokerName: 6,
    quality: 4,
    notes: 2
  },
  name: "idx_po_text_search"
});

// Static methods
PurchaseOrderSchema.statics.findActive = function (filter: Record<string, unknown> = {}) {
  return this.find({
    ...filter,
    $or: [
      { softDeleted: false },
      { softDeleted: { $exists: false } }
    ]
  }).sort({ createdAt: -1 }).lean();
};

if (mongoose.models.PurchaseOrder) {
  delete mongoose.models.PurchaseOrder;
}

const PurchaseOrder = mongoose.model<IPurchaseOrder, IPurchaseOrderModel>("PurchaseOrder", PurchaseOrderSchema);

export default PurchaseOrder;
