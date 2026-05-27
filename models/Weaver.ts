import mongoose, { Schema, Document } from 'mongoose';

export interface IWeaver extends Document {
  name: string;
  qualityNameId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WeaverSchema = new Schema<IWeaver>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  qualityNameId: {
    type: Schema.Types.ObjectId,
    ref: 'QualityName',
    required: true
  }
}, {
  timestamps: true
});

export default mongoose.models.Weaver || mongoose.model<IWeaver>('Weaver', WeaverSchema);
