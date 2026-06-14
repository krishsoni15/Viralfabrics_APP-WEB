import mongoose, { Schema, Document } from 'mongoose';

export interface ISampling extends Document {
  qualityName: string;
  images?: string[];
  notes?: string;
  meter?: number;
  piece?: number;
  createdAt: Date;
  updatedAt: Date;
}

const SamplingSchema = new Schema<ISampling>({
  qualityName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  images: {
    type: [String],
    required: false,
    default: []
  },
  notes: {
    type: String,
    required: false,
    trim: true,
    maxlength: 1000
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
SamplingSchema.index({ qualityName: 1 });
SamplingSchema.index({ createdAt: -1 });

// Text search index
SamplingSchema.index({ 
  qualityName: "text",
  notes: "text"
}, {
  weights: {
    qualityName: 10,
    notes: 5
  },
  name: "sampling_text_search"
});

// Force model reset to ensure schema changes take effect
const modelName = 'Sampling';
if (mongoose.models[modelName]) {
  delete mongoose.models[modelName];
}

// Also clear the model from the connection
if (mongoose.connection.models[modelName]) {
  delete (mongoose.connection.models as any)[modelName];
}

export default mongoose.model<ISampling>(modelName, SamplingSchema);
