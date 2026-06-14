import mongoose, { Schema, Document } from 'mongoose';

export interface IGreyMaterial extends Document {
  qualityCode: string;
  qualityName: string;
  type?: string;
  weaver?: string; // Corresponds to Name
  challanNumber?: string;
  piece?: number;
  meter?: number;
  images?: string[];
  weaverQualityName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GreyMaterialSchema = new Schema<IGreyMaterial>({
  qualityCode: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  qualityName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  type: {
    type: String,
    required: false,
    default: '',
  },
  weaver: {
    type: String,
    required: false,
    default: '',
  },
  challanNumber: {
    type: String,
    required: false,
    default: '',
  },
  piece: {
    type: Number,
    required: false,
    default: 0,
  },
  meter: {
    type: Number,
    required: false,
    default: 0,
  },
  images: {
    type: [String],
    required: false,
    default: []
  },
  weaverQualityName: {
    type: String,
    required: false,
    default: '',
  }
}, {
  timestamps: true
});

// Indexes for common queries
GreyMaterialSchema.index({ qualityCode: 1 });
GreyMaterialSchema.index({ qualityName: 1 });
GreyMaterialSchema.index({ weaver: 1 });
GreyMaterialSchema.index({ createdAt: -1 });

// Text search index
GreyMaterialSchema.index({ 
  qualityName: "text",
  qualityCode: "text",
  weaver: "text",
}, {
  weights: {
    qualityName: 10,
    qualityCode: 5,
    weaver: 5,
  },
  name: "grey_material_text_search"
});

// Force model reset to ensure schema changes take effect
const modelName = 'GreyMaterial';
if (mongoose.models[modelName]) {
  delete mongoose.models[modelName];
}

// Also clear the model from the connection
if (mongoose.connection.models[modelName]) {
  delete (mongoose.connection.models as any)[modelName];
}

export default mongoose.model<IGreyMaterial>(modelName, GreyMaterialSchema);
