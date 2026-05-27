import mongoose, { Schema, Document } from 'mongoose';

export interface IWeaverQualityName extends Document {
  name: string;
  weaverId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WeaverQualityNameSchema = new Schema<IWeaverQualityName>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  weaverId: {
    type: Schema.Types.ObjectId,
    ref: 'Weaver',
    required: true
  }
}, {
  timestamps: true
});

export default mongoose.models.WeaverQualityName || mongoose.model<IWeaverQualityName>('WeaverQualityName', WeaverQualityNameSchema);
