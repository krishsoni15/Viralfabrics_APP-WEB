import mongoose, { Document, Schema, Model } from "mongoose";

// Mill interface
export interface IMill extends Document {
  name: string;
  contactPerson?: string;
  contactPhone?: string;
  address?: string;
  email?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Mill Input interface
export interface IMillInput extends Document {
  orderId: string;
  order: mongoose.Types.ObjectId;
  mill: mongoose.Types.ObjectId;
  millDate: Date;
  chalanNo: string;
  greighMtr: number;
  pcs: number;
  quality?: mongoose.Types.ObjectId;
  processName?: string;
  process?: mongoose.Types.ObjectId;
  additionalMeters?: Array<{
    greighMtr: number;
    pcs: number;
    quality?: mongoose.Types.ObjectId;
    processName?: string;
    process?: mongoose.Types.ObjectId;
    notes?: string;
  }>;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Static methods interface
export interface IMillModel extends Model<IMill> {
  findByName(name: string): Promise<IMill | null>;
  findActiveMills(): Promise<IMill[]>;
  searchMills(searchTerm: string): Promise<IMill[]>;
}

export interface IMillInputModel extends Model<IMillInput> {
  findByOrderId(orderId: string): Promise<IMillInput[]>;
  findByMill(millId: string): Promise<IMillInput[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<IMillInput[]>;
  getMillInputStats(): Promise<any>;
}

// Mill Schema
const MillSchema = new Schema<IMill>({
  name: {
    type: String,
    required: [true, "Mill name is required"],
    trim: true,
    maxlength: [100, "Mill name cannot exceed 100 characters"],
    unique: true,
    index: true
  },
  contactPerson: {
    type: String,
    trim: true,
    maxlength: [50, "Contact person name cannot exceed 50 characters"]
  },
  contactPhone: {
    type: String,
    trim: true,
    maxlength: [20, "Contact phone cannot exceed 20 characters"]
  },
  address: {
    type: String,
    trim: true,
    maxlength: [200, "Address cannot exceed 200 characters"]
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [100, "Email cannot exceed 100 characters"]
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

// Mill Input Schema
const MillInputSchema = new Schema<IMillInput>({
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
  mill: {
    type: Schema.Types.ObjectId,
    ref: "Mill",
    required: [true, "Mill reference is required"],
    index: true
  },
  millDate: {
    type: Date,
    required: [true, "Mill date is required"],
    index: true
  },
  chalanNo: {
    type: String,
    required: [true, "Chalan number is required"],
    trim: true,
    maxlength: [50, "Chalan number cannot exceed 50 characters"]
  },
  greighMtr: {
    type: Number,
    required: [true, "Greigh meters is required"],
    min: [0, "Greigh meters cannot be negative"]
  },
  pcs: {
    type: Number,
    required: [true, "Number of pieces is required"],
    min: [1, "Number of pieces must be at least 1"]
  },
  quality: {
    type: Schema.Types.ObjectId,
    ref: "Quality",
    index: true
  },
  processName: {
    type: String,
    trim: true,
    maxlength: [100, "Process name cannot exceed 100 characters"]
  },
  process: {
    type: Schema.Types.ObjectId,
    ref: "Process",
    index: true
  },
  additionalMeters: [
    {
      greighMtr: {
        type: Number,
        required: [true, "Additional greigh meters is required"],
        min: [0, "Additional greigh meters cannot be negative"]
      },
      pcs: {
        type: Number,
        required: [true, "Additional pieces is required"],
        min: [1, "Additional pieces must be at least 1"]
      },
      quality: {
        type: Schema.Types.ObjectId,
        ref: "Quality"
      },
      processName: {
        type: String,
        trim: true,
        maxlength: [100, "Process name cannot exceed 100 characters"]
      },
      process: {
        type: Schema.Types.ObjectId,
        ref: "Process"
      },
      notes: {
        type: String,
        trim: true,
        maxlength: [500, "Additional notes cannot exceed 500 characters"]
      }
    }
  ],
  notes: {
    type: String,
    trim: true,
    maxlength: [500, "Notes cannot exceed 500 characters"]
  }
}, {
  timestamps: true
});

// Indexes for better performance
// Removed duplicate indexes that are already defined in field definitions

// Static methods for Mill
MillSchema.statics.findByName = function(name: string) {
  return this.findOne({ name: { $regex: name, $options: 'i' } });
};

MillSchema.statics.findActiveMills = function() {
  return this.find({ isActive: true }).sort({ name: 1 });
};

MillSchema.statics.searchMills = function(searchTerm: string) {
  return this.find({
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { contactPerson: { $regex: searchTerm, $options: 'i' } },
      { contactPhone: { $regex: searchTerm, $options: 'i' } }
    ]
  }).sort({ name: 1 });
};

// Static methods for MillInput
MillInputSchema.statics.findByOrderId = function(orderId: string) {
  return this.find({ orderId }).populate('mill').sort({ millDate: -1 });
};

MillInputSchema.statics.findByMill = function(millId: string) {
  return this.find({ mill: millId }).populate('order').sort({ millDate: -1 });
};

MillInputSchema.statics.findByDateRange = function(startDate: Date, endDate: Date) {
  return this.find({
    millDate: {
      $gte: startDate,
      $lte: endDate
    }
  }).populate('mill order').sort({ millDate: -1 });
};

MillInputSchema.statics.getMillInputStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalInputs: { $sum: 1 },
        totalGreighMtr: { $sum: "$greighMtr" },
        totalPcs: { $sum: "$pcs" },
        avgGreighMtr: { $avg: "$greighMtr" },
        avgPcs: { $avg: "$pcs" }
      }
    }
  ]);
};

// Pre-save middleware for Mill
MillSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.name = this.name.trim();
  }
  next();
});

// Pre-save middleware for MillInput
MillInputSchema.pre('save', function(next) {
  if (this.isModified('chalanNo')) {
    this.chalanNo = this.chalanNo.trim();
  }
  next();
});

// Export models
const Mill = mongoose.models.Mill || mongoose.model<IMill, IMillModel>("Mill", MillSchema);
const MillInput = mongoose.models.MillInput || mongoose.model<IMillInput, IMillInputModel>("MillInput", MillInputSchema);

export { Mill, MillInput };
export default Mill;
