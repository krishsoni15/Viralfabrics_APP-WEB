import mongoose, { Schema, Document } from 'mongoose';

export interface ISample extends Document {
  weaverId: mongoose.Types.ObjectId;
  qualityName: string;
  type: string; // Polyester, Blend, Viscose, Cotton, Rayon, Other
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
  note?: string;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

const SampleSchema = new Schema<ISample>({
  weaverId: {
    type: Schema.Types.ObjectId,
    ref: 'SamplingWeaver',
    required: true
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
    validate: {
      validator: function(value: string) {
        if (!value || value.trim() === '') return true;
        const validTypes = ['Polyester', 'Blend', 'Viscose', 'Cotton', 'Rayon', 'Other'];
        // Case-insensitive validation
        return validTypes.some(
          validType => validType.toLowerCase() === value.trim().toLowerCase()
        );
      },
      message: 'Type must be one of: Polyester, Blend, Viscose, Cotton, Rayon, Other, or empty'
    },
    set: function(value: string) {
      // Normalize to correct case on save
      if (!value || value.trim() === '') return '';
      const validTypes = ['Polyester', 'Blend', 'Viscose', 'Cotton', 'Rayon', 'Other'];
      const matchedType = validTypes.find(
        validType => validType.toLowerCase() === value.trim().toLowerCase()
      );
      return matchedType || value.trim();
    }
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
    default: 0,
    min: [0, 'Greigh width cannot be negative']
  },
  finishWidth: {
    type: Number,
    required: false,
    default: 0,
    min: [0, 'Finish width cannot be negative']
  },
  weight: {
    type: Number,
    required: false,
    default: 0,
    min: [0, 'Weight cannot be negative']
  },
  gsm: {
    type: Number,
    required: false,
    default: 0,
    min: [0, 'GSM cannot be negative']
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
    default: 0,
    min: [0, 'Count cannot be negative']
  },
  reed: {
    type: Number,
    required: false,
    default: 0,
    min: [0, 'Reed cannot be negative']
  },
  pick: {
    type: Number,
    required: false,
    default: 0,
    min: [0, 'Pick cannot be negative']
  },
  greighRate: {
    type: Number,
    required: false,
    default: 0,
    min: [0, 'Greigh rate cannot be negative']
  },
  label: {
    type: String,
    required: false,
    trim: true,
    maxlength: 500,
    default: ''
  },
  note: {
    type: String,
    required: false,
    trim: true,
    maxlength: 1000,
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
SampleSchema.index({ weaverId: 1 });
SampleSchema.index({ qualityName: 1 });
SampleSchema.index({ createdAt: -1 });
// Text index for search queries (qualityName, type, content)
SampleSchema.index({ qualityName: 'text', type: 'text', content: 'text' });
// Compound index for weaver-specific queries with sorting
SampleSchema.index({ weaverId: 1, createdAt: -1 });

export default mongoose.models.Sample || mongoose.model<ISample>('Sample', SampleSchema);

