import mongoose, { Schema, Document } from 'mongoose';

export interface IQualityName extends Document {
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const QualityNameSchema = new Schema<IQualityName>({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100
  }
}, {
  timestamps: true
});

export default mongoose.models.QualityName || mongoose.model<IQualityName>('QualityName', QualityNameSchema);
