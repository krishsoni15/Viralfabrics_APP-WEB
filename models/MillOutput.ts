import mongoose, { Document, Schema, Model } from "mongoose";

// Mill Output interface
export interface IMillOutput extends Document {
  orderId: string;
  order: mongoose.Types.ObjectId;
  recdDate: Date;
  millBillNo: string;
  finishedMtr: number;
  millRate?: number;
  quality?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Static methods interface
export interface IMillOutputModel extends Model<IMillOutput> {
  findByOrderId(orderId: string): Promise<IMillOutput[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<IMillOutput[]>;
  getMillOutputStats(): Promise<any>;
}

// Mill Output Schema
const MillOutputSchema = new Schema<IMillOutput>({
  orderId: {
    type: String,
    required: [true, "Order ID is required"],
    index: true
  },
  order: {
    type: Schema.Types.ObjectId,
    ref: "Order",
    required: [true, "Order reference is required"],
    index: true
  },
  recdDate: {
    type: Date,
    required: [true, "Received date is required"],
    index: true
  },
  millBillNo: {
    type: String,
    required: [true, "Mill bill number is required"],
    trim: true,
    maxlength: [50, "Mill bill number cannot exceed 50 characters"]
  },
  finishedMtr: {
    type: Number,
    required: [true, "Finished meters is required"],
    min: [0, "Finished meters cannot be negative"]
  },
  millRate: {
    type: Number,
    min: [0, "Mill rate cannot be negative"]
  },
  quality: {
    type: Schema.Types.ObjectId,
    ref: "Quality",
    index: true
  }
}, {
  timestamps: true
});

// Indexes for better performance (removed duplicates that are already defined in schema)
// Removed duplicate indexes that are already defined in field definitions

// Static methods for MillOutput
MillOutputSchema.statics.findByOrderId = function(orderId: string) {
  return this.find({ orderId }).populate('order quality').sort({ recdDate: -1 });
};

MillOutputSchema.statics.findByDateRange = function(startDate: Date, endDate: Date) {
  return this.find({
    recdDate: {
      $gte: startDate,
      $lte: endDate
    }
  }).populate('order quality').sort({ recdDate: -1 });
};

MillOutputSchema.statics.getMillOutputStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalOutputs: { $sum: 1 },
        totalFinishedMtr: { $sum: "$finishedMtr" },
        avgFinishedMtr: { $avg: "$finishedMtr" },
      }
    }
  ]);
};

// Pre-save middleware for MillOutput
MillOutputSchema.pre('save', function(next) {
  if (this.isModified('millBillNo')) {
    this.millBillNo = this.millBillNo.trim();
  }
  next();
});

// Export model
const MillOutput = mongoose.models.MillOutput || mongoose.model<IMillOutput, IMillOutputModel>("MillOutput", MillOutputSchema);

export { MillOutput };
export default MillOutput;
