import mongoose, { Schema, Document } from 'mongoose';

export interface IFinishLotStock extends Document {
  qualityName: string;
  lotType: 'RFD' | 'OTHER';
  sequence: string;
  weaverName?: string;
  weaverQuality?: string;
  millName?: string;
  processInMill?: string;
  images?: string[];
  meter?: number;
  piece?: number;
  createdAt: Date;
  updatedAt: Date;
}

const FinishLotStockSchema = new Schema<IFinishLotStock>({
  qualityName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  lotType: {
    type: String,
    enum: ['RFD', 'OTHER'],
    required: true,
    default: 'OTHER'
  },
  sequence: {
    type: String,
    required: true,
    unique: true
  },
  weaverName: {
    type: String,
    required: false,
    trim: true
  },
  weaverQuality: {
    type: String,
    required: false,
    trim: true
  },
  millName: {
    type: String,
    required: false,
    trim: true
  },
  processInMill: {
    type: String,
    required: false,
    trim: true
  },
  images: {
    type: [String],
    required: false,
    default: []
  },
  meter: {
    type: Number,
    required: false,
    default: 0
  },
  piece: {
    type: Number,
    required: false,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for common queries
FinishLotStockSchema.index({ qualityName: 1 });
FinishLotStockSchema.index({ createdAt: -1 });

// Text search index
FinishLotStockSchema.index({ 
  qualityName: "text"
}, {
  weights: {
    qualityName: 10
  },
  name: "finish_lot_stock_text_search"
});

// Force model reset to ensure schema changes take effect
const modelName = 'FinishLotStock';
if (mongoose.models[modelName]) {
  delete mongoose.models[modelName];
}

// Also clear the model from the connection
if (mongoose.connection.models[modelName]) {
  delete (mongoose.connection.models as any)[modelName];
}

export default mongoose.model<IFinishLotStock>(modelName, FinishLotStockSchema);
