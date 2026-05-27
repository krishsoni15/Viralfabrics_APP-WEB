import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for Dispatch document
export interface IDispatch extends Document {
  orderId: string;
  order: mongoose.Types.ObjectId;
  dispatchDate: Date;
  billNo: string;
  transportNo?: string;
  lrNo?: string;
  finishMtr: number;
  saleRate?: number;
  quality?: mongoose.Types.ObjectId;
  totalValue: number;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for Dispatch model
export interface IDispatchModel extends Model<IDispatch> {
  // Add any static methods here if needed
}

// Dispatch Schema
const DispatchSchema = new Schema<IDispatch>({
  orderId: {
    type: String,
    required: true,
    index: true
  },
  order: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  dispatchDate: {
    type: Date,
    required: true,
    index: true
  },
  billNo: {
    type: String,
    required: true,
    trim: true
  },
  transportNo: {
    type: String,
    required: false,
    trim: true,
    default: ''
  },
  lrNo: {
    type: String,
    required: false,
    trim: true,
    default: ''
  },
  finishMtr: {
    type: Number,
    required: true,
    min: 0
  },
  saleRate: {
    type: Number,
    required: false,
    min: 0,
    default: 0
  },
  quality: {
    type: Schema.Types.ObjectId,
    ref: "Quality",
    index: true
  },
  totalValue: {
    type: Number,
    required: false,
    min: 0,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Calculate total value before saving
DispatchSchema.pre('save', function(next) {
  try {
    // Always calculate totalValue if both finishMtr and saleRate are present
    if (typeof this.finishMtr === 'number' && typeof this.saleRate === 'number') {
      this.totalValue = this.finishMtr * this.saleRate;
    } else if (this.finishMtr && this.saleRate) {
      // Fallback for string values that need to be converted
      this.totalValue = Number(this.finishMtr) * Number(this.saleRate);
    } else {
      // Set default value if calculation is not possible
      this.totalValue = 0;
    }
  } catch (error) {
    this.totalValue = 0;
  }
  next();
});

// Indexes for better performance
DispatchSchema.index({ dispatchDate: -1 }, { name: 'idx_dispatch_date_desc' });
DispatchSchema.index({ billNo: 1 }, { name: 'idx_dispatch_bill_no' });
DispatchSchema.index({ finishMtr: -1 }, { name: 'idx_dispatch_finish_mtr' });
DispatchSchema.index({ saleRate: -1 }, { name: 'idx_dispatch_sale_rate' });
DispatchSchema.index({ totalValue: -1 }, { name: 'idx_dispatch_total_value' });
DispatchSchema.index({ createdAt: -1 }, { name: 'idx_dispatch_created_desc' });
DispatchSchema.index({ updatedAt: -1 }, { name: 'idx_dispatch_updated_desc' });

// Export model
const Dispatch = mongoose.models.Dispatch || mongoose.model<IDispatch, IDispatchModel>('Dispatch', DispatchSchema);

export default Dispatch;
