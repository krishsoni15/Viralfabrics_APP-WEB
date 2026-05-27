import mongoose, { Schema, Document } from 'mongoose';

export interface IFabric extends Document {
  qualityCode: string;
  qualityName: string;
  type: string; // Polyester, Blend, Viscose, Cotton, Rayon, Other
  weaver: string;
  weaverQualityName: string;
  rack?: string;
  greighWidth: number;
  finishWidth: number;
  weight: number;
  gsm: number;
  content: string;
  danier: string;
  count: number;
  reed: number;
  pick: number;
  greighRate: number;
  label: string;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

const FabricSchema = new Schema<IFabric>({
  qualityCode: {
    type: String,
    required: false,
    trim: true,
    maxlength: 50,
    default: ''
  },
  qualityName: {
    type: String,
    required: false,
    trim: true,
    maxlength: 100,
    default: ''
  },
  type: {
    type: String,
    required: false,
    default: '',
    validate: {
      validator: function(value: string) {
        // ⚡ FIX: Allow empty string or valid enum values
        if (!value || value.trim() === '') return true;
        return ['Polyester', 'Blend', 'Viscose', 'Cotton', 'Rayon', 'Other'].includes(value);
      },
      message: 'Type must be one of: Polyester, Blend, Viscose, Cotton, Rayon, Other, or empty'
    }
  },
  weaver: {
    type: String,
    required: false,
    trim: true,
    maxlength: 100,
    default: ''
  },
  weaverQualityName: {
    type: String,
    required: false,
    trim: true,
    maxlength: 100,
    default: ''
  },
  rack: {
    type: String,
    required: false,
    trim: true,
    maxlength: 100,
    default: ''
  },
  greighWidth: {
    type: Number,
    required: false,
    default: 0
  },
  finishWidth: {
    type: Number,
    required: false,
    default: 0
  },
  weight: {
    type: Number,
    required: false,
    default: 0
  },
  gsm: {
    type: Number,
    required: false,
    default: 0
  },
  content: {
    type: String,
    required: false,
    trim: true,
    maxlength: 100,
    default: ''
  },
  danier: {
    type: String,
    required: false,
    trim: true,
    maxlength: 50,
    default: ''
  },
  count: {
    type: Number,
    required: false,
    default: 0
  },
  reed: {
    type: Number,
    required: false,
    default: 0
  },
  pick: {
    type: Number,
    required: false,
    default: 0
  },
  greighRate: {
    type: Number,
    required: false,
    default: 0
  },
  label: {
    type: String,
    required: false,
    trim: true,
    maxlength: 500,
    default: ''
  },
  images: {
    type: [String],
    required: false,
    default: []
  }
}, {
  timestamps: true
});

// Indexes for common queries
FabricSchema.index({ qualityCode: 1 }, { sparse: true });
FabricSchema.index({ qualityName: 1 });
FabricSchema.index({ weaver: 1 });
FabricSchema.index({ weaverQualityName: 1 });
FabricSchema.index({ createdAt: -1 });
FabricSchema.index({ updatedAt: -1 });

// Text search index
FabricSchema.index({ 
  qualityName: "text",
  weaverQualityName: "text",
  weaver: "text"
}, {
  weights: {
    qualityName: 10,
    weaverQualityName: 8,
    weaver: 5
  },
  name: "fabric_text_search"
});

// Auto-generate label before saving
FabricSchema.pre('save', function(next) {
  if (this.isModified()) {
    this.label = `QUALITY CODE : ${this.qualityCode}\n${this.qualityName} ${this.weaverQualityName}\nWEIGHT: ${this.weight} KG , GSM : ${this.gsm}\nWIDTH: ${this.finishWidth}"`;
  }
  next();
});

// Force model reset to ensure schema changes take effect
const modelName = 'Fabric';
if (mongoose.models[modelName]) {
  delete mongoose.models[modelName];
}

  // Also clear the model from the connection
  if (mongoose.connection.models[modelName]) {
    delete (mongoose.connection.models as any)[modelName];
  }

export default mongoose.model<IFabric>(modelName, FabricSchema);
