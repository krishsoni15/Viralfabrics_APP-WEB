import mongoose, { Schema, Document } from 'mongoose';

export interface ISamplingWeaver extends Document {
  name: string;
  phone?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SamplingWeaverSchema = new Schema<ISamplingWeaver>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  phone: {
    type: String,
    required: false,
    trim: true,
    maxlength: 20,
    default: ''
  },
  address: {
    type: String,
    required: false,
    trim: true,
    maxlength: 500,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for common queries
SamplingWeaverSchema.index({ name: 1 });
SamplingWeaverSchema.index({ createdAt: -1 });

export default mongoose.models.SamplingWeaver || mongoose.model<ISamplingWeaver>('SamplingWeaver', SamplingWeaverSchema);

